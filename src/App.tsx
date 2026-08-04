import { useMemo, useState, useEffect, useRef } from "react";
import {
  playNow, addJob, clearJobs, setBpm,
  startClock, stopClock, clockRunning, ARPEGGIO_SPREAD,
} from "./audio/engine";
import Spectrum from "./components/Spectrum";

/**
 * Pentomino Music — minimal playable prototype
 * - Left: palette of 12 pentomino pieces (F, I, L, N, P, T, U, V, W, X, Y, Z)
 * - Center: grid (10x6 by default). Click a cell to place the selected piece if it fits.
 * - Right: controls for rotation (0/90/180/270), reflection (on/off), clock, tempo.
 * - Audio: when a piece is placed, we generate its 5-note pentatonic sequence according to the rotation/reflection policy
 *          and play it. Optionally "Loop placed" makes each placed piece re-trigger every bar.
 *
 * Policies (as acordado):
 *  rotation 0°  -> major pentatonic (0,2,4,7,9)
 *  rotation 90° -> minor pentatonic (0,3,5,7,10)
 *  rotation 180°-> minor pent + blue (0,3,5,6,7)
 *  rotation 270°-> major pent transposed +7 semitones
 *  reflection -> retrograde (reverse order of the 5 notes)
 */

type Cell = [number, number];
const CHROMATIC = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;
const PENT_MAJOR: number[] = [0,2,4,7,9];
const PENT_MINOR: number[] = [0,3,5,7,10];
const PENT_BLUES5: number[] = [0,3,5,6,7];

// Base mapping piece -> pitch class (F->C, I->C#, ..., Z->B)
const BASE_MAP = { F:0, I:1, L:2, N:3, P:4, T:5, U:6, V:7, W:8, X:9, Y:10, Z:11 } as const;
type PieceKey = keyof typeof BASE_MAP;

// Canonical coordinates per piece (5 cells). Each cell is [x,y].
const SHAPES: Record<PieceKey, Cell[]> = {
  F: [[0,1],[1,0],[1,1],[1,2],[2,2]],
  I: [[0,0],[1,0],[2,0],[3,0],[4,0]],
  L: [[0,0],[0,1],[0,2],[0,3],[1,0]],
  N: [[0,0],[1,0],[1,1],[2,1],[3,1]],
  P: [[0,0],[0,1],[1,0],[1,1],[2,0]],
  T: [[0,0],[1,0],[2,0],[1,1],[1,2]],
  U: [[0,0],[0,1],[1,0],[2,0],[2,1]],
  V: [[0,0],[0,1],[0,2],[1,0],[2,0]],
  W: [[0,0],[1,0],[1,1],[2,1],[2,2]],
  X: [[1,0],[0,1],[1,1],[2,1],[1,2]],
  Y: [[0,0],[1,0],[2,0],[3,0],[2,1]],
  Z: [[0,1],[1,1],[1,0],[2,0],[3,0]],
};

// Celda "de agarre": la que queda bajo el cursor al colocar la pieza. Se guarda
// como índice dentro de SHAPES[pieza] en vez de como coordenada porque rotar,
// reflejar y normalizar mapean cada celda preservando el orden del array, así
// que el índice sigue apuntando a la misma celda después de transformar.
// Se eligió en cada pieza una celda central, para que el click caiga sobre
// masa de la pieza y no sobre un hueco de su bounding box.
const ANCHOR_INDEX: Record<PieceKey, number> = {
  F: 2, I: 2, L: 1, N: 2, P: 2, T: 3, U: 2, V: 0, W: 2, X: 2, Y: 2, Z: 1,
};

function rotate90(cells: Cell[]): Cell[] { return cells.map(([x,y]): Cell => [y, -x]); }
function normalize(cells: Cell[]): Cell[]{
  const minx = Math.min(...cells.map(c=>c[0]));
  const miny = Math.min(...cells.map(c=>c[1]));
  return cells.map(([x,y]) => [x-minx, y-miny]);
}
function rotateN(cells: Cell[], n: number): Cell[]{ let r = normalize(cells); for(let i=0;i<n;i++) r = normalize(rotate90(r)); return r; }
function reflect(cells: Cell[]): Cell[]{ // vertical mirror x->-x
  const refl: Cell[] = cells.map(([x,y]): Cell => [-x, y]);
  return normalize(refl);
}

function midiFor(pc: number, octave: number): number { return 12*(octave+1) + pc; }
function midiName(m: number): string { const pc = m%12; const o = Math.floor(m/12)-1; return `${CHROMATIC[pc]}${o}`; }

function notesForRotation(basePc: number, octave: number, rot: number): number[]{
  let formula = PENT_MAJOR, transpose=0;
  if (rot===1) formula = PENT_MINOR;
  else if (rot===2) formula = PENT_BLUES5;
  else if (rot===3) { formula = PENT_MAJOR; transpose = 7; }
  return formula.map(iv => {
    const total = basePc + iv + transpose;
    const pc = ((total%12)+12)%12;
    const octShift = Math.floor((basePc + iv + transpose)/12);
    return midiFor(pc, octave + octShift);
  });
}

// El sonido lo produce src/audio/engine.ts. Ver docs/architecture/audio.md.

// Board state
const GRID_W = 10; const GRID_H = 6;

interface PlacedPiece {
  id: string;
  piece: PieceKey;
  rotation: number;
  mirror: boolean;
  cells: Cell[];
  notes: number[];
}

export default function App(){
  const [selected, setSelected] = useState<PieceKey>('F');
  const [rotation, setRotation] = useState<number>(0); // 0..3
  const [mirror, setMirror] = useState<boolean>(false);
  const [tempo, setTempo] = useState<number>(110);
  const [loopPlaced, setLoopPlaced] = useState<boolean>(false);

  // placed pieces
  const [placed, setPlaced] = useState<PlacedPiece[]>([]);

  // celda del tablero bajo el cursor, para el fantasma de previsualización
  const [hover, setHover] = useState<Cell | null>(null);

  const idRef = useRef(0);

  useEffect(()=>{ setBpm(tempo); }, [tempo]);

  const transformedShape = useMemo(()=>{
    let c = SHAPES[selected];
    c = rotateN(c, rotation);
    if (mirror) c = reflect(c);
    return c; // normalized
  }, [selected, rotation, mirror]);

  const noteSet = useMemo(()=>{
    const basePc = BASE_MAP[selected];
    let ns = notesForRotation(basePc, 4, rotation);
    if (mirror) ns = [...ns].reverse();
    return ns;
  }, [selected, rotation, mirror]);

  // Celda de agarre ya transformada: el click en (x,y) la deja justo ahí.
  const anchor = transformedShape[ANCHOR_INDEX[selected]];

  // Celdas del tablero que ocuparía la pieza si se la coloca apuntando a (x,y).
  function cellsAt(x: number, y: number): Cell[]{
    const ox = x - anchor[0];
    const oy = y - anchor[1];
    return transformedShape.map(([cx,cy]): Cell => [cx+ox, cy+oy]);
  }

  function isValid(cells: Cell[]): boolean{
    if (cells.some(([x,y])=> x<0 || y<0 || x>=GRID_W || y>=GRID_H)) return false;
    for (const p of placed){
      const set = new Set(p.cells.map(([x,y])=>`${x},${y}`));
      if (cells.some(([x,y])=> set.has(`${x},${y}`))) return false;
    }
    return true;
  }

  function handleCellClick(x: number, y: number){
    const cells = cellsAt(x,y);
    if (!isValid(cells)) return;
    const newPiece: PlacedPiece = {
      id: String(++idRef.current),
      piece: selected, rotation, mirror, cells, notes: noteSet,
    };
    setPlaced(prev => [...prev, newPiece]);
    playNow(noteSet);
  }

  function resetBoard(){
    setPlaced([]); // el efecto de sincronización se encarga de cancelar los loops
  }

  // Reconcilia los loops contra el tablero. Al ser declarativo cubre por igual
  // colocar, quitar, resetear y prender/apagar el checkbox — antes cada uno de
  // esos caminos tenía que acordarse de limpiar por su cuenta, y no lo hacían.
  //
  // Limpia y re-agrega todo en vez de diffear, y es seguro porque la fase de los
  // loops NO vive en los jobs: vive en el cursor del reloj, que esto no toca. Los
  // jobs son datos puros que el scheduler lee, no eventos con identidad.
  //
  // Tampoco hace falta el flag de cancelación que pedía Tone: addJob y clearJobs
  // son sincrónicos, así que no hay promesa que pueda resolver después de que el
  // efecto se limpió.
  useEffect(()=>{
    clearJobs();
    if (!loopPlaced) return;
    for (const p of placed) addJob({ id: p.id, notes: p.notes, spread: ARPEGGIO_SPREAD, phase: 0 });
  }, [placed, loopPlaced]);

  // Al desmontar, frenar el reloj y soltar los jobs. La limpieza es sincrónica:
  // si fuera asincrónica, en StrictMode podría ejecutarse después de que el
  // efecto de arriba ya volvió a agendar, y cancelaría los jobs nuevos.
  useEffect(()=> ()=>{ stopClock(); clearJobs(); }, []);

  function toggleClock(){
    if (clockRunning()) stopClock(); else startClock();
  }

  // helpers for UI
  function cellOccupied(x: number, y: number): PlacedPiece | null {
    for (const p of placed){
      if (p.cells.some(([cx,cy])=> cx===x && cy===y)) return p;
    }
    return null;
  }

  // Fantasma: dónde caería la pieza desde la celda bajo el cursor. Las celdas
  // fuera del tablero no se pintan, pero sí cuentan para marcar la jugada
  // como inválida.
  const previewCells = hover? cellsAt(hover[0], hover[1]) : [];
  const previewValid = hover? isValid(previewCells) : false;
  const previewSet = new Set(previewCells.map(([x,y])=> `${x},${y}`));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-4">
        {/* Left: palette */}
        <div className="col-span-12 md:col-span-3 bg-white rounded-2xl shadow p-3">
          <h2 className="text-lg font-semibold mb-2">Piezas</h2>
          <div className="grid grid-cols-6 gap-2">
            {(Object.keys(SHAPES) as PieceKey[]).map(key=> (
              <button
                key={key}
                onClick={()=> setSelected(key)}
                className={`px-2 py-1 rounded-lg border text-sm ${selected===key? 'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}
              >{key}</button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Rotación</span>
              <div className="flex gap-1">
                {[0,1,2,3].map(r=> (
                  <button key={r} onClick={()=> setRotation(r)} className={`px-2 py-1 rounded ${rotation===r?'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}>{r*90}°</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Reflexión</span>
              <button onClick={()=> setMirror(m=>!m)} className={`px-3 py-1 rounded ${mirror?'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}>{mirror? 'ON':'OFF'}</button>
            </div>
            <div className="pt-2 text-sm text-slate-600">
              <p><b>{selected}</b> → tónica {CHROMATIC[BASE_MAP[selected]]}</p>
              <p>Notas actuales: {noteSet.map(m => midiName(m)).join(" · ")}</p>
            </div>
            <div className="mt-4 border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Tempo</span>
                <input type="range" min={60} max={160} value={tempo} onChange={e=>setTempo(parseInt(e.target.value))} />
                <span className="tabular-nums w-10 text-right">{tempo}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={toggleClock} className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">Loop</button>
                <button onClick={resetBoard} className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300">Reset</button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={loopPlaced} onChange={e=>setLoopPlaced(e.target.checked)} />
                Loop de piezas colocadas (cada 1 compás)
              </label>
            </div>
          </div>
        </div>

        {/* Center: board */}
        <div className="col-span-12 md:col-span-6 bg-white rounded-2xl shadow p-4">
          <h2 className="text-lg font-semibold mb-3">Tablero {GRID_W}×{GRID_H}</h2>
          <div className="relative">
            <div
              className="grid"
              style={{gridTemplateColumns:`repeat(${GRID_W}, 28px)`}}
              onMouseLeave={()=> setHover(null)}
            >
              {Array.from({length: GRID_W*GRID_H}, (_,i)=>{
                const x = i % GRID_W; const y = Math.floor(i/GRID_W);
                const occ = cellOccupied(x,y);
                const ghost = previewSet.has(`${x},${y}`);
                let tone: string;
                if (occ && ghost) tone = 'bg-rose-500 text-white';   // choque contra pieza colocada
                else if (occ) tone = 'bg-slate-900 text-white';
                else if (ghost) tone = previewValid? 'bg-emerald-300' : 'bg-rose-200';
                else tone = 'bg-white hover:bg-slate-100';
                return (
                  <div key={i}
                       onClick={()=> handleCellClick(x,y)}
                       onMouseEnter={()=> setHover([x,y])}
                       className={`w-7 h-7 border border-slate-300 -m-px flex items-center justify-center text-[10px] ${previewValid || !hover? 'cursor-pointer':'cursor-not-allowed'} ${tone}`}
                       title={`(${x},${y})`}
                  >{occ? occ.piece: (ghost? selected : '')}</div>
                );
              })}
            </div>

            {/* ghost preview of current transformed shape at 0,0 */}
            <div className="mt-3">
              <span className="text-sm text-slate-600">Previsualización (el punto marca dónde agarra el cursor):</span>
              <div className="grid mt-1" style={{gridTemplateColumns:`repeat(${Math.max(...transformedShape.map(c=>c[0]))+1}, 20px)`}}>
                {Array.from({length: (Math.max(...transformedShape.map(c=>c[0]))+1) * (Math.max(...transformedShape.map(c=>c[1]))+1)}, (_,i)=>{
                  const x = i % (Math.max(...transformedShape.map(c=>c[0]))+1);
                  const y = Math.floor(i / (Math.max(...transformedShape.map(c=>c[0]))+1));
                  const on = transformedShape.some(([cx,cy])=> cx===x && cy===y);
                  const isAnchor = anchor[0]===x && anchor[1]===y;
                  return <div key={i} className={`w-5 h-5 border border-slate-200 -m-px flex items-center justify-center ${on? 'bg-slate-800':'bg-white'}`}>
                    {isAnchor && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                  </div>
                })}
              </div>
              <div className="text-xs text-slate-600 mt-1">Notas: {noteSet.map(m=>midiName(m)).join(' · ')}</div>
            </div>
          </div>
        </div>

        {/* Right: placed list / info */}
        <div className="col-span-12 md:col-span-3 bg-white rounded-2xl shadow p-3">
          <h2 className="text-lg font-semibold mb-2">Piezas colocadas</h2>
          <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
            {placed.length===0 && <div className="text-slate-500 text-sm">(Vacío — hacé click en el tablero para colocar la pieza seleccionada)</div>}
            {placed.map(p=> (
              <div key={p.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{p.piece} {p.rotation*90}° {p.mirror? '⥯':''}</div>
                  <button onClick={()=> setPlaced(arr=> arr.filter(q=> q.id!==p.id))}
                          className="text-xs px-2 py-0.5 rounded bg-rose-600 text-white">Quitar</button>
                </div>
                <div className="text-xs text-slate-600">Notas: {p.notes.map(m=>midiName(m)).join(' · ')}</div>
                <div className="text-[10px] text-slate-500 mt-1">Celdas: {p.cells.map(([x,y])=>`(${x},${y})`).join(' ')}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: señal que sale por el master. No recibe props: lee del motor
            por su cuenta, para que dibujar a 60 fps no re-renderice nada de acá. */}
        <div className="col-span-12 bg-white rounded-2xl shadow p-3">
          <h2 className="text-lg font-semibold mb-2">Señal</h2>
          <Spectrum />
        </div>
      </div>

      <footer className="text-center text-xs text-slate-500 pt-4">Pentomino Music — prototipo. Rotación cambia la fórmula de escala; Reflexión invierte el orden (retrogrado). Click en tablero para colocar y escuchar.</footer>
    </div>
  );
}
import { useMemo, useState, useEffect } from "react";
// Lazy load Tone.js only in browser after first interaction to prevent build issues
type ToneModule = typeof import('tone');
let toneModule: ToneModule | null = null;
let synth: any = null;
async function ensureTone(){
  if (!toneModule){
    try {
      toneModule = await import('tone');
    } catch (e){
      console.warn('Tone.js failed to load', e);
      return null;
    }
  }
  if (toneModule && !synth){
    try {
      // @ts-ignore dynamic constructor types
      synth = new toneModule.PolySynth(toneModule.Synth).toDestination();
    } catch (e){
      console.warn('Failed creating synth', e);
    }
  }
  return toneModule;
}

/**
 * Pentomino Music — minimal playable prototype
 * - Left: palette of 12 pentomino pieces (F, I, L, N, P, T, U, V, W, X, Y, Z)
 * - Center: grid (10x6 by default). Click a cell to place the selected piece if it fits.
 * - Right: controls for rotation (0/90/180/270), reflection (on/off), transport, tempo.
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

// Simple synth is created lazily in ensureTone()

// Utility: schedule a quick arpeggio of the 5 notes now
async function playNotesNow(midiNotes: number[], velocity=0.8, noteDur: string="8n"){
  const Tone = await ensureTone();
  if (!Tone || !synth) return; // audio layer unavailable
  await Tone.start();
  const t = Tone.now();
  midiNotes.forEach((m, i) => {
    const hz = Tone.Frequency(m, "midi").toFrequency();
    synth.triggerAttackRelease(hz, noteDur, t + i*0.15, velocity);
  });
}

// Board state
const GRID_W = 10; const GRID_H = 6;

function useTransport(tempo: number){
  useEffect(()=>{
    let mounted = true;
    ensureTone().then(Tone => { if (Tone && mounted) Tone.Transport.bpm.value = tempo; });
    return ()=>{ mounted = false; };
  },[tempo]);
}

interface PlacedPiece {
  piece: PieceKey;
  rotation: number;
  mirror: boolean;
  cells: Cell[];
  notes: number[];
  _sched?: number;
}

export default function App(){
  const [selected, setSelected] = useState<PieceKey>('F');
  const [rotation, setRotation] = useState<number>(0); // 0..3
  const [mirror, setMirror] = useState<boolean>(false);
  const [tempo, setTempo] = useState<number>(110);
  const [loopPlaced, setLoopPlaced] = useState<boolean>(false);

  // placed pieces
  const [placed, setPlaced] = useState<PlacedPiece[]>([]);

  useTransport(tempo);

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

  // try place piece with top-left at (gx,gy)
  function canPlaceAt(gx: number, gy: number): {ok:true; cells: Cell[]} | {ok:false}{
    // transformed shape cells are 0-based; offset by gx,gy
  const cells: Cell[] = transformedShape.map(([x,y]): Cell => [x+gx, y+gy]);
    // bounds
    if (cells.some(([x,y])=> x<0 || y<0 || x>=GRID_W || y>=GRID_H)) return {ok:false};
    // collision
    for (const p of placed){
      const set = new Set(p.cells.map(([x,y])=>`${x},${y}`));
      if (cells.some(([x,y])=> set.has(`${x},${y}`))) return {ok:false};
    }
    return {ok:true, cells};
  }

  function handleCellClick(x: number, y: number){
    const res = canPlaceAt(x,y);
    if (!res.ok) return;
  const newPiece: PlacedPiece = { piece: selected, rotation, mirror, cells: res.cells, notes: noteSet, _sched: undefined };
    setPlaced(prev => [...prev, newPiece]);
    playNotesNow(noteSet);
    if (loopPlaced){
      // schedule retrigger every bar (simple):
  // @ts-ignore
  const scheduleLoop = async () => {
    const Tone = await ensureTone();
    if (!Tone) return;
    const id = Tone.Transport.scheduleRepeat((time: number)=>{
        noteSet.forEach((m,i)=>{
          if (!synth) return;
          synth.triggerAttackRelease(Tone.Frequency(m, "midi").toFrequency(), "8n", time + i*0.15, 0.8);
        })
      }, "1m");
      newPiece._sched = id; // attach id
    };
    scheduleLoop();
  }
  }

  function resetBoard(){
    // clear scheduled events
  // @ts-ignore
  ensureTone().then(Tone => { if (Tone) placed.forEach(p=>{ if (p._sched!=null) Tone.Transport.clear(p._sched); }); });
    setPlaced([]);
  }

  function toggleTransport(){
  ensureTone().then(Tone => { if (!Tone) return; if (Tone.Transport.state === 'started') Tone.Transport.stop(); else Tone.Transport.start(); });
  }

  // helpers for UI
  function cellOccupied(x: number, y: number): PlacedPiece | null {
    for (const p of placed){
      if (p.cells.some(([cx,cy])=> cx===x && cy===y)) return p;
    }
    return null;
  }

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
                <button onClick={toggleTransport} className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">Loop</button>
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
            <div className="grid" style={{gridTemplateColumns:`repeat(${GRID_W}, 28px)`}}>
              {Array.from({length: GRID_W*GRID_H}, (_,i)=>{
                const x = i % GRID_W; const y = Math.floor(i/GRID_W);
                const occ = cellOccupied(x,y);
                return (
                  <div key={i}
                       onClick={()=> handleCellClick(x,y)}
                       className={`w-7 h-7 border border-slate-300 -m-px flex items-center justify-center text-[10px] cursor-pointer ${occ? 'bg-slate-900 text-white':'bg-white hover:bg-slate-100'}`}
                       title={`(${x},${y})`}
                  >{occ? occ.piece: ''}</div>
                );
              })}
            </div>

            {/* ghost preview of current transformed shape at 0,0 */}
            <div className="mt-3">
              <span className="text-sm text-slate-600">Previsualización (origen 0,0):</span>
              <div className="grid mt-1" style={{gridTemplateColumns:`repeat(${Math.max(...transformedShape.map(c=>c[0]))+1}, 20px)`}}>
                {Array.from({length: (Math.max(...transformedShape.map(c=>c[0]))+1) * (Math.max(...transformedShape.map(c=>c[1]))+1)}, (_,i)=>{
                  const x = i % (Math.max(...transformedShape.map(c=>c[0]))+1);
                  const y = Math.floor(i / (Math.max(...transformedShape.map(c=>c[0]))+1));
                  const on = transformedShape.some(([cx,cy])=> cx===x && cy===y);
                  return <div key={i} className={`w-5 h-5 border border-slate-200 -m-px ${on? 'bg-slate-800':'bg-white'}`}></div>
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
            {placed.map((p,idx)=> (
              <div key={idx} className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{p.piece} {p.rotation*90}° {p.mirror? '⥯':''}</div>
                  <button onClick={()=>{
                    ensureTone().then(Tone => { if (Tone && p._sched!=null) Tone.Transport.clear(p._sched); });
                    setPlaced(arr=> arr.filter((_,i)=> i!==idx));
                  }} className="text-xs px-2 py-0.5 rounded bg-rose-600 text-white">Quitar</button>
                </div>
                <div className="text-xs text-slate-600">Notas: {p.notes.map(m=>midiName(m)).join(' · ')}</div>
                <div className="text-[10px] text-slate-500 mt-1">Celdas: {p.cells.map(([x,y])=>`(${x},${y})`).join(' ')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-slate-500 pt-4">Pentomino Music — prototipo. Rotación cambia la fórmula de escala; Reflexión invierte el orden (retrogrado). Click en tablero para colocar y escuchar.</footer>
    </div>
  );
}
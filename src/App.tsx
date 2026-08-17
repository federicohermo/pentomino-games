import { useMemo, useState, useEffect, useRef } from "react";
import {
  playNow, addJob, clearJobs, setBpm,
  startClock, stopClock, clockRunning,
} from "./audio/engine.ts";
import { DEFAULT_BPM } from "./audio/constants/engine.constants.ts";
import { rotateN, reflect } from "./domain/transform.ts";
import { notesForRotation } from "./domain/music.ts";
import { cellsAt, isValid, phaseFor } from "./domain/board.ts";
import { SHAPES, ANCHOR_INDEX } from "./domain/constants/pieces.constants.ts";
import { BASE_MAP, DEFAULT_OCTAVE } from "./domain/constants/music.constants.ts";
import type { Cell } from "./domain/types/transform.types.ts";
import type { PieceKey } from "./domain/types/pieces.types.ts";
import type { PlacedPiece } from "./domain/types/board.types.ts";
import PiecePalette from "./components/PiecePalette.tsx";
import Board from "./components/Board.tsx";
import PlacedList from "./components/PlacedList.tsx";
import Spectrum from "./components/Spectrum.tsx";

/**
 * Pentomino Music — prototipo de instrumento, no un juego con reglas de resolucion.
 *
 * El usuario coloca pentominos en un tablero de 10x6 y cada pieza dispara un
 * arpegio de cinco notas. Que pieza determina la tonica, la rotacion la formula de
 * escala, la reflexion el orden de las notas, y la columna de la celda de agarre la
 * posicion dentro del compas.
 *
 * Este archivo es el shell: estado, derivados, handlers y efectos. La geometria, la
 * musica y las reglas del tablero viven en `src/domain/`; el sonido en
 * `src/audio/`; y el JSX, en los cuatro componentes de `src/components/`.
 *
 * Ver docs/architecture/modelo-musical.md y docs/architecture/audio.md.
 */

export default function App(){
  const [selected, setSelected] = useState<PieceKey>('F');
  const [rotation, setRotation] = useState<number>(0); // 0..3
  const [mirror, setMirror] = useState<boolean>(false);
  // Arranca del mismo numero que el motor: DEFAULT_BPM es una sola declaracion.
  const [tempo, setTempo] = useState<number>(DEFAULT_BPM);
  const [playing, setPlaying] = useState<boolean>(false);

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
    let ns = notesForRotation(basePc, DEFAULT_OCTAVE, rotation);
    if (mirror) ns = [...ns].reverse();
    return ns;
  }, [selected, rotation, mirror]);

  function handleCellClick(x: number, y: number){
    const cells = cellsAt(transformedShape, ANCHOR_INDEX[selected], x, y);
    if (!isValid(cells, placed)) return;
    const newPiece: PlacedPiece = {
      id: String(++idRef.current),
      piece: selected, rotation, mirror, cells, notes: noteSet,
    };
    setPlaced(prev => [...prev, newPiece]);
    // Con el transporte corriendo, el arpegio de colocación se superpondría al
    // job que el efecto va a agendar para esta misma pieza: dos veces las mismas
    // cinco notas, fuera de fase entre sí. Con el transporte en pausa el click
    // sigue siendo la única forma de escuchar lo que se coloca, así que ahí se
    // dispara. Sin Web Audio `playing` nunca llega a true, de modo que el caso
    // degradado cae solo del lado que suena.
    if (!playing) playNow(noteSet);
  }

  function resetBoard(){
    setPlaced([]); // el efecto de sincronización se encarga de cancelar los loops
  }

  // Reconcilia los loops contra el tablero. Al ser declarativo cubre por igual
  // colocar, quitar, resetear y darle play o pausa al transporte — antes cada
  // uno de esos caminos tenía que acordarse de limpiar por su cuenta, y no lo
  // hacían.
  //
  // Limpia y re-agrega todo en vez de diffear, y sigue siendo seguro con la fase
  // por pieza porque `phase` se deriva del tablero, no del reloj: re-agregar un
  // job reconstruye exactamente la misma fase. Los jobs son datos puros que el
  // scheduler lee, no eventos con identidad.
  //
  // Tampoco hace falta el flag de cancelación que pedía Tone: addJob y clearJobs
  // son sincrónicos, así que no hay promesa que pueda resolver después de que el
  // efecto se limpió.
  useEffect(()=>{
    clearJobs();
    if (!playing) return;
    for (const p of placed){
      // La columna de la celda de agarre es la posición dentro del compás: el eje
      // X del tablero es tiempo. El ancho del tablero ES el compás (10 pasos, no
      // 16): con una grilla de semicorcheas, 6 subdivisiones no serían alcanzables
      // desde ninguna columna. La regla vive en `domain/board.ts` para que la
      // pueda ejecutar cualquiera —los tests y el MCP server— y no solo el shell.
      addJob({ id: p.id, notes: p.notes, phase: phaseFor(p.cells, ANCHOR_INDEX[p.piece]) });
    }
  }, [placed, playing]);

  // Al desmontar, frenar el reloj y soltar los jobs. La limpieza es sincrónica:
  // si fuera asincrónica, en StrictMode podría ejecutarse después de que el
  // efecto de arriba ya volvió a agendar, y cancelaría los jobs nuevos.
  useEffect(()=> ()=>{ stopClock(); clearJobs(); }, []);

  function togglePlay(){
    if (playing) stopClock(); else startClock();
    // El motor es quien sabe si arrancó: startClock() es un no-op silencioso
    // cuando audio() devuelve null, y sin este chequeo el botón diría "Pausa"
    // con el reloj parado. Es la falla suave que .claude/rules/audio.md obliga
    // a chequear en todo llamador, y era lo único que la consulta imperativa
    // hacía bien antes de este spec.
    setPlaying(clockRunning());
  }

  // Fantasma: dónde caería la pieza desde la celda bajo el cursor. Las celdas
  // fuera del tablero no se pintan, pero sí cuentan para marcar la jugada
  // como inválida.
  const previewCells = hover? cellsAt(transformedShape, ANCHOR_INDEX[selected], hover[0], hover[1]) : [];
  const previewValid = hover? isValid(previewCells, placed) : false;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-4">
        <PiecePalette
          selected={selected}
          rotation={rotation}
          mirror={mirror}
          tempo={tempo}
          playing={playing}
          noteSet={noteSet}
          onSelect={setSelected}
          onRotate={setRotation}
          onMirror={()=> setMirror(m=>!m)}
          onTempo={setTempo}
          onTogglePlay={togglePlay}
          onReset={resetBoard}
        />

        <Board
          placed={placed}
          previewCells={previewCells}
          previewValid={previewValid}
          hover={hover}
          selected={selected}
          rotation={rotation}
          onCellClick={handleCellClick}
          onCellEnter={setHover}
          onMouseLeave={()=> setHover(null)}
        />

        <PlacedList
          placed={placed}
          onRemove={id=> setPlaced(arr=> arr.filter(q=> q.id!==id))}
        />

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

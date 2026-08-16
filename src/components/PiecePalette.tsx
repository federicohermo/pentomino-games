import { midiName } from '../domain/music.ts';
import { SHAPES } from '../domain/constants/pieces.constants.ts';
import { CHROMATIC, BASE_MAP } from '../domain/constants/music.constants.ts';
import type { PieceKey } from '../domain/types/pieces.types.ts';
import { TEMPO_MIN, TEMPO_MAX } from './constants/layout.constants.ts';
import { PIECE_COLOR } from './constants/palette.constants.ts';

/**
 * Panel izquierdo: eleccion de pieza, rotacion, reflexion, tempo y transporte.
 *
 * Presentacional: sin estado, sin efectos. Todo entra por props.
 */

interface Props {
  selected: PieceKey;
  rotation: number;
  mirror: boolean;
  tempo: number;
  loopPlaced: boolean;
  noteSet: readonly number[];
  onSelect: (piece: PieceKey) => void;
  onRotate: (rotation: number) => void;
  onMirror: () => void;
  onTempo: (bpm: number) => void;
  onToggleLoopPlaced: (on: boolean) => void;
  onToggleClock: () => void;
  onReset: () => void;
}

export default function PiecePalette({
  selected, rotation, mirror, tempo, loopPlaced, noteSet,
  onSelect, onRotate, onMirror, onTempo, onToggleLoopPlaced, onToggleClock, onReset,
}: Props) {
  return (
    <div className="col-span-12 md:col-span-3 bg-white rounded-2xl shadow p-3">
      <h2 className="text-lg font-semibold mb-2">Piezas</h2>
      {/* Las columnas bajan de 6 a partir de `md`, y eso es consecuencia del punto:
          medido en el DOM, el boton mas ancho (`W`) pide 42,7 px de min-content —
          `px-2` (16) + borde (2) + punto (8) + `gap-1` (4) + la letra (13,1)— contra
          pistas de 18 px a 768 y 35,3 px con el `max-w-6xl` saturado.

          El `1fr` no desborda la tarjeta: el contenido se sale del PADDING del boton,
          que tiene `overflow: visible`. Por eso no se ve como scroll sino como aire
          que desaparece — el padding efectivo medido caia de 8 px a 3,5 en pantalla
          ancha y a **-4,6 px a 768**, o sea la letra cruzando su propio borde. Sin el
          punto el peor caso era 1,4 px: apretado, pero nunca negativo.

          6 columnas solo debajo de `md`, donde la tarjeta es `col-span-12` y sobra
          ancho: ahi el peor caso a 375 px de viewport son 9,7 px de padding. Con 3 a
          `md` y 4 a `lg` el peor caso de todo el rango vuelve a **8,5 px** (a 768,
          que es el mas apretado), a costa de una fila mas. */}
      <div className="grid grid-cols-6 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {/* El fondo del boton NO toma el color de pieza: ese fondo es el canal de
            "seleccionada" y pintarlo dejaria a la paleta sin decir cual esta activa.
            La identidad entra como un punto al costado de la letra, que es donde ya
            se comunicaba identidad. El punto lleva borde propio porque varios de los
            12 colores (el amarillo de `V`, el lima de `F`) casi no se ven contra el
            gris claro del boton sin apoyarse. */}
        {(Object.keys(SHAPES) as PieceKey[]).map(key=> (
          <button
            key={key}
            onClick={()=> onSelect(key)}
            className={`px-2 py-1 rounded-lg border text-sm inline-flex items-center justify-center gap-1 ${selected===key? 'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}
          >
            <span className="w-2 h-2 rounded-full border border-slate-400 shrink-0"
                  style={{background: PIECE_COLOR[key].bg}}></span>
            {key}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium">Rotación</span>
          <div className="flex gap-1">
            {[0,1,2,3].map(r=> (
              <button key={r} onClick={()=> onRotate(r)} className={`px-2 py-1 rounded ${rotation===r?'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}>{r*90}°</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Reflexión</span>
          <button onClick={onMirror} className={`px-3 py-1 rounded ${mirror?'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}>{mirror? 'ON':'OFF'}</button>
        </div>
        <div className="pt-2 text-sm text-slate-600">
          <p><b>{selected}</b> → tónica {CHROMATIC[BASE_MAP[selected]]}</p>
          {/* Las dos lineas van RESERVADAS, no dejadas al contenido: el largo de esta
              linea depende de cuantos sostenidos tenga la escala, que va de 0 a 5
              sobre las 48 combinaciones de pieza x rotacion, y al envolver movia
              todo lo que tiene debajo —Tempo, Loop, Reset— 20 px hacia abajo al
              cambiar de pieza O de rotacion. Un panel de control que se acomoda solo
              cuando lo tocas es el bug: el boton se corre justo cuando vas a apretarlo.

              Dos y no tres, medido sobre el peor string de los 48 (`F#4 · G#4 · A#4 ·
              C#5 · D#5`, 5 sostenidos: sale en `N` rot1, `U` rot0 y `Z` rot3): ocupa
              2 lineas desde 148 px de tarjeta —el interior a 768— hasta los 252 de
              `max-w-6xl` saturado. El salto existia solo en la banda mas ancha, que
              es la unica donde el mejor caso entra en una.

              `2lh` y no `min-h-10`: son los mismos 40 px hoy porque `text-sm` da 20
              de interlineado, pero atado a la fuente en vez de a un numero que habria
              que recordar actualizar. */}
          <p className="min-h-[2lh]">Notas actuales: {noteSet.map(m => midiName(m)).join(" · ")}</p>
        </div>
        <div className="mt-4 border-t pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">Tempo</span>
            <input type="range" min={TEMPO_MIN} max={TEMPO_MAX} value={tempo} onChange={e=>onTempo(parseInt(e.target.value))} />
            <span className="tabular-nums w-10 text-right">{tempo}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onToggleClock} className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">Loop</button>
            <button onClick={onReset} className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300">Reset</button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={loopPlaced} onChange={e=>onToggleLoopPlaced(e.target.checked)} />
            Loop de piezas colocadas (cada 1 compás)
          </label>
        </div>
      </div>
    </div>
  );
}

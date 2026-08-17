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
  playing: boolean;
  clicks: boolean;
  noteSet: readonly number[];
  onSelect: (piece: PieceKey) => void;
  onRotate: (rotation: number) => void;
  onMirror: () => void;
  onTempo: (bpm: number) => void;
  onTogglePlay: () => void;
  onToggleClicks: () => void;
  onReset: () => void;
}

export default function PiecePalette({
  selected, rotation, mirror, tempo, playing, clicks, noteSet,
  onSelect, onRotate, onMirror, onTempo, onTogglePlay, onToggleClicks, onReset,
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
        {/* El click del recorrido, con el mismo idioma que Reflexion: activo en
            oscuro. Es un interruptor de MEZCLA y no del modelo — el recorrido
            sigue siendo el mismo con los clicks apagados, solo que no se oye. El
            spec 009 lo previo asi en su tabla de riesgos ("es un parametro suelto:
            si molesta, se baja o se apaga sin tocar el modelo") y hace falta
            mientras el camino cruce celdas ocupadas, que es deuda anotada. */}
        <div className="flex items-center justify-between">
          <span className="font-medium">Clicks</span>
          <button onClick={onToggleClicks} className={`px-3 py-1 rounded ${clicks?'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}>{clicks? 'ON':'OFF'}</button>
        </div>
        <div className="pt-2 text-sm text-slate-600">
          <p><b>{selected}</b> → tónica {CHROMATIC[BASE_MAP[selected]]}</p>
          {/* Las dos lineas van RESERVADAS, no dejadas al contenido: el largo de esta
              linea depende de cuantos sostenidos tenga la escala, que va de 0 a 5
              sobre las 48 combinaciones de pieza x rotacion, y al envolver movia
              todo lo que tiene debajo —Tempo, transporte, Reset— 20 px hacia abajo al
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
          {/* Un solo boton para el transporte: antes el checkbox decidia si sonaba y
              este boton arrancaba el reloj, y ninguno de los dos mostraba si el reloj
              corria. El icono es el estado —lo que se ve es lo que pasa al apretar— y
              el color lo repite para que se lea de un vistazo.

              Solo el icono, sin la palabra: ▶ y ⏸ son el vocabulario universal del
              transporte y no necesitan glosa. Medido, la etiqueta ademas no entraba:
              con "▶ Reproducir" el boton pedia 119 px de min-content contra los 148
              del interior de la tarjeta a 768 —el ancho mas apretado, el mismo que
              gobierna la grilla de piezas de arriba—, asi que junto a Reset (62 px +
              8 de gap) la fila desbordaba 23 px y el texto envolvia a dos lineas.
              Con el icono solo el boton mide 37,8 px, asi que en esos 148 sobran 40.

              `aria-label` porque al sacar el texto el boton se queda sin nombre
              accesible: el glifo no lo es. `title` para que el puntero tambien lo diga.

              Corriendo usa el `bg-slate-900 text-white` con el que la tarjeta marca lo
              activo en Rotacion y Reflexion: es el mismo idioma, aplicado al mismo
              concepto. En pausa NO cae a `bg-slate-100`, que es el "apagado" de esos
              dos, porque al lado tiene a Reset en `bg-slate-200`: el boton principal
              del instrumento quedaria indistinguible del secundario. Se queda con el
              verde que ya tenia, que ademas es lo que un transporte pide leer como
              "apreta esto para que suene". */}
          <div className="flex gap-2">
            <button
              onClick={onTogglePlay}
              aria-label={playing? 'Pausa':'Reproducir'}
              title={playing? 'Pausa':'Reproducir'}
              className={`px-3 py-1 rounded text-white ${playing? 'bg-slate-900 hover:bg-slate-800':'bg-emerald-600 hover:bg-emerald-700'}`}
            >{playing? '⏸':'▶'}</button>
            <button onClick={onReset} className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300">Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { TEMPO_MIN, TEMPO_MAX } from './constants/layout.constants.ts';
import type { PropsDeTransporte } from './types/panel.types.ts';

/**
 * El transporte del instrumento: tempo, play/pausa y reset.
 *
 * Presentacional: sin estado, sin efectos. Recibe UN objeto —el del transporte— y nada
 * mas.
 *
 * Es exactamente el bloque `border-t` que tenia `PiecePalette`, devuelto como el mismo
 * `div` y sin envolverlo en nada: es el unico subarbol CONTIGUO de los dos paneles (el
 * boton de los clicks cae entre dos bloques de orientacion, ver `PiecePalette.tsx`), y
 * agregarle un nodo cambiaria el ritmo vertical del `space-y-2` que lo contiene con las
 * clases intactas.
 */
export default function TransportPanel({ transporte }: { transporte: PropsDeTransporte }) {
  const { tempo, playing, onTempo, onTogglePlay, onReset } = transporte;
  return (
    <div className="mt-4 border-t pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span id="tempo-etiqueta" className="font-medium">Tempo</span>
        {/* `aria-labelledby` y no `aria-label`: el nombre toma el mismo texto que ya se
            ve en el span de arriba, en vez de escribirlo dos veces. Si alguien cambia la
            etiqueta visible, la anunciada lo sigue sola.

            Y `aria-valuetext` es el argumento del comentario de abajo —"110" a secas no
            dice si son bpm o intervalos, y desde el spec 008 el instrumento maneja las
            dos unidades— aplicado al oido, donde no hay span al lado que lo salve: un
            `range` se anuncia con su valor numerico crudo salvo que lo tenga. */}
        <input
          type="range"
          min={TEMPO_MIN}
          max={TEMPO_MAX}
          value={tempo}
          onChange={e=>onTempo(parseInt(e.target.value))}
          aria-labelledby="tempo-etiqueta"
          aria-valuetext={`${tempo} bpm`}
        />
        {/* Con la unidad: "110" a secas no dice si son bpm o intervalos, y desde el
            spec 008 el instrumento maneja las dos unidades. `w-16` y no `w-10`
            porque " bpm" agrega ~24 px; lo absorbe el `range`, que es el unico
            elemento elastico de la fila. `tabular-nums` mantiene el numero quieto
            al arrastrar, que es para lo que estaba el ancho fijo. */}
        <span className="tabular-nums w-16 text-right whitespace-nowrap">{tempo} <span className="text-slate-500">bpm</span></span>
      </div>
      {/* Un solo boton para el transporte, y **el icono ES el estado**: lo que se ve es
          lo que pasa al apretar, y el color lo repite para que se lea de un vistazo.

          Solo el icono, sin la palabra: ▶ y ⏸ son el vocabulario universal del
          transporte y no necesitan glosa. Y medido, la etiqueta no entra: con
          "▶ Reproducir" el boton pide 119 px de min-content contra los 148 del interior
          de la tarjeta a 768 —el ancho mas apretado, el mismo que gobierna la grilla de
          piezas— asi que junto a Reset (62 px + 8 de gap) la fila desborda 23 px y el
          texto envuelve a dos lineas. Con el icono solo mide 37,8 px y en esos 148 sobran
          40.

          `aria-label` porque al sacar el texto el boton se queda sin nombre accesible: el
          glifo no lo es. `title` para que el puntero tambien lo diga.

          Corriendo usa el `bg-slate-900 text-white` con el que la tarjeta marca lo activo
          en Rotacion y Reflexion: es el mismo idioma, aplicado al mismo concepto. En
          pausa NO cae a `bg-slate-100`, que es el "apagado" de esos dos, porque al lado
          tiene a Reset en `bg-slate-200`: el boton principal del instrumento quedaria
          indistinguible del secundario. El verde es lo que un transporte pide leer como
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
  );
}

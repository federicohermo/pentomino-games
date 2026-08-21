import { midiName } from '../domain/music.ts';
import { CHROMATIC, BASE_MAP } from '../domain/constants/music.constants.ts';
import { REGIMEN } from '../domain/constants/music.constants.ts';
import OrientationPanel from './OrientationPanel.tsx';
import TransportPanel from './TransportPanel.tsx';
import type { PropsDeOrientacion, PropsDeTransporte } from './types/panel.types.ts';

/**
 * La tarjeta de piezas: el contenedor de los dos paneles, y las filas que no se pueden
 * mudar sin reordenar el DOM.
 *
 * Presentacional: sin estado, sin efectos. Desde el spec 022 recibe DOS objetos en vez de
 * dieciseis props planas —`orientacion` y `transporte`—, y cada panel recibe solo el
 * suyo. El criterio de reparto esta en `types/panel.types.ts`.
 *
 * ## Por que este archivo se queda con cuatro filas
 *
 * Los dos paneles NO son dos regiones contiguas, y esta medido: bajo el `space-y-2` de
 * abajo el orden real es Rotacion → Reflexion → *clicks* → linea de notas → Tempo, o sea
 * que la fila de clicks (transporte) cae ENTRE dos bloques de orientacion. Y el bloque de
 * las doce miniaturas no cuelga de ese `space-y-2` sino de la tarjeta, un nivel mas
 * arriba. O sea que la orientacion vive en TRES regiones no adyacentes y en dos niveles
 * de anidamiento.
 *
 * Con AC18 del 022 —cero cambio visual: mismo DOM, mismas clases, mismo orden, mismos
 * nodos— eso deja una sola forma de partir sin reescribir. `space-y-2` compila a
 * `& > :not([hidden]) ~ :not([hidden])`, un selector de HIJO DIRECTO: cualquier
 * envoltorio nuevo convierte dos hijos en uno y se come un margen con las clases
 * intactas y sin que ningun test lo note. Y mover la grilla adentro del `space-y-2`
 * la empujaria 16 px hacia abajo por el `mt-4` del contenedor.
 *
 * Entonces cada componente se lleva un subarbol CONTIGUO y lo devuelve tal cual: las doce
 * miniaturas (`OrientationPanel`) y el bloque `border-t` del transporte
 * (`TransportPanel`). Las cuatro filas del medio se quedan acá, leyendo del objeto que
 * les corresponde. El 019 vuelve contigua parte de esta interpolacion cuando muda el
 * boton de los clicks a la fila de transporte (`019` `T011`): en un spec el problema se
 * achica solo.
 */

interface Props {
  orientacion: PropsDeOrientacion;
  transporte: PropsDeTransporte;
}

export default function PiecePalette({ orientacion, transporte }: Props) {
  const { selected, rotation, mirror, regimen, noteSet, onRotate, onMirror, onRegimen } = orientacion;
  const { clicks, onToggleClicks } = transporte;
  // `md:col-span-4` desde el spec 014: al morir `PlacedList` quedaron dos columnas libres
  // y esta es una de las dos. La otra va al tablero, y el reparto sale MEDIDO y no
  // elegido: a partir de `md:col-span-8` el tablero deja de estar limitado por el ancho y
  // pasa a estarlo por el alto, asi que la novena columna no le compraria un solo pixel
  // (la tabla esta en `Board.tsx`). El interior de esta tarjeta pasa de 252 a 349,3 px,
  // que es donde el spec 016 va a meter las doce miniaturas — y es la premisa de la tabla
  // de columnas de `OrientationPanel.tsx`, que sin este dato no se puede re-derivar.
  return (
    <div className="col-span-12 md:col-span-4 bg-white rounded-2xl shadow p-3">
      <h2 className="text-lg font-semibold mb-2">Piezas</h2>
      <OrientationPanel orientacion={orientacion} />
      <div className="mt-4 space-y-2">
        {/* La fila de Rotación son DOS líneas y no dos filas: la segunda dice QUÉ cambia
            la de arriba, así que se lee como una oración —«Rotación … cambia escala /
            orden»— y el interruptor no necesita glosa. No agrega una fila, completa una
            (AC10 del spec 017): sin rotar, el régimen no hace nada, así que no es un
            control independiente.

            Dos botones y no un ON/OFF como Reflexión o Clicks: los dos valores son
            simétricos y ninguno es la ausencia del otro. Un ON/OFF diría que hay un
            régimen y una desviación, que es justo la lectura que D4 rechaza — no son
            dificultades, son dos reglas. El idioma visual sí es el mismo que el resto de
            la tarjeta usa para lo activo: fondo oscuro. */}
        {/* Los dos grupos de abajo son `role="group"` y NO `radiogroup`, aunque los cuatro
            de rotación y los dos de régimen sean conjuntos exclusivos. Un `radiogroup`
            obliga a un modelo de foco —una sola parada de tabulación para el grupo entero
            y flechas para moverse adentro— y ese modelo lo fija el spec 026, que es el que
            contesta la pregunta que `specs/deuda.md` tiene abierta para el tablero.
            Decidirlo acá de refilón sería decidirlo dos veces y probablemente distinto: el
            `aria-pressed` de cada botón ya anuncia el estado sin comprometer el foco. */}
        <div>
          <div className="flex items-center justify-between">
            <span id="rotacion-etiqueta" className="font-medium">Rotación</span>
            <div role="group" aria-labelledby="rotacion-etiqueta" className="flex gap-1">
              {[0,1,2,3].map(r=> (
                <button key={r} onClick={()=> onRotate(r)} aria-pressed={rotation===r} className={`px-2 py-1 rounded ${rotation===r?'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}>{r*90}°</button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-1 mt-1">
            <span id="regimen-etiqueta" className="text-xs text-slate-600">cambia</span>
            <div role="group" aria-labelledby="regimen-etiqueta" className="flex gap-1">
              {([REGIMEN.escala, REGIMEN.orden] as const).map(r=> (
                <button key={r} onClick={()=> onRegimen(r)} aria-pressed={regimen===r}
                        className={`px-2 py-0.5 rounded text-xs ${regimen===r?'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}>{r}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span id="reflexion-etiqueta" className="font-medium">Reflexión</span>
          <button onClick={onMirror} aria-labelledby="reflexion-etiqueta" aria-pressed={mirror} className={`px-3 py-1 rounded ${mirror?'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}>{mirror? 'ON':'OFF'}</button>
        </div>
        {/* El click MUDO del recorrido, con el mismo idioma que Reflexion: activo en
            oscuro. Es un interruptor de MEZCLA y no del modelo — el recorrido sigue
            siendo el mismo con los clicks apagados, solo que no se oye.

            **Apaga solo una de las dos clases de cruce.** El cruce sobre una celda
            ocupada suena su nota y no se apaga, porque es modelo y no mezcla (D6):
            apagarlo seria silenciar parte de lo que el tablero dice. Por eso la etiqueta
            dice QUE SE OYE cuando esta encendido —el recorrido, y la parte de el que pasa
            por celdas vacias— y no nombra al click: desde el 015 no es un click sino una
            campana de altura fija, y con el default en OFF un "Clicks mudos: OFF" no
            dejaria saber si apaga el click o apaga el mute.

            **Y no se puede borrar**: con el default apagado este boton es la unica forma
            de ENCENDER el recorrido, asi que borrarlo lo dejaria inalcanzable. La
            propuesta de borrarlo existio y quedo cerrada con un "no"; la cronica de las
            tres etiquetas y de esa decision esta en `specs/revisiones.md`, pase de
            comentarios del 022.

            Es del TRANSPORTE y sin embargo lo renderiza este archivo: cae entre dos
            bloques de orientacion, asi que llevarselo a `TransportPanel` reordenaria
            el DOM (AC18 del 022). Ver el docblock de arriba. */}
        <div className="flex items-center justify-between">
          <span id="recorrido-etiqueta" className="font-medium">Recorrido en el vacío</span>
          <button onClick={onToggleClicks} aria-labelledby="recorrido-etiqueta" aria-pressed={clicks} className={`px-3 py-1 rounded ${clicks?'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}>{clicks? 'ON':'OFF'}</button>
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
        <TransportPanel transporte={transporte} />
      </div>
    </div>
  );
}

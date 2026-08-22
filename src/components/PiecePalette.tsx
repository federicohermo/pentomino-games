import { midiName } from '../domain/music.ts';
import { CHROMATIC, BASE_MAP } from '../domain/constants/music.constants.ts';
import { REGIMEN } from '../domain/constants/music.constants.ts';
import { textoDeOrientacion } from './orientation-text.ts';
import OrientationPanel from './OrientationPanel.tsx';
import TransportPanel from './TransportPanel.tsx';
import type { PropsDeOrientacion, PropsDeTransporte } from './types/panel.types.ts';

/**
 * La tarjeta de piezas: el contenedor de los dos paneles y las dos filas del medio.
 *
 * Presentacional: sin estado, sin efectos. Desde el spec 022 recibe DOS objetos en vez de
 * dieciseis props planas —`orientacion` y `transporte`—, y cada panel recibe solo el
 * suyo. El criterio de reparto esta en `types/panel.types.ts`.
 *
 * ## Por que este archivo se queda con dos filas
 *
 * Bajo el `space-y-2` de abajo el orden es regimen → linea de notas, y el bloque de las
 * doce miniaturas no cuelga de ese `space-y-2` sino de la tarjeta, un nivel mas arriba.
 *
 * Hasta el 019 habia una razon mas fuerte para que el reparto fuera este: la fila del
 * recorrido, que es del TRANSPORTE, caia ENTRE dos bloques de orientacion, asi que la
 * orientacion vivia en tres regiones no adyacentes y en dos niveles de anidamiento. Ese
 * problema se acabo: el 019 mudo el boton de los clicks a la fila de transporte, o sea
 * que lo que queda aca es todo del mismo lado.
 *
 * Lo que sigue valiendo es la restriccion que fijo la particion, y por eso no se borra:
 * `space-y-2` compila a `& > :not([hidden]) ~ :not([hidden])`, un selector de HIJO
 * DIRECTO, asi que cualquier envoltorio nuevo convierte dos hijos en uno y se come un
 * margen con las clases intactas y sin que ningun test lo note. Y mover la grilla adentro
 * del `space-y-2` la empujaria 16 px hacia abajo por el `mt-4` del contenedor. Cada
 * componente se lleva un subarbol CONTIGUO y lo devuelve tal cual: las doce miniaturas
 * (`OrientationPanel`) y el bloque `border-t` del transporte (`TransportPanel`).
 */

interface Props {
  orientacion: PropsDeOrientacion;
  transporte: PropsDeTransporte;
}

export default function PiecePalette({ orientacion, transporte }: Props) {
  const { selected, rotation, mirror, regimen, noteSet, onRegimen } = orientacion;
  const { grados, reflejada } = textoDeOrientacion(rotation, mirror);
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
        {/* El régimen ASCIENDE a fila propia con el spec 019, y no es cosmética. Hasta acá
            era la segunda línea de la fila de Rotación, y estaba escrito así a propósito
            (AC10 del 017): sin rotar el régimen no hace nada, así que en vez de abrir una
            fila completaba una —«Rotación … cambia escala / orden»— y el interruptor no
            necesitaba glosa. El 019 borra los cuatro botones de grados, o sea que la frase
            se queda SIN SUJETO: lo que era una segunda línea pasa a ser la fila, con la
            etiqueta que era de arriba.

            Y no se borra, aunque la tentación sea la misma que con los grados. El
            precedente es el `T070` del spec 011: propuso borrar el botón de los clicks y el
            015 lo cerró con un «no» porque era la única forma de encender el recorrido. Acá
            está peor: la rotación y la reflexión sobreviven al borrado porque tienen dos
            gestos directos cada una, y el régimen no tiene ninguno. Borrarlo lo dejaría
            inalcanzable. Es una propiedad del instrumento, como el tempo.

            El `title` dice la frase entera porque la palabra que la unía —«cambia»— se fue
            con la fila de arriba, y sin ella `Rotación | escala orden` se puede leer como
            si la rotación tuviera dos valores.

            Dos botones y no un ON/OFF: los dos valores son simétricos y ninguno es la
            ausencia del otro. Un ON/OFF diría que hay un régimen y una desviación, que es
            justo la lectura que D4 rechaza — no son dificultades, son dos reglas. El
            idioma visual sí es el mismo que el resto de la tarjeta usa para lo activo:
            fondo oscuro. */}
        {/* El grupo es `role="group"` y NO `radiogroup`, aunque los dos botones sean un
            conjunto exclusivo. Un `radiogroup` obliga a un modelo de foco —una sola parada
            de tabulación para el grupo entero y flechas para moverse adentro— y ese modelo
            lo fija el spec 026, que es el que contesta la pregunta que `specs/deuda.md`
            tiene abierta para el tablero. Decidirlo acá de refilón sería decidirlo dos
            veces y probablemente distinto: el `aria-pressed` de cada botón ya anuncia el
            estado sin comprometer el foco. */}
        <div className="flex items-center justify-between gap-1">
          <span id="rotacion-etiqueta" className="font-medium">Rotación</span>
          <div
            role="group"
            aria-labelledby="rotacion-etiqueta"
            title="La rotación cambia la fórmula de escala o el arranque del arpegio"
            className="flex gap-1"
          >
            {([REGIMEN.escala, REGIMEN.orden] as const).map(r=> (
              <button key={r} type="button" onClick={()=> onRegimen(r)} aria-pressed={regimen===r}
                      className={`px-2 py-0.5 rounded text-xs ${regimen===r?'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}>{r}</button>
            ))}
          </div>
        </div>
        <div className="pt-2 text-sm text-slate-600">
          <p><b>{selected}</b> → tónica {CHROMATIC[BASE_MAP[selected]]}</p>
          {/* La orientación EN TEXTO, y es lo único que el 019 suma en vez de restar. Al
              borrar los cuatro botones de grados la orientación queda sólo DERIVABLE: de la
              miniatura, que es ciega en 6 de las 12 piezas —hay 29 de 96 combinaciones que
              suenan distinto sin verse distinto, y la `X` rotada cuatro veces da cuatro
              arpegios y cero cambio en la forma—, o de los cinco nombres de `Notas
              actuales`, que sí las distingue las ocho pero obliga a deducirla. Lo que
              faltaba era un lector DIRECTO, que es exactamente la derivación que un panel
              existe para ahorrar. El argumento entero está en `orientation-text.ts`.

              No devuelve un botón —no se puede apretar— así que no deshace el borrado: lo
              que se fue era el camino lento a rotar, y lo que queda es el lector.

              `min-h-[1lh]` por lo mismo que el `2lh` de la línea de abajo: el peor caso
              (`270° · reflejada`) tiene que tener su alto reservado, para que la línea no
              mueva todo lo que tiene debajo al cambiar de orientación. Uno y no dos porque
              entra en un renglón en todo el rango de anchos — medido en el DOM. */}
          <p className="min-h-[1lh]">{grados}{reflejada !== null && ` · ${reflejada}`}</p>
          {/* Las dos lineas van RESERVADAS, no dejadas al contenido: el largo de esta
              linea depende de cuantos sostenidos tenga la escala, que va de 0 a 5
              sobre las 48 combinaciones de pieza x rotacion, y al envolver movia
              todo lo que tiene debajo —Tempo y la fila de transporte— 20 px hacia
              abajo al cambiar de pieza O de rotacion. Un panel de control que se
              acomoda solo cuando lo tocas es el bug: el boton se corre justo cuando
              vas a apretarlo.

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

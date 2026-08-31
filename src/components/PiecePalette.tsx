import { REGIMEN } from '../domain/constants/music.constants.ts';
import { textoDeOrientacion } from './orientation-text.ts';
import FloatingPanel from './FloatingPanel.tsx';
import OrientationPanel from './OrientationPanel.tsx';
import TransportPanel from './TransportPanel.tsx';
import type { Posicion, PropsDeOrientacion, PropsDeTransporte } from './types/panel.types.ts';

/**
 * El DOCK de piezas: el panel que flota sobre el tablero y **se arrastra a donde el usuario
 * quiera**.
 *
 * Presentacional: sin estado, sin efectos. Recibe los dos objetos de props —`orientacion` y
 * `transporte`—, el del plegado y el de la posicion; cada panel recibe solo el suyo, y el
 * criterio de reparto esta en `types/panel.types.ts`.
 *
 * ## De caja en celdas a caja medida por su contenido
 *
 * Hasta el 052 la caja media `2 x 4` celdas y ese numero salia de una medicion honesta:
 * `fixed right-0 top-1/2` tapa `(8,1)`…`(9,4)` y deja libres `(0,0)` y `(9,5)`, que son las
 * dos celdas que no se pueden tapar. **La medicion estaba bien y la respuesta era una sola
 * para todos los tableros y todas las sesiones**: si la pieza que interesaba caia debajo del
 * dock, la unica salida era plegarlo entero.
 *
 * El chasis arrastrable resuelve eso sin elegir por nadie, y de paso **retira la restriccion
 * que sostenia la caja**: «que celdas tapa» dejo de ser una propiedad fija del diseno y paso
 * a ser una posicion INICIAL mas la libertad de moverlo. Con eso la caja pasa a medirse por
 * su contenido, que es lo que arregla las dos mitades del mismo bug —el desborde de 1192 px
 * en vertical y la columna unica en horizontal—: el contenido no cabia en una caja que se
 * habia fijado sin mirarlo.
 *
 * ## El texto se fue del ojo y NO del arbol de accesibilidad
 *
 * De los 210 caracteres en 27 nodos que este panel tenia, se fueron los que eran PROSA:
 * la leyenda de gestos (227 px de alto, mas que el scroller entero), `Rotación`,
 * `F → tónica C` y `Notas actuales: …` (60 px de dos renglones reservados). Cada control que
 * perdio su texto visible conserva su nombre accesible y su `title`, que es lo que ya hacian
 * los tres botones del transporte.
 *
 * **Las doce letras no son prosa: son el simbolo**, y se quedan — ver `OrientationPanel`.
 *
 * La leyenda no se borro sin mas: era el UNICO lugar donde los cuatro gestos directos y la
 * letra estaban escritos, y su contenido vive en
 * [#170](https://github.com/federicohermo/pentomino-games/issues/170) para que vuelva en su
 * lugar propio y no como deuda invisible. Reponerlo es la segunda mitad del pedido y va en
 * su propio spec.
 */

interface Props {
  orientacion: PropsDeOrientacion;
  transporte: PropsDeTransporte;
  /** El plegado, que vive en el shell: este componente lo lee y lo pide, no lo guarda. */
  abierto: boolean;
  onToggle: () => void;
  /**
   * La posicion del flotante, que vive en el shell igual que el plegado.
   *
   * Entra por su PROPIA prop y no dentro del objeto `orientacion`: ese objeto es la mitad de
   * la barrera del `memo` de `OrientationPanel`, y meterle un valor que cambia con cada
   * gesto la romperia. El numero esta en `OrientationPanel`.
   */
  posicion: Posicion;
  onMover: (p: Posicion) => void;
}

export default function PiecePalette({
  orientacion, transporte, abierto, onToggle, posicion, onMover,
}: Props) {
  const { selected, orientaciones, regimen, onRegimen, onResetOrientacion } = orientacion;
  // La de la pieza en la mano, derivada del `Record` y no recibida como dos props sueltas:
  // dos fuentes de la misma verdad son dos formas de que la linea diga una orientacion y
  // la miniatura dibuje otra.
  const { rotation, mirror } = orientaciones[selected];
  const { grados, reflejada } = textoDeOrientacion(rotation, mirror);
  return (
    <FloatingPanel
      titulo="Piezas"
      idRegion="dock-piezas"
      abierto={abierto}
      onToggle={onToggle}
      posicion={posicion}
      onMover={onMover}
    >
      <OrientationPanel orientacion={orientacion} />
      {/* El `space-y-2` de las filas del medio compila a
          `& > :not([hidden]) ~ :not([hidden])`, un selector de HIJO DIRECTO, asi que
          cualquier envoltorio nuevo convierte dos hijos en uno y se come un margen con las
          clases intactas y sin que ningun test lo note. Sus hijos directos siguen siendo
          tres: el grupo del regimen, la linea de orientacion y el transporte. */}
      <div className="mt-4 space-y-2">
        {/* El régimen tiene fila propia, y no es cosmética. Llegó a ser
            la segunda línea de la fila de Rotación, y estaba escrito así a propósito:
            sin rotar el régimen no hace nada, así que en vez de abrir una
            fila completaba una —«Rotación … cambia escala / orden»— y el interruptor no
            necesitaba glosa. El 019 borra los cuatro botones de grados, o sea que la frase
            se queda SIN SUJETO: lo que era una segunda línea pasa a ser la fila.

            Y no se borra, aunque la tentación sea la misma que con los grados. El
            precedente es el `T070`: propuso borrar el botón de los clicks y el
            015 lo cerró con un «no» porque era la única forma de encender el recorrido. Acá
            está peor: la rotación y la reflexión sobreviven al borrado porque tienen dos
            gestos directos cada una, y el régimen no tiene ninguno. Borrarlo lo dejaría
            inalcanzable. Es una propiedad del instrumento, como el tempo.

            **Lo que el 052 saca es la palabra, no el control.** El `<span
            id="rotacion-etiqueta">Rotación</span>` era el ancla del `aria-labelledby` de
            este grupo, así que borrarlo sin más dejaría al `role="group"` sin nombre
            accesible y a `arbol-accesible.browser.test.tsx` en rojo. El nombre pasa a
            `aria-label`, que es lo que `.claude/rules/ui.md` manda cuando no hay texto
            visible que referenciar (AC9b).

            El grupo es `role="group"` y NO `radiogroup`, aunque los dos botones sean un
            conjunto exclusivo: un `radiogroup` obliga a un modelo de foco —una sola parada
            de tabulación y flechas para moverse adentro— y ese modelo lo fija el spec 026
            para el tablero. El `aria-pressed` de cada botón ya anuncia el estado sin
            comprometer el foco.

            Dos botones y no un ON/OFF: los dos valores son simétricos y ninguno es la
            ausencia del otro. Un ON/OFF diría que hay un régimen y una desviación, que es
            justo la lectura que D4 del 017 rechaza — no son dificultades, son dos reglas.

            Los dos glifos: `⇗` para `escala`, que es lo que cambia cuando la rotación mueve
            la FÓRMULA —las notas se van a otra altura—, y `⇄` para `orden`, que es lo que
            cambia cuando mueve el ARRANQUE del arpegio —las mismas notas, reordenadas—. Un
            par de glifos para una distinción abstracta no se explica solo, y por eso el
            `title` de cada uno dice la frase entera: acá el icono ahorra los 95 px de las
            dos palabras y el nombre accesible es el que hace el trabajo. */}
        <div role="group" aria-label="Qué cambia la rotación" className="flex gap-1">
          {([REGIMEN.escala, REGIMEN.orden] as const).map(r=> {
            const dice = r === REGIMEN.escala
              ? 'La rotación cambia la fórmula de escala'
              : 'La rotación cambia el arranque del arpegio';
            return (
              <button key={r} type="button" onClick={()=> onRegimen(r)} aria-pressed={regimen===r}
                      aria-label={dice} title={dice}
                      className={`px-2 py-0.5 rounded text-xs ${regimen===r?'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}
              >{r === REGIMEN.escala ? '⇗' : '⇄'}</button>
            );
          })}
        </div>
        {/* La orientación EN TEXTO, y es lo único que el 019 suma en vez de restar. Al
            borrar los cuatro botones de grados la orientación queda sólo DERIVABLE: de la
            miniatura, que es ciega en 6 de las 12 piezas —hay 29 de 96 combinaciones que
            suenan distinto sin verse distinto, y la `X` rotada cuatro veces da cuatro
            arpegios y cero cambio en la forma—. Lo que faltaba era un lector DIRECTO, que es
            exactamente la derivación que un panel existe para ahorrar.

            **No es prosa y por eso se queda.** Es la misma clase de nodo que el número del
            reloj: un LECTOR de dos caracteres, no una etiqueta ni una explicación. Lo que el
            052 saca son los 347 px de prosa, y esta línea mide 20.

            `min-h-[1lh]` para que el peor caso (`270° · reflejada`) tenga su alto reservado y
            la línea no mueva lo que tiene debajo al cambiar de orientación.

            Dice la de la PIEZA EN LA MANO y cambia al elegir otra, que es lo que hace visible
            la memoria: volver a la `F` que dejaste a 180° tiene que decir `180°`, o la
            memoria existe y no se ve. */}
        {/* El botón `0°` y no un icono: en la misma tarjeta hay un `↺` —en
            `TransportPanel.tsx`— y dos «volver atrás» tienen que decir cosas distintas. `0°`
            dice literalmente adónde lleva, recupera el vocabulario de los botones de grados
            que el 019 borró, y es tipográficamente incompatible con un glifo.

            Resetea la orientación ENTERA —rotación y reflexión—, no sólo los grados: una
            `X` reflejada suena distinto y no se ve (29 de las 96 orientaciones), así que un
            botón que la dejara «a 0° pero reflejada» dejaría vivo justo el estado invisible.
            Y resetea UNA pieza y no las doce: con memoria por pieza, si la `T` está a 90° es
            porque rotaste la `T`. */}
        <p className="min-h-[1lh] flex items-center gap-2">
          <span>{grados}{reflejada !== null && ` · ${reflejada}`}</span>
          <button
            type="button"
            onClick={onResetOrientacion}
            aria-label="Volver esta pieza a 0° sin reflejar"
            title="Volver esta pieza a 0° sin reflejar"
            className="px-1.5 rounded text-xs bg-slate-100 hover:bg-slate-200"
          >0°</button>
        </p>
        <TransportPanel transporte={transporte} />
      </div>
    </FloatingPanel>
  );
}

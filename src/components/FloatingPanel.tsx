import { useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useArrastre } from './use-drag.ts';
import type { Posicion } from './types/panel.types.ts';

/**
 * El chasis de un flotante: lo que se arrastra, lo que se pliega y lo que contiene.
 *
 * Presentacional en lo que decide —no tiene estado: la posición y el plegado viven en el
 * shell y le llegan por props—, y el único efecto que necesita lo pone `use-drag.ts`, que
 * es la regla del spec 022 y deja el issue #147 sin discusión.
 *
 * Lo usan **los dos** flotantes, y eso es AC11. Aplicarlo a uno solo dejaría dos idiomas
 * conviviendo, que es literalmente el desfasaje que el spec 052 abre.
 *
 * ## Por qué el asa y el plegado son DOS botones (AC12)
 *
 * Hasta acá el encabezado era un solo `<button>` que plegaba, y `.claude/rules/ui.md` lo
 * nombra como uno de los dos *disclosure* de la app. Si el arrastre naciera ahí, **el
 * `click` sintético con el que termina cualquier arrastre cerraría el panel al soltarlo**:
 * el navegador sintetiza un `click` después del `pointerup` sobre el mismo nodo.
 *
 * Las dos salidas eran un asa aparte o un umbral de arrastre que se coma el `click`. Va la
 * primera: la segunda deja un botón cuyo comportamiento depende de cuántos píxeles se movió
 * el puntero, que es justo lo que no se puede anunciar en el árbol de accesibilidad. Así
 * cada uno tiene **un solo trabajo y un solo nombre accesible**, y el título sigue siendo
 * lo que se agarra —que es lo que AC4 enfoca—.
 *
 * ## Por qué la posición va por `transform` y no por `left`/`top`
 *
 * `transform` no participa del layout: mover el panel no invalida el layout de nada, así
 * que el arrastre queda en la fase de composición. Con `left`/`top` cada píxel del gesto
 * dispararía un reflow del documento.
 *
 * Y el `transform` que React escribe **es una constante**: las dos custom properties de
 * adentro son lo que cambia, y las escribe `use-drag.ts`. El porqué —que es lo que impide
 * que React y el gesto se pisen sobre el mismo nodo— está ahí.
 */

interface Props {
  /** El texto del asa, que es también el nombre del panel. */
  titulo: string;
  /** El `id` de la región plegable, para el `aria-controls` del *disclosure*. */
  idRegion: string;
  abierto: boolean;
  onToggle: () => void;
  posicion: Posicion;
  onMover: (p: Posicion) => void;
  /**
   * Lo que el flotante mide, que el chasis no decide.
   *
   * El dock no pasa nada: desde que se arrastra, su caja **se mide por su contenido** —era
   * `calc(var(--cell) * 2)` y ahí adentro el contenido desbordaba 1192 px—. El de señal sí,
   * porque su canvas necesita un alto que darle al `ResizeObserver`.
   */
  caja?: CSSProperties;
  children: ReactNode;
}

export default function FloatingPanel({
  titulo, idRegion, abierto, onToggle, posicion, onMover, caja, children,
}: Props) {
  const panelRef = useRef<HTMLElement | null>(null);
  const { alBajarEnElAsa, alTeclearEnElAsa } = useArrastre(panelRef, posicion, onMover);

  // El fondo va semiopaco con `backdrop-blur` y no opaco, igual que los dos flotantes que
  // reemplaza: abajo hay celdas con nota, y un panel opaco las esconde mientras uno
  // translúcido dice que están ahí.
  //
  // `rounded-2xl` en los cuatro lados y no `rounded-l-2xl` / `rounded-tr-2xl`: aquellos
  // redondeaban sólo los vértices que no tocaban el borde de la pantalla, y eso valía
  // mientras la posición era fija. Un panel que se suelta en el medio del tablero tiene
  // cuatro vértices a la vista.
  return (
    <aside
      ref={panelRef}
      className="fixed left-0 top-0 z-20 flex flex-col rounded-2xl shadow-lg bg-white/85 backdrop-blur p-2 text-sm will-change-transform"
      style={{ ...caja, transform: 'translate3d(var(--panel-x), var(--panel-y), 0)' }}
    >
      <div className="shrink-0 flex items-center gap-1 mb-2">
        {/* El asa. `touch-none` es lo que hace que el arrastre funcione con el dedo: sin
            `touch-action: none` el navegador se queda el gesto para scrollear y el
            `pointermove` no llega nunca.

            El nombre accesible dice el título Y el gesto. Lo primero porque WCAG 2.5.3 pide
            que el nombre CONTENGA el texto visible —quien dicta «Piezas» tiene que activar
            este botón—; lo segundo porque un botón llamado sólo `Piezas` no dice qué hace, y
            las flechas del AC4 no se descubren de ninguna otra forma. No lleva `title`, y es
            deliberado: el título ya se lee en pantalla, así que un tooltip repetiría lo que
            se ve — ver AC9. */}
        <button
          type="button"
          onPointerDown={alBajarEnElAsa}
          onKeyDown={alTeclearEnElAsa}
          aria-label={`${titulo} — arrastrar el panel, o moverlo con las flechas`}
          className="flex-1 text-left text-base font-semibold cursor-grab active:cursor-grabbing touch-none"
        >{titulo}</button>
        {/* El *disclosure*, ahora un control propio. `aria-expanded` y no `aria-pressed`:
            `.claude/rules/ui.md` lo fija —`aria-pressed` dice que un control está hundido y
            `aria-expanded` que la región que controla está abierta—.

            Solo-icono, así que `aria-label` y `title` con el MISMO texto, como los tres
            botones del transporte: el puntero y el lector no pueden contar dos historias
            distintas del mismo botón. Y el nombre dice QUÉ hace, no en qué estado está: es
            la cláusula «el nombre de un toggle es lo que alterna, no el valor». */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={abierto}
          aria-controls={idRegion}
          aria-label={`${abierto ? 'Plegar' : 'Desplegar'} ${titulo}`}
          title={`${abierto ? 'Plegar' : 'Desplegar'} ${titulo}`}
          className="shrink-0 px-1.5 rounded text-xs bg-slate-100 hover:bg-slate-200"
        >{abierto ? '▾' : '▸'}</button>
      </div>
      {/* `hidden` y no desmontar, y de eso dependen dos cosas medidas que vienen de los dos
          flotantes que este chasis reemplaza. Una: el `ResizeObserver` del espectro redibuja
          porque su contenedor CAMBIA DE TAMAÑO, y desmontar el `<canvas>` dejaría al
          observador sin nada que observar. Dos: la barrera del `memo` de `OrientationPanel`
          — desmontar y remontar le cuesta exactamente las ejecuciones que el memo existe
          para ahorrar. */}
      <div id={idRegion} hidden={!abierto} className="min-h-0 flex-1">
        {children}
      </div>
    </aside>
  );
}

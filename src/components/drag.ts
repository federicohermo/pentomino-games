import { MARGEN_VISIBLE_PX, PASO_TECLADO_PX } from './constants/layout.constants.ts';
import type { Caja, Delta, Posicion } from './types/panel.types.ts';

/**
 * Las dos decisiones del arrastre de un flotante, sin DOM: adónde va el panel y qué
 * desplazamiento pide una tecla.
 *
 * Vive acá y no en `use-drag.ts` por el motivo de siempre —el mismo reparto que
 * `grid-fit.ts` contra `use-grid.ts`—: así se testea en `environment: 'node'`, sin
 * navegador y sin fabricar un `PointerEvent`. Lo que queda del otro lado es cableado
 * —`setPointerCapture`, los dos listeners sobre `window` y la escritura del `transform`—.
 *
 * No es una preferencia de estilo sino el riesgo 1 del research: el umbral de coverage es
 * **100 en las cuatro métricas** y un chasis con arrastre tiene ramas —dentro y fuera del
 * viewport por los cuatro bordes, puntero y teclado—. Agotarlas desde el navegador cuesta
 * un evento sintético por rama; acá cuesta una llamada.
 */

/**
 * Acota un número a un intervalo, y **sin una sola rama**.
 *
 * `Math.min(Math.max(v, min), max)` en vez de dos `if`: las ramas que no se escriben no
 * hay que cubrirlas, y acá el umbral 100 las cobraría de a una. De paso contesta el caso
 * degenerado —un viewport tan chico que `min > max`, o sea una caja que no entra ni con el
 * margen— devolviendo `max` en vez de tirar: en una ventana de cero píxeles lo que
 * corresponde es pegar el panel al borde, no romper.
 */
const acotar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * La posición nueva del panel después de un desplazamiento, **acotada para que nunca se
 * pueda perder** (AC5).
 *
 * El acotado no es simétrico en los dos ejes, y ésa es toda la decisión:
 *
 * ```
 * x   MARGEN_VISIBLE_PX - caja.ancho  …  viewport.ancho - MARGEN_VISIBLE_PX
 * y   0                               …  viewport.alto  - MARGEN_VISIBLE_PX
 * ```
 *
 * En horizontal el panel puede salirse casi entero por cualquiera de los dos lados y
 * siempre queda una franja de `MARGEN_VISIBLE_PX` adentro, que alcanza para agarrarlo. En
 * vertical el tope de arriba es **0**: el asa vive en el borde superior del chasis, así que
 * subirlo más allá del viewport escondería justo el control con el que se lo trae de
 * vuelta y quedaría un panel visible e inmóvil. El porqué del número está en
 * `MARGEN_VISIBLE_PX`.
 *
 * Recibe el viewport y la caja en vez de leerlos: son las dos lecturas de layout que el
 * hook ya hace, y pedírselas es lo que deja a esta función corriendo en `node`.
 */
export function moverPanel(pos: Posicion, delta: Delta, viewport: Caja, caja: Caja): Posicion {
  return {
    x: acotar(pos.x + delta.dx, MARGEN_VISIBLE_PX - caja.ancho, viewport.ancho - MARGEN_VISIBLE_PX),
    y: acotar(pos.y + delta.dy, 0, viewport.alto - MARGEN_VISIBLE_PX),
  };
}

/**
 * El desplazamiento que pide una flecha, o `null` si la tecla no es nuestra (AC4).
 *
 * Sin esto el chasis sería un control **sólo-mouse**, que es agrandar
 * [#48](https://github.com/federicohermo/pentomino-games/issues/48) en vez de achicarlo: el
 * arrastre resuelve «la celda que me interesa está tapada» para quien usa el puntero y no
 * para quien no.
 *
 * Devuelve `null` y no un delta de cero para las teclas ajenas, porque el llamador tiene
 * que poder distinguirlas: con cero no sabría si frenar el default del navegador. Es la
 * misma forma que `piezaDeTecla` en `input.ts`.
 *
 * **Sólo las cuatro flechas.** Un `Shift` que multiplique el paso es una quinta rama a
 * cubrir por un gesto que ningún criterio de aceptación pide, y el paso de
 * `PASO_TECLADO_PX` ya cruza la pantalla en menos de cien pulsaciones.
 */
export function pasoDeTecla(key: string): Delta | null {
  if (key === 'ArrowLeft') return { dx: -PASO_TECLADO_PX, dy: 0 };
  if (key === 'ArrowRight') return { dx: PASO_TECLADO_PX, dy: 0 };
  if (key === 'ArrowUp') return { dx: 0, dy: -PASO_TECLADO_PX };
  if (key === 'ArrowDown') return { dx: 0, dy: PASO_TECLADO_PX };
  return null;
}

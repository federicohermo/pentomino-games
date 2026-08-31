/**
 * El andamio para arrastrar algo en un navegador de verdad, y **una sola copia de la trampa
 * que lo hace necesario**.
 *
 * Es el `browser-setup.ts` de los gestos: lo comparten los cuatro archivos que ejercitan el
 * chasis —`FloatingPanel`, `PiecePalette`, `TransportPanel` y `App`—, que lo escribieron por
 * separado y terminaron con cuatro versiones del mismo párrafo. Un hecho escrito cuatro
 * veces son cuatro lugares donde puede quedar desactualizado.
 *
 * No lo colecta ningún proyecto de Vitest: los dos piden un sufijo de archivo de test que
 * este módulo no tiene. Y no entra al coverage, que excluye la carpeta entera.
 */

/**
 * Reemplaza `setPointerCapture` sobre el nodo, y devuelve el nodo para poder encadenar.
 *
 * **La trampa, escrita una vez**: `setPointerCapture` con un `pointerId` que el navegador no
 * emitió tira `NotFoundError` en un Chromium de verdad, y el error se lleva puesto el
 * `pointerdown` entero. Sin esto el gesto no arranca y el test pasa en verde por el motivo
 * equivocado.
 *
 * Se stubea y **no se saltea la llamada** en producción: la captura es justamente lo que hace
 * que el gesto sobreviva a salirse del asa. Lo que acá la reemplaza es despachar los otros
 * dos eventos sobre `window`, que es donde `use-drag.ts` escucha.
 */
export function stubearCaptura<T extends Element>(el: T): T {
  el.setPointerCapture = () => undefined;
  el.releasePointerCapture = () => undefined;
  return el;
}

/** Un `PointerEvent` con lo que los handlers leen: el id, las coordenadas y que burbujee. */
export function eventoDePuntero(tipo: string, x: number, y: number): PointerEvent {
  return new PointerEvent(tipo, {
    pointerId: 1, bubbles: true, cancelable: true, clientX: x, clientY: y, isPrimary: true,
  });
}

/**
 * Un arrastre completo desde el centro de un asa: `pointerdown` sobre ella, `pointermove` y
 * `pointerup` sobre `window`.
 *
 * No manda el `click` sintético con el que el navegador termina un arrastre real. Es
 * deliberado: ese `click` es el sujeto de AC12 y no un detalle del andamio, así que el
 * archivo que lo verifica lo despacha él, a la vista.
 */
export function arrastrar(asa: HTMLElement, dx: number, dy: number): void {
  const r = asa.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  stubearCaptura(asa);
  asa.dispatchEvent(eventoDePuntero('pointerdown', x, y));
  window.dispatchEvent(eventoDePuntero('pointermove', x + dx, y + dy));
  window.dispatchEvent(eventoDePuntero('pointerup', x + dx, y + dy));
}

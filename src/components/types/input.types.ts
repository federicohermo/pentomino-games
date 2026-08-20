import type { ACCION, EDICION } from '../constants/input.constants.ts';

/** Las tres acciones de entrada: ver `ACCION` en `input.constants.ts`. */
export type Accion = (typeof ACCION)[keyof typeof ACCION];

/** Lo que pide un click sobre una celda: ver `EDICION` en `input.constants.ts`. */
export type Edicion = (typeof EDICION)[keyof typeof EDICION];

/**
 * Los campos de un evento de teclado que la decisión necesita — y ninguno más.
 *
 * No es el `KeyboardEvent` del DOM a propósito: los tests de `src/` corren en
 * `environment: 'node'` y no hay jsdom, así que una pura que reciba el evento no se
 * puede testear sin fabricar uno. Recibiendo campos, las cinco guardas quedan cubiertas
 * en `environment: 'node'` y lo único que queda sin test es el cableado.
 *
 * `targetEsControl` y `tapLimpio` los calcula el llamador porque salen de afuera del
 * evento: el primero mira el `e.target` contra `HTMLButtonElement`/`HTMLInputElement`
 * —tipos del DOM que la pura no puede ver— y el segundo es estado entre eventos, que
 * una pura por definición no tiene.
 */
export interface EventoDeTecla {
  /** El `key` del DOM: `'Shift'`, `'Control'` o `' '` para la barra espaciadora. */
  key: string;
  tipo: 'keydown' | 'keyup';
  /** El auto-repeat del sistema. Solo lo ejerce la barra, que es la única en `keydown`. */
  repeat: boolean;
  /** El foco está sobre un `<button>` o un `<input>`: el navegador se queda el evento. */
  targetEsControl: boolean;
  /** Mientras el modificador estuvo abajo no llegó otra tecla ni la rueda (D10). */
  tapLimpio: boolean;
}

/**
 * Los cuatro modificadores que un `keydown` reporta, más la tecla que lo produjo.
 *
 * Es lo único que hace falta para saber si el `keydown` ABRE un tap o lo ensucia, y va
 * separado de `EventoDeTecla` porque esa pregunta se contesta antes: el tap es lo que
 * `EventoDeTecla` recibe ya resuelto.
 */
export interface EventoDeModificador {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

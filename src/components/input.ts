import { ACCION } from './constants/input.constants.ts';
import type { Accion, EventoDeTecla } from './types/input.types.ts';

/**
 * La DECISIÓN de cada gesto de entrada, separada del cableado que la ejecuta.
 *
 * ## Por qué estas puras reciben campos y no el evento
 *
 * Los tests de `src/` corren con Vitest en `environment: 'node'` y el repo no tiene
 * jsdom: no hay `KeyboardEvent` ni `MouseEvent` que fabricar, y tampoco hay forma de
 * montar un componente para dispararlos. Recibiendo los campos que importan, las
 * guardas quedan testeadas de verdad y lo único que queda sin red es que `App.tsx` los
 * llene bien — que es exactamente lo que las tareas `[M]` del spec 013 verifican en el
 * navegador.
 *
 * ## Por qué viven acá y no en `App.tsx`
 *
 * `react-refresh/only-export-components` prohíbe que un `.tsx` exporte algo que no sea
 * el componente, así que una pura escrita adentro de `App.tsx` no se puede exportar y
 * por lo tanto no se puede testear. Es el mismo movimiento con el que `cell-text.ts`
 * salió de `Board.tsx` en el spec 012, y por el mismo motivo: ahí vivía el bug.
 *
 * De los seis criterios que estas tres funciones cubren, el que justifica el archivo es
 * AC6: en macOS `Ctrl`+click ES el click derecho, y este repo se desarrolla en Windows,
 * donde ese cruce no se puede ver a ojo. El test es la única forma de atraparlo.
 */

/**
 * La rotación que deja la rueda: abajo (`deltaY > 0`) suma 90°, arriba resta 90°.
 *
 * El `+ 4` no es decorativo: en JS `-1 % 4` es `-1`, así que sin él la rueda hacia
 * arriba desde `0` devolvería `-1` y `rotateN` recibiría un índice que no existe.
 *
 * Un `deltaY` de 0 no rota. Llega de verdad —un scroll horizontal puro con `deltaX`
 * deja `deltaY` en 0— y girar ahí sería rotar sin que nadie lo haya pedido.
 */
export function rotacionPorRueda(rotation: number, deltaY: number): number {
  const delta = deltaY > 0 ? 1 : deltaY < 0 ? -1 : 0;
  return (rotation + 4 + delta) % 4;
}

/**
 * Qué acción pide una tecla, o `null` si el evento no es nuestro.
 *
 * Las cuatro guardas, en orden y con su motivo:
 *
 * 1. **`targetEsControl`** — con el foco sobre un `<button>` o un `<input>` el navegador
 *    ya tiene un significado para la barra: activar el control. Si además contestáramos
 *    nosotros, apretar Play con el mouse y después la barra alternaría el transporte dos
 *    veces (el handler global más la activación nativa) y el instrumento no arrancaría.
 *    Devolver `null` acá deja pasar la vía nativa entera, sin un `blur()` a mano.
 * 2. **`repeat`** — mantener una tecla apretada dispara `keydown` a la cadencia de
 *    repetición del sistema. La ejerce la barra, que es la única que sigue en `keydown`;
 *    los modificadores actúan en `keyup`, que no se auto-repite.
 * 3. **Los modificadores actúan al SOLTAR y solo si el tap fue limpio** — `Ctrl`+C,
 *    `Ctrl`+V, `Ctrl`+R y cualquier mayúscula empiezan con el `keydown` del modificador.
 *    Atado al `keydown`, copiar un texto daría vuelta la reflexión sin que nadie lo pida
 *    y sin que se vea. El `tapLimpio` lo ensucian otra tecla y la rueda; el mouse no,
 *    porque el `Ctrl`+click de macOS necesita que el `keyup` sea el que alterna (D2).
 * 4. **La barra sigue en `keydown`** — es donde el navegador scrollea, así que es el
 *    único momento en que un `preventDefault` sirve de algo.
 */
export function accionDeTecla(e: EventoDeTecla): Accion | null {
  if (e.targetEsControl) return null;
  if (e.repeat) return null;

  if (e.key === 'Shift') return e.tipo === 'keyup' && e.tapLimpio ? ACCION.rotar : null;
  if (e.key === 'Control') return e.tipo === 'keyup' && e.tapLimpio ? ACCION.reflejar : null;
  if (e.key === ' ') return e.tipo === 'keydown' ? ACCION.transporte : null;

  return null;
}

/**
 * Si un `contextmenu` sobre el tablero tiene que alternar la reflexión.
 *
 * `ctrlKey` lo veta, y esa línea es todo el AC6: en macOS `Ctrl`+click es la forma de
 * emitir el click secundario sin mouse, y el sistema lo entrega como `contextmenu` con
 * `ctrlKey: true`. Sin la guarda, el `keyup` de `Ctrl` alterna una vez y este handler
 * la deshace — neto cero, o sea que en una laptop de Apple sin mouse la reflexión no
 * respondería nunca. En Windows un click derecho de verdad llega con `ctrlKey: false`,
 * así que la guarda no le saca nada.
 *
 * Quien quiera reflejar con el trackpad usa el click secundario de dos dedos, que llega
 * sin `ctrlKey`; quien quiera hacerlo con el teclado usa `Ctrl` solo.
 */
export function reflejaElContextMenu(e: { ctrlKey: boolean }): boolean {
  return !e.ctrlKey;
}

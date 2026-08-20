import { ACCION, EDICION } from './constants/input.constants.ts';
import type { Accion, Edicion, EventoDeTecla, EventoDeModificador } from './types/input.types.ts';
import type { PieceKey } from '../domain/types/pieces.types.ts';
import type { PlacedPiece } from '../domain/types/board.types.ts';

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
 * De los seis criterios que estas puras cubren, el que justifica el archivo es
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
 * deja `deltaY` en 0— y girar ahí sería rotar sin que nadie lo haya pedido. El cableado
 * de `App.tsx` además **sale antes** en ese caso, por un motivo que esta pura no puede
 * ver: el nodo que escucha la rueda es el `overflow-x-auto` con el que se recorre la
 * grilla debajo de `md`, así que hacerle `preventDefault` a un gesto horizontal sería
 * dejar sin scroll al único elemento que lo tiene.
 */
export function rotacionPorRueda(rotation: number, deltaY: number): number {
  const delta = deltaY > 0 ? 1 : deltaY < 0 ? -1 : 0;
  return (rotation + 4 + delta) % 4;
}

/**
 * Si este `keydown` ABRE un tap limpio. Si no, ensucia el que hubiera abierto.
 *
 * El spec 013 describe la regla como «arranca en `true` con el `keydown` del
 * modificador», y así escrita tiene un agujero que el código destapa: `Ctrl`+`Shift`
 * son DOS keydown de modificador seguidos, así que los dos abrirían tap y al soltarlos
 * la pieza rotaría y se reflejaría sola. No es un caso inventado — `Ctrl`+`Shift` es el
 * atajo con el que Windows cambia de distribución de teclado, y a diferencia de
 * `Ctrl`+`Shift`+`I` no trae una tercera tecla que ensucie el tap.
 *
 * De ahí la condición completa: un modificador abre tap solo si **ningún otro**
 * modificador estaba abajo. `Alt` y `Meta` cuentan aunque no sean nuestros — `Alt` lo
 * reserva el spec 014 para mutear, y `Meta` es el modificador de los atajos de macOS.
 */
export function abreTapLimpio(e: EventoDeModificador): boolean {
  const otroAbajo = (e.key !== 'Shift' && e.shiftKey)
    || (e.key !== 'Control' && e.ctrlKey)
    || e.altKey || e.metaKey;
  return (e.key === 'Shift' || e.key === 'Control') && !otroAbajo;
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
 *
 * Lo que esta función NO contesta es si hay que hacer `preventDefault`: son dos
 * preguntas distintas y las separa la guarda 2. Ver `frenaElDefault`.
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
 * Si el navegador **no** puede quedarse el evento entero.
 *
 * Es una pregunta distinta de la de `accionDeTecla` aunque parezca la misma, y las
 * separa un solo caso: la barra con auto-repeat. Ahí `accionDeTecla` devuelve `null`
 * —mantenerla apretada no tiene que alternar el transporte treinta veces por segundo—
 * pero el default sigue vivo, porque **cada `keydown` repetido trae el suyo** y el de
 * la barra es scrollear. Fundidas en una sola pregunta, un tap un poco largo arrancaba
 * el transporte una vez y después scrolleaba la página a la cadencia de repetición del
 * sistema, que es justo lo que AC7 dice que no pasa.
 *
 * `targetEsControl` la veta igual que a la acción, y por el mismo motivo de D4: si el
 * foco está sobre un `<button>` o un `<input>`, el evento es del navegador entero y no
 * a medias — es lo que deja que la barra active el control armado sin un `blur()` a
 * mano.
 *
 * Los modificadores no aparecen acá: `Shift` y `Control` sueltos no tienen ningún
 * default que frenar, ni al bajar ni al soltar.
 */
export function frenaElDefault(e: EventoDeTecla): boolean {
  return !e.targetEsControl && e.key === ' ' && e.tipo === 'keydown';
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

/**
 * Si la celda clickeada está ocupada por una pieza **del mismo tipo que el seleccionado**.
 *
 * Es la llave de toda la edición en el tablero (D2 del spec 014), y está escrita una sola
 * vez porque la usan dos: el handler del click y la derivación del hover, que decide el
 * cursor y si se pinta el fantasma. Dos copias de esta condición serían dos formas de
 * discrepar sobre si un click va a borrar — con el cursor prometiendo una cosa y el click
 * haciendo otra.
 *
 * **No** es «la jugada es inválida»: eso también es cierto al chocar contra una pieza
 * distinta, y ahí no tiene que pasar nada. Y **no** es «hay alguna pieza de ese tipo en el
 * tablero»: se mide sobre la celda clickeada, así que con dos `N` colocadas se edita la
 * que se tocó y no la otra.
 *
 * Que haya que tener la pieza en la mano para tocarla es lo que evita que editar sea un
 * accidente: sin esa condición, cualquier click mal apuntado sobre el tablero borraría.
 */
export function esLaPiezaEnLaMano(ocupante: PlacedPiece | null, selected: PieceKey): boolean {
  return ocupante !== null && ocupante.piece === selected;
}

/**
 * Qué le pide al tablero un click sobre la celda `(x, y)`, o `null` si no pide nada.
 *
 * Las cuatro ramas de la tabla del spec 014, con `Alt` significando "muteado" en los dos
 * lados del gesto:
 *
 * ```
 * celda ocupada por la pieza que está en la mano
 *   ├─ sin Alt → quitar esa pieza
 *   └─ con Alt → alternar su muteo
 * celda ocupada por OTRA pieza → nada (como antes de este spec)
 * celda libre
 *   ├─ sin Alt → colocar
 *   └─ con Alt → colocar ya muteada
 * ```
 *
 * El reparto —click quita, `Alt`+click mutea— y no al revés: con el contrario, **quitar**
 * quedaría alcanzable únicamente a través de mutear, o sea que para borrar una pieza que
 * nadie quiso mutear habría que mutearla primero. Así las dos operaciones cuestan un
 * gesto, y la destructiva es casi reversible: con la misma pieza y la misma orientación
 * en la mano, volver a clickear la repone en el mismo lugar.
 *
 * `colocar` no promete que la jugada entre: la validez la sigue decidiendo `isValid` del
 * dominio, en el llamador, porque depende de las otras cuatro celdas de la pieza y no de
 * la que se clickeó. Esta pura contesta QUÉ gesto es, no si es posible.
 */
export function accionDeClick(ocupante: PlacedPiece | null, selected: PieceKey, altKey: boolean): Edicion | null {
  if (esLaPiezaEnLaMano(ocupante, selected)) return altKey ? EDICION.mutear : EDICION.quitar;
  if (ocupante !== null) return null;
  return altKey ? EDICION.colocarMuteada : EDICION.colocar;
}

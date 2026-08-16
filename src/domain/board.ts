import type { Cell } from './types/transform.types.ts';
import type { PlacedPiece } from './types/board.types.ts';
import { GRID_W, GRID_H } from './constants/board.constants.ts';

/**
 * Las reglas del tablero: donde cae una pieza y si la jugada es legal.
 *
 * Las tres reciben todo por parametro en vez de cerrar sobre estado: es lo que las
 * hace testeables y lo que evita que el spec 006 tenga que reimplementar la regla
 * de colocacion en su propio modulo.
 */

/**
 * Celdas que ocuparia `shape` si su celda de agarre cae en `(x, y)`.
 *
 * Recibe `shape` ya transformada y `anchorIndex` en vez de calcularlos: quien
 * llama tiene la forma memoizada, asi que no hay que volver a rotar en cada hover.
 * El ancla sale por indice y no por busqueda gracias al invariante del orden del
 * array (ver `transform.ts`).
 *
 * `shape` entra `readonly` justamente porque viene memoizada: mutarla seria mutar
 * un valor que React ya entrego.
 */
export function cellsAt(shape: readonly Cell[], anchorIndex: number, x: number, y: number): Cell[] {
  const [ax, ay] = shape[anchorIndex];
  const ox = x - ax;
  const oy = y - ay;
  return shape.map(([cx, cy]): Cell => [cx + ox, cy + oy]);
}

/** Dentro del tablero y sin solaparse con lo ya colocado. */
export function isValid(cells: Cell[], placed: readonly PlacedPiece[]): boolean {
  if (cells.some(([x, y]) => x < 0 || y < 0 || x >= GRID_W || y >= GRID_H)) return false;
  for (const p of placed) {
    const set = new Set(p.cells.map(([x, y]) => `${x},${y}`));
    if (cells.some(([x, y]) => set.has(`${x},${y}`))) return false;
  }
  return true;
}

/**
 * Posicion de una pieza dentro del compas: la columna de su celda de agarre,
 * como fraccion del ancho del tablero.
 *
 * **El eje X del tablero es tiempo**, y esta es la funcion que lo dice. Fraccion
 * y no segundos: asi mover el tempo estira el patron en vez de reordenarlo, y el
 * mismo tablero suena siempre igual porque la fase se deriva de la geometria y no
 * del reloj de pared.
 *
 * La columna sale por INDICE y no por busqueda gracias al invariante del orden
 * del array: `cells` se construye con `cellsAt`, que es un `map`, asi que
 * `ANCHOR_INDEX` sigue apuntando a la celda de agarre ya en coordenadas de
 * tablero.
 */
export function phaseFor(cells: readonly Cell[], anchorIndex: number): number {
  return cells[anchorIndex][0] / GRID_W;
}

/** La pieza que ocupa `(x, y)`, o null. */
export function occupantAt(placed: readonly PlacedPiece[], x: number, y: number): PlacedPiece | null {
  for (const p of placed) {
    if (p.cells.some(([cx, cy]) => cx === x && cy === y)) return p;
  }
  return null;
}

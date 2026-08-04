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

/** La pieza que ocupa `(x, y)`, o null. */
export function occupantAt(placed: readonly PlacedPiece[], x: number, y: number): PlacedPiece | null {
  for (const p of placed) {
    if (p.cells.some(([cx, cy]) => cx === x && cy === y)) return p;
  }
  return null;
}

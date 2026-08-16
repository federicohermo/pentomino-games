import type { Cell } from '../../src/domain/types/transform.types.ts';

/**
 * Render ASCII de una forma. Es lo unico geometrico que el server escribe por su
 * cuenta, y a proposito: **no es dominio**. Rotar, reflejar, colocar y validar
 * vienen de `src/domain/`; esto solo dibuja lo que aquellas devolvieron.
 *
 * Existe porque una pieza descrita como cinco pares de coordenadas no se ve, y
 * ver la forma es la mitad de lo que la tool responde.
 */

/** Celda ocupada. */
const CELL = '#';
/** Celda de agarre: la que queda bajo el cursor al colocar. */
const ANCHOR = '@';
/** Hueco dentro del bounding box. */
const EMPTY = '.';

/**
 * Dibuja `cells` en su bounding box, marcando la celda `anchorIndex`.
 *
 * Traslada por el minimo en vez de asumir que la forma esta normalizada: asi
 * sirve igual para una forma canonica y para celdas ya en coordenadas de tablero.
 *
 * `y` crece hacia ABAJO —son coordenadas de grilla—, asi que la fila 0 del string
 * es la de arriba y el dibujo coincide con lo que se ve en pantalla.
 */
export function renderAscii(cells: readonly Cell[], anchorIndex: number): string {
  if (cells.length === 0) return '';

  const minx = Math.min(...cells.map(c => c[0]));
  const miny = Math.min(...cells.map(c => c[1]));
  const width = Math.max(...cells.map(c => c[0])) - minx + 1;
  const height = Math.max(...cells.map(c => c[1])) - miny + 1;

  const grid: string[][] = Array.from({ length: height }, () => Array<string>(width).fill(EMPTY));
  cells.forEach(([x, y], k) => {
    grid[y - miny][x - minx] = k === anchorIndex ? ANCHOR : CELL;
  });

  return grid.map(row => row.join('')).join('\n');
}

/** Ancho y alto del bounding box de una forma. */
export function sizeOf(cells: readonly Cell[]): { width: number; height: number } {
  if (cells.length === 0) return { width: 0, height: 0 };
  return {
    width: Math.max(...cells.map(c => c[0])) - Math.min(...cells.map(c => c[0])) + 1,
    height: Math.max(...cells.map(c => c[1])) - Math.min(...cells.map(c => c[1])) + 1,
  };
}

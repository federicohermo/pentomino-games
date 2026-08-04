import type { Cell } from './types/transform.types.ts';

/**
 * Geometria de las piezas: rotacion, reflexion y normalizacion.
 *
 * INVARIANTE que no hay que romper: las tres son `map`, asi que **la celda del
 * indice `k` sigue siendo la misma celda logica despues de transformar**.
 * `ANCHOR_INDEX` depende de esto —guarda la celda de agarre como indice, no como
 * coordenada—, igual que la fase por pieza del spec 004, que lee la columna del
 * ancla por indice sobre `PlacedPiece.cells`. Filtrar, ordenar o reagrupar celdas
 * dentro de estas funciones rompe la colocacion de piezas **sin ningun error
 * visible**.
 *
 * `y` crece hacia ABAJO: son coordenadas de grilla, no cartesianas, asi que el
 * recorrido angular va en sentido horario en pantalla.
 */

/** Rotacion de 90°. Produce `-0` cuando `x = 0`; ver `sameCell` en invariants.ts. */
export function rotate90(cells: Cell[]): Cell[] { return cells.map(([x,y]): Cell => [y, -x]); }

/** Traslada la forma para que su esquina superior izquierda quede en (0,0). */
export function normalize(cells: Cell[]): Cell[]{
  const minx = Math.min(...cells.map(c=>c[0]));
  const miny = Math.min(...cells.map(c=>c[1]));
  return cells.map(([x,y]) => [x-minx, y-miny]);
}

/** `n` rotaciones de 90°, normalizando en cada paso. */
export function rotateN(cells: Cell[], n: number): Cell[]{ let r = normalize(cells); for(let i=0;i<n;i++) r = normalize(rotate90(r)); return r; }

/** Espejo vertical: `x -> -x`, renormalizado. */
export function reflect(cells: Cell[]): Cell[]{
  const refl: Cell[] = cells.map(([x,y]): Cell => [-x, y]);
  return normalize(refl);
}

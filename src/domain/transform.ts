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

/**
 * Centro de masa de una forma: el promedio de las coordenadas.
 *
 * Promedio y no centro de la bounding box: es lo que hace que el recorrido
 * angular quede repartido alrededor de la MASA de la pieza y no de su caja.
 * En una `L` las dos cosas caen en lugares distintos.
 *
 * Casi nunca da enteros —es un promedio de quintos—, asi que comparar contra
 * el resultado pide epsilon y no `===`.
 */
export function centroid(cells: readonly Cell[]): [number, number] {
  let sx = 0, sy = 0;
  for (const [x, y] of cells) { sx += x; sy += y; }
  return [sx / cells.length, sy / cells.length];
}

/**
 * Angulo de una celda vista desde el centroide, normalizado a `[0, 2π)`.
 *
 * `y` crece hacia ABAJO: son coordenadas de grilla, no cartesianas, asi que el
 * angulo crece en sentido HORARIO en pantalla y la celda al SUR del centroide
 * da `π/2` y no `-π/2`. No esta mal — es exactamente la clase de detalle que
 * alguien "arregla" por error, y por eso tiene un test propio.
 *
 * La normalizacion a `[0, 2π)` no es cosmetica: `atan2` devuelve `(-π, π]`, que
 * corta el anillo justo al oeste, y ordenar con eso pondria las celdas del
 * noroeste antes que las del norte.
 */
export function angleFromCentroid(cell: Cell, cent: readonly [number, number]): number {
  const twoPi = 2 * Math.PI;
  const a = Math.atan2(cell[1] - cent[1], cell[0] - cent[0]);
  if (a >= 0) return a;

  // El intervalo es SEMIABIERTO y la suma sola no lo garantiza: con `a` negativo
  // mas chico que el ulp de 2π (~8,9e-16) —una celda apenas al norte del este—,
  // `a + 2π` redondea a exactamente 2π y el resultado se sale del rango.
  //
  // No cambia ningun orden: 2π y 2π-ulp caen los dos al final del anillo, que es
  // donde va esa celda. Se acota igual porque el rango es el contrato que lee
  // `degreeByCellIndex`, y esta funcion recibe formas arbitrarias a proposito —
  // con las 12 de `SHAPES` no puede pasar, porque las coordenadas son enteras y
  // el centroide es una suma sobre 5, asi que `dy` o es cero exacto o es O(0,1).
  const norm = a + twoPi;
  return norm < twoPi ? norm : twoPi * (1 - Number.EPSILON);
}

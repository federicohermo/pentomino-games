import type { Cell } from '../types/transform.types.ts';

/**
 * Dimensiones del tablero.
 *
 * `GRID_W` ya NO es la cantidad de posiciones dentro del compas: eso valia
 * mientras el eje X era tiempo y la fase de una pieza salia de su columna (spec
 * 004). El spec 009 reemplaza esa lectura por el recorrido — el tiempo lo da el
 * orden en que se visitan las piezas, no la abscisa—, asi que `GRID_W` volvio a
 * ser ancho a secas.
 *
 * Lo que si sigue dependiendo de las dos: las 60 celdas del circuito y los dos
 * extremos de la costura, que se derivan de aca y no se escriben a mano.
 */
export const GRID_W = 10;
export const GRID_H = 6;

/**
 * Los dos extremos de la costura: el tablero se repliega sobre si mismo y `(0,0)`
 * queda adyacente a `(9,5)` (spec 009, D2).
 *
 * Es UNA arista extra, no un toroide ni envoltura de todo el borde: ningun otro
 * par de celdas del borde se toca de mas. Medido sobre los 3.600 pares: acorta
 * 496 (13,8 %) y baja la distancia maxima del tablero de 14 a 12.
 *
 * El orden importa y lo leen `bestRoute` y `pathBetween`: `SEAM[0]` es el
 * arranque del circuito y `SEAM[1]` su final, y de ahi salen los nombres
 * `viaStart` y `viaEnd` de `ROUTE`.
 */
export const SEAM: readonly [Cell, Cell] = [[0, 0], [GRID_W - 1, GRID_H - 1]];

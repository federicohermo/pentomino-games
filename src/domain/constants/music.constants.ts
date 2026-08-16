import type { PieceKey } from '../types/pieces.types.ts';

/** Las 12 clases de altura, en orden. El indice ES la clase de altura. */
export const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const;

export const PENT_MAJOR: number[] = [0,2,4,7,9];
export const PENT_MINOR: number[] = [0,3,5,7,10];
export const PENT_BLUES5: number[] = [0,3,5,6,7];

/**
 * Notas que dispara una pieza: las cuatro formulas son pentatonicas.
 *
 * Coincide con `CELLS_PER_PIECE` y **ya no es una coincidencia**: son 5 notas
 * porque la escala es pentatonica y 5 celdas porque la pieza es un pentomino,
 * pero desde el spec 007 `degreeByCellIndex` empareja las dos listas y cada
 * celda tiene su nota.
 *
 * O sea que los dos numeros pasaron de coincidir a tener que coincidir: una
 * formula de 4 notas dejaria una celda sin nota —`ascendente[4]` seria
 * `undefined`— y una de 6 dejaria una nota que ninguna celda dispara.
 */
export const NOTES_PER_PIECE = 5;

/**
 * Pieza → clase de altura de su tonica (F→C, I→C#, … Z→B).
 *
 * Tipado `Record<PieceKey, number>` y no `as const`: agregar una pieza sin darle
 * tonica pasa a ser error de compilacion.
 *
 * Cuidado con la colision de nombres: la PIEZA `F` suena con tonica C; la nota F
 * le corresponde a la pieza `T`.
 */
export const BASE_MAP: Record<PieceKey, number> = {
  F:0, I:1, L:2, N:3, P:4, T:5, U:6, V:7, W:8, X:9, Y:10, Z:11,
};

/** Octava en la que se construye el arpegio de una pieza. */
export const DEFAULT_OCTAVE = 4;

/**
 * Tolerancia de las dos comparaciones de `degreeByCellIndex`: "esta celda cae
 * sobre el centroide" y "estas dos celdas tienen el mismo angulo".
 *
 * Va contra un epsilon y no contra `0` porque el centroide es un promedio de
 * quintos: `2/5 + 2/5 + 1/5` no siempre da exactamente `1`, y una celda que
 * geometricamente ESTA en el centro puede quedar a 1e-16 de el.
 */
export const DEGREE_EPSILON = 1e-9;

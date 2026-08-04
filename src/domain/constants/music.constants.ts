import type { PieceKey } from '../types/pieces.types.ts';

/** Las 12 clases de altura, en orden. El indice ES la clase de altura. */
export const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const;

export const PENT_MAJOR: number[] = [0,2,4,7,9];
export const PENT_MINOR: number[] = [0,3,5,7,10];
export const PENT_BLUES5: number[] = [0,3,5,6,7];

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

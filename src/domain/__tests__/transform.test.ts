import { describe, it, expect } from 'vitest';
import { rotate90, normalize, rotateN, reflect } from '../transform.ts';
import { SHAPES } from '../constants/pieces.constants.ts';
import type { Cell } from '../types/transform.types.ts';
import type { PieceKey } from '../types/pieces.types.ts';

const PIECES = Object.keys(SHAPES) as PieceKey[];

/** Comparacion de celdas que no distingue `-0` de `0`. Ver el test de AC7. */
const sameCell = (a: Cell, b: Cell) => a[0] + 0 === b[0] + 0 && a[1] + 0 === b[1] + 0;
const sameCells = (a: Cell[], b: Cell[]) => a.length === b.length && a.every((c, i) => sameCell(c, b[i]));

describe('rotate90', () => {
  it('mapea [x,y] a [y,-x] preservando el orden del array', () => {
    const cells: Cell[] = [[0,0],[1,0],[2,3]];
    expect(sameCells(rotate90(cells), [[0,0],[0,-1],[3,-2]])).toBe(true);
  });

  it('cuatro rotaciones normalizadas vuelven a la forma original', () => {
    for (const p of PIECES) {
      expect(sameCells(rotateN(SHAPES[p], 4), normalize(SHAPES[p]))).toBe(true);
    }
  });
});

describe('normalize', () => {
  it('lleva la esquina superior izquierda a (0,0)', () => {
    expect(sameCells(normalize([[3,5],[4,5],[3,7]]), [[0,0],[1,0],[0,2]])).toBe(true);
  });

  it('es idempotente', () => {
    for (const p of PIECES) {
      const once = normalize(SHAPES[p]);
      expect(sameCells(normalize(once), once)).toBe(true);
    }
  });
});

describe('rotateN', () => {
  it('preserva la cantidad de celdas en las cuatro rotaciones', () => {
    for (const p of PIECES) {
      for (let r = 0; r < 4; r++) expect(rotateN(SHAPES[p], r)).toHaveLength(5);
    }
  });

  it('rotar dos veces intercambia ancho por alto dos veces: vuelve al bounding box original', () => {
    const box = (cells: Cell[]) => [
      Math.max(...cells.map(c => c[0])),
      Math.max(...cells.map(c => c[1])),
    ];
    for (const p of PIECES) {
      expect(box(rotateN(SHAPES[p], 2))).toEqual(box(normalize(SHAPES[p])));
    }
  });

  it('rotar 90° intercambia ancho por alto', () => {
    for (const p of PIECES) {
      const base = normalize(SHAPES[p]);
      const girada = rotateN(SHAPES[p], 1);
      expect(Math.max(...girada.map(c => c[0]))).toBe(Math.max(...base.map(c => c[1])));
      expect(Math.max(...girada.map(c => c[1]))).toBe(Math.max(...base.map(c => c[0])));
    }
  });
});

describe('reflect', () => {
  it('espeja en x y renormaliza', () => {
    expect(sameCells(reflect([[0,0],[1,0],[2,1]]), [[2,0],[1,0],[0,1]])).toBe(true);
  });

  it('es involutiva sobre una forma normalizada', () => {
    for (const p of PIECES) {
      const base = normalize(SHAPES[p]);
      expect(sameCells(reflect(reflect(base)), base)).toBe(true);
    }
  });
});

/**
 * El cero con signo (AC7).
 *
 * Medido, no supuesto: de las cuatro funciones **solo `rotate90` cruda produce
 * `-0`** —la niega al mapear `[x,y] -> [y,-x]`—, y las 12 piezas lo disparan
 * porque todas tienen alguna celda con `x = 0`. `normalize` lo limpia (`-0 - -0`
 * da `+0`), asi que `rotateN` y `reflect`, que normalizan al final, nunca lo
 * dejan salir.
 *
 * Importa igual porque `toEqual` y `deepStrictEqual` SI distinguen `-0` de `0`:
 * cualquier test que compare la salida cruda de `rotate90` contra literales tiene
 * que pasar por `sameCell`.
 */
describe('AC7 — el cero con signo', () => {
  it('rotate90 cruda produce -0, y toEqual lo distingue de 0', () => {
    const [c] = rotate90([[0, 0]]);
    expect(Object.is(c[1], -0)).toBe(true);
    expect(c[1] === 0).toBe(true);            // el === no lo ve
    expect(() => expect([c]).toEqual([[0, 0]])).toThrow();   // toEqual si
    expect(sameCell(c, [0, 0])).toBe(true);   // sameCell lo normaliza
  });

  it('las 12 piezas disparan el caso al rotar sin normalizar', () => {
    for (const p of PIECES) {
      expect(rotate90(SHAPES[p]).some(([x, y]) => Object.is(x, -0) || Object.is(y, -0))).toBe(true);
    }
  });

  it('normalize lo limpia, asi que rotateN y reflect nunca lo dejan salir', () => {
    const negZero = (cells: Cell[]) => cells.some(([x, y]) => Object.is(x, -0) || Object.is(y, -0));
    for (const p of PIECES) {
      for (let r = 0; r < 4; r++) expect(negZero(rotateN(SHAPES[p], r))).toBe(false);
      expect(negZero(reflect(SHAPES[p]))).toBe(false);
    }
  });
});

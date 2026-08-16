import { describe, it, expect } from 'vitest';
import { rotate90, normalize, rotateN, reflect, centroid, angleFromCentroid } from '../transform.ts';
import { SHAPES } from '../constants/pieces.constants.ts';
// El mismo numero que usa `degreeByCellIndex` para decidir "esta celda cae sobre el
// centroide", y no una copia local: es la misma pregunta, y dos epsilon que tienen
// que coincidir sin que nada los sincronice es el patron que el spec 005 denuncio.
import { DEGREE_EPSILON } from '../constants/music.constants.ts';
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

const distancia = (a: readonly [number, number], b: readonly [number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('centroid', () => {
  /**
   * El centroide de las 12 piezas canonicas, congelado.
   *
   * Son todos promedios de quintos, asi que la comparacion va con epsilon y no con
   * `===`: por eso `toBeCloseTo`.
   */
  const CENTROIDES: Record<PieceKey, [number, number]> = {
    F: [1, 1.2],
    I: [2, 0],
    L: [0.2, 1.2],
    N: [1.4, 0.6],
    P: [0.8, 0.4],
    T: [1, 0.6],
    U: [1, 0.4],
    V: [0.6, 0.6],
    W: [1.2, 0.8],
    X: [1, 1],
    Y: [1.6, 0.2],
    Z: [1.4, 0.4],
  };

  it('es el promedio de las coordenadas de las 12 piezas', () => {
    for (const p of PIECES) {
      const [cx, cy] = centroid(SHAPES[p]);
      expect(cx).toBeCloseTo(CENTROIDES[p][0], 12);
      expect(cy).toBeCloseTo(CENTROIDES[p][1], 12);
    }
  });

  it('es el centro de MASA y no el de la bounding box: en L caen en lugares distintos', () => {
    // La `L` es el contraejemplo barato: cuatro celdas en la columna 0 y una sola en
    // la 1, asi que el promedio se corre hacia la columna llena mientras que el
    // centro de la caja se queda en el medio geometrico.
    const cent = centroid(SHAPES.L);
    const caja: [number, number] = [
      (Math.min(...SHAPES.L.map(c => c[0])) + Math.max(...SHAPES.L.map(c => c[0]))) / 2,
      (Math.min(...SHAPES.L.map(c => c[1])) + Math.max(...SHAPES.L.map(c => c[1]))) / 2,
    ];
    expect(cent).not.toEqual(caja);
    expect(distancia(cent, caja)).toBeGreaterThan(0.4);
  });

  it('solo I y X tienen una celda parada sobre el centroide, y es la del indice 2', () => {
    // Medido, no supuesto: es la regla que saca esa celda del anillo angular y le da
    // el primer grado del arpegio. Las otras 10 piezas no tienen ninguna.
    const sobreElCentro = (p: PieceKey) => {
      const cent = centroid(SHAPES[p]);
      return SHAPES[p].flatMap((c, k) => (distancia(c, cent) < DEGREE_EPSILON ? [k] : []));
    };
    for (const p of PIECES) {
      expect(sobreElCentro(p)).toEqual(p === 'I' || p === 'X' ? [2] : []);
    }
  });
});

describe('angleFromCentroid', () => {
  it('la celda al SUR del centroide da π/2, no -π/2: el eje Y crece hacia abajo', () => {
    // Coordenadas de grilla, no cartesianas. Es exactamente la clase de detalle que
    // alguien "arregla" por error, y por eso tiene un test propio.
    expect(angleFromCentroid([1, 2], [1, 1])).toBeCloseTo(Math.PI / 2, 12);
  });

  it('recorre el circulo en sentido horario en pantalla: este 0, sur π/2, oeste π, norte 3π/2', () => {
    const cent: [number, number] = [1, 1];
    expect(angleFromCentroid([2, 1], cent)).toBeCloseTo(0, 12);
    expect(angleFromCentroid([1, 2], cent)).toBeCloseTo(Math.PI / 2, 12);
    expect(angleFromCentroid([0, 1], cent)).toBeCloseTo(Math.PI, 12);
    expect(angleFromCentroid([1, 0], cent)).toBeCloseTo(3 * Math.PI / 2, 12);
  });

  it('no depende de la distancia: dos celdas en la misma direccion dan el mismo angulo', () => {
    // De aca salen los empates que despues desempata `degreeByCellIndex`.
    expect(angleFromCentroid([1, 2], [1, 1])).toBe(angleFromCentroid([1, 9], [1, 1]));
  });

  it('normaliza a [0, 2π): ningun angulo de las 12 piezas sale negativo', () => {
    // `atan2` devuelve `(-π, π]`, que corta el anillo justo al oeste: sin normalizar,
    // ordenar por angulo pondria las celdas del noroeste antes que las del norte.
    for (const p of PIECES) {
      const cent = centroid(SHAPES[p]);
      for (const celda of SHAPES[p]) {
        const a = angleFromCentroid(celda, cent);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThan(2 * Math.PI);
      }
    }
  });
});

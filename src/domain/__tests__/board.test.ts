import { describe, it, expect } from 'vitest';
import { cellsAt, isValid, occupantAt, phaseFor } from '../board.ts';
import { rotateN, reflect } from '../transform.ts';
import { SHAPES, ANCHOR_INDEX } from '../constants/pieces.constants.ts';
import { GRID_W, GRID_H } from '../constants/board.constants.ts';
import type { Cell } from '../types/transform.types.ts';
import type { PieceKey } from '../types/pieces.types.ts';
import type { PlacedPiece } from '../types/board.types.ts';

const PIECES = Object.keys(SHAPES) as PieceKey[];

/** Una pieza colocada con las celdas dadas. El resto de los campos no lo mira el tablero. */
const piezaEn = (id: string, cells: Cell[]): PlacedPiece =>
  ({ id, piece: 'I', rotation: 0, mirror: false, cells, notes: [] });

describe('cellsAt', () => {
  it('AC8 — la celda de agarre cae exactamente donde se clickeo', () => {
    // Es la propiedad que hace que colocar se sienta preciso, y la que sostiene la
    // fase por pieza del spec 004: si el ancla se corriera, la columna leida
    // despues seria otra.
    for (const p of PIECES) {
      for (let rot = 0; rot < 4; rot++) {
        for (const mirror of [false, true]) {
          const base = rotateN(SHAPES[p], rot);
          const shape = mirror ? reflect(base) : base;
          const idx = ANCHOR_INDEX[p];
          for (const [x, y] of [[0, 0], [3, 2], [9, 5]] as Cell[]) {
            expect(cellsAt(shape, idx, x, y)[idx]).toEqual([x, y]);
          }
        }
      }
    }
  });

  it('traslada la forma entera sin deformarla', () => {
    const shape: Cell[] = [[0,0],[1,0],[2,0],[3,0],[4,0]];
    expect(cellsAt(shape, 2, 5, 3)).toEqual([[3,3],[4,3],[5,3],[6,3],[7,3]]);
  });

  it('preserva el orden del array: la celda k sigue siendo la celda k', () => {
    const shape: Cell[] = [[2,2],[0,0],[1,1]];
    const got = cellsAt(shape, 0, 7, 7);
    // El ancla es la celda 0, que estaba en (2,2): el corrimiento es (+5,+5).
    expect(got).toEqual([[7,7],[5,5],[6,6]]);
  });

  it('no muta la forma que recibe', () => {
    const shape: Cell[] = [[0,0],[1,0]];
    const copia = shape.map(([x, y]): Cell => [x, y]);
    cellsAt(shape, 0, 4, 4);
    expect(shape).toEqual(copia);
  });
});

describe('isValid', () => {
  it('acepta una pieza que entra en un tablero vacio', () => {
    expect(isValid([[0,0],[1,0],[2,0]], [])).toBe(true);
  });

  it('AC8 — rechaza por cada uno de los cuatro bordes', () => {
    expect(isValid([[-1,0]], [])).toBe(false);                 // izquierda
    expect(isValid([[0,-1]], [])).toBe(false);                 // arriba
    expect(isValid([[GRID_W,0]], [])).toBe(false);             // derecha
    expect(isValid([[0,GRID_H]], [])).toBe(false);             // abajo
  });

  it('AC8 — las esquinas del tablero son validas y sus vecinas de afuera no', () => {
    expect(isValid([[0,0],[GRID_W-1,GRID_H-1]], [])).toBe(true);
    expect(isValid([[GRID_W-1,GRID_H]], [])).toBe(false);
  });

  it('AC8 — rechaza el choque contra una pieza ya colocada', () => {
    const placed = [piezaEn('1', [[2,2],[3,2],[4,2]])];
    expect(isValid([[4,2]], placed)).toBe(false);              // se pisan en una celda
    expect(isValid([[2,2],[3,2],[4,2]], placed)).toBe(false);  // se pisan enteras
    expect(isValid([[2,3],[3,3],[4,3]], placed)).toBe(true);   // justo debajo, libre
  });

  it('mira TODAS las piezas colocadas, no solo la primera', () => {
    const placed = [piezaEn('1', [[0,0]]), piezaEn('2', [[5,5]])];
    expect(isValid([[5,5]], placed)).toBe(false);
  });

  it('una jugada fuera del tablero es invalida aunque no choque con nada', () => {
    expect(isValid([[8,0],[9,0],[10,0]], [])).toBe(false);
  });

  it('las 12 piezas entran en el tablero en su rotacion 0', () => {
    for (const p of PIECES) {
      const shape = rotateN(SHAPES[p], 0);
      expect(isValid(cellsAt(shape, ANCHOR_INDEX[p], 4, 2), [])).toBe(true);
    }
  });
});

describe('phaseFor', () => {
  it('AC8 del spec 004 — la columna del ancla es la posicion dentro del compas', () => {
    // La primera columna es el downbeat y la ultima, la ultima subdivision: la
    // fase nunca llega a 1, porque 1 seria el downbeat del compas siguiente.
    expect(phaseFor([[0, 3]], 0)).toBe(0);
    expect(phaseFor([[5, 0]], 0)).toBe(0.5);
    expect(phaseFor([[GRID_W - 1, 0]], 0)).toBe(0.9);
  });

  it('lee la celda de agarre por indice, no la primera del array', () => {
    const cells: Cell[] = [[7, 0], [2, 0], [4, 0]];
    expect(phaseFor(cells, 1)).toBe(0.2);
  });

  it('la fila no cambia la fase: el eje que es tiempo es el X', () => {
    for (let y = 0; y < GRID_H; y++) expect(phaseFor([[3, y]], 0)).toBe(0.3);
  });

  it('dos piezas en la misma columna comparten fase, en columnas distintas no', () => {
    const p = rotateN(SHAPES.F, 0);
    const a = cellsAt(p, ANCHOR_INDEX.F, 2, 1);
    const b = cellsAt(p, ANCHOR_INDEX.F, 2, 4);
    const c = cellsAt(p, ANCHOR_INDEX.F, 7, 1);
    expect(phaseFor(a, ANCHOR_INDEX.F)).toBe(phaseFor(b, ANCHOR_INDEX.F));
    expect(phaseFor(a, ANCHOR_INDEX.F)).not.toBe(phaseFor(c, ANCHOR_INDEX.F));
  });
});

describe('occupantAt', () => {
  it('devuelve la pieza que ocupa la celda', () => {
    const a = piezaEn('a', [[1,1],[2,1]]);
    const b = piezaEn('b', [[5,3]]);
    expect(occupantAt([a, b], 2, 1)).toBe(a);
    expect(occupantAt([a, b], 5, 3)).toBe(b);
  });

  it('devuelve null en una celda libre y en un tablero vacio', () => {
    expect(occupantAt([piezaEn('a', [[1,1]])], 0, 0)).toBeNull();
    expect(occupantAt([], 0, 0)).toBeNull();
  });

  it('no confunde (x,y) con (y,x)', () => {
    const a = piezaEn('a', [[1,4]]);
    expect(occupantAt([a], 1, 4)).toBe(a);
    expect(occupantAt([a], 4, 1)).toBeNull();
  });
});

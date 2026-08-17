import { describe, it, expect } from 'vitest';
import { cellsAt, isValid, occupantAt, occupantCellIndex, cellDistance, pathBetween, phaseFor } from '../board.ts';
import { rotateN, reflect } from '../transform.ts';
import { SHAPES, ANCHOR_INDEX } from '../constants/pieces.constants.ts';
import { GRID_W, GRID_H, SEAM } from '../constants/board.constants.ts';
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

describe('occupantCellIndex', () => {
  it('AC14 — sobre una celda ocupada devuelve el indice de esa celda dentro de la pieza', () => {
    const a = piezaEn('a', [[1,1],[2,1],[3,1]]);
    expect(occupantCellIndex(a, 1, 1)).toBe(0);
    expect(occupantCellIndex(a, 2, 1)).toBe(1);
    expect(occupantCellIndex(a, 3, 1)).toBe(2);
  });

  it('AC14 — sobre una celda que la pieza no ocupa devuelve -1', () => {
    const a = piezaEn('a', [[1,1],[2,1]]);
    expect(occupantCellIndex(a, 0, 0)).toBe(-1);      // libre y lejos
    expect(occupantCellIndex(a, 3, 1)).toBe(-1);      // libre y pegada
    expect(occupantCellIndex(a, 1, 2)).toBe(-1);      // no confunde (x,y) con (y,x)
  });

  it('AC14 — con dos piezas adyacentes el indice sale de la pieza consultada', () => {
    // Es el caso que rompe una implementacion que buscara la celda en el tablero
    // entero: (3,1) y (4,1) son de `b` y su indice adentro de `b` no es el que
    // tendrian contando desde `a`.
    const a = piezaEn('a', [[1,1],[2,1]]);
    const b = piezaEn('b', [[3,1],[4,1]]);
    expect(occupantCellIndex(a, 3, 1)).toBe(-1);
    expect(occupantCellIndex(b, 3, 1)).toBe(0);
    expect(occupantCellIndex(b, 4, 1)).toBe(1);
    expect(occupantCellIndex(a, 2, 1)).toBe(1);
    expect(occupantCellIndex(b, 2, 1)).toBe(-1);
  });

  it('AC14 — compuesto con occupantAt: primero que pieza, despues que celda de esa pieza', () => {
    const a = piezaEn('a', [[1,1],[2,1]]);
    const b = piezaEn('b', [[3,1],[4,1]]);
    const ocupante = occupantAt([a, b], 4, 1) ?? a;   // el ?? no se ejerce: si diera null, el indice seria -1 y el test caeria igual
    expect(ocupante).toBe(b);
    expect(occupantCellIndex(ocupante, 4, 1)).toBe(1);
  });

  it('AC14 — el indice sirve contra la forma canonica en las 96 orientaciones', () => {
    // Es de lo que depende la derivacion celda→nota del spec 007: la celda k del
    // tablero tiene que seguir siendo la celda k de SHAPES despues de rotar, reflejar
    // y trasladar. `cellsAt` es un `map`, asi que el indice sobrevive los tres pasos.
    for (const p of PIECES) {
      for (let rot = 0; rot < 4; rot++) {
        for (const mirror of [false, true]) {
          const base = rotateN(SHAPES[p], rot);
          const shape = mirror ? reflect(base) : base;
          const cells = cellsAt(shape, ANCHOR_INDEX[p], 5, 3);
          const pieza = piezaEn(`${p}-${rot}-${mirror}`, cells);
          for (let k = 0; k < cells.length; k++) {
            expect(occupantCellIndex(pieza, cells[k][0], cells[k][1])).toBe(k);
          }
        }
      }
    }
  });
});

/** Las 60 celdas del tablero. Recorrerlas de a pares da las 3.600 combinaciones. */
const TODAS: Cell[] = [];
for (let x = 0; x < GRID_W; x++) for (let y = 0; y < GRID_H; y++) TODAS.push([x, y]);

const [COSTURA_INICIO, COSTURA_FIN] = SEAM;
const misma = (p: Cell, q: Cell): boolean => p[0] === q[0] && p[1] === q[1];
const manhattan = (p: Cell, q: Cell): number => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]);

/** Vecinas en el grafo real: pegadas en la grilla, o las dos puntas de la costura. */
const adyacentes = (p: Cell, q: Cell): boolean =>
  manhattan(p, q) === 1
  || (misma(p, COSTURA_INICIO) && misma(q, COSTURA_FIN))
  || (misma(p, COSTURA_FIN) && misma(q, COSTURA_INICIO));

describe('cellDistance', () => {
  it('AC2 — las dos esquinas de la costura estan a un paso', () => {
    // Es la definicion del repliegue: (0,0) y (9,5) son las mas lejanas de la
    // grilla y la costura las vuelve vecinas.
    expect(cellDistance([0, 0], [GRID_W - 1, GRID_H - 1])).toBe(1);
    expect(cellDistance([GRID_W - 1, GRID_H - 1], [0, 0])).toBe(1);
  });

  it('AC2 — la distancia maxima del tablero es 12, no 14', () => {
    // 14 es el diametro Manhattan de una grilla 10x6 sin costura. Con la arista
    // extra ningun par supera 12: el que era el par mas lejano ahora mide 1.
    let maxima = 0;
    for (const a of TODAS) for (const b of TODAS) maxima = Math.max(maxima, cellDistance(a, b));
    expect(maxima).toBe(12);
  });

  it('sin costura de por medio coincide con la distancia Manhattan', () => {
    // La costura no reescribe todo el tablero: es UNA arista, y en el centro no
    // cambia nada.
    expect(cellDistance([4, 2], [4, 2])).toBe(0);
    expect(cellDistance([4, 2], [5, 2])).toBe(1);
    expect(cellDistance([4, 2], [6, 4])).toBe(4);
  });

  it('es simetrica en las 3.600 combinaciones', () => {
    const fallas: string[] = [];
    for (const a of TODAS) for (const b of TODAS) {
      if (cellDistance(a, b) !== cellDistance(b, a)) fallas.push(`${a} / ${b}`);
    }
    expect(fallas).toEqual([]);
  });

  it('cumple la desigualdad triangular en las 3.600 combinaciones', () => {
    // Es lo que distingue una distancia de grafo de una formula que se parece a
    // una: si un atajo por la costura estuviera mal contado, existiria un rodeo
    // mas barato que el camino directo. Cada par se mide contra las 60 celdas
    // como escala intermedia.
    const fallas: string[] = [];
    for (const a of TODAS) for (const b of TODAS) {
      const directa = cellDistance(a, b);
      for (const c of TODAS) {
        if (directa > cellDistance(a, c) + cellDistance(c, b)) fallas.push(`${a} -> ${c} -> ${b}`);
      }
    }
    expect(fallas).toEqual([]);
  });
});

describe('pathBetween', () => {
  it('AC7b — el camino tiene exactamente una celda menos que la distancia', () => {
    // Se recorren las 3.600 combinaciones y se asevera sobre 3.540: los 60 pares
    // de una celda consigo misma quedan afuera porque con distancia 0 no existe un
    // camino de largo -1, y ese caso no ocurre en el circuito.
    let recorridos = 0;
    let aseverados = 0;
    for (const a of TODAS) for (const b of TODAS) {
      recorridos++;
      if (misma(a, b)) continue;
      aseverados++;
      expect(pathBetween(a, b).length, `${a} -> ${b}`).toBe(cellDistance(a, b) - 1);
    }
    expect(recorridos).toBe(3600);
    expect(aseverados).toBe(3540);
  });

  it('AC7b — es un camino de verdad: celdas adyacentes de a pares y ninguna repetida', () => {
    // El largo solo no alcanza: un array del tamano correcto con celdas salteadas
    // lo cumpliria igual. Se mide sobre el recorrido COMPLETO —con a y b en las
    // puntas— porque la costura puede caer entre dos celdas intermedias.
    const fallas: string[] = [];
    for (const a of TODAS) for (const b of TODAS) {
      if (misma(a, b)) continue;
      const completo = [a, ...pathBetween(a, b), b];
      for (let i = 1; i < completo.length; i++) {
        if (!adyacentes(completo[i - 1], completo[i])) fallas.push(`salto ${a} -> ${b} en ${i}`);
      }
      const vistas = new Set(completo.map(([x, y]) => `${x},${y}`));
      if (vistas.size !== completo.length) fallas.push(`repetida ${a} -> ${b}`);
    }
    expect(fallas).toEqual([]);
  });

  it('no incluye ni el origen ni el destino', () => {
    const camino = pathBetween([0, 0], [3, 0]);
    expect(camino).toEqual([[1, 0], [2, 0]]);
  });

  it('traza primero en X y despues en Y', () => {
    // Ninguna eleccion es mas correcta —entre (0,0) y (3,2) hay 10 caminos
    // minimos—, asi que se fija la que se explica en una linea.
    expect(pathBetween([0, 0], [3, 2])).toEqual([[1, 0], [2, 0], [3, 0], [3, 1]]);
  });

  it('AC7b — el borde de la costura: el origen ya ES la esquina', () => {
    // Es donde fallaba la version que excluia los extremos tramo por tramo: el
    // primer tramo se queda sin celdas propias y la esquina de llegada, que en el
    // camino completo es intermedia, se perdia.
    expect(cellDistance([0, 0], [GRID_W - 1, GRID_H - 2])).toBe(2);
    expect(pathBetween([0, 0], [GRID_W - 1, GRID_H - 2])).toEqual([[GRID_W - 1, GRID_H - 1]]);
  });

  it('AC7b — el borde de la costura: el destino ya ES la esquina', () => {
    expect(cellDistance([GRID_W - 1, GRID_H - 2], [0, 0])).toBe(2);
    expect(pathBetween([GRID_W - 1, GRID_H - 2], [0, 0])).toEqual([[GRID_W - 1, GRID_H - 1]]);
  });

  it('AC7b — el borde de la costura: origen y destino son las dos esquinas', () => {
    expect(pathBetween([0, 0], [GRID_W - 1, GRID_H - 1])).toEqual([]);
    expect(pathBetween([GRID_W - 1, GRID_H - 1], [0, 0])).toEqual([]);
  });

  it('cruza la costura solo cuando acorta', () => {
    // (8,5) -> (1,0): 12 derecho contra 1+1+1=3 por la costura, asi que la usa y
    // el camino pasa por sus dos puntas.
    expect(cellDistance([8, 5], [1, 0])).toBe(3);
    expect(pathBetween([8, 5], [1, 0])).toEqual([[GRID_W - 1, GRID_H - 1], [0, 0]]);
    // (9,0) -> (0,4): 13 derecho contra 5+1+4=10 por la costura. Tambien acorta.
    expect(cellDistance([GRID_W - 1, 0], [0, 4])).toBe(10);
    // En el centro no acorta nada y la costura queda afuera del camino.
    expect(cellDistance([4, 2], [6, 3])).toBe(3);
    expect(pathBetween([4, 2], [6, 3]).some((c) => misma(c, COSTURA_FIN) || misma(c, COSTURA_INICIO))).toBe(false);
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

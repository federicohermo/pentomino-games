import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { renderAscii, sizeOf } from '../render.ts';
import { rotateN, reflect } from '../../../src/domain/transform.ts';
import { SHAPES, ANCHOR_INDEX, CELLS_PER_PIECE } from '../../../src/domain/constants/pieces.constants.ts';
import { PIECE_KEYS } from '../pieces.ts';
import type { Cell } from '../../../src/domain/types/transform.types.ts';

describe('renderAscii', () => {
  test('marca la celda de agarre y deja los huecos del bounding box', () => {
    // La Z rotada 270° y reflejada: es el caso del AC4.
    const cells = reflect(rotateN(SHAPES.Z, 3));
    assert.equal(renderAscii(cells, ANCHOR_INDEX.Z), '.#\n#@\n#.\n#.');
  });

  test('la fila 0 es la de arriba: `y` crece hacia abajo', () => {
    // Si el render invirtiera el eje, esta forma saldria al reves y el dibujo no
    // coincidiria con lo que se ve en pantalla.
    assert.equal(renderAscii([[0, 0], [0, 1], [1, 1]], 0), '@.\n##');
  });

  test('el ancla es el INDICE, no la coordenada', () => {
    const cells: Cell[] = [[0, 0], [1, 0], [2, 0]];
    assert.equal(renderAscii(cells, 0), '@##');
    assert.equal(renderAscii(cells, 2), '##@');
  });

  test('traslada por el minimo: sirve con celdas en coordenadas de tablero', () => {
    assert.equal(renderAscii([[5, 3], [6, 3]], 1), '#@');
  });

  test('un anchorIndex fuera de rango dibuja la forma sin ancla', () => {
    assert.equal(renderAscii([[0, 0], [1, 0]], -1), '##');
  });

  test('sin celdas devuelve el string vacio', () => {
    assert.equal(renderAscii([], 0), '');
    assert.deepEqual(sizeOf([]), { width: 0, height: 0 });
  });

  test('las 96 combinaciones dibujan 5 celdas y exactamente un ancla', () => {
    for (const p of PIECE_KEYS) {
      for (let rot = 0; rot < 4; rot++) {
        for (const mirror of [false, true]) {
          const base = rotateN(SHAPES[p], rot);
          const cells = mirror ? reflect(base) : base;
          const ascii = renderAscii(cells, ANCHOR_INDEX[p]);
          const marcadas = [...ascii].filter(c => c === '#' || c === '@').length;
          const anclas = [...ascii].filter(c => c === '@').length;

          assert.equal(marcadas, CELLS_PER_PIECE, `${p} rot${rot}${mirror ? ' mirror' : ''}`);
          assert.equal(anclas, 1, `${p} rot${rot}${mirror ? ' mirror' : ''}`);
          // El bounding box del dibujo tiene que ser el de la forma.
          const { width, height } = sizeOf(cells);
          const filas = ascii.split('\n');
          assert.equal(filas.length, height);
          assert.ok(filas.every(f => f.length === width));
        }
      }
    }
  });
});

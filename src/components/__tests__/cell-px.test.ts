import { describe, it, expect } from 'vitest';
import { cellPxPara } from '../cell-px.ts';
import { CELL_PX_MIN, NOTA_RAZON, PASO_RAZON } from '../constants/layout.constants.ts';

/**
 * La única parte del spec 021 que se puede verificar sin navegador: la fórmula.
 *
 * El resto —que `--cell` se escriba con unidad, que un `resize` la reescriba, que la
 * baldosa herede— es cableado y vive en `use-cell-px.browser.test.tsx`.
 */

/** La tabla del research, medida sobre viewports reales. */
const VIEWPORTS: [vw: number, vh: number, esperado: number][] = [
  [1920, 1080, 180.0],
  [1512, 982, 151.2],
  [1440, 900, 144.0],
  [1366, 768, 128.0],
  [1280, 720, 120.0],
  [834, 1112, 83.4],
  // Las dos donde gana el PISO. Su valor esperado sale del símbolo y no de un `73`
  // escrito a mano: si el piso se moviera, estas dos filas lo tienen que seguir.
  [430, 932, CELL_PX_MIN],
  [375, 667, CELL_PX_MIN],
];

describe('021 AC2 — el tamaño de celda sale del viewport', () => {
  it('la tabla de viewports entera', () => {
    for (const [vw, vh, esperado] of VIEWPORTS) {
      expect(cellPxPara(vw, vh), `${vw}x${vh}`).toBeCloseTo(esperado, 1);
    }
  });

  it('manda el eje más apretado, y cambia de eje dentro de la tabla', () => {
    // No es un detalle: en 1920×1080 manda el ALTO (180 contra 192) y en 1512×982 manda
    // el ANCHO (151,2 contra 163,7). Un `max` en vez de un `min` pasaría la primera fila
    // de la tabla y desbordaría en la segunda.
    expect(cellPxPara(1920, 1080)).toBe(1080 / 6);
    expect(cellPxPara(1512, 982)).toBe(1512 / 10);
  });

  it('el piso no deja que la celda baje de `CELL_PX_MIN`', () => {
    // La promesa del spec: el tablero nunca es más chico que antes del 021, sólo más
    // grande. Abajo de 730 px de viewport lo que sobra lo absorbe el scroll horizontal.
    expect(cellPxPara(1, 1)).toBe(CELL_PX_MIN);
    expect(cellPxPara(729, 4000)).toBe(CELL_PX_MIN);
    // Y justo en el borde: 730 de ancho es exactamente 10 celdas de 73.
    expect(cellPxPara(730, 4000)).toBe(CELL_PX_MIN);
    expect(cellPxPara(731, 4000)).toBeGreaterThan(CELL_PX_MIN);
  });

  it('no redondea: la fracción la resuelve el navegador una sola vez', () => {
    expect(cellPxPara(1512, 982)).toBe(151.2);
  });
});

describe('021 AC4 — al piso, el tablero se ve igual que antes del spec', () => {
  it('las dos razones tipográficas devuelven los px exactos de siempre', () => {
    // Es lo que hace que este spec no tenga que re-medir el aire alrededor del texto: a
    // `CELL_PX_MIN` la nota vale 19 px y el `#N` 13, que son los dos números que el repo
    // midió con un `Range` y que `Board.tsx` tenía escritos como clases de Tailwind.
    expect(CELL_PX_MIN * NOTA_RAZON).toBeCloseTo(19, 10);
    expect(CELL_PX_MIN * PASO_RAZON).toBeCloseTo(13, 10);
  });
});

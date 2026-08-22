import { describe, it, expect } from 'vitest';
import { cellPxPara } from '../cell-px.ts';
import { CELL_PX_MIN, CELL_PX_MAX, NOTA_RAZON, PASO_RAZON } from '../constants/layout.constants.ts';

/**
 * La única parte de la fórmula que se puede verificar sin navegador.
 *
 * El resto —que `--cell` se escriba con unidad, que un `resize` la reescriba, que la
 * baldosa herede— es cableado y vive en `use-cell-px.browser.test.tsx`.
 *
 * **Lo que este archivo mide cambió de signo con el techo.** El spec 021 lo escribió para
 * verificar que la celda CRECIERA con el viewport; hoy `CELL_PX_MAX` vale lo mismo que
 * `CELL_PX_MIN`, así que lo que hay que verificar es lo contrario: que en ningún viewport
 * la celda se salga de los 73 px que tenía antes de aquel spec. Las dos cotas se toman de
 * los símbolos y no de un `73` escrito a mano — si el techo se afloja, estas expectativas
 * lo siguen solas y las que dejan de valer son las de la tabla, que están anotadas ahí.
 */

/**
 * La tabla del research del 021, con lo que cada viewport daría SIN techo al lado.
 *
 * Se queda entera y no se recorta a un caso: es la que muestra que el techo no es una
 * preferencia sino la diferencia entre una baldosa de 73 px y una de 180.
 */
const VIEWPORTS: [vw: number, vh: number, sinTecho: number][] = [
  [1920, 1080, 180.0],
  [1512, 982, 151.2],
  [1440, 900, 144.0],
  [1366, 768, 128.0],
  [1280, 720, 120.0],
  [834, 1112, 83.4],
  // Las dos donde ya ganaba el PISO, o sea las dos que el techo no toca.
  [430, 932, CELL_PX_MIN],
  [375, 667, CELL_PX_MIN],
];

describe('el techo devuelve la celda al tamaño de antes del spec 021', () => {
  it('la tabla de viewports entera da el mismo número', () => {
    for (const [vw, vh] of VIEWPORTS) {
      expect(cellPxPara(vw, vh), `${vw}x${vh}`).toBe(CELL_PX_MAX);
    }
  });

  it('el techo es lo que corta, y se ve en cuánto cortó', () => {
    // No es redundante con la tabla: esto es lo que fija que el corte lo haga el TECHO y
    // no el piso. Si alguien afloja `CELL_PX_MAX`, esta expectativa falla y la tabla de
    // arriba también — que es exactamente el aviso que hace falta, porque aflojarlo
    // devuelve las baldosas grandes.
    expect(CELL_PX_MAX).toBe(CELL_PX_MIN);
    for (const [vw, vh, sinTecho] of VIEWPORTS) {
      expect(cellPxPara(vw, vh), `${vw}x${vh}`).toBeLessThanOrEqual(sinTecho);
    }
  });

  it('el piso sigue mandando por debajo', () => {
    // La promesa que el 021 dejó escrita y que el techo no toca: el tablero nunca es más
    // chico que antes de aquel spec. Abajo de 730 px de viewport lo que sobra lo absorbe
    // el scroll horizontal.
    expect(cellPxPara(1, 1)).toBe(CELL_PX_MIN);
    expect(cellPxPara(729, 4000)).toBe(CELL_PX_MIN);
    // Y justo en el borde: 730 de ancho es exactamente 10 celdas de 73.
    expect(cellPxPara(730, 4000)).toBe(CELL_PX_MIN);
  });
});

describe('la baldosa se ve igual que antes del spec 021', () => {
  it('las dos razones tipográficas devuelven los px exactos de siempre', () => {
    // Es lo que hace que no haya que re-medir el aire alrededor del texto: a `CELL_PX_MIN`
    // la nota vale 19 px y el `#N` 13, que son los dos números que el repo midió con un
    // `Range` y que `Board.tsx` tenía escritos como clases de Tailwind. Con el techo puesto
    // esos son los dos únicos tamaños que la baldosa puede tener, y no el piso de un rango.
    expect(CELL_PX_MIN * NOTA_RAZON).toBeCloseTo(19, 10);
    expect(CELL_PX_MIN * PASO_RAZON).toBeCloseTo(13, 10);
  });
});

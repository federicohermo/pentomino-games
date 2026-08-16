import { describe, it, expect } from 'vitest';
import { PIECE_COLOR, CONTRAST_AA } from '../constants/palette.constants.ts';
import { BASE_MAP } from '../../domain/constants/music.constants.ts';
import type { PieceKey } from '../../domain/types/pieces.types.ts';

/**
 * AC7 del spec 007: el texto de cada celda pasa WCAG AA sobre el color de su pieza.
 *
 * Es el primer test de `components/` y es PURO: constantes y aritmetica, sin DOM y
 * sin React. Corre en el `environment: 'node'` que ya usa el resto del repo.
 *
 * La formula de luminancia esta reimplementada aca a proposito. Si `palette.constants.ts`
 * exportara un `contrast()` y el test lo llamara, el test verificaria que la tabla
 * es consistente consigo misma; recalculando desde `bg` verifica lo unico que
 * importa: que `fg` siga siendo el mejor de negro/blanco DESPUES de que alguien
 * retoque un `bg` y se olvide del `fg`.
 */

const PIECES = Object.keys(BASE_MAP) as PieceKey[];

/** Canal sRGB linealizado, WCAG 2.1 §relative luminance. */
function linear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminancia relativa de un `#RRGGBB`. Negro = 0, blanco = 1. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * linear((n >> 16) & 255)
       + 0.7152 * linear((n >> 8) & 255)
       + 0.0722 * linear(n & 255);
}

/** Razon de contraste WCAG entre dos colores: el mas claro va arriba de la fraccion. */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const NEGRO = '#000000';
const BLANCO = '#FFFFFF';

describe('PIECE_COLOR', () => {
  it('tiene una entrada por pieza, con hex de 6 digitos', () => {
    expect(Object.keys(PIECE_COLOR).sort()).toEqual([...PIECES].sort());
    for (const p of PIECES) {
      expect(PIECE_COLOR[p].bg).toMatch(/^#[0-9A-F]{6}$/);
      expect([NEGRO, BLANCO]).toContain(PIECE_COLOR[p].fg);
    }
  });

  it('el fg de cada pieza es el mejor de negro/blanco contra su bg', () => {
    for (const p of PIECES) {
      const { bg, fg } = PIECE_COLOR[p];
      const mejor = contrast(bg, NEGRO) >= contrast(bg, BLANCO) ? NEGRO : BLANCO;
      expect(fg, `${p} (${bg}) deberia usar ${mejor}`).toBe(mejor);
    }
  });

  it('las 12 pasan WCAG AA con el fg elegido', () => {
    for (const p of PIECES) {
      const { bg, fg } = PIECE_COLOR[p];
      expect(contrast(bg, fg), `${p} (${bg})`).toBeGreaterThanOrEqual(CONTRAST_AA);
    }
  });

  it('W es la unica pieza con texto blanco', () => {
    // No es cosmetico: si otro bg se oscurece hasta pedir blanco, el cambio deja de
    // ser "un color distinto" y pasa a mover el equilibrio de la lamina entera.
    const blancas = PIECES.filter(p => PIECE_COLOR[p].fg === BLANCO);
    expect(blancas).toEqual(['W']);
  });

  it('los 12 fondos son distintos entre si', () => {
    // Dos piezas con el mismo fondo dejarian de ser distinguibles en el tablero,
    // que es justo lo unico que el color esta ahi para hacer.
    const bgs = PIECES.map(p => PIECE_COLOR[p].bg);
    expect(new Set(bgs).size).toBe(PIECES.length);
  });
});

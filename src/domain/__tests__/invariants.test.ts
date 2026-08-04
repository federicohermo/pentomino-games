import { describe, it, expect, vi } from 'vitest';
import {
  checkArrayOrder, checkAnchors, checkShapes, checkBaseMap, checkNotes, checkAll,
} from '../invariants.ts';
import { SHAPES } from '../constants/pieces.constants.ts';
import { BASE_MAP, PENT_MAJOR } from '../constants/music.constants.ts';
import type { Cell } from '../types/transform.types.ts';
import type { PieceKey } from '../types/pieces.types.ts';

describe('AC6 — los cinco chequeos sobre las 96 combinaciones', () => {
  it('orden del array', () => {
    const r = checkArrayOrder();
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('ancla', () => {
    const r = checkAnchors();
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('formas', () => {
    const r = checkShapes();
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('BASE_MAP', () => {
    const r = checkBaseMap();
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('notas', () => {
    const r = checkNotes();
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('checkAll devuelve los cinco, todos en verde', () => {
    const all = checkAll();
    expect(all).toHaveLength(5);
    expect(all.map(r => r.name)).toEqual(['orden del array', 'ancla', 'formas', 'BASE_MAP', 'notas']);
    expect(all.every(r => r.ok)).toBe(true);
  });

  it('devuelven resultado en vez de lanzar: es lo que necesita el spec 006', () => {
    // Si asertaran, la tool `check_invariants` no podria responder con el detalle.
    expect(() => checkAll()).not.toThrow();
    for (const r of checkAll()) expect(Array.isArray(r.failures)).toBe(true);
  });
});

/**
 * Un chequeo que nunca vio un rojo no prueba nada.
 *
 * Estos tests mutan las tablas a mano para confirmar que cada chequeo DETECTA su
 * regresion. Se restauran en el `finally` porque `SHAPES` es un modulo compartido
 * entre los archivos de test del proceso.
 */
describe('los chequeos detectan una regresion', () => {
  /** Corre `fn` con `SHAPES[p]` reemplazada, y despues la deja como estaba. */
  function conFormaMutada(p: PieceKey, cells: Cell[], fn: () => void): void {
    const original = SHAPES[p];
    SHAPES[p] = cells;
    try { fn(); } finally { SHAPES[p] = original; }
  }

  it('checkShapes ve una celda repetida', () => {
    conFormaMutada('I', [[0,0],[0,0],[2,0],[3,0],[4,0]], () => {
      const r = checkShapes();
      expect(r.ok).toBe(false);
      expect(r.failures.some(f => f.includes('repetidas'))).toBe(true);
    });
  });

  it('checkShapes ve una forma con menos de 5 celdas', () => {
    conFormaMutada('I', [[0,0],[1,0],[2,0]], () => {
      const r = checkShapes();
      expect(r.ok).toBe(false);
      expect(r.failures.some(f => f.includes('3 celdas'))).toBe(true);
    });
  });

  it('checkShapes ve una forma desconectada', () => {
    conFormaMutada('I', [[0,0],[1,0],[2,0],[3,0],[9,9]], () => {
      const r = checkShapes();
      expect(r.ok).toBe(false);
      expect(r.failures.some(f => f.includes('conexa'))).toBe(true);
    });
  });

  it('checkShapes NO acepta la conexion por diagonal', () => {
    conFormaMutada('I', [[0,0],[1,0],[2,0],[3,0],[4,1]], () => {
      expect(checkShapes().ok).toBe(false);
    });
  });

  /**
   * La regresion mas peligrosa del repo, y la que motiva todo el chequeo 1: si una
   * transformacion reordenara las celdas, el CONJUNTO seguiria siendo el mismo
   * —la pieza se dibujaria identica— pero `ANCHOR_INDEX` dejaria de apuntar a la
   * celda de agarre. No produce ningun error visible.
   *
   * Se simula reemplazando `rotateN` por una version que devuelve las mismas
   * celdas al reves. Mutar la tabla no alcanza: escribir `SHAPES.I` en otro orden
   * no rompe nada, porque las funciones preservan el orden de SU entrada. Lo que
   * el chequeo detecta es que una TRANSFORMACION reordene.
   */
  it('checkArrayOrder da rojo si una transformacion reordena las celdas', async () => {
    vi.resetModules();
    vi.doMock('../transform.ts', async () => {
      const real = await vi.importActual<typeof import('../transform.ts')>('../transform.ts');
      return { ...real, rotateN: (cells: Cell[], n: number) => [...real.rotateN(cells, n)].reverse() };
    });
    try {
      const { checkArrayOrder: conReordenamiento } = await import('../invariants.ts');
      const r = conReordenamiento();
      expect(r.ok).toBe(false);
      expect(r.failures.length).toBeGreaterThan(0);
    } finally {
      vi.doUnmock('../transform.ts');
      vi.resetModules();
    }
  });

  it('checkBaseMap ve dos piezas con la misma tonica', () => {
    const original = BASE_MAP.Z;
    BASE_MAP.Z = BASE_MAP.F;
    try {
      const r = checkBaseMap();
      expect(r.ok).toBe(false);
      expect(r.failures.some(f => f.includes('comparten tonica'))).toBe(true);
    } finally {
      BASE_MAP.Z = original;
    }
  });

  it('checkNotes ve una escala que deja de ser ascendente', () => {
    const original = PENT_MAJOR.slice();
    PENT_MAJOR[3] = 0;   // la cuarta nota deja de superar a la anterior
    try {
      const r = checkNotes();
      expect(r.ok).toBe(false);
      expect(r.failures.some(f => f.includes('no supera'))).toBe(true);
    } finally {
      PENT_MAJOR.splice(0, PENT_MAJOR.length, ...original);
    }
  });

  it('checkAnchors ve un ANCHOR_INDEX fuera de rango', () => {
    conFormaMutada('I', [[0,0],[1,0]], () => {
      // ANCHOR_INDEX.I es 2, y la forma mutada tiene 2 celdas: el indice ya no existe.
      const r = checkAnchors();
      expect(r.ok).toBe(false);
      expect(r.failures.some(f => f.includes('fuera de'))).toBe(true);
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import {
  checkArrayOrder, checkAnchors, checkShapes, checkBaseMap, checkNotes, checkDistinct, checkAll,
} from '../invariants.ts';
import { SHAPES } from '../constants/pieces.constants.ts';
import { BASE_MAP, PENT_MAJOR, REGIMEN } from '../constants/music.constants.ts';
import type { Cell } from '../types/transform.types.ts';
import type { PieceKey } from '../types/pieces.types.ts';

describe('los seis chequeos sobre las 96 combinaciones', () => {
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

  it('piezas distintas', () => {
    const r = checkDistinct();
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('checkAll devuelve los seis, todos en verde', () => {
    const all = checkAll();
    expect(all).toHaveLength(6);
    expect(all.map(r => r.name)).toEqual([
      'orden del array', 'ancla', 'formas', 'BASE_MAP', 'notas', 'piezas distintas',
    ]);
    expect(all.every(r => r.ok)).toBe(true);
  });

  it('devuelven resultado en vez de lanzar: es lo que necesita la tool', () => {
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

  /**
   * El bug que motivo el chequeo, reproducido con la forma que la `Z` tuvo de verdad:
   * `[[0,1],[1,1],[1,0],[2,0],[3,0]]` es la `N` reflejada. Los otros cinco chequeos la
   * dan por buena —son cinco celdas, sin repetir, conexas— porque ninguno compara dos
   * FORMAS: el unico que cruza piezas es `checkBaseMap`, y las cruza por su tonica.
   */
  it('checkDistinct ve la Z que era la N reflejada', () => {
    conFormaMutada('Z', [[0,1],[1,1],[1,0],[2,0],[3,0]], () => {
      expect(checkShapes().ok).toBe(true);   // el chequeo 3 no la ve, y ese es el punto

      const r = checkDistinct();
      expect(r.ok).toBe(false);
      expect(r.failures).toEqual(['Z: es la misma forma que N rotada o reflejada']);
    });
  });

  /**
   * Y una forma distinta escrita con las celdas en otro orden NO es un duplicado: el
   * chequeo compara conjuntos, no arrays. Sin el `sort()` de `canonicalKey` esta `N`
   * —la misma pieza, otro orden— se leeria como una pieza nueva y el duplicado real
   * pasaria.
   */
  it('checkDistinct compara el conjunto y no el orden del array', () => {
    conFormaMutada('N', [[3,1],[2,1],[1,1],[1,0],[0,0]], () => {
      const r = checkDistinct();
      expect(r.ok).toBe(true);
    });
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

  /**
   * El corolario del chequeo 1, roto por la misma via y verificado aparte a proposito.
   *
   * Con el ancla EN RANGO —o sea, pasado el `continue` del caso anterior— lo que queda
   * por afirmar es que la celda de agarre siga siendo la celda de agarre despues de
   * transformar. Es la propiedad de la que depende que el click caiga donde el usuario
   * apunto, y se rompe sin sintoma: la pieza se dibuja identica.
   */
  it('checkAnchors da rojo si una transformacion reordena las celdas', async () => {
    vi.resetModules();
    vi.doMock('../transform.ts', async () => {
      const real = await vi.importActual<typeof import('../transform.ts')>('../transform.ts');
      return { ...real, rotateN: (cells: Cell[], n: number) => [...real.rotateN(cells, n)].reverse() };
    });
    try {
      const { checkAnchors: conReordenamiento } = await import('../invariants.ts');
      const r = conReordenamiento();
      expect(r.ok).toBe(false);
      expect(r.failures.some(f => f.includes('el ancla quedo en'))).toBe(true);
      // Las dos mitades del espacio y no una: el mensaje distingue la orientacion
      // reflejada de la que no, y es lo que hace ubicable la regresion.
      expect(r.failures.some(f => f.includes('mirror'))).toBe(true);
      expect(r.failures.some(f => !f.includes('mirror'))).toBe(true);
    } finally {
      vi.doUnmock('../transform.ts');
      vi.resetModules();
    }
  });

  /**
   * El caso vacio de `isConnected`, que no es teorico: se llega por el camino de una
   * forma que perdio todas sus celdas. Lo que se afirma es que el chequeo REPORTE la
   * forma corta en vez de romperse leyendo `cells[0]` de un array vacio.
   */
  it('checkShapes ve una forma sin celdas y no explota buscando la primera', () => {
    conFormaMutada('I', [], () => {
      const r = checkShapes();
      expect(r.ok).toBe(false);
      expect(r.failures.some(f => f.includes('0 celdas'))).toBe(true);
      // Y NO la reporta como desconectada: un conjunto vacio es conexo por vacuidad, y
      // decir las dos cosas mandaria a buscar un agujero que no existe.
      expect(r.failures.some(f => f.includes('conexa'))).toBe(false);
    });
  });

  it('checkBaseMap ve que sobra una clase de altura', async () => {
    vi.resetModules();
    vi.doMock('../constants/music.constants.ts', async () => {
      const real = await vi.importActual<typeof import('../constants/music.constants.ts')>(
        '../constants/music.constants.ts',
      );
      // Trece clases para doce piezas: la biyeccion se cae del lado que ningun otro
      // chequeo mira, porque cada tonica sigue estando en rango y sin repetirse.
      return { ...real, CHROMATIC: [...real.CHROMATIC, 'X'] };
    });
    try {
      const { checkBaseMap: conCromaticaLarga } = await import('../invariants.ts');
      const r = conCromaticaLarga();
      expect(r.ok).toBe(false);
      expect(r.failures.some(f => f.includes('12 piezas para 13 clases'))).toBe(true);
    } finally {
      vi.doUnmock('../constants/music.constants.ts');
      vi.resetModules();
    }
  });

  /**
   * Las tres formas de estar fuera de rango, y las tres por separado.
   *
   * El guardia es `!Number.isInteger(pc) || pc < 0 || pc >= CHROMATIC.length`: tres
   * condiciones encadenadas, y un solo caso deja las otras dos sin ejercer. Lo que no
   * se ejerce es exactamente donde se escribe un `>` por un `>=`.
   */
  it.each([
    ['por encima del rango', 99],
    ['negativa', -1],
    ['fraccionaria', 1.5],
  ])('checkBaseMap ve una tonica %s', (_caso, valor) => {
    const original = BASE_MAP.Z;
    BASE_MAP.Z = valor;
    try {
      const r = checkBaseMap();
      expect(r.ok).toBe(false);
      expect(r.failures.some(f => f.includes(`Z: tonica ${valor} fuera de`))).toBe(true);
    } finally {
      BASE_MAP.Z = original;
    }
  });

  /**
   * El chequeo que el docblock de `checkNotes` explica: sin el,
   * una formula de cuatro notas con `NOTES_PER_PIECE = 4` pasaba los cinco invariantes
   * que habia entonces —hoy son seis— y todos los tests, y la celda de grado 4
   * renderizaba `undefinedNaN`.
   *
   * Se rompe por el lado barato —la constante, no la formula— y con eso caen los dos
   * mensajes: el del par que dejo de coincidir, y el del arpegio que ahora tiene una nota
   * de mas para lo que la constante declara.
   */
  it('checkNotes ve que NOTES_PER_PIECE dejo de coincidir con CELLS_PER_PIECE', async () => {
    vi.resetModules();
    vi.doMock('../constants/music.constants.ts', async () => {
      const real = await vi.importActual<typeof import('../constants/music.constants.ts')>(
        '../constants/music.constants.ts',
      );
      return { ...real, NOTES_PER_PIECE: 4 };
    });
    try {
      const { checkNotes: conCuatroNotas } = await import('../invariants.ts');
      const r = conCuatroNotas();
      expect(r.ok).toBe(false);
      expect(r.failures.some(f => f.includes('tienen que ser iguales'))).toBe(true);
      expect(r.failures.some(f => f.includes('5 notas y deberian ser 4'))).toBe(true);
    } finally {
      vi.doUnmock('../constants/music.constants.ts');
      vi.resetModules();
    }
  });

  /**
   * El ancla de D2, verificada con la mutacion exacta que su comentario nombra.
   *
   * `checkNotes` compara el arpegio de `orden` contra el de rotacion 0 del MISMO
   * regimen, asi que un corrimiento uniforme —`(j + rot + 1)` en vez de `(j + rot)`—
   * mueve la referencia junto con el resto y la permutacion ciclica sigue cerrando. Lo
   * unico que lo atrapa es exigir que la rotacion 0 de `orden` sea la de `escala`.
   */
  it('checkNotes ve un corrimiento uniforme, que la permutacion ciclica no ve', async () => {
    vi.resetModules();
    vi.doMock('../music.ts', async () => {
      const real = await vi.importActual<typeof import('../music.ts')>('../music.ts');
      return {
        ...real,
        notesForRotation: (basePc: number, octave: number, rot: number, regimen: typeof REGIMEN[keyof typeof REGIMEN]) =>
          regimen === REGIMEN.orden
            ? real.notesForRotation(basePc, octave, rot + 1, REGIMEN.orden)
            : real.notesForRotation(basePc, octave, rot, regimen),
      };
    });
    try {
      const { checkNotes: conCorrimientoUniforme } = await import('../invariants.ts');
      const r = conCorrimientoUniforme();
      expect(r.ok).toBe(false);
      expect(r.failures.some(f => f.includes('tienen que dar lo mismo a rotacion 0'))).toBe(true);
      // Y la permutacion ciclica NO se queja: es justo el punto ciego que el ancla tapa.
      expect(r.failures.some(f => f.includes('rompe la permutacion ciclica'))).toBe(false);
      expect(r.failures.some(f => f.includes('corrido'))).toBe(false);
    } finally {
      vi.doUnmock('../music.ts');
      vi.resetModules();
    }
  });

  /**
   * El agujero que el doble modulo de `notesForRotation` tapa: un arpegio de `orden`
   * cuya primera nota no esta en el de rotacion 0. Sin este camino el `indexOf` que
   * devuelve -1 se usaria igual como indice, y el chequeo reportaria una permutacion
   * rota en vez del problema real.
   */
  it('checkNotes ve un arpegio de orden que no sale del de rotacion 0', async () => {
    vi.resetModules();
    vi.doMock('../music.ts', async () => {
      const real = await vi.importActual<typeof import('../music.ts')>('../music.ts');
      return {
        ...real,
        notesForRotation: (basePc: number, octave: number, rot: number, regimen: typeof REGIMEN[keyof typeof REGIMEN]) =>
          regimen === REGIMEN.orden && rot !== 0
            ? [900, 901, 902, 903, 904]
            : real.notesForRotation(basePc, octave, rot, regimen),
      };
    });
    try {
      const { checkNotes: conArpegioAjeno } = await import('../invariants.ts');
      const r = conArpegioAjeno();
      expect(r.ok).toBe(false);
      expect(r.failures.some(f => f.includes('que no esta en el arpegio de rotacion 0'))).toBe(true);
    } finally {
      vi.doUnmock('../music.ts');
      vi.resetModules();
    }
  });
});

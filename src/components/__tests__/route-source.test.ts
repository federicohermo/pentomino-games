import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildSequence, cellsByPlayOrder } from '../../domain/sequence.ts';
import { cellsAt } from '../../domain/board.ts';
import { notesForRotation } from '../../domain/music.ts';
import { rotateN, reflect } from '../../domain/transform.ts';
import { SHAPES, ANCHOR_INDEX } from '../../domain/constants/pieces.constants.ts';
import { BASE_MAP, DEFAULT_OCTAVE } from '../../domain/constants/music.constants.ts';
import type { PieceKey } from '../../domain/types/pieces.types.ts';
import type { PlacedPiece } from '../../domain/types/board.types.ts';

/**
 * `route-source.ts` es donde vive AC9 del spec 010 —que la cabeza dibuje el circuito
 * que SUENA y no el que esta encolado— y es una maquina de estados con dos colas, un
 * contador ajeno y un velo que se recalcula en los dos bordes. Nada de eso lo mira
 * `pnpm verify` si no se lo testea: el modulo no tiene tipos que lo aten y su unico
 * consumidor es un loop de `requestAnimationFrame`, que no corre en los tests.
 *
 * El motor va mockeado porque la unica pieza suya que este modulo usa es
 * `cycleGeneration()`, un numero. Importar el `engine.ts` real arrastraria el
 * singleton del AudioContext para leer un contador.
 *
 * El estado es de MODULO, asi que cada test lo reimporta con `vi.resetModules()`: sin
 * eso el orden de los tests seria parte del oraculo.
 */
const motor = vi.hoisted(() => ({ generacion: 0 }));
vi.mock('../../audio/engine.ts', () => ({ cycleGeneration: () => motor.generacion }));

type RouteSource = typeof import('../route-source.ts');
let rs: RouteSource;

beforeEach(async () => {
  motor.generacion = 0;
  vi.resetModules();
  rs = await import('../route-source.ts');
});

/** La cadena de colocacion completa, igual a la de `App.tsx` y a `sequence.test.ts`. */
const colocar = (piece: PieceKey, rot: number, mirror: boolean, x: number, y: number): PlacedPiece => {
  const base = rotateN(SHAPES[piece], rot);
  const shape = mirror ? reflect(base) : base;
  const asc = notesForRotation(BASE_MAP[piece], DEFAULT_OCTAVE, rot);
  return {
    id: piece,
    piece,
    rotation: rot,
    mirror,
    cells: cellsAt(shape, ANCHOR_INDEX[piece], x, y),
    notes: mirror ? [...asc].reverse() : asc,
  };
};

/** Encola el tablero por el mismo camino que `App.tsx`: una `buildSequence`, dos colas. */
const encolarTablero = (placed: readonly PlacedPiece[]): void => rs.encolar(buildSequence(placed), placed);

/** Lo que hace el motor al cerrar un ciclo: subir el contador. */
const cerrarCiclo = (): void => { motor.generacion++; };

const clave = (c: readonly number[]): string => `${c[0]},${c[1]}`;
const claves = (cs: readonly (readonly number[])[]): Set<string> => new Set(cs.map(clave));

const UNA = [colocar('F', 0, false, 2, 2)];
const DOS = [colocar('F', 0, false, 2, 2), colocar('L', 0, true, 7, 1)];

describe('AC9 — la ruta activa es la que suena, no la encolada', () => {
  it('encolar no cambia lo que la cabeza dibuja: hace falta que el motor cierre el ciclo', () => {
    encolarTablero(UNA);
    expect(rs.rutaActiva()).toEqual([]);

    cerrarCiclo();
    expect(rs.rutaActiva()).not.toEqual([]);
  });

  it('durante la espera sigue vigente el circuito VIEJO, entero', () => {
    encolarTablero(UNA);
    cerrarCiclo();
    const vieja = [...rs.rutaActiva()];

    // Se encola un tablero distinto —otra pieza, otro circuito, otro largo— y hasta
    // el borde la cabeza tiene que seguir recorriendo el anterior.
    encolarTablero(DOS);
    expect(rs.rutaActiva()).toEqual(vieja);

    cerrarCiclo();
    const nueva = rs.rutaActiva();
    expect(nueva).not.toEqual(vieja);
    expect(nueva).toHaveLength(buildSequence(DOS).length);
  });

  it('quitar una pieza tampoco la apaga antes de que deje de sonar', () => {
    // El cruce con `placed` queda CONGELADO junto con la ruta: si el loop mirara el
    // tablero en vivo, la pieza quitada se apagaria a mitad de ciclo.
    encolarTablero(DOS);
    cerrarCiclo();
    const conLas2 = rs.rutaActiva();
    const celdasL = claves(DOS[1].cells);
    const dibujadas = () => claves(conLas2.filter((m) => m !== null).map((m) => m.cell));
    expect([...celdasL].every((c) => dibujadas().has(c))).toBe(true);

    encolarTablero([DOS[0]]);
    expect(rs.rutaActiva()).toBe(conLas2);
    expect([...celdasL].every((c) => dibujadas().has(c))).toBe(true);
  });

  it('la generacion se sincroniza aunque no haya pendiente', () => {
    // Si un swap del motor sin contraparte aca dejara el contador atrasado, el
    // proximo encolar entraria en vigencia al cuadro siguiente en vez de esperar su
    // borde — que es justo lo que AC9 prohibe.
    cerrarCiclo();
    expect(rs.rutaActiva()).toEqual([]);

    encolarTablero(UNA);
    expect(rs.rutaActiva()).toEqual([]);   // todavia no: le falta SU borde

    cerrarCiclo();
    expect(rs.rutaActiva()).not.toEqual([]);
  });
});

describe('la tabla por offset', () => {
  it('cada offset trae la celda que suena en el, con la nota separada del click', () => {
    encolarTablero(DOS);
    cerrarCiclo();
    const marcas = rs.rutaActiva();
    const s = buildSequence(DOS);

    // Las notas: la celda de `notes[j]` sale de la pura del dominio, no de aca.
    for (const step of s.steps) {
      const pieza = DOS.find((p) => p.id === step.pieceId);
      const celdas = cellsByPlayOrder(pieza!);
      for (let j = 0; j < celdas.length; j++) {
        expect(marcas[step.offset + j], `paso ${step.pieceId} nota ${j}`)
          .toEqual({ cell: celdas[j], nota: true });
      }
    }

    // Los clicks: la celda la trae la propia secuencia (D5 — la UI no calcula caminos).
    expect(s.clicks.length).toBeGreaterThan(0);
    for (const c of s.clicks) expect(marcas[c.offset]).toEqual({ cell: c.cell, nota: false });

    // Y no hay agujeros ni sobrantes: el ciclo del recorrido esta cubierto entero.
    expect(marcas).toHaveLength(s.length);
    expect(marcas.filter((m) => m === null)).toEqual([]);
  });

  it('con una sola pieza no hay clicks que dibujar', () => {
    encolarTablero(UNA);
    cerrarCiclo();
    const marcas = rs.rutaActiva();
    // El ciclo mide 5 y el arpegio ocupa 5: el ultimo intervalo es el silencio con el
    // que el ciclo vuelve a empezar contiguo (spec 009), no un click.
    expect(marcas.filter((m) => m?.nota === false)).toEqual([]);
    expect(marcas.filter((m) => m?.nota === true)).toHaveLength(5);
  });

  it('un tablero vacio no deja marcas', () => {
    encolarTablero([]);
    cerrarCiclo();
    expect(rs.rutaActiva()).toEqual([]);
    expect(rs.velo()).toEqual([]);
  });
});

describe('AC5 — el velo de lo que todavia no sono', () => {
  it('la pieza encolada va sin offset, y despues del swap con el intervalo en que estrena', () => {
    encolarTablero(UNA);
    // Encolada y sin ciclo que la contenga: no hay instante que esperar, solo el swap.
    expect(rs.velo().map((e) => e.offset)).toEqual([null, null, null, null, null]);
    expect(claves(rs.velo().map((e) => e.cell))).toEqual(claves(UNA[0].cells));

    cerrarCiclo();
    rs.rutaActiva();

    // Ya entro al ciclo: ahora cada celda sabe CUANDO le toca, que es lo que hace
    // visible que el orden de reproduccion no es el de colocacion.
    const s = buildSequence(UNA);
    const paso = s.steps[0];
    const celdas = cellsByPlayOrder(UNA[0]);
    expect(rs.velo()).toEqual(celdas.map((cell, j) => ({ id: 'F', cell, offset: paso.offset + j })));
  });

  it('la que ya sonaba no vuelve al velo cuando entra otra', () => {
    encolarTablero(UNA);
    cerrarCiclo();
    rs.rutaActiva();

    encolarTablero(DOS);
    cerrarCiclo();
    rs.rutaActiva();

    // Solo estrena la `L`: la `F` ya venia sonando, y volver a taparla leeria como que
    // el tablero entero arranca de nuevo en cada swap.
    expect(new Set(rs.velo().map((e) => e.id))).toEqual(new Set(['L']));
    expect(claves(rs.velo().map((e) => e.cell))).toEqual(claves(DOS[1].cells));
  });

  it('la IDENTIDAD del array es la senal de cambio, y solo cambia en los dos bordes', () => {
    // El loop de dibujo compara por referencia 60 veces por segundo: si el array se
    // recreara en cada lectura, rearmaria los nodos del velo en cada cuadro.
    encolarTablero(UNA);
    const alEncolar = rs.velo();
    expect(rs.velo()).toBe(alEncolar);
    rs.rutaActiva();                      // sin cambio de generacion no pasa nada
    expect(rs.velo()).toBe(alEncolar);

    cerrarCiclo();
    rs.rutaActiva();
    expect(rs.velo()).not.toBe(alEncolar);
  });
});

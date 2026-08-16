import { describe, it, expect } from 'vitest';
import { degreeByCellIndex, midiFor, midiName, notesForRotation } from '../music.ts';
import { centroid, normalize, reflect, rotateN } from '../transform.ts';
import {
  BASE_MAP, CHROMATIC, DEFAULT_OCTAVE, DEGREE_EPSILON, PENT_MAJOR, PENT_MINOR, PENT_BLUES5,
} from '../constants/music.constants.ts';
import { SHAPES } from '../constants/pieces.constants.ts';
import type { Cell } from '../types/transform.types.ts';
import type { PieceKey } from '../types/pieces.types.ts';

const PIECES = Object.keys(BASE_MAP) as PieceKey[];

describe('midiFor', () => {
  it('ancla C4 en 60', () => {
    expect(midiFor(0, 4)).toBe(60);
    expect(midiFor(9, 4)).toBe(69);   // A4
  });

  it('una octava son 12 semitonos', () => {
    expect(midiFor(0, 5) - midiFor(0, 4)).toBe(12);
  });
});

describe('midiName', () => {
  it('es la inversa de midiFor sobre las 12 clases y varias octavas', () => {
    for (let o = 0; o <= 8; o++) {
      for (let pc = 0; pc < 12; pc++) {
        expect(midiName(midiFor(pc, o))).toBe(`${CHROMATIC[pc]}${o}`);
      }
    }
  });
});

describe('notesForRotation', () => {
  it('cada rotacion usa su formula, sobre C', () => {
    const base = midiFor(0, DEFAULT_OCTAVE);
    expect(notesForRotation(0, DEFAULT_OCTAVE, 0)).toEqual(PENT_MAJOR.map(iv => base + iv));
    expect(notesForRotation(0, DEFAULT_OCTAVE, 1)).toEqual(PENT_MINOR.map(iv => base + iv));
    expect(notesForRotation(0, DEFAULT_OCTAVE, 2)).toEqual(PENT_BLUES5.map(iv => base + iv));
    expect(notesForRotation(0, DEFAULT_OCTAVE, 3)).toEqual(PENT_MAJOR.map(iv => base + iv + 7));
  });

  it('una rotacion fuera de 0..3 cae en la formula mayor', () => {
    expect(notesForRotation(0, DEFAULT_OCTAVE, 4)).toEqual(notesForRotation(0, DEFAULT_OCTAVE, 0));
  });

  it('devuelve 5 notas distintas y ascendentes para las 96 combinaciones', () => {
    for (const p of PIECES) {
      for (let rot = 0; rot < 4; rot++) {
        const ns = notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, rot);
        expect(ns).toHaveLength(5);
        expect(new Set(ns).size).toBe(5);
        for (let i = 1; i < ns.length; i++) expect(ns[i]).toBeGreaterThan(ns[i - 1]);
      }
    }
  });

  it('la nota mas grave de una pieza es su tonica', () => {
    for (const p of PIECES) {
      for (let rot = 0; rot < 4; rot++) {
        const ns = notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, rot);
        // La rotacion 3 transpone +7, asi que su grave es la quinta, no la tonica.
        const esperada = rot === 3 ? (BASE_MAP[p] + 7) % 12 : BASE_MAP[p];
        expect(ns[0] % 12).toBe(esperada);
      }
    }
  });

  it('el corrimiento de octava sube la nota en vez de envolverla', () => {
    // Z (tonica B = 11) + la sexta mayor (9) pasa de B: la nota sube de octava en
    // vez de volver al grave. Es decision de diseno, no un bug.
    const ns = notesForRotation(BASE_MAP.Z, DEFAULT_OCTAVE, 0);
    expect(ns[4] - ns[0]).toBe(9);
    expect(midiName(ns[0])).toBe('B4');
    expect(midiName(ns[4])).toBe('G#5');
  });

  it('el ambito nunca supera una decima', () => {
    for (const p of PIECES) {
      for (let rot = 0; rot < 4; rot++) {
        const ns = notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, rot);
        const ambito = ns[4] - ns[0];
        expect(ambito).toBeGreaterThanOrEqual(7);
        expect(ambito).toBeLessThanOrEqual(10);
      }
    }
  });
});

/**
 * La derivacion celda→nota completa, tal como la arma quien dibuja el tablero: el
 * grado sale de la forma CANONICA indexado por `k`, y la nota sale del arpegio
 * ASCENDENTE indexada por ese grado.
 */
const notaDeCelda = (p: PieceKey, rot: number, k: number): number =>
  notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, rot)[degreeByCellIndex(SHAPES[p])[k]];

const distanciaAlCentro = (p: PieceKey, k: number) => {
  const cent = centroid(SHAPES[p]);
  return Math.hypot(SHAPES[p][k][0] - cent[0], SHAPES[p][k][1] - cent[1]);
};

describe('degreeByCellIndex', () => {
  it('AC1 — las 12 piezas dan una permutacion de [0,1,2,3,4]', () => {
    // Permutacion y no "cinco numeros del 0 al 4": ningun grado se repite ni falta,
    // que es lo que garantiza que la pieza suene sus cinco notas y no cuatro.
    for (const p of PIECES) {
      const grados = degreeByCellIndex(SHAPES[p]);
      expect(grados).toHaveLength(5);
      expect([...grados].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it('AC2 — en I y X la celda parada sobre el centroide se lleva el grado 0', () => {
    // Son las dos unicas piezas con una celda en el centro, y en las dos es la del
    // indice 2. Esa celda sale del anillo angular y toma el primer grado.
    for (const p of ['I', 'X'] as PieceKey[]) {
      expect(distanciaAlCentro(p, 2)).toBeLessThan(DEGREE_EPSILON);
      expect(degreeByCellIndex(SHAPES[p])[2]).toBe(0);
    }
  });
});

describe('AC4 — el desempate a igual angulo', () => {
  it('las celdas empatadas reciben grados consecutivos en orden de indice creciente', () => {
    // Los empates estan medidos, no supuestos: solo tres piezas los tienen. `F`
    // empata los indices 1 y 2 (los dos al norte del centroide), `I` empata {3,4}
    // al este y {0,1} al oeste, y `T` empata {3,4} al sur. Las otras nueve piezas
    // no ejercen el desempate.
    const F = degreeByCellIndex(SHAPES.F);
    expect([F[1], F[2]]).toEqual([3, 4]);

    const I = degreeByCellIndex(SHAPES.I);
    expect([I[3], I[4]]).toEqual([1, 2]);
    expect([I[0], I[1]]).toEqual([3, 4]);

    const T = degreeByCellIndex(SHAPES.T);
    expect([T[3], T[4]]).toEqual([0, 1]);
  });

  it('gana el indice menor y no el radio menor: en F la celda mas lejana va primero', () => {
    // Los dos criterios se midieron contra la lamina de referencia: por indice
    // acierta 12/12 y por radio 10/12. Aca esta una de las dos que se caen — la
    // celda (1,1) esta seis veces mas cerca del centroide que (1,0), asi que "la mas
    // cercana primero" intercambiaria G4 y A4.
    expect(distanciaAlCentro('F', 1)).toBeGreaterThan(distanciaAlCentro('F', 2));
    expect(degreeByCellIndex(SHAPES.F)[1]).toBeLessThan(degreeByCellIndex(SHAPES.F)[2]);
    expect(midiName(notaDeCelda('F', 0, 1))).toBe('G4');
    expect(midiName(notaDeCelda('F', 0, 2))).toBe('A4');
  });
});

describe('AC3 — el mapeo se arrastra por indice sobre las 96 orientaciones', () => {
  it('la celda k de la forma transformada sigue siendo la celda k de la canonica', () => {
    // Lo que sostiene el arrastre es que `rotateN` y `reflect` son `map`, y se
    // verifica DESANDANDO la transformacion en vez de recalculando el grado: si la
    // celda k vuelve a su lugar canonico, entonces el grado calculado sobre la forma
    // canonica describe la misma celda en las 96 orientaciones.
    for (const p of PIECES) {
      const canonica = normalize(SHAPES[p]);
      for (let rot = 0; rot < 4; rot++) {
        for (const mirror of [false, true]) {
          const girada = rotateN(SHAPES[p], rot);
          const shape = mirror ? reflect(girada) : girada;
          const vuelta = rotateN(mirror ? reflect(shape) : shape, (4 - rot) % 4);
          expect(vuelta).toEqual(canonica);
        }
      }
    }
  });

  it('recalcular el grado sobre la forma ya transformada NO es equivalente: difiere en 75 de las 96', () => {
    // Medido en la revision del spec 007. Rotar corre el origen del angulo, asi que
    // el recalculo da otra permutacion en casi todas las orientaciones: escribir el
    // AC3 como `degreeByCellIndex(formaTransformada) == mapeo canonico` daria un test
    // rojo, no una verificacion. Las 21 que coinciden son cortesia de la simetria.
    let distintas = 0;
    for (const p of PIECES) {
      const canonico = degreeByCellIndex(SHAPES[p]).join('');
      for (let rot = 0; rot < 4; rot++) {
        for (const mirror of [false, true]) {
          const girada = rotateN(SHAPES[p], rot);
          const shape = mirror ? reflect(girada) : girada;
          if (degreeByCellIndex(shape).join('') !== canonico) distintas++;
        }
      }
    }
    expect(distintas).toBe(75);
  });
});

describe('AC12 — la reflexion no cambia la nota de una celda', () => {
  it('la celda de grado g muestra la nota g del arpegio ASCENDENTE, no del retrogrado', () => {
    // Reflejar invierte el ORDEN EN QUE SUENAN las notas, no cual nota le toca a cada
    // celda: por eso `notesForRotation` no recibe la reflexion y la lectura visual
    // sale siempre del arpegio ascendente. Si saliera del ya invertido, las cuatro
    // celdas de grado distinto de 2 quedarian espejadas.
    for (const p of PIECES) {
      const grados = degreeByCellIndex(SHAPES[p]);
      for (let rot = 0; rot < 4; rot++) {
        const ascendente = notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, rot);
        const retrogrado = [...ascendente].reverse();
        for (let k = 0; k < grados.length; k++) {
          expect(notaDeCelda(p, rot, k)).toBe(ascendente[grados[k]]);
          // El grado 2 es el centro del arpegio: el unico que el retrogrado deja quieto.
          if (grados[k] !== 2) expect(notaDeCelda(p, rot, k)).not.toBe(retrogrado[grados[k]]);
        }
      }
    }
  });

  it('la celda de grado 0 se queda con la nota mas grave, no con la mas aguda', () => {
    for (const p of PIECES) {
      const k = degreeByCellIndex(SHAPES[p]).indexOf(0);
      const ascendente = notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, 0);
      expect(notaDeCelda(p, 0, k)).toBe(ascendente[0]);
      expect(notaDeCelda(p, 0, k)).not.toBe(ascendente[4]);   // lo que daria el retrogrado
    }
  });
});

/**
 * AC5 — la lamina de referencia, congelada: rotacion 0, octava 4, sin reflejar.
 *
 * Los nombres de nota estan escritos A MANO contra la lamina del spec 007. Si
 * salieran de correr el modelo, el test no diria nada: lo unico que hace que esto
 * sea una referencia es que no se re-derive.
 *
 * Las celdas van en el orden del array de `SHAPES`, que es el orden por el que se
 * indexa el mapeo — el segundo test lo verifica para atrapar una transcripcion
 * corrida.
 */
const REFERENCIA: Record<PieceKey, [Cell, string][]> = {
  F: [[[0, 1], 'E4'],  [[1, 0], 'G4'],  [[1, 1], 'A4'],  [[1, 2], 'D4'],  [[2, 2], 'C4']],
  I: [[[0, 0], 'G#4'], [[1, 0], 'A#4'], [[2, 0], 'C#4'], [[3, 0], 'D#4'], [[4, 0], 'F4']],
  L: [[[0, 0], 'A4'],  [[0, 1], 'F#4'], [[0, 2], 'E4'],  [[0, 3], 'D4'],  [[1, 0], 'B4']],
  N: [[[0, 0], 'A#4'], [[1, 0], 'C5'],  [[1, 1], 'G4'],  [[2, 1], 'F4'],  [[3, 1], 'D#4']],
  P: [[[0, 0], 'G#4'], [[0, 1], 'F#4'], [[1, 0], 'B4'],  [[1, 1], 'E4'],  [[2, 0], 'C#5']],
  T: [[[0, 0], 'A4'],  [[1, 0], 'C5'],  [[2, 0], 'D5'],  [[1, 1], 'F4'],  [[1, 2], 'G4']],
  U: [[[0, 0], 'A#4'], [[0, 1], 'G#4'], [[1, 0], 'C#5'], [[2, 0], 'D#5'], [[2, 1], 'F#4']],
  V: [[[0, 0], 'B4'],  [[0, 1], 'A4'],  [[0, 2], 'G4'],  [[1, 0], 'D5'],  [[2, 0], 'E5']],
  W: [[[0, 0], 'D#5'], [[1, 0], 'F5'],  [[1, 1], 'C5'],  [[2, 1], 'G#4'], [[2, 2], 'A#4']],
  X: [[[1, 0], 'F#5'], [[0, 1], 'E5'],  [[1, 1], 'A4'],  [[2, 1], 'B4'],  [[1, 2], 'C#5']],
  Y: [[[0, 0], 'C5'],  [[1, 0], 'D5'],  [[2, 0], 'F5'],  [[3, 0], 'G5'],  [[2, 1], 'A#4']],
  Z: [[[0, 1], 'C#5'], [[1, 1], 'B4'],  [[1, 0], 'D#5'], [[2, 0], 'F#5'], [[3, 0], 'G#5']],
};

/** La celda que la lamina marca en negrita: la del grado 0, la que lleva la tonica. */
const TONICA_EN: Record<PieceKey, number> = {
  F: 4, I: 2, L: 3, N: 4, P: 3, T: 3, U: 4, V: 2, W: 3, X: 2, Y: 4, Z: 1,
};

describe('AC5 — la referencia congelada', () => {
  it('las 12 piezas suenan celda por celda como la lamina', () => {
    for (const p of PIECES) {
      const leida = SHAPES[p].map((_, k) => midiName(notaDeCelda(p, 0, k)));
      expect(leida).toEqual(REFERENCIA[p].map(([, nombre]) => nombre));
    }
  });

  it('la lamina nombra las celdas en el orden del array de SHAPES', () => {
    for (const p of PIECES) {
      expect(REFERENCIA[p].map(([celda]) => celda)).toEqual(SHAPES[p]);
    }
  });

  it('la celda en negrita de la lamina es la del grado 0 y suena la tonica de la pieza', () => {
    for (const p of PIECES) {
      const k = TONICA_EN[p];
      expect(degreeByCellIndex(SHAPES[p])[k]).toBe(0);
      expect(notaDeCelda(p, 0, k) % 12).toBe(BASE_MAP[p]);
    }
  });
});

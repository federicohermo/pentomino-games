import type { Cell } from './types/transform.types.ts';
import { centroid, angleFromCentroid } from './transform.ts';
import { CHROMATIC, PENT_MAJOR, PENT_MINOR, PENT_BLUES5, DEGREE_EPSILON } from './constants/music.constants.ts';

/**
 * El modelo musical: de una clase de altura y una rotacion, a cinco notas MIDI.
 *
 * Que la rotacion elija la formula es la decision de diseno del instrumento, no un
 * dato: por eso el mapeo vive aca y las formulas en `constants/music.constants.ts`.
 */

/** Nota MIDI de la clase de altura `pc` en la octava `octave`. C4 = 60. */
export function midiFor(pc: number, octave: number): number { return 12*(octave+1) + pc; }

/** Nombre legible de una nota MIDI, p. ej. `C4`. */
export function midiName(m: number): string { const pc = m%12; const o = Math.floor(m/12)-1; return `${CHROMATIC[pc]}${o}`; }

/**
 * Las cinco notas de una pieza segun su rotacion.
 *
 * 0° → pentatonica mayor · 90° → menor · 180° → menor con blue note ·
 * 270° → mayor transpuesta +7.
 *
 * El corrimiento de octava (`octShift`) es deliberado: cuando la suma pasa de B la
 * nota SUBE de octava en vez de envolverse, y por eso las piezas de tonica alta
 * abren mas registro. Es decision documentada, no un bug a corregir de paso.
 */
export function notesForRotation(basePc: number, octave: number, rot: number): number[]{
  let formula = PENT_MAJOR, transpose=0;
  if (rot===1) formula = PENT_MINOR;
  else if (rot===2) formula = PENT_BLUES5;
  else if (rot===3) { formula = PENT_MAJOR; transpose = 7; }
  return formula.map(iv => {
    const total = basePc + iv + transpose;
    const pc = ((total%12)+12)%12;
    const octShift = Math.floor((basePc + iv + transpose)/12);
    return midiFor(pc, octave + octShift);
  });
}

/**
 * Que grado del arpegio le toca a cada celda de una forma. DEVUELVE POR INDICE:
 * el elemento `k` es el grado (`0..n-1`) de `cells[k]`, no al reves.
 *
 * Recibe la forma y no la `PieceKey` a proposito: es lo que la hace testeable
 * sobre formas arbitrarias y lo que evita que `music.ts` conozca `SHAPES`.
 *
 * Se le pasa la forma CANONICA, no la transformada. El mapeo se arrastra por
 * indice —rotar es un `map`, asi que la celda `k` sigue siendo la celda `k`—, y
 * recalcularlo sobre la forma ya rotada daria otra cosa, porque rotar corre el
 * origen del angulo.
 *
 * Tres reglas, en este orden:
 *
 * 1. Las celdas que caen SOBRE el centroide salen del anillo y toman los
 *    primeros grados. Solo `I` y `X` tienen una.
 * 2. El resto se ordena por angulo ascendente alrededor del centroide, que con
 *    el eje `y` hacia abajo es sentido horario en pantalla.
 * 3. A igual angulo gana el INDICE ORIGINAL MENOR.
 *
 * ## Por que el desempate es por indice y no por radio
 *
 * Porque se midieron los dos contra la lamina de referencia: por indice acierta
 * **12/12**, por radio **10/12** (`research.md` §2 del spec 007). Las dos que se
 * caen son `F` —donde `(1,0)` y `(1,1)` se intercambian G4 ↔ A4— e `I` —donde
 * `(0,0)` y `(1,0)` se intercambian G#4 ↔ A#4—. O sea: "la mas cercana primero",
 * que es el criterio que suena mas natural y el que proponia el spec 001,
 * desafina dos piezas contra la referencia. El desempate se ejerce en tres
 * piezas (`F`, `I`, `T`) y decide algo audible en dos.
 *
 * El tercer criterio va ESCRITO en el comparador en vez de delegado a que el
 * `sort` sea estable: la estabilidad esta garantizada desde ES2019, pero
 * apoyarse en ella dejaria la regla sin decir en ningun lado.
 *
 * Los angulos se precomputan y no se piden adentro del comparador: `sort` lo
 * llama O(n log n) veces, y ademas comparar siempre el MISMO numero es lo que
 * hace que el epsilon del empate se comporte.
 */
export function degreeByCellIndex(cells: readonly Cell[]): number[] {
  const cent = centroid(cells);

  const center: number[] = [];
  const ring: number[] = [];
  const angle = new Array<number>(cells.length);

  for (let k = 0; k < cells.length; k++) {
    const dx = cells[k][0] - cent[0];
    const dy = cells[k][1] - cent[1];
    if (Math.hypot(dx, dy) < DEGREE_EPSILON) {
      center.push(k);
    } else {
      angle[k] = angleFromCentroid(cells[k], cent);
      ring.push(k);
    }
  }

  ring.sort((a, b) =>
    Math.abs(angle[a] - angle[b]) < DEGREE_EPSILON ? a - b : angle[a] - angle[b]);

  const degrees = new Array<number>(cells.length);
  [...center, ...ring].forEach((k, degree) => { degrees[k] = degree; });
  return degrees;
}

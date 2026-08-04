import { CHROMATIC, PENT_MAJOR, PENT_MINOR, PENT_BLUES5 } from './constants/music.constants.ts';

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

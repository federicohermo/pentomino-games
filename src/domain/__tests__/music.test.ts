import { describe, it, expect } from 'vitest';
import { midiFor, midiName, notesForRotation } from '../music.ts';
import {
  BASE_MAP, CHROMATIC, DEFAULT_OCTAVE, PENT_MAJOR, PENT_MINOR, PENT_BLUES5,
} from '../constants/music.constants.ts';
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

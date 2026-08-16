import { describe, it, expect } from 'vitest';
import { midiToHz, scheduleVoice } from '../voice.ts';
import { intervalDuration } from '../scheduler.ts';
import { DEFAULT_VOICE, NOTE_INTERVALS } from '../constants/voice.constants.ts';
import { offline, peakNear, zeroCrossHz, firstAudible } from './test-context.ts';

const A4 = 69;
const VEL = 0.8;

/** Renderiza una sola voz a ganancia unitaria y devuelve las muestras. */
async function renderVoice(at: number, dur: number, freq = midiToHz(A4)) {
  const ctx = offline(at + dur + 1);
  const g = ctx.createGain();
  g.gain.value = 1;
  g.connect(ctx.destination);
  scheduleVoice(ctx, g, freq, at, dur, VEL);
  const buf = await ctx.startRendering();
  return buf.getChannelData(0);
}

describe('midiToHz', () => {
  it('ancla A4 en 440 y respeta las octavas', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 10);
    expect(midiToHz(81)).toBeCloseTo(880, 10);
    expect(midiToHz(57)).toBeCloseTo(220, 10);
    expect(midiToHz(60)).toBeCloseTo(261.6256, 3);   // C4
  });
});

describe('sintesis', () => {
  it('AC2 — la frecuencia renderizada es la pedida (+-1 Hz)', async () => {
    const d = await renderVoice(0.05, 0.5);
    expect(zeroCrossHz(d, 0.2, 0.3)).toBeCloseTo(440, 0);
  });

  it('AC2 — sirve para cualquier nota, no solo A4', async () => {
    const d = await renderVoice(0.05, 0.5, midiToHz(60));
    expect(Math.abs(zeroCrossHz(d, 0.2, 0.3) - midiToHz(60))).toBeLessThan(1);
  });

  it('AC3 — la envolvente alcanza el pico y el sostenido esperados', async () => {
    const at = 0.1, dur = 0.35;
    const d = await renderVoice(at, dur);
    const { attack, sustain } = DEFAULT_VOICE;

    // El pico real cae entre muestras, de ahi el margen del 5%.
    expect(peakNear(d, at + attack)).toBeGreaterThan(VEL * 0.95);
    expect(peakNear(d, at + attack)).toBeLessThanOrEqual(VEL * 1.001);

    const expectedSustain = VEL * sustain;
    expect(Math.abs(peakNear(d, at + dur - 0.02) - expectedSustain)).toBeLessThan(expectedSustain * 0.05);
  });

  it('AC3 — silencio exacto fuera de la nota', async () => {
    const at = 0.1, dur = 0.35;
    const d = await renderVoice(at, dur);
    const { release } = DEFAULT_VOICE;
    expect(peakNear(d, at - 0.03)).toBe(0);
    expect(peakNear(d, at + dur + release + 0.1)).toBe(0);
  });

  it('AC4 — la nota empieza donde se la agendo (+-1 ms)', async () => {
    const at = 0.1;
    const d = await renderVoice(at, 0.3);
    expect(Math.abs(firstAudible(d) - at)).toBeLessThan(0.001);
  });

  it('AC4 — y tambien en otro instante, para descartar una coincidencia', async () => {
    const at = 0.37;
    const d = await renderVoice(at, 0.3);
    expect(Math.abs(firstAudible(d) - at)).toBeLessThan(0.001);
  });
});

describe('AC5 — dur en intervalos, spec 008 (la envolvente no se movio)', () => {
  it('con dur = NOTE_INTERVALS * intervalDuration(bpm), pico y sostenido son los de siempre', async () => {
    // Mismo patron que AC3: lo unico que cambia es de donde sale `dur`. Si
    // scheduleVoice tratara `dur` distinto por venir de intervalos en vez de
    // ser un literal, el pico o el sostenido se verian corridos.
    const bpm = 100;
    const dur = NOTE_INTERVALS * intervalDuration(bpm);   // 2 * 0.15 = 0.300 s
    const at = 0.1;
    const d = await renderVoice(at, dur);
    const { attack, sustain, release } = DEFAULT_VOICE;

    expect(peakNear(d, at + attack)).toBeGreaterThan(VEL * 0.95);
    expect(peakNear(d, at + attack)).toBeLessThanOrEqual(VEL * 1.001);
    const expectedSustain = VEL * sustain;
    expect(Math.abs(peakNear(d, at + dur - 0.02) - expectedSustain)).toBeLessThan(expectedSustain * 0.05);

    // Silencio exacto antes de `at`, y de nuevo despues de dur + release: el
    // release arranca donde termina `dur`, ni antes ni despues.
    expect(peakNear(d, at - 0.03)).toBe(0);
    expect(peakNear(d, at + dur + release + 0.1)).toBe(0);
  });

  it('a 60 bpm la nota dura mas que a 160: `dur` sigue al tempo, no es un literal fijo', async () => {
    const at = 0.1;
    const durLento = NOTE_INTERVALS * intervalDuration(60);     // 2 * 0.25    = 0.500 s
    const durRapido = NOTE_INTERVALS * intervalDuration(160);   // 2 * 0.09375 = 0.1875 s
    const { sustain, release } = DEFAULT_VOICE;
    const lento = await renderVoice(at, durLento);
    const rapido = await renderVoice(at, durRapido);

    // En el instante en que la nota de 160 bpm ya termino su release, la de 60
    // bpm sigue sostenida. Si `dur` no viniera del bpm (p.ej. quedara fija en
    // el 0.35 s de antes de este spec) las dos curvas mostrarian el mismo
    // estado en ese instante, y este test fallaria.
    const tSondeo = at + durRapido + release + 0.02;
    expect(peakNear(rapido, tSondeo)).toBe(0);
    expect(peakNear(lento, tSondeo)).toBeGreaterThan(VEL * sustain * 0.9);
  });
});

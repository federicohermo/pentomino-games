import { describe, it, expect } from 'vitest';
import { midiToHz, scheduleVoice } from '../voice.ts';
import { DEFAULT_VOICE } from '../constants/voice.constants.ts';
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

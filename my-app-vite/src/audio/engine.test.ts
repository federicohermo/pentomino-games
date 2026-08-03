import { describe, it, expect } from 'vitest';
import {
  midiToHz, scheduleVoice, collectHits, DEFAULT_VOICE, ARPEGGIO_SPREAD,
  type Job, type ClockState,
} from './engine';
import { offline, peakNear, zeroCrossHz, firstAudible, detectOnsets, SR } from './test-context';

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

describe('scheduler', () => {
  const job = (notes: number[]): Job => ({ id: 'j', notes, spread: ARPEGGIO_SPREAD });

  it('AC5 — N compases producen N disparos en los instantes esperados', () => {
    const state: ClockState = { nextBar: 0 };
    const hits = collectHits(0, 8, 120, [job([A4])], state);   // 120 bpm -> compas de 2 s
    expect(hits).toHaveLength(4);
    hits.forEach((h, i) => expect(h.at).toBeCloseTo(i * 2, 9));
    expect(state.nextBar).toBeCloseTo(8, 9);
  });

  it('AC5 — cada job aporta todas sus notas, espaciadas por el arpegio', () => {
    const state: ClockState = { nextBar: 0 };
    const hits = collectHits(0, 2, 120, [job([60, 62, 64])], state);
    expect(hits).toHaveLength(3);
    expect(hits[1].at - hits[0].at).toBeCloseTo(ARPEGGIO_SPREAD, 9);
    expect(hits[2].at - hits[1].at).toBeCloseTo(ARPEGGIO_SPREAD, 9);
  });

  it('AC5 — varios jobs suenan en el mismo compas', () => {
    const state: ClockState = { nextBar: 0 };
    const jobs = [{ id: 'a', notes: [60], spread: 0 }, { id: 'b', notes: [64], spread: 0 }];
    expect(collectHits(0, 2, 120, jobs, state)).toHaveLength(2);
  });

  it('sin jobs no agenda nada, pero el cursor igual avanza', () => {
    const state: ClockState = { nextBar: 0 };
    expect(collectHits(0, 8, 120, [], state)).toHaveLength(0);
    expect(state.nextBar).toBeCloseTo(8, 9);
  });

  it('se recupera del throttling en vez de acumular compases atrasados', () => {
    const state: ClockState = { nextBar: 0 };   // el reloj quedo 100 s adelante
    const hits = collectHits(100, LOOKAHEAD_S, 120, [job([A4])], state);
    expect(hits).toHaveLength(1);               // 1, no 50
    expect(hits[0].at).toBeCloseTo(100.05, 9);
  });

  it('en marcha normal NO aplica el offset de recuperacion', () => {
    const state: ClockState = { nextBar: 5 };
    const hits = collectHits(4.95, 0.1, 120, [job([A4])], state);
    expect(hits[0].at).toBeCloseTo(5, 9);       // exactamente nextBar, sin +0.05
  });

  it('el tempo cambia la duracion del compas', () => {
    const slow: ClockState = { nextBar: 0 };
    const fast: ClockState = { nextBar: 0 };
    collectHits(0, 8, 60, [job([A4])], slow);    // compas de 4 s
    collectHits(0, 8, 240, [job([A4])], fast);   // compas de 1 s
    expect(slow.nextBar).toBeCloseTo(8, 9);
    expect(fast.nextBar).toBeCloseTo(8, 9);
    expect(collectHits(0, 4, 60, [job([A4])], { nextBar: 0 })).toHaveLength(1);
    expect(collectHits(0, 4, 240, [job([A4])], { nextBar: 0 })).toHaveLength(4);
  });
});

const LOOKAHEAD_S = 0.1;

describe('scheduler + sintesis integrados', () => {
  it('AC5 — los disparos se oyen donde el scheduler dijo (+-6 ms)', async () => {
    const state: ClockState = { nextBar: 0 };
    const hits = collectHits(0, 5, 120, [{ id: 'j', notes: [A4], spread: 0 }], state);
    expect(hits).toHaveLength(3);

    const ctx = offline(5);
    const g = ctx.createGain();
    g.gain.value = 1;
    g.connect(ctx.destination);
    hits.forEach(h => scheduleVoice(ctx, g, h.hz, h.at, 0.2, VEL));
    const d = (await ctx.startRendering()).getChannelData(0);

    const onsets = detectOnsets(d);
    expect(onsets).toHaveLength(hits.length);
    onsets.forEach((t, i) => expect(Math.abs(t - hits[i].at)).toBeLessThan(0.006));
  });

  it('dos notas superpuestas suman amplitud', async () => {
    const render = async (freqs: number[]) => {
      const ctx = offline(1);
      const g = ctx.createGain();
      g.gain.value = 1;
      g.connect(ctx.destination);
      freqs.forEach(f => scheduleVoice(ctx, g, f, 0.1, 0.3, 0.4));
      return (await ctx.startRendering()).getChannelData(0);
    };
    const solo = peakNear(await render([midiToHz(60)]), 0.2);
    const dueto = peakNear(await render([midiToHz(60), midiToHz(67)]), 0.2);

    // En sostenido cada voz aporta vel*sustain = 0.2. Suman, pero no en fase, asi
    // que el pico conjunto queda entre una voz sola y el maximo teorico de 0.4.
    expect(dueto).toBeGreaterThan(solo);
    expect(dueto).toBeLessThanOrEqual(0.4 + 1e-6);
    expect((await render([midiToHz(60)])).length).toBe(SR);
  });
});

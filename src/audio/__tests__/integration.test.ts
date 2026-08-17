import { describe, it, expect } from 'vitest';
import { midiToHz, scheduleVoice, scheduleClick } from '../voice.ts';
import { collectHits, intervalDuration } from '../scheduler.ts';
import { FFT_SIZE, SMOOTHING } from '../constants/engine.constants.ts';
import { HIT } from '../constants/scheduler.constants.ts';
import { CLICK_SECONDS } from '../constants/voice.constants.ts';
import type { ClockState } from '../types/scheduler.types.ts';
import { offline, peakNear, detectOnsets, SR } from './test-context.ts';

const A4 = 69;
const VEL = 0.8;

describe('scheduler + sintesis integrados', () => {
  it('AC5 — los disparos se oyen donde el scheduler dijo (+-6 ms)', async () => {
    const state: ClockState = { origin: 0.5, scheduledUntil: 0 };
    // Una sola nota: hit y onset coinciden por construccion. Y un ciclo de 16
    // intervalos es un compas exacto, o sea el periodo de antes del spec 009: a
    // 120 bpm da los mismos 2 s que este test medía con `phase`.
    const hits = collectHits(0, 5, 120, { steps: [{ offset: 0, notes: [A4] }], clicks: [], length: 16 }, state);
    expect(hits).toHaveLength(3);

    const ctx = offline(5);
    const g = ctx.createGain();
    g.gain.value = 1;
    g.connect(ctx.destination);
    for (const h of hits) if (h.kind === HIT.note) scheduleVoice(ctx, g, h.hz, h.at, 0.2, VEL);
    const d = (await ctx.startRendering()).getChannelData(0);

    const onsets = detectOnsets(d);
    expect(onsets).toHaveLength(hits.length);
    onsets.forEach((t, i) => expect(Math.abs(t - hits[i].at)).toBeLessThan(0.006));
  });

  it('D4 — la nota y el click del recorrido suenan donde el scheduler dijo, y el click no ocupa lugar', async () => {
    const bpm = 110;
    const interval = intervalDuration(bpm);
    const state: ClockState = { origin: 0.2, scheduledUntil: 0 };
    // Un paso y un cruce por celda vacia tres intervalos despues: el caso que el
    // spec 009 hace posible, con las dos clases de hit en la misma grilla.
    const hits = collectHits(0, 6 * interval, bpm, {
      steps: [{ offset: 0, notes: [A4] }],
      clicks: [{ offset: 3 }],
      length: 6,
    }, state);
    expect(hits).toHaveLength(2);

    const ctx = offline(2);
    const g = ctx.createGain();
    g.gain.value = 1;
    g.connect(ctx.destination);
    for (const h of hits) {
      if (h.kind === HIT.note) scheduleVoice(ctx, g, h.hz, h.at, interval, VEL);
      else scheduleClick(ctx, g, h.at);
    }
    const d = (await ctx.startRendering()).getChannelData(0);

    const onsets = detectOnsets(d);
    expect(onsets).toHaveLength(2);
    onsets.forEach((t, i) => expect(Math.abs(t - hits[i].at)).toBeLessThan(0.006));

    // El click no invade el intervalo que sigue: 50 ms despues ya es silencio, donde
    // una nota del mismo instante todavia estaria sonando (0,136 s mas el release).
    const click = hits[1].at;
    expect(peakNear(d, click + 0.002)).toBeGreaterThan(0.1);
    expect(peakNear(d, click + CLICK_SECONDS + 0.03)).toBe(0);
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

describe('analizador', () => {
  it('AC1 — el nodo es transparente: la senal que sale es la misma', async () => {
    // No verifica el analisis —getByteFrequencyData no rinde nada util offline,
    // por eso el mapeo vive en spectrum.ts— sino la unica parte del AC1 que se
    // puede afirmar sin escuchar: insertar el nodo en serie no altera el audio.
    const render = async (withAnalyser: boolean) => {
      const ctx = offline(1);
      const g = ctx.createGain();
      g.gain.value = 0.3;
      if (withAnalyser) {
        const an = ctx.createAnalyser();
        an.fftSize = FFT_SIZE;
        an.smoothingTimeConstant = SMOOTHING;
        g.connect(an);
        an.connect(ctx.destination);
      } else {
        g.connect(ctx.destination);
      }
      // 0.35 s es una duracion de render arbitraria: este test es sobre la
      // transparencia del analizador, no sobre cuanto dura la nota (esa cuenta
      // es NOTE_INTERVALS * intervalDuration(bpm) desde el spec 008, y no hay
      // bpm en juego aca).
      scheduleVoice(ctx, g, midiToHz(60), 0.1, 0.35, VEL);
      return (await ctx.startRendering()).getChannelData(0);
    };

    const directo = await render(false);
    const analizado = await render(true);
    expect(analizado.length).toBe(directo.length);
    for (let i = 0; i < directo.length; i++) {
      if (analizado[i] !== directo[i]) {
        throw new Error(`el analizador altero la muestra ${i}: ${directo[i]} -> ${analizado[i]}`);
      }
    }
  });
});

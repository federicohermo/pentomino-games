import { describe, it, expect } from 'vitest';
import { midiToHz, scheduleVoice, scheduleClick } from '../voice.ts';
import { intervalDuration } from '../scheduler.ts';
import {
  DEFAULT_VOICE, NOTE_INTERVALS, RELEASE_INTERVALS, DEFAULT_VELOCITY,
  CLICK_VELOCITY, CLICK_SECONDS,
} from '../constants/voice.constants.ts';
import { offline, peakNear, zeroCrossHz, firstAudible } from './test-context.ts';

const A4 = 69;
const VEL = 0.8;

/**
 * El release al tempo por defecto. Desde que esta en intervalos hay que elegir un bpm
 * para tener un numero, y 110 es el que da exactamente los 0,12 s que la constante
 * tenia antes: los tests que no hablan de tempo miden contra la misma envolvente de
 * siempre.
 */
const REL = RELEASE_INTERVALS * intervalDuration(110);

/** Renderiza una sola voz a ganancia unitaria y devuelve las muestras. */
async function renderVoice(at: number, dur: number, freq = midiToHz(A4), rel = REL) {
  const ctx = offline(at + dur + 1);
  const g = ctx.createGain();
  g.gain.value = 1;
  g.connect(ctx.destination);
  scheduleVoice(ctx, g, freq, at, dur, rel, VEL);
  const buf = await ctx.startRendering();
  return buf.getChannelData(0);
}

/** Idem para un click. Mismo molde a proposito: lo unico que cambia es que se agenda. */
async function renderClick(at: number, vel?: number) {
  const ctx = offline(at + 1);
  const g = ctx.createGain();
  g.gain.value = 1;
  g.connect(ctx.destination);
  scheduleClick(ctx, g, at, vel);
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
    expect(peakNear(d, at - 0.03)).toBe(0);
    expect(peakNear(d, at + dur + REL + 0.1)).toBe(0);
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
    const dur = NOTE_INTERVALS * intervalDuration(bpm);   // 1 * 0.15 = 0.150 s
    const at = 0.1;
    const d = await renderVoice(at, dur);
    const { attack, sustain } = DEFAULT_VOICE;

    expect(peakNear(d, at + attack)).toBeGreaterThan(VEL * 0.95);
    expect(peakNear(d, at + attack)).toBeLessThanOrEqual(VEL * 1.001);
    const expectedSustain = VEL * sustain;
    expect(Math.abs(peakNear(d, at + dur - 0.02) - expectedSustain)).toBeLessThan(expectedSustain * 0.05);

    // Silencio exacto antes de `at`, y de nuevo despues de dur + release: el
    // release arranca donde termina `dur`, ni antes ni despues.
    expect(peakNear(d, at - 0.03)).toBe(0);
    expect(peakNear(d, at + dur + REL + 0.1)).toBe(0);
  });

  it('a 60 bpm la nota dura mas que a 160: `dur` sigue al tempo, no es un literal fijo', async () => {
    const at = 0.1;
    const durLento = NOTE_INTERVALS * intervalDuration(60);     // 1 * 0.25    = 0.250 s
    const durRapido = NOTE_INTERVALS * intervalDuration(160);   // 1 * 0.09375 = 0.09375 s
    // El release sigue al tempo igual que `dur`: 0,22 s a 60 bpm y 0,0825 a 160.
    const relLento = RELEASE_INTERVALS * intervalDuration(60);
    const relRapido = RELEASE_INTERVALS * intervalDuration(160);
    const { sustain } = DEFAULT_VOICE;
    const lento = await renderVoice(at, durLento, midiToHz(A4), relLento);
    const rapido = await renderVoice(at, durRapido, midiToHz(A4), relRapido);

    // En el instante en que la nota de 160 bpm ya termino su release, la de 60
    // bpm sigue sostenida. Si `dur` no viniera del bpm (p.ej. quedara fija en
    // el 0.35 s de antes de este spec) las dos curvas mostrarian el mismo
    // estado en ese instante, y este test fallaria.
    const tSondeo = at + durRapido + relRapido + 0.02;
    expect(peakNear(rapido, tSondeo)).toBe(0);
    expect(peakNear(lento, tSondeo)).toBeGreaterThan(VEL * sustain * 0.9);
  });
});

describe('scheduleClick — el cruce por una celda vacia (spec 009, D4)', () => {
  it('empieza donde se lo agendo (+-1 ms), igual que una nota', async () => {
    const at = 0.37;
    const d = await renderClick(at);
    expect(Math.abs(firstAudible(d) - at)).toBeLessThan(0.001);
  });

  it('dura CLICK_SECONDS y nada mas: no invade el intervalo siguiente', async () => {
    const at = 0.1;
    const d = await renderClick(at);
    expect(peakNear(d, at - 0.03)).toBe(0);
    // 30 ms despues de terminar ya es silencio absoluto. Una nota, a 110 bpm,
    // seguiria sonando: 0,136 s de nota mas 0,12 s de release (0,88 intervalos).
    expect(peakNear(d, at + CLICK_SECONDS + 0.03)).toBe(0);
    expect(peakNear(d, at + 0.002)).toBeGreaterThan(CLICK_VELOCITY * 0.75);
  });

  it('NO tiene altura: cruza el cero a una tasa de ruido, no de nota', async () => {
    const at = 0.1;
    const d = await renderClick(at);
    // El ruido blanco cambia de signo cerca de la mitad de las muestras: medido,
    // 10.815 Hz a 44,1 kHz de muestreo. Cualquier oscilador a una altura del
    // instrumento —el tablero no pasa de unos 1500 Hz— daria un orden de magnitud
    // menos. Es la diferencia entre un click y una nota corta, y es lo unico que se
    // puede medir sin escuchar.
    expect(zeroCrossHz(d, at + 0.002, at + 0.015)).toBeGreaterThan(4000);
  });

  it('suena mas bajo que una nota: acompana el recorrido, no compite', async () => {
    const at = 0.1;
    const click = peakNear(await renderClick(at), at + 0.002);
    const nota = peakNear(await renderVoice(at, 0.15), at + DEFAULT_VOICE.attack);

    expect(click).toBeLessThanOrEqual(CLICK_VELOCITY + 1e-6);
    expect(nota).toBeGreaterThan(DEFAULT_VELOCITY * 0.95);
    expect(click).toBeLessThan(nota / 2);
  });

  it('el volumen se puede pisar por parametro, como en scheduleVoice', async () => {
    const at = 0.1;
    const bajo = peakNear(await renderClick(at, CLICK_VELOCITY / 4), at + 0.002);
    expect(bajo).toBeLessThanOrEqual(CLICK_VELOCITY / 4 + 1e-6);
    expect(bajo).toBeGreaterThan(0);
  });
});

describe('el release en intervalos (cierre del seguimiento del 008)', () => {
  it('la cola sigue al tempo: el solape del arpegio ya no crece con el bpm', async () => {
    // La propiedad que el numero en segundos rompia. Voces simultaneas =
    // `(NOTE_INTERVALS * intervalo + release) / intervalo`, o sea `1 + RELEASE_INTERVALS`
    // — un numero SIN bpm adentro. Se mide como cola: cuanto sobrevive la nota despues
    // de `dur`, en intervalos, tiene que dar lo mismo a los dos extremos del slider.
    const at = 0.1;
    for (const bpm of [60, 160]) {
      const iv = intervalDuration(bpm);
      const dur = NOTE_INTERVALS * iv;
      const rel = RELEASE_INTERVALS * iv;
      const d = await renderVoice(at, dur, midiToHz(A4), rel);

      // Justo antes de que termine el release todavia suena; pasado el release, no.
      expect(peakNear(d, at + dur + rel * 0.5), `${bpm} bpm en pleno release`).toBeGreaterThan(0);
      expect(peakNear(d, at + dur + rel + 0.05), `${bpm} bpm despues del release`).toBe(0);
    }
  });

  it('a 110 bpm la envolvente es la misma que con los 0,12 s de antes', async () => {
    // El valor de `RELEASE_INTERVALS` se eligio para esto: al tempo por defecto el
    // instrumento suena exactamente igual que antes del cambio.
    expect(RELEASE_INTERVALS * intervalDuration(110)).toBeCloseTo(0.12, 10);
  });
});

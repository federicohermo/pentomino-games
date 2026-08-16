import { describe, it, expect } from 'vitest';
import { collectHits } from '../scheduler.ts';
import { scheduleVoice } from '../voice.ts';
import { LOOKAHEAD, TICK_MS } from '../constants/scheduler.constants.ts';
import type { Job, ClockState } from '../types/scheduler.types.ts';
import { offline, detectOnsets } from './test-context.ts';

const A4 = 69;
const VEL = 0.8;

/**
 * El espaciado del arpegio, escrito acá a proposito (AC10).
 *
 * Importarlo de `engine.ts` haria que el test de la capa 2 alcanzara a la capa 3,
 * que es justo la dependencia que la particion viene a impedir. Para el scheduler
 * el spread es un dato del job, no una constante del motor.
 */
const SPREAD = 0.15;

/**
 * El cursor de compas del spec 002, copiado tal cual, como oraculo de
 * no-regresion del reloj por origen (AC2 del spec 004).
 *
 * Es codigo muerto en produccion a proposito: la unica forma de afirmar que la
 * reformulacion no cambio ningun instante es tener las dos implementaciones vivas
 * y compararlas. Si el spec 004 se revierte, este bloque se borra con el.
 */
function collectHitsPorCursor(
  fromTime: number,
  horizon: number,
  bpm: number,
  jobs: Iterable<Job>,
  state: { nextBar: number },
): { at: number }[] {
  const bar = (60 / bpm) * 4;
  const out: { at: number }[] = [];
  const list = [...jobs];
  if (state.nextBar < fromTime) state.nextBar = fromTime + 0.05;
  while (state.nextBar < fromTime + horizon) {
    for (const job of list) {
      job.notes.forEach((_, i) => out.push({ at: state.nextBar + i * job.spread }));
    }
    state.nextBar += bar;
  }
  return out;
}

describe('scheduler — reloj por origen (spec 004)', () => {
  const BPM = 110;
  const BAR = (60 / BPM) * 4;
  const TICK = TICK_MS / 1000;
  /** Reloj recien arrancado, igual que startClock: scheduledUntil antes de origin. */
  const ORIGIN = 0.05;
  const recienArrancado = (): ClockState => ({ origin: ORIGIN, scheduledUntil: 0 });
  const job = (notes: number[], phase = 0): Job => ({ id: 'j', notes, spread: SPREAD, phase });

  it('N compases producen N disparos en los instantes esperados', () => {
    const state: ClockState = { origin: 0.5, scheduledUntil: 0 };
    const hits = collectHits(0, 8, 120, [job([A4])], state);   // 120 bpm -> compas de 2 s
    expect(hits).toHaveLength(4);
    hits.forEach((h, k) => expect(h.at).toBeCloseTo(0.5 + k * 2, 9));
    expect(state.scheduledUntil).toBeCloseTo(8, 9);
  });

  it('cada job aporta todas sus notas, espaciadas por el arpegio', () => {
    const hits = collectHits(0, 2, 120, [job([60, 62, 64])], { origin: 0.5, scheduledUntil: 0 });
    expect(hits).toHaveLength(3);
    expect(hits[1].at - hits[0].at).toBeCloseTo(SPREAD, 9);
    expect(hits[2].at - hits[1].at).toBeCloseTo(SPREAD, 9);
  });

  it('varios jobs suenan en el mismo compas', () => {
    const jobs: Job[] = [
      { id: 'a', notes: [60], spread: 0, phase: 0 },
      { id: 'b', notes: [64], spread: 0, phase: 0 },
    ];
    const hits = collectHits(0, 2, 120, jobs, { origin: 0.5, scheduledUntil: 0 });
    expect(hits).toHaveLength(2);
    expect(hits[0].at).toBeCloseTo(hits[1].at, 9);
  });

  it('acepta un iterador de una sola pasada', () => {
    // Regresion heredada del 002: tick() pasa jobs.values(), un iterador de Map
    // que se agota en la primera pasada. Con el cursor de compas el for de jobs
    // estaba ADENTRO del while y los compases 2..N salian vacios; con el reloj por
    // origen el bucle de compases quedo adentro y los jobs se recorren una sola
    // vez, asi que ya no puede pasar. El test se queda para que si alguien vuelve
    // a invertir los bucles, se entere.
    const map = new Map<string, Job>([['a', { id: 'a', notes: [A4], spread: 0, phase: 0 }]]);
    const conIterador = collectHits(0, 8, 120, map.values(), { origin: 0.5, scheduledUntil: 0 });
    const conArray = collectHits(0, 8, 120, [...map.values()], { origin: 0.5, scheduledUntil: 0 });
    expect(conIterador).toHaveLength(4);
    expect(conIterador.map(h => h.at)).toEqual(conArray.map(h => h.at));
  });

  it('sin jobs no agenda nada, pero el reloj igual avanza', () => {
    const state = recienArrancado();
    expect(collectHits(0, 8, 120, [], state)).toHaveLength(0);
    expect(state.scheduledUntil).toBeCloseTo(8, 9);
  });

  it('una ventana ya cubierta no vuelve a emitir ni hace retroceder el reloj', () => {
    const state = recienArrancado();
    expect(collectHits(0, 1, BPM, [job([A4])], state)).toHaveLength(1);   // el downbeat
    expect(state.scheduledUntil).toBeCloseTo(1, 9);
    expect(collectHits(0, 0.5, BPM, [job([A4])], state)).toHaveLength(0);
    expect(state.scheduledUntil).toBeCloseTo(1, 9);                       // no retrocedio
  });

  it('el tempo cambia la duracion del compas', () => {
    expect(collectHits(0, 4, 60, [job([A4])], { origin: 0.5, scheduledUntil: 0 })).toHaveLength(1);
    expect(collectHits(0, 4, 240, [job([A4])], { origin: 0.5, scheduledUntil: 0 })).toHaveLength(4);
  });

  it('AC2 — con phase 0 emite exactamente los mismos instantes que el cursor de compas', () => {
    const nuevo = recienArrancado();
    const viejo = { nextBar: ORIGIN };
    const nuevos: number[] = [];
    const viejos: number[] = [];
    for (let i = 0; i < 400; i++) {                 // 10 s de ticks de 25 ms
      const t = i * TICK;
      nuevos.push(...collectHits(t, LOOKAHEAD, BPM, [job([A4, 64, 67])], nuevo).map(h => h.at));
      viejos.push(...collectHitsPorCursor(t, LOOKAHEAD, BPM, [job([A4, 64, 67])], viejo).map(h => h.at));
    }
    expect(viejos.length).toBeGreaterThan(0);
    expect(nuevos).toHaveLength(viejos.length);
    nuevos.forEach((at, i) => expect(at).toBeCloseTo(viejos[i], 6));
  });

  it('AC3 — ventanas solapadas emiten cada onset una sola vez, y todos', () => {
    const phase = 0.37;
    const state: ClockState = { origin: ORIGIN, scheduledUntil: 0 };
    const emitidos: number[] = [];
    let ultimo = 0;
    for (let i = 0; i < 400; i++) {
      const t = i * TICK;
      ultimo = t + LOOKAHEAD;
      const j: Job = { id: 'j', notes: [A4], spread: 0, phase };
      emitidos.push(...collectHits(t, LOOKAHEAD, BPM, [j], state).map(h => h.at));
    }
    const esperados: number[] = [];
    for (let k = 0; ORIGIN + (k + phase) * BAR <= ultimo; k++) esperados.push(ORIGIN + (k + phase) * BAR);

    expect(new Set(emitidos).size).toBe(emitidos.length);   // ninguno repetido
    expect(emitidos).toHaveLength(esperados.length);        // ninguno perdido
    emitidos.forEach((at, i) => expect(at).toBeCloseTo(esperados[i], 9));
  });

  it('AC4 — ningun hit cae en el pasado', () => {
    const state = recienArrancado();
    for (let i = 0; i < 400; i++) {
      const t = i * TICK;
      for (const h of collectHits(t, LOOKAHEAD, BPM, [job([60, 62, 64], 0.6)], state)) {
        expect(h.at).toBeGreaterThanOrEqual(t);
      }
    }
  });

  it('AC6 — un salto de 10 compases se saltea, sin avalancha y sin trabarse', () => {
    const state = recienArrancado();
    collectHits(0, LOOKAHEAD, BPM, [job([60, 62, 64])], state);
    const salto = LOOKAHEAD + 10 * BAR;
    // Como mucho un compas de notas: los 10 perdidos se descartan, no se recuperan.
    expect(collectHits(salto, LOOKAHEAD, BPM, [job([60, 62, 64])], state).length)
      .toBeLessThanOrEqual(3);
    // Y el reloj no queda trabado: el compas siguiente vuelve a salir, uno solo.
    const sigue: number[] = [];
    for (let t = salto + LOOKAHEAD; t < salto + LOOKAHEAD + BAR; t += TICK) {
      sigue.push(...collectHits(t, LOOKAHEAD, BPM, [job([60, 62, 64])], state).map(h => h.at));
    }
    expect(sigue).toHaveLength(3);
  });
});

describe('fase por pieza (spec 004)', () => {
  const BPM = 110;
  const BAR = (60 / BPM) * 4;
  const ORIGIN = 0.05;
  const pieza = (id: string, notes: number[], phase: number): Job =>
    ({ id, notes, spread: SPREAD, phase });

  it('AC1 — los onsets caen en origin + (k + phase) * bar', () => {
    const state: ClockState = { origin: 0.5, scheduledUntil: 0 };
    const j: Job = { id: 'j', notes: [A4], spread: 0, phase: 0.25 };
    const hits = collectHits(0, 8, 120, [j], state);   // compas de 2 s
    expect(hits).toHaveLength(4);
    hits.forEach((h, k) => expect(h.at).toBeCloseTo(0.5 + (k + 0.25) * 2, 9));
  });

  it('AC1 — el arpegio se expande desde el onset desfasado', () => {
    const state: ClockState = { origin: 0.5, scheduledUntil: 0 };
    const hits = collectHits(0, 2.4, 120, [pieza('j', [60, 62, 64], 0.5)], state);
    expect(hits).toHaveLength(3);
    hits.forEach((h, i) => expect(h.at).toBeCloseTo(0.5 + 0.5 * 2 + i * SPREAD, 9));
  });

  it('AC1 — dos jobs con phase distinta arrancan en instantes distintos', () => {
    const state: ClockState = { origin: ORIGIN, scheduledUntil: 0 };
    const jobs = [
      { id: 'a', notes: [60], spread: 0, phase: 0 },
      { id: 'b', notes: [64], spread: 0, phase: 0.5 },
    ];
    const hits = collectHits(0, BAR, BPM, jobs, state);
    expect(hits).toHaveLength(2);
    expect(hits[1].at - hits[0].at).toBeCloseTo(0.5 * BAR, 9);
  });

  it('AC5 — ningun onset se agenda con mas de LOOKAHEAD de anticipacion', () => {
    // spread 0 para que cada hit SEA un onset: AC5 se mide sobre el instante del
    // onset, no sobre la ultima nota del arpegio, que se extiende mas alla a
    // proposito — igual que antes de este spec.
    for (const phase of [0, 0.25, 0.5, 0.99]) {
      const state: ClockState = { origin: ORIGIN, scheduledUntil: 0 };
      let emitidos = 0;
      for (let i = 0; i < 400; i++) {
        const t = i * (TICK_MS / 1000);
        for (const h of collectHits(t, LOOKAHEAD, BPM, [{ id: 'j', notes: [A4], spread: 0, phase }], state)) {
          expect(h.at).toBeLessThanOrEqual(t + LOOKAHEAD);
          emitidos++;
        }
      }
      expect(emitidos).toBeGreaterThan(0);   // que no pase por vacio
    }
  });

  it('AC9 — cambiar el tempo estira el patron sin reordenarlo', () => {
    const jobs = [
      pieza('a', [60], 0),
      pieza('b', [67], 0.5),
      pieza('c', [72], 0.8),
    ];
    // Fracciones de compas desde el origen: si son iguales a los dos tempos, el
    // patron es el mismo estirado, no otro patron.
    const fracciones = (bpm: number) => {
      const bar = (60 / bpm) * 4;
      // Arrancar 1 ms antes del origen y no mucho antes: la progresion de onsets
      // esta definida para todo k, asi que una ventana que empieza compases antes
      // del origen tambien emite los compases negativos.
      const state: ClockState = { origin: 1, scheduledUntil: 0.999 };
      return collectHits(0.999, 1.9 * bar, bpm, jobs, state)
        .map(h => (h.at - 1) / bar)
        .sort((x, y) => x - y);
    };
    const lento = fracciones(60);     // compas de 4 s
    const rapido = fracciones(160);   // compas de 1.5 s
    expect(lento).toHaveLength(6);    // 3 jobs x 2 compases
    expect(rapido).toHaveLength(6);
    lento.forEach((f, i) => expect(f).toBeCloseTo(rapido[i], 6));
  });

  /**
   * Renderiza UN compas de los jobs dados, a ganancia unitaria.
   *
   * El horizonte de un compas entero es deliberadamente el que el motor real
   * nunca usa (alla es LOOKAHEAD): es la unica forma de juntar de una todos los
   * onsets del compas para medirlos como audio.
   */
  async function renderCompas(jobs: Job[]) {
    const state: ClockState = { origin: ORIGIN, scheduledUntil: 0 };
    const hits = collectHits(0, BAR, BPM, jobs, state);
    const ctx = offline(BAR + 1);
    const g = ctx.createGain();
    g.gain.value = 1;
    g.connect(ctx.destination);
    hits.forEach(h => scheduleVoice(ctx, g, h.hz, h.at, 0.35, VEL));
    return (await ctx.startRendering()).getChannelData(0);
  }

  const peak = (d: Float32Array) => d.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

  it('AC7 — desfasar dos piezas baja el pico y separa los eventos', async () => {
    const A = [60, 62, 64, 67, 69];   // pentatonica mayor de C
    const B = [67, 69, 71, 74, 76];   // la de G
    const alineadas = await renderCompas([pieza('a', A, 0), pieza('b', B, 0)]);
    const desfasadas = await renderCompas([pieza('a', A, 0), pieza('b', B, 0.5)]);

    // El pico de dos piezas alineadas es volumen apilado sobre la misma voz; el de
    // dos desfasadas es el de una pieza sola. Es el problema que ataca el spec.
    expect(peak(desfasadas)).toBeLessThan(peak(alineadas));
    // Y donde habia un evento pasan a haber dos: la textura que el volumen tapaba.
    expect(detectOnsets(desfasadas)).toHaveLength(detectOnsets(alineadas).length * 2);
  });
});

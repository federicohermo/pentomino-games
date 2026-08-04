import type { Job, ClockState, Hit } from './types/scheduler.types.ts';
import { midiToHz } from './voice.ts';

/**
 * Scheduler con lookahead: decide QUE suena y CUANDO, sin producir sonido.
 *
 * Igual que `voice.ts`, no conoce el singleton del `AudioContext`: recibe los
 * tiempos por parametro. Es lo que permite llamarlo con instantes arbitrarios y
 * comparar contra lo esperado, sin depender de tiempo real.
 *
 * **El reloj es un origen, no un cursor.** `ClockState` son dos escalares y los
 * onsets de cada job —`origin + (k + phase) * bar`— se resuelven en forma cerrada.
 */

const barDuration = (bpm: number) => (60 / bpm) * 4;

/**
 * Primer onset de un job estrictamente posterior a `after`.
 *
 * `floor(x) + 1` y no `ceil(x)`: se quiere el primer k con onset > after, no >=.
 * Con `ceil`, un onset que cae exacto en el borde de una ventana se emitiria dos
 * veces — al cerrar una ventana y al abrir la siguiente.
 *
 * `k` puede salir negativo si `after` cae antes del origen, y esta bien: la
 * progresion esta definida para todo k. Solo pasa en la primera ventana despues
 * de startClock, con fases cercanas a 1, y a lo sumo emite la cola del compas -1
 * en los 50 ms previos al downbeat inicial. Nunca produce un onset anterior a
 * `after`, que es la propiedad que importa.
 */
function firstOnsetAfter(after: number, origin: number, bar: number, phase: number): number {
  const k = Math.floor((after - origin) / bar - phase) + 1;
  return origin + (k + phase) * bar;
}

/**
 * Decide QUE suena y CUANDO, sin producir sonido. Separarlo de scheduleVoice es
 * lo que hace testeable al scheduler: se lo puede llamar con tiempos arbitrarios
 * y comparar contra lo esperado, sin depender de tiempo real.
 *
 * Los onsets de un job son la progresion `origin + (k + phase) * bar`. Resolver
 * el primer `k` en forma cerrada, en vez de avanzar un cursor de compas, es lo
 * que permite que cada job tenga su propio desplazamiento sin emitir un compas
 * entero de una: **nunca se compromete mas de `horizon` de audio**, asi que
 * quitar una pieza la calla casi al instante.
 *
 * Muta `state.scheduledUntil`.
 */
export function collectHits(
  fromTime: number,
  horizon: number,
  bpm: number,
  jobs: Iterable<Job>,
  state: ClockState,
): Hit[] {
  const bar = barDuration(bpm);
  const until = fromTime + horizon;
  const out: Hit[] = [];

  // Arrancar desde scheduledUntil evita re-emitir lo que ya salio en la ventana
  // anterior; arrancar desde fromTime cuando el reloj se adelanto DESCARTA los
  // compases perdidos por el estrangulamiento de la pestana en vez de intentar
  // recuperarlos. Es lo que reemplaza a la guarda de recuperacion explicita del
  // spec 002: no hay bucle que acotar, porque el primer k sale en forma cerrada
  // y saltear 10 compases cuesta lo mismo que saltear 1.
  const from = Math.max(state.scheduledUntil, fromTime);
  // Sin este corte, una ventana mas chica que la anterior haria RETROCEDER
  // scheduledUntil y lo ya emitido volveria a salir.
  if (from >= until) return out;

  // El parametro sigue siendo Iterable y tick() pasa jobs.values(), un iterador
  // de una sola pasada: acá se recorre exactamente una vez porque el bucle de
  // compases quedo adentro, no afuera. No hace falta materializar.
  for (const job of jobs) {
    // `at += bar` acumula error de punto flotante, y lo que lo vuelve inofensivo
    // es que cada llamada recalcula el primer onset desde origin: no hay deriva
    // ENTRE llamadas, que es donde si importaria. Ademas, como lo llama tick()
    // el bucle da a lo sumo una vuelta —horizonte de 0.1 s contra un compas de
    // 1.5 s a 160 bpm, el mas corto que permite la UI—, pero eso es una
    // propiedad de ESE llamador y no de la funcion: con un horizonte de varios
    // compases da varias vueltas, y los tests la usan asi a proposito.
    for (let at = firstOnsetAfter(from, state.origin, bar, job.phase); at <= until; at += bar) {
      job.notes.forEach((m, i) => out.push({ hz: midiToHz(m), at: at + i * job.spread }));
    }
  }

  state.scheduledUntil = until;
  return out;
}

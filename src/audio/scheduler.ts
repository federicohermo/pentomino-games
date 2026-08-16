import type { Job, ClockState, Hit } from './types/scheduler.types.ts';
import { midiToHz } from './voice.ts';
import { BEATS_PER_BAR, SUBDIVISIONS_PER_BEAT } from './constants/scheduler.constants.ts';

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

/**
 * Duracion de un compas, en segundos. El 60 es la conversion de minutos a segundos.
 *
 * Exportada porque es una regla, no un detalle: cualquiera que quiera saber
 * cuanto dura `n` compases a un tempo dado la necesita, y volver a escribirla es
 * tener dos definiciones del compas.
 */
export const barDuration = (bpm: number): number => (60 / bpm) * BEATS_PER_BAR;

/**
 * Duracion de un intervalo —la unidad ritmica del instrumento— en segundos.
 *
 * Definida SOBRE barDuration y no con su propia formula: asi hay un solo lugar
 * donde el compas se convierte en segundos, y el intervalo no puede desfasarse
 * del compas al que subdivide.
 *
 * Exportada por el mismo motivo que barDuration: es una regla, no un detalle.
 * Antes el espaciado del arpegio era una constante en segundos (0.15) que no
 * miraba el tempo: el arpegio de 5 notas duraba 4 * 0.15 = 0.6 s a cualquier bpm,
 * o sea un 25% del compas a 100 bpm pero un 40% a 160, donde la linea base del
 * spec 008 mostro que las piezas ya se pisan. Derivado del compas mide siempre
 * `compas / 4` —1.000 s a 60 bpm, 0.375 s a 160— y deja de depender del tempo.
 * A 100 bpm da 0.15 s exactos, que es el valor de antes: ahi no cambia nada.
 */
export const intervalDuration = (bpm: number): number =>
  barDuration(bpm) / (BEATS_PER_BAR * SUBDIVISIONS_PER_BEAT);

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
  // Depende solo del bpm de esta llamada, asi que sale una vez y no por nota:
  // adentro del forEach serian 5 divisiones por job y por compas de la ventana.
  const interval = intervalDuration(bpm);
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
      job.notes.forEach((m, i) => out.push({ hz: midiToHz(m), at: at + i * interval }));
    }
  }

  state.scheduledUntil = until;
  return out;
}

import type { Sequence, ClockState } from './types/scheduler.types.ts';
import { midiToHz, scheduleVoice, scheduleClick } from './voice.ts';
import { collectWindow, intervalDuration } from './scheduler.ts';
import { NOTE_INTERVALS } from './constants/voice.constants.ts';
import { LOOKAHEAD, TICK_MS, HIT } from './constants/scheduler.constants.ts';
import {
  MASTER_GAIN, DEFAULT_BPM, PLAY_DELAY, CLOCK_START_DELAY,
  FFT_SIZE, SMOOTHING,
} from './constants/engine.constants.ts';

/**
 * Capa de aplicacion del audio: los singletons y la API que consume la UI.
 *
 * Es la unica de las tres capas que toca el `AudioContext` global. `voice.ts` y
 * `scheduler.ts` lo reciben por parametro y no importan este modulo, asi que la
 * separacion que antes sostenia un comentario ahora la sostiene el grafo de
 * imports — y es lo que permite renderizarlas con un OfflineAudioContext.
 *
 * NO es un barrel: no re-exporta voice ni scheduler en bloque.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;

/**
 * El AudioContext vive a nivel de modulo: hay uno por pestana, no uno por
 * instancia del componente. Se crea perezosamente porque los navegadores exigen
 * un gesto del usuario para arrancar el audio.
 *
 * Devuelve null si el navegador no soporta Web Audio: la app queda usable pero
 * muda, y cada llamador tiene que chequearlo.
 */
export function audio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;

    // El analizador va ENTRE el master y el destino, no colgado de una rama
    // paralela: asi ve exactamente la mezcla que sale por los parlantes. Es
    // transparente al audio —no altera la senal que lo atraviesa—, de modo que
    // insertarlo no cambia como suena nada.
    analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;
    master.connect(analyser);
    analyser.connect(ctx.destination);
  } catch (e) {
    console.warn('Web Audio no disponible', e);
    return null;
  }
  return ctx;
}

/** Buffer de lectura del espectro. Ver la advertencia en readSpectrum(). */
let freqBuf: Uint8Array | null = null;

/**
 * Magnitudes de frecuencia del ultimo bloque procesado, 0-255 por bin.
 *
 * Devuelve null cuando todavia no hay senal que mirar: sin contexto (nadie hizo
 * click aun) o con el contexto suspendido. Es informacion util para el llamador
 * —un array de ceros y "no hay audio" se dibujan distinto— y ademas evita crear
 * el AudioContext desde el loop de dibujo, que correria sin gesto del usuario.
 *
 * CUIDADO: el Uint8Array es reusado entre llamadas para no asignar 60 veces por
 * segundo. Quien lo guarde va a ver como le cambia por debajo. El consumidor
 * previsto es un loop de dibujo, que lo lee y lo descarta en el mismo cuadro; si
 * hace falta conservarlo, copiarlo con slice().
 */
export function readSpectrum(): Uint8Array | null {
  if (!analyser || !ctx || ctx.state !== 'running') return null;
  if (!freqBuf || freqBuf.length !== analyser.frequencyBinCount) {
    freqBuf = new Uint8Array(analyser.frequencyBinCount);
  }
  analyser.getByteFrequencyData(freqBuf);
  return freqBuf;
}

/**
 * Dispara un arpegio contra el singleton, ya mismo.
 *
 * NO es el unico camino de nota a sonido: tick() llama a scheduleVoice() directo,
 * porque collectHits ya devolvio los instantes expandidos y volver a pasar por aca
 * significaria recalcular el espaciado que el scheduler ya aplico.
 *
 * Siguen siendo dos caminos, pero ahora comparten tambien el RITMO, no solo el
 * timbre: el paso del arpegio y la duracion de la nota salen de intervalDuration
 * con el bpm de este modulo, aca y en tick(). Antes tambien coincidian, pero por
 * copiar el mismo numero fijo en segundos —uno leia la constante y el otro la
 * recibia dentro del Job—, y ese numero ignoraba el tempo: eran dos lugares que
 * alguien tenia que mantener iguales. Hoy es una regla sola y sigue al bpm.
 *
 * Lo que sigue SIN unificar es COMO se expande el arpegio: un cambio en la linea
 * de abajo no llega al loop, igual que un cambio en collectHits no llega aca.
 * Cambiar el timbre en DEFAULT_VOICE si alcanza para los dos.
 */
export function playNotes(notes: number[]): void {
  const c = audio();
  if (!c || !master) return;
  const start = c.currentTime + PLAY_DELAY;
  const interval = intervalDuration(bpm);
  const dur = NOTE_INTERVALS * interval;
  notes.forEach((m, i) => scheduleVoice(c, master!, midiToHz(m), start + i * interval, dur));
}

/** Dispara ya, reanudando el contexto. Debe llamarse desde un gesto del usuario. */
export function playNow(notes: number[]): void {
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  playNotes(notes);
}

// —— reloj ——

/**
 * El recorrido que esta sonando y el que va a sonar cuando este cierre su ciclo.
 *
 * Dos y no una: colocar o quitar una pieza no interrumpe lo que suena (D5). El
 * cambio de una por otra lo hace `collectWindow`, al cerrar el ciclo.
 */
let active: Sequence = { steps: [], clicks: [], length: 0 };
let pending: Sequence | null = null;
const clock: ClockState = { origin: 0, scheduledUntil: 0 };
let timer: number | null = null;
let bpm = DEFAULT_BPM;

export const setBpm = (v: number): void => { bpm = v; };

/**
 * Si los clicks del recorrido suenan. Es MEZCLA, no modelo.
 *
 * Vive aca y no en la secuencia por eso: apagarlos no cambia el recorrido —los
 * clicks siguen en la `Sequence` y `collectHits` los sigue emitiendo—, solo deja de
 * cablearlos a sonido en `tick()`. Filtrar antes obligaria a reconstruir la
 * secuencia para algo que no es una decision del tablero, y ademas haria que el
 * ciclo pareciera distinto segun el volumen.
 *
 * El spec 009 lo dejo previsto en su tabla de riesgos —"es un parametro suelto: si
 * molesta, se baja o se apaga sin tocar el modelo"— y salio de escuchar: mientras
 * `pathBetween` cruce celdas ocupadas, hay clicks que caen encima de la pieza que
 * acaba de sonar.
 */
let clicksAudible = true;
export const setClicksAudible = (v: boolean): void => { clicksAudible = v; };

/**
 * Encola el recorrido nuevo. NO toca lo que esta sonando: entra en vigencia recien
 * al cerrar el ciclo activo, que es lo que permite que el circuito se reordene
 * entero sin que el patron salte a mitad de frase (D5).
 *
 * El precio esta medido y es la decision mas cara del spec 009: con 8 piezas a 110
 * bpm el ciclo dura 7,5 s, asi que una pieza recien colocada puede tardar eso en
 * escucharse dentro del loop. Lo que si suena al instante es su arpegio, por el otro
 * camino a sonido (`playNotes`).
 *
 * Solo se guarda la ultima: dos cambios antes del cierre valen por uno, porque lo que
 * se encola es el recorrido COMPLETO y no un delta.
 */
export function setSequence(next: Sequence): void { pending = next; }

/**
 * Expuesto para verificacion manual desde la consola: reemplaza a `jobCount()`, que
 * era la forma de mirar el motor sin oirlo y que este spec borro junto con los jobs.
 * Informa la secuencia ACTIVA —la que esta sonando—, no la pendiente: preguntarle al
 * motor que agendo y que le contesten lo que todavia no agendo seria peor que no
 * tener la funcion.
 */
export const sequenceInfo = (): { steps: number; clicks: number; length: number } => ({
  steps: active.steps.length,
  clicks: active.clicks.length,
  length: active.length,
});

export const clockRunning = (): boolean => timer !== null;

function tick(): void {
  const c = audio();
  if (!c || !master) return;
  // El bpm no cambia dentro de la vuelta, asi que la duracion sale una sola vez
  // y todas las notas de esta ventana quedan medidas contra el mismo tempo.
  const dur = NOTE_INTERVALS * intervalDuration(bpm);
  // Toda la decision —incluido el swap al cierre del ciclo— vive en el scheduler,
  // que es testeable; aca queda el cableado a sonido, que sin AudioContext no se
  // puede correr. Ver el docblock de collectWindow.
  const w = collectWindow(c.currentTime, LOOKAHEAD, bpm, active, pending, clock);
  active = w.active;
  pending = w.pending;
  for (const hit of w.hits) {
    if (hit.kind === HIT.note) scheduleVoice(c, master, hit.hz, hit.at, dur);
    else if (clicksAudible) scheduleClick(c, master, hit.at);
  }
}

export function startClock(): void {
  if (timer !== null) return;
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  clock.origin = c.currentTime + CLOCK_START_DELAY;
  // Estrictamente ANTES de origin: firstOnsetAfter devuelve el primer onset
  // POSTERIOR a lo ya emitido, asi que con scheduledUntil = origin el primer onset
  // del ciclo 0 se saltearia y el primer sonido llegaria un ciclo tarde — que desde
  // el spec 009 son 7,5 s con 8 piezas, no un compas. Es la misma trampa que vuelve
  // a aparecer en el swap de collectWindow.
  clock.scheduledUntil = c.currentTime;
  timer = window.setInterval(tick, TICK_MS);
}

export function stopClock(): void {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
}

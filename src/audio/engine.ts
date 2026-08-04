import type { Job, ClockState } from './types/scheduler.types.ts';
import { midiToHz, scheduleVoice } from './voice.ts';
import { collectHits } from './scheduler.ts';
import { NOTE_DUR } from './constants/voice.constants.ts';
import { LOOKAHEAD, TICK_MS } from './constants/scheduler.constants.ts';
import {
  MASTER_GAIN, ARPEGGIO_SPREAD, DEFAULT_BPM, PLAY_DELAY, CLOCK_START_DELAY,
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
 * La consecuencia practica: un cambio de sonido hecho SOLO aca no afecta al loop.
 * Lo que si esta unificado son las constantes (ARPEGGIO_SPREAD, NOTE_DUR) y la
 * funcion de voz — cambiar el timbre en DEFAULT_VOICE alcanza para los dos caminos.
 */
export function playNotes(notes: number[]): void {
  const c = audio();
  if (!c || !master) return;
  const start = c.currentTime + PLAY_DELAY;
  notes.forEach((m, i) => scheduleVoice(c, master!, midiToHz(m), start + i * ARPEGGIO_SPREAD, NOTE_DUR));
}

/** Dispara ya, reanudando el contexto. Debe llamarse desde un gesto del usuario. */
export function playNow(notes: number[]): void {
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  playNotes(notes);
}

// —— reloj ——

const jobs = new Map<string, Job>();
const clock: ClockState = { origin: 0, scheduledUntil: 0 };
let timer: number | null = null;
let bpm = DEFAULT_BPM;

export const setBpm = (v: number): void => { bpm = v; };
export const addJob = (job: Job): void => { jobs.set(job.id, job); };
export const removeJob = (id: string): void => { jobs.delete(id); };
export const clearJobs = (): void => { jobs.clear(); };
/** Expuesto para verificacion manual desde la consola. */
export const jobCount = (): number => jobs.size;
export const clockRunning = (): boolean => timer !== null;

function tick(): void {
  const c = audio();
  if (!c || !master) return;
  for (const hit of collectHits(c.currentTime, LOOKAHEAD, bpm, jobs.values(), clock)) {
    scheduleVoice(c, master, hit.hz, hit.at, NOTE_DUR);
  }
}

export function startClock(): void {
  if (timer !== null) return;
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  clock.origin = c.currentTime + CLOCK_START_DELAY;
  // Estrictamente ANTES de origin: firstOnsetAfter devuelve el primer onset
  // POSTERIOR a lo ya emitido, asi que con scheduledUntil = origin el downbeat
  // del compas 0 se saltearia y el primer sonido llegaria un compas tarde.
  clock.scheduledUntil = c.currentTime;
  timer = window.setInterval(tick, TICK_MS);
}

export function stopClock(): void {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
}

/**
 * Motor de audio sobre Web Audio.
 *
 * Tres piezas, en este orden:
 *   1. Sintesis  — una voz por nota: oscilador + envolvente ADSR.
 *   2. Scheduler — lookahead: un temporizador grueso agenda con anticipacion
 *                  contra el reloj de audio.
 *   3. App layer — el singleton del AudioContext y las funciones que usa la UI.
 *
 * Las dos primeras reciben el contexto por parametro y no tocan el singleton:
 * es lo que permite renderizarlas con un OfflineAudioContext en los tests.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Sintesis
// ─────────────────────────────────────────────────────────────────────────────

/** MIDI a Hz. A4 = 69 = 440 Hz. */
export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

export interface VoiceOpts {
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  type?: OscillatorType;
}

export const DEFAULT_VOICE: Required<VoiceOpts> = {
  attack: 0.005,
  decay: 0.06,
  sustain: 0.5,
  release: 0.12,
  type: 'triangle',
};

/**
 * Agenda UNA nota. `at` es tiempo absoluto del reloj del contexto, no un delay.
 *
 * El `setValueAtTime(0, at)` inicial no es redundante: las rampas de Web Audio
 * interpolan desde el ultimo evento agendado, asi que sin ese ancla la rampa
 * arranca en el valor que haya quedado y se oye un click.
 *
 * Las rampas son lineales y no exponenciales porque exponentialRampToValueAtTime
 * no admite llegar a 0 — habria que rampar a un epsilon y cortar.
 */
export function scheduleVoice(
  ctx: BaseAudioContext,
  dest: AudioNode,
  freq: number,
  at: number,
  dur = 0.35,
  vel = 0.8,
  opts: VoiceOpts = {},
): void {
  const { attack, decay, sustain, release, type } = { ...DEFAULT_VOICE, ...opts };
  const osc = ctx.createOscillator();
  const env = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);

  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(vel, at + attack);
  env.gain.linearRampToValueAtTime(vel * sustain, at + attack + decay);
  env.gain.setValueAtTime(vel * sustain, at + dur);
  env.gain.linearRampToValueAtTime(0, at + dur + release);

  osc.connect(env);
  env.connect(dest);
  osc.start(at);
  osc.stop(at + dur + release + 0.01);
  osc.onended = () => { osc.disconnect(); env.disconnect(); };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Scheduler con lookahead
// ─────────────────────────────────────────────────────────────────────────────

/** Una pieza colocada que re-dispara su secuencia cada compas. */
export interface Job {
  id: string;
  notes: number[];
  /** segundos entre notas consecutivas del arpegio */
  spread: number;
}

export interface ClockState {
  /** instante absoluto del proximo compas, en el reloj del contexto */
  nextBar: number;
}

export interface Hit {
  hz: number;
  at: number;
}

/** Cuanto futuro se agenda en cada vuelta del temporizador. */
export const LOOKAHEAD = 0.1;
/** Cada cuanto despierta el temporizador. No dispara notas: decide cuando mirar. */
export const TICK_MS = 25;

const barDuration = (bpm: number) => (60 / bpm) * 4;

/**
 * Decide QUE suena y CUANDO, sin producir sonido. Separarlo de scheduleVoice es
 * lo que hace testeable al scheduler: se lo puede llamar con tiempos arbitrarios
 * y comparar contra lo esperado, sin depender de tiempo real.
 *
 * Muta `state.nextBar`, que es el cursor del reloj.
 */
export function collectHits(
  fromTime: number,
  horizon: number,
  bpm: number,
  jobs: Iterable<Job>,
  state: ClockState,
): Hit[] {
  const bar = barDuration(bpm);
  const out: Hit[] = [];

  // Materializar los jobs ANTES del while. El parametro es Iterable, y tick() pasa
  // jobs.values(): un iterador de Map se agota en la primera pasada, asi que si el
  // while da mas de una vuelta los compases siguientes saldrian vacios. Hoy no se
  // alcanza —el horizonte es 0.1 s y el compas mas corto 1.5 s a 160 bpm— pero
  // depende de una relacion entre constantes que nadie esta obligado a preservar.
  const list = [...jobs];

  // Recuperacion: si la pestana estuvo oculta el temporizador se estrangula y el
  // reloj de audio sigue corriendo. Sin esta guarda el while intentaria recuperar
  // cientos de compases atrasados de una. Solo actua cuando el reloj YA paso el
  // proximo compas; en marcha normal nextBar va por delante y no se toca.
  //
  // Lo que NO arregla: con la pestana oculta Chrome estrangula setInterval a >=1 s,
  // muy por encima del horizonte de 0.1 s, asi que cada tick emite un compas y el
  // tempo efectivo baja (a 110 bpm, un compas cada ~3 s en vez de cada 2.18 s). Se
  // ataca con el reloj basado en origen del spec 004, no con esta guarda.
  if (state.nextBar < fromTime) state.nextBar = fromTime + 0.05;

  while (state.nextBar < fromTime + horizon) {
    for (const job of list) {
      job.notes.forEach((m, i) => out.push({ hz: midiToHz(m), at: state.nextBar + i * job.spread }));
    }
    state.nextBar += bar;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Capa de aplicacion — singletons
// ─────────────────────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;

/** 128 bins (fftSize / 2). Suficiente para visualizar, insuficiente para afinar. */
export const FFT_SIZE = 256;
/** Promediado temporal entre lecturas: sin el la animacion tiembla; de mas, es melaza. */
export const SMOOTHING = 0.8;

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
    master.gain.value = 0.3;

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

/** Espaciado del arpegio, en segundos. Igual para el disparo directo y el loop. */
export const ARPEGGIO_SPREAD = 0.15;
const NOTE_DUR = 0.35;

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
  const start = c.currentTime + 0.02;
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
const clock: ClockState = { nextBar: 0 };
let timer: number | null = null;
let bpm = 110;

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
  clock.nextBar = c.currentTime + 0.05;
  timer = window.setInterval(tick, TICK_MS);
}

export function stopClock(): void {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
}

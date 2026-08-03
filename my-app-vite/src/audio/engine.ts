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

  // Recuperacion: si la pestana estuvo oculta el temporizador se estrangula y el
  // reloj de audio sigue corriendo. Sin esta guarda el while intentaria recuperar
  // cientos de compases atrasados de una. Solo actua cuando el reloj YA paso el
  // proximo compas; en marcha normal nextBar va por delante y no se toca.
  if (state.nextBar < fromTime) state.nextBar = fromTime + 0.05;

  while (state.nextBar < fromTime + horizon) {
    for (const job of jobs) {
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
    master.connect(ctx.destination);
  } catch (e) {
    console.warn('Web Audio no disponible', e);
    return null;
  }
  return ctx;
}

/** Espaciado del arpegio, en segundos. Igual para el disparo directo y el loop. */
export const ARPEGGIO_SPREAD = 0.15;
const NOTE_DUR = 0.35;

/**
 * UNICO camino de nota a sonido. Lo llaman tanto el disparo al colocar una pieza
 * como el scheduler; asi el espaciado y la duracion viven en un solo lugar.
 */
export function playNotes(notes: number[], at?: number): void {
  const c = audio();
  if (!c || !master) return;
  const start = at ?? c.currentTime + 0.02;
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

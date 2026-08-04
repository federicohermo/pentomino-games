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
  /**
   * Posicion del job dentro del compas, `0 <= phase < 1`.
   *
   * Fraccion y no segundos: asi el patron se mantiene proporcional al cambiar el
   * tempo, en vez de quedar atado al bpm con el que se creo el job.
   *
   * Obligatorio y sin default a proposito: un `phase?: number` dejaria pasar en
   * silencio el caso de agregar un job y olvidarse la fase, que es exactamente el
   * bug que este campo corrige.
   */
  phase: number;
}

export interface ClockState {
  /** instante del compas 0 en el reloj del contexto */
  origin: number;
  /**
   * Hasta donde ya se emitieron onsets. Sin esto cada onset se emitiria cuatro
   * veces: los ticks son de 25 ms y el horizonte de 100 ms, asi que las ventanas
   * consecutivas se solapan.
   */
  scheduledUntil: number;
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
    // `at += bar` acumula error de punto flotante, pero el bucle da como mucho
    // una vuelta por llamada (horizonte 0.1 s contra un compas de 2.18 s a
    // 110 bpm) y cada llamada recalcula desde origin: no hay deriva entre
    // llamadas, que es donde si importaria.
    for (let at = firstOnsetAfter(from, state.origin, bar, job.phase); at <= until; at += bar) {
      job.notes.forEach((m, i) => out.push({ hz: midiToHz(m), at: at + i * job.spread }));
    }
  }

  state.scheduledUntil = until;
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
const clock: ClockState = { origin: 0, scheduledUntil: 0 };
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
  // El margen de 0.05 le da al primer tick (25 ms) tiempo de llegar antes del
  // compas 0. Si el temporizador se atrasa mas que eso, el downbeat inicial se
  // saltea en vez de recuperarse — coherente con el resto del reloj.
  clock.origin = c.currentTime + 0.05;
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

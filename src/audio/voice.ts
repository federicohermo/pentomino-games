import type { VoiceOpts } from './types/voice.types.ts';
import {
  DEFAULT_VOICE, DEFAULT_VELOCITY, RELEASE_TAIL,
  CLICK_VELOCITY, CLICK_SECONDS,
} from './constants/voice.constants.ts';

/**
 * Sintesis: una voz por nota, oscilador mas envolvente ADSR.
 *
 * Recibe el `BaseAudioContext` por parametro y **no puede** tocar el singleton: el
 * singleton vive en `engine.ts` y este modulo no lo importa. Es lo que permite
 * renderizar la sintesis con un `OfflineAudioContext` en los tests, y ahora lo
 * sostiene el grafo de imports en vez de un comentario.
 */

/** MIDI a Hz. A4 = 69 = 440 Hz. */
export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/**
 * Agenda UNA nota. `at` es tiempo absoluto del reloj del contexto, no un delay.
 *
 * El `setValueAtTime(0, at)` inicial no es redundante: las rampas de Web Audio
 * interpolan desde el ultimo evento agendado, asi que sin ese ancla la rampa
 * arranca en el valor que haya quedado y se oye un click.
 *
 * Las rampas son lineales y no exponenciales porque exponentialRampToValueAtTime
 * no admite llegar a 0 — habria que rampar a un epsilon y cortar.
 *
 * `dur` es obligatorio y sin default a proposito, igual que `phase` en `Job`:
 * desde que la duracion de la nota se cuenta en intervalos, depende del tempo y
 * ya no puede ser una constante. Un default seria un numero fijo en segundos que
 * miente sobre el bpm vigente, y el llamador que se olvidara el parametro no se
 * enteraria. El calculo —`NOTE_INTERVALS * intervalDuration(bpm)`— vive donde
 * esta el bpm, que es `engine.ts`, y este modulo sigue sin saber de tempo.
 */
export function scheduleVoice(
  ctx: BaseAudioContext,
  dest: AudioNode,
  freq: number,
  at: number,
  dur: number,
  vel = DEFAULT_VELOCITY,
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
  osc.stop(at + dur + release + RELEASE_TAIL);
  osc.onended = () => { osc.disconnect(); env.disconnect(); };
}

/**
 * Agenda UN click: el recorrido cruzando una celda vacia (D4 del spec 009). `at`
 * es tiempo absoluto del reloj del contexto, igual que en scheduleVoice.
 *
 * **Ruido y no un oscilador corto.** El click no tiene altura, y un oscilador
 * SIEMPRE la tiene: 20 ms de una onda de 1 kHz son 20 ciclos completos, suficientes
 * para que el oido le ponga nota y para que el recorrido empiece a sonar como una
 * linea melodica que compite con las piezas. El ruido blanco no tiene fundamental
 * que perseguir, asi que el cruce se lee como percusion. Es un `AudioBufferSourceNode`
 * con muestras aleatorias, un nodo que esta capa nunca habia creado; el research del
 * spec verifico que `node-web-audio-api` lo renderiza offline, que es lo que permite
 * testearlo en vez de escucharlo.
 *
 * El buffer se arma por click y no se cachea a nivel de modulo: **los modulos de capa
 * no declaran constantes**, y un cache tampoco podria vivir aca porque dependeria del
 * `sampleRate` del contexto, que este modulo recibe por parametro justamente para que
 * el mismo codigo corra contra el singleton y contra un OfflineAudioContext. Son ~880
 * muestras por click y ~15 clicks por ciclo de 7,5 s: no es un costo que valga la pena
 * pagar con una constante que mienta sobre el contexto.
 */
export function scheduleClick(
  ctx: BaseAudioContext,
  dest: AudioNode,
  at: number,
  vel = CLICK_VELOCITY,
): void {
  const frames = Math.max(1, Math.round(CLICK_SECONDS * ctx.sampleRate));
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const env = ctx.createGain();

  // Sin rampa de ataque, al reves que scheduleVoice: alla el escalon se oye como un
  // click y hay que anclarlo en 0; aca el click ES lo que se busca, y una rampa de
  // ataque le sacaria justo el transitorio que lo hace percusivo. La caida lineal a 0
  // en CLICK_SECONDS es lo que lo cierra: sin ella el buffer termina de golpe y el
  // corte suena como un segundo click.
  env.gain.setValueAtTime(vel, at);
  env.gain.linearRampToValueAtTime(0, at + CLICK_SECONDS);

  src.connect(env);
  env.connect(dest);
  src.start(at);
  // Sin stop(): el buffer dura exactamente CLICK_SECONDS y se termina solo. Un stop()
  // en ese mismo instante seria un segundo lugar donde vive la duracion del click.
  src.onended = () => { src.disconnect(); env.disconnect(); };
}

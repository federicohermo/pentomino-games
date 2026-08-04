import type { VoiceOpts } from './types/voice.types.ts';
import { DEFAULT_VOICE, NOTE_DUR, DEFAULT_VELOCITY } from './constants/voice.constants.ts';

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
 */
export function scheduleVoice(
  ctx: BaseAudioContext,
  dest: AudioNode,
  freq: number,
  at: number,
  dur = NOTE_DUR,
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
  // El colchon sobre el final del release evita cortar la cola de la envolvente.
  osc.stop(at + dur + release + 0.01);
  osc.onended = () => { osc.disconnect(); env.disconnect(); };
}

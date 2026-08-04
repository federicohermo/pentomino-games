/** Envolvente y timbre de una voz. Todo opcional: los faltantes salen de DEFAULT_VOICE. */
export interface VoiceOpts {
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  type?: OscillatorType;
}

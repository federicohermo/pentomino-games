import type { VoiceOpts } from '../types/voice.types.ts';

/**
 * El timbre por defecto. Cambiarlo alcanza para los DOS caminos a sonido —el
 * arpegio al colocar y el loop—, porque los dos terminan en `scheduleVoice`.
 */
export const DEFAULT_VOICE: Required<VoiceOpts> = {
  attack: 0.005,
  decay: 0.06,
  sustain: 0.5,
  release: 0.12,
  type: 'triangle',
};

/** Cuanto dura una nota, en segundos. Sin contar el release, que se suma despues. */
export const NOTE_DUR = 0.35;

/** Amplitud de una nota, 0-1. */
export const DEFAULT_VELOCITY = 0.8;

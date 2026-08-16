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

/**
 * Cuanto dura una nota, en INTERVALOS. Sin contar el release, que se suma despues.
 *
 * En intervalos y no en segundos porque una duracion fija no sobrevive al cambio
 * de tempo: la nota mantiene su relacion con el pulso —dos intervalos, media
 * negra— a cualquier bpm, mientras que un valor en segundos se estira o se pisa
 * con la nota siguiente segun el tempo. Quien la use la multiplica por
 * `intervalDuration(bpm)`. A 100 bpm da 2 * 0.15 = 0.300 s, contra los 0.350 s
 * de antes: la nota se acorta 50 ms y ese es todo el cambio a ese tempo.
 */
export const NOTE_INTERVALS = 2;

/** Amplitud de una nota, 0-1. */
export const DEFAULT_VELOCITY = 0.8;

/**
 * Colchon entre el final del release y el `stop()` del oscilador, en segundos.
 *
 * Sin el, el oscilador se corta justo cuando la envolvente llega a 0 y la cola
 * queda truncada.
 */
export const RELEASE_TAIL = 0.01;

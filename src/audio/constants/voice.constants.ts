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
 * de tempo: la nota mantiene su relacion con el pulso a cualquier bpm, mientras
 * que un valor en segundos se estira o se pisa con la nota siguiente segun el
 * tempo. Quien la use la multiplica por `intervalDuration(bpm)`.
 *
 * UNO y no dos, que es lo que preveia el plan del spec 008: con dos, la nota
 * dura exactamente el doble de lo que tarda en llegar la siguiente, asi que el
 * arpegio suena con 2,88 voces encimadas de forma permanente —medido a 110 bpm,
 * contando `(NOTE_INTERVALS * intervalo + release) / intervalo`—. Con uno la nota
 * termina justo cuando entra la que sigue y lo unico que se solapa es la cola del
 * release: 1,88 voces, contra las 3,13 de antes del spec. El arpegio se escucha
 * como cinco notas y no como un acorde desplegado.
 *
 * A 100 bpm da 1 * 0.15 = 0.150 s, contra los 0.350 s de antes del spec.
 *
 * Ojo con el numero que NO esta en intervalos: `DEFAULT_VOICE.release` son 0,12 s
 * absolutos, o sea 0,48 intervalos a 60 bpm pero 1,28 a 160. Es lo que hace que
 * el solape restante crezca con el tempo en vez de quedarse quieto.
 */
export const NOTE_INTERVALS = 1;

/** Amplitud de una nota, 0-1. */
export const DEFAULT_VELOCITY = 0.8;

/**
 * Colchon entre el final del release y el `stop()` del oscilador, en segundos.
 *
 * Sin el, el oscilador se corta justo cuando la envolvente llega a 0 y la cola
 * queda truncada.
 */
export const RELEASE_TAIL = 0.01;

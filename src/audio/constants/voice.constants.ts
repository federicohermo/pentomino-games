import type { VoiceOpts } from '../types/voice.types.ts';

/**
 * El timbre por defecto. Cambiarlo alcanza para los DOS caminos a sonido —el
 * arpegio al colocar y el loop—, porque los dos terminan en `scheduleVoice`.
 *
 * Ya NO trae el release. Lo traia —0,12 s absolutos— y era lo unico del modelo
 * temporal que habia quedado fuera de las unidades musicales del spec 008: 0,48
 * intervalos a 60 bpm pero 1,28 a 160, o sea que el solape del arpegio crecia con
 * el tempo en vez de quedarse quieto. Hoy es `RELEASE_INTERVALS` y viaja como
 * parametro, por la misma razon por la que `dur` no tiene default.
 *
 * Lo que queda aca es lo que NO depende del tempo: attack y decay son el
 * transitorio del instrumento —su identidad perceptual es la brevedad absoluta,
 * igual que la de `CLICK_SECONDS`— y sustain es un nivel, no un tiempo.
 */
export const DEFAULT_VOICE: Required<VoiceOpts> = {
  attack: 0.005,
  decay: 0.06,
  sustain: 0.5,
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
 * El release tambien esta en intervalos desde el cierre de los seguimientos del 008
 * (`RELEASE_INTERVALS`), asi que las 1,88 voces son las mismas a cualquier tempo. Antes
 * eran 0,12 s absolutos y el solape crecia con el bpm.
 */
export const NOTE_INTERVALS = 1;

/**
 * Cuanto dura la caida de la nota despues de `dur`, en INTERVALOS.
 *
 * Es el par de `NOTE_INTERVALS` y existe por el mismo motivo: en segundos no
 * sobrevive al cambio de tempo. Era `DEFAULT_VOICE.release = 0.12` fijo, y con eso
 * el arpegio se espesaba al acelerar — las voces simultaneas son
 * `(NOTE_INTERVALS * intervalo + release) / intervalo`, o sea `1 + release/intervalo`:
 * con el release en segundos ese cociente crece con el bpm, y a 160 bpm daba 2,28
 * contra las 1,88 de 110. Justo lo que el spec 008 arreglo para el espaciado y para
 * la duracion, sobreviviendo en el ultimo numero que nadie habia mirado.
 *
 * **0,88 y no un valor redondo**: es exactamente `0.12 / intervalDuration(110)`, o sea
 * el release que ya sonaba al tempo por defecto (`15 / 110 = 0,13636 s` de intervalo).
 * A 110 bpm la envolvente queda IDENTICA a la de antes de este cambio, y a cualquier
 * otro tempo el solape se queda en las 1,88 voces medidas en vez de moverse. Elegir un
 * numero mas lindo habria cambiado como suena el instrumento al tempo en el que se
 * afino, que es lo unico que este cambio no queria tocar.
 *
 * Quien lo usa lo multiplica por `intervalDuration(bpm)` y se lo pasa a
 * `scheduleVoice`, que sigue sin saber de tempo.
 */
export const RELEASE_INTERVALS = 0.88;

/** Amplitud de una nota, 0-1. */
export const DEFAULT_VELOCITY = 0.8;

/**
 * Amplitud de un click, 0-1.
 *
 * Calibrado contra `DEFAULT_VELOCITY` (0,8), que es la de una nota: 0,25 es menos de
 * un tercio, unos -10 dB. Bajo a proposito para que el recorrido acompanie y no
 * compita con las notas (D4).
 *
 * Pero no mas bajo, y eso tambien esta medido: un ciclo de 8 piezas tiene 40 notas y
 * ~15 clicks, o sea que el click es minoria pero no ruido de fondo. Si no se
 * escucha, el recorrido se vuelve inaudible y el spec pierde su razon de ser.
 *
 * Ademas el click dura `CLICK_SECONDS` (20 ms) contra los ~136 ms de una nota a 110
 * bpm, y un transitorio tan corto ya se percibe bastante mas debil que una nota
 * sostenida de la misma amplitud: bajar el numero seria descontar dos veces lo mismo.
 */
export const CLICK_VELOCITY = 0.25;

/**
 * Cuanto dura un click, en SEGUNDOS.
 *
 * Es la excepcion deliberada a lo que dice `NOTE_INTERVALS`: lo musical se mide en
 * intervalos para que sobreviva al cambio de tempo, pero el click es un transitorio y
 * su identidad perceptual es la brevedad ABSOLUTA, no la proporcion con el pulso. Si
 * se estirara con el tempo, a 60 bpm (intervalo de 0,25 s) duraria 37 ms y empezaria
 * a tener cuerpo y altura en vez de sonar como un golpe.
 *
 * 20 ms: a 110 bpm el intervalo mide 0,136 s y el click ocupa el 15%; aun a 160 bpm
 * (intervalo de 0,094 s) ocupa el 21%. O sea que dos clicks consecutivos no se pisan
 * a ningun tempo del instrumento, y ninguno invade la nota que viene despues.
 *
 * No fija el timbre: quien lo elige —ruido con `createBuffer`, que el research
 * verifico que `node-web-audio-api` soporta, u oscilador con envolvente corta— es el
 * scheduler. Aca solo esta cuanto dura.
 */
export const CLICK_SECONDS = 0.02;

/**
 * Colchon entre el final del release y el `stop()` del oscilador, en segundos.
 *
 * Sin el, el oscilador se corta justo cuando la envolvente llega a 0 y la cola
 * queda truncada.
 */
export const RELEASE_TAIL = 0.01;

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

/**
 * Cuanto dura un CRUCE por celda ocupada, en INTERVALOS. Su release es el mismo
 * `RELEASE_INTERVALS` de una nota: lo que cambia es el cuerpo, no el timbre.
 *
 * En intervalos y no en segundos como `CLICK_SECONDS`. La excepcion del click esta
 * justificada en que NO tiene altura —es un transitorio y su identidad es la brevedad
 * absoluta—; el cruce si la tiene: es la nota de la celda que se piso (D5 del spec
 * 011), asi que su precedente es `NOTE_INTERVALS` y tiene que mantener su relacion
 * con el pulso a cualquier tempo. Quien la multiplica por `intervalDuration(bpm)` es
 * `engine.ts`, que es donde vive el bpm.
 *
 * **Menor que uno**, porque el cruce es una floritura y no puede disputarle el turno
 * a la pieza: con 0,75 el cuerpo se apaga a tres cuartos del camino a la casilla
 * siguiente, y lo que queda sonando en ese ultimo cuarto es solo la cola del release.
 * Contado en voces simultaneas —`(dur + release) / intervalo`, la misma cuenta de
 * `NOTE_INTERVALS`—, un cruce pesa 1,63 contra las 1,88 de una nota.
 *
 * **0,75 y no menos, y ese es un piso MEDIDO, no una preferencia.** `scheduleVoice`
 * agenda `setValueAtTime(vel * sustain, at + dur)` despues de la rampa de decay, que
 * termina en `attack + decay = 0,065 s` ABSOLUTOS (los dos viven en `DEFAULT_VOICE`
 * porque son el transitorio del instrumento y no dependen del tempo). Si `dur` cae
 * antes de ese instante los eventos se procesan igual en orden temporal y la
 * envolvente se da vuelta: en vez de decaer se queda clavada en el pico y despues
 * baja de GOLPE al sustain. Renderizado offline a 160 bpm —el `TEMPO_MAX` del
 * instrumento, donde el intervalo mide 0,0938 s— con dur 0,25 · 0,5 · 0,693: las tres
 * sostienen 0,450 (el pico entero) y saltan a 0,225 en 1 ms, o sea un escalon que se
 * oye como un click justo lo que este cruce no quiere ser. Con 0,75 la envolvente
 * decae limpia y el salto mas grande del cuerpo pasa a ser la propia rampa de ataque.
 * El piso exacto a 160 bpm es 0,693 (`0,065 / 0,0938`) y 0,75 es el valor redondo que
 * lo pasa, con 5 ms de margen. Bajarlo obliga a mirar `DEFAULT_VOICE` y `TEMPO_MAX`
 * en la misma cuenta.
 */
export const GRACE_INTERVALS = 0.75;

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
 * Amplitud de un CRUCE por celda ocupada, 0-1. Entre las otras dos, y no en el medio
 * aritmetico.
 *
 * El cruce es una floritura: tiene que oirse mas presente que un click —lleva altura,
 * y si no se identifica como nota no se entiende que se piso una celda de una pieza—
 * pero mas al fondo que la nota de la pieza cuyo turno es (D5 del spec 011). O sea que
 * el numero esta acotado por los dos que ya existen: `CLICK_VELOCITY` (0,25) y
 * `DEFAULT_VELOCITY` (0,8).
 *
 * **0,45 y no 0,525, que seria el promedio.** La amplitud se percibe en dB y no
 * linealmente, asi que el punto medio real es la media GEOMETRICA: `sqrt(0,25 * 0,8) =
 * 0,447`. Con 0,45 el cruce queda a -5,0 dB de una nota y a +5,1 dB de un click, o sea
 * a la misma distancia de los dos; con el promedio aritmetico quedaria a -3,7 dB de la
 * nota y a +6,4 dB del click, mucho mas cerca de sonar como una nota mas.
 *
 * Cinco dB tampoco es un numero arbitrario: es la diferencia mas chica que se lee
 * claramente como "esto suena mas suave" en vez de como una nota mal tocada, y todavia
 * deja al cruce audible en la mezcla — con 8 piezas un ciclo tiene 40 notas contra un
 * punado de cruces, asi que si se hunde no se escucha nunca.
 *
 * Ademas el cruce dura menos que una nota (`GRACE_INTERVALS`, 0,75 contra 1) y eso ya
 * lo aleja por su cuenta: bajar mas la amplitud seria descontar dos veces lo mismo, el
 * mismo argumento que cierra el docblock de `CLICK_VELOCITY`.
 */
export const GRACE_VELOCITY = 0.45;

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

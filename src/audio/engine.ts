import type { Sequence, ClockState } from './types/scheduler.types.ts';
import { midiToHz, scheduleVoice, scheduleClick } from './voice.ts';
import { collectWindow, intervalDuration } from './scheduler.ts';
import { offsetAt } from './playhead.ts';
import {
  NOTE_INTERVALS, RELEASE_INTERVALS, GRACE_INTERVALS, GRACE_VELOCITY,
} from './constants/voice.constants.ts';
import { LOOKAHEAD, TICK_MS, HIT } from './constants/scheduler.constants.ts';
import {
  MASTER_GAIN, DEFAULT_BPM, PLAY_DELAY, CLOCK_START_DELAY,
  FFT_SIZE, SMOOTHING,
} from './constants/engine.constants.ts';

/**
 * Capa de aplicacion del audio: los singletons y la API que consume la UI.
 *
 * Es la unica de las tres capas que toca el `AudioContext` global. `voice.ts` y
 * `scheduler.ts` lo reciben por parametro y no importan este modulo, asi que la
 * separacion que antes sostenia un comentario ahora la sostiene el grafo de
 * imports — y es lo que permite renderizarlas con un OfflineAudioContext.
 *
 * NO es un barrel: no re-exporta voice ni scheduler en bloque.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;

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
    master.gain.value = MASTER_GAIN;

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

/**
 * Buffer de lectura del espectro. Ver la advertencia en readSpectrum().
 *
 * El `<ArrayBuffer>` va escrito y NO se puede simplificar a `Uint8Array` pelado, aunque
 * el `pnpm typecheck` de hoy lo acepte. Desde TypeScript 5.7 los arrays tipados son
 * genericos en su buffer, y `Uint8Array` a secas significa `Uint8Array<ArrayBufferLike>`,
 * que incluye `SharedArrayBuffer`. El `lib.dom.d.ts` de la 5.8.3 —la version fijada en el
 * repo— todavia declara `getByteFrequencyData(array: Uint8Array)`, asi que compila; las
 * versiones siguientes lo estrecharon a `Uint8Array<ArrayBuffer>` y ahi el pelado pasa a
 * ser un TS2345. Medido: con la 5.8.3 verde y con la 7.0.2 error en esta misma linea, o
 * sea que el editor ya lo marca hoy con el repo en verde.
 *
 * Escribirlo no es defensivo: `new Uint8Array(n)` SIEMPRE aloca un `ArrayBuffer`, asi que
 * este es el tipo real del valor y el pelado era el que decia de mas. Es tambien la unica
 * salida que respeta el "cero `any`, cero `@ts-ignore`" del repo.
 *
 * `binsToBars` sigue recibiendo el `Uint8Array` ancho a proposito: solo lee, asi que no
 * tiene por que rechazar un buffer compartido. El estrechamiento es del que llama a la
 * API del navegador, no del que consume los numeros.
 */
let freqBuf: Uint8Array<ArrayBuffer> | null = null;

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
export function readSpectrum(): Uint8Array<ArrayBuffer> | null {
  if (!analyser || !ctx || ctx.state !== 'running') return null;
  if (!freqBuf || freqBuf.length !== analyser.frequencyBinCount) {
    freqBuf = new Uint8Array(analyser.frequencyBinCount);
  }
  analyser.getByteFrequencyData(freqBuf);
  return freqBuf;
}

/**
 * Dispara un arpegio contra el singleton, ya mismo.
 *
 * NO es el unico camino de nota a sonido: tick() llama a scheduleVoice() directo,
 * porque collectHits ya devolvio los instantes expandidos y volver a pasar por aca
 * significaria recalcular el espaciado que el scheduler ya aplico.
 *
 * Siguen siendo dos caminos, pero ahora comparten tambien el RITMO, no solo el
 * timbre: el paso del arpegio, la duracion de la nota y su release salen de
 * intervalDuration con el bpm de este modulo, aca y en tick(). Antes tambien coincidian, pero por
 * copiar el mismo numero fijo en segundos —uno leia la constante y el otro la
 * recibia dentro del Job—, y ese numero ignoraba el tempo: eran dos lugares que
 * alguien tenia que mantener iguales. Hoy es una regla sola y sigue al bpm.
 *
 * Lo que sigue SIN unificar es COMO se expande el arpegio: un cambio en la linea
 * de abajo no llega al loop, igual que un cambio en collectHits no llega aca.
 * Cambiar el timbre en DEFAULT_VOICE si alcanza para los dos.
 */
export function playNotes(notes: number[]): void {
  const c = audio();
  if (!c || !master) return;
  const start = c.currentTime + PLAY_DELAY;
  const interval = intervalDuration(bpm);
  const dur = NOTE_INTERVALS * interval;
  const rel = RELEASE_INTERVALS * interval;
  notes.forEach((m, i) => scheduleVoice(c, master!, midiToHz(m), start + i * interval, dur, rel));
}

/** Dispara ya, reanudando el contexto. Debe llamarse desde un gesto del usuario. */
export function playNow(notes: number[]): void {
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  playNotes(notes);
}

// —— reloj ——

/**
 * El recorrido que esta sonando y el que va a sonar cuando este cierre su ciclo.
 *
 * Dos y no una: colocar o quitar una pieza no interrumpe lo que suena (D5). El
 * cambio de una por otra lo hace `collectWindow`, al cerrar el ciclo.
 */
let active: Sequence = { steps: [], clicks: [], length: 0 };
let pending: Sequence | null = null;
const clock: ClockState = { origin: 0, scheduledUntil: 0 };
let timer: number | null = null;
let bpm = DEFAULT_BPM;

export const setBpm = (v: number): void => { bpm = v; };

/**
 * Si los clicks MUDOS del recorrido suenan. Es MEZCLA, no modelo.
 *
 * Vive aca y no en la secuencia por eso: apagarlos no cambia el recorrido —los cruces
 * siguen en la `Sequence` y `collectHits` los sigue emitiendo—, solo deja de
 * cablearlos a sonido en `tick()`. Filtrar antes obligaria a reconstruir la
 * secuencia para algo que no es una decision del tablero, y ademas haria que el
 * ciclo pareciera distinto segun el volumen.
 *
 * El spec 009 lo dejo previsto en su tabla de riesgos —"es un parametro suelto: si
 * molesta, se baja o se apaga sin tocar el modelo"— y salio de escuchar: los clicks
 * de un salto largo se acumulan y tapan la frase.
 *
 * **Solo los mudos** (D6 del spec 011). El cruce por celda ocupada suena la nota de esa
 * celda, y eso es MODELO: es la pieza pisada contestando, no un adorno de mezcla. Por
 * eso `tick()` lo despacha por su propia rama del `kind` y este interruptor no lo toca
 * — apagarlo dejaria el recorrido diciendo que cruzo por el vacio donde cruzo por una
 * pieza. Es tambien la razon por la que `HIT` tiene tres claves y no dos con un campo
 * opcional: sin discriminante, esta funcion no tendria a quien apagar.
 */
let clicksAudible = true;
export const setClicksAudible = (v: boolean): void => { clicksAudible = v; };

/**
 * Encola el recorrido nuevo. NO toca lo que esta sonando: entra en vigencia recien
 * al cerrar el ciclo activo, que es lo que permite que el circuito se reordene
 * entero sin que el patron salte a mitad de frase (D5).
 *
 * El precio esta medido y es la decision mas cara del spec 009: con 8 piezas a 110
 * bpm el ciclo dura 7,5 s, asi que una pieza recien colocada puede tardar eso en
 * escucharse dentro del loop. Lo que si suena al instante es su arpegio, por el otro
 * camino a sonido (`playNotes`).
 *
 * Solo se guarda la ultima: dos cambios antes del cierre valen por uno, porque lo que
 * se encola es el recorrido COMPLETO y no un delta.
 */
export function setSequence(next: Sequence): void { pending = next; }

/**
 * Expuesto para verificacion manual desde la consola: reemplaza a `jobCount()`, que
 * era la forma de mirar el motor sin oirlo y que este spec borro junto con los jobs.
 * Informa la secuencia ACTIVA —la que esta sonando—, no la pendiente: preguntarle al
 * motor que agendo y que le contesten lo que todavia no agendo seria peor que no
 * tener la funcion.
 */
// `clicks` y `crosses` por separado desde el spec 011: el campo `clicks` de la
// `Sequence` mezcla las dos cosas, pero el motor las distingue —una se apaga con
// `setClicksAudible` y la otra no—, y esta funcion existe para mirar el motor sin
// oirlo. Un solo numero obligaria a oir cual es cual, que es lo que no se puede.
export const sequenceInfo = (): { steps: number; clicks: number; crosses: number; length: number } => ({
  steps: active.steps.length,
  clicks: active.clicks.filter((c) => c.note === undefined).length,
  crosses: active.clicks.filter((c) => c.note !== undefined).length,
  length: active.length,
});

export const clockRunning = (): boolean => timer !== null;

/**
 * Cuantas veces el motor puso en vigencia una secuencia nueva desde que carga el modulo.
 *
 * Es lo unico que sabe el INSTANTE exacto en que el ciclo nuevo empezo a sonar. La UI
 * tiene el par activa/pendiente del dominio (`components/route-source.ts`) pero no puede
 * derivar el borde: el swap lo decide `collectWindow` dentro del lookahead, medio
 * intervalo antes del cierre, y ninguna cuenta sobre `placed` lo ve venir.
 *
 * Arranca en 0 y NO se resetea en stopClock/startClock: pausar no cambia que ciclo esta
 * en vigencia, asi que resetear haria creer a la UI que hubo un swap que no hubo.
 */
let cycleGen = 0;
export const cycleGeneration = (): number => cycleGen;

/**
 * En que intervalo del ciclo esta la cabeza lectora, o null si no hay nada que marcar.
 *
 * Devuelve null en pausa, sin contexto, con el contexto que no esta corriendo, con la
 * secuencia activa vacia y ANTES de que la activa empiece a sonar (ver abajo). Es
 * informacion y no una falla, igual que `readSpectrum()` en reposo: "no hay cabeza" y
 * "la cabeza esta en 0" se dibujan distinto.
 *
 * Lee `ctx` y no `audio()` por el mismo motivo que readSpectrum: el llamador previsto es
 * un loop de dibujo y crear el AudioContext desde ahi seria hacerlo sin gesto del usuario.
 *
 * Mira la secuencia ACTIVA, no la pendiente: la cabeza tiene que recorrer lo que suena.
 * Que la UI dibuje el circuito correcto abajo es problema de `components/route-source.ts`.
 *
 * ## `now < origin` es "todavia no empezo", y ahi no hay nada que dibujar
 *
 * `collectWindow` pone la pendiente en vigencia DENTRO del lookahead y deja `origin` en
 * el borde, que en ese momento es futuro: medido, hasta 82 ms a 110 bpm, mas la latencia
 * de salida. Durante esa ventana la secuencia activa ya es la nueva pero lo que se
 * escucha sigue siendo la cola de la vieja, que quedo agendada hasta medio intervalo
 * antes del borde. Lo mismo pasa en el primer arranque, con los 50 ms de
 * `CLOCK_START_DELAY`.
 *
 * Sin este corte, `offsetAt` contesta —correctamente, como funcion total— la COLA del
 * ciclo nuevo, o sea `ciclo - 1`. Y ese numero, que es el MAXIMO posible, destapaba de
 * un saque las cinco celdas del velo de `Playhead.tsx`: el estreno celda por celda no se
 * veia nunca, ni al colocar con el ciclo andando ni al apretar play. Es el bug que el
 * test «el swap deja `origin` en el FUTURO» de `scheduler.test.ts` deja clavado.
 *
 * El precio es que la cabeza se apaga esa ventana en cada swap. Es lo correcto: la ruta
 * vieja ya no esta y la nueva todavia no empezo, asi que cualquier celda que se dibujara
 * ahi seria mentira.
 */
export function playheadOffset(): number | null {
  if (timer === null || !ctx || ctx.state !== 'running') return null;
  if (active.length <= 0) return null;
  const now = ctx.currentTime - outputLatency(ctx);
  if (now < clock.origin) return null;
  return offsetAt(now, clock.origin, intervalDuration(bpm), active.length);
}

/**
 * Cuanto tarda en oirse lo que se agenda en `currentTime`. Sin restarlo, la cabeza va
 * sistematicamente adelantada y en un instrumento eso se percibe como que la imagen miente.
 *
 * La cadena `outputLatency` → `baseLatency` → 0 NO es redundante aunque el tipo diga que
 * si: `lib.dom.d.ts` declara `outputLatency` como `number` no opcional, pero Firefox no lo
 * implementa y ahi la propiedad llega `undefined`. Por eso las dos lecturas se tipan a mano
 * como `number | undefined` en vez de taparse con un `any` o un `@ts-ignore`, que ademas el
 * repo prohibe: el fallback tiene que sobrevivir a que TypeScript lo crea innecesario.
 *
 * No tiene test: los tests corren contra node-web-audio-api, donde estos numeros no
 * describen ninguna salida real. Se verifica en el navegador y a oido.
 */
function outputLatency(c: AudioContext): number {
  const out: number | undefined = c.outputLatency;
  if (typeof out === 'number' && Number.isFinite(out)) return out;
  const base: number | undefined = c.baseLatency;
  if (typeof base === 'number' && Number.isFinite(base)) return base;
  return 0;
}

function tick(): void {
  const c = audio();
  if (!c || !master) return;
  // El bpm no cambia dentro de la vuelta, asi que la duracion y el release salen una
  // sola vez y todas las notas de esta ventana quedan medidas contra el mismo tempo.
  const interval = intervalDuration(bpm);
  const dur = NOTE_INTERVALS * interval;
  const rel = RELEASE_INTERVALS * interval;
  // El cruce con altura comparte el release con la nota —lo que lo hace floritura es el
  // cuerpo mas corto y la amplitud mas baja, no otro timbre—, asi que solo su `dur` es
  // propio. Ver GRACE_INTERVALS: por debajo de 0,75 la envolvente se desarma al tempo
  // maximo del instrumento.
  const grace = GRACE_INTERVALS * interval;
  // Toda la decision —incluido el swap al cierre del ciclo— vive en el scheduler,
  // que es testeable; aca queda el cableado a sonido, que sin AudioContext no se
  // puede correr. Ver el docblock de collectWindow.
  const w = collectWindow(c.currentTime, LOOKAHEAD, bpm, active, pending, clock);
  // Identidad de referencia y no comparacion de contenido: `collectWindow` devuelve la
  // MISMA referencia cuando no hubo swap y la de la pendiente cuando si, asi que un
  // `!==` cubre sus DOS ramas —la del borde de ciclo y la de `vigente.length <= 0`— sin
  // que el scheduler tenga que enterarse de que alguien cuenta.
  //
  // Que cuente tambien la segunda importa mas de lo que parece: el primer arranque pasa
  // siempre por ahi —active vacia, reloj recien largado—, y si no subiera, la cabeza no
  // apareceria en el primer ciclo y si en todos los siguientes. Es un sintoma raro de
  // diagnosticar despues.
  if (w.active !== active) cycleGen++;
  active = w.active;
  pending = w.pending;
  // Tres clases y tres ramas (AC13 del spec 011). El cruce con altura vuelve a pasar
  // por `scheduleVoice` y no por una funcion nueva: es una nota, con otros dos numeros.
  // Y no lo mira `clicksAudible`, que apaga solo la rama muda (D6).
  for (const hit of w.hits) {
    if (hit.kind === HIT.note) scheduleVoice(c, master, hit.hz, hit.at, dur, rel);
    else if (hit.kind === HIT.cross) scheduleVoice(c, master, hit.hz, hit.at, grace, rel, GRACE_VELOCITY);
    else if (clicksAudible) scheduleClick(c, master, hit.at);
  }
}

export function startClock(): void {
  if (timer !== null) return;
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  clock.origin = c.currentTime + CLOCK_START_DELAY;
  // Estrictamente ANTES de origin: firstOnsetAfter devuelve el primer onset
  // POSTERIOR a lo ya emitido, asi que con scheduledUntil = origin el primer onset
  // del ciclo 0 se saltearia y el primer sonido llegaria un ciclo tarde — que desde
  // el spec 009 son 7,5 s con 8 piezas, no un compas. Es la misma trampa que vuelve
  // a aparecer en el swap de collectWindow.
  clock.scheduledUntil = c.currentTime;
  timer = window.setInterval(tick, TICK_MS);
}

export function stopClock(): void {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
}

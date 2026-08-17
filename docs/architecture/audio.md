# Capa de Audio

El motor vive en `src/audio/` y está construido directamente sobre Web Audio, sin librerías. Es la
parte del código con más decisiones no obvias.

## El grafo

```
scheduleVoice()  ──┐
   osc → env       │
                   ├──→  master (gain 0.3)  ──→  analyser  ──→  ctx.destination
scheduleVoice()  ──┘                                 ↓
   osc → env                                  readSpectrum() → canvas (rAF)
```

Una voz por nota, creada y descartada. El `master` existe para tener un punto único de volumen y de
inserción: el `AnalyserNode` del
[spec 003](../../specs/003-visualizacion-de-la-senal-con-analysernode/spec.md) entra ahí.

## Los archivos de la capa

| Archivo | Qué hace | Cómo obtiene el contexto |
|---|---|---|
| **`voice.ts`** | `midiToHz`, `scheduleVoice` | por parámetro |
| **`scheduler.ts`** | `collectHits` — decide qué suena y cuándo | por parámetro |
| **`engine.ts`** | singletons, `playNow`, `startClock`, jobs | **es** el dueño del singleton |
| **`spectrum.ts`** | `binsToBars` — de bins de la FFT a alturas de barra | no lo toca: es puro |

Los tres primeros son el motor; `spectrum.ts` es el mapeo puro que se separó del `AnalyserNode` para
poder testearlo — [más abajo](#por-qué-el-mapeo-binsbarras-vive-aparte).

**`voice.ts` y `scheduler.ts` no pueden tocar el singleton**, y no por disciplina: el singleton vive en
`engine.ts` y ellos no lo importan. Eso es lo que permite renderizarlos con un `OfflineAudioContext` en
los tests, y es la razón por la que el audio de este proyecto es verificable.

Hasta el spec 005 los tres bloques del motor eran secciones de un mismo archivo y el invariante lo sostenía un
comentario: nada estructural impedía que `scheduleVoice` llamara a `audio()` y el audio dejara de ser
testeable. Ahora lo sostiene el grafo de imports, y el override del linter
([conventions.md](../guides/conventions.md)) impide además que la capa mire al dominio o a la UI.

Efecto lateral: se puede importar `scheduler.ts` **sin** arrastrar el módulo de los singletons a un
proceso de node.

Los valores fijos de cada capa viven en `audio/constants/` y los tipos en `audio/types/`, con el nombre
de su módulo. Ahí está, por ejemplo, la duración de la nota: `NOTE_INTERVALS` la fija en intervalos, no
en segundos, y `scheduleVoice` no tiene default para `dur` —un default fijo sería una constante que ya
no puede ser constante, porque la duración depende del tempo—, así que los dos llamadores (`tick` y
`playNotes`) calculan `NOTE_INTERVALS * intervalDuration(bpm)` en cada llamada.

## Síntesis

```ts
env.gain.setValueAtTime(0, at);                              // ancla
env.gain.linearRampToValueAtTime(vel, at + attack);
env.gain.linearRampToValueAtTime(vel * sustain, at + attack + decay);
env.gain.setValueAtTime(vel * sustain, at + dur);
env.gain.linearRampToValueAtTime(0, at + dur + release);
```

Dos detalles que parecen redundantes y no lo son:

- **El `setValueAtTime(0, at)` inicial.** Las rampas de Web Audio interpolan desde el *último evento
  agendado*, no desde cero. Sin ese ancla, la rampa de ataque arranca en el valor que haya quedado de
  una nota anterior y se oye un click.
- **Rampas lineales, no exponenciales.** `exponentialRampToValueAtTime` lanza si el target es `0`, así
  que para el release habría que rampar a un épsilon y cortar. La lineal es correcta y suficiente.

Las voces son *fire-and-forget*: `osc.onended` desconecta los nodos. Los `OscillatorNode` son de un
solo uso por diseño de la API; no hay pool ni voice stealing, y a cinco notas por pieza no hace falta.

## Scheduler con lookahead

`setTimeout` tiene jitter de decenas de milisegundos. El reloj de audio
(`AudioContext.currentTime`) es preciso a nivel de sample, pero no se puede "esperar" sobre él.

La solución es el patrón de *A Tale of Two Clocks*: un temporizador grueso que despierta cada **25 ms**
y agenda todo lo que caiga en los próximos **100 ms**, con tiempos absolutos del reloj de audio.

**El temporizador no dispara notas: decide cuándo mirar.** Por eso su jitter no se oye.

### El reloj es un origen, no un cursor

El estado del reloj son dos escalares, y ninguno es "el próximo compás":

```ts
export interface ClockState {
  origin: number;          // instante del ciclo 0 en el reloj del contexto
  scheduledUntil: number;  // hasta dónde ya se emitieron onsets
}
```

`ClockState` no cambió con el spec 009 — sigue siendo dos escalares. Lo que cambió es el período: los
onsets se resuelven **en forma cerrada**, sin avanzar un cursor, pero la unidad pasó del compás al
**ciclo** del recorrido:

```
onset(k) = origin + (k × ciclo + offset + j) × intervalo
```

con `offset` el desplazamiento entero del paso dentro del ciclo (en intervalos) y `j` el índice de la
nota dentro de la pieza. Detalle de cómo se arma en
[#el-recorrido-en-el-scheduler](#el-recorrido-en-el-scheduler).

```ts
const from = Math.max(state.scheduledUntil, fromTime);
if (from >= until) return out;                    // ventana ya cubierta
for (const step of sequence.steps) {
  for (let at = firstOnsetAfter(from, state.origin, ciclo, step.offset / sequence.length); at <= until; at += ciclo) { … }
}
state.scheduledUntil = until;
```

Tres propiedades que salen de esa forma, y que hay que preservar:

- **`scheduledUntil` es lo que evita la re-emisión.** Los ticks son de 25 ms y el horizonte de 100 ms:
  sin él, cada onset saldría cuatro veces. Es un escalar compartido, no estado por paso.
- **Los ciclos perdidos se saltean, no se recuperan.** Cuando la pestaña estuvo oculta el reloj de
  audio siguió corriendo y `scheduledUntil` quedó atrás; `Math.max(…, fromTime)` descarta el hueco. No
  hay bucle de recuperación que acotar, porque saltear 10 ciclos cuesta lo mismo que saltear 1. Esto
  **reemplaza** a la guarda `if (state.nextBar < fromTime)` del spec 002.
- **Nunca hay más de `horizon` de *onsets* comprometidos**, con cualquier tamaño de ciclo. Es lo que
  hace que quitar una pieza la calle rápido; emitir un ciclo entero de una lo dejaría sonando hasta
  8,98 s con 10 piezas a 110 bpm (`research.md` del spec 009, §4). El límite es sobre el **onset**, no
  sobre la última nota: el arpegio se expande después del onset y esa cola siempre estuvo fuera del
  horizonte. Desde el spec 008 la cola mide `compás / 4` más la nota y su release, o sea 1.37 s a 60 bpm
  y 0.59 s a 160.

  **Ojo con leer esto como "quitar una pieza la calla en 100 ms": desde el spec 009 ya no es cierto.**
  El horizonte acota lo que está *comprometido*, no cuándo entra en vigencia el cambio: quitar una pieza
  reemplaza la secuencia **pendiente**, y la pendiente entra recién al cerrar el ciclo activo (D5). Con 8
  piezas a 110 bpm eso son hasta 7,5 s. Lo que el horizonte sigue garantizando es que **pausar** corta en
  100 ms más la cola, porque ahí se frena el temporizador y no hay ciclo que esperar.

`firstOnsetAfter` usa `floor(x) + 1` y **no** `ceil(x)`: se quiere el primer onset *estrictamente*
posterior a lo ya emitido. Con `ceil`, un onset que cae exacto en el borde de una ventana saldría dos
veces — al cerrar una ventana y al abrir la siguiente.

`startClock` deja `scheduledUntil = currentTime` y `origin = currentTime + 0.05`, en ese orden de
magnitud: **`scheduledUntil` tiene que quedar estrictamente antes de `origin`**, o el primer onset del
ciclo 0 se saltea y el primer sonido llega un ciclo tarde. Es la misma trampa que reaparece en el swap
de secuencia al cerrar un ciclo — ver [más abajo](#el-swap-en-el-cierre-de-ciclo).

## El recorrido en el scheduler

`domain/sequence.ts` arma el circuito y los offsets; el motor no recalcula ni reordena nada, solo lee
lo que le entregan. `App.tsx` llama a `buildSequence(placed)` y proyecta el resultado a la `Sequence`
del motor, que **no lleva celdas**:

```ts
// audio/types/scheduler.types.ts
export interface Sequence {
  steps: { offset: number; notes: number[] }[];   // sin pieceId: el motor no tiene a quién devolvérselo
  clicks: { offset: number }[];                    // sin cell: para sonar solo hace falta contar
  length: number;                                  // el ciclo, en intervalos
}
```

El click no tiene altura y suena igual en cualquier celda (ver [más abajo](#el-click)), así que la
celda no es información que el motor pueda usar — y no puede importar `Cell` del dominio ni con
`import type`, porque `audio/` y `domain/` son hermanos sin aristas entre ellos. `setSequence(next)`
reemplaza a `addJob`/`removeJob`/`clearJobs`; `sequenceInfo()` reemplaza a `jobCount()` como receta de
verificación en el navegador — ver [más abajo](#cómo-verificar-el-audio).

### El período pasa del compás al ciclo

`firstOnsetAfter` **no cambia ni una línea** — sigue resolviendo la progresión en forma cerrada (ver
[arriba](#el-reloj-es-un-origen-no-un-cursor)). Lo que cambia es qué se le pasa: el período pasa a ser
el ciclo entero (`sequence.length * intervalDuration(bpm)`) y la fase de cada paso es
`offset / sequence.length`, en vez de la columna del ancla. Los clicks son offsets sueltos sin notas:
mismo `firstOnsetAfter`, sin expansión de arpegio.

### El swap en el cierre de ciclo

Colocar o quitar una pieza puede reordenar el circuito entero (D1 del spec 009) — el motor no puede
aplicar ese cambio a mitad de ciclo sin que el patrón salte. `setSequence(next)` guarda `next` como
**pendiente** y no toca la secuencia **activa**; `tick()`, antes de recolectar hits, revisa si el reloj
cruzó el borde del ciclo: si lo cruzó y hay pendiente, la activa pasa a ser la pendiente y ese borde
pasa a ser el nuevo `origin`.

**En ese swap hay que bajar `scheduledUntil` a estrictamente antes del nuevo `origin`.** Es la misma
trampa que `startClock` ya evita (ver arriba) y con el mismo síntoma: el horizonte es de 100 ms y el
borde se detecta cada 25 ms, así que al cruzarlo `scheduledUntil` ya quedó **adelante** del borde; si se
lo deja quieto, el primer onset del ciclo nuevo cae antes de donde `firstOnsetAfter` empieza a buscar y
se pierde en silencio, sin ningún error.

Si la secuencia activa está vacía, la pendiente entra en vigor **ya** — si no, la primera pieza jamás
sonaría, porque no hay ciclo que cerrar. Y con `sequence.length === 0` no hay borde que cruzar: la
guarda es explícita, porque calcular un período de longitud 0 divide por cero o da el borde por cruzado
en cada tick — es el estado real de "se quitó la última pieza", no un caso teórico.

**El precio es la latencia, y es una decisión, no un bug.** Colocar una pieza puede tardar hasta un
ciclo entero en escucharse: 7,5 s con 8 piezas a 110 bpm, 4,4 s con 4 (`research.md` del spec 009, §4).
Es el costo de que el circuito se pueda reordenar entero sin que el patrón salte a mitad de frase (D5).
Si al usarlo resulta intolerable, la salida no es aplicar los cambios en caliente —eso reordena el
patrón a mitad de frase— sino aplicarlos en el próximo cruce por la pieza afectada, que es una regla
más fina y su propio cambio.

### El click

Un salto de `d` celdas entre la salida de una pieza y la entrada de la siguiente produce `d − 1`
clicks, uno por celda intermedia de `pathBetween` — sin altura, a volumen bajo (`CLICK_VELOCITY`,
`CLICK_SECONDS` en `audio/constants/`), para que no compita armónicamente con las notas.
`scheduleClick` en `voice.ts` es la otra forma de sonido de la capa, aparte de `scheduleVoice`. Con 8
piezas un ciclo tiene ~15 clicks contra 40 notas (`research.md` del spec 009, §4) — sin el click, un
salto de varias celdas es un silencio mudo de casi un segundo, y el recorrido —que es todo el modelo—
se vuelve inaudible.

**Se pueden apagar, y el interruptor es de mezcla y no del modelo.** `setClicksAudible(false)` —el
toggle «Clicks» de la paleta— deja de cablearlos a sonido en `tick()`; la `Sequence` sigue teniendo sus
clicks y `collectHits` los sigue emitiendo. Filtrarlos antes obligaría a reconstruir la secuencia por
algo que no es una decisión del tablero, y haría que el ciclo pareciera distinto según el volumen.

El interruptor existe porque **el camino cruza celdas ocupadas**: `pathBetween` es el camino mínimo
ignorando obstáculos, así que un click puede caer encima de una pieza. No es un caso raro — en el
tablero lleno de 12 piezas caen ahí los 21 clicks del ciclo. Esquivar las piezas es un spec propio
(BFS sobre celdas libres, con el caso "no hay camino"), y hasta entonces poder apagarlos es la
mitigación que el spec 009 dejó prevista en su tabla de riesgos.

## Reconciliación de loops

Un único `useEffect` en `App.tsx` observa `[placed, playing]` y le entrega al motor la secuencia donde
debe estar. Los handlers solo cambian estado.

```ts
useEffect(() => {
  setSequence(playing ? buildSequence(placed) : { steps: [], clicks: [], length: 0 });
}, [placed, playing]);
```

Antes este efecto iteraba piezas y armaba un job por cada una; hoy es **una sola llamada**:
`buildSequence` (`domain/sequence.ts`) arma el circuito entero —orden, offsets y clicks— de una vez, y
`App.tsx` sigue siendo el único puente entre las dos capas, ahora más chico que antes.

**Por qué reemplazar la secuencia entera es seguro acá**, cuando con Tone habría reiniciado la fase de
cada loop: `setSequence` no agenda nada, solo deja la secuencia nueva como **pendiente** — `tick()` la
adopta recién al cerrar el ciclo (D5, ver
[#el-swap-en-el-cierre-de-ciclo](#el-swap-en-el-cierre-de-ciclo)). Con Tone cada job cargaba su propio
ID de evento del Transport y perderlo dejaba loops huérfanos — de hecho ese fue un bug real. Acá no hay
evento que perder: la secuencia es un dato que `tick()` lee, no algo agendado.

Y sigue siendo determinista porque **`buildSequence` se deriva del tablero y no del reloj**:
reconstruir la secuencia en cada reconciliación da siempre el mismo circuito para el mismo conjunto de
piezas. Si el orden se hubiera derivado del momento de colocación —lo que hacía Tone, por accidente—
este patrón lo habría destruido en cada reconciliación.

Tampoco hace falta flag de cancelación: `setSequence` es sincrónica, así que no hay promesa que pueda
resolver después de que el efecto se limpió.

## `AudioContext` y el gesto del usuario

El contexto vive en un singleton de módulo —hay uno por pestaña, no uno por componente— y se crea
perezosamente:

```ts
if (c.state === 'suspended') void c.resume();
```

Los navegadores exigen que el contexto se reanude desde un handler originado por el usuario. Como
`playNow` y `startClock` salen de clicks, la cadena de gesto se preserva.

**Esto se rompe fácil**: cualquier feature que quiera sonar sin click previo —un preview al pasar el
mouse, una nota al cambiar de pieza con el teclado— va a quedar muda hasta que el usuario haga click en
algo. Es una restricción del navegador, no del código.

`audio()` devuelve `null` si Web Audio no está disponible; la app queda usable pero muda, y cada
llamador tiene que chequearlo.

## Los dos caminos de reproducción

Hay **dos** funciones que producen sonido, y conviene saber cuál es cuál:

| Camino | Quién lo usa | Cómo llega a `scheduleVoice` |
|---|---|---|
| `playNotes()` | `playNow()`, al colocar una pieza | expande el arpegio y agenda |
| `tick()` | el loop por ciclo del recorrido | `collectHits()` ya devolvió los instantes; agenda directo |

**No están unificados en una sola función, y es a propósito**: `collectHits` tiene que ser pura para
poder testear el scheduler, así que devuelve instantes en vez de producir sonido. Volver a pasar por
`playNotes` obligaría a recalcular el espaciado que el scheduler ya aplicó.

Lo que **sí** está unificado es lo que importa para cambiar el sonido:

- `scheduleVoice()` — la única función que crea un oscilador.
- `DEFAULT_VOICE` — el timbre y la ADSR.
- `intervalDuration(bpm)` — el espaciado, definida sobre `barDuration` para que exista un solo lugar
  donde el compás se convierte en segundos.
- `NOTE_INTERVALS` — la duración de la nota, medida en intervalos y no en segundos absolutos.

**La consecuencia práctica:** tocar el timbre en `DEFAULT_VOICE` alcanza para los dos caminos, y
también alcanza tocar `intervalDuration` para cambiar el ritmo: las dos expansiones —la de `playNotes`
y la que arma `collectHits`— salen de la misma función. Siguen siendo dos caminos —`playNotes` expande
el arpegio, `tick` recibe de `collectHits` los instantes ya expandidos—, pero lo que los separa se
achicó a la mecánica de agendado, no al espaciado.

## Análisis de la señal

El `AnalyserNode` va **en serie**, entre el master y el destino, no colgado de una rama paralela: así
ve exactamente la mezcla que sale por los parlantes. Es transparente —no altera la señal que lo
atraviesa—, de modo que insertarlo no cambia cómo suena nada.

```ts
analyser.fftSize = FFT_SIZE;                    // 256 → 128 bins
analyser.smoothingTimeConstant = SMOOTHING;     // 0.8
master.connect(analyser);
analyser.connect(ctx.destination);
```

Que sea transparente no es una creencia: `__tests__/integration.test.ts` renderiza la misma voz con y
sin el nodo en el camino y compara **muestra por muestra**. Es la única parte del análisis que se puede afirmar
offline.

Los dos valores vienen de `LiveWaveform` de `@elevenlabs/ui`, no de la intuición: 128 bins a 48 kHz dan
~187 Hz por bin —suficiente para visualizar, insuficiente para afinar— y sin suavizado temporal la
animación tiembla.

`readSpectrum()` devuelve las magnitudes 0–255 del último bloque, o `null` si todavía no hay señal que
mirar (sin contexto, o suspendido). **Es información, no una falla**: un array de ceros y "no hay
audio" se dibujan distinto, y devolver `null` también evita que el loop de dibujo cree el
`AudioContext` sin gesto del usuario.

**El buffer que devuelve es reusado** entre llamadas para no asignar 60 veces por segundo. Quien lo
guarde va a verlo cambiar por debajo; el consumidor previsto lo lee y lo descarta en el mismo cuadro.

### Por qué el mapeo bins→barras vive aparte

En `src/audio/spectrum.ts`, y no dentro del nodo ni del componente, por una restricción medida:
**`AnalyserNode` no rinde nada útil en un `OfflineAudioContext`**. El render offline corre más rápido
que tiempo real y no tiene cuadros; `getByteFrequencyData` devuelve el estado del último bloque
procesado. Los tests del estilo "renderizar y afirmar sobre el espectro" que sí funcionan para la
síntesis, acá no existen.

La respuesta no fue renunciar a testear sino mover la lógica adonde sí se puede: `binsToBars(bins,
barCount)` toma un `Uint8Array` y devuelve alturas 0–1. Entrada a mano, salida determinista, sin tocar
Web Audio. El nodo queda reducido a una fuente de datos sin test propio.

Dos decisiones dentro del mapeo:

- **Bandas logarítmicas, no lineales.** Los bins están espaciados linealmente en frecuencia pero la
  percepción no: con reparto lineal las dos primeras barras se comen toda la información musical y el
  resto del canvas muestra agudos vacíos.
- **Pico por banda, no promedio.** Promediar una banda ancha aplana los transitorios, que es justo lo
  que hay que ver en un instrumento percusivo.

El canvas (`src/components/Spectrum.tsx`) dibuja imperativamente dentro de `requestAnimationFrame` y
**no pasa por estado de React**: 60 renders por segundo para pintar barras competirían con el
re-render del tablero. React monta el `<canvas>` y arranca/frena el loop; nada más.

## Cómo verificar el audio

### En tests: `OfflineAudioContext`

Renderiza a un `AudioBuffer` en memoria, más rápido que tiempo real y de forma determinística. Los
helpers están en `src/audio/__tests__/test-context.ts`:

| Helper | Para qué |
|---|---|
| `offline(secs)` | contexto de render |
| `zeroCrossHz(d, from, to)` | frecuencia por cruces por cero **interpolados** |
| `peakNear(d, t)` | pico en una ventana |
| `firstAudible(d)` | instante de la primera muestra audible |
| `detectOnsets(d)` | onsets por seguidor de envolvente con histéresis |

Dos trampas que costaron un ciclo de tests cada una:

- **`zeroCrossHz` debe interpolar.** Contar cruces y dividir por la duración de la ventana cuantiza:
  en 0.1 s el error es de ~5 Hz, suficiente para leer 261.6 Hz como 263.2. Se mide entre el primer y el
  último cruce interpolados.
- **`detectOnsets` no puede ser un umbral sobre la muestra cruda.** Cada cruce por cero de la onda
  parece silencio: medido, 21 falsos onsets para 3 notas. Hace falta envolvente por ventanas de 5 ms
  con dos umbrales (0.05 para disparar, 0.01 para rearmar).

### En el navegador

```js
const m = await import('/src/audio/engine.ts');   // en dev, mismo singleton
m.sequenceInfo();                                  // { steps, clicks, length } de la secuencia activa
m.clockRunning();                                  // reloj
m.audio().state;                                   // 'running' | 'suspended'
m.readSpectrum();                                  // null en reposo; Uint8Array(128) sonando
```

Para comprobar que el scheduler realmente dispara, contar osciladores creados:

```js
const c = m.audio(), orig = c.createOscillator.bind(c);
let n = 0; c.createOscillator = () => { n++; return orig(); };
// esperar N segundos… n ≈ (segundos / duraciónDelCiclo) × notas del ciclo
// duraciónDelCiclo = sequenceInfo().length * intervalDuration(bpm)
// notas del ciclo = 5 × sequenceInfo().steps
```

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
  origin: number;          // instante del compás 0 en el reloj del contexto
  scheduledUntil: number;  // hasta dónde ya se emitieron onsets
}
```

Los onsets de un job son una progresión aritmética que se resuelve **en forma cerrada**, sin avanzar un
cursor:

```
onset(k) = origin + (k + phase) * bar
```

```ts
const from = Math.max(state.scheduledUntil, fromTime);
if (from >= until) return out;                    // ventana ya cubierta
for (const job of jobs) {
  for (let at = firstOnsetAfter(from, state.origin, bar, job.phase); at <= until; at += bar) { … }
}
state.scheduledUntil = until;
```

Tres propiedades que salen de esa forma, y que hay que preservar:

- **`scheduledUntil` es lo que evita la re-emisión.** Los ticks son de 25 ms y el horizonte de 100 ms:
  sin él, cada onset saldría cuatro veces. Es un escalar compartido, no estado por job.
- **Los compases perdidos se saltean, no se recuperan.** Cuando la pestaña estuvo oculta el reloj de
  audio siguió corriendo y `scheduledUntil` quedó atrás; `Math.max(…, fromTime)` descarta el hueco. No
  hay bucle de recuperación que acotar, porque saltear 10 compases cuesta lo mismo que saltear 1. Esto
  **reemplaza** a la guarda `if (state.nextBar < fromTime)` del spec 002.
- **Nunca hay más de `horizon` de audio comprometido**, con cualquier `phase`. Es lo que hace que quitar
  una pieza la calle en 100 ms; emitir un compás entero de una la dejaría sonando 2.18 s a 110 bpm.

`firstOnsetAfter` usa `floor(x) + 1` y **no** `ceil(x)`: se quiere el primer onset *estrictamente*
posterior a lo ya emitido. Con `ceil`, un onset que cae exacto en el borde de una ventana saldría dos
veces — al cerrar una ventana y al abrir la siguiente.

`startClock` deja `scheduledUntil = currentTime` y `origin = currentTime + 0.05`, en ese orden de
magnitud: **`scheduledUntil` tiene que quedar estrictamente antes de `origin`**, o el downbeat del
compás 0 se saltea y el primer sonido llega un compás tarde.

## Fase por pieza

`Job.phase` es la posición del job dentro del compás, `0 ≤ phase < 1`. Es **fracción y no segundos**:
así mover el tempo estira el patrón en vez de reordenarlo. `App.tsx` la deriva de la columna de la
celda de agarre (`ax / GRID_W`) — ver
[modelo-musical.md](./modelo-musical.md).

Es un campo **obligatorio, sin default**. Un `phase?: number` dejaría pasar en silencio el caso de
agregar un job y olvidarse la fase, que es exactamente el bug que el campo corrige: antes del spec 004
todas las piezas arrancaban en el mismo sample y agregar la segunda no agregaba una voz, agregaba
volumen.

Medido con `OfflineAudioContext` a 110 bpm, a ganancia unitaria (el master divide por 0.3):

| | pico | onsets detectados |
|---|---|---|
| una pieza | 1.396 | 1 |
| dos piezas a fase 0 y 0 | 2.298 | 1 |
| dos piezas a fase 0 y 0.5 | **1.396** | **2** |
| cuatro piezas a fase 0 | 4.596 | 1 |
| cuatro piezas a fase 0 · 0.25 · 0.5 · 0.75 | **1.749** | 1 |

Desfasar dos piezas deja el pico exactamente en el de una sola. Con cuatro el pico baja un 62 % pero
los onsets vuelven a fusionarse: el arpegio dura 1.07 s y un cuarto de compás 0.545 s, así que se
solapan. **Es el comportamiento deseado** — solaparse desfasadas produce textura, solaparse alineadas
produce volumen — y es la medición que llevó el espaciado del arpegio a unidades musicales:
`intervalDuration(bpm)` se define sobre `barDuration` como `barDuration(bpm) / (BEATS_PER_BAR *
SUBDIVISIONS_PER_BEAT)`, así que a más tempo el arpegio se achica en la misma proporción que el
compás. El arpegio de 5 notas mide siempre `4 × intervalo = compás / 4`: 1,000 s a 60 bpm y 0,375 s a
160 bpm. A 100 bpm el intervalo da 0,15 s — exactamente el `ARPEGGIO_SPREAD` que reemplaza —, así que a
ese tempo el patrón no cambia en absoluto.

## Reconciliación de loops

Un único `useEffect` en `App.tsx` observa `[placed, playing]` y lleva los jobs del motor a donde
deben estar. Los handlers solo cambian estado.

```ts
useEffect(()=>{
  clearJobs();
  if (!playing) return;
  for (const p of placed){
    const [ax] = p.cells[ANCHOR_INDEX[p.piece]];
    addJob({ id: p.id, notes: p.notes, phase: ax / GRID_W });
  }
}, [placed, playing]);
```

**Por qué limpiar y re-agregar es seguro acá**, cuando con Tone habría reiniciado la fase: los jobs son
datos puros que `tick()` lee, no eventos agendados. Con Tone cada job cargaba su propio ID de evento del
Transport y perderlo dejaba loops huérfanos — de hecho ese fue un bug real.

Y sigue siendo seguro con la fase por pieza, porque **`phase` se deriva del tablero y no del reloj**:
re-agregar un job reconstruye exactamente la misma fase. Si la fase se hubiera derivado del momento de
colocación —lo que hacía Tone, por accidente— este patrón la habría destruido en cada reconciliación.

Tampoco hace falta flag de cancelación: `addJob` y `clearJobs` son sincrónicos, así que no hay promesa
que pueda resolver después de que el efecto se limpió.

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
| `tick()` | el loop por compás | `collectHits()` ya devolvió los instantes; agenda directo |

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
m.jobCount();                                      // loops vivos
m.clockRunning();                                  // reloj
m.audio().state;                                   // 'running' | 'suspended'
m.readSpectrum();                                  // null en reposo; Uint8Array(128) sonando
```

Para comprobar que el scheduler realmente dispara, contar osciladores creados:

```js
const c = m.audio(), orig = c.createOscillator.bind(c);
let n = 0; c.createOscillator = () => { n++; return orig(); };
// esperar N segundos…  n ≈ (segundos / duraciónCompás) * notasPorPieza
```

Medido: 10 voces en 5.02 s a 110 bpm con una pieza = exactamente 2 compases × 5 notas.

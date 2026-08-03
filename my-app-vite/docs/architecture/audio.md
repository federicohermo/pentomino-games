# Capa de Audio

El motor vive en `src/audio/engine.ts` y está construido directamente sobre Web Audio, sin librerías.
Es la parte del código con más decisiones no obvias.

## El grafo

```
scheduleVoice()  ──┐
   osc → env       │
                   ├──→  master (gain 0.3)  ──→  ctx.destination
scheduleVoice()  ──┘
   osc → env
```

Una voz por nota, creada y descartada. El `master` existe para tener un punto único de volumen y —a
futuro— de inserción de efectos o de un `AnalyserNode`
([spec 003](../../specs/003-visualizacion-de-la-senal-con-analysernode/spec.md)).

## Las tres capas del módulo

El archivo está ordenado en tres bloques, y el orden importa:

| Bloque | Qué hace | Recibe el contexto |
|---|---|---|
| **1. Síntesis** | `midiToHz`, `scheduleVoice` | por parámetro |
| **2. Scheduler** | `collectHits` — decide qué suena y cuándo | por parámetro |
| **3. App** | singletons, `playNow`, `startClock`, jobs | usa el singleton |

**Los bloques 1 y 2 nunca tocan el singleton.** Es lo que permite renderizarlos con un
`OfflineAudioContext` en los tests, y es la razón por la que el audio de este proyecto es verificable.

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

```ts
if (state.nextBar < fromTime) state.nextBar = fromTime + 0.05;   // recuperación
while (state.nextBar < fromTime + horizon) { … state.nextBar += bar; }
```

La guarda de recuperación evita que, si la pestaña estuvo oculta y el temporizador se estranguló, el
`while` intente recuperar cientos de compases atrasados de golpe. **Solo actúa cuando el reloj ya pasó
el próximo compás**; en marcha normal `nextBar` va por delante y el offset de `0.05` no se aplica.

## Reconciliación de loops

Un único `useEffect` en `App.tsx` observa `[placed, loopPlaced]` y lleva los jobs del motor a donde
deben estar. Los handlers solo cambian estado.

```ts
useEffect(()=>{
  clearJobs();
  if (!loopPlaced) return;
  for (const p of placed) addJob({ id: p.id, notes: p.notes, spread: ARPEGGIO_SPREAD });
}, [placed, loopPlaced]);
```

**Por qué limpiar y re-agregar es seguro acá**, cuando con Tone habría reiniciado la fase: los jobs son
datos puros que `tick()` lee, no eventos agendados. La fase vive en `clock.nextBar`, que es compartido y
no se toca. Con Tone cada job cargaba su propio ID de evento del Transport y perderlo dejaba loops
huérfanos — de hecho ese fue un bug real.

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
- `ARPEGGIO_SPREAD` y `NOTE_DUR` — el espaciado y la duración.

**La consecuencia práctica:** tocar el timbre en `DEFAULT_VOICE` alcanza para los dos caminos, pero
cambiar *cómo se expande un arpegio* dentro de `playNotes` **no afecta al loop**. Ese cambio va en
`collectHits`, o en los dos lugares.

## Cómo verificar el audio

### En tests: `OfflineAudioContext`

Renderiza a un `AudioBuffer` en memoria, más rápido que tiempo real y de forma determinística. Los
helpers están en `src/audio/test-context.ts`:

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
```

Para comprobar que el scheduler realmente dispara, contar osciladores creados:

```js
const c = m.audio(), orig = c.createOscillator.bind(c);
let n = 0; c.createOscillator = () => { n++; return orig(); };
// esperar N segundos…  n ≈ (segundos / duraciónCompás) * notasPorPieza
```

Medido: 10 voces en 5.02 s a 110 bpm con una pieza = exactamente 2 compases × 5 notas.

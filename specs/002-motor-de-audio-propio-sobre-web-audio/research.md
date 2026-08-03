# Research — Motor de audio propio sobre Web Audio

Todo lo de este documento está medido en este repo, no estimado.

## Qué usamos realmente de Tone

Cinco símbolos, sobre una librería de 340 kB:

| Símbolo | Para qué | Equivalente nativo |
|---|---|---|
| `PolySynth(Synth)` | Una voz por nota, polifónica | `OscillatorNode` + `GainNode` con envolvente |
| `triggerAttackRelease(hz, dur, at, vel)` | Disparar una nota en un instante | `osc.start(at)` + rampas en `gain.gain` |
| `Frequency(m,"midi").toFrequency()` | MIDI → Hz | `440 * 2**((m-69)/12)` |
| `Transport` (`bpm`, `start`, `stop`, `scheduleRepeat`, `clear`, `state`) | Loop por compás | Scheduler con lookahead |
| `Tone.start()` / `Tone.now()` | Reanudar contexto / reloj | `ctx.resume()` / `ctx.currentTime` |

## Peso: por qué Tone no se puede achicar

Vite 7 · Rollup, builds en modo lib, minificados:

| Import | Bundle |
|---|---|
| `import { PolySynth, Synth, Frequency, getTransport, start, now } from 'tone'` | **382.98 kB** (gzip 87.42) |
| Imports profundos a `tone/build/esm/…` | **347.87 kB** (gzip 79.06) |

Solo **9%** de diferencia, y los imports profundos apuntan a rutas fuera del mapa `exports` del paquete
(se rompen en cualquier minor).

Causa raíz: **`tone@15.1.22` no declara `sideEffects: false`** en su `package.json`. Sin esa marca
Rollup debe asumir que todo módulo tiene efectos y no puede descartar nada. Importar 6 símbolos
arrastra **962 módulos**.

```
$ node -p "require('./node_modules/tone/package.json').sideEffects"
undefined
```

### Lo que costaría el motor propio

Prototipo funcional escrito para este research —contexto, envolvente ADSR, MIDI→Hz y scheduler con
lookahead— compilado igual:

| | Bundle | gzip |
|---|---|---|
| Motor propio (prototipo completo) | **1.57 kB** | **0.75 kB** |
| Tone | 340.42 kB | 81.24 kB |

**Factor ~217×.** El prototipo cubre los cinco usos de la tabla de arriba.

### Baseline actual del `dist`

```
dist/index.html                 0.74 kB │ gzip:  0.40 kB
dist/assets/index-*.css        12.55 kB │ gzip:  3.46 kB
dist/assets/index-*.js        197.52 kB │ gzip: 62.77 kB   ← React + app
dist/assets/index-*.js        340.42 kB │ gzip: 81.24 kB   ← Tone (chunk diferido)
```

Tone es el **62% del JS servido**. Como se carga con `import()` dinámico, hoy no penaliza el primer
pintado — penaliza el primer click.

## Testabilidad: verificado, no supuesto

La afirmación "se puede testear audio sin oídos" se comprobó ejecutando un render real en el navegador
con `OfflineAudioContext`, que renderiza a un `AudioBuffer` en memoria, más rápido que tiempo real y de
forma determinística.

Se renderizó 1 segundo a 44100 Hz con la envolvente del prototipo (`vel=0.8`, master `0.3`, ataque
0.005 s, decay 0.06 s, sustain 0.5, release 0.12 s) sobre un triángulo de 440 Hz:

| Medición | Resultado | Esperado | |
|---|---|---|---|
| Frecuencia por cruces por cero | **440 Hz** | 440 Hz | exacto |
| Pico en el ataque | **0.2356** | 0.24 (`0.8 × 0.3`) | −1.8% |
| Nivel de sostenido | **0.1188** | 0.12 (`0.8 × 0.5 × 0.3`) | −1.0% |
| Amplitud antes del ataque | **0** | 0 | exacto |
| Amplitud tras el release | **0** | 0 | exacto |

Las desviaciones del 1–2% son de muestreo (el pico real cae entre muestras), no de la envolvente.

**Esto es la base de los criterios de aceptación del spec**: frecuencia, forma de envolvente,
silencio fuera de la nota y posición temporal son todas asertables numéricamente.

> **Aclaración honesta:** Tone **sí** ofrece `Tone.Offline()` y podría testearse también. El punto no
> es que Tone lo impida, sino que la implementación actual no está escrita para eso (singletons de
> módulo, `Tone.now()`, sin inyección del contexto), y adoptarlo dejaría igual los 340 kB.

### El gate ya se ejecutó: pasa

El paso 1 del `plan.md` se corrió durante el review del spec, con `node-web-audio-api@2.1.0` +
`vitest@4.1.10`. **La opción A alcanza**; no hace falta el browser mode.

| Medición | Chrome | Node | Teórico | AC |
|---|---|---|---|---|
| Frecuencia (cruces por cero) | 440 Hz | **440 Hz** | 440 | AC2 ±1 Hz ✅ |
| Pico del ataque | 0.2356 | **0.2351** | 0.24 | AC3 ±5% ✅ |
| Nivel de sostenido | 0.1188 | **0.1197** | 0.12 | AC3 ±5% ✅ |
| Primera muestra no nula | — | **+0.023 ms** | 0 | AC4 ±1 ms ✅ |

Se escribieron y corrieron los cuatro tests propuestos (síntesis, conteo de compases, onsets audibles,
recuperación de throttling): **los cuatro pasan**.

#### Lo que el ejercicio corrigió del spec

Escribir los tests reveló dos cosas que leyendo el plan no se veían:

1. **La detección de onsets no es trivial.** El primer detector —"silencio → señal" sobre la muestra
   cruda— contó **21 onsets para 3 notas**: cada cruce por cero de la onda triangular parece silencio.
   Hace falta un seguidor de envolvente con histéresis, y eso fija la tolerancia de AC5 en ±6 ms (el
   ancho de ventana), no en ±1 ms.
2. **La guarda de recuperación del scheduler solo actúa cuando el reloj ya pasó el próximo compás.**
   El pseudocódigo del plan la describía de forma ambigua y el primer test asumió que el offset de
   0.05 s se aplicaba siempre. Corregido en `plan.md` §3.

## Alineación con lo que ElevenLabs realmente implementa

Consultado vía Context7 sobre `/elevenlabs/packages` y `/elevenlabs/ui`:

| Hallazgo | Fuente |
|---|---|
| El SDK expone `getInputByteFrequencyData()` / `getOutputByteFrequencyData()` → `Uint8Array`, *"focused on 100–8000 Hz"* | `packages/react` — `ConversationControlsValue` |
| Transporte por WebRTC (LiveKit) y WebSocket, formatos `pcm_48000` | `packages/client` — `WebRTCConnection`, `WebSocketConnection` |
| `LiveWaveform` y `BarVisualizer`: canvas + Web Audio, props `fftSize`, `smoothingTimeConstant`, `historySize`, HiDPI, `ResizeObserver`, `requestAnimationFrame`, limpieza al desmontar | `@elevenlabs/ui` |

Dos conclusiones para este spec:

1. **El análisis de frecuencia está en su superficie pública de API y en su librería de componentes.**
   Por eso la visualización con `AnalyserNode` dejó de ser un "seguimiento" vago y pasó a ser el
   [spec 003](../003-visualizacion-de-la-senal-con-analysernode/spec.md).
2. **La síntesis por `AudioWorklet` se evaluó y se descarta.** Su cliente **no sintetiza nada**: usa
   WebRTC para transporte y `AnalyserNode` para visualización. Un procesador DSP muestra a muestra
   impresionaría, pero apunta a un eje que ellos no ejercitan, y agrega riesgo real de bundling. El
   núcleo de este spec —ADSR + scheduler con lookahead— es el correcto.

## Estado actual del código

| Aspecto | Hoy | Archivo |
|---|---|---|
| Carga de Tone | `import()` dinámico en `ensureTone()`, singletons de módulo | `src/App.tsx` |
| Disparo inmediato | `playNotesNow()` — `Tone.now() + i*0.15` | `src/App.tsx` |
| Loop por compás | `Transport.scheduleRepeat(…, "1m")` dentro del efecto de reconciliación | `src/App.tsx` |
| Tempo | `Transport.bpm.value` en `useTransport()` | `src/App.tsx` |
| Arranque/parada | `Transport.start()` / `.stop()` en `toggleTransport()` | `src/App.tsx` |

**Los dos caminos de reproducción están duplicados**: mismo espaciado `0.15 s` y misma duración `"8n"`
escritos dos veces. Ya está anotado como seguimiento en el
[spec 001](../001-notas-por-celda-en-orden-angular/tasks.md); este spec los unifica de manera natural,
porque ambos pasan a llamar a la misma función del motor.

## El scheduler: por qué no alcanza `setTimeout`

`setTimeout`/`setInterval` corren en el hilo principal y su jitter es de decenas de milisegundos —
inaceptable para música. El reloj de audio (`AudioContext.currentTime`) es preciso a nivel de sample
pero no se puede "esperar" sobre él.

El patrón estándar (Chris Wilson, *A Tale of Two Clocks*) combina ambos: un temporizador **grueso** que
despierta cada ~25 ms y agenda con **anticipación** (~100 ms) todo lo que caiga en esa ventana, usando
tiempos absolutos del reloj de audio. El jitter del temporizador deja de importar porque no dispara
notas: solo decide *cuándo mirar*.

Es exactamente lo que `Transport.scheduleRepeat` hace por dentro, y es la competencia que hoy queda
delegada.

## Archivos afectados

| Archivo | Acción |
|---|---|
| `src/audio/engine.ts` | **nuevo** — contexto, voz con envolvente, MIDI→Hz, scheduler |
| `src/audio/engine.test.ts` | **nuevo** — tests con `OfflineAudioContext` |
| `src/App.tsx` | retirar `ensureTone`/`playNotesNow`/`useTransport`; el efecto de reconciliación pasa a hablarle al motor |
| `package.json` | quitar `tone`; agregar Vitest (prerrequisito, compartido con el spec 001) |
| `vite.config.ts` | bloque `test` |
| `docs/architecture/audio.md` | reescribir: ya no describe Tone |
| `CLAUDE.md`, `docs/README.md`, `docs/guides/*` | actualizar stack y referencias |

## Riesgos verificados

1. **`OfflineAudioContext` en jsdom: NO verificado.** El render se comprobó en Chrome real. jsdom no
   implementa Web Audio, así que los tests probablemente necesiten
   [`node-web-audio-api`](https://www.npmjs.com/package/node-web-audio-api) o correr en
   `environment: 'happy-dom'`/browser mode de Vitest. **Es el primer paso del plan**, no un supuesto.
2. **El gesto del usuario sigue siendo obligatorio.** `ctx.resume()` tiene la misma restricción que
   `Tone.start()`. Cambiar de motor no cambia esta política del navegador.
3. **La calidad del sonido va a cambiar.** `Tone.Synth` es un triángulo con envolvente propia; el
   prototipo usa triángulo + ADSR explícita, pero no van a sonar idénticos. Es un cambio audible
   esperado, no una regresión — y en un instrumento, es una oportunidad de diseño sonoro.

## Deuda adyacente (fuera de alcance)

- **`AnalyserNode` para visualización.** Atar la geometría del tablero a la señal real es la extensión
  natural, y barata una vez que el grafo es propio. Su propio spec.
- **Efectos** (filtro, reverb, delay). Ídem.
- **El modelo musical no se toca**: escalas, tónicas y retrógrado quedan exactamente como están.

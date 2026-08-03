# Research — Visualización de la señal con AnalyserNode

## Por qué este spec existe como spec, y no como bullet de seguimiento

Nació como una línea de "seguimiento (no bloquea)" dentro del
[spec 002](../002-motor-de-audio-propio-sobre-web-audio/spec.md). Se promovió tras consultar, vía
Context7, qué implementa realmente ElevenLabs en el navegador.

### Lo que se encontró

| Hallazgo | Fuente |
|---|---|
| El SDK expone `getInputByteFrequencyData()` y `getOutputByteFrequencyData()`, que devuelven `Uint8Array`, *"focused on 100–8000 Hz"* | `@elevenlabs/react` — `ConversationControlsValue` |
| También `getInputVolume()` / `getOutputVolume()`, normalizados 0–1 | ídem |
| `LiveWaveform`: visualizador en canvas, props `fftSize` (256), `smoothingTimeConstant` (0.8), `historySize`, `sensitivity`, `updateRate`, modos `scrolling` / `static` | `@elevenlabs/ui` |
| `BarVisualizer`: análisis de frecuencia en tiempo real, animado con `requestAnimationFrame`, reactivo al estado del agente | `@elevenlabs/ui` |
| Los componentes ajustan por `devicePixelRatio`, usan `ResizeObserver` para el sizing y limpian contextos y streams al desmontar | `@elevenlabs/ui` |
| El transporte es WebRTC (LiveKit) / WebSocket con formatos `pcm_48000` | `@elevenlabs/client` |

### Las dos conclusiones

1. **El análisis de frecuencia no es un adorno: está en su superficie pública de API.**
   `getByteFrequencyData` sobre un `AnalyserNode` es exactamente lo que su SDK expone a los
   consumidores, y su librería de componentes lo empaqueta en dos visualizadores distintos.
2. **La síntesis por `AudioWorklet` se evaluó y se descartó.** Su cliente no sintetiza: usa WebRTC para
   transporte y `AnalyserNode` para visualización. Un procesador DSP muestra a muestra apunta a un eje
   que ellos no ejercitan.

Dicho de otro modo: de todo lo que se podía construir sobre el motor propio, **esto es lo que más se
parece a lo que la industria del audio en el navegador realmente hace**.

## Estado actual

No hay visualización de ninguna clase. El tablero muestra la letra de la pieza en cada celda ocupada
(o su nota, si se implementa antes el
[spec 001](../001-notas-por-celda-en-orden-angular/spec.md)), y nada más.

Tampoco hay `AnalyserNode` en el grafo: hoy el grafo lo arma Tone y no se lo toca.

## Dependencia dura del spec 002

Este spec **no se puede implementar antes** que el 002. Con Tone, el grafo de audio es interno a la
librería y no hay un punto donde insertar un `AnalyserNode` sin pelearse con su API. Con el motor
propio, el nodo maestro es nuestro y conectar el analizador es una línea:

```ts
master.connect(analyser);
analyser.connect(ctx.destination);
```

## Costo estimado

| Pieza | Tamaño |
|---|---|
| `AnalyserNode` + configuración | ~10 líneas en el motor |
| Componente de canvas con `requestAnimationFrame` | ~60 líneas |
| Manejo de HiDPI + `ResizeObserver` | ~15 líneas |

Sin dependencias nuevas: `AnalyserNode` es parte de Web Audio y el canvas es del DOM. El impacto en el
bundle es del orden de 1 kB.

## Precisión del análisis: parámetros que importan

- **`fftSize`** — potencia de 2 entre 32 y 32768. Determina la resolución: `frequencyBinCount` es
  `fftSize / 2` bins. ElevenLabs usa **256** (128 bins) en `LiveWaveform`, que a 48 kHz da ~187 Hz por
  bin. Suficiente para visualizar, insuficiente para afinar.
- **`smoothingTimeConstant`** — 0 a 1, promediado temporal entre lecturas. ElevenLabs usa **0.8**.
  Sin suavizado la animación tiembla; con demasiado, se vuelve melaza.
- **`getByteFrequencyData`** devuelve 0–255 ya escalado entre `minDecibels` y `maxDecibels`;
  `getFloatFrequencyData` devuelve dB crudos. Para dibujar alcanza el primero.

## Riesgos verificados

1. **`AnalyserNode` no funciona en `OfflineAudioContext` de forma útil.** El render offline corre más
   rápido que tiempo real y no hay "cuadros"; `getByteFrequencyData` lee el estado del último bloque
   procesado. **Consecuencia**: los tests de este spec no pueden ser del tipo "renderizar y afirmar
   sobre el espectro" como los del spec 002. Hay que testear la lógica de mapeo (bins → geometría de
   barras) como función pura, separada del nodo. **Es la decisión de diseño principal.**
2. **`requestAnimationFrame` no corre con la pestaña oculta.** Es el comportamiento correcto para una
   visualización; solo hay que asegurar que no se acumule trabajo al volver.
3. **Costo de repintado.** A 60 fps con canvas y ~128 barras no hay problema, pero conviene medirlo en
   vez de asumirlo, sobre todo si el tablero se re-renderiza en React al mismo tiempo.

## Archivos afectados

| Archivo | Acción |
|---|---|
| `src/audio/engine.ts` | agregar `AnalyserNode` al grafo y exponer un lector de datos de frecuencia |
| `src/audio/spectrum.ts` | **nuevo** — mapeo puro de bins a geometría de barras (lo testeable) |
| `src/audio/spectrum.test.ts` | **nuevo** |
| `src/components/Spectrum.tsx` | **nuevo** — canvas + `requestAnimationFrame` + HiDPI |
| `src/App.tsx` | montar el componente |
| `docs/architecture/audio.md` | documentar el nodo de análisis en el grafo |

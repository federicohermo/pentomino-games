# Spec 003 — Visualización de la señal con AnalyserNode

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **Depende del [spec 002](../002-motor-de-audio-propio-sobre-web-audio/spec.md)**: sin el motor propio
> no hay un punto del grafo donde insertar el analizador.

## Problema

El proyecto convierte geometría en sonido y **no muestra el sonido en ningún lado**. La única
evidencia de que algo pasó es auditiva: si el usuario tiene el volumen bajo, o está en un lugar donde
no puede escuchar, la app se comporta como si no hiciera nada.

Es una carencia doble:

**De producto.** Un instrumento debería dar retroalimentación visual de lo que produce. Hoy colocar una
pieza pinta cinco celdas oscuras y ahí termina la información: no se ve el ataque, ni el decaimiento,
ni la superposición de dos piezas en loop.

**De demostración.** El proyecto es un artefacto que debería exhibir el trabajo con audio, y la señal
—lo único que prueba que el motor hace lo que dice— es invisible.

## Solución Propuesta

Insertar un `AnalyserNode` entre el gain maestro y el destino, y dibujar su salida en un canvas:

```
voces → master → analyser → destination
                     ↓
              canvas (rAF)
```

1. **Nodo de análisis** en el motor, con `fftSize` y `smoothingTimeConstant` configurables.
2. **Mapeo puro de bins a barras** en su propio módulo — la parte que se puede testear.
3. **Componente de canvas** que lee con `requestAnimationFrame`, ajusta por `devicePixelRatio` y se
   redimensiona con `ResizeObserver`.

Los valores por defecto (`fftSize: 256`, `smoothingTimeConstant: 0.8`) son los que usa
`@elevenlabs/ui` en `LiveWaveform`; no se eligieron por gusto (ver `research.md`).

### Decisiones de diseño

**D1 — El mapeo bins→barras es una función pura, separada del nodo.**
`AnalyserNode` no se puede testear con `OfflineAudioContext`: el render offline no tiene cuadros y
`getByteFrequencyData` lee el último bloque procesado. **Es el riesgo verificado que estructura todo el
spec.**

La respuesta no es renunciar a testear, sino mover la lógica a donde sí se puede: dado un `Uint8Array`
de bins y un ancho en píxeles, ¿qué barras salen? Eso es determinístico y se testea con arrays a mano.
El `AnalyserNode` queda reducido a una fuente de datos que no necesita test propio.

**D2 — Agrupación logarítmica de bins, no lineal.**
Los bins de la FFT están espaciados linealmente en frecuencia, pero la percepción es logarítmica: con
mapeo lineal, las primeras dos barras cubren toda la información musical útil y el resto del canvas
muestra agudos vacíos. Se agrupan en bandas logarítmicas.

Es también lo que hace `LiveWaveform` con sus "multiple frequency bands".

**D3 — Sin estado de React en el loop de dibujo.**
El canvas se dibuja imperativamente dentro de `requestAnimationFrame`, leyendo del analizador. **No
pasa por `useState`**: 60 renders por segundo de React para dibujar barras sería absurdo y competiría
con el re-render del tablero. React monta el `<canvas>` y arranca/frena el loop; nada más.

**D4 — El componente es honesto cuando no hay audio.**
Si el `AudioContext` no existe todavía (no hubo gesto del usuario) o está suspendido, el canvas muestra
un estado de reposo explícito en vez de una línea plana ambigua que parece un bug.

## Criterios de Aceptación

- **AC1** — El grafo del motor tiene el analizador entre el master y el destino, y el audio se sigue
  oyendo igual (el nodo es transparente).
- **AC2** — `binsToBars(bins, barCount)` es pura y testeada: dado un `Uint8Array` conocido, devuelve
  alturas normalizadas 0–1 deterministas. Sin `AudioContext` en el test.
- **AC3** — La agrupación es logarítmica (D2): un test verifica que la banda más grave abarca menos
  bins que la más aguda.
- **AC4** — Casos borde cubiertos: `bins` todo en cero → todas las barras en 0; `barCount` mayor que la
  cantidad de bins; `barCount` de 1.
- **AC5** — El canvas se ve nítido en pantallas HiDPI (escalado por `devicePixelRatio`) y se
  redimensiona con el contenedor.
- **AC6** — El loop de `requestAnimationFrame` se cancela al desmontar. Verificable: no queda ningún
  cuadro pendiente después de desmontar el componente.
- **AC7** — El dibujo **no** dispara renders de React (D3).
- **AC8** — Con el audio en reposo, el componente muestra su estado de reposo, no una línea plana
  (D4).
- **AC9** — `pnpm exec tsc -b --noEmit` en 0, `pnpm build` en verde, `pnpm test` en verde.

## Fuera de Alcance

- **Visualización de la entrada de micrófono.** El proyecto no captura audio. Es lo que hace
  `LiveWaveform` de ElevenLabs, pero acá no hay fuente de entrada que justificarlo.
- **Modo scrolling / histórico.** La primera versión es estática (barras que reaccionan al instante).
  El histórico agrega un buffer circular y decisiones de escala temporal; su propio spec si se quiere.
- **Atar la visualización a la geometría del tablero.** Que la barra correspondiente a la nota de una
  celda se ilumine *en esa celda* es la idea más atractiva del proyecto y merece su propio spec, con
  su propio diseño.
- **Waveform en el dominio del tiempo** (`getByteTimeDomainData`). Este spec hace espectro. El
  osciloscopio es otra vista.
- **Medidores de volumen** (`getInputVolume`-style). Derivables de lo mismo, pero otra UI.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **`AnalyserNode` no es testeable con `OfflineAudioContext`** (verificado). | D1: toda la lógica testeable vive en el mapeo puro; el nodo queda como fuente de datos sin test propio. Es una decisión estructural, no una renuncia. |
| El repintado a 60 fps compite con los re-renders de React del tablero. | D3 lo evita por diseño. Si aun así se nota, medir con el profiler antes de optimizar — no asumir. |
| La visualización puede quedar poco expresiva: cinco notas cortas dan poca señal sostenida. | Es el riesgo de producto real. `smoothingTimeConstant` y el rango de dB se ajustan en un solo lugar. Si el espectro no dice nada visualmente, el osciloscopio (fuera de alcance) puede ser mejor vista — y este spec deja el analizador listo para ambas. |
| Sobreajustar a lo que hace ElevenLabs y que quede como copia. | Los defaults se toman de ahí porque son razonables y están justificados en `research.md`, pero el diseño visual es propio. La alineación es de vocabulario técnico, no de estética. |

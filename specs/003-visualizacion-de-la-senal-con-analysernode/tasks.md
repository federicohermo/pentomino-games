# Tareas — Visualización de la señal con AnalyserNode

> **Desbloqueado.** Dependía del spec 002, mergeado en `1f34eac`.

## Backlog
- [x] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [x] Confirmar que el spec 002 está mergeado — PR #1 en `main` (`1f34eac`)
- [ ] **Crear rama** `feature/003-visualizacion-de-la-senal-con-analysernode`

## Mapeo puro (independiente, mergeable solo)
- [ ] `src/audio/spectrum.ts` con `binsToBars(bins, barCount)`
- [ ] Agrupación logarítmica, no lineal (D2)
- [ ] Pico por banda, no promedio — conserva los transitorios
- [ ] Guarda para que ninguna banda quede vacía si `barCount` > cantidad de bins

## Tests del mapeo
- [ ] AC2 — determinista y normalizado 0–1, sin tocar `AudioContext`
- [ ] AC3 — la banda grave abarca menos bins que la aguda
- [ ] AC4 — bordes: bins en cero, `barCount` > bins, `barCount` = 1

## Nodo en el grafo
- [ ] `AnalyserNode` entre master y destination, `fftSize: 256`, `smoothingTimeConstant: 0.8`
- [ ] AC1 — el audio suena igual: el nodo es transparente
- [ ] `readSpectrum()` con buffer reusado + JSDoc advirtiendo que no se debe guardar

## Componente
- [ ] `src/components/Spectrum.tsx` con canvas y `requestAnimationFrame`
- [ ] AC5 — escalado por `devicePixelRatio` + `ResizeObserver`
- [ ] AC6 — `cancelAnimationFrame` y `ro.disconnect()` al desmontar
- [ ] AC7 — el dibujo no pasa por estado de React (D3)
- [ ] AC8 — estado de reposo explícito cuando no hay contexto de audio (D4)
- [ ] Montar en `App.tsx`

## Verificación
- [ ] `npx tsc -b --noEmit` en 0 (AC9)
- [ ] `npm test` en verde (AC2–AC4)
- [ ] `npm run build` en verde (AC9)
- [ ] AC1 en el navegador — el audio no cambió
- [ ] AC5 — captura en HiDPI + redimensionar la ventana
- [ ] AC6 — montar/desmontar sin dejar `rAF` vivo
- [ ] AC7 — React Profiler: los renders del tablero no suben a 60/s
- [ ] AC8 — cargar sin hacer click: reposo, no línea plana

## Documentación
- [ ] `docs/architecture/audio.md` — el analizador en el diagrama y por qué el mapeo vive aparte
- [ ] `specs/log.md` — estado de 003 a `Implementado`

## PR
- [ ] Captura o GIF de la visualización andando
- [ ] Explicar por qué el mapeo es una función pura separada del nodo: `AnalyserNode` no es testeable
      con `OfflineAudioContext`, y esa restricción es la que estructura el diseño
- [ ] `/pr-review` antes de pedir revisión

## Seguimiento (no bloquea)
- [ ] Osciloscopio con `getByteTimeDomainData` — otra vista sobre el mismo nodo
- [ ] Modo scrolling / histórico con buffer circular
- [ ] **Atar la visualización a la geometría**: que la barra de la nota de una celda ilumine esa celda.
      Es la idea más atractiva del proyecto; merece su propio spec y su propio diseño
- [ ] Medidores de volumen derivados del mismo analizador

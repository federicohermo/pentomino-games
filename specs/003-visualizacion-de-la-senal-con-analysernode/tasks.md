# Tareas — Visualización de la señal con AnalyserNode

> **Desbloqueado.** Dependía del spec 002, mergeado en `1f34eac`.

## Backlog
- [x] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [x] Confirmar que el spec 002 está mergeado — PR #1 en `main` (`1f34eac`)
- [x] **Crear rama** `feature/003-visualizacion-de-la-senal-con-analysernode`

## Mapeo puro (independiente, mergeable solo)
- [x] `src/audio/spectrum.ts` con `binsToBars(bins, barCount)`
- [x] Agrupación logarítmica, no lineal (D2)
- [x] Pico por banda, no promedio — conserva los transitorios
- [x] Guarda para que ninguna banda quede vacía si `barCount` > cantidad de bins

## Tests del mapeo
- [x] AC2 — determinista y normalizado 0–1, sin tocar `AudioContext`
- [x] AC3 — la banda grave abarca menos bins que la aguda
- [x] AC4 — bordes: bins en cero, `barCount` > bins, `barCount` = 1

## Nodo en el grafo
- [x] `AnalyserNode` entre master y destination, `fftSize: 256`, `smoothingTimeConstant: 0.8`
- [x] AC1 — el audio suena igual: el nodo es transparente
- [x] `readSpectrum()` con buffer reusado + JSDoc advirtiendo que no se debe guardar

## Componente
- [x] `src/components/Spectrum.tsx` con canvas y `requestAnimationFrame`
- [x] AC5 — escalado por `devicePixelRatio` + `ResizeObserver`
- [x] AC6 — `cancelAnimationFrame` y `ro.disconnect()` al desmontar
- [x] AC7 — el dibujo no pasa por estado de React (D3)
- [x] AC8 — estado de reposo explícito cuando no hay contexto de audio (D4)
- [x] Montar en `App.tsx`

## Verificación
- [x] `pnpm exec tsc -b --noEmit` en 0 (AC9)
- [x] `pnpm test` en verde — 27 tests (AC2–AC4, y AC1 por transparencia)
- [x] `pnpm build` en verde (AC9)
- [x] AC1 en el navegador — el audio no cambió. Machine-checked además en
      `engine.test.ts`: la misma voz renderizada con y sin el nodo da muestras **idénticas**
- [x] AC5 — medido con dpr 1.25: canvas de 1128×96 CSS con backing store de 1410×120, y al
      angostar el contenedor a 576 CSS el backing pasó a 720. La transformación del contexto
      queda en (1.25, 1.25)
- [x] AC6 — remontaje por HMR: antes y después, exactamente **una** llamada a `rAF` por cuadro
      (gaps de ~7 ms, cero pares en el mismo cuadro). Un loop huérfano habría duplicado la cuenta
- [x] AC7 — por construcción: `Spectrum.tsx` no tiene `useState` ni llama a ningún setter; el
      loop solo lee del motor y dibuja. No se pasó el React Profiler porque no hay nada que
      pueda disparar un render desde el camino de dibujo
- [x] AC8 — cargando sin hacer click: ranuras apagadas + "En reposo — el audio arranca con el
      primer click", no una línea plana

## Documentación
- [x] `docs/architecture/audio.md` — el analizador en el diagrama y por qué el mapeo vive aparte
- [x] `docs/architecture/directory-structure.md` — `spectrum.ts` y `components/`
- [x] `CLAUDE.md` — el analizador en la lista de invariantes de audio
- [x] `specs/log.md` — estado de 003 a `Implementado`

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

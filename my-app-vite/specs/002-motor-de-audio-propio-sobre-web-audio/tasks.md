# Tareas — Motor de audio propio sobre Web Audio

## Backlog
- [x] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [x] **Crear rama** `feature/002-motor-de-audio-propio-sobre-web-audio`

## Gate — `OfflineAudioContext` corriendo en tests
> **PASADO** durante el review del spec. La opción A alcanza; el browser mode se descartó.

- [x] `npm i -D vitest node-web-audio-api` — instaladas (`vitest@^4.1.10`, `node-web-audio-api@^2.1.0`)
- [x] Opción A verificada: render de 440 Hz en Node, idéntico a Chrome dentro del 2%
- [x] Opción B (browser mode) descartada por innecesaria
- [x] Los cuatro tests propuestos escritos y en verde
- [x] Bloque `test` en `vite.config.ts` versionado (compartido con el spec 001), sin `globals` para no
      chocar con `@types/jest`
- [x] Helper `offline(secs, sr)` en `src/audio/test-context.ts`

## Motor — síntesis
- [x] `src/audio/engine.ts`: `midiToHz`
- [x] `scheduleVoice(ctx, dest, freq, at, dur, vel, opts)` con ADSR
- [x] Ancla `setValueAtTime(0, at)` antes de la rampa de ataque (evita clicks)
- [x] `onended` desconecta osc y env (ciclo de vida, D2)
- [x] El contexto entra por parámetro, nunca por singleton importado (D3)

## Tests de síntesis
- [x] Helpers `peakNear` y `zeroCrossHz`
- [x] AC2 — frecuencia por cruces por cero = `midiToHz(m)` ±1 Hz
- [x] AC3 — pico ≈ `vel*master` y sostenido ≈ `vel*sustain*master`, ambos ±5%; `0` fuera de la nota
- [x] AC4 — primera muestra no nula en `at ± 1 ms`

## Motor — scheduler
- [x] `Job`, `addJob`, `removeJob`, `clearJobs`, `setBpm`, `startClock`, `stopClock`, `clockRunning`
- [x] `tick()` separado de `scheduleVoice()` — es lo que hace testeable al scheduler
- [x] Guarda `nextBar < ctx.currentTime` para recuperarse del throttling de pestañas ocultas
- [x] `jobCount()` expuesto para verificación manual (paso 5 del plan)
- [x] AC5 — N compases → N disparos, cada uno a ±6 ms, sin depender de tiempo real
- [x] La detección de onsets usa seguidor de envolvente (ventanas de 5 ms) con histéresis de dos
      umbrales. **Un umbral sobre la muestra cruda no sirve**: dio 21 falsos onsets para 3 notas

## Integración
- [x] `audio()`: singleton del `AudioContext`, creado en el primer gesto (D4)
- [x] `playNotes()` — **única** función que convierte notas en sonido (AC6)
- [x] Retirar `ensureTone`, `toneModule`, `synth`, `type ToneModule`, `playNotesNow`, `useTransport`
- [x] El efecto de reconciliación pasa a `addJob`/`clearJobs` — **conserva su forma**, solo cambia
      destinatario. Se simplifica mas de lo previsto: `addJob` es sincrónico, desaparece el flag de
      cancelación, y como los jobs son datos puros (no eventos con id) alcanza con limpiar y re-agregar
- [x] `toggleTransport` → `startClock`/`stopClock`
- [x] `npm uninstall tone` (AC1)

## Verificación
- [x] `npx tsc -b --noEmit` en 0 (AC9)
- [x] `npm test` en verde (AC2–AC5)
- [x] `npm run build`: el chunk de 340 kB desaparece; `dist` quedó en 209.57 kB (AC8)
- [x] AC7 en el navegador — los seis en verde: 1 pieza ON → 1 · apagar → 0 · encender → 1 ·
      Quitar → 0 · 2 piezas → 2 · Reset → 0. Además, 10 osciladores en 5.02 s a 110 bpm = 2 compases × 5 notas
- [ ] Escuchar y confirmar que el cambio de timbre es aceptable (es esperado, D5)

## Documentación
- [x] `docs/architecture/audio.md` — reescritura completa, sin Tone
- [x] `CLAUDE.md` — stack, sección de audio, invariante del efecto de reconciliación
- [x] `docs/README.md` — sacar Tone del stack
- [x] `docs/guides/quickstart.md` — receta de verificación de audio
- [x] `docs/guides/troubleshooting.md` — "no suena nada" sin Tone; sacar el fallo de import
- [x] `specs/log.md` — estado de 002 a `Implementado`

## PR
- [ ] Incluir las mediciones: 340.42 kB → ~1.6 kB, y por qué Tone no se podía achicar
      (`sideEffects` ausente, 962 módulos, imports profundos solo −9%)
- [ ] Incluir la salida de los tests de envolvente — es la prueba de que el audio quedó asertable
- [ ] `/pr-review` antes de pedir revisión
- [x] `/code-review` corrido: 7 hallazgos, 6 confirmados midiendo. Arreglados los cuatro baratos —
      iterador de una sola pasada en `collectHits`, la invariante falsa de "un solo camino de nota a
      sonido", el comentario de reconciliación que describía diffing inexistente, y la constante
      `LOOKAHEAD` duplicada en el test. Los tres restantes (throttling, headroom, `stopClock`) van a
      seguimiento con sus mediciones

## Seguimiento (no bloquea)
- [ ] Efectos: filtro, reverb, delay
- [ ] Diseño sonoro fino del patch (este spec entrega una ADSR correcta, no trabajada)
- [ ] Si el conteo de voces simultáneas crece, revisar D2 (pool / voice stealing)
- [ ] Comportamiento con la pestaña en segundo plano: el lookahead de 100 ms cubre solo parcialmente el
      estrangulamiento de temporizadores. **Cuantificado en el review**: Chrome estrangula `setInterval`
      a ≥1 s con la pestaña oculta, muy por encima del horizonte, así que el tempo efectivo baja (a
      110 bpm, un compás cada ~3 s en vez de cada 2.18 s) y la fase no vuelve a engancharse. El reloj
      basado en origen del
      [spec 004](../004-fase-por-pieza-la-columna-como-posicion-en-el-compas/spec.md) lo resuelve, así
      que no se ataca acá
- [ ] **Sin headroom: clipping a partir de 5–6 piezas en loop.** Medido con `OfflineAudioContext`:
      1 pieza → 0.4187 · 2 → 0.6461 · 4 → 0.9813 (0 muestras clippeadas) · 6 → 1.1409 (35 clippeadas).
      El master es un gain fijo de 0.3. Un limitador, o escalar por `jobCount()`, lo cubre; el spec 004
      lo mitiga de rebote al repartir las piezas dentro del compás
- [ ] **`stopClock()` no calla lo ya agendado**: hasta ~1.2 s siguen sonando después del click
      (`LOOKAHEAD` + 4×`ARPEGGIO_SPREAD` + `NOTE_DUR` + release). Se percibe como un botón que no
      responde. Un fade del master, o rastrear las voces vivas, lo arregla

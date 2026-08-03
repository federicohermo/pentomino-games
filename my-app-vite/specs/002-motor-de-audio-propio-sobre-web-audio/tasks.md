# Tareas — Motor de audio propio sobre Web Audio

## Backlog
- [x] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [ ] **Crear rama** `feature/002-motor-de-audio-propio-sobre-web-audio`

## Gate — `OfflineAudioContext` corriendo en tests
> Si este gate no pasa, **parar y replantear el spec**. Sin tests de audio el cambio pierde su
> principal justificación técnica.

- [ ] `npm i -D vitest` + bloque `test` en `vite.config.ts` (compartido con el spec 001)
- [ ] Opción A: `node-web-audio-api` — test mínimo que renderiza 440 Hz y verifica `buf.length`
- [ ] Si A falla, opción B: browser mode de Vitest (`@vitest/browser` + Playwright)
- [ ] Helper `offline(secs, sr)` en `src/audio/test-context.ts`
- [ ] Gate verde antes de seguir

## Motor — síntesis
- [ ] `src/audio/engine.ts`: `midiToHz`
- [ ] `scheduleVoice(ctx, dest, freq, at, dur, vel, opts)` con ADSR
- [ ] Ancla `setValueAtTime(0, at)` antes de la rampa de ataque (evita clicks)
- [ ] `onended` desconecta osc y env (ciclo de vida, D2)
- [ ] El contexto entra por parámetro, nunca por singleton importado (D3)

## Tests de síntesis
- [ ] Helpers `peakNear` y `zeroCrossHz`
- [ ] AC2 — frecuencia por cruces por cero = `midiToHz(m)` ±1 Hz
- [ ] AC3 — pico ≈ `vel*master` y sostenido ≈ `vel*sustain*master`, ambos ±5%; `0` fuera de la nota
- [ ] AC4 — primera muestra no nula en `at ± 1 ms`

## Motor — scheduler
- [ ] `Job`, `addJob`, `removeJob`, `clearJobs`, `setBpm`, `startClock`, `stopClock`, `clockRunning`
- [ ] `tick()` separado de `scheduleVoice()` — es lo que hace testeable al scheduler
- [ ] Guarda `nextBar < ctx.currentTime` para recuperarse del throttling de pestañas ocultas
- [ ] `jobCount()` expuesto para verificación manual (paso 5 del plan)
- [ ] AC5 — N compases → N disparos en los instantes esperados, sin depender de tiempo real

## Integración
- [ ] `audio()`: singleton del `AudioContext`, creado en el primer gesto (D4)
- [ ] `playNotes()` — **única** función que convierte notas en sonido (AC6)
- [ ] Retirar `ensureTone`, `toneModule`, `synth`, `type ToneModule`, `playNotesNow`, `useTransport`
- [ ] El efecto de reconciliación pasa a `addJob`/`removeJob` — **conserva su forma**, solo cambia
      destinatario. Se simplifica: `addJob` es sincrónico y desaparece el flag de cancelación
- [ ] `toggleTransport` → `startClock`/`stopClock`
- [ ] `npm uninstall tone` (AC1)

## Verificación
- [ ] `npx tsc -b --noEmit` en 0 (AC9)
- [ ] `npm test` en verde (AC2–AC5)
- [ ] `npm run build`: el chunk de 340 kB desaparece; `dist` baja de ~550 kB a ~210 kB (AC8)
- [ ] AC7 en el navegador — los seis comportamientos de loops, contando con `jobCount()`:
      1 pieza ON → 1 · apagar → 0 · encender → 1 · Quitar → 0 · 2 piezas → 2 · Reset → 0
- [ ] Escuchar y confirmar que el cambio de timbre es aceptable (es esperado, D5)

## Documentación
- [ ] `docs/architecture/audio.md` — reescritura completa, sin Tone
- [ ] `CLAUDE.md` — stack, sección de audio, invariante del efecto de reconciliación
- [ ] `docs/README.md` — sacar Tone del stack
- [ ] `docs/guides/quickstart.md` — receta de verificación de audio
- [ ] `docs/guides/troubleshooting.md` — "no suena nada" sin Tone; sacar el fallo de import
- [ ] `specs/README.md` — fila 002

## PR
- [ ] Incluir las mediciones: 340.42 kB → ~1.6 kB, y por qué Tone no se podía achicar
      (`sideEffects` ausente, 962 módulos, imports profundos solo −9%)
- [ ] Incluir la salida de los tests de envolvente — es la prueba de que el audio quedó asertable
- [ ] `/pr-review` antes de pedir revisión

## Seguimiento (no bloquea)
- [ ] `AnalyserNode` para visualizar la señal — barato una vez que el grafo es propio
- [ ] Efectos: filtro, reverb, delay
- [ ] Diseño sonoro fino del patch (este spec entrega una ADSR correcta, no trabajada)
- [ ] Si el conteo de voces simultáneas crece, revisar D2 (pool / voice stealing)
- [ ] Comportamiento con la pestaña en segundo plano: el lookahead de 100 ms cubre solo parcialmente el
      estrangulamiento de temporizadores. Si molesta, evaluar `AudioWorklet` o un `Worker`

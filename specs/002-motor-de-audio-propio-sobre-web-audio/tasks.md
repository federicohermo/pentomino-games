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
- [ ] [M] **Escuchar y confirmar que el cambio de timbre es aceptable** (es esperado, D5). Sigue pendiente:
      es la única tarea del spec que no se puede automatizar, y el PR se mergeó sin ella. `Tone.Synth`
      tenía `release: 1` y la nueva ADSR tiene `0.12` — el sonido **es** distinto por diseño. Si el
      ataque suena duro o el sostenido largo, se ajusta en `DEFAULT_VOICE` y el test de envolvente avisa
      si se rompe la forma

## Documentación
- [x] `docs/architecture/audio.md` — reescritura completa, sin Tone
- [x] `CLAUDE.md` — stack, sección de audio, invariante del efecto de reconciliación
- [x] `docs/README.md` — sacar Tone del stack
- [x] `docs/guides/quickstart.md` — receta de verificación de audio
- [x] `docs/guides/troubleshooting.md` — "no suena nada" sin Tone; sacar el fallo de import
- [x] `specs/log.md` — estado de 002 a `Implementado`

## PR
> **El PR ([#1](https://github.com/federicohermo/pentomino-games/pull/1)) se mergeó antes de que se
> escribiera su descripción**, así que las tres tareas de abajo se cumplieron **en el repo y no en el
> PR**. No es una pérdida: la descripción de un PR mergeado no la vuelve a leer nadie, y las mediciones
> son justamente lo que hay que poder consultar dentro de seis meses. Ver
> [Resultados medidos](#resultados-medidos).

- [x] Las mediciones quedan en [Resultados medidos](#resultados-medidos), con los números **remedidos**,
      no copiados: el chunk de Tone eran 340.42 kB y el motor propio pesa **1.83 kB** minificado
      (1.0 kB gzip). El spec estimaba "~1.6 kB" — se corrige al valor real
- [x] La salida de los 17 tests queda en [Resultados medidos](#resultados-medidos) — es la prueba de que
      el audio quedó asertable
- [x] **`/pr-review` corrido.** Su maquinaria de Bitbucket + Jira no aplica acá (GitHub personal, sin
      tablero, sin `gh` instalado), así que los hallazgos no se pudieron subir como comentarios del PR.
      Su pase de revisión sí corrió, y **encontró lo que `/code-review` no podía ver**: rot en
      `docs/guides/conventions.md`, `docs/infra/deploy.md` y `docs/README.md`, más dos nombres heredados
      de Tone en código. Corregido en `45021fd` — ver abajo
- [x] `/code-review` corrido: 7 hallazgos, 6 confirmados midiendo. Arreglados los cuatro baratos —
      iterador de una sola pasada en `collectHits`, la invariante falsa de "un solo camino de nota a
      sonido", el comentario de reconciliación que describía diffing inexistente, y la constante
      `LOOKAHEAD` duplicada en el test. Los tres restantes (throttling, headroom, `stopClock`) van a
      seguimiento con sus mediciones

## Resultados medidos

> Remedidos sobre `main` después del merge (`1f34eac`), no copiados del plan.

### Bundle

| | antes | después |
|---|---|---|
| JS | 537.94 kB (dos chunks) | **197.00 kB** (uno) |
| CSS | 12.57 kB | 12.60 kB |
| chunk de Tone | 340.42 kB | **no existe** |
| motor propio | — | **1.83 kB** minificado · 1.0 kB gzip |

`tone` no está en `package.json` ni en el lockfile (`npm ls tone` → vacío, 0 matches en
`package-lock.json`). El motor son 9.5 kB de fuente que minifican a 1.83 kB.

**Por qué Tone no se podía achicar**, que es la parte que justifica reemplazarlo en vez de optimizarlo:
su `package.json` **no declara `sideEffects: false`**, así que el bundler no puede descartar nada. Seis
imports arrastraban 962 módulos. Se midió la alternativa de imports profundos antes de descartarla:
383 kB → 348 kB, **apenas −9%**. No era un problema de cómo se importaba.

### Tests

17 en verde, contra muestras reales renderizadas con `OfflineAudioContext` en Node
(`node-web-audio-api`), no contra mocks:

```
✓ midiToHz > ancla A4 en 440 y respeta las octavas
✓ sintesis > AC2 — la frecuencia renderizada es la pedida (+-1 Hz)
✓ sintesis > AC2 — sirve para cualquier nota, no solo A4
✓ sintesis > AC3 — la envolvente alcanza el pico y el sostenido esperados
✓ sintesis > AC3 — silencio exacto fuera de la nota
✓ sintesis > AC4 — la nota empieza donde se la agendo (+-1 ms)
✓ sintesis > AC4 — y tambien en otro instante, para descartar una coincidencia
✓ scheduler > AC5 — N compases producen N disparos en los instantes esperados
✓ scheduler > AC5 — cada job aporta todas sus notas, espaciadas por el arpegio
✓ scheduler > AC5 — varios jobs suenan en el mismo compas
✓ scheduler > acepta un iterador de una sola pasada en varios compases
✓ scheduler > sin jobs no agenda nada, pero el cursor igual avanza
✓ scheduler > se recupera del throttling en vez de acumular compases atrasados
✓ scheduler > en marcha normal NO aplica el offset de recuperacion
✓ scheduler > el tempo cambia la duracion del compas
✓ scheduler + sintesis integrados > AC5 — los disparos se oyen donde el scheduler dijo (+-6 ms)
✓ scheduler + sintesis integrados > dos notas superpuestas suman amplitud
```

Los tests de envolvente (AC3) son el resultado que importa: **el audio dejó de ser algo que solo se
puede escuchar.** Se afirma sobre frecuencia por cruces por cero interpolados, niveles de pico y
sostenido dentro del 5%, silencio exacto fuera de la nota, e instantes de arranque.

### En el navegador

- Los seis comportamientos de loop vía `jobCount()`: 1 pieza ON → 1 · apagar → 0 · encender → 1 ·
  Quitar → 0 · 2 piezas → 2 · Reset → 0.
- Instrumentando `ctx.createOscillator`: **10 osciladores en 5.02 s a 110 bpm** con una pieza = exactamente
  2 compases × 5 notas.
- `AudioContext` en `running` a 48 kHz, sin errores de consola.

### Lo que no se verificó

**El timbre.** Ver la tarea abierta en [Verificación](#verificación).

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

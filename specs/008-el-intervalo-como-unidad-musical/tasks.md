# Tareas — El intervalo como unidad musical, y un solo transporte

## Backlog
- [x] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [x] Fila del 008 en `specs/log.md` (`Propuesto`)
- [x] **Línea base**: guardar `simulate_board` a `bpm: 100` (para AC3) y a `bpm: 160` (para el PR) —
      está en [`baseline.md`](./baseline.md), con la predicción de lo que tiene que dar después
- [x] **Crear rama** `feature/008-el-intervalo-como-unidad-musical`

## El intervalo
- [x] `SUBDIVISIONS_PER_BEAT = 4` en `audio/constants/scheduler.constants.ts`
- [x] `intervalDuration(bpm)` en `audio/scheduler.ts`, definida **sobre** `barDuration`
- [x] `collectHits` deriva el intervalo y lo calcula una vez, fuera del bucle de jobs
- [x] Sale `Job.spread` de `audio/types/scheduler.types.ts` — el comentario de `phase` se queda
- [x] Sale `ARPEGGIO_SPREAD` de `audio/constants/engine.constants.ts`
- [x] `playNotes` usa `intervalDuration(bpm)` con el `bpm` del módulo

## La duración de la nota
- [x] `NOTE_DUR` → `NOTE_INTERVALS`, con el dato de D3 en el comentario. **Quedó en 1 y no en 2**: con
      2 la nota dura el doble de lo que tarda en llegar la siguiente y el arpegio suena con 2,88 voces
      encimadas de forma permanente (medido a 110 bpm). Con 1 son 1,88, contra las 3,13 de antes del
      spec. Ver la nota en el PR
- [x] `scheduleVoice` pierde el default de `dur`: pasa a ser obligatorio
- [x] Los dos llamadores (`tick` y `playNotes`) calculan la duración desde el intervalo

## Transporte
- [x] `App.tsx`: `loopPlaced` → `playing`, `toggleClock` → `togglePlay`
- [x] El efecto de reconciliación pasa a `[placed, playing]` y **no se mueve nada más de él**
- [x] `handleCellClick` no dispara el arpegio con `playing` en true (D5)
- [x] `PiecePalette`: un solo botón ▶/⏸ con estado a la vista; fuera el checkbox
- [x] La palabra "loop" no queda en ninguna etiqueta de la UI (AC6)
- [x] Confirmar que `clockRunning()` y `jobCount()` siguen exportados para la verificación por consola
- [x] AC10 — `togglePlay` cierra con `setPlaying(clockRunning())`, no con `setPlaying(!playing)`:
      `startClock()` es un no-op silencioso sin Web Audio y el botón diría "Pausa" con el reloj parado
      (ver el snippet en `plan.md` §3)

## Tests
- [x] Los tests de `audio/__tests__/` que construyen jobs con `spread`
- [x] El comentario de `scheduler.test.ts:16` («el spread es un dato del job, no una constante del
      motor») deja de ser cierto: ahora no es ninguna de las dos cosas
- [x] AC2 — cambiar el bpm afecta a un job **ya creado**, sin recrearlo
- [x] AC5 — `scheduleVoice` con `OfflineAudioContext`: la nota dura `NOTE_INTERVALS` intervalos; la
      envolvente no se movió
- [x] AC4 — el arpegio mide 1,000 s a 60 bpm y 0,375 s a 160 bpm

## MCP server
- [x] `simulateBoard.ts:184`: jobs sin `spread`; la respuesta gana `intervalSeconds`
- [x] `simulateBoard.ts:143`: `jobTimeline` deriva `lastNote` del intervalo — sin esto da `NaN` y la
      `timeline` vuelve **vacía sin error**
- [x] Reescribir el comentario de `jobTimeline` (`:123-134`): el argumento de no-solapamiento deja de
      depender del bpm (el arpegio mide siempre `bar / 4`)
- [x] AC8 — aserción sobre `intervalSeconds` en `mcp-server/src/__tests__/tools.test.ts` (al lado de la
      de `barSeconds`, `:244`)
- [x] `pnpm mcp:test` en verde

## Documentación
- [x] `docs/architecture/audio.md`: los dos caminos (`:215`, `:218`), y que ahora el intervalo también
      está unificado
- [x] `docs/architecture/audio.md:154-165`: el bloque de reconciliación tiene `spread: ARPEGGIO_SPREAD`
      y `[placed, loopPlaced]`
- [x] `docs/architecture/modelo-musical.md:160-167`: "arpegio de tiempo fijo" deja de ser cierto
- [x] `.claude/rules/audio.md`: la lista de lo unificado
- [x] `.claude/rules/ui.md:18`: el efecto observa `[placed, playing]`, y no hay checkbox que prender
- [x] `docs/guides/conventions.md:176`: ídem, lo afirma en presente
- [x] `docs/guides/troubleshooting.md:110-112`: las tres afirmaciones que el spec falsifica — el botón
      "Loop", el checkbox, y *"el arpegio de colocación suena siempre"*, que D5 deja de ser cierto
- [x] `docs/guides/quickstart.md:76-78`: el espaciado deja de ser "dos lugares" y pasa a ser una
      definición usada en dos lugares
- [x] `specs/004-…/tasks.md:135`: marcar la tarea de seguimiento que este spec **salda**
- [ ] `specs/log.md`: estado del 008 — **la nota de que la deuda del 004 queda cerrada ya está**; mover
      el estado de `Propuesto` es del merge, no de la rama

## Verificación
- [x] **AC3** — `simulate_board` a 100 bpm: `timeline` idéntica a la línea base (30 onsets en 30
      instantes, los mismos)
- [x] **AC4** — a 60 y 160 bpm, el arpegio mide lo previsto. A 160 bpm el tablero de la línea base pasa
      de 21 instantes con `maxPerInstant: 2` a **30 con 1**. El arpegio al colocar se verificó contando
      osciladores en el navegador, no de oído
- [x] `pnpm verify` en verde (AC1, AC8, AC9)
- [x] A mano: el botón cambia de cara; colocar en pausa suena (5 osciladores en 0,1 ms), colocar
      andando no (0 al click; después solo el loop, cada 2,18 s) (AC6, AC7)
- [ ] **Escuchar el extremo de 160 bpm** y decidir si `TEMPO_MAX` se queda

## PR
- [x] Aclarar que **a 100 bpm no cambia nada**, y por qué: 0,15 s era la semicorchea de 100 bpm
- [x] Adjuntar las dos salidas de `simulate_board` (100 y 160) antes y después
- [ ] `/pr-review` antes de pedir revisión

## Seguimiento (no bloquea)
- [ ] `TEMPO_MAX` puede necesitar bajar de 160 — constante, commit aparte
- [ ] `CLOCK_START_DELAY` y `PLAY_DELAY` se quedan en segundos a propósito: son latencias de agenda
- [ ] El slider de tempo no muestra la unidad ("110" a secas) — cosmético, va con el 010
- [ ] **`DEFAULT_VOICE.release` sigue en segundos absolutos** (0,12 s), o sea 0,48 intervalos a 60 bpm
      y 1,28 a 160: es lo único del modelo temporal que no quedó en unidades musicales, y es lo que
      hace que el solape restante del arpegio crezca con el tempo. Descubierto midiendo el solape

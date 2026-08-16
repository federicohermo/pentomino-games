# Tareas — El intervalo como unidad musical, y un solo transporte

## Backlog
- [ ] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [ ] Fila del 008 en `specs/log.md` (`Propuesto`)
- [ ] **Línea base**: guardar `simulate_board` a `bpm: 100` (para AC3) y a `bpm: 160` (para el PR)
- [ ] **Crear rama** `feature/008-el-intervalo-como-unidad-musical`

## El intervalo
- [ ] `SUBDIVISIONS_PER_BEAT = 4` en `audio/constants/scheduler.constants.ts`
- [ ] `intervalDuration(bpm)` en `audio/scheduler.ts`, definida **sobre** `barDuration`
- [ ] `collectHits` deriva el intervalo y lo calcula una vez, fuera del bucle de jobs
- [ ] Sale `Job.spread` de `audio/types/scheduler.types.ts` — el comentario de `phase` se queda
- [ ] Sale `ARPEGGIO_SPREAD` de `audio/constants/engine.constants.ts`
- [ ] `playNotes` usa `intervalDuration(bpm)` con el `bpm` del módulo

## La duración de la nota
- [ ] `NOTE_DUR` → `NOTE_INTERVALS = 2`, con el dato de D3 en el comentario (0,350 → 0,300 s a 100 bpm)
- [ ] `scheduleVoice` pierde el default de `dur`: pasa a ser obligatorio
- [ ] Los dos llamadores (`tick` y `playNotes`) calculan la duración desde el intervalo

## Transporte
- [ ] `App.tsx`: `loopPlaced` → `playing`, `toggleClock` → `togglePlay`
- [ ] El efecto de reconciliación pasa a `[placed, playing]` y **no se mueve nada más de él**
- [ ] `handleCellClick` no dispara el arpegio con `playing` en true (D5)
- [ ] `PiecePalette`: un solo botón ▶/⏸ con estado a la vista; fuera el checkbox
- [ ] La palabra "loop" no queda en ninguna etiqueta de la UI (AC6)
- [ ] Confirmar que `clockRunning()` y `jobCount()` siguen exportados para la verificación por consola

## Tests
- [ ] Los tests de `audio/__tests__/` que construyen jobs con `spread`
- [ ] AC2 — cambiar el bpm afecta a un job **ya creado**, sin recrearlo
- [ ] AC5 — `scheduleVoice` con `OfflineAudioContext`: la nota dura 2 intervalos; la envolvente no se movió
- [ ] AC4 — el arpegio mide 1,000 s a 60 bpm y 0,375 s a 160 bpm

## MCP server
- [ ] `simulateBoard.ts`: jobs sin `spread`; la respuesta gana `intervalSeconds`
- [ ] `pnpm mcp:test` en verde

## Documentación
- [ ] `docs/architecture/audio.md`: los dos caminos, y que ahora el intervalo también está unificado
- [ ] `docs/architecture/modelo-musical.md`: "arpegio de tiempo fijo" deja de ser cierto
- [ ] `.claude/rules/audio.md`: la lista de lo unificado
- [ ] `specs/log.md`: estado del 008

## Verificación
- [ ] **AC3** — `simulate_board` a 100 bpm: `timeline` idéntica a la línea base
- [ ] **AC4** — a 60 y 160 bpm, el arpegio mide lo previsto
- [ ] `pnpm verify` en verde (AC1, AC8, AC9)
- [ ] A mano: el botón cambia de cara; colocar en pausa suena, colocar andando no (AC6, AC7)
- [ ] **Escuchar el extremo de 160 bpm** y decidir si `TEMPO_MAX` se queda

## PR
- [ ] Aclarar que **a 100 bpm no cambia nada**, y por qué: 0,15 s era la semicorchea de 100 bpm
- [ ] Adjuntar las dos salidas de `simulate_board` (100 y 160) antes y después
- [ ] `/pr-review` antes de pedir revisión

## Seguimiento (no bloquea)
- [ ] `TEMPO_MAX` puede necesitar bajar de 160 — constante, commit aparte
- [ ] `CLOCK_START_DELAY` y `PLAY_DELAY` se quedan en segundos a propósito: son latencias de agenda
- [ ] El slider de tempo no muestra la unidad ("110" a secas) — cosmético, va con el 010

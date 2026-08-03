# Tareas — Fase por pieza: la columna como posición en el compás

## Backlog
- [ ] **Esperar a que el [spec 002](../002-motor-de-audio-propio-sobre-web-audio/spec.md) esté
      mergeado.** Este spec reescribe `collectHits`; hacerlo sobre una rama que todavía no mergeó
      garantiza el conflicto.
- [ ] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [ ] **Crear rama** `feature/004-fase-por-pieza-la-columna-como-posicion-en-el-compas`

## Paso 1 — Reloj basado en origen, sin cambio de comportamiento
> Este paso **no debe alterar nada audible**. Si AC2 no queda en verde, parar acá.

- [ ] `ClockState`: `nextBar` → `origin` + `scheduledUntil`
- [ ] `firstOnsetAfter(after, origin, bar, phase)` — `floor(x) + 1`, no `ceil` (AC3)
- [ ] `collectHits` reformulada sobre `origin`
- [ ] Borrar la guarda de recuperación `if (state.nextBar < fromTime)` — queda subsumida por
      `Math.max(scheduledUntil, fromTime)` (AC6)
- [ ] `startClock`: `scheduledUntil = c.currentTime`, **estrictamente antes** de `origin`, o el
      downbeat del compás 0 se pierde
- [ ] AC2 — `phase: 0` reproduce los mismos instantes que el cursor de compás
- [ ] AC3 — ventanas de 25 ms sobre horizonte de 100 ms: ningún onset repetido
- [ ] AC4 — ningún `hit.at < fromTime`
- [ ] AC6 — salto de 10 compases: se saltean, no se recuperan

## Paso 2 — `phase` en el `Job`
- [ ] `Job.phase: number` — **obligatorio**, no opcional con default (el default silencia el bug)
- [ ] `collectHits` usa `job.phase` (AC1)
- [ ] AC5 — con `phase: 0.99`, ningún onset más allá de `fromTime + horizon`
- [ ] AC7 — pico de dos piezas a fase 0/0.5 **menor** que a fase 0/0, y el doble de onsets detectados
- [ ] AC9 — cambiar el bpm no reordena el patrón: las fases son fracciones

## Paso 3 — App
- [ ] El efecto de reconciliación pasa `phase: ax / GRID_W` desde `p.cells[ANCHOR_INDEX[p.piece]]`
- [ ] AC8 — misma pieza en columnas distintas → `phase` distinta; misma columna → misma `phase`
- [ ] Confirmar que `playNow` al colocar **no** lleva fase (D5)
- [ ] Confirmar que `handleCellClick`, `resetBoard` y la limpieza al desmontar **no** se tocan

## Verificación
- [ ] `npx tsc -b --noEmit` en 0 (AC10)
- [ ] `npm run lint` en 0 (AC10)
- [ ] `npm test` en verde (AC10)
- [ ] `npm run build` en verde (AC10)
- [ ] **Escuchar 3–4 piezas en columnas separadas**: ¿se oyen como eventos distintos o como un acorde
      repetido? Es la única verificación que decide si el spec cumplió su objetivo
- [ ] Mover el tempo con el loop corriendo: el patrón se estira, no se reordena
- [ ] Anotar el pico real de AC7. Si no baja lo predicho, `ARPEGGIO_SPREAD` deja de ser fuera de
      alcance (ver `research.md`, "Lo que hay que medir")

## Documentación
- [ ] `docs/architecture/audio.md` — reloj por origen, `phase`, anticipación acotada
- [ ] `docs/architecture/modelo-musical.md` — fila **columna → posición en el compás**
- [ ] `CLAUDE.md` — la misma fila en la tabla del modelo musical
- [ ] `specs/log.md` — estado de 004 a `Implementado`

## PR
- [ ] Explicar que el paso 1 es un refactor sin cambio audible y el paso 2 el cambio de producto —
      idealmente dos commits separados, para que revertir el producto no revierta el scheduler
- [ ] Incluir la comparación de picos de AC7
- [ ] Nombrar la limitación conocida: **sin retroalimentación visual la fase se oye pero no se lee**
- [ ] `/pr-review` antes de pedir revisión

## Seguimiento (no bloquea)
- [ ] **Cabeza lectora en el tablero.** Es lo que vuelve legible a esta feature; encaja con el
      [spec 003](../003-visualizacion-de-la-senal-con-analysernode/spec.md), que ya trae el canvas
- [ ] Que la fila (`y`) determine algo: octava, duración o velocity. Un eje por vez
- [ ] `ARPEGGIO_SPREAD` en unidades musicales en vez de 0.15 s absolutos
- [ ] Cuantización configurable (10 pasos / semicorcheas / tresillos)
- [ ] Mover una pieza sin quitarla y volver a colocarla — hoy no existe, y con fase se vuelve un gesto
      musical y no solo visual

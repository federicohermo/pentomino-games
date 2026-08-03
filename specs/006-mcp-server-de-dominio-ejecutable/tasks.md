# Tareas — MCP server de dominio ejecutable

> **Este spec no toca `src/`.** Si al implementarlo hace falta un export o un módulo nuevo en el
> dominio, es un cambio del [spec 005](../005-modularizacion-de-src-en-capas/spec.md) y va en su commit.

## Backlog
- [ ] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [ ] **Esperar las fases 1–3 del spec 005** mergeadas: `src/domain/{transform,pieces,board,music,
      invariants}.ts` con sus `types/`, y `src/audio/{voice,scheduler,engine}.ts`. La fase 4 de 005
      (componentes) **no bloquea**
- [ ] Confirmar `node --version` ≥ 22.18 (medido: v22.18.0). Con Node 20 el server no arranca
- [ ] **Crear rama** `feature/006-mcp-server-de-dominio-ejecutable`

## Paso 1 — Andamiaje
- [ ] `mcp-server/package.json` — `type: module`, `engines.node >= 22.18`, deps
      `@modelcontextprotocol/server@^2.0.0` + `zod@^4.2.0`, devDeps `typescript` + `@types/node`
- [ ] `cd mcp-server && npm install` (**no** `npm --prefix mcp-server install` desde la raíz)
- [ ] `mcp-server/tsconfig.json` con la combinación verificada — incluido `lib: ["ES2023", "DOM"]`, que
      hace falta por la cadena `scheduler.ts → voice.ts` y no por el server (§5 de `research.md`)
- [ ] `src/tools/types.ts` (`ToolDef` + helper de respuesta) y `src/tools/index.ts` (el array)
- [ ] `src/index.ts` con `serveStdio` + `registerTool` sobre el registro
- [ ] `.mcp.json` en la raíz, commiteado, apuntando a `mcp-server/src/index.ts` (AC2)
- [ ] Scripts `test`/`typecheck`/`start` en el server; `mcp:test`/`mcp:typecheck` en la raíz
- [ ] Verificar que el server arranca y lista las tools desde Claude Code (AC1)
- [ ] Confirmar que `.gitignore` no necesita cambios y que **`src/` no importa nada de `mcp-server/`**

## Paso 2 — `describe_piece`
- [ ] `src/render.ts` — ASCII puro: `#` celda, `@` ancla, `.` hueco
- [ ] `tools/describePiece.ts` con schema de zod (`piece` enum de 12, `rotation` 0–3, `mirror`,
      `octave`) y **sin validación a mano** (D4)
- [ ] Importa `rotateN`/`reflect` de `domain/transform.ts`, `notesForRotation`/`midiName` de
      `domain/music.ts`, y `SHAPES`/`ANCHOR_INDEX`/`BASE_MAP`/`CHROMATIC` de `domain/constants/` —
      **nada reimplementado** (AC3)
- [ ] Descripción de la tool con las dos trampas: **la letra es la forma, no el sonido** y **la
      reflexión es invisible en `I T U V W X`**
- [ ] AC4 — `describe_piece("Z", 3, true)` → notas `D#6 C#6 A#5 G#5 F#5`, ancla índice 1 = `[1,1]`,
      ascii `.#\n#@\n#.\n#.`
- [ ] AC5 — las 96 combinaciones: siempre 5 celdas y 5 notas, ninguna falla
- [ ] `src/__tests__/render.test.ts`

## Paso 3 — `check_invariants`
- [ ] `tools/checkInvariants.ts` — envoltorio de `checkAll()` de `domain/invariants.ts`
- [ ] **Iterar sobre lo que devuelve `checkAll()`**, sin lista propia de chequeos: si 005 agrega uno, la
      tool lo expone sin cambios (AC6)
- [ ] Con `piece`, llamar a los `check*` acotados a esa pieza
- [ ] AC6 — los cinco en verde sobre 96 combinaciones

## Paso 4 — `simulate_board`
- [ ] `tools/simulateBoard.ts` — colocación con `cellsAt`/`isValid` de `domain/board.ts` (AC3)
- [ ] Jobs con `ARPEGGIO_SPREAD` de `audio/engine.ts`; línea de tiempo con `collectHits`, `LOOKAHEAD` y
      `TICK_MS` de `audio/scheduler.ts`, en pasos de `TICK_MS` (D7)
- [ ] Agrupar por instante y calcular `coincident.maxPerInstant`
- [ ] AC7 — dos piezas a 110 bpm: **20 onsets, 10 instantes, `maxPerInstant` 2**
- [ ] AC8 — pieza fuera del tablero o solapada: inválida con motivo, y **sin** onsets
- [ ] `src/__tests__/tools.test.ts` — formato de respuesta de un tablero inválido

## Paso 5 — `spec_status`
- [ ] `src/specs.ts` — tabla de `log.md` + checkboxes de cada `tasks.md`, con la lista de specs sacada
      de `readdir` (AC9)
- [ ] Contar aparte las tareas bajo un encabezado `Seguimiento…` y excluirlas de `proxima`
- [ ] AC9 — conteos contra los medidos: 001 → 2/34 · 002 → 43/50 · 003 → 2/36 · 004 → 2/41, y
      seguimiento 4 · 6 · 4 · 5
- [ ] `src/__tests__/specs.test.ts` sobre strings fijos, **no** sobre los archivos del repo (así no se
      rompe cada vez que alguien marca una tarea)

## Verificación
- [ ] `npm run mcp:test` en verde (typecheck + `node --test`) — AC10
- [ ] Las cuatro tools llamadas desde Claude Code, una vez cada una, contra el repo real
- [ ] Argumento inválido (`piece: "Q"`, `rotation: 7`): el error dice qué valores son válidos
- [ ] **Revisar que ninguna regla esté escrita dos veces** (AC3): buscar en `mcp-server/` cualquier
      cálculo de rotación, validez, escala o invariante que debería venir de `src/domain/`
- [ ] **Prueba del import sin extensión**: sacarle el `.ts` a un import de `src/domain/` y confirmar que
      el server falla y `npm run build` de la app **no**. Volver a ponerlo. Verlo una vez vale más que
      leerlo
- [ ] AC11 — medir el antes/después de una pregunta real ("¿qué notas y forma da `Z` en 270° reflejada,
      y qué onsets produce con otra pieza en `x=5`?") y **anotar los números acá**

## Documentación
- [ ] `docs/guides/mcp-domain.md` — setup, catálogo de tools, cuándo preferirlas a leer código
- [ ] `mcp-server/README.md` — comandos, estructura, cómo agregar una tool, advertencia del
      `--prefix install`
- [ ] `CLAUDE.md` — el server, y que **las tools son una fachada sobre `src/domain/`**, no una copia
- [ ] `docs/architecture/directory-structure.md` — `mcp-server/` en el árbol
- [ ] `docs/guides/quickstart.md` — `npm run mcp:test` y el piso de Node 22.18
- [ ] `specs/log.md` — estado de 006 a `Implementado`

## PR
- [ ] Explicar por qué **no** hay índice de símbolos, con la medición de tamaño del repo: es la
      diferencia con el server de bait y la primera pregunta de cualquiera que compare
- [ ] Explicar que las tools **no reimplementan nada** y que eso fue un cambio de diseño: la versión
      anterior de este plan tenía su propio `board.ts`
- [ ] Incluir los números de AC11
- [ ] Nombrar el acoplamiento con el spec 004 (`collectHits` cambia de firma) y que la tool queda como
      su instrumento de verificación
- [ ] `/pr-review` antes de pedir revisión

## Seguimiento (no bloquea)
- [ ] Cuando el spec 004 esté implementado, agregar a `simulate_board` la columna → `phase` y verificar
      que `maxPerInstant` baja a 1 para piezas en columnas distintas
- [ ] Cuando el spec 001 esté implementado, agregar el grado por celda al ASCII de `describe_piece`:
      mostrar qué nota le toca a cada celda es el render que hoy no se puede dibujar
- [ ] Evaluar una tool `find_by_notes` (dadas notas, qué pieza/rotación las produce) — solo si aparece
      la necesidad real
- [ ] Si `CheckResult` termina tipando respuestas de la tool, promoverlo a
      `src/domain/types/invariants.types.ts` (es el umbral de la regla de roles del spec 005)

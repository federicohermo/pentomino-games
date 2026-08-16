# Tareas — MCP server de dominio ejecutable

> **Este spec no toca `src/`.** Si al implementarlo hace falta un export o un módulo nuevo en el
> dominio, es un cambio del [spec 005](../005-modularizacion-de-src-en-capas/spec.md) y va en su commit.
>
> **Pasó exactamente eso, una vez:** `phase = ax / GRID_W` vivía dentro del efecto de reconciliación de
> `App.tsx`, o sea en el único lugar del repo que ni los tests ni node pueden importar. Bajó a
> `phaseFor` en `domain/board.ts` en su propio commit, con sus cuatro tests, y `simulate_board` la
> importa en vez de escribirla por segunda vez.

## Backlog
- [x] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [x] **Esperar las fases 1–3 del spec 005** mergeadas: `src/domain/{transform,pieces,board,music,
      invariants}.ts` con sus `types/`, y `src/audio/{voice,scheduler,engine}.ts`. La fase 4 de 005
      (componentes) **no bloquea**
- [x] Confirmar `node --version` ≥ 22.18 (medido: v22.18.0). Con Node 20 el server no arranca
- [x] **Crear rama** `feature/006-mcp-server-de-dominio-ejecutable`

## Paso 1 — Andamiaje
- [x] `mcp-server/package.json` — `type: module`, `engines.node >= 22.18`, deps
      `@modelcontextprotocol/server@^2.0.0` + `zod@^4.2.0`, devDeps `typescript` + `@types/node`
- [x] Agregar `packages: ['.', 'mcp-server']` al `pnpm-workspace.yaml` de la raíz, y `pnpm install`
      **una sola vez desde la raíz** (el workspace instala los dos paquetes; no hay `cd` ni `--prefix`)
- [x] Confirmar el aislamiento: `zod` y `@modelcontextprotocol/server` están en
      `mcp-server/node_modules` y **no** en el `node_modules` de la raíz
- [x] `mcp-server/tsconfig.json` con la combinación verificada — incluido `lib: ["ES2023", "DOM"]`, que
      hace falta por la cadena `scheduler.ts → voice.ts` y no por el server (§5 de `research.md`)
- [x] `src/tools/types.ts` (`ToolDef` + helper de respuesta) y `src/tools/index.ts` (el array)
- [x] `src/index.ts` con `serveStdio` + `registerTool` sobre el registro
- [x] `.mcp.json` en la raíz, commiteado, apuntando a `mcp-server/src/index.ts` (AC2)
- [x] Scripts `test`/`typecheck`/`start` en el server; `mcp:test`/`mcp:typecheck` en la raíz
- [x] Verificar que el server arranca por stdio y lista las cuatro tools (AC1)
- [x] Confirmar que `.gitignore` no necesita cambios y que **`src/` no importa nada de `mcp-server/`**

## Paso 2 — `describe_piece`
- [x] `src/render.ts` — ASCII puro: `#` celda, `@` ancla, `.` hueco
- [x] `tools/describePiece.ts` con schema de zod (`piece` enum de 12, `rotation` 0–3, `mirror`,
      `octave`) y **sin validación a mano** (D4)
- [x] Importa `rotateN`/`reflect` de `domain/transform.ts`, `notesForRotation`/`midiName` de
      `domain/music.ts`, y `SHAPES`/`ANCHOR_INDEX`/`BASE_MAP`/`CHROMATIC` de `domain/constants/` —
      **nada reimplementado** (AC3)
- [x] Descripción de la tool con las dos trampas: **la letra es la forma, no el sonido** y **la
      reflexión se oye pero no siempre se ve**. Corregido contra la medición: es invisible en `I` y `X`
      (las cuatro rotaciones) y en `T` y `U` (rotaciones 0 y 180°). En `V` y `W` el espejo **sí** cambia
      la forma; lo que no cambia es el conjunto de formas alcanzables, porque cae sobre otra rotación
- [x] AC4 — `describe_piece("Z", 3, true)` → notas `D#6 C#6 A#5 G#5 F#5`, ancla índice 1 = `[1,1]`,
      ascii `.#\n#@\n#.\n#.`
- [x] AC5 — las 96 combinaciones: siempre 5 celdas y 5 notas, ninguna falla
- [x] `src/__tests__/render.test.ts`

## Paso 3 — `check_invariants`
- [x] `tools/checkInvariants.ts` — envoltorio de `checkAll()` de `domain/invariants.ts`
- [x] **Iterar sobre lo que devuelve `checkAll()`**, sin lista propia de chequeos: si 005 agrega uno, la
      tool lo expone sin cambios (AC6)
- [x] Con `piece`, acotar los fallos a esa pieza. **No** llamando a los `check*` con un argumento —no lo
      tienen, y agregárselo sería tocar `src/`—, sino filtrando por el prefijo del mensaje. El filtro
      degrada hacia mostrar de más: si el formato cambia, el fallo se reporta igual en vez de esconderse.
      `ok` sigue siendo el del modelo entero, porque un "todo bien" acotado a una pieza sería engañoso
- [x] AC6 — los cinco en verde sobre 96 combinaciones

## Paso 4 — `simulate_board`
- [x] `tools/simulateBoard.ts` — colocación con `cellsAt`/`isValid` de `domain/board.ts` (AC3)
- [x] Jobs con `ARPEGGIO_SPREAD` de `audio/engine.ts`; línea de tiempo con `collectHits`, `LOOKAHEAD` y
      `TICK_MS` de `audio/scheduler.ts`, en pasos de `TICK_MS` (D7)
- [x] Agrupar por instante y calcular `coincident.maxPerInstant`
- [x] AC7 — dos piezas a 110 bpm. El número del spec se midió **antes** de que el 004 estuviera
      implementado, así que hoy vale con la condición que le faltaba: en la **misma columna** da
      **20 onsets, 10 instantes, `maxPerInstant` 2**; en columnas distintas, **20 instantes y
      `maxPerInstant` 1**. Los dos casos tienen test
- [x] AC8 — pieza fuera del tablero o solapada: inválida con motivo, y **sin** onsets
- [x] `src/__tests__/tools.test.ts` — formato de respuesta de un tablero inválido

## Paso 5 — `spec_status`
- [x] `src/specs.ts` — tabla de `log.md` + checkboxes de cada `tasks.md`, con la lista de specs sacada
      de `readdir` (AC9)
- [x] Contar aparte las tareas bajo un encabezado `Seguimiento…` y excluirlas de `proxima`
- [x] AC9 — conteos verificados contra los `tasks.md` de hoy. Los del spec envejecieron porque 003, 004
      y 005 se implementaron en el medio; el único que quedó idéntico es el que motivaba el AC,
      **002 → 43/50 con 6 de seguimiento**. Hoy: 001 → 3/34 (seg. 4) · 002 → 43/50 (6) ·
      003 → 31/38 (4) · 004 → 32/42 (6) · 005 → 78/87 (6). Que el conteo se mueva es la evidencia de
      que lee los archivos y no una tabla propia
- [x] `src/__tests__/specs.test.ts` sobre strings fijos, **no** sobre los archivos del repo (así no se
      rompe cada vez que alguien marca una tarea)

## Verificación
- [x] `pnpm mcp:test` en verde (typecheck + `node --test`) — AC10
- [x] Las cuatro tools llamadas una vez cada una contra el repo real, **por el protocolo**: un cliente
      stdio mínimo hace `initialize` → `tools/list` → `tools/call`, que es el mismo intercambio que hace
      Claude Code. Lo que **no** se probó desde esta sesión es la UI de Claude Code leyendo `.mcp.json`:
      el server se registra al abrir el repo, así que eso se confirma en la próxima sesión
- [x] Argumento inválido (`piece: "Q"`, `rotation: 7`): el error dice qué valores son válidos
- [x] **Revisar que ninguna regla esté escrita dos veces** (AC3): buscar en `mcp-server/` cualquier
      cálculo de rotación, validez, escala o invariante que debería venir de `src/domain/`
- [x] **Prueba del import sin extensión**: sacarle el `.ts` a un import de `src/domain/` y confirmar que
      el server falla y `pnpm build` de la app **no**. Volver a ponerlo. Verlo una vez vale más que
      leerlo
- [x] AC11 — medido y anotado abajo, en *Resultados medidos*

## Resultados medidos

### AC11 — el antes/después de una pregunta real

*"¿Qué notas y qué forma da la `Z` en 270° reflejada, y qué onsets produce si la pongo en `x=1` y otra
pieza en `x=5`?"*

| | Bytes | ~Tokens |
|---|---|---|
| **Antes** — `domain/{transform,music,board}` + sus `constants/` + `audio/scheduler` + sus constantes | 14.999 | ~3.750 |
| **Después** — `describe_piece` (414) + `simulate_board` (1.189) | **1.603** | **~400** |
| Catálogo de las cuatro tools, una vez por sesión | 4.863 | ~1.215 |

**89% menos por pregunta**, y el catálogo se amortiza con la primera: 4.863 + 1.603 sigue siendo menos
que 14.999. Lo que la tabla no mide es lo que más pesa: leyendo el código la respuesta todavía hay que
**derivarla a mano** —tres rotaciones, un espejo, la escala transpuesta +7, el retrógrado y el recorrido
del lookahead— y nadie avisa si sale mal.

**Un hallazgo lateral, que es la mejor defensa de la tool:** preguntada tal cual estaba escrita —la `Z`
en `x=0`— la respuesta es que **no entra**. Su celda de agarre en la columna 0 empuja el resto de la
pieza a `x=-1`, y `simulate_board` responde `fuera-del-tablero` con el detalle. Es exactamente el error
que una simulación mental comete sin enterarse.

### Costo del catálogo, por tool

| Tool | Bytes de su entrada en `tools/list` |
|---|---|
| `simulate_board` | 1.800 |
| `describe_piece` | 1.599 |
| `check_invariants` | 874 |
| `spec_status` | 590 |

### `spec_status` contra leer los archivos

24.027 bytes de `log.md` + los `tasks.md`, contra **3.133 bytes** de respuesta con los seis specs. Es la
tool que menos ahorra en proporción a lo que responde, y entró igual porque costaba un parseo de
checkboxes.

### Arranque

`node mcp-server/src/index.ts` levanta y responde `initialize` sin demora perceptible; el sobrecosto del
type-stripping medido en el `research.md` (~50–70 ms) se paga una vez por sesión de stdio.

## Documentación
- [x] `docs/guides/mcp-domain.md` — setup, catálogo de tools, cuándo preferirlas a leer código
- [x] `mcp-server/README.md` — comandos, estructura, cómo agregar una tool
- [x] `CLAUDE.md` — el server, y que **las tools son una fachada sobre `src/domain/`**, no una copia
- [x] `docs/architecture/directory-structure.md` — `mcp-server/` en el árbol
- [x] `docs/guides/quickstart.md` — `pnpm mcp:test` y el piso de Node 22.18
- [x] `specs/log.md` — estado de 006 a `Implementado`

## PR

> Abierto: [#5](https://github.com/federicohermo/pentomino-games/pull/5)

- [x] Explicar por qué **no** hay índice de símbolos, con la medición de tamaño del repo: es la
      diferencia con el server de bait y la primera pregunta de cualquiera que compare
- [x] Explicar que las tools **no reimplementan nada** y que eso fue un cambio de diseño: la versión
      anterior de este plan tenía su propio `board.ts`
- [x] Incluir los números de AC11
- [x] Nombrar el acoplamiento con el spec 004 (`collectHits` cambia de firma) y que la tool queda como
      su instrumento de verificación
- [ ] `/pr-review` antes de pedir revisión — el skill del repo apunta a Bitbucket y este PR está
      en GitHub ([#5](https://github.com/federicohermo/pentomino-games/pull/5)), así que queda pendiente
      elegir con qué revisarlo

## Seguimiento (no bloquea)
- [x] Cuando el spec 004 esté implementado, agregar a `simulate_board` la columna → `phase` y verificar
      que `maxPerInstant` baja a 1 para piezas en columnas distintas — **hecho**: el 004 ya estaba
      implementado al arrancar este spec, la fase sale de `phaseFor` y los dos casos tienen test
- [ ] Cuando el spec 001 esté implementado, agregar el grado por celda al ASCII de `describe_piece`:
      mostrar qué nota le toca a cada celda es el render que hoy no se puede dibujar
- [ ] Evaluar una tool `find_by_notes` (dadas notas, qué pieza/rotación las produce) — solo si aparece
      la necesidad real
- [ ] Si `CheckResult` termina tipando respuestas de la tool, promoverlo a
      `src/domain/types/invariants.types.ts` (es el umbral de la regla de roles del spec 005)

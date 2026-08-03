# Plan 006 — Diseño técnico del MCP server de dominio ejecutable

## Layout

```
pentomino-games/
├── .mcp.json                      ← NUEVO (commiteado) — registra el server
├── src/                           ← NO SE TOCA. Lo entrega el spec 005
│   ├── domain/{transform,pieces,board,music,invariants}.ts + types/
│   └── audio/{voice,scheduler,engine}.ts + types/
└── mcp-server/                    ← NUEVO — paquete aislado, deps propias, sin build
    ├── package.json
    ├── tsconfig.json
    ├── README.md
    └── src/
        ├── index.ts               entrypoint: serveStdio + registro de tools
        ├── render.ts              ASCII de una pieza (puro)
        ├── specs.ts               parseo de log.md y de los tasks.md
        ├── tools/
        │   ├── index.ts           el array de tools; una línea por tool
        │   ├── types.ts           el tipo ToolDef y el helper de respuesta
        │   ├── describePiece.ts
        │   ├── simulateBoard.ts
        │   ├── checkInvariants.ts
        │   └── specStatus.ts
        └── __tests__/
            ├── render.test.ts
            ├── specs.test.ts
            └── tools.test.ts      formato de respuesta: tablero inválido, pieza inexistente
```

**Lo que no está en este árbol y en la versión anterior sí: `mcp-server/src/board.ts`.** Se eliminó al
separar el spec 005 — la colocación y la validez son `domain/board.ts` y el server las importa (D2). Por
el mismo motivo no hay módulo de invariantes propio: `checkInvariants.ts` es un envoltorio de
`checkAll()`.

`mcp-server/` es un paquete aparte para que `@modelcontextprotocol/server` y `zod` **no entren a las
deps de la app**. La dirección de dependencia es una sola: `mcp-server/` importa de `src/`, nunca al
revés (AC1).

**El aislamiento lo da pnpm, no la disciplina.** El repo migró a pnpm, así que `mcp-server/` entra como
segundo paquete del workspace: en `pnpm-workspace.yaml` de la raíz se agrega

```yaml
packages:
  - '.'
  - 'mcp-server'
```

y con eso `zod` y el SDK viven en `mcp-server/node_modules` y **no** aparecen en la raíz. Verificado
sobre un prototipo de este mismo layout: `ls node_modules | grep zod` en la raíz no devuelve nada. Con
npm el aislamiento dependía de acordarse de no instalar en el lugar equivocado; acá lo garantiza el
gestor.

**Hay un solo lockfile**, el `pnpm-lock.yaml` de la raíz, que cubre los dos paquetes. `mcp-server/` no
tiene lockfile propio.

`.gitignore` **no se toca**: `node_modules` sin barra ya matchea a cualquier profundidad —incluido
`mcp-server/node_modules`, que pnpm también crea— y sin build no hay `dist/` que ignorar.

## Stack

- **Runtime:** Node ≥ 22.18 (type-stripping nativo), ES modules, TypeScript sin compilar.
- **MCP:** `@modelcontextprotocol/server@^2.0.0` — `McpServer` + `registerTool` + `serveStdio`.
- **Schemas:** `zod@^4.2.0` (dependencia declarada, no transitiva). La validación la hace el SDK.
- **Dev:** `typescript` + `@types/node` para el typecheck; nada más.
- **Tests:** `node --test` sobre `src/**/*.test.ts`. Sin runner nuevo.

`mcp-server/tsconfig.json` — combinación verificada (§5 de `research.md`):

```jsonc
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM"],           // DOM por los tipos de Web Audio de src/audio/, no por el server
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "types": ["node"],
    "strict": true,
    "noEmit": true,                      // no hay build: node corre el .ts
    "allowImportingTsExtensions": true,  // los specifiers llevan .ts
    "erasableSyntaxOnly": true,          // garantía para el type-stripping
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src/**/*.ts"]
}
```

El `DOM` en `lib` es contraintuitivo y hay que dejarlo escrito: sin él son **8 errores TS2304**
(`AudioContext`, `BaseAudioContext`, `AudioNode`, `GainNode`, `OscillatorType`, `window`), porque el
server typechequea la cadena `scheduler.ts → voice.ts`, que declara tipos de Web Audio. En runtime nada
de eso existe: los tipos se borran y `collectHits` es aritmética.

## Contrato de las tools

Todas devuelven **JSON serializado como texto**, sin sello de frescura: no hay índice que pueda estar
viejo. Las salidas de abajo son **reales**, generadas corriendo las puras y el `collectHits` de hoy.

### `describe_piece`

```
input:   { piece: enum(12), rotation?: 0|1|2|3 = 0, mirror?: boolean = false, octave?: number = 4 }
importa: domain/transform.ts · domain/music.ts · domain/constants/{pieces,music}.constants.ts
```

```jsonc
{
  "piece": "Z", "rotation": 3, "mirror": true, "octave": 4,
  "tonic": "B", "tonicPc": 11,
  "scale": "pentatónica mayor transpuesta +7 (rotación 270°)",
  "cells": [[1,0],[1,1],[0,1],[0,2],[0,3]],   // el índice k es la misma celda lógica que en SHAPES
  "anchorIndex": 1, "anchor": [1,1],
  "size": { "width": 2, "height": 4 },
  "ascii": ".#\n#@\n#.\n#.",                   // '#' celda, '@' celda de agarre, '.' hueco
  "notes": [
    { "midi": 87, "name": "D#6" }, { "midi": 85, "name": "C#6" }, { "midi": 82, "name": "A#5" },
    { "midi": 80, "name": "G#5" }, { "midi": 78, "name": "F#5" }
  ],
  "retrograde": true
}
```

Dos advertencias que la descripción de la tool tiene que llevar, porque son las trampas medidas:

- **La letra es la forma, no el sonido.** La pieza `F` suena en `C`; la nota `F` es de la pieza `T`.
- **La reflexión no siempre cambia la forma**: en `I`, `T`, `U`, `V`, `W` y `X` es geométricamente
  invisible y sigue invirtiendo las notas.

`render.ts` es lo único propio: puro sobre `Cell[]` + índice de ancla → string, con test propio.

### `simulate_board`

```
input:   { pieces: [{ piece, rotation?, mirror?, at: [x, y] }], bpm? = 110, bars? = 2 }
importa: domain/{transform,pieces,board,music}.ts · audio/scheduler.ts · audio/engine.ts (ARPEGGIO_SPREAD)
```

Tres etapas, en el mismo orden que la app y **con las mismas funciones**:

1. **Colocación** — `cellsAt(shape, anchorIndex, x, y)` e `isValid(cells, placed)` de
   `domain/board.ts`. Reporta el motivo (`fuera-del-tablero`, `choque-con-<id>`), y **la pieza inválida
   no aporta onsets** (AC8).
2. **Jobs** — lo que crearía el efecto de reconciliación: `{ id, notes, spread: ARPEGGIO_SPREAD }`.
3. **Línea de tiempo** — bucle sobre `collectHits(t, LOOKAHEAD, bpm, jobs, state)` avanzando `t` en
   pasos de `TICK_MS`, igual que `tick()` (D7). Acumula y agrupa por instante.

```jsonc
{
  "bpm": 110, "barSeconds": 2.1818, "bars": 2,
  "placements": [
    { "id": "1", "piece": "F", "cells": [[1,1],[2,0],[2,1],[2,2],[3,2]], "valid": true },
    { "id": "2", "piece": "Z", "cells": [[5,1],[6,1],[6,0],[7,0],[8,0]], "valid": true }
  ],
  "onsets": { "total": 20, "distinctInstants": 10 },
  "timeline": [
    { "at": 0.0500, "count": 2, "notes": ["C4", "B4"] },
    { "at": 0.2000, "count": 2, "notes": ["D4", "C#5"] },
    { "at": 0.3500, "count": 2, "notes": ["E4", "D#5"] }
    // …
  ],
  "coincident": { "instants": 10, "maxPerInstant": 2 }
}
```

Los números son los medidos con dos piezas a 110 bpm: **20 onsets en 10 instantes, todos de
multiplicidad 2**. Es el problema del
[spec 004](../004-fase-por-pieza-la-columna-como-posicion-en-el-compas/spec.md) expresado como número:
agregar una pieza no agrega eventos, duplica los que ya había (AC7). Cuando 004 esté implementado,
`maxPerInstant` tiene que bajar a 1 para piezas en columnas distintas — y esta tool es el instrumento
para verificarlo.

### `check_invariants`

```
input:   { piece?: enum(12) }
importa: domain/invariants.ts
```

Es un envoltorio: llama a `checkAll()` (o a los `check*` individuales si viene `piece`) y formatea. **Si
el spec 005 agrega un sexto chequeo, la tool lo expone sin cambios** — itera sobre lo que devuelve
`checkAll()`, no sobre una lista propia (AC6).

```jsonc
{
  "checked": { "pieces": 12, "combinations": 96 },
  "ok": true,
  "checks": [
    { "name": "arrayOrder", "ok": true, "failures": [] },
    { "name": "anchor",     "ok": true, "failures": [] },
    { "name": "shapes",     "ok": true, "failures": [] },
    { "name": "baseMap",    "ok": true, "failures": [] },
    { "name": "notes",      "ok": true, "failures": [] }
  ]
}
```

Los cinco pasan hoy (valores de referencia en el `research.md` del spec 005). El cuidado con `-0` vive
en `domain/invariants.ts`, no acá: es del 005.

### `spec_status`

```
input: {}
lee:   specs/log.md + specs/*/tasks.md (con readdir, sin hardcodear la lista)
```

`specs.ts` parsea la tabla de `log.md` (número, fecha, estado, descripción) y los checkboxes de cada
`tasks.md` (`- [x]` / `- [ ]`, incluidos los anidados).

Conteos de hoy, medidos: **001 → 2/34 · 002 → 43/50 · 003 → 2/36 · 004 → 2/41.**

```jsonc
{
  "specs": [
    { "id": "001", "estado": "Propuesto", "titulo": "Notas por celda en orden angular",
      "tareas": { "hechas": 2, "total": 34, "seguimiento": 4 },
      "proxima": "Crear rama feature/001-notas-por-celda-en-orden-angular" },
    { "id": "002", "estado": "Implementado", "titulo": "Motor de audio propio sobre Web Audio",
      "tareas": { "hechas": 43, "total": 50, "seguimiento": 6 },
      "proxima": "Escuchar y confirmar que el cambio de timbre es aceptable" }
  ],
  "totales": { "specs": 6, "implementados": 1, "propuestos": 5 }
}
```

**El 43/50 del spec 002 muestra por qué hace falta contar aparte:** está `Implementado` y tiene 7 tareas
sin marcar. **Seis** son de su sección *"Seguimiento (no bloquea)"* —deuda anotada a propósito— y
**una** es una verificación manual real ("escuchar y confirmar el timbre"). Un conteo plano leería 86% y
no distinguiría una cosa de la otra. El parseo separa las tareas bajo un encabezado que empiece con
`Seguimiento`, las reporta en su propio campo y las excluye de `proxima` — que así queda apuntando a la
única pendiente que importa. Medido: las secciones de seguimiento tienen 4 · 6 · 4 · 5 tareas en los
specs 001–004.

Es la única tool que no es de dominio y la que menos ahorra: 24 KB de `log.md` + `tasks.md` contra una
respuesta de ~600 bytes. Entra porque el costo de escribirla es un parseo de checkboxes.

## Entrypoint

```ts
// mcp-server/src/index.ts
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { tools } from "./tools/index.ts";

serveStdio(() => {
  const server = new McpServer(
    { name: "pentomino-domain", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
  for (const t of tools) {
    server.registerTool(t.name, { description: t.description, inputSchema: t.inputSchema }, t.run);
  }
  return server;
});
```

`ToolDef` (en `tools/types.ts`) es nombre + descripción + schema de zod + handler. **No** lleva
validación propia: la hace el SDK contra el schema (D4). El handler devuelve
`{ content: [{ type: "text", text: json(x) }] }`; los errores esperables van como texto con
`isError: true` y con la salida adentro ("la pieza `Q` no existe; las 12 son F I L N P T U V W X Y Z").

**`.mcp.json`** (commiteado, en la raíz):

```json
{
  "mcpServers": {
    "pentomino-domain": {
      "command": "node",
      "args": ["mcp-server/src/index.ts"]
    }
  }
}
```

Sin `dist/` y sin `tsx`: node 22.18 corre el `.ts` (D3). Si alguien está en Node 20, el server no
arranca y el repo sigue igual.

## Scripts

En `mcp-server/package.json`:

```jsonc
{
  "type": "module",
  "engines": { "node": ">=22.18" },
  "scripts": {
    "start": "node src/index.ts",
    "typecheck": "tsc",                                       // noEmit está en el tsconfig
    "test": "pnpm run typecheck && node --test \"src/**/*.test.ts\""
  }
}
```

En el `package.json` de la raíz, delegaciones para no entrar a la carpeta:

```jsonc
"mcp:test": "pnpm --filter mcp-server test",
"mcp:typecheck": "pnpm --filter mcp-server typecheck"
```

**El `install` es uno solo y desde la raíz**: `pnpm install` instala los dos paquetes del workspace. No
hay que entrar a `mcp-server/` ni pasar prefijos.

Esto era una trampa con npm y dejó de serlo: `npm --prefix mcp-server install` desde la raíz le agregaba
una dependencia `file:..` al `package.json` del server y le ensuciaba el lockfile —bug del subcomando
`install`, no de `run`—, así que el plan anterior obligaba a un `cd mcp-server && npm install`. Con el
workspace de pnpm el problema no existe: verificado sobre un prototipo de este layout, un `pnpm install`
desde la raíz deja el `package.json` del server intacto, sin `file:..`.

## Fases

0. **Esperar las fases 1–3 del [spec 005](../005-modularizacion-de-src-en-capas/spec.md)** (tipos,
   dominio, tablero, invariantes, audio en tres módulos). La fase 4 de 005 —los componentes— no bloquea.
1. **Andamiaje.** `mcp-server/` con package/tsconfig/README, entrypoint que arranca por stdio y lista
   una tool trivial. Verificar el registro con Claude Code vía `.mcp.json` (AC1, AC2).
2. **`describe_piece` + `render.ts`.** Es la tool de mayor ahorro y la que valida el diseño del
   `ToolDef`. Tests de render y AC4/AC5.
3. **`check_invariants`.** Envoltorio de `checkAll()`. Es la tool más chica del spec, justamente porque
   la lógica ya vive en `src/` (AC6).
4. **`simulate_board`.** Colocación con `domain/board.ts` y línea de tiempo con `audio/scheduler.ts`
   (AC7, AC8).
5. **`spec_status` + `specs.ts`.** (AC9)
6. **Docs y medición.** `docs/guides/mcp-domain.md`, filas en `CLAUDE.md` y en
   `docs/architecture/directory-structure.md`, y el antes/después de AC11 anotado en `tasks.md`.

Las fases 2 a 5 son independientes: cada una es un archivo nuevo más una línea en `tools/index.ts`. Se
pueden mergear sueltas.

## Qué queda documentado dónde

| Archivo | Qué se agrega |
|---|---|
| `docs/guides/mcp-domain.md` (nuevo) | setup en ≤10 líneas, catálogo de tools, cuándo preferirlas a leer código |
| `CLAUDE.md` | sección corta: existe el server, qué responde, y que **no reimplementa nada** — las tools son una fachada sobre `src/domain/` |
| `docs/architecture/directory-structure.md` | `mcp-server/` en el árbol de la raíz; fila en "dónde crear cada cosa" |
| `docs/guides/quickstart.md` | `pnpm mcp:test` y el piso de Node 22.18 |
| `mcp-server/README.md` | comandos, estructura y cómo agregar una tool |
| `specs/log.md` | estado de 006 |

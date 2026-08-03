# Research 006 — MCP server de dominio ejecutable

Todo lo de acá está **medido**, no supuesto. Los comandos que produjeron cada número están citados.

## 1. La referencia: qué es el server de `bait-landing-frontend`

`raw/repos/bait-landing-frontend/mcp-server/` — 1.279 líneas de TypeScript, spec 026 de ese repo,
implementado y con ahorro medido (**80.8% agregado, 90–95% en queries puntuales**).

| Capa | Archivos | Qué hace |
|---|---|---|
| Modelo/config | `model.ts`, `config.ts` | tipos puros del grafo, rutas del repo |
| Indexado | `indexer/{project,symbols,imports,references,routes}.ts` + `index.ts` | `ts-morph` → `.index/graph.json` |
| Consulta | `graph.ts` (`GraphView`, `loadGraph`) | carga el JSON en memoria, lookups por Map |
| Tools | `tools/*.ts` + `tools/index.ts` | 5 tools: `search_symbol`, `who_uses`, `get_module_context`, `get_route_map`, `compare_versions` |
| Entrypoint | `index.ts` | `Server` low-level + `StdioServerTransport`, deriva `ListTools`/`CallTool` del registro |

**Lo que se hereda tal cual:**

- Paquete aislado con sus propias deps, para que el tooling no entre al bundle de la app.
- `.mcp.json` commiteado en la raíz → cualquiera que abra el repo hereda el server.
- Un archivo por tool con nombre, descripción, schema y handler **colocados**, más un `index.ts` que
  es solo un array. Agregar una tool no toca el entrypoint.
- Tests fuera de `src/`, con su propio tsconfig.
- Descripciones de tools escritas por intención (*"usar en lugar de grep para…"*), no por mecanismo.
- Errores con instrucción de salida, no solo diagnóstico ("regeneralo con: `npm run index`").

**Lo que no se hereda, y por qué:** todo el eje del índice (§2), la validación de argumentos a mano
(§6) y el paso de build (§5).

## 2. Por qué el índice no se justifica acá

El costo que ataca bait es localizar en **~135 archivos** con 11 versiones espejadas. Este repo:

```
$ find src -type f | wc -l   →  8
$ wc -l src/**/*.ts*         →  855 líneas
$ cat src/App.tsx src/audio/engine.ts | wc -c   →  25.189 bytes  (~6,3k tokens)
```

| | bait-landing-frontend | pentomino-games |
|---|---|---|
| Archivos en `src/` | ~135 | **8** |
| Duplicación estructural | 11 versiones espejadas | ninguna |
| Costo de "¿dónde está X?" | decenas de reads | un `grep`, o leer `src/` entero |
| Preguntas del tipo "quién usa X" | constantes | ~1 consumidor por símbolo |

Un `search_symbol` sobre 8 archivos compite contra `grep`, y pierde: cuesta un índice, un
`npm run index` que hay que acordarse de correr, staleness, un `generatedAt` que sellar en cada
respuesta y dos clases de error (`IndexMissingError`, `IndexUnreadableError`) que existen solo por
el índice. **Copiar el diseño literal traería el 100% del precio para un ahorro de ~0.**

Lo que sí es caro acá está en el §3.

## 3. Lo caro medido: el dominio, no su ubicación

Se corrieron las puras de `App.tsx` (copia literal en un script aparte) sobre las **96
combinaciones** de 12 piezas × 4 rotaciones × mirror:

**Orientaciones geométricas distintas por pieza**

| Pieza | F | I | L | N | P | T | U | V | W | X | Y | Z |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| solo rotación | 4 | **2** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **1** | 4 | 4 |
| rotación + mirror | 8 | **2** | 8 | 8 | 8 | **4** | **4** | **4** | **4** | **1** | 8 | 8 |

96 entradas → **67 formas distintas**. Consecuencias que no se leen en el código:

- **`X` tiene una sola forma y cuatro escalas.** Rotarla no cambia nada visible y cambia todo lo
  audible.
- **En `I`, `T`, `U`, `V`, `W` y `X` la reflexión no cambia la forma**, pero sí invierte el orden de
  las notas. Hay 6 piezas donde el botón "Reflexión" se oye y no se ve.
- Es material para el [spec 001](../001-notas-por-celda-en-orden-angular/spec.md): mientras la forma
  no determine nada, estas asimetrías quedan inexplicadas para el usuario.

**Música**

```
siempre ascendentes: true | siempre 5 distintas: true
ámbito (semitonos) min/max: 7 / 10
F r0 → C4 D4 E4 G4 A4   |   T r0 → F4 G4 A4 C5 D5   |   Z r0 → B4 C#5 D#5 F#5 G#5
Z r3 → F#5 G#5 A#5 C#6 D#6   → con mirror: D#6 C#6 A#5 G#5 F#5
BASE_MAP: 12 clases distintas, cubre 0..11
```

Los tres ejemplos muestran la trampa que CLAUDE.md ya advierte: la **pieza** `T` suena en `F`. Un
agente que responda de memoria la confunde; una tool que ejecute `BASE_MAP` no.

**Invariantes**

```
orden preservado en 12x4x2: true
no-5-celdas: []  |  no-conexas: []  |  con celdas repetidas: []
```

Los cinco invariantes del AC6 **pasan hoy**. Ese es el valor de referencia contra el que la tool
detecta regresiones. Y no hay ni un test que los cubra: los 17 tests del repo son todos de
`src/audio/engine.test.ts`.

**Costo del estado del trabajo planificado**

```
$ wc -c specs/log.md specs/*/tasks.md   →  24.027 bytes
```

## 4. Qué se puede cargar desde node hoy

Node instalado: **v22.18.0** → ejecuta TypeScript quitando los tipos, sin `tsc` ni `tsx`.

**`engine.ts` se carga tal cual, sin build y sin Vitest:**

```
$ node _probe.ts     # import { collectHits } from "./src/audio/engine.ts"
hits: [{"hz":262,"at":1},{"hz":294,"at":1.15},{"hz":330,"at":1.3}]
nextBar: 3.1818181818181817 | midiToHz(69): 440
```

`collectHits` corrió contra el `engine.ts` real y devolvió los onsets de un job de 3 notas, con el
cursor avanzado un compás (2.1818 s a 110 bpm). **`simulate_board` es viable con el código de hoy.**

**`App.tsx` no se carga, y no es cuestión de configuración:**

```
$ node _probe-app.ts     # import App from "./src/App.tsx"
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".tsx"
```

El type-stripping de node no transforma JSX. Sumado a que las puras no están exportadas, hoy son
inalcanzables desde cualquier proceso que no sea Vite. **De acá sale la dependencia del
[spec 005](../005-modularizacion-de-src-en-capas/spec.md)**: la modularización de `src/` no es un
prerrequisito estético de este server, es la condición material para que exista. Este spec no la hace ni
la discute; la consume.

**Los specifiers necesitan la extensión `.ts`:**

```
import { SHAPES } from "./geometry"      → ERR_MODULE_NOT_FOUND
import { SHAPES } from "./geometry.ts"   → ok
```

El repo ya está preparado para eso: `tsconfig.app.json` tiene `allowImportingTsExtensions: true`, y
también `erasableSyntaxOnly: true`, que es justo la garantía que el type-stripping necesita (sin
`enum` ni parameter properties). Vite resuelve los `.ts` explícitos sin cambios.

**Contrapartida a documentar:** un import sin extensión dentro de `src/domain/` rompe el server y
**no** rompe la app. Es un modo de falla asimétrico — de ahí la regla de convenciones y el riesgo
anotado en el spec.

**Arranque medido** (`Measure-Command`, 3 corridas): **92–115 ms** para `node archivo.ts`, contra
**41–56 ms** de `node -e "1"`. El sobrecosto del stripping es de ~50–70 ms, una vez por sesión de
stdio. Irrelevante.

## 5. Typecheck: la combinación que hay que usar

Se probó el tsconfig del server contra un archivo que importa `src/audio/engine.ts` con la
profundidad real (`mcp-server/src/tools/x.ts` → `../../../src/audio/engine.ts`), usando el
TypeScript del repo (5.8.3):

| `lib` | Resultado |
|---|---|
| `["ES2023"]` | **8 errores TS2304**: `AudioContext`, `BaseAudioContext`, `AudioNode`, `GainNode`, `OscillatorType`, `window` |
| `["ES2023", "DOM"]` | **exit 0** |

Es contraintuitivo y hay que dejarlo escrito: **el server necesita `DOM` en `lib` aunque nunca toque
el DOM**, porque typechequea un módulo que declara tipos de Web Audio. `types: ["node"]` +
`skipLibCheck: true` conviven sin conflicto. En runtime nada de eso existe: los tipos se borran y
`collectHits` es aritmética.

La medición se hizo contra el `engine.ts` monolítico de hoy. Después del spec 005 la cadena que el server
typechequea es `scheduler.ts → voice.ts`, y **`voice.ts` es justamente el módulo que se queda con
`BaseAudioContext`, `AudioNode` y `OscillatorType`**, así que la necesidad de `DOM` no cambia. Lo que sí
mejora es el runtime: importar `scheduler.ts` ya no arrastra el módulo de los singletons.

El resto de la combinación verificada: `module`/`moduleResolution: nodenext`, `noEmit: true`,
`allowImportingTsExtensions: true`, `erasableSyntaxOnly: true`, `verbatimModuleSyntax: true`,
`strict: true`, `noUnusedLocals`/`noUnusedParameters`.

**`.gitignore` no necesita cambios**: la línea `node_modules` (sin barra) ya matchea a cualquier
profundidad, y sin build no hay `dist/` del server que ignorar. bait tuvo que agregar tres entradas;
acá, cero.

## 6. El SDK: qué versión y qué API

```
$ npm view @modelcontextprotocol/sdk version      →  1.30.0
$ npm view @modelcontextprotocol/server version   →  2.0.0   (publicado 2026-07-28)
$ npm view @modelcontextprotocol/server engines dependencies
  engines: { node: ">=20" }
  dependencies: { zod: "^4.2.0", "@modelcontextprotocol/core": "2.0.0" }
```

Hay dos generaciones vivas. bait usa la v1 (`@modelcontextprotocol/sdk` 1.29.0 instalada) con el
server **low-level**: `new Server(...)` + `setRequestHandler(ListToolsRequestSchema | CallToolRequestSchema)`.
La v2 partió el paquete y expone `McpServer` + `registerTool` + `serveStdio`, con schemas de zod
(incluida como dependencia) y validación hecha por el SDK.

Verificado en los `.d.mts` instalados de `@modelcontextprotocol/server@2.0.0`: exporta `McpServer`,
`Server` (low-level, todavía), y en `./stdio` exporta `serveStdio(factory, options?)` y
`StdioServerTransport`. Patrón mínimo documentado:

```ts
serveStdio(() => {
  const server = new McpServer({ name: '…', version: '1.0.0' }, { capabilities: { tools: {} } });
  server.registerTool('describe_piece', { description: '…', inputSchema: z.object({ … }) }, handler);
  return server;
});
```

**Consecuencia de diseño:** las 67 líneas de `tools/types.ts` de bait —`requireString`,
`optionalEnum`, `MissingArgumentError`, `InvalidArgumentError`— existen porque el server low-level no
valida. Su propio comentario lo dice: sin ese chequeo un argumento faltante degrada a `""` y
`search_symbol` matchea todo por substring vacío. Con zod eso no pasa. Se hereda **el problema
conocido**, no el código.

## 7. Tests: `node --test` sobre `.ts`, y la trampa del `-0`

```
$ node --test "__tests__/**/*.test.ts"
# tests 2  # pass 1  # fail 1  # duration_ms 119
```

Corre TypeScript sin transpilador ni dependencia nueva (los imports, con `.ts` explícito). El test
que falló lo hizo por un motivo que vale registrar:

```
Expected values to be strictly deep-equal:
  [ [ 0, +  -0
           -  0  ], … ]
```

`rotate90` es `[x,y] → [y,-x]` y `reflect` es `[x,y] → [-x,y]`: con `x = 0` producen **`-0`**, y
`assert.deepStrictEqual` distingue `-0` de `0`. `normalize` lo borra después (`0 - (-0) === 0`), y
`JSON.stringify(-0)` es `"0"`, así que la app y las respuestas de las tools no lo ven nunca — pero
**los tests y `check_invariants` sí**, si comparan celdas crudas. De ahí AC7.

Verificado que los `include` no se solapan: Vitest corre `src/**/*.test.{ts,tsx}` —o sea, dentro de
`src/` del repo— y el server corre `mcp-server/src/**/*.test.ts` con `node --test`. Los tests del server
van en `mcp-server/src/__tests__/`, siguiendo la convención de roles que fija el spec 005, y no en la
raíz del paquete como en bait: allá el motivo era mantenerlos fuera de `dist/`, y acá no hay `dist/`.

## 8. Qué le pide este spec al 005, exactamente

Las puras que el server necesita son las **líneas 23–99 de `App.tsx`: 77 líneas, 3.114 bytes** — hoy sin
exportar y dentro de un `.tsx`. El spec 005 las convierte en módulos; acá queda anotado **qué consume
este server**, para que el acoplamiento sea explícito y no se descubra al implementar:

| Módulo del spec 005 | Qué usa este server | Para qué tool |
|---|---|---|
| `domain/transform.ts` | `rotateN`, `reflect` | `describe_piece`, `simulate_board` |
| `domain/constants/pieces.constants.ts` | `SHAPES`, `ANCHOR_INDEX` | las dos |
| `domain/constants/board.constants.ts` | `GRID_W`, `GRID_H` | `simulate_board` |
| `domain/constants/music.constants.ts` | `BASE_MAP`, `CHROMATIC`, `DEFAULT_OCTAVE` | las dos |
| `domain/board.ts` | `cellsAt`, `isValid` | `simulate_board` |
| `domain/music.ts` | `notesForRotation`, `midiName` | las dos |
| `domain/invariants.ts` | `checkAll` | `check_invariants` |
| `audio/scheduler.ts` | `collectHits` | `simulate_board` |
| `audio/constants/scheduler.constants.ts` | `LOOKAHEAD`, `TICK_MS` | `simulate_board` |
| `audio/constants/engine.constants.ts` | `ARPEGGIO_SPREAD`, `DEFAULT_BPM` | `simulate_board` |
| `audio/types/scheduler.types.ts` | `Job`, `ClockState` | `simulate_board` |

**La separación `constants/` del spec 005 le sirve directo a este server:** las tablas de datos se
importan sin arrastrar una sola función, y `DEFAULT_BPM` deja de ser un `110` escrito en dos lados, así
que el default de `simulate_board` sale del mismo lugar que el de la app.

**El cambio de diseño que produjo separar el 005:** la versión anterior de este plan tenía un
`mcp-server/src/board.ts` con su propia colocación y validez, porque las de la app estaban atrapadas
dentro del componente. Eso eran **dos copias de la regla del juego**. Con `domain/board.ts` existiendo,
el server importa y no reimplementa (AC3), y `check_invariants` se reduce a un envoltorio de `checkAll()`.

Lo único que sigue siendo propio del server: el render ASCII, el parseo de los specs y el formato de las
respuestas. Nada de eso es dominio.

## 9. Decisiones que entran al `plan.md`

1. Ejecutar el dominio, no indexarlo. Sin `.index/`, sin `ts-morph`, sin staleness (§2).
2. **Depender del spec 005** en vez de extraer nada: este spec no toca `src/` (§4, §8).
3. **Cero reimplementación**: las tools importan de `src/domain/` y `src/audio/`; el server solo aporta
   render, parseo y formato (§8).
4. Sin build: `.mcp.json` corre `node mcp-server/src/index.ts`. Piso Node ≥ 22.18 para el server (§4).
5. `@modelcontextprotocol/server@^2.0.0` + `zod@^4.2.0`, `McpServer` + `registerTool` + `serveStdio`.
   Sin capa de validación propia (§6).
6. Registro de tools heredado de bait: un archivo por tool + un array en `tools/index.ts` (§1).
7. `lib: ["ES2023", "DOM"]` en el tsconfig del server, aunque no toque el DOM (§5).
8. Tests con `node --test` en `mcp-server/src/__tests__/`; Vitest sigue siendo el runner de `src/` (§7).

# Spec 006 — MCP server: el dominio ejecutable, no el código indexado

> Sin ticket: este repo no tiene tablero. Ver [`specs/README.md`](../README.md).
>
> **Depende del [spec 005](../005-modularizacion-de-src-en-capas/spec.md)**, y fuerte: sin
> `src/domain/` y `src/audio/scheduler.ts` como módulos importables no hay nada que este server pueda
> ejecutar. Node no carga `.tsx` y las puras de `App.tsx` no están exportadas.
>
> **Modelado sobre `bait-landing-frontend/mcp-server`** (spec 026 de ese repo). Se hereda el
> andamiaje —paquete aislado con sus propias deps, transporte stdio, `.mcp.json` commiteado, un archivo
> por tool con schema y handler colocados— y se **cambia la capa de datos**: allá el server indexa el
> código con `ts-morph`, acá **ejecuta el dominio**. El §2 de [`research.md`](./research.md) mide por
> qué copiar el índice no serviría a esta escala.

## Problema

Un agente que trabaja este repo no gasta tokens en **localizar** código. Gasta en **simular el
dominio**.

Localizar es gratis acá: `src/` son 8 archivos y 855 líneas (25 KB entre `App.tsx` y `engine.ts`).
Cualquier "¿dónde está X?" se resuelve con un `grep`. Lo caro es responder **qué produce el modelo**:

| Pregunta recurrente | Cómo se responde hoy | Costo |
|---|---|---|
| ¿Qué notas suenan con la pieza `Z` rotada 270° y reflejada? | leer el módulo de música y ejecutar `notesForRotation` a mano, incluido el corrimiento de octava | ~3.9k tokens **y una simulación mental de la que nadie avisa si sale mal** |
| ¿Qué forma tiene la `F` rotada 180°? ¿dónde queda su celda de agarre? | componer `normalize ∘ rotate90` dos veces sobre 5 pares de coordenadas, a mano | idem |
| ¿Un tablero dado suena cómo? ¿qué onsets produce? | leer el scheduler y recorrer el lookahead a mano | ~2.4k tokens, sin garantía de haberlo recorrido bien |
| ¿Siguen valiendo los invariantes del modelo? | correr los tests que escribe el spec 005 — si te acordás de que existen | — |
| ¿En qué estado está el trabajo planificado? | leer `log.md` + los `tasks.md` | 24 KB |

Y hay cosas del modelo que **no se ven leyéndolo**. Corriéndolo sobre las 96 combinaciones (12 piezas ×
4 rotaciones × mirror) aparece esto (medido, §3 de `research.md`):

- Las 96 combinaciones producen solo **67 formas distintas**. Para `X`, las cuatro rotaciones dan **la
  misma forma y cuatro escalas distintas**. Para `I`, `T`, `U`, `V`, `W` y `X` la reflexión **no cambia
  la forma** pero sí invierte las notas: hay entradas que suenan distinto sin verse distinto.
- El ámbito del arpegio varía entre **7 y 10 semitonos** según pieza y rotación, por el corrimiento de
  octava.

El spec 005 pone los tests que impiden que el modelo se rompa en silencio. Este spec ataca el otro
lado: que **preguntarle al modelo** sea una llamada en vez de una simulación mental.

## Solución propuesta

Un **servidor MCP propio, dentro del repo**, que **importa las funciones puras reales y las ejecuta**.
No indexa nada: la fuente de verdad es el código de `HEAD` en el momento de la consulta.

```
pentomino-games/
├── .mcp.json               ← NUEVO (commiteado): registra el server
└── mcp-server/             ← NUEVO: paquete aislado, deps propias, sin build
    └── src/                   importa de ../../src/domain/ y ../../src/audio/
```

### Las cuatro tools

| Tool | Responde en una llamada | Reemplaza |
|---|---|---|
| `describe_piece(piece, rotation?, mirror?, octave?)` | celdas transformadas **en orden de array**, render ASCII con el ancla marcada, tónica, escala, y las 5 notas (MIDI + nombre) ya con el retrógrado aplicado | leer el dominio y componer las cuatro puras a mano |
| `simulate_board(pieces[], bpm?, bars?)` | validez de cada colocación **con la misma función que usa la app**, los jobs que crearía el efecto de reconciliación, y la línea de tiempo de onsets del scheduler real | leer el scheduler y recorrer el lookahead a mano, o escuchar |
| `check_invariants(piece?)` | los cinco chequeos de `domain/invariants.ts` sobre las 96 combinaciones, con contraejemplos | correr los tests y leer la salida |
| `spec_status()` | por spec: estado, tareas hechas/total y la próxima sin marcar | leer `log.md` + todos los `tasks.md` (24 KB) |

**Las tools no reimplementan nada.** `simulate_board` llama a `cellsAt`/`isValid` de
`domain/board.ts`; `check_invariants` llama a `checkAll()` de `domain/invariants.ts`; `describe_piece`
llama a `rotateN`/`reflect`/`notesForRotation`. Lo único propio del server es el render ASCII, el
parseo de los specs y el armado de las respuestas.

### Decisiones de diseño

**D1 — El server ejecuta el dominio; no lo indexa.**

El server de bait indexa porque allá localizar es el costo dominante: 135 archivos, 11 versiones casi
idénticas. Acá `src/` entero entra en un solo read. Un índice de símbolos sobre 8 archivos ahorraría
del orden de nada y traería todo el precio: `ts-morph` como dependencia, un `npm run index` que hay que
acordarse de correr, staleness, un `generatedAt` que sellar en cada respuesta y dos clases de error
nuevas (`IndexMissingError`, `IndexUnreadableError`).

Ejecutar el dominio invierte esas propiedades: **no hay paso de indexado, no hay staleness y no hay
nada que sellar.** Si alguien cambia `notesForRotation`, la tool responde distinto en la consulta
siguiente.

**D2 — Cero duplicación de reglas: las tools importan de `src/`.**

Es la decisión que más cambió al separar el spec 005. La versión anterior de este plan tenía un
`mcp-server/src/board.ts` con su propia colocación y validez — **dos copias de la regla del juego**,
divergiendo desde el primer cambio. Con `domain/board.ts` y `domain/invariants.ts` existiendo, el
server importa la única implementación.

La contrapartida, dicha claro: el server queda **acoplado a la API de `src/`**. Si cambia la firma de
`isValid`, el server rompe. Es el acoplamiento correcto —a módulos puros y testeados, no a la UI— y es
preferible a la divergencia silenciosa de dos copias.

**D3 — Sin paso de build: `.mcp.json` corre el `.ts` directo.**

Node 22.18 —el instalado— ejecuta TypeScript quitando los tipos, sin `tsc` ni `tsx`. Medido: ~95 ms de
arranque contra ~45 ms de un `node -e` vacío, una vez por sesión. bait compila a `dist/` y su
`.mcp.json` apunta al `.js`; acá apunta al `.ts` y **desaparece el modo de falla más común de ese
diseño**: un `dist/` viejo sirviendo código que ya no es el del repo.

El precio, explícito: **el server necesita Node ≥ 22.18**, por encima del ≥ 22.12 que pide Vite. Es
tooling de desarrollo: no entra al bundle ni al deploy, así que el piso no afecta ni a la app ni a
Netlify. Con Node 20 el server no arranca y el repo sigue funcionando igual.

**D4 — SDK v2 (`@modelcontextprotocol/server@2.0.0`) con schemas de zod.**

bait usa el server low-level de `@modelcontextprotocol/sdk` (hoy 1.30.0), que **no valida los
argumentos**: por eso tuvo que escribir `requireString` y `optionalEnum`, con un comentario que explica
que sin ellos un argumento faltante degrada a `""` y la tool responde algo plausible en vez de fallar.
Con `McpServer` + `registerTool` la validación la hace el SDK contra el schema de zod, y esa capa entera
no se escribe. Se hereda el problema conocido, no el código que lo resolvía.

**D5 — El registro de tools se hereda tal cual.**

Un archivo por tool que exporta su definición (nombre, descripción, schema, handler juntos) y un
`tools/index.ts` con el array. Agregar una tool = un archivo + una línea, sin tocar el entrypoint ni un
`switch`. Es la parte del diseño de bait que mejor envejeció.

**D6 — Los tests del server corren con `node --test`, en `src/__tests__/`.**

Verificado: `node --test` corre archivos TypeScript sin transpilador ni dependencia nueva. La ubicación
sigue la convención que fija el spec 005 —un `__tests__/` dentro de la carpeta, con un archivo por
módulo— y no la de bait, que los pone en la raíz del paquete para mantenerlos fuera de `dist/`: acá no
hay `dist/`, así que ese motivo no aplica.

Vitest sigue siendo el runner de `src/`: su `include` es `src/**/*.test.{ts,tsx}` y el server vive en
`mcp-server/`, así que no se pisan. Dos runners es un costo real; el alternativo era meter un paquete
con otras deps y otro tsconfig dentro del `include` de Vitest, que es peor.

**D7 — `simulate_board` corre el scheduler real en ventanas de 25 ms.**

No reimplementa la fórmula de onsets: llama a `collectHits` con `TICK_MS` y `LOOKAHEAD` reales, igual
que `tick()` en producción, y acumula. Una fórmula idealizada responde lo que el scheduler *debería*
hacer; el bucle responde lo que **hace**, incluida la guarda de recuperación y la mutación del cursor.

## Criterios de Aceptación

- **AC1** — Existe `mcp-server/` como paquete aislado (su `package.json`, su `tsconfig.json`) y
  `node mcp-server/src/index.ts` arranca por stdio y lista las cuatro tools. **`src/` no importa nada
  de `mcp-server/`.**
- **AC2** — `.mcp.json` está commiteado en la raíz y registra el server; abrir el repo con Claude Code
  lo levanta sin configurar nada.
- **AC3 — Cero reimplementación.** Ninguna regla de dominio se escribe dos veces: `simulate_board`
  importa `cellsAt`/`isValid` de `domain/board.ts`, `check_invariants` importa `checkAll` de
  `domain/invariants.ts`, y `describe_piece` importa las transformaciones y la música de `domain/`. Lo
  único propio del server es el render ASCII, el parseo de specs y el formato de las respuestas.
- **AC4** — `describe_piece("Z", 3, true)` devuelve las notas `D#6 C#6 A#5 G#5 F#5`, el ancla en el
  índice 1 = `[1,1]` y el ascii `.#\n#@\n#.\n#.` (valores medidos).
- **AC5** — `describe_piece` sobre las 96 combinaciones nunca falla y siempre devuelve exactamente 5
  celdas y 5 notas.
- **AC6** — `check_invariants()` reporta los cinco chequeos por separado, con contraejemplos, y **hoy
  los cinco pasan**. Si `domain/invariants.ts` agrega un chequeo, la tool lo expone sin cambios: itera
  sobre `checkAll()`.
- **AC7** — `simulate_board` con dos piezas a 110 bpm y 2 compases devuelve **20 onsets en 10
  instantes, `maxPerInstant` 2** (medido con el `collectHits` de hoy). Es el problema del
  [spec 004](../004-fase-por-pieza-la-columna-como-posicion-en-el-compas/spec.md) hecho número, sin
  escuchar.
- **AC8** — `simulate_board` valida las colocaciones como la app: fuera del tablero y solapadas se
  reportan inválidas con el motivo, y una pieza inválida **no** aporta onsets.
- **AC9** — `spec_status()` devuelve, por spec, el estado de `log.md` y las tareas marcadas contra el
  total de su `tasks.md`, sin hardcodear la lista de specs, y **contando aparte** las tareas bajo un
  encabezado `Seguimiento` (medido: el spec 002 está `Implementado` con 7 sin marcar, 6 de ellas de
  seguimiento).
- **AC10** — `npm run mcp:test` en verde (typecheck + `node --test`) cubriendo el render ASCII, el
  formato de respuesta de un tablero inválido y el parseo de checkboxes. `npx tsc --noEmit` del server
  en 0.
- **AC11** — Verificación de la promesa: responder *"¿qué notas y qué forma da la `Z` en 270°
  reflejada, y qué onsets produce si la pongo en `x=0` y otra en `x=5`?"* con las tools consume
  **menos** tokens que leyendo el dominio y el scheduler. Se anota el antes/después medido, como hizo
  bait.

## Fuera de Alcance

- **La modularización de `src/`.** Es el [spec 005](../005-modularizacion-de-src-en-capas/spec.md)
  entero. Este spec **no toca `src/`**: si al implementarlo aparece la necesidad de un módulo o de un
  export nuevo en el dominio, eso es un cambio del 005 y va en su propio commit.
- **Índice de símbolos con `ts-morph`.** Descartado con medición (D1, §2 de `research.md`).
- **Tools que escriban.** Las cuatro son de solo lectura.
- **`resources` y `prompts` de MCP.** Solo `tools`. Exponer `docs/` como resources no resuelve ningún
  costo medido: los docs ya se leen bien.
- **Watcher / re-indexado.** No aplica: no hay índice.
- **Cambiar el modelo musical, la geometría o el audio.** Este spec solo lee.
- **Publicar el server como paquete o usarlo desde otro repo.** Es tooling local de este repo.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Depende del spec 005**, que es un refactor grande. Si 005 se atrasa o se corta, este spec no arranca. | La dependencia es solo de las fases 1–3 de 005 (tipos, dominio, tablero, invariantes, audio). La fase 4 —los componentes— **no afecta** a este spec: si 005 se corta ahí, este sigue viable. |
| **Acoplamiento a la API de `src/`** (D2): un cambio de firma en `isValid` o en `collectHits` rompe el server. | Es acoplamiento a módulos puros y testeados, no a la UI. Y `npm run mcp:test` corre el typecheck, así que `tsc` grita cuando la firma cambia, no en runtime. |
| **El spec 004 reescribe `collectHits`** (`ClockState` pasa a `origin` + `scheduledUntil`, `Job` gana `phase`). | Si 004 va primero, `simulate_board` se escribe contra la firma nueva. Si va primero este spec, 004 actualiza la tool — y ahí **la usa**: la línea de tiempo de onsets es la forma de verificar sus AC1–AC7 sin escuchar. |
| **Los módulos que el server carga con node crudo no pueden usar imports sin extensión.** Un `import "./music"` dentro de `src/domain/` rompe el server y **no** rompe la app, porque Vite lo resuelve. | La regla es del spec 005 (su D4), queda escrita en `conventions.md`, y la ataja el arranque del server — lo primero que hace `npm run mcp:test`. |
| **El piso de Node sube a 22.18 para el server** (D3). | Documentado en el README del server y en el quickstart. La app y el deploy no se tocan. Si molesta, el escape es un `npm run mcp:build` opcional con `tsc`; no entra al MVP. |
| **El agente no usa las tools y sigue leyendo el código.** Es la "condición crítica" que remarcan las implementaciones de referencia: sin adopción no hay ahorro. | Descripciones escritas por intención (*"antes de simular a mano qué notas suenan, preguntá"*), una fila en `CLAUDE.md` y `docs/guides/mcp-domain.md` con las recetas. AC11 mide si sirvió. |

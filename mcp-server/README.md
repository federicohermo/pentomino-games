# mcp-server — el dominio de pentomino-games, ejecutable

Servidor MCP que **importa las funciones puras de `src/` y las ejecuta**. No indexa código: no hay
índice, no hay staleness y no hay paso de build.

Guía de uso y catálogo de tools: [`docs/guides/mcp-domain.md`](../docs/guides/mcp-domain.md).
El spec que lo motivó: [`specs/006`](../specs/006-mcp-server-de-dominio-ejecutable/spec.md).

## Comandos

```bash
pnpm install                # DESDE LA RAÍZ: el workspace instala los dos paquetes
pnpm mcp:test               # desde la raíz — typecheck + node --test
pnpm mcp:typecheck          # desde la raíz — solo tsc
pnpm --filter mcp-server start   # arranca por stdio, para probarlo a mano
```

Adentro de esta carpeta los scripts son `test`, `typecheck` y `start`.

**Node ≥ 22.18.** El server corre TypeScript sin compilar; con Node 20 no arranca. La app y el deploy
no se ven afectados: esto es tooling.

## Estructura

```
mcp-server/
├── package.json            deps propias: @modelcontextprotocol/server + zod
├── tsconfig.json           noEmit; lib incluye DOM (ver abajo)
└── src/
    ├── index.ts            entrypoint: serveStdio + registro de tools
    ├── pieces.ts           las 12 letras, sacadas de SHAPES
    ├── render.ts           ASCII de una pieza (puro)
    ├── specs.ts            parseo de log.md y de los tasks.md (puro + lectura)
    ├── tools/
    │   ├── index.ts        el array de tools; una línea por tool
    │   ├── types.ts        ToolDef, defineTool y los helpers de respuesta
    │   └── <tool>.ts       una por archivo: nombre, descripción, schema y handler
    └── __tests__/          node --test, un archivo por módulo
```

## Cómo agregar una tool

1. Un archivo en `src/tools/`, que exporte `defineTool({ name, description, inputSchema, run })`.
2. Una línea en `src/tools/index.ts`.

El entrypoint no se toca y no hay ningún `switch`. **No escribir validación de argumentos**: la hace el
SDK contra el schema de zod antes de llamar al handler.

La descripción se escribe **por intención** —cuándo conviene llamarla en vez de leer el código—, no por
mecanismo. Sin adopción no hay ahorro, y lo único que decide la adopción es esa descripción.

## Tres cosas que no son obvias

**Los imports de `src/` llevan `.ts` explícito, y no es cosmético.** Node los necesita para resolver.
Un import sin extensión dentro de `src/domain/` rompe este server y **no** rompe la app, porque Vite
resuelve igual: el error sería invisible del lado del navegador. Lo ataja `pnpm mcp:test`.

**El tsconfig incluye `DOM` en `lib` aunque el server nunca toque el DOM.** Typechequea la cadena
`audio/scheduler.ts → audio/voice.ts`, que declara `BaseAudioContext`, `AudioNode` y `OscillatorType`.
Sin `DOM` son 8 errores TS2304. En runtime nada de eso existe: los tipos se borran y `collectHits` es
aritmética.

**Nada de dominio se escribe acá.** Rotar, reflejar, colocar, validar, calcular notas y chequear
invariantes viene todo de `src/`. Lo propio del server es el render ASCII, el parseo de los specs y el
formato de las respuestas. Si aparece la tentación de calcular una rotación o una escala en este
paquete, es señal de que falta un export en `src/domain/` — y eso es un cambio de `src/`, en su propio
commit.

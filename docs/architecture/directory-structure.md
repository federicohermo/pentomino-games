# Estructura de Directorios

## Organización General

```
pentomino-games/           # raíz del repo: la app vive acá, sin subdirectorio
├── CLAUDE.md              # Guía para Claude Code
├── docs/                  # Esta documentación
├── specs/                 # Trabajo planificado (ver specs/README.md)
├── public/                # Assets servidos tal cual, copiados a dist/
├── src/                   # Todo el código de la app
├── mcp-server/            # MCP server de dominio: tooling, NO entra al bundle
├── .mcp.json              # Registra el server; commiteado, sin nada que configurar
├── index.html             # Entry point de Vite (en la raíz, no en public/)
├── vite.config.ts         # Plugins: react() + tailwindcss()
├── eslint.config.js       # Flat config v9 + los overrides de dirección de dependencia
├── netlify.toml           # Config de deploy (ver infra/deploy.md)
├── pnpm-workspace.yaml    # Workspace de dos paquetes: `.` y `mcp-server`
├── pnpm-lock.yaml         # Lockfile único, cubre los dos paquetes
├── LICENSE
└── tsconfig{,.app,.node}.json
```

## `mcp-server/`

Paquete aparte, con sus propias dependencias y su propio `tsconfig.json`. **La dirección de dependencia
es una sola: `mcp-server/` importa de `src/`, nunca al revés.**

```
mcp-server/
└── src/
    ├── index.ts                  entrypoint: serveStdio + registro de tools
    ├── pieces.ts                 las 12 letras, derivadas de SHAPES
    ├── render.ts                 ASCII de una pieza (puro)
    ├── specs.ts                  parseo de log.md y de los tasks.md
    ├── tools/                    una tool por archivo + el array de index.ts
    └── __tests__/                node --test, uno por tool + los de parseo y render
```

Que sea un paquete y no una carpeta más no es prolijidad: `zod` y `@modelcontextprotocol/server` quedan
en `mcp-server/node_modules` y **no** aparecen en el de la raíz, así que el tooling no puede colarse al
bundle. Lo garantiza pnpm, no la disciplina.

No tiene `dist/`: node corre los `.ts` quitando los tipos. Por eso el server pide **Node ≥ 22.18**, por
encima del piso de la app — y por eso no puede quedar sirviendo código viejo. Detalle en
[mcp-domain.md](../guides/mcp-domain.md).

## `src/`

```
src/
├── main.tsx                      # createRoot + StrictMode + import de styles/index.css
├── App.tsx                       # estado, derivados, handlers, efectos y composición
├── vite-env.d.ts                 # Tipos de Vite
├── styles/
│   └── index.css                 # @import "tailwindcss" + estilos globales de body/code
├── domain/                       # puro: sin React, sin Web Audio, sin DOM
│   ├── transform.ts              # rotate90 · normalize · rotateN · reflect · centroid ·
│   │                             #   angleFromCentroid · pathThroughCells
│   ├── board.ts                  # cellsAt · isValid · routeBetween · occupantAt ·
│   │                             #   occupantCellIndex
│   ├── music.ts                  # midiFor · midiName · notesForRotation · arpeggioFor ·
│   │                             #   degreeByCellIndex · angularRank
│   ├── sequence.ts               # buildSequence — el circuito (Held-Karp) y los offsets del ciclo —,
│   │                             #   cellsByPlayOrder, gates —las dos puertas, las usa simulate_board—
│   │                             #   y noteAtCell, qué nota hay en una celda
│   ├── invariants.ts             # los cinco chequeos del modelo + checkAll
│   ├── types/                    # el contrato de la capa. Cero imports de afuera
│   │   ├── transform.types.ts    #   Cell
│   │   ├── pieces.types.ts       #   PieceKey
│   │   ├── board.types.ts        #   PlacedPiece
│   │   └── sequence.types.ts     #   Step · Click · Sequence
│   ├── constants/                # los datos del modelo. Solo importan tipos
│   │   ├── pieces.constants.ts   #   SHAPES · ANCHOR_INDEX
│   │   ├── board.constants.ts    #   GRID_W · GRID_H · SEAM · CROSS_COST
│   │   └── music.constants.ts    #   CHROMATIC · PENT_* · BASE_MAP · DEFAULT_OCTAVE
│   └── __tests__/                # uno por módulo
│       └── transform · board · music · sequence · invariants
├── audio/                        # Web Audio; habla MIDI, no conoce el dominio ni la UI
│   ├── voice.ts                  # midiToHz · scheduleVoice · scheduleClick
│   ├── scheduler.ts              # collectHits · collectWindow (el swap al cierre de ciclo) ·
│   │                             #   barDuration · intervalDuration
│   ├── engine.ts                 # singletons y la API que consume la UI
│   ├── spectrum.ts               # mapeo puro de bins de la FFT a alturas de barra
│   ├── playhead.ts               # offsetAt — aritmética del offset de la cabeza lectora (spec 010)
│   ├── types/                    #   voice.types.ts · scheduler.types.ts
│   ├── constants/                #   voice · scheduler · engine
│   └── __tests__/
│       ├── voice.test.ts         #   síntesis, con OfflineAudioContext
│       ├── scheduler.test.ts     #   lookahead, reloj por origen, offsets del ciclo y el swap (D5)
│       ├── integration.test.ts   #   el analyser es transparente, muestra por muestra
│       ├── spectrum.test.ts      #   binsToBars, sin AudioContext (ver audio.md)
│       ├── playhead.test.ts      #   offsetAt: borde de ciclo, t < origin y los degradados (AC2)
│       └── test-context.ts       #   helpers de render y medición (no es un test)
└── components/                   # un componente por archivo, presentacionales
    ├── PiecePalette.tsx          # paleta, rotación, reflexión, tempo, transporte, clicks
    ├── Board.tsx                 # grilla 10×6: color por pieza, nota por celda, y el fantasma
    │                             #   diciendo lo mismo antes de colocar
    ├── Spectrum.tsx              # canvas del espectro: rAF + HiDPI, sin props
    ├── Playhead.tsx              # cabeza lectora: rAF + estilo imperativo, sin props (spec 010)
    ├── route-source.ts           # singleton fuera de React (no un componente): espeja active/
    │                             #   pending del motor con la Sequence del dominio, con celdas
    ├── cell-text.ts              # qué dice cada celda: su nota (por grado) y su #N (por paso).
    │                             #   Fuera del .tsx para poder testearla (spec 012, fix del #N)
    ├── piece-mini.ts             # la forma de una pieza centrada en la caja de 5×5 de la paleta,
    │                             #   ya rotada y reflejada (spec 016). Fuera del .tsx por lo mismo
    ├── input.ts                  # la decisión de cada gesto de entrada: rueda, tecla, menú
    │                             #   contextual y click sobre una celda (specs 013 y 014)
    ├── constants/
    │   ├── layout.constants.ts   # CELL_PX · MINI_BOX · MINI_CELL_PX · TEMPO_MIN · TEMPO_MAX
    │   ├── palette.constants.ts  # los 12 colores y su color de texto (ver DESIGN.md)
    │   ├── route.constants.ts    # MARCA: los estados de una celda bajo la cabeza lectora
    │   └── input.constants.ts    # ACCION y EDICION: lo que puede pedir un gesto
    ├── types/
    │   ├── cell-text.types.ts    # CellText: lo que una celda muestra
    │   ├── route.types.ts        # Marca · CeldaPorEstrenar
    │   └── input.types.ts        # Accion · Edicion · los campos de evento que las puras miran
    └── __tests__/
        ├── palette.test.ts       # contraste WCAG recalculado desde el fondo; puro, sin jsdom
        ├── route-source.test.ts  # el par activa/pendiente y el velo, con el motor mockeado
        ├── cell-text.test.ts     # el #N es el paso y la nota es el grado, en las 96
        ├── input.test.ts         # la decisión de cada gesto: rueda, teclas y click (013 y 014)
        └── piece-mini.test.ts    # la forma entra y queda centrada en la caja, en las 96
```

## La dirección de dependencia

Es la regla que ordena todo lo demás, y **la verifica el linter**, no la revisión:

```
types/ ← constants/ ← módulos              types/ no importa nada de afuera de types/
transform.ts ← board.ts                    domain/ no importa nada de fuera de domain/
             ← music.ts ← invariants.ts    audio/  no importa nada de fuera de audio/
                                           components/ y App.tsx importan de las dos
```

`domain/` y `audio/` son **hermanos sin aristas entre ellos**: el motor habla números MIDI y no sabe
qué es un pentominó. Agregar a mano un import prohibido falla `pnpm lint` con el mensaje del override
de `eslint.config.js`. El porqué de cada regla está en
[conventions.md](../guides/conventions.md).

Todos los archivos de `src/` están vivos. Los residuos de las plantillas de Create React App y de Vite
(`App.css`, `logo.svg`, `assets/react.svg`, `setupTests.ts`) se eliminaron.

Si al agregar un archivo se quiere confirmar que efectivamente se usa:

```bash
grep -rq "App.css" src --include="*.tsx" --include="*.ts" --include="*.css"
```

### Tests

`pnpm test` corre Vitest en `environment: 'node'` contra `node-web-audio-api`, sobre la capa de audio y
el dominio. El `include` (`src/**/*.test.{ts,tsx}`) toma los `__tests__/` sin configuración extra, y
`test-context.ts` no matchea porque le falta el `.test.` antes de la extensión.

Los **tests del MCP server corren aparte**, con `pnpm mcp:test`: viven en `mcp-server/src/__tests__/`
y los corre `node --test`, no Vitest. Los `include` no se pisan — el de Vitest empieza en `src/`.

**Sigue sin haber tests que rendericen un componente.** El `App.test.tsx` heredado de CRA se eliminó al
montar el runner: buscaba el texto "learn react" de la plantilla, que la app nunca renderizó. Renderizar
va a requerir `jsdom` en su propio bloque de config — sin cambiar el `environment` global, que rompería
los de audio. Las `@testing-library/*` siguen en el árbol esperando eso.

`components/__tests__/palette.test.ts` es el primer test de la carpeta y **no** cambia lo anterior: es de
constantes, corre en `environment: 'node'` y no monta nada. La otra mitad de la respuesta es que la
lógica no vive en los componentes — la derivación de `(x, y)` al nombre de nota que muestra `Board` está
en `domain/` (`occupantCellIndex` · `degreeByCellIndex` · `playOrderByCellIndex` · `notesForRotation` ·
`midiName`), y el `.tsx` solo indexa el resultado.

**Encadenarlas tampoco es gratis, y por eso el encadenado salió del `.tsx`.** Vive en `cell-text.ts`
desde el fix del `#N`: elegir *cuál* de las dos numeraciones por celda alimenta el número y cuál la nota
es una decisión, y adentro de un componente no se podía testear —`react-refresh/only-export-components`
le prohíbe al archivo exportar algo que no sea el componente—, así que el bug convivió con 238 tests en
verde. Las puras del dominio estaban bien; lo que no había era un test entre la pura y el píxel.

`route-source.test.ts` (spec 010) es el segundo, y es el que muestra dónde queda la costura: **no** es un
componente, es el singleton de módulo que espeja el par activa/pendiente del motor, así que tiene lógica
propia y se testea sin montar nada. Mockea `audio/engine.ts` con `vi.mock` porque lo único que le usa es
`cycleGeneration()`, un número — importar el motor real arrastraría el singleton del `AudioContext` para
leer un contador. El estado es de módulo, así que cada caso lo reimporta con `vi.resetModules()`: sin
eso, el orden de los tests sería parte del oráculo.

## `public/`

Se copia tal cual a `dist/`. Las rutas se referencian desde la raíz del sitio (`/favicon.ico`).

| Archivo | Estado |
|---|---|
| `_redirects` | **Vivo y necesario.** Regla SPA para Netlify: `/* /index.html 200` |
| `favicon.ico`, `logo192.png`, `logo512.png` | Vivos, referenciados desde `index.html` y `manifest.json` |
| `manifest.json` | Vivo pero **con valores por defecto de CRA** (`"name": "Create React App Sample"`) |
| `robots.txt` | Vivo |

## Dónde crear cada cosa

La regla de fondo: **los módulos contienen comportamiento; los datos, los tipos y los valores fijos
viven en la carpeta de su rol.** Un `.ts` de capa tiene funciones y nada más.

| Rol | Carpeta | Archivo |
|---|---|---|
| lógica de un concern | la capa (`domain/`, `audio/`) | `<módulo>.ts` |
| tipo que cruza un límite | `<capa>/types/` | `<módulo>.types.ts` |
| dato o valor fijo | `<capa>/constants/` | `<módulo>.constants.ts` |
| test de un módulo | `<capa>/__tests__/` | `<módulo>.test.ts` |
| helper de test | `<capa>/__tests__/` | nombre descriptivo (`test-context.ts`) |
| componente | `components/` | `PascalCase.tsx`, **único export** |
| estado nuevo de UI | `useState` dentro de `App()` | no hay ni hace falta estado global |
| efecto de audio | dentro de `App()`, junto al de reconciliación | ver [audio.md](./audio.md) |
| asset referenciado por URL | `public/` | se copia sin procesar |
| documentación de arquitectura | `docs/architecture/` | |
| trabajo planificado | `specs/<NNN>-<desc>/` | cuatro archivos, ver [specs/README.md](../../specs/README.md) |
| tool nueva del MCP server | `mcp-server/src/tools/` | `<tool>.ts` + una línea en `tools/index.ts` |
| regla que el server necesita ejecutar | `src/domain/` | **no** en `mcp-server/`: es un cambio de `src/`, en su propio commit |

**Las carpetas de rol se crean cuando tienen su primer archivo.** No hay `schemas/`, `utils/`, `hooks/`
ni `lib/`: estarían vacías, y una carpeta vacía es ceremonia. La tabla de crecimiento —qué carpeta
aparece con qué disparador— está en [conventions.md](../guides/conventions.md).

## Convención de nombres

- **Componentes**: `PascalCase.tsx`, un componente por archivo y ningún otro export.
- **Funciones puras y utilidades**: `camelCase`.
- **Constantes de dominio**: `SCREAMING_SNAKE_CASE` (`SHAPES`, `BASE_MAP`, `ANCHOR_INDEX`, `GRID_W`).
- **Tipos e interfaces**: `PascalCase` (`Cell`, `PieceKey`, `PlacedPiece`).
- **Archivos de rol**: repiten el nombre de su módulo con el sufijo del rol
  (`transform.ts` → `types/transform.types.ts`, `constants/…`, `__tests__/transform.test.ts`).

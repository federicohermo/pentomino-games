# Estructura de Directorios

## Organización General

```
pentomino-games/           # raíz del repo: la app vive acá, sin subdirectorio
├── CLAUDE.md              # Guía para Claude Code
├── docs/                  # Esta documentación
├── specs/                 # Trabajo planificado (ver specs/README.md)
├── public/                # Assets servidos tal cual, copiados a dist/
├── src/                   # Todo el código
├── index.html             # Entry point de Vite (en la raíz, no en public/)
├── vite.config.ts         # Plugins: react() + tailwindcss()
├── eslint.config.js       # Flat config v9 + los overrides de dirección de dependencia
├── netlify.toml           # Config de deploy (ver infra/deploy.md)
├── pnpm-workspace.yaml    # Config de pnpm (allowBuilds); todavía sin `packages:`
├── pnpm-lock.yaml         # Lockfile versionado — Netlify elige el gestor por él
├── LICENSE
└── tsconfig{,.app,.node}.json
```

## `src/`

```
src/
├── main.tsx                      # createRoot + StrictMode + import de styles/index.css
├── App.tsx                       # estado, derivados, handlers, efectos y composición
├── vite-env.d.ts                 # Tipos de Vite
├── styles/
│   └── index.css                 # @import "tailwindcss" + estilos globales de body/code
├── domain/                       # puro: sin React, sin Web Audio, sin DOM
│   ├── transform.ts              # rotate90 · normalize · rotateN · reflect
│   ├── board.ts                  # cellsAt · isValid · occupantAt
│   ├── music.ts                  # midiFor · midiName · notesForRotation
│   ├── invariants.ts             # los cinco chequeos del modelo + checkAll
│   ├── types/                    # el contrato de la capa. Cero imports de afuera
│   │   ├── transform.types.ts    #   Cell
│   │   ├── pieces.types.ts       #   PieceKey
│   │   └── board.types.ts        #   PlacedPiece
│   ├── constants/                # los datos del modelo. Solo importan tipos
│   │   ├── pieces.constants.ts   #   SHAPES · ANCHOR_INDEX
│   │   ├── board.constants.ts    #   GRID_W · GRID_H
│   │   └── music.constants.ts    #   CHROMATIC · PENT_* · BASE_MAP · DEFAULT_OCTAVE
│   └── __tests__/                # 50 tests, uno por módulo
│       └── transform · board · music · invariants
├── audio/                        # Web Audio; habla MIDI, no conoce el dominio ni la UI
│   ├── voice.ts                  # midiToHz · scheduleVoice
│   ├── scheduler.ts              # collectHits
│   ├── engine.ts                 # singletons y la API que consume la UI
│   ├── spectrum.ts               # mapeo puro de bins de la FFT a alturas de barra
│   ├── types/                    #   voice.types.ts · scheduler.types.ts
│   ├── constants/                #   voice · scheduler · engine
│   └── __tests__/                # 36 tests
│       ├── voice.test.ts         #   7, con OfflineAudioContext
│       ├── scheduler.test.ts     #   17
│       ├── integration.test.ts   #   3
│       ├── spectrum.test.ts      #   9, sin AudioContext (ver audio.md)
│       └── test-context.ts       #   helpers de render y medición (no es un test)
└── components/                   # un componente por archivo, presentacionales
    ├── PiecePalette.tsx          # paleta, rotación, reflexión, tempo, transporte
    ├── Board.tsx                 # grilla 10×6 con el fantasma
    ├── PiecePreview.tsx          # previsualización con el ancla marcada
    ├── PlacedList.tsx            # lista de piezas colocadas
    ├── Spectrum.tsx              # canvas del espectro: rAF + HiDPI, sin props
    └── constants/
        └── layout.constants.ts   # CELL_PX · PREVIEW_CELL_PX · TEMPO_MIN · TEMPO_MAX
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

`pnpm test` corre Vitest en `environment: 'node'` contra `node-web-audio-api`. Son **86**: 36 de la capa
de audio y 50 del dominio. El `include` (`src/**/*.test.{ts,tsx}`) toma los `__tests__/` sin
configuración extra, y `test-context.ts` no matchea porque le falta el `.test.` antes de la extensión.

**No hay tests de componentes.** El `App.test.tsx` heredado de CRA se eliminó al montar el runner:
buscaba el texto "learn react" de la plantilla, que la app nunca renderizó. Agregar tests de componentes
va a requerir `jsdom` en su propio bloque de config — sin cambiar el `environment` global, que rompería
los de audio. Las `@testing-library/*` siguen en el árbol esperando eso.

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

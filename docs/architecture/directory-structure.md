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
├── eslint.config.js       # Flat config v9
├── netlify.toml           # Config de deploy (ver infra/deploy.md)
├── pnpm-workspace.yaml    # Config de pnpm (allowBuilds); todavía sin `packages:`
├── pnpm-lock.yaml         # Lockfile versionado — Netlify elige el gestor por él
├── LICENSE
└── tsconfig{,.app,.node}.json
```

## `src/`

```
src/
├── index.tsx          # createRoot().render(<App/>) + import de index.css
├── App.tsx            # dominio (geometría + música) + componente
├── index.css          # @import "tailwindcss" + estilos globales de body/code
├── setupTests.ts      # import de @testing-library/jest-dom
├── vite-env.d.ts      # Tipos de Vite
└── audio/
    ├── engine.ts        # motor Web Audio: síntesis, scheduler, singletons
    ├── engine.test.ts   # 17 tests con OfflineAudioContext
    └── test-context.ts  # helpers de render y medición (solo tests)
```

Todos los archivos de `src/` están vivos. Los residuos de las plantillas de Create React App y de Vite
(`App.css`, `logo.svg`, `assets/react.svg`) se eliminaron; ninguno estaba referenciado por un import.

Si al agregar un archivo se quiere confirmar que efectivamente se usa:

```bash
grep -rq "App.css" src --include="*.tsx" --include="*.ts" --include="*.css"
```

### Tests

`pnpm test` corre Vitest en `environment: 'node'` contra `node-web-audio-api`. Los 17 tests actuales son
todos del motor de audio.

**No hay tests de componentes.** El `App.test.tsx` heredado de CRA se eliminó al montar el runner:
buscaba el texto "learn react" de la plantilla, que la app nunca renderizó. Agregar tests de componentes
va a requerir `jsdom` en su propio bloque de config — sin cambiar el `environment` global, que rompería
los de audio.

`setupTests.ts` y las `@testing-library/*` quedaron sin usar hasta que eso pase.

## `public/`

Se copia tal cual a `dist/`. Las rutas se referencian desde la raíz del sitio (`/favicon.ico`).

| Archivo | Estado |
|---|---|
| `_redirects` | **Vivo y necesario.** Regla SPA para Netlify: `/* /index.html 200` |
| `favicon.ico`, `logo192.png`, `logo512.png` | Vivos, referenciados desde `index.html` y `manifest.json` |
| `manifest.json` | Vivo pero **con valores por defecto de CRA** (`"name": "Create React App Sample"`) |
| `robots.txt` | Vivo |

## Dónde crear cada cosa

| Qué | Dónde | Notas |
|---|---|---|
| Función pura de geometría o música | `src/App.tsx`, con las otras puras (antes de `App()`) | No suelta dentro del componente |
| Estado nuevo de UI | `useState` dentro de `App()` | No hay ni hace falta estado global |
| Efecto de audio | Dentro de `App()`, junto al de reconciliación | Ver [audio.md](./audio.md) |
| Asset estático referenciado por URL | `public/` | Se copia sin procesar |
| Asset importado desde código | `src/assets/` | Pasa por el pipeline de Vite (hash, inline) |
| Documentación de arquitectura | `docs/architecture/` | |
| Trabajo planificado | `specs/<NNN>-<desc>/` | Cuatro archivos, ver [specs/README.md](../../specs/README.md) |

## Convención de nombres

- **Componentes**: `PascalCase.tsx` (hoy solo `App.tsx`).
- **Funciones puras y utilidades**: `camelCase`.
- **Constantes de dominio**: `SCREAMING_SNAKE_CASE` (`SHAPES`, `BASE_MAP`, `ANCHOR_INDEX`, `GRID_W`).
- **Tipos e interfaces**: `PascalCase` (`Cell`, `PieceKey`, `PlacedPiece`).

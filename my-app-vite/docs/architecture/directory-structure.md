# Estructura de Directorios

## Organización General

```
my-app-vite/
├── CLAUDE.md              # Guía para Claude Code
├── docs/                  # Esta documentación
├── specs/                 # Trabajo planificado (ver specs/README.md)
├── public/                # Assets servidos tal cual, copiados a dist/
├── src/                   # Todo el código
├── index.html             # Entry point de Vite (en la raíz, no en public/)
├── vite.config.ts         # Plugins: react() + tailwindcss()
├── eslint.config.js       # Flat config v9
└── tsconfig{,.app,.node}.json
```

El `netlify.toml` **no** está acá: vive en la raíz del repositorio, un nivel arriba. Ver
[infra/deploy.md](../infra/deploy.md).

## `src/`

```
src/
├── index.tsx          # createRoot().render(<App/>) + import de index.css
├── App.tsx            # ~400 líneas: dominio + componente + audio
├── index.css          # @import "tailwindcss" + estilos globales de body/code
├── setupTests.ts      # import de @testing-library/jest-dom
├── App.test.tsx       # Smoke test heredado de CRA — no hay runner que lo corra
└── vite-env.d.ts      # Tipos de Vite
```

Todos los archivos de `src/` están vivos. Los residuos de las plantillas de Create React App y de Vite
(`App.css`, `logo.svg`, `assets/react.svg`) se eliminaron; ninguno estaba referenciado por un import.

Si al agregar un archivo se quiere confirmar que efectivamente se usa:

```bash
grep -rq "App.css" src --include="*.tsx" --include="*.ts" --include="*.css"
```

### `App.test.tsx` no corre

Existe, importa `@testing-library/react` y hace un smoke test de `App`, pero **no hay runner
configurado**: `package.json` no tiene script `test` ni Vitest ni Jest. Es un test que nadie ejecuta y
que probablemente falle si se lo ejecutara, porque busca texto de la plantilla CRA.

Montar el runner es parte del alcance del
[spec 001](../../specs/001-notas-por-celda-en-orden-angular/plan.md) §1.

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

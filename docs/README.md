# Documentación Técnica — Pentomino Games

Prototipo de instrumento musical basado en pentominós: un tablero donde cada pieza colocada dispara una
secuencia de cinco notas derivada de su identidad y su orientación.

## Índice de Documentación

### Arquitectura
- [Visión General](./architecture/overview.md) — Las cuatro capas, su dirección de dependencia y el stack
- [Estructura de Directorios](./architecture/directory-structure.md) — Qué hay y qué está muerto
- [Modelo Musical](./architecture/modelo-musical.md) — Pieza → tónica, rotación → escala **o** orden según el régimen, reflexión → retrógrado
- [Capa de Audio](./architecture/audio.md) — Grafo Web Audio, envolvente ADSR, scheduler con lookahead

### Guías de Desarrollo
- [Inicio Rápido](./guides/quickstart.md) — Setup y comandos
- [Convenciones de Código](./guides/conventions.md) — Organización de `src/`, geometría, comentarios, estado
- [Troubleshooting](./guides/troubleshooting.md) — Errores reales que ya se pisaron en este repo
- [MCP server de dominio](./guides/mcp-domain.md) — Las cuatro tools que ejecutan el dominio, y cuándo preferirlas a leer el código

### Infraestructura
- [Deploy](./infra/deploy.md) — Netlify, rutas relativas a `base` y versión de Node

### Specs
- [specs/log.md](../specs/log.md) — Registro de specs, con estados y dependencias
- [GitHub Issues](https://github.com/federicohermo/pentomino-games/issues) — Lo registrado que todavía no tiene spec
- [specs/revisiones.md](../specs/revisiones.md) — Qué se aprendió escribiendo o revisando cada spec
- [specs/README.md](../specs/README.md) — Convención de formato y flujo de trabajo

---

## Stack Tecnológico

| Tecnología | Versión | Propósito |
|---|---|---|
| Vite | 7.x | Dev server y bundler |
| React | 19.x | Biblioteca UI |
| TypeScript | 5.8 | Tipado estático |
| Tailwind CSS | 4.x | Estilos utility-first, vía `@tailwindcss/vite` |
| Web Audio | — | Síntesis y scheduling, sin librería (`src/audio/`) |

---

## Comandos Principales

```bash
pnpm dev      # Dev server de Vite
pnpm build    # tsc -b && vite build
pnpm lint     # ESLint (flat config v9)
pnpm preview  # Sirve el build de dist/
pnpm test     # Vitest — los dos proyectos, sin instrumentar
pnpm suite    # test y después coverage, con umbral 100; es lo que corre verify
pnpm verify   # lint ‖ typecheck ‖ suite ‖ mcp:test — el nodo de convergencia
pnpm mcp:test # MCP server — typecheck + tests con node --test
```

Vitest corre en **dos proyectos y un solo comando** (spec 029): los `*.test.ts` en `environment: 'node'`
contra `node-web-audio-api`, y los `*.browser.test.tsx` en un Chromium de verdad por Playwright. **En
jsdom no corre ninguno**, y no es una pendiente: jsdom no implementa Web Audio ni da canvas 2D,
`ResizeObserver` o `matchMedia`, así que cubrir `Spectrum.tsx` con él exigiría mockear justo el código
que se quiere cubrir. Los seis componentes, `App.tsx` y los dos hooks tienen test — ver
[la sección de tests](./architecture/directory-structure.md#tests).

---

## Variables de Entorno

**Ninguna.** La app es enteramente cliente: sin backend, sin API keys, sin endpoints. La única variable
del proyecto es `NODE_VERSION` en `netlify.toml`, que configura la imagen de build de Netlify y no
llega al bundle.

Si algún día hace falta una, en Vite debe llevar el prefijo `VITE_` para ser visible desde el cliente
(`import.meta.env.VITE_FOO`). El prefijo `REACT_APP_` de Create React App **no** funciona y falla en
silencio.

---

## Enlaces Rápidos

- [CLAUDE.md](../CLAUDE.md) — Guía para Claude Code
- [netlify.toml](../netlify.toml) — Config de deploy (vive en la raíz del repo, no acá)

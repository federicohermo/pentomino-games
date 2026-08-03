# Documentación Técnica — Pentomino Games

Prototipo de instrumento musical basado en pentominós: un tablero donde cada pieza colocada dispara una
secuencia de cinco notas derivada de su identidad y su orientación.

## Índice de Documentación

### Arquitectura
- [Visión General](./architecture/overview.md) — Capas, stack y por qué todo vive en un archivo
- [Estructura de Directorios](./architecture/directory-structure.md) — Qué hay y qué está muerto
- [Modelo Musical](./architecture/modelo-musical.md) — Pieza → tónica, rotación → escala, reflexión → retrógrado
- [Capa de Audio](./architecture/audio.md) — Grafo Web Audio, envolvente ADSR, scheduler con lookahead

### Guías de Desarrollo
- [Inicio Rápido](./guides/quickstart.md) — Setup y comandos
- [Convenciones de Código](./guides/conventions.md) — Geometría, comentarios, estado
- [Troubleshooting](./guides/troubleshooting.md) — Errores reales que ya se pisaron en este repo

### Infraestructura
- [Deploy](./infra/deploy.md) — Netlify, rutas relativas a `base` y versión de Node

### Specs
- [specs/log.md](../specs/log.md) — Registro de specs, con estados y dependencias
- [specs/README.md](../specs/README.md) — Convención de formato y flujo de trabajo

---

## Stack Tecnológico

| Tecnología | Versión | Propósito |
|---|---|---|
| Vite | 7.x | Dev server y bundler |
| React | 19.x | Biblioteca UI |
| TypeScript | 5.8 | Tipado estático |
| Tailwind CSS | 4.x | Estilos utility-first, vía `@tailwindcss/vite` |
| Web Audio | — | Síntesis y scheduling, sin librería (`src/audio/engine.ts`) |

---

## Comandos Principales

```bash
npm run dev      # Dev server de Vite
npm run build    # tsc -b && vite build
npm run lint     # ESLint (flat config v9)
npm run preview  # Sirve el build de dist/
npm test         # Vitest — tests de audio con OfflineAudioContext
```

Los tests corren en `environment: 'node'` contra `node-web-audio-api`, **no en jsdom**: jsdom no
implementa Web Audio. Todavía no hay tests de componentes — ver
[troubleshooting](./guides/troubleshooting.md#offlineaudiocontext-is-not-defined-en-un-test) si hace
falta agregarlos.

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
- [netlify.toml](../../netlify.toml) — Config de deploy (vive en la raíz del repo, no acá)

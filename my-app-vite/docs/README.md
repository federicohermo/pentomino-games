# Documentación Técnica — Pentomino Games

Prototipo de instrumento musical basado en pentominós: un tablero donde cada pieza colocada dispara una
secuencia de cinco notas derivada de su identidad y su orientación.

## Índice de Documentación

### Arquitectura
- [Visión General](./architecture/overview.md) — Capas, stack y por qué todo vive en un archivo
- [Estructura de Directorios](./architecture/directory-structure.md) — Qué hay y qué está muerto
- [Modelo Musical](./architecture/modelo-musical.md) — Pieza → tónica, rotación → escala, reflexión → retrógrado
- [Capa de Audio](./architecture/audio.md) — Carga diferida de Tone.js, Transport y reconciliación de loops

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
| Tone.js | 15.x | Síntesis y scheduling musical |

---

## Comandos Principales

```bash
npm run dev      # Dev server de Vite
npm run build    # tsc -b && vite build
npm run lint     # ESLint (flat config v9)
npm run preview  # Sirve el build de dist/
```

**No hay comando `test`.** El proyecto no tiene runner configurado — ver
[troubleshooting](./guides/troubleshooting.md#no-hay-runner-de-tests) y el
[spec 001](../specs/001-notas-por-celda-en-orden-angular/plan.md), que lo incluye en su alcance.

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

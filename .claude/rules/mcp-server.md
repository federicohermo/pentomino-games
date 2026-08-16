---
paths:
  - "mcp-server/**/*.ts"
---

# MCP server

Segundo paquete del workspace: `pnpm install` desde la raíz instala los dos y sus deps quedan aisladas
en `mcp-server/node_modules`. Sus tests son de `node --test`, no de Vitest — los `include` no se pisan.
Es tooling: no entra al bundle ni al deploy.

- **Las tools son una fachada sobre `src/domain/` y `src/audio/`, no una copia.** Lo único propio del
  server es el render ASCII, el parseo de los specs y el formato de las respuestas. Si al agregar o
  tocar una tool aparece la tentación de calcular una rotación, una validez o una escala acá, falta un
  export en `src/domain/` — y eso es un cambio de `src/`, en su propio commit.
- **Los imports de `src/` llevan extensión `.ts`.** Node los necesita; Vite no. Un import sin extensión
  rompe el server y **no** rompe la app, así que el error sería invisible del lado del navegador —
  `pnpm mcp:test` es lo que lo ataja.
- **El punto de una regex no matchea el retorno de carro.** Los archivos del repo están en CRLF, así
  que un patrón terminado en `(.*)$` deja de matchear y el parseo devuelve cero resultados sin ningún
  error. Cortar líneas aceptando CRLF.

Detalle en [docs/guides/mcp-domain.md](../../docs/guides/mcp-domain.md).

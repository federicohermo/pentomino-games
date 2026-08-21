# Pentomino Games

Un prototipo de **instrumento musical**, no un juego con reglas de resolución. El usuario coloca
pentominós en un tablero de 10×6 y cada pieza dispara un arpegio de cinco notas —salvo que esté
muteada, que la deja ocupando su lugar y su tiempo sin sonar—. El tablero es un **recorrido**, no un
compás: un circuito cerrado visita las piezas, y el orden y los silencios salen de la geometría. No
hay puntaje ni condición de victoria: una feature se evalúa por si vuelve al instrumento más
expresivo, no más difícil.

Vite 7 · React 19 · TypeScript 5.8 · Tailwind CSS 4 · Web Audio (sin librería de audio).

## Correrlo

Node ≥ 20.19 o ≥ 22.12 (Vite 7). El gestor es **pnpm** y está fijado en `packageManager`: usar npm
deja un `package-lock.json` que el deploy puede llegar a preferir.

```sh
pnpm install
pnpm exec playwright install chromium   # una sola vez por clone
pnpm dev
pnpm verify                             # el gate antes de un PR
```

Chromium no está en el lockfile y el proyecto `browser` de Vitest lo necesita: sin esa segunda línea
el primer `verify` de un clone recién sacado falla. `verify` corre `lint ‖ typecheck ‖ suite ‖
mcp:test`, y `suite` incluye coverage con umbral 100 en las cuatro métricas. El resto de los scripts
está en `package.json`.

## A dónde ir

| Para | Archivo |
|---|---|
| La doc técnica entera: arquitectura, guías, infra | [docs/README.md](./docs/README.md) |
| El lenguaje visual: los 12 colores y su tónica | [DESIGN.md](./DESIGN.md) |
| Trabajar en el repo: comandos, capas, reglas | [CLAUDE.md](./CLAUDE.md) |
| La convención de los specs | [specs/README.md](./specs/README.md) |

Cada uno de esos archivos es la única fuente de lo suyo. Este README enlaza y no repite, para no ser
un lugar más donde la información pueda quedar vieja.

# Plan 023 — La verificación la corre la máquina

Tres pasos, independientes entre sí. El tercero es el que da el spec.

## Paso 1 — Las subidas que no son major

Las seis de `research.md` §5, en un solo `pnpm add -w -D`.

`vitest` sube a 4.1.11 aunque sea un patch sin consecuencia visible: es la precondición del 024 —
`@vitest/browser-playwright` se publica pinneado a la versión **exacta** del runner— y el motivo se
escribe al lado de la línea para que no parezca ruido.

**`eslint-plugin-react-hooks` no entra.** Es del spec del linter, y tiene que subir en el mismo commit
que migra el preset a su forma flat: sin eso `eslint` no arranca. Separarlos dejaría el repo en un
estado donde el lint no corre.

**Verificación:** `pnpm verify` verde.

## Paso 2 — Los dos `package.json`

`engines.node` en el raíz con el requisito de Vite 7 (`^20.19.0 || >=22.12.0`), y `CLAUDE.md` dejando
de atribuirlo al `engines` de Vite para atribuirlo al propio.

`typescript` de `dependencies` a `devDependencies` en `mcp-server`, con el argumento escrito: lo usa
`tsc` en `typecheck` y **no** lo usa `start`, porque Node ≥22.18 hace type-stripping nativo — que es el
mismo motivo del piso de `engines` que ese archivo ya declara.

**Verificación:** `pnpm install` sin warnings nuevos y `pnpm mcp:test` verde. Que el paquete siga
arrancando es tarea `[M]`.

## Paso 3 — El workflow

`.github/workflows/verify.yml`. Un job, cinco pasos: checkout, pnpm, node con caché, install congelado,
`pnpm verify`.

La decisión que hay que dejar escrita en el propio YAML es **por qué corre el script y no sus nodos**:
`verify` es el nodo de convergencia y su forma exacta ya costó dos trampas —el filtro `{.}` y el `$` del
regex—. Enumerar los nodos en el workflow crea un segundo lugar donde esa forma vive. Y hay una razón
inmediata además de la de principio: dos specs escritos en paralelo le están cambiando la forma —el del
linter lo encarece, el 029 le agrega un quinto nodo— y con el script el workflow no se entera.

La versión de pnpm sale de `packageManager`, que es de donde ya la toma Netlify vía Corepack: un solo
lugar donde vive ese número.

**Verificación, y es un AC:** el workflow tiene que **fallar** ante un error real antes de creerle que
pasa. Se rompe algo a propósito en la rama —un import prohibido en `domain/`, que es lo que el repo
verifica con el linter—, se confirma el rojo, y se revierte. Un CI que nunca se vio en rojo no está
verificado.

## Orden

```
paso 1 ─ paso 2 ─ paso 3      (los tres independientes; el 3 se verifica al final)
```

## Qué NO se toca

- Ni un archivo de `src/`.
- **`eslint.config.js`, entero.** El preset de react-hooks, el `--max-warnings 0`, el `ecmaVersion`, el
  bloque para los `.js` y las reglas por ruta son del spec del linter.
- El bloque `test` de `vite.config.ts` — lo toca el 024.
- El umbral de coverage — lo pone el 029, y este workflow lo hereda sin cambios.
- Los cinco majors.

# Plan 023 — La verificación la corre la máquina

Tres pasos, independientes entre sí. El tercero es el que da el spec.

## Paso 1 — Las subidas que quedan

Las cuatro de `research.md` §5, en un solo `pnpm add -w -D` (`react` y `react-dom` van a `dependencies`,
así que son dos comandos): `react` y `react-dom` a `^19.2.8`, `@types/react` a `^19.2.18`,
`@types/react-dom` a `^19.2.4`, `node-web-audio-api` a `^2.2.0`.

**Lo que este paso NO hace, y hay que verificarlo en vez de hacerlo:**

- `vitest` y las tres `@vitest/*` se quedan en `4.1.11` **sin caret**. El 029 las pinneó exactas a
  propósito —`@vitest/browser-playwright` se publica pinneado a la versión exacta del runner— y
  escribir `^4.1.11` sería una regresión, no una subida.
- `typescript-eslint`, `eslint-plugin-react-hooks` y `eslint-plugin-react-refresh` ya están arriba: los
  subió el 030.
- `typescript` se queda en `~5.8.3`, con la medición del docblock de `freqBuf` en contra.

**Verificación:** `pnpm verify` verde, y `grep '"vitest"' package.json` sin caret.

## Paso 2 — Los dos `package.json`

`engines.node` en el raíz con el requisito de Vite 7 (`^20.19.0 || >=22.12.0`), y `CLAUDE.md:93` dejando
de atribuirlo al `engines` de Vite para atribuirlo al propio.

`typescript` de `dependencies` a `devDependencies` en `mcp-server`, con el argumento escrito: lo usa
`tsc` en `typecheck` y **no** lo usa `start`, porque Node ≥22.18 hace type-stripping nativo — que es el
mismo motivo del piso de `engines` que ese archivo ya declara.

Nota sobre el `engines` del raíz: queda en el requisito de **Vite**, no en `>=22.18`. Es a propósito —
`CLAUDE.md` ya declara que con Node 20 «solo se pierde el server»—, y el piso del server sigue viviendo
en el `engines` del server, que es quien lo necesita.

**Verificación:** `pnpm install` sin warnings nuevos y `pnpm mcp:test` verde. Que el paquete siga
arrancando es tarea `[M]`.

## Paso 3 — El workflow

`.github/workflows/verify.yml`. Un job, seis pasos: checkout, pnpm, node con caché, install congelado,
**`playwright install --with-deps chromium`**, `pnpm verify`.

Ese quinto paso no es opcional y no es del 024. Desde que el 029 mergeó, `verify` corre ocho
`*.browser.test.tsx` en Chromium de verdad, y el navegador no está en el lockfile: sin el paso el job no
llega a ejecutar un test. Va con `--with-deps` porque el runner de Ubuntu no trae las librerías de
sistema que Chromium necesita.

La decisión que hay que dejar escrita en el propio YAML es **por qué corre el script y no sus nodos**:
`verify` es el nodo de convergencia y su forma exacta ya costó dos trampas —el filtro `{.}` y el `$` del
regex—. Enumerar los nodos en el workflow crea un segundo lugar donde esa forma vive. Y esa decisión ya
tiene evidencia y no sólo principio: el 029 le cambió la forma —`test` pasó a ser `suite`, que es
`test && coverage`— y un workflow con la lista habría seguido corriendo `test` a secas, o sea verde sin
el gate de coverage.

La versión de pnpm sale de `packageManager`, que es de donde ya la toma Netlify vía Corepack: un solo
lugar donde vive ese número. `pnpm/action-setup` la lee de ahí cuando no se le pasa `version`, y va
**antes** de `actions/setup-node`, porque `cache: pnpm` necesita el binario ya instalado.

**Verificación, y son dos ACs:** el workflow tiene que **fallar** ante un error real antes de creerle
que pasa.

1. Se rompe algo a propósito en la rama —un import prohibido en `domain/`, que es lo que el repo
   verifica con el linter—, se confirma el rojo **y que el rojo lo reporta `lint`**, y se revierte
   (AC7).
2. Se borra un test a propósito, se confirma que el rojo lo reporta el gate de coverage nombrando la
   métrica, y se revierte (AC9 — que es AC13 del 029, diferido acá).

Un CI que nunca se vio en rojo no está verificado, y un gate de coverage que nunca se vio morder en un
PR tampoco.

## Orden

```
paso 1 ─ paso 2 ─ paso 3      (los tres independientes; el 3 se verifica al final)
```

## Qué NO se toca

- Ni un archivo de `src/`.
- **`eslint.config.js`, entero.** Es del 030, que ya mergeó.
- El bloque `test` de `vite.config.ts` y el umbral de coverage — son del 029, y este workflow los hereda
  sin tocarlos.
- `.gitignore` — el 029 ya le puso `.vitest-attachments/` y `**/__screenshots__/`.
- Los siete majors.

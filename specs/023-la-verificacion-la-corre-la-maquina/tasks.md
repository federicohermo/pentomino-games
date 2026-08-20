# Tasks 023 — La verificación la corre la máquina

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — Versiones

- [ ] T001 `package.json`: subir `react` y `react-dom` a `^19.2.8`, `@types/react` a `^19.2.18` y
      `@types/react-dom` a `^19.2.4`. Los cuatro juntos: los tipos y el runtime se mueven en pareja
- [ ] T002 [P] `package.json`: subir `typescript-eslint` a `^8.67.0` y `node-web-audio-api` a `^2.2.0`
- [ ] T003 `package.json`: subir `vitest` a `^4.1.11`, **con el motivo escrito al lado**: es un patch sin
      consecuencia visible hoy, y es la precondición del 024 — `@vitest/browser-playwright` se publica
      pinneado a la versión **exacta** del runner, así que con 4.1.10 quedarían dos en el árbol
- [ ] T004 **`eslint-plugin-react-hooks` NO se toca acá.** Es del spec del linter, y su subida tiene que
      ir en el mismo commit que migra el preset a su forma flat: sin eso `eslint` no arranca. Separarlos
      dejaría el repo con el lint caído
- [ ] T005 Confirmar que ninguna subida es major y que `typescript` sigue en `~5.8.3` — **AC6**
- [ ] T006 `pnpm install` y commitear `pnpm-lock.yaml` en el mismo commit que `package.json`
- [ ] T007 `pnpm verify` verde

## Paso 2 — Los dos `package.json`

- [ ] T008 [P] `package.json` raíz: `"engines": { "node": "^20.19.0 || >=22.12.0" }`, que es el
      requisito de Vite 7 — **AC4**
- [ ] T009 [P] `mcp-server/package.json`: `typescript` de `dependencies` a `devDependencies`, con el
      argumento al lado (lo usa `tsc` en `typecheck`; **no** lo usa `start`, porque Node ≥22.18 hace
      type-stripping nativo — el mismo motivo del piso de `engines` que ese archivo ya declara) — **AC4**
- [ ] T010 `CLAUDE.md`: la línea de Node deja de atribuir el requisito al `engines` de Vite y nombra el
      propio
- [ ] T011 `pnpm install` y `pnpm mcp:test` verde
- [ ] T012 [M] `pnpm --filter mcp-server start` arranca y responde una tool

## Paso 3 — El workflow

- [ ] T013 `.github/workflows/verify.yml`: disparadores `pull_request` y `push` a `main`
- [ ] T014 Pasos: `actions/checkout`, `pnpm/action-setup` (versión **desde `packageManager`**, no
      escrita a mano), `actions/setup-node` con `node-version: 22` y `cache: pnpm`,
      `pnpm install --frozen-lockfile`, `pnpm verify` — **AC1**, **AC2**
- [ ] T015 **El workflow corre el script, no la lista de nodos** — **AC3**. Comentario en el YAML con las
      dos razones: `verify` ya costó dos trampas (`{.}` y el `$` del regex) y enumerar sus nodos crearía
      un segundo lugar donde esa forma vive; y ahora mismo dos specs le están cambiando la forma —el del
      linter lo encarece, el [029](../029-lo-que-no-se-cubre-no-se-mergea/spec.md) le agrega un quinto
      nodo— así que con el script el workflow no se entera
- [ ] T016 Comentario con lo que **no** hace: no arma matriz de Node (D2) y no despliega — Netlify ya lo
      hace
- [ ] T017 **Ver el workflow en rojo antes de creerle el verde.** Romper algo a propósito en la rama —un
      import prohibido en `domain/`, que es lo que el repo verifica con el linter—, confirmar que la CI
      falla, y revertirlo. Un CI que nunca se vio fallar no está verificado — **AC7**
- [ ] T018 Confirmar que el rojo del T017 vino de `lint` y no de otro nodo: es lo que prueba que el
      paralelo de `verify` reporta el nodo correcto a través de Actions

## Cierre

- [ ] T019 `pnpm verify` verde: 322 + 85 tests — **AC5**
- [ ] T020 [P] `CLAUDE.md`: la sección de Comandos dice que `verify` lo corre la CI sobre cada PR
- [ ] T021 [P] `docs/guides/quickstart.md`: mencionar el workflow donde ya se nombran los comandos
- [ ] T022 [P] `README.md`: badge del workflow, si el archivo ya tiene encabezado donde apoyarlo. **Ojo**:
      el 028 lo reescribe entero, así que si ese spec ya cerró, el badge va en el README nuevo
- [ ] T023 Actualizar la fila del 023 en `specs/log.md` a `Implementado` — **queda abierta a propósito**:
      en este repo el estado del spec lo mueve el **merge**, no la rama
- [ ] T024 PR contra `main`

## Seguimiento (no bloquea)

- [ ] T025 **Cachear el caché de Playwright** (`~/.cache/ms-playwright`) cuando el 024 agregue su paso.
      Son ~130 MB por corrida; hoy el job no tiene presión de tiempo
- [ ] T026 **Los cinco majors** (`vite` 8, `eslint` 10, `@vitejs/plugin-react` 6, `@types/node` 26,
      `globals` 17). Cada uno pide su propia evidencia; `typescript` 7 **no** entra: ya tiene su medición
      en contra en el docblock de `freqBuf`
- [ ] T027 **El ruido de `baseline-browser-mapping`** en stdout durante `eslint`. Viene de una
      transitiva del ecosistema de Vite, no cambia el exit code. Anotado para que nadie lo lea como un
      fallo de la CI

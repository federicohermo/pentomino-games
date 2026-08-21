# Tasks 023 — La verificación la corre la máquina

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

> **Revisado contra `37abf53`.** El 029 y el 030 mergearon después de que se escribiera este spec y se
> llevaron parte de su Paso 1. Las tareas afectadas **no se renumeraron**: las que ya están hechas por
> otra rama pasaron de «subir» a **«verificar que sigue así»**, que es trabajo real y falsable, y no se
> borran para no romper las referencias que les hacen los ACs.

## Paso 1 — Versiones

- [x] T001 `package.json`: subir `react` y `react-dom` a `^19.2.8`, `@types/react` a `^19.2.18` y
      `@types/react-dom` a `^19.2.4`. Los cuatro juntos: los tipos y el runtime se mueven en pareja
- [x] T002 `package.json`: subir `node-web-audio-api` a `^2.2.0`. **Sin `[P]`**: toca el mismo archivo
      que T001, T003 y T004. `typescript-eslint` **ya está** en `^8.67.0` (`package.json:45`) — lo subió
      el 030, así que acá sólo se verifica
- [x] T003 `package.json`: **verificar que `vitest` sigue en `4.1.11` SIN caret**, igual que
      `@vitest/browser`, `@vitest/browser-playwright` y `@vitest/coverage-v8` (`package.json:32-34,47`).
      La versión de la primera pasada de este spec decía «subir a `^4.1.11`» y **eso hoy es una
      regresión**: el 029 ya la subió y la pinneó exacta porque `@vitest/browser-playwright` se publica
      pinneado a la versión exacta del runner, así que un caret deja entrar un 4.1.12 y vuelve a partir
      el árbol en dos runners
- [x] T004 **`eslint-plugin-react-hooks` ya está en `^7.1.1`** (`package.json:38`). Lo subió el 030, en
      el mismo commit que migró el preset a su forma flat — que era exactamente el motivo por el que
      este spec lo dejaba afuera. Acá sólo se verifica que no bajó. Ídem
      `eslint-plugin-react-refresh` en `^0.5.4` (`package.json:39`)
- [x] T005 Confirmar que ninguna subida es major, que `typescript` sigue en `~5.8.3` y que las cuatro
      `vitest*` siguen sin caret — **AC6**
- [x] T006 `pnpm install` y commitear `pnpm-lock.yaml` en el mismo commit que `package.json`
- [x] T007 `pnpm verify` verde

## Paso 2 — Los dos `package.json`

- [x] T008 [P] `package.json` raíz: `"engines": { "node": "^20.19.0 || >=22.12.0" }`, que es el
      requisito de Vite 7 — **AC4**. Va el de Vite y **no** `>=22.18`: con Node 20 sólo se pierde el
      server, y el piso del server ya vive en el `engines` del server
- [x] T009 [P] `mcp-server/package.json`: `typescript` de `dependencies` a `devDependencies`, con el
      argumento al lado (lo usa `tsc` en `typecheck`; **no** lo usa `start`, porque Node ≥22.18 hace
      type-stripping nativo — el mismo motivo del piso de `engines` que ese archivo ya declara) — **AC4**
- [x] T010 `CLAUDE.md:93`: la línea de Node deja de atribuir el requisito al `engines` de Vite y nombra
      el propio
- [x] T011 `pnpm install` y `pnpm mcp:test` verde: **105 tests**
- [x] T012 [M] `pnpm --filter mcp-server start` arranca y responde una tool. **Hecho sin una persona:**
      era el riesgo real de T009 —sacar `typescript` de `dependencies`— así que se verificó spawneando
      `node src/index.ts` en un proceso fresco y hablándole JSON-RPC por stdio. `initialize` devolvió
      `pentomino-domain 1.0.0` y `describe_piece({piece:"T"})` devolvió su `cellMap`. El proceso fresco
      importa: el server de la sesión cachea los módulos y habría respondido con el código viejo

## Paso 3 — El workflow

- [x] T013 `.github/workflows/verify.yml`: disparadores `pull_request` y `push` a `main`
- [x] T014 Pasos, en este orden: `actions/checkout`, `pnpm/action-setup` (versión **desde
      `packageManager`**, no escrita a mano), `actions/setup-node` con `node-version: 22` y
      `cache: pnpm` —después de pnpm, porque el caché necesita el binario ya instalado—,
      `pnpm install --frozen-lockfile`, `pnpm exec playwright install --with-deps chromium`,
      `pnpm verify` — **AC1**, **AC2**, **AC8**
- [x] T015 **El workflow corre el script, no la lista de nodos** — **AC3**. Comentario en el YAML con las
      dos razones: `verify` ya costó dos trampas (`{.}` y el `$` del regex) y enumerar sus nodos crearía
      un segundo lugar donde esa forma vive; y la evidencia de que funciona ya existe — el
      [029](../029-lo-que-no-se-cubre-no-se-mergea/spec.md) le cambió `test` por `suite`
      (`test && coverage`), así que un workflow con la lista habría seguido corriendo `test` a secas, o
      sea **verde sin el gate de coverage**
- [x] T016 Comentario con lo que **no** hace: no arma matriz de Node (D2) y no despliega — Netlify ya lo
      hace
- [ ] T017 [M] **Ver el workflow en rojo antes de creerle el verde.** Romper algo a propósito en la rama
      —un import prohibido en `domain/`, que es lo que el repo verifica con el linter—, confirmar que la
      CI falla, y revertirlo. Un CI que nunca se vio fallar no está verificado — **AC7**.
      `[M]` porque leer una corrida de Actions pide la web o `gh`, y `gh` no está en el PATH de este repo

      > **Al implementar: la primera corrida salió en rojo sola, sin plantarle nada.** El job llegó al
      > final —los seis pasos previos pasaron, incluido Chromium— y `pnpm verify` salió con exit 1
      > ([run 32486122534](https://github.com/federicohermo/pentomino-games/actions/runs/32486122534)).
      > Eso deja **medio T017 cumplido de casualidad** —el rojo existe y llega al check del PR— y deja
      > **T018 como el bloqueante real**: el log pide sign-in, así que no se pudo determinar de qué nodo
      > vino. Descartado que sea el entorno (`CI=true pnpm verify` local da exit 0) y descartada una
      > deriva del lockfile (`--frozen-lockfile` local da exit 0). La hipótesis con evidencia es la
      > contención de CPU sobre los presupuestos de performance del 009: son **los mismos dos tests**
      > que fallaron en la primera pasada local de esta rama con cinco worktrees compitiendo. Si es eso,
      > **el arreglo no es de este spec**: tocar ese presupuesto es tocar `src/`, y AC10 lo prohíbe
- [ ] T018 [M] Confirmar que el rojo del T017 vino de `lint` y no de otro nodo: es lo que prueba que el
      paralelo de `verify` reporta el nodo correcto a través de Actions
- [ ] T028 [M] **Ver morder el gate de coverage en un PR** — **AC9**, que es **AC13 del 029** diferido
      acá. Borrar un test a propósito, confirmar que la CI queda en rojo **nombrando la métrica** y que
      la tabla de coverage se imprime en el log (`reportOnFailure: true` ya está puesto), y revertirlo.
      Distinto de T017: ahí el rojo lo da `lint`; acá lo da `suite`, que es el nodo que este spec vuelve
      obligatorio

## Cierre

- [x] T019 `pnpm verify` verde: **457 tests de `src/` en 26 archivos + 105 del server**, y coverage en
      100 en las cuatro métricas — **AC5**. Los dos números están **medidos en `main` hoy** y son el
      piso, no la igualdad: los otros cuatro specs del lote 023–028 agregan tests, así que si alguno
      mergea antes que éste el conteo sube y el AC se lee como **«no baja de 457 + 105, y el coverage
      sigue en 100»**. Este spec no toca `src/`, así que no puede moverlos él
- [x] T029 Confirmar que el diff no toca `src/`, `eslint.config.js` ni `vite.config.ts`:
      `git diff --name-only main` — **AC10**
- [x] T020 [P] `CLAUDE.md`: la sección de Comandos dice que `verify` lo corre la CI sobre cada PR, con
      Chromium instalado por el workflow
- [x] T021 [P] `docs/guides/quickstart.md`: mencionar el workflow donde ya se nombran los comandos, y
      aclarar que el `pnpm exec playwright install chromium` de la línea 17 es para el clone local — en
      CI lo hace el workflow
- [x] T030 [P] `specs/revisiones.md`: anotar §023 con las dos cosas que este spec aprendió al revisarse
      contra un `main` que ya no era el suyo — (1) el paso de Chromium se mudó del 024 al 023 porque el
      029 adelantó el proyecto de navegador, así que **AC10 y T022 del 024 quedan cumplidos por acá**; y
      (2) una subida de versión escrita en un spec caduca: `vitest` pasó de «subir a `^4.1.11`» a
      «verificar que sigue `4.1.11` sin caret» entre que se escribió y que se implementó
- [ ] T022 [P] `README.md`: badge del workflow. **Verificado hoy**: el README sigue siendo las 69 líneas
      de la plantilla de Vite, sin un encabezado propio donde apoyarlo, así que la respuesta por defecto
      es **no ponerlo acá** — el badge va con el README que reescribe el 028. Si el 028 ya cerró cuando
      se implemente esto, entonces sí. **Resuelto al implementar: NO.** El 028 corre en otro carril del
      mismo lote y no estaba mergeado; el `README.md` sigue siendo las 69 líneas de la plantilla de
      Vite. Queda para el 028, que es quien va a tener dónde apoyarlo
- [ ] T023 Actualizar la fila del 023 en `specs/log.md` a `Implementado` — **queda abierta a propósito**:
      en este repo el estado del spec lo mueve el **merge**, no la rama
- [x] T024 PR contra `main` — [#26](https://github.com/federicohermo/pentomino-games/pull/26)

## Seguimiento (no bloquea)

- [ ] T025 **Cachear `~/.cache/ms-playwright`** con `actions/cache`, clavado a la versión de
      `playwright` del lockfile. Son ~130 MB por corrida; hoy el job no tiene presión de tiempo. La
      instalación en sí **no** es seguimiento: entra en T014 (AC8)
- [ ] T026 **Los seis majors que sí son candidatos** (`vite` 8, `eslint` 10, `@eslint/js` 10, `@vitejs/plugin-react` 6,
      `@types/node` 26, `globals` 17). Cada uno pide su propia evidencia; `typescript` 7 **no** entra: ya
      tiene su medición en contra en el docblock de `freqBuf`
- [ ] T027 **El ruido de `baseline-browser-mapping`** en stdout durante `eslint`. Viene de una
      transitiva del ecosistema de Vite, no cambia el exit code. Anotado para que nadie lo lea como un
      fallo de la CI

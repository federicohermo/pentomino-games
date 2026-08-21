# Tasks 024 — Los componentes se verifican en un navegador

Formato en [`specs/README.md`](../README.md).

> **Casi todo este archivo ya está en el árbol, y no lo puso este spec: lo puso el
> [029](../029-lo-que-no-se-cubre-no-se-mergea/spec.md).** El 024 seguía en `Propuesto` y sin rama
> cuando el 029 necesitó el proyecto de navegador para llegar al 100 % de coverage, así que lo
> construyó **siguiendo el diseño que este spec ya había fijado** —segundo *project* de Vitest, sufijo
> `*.browser.test.tsx`, setup con la hoja de estilos— para que no hubiera dos versiones.
>
> **Qué significa `[x]` acá:** que la cosa **está en el árbol**, no que la haya hecho esta rama. Las
> marcadas `⟨029⟩` las trajo ese spec. Se marcan y no se borran porque el texto es el registro de la
> decisión —los specs de este repo son ADR—, y se marcan y no se dejan abiertas porque una casilla
> abierta que ya está hecha le miente a `spec_status` para siempre: reportaba **30 pendientes**
> fantasma.
>
> **Los nombres de archivo se corrigieron al del árbol.** Este spec los había escrito en kebab-case y
> con el setup en la raíz; el 029 los puso en PascalCase igual al componente y el setup adentro de
> `src/components/__tests__/`. Manda el árbol, y además es la convención que `revisiones.md` ya había
> fijado al corregir los nombres en castellano del 022.
>
> **Lo que queda abierto es UNA tarea, y es `[M]`: T029** —correr el proyecto de navegador en modo
> no-headless una vez—. Nadie la hizo y ninguna corrida headless puede firmarla. Las otras dos que el
> review había dejado abiertas se cerraron: **T022 se mudó al 023** (ahí es AC propio, no una tarea
> prestada) y **T030 ya está escrita** — la fila dice `Superado`.
>
> **Este spec no abre rama.** No hay diff que abrir: su trabajo entró por el PR #24. Lo que queda de él
> es su valor como registro —qué se decidió, qué se midió, y qué de eso resultó falso—, que es
> exactamente por lo que un spec no se borra al quedar terminal.

## Paso 1 — Infra

- [x] T001 ⟨029⟩ `pnpm add -w -D @vitest/browser-playwright vitest-browser-react playwright`. Anotar que
      `@vitest/browser-playwright` resuelve a **`4.1.11` exacta**, no a un rango: se publica pinneado a
      la versión de `vitest`. En el árbol: `package.json` las tiene, más `@vitest/browser` en 4.1.11
      exacta, que este spec no había previsto
- [x] T002 ⟨029⟩ `pnpm exec playwright install chromium`. Verificar en disco que bajó
      (`%LOCALAPPDATA%\ms-playwright` en Windows). **No entra al repo**. Está documentado en
      `docs/guides/quickstart.md`: un clone nuevo lo necesita antes del primer `verify`
- [x] T003 ⟨029⟩ `vite.config.ts`: el bloque `test` pasa a `projects`, con `node` (los de hoy, sin tocar) y
      `browser` — **AC1**
- [x] T004 ⟨029⟩ ~~El proyecto `browser` repite `plugins: [react(), tailwindcss()]`~~ — **el árbol lo
      resolvió mejor y D3 quedó falsificado**. Los dos proyectos llevan `extends: true` y con eso
      heredan `plugins` **y** el bloque `coverage`, así que no hay nada que repetir. Las dos mediciones
      son compatibles —sin `extends`, no hereda—; la que sobrevive está en el `research.md` §4 del 029
- [x] T005 ⟨029⟩ La convención de nombre queda escrita en el `include`: `*.browser.test.tsx` para navegador,
      `*.test.ts` para node — D2, el sufijo y no una carpeta. En el árbol los dos `include` además
      anclan la carpeta: `src/**/__tests__/*.test.ts` y `src/**/__tests__/*.browser.test.tsx`
- [x] T006 ⟨029⟩ ~~Un test trivial de tres líneas~~ — no quedó rastro, y por lo tanto tampoco hay nada que
      borrar en T017
- [x] T007 ⟨029⟩ `pnpm test` reporta los dos proyectos — **AC1**. El número que este spec fijó (322) es de
      `052aedf`: hoy son **562** y ninguno de los viejos se tocó
- [x] T008 ⟨029⟩ `pnpm verify` sigue teniendo **cuatro** nodos — **AC2**. Y se defendió: el 029 preveía
      llevarlo a cinco, los presupuestos de performance del 009 se cayeron, y la salida fue encadenar
      `suite = test && coverage` para volver a cuatro. El nodo se llama `suite` y no `test`

## Paso 2 — El setup, que es la trampa

- [x] T009 ⟨029⟩ `src/components/__tests__/browser-setup.ts` —y no `vitest.setup.browser.ts` en la raíz—:
      importa `../../styles/index.css` y nada más
- [x] T010 ⟨029⟩ Docblock más largo que el import, con la medición: sin la hoja, `z-10` está en el `className`
      y `getComputedStyle(...).zIndex` computa **`auto`**, así que un test de layout falla **igual que
      fallaría un bug real**. Por eso va en el setup del proyecto y no a criterio de cada test — D4. En
      el árbol el docblock agrega dos casos más que este spec no tenía: un `h-24` leído `auto` y el
      `getBoundingClientRect()` de un canvas estirado por CSS devolviendo 0
- [x] T011 ⟨029⟩ Cablearlo con `setupFiles` **sólo** en el proyecto `browser`. El de node no lo carga

## Paso 3 — Tanda A: comportamiento (sobrevive al lote 018–021)

- [x] T012 ⟨029⟩ `use-input.browser.test.tsx`: la rueda sobre el tablero dispara un `WheelEvent` cancelable y
      `defaultPrevented` queda en `true` — **AC3**. `use-input.browser.test.tsx:146`
- [x] T013 ⟨029⟩ ~~El test monta **`App`** y no `Board`~~ — **el árbol eligió un tercer camino y es mejor**:
      monta el hook solo, con `renderHook(() => useRuedaRota({ current: el }, …))` sobre un `div`
      suelto. El riesgo que T013 quería evitar —un tablero sin listener colgado— desaparece por
      construcción, y el test no arrastra el árbol entero de `App` para afirmar sobre un listener.
      Además el árbol agrega la afirmación de **forma** que este spec no tenía: que el registro sea
      `addEventListener(..., { passive: false })` (`use-input.browser.test.tsx:162`)
- [x] T014 ⟨029⟩ **Verlo en rojo** — **AC4**. El árbol lo hizo por la vía más fuerte: un pase de mutación
      cambiando el registro a `{ passive: true }` pone el `expect` en rojo, y queda escrito en el
      comentario de `use-input.browser.test.tsx:153-158`
- [x] T015 ⟨029⟩ `Ctrl`+rueda: no cambia la rotación **y** no llama a `preventDefault` — **AC5**.
      `use-input.browser.test.tsx:177`. Y afirma la tercera mitad que D10 del 013 nombra y este spec no
      había pedido: que **igual ensucie el tap limpio**, o sea que el `keyup` del `Ctrl` no refleje

## Paso 3 — Tanda B: layout (depende del setup)

- [x] T016 [P] ⟨029⟩ `Playhead.browser.test.tsx`: la capa computa `z-index: 10` y no `auto` — **AC6**.
      `Playhead.browser.test.tsx:65`, con el docblock citado en el comentario de arriba y sobre **las
      dos capas** —velo y cabeza—, no una
- [x] T017 [P] ⟨029⟩ `Board.browser.test.tsx`: la grilla mide `10 × CELL_PX` y el `body` **no gana scroll
      horizontal** a 375 px de viewport — **AC7**. `Board.browser.test.tsx:74`, con
      `page.viewport(375, 800)` y un `finally` que lo devuelve
- [x] T018 [P] ⟨029⟩ `OrientationPanel.browser.test.tsx`: el ancho del contenedor de las miniaturas es el
      mismo con `rotation: 0` y con `rotation: 1` — la caja fija de 5×5 del 016 — **AC8**.
      `OrientationPanel.browser.test.tsx:59`, y más fuerte que el AC: mide **las cuatro rotaciones por
      los dos espejos**, ancho y alto, botón por botón. Más un segundo test (`:88`) que afirma el
      **tamaño** de las pistas, porque un pase de mutación mostró que con `min-content` las cinco
      pistas siguen existiendo colapsadas a cero y el primer test pasaba igual
- [x] T019 [P] ⟨029⟩ `PiecePalette.browser.test.tsx`: la línea «Notas actuales» tiene el mismo alto con el
      mejor y el peor de los 48 casos (`F#4 · G#4 · A#4 · C#5 · D#5`, cinco sostenidos) — **AC9**.
      `PiecePalette.browser.test.tsx:50`, y agrega que sean **dos renglones y no uno estirado**,
      comparando contra el `lineHeight` computado en vez de contra un número de memoria
- [x] T020 ⟨029⟩ Los cuatro se escriben como **invariantes y no como medidas** — D5. Cumplido: los cuatro
      comparan contra una constante importada (`CELL_PX`, `GRID_W`, `MINI_BOX`, `MINI_CELL_PX`) o
      contra otra medición del mismo test. Ningún número de layout literal
- [x] T021 ⟨029⟩ Que el oráculo dependa de la hoja y no de la suerte. En el árbol quedó como **guarda
      adentro de cada test** en vez de como una comprobación de una sola vez: `PiecePalette:66` y
      `OrientationPanel:76` afirman `> 0` antes de comparar, y `OrientationPanel:140` afirma que el
      borde no sea el valor inicial. Es más barato de mantener que sacar y volver a poner el setup

## Paso 4 — CI y registro

- [x] T022 ⟨023⟩ ~~`.github/workflows/verify.yml`: paso `pnpm exec playwright install --with-deps chromium`~~
      — **AC10 se mudó al 023 y ahí es AC propio**, no una tarea prestada: `023/spec.md:173` (AC8) y
      `023/tasks.md:52`. La mudanza es la correcta y no un atajo: hacerla desde acá obligaba a crear el
      workflow entero, que es justamente el spec del 023. Y el 023 la necesita para sí mismo — sin
      Chromium su propio AC del rojo plantado es infalsificable, porque el rojo vendría del binario que
      falta. **Nada que hacer de este lado**; el gate de navegador deja de existir-sin-correr cuando
      mergee el 023, igual que el de coverage del 029 (su AC13, diferido por lo mismo)
- [x] T023 [P] ⟨029⟩ `.gitignore`: `.vitest-attachments/` y `**/__screenshots__/`. Las dos líneas están, y el
      caso ya se dio: hay un `src/components/__tests__/__screenshots__/` en disco y sin trackear
- [x] T024 [P] ⟨029⟩ `specs/deuda.md`: el ítem «No hay tests de UI» se **reescribe**, no se borra — **AC11**.
      Está hecho, y con el matiz que D6 pedía: el ítem dice qué cubre y qué **no** —«una verificación
      de que la app se vea BIEN, que es otra cosa y otro spec»—. La diferencia con lo que este spec
      preveía es de grado y a favor: no son seis invariantes sobre seis componentes sino el 100 % en
      las cuatro métricas, así que la mitad que queda abierta es más chica de lo que D6 calculaba
- [x] T025 [P] ⟨029⟩ `CLAUDE.md`: la sección de comandos nombra los dos proyectos y **conserva el argumento
      contra jsdom**, ampliado con los casos concretos (`Spectrum.tsx` y `audio/engine.ts`)
- [x] T026 [P] ⟨029⟩ `.claude/rules/ui.md`: dice cuál test va a cuál proyecto y por qué, con el criterio de D5
- [x] T027 [P] ⟨029⟩ `docs/guides/quickstart.md`: los comandos, más el `playwright install chromium` que un
      clone nuevo necesita porque Chromium no está en el lockfile
- [x] T028 ⟨029⟩ `pnpm verify` verde con los dos proyectos
- [ ] T029 [M] Correr el proyecto de navegador en modo no-headless una vez, para ver el tablero de
      verdad y confirmar que lo que se testea es lo que se ve. **Sobrevive**: es lo único que nadie
      hizo y que ninguna corrida headless puede firmar
- [x] T030 ⟨review⟩ La fila del 024 en `specs/log.md` quedó en **`Superado`**, con el precedente del 004
      («Superado por el 009»). **La excepción a «el estado lo mueve el merge» está justificada**: esa
      regla existe para que una rama no declare hecho lo que todavía no mergeó, y acá no hay rama que
      pueda mergear nunca — el trabajo entró por el PR #24, que es el del 029. Dejarla en `Propuesto`
      esperando un merge que no va a existir es lo que producía las 30 casillas fantasma
- [x] T031 ~~PR contra `main`~~ — no hay diff que abrir. El trabajo entró por el PR #24, que es el del 029

## Seguimiento (no bloquea)

- [ ] T032 **Cachear `~/.cache/ms-playwright` en la CI** con `actions/cache`. Son ~130 MB por corrida y
      hoy el job no tiene presión de tiempo, así que se anota y no se hace. Sigue vivo, y sigue
      esperando al 023 igual que T022
- [x] T033 ⟨029⟩ ~~Los tests de audio en navegador~~ — **la puerta se cruzó**. El 029 los necesitó para
      cubrir `audio/engine.ts` y `Spectrum.tsx`, y resolvió la política de autoplay que esta tarea
      nombraba con `launchOptions.args: ['--autoplay-policy=no-user-gesture-required']` en
      `vite.config.ts`
- [ ] T034 **Snapshots visuales.** Playwright puede; es otra decisión (qué cuenta como cambio, dónde
      viven las referencias) y no cabe en este spec. Es lo único que `deuda.md` deja abierto del ítem
      de tests de UI
- [ ] T035 **Los cuatro tests de layout se rompen con el 019, el 020 y el 021**, y eso es lo buscado: un
      spec que cambie el layout va a tener que decidir el número nuevo en vez de re-verificarlo a ojo.
      Está medido cuál rompe cuál en `research.md` §11. **Sigue vigente y ahora es más caro**: con el
      umbral de coverage en 100, un spec que borre uno de esos tests sin reemplazarlo no mergea

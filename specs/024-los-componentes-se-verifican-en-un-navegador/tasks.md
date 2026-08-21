# Tasks 024 — Los componentes se verifican en un navegador

Formato en [`specs/README.md`](../README.md). **Precondición: el 023 mergeado** (`vitest` en 4.1.11 y el
workflow existiendo).

## Paso 1 — Infra

- [ ] T001 `pnpm add -w -D @vitest/browser-playwright vitest-browser-react playwright`. Anotar que
      `@vitest/browser-playwright` resuelve a **`4.1.11` exacta**, no a un rango: se publica pinneado a
      la versión de `vitest`
- [ ] T002 `pnpm exec playwright install chromium`. Verificar en disco que bajó
      (`%LOCALAPPDATA%\ms-playwright` en Windows). **No entra al repo**
- [ ] T003 `vite.config.ts`: el bloque `test` pasa a `projects`, con `node` (los 322 de hoy, sin tocar) y
      `browser` — **AC1**
- [ ] T004 El proyecto `browser` repite `plugins: [react(), tailwindcss()]`, **con el comentario de por
      qué**: medido, un `projects[]` no los hereda y sin `react()` el JSX no compila. Es la línea que
      alguien va a querer borrar por parecer duplicada
- [ ] T005 La convención de nombre queda escrita en el `include`: `*.browser.test.tsx` para navegador,
      `*.test.ts` para node — D2, el sufijo y no una carpeta
- [ ] T006 Un test trivial de tres líneas en el navegador, para ver arrancar Chromium **antes** de
      escribir los seis de verdad. Se borra en el T017
- [ ] T007 `pnpm test` reporta los dos proyectos y node sigue en 322 — **AC1**
- [ ] T008 `pnpm verify` sigue teniendo **cuatro** nodos — **AC2**

## Paso 2 — El setup, que es la trampa

- [ ] T009 `vitest.setup.browser.ts`: importa `src/styles/index.css` y nada más
- [ ] T010 Docblock más largo que el import, con la medición: sin la hoja, `z-10` está en el `className`
      y `getComputedStyle(...).zIndex` computa **`auto`**, así que un test de layout falla **igual que
      fallaría un bug real**. Por eso va en el setup del proyecto y no a criterio de cada test — D4
- [ ] T011 Cablearlo con `setupFiles` **sólo** en el proyecto `browser`. El de node no lo carga

## Paso 3 — Tanda A: comportamiento (sobrevive al lote 018–021)

- [ ] T012 `use-input.browser.test.tsx`: la rueda sobre el tablero dispara un `WheelEvent` cancelable y
      `defaultPrevented` queda en `true` — **AC3**
- [ ] T013 El test monta **`App`** y no `Board`, con el motivo en un comentario: el listener lo cuelga
      `useRuedaRota` desde el shell sobre un `ref` que crea `App.tsx`; con `Board` suelto no hay `wheel`
      colgado y el test pasaría por la razón equivocada. **Medido**
- [ ] T014 **Verlo en rojo.** Mover el listener a un `onWheel` de JSX, confirmar que el test falla,
      revertir. Un test que nunca se vio fallar no está verificado — **AC4**
- [ ] T015 `Ctrl`+rueda: no cambia la rotación **y** no llama a `preventDefault`. Es el gesto que D10 del
      013 nombra por su nombre y que hoy no cubre nada — **AC5**

## Paso 3 — Tanda B: layout (depende del setup)

- [ ] T016 [P] `playhead.browser.test.tsx`: la capa computa `z-index: 10` y no `auto` — **AC6**. Citar el
      docblock de `Playhead.tsx`: «no lo atrapa ningún test ni se ve en el atributo `style`: hay que
      mirar los píxeles»
- [ ] T017 [P] `board.browser.test.tsx`: la grilla mide `10 × CELL_PX` y el `body` **no gana scroll
      horizontal** a 375 px de viewport — **AC7**. Borrar acá el test trivial del T006
- [ ] T018 [P] `orientation-panel.browser.test.tsx`: el ancho del contenedor de las miniaturas es el
      mismo con `rotation: 0` y con `rotation: 1` — la caja fija de 5×5 del 016 — **AC8**
- [ ] T019 [P] `piece-palette.browser.test.tsx`: la línea «Notas actuales» tiene el mismo alto con el
      mejor y el peor de los 48 casos (`F#4 · G#4 · A#4 · C#5 · D#5`, cinco sostenidos) — **AC9**
- [ ] T020 Los cuatro se escriben como **invariantes y no como medidas**: «no gana scroll», «no cambia de
      alto», «es igual entre dos rotaciones». Nunca `730,7`. Es lo que los deja sobrevivir a que el 019 y
      el 021 muevan los números — D5
- [ ] T021 Sacar el setup del paso 2 y confirmar que el T016 **falla**; volverlo a poner. Es la
      verificación de que el oráculo depende de la hoja y no de la suerte

## Paso 4 — CI y registro

- [ ] T022 `.github/workflows/verify.yml`: paso `pnpm exec playwright install --with-deps chromium`
      antes de `pnpm verify` — **AC10**
- [ ] T023 [P] `.gitignore`: `.vitest-attachments/` y `**/__screenshots__/`. Verificado: Vitest los
      escribe **al lado del test**, dentro de `src/components/__tests__/`
- [ ] T024 [P] `specs/deuda.md`: el ítem «No hay tests de UI» se **reescribe**, no se borra — **AC11**.
      Queda qué cubre (seis invariantes) y qué no (la superficie de seis componentes). Decir que está
      cerrado sería el mismo error que el registro ya se corrigió con el `title` del tablero
- [ ] T025 [P] `CLAUDE.md`: la sección de comandos dice hoy que los tests de `src/` corren «con Vitest en
      `environment: 'node'`, **no en jsdom**». Pasa a nombrar los dos proyectos, y **conserva el
      argumento contra jsdom**, que sigue siendo válido y ahora tiene un motivo más
- [ ] T026 [P] `.claude/rules/ui.md`: hoy dice «todos en el `environment: 'node'` del repo y ninguno con
      DOM». Pasa a decir cuál es cuál y cuándo un test va al navegador — el criterio de D5: que exista un
      docblock afirmando algo que jsdom no podría verificar
- [ ] T027 [P] `docs/guides/quickstart.md`: los comandos
- [ ] T028 `pnpm verify` verde con los dos proyectos
- [ ] T029 [M] Correr el proyecto de navegador en modo no-headless una vez, para ver el tablero de
      verdad y confirmar que lo que se testea es lo que se ve
- [ ] T030 Actualizar la fila del 024 en `specs/log.md` a `Implementado` — **queda abierta a propósito**:
      el estado lo mueve el merge
- [ ] T031 PR contra `main`

## Seguimiento (no bloquea)

- [ ] T032 **Cachear `~/.cache/ms-playwright` en la CI** con `actions/cache`. Son ~130 MB por corrida y
      hoy el job no tiene presión de tiempo, así que se anota y no se hace
- [ ] T033 **Los tests de audio en navegador.** Chromium trae la política de autoplay real —el contexto
      arranca suspendido—, que es contra la que `audio()` y `playNow()` están escritos y que
      `node-web-audio-api` **no modela**. Es una puerta que este spec abre y no cruza
- [ ] T034 **Snapshots visuales.** Playwright puede; es otra decisión (qué cuenta como cambio, dónde
      viven las referencias) y no cabe en este spec
- [ ] T035 **Los cuatro tests de layout se rompen con el 019, el 020 y el 021**, y eso es lo buscado: un
      spec que cambie el layout va a tener que decidir el número nuevo en vez de re-verificarlo a ojo.
      Está medido cuál rompe cuál en `research.md` §11

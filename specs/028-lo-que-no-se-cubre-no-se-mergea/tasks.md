# Tasks — 028

Formato en [../README.md](../README.md). `[P]` = paralelizable dentro de su bloque · `[M]` = pide una
persona y no bloquea el cierre.

> **Las tareas marcadas `⟨024⟩` no se pueden empezar hasta que el
> [024](../024-los-componentes-se-verifican-en-un-navegador/spec.md) esté mergeado.** Son T020–T041.
> Todo lo demás corre con el 024 en `Propuesto`.

## Fase 1 — El instrumento

- [ ] T001 Agregar `@vitest/coverage-v8` a `devDependencies` del raíz, en la versión exacta de `vitest` (peer estricto)
- [ ] T002 Escribir el bloque `test.coverage` en `vite.config.ts`: `provider: 'v8'`, `include: ['src/**/*.{ts,tsx}']`, `reporter: ['text']`, `reportOnFailure: true`. **Sin `thresholds` todavía** (plan, §Orden)
- [ ] T003 Escribir `coverage.exclude` con los tres archivos de `src/` que fija D3, cada uno con su comentario al lado — AC11
- [ ] T004 Agregar el script `coverage` a `package.json`, que fije la env var que T010 consume
- [ ] T005 Subir `verify` a cinco nodos: `"/^(lint|typecheck|test|coverage|mcp:test)$/"`. Verificar que los cinco corren de verdad —el modo de falla del filtro `{.}` ya está documentado en `CLAUDE.md`— contando los nodos en la salida
- [ ] T006 Confirmar que `pnpm coverage` imprime la tabla y devuelve **0** (todavía sin gate)

## Fase 2 — Lo que se cierra sin navegador

### Los presupuestos de performance

- [ ] T010 `skipIf` sobre los dos presupuestos de `domain/__tests__/sequence.test.ts` (`:863` y `:918`), con el comentario que deja los números medidos: 11,3 ms contra techo de 5, y 6,8 contra 4 — AC4
- [ ] T011 Confirmar que `pnpm test` (sin instrumentar) **sigue** corriendo los dos y midiendo contra los techos originales — AC3

### `domain/invariants.ts` — de 83,33 % a 100 % de ramas

- [ ] T012 [P] Cubrir 99-103, 124-126, 133-137 y 150-151: los caminos de violación de los invariantes de geometría
- [ ] T013 [P] Cubrir 187-188 y 193-194: los del modelo musical
- [ ] T014 [P] Cubrir 231-235, 251-255, 261-262, 268-269, 279 y 284-290: el resto de los reportes de violación
- [ ] T015 Confirmar que cada invariante tiene **un test que lo hace fallar** y no sólo uno que lo hace pasar — AC7

### `components/route-source.ts` — de 81,25 % a 100 % de ramas

- [ ] T016 [P] Cubrir la rama de `:141` y el bloque `:148-181` — AC8
- [ ] T017 Si alguna de esas ramas es genuinamente inalcanzable: borrarla o volverla alcanzable (D4), y anotar en `research.md` cuál fue y qué se hizo. **Nunca un `v8 ignore`**

### `domain/` — las ramas sueltas

- [ ] T018 [P] Cerrar el 96,77 % de ramas de `music.ts` y el 93,88 % de `sequence.ts`

### `mcp-server` — de 92,38 % a 100 %

- [ ] T030 [P] Agregar `--test-coverage-include='src/**'` y `--test-coverage-exclude='src/__tests__/**'` al script `test` del server, **sin umbrales todavía**, y confirmar que el reporte deja afuera los `../src/**` del dominio
- [ ] T031 [P] `tools/findSymbol.ts` 68-96: la función `run`, hoy en **0 % de funciones**
- [ ] T032 [P] `tools/specStatus.ts`: la función `run`, hoy en **0 % de funciones**
- [ ] T033 [P] `specs.ts` 176-181 y 191-237: el 40 % de funciones sin cubrir
- [ ] T034 [P] `symbols.ts` 241-249 y 271-295
- [ ] T035 [P] Las ramas sueltas de `checkInvariants.ts` (87,50 %), `describePiece.ts` (92,86 %), `render.ts` (96 %) y `simulateBoard.ts` (96 %)
- [ ] T036 Excluir `mcp-server/src/index.ts` por nombre y con su comentario — D3, AC11

## Fase 3 — `audio/engine.ts` ⟨024⟩

- [ ] T020 Crear `src/audio/__tests__/engine.browser.test.tsx` con el andamio de aislamiento: `vi.resetModules()` + `await import()` dinámico por caso (research §8)
- [ ] T021 [P] El grafo: `audio()`, `readSpectrum()`, `playNotes()`, `playNow()`
- [ ] T022 [P] La rama del `catch` de `audio()`: `vi.stubGlobal('AudioContext', …)` que tire, y afirmar que devuelve `null` y avisa por consola — AC6
- [ ] T023 [P] El reloj: `startClock()`, `stopClock()`, `tick()`, `outputLatency()`, `playheadOffset()`
- [ ] T024 [P] Los accesores: `setBpm`, `setClicksAudible`, `setSequence`, `sequenceInfo`, `clockRunning`, `cycleGeneration`
- [ ] T025 Confirmar `engine.ts` al 100 % en las cuatro métricas

## Fase 4 — La UI ⟨024⟩

- [ ] T040 [P] `use-engine.ts` con `renderHook` — los cuatro efectos de reconciliación que el 022 sacó del shell
- [ ] T041 [P] `use-input.ts` con `renderHook` — los dos de entrada. **Sin duplicar** los tests de rueda del 024 (AC3–AC5 de ese spec): se extiende lo que dejó
- [ ] T042 [P] `TransportPanel.tsx`
- [ ] T043 [P] `OrientationPanel.tsx` — extendiendo el test de las miniaturas del 024 (su AC8)
- [ ] T044 [P] `PiecePalette.tsx` — extendiendo el de los dos renglones (su AC9)
- [ ] T045 [P] `Spectrum.tsx` — canvas real: `drawBars` con señal y `drawIdle` sin ella, y la rama del `dpr` que `matchMedia` dispara
- [ ] T046 [P] `Playhead.tsx` — extendiendo el de `z-index` (su AC6)
- [ ] T047 [P] `Board.tsx` — extendiendo los de ancho y scroll (su AC7)
- [ ] T048 `App.tsx`, al final: es el único que puede apoyarse en que todo lo que compone ya tiene test

## Fase 5 — El gate y el registro

- [ ] T050 Poner `thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 }` en `vite.config.ts` — AC1
- [ ] T051 Poner `--test-coverage-lines=100 --test-coverage-branches=100 --test-coverage-functions=100` en el `test` del server — AC5
- [ ] T052 **Verificar que el gate muerde**: comentar una rama cubierta, correr `pnpm verify`, confirmar exit 1 y que el mensaje nombra la métrica, revertir. Un gate que nunca se vio fallar no es un gate
- [ ] T053 `grep -rn "v8 ignore\|c8 ignore" src mcp-server` devuelve vacío — AC10
- [ ] T054 `CLAUDE.md`: `verify` pasa a cinco nodos, con la medición nueva de serie contra paralelo y el segundo motivo del ancla `$` — AC12
- [ ] T055 `docs/guides/quickstart.md`: el paso de `playwright install chromium` antes del primer `verify`
- [ ] T056 `specs/deuda.md`: volver a mirar el ítem de tests de UI que el 024 dejó reescrito — con el 100 % la mitad abierta cambia de forma otra vez
- [ ] T057 `specs/log.md`: mover el 028 a `Implementado` y anotar la dependencia con el 023 y el 024
- [ ] T058 `specs/revisiones.md`: anotar qué salió distinto de lo previsto
- [ ] T059 [M] Abrir la app y confirmar que suena igual — el spec no toca comportamiento salvo si T017 obliga a borrar una rama muerta

## Verificación y PR

- [ ] T060 `pnpm verify` en verde con los cinco nodos
- [ ] T061 Commit, push y PR contra `origin`
- [ ] T062 [M] Code review del PR

## Seguimiento (no bloquea)

- [ ] T070 **Mutation testing.** El coverage dice que la línea corrió, no que el test la verifique. Con el 100 % alcanzado, Stryker deja de ser una idea abstracta y pasa a tener un piso desde donde medir. Necesita spec propio: otro runner, ~20× el tiempo, y un umbral de mutantes sobrevivientes que hay que decidir
- [ ] T071 **El reporte HTML.** Hoy alcanza el `text` porque el gate es binario. El día que alguien quiera ver *dónde* está el hueco antes de que exista, `reporter: ['text', 'html']` y un `.gitignore`

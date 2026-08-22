# Tasks — Spec 031

Formato en `specs/README.md`. `[P]` = paralelizable dentro de su bloque; `[M]` = pide una persona.

## Bloque 1 — El dominio deja de saber cuánto mide el tablero

- [ ] T001 `Dims` en `src/domain/types/board.types.ts`, con el docblock de por qué es un parámetro y no
      una constante
- [ ] T002 `src/domain/constants/board.constants.ts`: se van `GRID_W`, `GRID_H` y `SEAM`; entran
      `GRID_MIN`, `GRID_DEFAULT` y `MAX_PIEZAS`
- [ ] T003 `src/domain/board.ts`: `costuraDe(dims)` y `Dims` en `isValid`, `nodeOf`, `cellOf`,
      `neighborsOf` y `routeBetween`
- [ ] T004 `src/domain/board.ts`: partir el Dijkstra en `distanciasHacia(destino, placed, dims)` y la
      reconstrucción del camino, con `routeBetween` armado sobre las dos
- [ ] T005 `src/domain/sequence.ts`: `buildSequence(placed, regimen, dims)` con la caché de
      distancias por destino
- [ ] T006 [P] `src/domain/__tests__/board.test.ts` — al día con las firmas nuevas, más la costura
      derivada de `dims` (AC11)
- [ ] T007 [P] `src/domain/__tests__/sequence.test.ts` — al día, más el presupuesto del AC6 sobre
      390 celdas y con el `skipIf` del 009
- [ ] T008 [P] Test de AC7: la secuencia con caché es idéntica a la de referencia sobre tableros
      generados con PRNG determinista

## Bloque 2 — La grilla sale del viewport

- [ ] T009 `src/components/constants/layout.constants.ts`: `CELL_PX_OBJETIVO` reemplaza a
      `CELL_PX_MIN`/`CELL_PX_MAX`, y las siete razones dividen por él
- [ ] T010 `src/components/grid-fit.ts` con `grillaPara(vw, vh)`; se borra `cell-px.ts`
- [ ] T011 `src/components/use-grid.ts` con `useGrilla(raizRef): Dims`; se borra `use-cell-px.ts`
- [ ] T012 [P] `src/components/__tests__/grid-fit.test.ts` — la tabla de nueve viewports entera (AC2,
      AC3) más los dos casos desproporcionados que justifican el tercer paso
- [ ] T013 [P] `src/components/__tests__/use-grid.browser.test.tsx` — `--cell` con unidad, las
      dimensiones que devuelve, el `resize` y la limpieza del listener

## Bloque 3 — El tablero y el shell

- [ ] T014 `src/components/Board.tsx`: `dims` por prop, y **se van `overflow-x-auto`, `max-h-full` y
      `w-max`** (AC1)
- [ ] T015 `src/components/Board.tsx`: los topes del teclado del 026 y los `aria-*` salen de `dims`
      (AC9, AC10)
- [ ] T016 `src/App.tsx`: `useGrilla`, el filtro de piezas que caben y `buildSequence` con `dims`
- [ ] T017 `src/App.tsx`: el tope de `MAX_PIEZAS` en la colocación, con su anuncio en la región
      `aria-live` (AC5)
- [ ] T018 [P] `src/components/__tests__/Board.browser.test.tsx` — al día, más el test de que no hay
      scroll en los nueve viewports (AC1)
- [ ] T019 [P] `src/components/__tests__/App.browser.test.tsx` — el tope de 12 y su anuncio, y que
      achicar y agrandar devuelve la pieza idéntica (AC8)

## Bloque 4 — El borde del paquete y la prosa

- [ ] T020 `mcp-server/src/tools/simulateBoard.ts`: `dims` opcional con default `GRID_DEFAULT` (AC12)
- [ ] T021 [P] `mcp-server/src/tools/__tests__/` — el default y un tablero de otro tamaño
- [ ] T022 [P] `docs/architecture/directory-structure.md`, `docs/architecture/overview.md` y
      `docs/guides/conventions.md`
- [ ] T023 [P] `DESIGN.md` — la tabla de «Qué muestra una celda» y el tamaño del tablero
- [ ] T024 [P] `.claude/rules/ui.md` y `CLAUDE.md` — lo que afirma en presente que el tablero es 10 × 6
- [ ] T025 [P] `specs/deuda.md` — el Dijkstra en 4K (30,9 ms medidos, con la cola de baldes como
      salida) y el ancho del dock de piezas

## Verificación y PR

- [ ] T026 `pnpm verify` en verde, coverage 100 en las cuatro métricas
- [ ] T027 [M] Los nueve viewports de la tabla, a ojo, sin una barra de scroll — incluido el móvil
- [ ] T028 [M] Escuchar un tablero de 12 piezas repartidas en una pantalla grande: la música cambia de
      carácter sin que cambie el modelo, y hay que decidir si eso está bien
- [ ] T029 PR contra `fix/celda-vuelve-al-tamano-de-antes` (o contra `main` si ese ya mergeó)

## Seguimiento (no bloquea)

- [ ] T030 El Dijkstra en 4K: cola de baldes, y remedir los 30,9 ms
- [ ] T031 El dock de piezas mide `--cell × 2` y con la celda en 73 muestra una sola columna

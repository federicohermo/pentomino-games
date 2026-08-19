# Tasks — Spec 014

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — `muted` entra al dominio, apagado

- [x] T001 `board.types.ts`: `muted: boolean` **obligatorio** en `PlacedPiece`
- [x] T002 Docblock del campo: por qué no es derivable —igual que `cells`, sale de un gesto— y por qué
      **no** es opcional (`research.md` §6: dos formas de decir "no muteada", el error de `Click.note`)
- [x] T003 [P] `App.tsx` construye con `muted: false`
- [x] T004 [P] Los helpers de `sequence.test.ts`, `board.test.ts` y
      `components/__tests__/route-source.test.ts` (`colocar`, `:37`) construyen con `muted: false`. Son
      **tres** archivos y no dos: el tercero también arma `PlacedPiece` y sin él el paso 1 no cierra
- [x] T005 [P] `mcp-server/src/tools/simulateBoard.ts` construye con `muted: false`
- [x] T006 `pnpm verify` en verde con el campo puesto y **nada sonando distinto** — es la garantía de
      que el commit siguiente tenga un diff legible

## Paso 2 — La pieza muteada suena como clicks

- [x] T007 `sequence.ts`: la pieza con `muted: true` no emite `Step` y emite cinco `Click`s sin `note`,
      en los offsets donde estaban sus notas
- [x] T008 Docblock: por qué reusa `Click` en vez de un `Step` con bandera (D3) — la ausencia de `note`
      ya significa "esta celda no tiene nota que dar", y meter la decisión en el motor es el reparto que
      `.claude/rules/audio.md` no quiere
- [x] T009 **AC5** — test: mismo tablero con y sin la pieza muteada da el mismo orden de visita, los
      mismos offsets del resto y el mismo `length`. Es el AC central: mutear **no puede** mover el
      circuito
- [x] T010 **AC6** — test: cinco `Click`s sin `note` y cero `Step` para la pieza muteada
- [x] T011 Test de que los clicks de la pieza muteada **no colisionan** con los clicks del recorrido:
      la garantía de "dos clicks no caen nunca en el mismo instante" (D4 del spec 009) tiene que seguir
      valiendo con la clase nueva de click adentro
- [x] T052 `sequence.ts`: `clickEn` no le pone `note` al cruce cuando el ocupante está muteado, con el
      motivo al lado — la floritura del 011 es la nota que el muteo apagó (`research.md` §9) — **AC17**
- [x] T053 **AC17 y AC18** — tests: un tablero donde el recorrido **cruza** la pieza muteada y ese click
      sale sin `note`; y el tablero de **una sola** pieza muteada, que va por el retorno temprano de
      `n === 1` (`sequence.ts:320-326`) y no por el bucle

> T009, T010, T011, T052 y T053 escriben las cinco en `src/domain/__tests__/sequence.test.ts` o en
> `src/domain/sequence.ts`, así que ninguna lleva `[P]`: el marcador declara justamente que no comparten
> archivo (`specs/README.md`).
- [x] T012 `route-source.ts`: decidir y **escribir** qué pasa con el velo de una pieza sin `Step`
      (`research.md` §5). Por defecto (a): no tiene velo, con el motivo en el código — **AC9**
- [x] T013 Test en `components/__tests__/route-source.test.ts` de que las marcas de la cabeza lectora
      **sí** cubren las celdas de la pieza muteada —tiene que seguir recorriéndola, porque está ocupando
      ese tiempo— y de que su `kind` es `MARCA.click` y no `MARCA.nota` (`route-source.ts:183` vs
      `:199`, y `Playhead.tsx:118` les da bordes distintos) — **AC19**

## Paso 3 — El gesto y la baldosa blanca

- [x] T014 La decisión del click como pura **en `src/components/input.ts`** —el módulo que crea el 013
      (T002–T005 de su `tasks.md`)— y no en uno paralelo, con las cuatro ramas de la tabla. Mismo
      movimiento que el 013 y por el mismo motivo: no hay jsdom
- [x] T015 La rama de edición se decide con `occupantAt` y `piece === selected`, **no** con `isValid`
      (D2, `research.md` §1)
- [x] T016 **AC1** — test: quita la pieza clickeada, y con dos piezas del mismo tipo quita la
      correcta
- [x] T017 **AC2** — test: con otra pieza seleccionada no pasa nada
- [x] T018 **AC3** — test: `Alt`+click alterna el muteo, y con otra pieza seleccionada no hace nada
- [x] T019 **AC4** — test: `Alt`+click en celda vacía coloca con `muted: true` y **no** dispara
      `playNow` (D9)

> T016–T019 escriben las cuatro en `components/__tests__/input.test.ts`, así que ninguna lleva `[P]`.
> Son cuatro `it` de un mismo archivo: abanicarlas es un conflicto de edición, no paralelismo.
- [x] T020 Cablear el `altKey`, que **hoy no cruza `Board`**: `onCellClick` es `(x, y) => void`
      (`Board.tsx:112`) y el `onClick` de la celda (`:189`) no pasa el evento. Cambia la prop además del
      handler de `App.tsx`
- [x] T051 `Board.tsx:190`: el hover sobre una celda ocupada por la **misma** pieza seleccionada deja de
      mostrar `cursor-not-allowed`. Hoy `previewValid` es `false` ahí y el cursor dice "acá no entra"
      sobre la celda donde el click **borra**. Qué hace el fantasma rosa en ese caso se decide y se
      escribe — **AC20**
- [x] T021 `Board.tsx`: la celda de una pieza muteada no arma el `style` de `PIECE_COLOR` y cae al
      blanco de una celda libre, conservando nota y `#N` — **AC8**
- [x] T022 El texto de la celda muteada va en el color del tablero y **no** en `PIECE_COLOR[p].fg`, que
      está medido contra otro fondo y sobre blanco es ilegible en varias piezas (`research.md` §7)
- [x] T023 Comentario en `Board.tsx`: por qué el canal es la ausencia de color y no la opacidad —la
      tiene tomada el velo de `Playhead`— ni el color —es identidad, y está medido en contraste— (D4)
- [x] T024 Verificar que `LC_EXCEPCIONES` de `palette.constants.ts` no se toca: este spec no mueve
      ningún fondo de pieza

## Paso 4 — Muere `PlacedList` y el layout se reacomoda

- [x] T025 **Commit propio**: borrar `src/components/PlacedList.tsx`, su import, su `<PlacedList>` y el
      `orden` que `App.tsx` derivaba para él — **AC10**
- [x] T026 Verificar que `arpeggioFor` no queda huérfana: conserva consumidores en `domain/sequence.ts`
      y en el MCP server
- [x] T027 `PiecePalette.tsx:36` → `md:col-span-4` y `Board.tsx:132` → `md:col-span-8`. **No están en
      `App.tsx`**, que es donde este spec los daba por escritos — **AC11**, D6
- [x] T028 `layout.constants.ts`: `CELL_PX` 63 → **71**
- [x] T029 Reescribir el docblock de `CELL_PX`: las dos frases que explican el 63 dejan de valer
      (`research.md` §4). El **piso de 60** se queda —depende de la fuente, no del ancho— y el techo
      pasa a salir de la tabla medida de `research.md` §3, incluido **por qué la novena columna no le
      compra nada al tablero**
- [x] T030 Anotar en el docblock que cuando el 016 haga más alta la paleta, `CELL_PX` puede subir a 73
      (medido), para que ese spec no tenga que redescubrirlo
- [x] T054 El comentario de `Board.tsx:125` es el **segundo** lugar que explica el 63, y argumenta el
      `md:col-span-7` contra el 6 con los mismos números viejos (536 × 380, 633 × 380, celdas de 63). Se
      reescribe con los de `research.md` §3 — **AC11** pide los dos

## Paso 5 — MCP, verificación y documentación

- [x] T031 `simulate_board` acepta `muted` en su entrada y lo reporta — **AC12**
- [x] T032 [P] Test en `mcp-server`: un tablero con una pieza muteada reporta sus clicks y no su arpegio
- [x] T033 `pnpm verify` en verde y `check_invariants` en proceso fresco antes y después — **AC13**
- [x] T034 [P] `DESIGN.md`: el canal nuevo, y por qué no es color ni opacidad. Y se va la fila de
      `PlacedList` de la tabla de contraste, con su párrafo (`DESIGN.md:129-131`)
- [x] T035 [P] `docs/architecture/directory-structure.md:99` **y `docs/architecture/overview.md:30`**:
      los **dos** nombran a `PlacedList` en el árbol de componentes
- [x] T036 [P] `docs/architecture/modelo-musical.md`: una pieza colocada puede no sonar y seguir
      ocupando su lugar en el circuito
- [x] T037 [P] `.claude/rules/ui.md`: la edición vive en el tablero, y el panel derecho ya no existe
- [x] T038 [P] `CLAUDE.md`: la descripción de la app dice que cada pieza dispara un arpegio — ahora hay
      una excepción
- [ ] T039 [M] **AC14** — a oído: un tablero de 4 piezas, mutear una, y verificar que el resto entra en
      el mismo momento que antes. **Se escucha después del 015**, que le cambia el timbre al click
- [ ] T040 [M] **AC15** — a ojo: quitar y reponer la misma pieza en la misma casilla con la misma
      orientación devuelve el tablero al estado anterior
- [ ] T041 [M] Con dos piezas del mismo tipo colocadas y esa pieza seleccionada: clickear una quita
      **esa**, no la otra
- [ ] T042 [M] La baldosa blanca se distingue de una celda libre a un metro de la pantalla

## PR

- [x] T043 Rama `feature/014-el-tablero-se-edita-en-el-tablero` desde `main`
- [x] T044 El PR declara que **cambia lo que suena** en todo tablero con una pieza muteada, y que
      **cambia el layout** (`CELL_PX` 63 → 71)
- [ ] T045 [M] `/pr-review` antes de pedir revisión
- [x] T046 `specs/log.md`: estado del 014

## Seguimiento (no bloquea)

- [ ] T047 **El tablero sigue sin teclado**, y ahora un click borra. El hueco de `specs/deuda.md` deja
      de ser solo de lectura: una grilla que no se alcanza con el teclado tiene una operación
      destructiva que no se puede ejecutar de otra forma. Sube de prioridad, no se cierra acá
- [ ] T048 **No hay deshacer.** Reponer a mano alcanza cuando la orientación seleccionada no cambió
      (AC15); si cambió, la pieza vuelve distinta. Si molesta, es un spec propio y chico
- [ ] T049 **La orientación de una pieza colocada dejó de leerse en texto.** Se lee del `#0..#4` de sus
      celdas, que dice lo mismo pero hay que saber leerlo. Anotado por si aparece la necesidad
- [ ] T050 Si el velo (T012) resulta que se extraña sobre las piezas muteadas, la salida (b) de
      `research.md` §5 pide que `Click` sepa de qué pieza es su celda. No se hace por adelantado

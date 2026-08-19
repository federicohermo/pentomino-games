# Tasks — Spec 014

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — `muted` entra al dominio, apagado

- [ ] T001 `board.types.ts`: `muted: boolean` **obligatorio** en `PlacedPiece`
- [ ] T002 Docblock del campo: por qué no es derivable —igual que `cells`, sale de un gesto— y por qué
      **no** es opcional (`research.md` §6: dos formas de decir "no muteada", el error de `Click.note`)
- [ ] T003 [P] `App.tsx` construye con `muted: false`
- [ ] T004 [P] Los helpers de `sequence.test.ts` y `board.test.ts` construyen con `muted: false`
- [ ] T005 [P] `mcp-server/src/tools/simulateBoard.ts` construye con `muted: false`
- [ ] T006 `pnpm verify` en verde con el campo puesto y **nada sonando distinto** — es la garantía de
      que el commit siguiente tenga un diff legible

## Paso 2 — La pieza muteada suena como clicks

- [ ] T007 `sequence.ts`: la pieza con `muted: true` no emite `Step` y emite cinco `Click`s sin `note`,
      en los offsets donde estaban sus notas
- [ ] T008 Docblock: por qué reusa `Click` en vez de un `Step` con bandera (D3) — la ausencia de `note`
      ya significa "esta celda no tiene nota que dar", y meter la decisión en el motor es el reparto que
      `.claude/rules/audio.md` no quiere
- [ ] T009 **AC5** — test: mismo tablero con y sin la pieza muteada da el mismo orden de visita, los
      mismos offsets del resto y el mismo `length`. Es el AC central: mutear **no puede** mover el
      circuito
- [ ] T010 [P] **AC6** — test: cinco `Click`s sin `note` y cero `Step` para la pieza muteada
- [ ] T011 [P] Test de que los clicks de la pieza muteada **no colisionan** con los clicks del recorrido:
      la garantía de "dos clicks no caen nunca en el mismo instante" (D4 del spec 009) tiene que seguir
      valiendo con la clase nueva de click adentro
- [ ] T012 `route-source.ts`: decidir y **escribir** qué pasa con el velo de una pieza sin `Step`
      (`research.md` §5). Por defecto (a): no tiene velo, con el motivo en el código — **AC9**
- [ ] T013 Test de que las marcas de la cabeza lectora **sí** cubren las celdas de la pieza muteada: la
      cabeza tiene que seguir recorriéndola, porque está ocupando ese tiempo

## Paso 3 — El gesto y la baldosa blanca

- [ ] T014 Extraer la decisión del click como pura (`components/`), con las cuatro ramas de la tabla —
      mismo movimiento que el 013, y por el mismo motivo: no hay jsdom
- [ ] T015 La rama de edición se decide con `occupantAt` y `piece === selected`, **no** con `isValid`
      (D2, `research.md` §1)
- [ ] T016 [P] **AC1** — test: quita la pieza clickeada, y con dos piezas del mismo tipo quita la
      correcta
- [ ] T017 [P] **AC2** — test: con otra pieza seleccionada no pasa nada
- [ ] T018 [P] **AC3** — test: `Alt`+click alterna el muteo, y con otra pieza seleccionada no hace nada
- [ ] T019 [P] **AC4** — test: `Alt`+click en celda vacía coloca con `muted: true` y **no** dispara
      `playNow` (D9)
- [ ] T020 `App.tsx`: cablear el handler con `e.altKey`
- [ ] T021 `Board.tsx`: la celda de una pieza muteada no arma el `style` de `PIECE_COLOR` y cae al
      blanco de una celda libre, conservando nota y `#N` — **AC8**
- [ ] T022 El texto de la celda muteada va en el color del tablero y **no** en `PIECE_COLOR[p].fg`, que
      está medido contra otro fondo y sobre blanco es ilegible en varias piezas (`research.md` §7)
- [ ] T023 Comentario en `Board.tsx`: por qué el canal es la ausencia de color y no la opacidad —la
      tiene tomada el velo de `Playhead`— ni el color —es identidad, y está medido en contraste— (D4)
- [ ] T024 Verificar que `LC_EXCEPCIONES` de `palette.constants.ts` no se toca: este spec no mueve
      ningún fondo de pieza

## Paso 4 — Muere `PlacedList` y el layout se reacomoda

- [ ] T025 **Commit propio**: borrar `src/components/PlacedList.tsx`, su import, su `<PlacedList>` y el
      `orden` que `App.tsx` derivaba para él — **AC10**
- [ ] T026 Verificar que `arpeggioFor` no queda huérfana: conserva consumidores en `domain/sequence.ts`
      y en el MCP server
- [ ] T027 `App.tsx`: paleta `md:col-span-4`, tablero `md:col-span-8` — **AC11**, D6
- [ ] T028 `layout.constants.ts`: `CELL_PX` 63 → **71**
- [ ] T029 Reescribir el docblock de `CELL_PX`: las dos frases que explican el 63 dejan de valer
      (`research.md` §4). El **piso de 60** se queda —depende de la fuente, no del ancho— y el techo
      pasa a salir de la tabla medida de `research.md` §3, incluido **por qué la novena columna no le
      compra nada al tablero**
- [ ] T030 Anotar en el docblock que cuando el 016 haga más alta la paleta, `CELL_PX` puede subir a 73
      (medido), para que ese spec no tenga que redescubrirlo

## Paso 5 — MCP, verificación y documentación

- [ ] T031 `simulate_board` acepta `muted` en su entrada y lo reporta — **AC12**
- [ ] T032 [P] Test en `mcp-server`: un tablero con una pieza muteada reporta sus clicks y no su arpegio
- [ ] T033 `pnpm verify` en verde y `check_invariants` en proceso fresco antes y después — **AC13**
- [ ] T034 [P] `DESIGN.md`: el canal nuevo, y por qué no es color ni opacidad
- [ ] T035 [P] `docs/architecture/directory-structure.md`: muere `PlacedList.tsx`
- [ ] T036 [P] `docs/architecture/modelo-musical.md`: una pieza colocada puede no sonar y seguir
      ocupando su lugar en el circuito
- [ ] T037 [P] `.claude/rules/ui.md`: la edición vive en el tablero, y el panel derecho ya no existe
- [ ] T038 [P] `CLAUDE.md`: la descripción de la app dice que cada pieza dispara un arpegio — ahora hay
      una excepción
- [ ] T039 [M] **AC14** — a oído: un tablero de 4 piezas, mutear una, y verificar que el resto entra en
      el mismo momento que antes. **Se escucha después del 015**, que le cambia el timbre al click
- [ ] T040 [M] **AC15** — a ojo: quitar y reponer la misma pieza en la misma casilla con la misma
      orientación devuelve el tablero al estado anterior
- [ ] T041 [M] Con dos piezas del mismo tipo colocadas y esa pieza seleccionada: clickear una quita
      **esa**, no la otra
- [ ] T042 [M] La baldosa blanca se distingue de una celda libre a un metro de la pantalla

## PR

- [ ] T043 Rama `feature/014-el-tablero-se-edita-en-el-tablero` desde `main`
- [ ] T044 El PR declara que **cambia lo que suena** en todo tablero con una pieza muteada, y que
      **cambia el layout** (`CELL_PX` 63 → 71)
- [ ] T045 [M] `/pr-review` antes de pedir revisión
- [ ] T046 `specs/log.md`: estado del 014

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

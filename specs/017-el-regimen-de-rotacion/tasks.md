# Tasks — Spec 017

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — Caracterizar el régimen de hoy, antes de tocarlo

- [ ] T001 **AC6** — test: en `escala`, **36 de 180** celdas conservan su nota al rotar, con la
      descomposición **24 / 12 / 0** por rotación
- [ ] T002 [P] Test: el grado 0 conserva la tónica en las rotaciones 1 y 2 y **no** en la 3 (la
      transposición `+7`). Es la propiedad que hace que `BASE_MAP` se escuche como identidad, y hoy no
      está escrita en ningún lado
- [ ] T003 [P] Comentario en los dos tests: son de **caracterización**, escritos antes de que exista la
      segunda rama, para que romper el régimen viejo falle acá y no en una escucha tres pasos después

## Paso 2 — El régimen entra al dominio

- [ ] T004 `domain/constants/music.constants.ts`: const-object con los dos valores, y el default
- [ ] T005 `domain/types/music.types.ts` *(nuevo)*: `RegimenDeRotacion` derivado del const-object.
      **Sin `enum`** — lo rechaza `erasableSyntaxOnly`, que es la misma opción que permite que node
      cargue `domain/` sin compilar — **AC1**
- [ ] T006 `notesForRotation` recibe el régimen, **sin default en el parámetro**. Un default haría que
      un llamador que se lo olvide obtenga el régimen viejo en silencio, y son 36 de 48 las
      combinaciones que difieren: que el typecheck lo atrape es el punto (mismo criterio que `dur` y
      `rel` en `scheduleVoice`)
- [ ] T007 La rama `orden`: pentatónica mayor sobre la tónica, corrida `r` posiciones
- [ ] T008 Reescribir el docblock de `notesForRotation`, que hoy declara el mapeo rotación→fórmula como
      **la** decisión de diseño del instrumento. Pasa a ser una de dos, con la otra al lado y con el
      motivo de que existan las dos
- [ ] T009 `arpeggioFor` recibe y pasa el régimen
- [ ] T010 `buildSequence(placed, regimen)` — es la firma más consumida de las dos que cambian
      (`research.md` §6)
- [ ] T011 `cell-text.ts` recibe el régimen
- [ ] T012 [P] **AC2** — no-regresión: en `escala` las 48 combinaciones dan exactamente lo de hoy
- [ ] T013 [P] **AC3** — el corrimiento sobre las 48 combinaciones
- [ ] T014 [P] **AC4** — a rotación 0 los dos regímenes son idénticos, sobre las 12 piezas. Es la
      propiedad que hace **auditable** la comparación (D2)
- [ ] T015 **AC5** — el 0 sobre 180 en `orden`, con el **porqué escrito en el test**: un corrimiento
      cíclico de `k ≠ 0` sobre `n` elementos tiene puntos fijos sólo si `gcd(k, n) > 1`, y `n = 5` es
      primo. Escrito así el test sigue significando algo si alguien toca `NOTES_PER_PIECE`; escrito como
      "esperamos 0" se vuelve un número mágico
- [ ] T016 `invariants.ts`: `checkNotes` recorre los dos regímenes, o declara por qué no. Hoy recorre 48
      «porque el espejo sólo invierte el orden», y con dos regímenes eso pasa a ser la mitad del espacio
      — es donde un corrimiento mal escrito produciría el `undefined` que `midiName` pinta como
      `undefinedNaN` (`research.md` §7)
- [ ] T017 `pnpm verify` en verde con `escala` pasado explícitamente en todos lados y **nada sonando
      distinto** — lo garantiza el paso 1
- [ ] T018 **Commit propio y declarado**: cambia lo que suena en 36 de 48 combinaciones cuando el
      régimen nuevo está activo

## Paso 3 — El interruptor y las tools

- [ ] T019 `App.tsx`: estado del régimen, default **`escala`** — **AC11**
- [ ] T020 `App.tsx`: pasarlo a las tres llamadas (`arpeggioFor` del panel, `buildSequence`, `cellTextFor`)
- [ ] T021 **AC8** — verificar que **ninguna función del dominio lee un global**: el régimen viaja como
      parámetro y el linter de dirección de dependencia sigue en verde
- [ ] T022 `PiecePalette.tsx`: el interruptor en la fila de `Rotación`, leyéndose como oración —
      `Rotación → cambia [escala | orden]` — **AC10**, D4
- [ ] T023 Medir la fila contra el ancho de la tarjeta que dejó el 016, que ya la llenó de miniaturas
- [ ] T024 **AC9** — `describe_piece` acepta el régimen **y lo reporta**
- [ ] T025 **AC9** — `simulate_board` acepta el régimen **y lo reporta**
- [ ] T026 [P] Test en `mcp-server`: la misma pieza con los dos regímenes da respuestas distintas y cada
      una dice cuál es. Sin eso, la tool es ambigua en 36 de 48 casos

## Paso 4 — Documentación y escucha

- [ ] T027 [P] `docs/architecture/modelo-musical.md`: su tabla de derivaciones dice «rotación → fórmula
      de escala» como si fuera la única
- [ ] T028 [P] `CLAUDE.md`: la fila del modelo musical en la tabla de documentación, y la descripción
      del instrumento
- [ ] T029 [P] `.claude/rules/domain.md`
- [ ] T030 `pnpm verify` y `check_invariants` en proceso fresco antes y después — **AC12**
- [ ] T031 [M] **AC7** — alternar el régimen con el transporte corriendo: el tablero entero se re-deriva
      y entra en el ciclo siguiente, sin cortar el que suena (D5 del spec 009)
- [ ] T032 [M] **AC13 — el punto del spec**: el mismo tablero en los dos regímenes, alternando en vivo.
      La pregunta no es cuál suena mejor sino **si los dos merecen quedarse**
- [ ] T033 [M] Escuchar específicamente el **salto** que D6 midió: en `orden` el arpegio deja de subir
      siempre y mete un descenso de hasta 9 semitonos donde antes había 3. Es lo que no estaba previsto
- [ ] T034 [M] Escuchar el **registro angostado**: `orden` llega hasta `G#5` contra el `D#6` de
      `escala`. Se nota más en las piezas de tónica alta (`X`, `Y`, `Z`), que son las que la
      transposición `+7` empujaba arriba

## PR

- [ ] T035 Rama `feature/017-el-regimen-de-rotacion` desde `main`
- [ ] T036 El PR declara que **cambia lo que suena** y que **cambia firmas del dominio** que cruzan al
      MCP server
- [ ] T037 [M] `/pr-review` antes de pedir revisión
- [ ] T038 `specs/log.md`: estado del 017

## Seguimiento (no bloquea)

- [ ] T039 **Decidir si los dos regímenes se quedan.** Es para lo que existe el spec. Sacar uno es
      borrar una rama, no desenredarla — por eso el régimen viaja como parámetro (D7)
- [ ] T040 **El reajuste de octava** que evitaría el salto de D6 (`D4 E4 G4 A4 C5` en vez de
      `D4 E4 G4 A4 C4`). Es un `+12` condicional en una línea. Se descartó porque cambia los MIDI aunque
      no las clases de altura, y el pedido dice *sin cambio de las notas*. Primera cosa a probar si T033
      dice que el salto molesta
- [ ] T041 Si `orden` gana, la transposición `+7` de la rotación 3 se queda sin ningún consumidor y
      `PENT_MINOR` y `PENT_BLUES5` también. Borrarlos sería un commit propio, por la regla de los
      borrados
- [ ] T042 **El tipo de `rotation`** sigue siendo un `number` sin acotar (`specs/deuda.md`). Este spec
      agrega un lugar más que lo usa como índice de corrimiento, o sea que ahora un `rotation` fuera de
      `0..3` produciría un `undefined` en vez de caer al `else` de la cadena de `if`. Es el argumento
      más fuerte que la deuda tuvo hasta ahora

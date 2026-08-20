# Tasks — Spec 017

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — Caracterizar el régimen de hoy, antes de tocarlo

- [x] T001 **AC6** — test: en `escala`, **36 de 180** celdas conservan su nota al rotar, con la
      descomposición **24 / 12 / 0** por rotación
- [x] T002 Test: el grado 0 conserva la tónica en las rotaciones 1 y 2 y **no** en la 3 (la
      transposición `+7`). Es la propiedad que hace que `BASE_MAP` se escuche como identidad, y hoy no
      está escrita en ningún lado
- [x] T003 Comentario en los dos tests: son de **caracterización**, escritos antes de que exista la
      segunda rama, para que romper el régimen viejo falle acá y no en una escucha tres pasos después

> **Ninguna de las tres lleva `[P]`, y no es un olvido:** las tres escriben
> `src/domain/__tests__/music.test.ts`. Dos tareas `[P]` del mismo bloque no pueden tocar el mismo
> archivo — `spec-implement` las abanica y el conflicto aparece recién al escribir.

## Paso 2 — El régimen entra al dominio

- [x] T004 `domain/constants/music.constants.ts`: const-object con los dos valores, y el default
- [x] T005 `domain/types/music.types.ts` *(nuevo)*: `RegimenDeRotacion` derivado del const-object.
      **Sin `enum`** — lo rechaza `erasableSyntaxOnly`, que es la misma opción que permite que node
      cargue `domain/` sin compilar — **AC1**
- [x] T006 `notesForRotation` recibe el régimen, **sin default en el parámetro**. Un default haría que
      un llamador que se lo olvide obtenga el régimen viejo en silencio, y son 36 de 48 las
      combinaciones que difieren: que el typecheck lo atrape es el punto (mismo criterio que `dur` y
      `rel` en `scheduleVoice`)
- [x] T007 La rama `orden`: pentatónica mayor sobre la tónica, corrida `r` posiciones
- [x] T008 Reescribir **los dos docblocks de `music.ts`**, no uno: la frase «que la rotación elija la
      fórmula es la decisión de diseño del instrumento» está en el docblock **de módulo** (`:9-14`), y
      el de `notesForRotation` (`:22-31`) es el que lista «0° → pentatónica mayor · 90° → menor …» más
      la nota del `octShift`. Tocar uno solo deja el otro afirmando la regla vieja en presente. Los dos
      pasan a decir una de dos, con la otra al lado y con el motivo de que existan las dos
- [x] T009 `arpeggioFor` recibe y pasa el régimen
- [x] T010 `buildSequence(placed, regimen)` — es la firma más consumida de las dos que cambian
      (`research.md` §6)
- [x] T010b **AC16** — `noteAtCell` (`domain/sequence.ts:115`) recibe el régimen: es la **tercera**
      firma pública del dominio que cambia, y de ella sale el `Click.note` de `clickEn` (`:131`), o sea
      la altura que suena al **cruzar** una celda ocupada, más el `crossed` que reporta
      `simulate_board`. Si se queda en `escala` mientras la pieza toca `orden`, la celda dice una altura
      y pisarla suena otra — el bug exacto que su docblock (`:98-114`) existe para prevenir. `tsc`
      obliga a tocar la línea pero no dice cuál es la respuesta: **propagar**, no fijar un régimen ahí
- [x] T010c Test de `noteAtCell` bajo `orden`: la nota de la celda coincide con la que el tablero pinta
      ahí. `sequence.test.ts:299-336` ya tiene la batería, hay que darle el segundo régimen
- [x] T011 `cell-text.ts` recibe el régimen, **y el régimen entra en la clave del memo de módulo**
      (`cell-text.ts:9` y `:52`, hoy `${piece}${rotation}${mirror}`) — **AC15**. Es un `Map` de módulo que
      sobrevive al render y que **no mira ningún linter**: sin el régimen en la clave, cambiarlo deja
      las celdas mostrando las notas del régimen anterior para siempre. Es la misma razón por la que la
      reflexión ya está en esa clave, escrita en el docblock de `cellTextFor`
- [x] T011b Test de **AC15**: `cellTextFor` con la misma pieza y los dos regímenes devuelve notas
      distintas. `cell-text.test.ts:80` ya ejercita el memo con `toBe`, así que el hueco es visible
- [x] T012 **AC2** — no-regresión: en `escala` las 48 combinaciones dan exactamente lo de hoy
- [x] T013 **AC3** — el corrimiento sobre las 48 combinaciones
- [x] T014 **AC4** — a rotación 0 los dos regímenes son idénticos, sobre las 12 piezas. Es la
      propiedad que hace **auditable** la comparación (D2)

> **T012–T015 tampoco llevan `[P]`, por lo mismo que T001–T003:** los cuatro van a
> `src/domain/__tests__/music.test.ts` (`research.md` §9). El bloque que sí se puede abanicar es el de
> las firmas —T006/T007/T008 en `music.ts`, T010/T010b en `sequence.ts`, T011 en `cell-text.ts`— pero
> están encadenados por el typecheck, así que tampoco.
- [x] T015 **AC5** — el 0 sobre 180 en `orden`, con el **porqué escrito en el test**: un corrimiento
      cíclico de `k ≠ 0` sobre `n` elementos tiene puntos fijos sólo si `gcd(k, n) > 1`, y `n = 5` es
      primo. Escrito así el test sigue significando algo si alguien toca `NOTES_PER_PIECE`; escrito como
      "esperamos 0" se vuelve un número mágico
- [x] T016 `invariants.ts`: `checkNotes` recorre las **96** combinaciones, con el chequeo de orden
      **partido por régimen** — **AC12**. Hoy recorre 48 «porque el espejo sólo invierte el orden», y
      con dos regímenes eso es la mitad del espacio; es donde un corrimiento mal escrito produciría el
      `undefined` que `midiName` pinta como `undefinedNaN` (`research.md` §7).
      **Ojo con extenderlo entero:** `invariants.ts:220-224` exige ascendente estricto, que es una
      propiedad de `escala` y no del modelo — medido, **falla en 36 de las 48** de `orden`, o sea que
      `check_invariants` quedaría en rojo por diseño y esta misma AC la pide en verde. En `orden` el
      chequeo equivalente y más fuerte es **«es una permutación cíclica del arpegio de rotación 0»**;
      `length === NOTES_PER_PIECE` y «sin repetidas» se quedan compartidos
- [x] T017 `pnpm verify` en verde con `escala` pasado explícitamente en todos lados y **nada sonando
      distinto** — lo garantiza el paso 1
- [x] T018 **Commit propio y declarado**: cambia lo que suena en 36 de 48 combinaciones cuando el
      régimen nuevo está activo

## Paso 3 — El interruptor y las tools

- [x] T019 `App.tsx`: estado del régimen, default **`escala`** — **AC11**
- [x] T020 `App.tsx`: pasarlo a `buildSequence` (`:74`), a `arpeggioFor` (`:81`) y a la proyección de
      desmontaje (`:174`) — **y a las dep arrays de los dos `useMemo`**, AC15. `exhaustive-deps` las
      ve, pero `recommended-latest` la reporta como **warning** y `pnpm lint` corre sin
      `--max-warnings 0`: no frena el gate
- [x] T020b `Board.tsx` recibe el régimen como **prop**: `cellTextFor` **no** se llama desde `App.tsx`,
      lo llama `Board.tsx` dos veces (`:163` la pieza colocada, `:164` el fantasma). El archivo no
      estaba en el alcance del spec
- [x] T020c `PlacedList.tsx:85` llama `arpeggioFor` y también necesita la prop — **salvo que el 014 ya
      haya mergeado**, que es quien lo borra. Hoy el archivo existe: si el 017 se implementa fuera del
      orden del lote, es un consumidor más
- [x] T021 **AC8** — verificar que **ninguna función del dominio lee un global**: el régimen viaja como
      parámetro y el linter de dirección de dependencia sigue en verde
- [x] T022 `PiecePalette.tsx`: el interruptor en la fila de `Rotación`, leyéndose como oración —
      `Rotación → cambia [escala | orden]` — **AC10**, D4
- [x] T023 Medir la fila contra el ancho de la tarjeta que dejó el 016, que ya la llenó de miniaturas
- [x] T024 **AC9** — `describe_piece` acepta el régimen **y lo reporta**
- [x] T024b **AC9** — `SCALE_LABEL` (`mcp-server/src/tools/describePiece.ts:31-36`): array hardcodeado
      indexado por rotación cuyas cuatro entradas son falsas bajo `orden` —la fórmula es siempre la
      pentatónica mayor y lo que la rotación mueve es el arranque—. Su docblock lo declara «uno de los
      DOS supuestos del server sobre el dominio que pueden quedar desincronizados **sin que `tsc` diga
      nada**»: ningún gate lo atrapa. Reportar el régimen y seguir diciendo «pentatónica menor
      (rotación 90°)» es peor que no reportarlo
- [x] T025 **AC9** — `simulate_board` acepta el régimen **y lo reporta**
- [x] T026 [P] Test en `mcp-server`: la misma pieza con los dos regímenes da respuestas distintas y cada
      una dice cuál es. Sin eso, la tool es ambigua en 36 de 48 casos

## Paso 4 — Documentación y escucha

- [x] T027 [P] `docs/architecture/modelo-musical.md` en **tres** puntos, no en uno: la fila `:14`
      («Rotación | La fórmula de escala»), el `:169` («rotar elige *qué* notas, reflejar elige *en qué
      orden*», que en `orden` es al revés) y el `:252` («la rotación cambia qué notas, la forma cambia
      dónde»)
- [x] T028 [P] `CLAUDE.md:152`: la fila del modelo musical en la tabla de documentación, y la
      descripción del instrumento
- [x] T029 [P] `.claude/rules/domain.md:36`
- [x] T029b [P] `docs/README.md:11` — «rotación → escala», en el índice. No estaba en la lista original
      y es el sexto lugar que lo afirma en presente
- [x] T030 `pnpm verify` y `check_invariants` en proceso fresco antes y después — **AC12**
- [ ] T031 [M] **AC7** — alternar el régimen con el transporte corriendo: el tablero entero se re-deriva
      y entra en el ciclo siguiente, sin cortar el que suena (D5 del spec 009)
- [ ] T032 [M] **AC13 — el punto del spec**: el mismo tablero en los dos regímenes, alternando en vivo.
      La pregunta no es cuál suena mejor sino **si los dos merecen quedarse**
- [ ] T033 [M] Escuchar específicamente el **salto** que D6 midió: en `orden` el arpegio deja de subir
      siempre y mete **un** descenso, de **9 semitonos exactos** —no «hasta 9»: medido, es siempre esa
      distancia, en las 36 combinaciones que se mueven—, donde en `escala` el paso más grande es 3. Es
      lo que no estaba previsto
- [ ] T034 [M] Escuchar el **registro angostado**: `orden` llega hasta `G#5` contra el `D#6` de
      `escala`. Se nota más en las piezas de tónica alta (`X`, `Y`, `Z`), que son las que la
      transposición `+7` empujaba arriba

## PR

- [x] T035 Rama `feature/017-el-regimen-de-rotacion` desde `main`
- [x] T036 El PR declara que **cambia lo que suena** y que **cambia firmas del dominio** que cruzan al
      MCP server
- [ ] T037 [M] `/pr-review` antes de pedir revisión
- [x] T038 `specs/log.md`: estado del 017

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

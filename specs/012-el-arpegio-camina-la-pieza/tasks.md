# Tareas — Spec 012

Formato en [`specs/README.md`](../README.md): `[P]` se puede hacer en paralelo dentro de su bloque,
`[M]` pide una persona y no bloquea el cierre.

## Paso 1 — El camino en `transform.ts` (no cambia comportamiento)

- [ ] T001 `pathThroughCells(cells, tiebreak)` en `src/domain/transform.ts`: matriz de costos con
      `BASE = 1 + n · maxDistancia`, Held-Karp de camino abierto hacia atrás, y recorrido de las ramas
      óptimas con el desempate de D2 y D1
- [ ] T002 Docblock de `pathThroughCells`: qué devuelve (orden de visita **por posición**, no grado por
      celda), por qué `tiebreak` entra por parámetro (D5), por qué el costo se empaqueta en un entero
      (D6) y cuál es el dominio de `n`
- [ ] T003 [P] Test de referencia en `src/domain/__tests__/transform.test.ts`: fuerza bruta sobre las
      permutaciones **escrita en el test**, contrastada sobre las 12 piezas y 400 formas aleatorias con
      semilla fija (AC2)
- [ ] T004 [P] Test: el resultado es una permutación de `0..n-1`, y casos borde de 0, 1 y 2 celdas
- [ ] T005 [P] Test: las 12 piezas tienen distancias no crecientes (AC3)
- [ ] T006 [P] Test: `I L N P U V W Z` dan 0 saltos y `F T Y X` dan 1, 1, 1 y 2 (AC4)
- [ ] T007 [P] Test: el desempate es determinista y se ejerce donde hay empate real — `Y` y `X` (AC6)

## Paso 2 — Cablearlo (**cambia lo que suena**, commit propio)

- [ ] T010 `angularRank` interna en `src/domain/music.ts`: el cuerpo de `degreeByCellIndex` de hoy, sin
      exportar
- [ ] T011 `degreeByCellIndex` pasa a componer `pathThroughCells(cells, angularRank(cells))` y a
      invertir el orden a grados. Firma y contrato intactos (AC7)
- [ ] T012 Docblock de `degreeByCellIndex` reescrito: el camino como regla, el ángulo como desempate de
      dirección (D1), los saltos al principio (D2), el grado 0 como puerta de entrada y no como centro
      (D3), y lo que se conserva del viejo — forma **canónica** y mapeo **por índice** (D4)
- [ ] T013 Test testigo de la `U` en `src/domain/__tests__/music.test.ts`: recorre sus cinco celdas sin
      saltar, con la colocación del spec (AC1)
- [ ] T014 Migrar `AC2 — en I y X la celda parada sobre el centroide se lleva el grado 0`: lo supera D3.
      Se reemplaza afirmando lo que ahora es cierto —que `I` se camina entera— con el motivo escrito
- [ ] T015 Migrar los dos tests de `AC4 — el desempate a igual angulo`: el desempate angular sigue
      existiendo pero elige la **dirección** del camino, no los grados
- [ ] T016 Recongelar `AC5 — la referencia congelada`: las 60 notas de `research.md` §5 escritas a mano,
      `TONICA_EN` nuevo, y el docblock diciendo que la fuente es este spec y no la lámina del 007 (AC8, D7)
- [ ] T017 Remedir el test de `recalcular sobre la forma ya transformada`: el 75 de 96 es un número del
      anillo angular. Lo que hay que verificar es el arrastre por índice (AC5)
- [ ] T018 Test: el camino sigue siendo camino en las 8 orientaciones de las 12 piezas — 0 de 96 rompen
      (AC5, D4)

## Paso 3 — Los valores aguas abajo

- [ ] T020 `src/domain/__tests__/sequence.test.ts`: los grados y las puertas escritos a mano. Cada uno se
      mira antes de tocarlo; lo que cambia es el valor esperado, no la intención (AC9)
- [ ] T021 [P] `mcp-server/src/__tests__/render.test.ts:71,86`: los grados de la `X` al renderizar
- [ ] T022 [P] Si algún test afirma algo que este spec vuelve falso, se declara superado con su motivo
      escrito en el propio test — no se borra en silencio (AC9)

## Paso 4 — Documentación

- [ ] T030 [P] `docs/architecture/modelo-musical.md`: la fila «La forma» de la tabla de derivaciones y la
      sección «forma → qué celda tiene qué nota» entera, más la nota de Reproducción que llama al orden
      «el orden angular» (AC13)
- [ ] T031 [P] `CLAUDE.md`: la fila del modelo musical en la tabla de documentación (AC13)
- [ ] T032 [P] `.claude/rules/domain.md`: la mención al anillo angular (AC13)

## Paso 5 — Verificación

- [ ] T040 `pnpm verify` en verde (AC11)
- [ ] T041 `check_invariants` en **proceso fresco**, antes y después (AC11)
- [ ] T042 [P] `describe_piece` sobre `U`, `I`, `Y` y `X`
- [ ] T043 [P] `simulate_board` sobre el tablero de las capturas del pedido: las puertas nuevas
- [ ] T044 [M] A ojo con el transporte corriendo: la cabeza lectora recorre cada pieza celda por celda,
      y donde brinca es una de las cuatro que no pueden evitarlo (AC12)
- [ ] T045 [M] A oído: el arpegio continuo cambia el carácter de las 9 piezas que se movieron. Si alguna
      suena peor que antes, queda anotado con cuál y por qué — el spec no lo revierte, lo registra

## PR

- [ ] T050 Commit del paso 1 (sin cambio de comportamiento) separado del paso 2 (AC10)
- [ ] T051 El commit del paso 2 dice en su mensaje que cambia lo que suena: 9 de 12 piezas, 56 % de los
      tableros reordenados (D8)
- [ ] T052 PR a `main` con el resumen del cambio y los números de `research.md` §8

## Seguimiento (no bloquea)

- [ ] T060 El desempate angular quedó reducido a elegir la dirección del camino. Si en algún momento el
      instrumento gana un criterio propio para eso —por ejemplo «entrar por la celda más cercana a la
      pieza anterior», que sería la entrada dependiente del tablero y no de la forma—, `centroid`,
      `angleFromCentroid` y `DEGREE_EPSILON` se quedan sin consumidor. Hoy siguen siendo necesarios
- [ ] T061 La lámina de referencia del spec 007 ya no describe el mapeo. Queda como historia del 007
      (los specs no se reescriben, desviación 2 de `specs/README.md`), pero conviene que
      `docs/architecture/modelo-musical.md` no la nombre como fuente vigente

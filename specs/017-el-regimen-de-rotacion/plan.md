# Plan — Spec 017

Cuatro pasos, y el orden importa por una razón: el paso 1 **congela el comportamiento de hoy con
tests** antes de que exista una segunda rama. Sin eso, el régimen `escala` queda verificado sólo por el
test de referencia del 012, que congela las notas pero no la propiedad de que rotar conserve la tónica.

## Paso 1 — Caracterizar el régimen de hoy

Antes de tocar nada, tests que afirmen lo que `escala` hace **y que hoy no están escritos** (AC6):

- Las 36 celdas que conservan su nota al rotar, con la descomposición 24 / 12 / 0 por rotación.
- Que el grado 0 conserva la tónica en las rotaciones 1 y 2, y no en la 3.

Son tests de caracterización: si el paso 2 rompe el régimen viejo sin querer, fallan acá y no en una
verificación a oído tres pasos después.

## Paso 2 — El régimen entra al dominio

`domain/types/music.types.ts` con `RegimenDeRotacion` como union type derivado de un const-object en
`constants/` — **sin `enum`** (D8), que el `erasableSyntaxOnly` rechaza y que además es lo que permite
que node cargue `domain/` sin compilar.

`notesForRotation` recibe el régimen. La rama nueva es corta:

```
orden:  const base = <pentatónica mayor sobre basePc>
        devolver base corrida r posiciones
```

**Sin default en el parámetro.** Es la misma decisión que `dur` y `rel` en `scheduleVoice`: un default
haría que un llamador que se lo olvide obtenga silenciosamente el régimen viejo, y son 36 de 48
combinaciones las que difieren. Que el typecheck lo atrape es el punto.

Después `arpeggioFor` y `buildSequence(placed, regimen)`, que es la firma más consumida (`research.md`
§6). Al final del paso, `pnpm verify` en verde con el régimen `escala` pasado explícitamente en todos
lados y **nada sonando distinto** — el paso 1 lo garantiza.

Tests: AC2 (no-regresión sobre las 48), AC3 (el corrimiento sobre las 48), AC4 (a rotación 0 son
idénticos, sobre las 12) y **AC5**, que es el que lleva el comentario: el 0 sobre 180 no es una
casualidad medida, está garantizado porque **5 es primo** y un corrimiento cíclico de `k ≠ 0` sobre `n`
elementos tiene puntos fijos sólo si `gcd(k, n) > 1`. Escrito así, el test sigue significando algo si
alguien cambia `NOTES_PER_PIECE`.

`checkNotes` de `invariants.ts` pasa a recorrer los dos regímenes, **partiendo su chequeo de orden**:
el `ns[i] > ns[i-1]` de `invariants.ts:220-224` es una propiedad de `escala` y no del modelo —medido,
falla en 36 de las 48 de `orden`—, así que extenderlo entero pondría `check_invariants` en rojo por
diseño. En `orden` lo reemplaza «es una permutación cíclica del arpegio de rotación 0», que implica lo
mismo y ata además el corrimiento (§7, AC12).

## Paso 3 — El interruptor y las tools

`App.tsx`: el estado, con default `escala` (AC11), y pasarlo a `buildSequence` (`:74`), a
`arpeggioFor` (`:81`) y a la proyección de desmontaje (`:174`). **`cellTextFor` no se llama desde
`App.tsx`**: lo llama `Board.tsx` dos veces (`:163`, `:164`), así que el régimen baja como **prop**.

Que las notas no se guarden hace que cambiar el régimen re-derive el tablero solo (D3, AC7) — **pero
sólo si el régimen entra en las tres cachés de derivación** (AC15): las dep arrays de los dos `useMemo`
y, sobre todo, la clave del `Map` de módulo de `cell-text.ts:9`, que no lo mira ningún linter y
sobrevive al render. Sin eso, el audio cambia y las celdas siguen mostrando las notas viejas.

Y `noteAtCell` (`domain/sequence.ts:115`, AC16) es la tercera firma pública que cambia: de ella sale la
altura del click de una celda **cruzada**. `tsc` obliga a tocar la línea; propagar es la respuesta, fijar
un régimen ahí es el error.

`PiecePalette.tsx`: el interruptor en la fila de `Rotación`, leyéndose como una oración (D4, AC10). El
ancho se mide contra la tarjeta que dejó el 016, que ya la llenó de miniaturas.

MCP: `describe_piece` y `simulate_board` aceptan el régimen **y lo reportan** (AC9). Reportarlo no es
cortesía: en 36 de 48 casos la misma pregunta tiene dos respuestas, y una tool que contesta cinco notas
sin decir bajo qué régimen es ambigua.

Y **`SCALE_LABEL`** (`describePiece.ts:31-36`), que es lo que ningún gate atrapa: un array hardcodeado
indexado por rotación cuyas cuatro entradas son falsas bajo `orden`. Su propio docblock lo declara uno
de los dos supuestos del server que pueden desincronizarse **sin que `tsc` diga nada**.

## Paso 4 — Documentación y la escucha

Son **seis** lugares y están enumerados con su línea en AC14. `docs/architecture/modelo-musical.md` es
el que más cambia y lo dice en **tres** puntos, no en uno: la fila `:14`, el «rotar elige *qué* notas,
reflejar elige *en qué* orden» de `:169` —que en `orden` es al revés— y el `:252`. Después
`docs/README.md:11`, `CLAUDE.md:152` y `.claude/rules/domain.md:36`.

Y en `music.ts`, **los dos docblocks**: la frase «*la* decisión de diseño del instrumento» está en el de
**módulo** (`:9-14`), no en el de `notesForRotation` (`:22-31`, que lista el mapeo rotación→fórmula y el
`octShift`). Los dos pasan a decir una de dos, con la otra al lado.

Y después **AC13, que es el punto del spec**: el mismo tablero en los dos regímenes, alternando en
vivo. La pregunta no es cuál suena mejor sino **si los dos merecen quedarse**, que es lo que el pedido
dijo que iba a decidir después.

## Verificación

| Qué | Cómo |
|---|---|
| AC6 | Paso 1, antes de que exista la segunda rama |
| AC2, AC3, AC4, AC5 | `music.test.ts` sobre las 48 / 180 combinaciones |
| AC1, AC8 | Por lectura y por lint: el linter de dirección de dependencia sigue en verde y nada lee un global |
| AC7 | `[M]` navegador: alternar el régimen con el transporte corriendo |
| AC9 | Test en `mcp-server`: la misma pieza con los dos regímenes da respuestas distintas y **cada una dice cuál es** |
| AC10, AC11 | Por lectura y medición en el navegador |
| AC15 | Test: `cellTextFor` con la misma pieza y los dos regímenes devuelve notas distintas — es lo que el memo rompería, y hoy `cell-text.test.ts:80` ya ejercita el memo con `toBe` |
| AC16 | Test: `noteAtCell` sobre una pieza en `orden` devuelve la nota que el tablero pinta en esa celda, no la de `escala` |
| AC12 | `pnpm verify` + `check_invariants` en proceso fresco |
| AC13, AC14 | `[M]` y lectura |

> **El paso 2 va en su propio commit y declarado**: cambia lo que suena en 36 de 48 combinaciones
> cuando el régimen nuevo está activo. Es la misma regla con la que el 012 declaró su cambio de audio.

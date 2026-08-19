# Research — Spec 017

Medido el 2026-08-19 sobre `main` en `c958dde`, ejecutando el dominio real con
`node --experimental-strip-types` contra `src/domain/`. No hay estimaciones: los 48 arpegios de cada
régimen se generaron y se compararon.

## 1. Qué hace hoy la rotación, exactamente

```ts
export function notesForRotation(basePc: number, octave: number, rot: number): number[]{
  let formula = PENT_MAJOR, transpose=0;
  if (rot===1) formula = PENT_MINOR;
  else if (rot===2) formula = PENT_BLUES5;
  else if (rot===3) { formula = PENT_MAJOR; transpose = 7; }
  ...
}
```

Nada más. La rotación **no** toca `degreeByCellIndex` —que corre sobre la forma canónica y viaja por
índice— ni el orden de reproducción, ni las puertas del circuito. O sea que hoy rotar **cambia las
notas y no cambia el orden**, y este spec construye el espejo exacto.

Las fórmulas:

```
PENT_MAJOR   [0, 2, 4, 7,  9]
PENT_MINOR   [0, 3, 5, 7, 10]
PENT_BLUES5  [0, 3, 5, 6,  7]
rot 3 = PENT_MAJOR transpuesta +7
```

## 2. Las dos lecturas de "cambio de orden sin cambio de notas" son idénticas al oído

- **(a) correr el arpegio**: la nota `j` pasa a ser la `j+r`.
- **(b) correr la entrada**: el camino que recorre la pieza arranca por otra punta.

Si se piensa el recorrido de la pieza como un ciclo, arrancar en otro punto produce **la misma
secuencia de alturas rotada**. Lo único que las separa es qué celda se ilumina en cada momento, que es
información visual.

(b) además rompe cosas: el camino lo elige `pathThroughCells` con Held-Karp y su punta la decide el
desempate angular (spec 012, D1). Forzar el arranque daría **otro camino**, y las puertas del circuito
salen del orden de reproducción, así que el tablero se reordenaría. O sea que "cambiar el orden adentro
de la pieza" terminaría cambiando el orden **entre** piezas — exactamente lo que D11 del 012 prohíbe.

(a) no toca `transform.ts`, no toca `gates` y no toca el circuito.

## 3. Cuánto cambia: los 48 arpegios

```
arpegios que cambian de contenido:   36 / 48      idénticos: 12
conjuntos de alturas distintos:      escala 43    orden 12
alturas distintas en el instrumento: escala 28    orden 21
```

Los 12 idénticos son **exactamente las 12 piezas a rotación 0**, que es lo que D2 busca: los dos
regímenes tienen origen común y divergen al rotar.

De 43 conjuntos a 12 es la medida de lo que el régimen `orden` simplifica: cada pieza tiene **un** solo
conjunto de cinco alturas, y rotarla no lo mueve.

## 4. El hallazgo que da vuelta la intuición: qué celda conserva su nota

180 combinaciones (12 piezas × 3 rotaciones ≠ 0 × 5 celdas):

| Régimen | celdas que conservan su nota |
|---|---|
| `escala` | **36 / 180** |
| `orden` | **0 / 180** |

O sea que el régimen con menos material —12 conjuntos contra 43— es el que **mueve más notas** al
rotar. Las dos cifras están explicadas y ninguna es casualidad:

**En `escala`, las fórmulas comparten grados.** Medido:

```
MAJOR vs MINOR   coinciden en los grados [0, 3]
MAJOR vs BLUES5  coinciden en el grado   [0]

rotación 1: 24 / 60 celdas conservan su nota     (2 grados × 12 piezas)
rotación 2: 12 / 60                              (1 grado × 12)
rotación 3:  0 / 60                              (transposición +7: nada sobrevive)
            ──────
             36
```

En particular **el grado 0 conserva la tónica en las rotaciones 1 y 2**: la pieza sigue anclada a su
nota, que es lo que hace que `BASE_MAP` se escuche como identidad.

**En `orden` el cero está garantizado.** Un corrimiento cíclico de `k ≠ 0` sobre `n` elementos tiene
puntos fijos sólo si `gcd(k, n) > 1`, y `n = 5` es primo: para `k = 1, 2, 3` el `gcd` es 1 siempre. No
es una medición afortunada — es una propiedad, y por eso AC5 pide que el test la escriba y no sólo la
verifique. **Con una escala de 6 notas dejaría de valer.**

Consecuencia musical: `orden` le saca a la pieza su ancla. La tónica sigue en el conjunto pero deja de
ser la primera nota.

## 5. Lo que no estaba previsto: el salto y el registro

```
salto máximo dentro del arpegio    escala: promedio 3,0  máx 3 semitonos
                                   orden:  promedio 7,5  máx 9

registro del instrumento           escala: C4 .. D#6
                                   orden:  C4 .. G#5
```

Los cuatro arpegios de `escala` **suben siempre**, con pasos de 2 o 3 semitonos, porque las cuatro
fórmulas son crecientes. Correr el arpegio cíclicamente mete **exactamente un salto grande**: la nota de
arriba vuelve abajo.

```
F, rotación 1, orden:   D4  E4  G4  A4  C4
                                      ↑ −9 semitonos
```

Y el registro se angosta **7 semitonos por arriba**, porque la transposición `+7` de la rotación 3 es
lo que en `escala` empuja a las piezas de tónica alta casi una octava más arriba. Sin ella, el techo
baja de `D#6` a `G#5`.

**Ninguna de las dos cosas estaba en el pedido ni en el diseño**, y salieron generando los 48 arpegios.
Es el mismo caso que el `research.md` del 001, que desmintió tres supuestos corriendo el algoritmo.

La variante que las evitaría es reajustar la octava de las notas que dan la vuelta —`D4 E4 G4 A4 C5`—:
el arpegio vuelve a subir y el registro se ensancha. Se descarta en esta versión porque **cambia las
notas**: son las mismas clases de altura pero no los mismos MIDI, y el pedido dice *sin cambio de las
notas*. Es un `+12` condicional en una línea, así que probarla después es barato.

## 6. Por dónde se enhebra el régimen

`arpeggioFor` es la única derivación pieza→arpegio del dominio desde que se cerraron los seguimientos
del 007/009/010; antes estaba escrita cuatro veces. O sea que hay **un solo lugar** donde el régimen
entra al modelo, y eso es lo que hace barato este spec.

Consumidores, en orden de distancia:

| Quién | Qué llama | Cómo le llega el régimen |
|---|---|---|
| `domain/sequence.ts` | `arpeggioFor`, `notesForRotation` | parámetro de `buildSequence` |
| `components/cell-text.ts` | `notesForRotation` (vía `cellTextFor`) | parámetro |
| `App.tsx` | `arpeggioFor` para el panel y el click | del estado |
| `mcp-server/.../describePiece.ts` | `notesForRotation` | argumento de la tool |
| `mcp-server/.../simulateBoard.ts` | `buildSequence` | argumento de la tool |

Las dos tools **tienen que reportar** el régimen y no sólo aceptarlo (AC9): una respuesta que dice cinco
notas sin decir bajo qué régimen es ambigua en 36 de 48 casos.

`buildSequence(placed)` pasa a `buildSequence(placed, regimen)`. Es la firma más consumida de las dos
que cambian y toca `App.tsx`, `route-source.ts`, los tests de dominio y el MCP server.

## 7. `checkNotes` se queda mirando medio modelo

`invariants.ts` documenta que `checkNotes` recorre **48** combinaciones «porque el espejo sólo invierte
el orden». Con dos regímenes, 48 pasa a ser la mitad del espacio.

Lo que el chequeo garantiza —que la cantidad de notas de la fórmula coincida con `CELLS_PER_PIECE`, o
sea que ninguna celda quede sin nota ni sobre ninguna— vale igual en los dos regímenes, pero el régimen
`orden` no puede quedar **sin recorrer**: es donde un corrimiento mal escrito produciría un `undefined`
que `midiName` pinta como `undefinedNaN` en la celda, que es el caso que ese invariante existe para
atrapar.

AC12: o pasa a 96 o declara por qué no.

## 8. Vocabulario

El pedido los llamó "dos dificultades". `CLAUDE.md`, primera sección:

> Un prototipo de **instrumento musical**, no un juego con reglas de resolución. […] No hay puntaje ni
> condición de victoria — al evaluar una feature, la pregunta es si vuelve al instrumento más
> expresivo, no más difícil.

No hay respecto de qué ser más difícil. Se llaman **regímenes**, y el control dice qué cambia la
rotación en vez de nombrar un nivel.

## 9. Archivos que toca

| Archivo | Qué |
|---|---|
| `src/domain/types/music.types.ts` *(nuevo)* | `RegimenDeRotacion`, union type derivado |
| `src/domain/constants/music.constants.ts` | El const-object de los dos valores, y el default |
| `src/domain/music.ts` | `notesForRotation` y `arpeggioFor` reciben el régimen |
| `src/domain/sequence.ts` | `buildSequence(placed, regimen)` |
| `src/domain/invariants.ts` | `checkNotes` (§7) |
| `src/domain/__tests__/music.test.ts` | AC2, AC3, AC4, AC5, AC6 |
| `src/App.tsx` | El estado, y pasarlo a las tres llamadas |
| `src/components/PiecePalette.tsx` | El interruptor en la fila de `Rotación` |
| `src/components/cell-text.ts` | Parámetro |
| `mcp-server/src/tools/describePiece.ts`, `simulateBoard.ts` | Aceptar y **reportar** (AC9) |
| `docs/`, `CLAUDE.md`, `.claude/rules/domain.md` | AC14 |

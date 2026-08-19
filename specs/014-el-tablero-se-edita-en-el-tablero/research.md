# Research — Spec 014

Estado del código medido el 2026-08-19, sobre `main` en `c958dde`. Las mediciones de layout se hicieron
en el navegador contra el dev server, viewport 1536 × 695, moviendo `gridColumn` **inline**.

> Nota de método: el primer intento midió reemplazando las clases (`md:col-span-7` → `md:col-span-9`) y
> dio números sin sentido — la paleta saltaba a 1128 px de ancho. Es la trampa que el repo ya tiene
> escrita: **Tailwind escanea el fuente**, así que una clase que no está en ningún `.tsx` no existe como
> regla CSS y el elemento cae a su ancho automático. Las mediciones de abajo son con `style.gridColumn`.

## 1. Qué hace hoy un click sobre una celda ocupada

```ts
function handleCellClick(x: number, y: number){
  const cells = cellsAt(transformedShape, ANCHOR_INDEX[selected], x, y);
  if (!isValid(cells, placed)) return;      // ← acá muere el click sobre una pieza
  ...
}
```

Nada. `isValid` rechaza cualquier solape y el handler vuelve. O sea que el gesto que este spec le
quiere dar significado **hoy no tiene ninguno**, y no hay que desalojar nada.

Importa para D2: la condición nueva no puede ser "`isValid` falló", porque eso también es verdad al
chocar contra una pieza distinta. Tiene que ser una pregunta sobre **la celda clickeada**, y la función
que la contesta ya existe:

```ts
occupantAt(placed, x, y): PlacedPiece | undefined
```

Con dos piezas del mismo tipo colocadas, devuelve la que cubre esa celda. Eso es exactamente lo que
AC1 pide y no hace falta nada nuevo en `domain/board.ts`.

## 2. Qué muestra `PlacedList` y qué se pierde al borrarlo

| Dato | ¿Se pierde? |
|---|---|
| Letra y color de la pieza | No: el tablero la pinta desde el 007 |
| Rotación (`180°`) y reflexión (`⥯`) | **Sí** |
| Las cinco notas en orden de reproducción | No: el tablero pinta la nota de cada celda |
| Las celdas en coordenadas (`(3,3) (2,2)…`) | Sí, y es lo más redundante de los cinco |
| **La posición en el circuito** (`1.`, `2.`, …) | **Sí — y es el único lugar donde estaba** |
| El botón `Quitar` | Se reemplaza por el click sobre el tablero |

Los dos que se pierden de verdad son la orientación y el orden. La orientación de una pieza colocada
igual **se lee del tablero**: el `#0..#4` de sus celdas dice por dónde entra y sale, que es la
consecuencia audible de la orientación. El orden se pierde y D5 lo acepta.

`PlacedList.tsx` son 100 líneas y es el único consumidor de `arpeggioFor` dentro de `components/`.
`arpeggioFor` conserva consumidores en `domain/sequence.ts` y en el MCP server, así que borrarlo no
deja una pura huérfana.

## 3. Layout: de dónde sale `CELL_PX = 63` y qué pasa al liberar dos columnas

Estado de hoy, medido:

```
grid (max-w-6xl)   1152,0 × 633,6
paleta   col-span-3   caja 276,0 × 461,6   interior 252,0 × 437,6
tablero  col-span-7   caja 665,3 × 461,6   interior 633,3 × 429,6
lista    col-span-2   caja 178,7 × 461,6   interior 154,7 × 437,6
grilla del tablero   630,0 × 378,0
```

`CELL_PX` es `min(633,3 / 10 · 429,6 / 6) = min(63,3 · 71,6) = 63`. **Lo limita el ancho**, y sobran
51,6 px de alto en la tarjeta.

Escondiendo la lista y moviendo el reparto:

| paleta / tablero | tablero interior | por ancho | por alto | `CELL_PX` | paleta interior |
|---|---|---|---|---|---|
| 3 / 9 | 828,0 × 429,6 | 82,8 | 71,6 | **71** | 252,0 |
| **4 / 8** | 730,7 × 429,6 | 73,1 | 71,6 | **71** | **349,3** |
| 5 / 7 | 633,3 × 429,6 | 63,3 | 71,6 | 63 | 446,7 |

**El que limita cambia de lado entre `col-span-7` y `col-span-8`.** A partir de 8 columnas manda el
alto, así que la novena no le compra nada al tablero: los dos repartos dan 71. Por eso D6 le da una
columna a cada uno.

Y el alto del tablero lo fija la **paleta**, que es la tarjeta más alta de la fila. Medido inyectando
80 px de relleno en la paleta:

```
paleta +80 px  →  tablero interior 730,7 × 509,6  →  CELL_PX 73
```

O sea que cuando el 016 haga más alta la paleta, `CELL_PX` sube solo. Este spec deja **71** y el 016
lo remide — el techo por ancho a `col-span-8` es 73,1, así que 73 es donde se detiene.

## 4. El docblock de `CELL_PX` deja de ser cierto en dos frases

`layout.constants.ts` explica el 63 con dos números:

- **60 es el piso**, medido con un `Range` sobre el nodo de texto: `D#5` ocupa 35,4 px a `text-[19px]`.
  Este número **no cambia** — depende de la fuente, no del ancho de la tarjeta.
- **63 es el techo útil**, y sale de "el tablero vive en un `md:col-span-7` de un `max-w-6xl`, o sea
  633 × 380 px de interior". Esa frase queda vieja en las dos mitades: el `col-span` pasa a 8 y el
  interior medido hoy ya no es 380 de alto sino 429,6 (la paleta creció desde que se escribió).

AC11 obliga a reescribirlo con los números de §3. La trampa que el docblock ya advierte —que el piso
hay que remedirlo cada vez que se toca el `text-[…]`— sigue valiendo y no la toca este spec.

## 5. `route-source.ts` arma el velo desde `steps`, y una pieza muteada no va a tener uno

```ts
return { marcas, ids: s.steps.map((st) => st.pieceId), porPieza };
```

`porPieza` es lo que `Playhead.tsx` usa para atenuar las celdas de una pieza que **todavía no se
estrenó** en el ciclo en curso. Se construye recorriendo `s.steps`, así que con D3 —la pieza muteada no
emite `Step`— esa pieza desaparece del velo.

Las dos salidas, y hay que elegir una a conciencia (AC9):

- **(a) La pieza muteada no tiene velo.** Coherente: el velo dice "esto todavía no sonó", y una pieza
  muteada no va a sonar nunca. Cuesta cero código.
- **(b) El velo se arma también desde los clicks de la pieza muteada**, agrupando por su `cell`. Cuesta
  que `Click` o el armado sepan a qué pieza pertenece la celda, que hoy no lo saben — `Click` lleva
  `cell` pero no `pieceId`.

(a) es lo que sale gratis y lo que el velo significa. Se escribe la decisión igual: lo que no puede
pasar es que el velo desaparezca porque nadie miró.

Las **marcas** de la cabeza lectora sí siguen andando sin tocar nada: se arman de `s.steps` *y* de
`s.clicks`, y los cinco clicks de la pieza muteada entran por la segunda rama con su `cell`. O sea que
la cabeza sigue recorriendo la pieza muteada celda por celda, que es lo correcto — está ocupando ese
tiempo.

## 6. `PlacedPiece` cruza el borde de paquete

```
$ grep -rln "PlacedPiece" src/ mcp-server/
src/App.tsx  src/components/Board.tsx  src/components/PlacedList.tsx  src/components/route-source.ts
src/domain/board.ts  src/domain/invariants.ts  src/domain/music.ts  src/domain/sequence.ts
src/domain/types/board.types.ts  src/domain/types/sequence.types.ts
mcp-server/src/tools/simulateBoard.ts        ← el otro paquete
+ 4 archivos de test
```

`simulateBoard.ts` construye `PlacedPiece` a partir de su entrada JSON. Agregar `muted` lo va a hacer
fallar el typecheck hasta que lo contemple, que es la red que `CLAUDE.md` describe: `pnpm verify`
typechequea cruzando el borde.

Decisión de forma: `muted: boolean` **obligatorio** y no `muted?: boolean`. Opcional dejaría dos
representaciones de "no muteada" (`false` y ausente) y el repo ya pagó ese error en `Click.note`, donde
la ausencia significa algo distinto de `undefined` explícito y hay un ternario en `App.tsx` puesto a
propósito para no producir el tercer estado.

## 7. El contraste del texto sobre una baldosa blanca (D4)

`PIECE_COLOR[piece].fg` está elegido contra el `bg` de su pieza y verificado por
`palette.test.ts` en Lc. Sobre blanco no vale: el `fg` de las piezas de fondo oscuro es blanco, o sea
invisible.

La celda muteada usa el mismo color de texto que ya usa el tablero fuera de las piezas. No hace falta
un par nuevo en `PIECE_COLOR` ni tocar `palette.test.ts`: es un color del tablero, no de la pieza —
que es justamente lo que D4 quiere decir.

Sí hay que verificar que `LC_EXCEPCIONES` no se toque: `L` e `Y` están ahí porque no llegan al piso con
**su propio** fondo, y este spec no mueve ningún fondo de pieza.

## 8. Archivos que toca

| Archivo | Qué |
|---|---|
| `src/domain/types/board.types.ts` | `muted: boolean` en `PlacedPiece`, con su docblock (D7) |
| `src/domain/sequence.ts` | La pieza muteada emite 5 `Click`s y ningún `Step` (D3) |
| `src/domain/__tests__/sequence.test.ts` | AC5, AC6 |
| `src/App.tsx` | El handler del click con las cuatro ramas, `col-span` de las tarjetas, borrar el `<PlacedList>` |
| `src/components/Board.tsx` | La baldosa blanca y el color de texto (D4) |
| `src/components/cell-text.ts` | Si el muteo entra por acá o por `Board.tsx` — se decide en el plan |
| `src/components/PlacedList.tsx` | **Borrado**, en su propio commit (AC10) |
| `src/components/constants/layout.constants.ts` | `CELL_PX` 63 → 71 y el docblock reescrito (AC11) |
| `src/components/route-source.ts` | Lo que decida §5 |
| `mcp-server/src/tools/simulateBoard.ts` | Acepta y reporta `muted` (AC12) |
| `DESIGN.md`, `docs/`, `.claude/rules/ui.md` | AC16 |

# Research — Nota por celda y lenguaje visual

Todo lo de acá está **medido sobre este repo y sobre la imagen de referencia**, no supuesto. Los
scripts de medición fueron descartables; lo que importa son los números y están todos abajo.

## 1. Los 12 colores, muestreados de la referencia

La imagen de referencia (`Pentomino mapping to the chromatic scale.pdf`, la lámina de las 12 piezas) se
muestreó pixel a pixel. Contando colores con saturación (descartando los que tienen `max-min < 40`,
o sea el fondo y las grillas) aparecen **exactamente 12 colores dominantes**, entre 1.317 y 1.529
píxeles cada uno, y el siguiente en frecuencia cae a 82 — o sea que no hay ambigüedad sobre cuáles son.
La asignación color→pieza se resolvió escaneando las bandas de título en `y = 8`, `y = 200` e `y = 350`
y leyendo los segmentos contiguos en orden.

| Pieza | Tónica | Color | vs negro | vs blanco | Texto | AA (4.5:1) |
|---|---|---|---|---|---|---|
| `F` | C | `#D9E021` | **14,63** | 1,43 | negro | ok |
| `I` | C# | `#ED1E79` | **5,06** | 4,15 | negro | ok |
| `L` | D | `#29ABE2` | **8,02** | 2,62 | negro | ok |
| `N` | D# | `#8CC63F` | **10,26** | 2,05 | negro | ok |
| `P` | E | `#F15A24` | **6,23** | 3,37 | negro | ok |
| `T` | F | `#FF0000` | **5,25** | 4,00 | negro | ok |
| `U` | F# | `#009245` | **5,20** | 4,04 | negro | ok |
| `V` | G | `#FFFF00` | **19,56** | 1,07 | negro | ok |
| `W` | G# | `#0000FF` | 2,44 | **8,59** | **blanco** | ok |
| `X` | A | `#00A99D` | **7,16** | 2,93 | negro | ok |
| `Y` | A# | `#FF7BAC` | **8,68** | 2,42 | negro | ok |
| `Z` | B | `#FBB03B` | **11,38** | 1,85 | negro | ok |

Contraste calculado con la fórmula de luminancia relativa de WCAG 2.1. **Las 12 pasan AA**, pero tres
—`I` (5,06), `U` (5,20) y `T` (5,25)— pasan con poco margen: bajarles la luminosidad al color o
achicar el texto las pone en rojo. Es el motivo de que AC7 sea un test y no una inspección.

`W` es la única que necesita texto blanco. Ninguna de las 12 alcanza AAA (7:1) con las dos opciones,
así que el umbral del repo para esto es AA.

## 2. El algoritmo angular reproduce la referencia — con desempate por índice

Se corrió el mapeo del spec 001 (centroide → ángulo → grado, con la regla D1 de la celda central) sobre
las 12 piezas, con los **dos** criterios de desempate posibles, y se comparó celda por celda contra la
referencia:

| Desempate | Piezas que coinciden con la referencia |
|---|---|
| **Índice del array `SHAPES`** | **12 / 12** |
| Radio ascendente (el D2 del spec 001) | 10 / 12 |

Las dos que difieren:

| Pieza | Por índice | Por radio | Qué cambia al oído |
|---|---|---|---|
| `F` | `23410` | `24310` | Las celdas `(1,0)` y `(1,1)` se intercambian G4 ↔ A4 |
| `I` | `34012` | `43012` | Las celdas `(0,0)` y `(1,0)` se intercambian G#4 ↔ A#4 |

*(La notación es **grado por índice del array**: el dígito `k`-ésimo es el grado que recibe la celda
`SHAPES[pieza][k]`.)*

El mapeo completo que queda fijado —y que AC5 congela en un test— es:

| Pieza | Tónica | Grados por índice | Nota por celda |
|---|---|---|---|
| `F` | C | `23410` | (0,1) E4 · (1,0) G4 · (1,1) A4 · (1,2) D4 · (2,2) **C4** |
| `I` | C# | `34012` | (0,0) G#4 · (1,0) A#4 · (2,0) **C#4** · (3,0) D#4 · (4,0) F4 |
| `L` | D | `32104` | (0,0) A4 · (0,1) F#4 · (0,2) E4 · (0,3) **D4** · (1,0) B4 |
| `N` | D# | `34210` | (0,0) A#4 · (1,0) C5 · (1,1) G4 · (2,1) F4 · (3,1) **D#4** |
| `P` | E | `21304` | (0,0) G#4 · (0,1) F#4 · (1,0) B4 · (1,1) **E4** · (2,0) C#5 |
| `T` | F | `23401` | (0,0) A4 · (1,0) C5 · (2,0) D5 · (1,1) **F4** · (1,2) G4 |
| `U` | F# | `21340` | (0,0) A#4 · (0,1) G#4 · (1,0) C#5 · (2,0) D#5 · (2,1) **F#4** |
| `V` | G | `21034` | (0,0) B4 · (0,1) A4 · (0,2) **G4** · (1,0) D5 · (2,0) E5 |
| `W` | G# | `34201` | (0,0) D#5 · (1,0) F5 · (1,1) C5 · (2,1) **G#4** · (2,2) A#4 |
| `X` | A | `43012` | (1,0) F#5 · (0,1) E5 · (1,1) **A4** · (2,1) B4 · (1,2) C#5 |
| `Y` | A# | `12340` | (0,0) C5 · (1,0) D5 · (2,0) F5 · (3,0) G5 · (2,1) **A#4** |
| `Z` | B | `10234` | (0,1) C#5 · (1,1) **B4** · (1,0) D#5 · (2,0) F#5 · (3,0) G#5 |

En negrita, la celda que lleva la tónica (grado 0).

## 3. Empates y celdas centrales: menos de lo que decía el spec 001

El `research.md` del spec 001 afirma que «`F`, `I`, `T` y `X` producen dos o más celdas con el mismo
ángulo, en **todas** sus rotaciones». Medido de nuevo sobre la forma canónica, **con la regla D1 ya
aplicada** (es decir, sacando del anillo la celda del centroide):

| Pieza | Empates de ángulo en el anillo | Celda en el centroide |
|---|---|---|
| `F` | 1 | no |
| `I` | 2 | **sí** — índice 2, `(2,0)` |
| `T` | 1 | no |
| `X` | **0** | **sí** — índice 2, `(1,1)` |
| Las otras 8 | 0 | no |

Dos correcciones al 001, chicas pero relevantes para el comparador:

- **`X` no tiene ningún empate** una vez que su celda central sale del anillo: sus cuatro brazos están
  a 90° exactos entre sí. El 001 lo contaba como pieza con empates porque medía **antes** de aplicar
  D1, y el `atan2(0,0) = 0` de la celda central fabricaba el empate.
- **El empate de `T` no cambia el resultado**: las dos celdas empatadas quedan en el mismo orden con
  cualquiera de los dos criterios. La única divergencia real entre índice y radio está en `F` e `I`.

O sea: el desempate se ejerce en **3 piezas** (`F`, `I`, `T`) y **decide algo audible en 2** (`F`, `I`).

## 4. Estado actual del render

| Aspecto | Hoy | Archivo |
|---|---|---|
| Celda ocupada | `bg-slate-900 text-white` con la **letra de la pieza**, igual en las cinco | `src/components/Board.tsx:52-63` |
| Tamaño de celda | `CELL_PX = 28` (era `w-7`) | `src/components/constants/layout.constants.ts:9` |
| Celda de previsualización | `PREVIEW_CELL_PX = 20` | ídem `:12` |
| `title` de la celda | `(x,y)` | `Board.tsx:62` |
| Relación celda↔nota | **ninguna**: `cells` y `notes` son arrays paralelos | `domain/types/board.types.ts` |

El tablero de hoy mide 10 × 28 = **280 px**; a 44 px pasa a **440 px**. Vive en un
`md:col-span-6` dentro de un `max-w-6xl` (1.152 px), o sea ~540 px disponibles descontando el `gap-4`:
entra con margen. Debajo del breakpoint `md` el tablero ya toma las 12 columnas.

## 5. Archivos afectados

| Archivo | Acción |
|---|---|
| `src/domain/transform.ts` | agregar `centroid` y `angleFromCentroid` (geometría pura, sin música) |
| `src/domain/music.ts` | agregar `degreeByCellIndex` (D1 + D2′ + D3) |
| `src/domain/board.ts` | agregar `occupantCellIndex`, al lado de `occupantAt` — es lo que saca la derivación celda→nota de `Board.tsx` (AC14) |
| `src/domain/__tests__/board.test.ts` | AC14: `occupantCellIndex` sobre celda ocupada, celda vacía y las dos piezas adyacentes |
| `src/domain/__tests__/transform.test.ts` | tests de centroide y ángulo, con el eje Y hacia abajo explícito |
| `src/domain/__tests__/music.test.ts` | AC1–AC5 |
| `src/components/constants/palette.constants.ts` | **nuevo** — los 12 colores y su color de texto |
| `src/components/__tests__/palette.test.ts` | **nuevo** — AC7. Primer test de `components/`, y es puro: no necesita jsdom |
| `src/components/constants/layout.constants.ts` | `CELL_PX` 28 → 44 |
| `src/components/Board.tsx` | color por pieza + nota por celda (AC6) |
| `src/components/PiecePalette.tsx`, `PiecePreview.tsx`, `PlacedList.tsx` | heredan el color de pieza donde ya mostraban la letra |
| `mcp-server/src/tools/describePiece.ts` | agregar grado y nota por celda (AC9) |
| `DESIGN.md` | **nuevo**, en la raíz (AC10) |
| `CLAUDE.md` | fila nueva en la tabla de documentación (AC10) |
| `.claude/rules/domain.md` | la **fila** «La forma → **Nada, hoy**» (`:36`) deja de ser cierta |
| `docs/architecture/modelo-musical.md` | ahí **no es una fila**: es prosa (`:16-18`) más la tabla «Las cuatro reglas» (`:9-14`), que pasa a cinco |
| `docs/architecture/directory-structure.md` | el árbol de `components/` (`:85-92`) enumera archivo por archivo: entran `constants/palette.constants.ts` y el directorio `__tests__/` |
| `specs/log.md` | fila del 007; el 001 pasa a `Descartado` |

**No se toca `src/audio/`.** Ni un archivo. Es lo que hace verificable a AC8.

## 6. Deuda adyacente detectada (fuera de alcance)

- **`PlacedPiece.notes` queda redundante** cuando cada celda tenga su grado: la lista de notas se puede
  derivar del mapeo. Sacarlo toca `PlacedList` y el efecto de reconciliación, así que va después del
  009 — pero este spec **le resta un consumidor**: `Board` deriva el arpegio de `notesForRotation` y no
  de `occ.notes` (AC12), así que al llegar el borrado quedan dos y no tres.
- **`components/` no tiene ningún test** y las `@testing-library/*` siguen sin consumidor (ya está
  anotado en `log.md`). Este spec agrega el primer test de la carpeta, pero es de constantes y corre en
  `environment: 'node'`: **no** desbloquea ni requiere jsdom.
  La deuda queda **igual de abierta, pero no más grande**: la única lógica nueva que AC6 pone en juego
  sale de `Board.tsx` a `domain/board.ts` con `occupantCellIndex` (AC14), así que el componente vuelve
  a ser el encadenado de puras que el repo puede testear. Sin eso, este spec habría metido dentro de la
  capa sin cobertura justo la derivación de la que depende todo lo que se ve.
- **La rotación sigue siendo un `number` sin acotar** (deuda del spec 005). `degreeByCellIndex` no la
  recibe —trabaja sobre la forma canónica— así que este spec no la empeora ni la arregla.
- **El `title` de la celda dice solo `(x,y)`.** Con la nota adentro de la celda, el `title` natural
  pasa a ser `(x,y) · D#5 · grado 3`, pero eso ya es diseño del 010 (feedback) y no de este.

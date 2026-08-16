# Lenguaje visual

Qué comunica cada cosa que se ve en el tablero, y qué deliberadamente **no** comunica. Es la contraparte
visual de [docs/architecture/modelo-musical.md](./docs/architecture/modelo-musical.md): ahí está qué
suena, acá está qué se ve.

Los valores salieron de **muestrear la lámina de referencia píxel a píxel**, no de elegirlos de nuevo.
Las mediciones —cómo se aisló cada color, los dos contrastes de cada uno y el mapeo celda↔nota completo—
viven en
[research.md §1](./specs/007-nota-por-celda-y-lenguaje-visual/research.md#1-los-12-colores-muestreados-de-la-referencia)
del spec 007 y **no se copian acá**, para que no haya dos fuentes que se contradigan.

## Un color por pieza

Cada pentominó tiene un color y una tónica, y son la misma identidad vista de dos maneras. Los valores
viven en `src/components/constants/palette.constants.ts`:

| Pieza | Tónica | `bg` | Texto |
|---|---|---|---|
| `F` | C | `#D9E021` | negro |
| `I` | C# | `#ED1E79` | negro |
| `L` | D | `#29ABE2` | negro |
| `N` | D# | `#8CC63F` | negro |
| `P` | E | `#F15A24` | negro |
| `T` | F | `#FF0000` | negro |
| `U` | F# | `#009245` | negro |
| `V` | G | `#FFFF00` | negro |
| `W` | G# | `#0000FF` | **blanco** |
| `X` | A | `#00A99D` | negro |
| `Y` | A# | `#FF7BAC` | negro |
| `Z` | B | `#FBB03B` | negro |

**Cuidado con la colisión de nombres:** la **pieza `F`** suena con tónica **C**; la nota F le corresponde
a la **pieza `T`**. La letra describe la forma, no el sonido — y el color va con la pieza, así que el
amarillo verdoso de `F` es el color de un C.

La paleta vive en `components/constants/` y **no** en el dominio: un color no cambia lo que suena. El
dominio no sabe que `V` es amarilla, igual que no sabe que el tablero se dibuja con `div`s.

## El contraste es un test, no una inspección

`src/components/__tests__/palette.test.ts` **recalcula** el contraste desde `bg` con la fórmula de
luminancia relativa de WCAG 2.1 y verifica que el `fg` declarado sea el mejor de negro/blanco. No es
ceremonia; es la única forma de que el par (fondo, texto) no se desincronice:

- **Las 12 pasan AA (4.5:1)** con su texto declarado. **Ninguna alcanza AAA (7:1)** —ni con negro ni con
  blanco—, así que el umbral del repo para esto es **AA**, y no por comodidad: no hay elección de texto
  que lo suba.
- **Tres pasan con poco margen:** `I` (5,06), `U` (5,20) y `T` (5,25). Bajarle la luminosidad al fondo o
  achicar el texto las pone en rojo. Ese margen es el que hace que un ajuste "cosmético" del color sea
  un cambio verificable en vez de una opinión.
- **`W` (`#0000FF`) es la única que necesita texto blanco.** Escribir el color de texto al lado del de
  fondo crea dos valores que tienen que coincidir —el patrón que el spec 005 denunció como "cuatro pares
  de números que nada sincroniza"—, y acá lo sincroniza el test.

## Qué muestra una celda

| Medida | Valor | Por qué |
|---|---|---|
| `CELL_PX` | **44** (era 28) | es lo que hace falta para que entre `D#5` legible |
| Ancho del tablero | **440 px** (era 280) | 10 × `CELL_PX`; entra con margen en el `md:col-span-6` |
| `PREVIEW_CELL_PX` | **20**, sin cambio | la previsualización no muestra notas |

Una celda ocupada muestra **el nombre de su nota** como contenido principal (`C4`, `D#5`, …) y **el grado
como número chico en la esquina**. Son dos lecturas del mismo dato: la nota es lo que se oye, el grado es
la posición dentro del arpegio y es lo que deja ver la forma —la celda de grado 0 es la tónica, y el
recorrido 0→4 dibuja el orden angular alrededor del centroide.

Cada celda es dueña de **su** nota, no de la letra de la pieza repetida cinco veces: de dónde sale ese
mapeo está en
[modelo-musical.md](./docs/architecture/modelo-musical.md#forma--qué-celda-tiene-qué-nota).

## El color comunica identidad, nunca estado

Es la regla **D7** del spec 007, y decide sola los cuatro componentes: *el color va donde ya se
comunicaba identidad de pieza, y nunca sobre el canal de estado.*

| Dónde | Qué hace el color | Por qué |
|---|---|---|
| `Board` | celda ocupada = color de pieza | identidad debajo, estado encima |
| `PiecePreview` | las celdas toman el color; el punto del ancla queda | es el mismo objeto que el tablero, más chico |
| `PiecePalette` | **el fondo del botón no se toca**; el color entra al costado | el fondo ya es el canal de "seleccionado" |
| `PlacedList` | la letra toma el color de pieza | texto plano: no hay estado que pisar |

Lo que **no** se comunica con el color de pieza, porque el color ya está ocupado diciendo *qué pieza es*:

- **El fantasma de previsualización** — dónde caería la pieza que estás por colocar.
- **El choque** (`bg-rose-500`) — que ahí no entra.
- **El hover** — dónde está el cursor.

Los tres **ganan** sobre el color de pieza cuando conviven en la misma celda. Si alguna vez hace falta un
estado nuevo, el canal disponible es el borde, la opacidad o la superposición — no el fondo.

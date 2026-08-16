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
| `CELL_PX` | **63** (era 28) | el piso son 52 —`D#5` mide 27,96 px medidos a `text-[15px]`— y 63 es lo que la tarjeta deja |
| Tablero | **630 × 378 px** (era 280 × 168) | 10 × 6 × `CELL_PX` en una tarjeta de 633 × 380: llena las dos dimensiones |
| Tarjeta del tablero | **`md:col-span-7`** (era 6) | con 6 sobraban 68 px de alto: 10 × 6 no tenía la proporción de la tarjeta |
| Aire de la baldosa | **2 px** por lado | separa las fichas sin sumar un segundo número al ancho |
| Borde de la baldosa | **1 px `slate-900`** | el tablero se define reforzando la celda, no rellenando el fondo |

Una celda ocupada muestra **el nombre de su nota** como contenido principal (`C4`, `D#5`, …) y **el grado
como número chico en la esquina inferior derecha**, con `#`. Son dos lecturas del mismo dato: la nota es
lo que se oye, el grado es la posición dentro del arpegio y es lo que deja ver la forma —la celda de
grado 0 es la tónica, y el recorrido 0→4 dibuja el orden angular alrededor del centroide.

**Cada celda es una baldosa redondeada, no un casillero.** Los 63 px son la pista; adentro va una ficha
`rounded-lg` con 2 px de aire alrededor. Es el lenguaje de la lámina: una pieza colocada se lee como
cinco fichas apoyadas sobre la grilla, no como cinco celdas de una tabla. El aire lo hace el padding de
la pista y no un `gap` de la grilla, así que el ancho del tablero sigue siendo exactamente 10 × `CELL_PX`.

**El tablero se define reforzando la celda, no rellenando el fondo.** Con borde `slate-200` sobre el
panel blanco, sesenta casilleros blancos casi no se veían. Se probó pintar la superficie de la grilla
—gris y negra— y se descartó: un fondo pintado se lleva el protagonismo que tienen que tener los 12
colores, que es lo único que este tablero está para comunicar. Queda **un borde negro de 1 px en cada
baldosa**, ocupada o vacía: la grilla se dibuja sola y el resto del panel sigue blanco.

**Debajo del breakpoint `md` el tablero no entra y scrollea en horizontal.** A 375 px de viewport el
panel deja 311 px útiles contra 630 px de pistas fijas. Lo absorbe un `overflow-x-auto` en el contenedor
de la grilla —scrollea el tablero, no la página— y deliberadamente **no** un `CELL_PX` menor: el nombre
de nota es lo que hay que poder leer, así que achicar la celda debajo de `md` devuelve el problema que
el número existe para resolver.

Cada celda es dueña de **su** nota, no de la letra de la pieza repetida cinco veces: de dónde sale ese
mapeo está en
[modelo-musical.md](./docs/architecture/modelo-musical.md#forma--qué-celda-tiene-qué-nota).

## El color comunica identidad, nunca estado

Es la regla **D7** del spec 007, y decide sola los cuatro componentes: *el color va donde ya se
comunicaba identidad de pieza, y nunca sobre el canal de estado.*

| Dónde | Qué hace el color | Por qué |
|---|---|---|
| `Board` | celda ocupada = color de pieza | identidad debajo, estado encima |
| `PiecePalette` | **el fondo del botón no se toca**; el color entra al costado | el fondo ya es el canal de "seleccionado" |
| `PlacedList` | la letra va **sobre** el color de pieza | texto plano: no hay estado que pisar |

En `PlacedList` la letra va **sobre** el color y no *pintada* del color, y la diferencia no es de gusto:
como texto sobre el blanco de la tarjeta, el amarillo de `V` da **1,07 de contraste**. Sobre su propio
fondo vale el par `bg`/`fg` de `PIECE_COLOR`, que es el que el test de la paleta mantiene en AA. Es el
mismo criterio que en el tablero, donde la celda ocupada también es color de fondo con texto medido.

*(`PiecePreview` era el cuarto caso y ya no existe: mostraba la pieza aparte, sin notas, mientras el
fantasma la muestra en el lugar donde va a caer y con la nota de cada celda. Dos vistas del mismo objeto
donde una es estrictamente mejor no es lenguaje visual, es alto de pantalla gastado.)*

Lo que **no** se comunica con el color de pieza, porque el color ya está ocupado diciendo *qué pieza es*:

- **El fantasma de previsualización** (`bg-slate-300`) — dónde caería la pieza que estás por colocar.
- **El choque** (`bg-rose-500`) y el **fantasma inválido** (`bg-rose-300`) — que ahí no entra.
- **El hover** — dónde está el cursor.

El fantasma es gris y no verde a propósito: verde era un color más compitiendo con los 12 de la lámina.
Pero **sí dice lo mismo que va a decir la celda una vez colocada** —su nota y su grado, celda por celda,
por la misma cadena de puras— porque para eso está: para ver la jugada antes de hacerla. Lo único que le
queda al color ahí es el par gris/rosa, que es la señal de *entra* / *no entra*.

Los tres **ganan** sobre el color de pieza cuando conviven en la misma celda. Si alguna vez hace falta un
estado nuevo, el canal disponible es el borde, la opacidad o la superposición — no el fondo.

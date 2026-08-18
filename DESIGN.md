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

| Pieza | Tónica | `bg` | Texto | Lc |
|---|---|---|---|---|
| `F` | C | `#D9E021` | negro | 83,1 |
| `I` | C# | `#ED1E79` | **blanco** | 71,9 |
| `L` | D | `#29ABE2` | **blanco** | 55,8 ⚠ |
| `N` | D# | `#8CC63F` | negro | 64,3 |
| `P` | E | `#F15A24` | **blanco** | 65,6 |
| `T` | F | `#FF0000` | **blanco** | 69,6 |
| `U` | F# | `#009245` | **blanco** | 72,5 |
| `V` | G | `#FFFF00` | negro | 101,4 |
| `W` | G# | `#0000FF` | **blanco** | 90,7 |
| `X` | A | `#00A99D` | **blanco** | 60,4 |
| `Y` | A# | `#FF7BAC` | negro | 56,9 ⚠ |
| `Z` | B | `#FBB03B` | negro | 69,4 |

Los `bg` son los de la lámina del spec 007, **sin retocar**. Lo que cambió respecto de esa versión es
el color de texto de seis piezas (`I`, `L`, `P`, `T`, `U`, `X`), y cambió porque cambió el criterio.

**Cuidado con la colisión de nombres:** la **pieza `F`** suena con tónica **C**; la nota F le corresponde
a la **pieza `T`**. La letra describe la forma, no el sonido — y el color va con la pieza, así que el
amarillo verdoso de `F` es el color de un C.

La paleta vive en `components/constants/` y **no** en el dominio: un color no cambia lo que suena. El
dominio no sabe que `V` es amarilla, igual que no sabe que el tablero se dibuja con `div`s.

## El contraste es un test, no una inspección

`src/components/__tests__/palette.test.ts` **recalcula** el contraste desde `bg` y verifica que el `fg`
declarado sea el mejor de negro/blanco. No es ceremonia; es la única forma de que el par (fondo, texto)
no se desincronice: escribir el color de texto al lado del de fondo crea dos valores que tienen que
coincidir —el patrón que el spec 005 denunció como "cuatro pares de números que nada sincroniza"—, y acá
lo sincroniza el test.

### El criterio es APCA, no WCAG 2.1

Esta es la parte que cambió, y cambió **midiendo**. La versión original usaba la razón de contraste de
WCAG 2.1 con piso AA (4,5:1). Ese modelo elegía mal en los fondos saturados de tono medio, que son
buena parte de esta lámina: pondera el verde al 71,5% y el rojo al 21,3%, y es conocido por fallar
justo en rojos, magentas y cianes.

El caso testigo es `T` (`#FF0000`):

| | negro | blanco | elige |
|---|---|---|---|
| WCAG 2.1 | 5,25 | 4,00 | negro |
| APCA | Lc 40,0 | **Lc 69,6** | blanco |

Con el piso de APCA para texto de cuerpo en **Lc 60**, el negro que 2.1 elegía ni siquiera llegaba a
ser legible. Lo mismo pasaba en `I`, `P`, `U` y `X`. El cambio de criterio es lo que permitió poner
texto blanco **sin oscurecer ni un color de la lámina** — bajo 2.1 las dos cosas eran incompatibles.

- **10 de 12 llegan a Lc 60** con su texto declarado.
- **`L` (55,8) e `Y` (56,9) no llegan con ningún color de texto.** Les falta contraste al `bg`, no al
  `fg`; subirlas exige mover el color de la lámina. Están en `LC_EXCEPCIONES` y el test verifica que la
  excepción **siga haciendo falta**, así que el día que alguien retoque esos dos fondos el test obliga a
  sacarlas de la lista.

## Qué muestra una celda

| Medida | Valor | Por qué |
|---|---|---|
| `CELL_PX` | **63** (era 28) | el piso son 60 —`D#5` mide 35,4 px medidos a `text-[19px]`— y 63 es lo que la tarjeta deja |
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
estado nuevo, el canal disponible es el borde, la opacidad o la superposición — no el fondo. La cabeza
lectora del spec 010 es ese caso ya cobrado, y usó los tres: borde para el resalte, opacidad y
superposición para el velo.

## La cabeza lectora: el estado va al borde

Es el canal que la sección anterior dejaba reservado, cobrado por el spec 010. La cabeza marca **qué
celda suena en este intervalo** y lo hace **engrosando el borde de la baldosa**: sin relleno, sin cambio
de color y sin `scale`. Vive en `src/components/Playhead.tsx`, en una capa encima de la grilla.

**Por qué el borde y no un relleno.** En un secuenciador de fondo oscuro el estándar es *encender* el
step activo, porque la metáfora es un LED. Este tablero es tema claro —panel blanco, celdas vacías
blancas— y ahí subir luminancia hace **desaparecer** la celda: el amarillo de `V` se va a blanco. Un
relleno oscuro sí funciona (medido: al 30 % el peor caso de las 12, la `W`, da un delta de L\* de 8,8
sobre un umbral de ~3) pero **tapa la nota** que la celda muestra desde el spec 007, que es justo lo que
hay que poder leer. El borde marca el límite sin pisar el contenido.

**Por qué engorda para los dos lados.** Las 60 celdas ya tienen `border-slate-900`, ocupadas o vacías,
así que engrosar hacia adentro es un cambio de grado contra un campo lleno de bordes negros. El anillo
exterior es lo que agrega el salto de tamaño: la celda se lee más grande sin que crezca su caja.

**Por qué no `transform: scale`, que es lo obvio.** Porque `scale` cuenta para el overflow
**scrolleable** del contenedor. Medido en el DOM: con la cabeza en `(9,5)` y `scale(1.10)`, el
`scrollHeight` del `overflow-x-auto` de `Board` pasa de 378 a 381 y aparecen las barras de
desplazamiento —las dos, porque Tailwind fija solo `overflow-x` y entonces el eje Y computa a `auto`—.
`box-shadow` es *ink overflow*: pinta afuera de la caja sin agrandar la región scrolleable.

**El color del resalte es gris pizarra (`#0f172a`) y no un color de pieza.** Es la regla de arriba sin
excepción: el hue dice *qué pieza es*, nunca *qué está pasando*. Misma razón por la que el fantasma es
gris y no verde.

### Los escalones de grosor

El grosor es el único canal, así que las clases de evento se distinguen **por cantidad de borde** y por
nada más. Los valores viven en `Playhead.tsx`:

| Qué suena | Hacia adentro | Hacia afuera | Se lee como |
|---|---|---|---|
| **Nota** de una pieza | 3 px | 2 px | la celda tiene su turno |
| **Click** sobre celda vacía | 2 px | — | un roce: la cabeza pasó por acá |

Nota fuerte, click tenue: si se vieran igual, el recorrido parecería tener piezas donde no hay.

> **Pendiente del spec 011 — todavía no está en el árbol.** El recorrido va a pisar celdas **ocupadas**
> y a sonar su nota como floritura, y eso es un tercer caso: ni el turno de la pieza ni un roce sobre el
> vacío. Le toca un tercer escalón entre los dos de arriba, **también sin agregar color**. Mientras no
> se implemente, esta tabla tiene dos filas y el 011 agrega la tercera.

**La cabeza salta, no se desliza.** El instrumento está cuantizado a la grilla de intervalos, y un
movimiento continuo sugeriría una continuidad que no existe.

### El velo de lo que todavía no sonó

Una celda **colocada pero que aún no se estrenó** dentro del ciclo se dibuja tapada, no atenuada: un
nodo propio con `bg-white/60` y borde punteado `slate-900/50` sobre la baldosa. Se enciende cuando la
cabeza la pisa por primera vez, **celda por celda** y no de a pieza entera — que es lo único que hace
visible que el orden de reproducción no es el de colocación.

Que sea un nodo que **tapa** y no una clase que atenúa es la lección cara del review del 007: React es
dueño de las baldosas de `Board`, el loop de dibujo es dueño de la capa de la cabeza, y el estilo de un
mismo nodo **no se parte entre los dos**.

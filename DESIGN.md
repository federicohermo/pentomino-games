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
| `CELL_PX` | **73** (era 28, y 63 hasta el 014) | el piso son 60 —`D#5` mide 35,4 px medidos a `text-[19px]`— y 73 es lo que la tarjeta deja hoy: 63 → 71 al morir `PlacedList` (014) y 71 → 73 cuando las miniaturas hicieron más alta la paleta (016). Cuál de las dos dimensiones manda cambió de lado dos veces, y está escrito en el docblock de la constante |
| Tablero | **730 × 438 px** (era 280 × 168) | 10 × 6 × `CELL_PX` en una tarjeta de 730,7 × 464: llena el ancho, y los 26 px de alto que sobran son el precio de que la paleta muestre las doce formas |
| Tarjeta del tablero | **`md:col-span-7`** (era 6) | con 6 sobraban 68 px de alto: 10 × 6 no tenía la proporción de la tarjeta |
| Aire de la baldosa | **2 px** por lado | separa las fichas sin sumar un segundo número al ancho |
| Borde de la baldosa | **1 px `slate-900`** | el tablero se define reforzando la celda, no rellenando el fondo |

Una celda ocupada muestra **el nombre de su nota** como contenido principal (`C4`, `D#5`, …) y **su paso
como número chico en la esquina inferior derecha**, con `#`. Son dos lecturas del mismo dato: la nota es
lo que se oye, el paso es **cuándo** se oye —su lugar en el orden de reproducción— y es lo que deja ver
la forma. El recorrido 0→4 dibuja el camino con que el arpegio recorre la pieza: cada número está pegado
al anterior, por un lado o —en `F`, `T`, `Y` y `X`, las cuatro que no admiten recorrido ortogonal— por
una esquina.

**El `#0` es siempre la celda por donde la cabeza lectora entra, y el `#4` por donde sale.** Esa es la
razón de que el número sea el paso y no el grado: el grado dice qué lugar ocupa la nota en el arpegio
ascendente, y en una pieza **reflejada** el retrógrado hace que la cabeza entre por el grado 4 y cuente
hacia atrás. El número que se ve tiene que seguir a lo que se ve moverse. La tónica sigue estando en la
celda de grado 0, pero eso ya no se lee del número: se lee de la nota, que es el dato que la reflexión
no mueve.

**Cada celda es una baldosa redondeada, no un casillero.** Los `CELL_PX` son la pista; adentro va una ficha
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
| `PiecePalette` | **el fondo del botón no se toca**; el color pinta **la forma** de la pieza, dibujada en miniatura | el fondo ya es el canal de "seleccionado" |

*(`PlacedList` era el tercer caso y se fue con el spec 014: la letra iba **sobre** el color de pieza y
no *pintada* del color, porque como texto sobre el blanco de la tarjeta el amarillo de `V` da **1,07 de
contraste**. Ese argumento no se pierde — sigue valiendo en el tablero, donde la celda ocupada es color
de fondo con texto medido por el par `bg`/`fg` de `PIECE_COLOR`— pero la lista ya no existe: el tablero
se edita en el tablero.)*

*(`PiecePreview` era el cuarto caso y ya no existe: mostraba la pieza aparte, sin notas, mientras el
fantasma la muestra en el lugar donde va a caer y con la nota de cada celda. Dos vistas del mismo objeto
donde una es estrictamente mejor no es lenguaje visual, es alto de pantalla gastado.)*

### El botón de la paleta muestra la forma, no la letra

Desde el spec 016 cada botón dibuja **la pieza**, pintada con su color y **en la orientación que está
seleccionada ahora mismo**, con la letra chica debajo. Antes decía sólo la letra, con un punto de 8 px al
costado para la identidad — y esas doce letras son nombres arbitrarios: la `N` no se parece a una N, y
la `V` y la `L` son la misma forma con un brazo de distinto largo.

Tres cosas que hacen que eso sea posible sin romper nada de lo de arriba:

- **La caja es fija, de 5×5 celdas.** Es la más chica que contiene cualquier pentominó en cualquiera de
  sus 8 orientaciones. Sin ella, la `I` —que pasa de 5×1 a 1×5— haría reflowear los doce botones en cada
  rotación, que es el mismo bug que la línea de notas de esa tarjeta ya tenía documentado: *un panel de
  control que se acomoda solo cuando lo tocás mueve el botón justo cuando vas a apretarlo.*
- **El fondo del botón sigue sin tocarse**, porque sigue siendo el único canal de «seleccionada».
- **El punto de color se fue** y su borde se quedó, en cada celda de la miniatura: varios de los 12
  colores (el amarillo de `V`, el lima de `F`) casi no se ven contra el gris claro del botón sin
  apoyarse. Es el mismo motivo por el que las baldosas del tablero llevan borde desde el 007.

Y una que no cambia: **la miniatura no dice notas ni pasos**. Eso lo dice el tablero a 73 px por celda;
en una mini-celda de 8 px no entra un `D#5`, y meterlo es lo que hacía que la previsualización del 007
repitiera al fantasma. La paleta contesta *cuál* y *cómo está girada*; el tablero contesta *qué suena*.

Lo que **no** se comunica con el color de pieza, porque el color ya está ocupado diciendo *qué pieza es*:

- **El fantasma de previsualización** (`bg-slate-300`) — dónde caería la pieza que estás por colocar.
- **El choque** (`bg-rose-500`) y el **fantasma inválido** (`bg-rose-300`) — que ahí no entra.
- **El hover** — dónde está el cursor.
- **El muteo** (spec 014) — que la pieza está y no suena.

### El muteo: la ausencia de color

Una pieza **muteada** ocupa su lugar y su tiempo en el circuito y no suena sus notas. El canal es la
**ausencia de color**: la baldosa cae al blanco de una celda libre y **conserva su nota y su `#N`**, con
el texto en el gris del tablero.

Los dos canales obvios estaban tomados, y las reglas de arriba los protegen:

- **el color no puede ser**, porque es identidad de pieza y nunca estado — y además los 12 pares
  `bg`/`fg` están medidos en contraste, así que desaturarlos rompe la medición;
- **la opacidad tampoco**, porque la usa el velo de `Playhead` para decir «esta celda no se estrenó». Si
  muteado también atenuara, una pieza muteada recién colocada sería indistinguible de una esperando su
  turno.

Lo que queda dice exactamente lo que pasó: *esta pieza dejó de afirmar que suena, pero sigue siendo esta
pieza, en estas celdas, con estas notas y estos pasos.* No se confunde con una celda libre porque una
celda libre **no tiene texto** — es la misma distinción que ya separa a una libre de una del fantasma. Y
el texto no puede seguir usando `PIECE_COLOR[p].fg`: ese valor está elegido contra el `bg` de su pieza y
sobre blanco varios son ilegibles, algunos directamente blancos.

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
| **Cruce** con nota, sobre celda ocupada (spec 011) | 2 px | 1 px | un paso que pesa: la cabeza cruza y la celda suena, pero no es su turno |
| **Click** sobre celda vacía | 2 px | — | un roce: la cabeza pasó por acá |

Nota fuerte, cruce intermedio, click tenue: si se vieran igual, el recorrido parecería tener piezas
donde no hay, o confundiría un turno con un roce.

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

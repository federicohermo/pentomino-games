# Lenguaje visual

Qué comunica cada cosa que se ve en el tablero, y qué deliberadamente **no** comunica. Es la contraparte
visual de [docs/architecture/modelo-musical.md](./docs/architecture/modelo-musical.md): ahí está qué
suena, acá está qué se ve.

Los valores salieron de **muestrear la lámina de referencia píxel a píxel**, no de elegirlos de nuevo.
Las mediciones —cómo se aisló cada color, los dos contrastes de cada uno y el mapeo celda↔nota completo—
viven en
[research.md §1](https://github.com/federicohermo/pentomino-games/issues/69#1-los-12-colores-muestreados-de-la-referencia)
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
| Celda | **unos 73 px**, en `--cell` | el spec 021 la sacó del viewport y la dejó crecer hasta 180 px en un escritorio: la baldosa se volvía una tarjeta grande —el nombre de la nota a 46,8 px— y el tablero dejaba de leerse como un instrumento denso. El **031** la devolvió al tamaño de siempre y puso a crecer lo otro: lo que sale del viewport es **cuántas celdas hay**. El redondeo la deja entre 64 y 74,1 px según la pantalla (`grid-fit.ts`) |
| Objetivo de la celda | **73** (era 60) | es **tipográfico**: es la celda donde la nota vale los 19 px que el repo midió con un `Range` (`D#5` ocupa 35,4). Era 60 mientras la fuente estaba clavada en 19; al volverse proporcional, a celda 60 la nota renderiza a 15,6 y queda por debajo de lo medido |
| Tablero | **lo que entra en la pantalla**, mínimo 5 × 5 celdas | 26 × 15 en 1920 × 1080, 5 × 9 en un teléfono en vertical. Lo que sobra sin cubrir es siempre menos de una celda, y **no hay scroll en ningún eje**: `cols · cell ≤ vw` por construcción. El mínimo es 5 × 5 porque es la caja más chica donde entra cualquier pentominó — abajo de eso hay piezas que no se podrían colocar |
| Piezas a la vez | **12**, mida el tablero lo que mida | hasta el 031 lo garantizaba el área (60 ÷ 5) y nadie tenía que escribirlo. El circuito se resuelve con Held-Karp exacto, `O(n²·2ⁿ)`: medido, 12 piezas 3,1 ms y 16 piezas 18,6 ms. Es el mismo tope de siempre, dicho donde se pueda leer |
| Aire de la baldosa | **`2/73` de la celda** | separa las fichas sin sumar un segundo número al ancho. Proporcional desde el 021: fijo, a celda 180 la nota quedaría apretada contra 2 px de aire |
| Borde de la baldosa | **1 px `slate-900`, y NO escala** | es el único número fijo que sobrevive al 021: un filete es un delimitador y no un elemento tipográfico, y en `calc()` daría fracciones que el navegador redondea distinto por arista — sobre decenas de celdas adyacentes, un enrejado irregular |

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

**Cada celda es una baldosa redondeada, no un casillero.** La celda es la caja externa; adentro va una
ficha redondeada con un aire proporcional alrededor. Es el lenguaje de la lámina: una pieza colocada se
lee como cinco fichas apoyadas sobre la grilla, no como cinco celdas de una tabla. El aire lo hace el
padding de la pista y no un `gap` de la grilla, así que el ancho del tablero sigue siendo exactamente
10 celdas.

**Y las seis medidas de la baldosa escalan con la celda, no sólo las dos fuentes.** El aire, el
redondeo, la reserva de abajo y la posición del `#N` son razones sobre 73 —los px que tenían antes del
spec 021— y a esa celda dan exactamente los mismos números de siempre. Si crecieran sólo las letras, a
celda 180 la nota quedaría apretada contra 2 px de aire y 8 de redondeo, y la baldosa dejaría de leerse
como una ficha para leerse como un casillero, que es justo lo que estos números existen para evitar.

**El tablero se define reforzando la celda, no rellenando el fondo.** Con borde `slate-200` sobre el
panel blanco, sesenta casilleros blancos casi no se veían. Se probó pintar la superficie de la grilla
—gris y negra— y se descartó: un fondo pintado se lleva el protagonismo que tienen que tener los 12
colores, que es lo único que este tablero está para comunicar. Queda **un borde negro de 1 px en cada
baldosa**, ocupada o vacía: la grilla se dibuja sola y el resto del panel sigue blanco.

**No hay scroll, y no porque algo lo absorba: porque no puede haberlo.** Hasta el spec 031 la grilla
medía 10 × 6 celdas de 73 px pasara lo que pasara, así que abajo de 730 px de viewport no entraba y un
`overflow-x-auto` en el contenedor de la grilla scrolleaba el tablero en vez de la página. Con las
dimensiones saliendo del viewport ese caso dejó de existir —`cols · cell ≤ vw` y `rows · cell ≤ vh` por
definición de `floor`— y las tres clases que lo sostenían se fueron. Lo que cede en un viewport
angosto sigue **sin** ser el nombre de nota: primero se sacan columnas, y sólo cuando ya no se puede
—el mínimo de 5 × 5— se achica la celda.

Cada celda es dueña de **su** nota, no de la letra de la pieza repetida cinco veces: de dónde sale ese
mapeo está en
[modelo-musical.md](./docs/architecture/modelo-musical.md#forma--qué-celda-tiene-qué-nota).

## El color comunica identidad, nunca estado

Es la regla **D7** del spec 007, y decide sola los cuatro componentes: *el color va donde ya se
comunicaba identidad de pieza, y nunca sobre el canal de estado.*

**Y tiene una mitad no visual, que el spec 025 escribió: si el color es el único canal que dice el
estado, el árbol de accesibilidad no lo dice.** No es una regla nueva, es la misma leída desde el canal
donde no hay color — y estaba entera sin cubrir: medido sobre `src/`, **cero** `aria-pressed`, **cero**
`aria-checked` y **cero** `role=` en los 22 botones y el `input` de la app. Un fondo oscuro que
significa «seleccionada» le llega al ojo y no le llega a nadie más. Las tres cláusulas —nombre accesible
en todo control solo-icono, `aria-pressed` en todo lo que alterna y con el nombre siendo lo que alterna,
y la etiqueta tomada del texto visible en vez de duplicada— viven en
[`.claude/rules/ui.md`](./.claude/rules/ui.md).

**Ese canal y el anillo de foco del spec 026 son complementarios, no rivales.** El 025 reclama lo **no
visual** —el rol, el nombre accesible y el `aria-pressed`, que es lo que un lector de pantalla
anuncia— y el 026 reclama la **caja de afuera** de la celda, que es píxel. Son dos ejes distintos, así
que agotar uno no agota el otro y un control puede necesitar los dos: el árbol dice *qué es esto y en
qué estado está*, y el anillo dice *acá está el cursor ahora*. Lo que sí comparten es lo que **no**
tocan: ninguno de los dos le saca canal a los 12 colores.

| Dónde | Qué hace el color | Por qué |
|---|---|---|
| `Board` | celda ocupada = color de pieza | identidad debajo, estado encima |
| `OrientationPanel` (la rejilla que compone el dock `PiecePalette`) | **el fondo del botón no se toca**; el color pinta **la forma** de la pieza, dibujada en miniatura | el fondo ya es el canal de "seleccionado" |

*(`PlacedList` era el tercer caso y se fue con el spec 014: la letra iba **sobre** el color de pieza y
no *pintada* del color, porque como texto sobre el blanco de la tarjeta el amarillo de `V` da **1,07 de
contraste**. Ese argumento no se pierde — sigue valiendo en el tablero, donde la celda ocupada es color
de fondo con texto medido por el par `bg`/`fg` de `PIECE_COLOR`— pero la lista ya no existe: el tablero
se edita en el tablero.)*

*(`PiecePreview` era el cuarto caso y ya no existe: mostraba la pieza aparte, sin notas, mientras el
fantasma la muestra en el lugar donde va a caer y con la nota de cada celda. Dos vistas del mismo objeto
donde una es estrictamente mejor no es lenguaje visual, es alto de pantalla gastado.)*

### Los dos paneles flotan sobre el tablero

Desde el spec 021 no hay fila de tarjetas: el tablero ocupa el viewport y los controles flotan encima,
en una capa superior que **no empuja la grilla**. El de piezas es un dock de **220 × 357 px**; la señal
es una franja de `3 × 1` celdas.

**El dock se mide por su contenido y la señal en celdas**, y la asimetría tiene un motivo de cada lado.
Al dock lo llena una rejilla de casillas de lado fijo, así que su ancho es la **salida** de esa cuenta
y no una entrada: fijarlo por afuera pone al contenido a desbordar la caja, y eso está medido —1192 px
de desborde sobre un scroller de 215, 6,5 veces la caja—. La señal es al revés: adentro va un
`<canvas>`, que **no tiene tamaño propio** —lo hereda del contenedor y lo lee su `ResizeObserver`—, así
que la caja tiene que decirlo. Y lo dice en celdas porque
así la franja es la misma proporción del tablero en cualquier viewport, que es lo que hace que la
cuenta de qué celdas tapa valga en todos.

`(0,0)` y la esquina opuesta no se tapan nunca —ahí es donde el circuito cierra (spec 009) y donde
arranca la cabeza lectora (spec 010)—, y ésa es la regla que decide dónde **aparece** cada panel la
primera vez. De ahí en más lo decide el usuario: los dos se arrastran, así que «qué celdas tapa» es una
posición inicial y no una propiedad del diseño. Arriba se descarta por lo mismo — una barra superior
tapa el borde de arriba entero, `(0,0)` incluida.

Los dos arrancan **desplegados**: un instrumento que arranca con los controles escondidos no se
descubre. Plegado, cada panel deja sólo su encabezado —sigue diciendo qué es, en vez de volverse un
icono suelto— y las celdas que tapaba quedan libres. El fondo va semiopaco con desenfoque y no opaco:
abajo hay celdas con nota, y un panel opaco las esconde mientras uno translúcido dice que están ahí.

### El chasis: se agarra del asa, y no se puede perder

Los dos flotantes comparten un mismo chasis (`src/components/FloatingPanel.tsx`), y eso es lo que los
vuelve dos ejemplares del mismo objeto en vez de dos idiomas conviviendo.

- **Se agarra del asa, y el asa es el título.** El texto que dice qué panel es, es también lo que se
  arrastra: no hay un pomo aparte que haya que descubrir.
- **El asa y el plegado son dos botones y no uno.** El navegador sintetiza un `click` sobre el nodo
  donde termina un arrastre, así que un asa que además plegara cerraría el panel cada vez que se lo
  suelta. La otra salida —un umbral de píxeles que se coma ese `click`— deja un botón cuyo efecto
  depende de cuánto se movió el puntero, y eso no se puede anunciar en el árbol de accesibilidad. Con
  dos botones, cada uno tiene un trabajo y un nombre.
- **El teclado mueve el panel igual que el puntero.** Con el asa enfocada, las cuatro flechas lo
  desplazan `PASO_TECLADO_PX` = **16 px** por pulsación: cruzar un viewport de 1536 cuesta 96
  pulsaciones, y el error de posicionamiento queda por debajo de la celda más chica que el tablero
  dibuja. Sin esto el chasis sería un control sólo-mouse.
- **No se puede perder.** Quedan siempre `MARGEN_VISIBLE_PX` = **48 px** del panel dentro del viewport,
  que es más que el alto del asa: lo que sigue a la vista incluye la franja con la que se lo trae de
  vuelta. Arriba el tope es **0** y no −48, y no es simetría mal hecha — el asa vive en el borde
  superior del chasis, así que dejarlo subir escondería justo el control con el que se agarra, y un
  panel visible e inmóvil es peor que uno perdido porque parece que anda.
- **Los cuatro vértices van redondeados** (`rounded-2xl`). Redondear sólo los que no tocan el borde de
  la pantalla vale mientras la posición es fija; un panel que se suelta en el medio del tablero tiene
  los cuatro a la vista.

### La paleta es una tabla periódica

Los doce botones son **casillas cuadradas de lado fijo**, separadas y alineadas, cada una con su pieza
dibujada en miniatura —pintada con su color y **en su propia orientación**, desde el spec 016— y su
letra como **símbolo** en la esquina inferior derecha. El botón dibuja la forma y no la letra sola
porque esas doce letras son nombres arbitrarios: la `N` no se parece a una N, y la `V` y la `L` son la
misma forma con un brazo de distinto largo. Hasta el 020 los doce se dibujaban en la orientación de la
pieza en la mano, que es lo mismo que decir que la orientación era del instrumento: rotar para acomodar
una `F` movía 11 de las 12 miniaturas.

**La casilla mide `CASILLA_PX` = 48 px de lado**, y ese número es derivado y no elegido: la caja de la
forma son `MINI_BOX × MINI_CELL_PX` = 5 × 8 = **40 px**, más **4 px** de aire por lado. Cuadrada,
porque en una tabla periódica el símbolo vive en una casilla de lado fijo, y es lo que hace que las doce
se lean como un conjunto y no como una lista: con el ancho decidido por el reparto del contenedor y el
alto por el contenido, la casilla cambia de forma en cada viewport.

**Las doce forman un rectángulo lleno.** Se reparten en `c` columnas × `f` filas con `c × f = 12`
exacto, así que `c` tiene que dividir a 12: las candidatas son las divisoras **propias**, `{2, 3, 4,
6}` —`1` y `12` son las dos degeneraciones, la columna única y la barra de 620 px de ancho—. Quien
elige es `columnasRectangulares` (`src/components/rejilla.ts`) y **no** `repeat(auto-fill, …)`, que
contesta otra pregunta: devuelve la mayor cantidad que entre, divida o no, así que a un ancho que
admita 5 deja tres huecos en la última fila.

Lo que pide de ancho cada cantidad de columnas, con casilla 48 y separación 4 —`c × 48 + (c − 1) × 4`—:

| columnas | 2 | 3 | **4** | 5 | 6 |
|---|---|---|---|---|---|
| ancho | 100 | 152 | **204** | 256 | 308 |

El techo es `REJILLA_ANCHO_TECHO_PX` = **220 px**, y de ahí sale el default de **4 × 3**: el 5 entra y
no divide a doce, que es exactamente el caso donde `auto-fill` contesta mal. Ese techo es la palanca
entera — subirlo a 308 da un dock de `6 × 2` sin tocar una línea de la paleta.

**La letra es el símbolo, y va en la esquina inferior derecha**, como el número atómico de una tabla
periódica, y no debajo de la miniatura: la casilla mide 48 y la caja de la forma 40, así que apilarlas
pediría 50, y esos 40 son el mínimo que deja leer la forma. Lo que cede es la posición del símbolo, no
el tamaño de la forma. Y lleva **el fondo del botón detrás** y no `transparent`: el vértice inferior
derecho de la caja de 5 × 5 está ocupado en varias de las 96 orientaciones, y una letra sobre el color
de la pieza no tiene contraste garantizado contra ninguno de los doce. Con el fondo del botón debajo,
el par letra/fondo es el mismo que el resto de la casilla ya usa.

**Es un símbolo y no prosa, y por eso se queda.** La letra es el vocabulario con el que este repo habla
de las piezas: lo usan `describe_piece`, el `title` del tablero y este archivo. Lo que el dock suelta es
la **prosa** —de 210 caracteres de texto visible en 27 nodos a **30**—: una `F` de 6 px no es prosa, un
`Rotación` de 56 px sí.

**No es el teselado de pentominós, y conviene dejarlo escrito.** «Empacar las doce en un rectángulo»
tiene una segunda lectura —el teselado clásico, 12 × 5 = 60 celdas en 6 × 10— que es hermosa y **no es
esto**. Encastradas, las doce dejan de ser doce botones con su caja propia: la forma de cada una sólo
se lee por su color, no hay dónde poner el símbolo, y rotar una —que es lo que estas miniaturas
muestran, cada una en **su** orientación recordada— rompería el teselado en cada gesto. La tabla
periódica es lo contrario: casillas iguales, separadas y alineadas.

Tres cosas que hacen que eso sea posible sin romper nada de lo de arriba:

- **La caja de la forma es fija, de 5×5 celdas** —y son celdas de la MINIATURA, de `MINI_CELL_PX` = 8
  px, que no escalan con `--cell`—. Es la más chica que contiene cualquier pentominó en cualquiera de
  sus 8 orientaciones. Sin ella, la `I` —que pasa de 5×1 a 1×5— haría reflowear los doce botones en cada
  rotación: *un panel de control que se acomoda solo cuando lo tocás mueve el botón justo cuando vas a
  apretarlo.* Con el spec 020 la caja fija pasa a ser **más** necesaria y no menos: las doce formas ya
  no cambian juntas, así que cualquier ajuste al contenido puede mover una sola miniatura y descuadrar
  la fila entera. Y adentro del dock **no hay scroll**: `scrollHeight − clientHeight` = **0**, porque la
  caja del panel la fija su contenido y no al revés.
- **El fondo del botón sigue sin tocarse**, porque sigue siendo el único canal de «seleccionada».
- **El punto de color se fue** y su borde se quedó, en cada celda de la miniatura: varios de los 12
  colores (el amarillo de `V`, el lima de `F`) casi no se ven contra el gris claro del botón sin
  apoyarse. Es el mismo motivo por el que las baldosas del tablero llevan borde desde el 007. Lo que
  **no** se heredó es su color fijo, y ahí hay un número que conviene tener a mano: **el borde se
  invierte con el estado del botón**, porque en cada estado falla un conjunto distinto de piezas y los
  dos son disjuntos. Medido en razón WCAG 2.1 —acá aplica 1.4.11, *objeto gráfico*, piso **3:1**, y no
  el APCA con el que se elige el color de texto—: contra el botón sin seleccionar (`slate-100`) hay
  **7 de 12** bajo el piso, la peor `V` con **1,02**; contra el seleccionado (`slate-900`) hay **una**,
  `W` con **2,08**. Un borde `slate-900` da 16,30 sobre el claro pero **1,00** sobre el oscuro —es el
  mismo color del fondo—, así que sobre el botón seleccionado el borde pasa a `slate-400`, que ahí da
  6,96. Fijarlo en uno solo no alcanza: `slate-400` sobre el claro da 2,34, también bajo el piso.

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
superposición para el velo — y ése fue el último que quedaba, como cuenta lo que sigue.

### Los canales de la celda, y por qué se acabaron

Esa frase —«el canal disponible es el borde, la opacidad o la superposición»— hablaba de la
**baldosa**, y la baldosa hoy no tiene ninguno libre:

| Canal de la baldosa | Quién lo usa |
|---|---|
| Color de fondo | identidad de pieza — los 12 colores medidos con APCA |
| Blanco | pieza muteada (spec 014) |
| Rosa | jugada inválida |
| Gris `slate-300` | fantasma |
| Grosor de borde (`box-shadow` interior y exterior) | cabeza lectora: nota / cruce / click (specs 010, 011) |
| Opacidad + borde punteado | velo de «no se estrenó» (spec 010) |

Lo que quedaba libre es **la otra caja**. Cada celda son dos: la de `--cell` y la baldosa redondeada
de adentro, con un aire de `2/73` de la celda entre las dos — y la de afuera no pinta nada. Ahí va el **anillo de foco**
del teclado (spec 026), y con eso **se acabaron**: el próximo estado que aparezca no tiene canal que
tomar, va a tener que sacárselo a otro y escribir cuál.

**El anillo son dos propiedades y no una**, y el motivo es la lámina: abajo de la celda enfocada puede
haber el `#FFFF00` de `V` o el `#0000FF` de `W`, así que un solo tono se pierde contra alguno de los
doce. Van dos —claro adentro, oscuro afuera—, y como un `outline` de CSS tiene un único color, el claro
va por `outline` y el oscuro por `box-shadow` con spread.

Lo **prohibido** es `transform: scale`, por la medición que la cabeza lectora ya pagó y que está más
abajo: `scale` cuenta para el overflow scrolleable del contenedor y hace aparecer las dos barras.
`outline` y `box-shadow` son *ink overflow* — pintan afuera de la caja sin agrandarla. Es el mismo
movimiento con el que el 014 eligió la ausencia de color para el muteo: se toma el canal que quedaba
libre, y se escribe que se acabaron.

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

**Por qué engorda para los dos lados.** Todas las celdas ya tienen `border-slate-900`, ocupadas o vacías,
así que engrosar hacia adentro es un cambio de grado contra un campo lleno de bordes negros. El anillo
exterior es lo que agrega el salto de tamaño: la celda se lee más grande sin que crezca su caja.

**Por qué no `transform: scale`, que es lo obvio.** Porque `scale` **agranda la caja** a efectos de
overflow. Medido en el DOM con `CELL_PX` en 63 —grilla de 630 × 378—: con la cabeza en la última celda
y `scale(1.10)`, el `scrollHeight` del entonces `overflow-x-auto` de `Board` pasaba de 378 a 381 y
aparecían las dos barras de desplazamiento. El 014 movió la celda a 71 y el 016 a 73, y esos dos
números no se remidieron; el 031 se llevó además el contenedor que scrolleaba, así que hoy el síntoma
sería una celda recortada por el `overflow-hidden` del raíz en vez de una barra. Lo que no depende de
nada de eso es el mecanismo, que es lo que decide: `box-shadow` es *ink overflow*, pinta afuera de la
caja sin agrandarla.

**El color del resalte es gris pizarra (`#0f172a`) y no un color de pieza.** Es la regla de arriba sin
excepción: el hue dice *qué pieza es*, nunca *qué está pasando*. Misma razón por la que el fantasma es
gris y no verde.

### Los escalones de grosor

El grosor es el único canal, así que las clases de evento se distinguen **por cantidad de borde** y por
nada más. Los valores viven en `src/components/constants/playhead.constants.ts`:

| Qué suena | Hacia adentro | Hacia afuera | Se lee como |
|---|---|---|---|
| **Nota** de una pieza | 3 px | 2 px | la celda tiene su turno |
| **Cruce** con nota, sobre celda ocupada (spec 011) | 2 px | 1 px | un paso que pesa: la cabeza cruza y la celda suena, pero no es su turno |
| **Click** sobre celda vacía | 2 px | — | un roce: la cabeza pasó por acá |

Nota fuerte, cruce intermedio, click tenue: si se vieran igual, el recorrido parecería tener piezas
donde no hay, o confundiría un turno con un roce.

**Los tres escalones se ven aunque el click no se oiga.** Desde el spec 015 el click nace apagado y se
enciende con «Recorrido en el vacío» —que es como se llama esa clase de evento de cara al usuario;
«click» es la palabra del código—. El nombre **no cambió** con el spec 019; cambió dónde se lee: el
interruptor bajó a la fila de transporte como un metrónomo solo-icono, así que la etiqueta vive en su
`aria-label` y su `title` en vez de en un `<span>` al lado. El borde de 2 px se dibuja igual: el recorrido es el mismo
con el sonido apagado, y el interruptor es de mezcla y no del modelo.

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

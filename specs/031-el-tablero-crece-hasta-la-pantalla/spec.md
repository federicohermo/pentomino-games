# Spec 031 — El tablero crece hasta la pantalla

> Sin ticket: este repo no tiene tablero de Jira. Ver `specs/README.md`.
>
> **Cambia el tamaño del tablero, no el de la celda.** `GRID_W` y `GRID_H` dejan de ser constantes y
> pasan a salir del viewport; la celda se queda en los 73 px de siempre.
>
> **Depende de la rama `fix/celda-vuelve-al-tamano-de-antes`** (PR #40), que le puso techo a `CELL_PX`
> y devolvió la celda a 73. Este spec se lleva ese techo: con las dimensiones saliendo del viewport, el
> piso y el techo del 021 dejan de tener trabajo que hacer.
>
> **Toca `domain/`**, que es lo que lo separa del 021: aquel movió layout y no tocó una función pura.

## Problema

Son tres frases y las tres son del mismo pedido:

1. **La celda tiene que medir lo de antes.** El 021 hizo que el tablero llenara la pantalla estirando
   la celda, y a 1920 × 1080 la baldosa quedaba en 180 px con el nombre de la nota a 46,8: el tablero
   dejaba de leerse como un instrumento denso y pasaba a ser una grilla de doce tarjetas grandes.
2. **El tablero tiene que ocupar la pantalla.** Con la celda de vuelta en 73 y la grilla clavada en
   10 × 6, el tablero mide 730 × 438 px y flota en el medio de un viewport de 1920 × 1080: usa el
   **19 %** del área. Es el mismo 15 % que el 021 fue a arreglar, con 4 puntos de diferencia.
3. **Y lo primero de todo: no puede haber scroll.** Hoy `Board.tsx` tiene un `overflow-x-auto` y un
   `max-h-full` que existen exactamente para el caso en que la grilla no entra, y debajo de 730 px de
   viewport ese caso ocurre: el tablero scrollea.

Las tres no pueden ser ciertas con una grilla de tamaño fijo. Con celdas cuadradas de 73 px, 10 × 6
mide 730 × 438 y ningún reparto lo hace cubrir un escritorio; y si lo que crece para cubrirlo es la
celda, se rompe la primera. **Lo único que puede crecer es la cantidad de celdas.**

## Solución Propuesta

**Las dimensiones del tablero salen del viewport, y la celda se queda en 73.**

```
1. cuántas entran al tamaño objetivo     c0 = max(GRID_MIN.w, round(vw / CELL_PX_OBJETIVO))
                                         r0 = max(GRID_MIN.h, round(vh / CELL_PX_OBJETIVO))
2. el tamaño real, cuadrado y sin desborde   cell = min(vw / c0, vh / r0)
3. y cuántas entran a ESE tamaño         cols = max(GRID_MIN.w, floor(vw / cell))
                                         rows = max(GRID_MIN.h, floor(vh / cell))
```

Con `CELL_PX_OBJETIVO = 73` y `GRID_MIN = 5 × 5`.

**El tercer paso parece redundante y no lo es.** Los dos primeros ya dan un tablero que entra, pero el
eje que no manda puede quedar con más de una celda libre cuando la ventana es muy desproporcionada: a
2000 × 300 el mínimo de 5 filas fuerza una celda de 60 px y sobrarían 380 px de ancho, o sea seis
columnas sin usar. Recontar contra la celda real cierra eso: `cols · cell ≤ vw` por definición de
`floor`, y lo que sobra es siempre menos de una celda **en los dos ejes**. En los nueve viewports
reales de la tabla el tercer paso no cambia ningún número — se nota sólo donde hace falta.

Medido sobre los viewports reales:

```
viewport        cols x rows   celdas   celda    sobra x   sobra y   piezas por area   nota
1920 x 1080      26 x  15      390     72,0 px    48,0       0,0           78         18,7 px
1512 x  982      21 x  13      273     72,0 px     0,0      46,0           54         18,7 px
1440 x  900      20 x  12      240     72,0 px     0,0      36,0           48         18,7 px
1366 x  768      19 x  11      209     69,8 px    39,5       0,0           41         18,2 px
1280 x  720      18 x  10      180     71,1 px     0,0       8,9           36         18,5 px
 834 x 1112      11 x  15      165     74,1 px    18,5       0,0           33         19,3 px
 430 x  932       6 x  13       78     71,7 px     0,0       0,3           15         18,7 px
 375 x  667       5 x   9       45     74,1 px     4,4       0,0            9         19,3 px
 320 x  568       5 x   8       40     64,0 px     0,0      56,0            8         16,7 px
```

Las tres columnas de la derecha son las tres cosas que hay que mirar:

- **`celda`** se queda entre **64 y 74,1 px**. El objetivo es 73 y el redondeo lo mueve como mucho un
  12 %, que es el caso del 320 × 568 donde manda el mínimo de 5 columnas; sin contar ése, el desvío
  máximo es del 4,4 %. La última columna es lo que eso le hace al nombre de la nota: entre 16,7 y
  19,3 px contra los 19 medidos con un `Range` (`CELL_PX_MIN`).
- **`sobra`** es lo que queda sin cubrir en el eje que no manda, y en los nueve es **menos de una
  celda** — por construcción: si sobrara una celda entera, entraría una fila o una columna más.
  Eso es lo que hace que «ocupa la pantalla» sea verdad sin mentir: no hay reparto que cubra los dos
  ejes con celdas cuadradas, y lo que queda es un margen de menos de 73 px repartido en dos.
- **`piezas por area`** es el que abre el problema que sigue.

### El tope de piezas se vuelve explícito, y vale 12

Hoy el tablero acepta **12 piezas** y ese número no está escrito en ningún lado: sale de dividir 60
celdas por las 5 de un pentominó. `shortestCircuit` lo dice en su docblock —«el tope de `n` lo fijan
las reglas del juego»— y resuelve el circuito con **Held-Karp exacto**, que es `O(n² · 2ⁿ)`.

Con 390 celdas ese tope pasaría a ser 78, y `2⁷⁸` no es un número que se pueda evaluar. Medido sobre
un tablero de 26 × 14, con la caché de la sección siguiente puesta:

```
piezas   buildSequence
  12        3,1 ms
  13        3,7 ms
  14        5,6 ms
  15        9,7 ms
  16       18,6 ms
```

Duplica por pieza, como corresponde a un `2ⁿ`. Así que el tope se escribe: **`MAX_PIEZAS = 12`**.

No es una regla nueva ni un recorte: es **exactamente lo que hoy es cierto**, dicho donde se pueda
leer. Lo que cambia es de dónde viene — antes lo garantizaba el área y ahora lo garantiza una
constante, porque el área dejó de garantizarlo.

### La caché de distancias, que es lo que hace que el tablero grande entre en presupuesto

`buildSequence` arma una matriz de `n × n` rutas llamando a `routeBetween`, y cada llamada corre un
Dijkstra propio sobre el tablero entero. Con 12 piezas son **144 Dijkstras**, y el algoritmo es
`O(N²)` sobre las `N` celdas: pasar de 60 a 390 celdas lo multiplica por 42.

Pero los destinos son sólo **12**: las entradas de las 12 piezas. Un Dijkstra desde un destino da las
distancias desde **todas** las celdas de una vez, así que las 144 corridas son 12 corridas y 132
reconstrucciones de camino. Medido:

```
tablero        celdas   12 piezas, hoy   12 piezas, con cache
10 x  6           60        2,3 ms            1,9 ms
21 x 12          252        ~                 2,2 ms
26 x 14          364       10,9 ms            3,1 ms
53 x 30 (4K)    1590        ~                30,9 ms
```

Verificado que no cambia una nota: **279 tableros al azar** —deterministas, con `mulberry32` y semilla
fija— comparados secuencia contra secuencia entre la implementación de hoy y la de la caché, **cero
diferencias**.

El 4K queda fuera de presupuesto y **se anota como deuda, no se resuelve acá**: la salida medida es
cambiar la cola del Dijkstra por una de baldes, que a `N = 60` se probó y salió peor (`revisiones.md`
del 011) y a `N = 1590` es donde ese resultado se da vuelta.

### Nada se pierde al achicar la ventana

Achicar la ventana achica la grilla, y las piezas que quedan afuera **no se borran**: se quedan en el
estado, dejan de dibujarse y dejan de sonar, y vuelven enteras cuando hay lugar otra vez. El repo no
tiene deshacer (`deuda.md`), así que una pieza que se pierde arrastrando el borde de la ventana se
pierde para siempre — y arrastrar el borde no es un gesto de edición.

El criterio es **la pieza entera**: una pieza con tres celdas adentro y dos afuera tampoco se dibuja.
Media pieza pintada sería una pieza que el tablero muestra y el circuito no visita.

## Criterios de Aceptación

- **AC1 — No hay scroll.** Ni horizontal ni vertical, ni en el tablero ni en la página, en ninguno de
  los nueve viewports de la tabla ni en ninguna orientación. `Board.tsx` se queda sin `overflow-x-auto`
  y sin el `max-h-full` que lo acompañaba: la grilla entra por construcción.
- **AC2 — Las dimensiones salen del viewport** con la fórmula de arriba, y la tabla de nueve viewports
  se verifica entera en un test del proyecto `node`.
- **AC3 — La celda se queda cerca del objetivo**: entre 64 y 74,1 px en los nueve viewports de la
  tabla. El piso duro es que **no haya scroll**, así que en un viewport donde las 5 columnas mínimas no
  entren a 73 px la celda se achica (320 × 568 → 64 px) en vez de desbordar.
- **AC4 — `domain/` recibe las dimensiones y no las lee de una constante.** Ni un módulo de `domain/`
  importa `GRID_W`/`GRID_H`; `isValid`, `routeBetween` y `buildSequence` toman un `Dims`.
- **AC5 — El tope de 12 piezas se aplica y se anuncia.** La pieza 13 no entra, el tablero no cambia, y
  la región `aria-live` del 025 lo dice.
- **AC6 — `buildSequence` con 12 piezas entra en 5 ms** sobre el tablero de referencia de 1920 × 1080
  (26 × 15 = 390 celdas), que es el techo realista de escritorio. Mismo presupuesto que el AC10 del
  009, sobre un tablero 6,5 veces más grande.
- **AC7 — La caché no cambia una nota.** Test que compara la secuencia con y sin caché sobre tableros
  generados con PRNG determinista.
- **AC8 — Achicar la ventana no borra piezas.** Achicar hasta dejar una pieza afuera y volver a
  agrandar la devuelve idéntica —mismas celdas, mismo muteo, mismo id—.
- **AC9 — El teclado respeta las dimensiones.** `Home`/`End` y las flechas del 026 se mueven dentro de
  `cols × rows` y no de `10 × 6`.
- **AC10 — El árbol de accesibilidad dice el tamaño real**: `aria-rowcount`, `aria-colcount` y el
  `aria-label` del `role="grid"` salen de las dimensiones.
- **AC11 — La costura sigue siendo las dos esquinas**: `(0,0)` y `(cols-1, rows-1)`, derivadas de las
  dimensiones y no escritas a mano.
- **AC12 — El MCP server sigue contestando.** `simulate_board` toma las dimensiones como parámetro
  opcional, con `10 × 6` de default: una consulta escrita antes de este spec sigue dando lo mismo.
- **AC13 — `pnpm verify` en verde**, con el gate de coverage al 100 en las cuatro métricas.

## Límites de Alcance

- **No cambia el modelo musical.** Ni una nota, ni una escala, ni el orden dentro de una pieza. Lo que
  sí cambia es qué recorrido sale de un tablero, porque hay más lugar donde poner las piezas — pero
  eso es el 009 funcionando, no una regla nueva.
- **No toca `audio/`.**
- **No toca los dos flotantes.** El dock de piezas y la franja de señal siguen midiendo en celdas y
  siguen siendo `fixed`. Que el dock mida 146 px y muestre una sola columna de miniaturas es cierto
  desde el PR #40 y **queda anotado en `deuda.md`**, no se arregla acá: es una decisión de diseño del
  dock y no del tablero.
- **No resuelve el 4K.** Está medido (30,9 ms) y anotado como deuda con la salida identificada.
- **No agrega deshacer.** El ítem de `deuda.md` sigue abierto; lo que este spec hace es no darle
  trabajo nuevo.

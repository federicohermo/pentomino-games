# Research — Spec 031

Todo lo de acá está **medido**, con el script y la semilla anotados. Las mediciones de tiempo salen de
`node v22.18.0` sobre `src/domain/` sin instrumentar, mediana de 5 corridas después de una de
calentamiento, en la máquina de desarrollo (Windows 11). No son comparables con las de la CI, por el
motivo que `CLAUDE.md` ya tiene escrito.

## 1. Quién lee hoy `GRID_W` y `GRID_H`

Menos archivos de los que parece. La lista completa de producción:

| Archivo | Qué hace con las dimensiones |
|---|---|
| `domain/constants/board.constants.ts` | las declara, y deriva `SEAM = [[0,0],[GRID_W-1,GRID_H-1]]` |
| `domain/board.ts` | `isValid` (los cuatro límites), `nodeOf`/`cellOf`/`neighborsOf` (el id de celda es `x * GRID_H + y`) y `routeBetween` (`N = GRID_W * GRID_H`) |
| `components/Board.tsx` | la grilla, el `aria-*`, y los topes del movimiento por teclado del 026 |
| `components/cell-px.ts` | la fórmula del tamaño de celda |
| `mcp-server/src/tools/simulateBoard.ts` | el texto del schema y el `max` de piezas |

**`sequence.ts`, `music.ts`, `invariants.ts` y `transform.ts` no las nombran nunca**: llegan al tablero
por `routeBetween` y por `isValid`. Eso es lo que hace que el parámetro `Dims` sea threading y no un
rediseño: se agrega a tres funciones públicas —`isValid`, `routeBetween`, `buildSequence`— y baja sola.

## 2. El techo real no es el tablero: es `2ⁿ`

`shortestCircuit` resuelve el circuito con Held-Karp exacto, `O(n² · 2ⁿ)`, y su docblock se apoya en
que «el tope de `n` lo fijan las reglas del juego: hay 12 pentominós libres y no se repiten».

**La segunda mitad de esa frase no es cierta hoy.** `isValid` chequea límites y solapamiento, y nada
más: colocar cinco `T` es legal, y `App.tsx` le da a cada una un id nuevo. Lo que hoy acota `n` a 12 no
es la regla sino el **área**: 60 celdas ÷ 5 celdas por pieza. Con 390 celdas ese tope pasa a 78.

Medido con `bench.mjs`, piezas en bloques de 5 × 1 (el peor caso razonable: todas separadas), tablero
de 26 × 14 = 364 celdas:

```
piezas   sin cache   con cache
   8       4,6 ms      3,5 ms
   9       5,8 ms      2,0 ms
  10       7,3 ms      2,3 ms
  11       8,9 ms      2,6 ms
  12      10,9 ms      3,1 ms
  13      13,8 ms      3,7 ms
  14      18,2 ms      5,6 ms
  15      23,7 ms      9,7 ms
  16      35,5 ms     18,6 ms
  17      56,0 ms
  18      98,6 ms
  19     185,6 ms
  20     397,1 ms
  21     834,2 ms
  22   1.777,8 ms
```

De 16 en adelante duplica por pieza, que es exactamente lo que dice `2ⁿ`. **No hay optimización que
compre un tablero lleno**: pasar de 12 a 78 piezas son 66 duplicaciones.

Las salidas posibles eran tres y sólo una no cambia lo que suena:

1. **Tope de piezas.** No cambia una nota en ningún tablero que hoy se pueda armar, porque hoy el tope
   es el mismo 12. **Elegida.**
2. **Heurística** (vecino más cercano, 2-opt) por encima de cierto `n`. El 009 ya la midió y la
   descartó: recorridos **+20,1 % en promedio y +79 % en el peor caso**. Además rompería el desempate
   determinista —«dos tableros idénticos podrían sonar distinto»— que `shortestCircuit` documenta.
3. **Tablero grande pero con menos celdas** (celda más grande). Es lo que este spec vino a deshacer.

## 3. La caché de distancias por destino

`buildSequence` arma `rutas[i][j] = routeBetween(salida_i, entrada_j, placed)` — `n²` llamadas, cada
una con su Dijkstra `O(N²)` propio sobre las `N` celdas del tablero. Con 12 piezas son **144
Dijkstras**, y `N` pasa de 60 a 390: `N²` se multiplica por **42**.

Pero los **destinos son `n`, no `n²`**: las entradas de las 12 piezas. El Dijkstra ya corre desde el
destino —está escrito así para poder reconstruir el camino hacia adelante—, y una corrida completa
desde un destino da la distancia desde **todas** las celdas. Las 144 corridas son entonces 12 corridas
y 132 reconstrucciones, que son lineales en el largo del camino.

El precio de la caché: hay que sacar el corte temprano (`if (u === origen) break`), o sea que cada
corrida cerrada cuesta más que una parcial de hoy. Medido, 12 piezas:

```
tablero          celdas   sin cache   con cache
10 x  6             60      2,3 ms      1,9 ms
21 x 12            252         —        2,2 ms
26 x 14            364     10,9 ms      3,1 ms
53 x 30 (4K)     1.590         —       30,9 ms
```

Gana igual en el tablero chico: 12 corridas completas cuestan menos que 144 parciales ya a `N = 60`.

**Verificación de que no cambia una nota:** `compare.mjs` genera tableros con `mulberry32` y semilla
`20260822` —nada de `Math.random`, así que se repite—, hasta 12 piezas con rotación, reflexión y muteo
al azar, y compara `JSON.stringify(buildSequence(...))` entre la implementación de `main` y la de la
caché. **279 tableros comparados (hasta 10 piezas efectivas), 0 diferencias.**

El argumento de por qué tiene que ser así, además del número: `dist[]` es función de `(destino,
placed)` y la caché está keyeada por destino dentro de una sola llamada a `buildSequence`, donde
`placed` no cambia. El corte temprano de hoy no cambia los valores que el camino lee — corta cuando el
origen ya quedó cerrado, o sea cuando todo lo que el camino va a pisar ya tiene su `dist` final.

## 4. El 4K queda afuera, y con número

53 × 30 = 1.590 celdas dan **30,9 ms** con 12 piezas, seis veces el presupuesto del AC10 del 009. El
costo es `n · N²` = 12 × 2,5 M = 30 M de operaciones, y el `N²` viene del Dijkstra con búsqueda lineal
del mínimo.

La salida está identificada y **no se implementa acá**: los pesos son sólo dos (1 y `CROSS_COST = 5`),
así que una cola de baldes lo baja a `O(N · C)`. `revisiones.md` registra que a `N = 60` se probó y
salió **peor** (1,41 ms contra 0,68), y ese resultado es exactamente el que se da vuelta cuando `N`
crece dos órdenes. Va a `deuda.md` con el número al lado.

## 5. Qué pasa hoy cuando el tablero se achica

Nada, porque hoy no se achica. Con dimensiones dinámicas aparece un caso nuevo: una pieza colocada en
`(24, 13)` y una ventana que pasa a tener 19 columnas.

Lo que no se puede hacer es dejarla en la secuencia: `nodeOf` la mapearía fuera del array de `N`
celdas y `routeBetween` leería `dist[]` fuera de rango — sin excepción, con `undefined` propagándose a
un `Int32Array`. O sea que **filtrar es obligatorio**; lo que se elige es qué se hace con la pieza.

- **Borrarla** es lo que el repo no puede permitirse: `deuda.md` tiene abierto «no hay deshacer», y
  arrastrar el borde de una ventana no es un gesto de edición.
- **Recortarla** —dibujar las celdas que quedan adentro— haría que el tablero muestre una pieza que el
  circuito no visita, que es la clase de discrepancia que el 009 (D5) existe para evitar.
- **Guardarla y no dibujarla** cuesta una línea: `placed.filter(cabe)` alimenta el dibujo y la
  secuencia, y `placed` entero se queda en el estado y en `isValid`. Elegida.

`isValid` tiene que seguir mirando `placed` **entero**: una pieza guardada puede tener celdas dentro de
la grilla nueva (es «no cabe entera», no «está toda afuera»), y colocar encima dejaría dos piezas
solapadas cuando la ventana crezca.

## 6. El scroll de hoy

`Board.tsx` tiene tres piezas que existen para el caso «la grilla no entra»:

- `overflow-x-auto` en el contenedor de la grilla,
- `max-h-full`, que es lo que hace que el eje Y desborde a ese contenedor y no al raíz —el comentario
  del propio archivo dice que sin él, en un viewport apaisado y bajo, las filas de abajo quedan
  recortadas y sin forma de llegar—,
- y `w-max` en el `role="grid"`.

Las tres se van juntas: con `cols · cell ≤ vw` y `rows · cell ≤ vh` por construcción, no hay desborde
que absorber. Lo que queda es el `overflow-hidden` del contenedor raíz, que pasa de red a garantía.

## 7. Riesgos

- **El tope de 12 es visible.** Hoy nadie lo choca porque el tablero se llena antes; en 390 celdas se
  choca con el tablero al 15 % de ocupación. Es el cambio de comportamiento más grande del spec y por
  eso tiene AC propio y anuncio en `aria-live`.
- **La musicalidad cambia sin que cambie el modelo.** Doce piezas en 390 celdas dejan tramos mucho más
  largos entre puertas, y el circuito se llena de clicks. Es el 009 funcionando sobre otro tablero,
  pero se va a **oír** distinto — vale escucharlo antes de mergear (tarea `[M]`).
- **Los tests que asumen 10 × 6.** `board.test.ts` y `Board.browser.test.tsx` los nombran. El resto del
  dominio se testea con tableros armados a mano, así que pasan a recibir `Dims` explícito.
- **El MCP server importa 31 símbolos del dominio**, y tres de las funciones que cambian de firma están
  entre ellos. No falla en silencio: `pnpm verify` typechequea cruzando el borde de paquete.

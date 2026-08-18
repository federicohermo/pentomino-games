# Research — Pisar una pieza cuesta

Todo lo de acá está **medido corriendo el dominio real**, no estimado. Los scripts se corrieron con
`node` cargando `src/domain/` sin compilar, que es lo mismo que hace el MCP server.

## 1. El caso que originó el spec, reproducido

Salió de mirar la cabeza lectora del 010, no de leer código. Reproducido con las funciones reales:

```
P rot 90, ancla (3,2)  → celdas (3,3) (4,3) (3,2) (4,2) (3,1)   notas E4 G4 A4 B4 D5
Y rot 90, ancla (7,2)  → celdas (7,4) (7,3) (7,2) (7,1) (8,2)   notas A#4 C#5 D#5 F5 G#5

gates P = { entrada (4,2), salida (3,1) }
gates Y = { entrada (8,2), salida (7,1) }

P→Y : d = 6, camino [4,1] [5,1] [6,1] [7,1] [8,1]   ← (7,1) es G#5, celda de la Y
Y→P : d = 4, camino [6,1] [5,1] [4,1]               ← libre
ciclo = 18 intervalos
```

Dos cosas que el caso muestra y conviene no perder:

- **No existe camino mínimo libre.** Con distancia 6 hay que bajar de la fila 1 a la 2 en la columna 7
  o en la 8, y `(7,1)` y `(7,2)` están ocupadas las dos. Cualquier camino libre tiene que subir a la
  fila 0 y rodear: mide **8**. O sea que esquivar no es desempatar entre caminos igual de cortos —
  cuesta, y por eso mueve la matriz de costos.
- **El tramo de vuelta reusa las mismas celdas.** `Y→P` cruza `[6,1] [5,1] [4,1]`, que el tramo de ida
  ya había cruzado. No es un bug, pero es la razón por la que el ciclo se escucha más repetitivo de lo
  que el tablero sugiere.

## 2. Cuántos clicks caen sobre una pieza, hoy

Sobre los prefijos del teselado de 12 piezas que ya usan los tests del 009:

| piezas | clicks | sobre celda ocupada | % |
|---|---|---|---|
| 2 | 3 | 3 | **100 %** |
| 3 | 6 | 6 | **100 %** |
| 4 | 8 | 3 | 38 % |
| 5 | 6 | 4 | 67 % |
| 6 | 13 | 10 | 77 % |
| 7 | 14 | 10 | 71 % |
| 8 | 14 | 13 | 93 % |
| 9 | 15 | 15 | **100 %** |
| 10 | 15 | 13 | 87 % |
| 11 | 14 | 14 | **100 %** |
| 12 | 14 | 14 | **100 %** |

El teselado es el peor caso por construcción —las 60 celdas ocupadas— pero los prefijos chicos no lo
son, y ahí también da 100 % con 2 y 3 piezas. La lectura correcta no es "el tablero lleno rompe el
click" sino **"el click casi nunca cae donde su definición dice"**.

## 3. Lo que cuesta esquivar

BFS sobre las 60 celdas, adyacencia de 4 vecinos más la arista de la costura. Bloqueadas todas las
celdas ocupadas salvo las dos puntas del tramo, que son puertas y por definición están sobre una pieza.

**Sobre 400 tableros aleatorios válidos por cada tamaño** (piezas sin repetir, colocación validada con
`isValid`, semilla fija):

| piezas | pares | sin camino libre | % | rodeo medio | rodeo máx |
|---|---|---|---|---|---|
| 2 | 800 | 74 | 9 % | +1,73 | +13 |
| 3 | 2.400 | 358 | 15 % | +2,33 | +17 |
| 4 | 4.800 | 1.319 | 27 % | +2,53 | +20 |
| 5 | 8.000 | 4.005 | 50 % | +2,17 | +18 |
| 6 | 11.880 | 7.758 | 65 % | +1,58 | +17 |
| 8 | 4.424 | 3.882 | 88 % | +0,44 | +9 |

Dos conclusiones, y ninguna es la que el spec suponía antes de medir:

- **El caso "no se puede esquivar" no es un borde.** Ya con 4 piezas es más de uno de cada cuatro
  tramos. El camino degradado (D4) es tan principal como el otro.
- **El rodeo puede ser enorme.** El máximo medido es **+20 intervalos**, que a 110 bpm son 2,7 s de
  recorrido para saltar entre dos piezas. De ahí salía el tope de la primera versión del spec — que §8 vuelve innecesario, porque un peso ya es un tope expresado como preferencia continua.

## 4. Por qué a veces es imposible, y no es congestión

La causa principal es estructural y se encuentra mirando las 96 orientaciones: **la celda central de la
`X` está rodeada por sus propios cuatro brazos, y es siempre una de sus dos puertas.**

```
puertas rodeadas por celdas de su propia pieza, sobre las 96 orientaciones:
X : entrada + salida
```

(Aparecen las dos porque la reflexión intercambia cuál es cuál: sin reflexión el centro es la entrada
—grado 0, el que cae sobre el centroide, spec 007— y con reflexión pasa a ser la salida. Es siempre la
misma celda.)

Consecuencia: **con una `X` en el tablero, el tramo que entra o sale de ella cruza celdas ocupadas
siempre**, con el tablero vacío o lleno. Ninguna otra de las 12 piezas tiene esa propiedad. Sola
alcanza para que D4 no sea opcional.

## 5. Una variante que se midió y se descarta

Se probó permitir cruzar las celdas de la pieza de **origen** y la de **destino**, y esquivar solo a un
tercero. Es mucho más viable:

| piezas | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 12 |
|---|---|---|---|---|---|---|---|---|
| pares sin camino (teselado) | 0 | 0 | 2 | 4 | 6 | 8 | 20 | 84 |
| rodeo medio | 0 | +0,33 | +0,20 | +0,50 | +0,58 | +0,62 | +0,28 | +0,29 |

**Y no sirve, porque no arregla el caso testigo:** `(7,1)` es celda de la `Y`, que es la pieza de
**destino**. Justo el caso que se ve mal es el que esta variante permite. Queda registrado para que no
se vuelva a proponer como atajo.

## 6. Lo que cuesta en tiempo

| | |
|---|---|
| Matriz 12×12 con BFS (media de 20 corridas) | **0,31 ms** |
| Held-Karp sobre esa matriz, ya medido por el 009 | 0,62 ms |
| Tope que afirma el test de AC10 del 009 | 5 ms |

El costo del recorrido **se duplica y sigue siendo despreciable**. El argumento del 009 —`n` está
acotado por las reglas del juego, hay 12 pentominós libres y no se repiten— vale igual acá: 144 BFS
sobre un grafo de 60 nodos es aritmética de juguete.

## 7. Elegir mejor entre los caminos MÍNIMOS, sin pagar nada

Antes de aceptar que esquivar cueste, se midió la opción gratis: quedarse en la distancia de hoy y,
entre los caminos de esa misma longitud, preferir uno que no pise nada. Sobre 400 tableros aleatorios
por tamaño:

| piezas | tramos | hoy pisan | existe un mínimo libre | pisadas que se evitan **sin costo** |
|---|---|---|---|---|
| 2 | 800 | 565 (71 %) | 50 % | 30 % |
| 3 | 2.400 | 1.874 (78 %) | 41 % | 24 % |
| 4 | 4.800 | 3.904 (81 %) | 34 % | 19 % |
| 5 | 8.000 | 6.788 (85 %) | 26 % | 13 % |
| 6 | 11.880 | 10.447 (88 %) | 22 % | 11 % |

**No alcanza.** Evita entre el 11 % y el 30 % de las pisadas. Vale como propiedad deseable —si hay un
camino libre de la misma longitud, tomarlo es gratis— pero no como solución, y el peso de §9 ya la
incluye: con `P > 1`, entre dos caminos de igual largo gana el que pisa menos.

## 8. La curva de P, que es la medición que define el spec

Peso 1 en la celda vacía, `P` en la ocupada, camino de costo mínimo. Media sobre 250 tableros aleatorios
válidos por tamaño, semilla fija.

| P | cruces por ciclo (3 piezas) | (5 piezas) | ciclo vs hoy |
|---|---|---|---|
| **1** — es exactamente lo de hoy | 4,39 | 10,12 | — |
| **2** | 1,92 | 5,42 | **+2 %** |
| 3 | 1,63 | 4,51 | +7 % |
| 5 | 1,08 | 3,58 | +16 % |
| **∞** — prohibir pisar | 0,39 | 2,80 | **+40 %** |

Lo que la curva dice, y que la primera versión de este spec no vio por haber medido solo sus dos
extremos: **la mayor parte del beneficio está al principio y es casi gratis**. P = 2 se lleva más de la
mitad de las pisadas por un 2 % de ciclo; el último tramo hasta prohibir cuesta un 40 % de ciclo para
llevarse el resto.

Prohibir además obliga a inventar dos cosas —un tope al rodeo, porque el máximo medido es de +20
intervalos (2,7 s a 110 bpm), y un tratamiento propio para el caso "no existe camino libre"—. **Las dos
desaparecen con un peso**, que es una preferencia continua en vez de un corte.

## 9. Lo que cambia en la música, con cualquier P > 1

Circuito óptimo con la matriz nueva contra la vieja, sobre 300 tableros aleatorios por tamaño:

| piezas | tableros | el orden de visita cambia | ciclo hoy | ciclo esquivando | crecimiento |
|---|---|---|---|---|---|
| 3 | 300 | **30 %** | 25,6 | 30,0 | +17 % |
| 4 | 300 | **44 %** | 32,0 | 37,1 | +16 % |
| 5 | 300 | **48 %** | 38,0 | 40,9 | +8 % |

(Medido con prohibición y con recaída al camino directo cuando no hay libre, o sea el escenario más
agresivo; con `P = 2` el crecimiento del ciclo baja al 2 %.)

**El orden de visita cambia en casi la mitad de los tableros.** No es efecto secundario: la distancia
alimenta la matriz de costos de Held-Karp, así que cambiarla cambia el circuito. Es coherente con el 009
—la geometría decide el orden y los obstáculos son geometría— pero es un cambio de audio y va declarado.

## 10. Qué hay que tocar

| Qué | Dónde | Por qué |
|---|---|---|
| `bestRoute` pasa a BFS con obstáculos y devuelve **camino y largo juntos** | `domain/board.ts` | D3: con obstáculos ya no hay fórmula que obligue a coincidir a dos funciones separadas |
| `cellDistance` y `pathBetween` pasan a recibir el tablero | `domain/board.ts` | Hoy son funciones de dos celdas; la distancia deja de depender solo de ellas |
| La matriz de costos pasa el tablero | `domain/sequence.ts` | `buildSequence` ya lo tiene: es su parámetro |
| El cruce puede llevar nota | `domain/types/sequence.types.ts` | D6. Hoy `Click` es `{ offset, cell }` |
| La proyección lleva la nota al motor | `src/App.tsx` + `audio/types/scheduler.types.ts` | El motor ya recibe MIDI en `Step.notes`; lo que sigue prohibido es que vea `Cell` |
| `tick()` cablea el cruce con altura a `scheduleVoice` en vez de `scheduleClick` | `audio/engine.ts` | — |
| La tabla por offset marca el cruce con nota | `components/route-source.ts` | Para que la cabeza lo dibuje distinto de un click mudo |
| `simulate_board` reporta el camino y si cruza ocupadas | `mcp-server/` | Es lo que permite verificar el recorrido sin oírlo, y hoy ya reporta el camino |

## 11. Deuda adyacente detectada (fuera de alcance)

- **Los tramos de ida y vuelta se pisan** (§1). Con obstáculos va a pasar menos, pero no desaparece.
  Si molesta al escucharlo, es una preferencia en el desempate de caminos, no un cambio de modelo.
- **`pathBetween` elige "primero en X, después en Y"** entre 35 caminos mínimos típicos. Con BFS la
  elección pasa a depender del orden de exploración, así que hay que fijarla explícitamente o el
  determinismo de AC5 se apoya en un detalle de implementación.

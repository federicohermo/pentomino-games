# Research — Spec 012

Todo lo de acá está **medido corriendo el dominio**, no derivado a mano. Los scripts corren
`src/domain/` con node crudo (que es lo que el `erasableSyntaxOnly` del tsconfig permite) y la versión
nueva se midió sobre una copia del dominio con `degreeByCellIndex` parchada, contra la misma semilla.

## 1. El estado actual: 13 saltos sobre 48 pasos

`degreeByCellIndex` ordena las celdas por su ángulo alrededor del centroide. Cada pieza da 4 pasos
—de la nota 0 a la 1, y así—, o sea 48 pasos en total. Un paso es **continuo** si la celda de destino es
vecina ortogonal de la de origen (distancia Manhattan 1).

| pieza | orden hoy (celdas por grado) | distancias | saltos |
|---|---|---|---|
| F | (2,2) (1,2) (0,1) (1,0) (1,1) | 1 2 2 1 | 2 |
| I | (2,0) (3,0) (4,0) (0,0) (1,0) | 1 1 4 1 | 1 |
| L | (0,3) (0,2) (0,1) (0,0) (1,0) | 1 1 1 1 | 0 |
| N | (3,1) (2,1) (1,1) (0,0) (1,0) | 1 1 2 1 | 1 |
| P | (1,1) (0,1) (0,0) (1,0) (2,0) | 1 1 1 1 | 0 |
| T | (1,1) (1,2) (0,0) (1,0) (2,0) | 1 3 1 1 | 1 |
| U | (2,1) (0,1) (0,0) (1,0) (2,0) | 2 1 1 1 | 1 |
| V | (0,2) (0,1) (0,0) (1,0) (2,0) | 1 1 1 1 | 0 |
| W | (2,1) (2,2) (1,1) (0,0) (1,0) | 1 2 2 1 | 2 |
| X | (1,1) (2,1) (1,2) (0,1) (1,0) | 1 2 2 2 | 3 |
| Y | (2,1) (0,0) (1,0) (2,0) (3,0) | 3 1 1 1 | 1 |
| Z | (1,1) (0,1) (1,0) (2,0) (3,0) | 1 2 1 1 | 1 |

**13 saltos sobre 48 pasos, y solo 3 piezas limpias.** El peor caso no es un salto raro: la `I` —cinco
celdas en línea, la pieza más simple del juego— salta **4 celdas** entre su tercera y su cuarta nota,
porque el anillo angular la hace arrancar por el centro y volver.

## 2. El techo: cuatro piezas no pueden ser continuas, y se sabe por qué

Enumerando las **120 permutaciones** de cada forma y quedándose con las de máxima cantidad de pasos
continuos:

| pieza | grados de los nodos | aristas | ¿árbol? | saltos mínimos |
|---|---|---|---|---|
| F | 1 1 3 2 1 | 4 | sí | **1** |
| I | 1 2 2 2 1 | 4 | sí | 0 |
| L | 2 2 2 1 1 | 4 | sí | 0 |
| N | 1 2 2 2 1 | 4 | sí | 0 |
| P | 2 2 3 2 1 | **5** | no | 0 |
| T | 1 3 1 2 1 | 4 | sí | **1** |
| U | 2 1 2 2 1 | 4 | sí | 0 |
| V | 2 2 1 2 1 | 4 | sí | 0 |
| W | 1 2 2 2 1 | 4 | sí | 0 |
| X | 1 1 4 1 1 | 4 | sí | **2** |
| Y | 1 2 3 1 1 | 4 | sí | **1** |
| Z | 1 2 2 2 1 | 4 | sí | 0 |

El grafo de una pieza son sus 5 celdas con una arista por cada par vecino. Con 4 aristas y conexo es un
**árbol**, y un árbol admite recorrido completo **si y solo si es un camino** — o sea, si ningún nodo
tiene 3 o más vecinos. Las cuatro que fallan son exactamente las que tienen uno: `F`, `T` e `Y` con un
nodo de grado 3, y `X` con el de grado 4. La `P` también tiene un nodo de grado 3 pero **no es árbol**
(su cuadrado de 2×2 le da un ciclo, 5 aristas), y por eso sí se camina entera.

**No es una limitación del algoritmo: es la forma.** Por eso AC4 verifica el mínimo contra la fuerza
bruta en vez de afirmarlo.

## 3. La referencia del pedido, traducida a forma canónica

El pedido vino con dos capturas del tablero: cómo se colocan hoy y cómo deberían verse. Cuatro piezas
—`N` (verde claro), `U` (verde oscuro), `P` (naranja) e `Y` (rosa)—, leídas celda por celda y
des-transformadas a `SHAPES` buscando la orientación que las reproduce:

| pieza | orientación | hoy (índices canónicos por grado) | referencia |
|---|---|---|---|
| N | rot 1 | 4 3 2 0 1 | **4 3 2 1 0** |
| U | rot 1 | 4 1 0 2 3 | **4 3 2 0 1** |
| P | rot 3, reflejada | 3 1 0 2 4 | **3 1 0 2 4** (igual) |
| Y | rot 3 | 4 0 1 2 3 | **4 3 2 1 0** |

La columna «hoy» reproduce exactamente lo que devuelve `degreeByCellIndex` sobre la forma canónica, lo
que confirma que la lectura de la captura es correcta y no una interpretación.

Dos cosas que la referencia dice y que no eran obvias:

1. **La `P` no cambia.** Ya se recorre entera; el pedido no la tocó. Cualquier criterio que la moviera
   estaría de más.
2. **La `Y` cambia aunque hoy ya tiene 3 pasos continuos de 4.** Las dos versiones tienen los mismos 3;
   lo que cambia es **dónde** cae el salto. Eso es lo que fija D2 del spec, y es la única evidencia
   disponible sobre ese criterio.

## 4. El embudo: qué criterio decide qué

Sobre las 120 permutaciones de cada pieza, cuántas sobreviven a cada criterio aplicado en orden. Medido
con el criterio final —«se tocan» para decidir, Manhattan para medir, ver §11—:

| pieza | 120 | pasos que se tocan | mín. suma Manhattan | los largos al principio | ángulo |
|---|---|---|---|---|---|
| F | 120 | 20 | 6 | 2 | **1** |
| I | 120 | 2 | 2 | 2 | **1** |
| L | 120 | 4 | 2 | 2 | **1** |
| N | 120 | 8 | 2 | 2 | **1** |
| P | 120 | 36 | 4 | 4 | **1** |
| T | 120 | 4 | 4 | 2 | **1** |
| U | 120 | 8 | 2 | 2 | **1** |
| V | 120 | 2 | 2 | 2 | **1** |
| W | 120 | 20 | 2 | 2 | **1** |
| X | 120 | 48 | 32 | 8 | **1** |
| Y | 120 | 8 | 6 | 2 | **1** |
| Z | 120 | 8 | 2 | 2 | **1** |

Lo que dice la tabla:

- **El primer criterio no alcanza en ninguna pieza.** Con la diagonal aceptada, entre 2 y 48 recorridos
  por pieza se tocan de punta a punta — hay que elegir entre ellos, y ahí es donde importa que la
  métrica que mide sea Manhattan y no la misma que decide.
- **La suma de Manhattan es la que hace el trabajo grueso**: es lo que prefiere el paso recto sobre el
  diagonal, y lo que baja `X` de 48 candidatos a 32 y `P` de 36 a 4.
- **El criterio del paso largo al principio se ejerce en 4** (`F`, `T`, `Y`, `X`) — las mismas cuatro
  que usan diagonal, que es exactamente donde tiene sentido.
- **El ángulo se ejerce en las 12**, porque un camino y su inverso son igual de buenos y hay que elegir
  la dirección. En las 8 piezas de recorrido ortogonal puro es *lo único* que queda por decidir.

Se probaron cuatro desempates contra las cuatro piezas de la referencia (§3). Aciertos:

| desempate | N | U | P | Y | total |
|---|---|---|---|---|---|
| solo ángulo | ✔ | ✔ | ✔ | ✘ | 3/4 |
| índice de `SHAPES` | ✘ | ✘ | ✘ | ✘ | 0/4 |
| arranque angular primero, después saltos | ✔ | ✔ | ✔ | ✔ | 4/4 |
| **saltos al principio, después ángulo** | ✔ | ✔ | ✔ | ✔ | **4/4** |

Los dos últimos empatan contra la referencia y difieren entre sí en `F` y `T`. Gana el último por una
propiedad que el otro no tiene: con él **las 12 piezas quedan con distancias no crecientes** —el arpegio
salta al entrar y después camina— mientras que con el otro la `F` salta en el segundo paso. Es AC3.

## 5. El resultado, y que el camino sobrevive a las 96 orientaciones

| pieza | orden nuevo (celdas por grado) | distancias | saltos (antes → después) |
|---|---|---|---|
| F | (0,1) (1,0) (1,1) (1,2) (2,2) | 2 1 1 1 | 2 → 1 |
| I | (4,0) (3,0) (2,0) (1,0) (0,0) | 1 1 1 1 | 1 → **0** |
| L | (0,3) (0,2) (0,1) (0,0) (1,0) | 1 1 1 1 | 0 → 0 *(sin cambio)* |
| N | (3,1) (2,1) (1,1) (1,0) (0,0) | 1 1 1 1 | 1 → **0** |
| P | (1,1) (0,1) (0,0) (1,0) (2,0) | 1 1 1 1 | 0 → 0 *(sin cambio)* |
| T | (1,2) (1,1) (0,0) (1,0) (2,0) | 1 2 1 1 | 1 → 1 |
| U | (2,1) (2,0) (1,0) (0,0) (0,1) | 1 1 1 1 | 1 → **0** |
| V | (0,2) (0,1) (0,0) (1,0) (2,0) | 1 1 1 1 | 0 → 0 *(sin cambio)* |
| W | (2,2) (2,1) (1,1) (1,0) (0,0) | 1 1 1 1 | 2 → **0** |
| X | (2,1) (1,2) (0,1) (1,1) (1,0) | 2 2 1 1 | 3 → 2 |
| Y | (2,1) (3,0) (2,0) (1,0) (0,0) | 2 1 1 1 | 1 → 1 |
| Z | (0,1) (1,1) (1,0) (2,0) (3,0) | 1 1 1 1 | 1 → **0** |

**Los 4 pasos que pasaban por encima de una celda se van, y quedan 5 pasos en diagonal.** Cambian **10 de
las 12** (`L`, `P` y `V` ya estaban bien; la `T` cambió dos veces, ver §11). Las distancias son no
crecientes en 11 de las 12 — la `T` es la excepción, y por qué está en §11.

Y la propiedad que hace que el mapeo pueda seguir viajando por índice (D4): se recorrieron las **96
orientaciones** —12 piezas × 4 rotaciones × 2 reflexiones— comprobando que la secuencia de distancias
del camino canónico se conserva al transformar la forma. **0 de 96 la rompen.** Rotar, reflejar y
trasladar son isometrías de la grilla: preservan la distancia Manhattan y por lo tanto la adyacencia.

## 6. Costo

| | por llamada | 12 llamadas (un render con el tablero lleno) |
|---|---|---|
| orden angular (hoy) | 0,57 µs | 0,007 ms |
| camino (nuevo) | 4,00 µs | 0,048 ms |

7× más caro y **tres órdenes de magnitud por debajo de un frame** (16,7 ms). `Board.tsx` ya cachea por
`(pieza, rotación)` dentro del render, así que el techo real son 12 llamadas por movimiento de cursor.

El algoritmo es Held-Karp de camino abierto: `g[j][mask]` = costo mínimo de arrancar en `j` y visitar
`mask`. Con `n = 5` son `5 × 32 = 160` estados. Después, un recorrido por las ramas que alcanzan el
óptimo aplica los criterios no aditivos (D2 y D1). La implementación candidata se contrastó contra
fuerza bruta sobre **412 casos** —las 12 piezas más 400 formas aleatorias de 4 a 7 celdas, incluidas
formas desconexas— con **0 diferencias**.

## 7. Qué se toca

### Dominio

| Archivo | Qué |
|---|---|
| `src/domain/transform.ts` | **Nuevo** `pathThroughCells(cells, tiebreak)` (D5). `centroid` y `angleFromCentroid` se quedan: los sigue usando el desempate |
| `src/domain/music.ts` | `degreeByCellIndex` reescrita: arma el rango angular (lo que hoy hace entera) y lo pasa como desempate del camino. Misma firma, mismo contrato (AC7) |

`DEGREE_EPSILON` sigue en uso: el rango angular sigue sacando del anillo a la celda parada sobre el
centroide, porque `atan2(0,0)` sigue devolviendo `0` en silencio. Lo que cambia es que esa celda **ya no
se lleva el grado 0 por eso** (D3), solo queda primera en el orden de desempate.

### Tests que afirman el modelo viejo (AC9)

| Test | Qué afirma | Qué le pasa |
|---|---|---|
| `music.test.ts` `AC2 — en I y X la celda parada sobre el centroide se lleva el grado 0` | D1 del 007 | **Superado por D3.** Se reemplaza por el test de AC1/AC3 de este spec |
| `music.test.ts` `AC4 — el desempate a igual angulo` (2 tests) | el orden angular como orden final | Se migran: el desempate angular sigue existiendo pero ya no fija estos grados. Lo que queda verificado es la **dirección** del camino |
| `music.test.ts` `AC5 — la referencia congelada` (3 tests) | las 60 notas de la lámina y `TONICA_EN` | **Se recongela** contra la tabla de §5 (D7, AC8) |
| `music.test.ts` `recalcular el grado sobre la forma ya transformada NO es equivalente: difiere en 75 de las 96` | una propiedad del anillo angular | Se remide: con el camino el número cambia, y lo que hay que verificar es que el mapeo se arrastre por índice, no cuánto difiere el recálculo |
| `sequence.test.ts:166` — `degreeByCellIndex(SHAPES.F)` es `[2,3,4,1,0]` | el mapeo viejo de la `F` | Valor nuevo |
| `sequence.test.ts:347` — `degreeByCellIndex(SHAPES.L)` es `[3,2,1,0,4]` | el mapeo de la `L` | **No cambia** (`L` es una de las tres que ya estaban bien) |
| `mcp-server/src/__tests__/render.test.ts:71,86` | el grado de las celdas de la `X` al renderizar | Valores nuevos |

Los tests de `sequence.test.ts` que verifican **puertas** y **orden del circuito** con tableros armados a
mano cambian de valor esperado, no de intención: hay que recorrerlos uno por uno cuando el nodo de
verificación se ponga rojo, que es el mecanismo por el que se encuentran.

### Documentación (AC13)

| Archivo | Qué dice hoy |
|---|---|
| `docs/architecture/modelo-musical.md` | «`degreeByCellIndex` — orden angular», la sección «forma → qué celda tiene qué nota» entera, y la nota de Reproducción que llama al orden «el orden angular alrededor del centroide» |
| `CLAUDE.md` | la fila «forma → nota por celda» de la tabla de documentación |
| `.claude/rules/domain.md` | menciona el anillo angular |
| `DESIGN.md` | qué muestra una celda — **no cambia**: sigue mostrando nota y grado, con otros valores |

### Lo que NO se toca

`audio/` entero, `components/` salvo por lo que cambia de valor, `board.ts`, `routeBetween`, el circuito,
`BASE_MAP`, `notesForRotation`, `arpeggioFor`, `ANCHOR_INDEX` y las firmas del MCP server.

## 8. El impacto sobre lo que suena

200 tableros aleatorios de 3 a 5 piezas, semilla fija, comparando el modelo viejo contra el nuevo con el
mismo `buildSequence`:

| | |
|---|---|
| piezas que cambian alguna de sus dos puertas | **601 / 811 — 74,1 %** |
| tableros con al menos una puerta distinta | **200 / 200 — 100 %** |
| tableros donde cambia el **orden de visita** de las piezas | **112 / 200 — 56,0 %** |
| tableros donde cambia el largo del ciclo | 177 / 200 — 88,5 % |
| largo medio del ciclo | 35,13 → 34,14 intervalos (**−2,8 %**) |

El ciclo se **acorta**, que es la dirección esperable: las puertas de una pieza recorrida en camino
quedan en las dos puntas de ese camino, y eso suele dejarlas más lejos una de otra pero mejor orientadas
respecto de las piezas vecinas. No es un objetivo del spec ni algo que haya que defender — es el número
que salió, y sirve para descartar que el cambio alargue el ciclo.

## 9. Lo que apareció implementando: la `X` deja de tener una puerta rodeada

No estaba previsto al escribir el spec y cambia tres tests del 011, así que queda medido acá.

El 011 eligió la `X` como **caso estructural** del cruce con este argumento, escrito en tres archivos:
su celda central está rodeada por sus propios cuatro brazos y es **siempre** una de sus dos puertas, así
que entrar a ella cruza una celda ocupada por mucho que suba `CROSS_COST`. La segunda mitad de esa frase
era consecuencia de D1 del 007 —el grado 0 iba a la celda del centroide— y **el 012 la revierte**: la
`X` entra por el brazo derecho y sale por el de arriba.

Medido sobre su tablero testigo, `X`(4,2) + `F`(3,4) + `I`(5,0):

| | con el mapeo del 007 | con el camino del 012 |
|---|---|---|
| clicks del ciclo | 11 | 10 |
| de esos, cruces con altura | **2** | **0** |

Los tres tests que se apoyaban en él —`domain/__tests__/sequence.test.ts`,
`components/__tests__/route-source.test.ts` y `mcp-server/src/__tests__/tools.test.ts`— habrían quedado
verdes sin ejercer nada, que es exactamente contra lo que sus guardas existían.

**El cruce no desaparece**: sobre 300 tableros aleatorios de 3 piezas con `CROSS_COST = 5`, el **32,3 %**
tiene al menos un cruce y el promedio es de **0,38 cruces por ciclo**. Lo que desaparece es el caso donde
cruzar es *inevitable por la forma*, y con él la garantía de que un test escrito sobre la `X` no se pueda
vaciar. El reemplazo —`X`(1,1) + `F`(3,2) + `N`(2,4), tres cruces sobre la `X` incluido su centro— cruza
porque **rodear sale más caro**, que es lo que D1 del 011 dice que el modelo es, y su guarda cuenta los
cruces exactos: si alguien mueve `CROSS_COST`, falla en rojo.

## 10. Los tres tableros de empate que hubo que volver a buscar

Misma clase de hallazgo: un tablero elegido para que **dos circuitos empaten** depende del modelo, y las
puertas cambiaron. Los tres se buscaron de nuevo por fuerza bruta:

| Test | Tablero viejo | Qué le pasó | Tablero nuevo |
|---|---|---|---|
| `ante dos circuitos de igual costo gana el de indices menores` | `F`(2,2) `I`(2,0) `L`(0,2), empataban a 24 y 11 pasos | dejó de empatar: 13 contra 20 | `F`(3,3) `Z` rot 90 (6,4) `Y` rot 180 (4,1) — los dos a 19 y 14 pasos |
| `el ORDEN DE COLOCACION no cambia lo que suena` | `N V Z U F`, dos óptimos a 27 con 28 y 24 pasos | óptimo único (17) | `N X U I P`, dos óptimos a 32 con 21 y 25 pasos |
| `con salto 1 no hay clicks` | `F`(1,1) + `P` rot 90 (3,1), 1 paso en los dos sentidos | 1 en un sentido y 6 en el otro | `L`(1,1) + `N` rot 90 (3,2) |

El patrón vale para cualquier spec que mueva las puertas: **los tests que se apoyan en un empate son los
que primero dejan de ejercer lo suyo, y lo hacen en verde.**

## 11. La diagonal: qué cuesta tolerarla adentro de la pieza

Medido después de la primera implementación, revisando la premisa. Un paso puede ser de tres clases, y
la diferencia importa porque **se ve**: la cabeza lectora del 010 recorre celda por celda.

| clase | qué se ve | mapeo del 007 | ortogonal estricto | con la diagonal tolerada |
|---|---|---|---|---|
| **recto** — comparten un lado | la cabeza avanza | 35 / 48 | 43 / 48 | 43 / 48 |
| **diagonal** — comparten una esquina | la cabeza avanza en diagonal | 9 | 4 | **5** |
| **por encima** — ni se tocan | la cabeza **saltea** una celda propia que no sonó | **4** (`I`, `T`, `U`, `Y`) | **1** (`T`) | **0** |

El caso que trajo el pedido —la `U` cuya segunda nota caía dos celdas más abajo— es exactamente uno de
esos cuatro.

**Tolerar la diagonal cambia una sola pieza: la `T`.** `F`, `Y` y `X` ya la usaban con el criterio
ortogonal estricto, porque su paso «no vecino» ya era una diagonal — lo único que cambia es cómo se lo
llama. Las cuatro piezas de la referencia del pedido (`N`, `U`, `P`, `Y`) quedan **idénticas**:

| pieza | ortogonal estricto | con la diagonal tolerada |
|---|---|---|
| `T` | (0,0) (2,0) (1,0) (1,1) (1,2) — **pasa por encima de (1,0)** | (1,2) (1,1) (0,0) (1,0) (2,0) — diagonal en el medio |
| las otras 11 | — | sin cambio |

Lo que se pierde: la propiedad de que las distancias sean **no crecientes** en las 12. La `T` queda con
`1 2 1 1`, porque el paso diagonal es el que une su tallo con su barra y ahí está. El criterio que
producía esa propiedad **se queda igual**: es lo único que separa las dos versiones de la `Y` (§3), y con
la diagonal aceptada las dos son continuas, así que sin él la `Y` dejaría de coincidir con la referencia.

Y lo que **no** cambia: `routeBetween`, o sea el recorrido **entre** piezas, que se sigue moviendo solo
en cruz. La asimetría es deliberada y está en D10: adentro de la pieza la alternativa a la diagonal es
pasar por encima de una celda; afuera no existe ese problema, porque el recorrido pisa —y suena— todas
las celdas por las que pasa.

## 12. La alternativa descartada: que la punta de entrada la elija el tablero

Hoy la punta por la que el recorrido entra a una pieza la decide la **forma** (el orden angular
desempata entre el camino y su inverso). La alternativa es que la decida el **tablero**: entrar por la
punta más cercana a la pieza anterior del circuito.

Medido sobre 150 tableros aleatorios de 3 a 5 piezas, probando las 2ⁿ orientaciones de cada tablero:

| | |
|---|---|
| tableros donde el ciclo se podría acortar | **119 / 150 — 79,3 %** |
| ciclo medio | 34,14 → 30,59 intervalos (**−10,4 %**) |

Es casi cuatro veces lo que el 012 mueve en ese eje por su cuenta (−2,8 %), y **se descarta igual**
(D11). El motivo es del instrumento: si el tablero decidiera, mover una pieza cambiaría el arpegio de
sus vecinas y el instrumento dejaría de ser predecible. Queda registrado acá con su número para que la
próxima vez que aparezca la idea no haya que volver a medirla.

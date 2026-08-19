# Spec 012 — El arpegio camina la pieza

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **Revisa el mapeo del [007](../007-nota-por-celda-y-lenguaje-visual/spec.md)**: cambia
> `degreeByCellIndex`, y con ella qué nota muestra cada celda en 9 de las 12 piezas.
> **Y mueve las puertas del [009](../009-el-tablero-como-recorrido/spec.md) /
> [010](../010-cabeza-lectora-por-celda/spec.md)**, porque entrada y salida se leen del orden de
> reproducción: el circuito cambia en el 56 % de los tableros.

## Problema

El arpegio de una pieza **salta por adentro de su propia forma**. El orden de las cinco notas lo da el
recorrido angular alrededor del centroide (spec 007), y ese anillo no sabe nada de adyacencia: la nota
siguiente puede caer en una celda que no toca a la anterior.

Medido sobre las 12 piezas —48 pasos en total, 4 por pieza—: **13 pasos aterrizan en una celda que no es
vecina** de la anterior, y **solo 3 piezas de 12** (`L`, `P`, `V`) recorren su forma sin cortarse. De esos
13, nueve van a una celda que al menos **se toca** con la anterior por una esquina; los otros **cuatro
pasan por encima** de una celda de la propia pieza que todavía no sonó — y están en `I`, `T`, `U` e `Y`.

El caso que originó el spec, la `U` colocada en `(7,3)`:

```
celdas  (8,3) (7,3) (7,4) (7,5) (8,5)      la U abierta hacia la derecha

hoy     #0 (8,3) → #1 (8,5) → #2 (7,5) → #3 (7,4) → #4 (7,3)
                    ^^^^^^^ dos celdas más abajo, cruzando el hueco de la U

deberia #0 (8,3) → #1 (7,3) → #2 (7,4) → #3 (7,5) → #4 (8,5)
```

Y ahora **se ve**, que es lo que lo hizo aparecer: desde el spec 010 la cabeza lectora marca celda por
celda qué está sonando, así que el salto dejó de ser una abstracción del modelo y pasó a ser un brinco
en pantalla. Entre piezas el recorrido camina —`routeBetween` traza celda a celda y suena cada paso—;
**adentro de la pieza se teletransporta**. El tablero es un recorrido continuo en todas partes menos
donde hay una pieza, que es justo adonde el recorrido va a buscar algo.

## Solución Propuesta

**El arpegio deja de ser un anillo y pasa a ser un camino.** El orden de las notas dentro de una pieza
es el recorrido que visita sus cinco celdas **sin pasar nunca por encima de otra**, y el grado `g` va a
la celda que el camino visita en el paso `g`.

El paso preferido es **arriba, abajo, izquierda o derecha**. Cuatro piezas no admiten un recorrido así
—`F`, `T`, `Y` y `X`, y es una propiedad de su forma, no una falla del algoritmo (§2 del
`research.md`)—: en ellas se **tolera** un paso en diagonal, que al menos llega a una celda que se toca
con la anterior por la esquina. Con eso las 12 se recorren enteras. La diagonal se tolera y no se
prefiere, y solo **adentro** de la pieza: el recorrido entre piezas sigue moviéndose en cruz (D10).

El resultado, medido sobre las 12 piezas:

| | hoy | con el camino |
|---|---|---|
| pasos **por encima** de una celda que no sonó | **4 / 48** | **0 / 48** |
| pasos ortogonales | 35 / 48 | **43 / 48** |
| pasos en diagonal | 9 | 5 (`F`, `T`, `Y` con 1; `X` con 2) |
| piezas que se recorren enteras | **3 / 12** con pasos rectos | **12 / 12** sin pasar por encima |

Los 5 pasos en diagonal que quedan son **el mínimo que la geometría permite**, verificado por fuerza
bruta sobre las 120 permutaciones de cada pieza (`research.md` §2).

### Decisiones de diseño

**D1 — El ángulo no muere: baja a desempate.**
El anillo angular del 007 deja de decidir el orden y pasa a decidir **por qué punta se entra al camino**.
No es cortesía con el spec anterior: con 5 celdas el camino óptimo casi siempre viene en pareja —él y su
inverso—, así que hace falta un criterio que elija la dirección, y el que ya existe está medido y es
determinista. El embudo completo, medido pieza por pieza, está en `research.md` §4: el camino decide, el
ángulo desempata, y el desempate se ejerce en las 12.

**D2 — Cuando hay que saltar, se salta al principio.**
Entre dos órdenes igual de continuos gana el que pone los saltos primero. La evidencia es la referencia
que trajo el pedido: en la `Y` —que no admite camino completo— las dos opciones tienen 3 pasos vecinos y
la misma distancia total, y la elegida a mano es la que salta en el primer paso y después camina los
tres restantes:

```
Y en (8,4)   elegida:  #0 (8,4) ⇢ #1 (9,5) → #2 (9,4) → #3 (9,3) → #4 (9,2)     distancias 2 1 1 1
             la otra:  #0 (8,4) → #1 (9,4) → #2 (9,5) ⇢ #3 (9,3) → #4 (9,2)     distancias 1 1 2 1
```

Con la diagonal aceptada (D10) este criterio **ya no separa «continuo» de «cortado»** —todos los pasos
llegan a una celda que se toca— pero **se queda**, y no por inercia: es lo único que separa las dos
versiones de la `Y`, y la referencia del pedido eligió a mano la que pone el paso diagonal primero. Lo
que se pierde es la propiedad de que las distancias sean no crecientes en las 12: la `T` pasa a tener su
paso diagonal en el medio, porque es donde su forma lo pone (`research.md` §11).

**D3 — El grado 0 deja de ser el centro geométrico y pasa a ser la puerta de entrada.**
Esto **revierte D1 del spec 007** —«la celda parada sobre el centroide sale del anillo y se lleva la
tónica»—, que solo alcanzaba a `I` y `X`. En la `I` es directamente incompatible con el pedido: arrancar
por el centro de una línea de cinco obliga a un salto que la forma no necesita, porque desde una punta
la `I` se camina entera. El grado 0 sigue siendo la raíz, pero de otra cosa: es **la celda por donde el
recorrido entra a la pieza** (`gates`, spec 010), que es la lectura que el instrumento le da de hecho
desde que el tablero es un circuito.

**D4 — Se sigue calculando sobre la forma canónica y viajando por índice.**
El invariante del 007 (su D3) **sobrevive, y queda mejor fundado que antes**: rotar y reflejar son `map`
y además **preservan la adyacencia**, así que un camino en la forma canónica sigue siendo un camino en
las 8 orientaciones. Verificado sobre las 96: **0 rompen** (`research.md` §5). Con el anillo angular esto
no era cierto en el mismo sentido —rotar corre el origen del ángulo, y recalcular daba otra permutación
en 75 de las 96—; con el camino, recalcular sobre la forma girada daría un camino igual de válido. Se
sigue calculando sobre la canónica igual, porque el desempate angular sí depende de la orientación y
porque es el invariante que sostiene `ANCHOR_INDEX` y medio dominio.

**D5 — El camino es geometría, así que vive en `transform.ts`; el grado es música y se queda en `music.ts`.**
`pathThroughCells(cells, tiebreak)` va a `domain/transform.ts` —el módulo de la geometría de las piezas—
y recibe el criterio de desempate **como parámetro**, así no necesita saber qué es un ángulo ni un
grado. `music.ts` sigue siendo quien arma el rango angular y convierte el camino en grados. La dirección
de dependencia no se mueve: `transform.ts ← music.ts`, que es lo que el linter ya verifica.

**D6 — El algoritmo es el mismo Held-Karp que ordena las piezas, un nivel más abajo.**
El circuito del 009 resuelve «visitar `n` piezas volviendo al principio»; esto resuelve «visitar `n`
celdas sin volver». Mismo `O(n² · 2ⁿ)`, con `n = 5` en vez de 12: **160 estados**. El costo de un paso
empaqueta los dos primeros criterios en un entero —`(vecina ? 0 : BASE) + distancia`, con `BASE` mayor
que cualquier suma posible—, exactamente como `claveDeTramo` empaqueta costo y pasos, y por el mismo
motivo: la programación dinámica suma claves y compara sumas.

Los criterios que **no** son aditivos —los saltos al principio (D2) y el desempate angular (D1)— se
resuelven después, recorriendo solo las ramas que alcanzan el óptimo. Medido: **0,57 µs → 4,00 µs** por
llamada. `Board.tsx` la llama a lo sumo 12 veces por render, con el caché por `(pieza, rotación)` que ya
existe: **0,05 ms por render**, contra los 16,7 ms de un frame.

**D7 — La lámina del 007 deja de ser la referencia de qué nota va en qué celda.**
El test `AC5 — la referencia congelada` de `music.test.ts` tiene las 60 notas transcritas a mano de la
lámina del spec 007, y **9 de las 12 piezas dejan de reproducirla**. Lo que la lámina sigue fijando es
qué **cinco notas** tiene cada pieza —eso lo decide `notesForRotation`, que este spec no toca—; lo que
cambia es **cuál de sus celdas muestra cuál**. El test no se borra: se vuelve a congelar contra la tabla
medida de este spec, y su docblock pasa a decir de dónde sale ahora. Sigue atrapando lo mismo —que nadie
mueva el mapeo sin querer— y deja de afirmar una correspondencia que ya no existe.

**D8 — El circuito cambia, y está bien.**
Entrada y salida de cada pieza se leen del orden de reproducción (D8 del 010), así que mover el orden
mueve las puertas. Medido sobre 200 tableros aleatorios de 3 a 5 piezas: **el 74 % de las piezas cambia
alguna de sus dos puertas**, **el 56 % de los tableros cambia el orden de visita** y el ciclo se acorta
**un 2,8 %** en promedio. No es daño colateral —el 009 dice que la geometría decide el orden, y esto es
geometría— pero **cambia lo que suena en casi todos los tableros**, así que va en su propio commit y lo
declara el PR.

**D9 — La `X` pierde su puerta rodeada, y eso le saca el caso estructural al 011.**
Anotado **durante la implementación**, no previsto al escribir el spec. El 011 se apoyaba en una
propiedad de la `X`: su celda central estaba rodeada por sus cuatro brazos y era **siempre** una de sus
dos puertas —porque el 007 le daba el grado 0 a la celda del centroide—, así que todo tramo que entrara
a la `X` cruzaba una celda ocupada *por mucho que subiera `CROSS_COST`*. Sobre eso eligió su caso
testigo y sus tres tests del cruce.

Con el camino, la `X` entra por un brazo y sale por el opuesto, y **esa propiedad desaparece**: su
tablero testigo —`X`(4,2) + `F`(3,4) + `I`(5,0)— pasa a tener **cero cruces**, y los tres tests que se
apoyaban en él se habrían quedado verdes sin ejercer nada. No es una regresión del 011 —el cruce sigue
existiendo, medido en el **32 % de los tableros de 3 piezas**— sino que vuelve a ser lo que su propio D1
dice que es: **un costo, no una imposibilidad**.

Los tres tests se mudan a un tablero donde cruzar sigue siendo lo más barato, y **los tres al mismo**, a
propósito: si algún día deja de cruzar, fallan juntos en vez de quedar uno verde afirmando lo contrario.

**D10 — La diagonal se tolera adentro de la pieza, no afuera, y con fecha de revisión.**
Decidido después de medirlo, y anotado tal cual se dijo: *«no, pero por ahora vamos a tomarlo como que
sí dentro de las piezas»*. O sea que la diagonal **no** es un movimiento del instrumento —`routeBetween`
sigue moviéndose solo en cruz y este spec no lo toca— pero adentro de la pieza se acepta, porque la
alternativa medida es peor: cuatro piezas pasarían **por encima** de una celda propia que todavía no
sonó, para volver a ella dos pasos después.

Cuesta **una sola pieza**: la `T`. Las otras tres que usan diagonal —`F`, `Y`, `X`— ya la usaban con el
criterio ortogonal estricto, porque su paso «no vecino» ya era una diagonal; lo único que cambia es cómo
se lo llama. Las cuatro piezas de la referencia del pedido quedan **idénticas** (`research.md` §11).

La implementación lo dice con dos métricas y no con una: **se decide con «se tocan»** (lado o esquina) y
**se mide con Manhattan** (la diagonal vale 2, el doble que un paso recto). Por eso la diagonal se
tolera sin preferirse — donde la forma da para ir en cruz, se va en cruz.

**D11 — Lo que pasa adentro de una pieza lo decide la forma, y nada más.**
Incluida la punta por donde el recorrido entra. Se evaluó la alternativa —que la entrada la eligiera el
**tablero**, entrando por la punta más cercana a la pieza anterior— y está **medida**: acortaría el ciclo
en el **79 % de los tableros**, un **10,4 % en promedio** (`research.md` §12). Se descarta igual, y el
motivo es del instrumento y no del código: **una pieza tiene que sonar igual esté donde esté**. Si el
tablero decidiera, mover una pieza cambiaría el arpegio de sus vecinas, y el instrumento dejaría de ser
predecible.

Queda escrito como regla y no como decisión de este spec, porque es con lo que hay que contrastar la
próxima idea que empiece con «y si el tablero también decidiera…»: **el circuito decide el orden entre
piezas y el silencio; la forma decide todo lo que pasa adentro de una.**

## Criterios de Aceptación

- **AC1** — El caso testigo, con test: la `U` recorre sus cinco celdas sin saltar, y en la colocación
  del problema el orden es `(8,3) (7,3) (7,4) (7,5) (8,5)`.
- **AC2** — **El camino es óptimo**, contrastado contra una fuerza bruta sobre las 120 permutaciones
  **escrita en el propio test** —no contra la implementación—, sobre las 12 piezas y sobre formas
  arbitrarias con semilla fija. Óptimo quiere decir, en este orden: máximo de pasos a celda vecina,
  mínima suma de distancias, saltos lo más al principio posible, y desempate por el orden angular.
- **AC3** — **Las 12 piezas se recorren enteras**: ningún paso pasa por encima de una celda de la propia
  pieza. Con test sobre las 12.
- **AC4** — **La diagonal se tolera pero no se prefiere**: solo la usan las 4 piezas que no admiten
  recorrido ortogonal (`F`, `T`, `Y` con 1 paso; `X` con 2), y ese es **el mínimo que su forma permite**,
  verificado contra la fuerza bruta de AC2 y no afirmado. Más un test de que el criterio del paso largo
  al principio sigue decidiendo donde nació: la `Y`.
- **AC5** — **El mapeo sigue viajando por índice** sobre las 96 orientaciones (D4), y además el camino
  **sigue siendo un camino** en las 8 orientaciones de las 12 piezas: 0 rompen.
- **AC6** — **Determinismo declarado**: mismo `cells`, mismo resultado, sin depender del orden en que el
  motor de JS recorrió un bucle. El desempate va escrito (D1/D2) y con test que lo ejerza donde el
  empate existe de verdad —la `Y` y la `X`—, no en una pieza donde el camino ya es único.
- **AC7** — `degreeByCellIndex` **no cambia de firma ni de contrato**: sigue devolviendo el grado POR
  ÍNDICE de celda y sigue siendo una permutación de `0..n-1`. Sus consumidores —`Board.tsx`,
  `sequence.ts` (×2), `describePiece`, `render.ts` del MCP y los tests— no se tocan salvo por lo que
  cambia de valor.
- **AC8** — **La referencia congelada se recongela** (D7): las 60 notas escritas a mano contra la tabla
  medida de este spec, `TONICA_EN` actualizado, y el docblock diciendo que la fuente es el spec 012 y no
  la lámina del 007.
- **AC9** — **No-regresión sobre los tests que afirman el modelo viejo**, que están nombrados uno por
  uno en `research.md` §7. Ninguno queda rojo ni borrado en silencio: cada uno se migra o se declara
  superado con su motivo escrito.
- **AC10** — El cambio de audio va en **su propio commit y declarado** (D8).
- **AC11** — `pnpm verify` en verde, y `check_invariants` **en proceso fresco** antes y después.
- **AC12** — **A ojo con la cabeza lectora del 010** `[M]`: la cabeza recorre cada pieza celda por celda
  sin brincos, y donde brinca es una de las cuatro que no pueden evitarlo. Es la verificación que este
  spec no habría podido hacer antes de existir el 010 — y es la que lo hizo aparecer.
- **AC14** — **Los testigos del cruce del spec 011 siguen ejerciendo el cruce** (D9). El tablero de la
  `X` deja de cruzar, así que los tres tests que lo usaban —`sequence.test.ts`, `route-source.test.ts` y
  `tools.test.ts` del MCP— se mudan al mismo tablero nuevo, con una guarda que cuenta los cruces exactos
  para que mover `CROSS_COST` los ponga en rojo en vez de vaciarlos. Y lo mismo con los **tres tableros
  que ejercen empates** del circuito: un empate depende del modelo, y heredarlo deja el test verde sin
  ejercer nada.
- **AC13** — La documentación que describe el modelo viejo queda al día:
  `docs/architecture/modelo-musical.md` (la tabla de derivaciones y la sección «forma → qué celda tiene
  qué nota»), `CLAUDE.md` (la fila del modelo musical) y `.claude/rules/domain.md`.

## Fuera de Alcance

- **Qué cinco notas tiene una pieza.** `BASE_MAP` y `notesForRotation` no se tocan: la pieza suena las
  mismas cinco alturas, repartidas distinto entre sus celdas.
- **El retrógrado.** La reflexión sigue invirtiendo el orden en el tiempo sin mover qué nota le toca a
  qué celda. Invertir un camino da un camino, así que la propiedad se conserva sola — con la vuelta de
  que en una pieza reflejada los saltos de D2 quedan al final.
- **El recorrido entre piezas.** `routeBetween` y el circuito no se tocan; cambian de resultado porque
  cambian las puertas.
- **El costo de pisar una pieza.** Es el spec 011, **ya mergeado** —`CROSS_COST = 5` está en el código;
  su fila del log todavía dice `Propuesto` porque mover el estado es del autor—. Son ortogonales: el 011
  cambia la matriz de costos, este cambia las puertas que la alimentan, y todas las mediciones de acá se
  hicieron sobre el código **con** el 011 puesto. Lo que este spec sí toca del 011 son sus casos testigo,
  por D9.
- **Los colores y el layout de la celda.** El tablero ya muestra nota y grado por celda; muestra otros.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Cambia lo que suena en casi todo tablero**: 9 de 12 piezas cambian su mapeo y el 56 % de los tableros cambia el orden de visita. | Commit propio y declarado (AC10). Es lo que el pedido pide, y el ciclo además se acorta un 2,8 %. |
| La lámina de referencia del 007 deja de valer, y con ella el argumento de por qué el desempate era por índice. | D7 y AC8: el test se recongela contra la tabla medida acá, con su docblock diciendo de dónde sale. El desempate angular sobrevive como criterio de dirección, no como reproductor de la lámina. |
| `I` y `X` pierden «el centro se lleva la tónica», que el 007 eligió a conciencia. | D3: el grado 0 pasa a ser la puerta de entrada, que es la lectura que el 009/010 ya le daban. En la `I` la regla vieja es incompatible con el pedido. |
| El algoritmo es exponencial en la cantidad de celdas. | Con `n = 5` son 160 estados y 4 µs. El docblock declara el dominio —una pieza— con el mismo argumento que `shortestCircuit` ya usa: `n` está acotado por las reglas del juego. |
| La `X` deja de tener una puerta rodeada y tres tests del 011 se quedan sin ejercer el cruce (D9). | Los tres se mudan al mismo tablero, con guardas que cuentan cruces exactos (AC14). El cruce sigue ocurriendo en el 32 % de los tableros de 3 piezas. |
| Cuatro piezas usan un paso en diagonal y alguien lo lee como un bug. | AC4 lo verifica contra fuerza bruta, y `research.md` §2 explica por qué es la forma y no el algoritmo: son las cuatro piezas cuyo grafo de celdas es un árbol con un nodo de grado ≥ 3. |
| La diagonal adentro y la cruz afuera es una asimetría, y las asimetrías sin motivo escrito se vuelven deuda. | D10 la deja escrita con su «por ahora» y con lo que cuesta cada lado. El motivo es concreto: adentro de la pieza la alternativa es pasar por encima de una celda; afuera no existe ese problema, porque el recorrido pisa todas las celdas por las que pasa. |

# Spec 011 — Pisar una pieza cuesta

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **Revisa el modelo del [009](../009-el-tablero-como-recorrido/spec.md)**: cambia `cellDistance`, y con
> ella la matriz de costos y el circuito. **Depende del [010](../010-cabeza-lectora-por-celda/spec.md)**
> para poder verificarse: el problema es invisible sin cabeza lectora.

## Problema

El recorrido del 009 va de la salida de una pieza a la entrada de la siguiente por el camino más corto,
y **`pathBetween` ignora lo que haya en el medio**. Está escrito como consecuencia conocida en
`.claude/rules/audio.md` —«un click puede caer sobre una pieza»— y se dio por aceptable porque el click
es un golpe sin altura. Medido, no es una excepción: es **la regla**. Sobre tableros aleatorios válidos,
entre el **71 % y el 88 %** de los tramos pisan al menos una celda ocupada, y en los prefijos del
teselado los clicks caen sobre pieza entre el 38 % y el 100 %.

Lo que eso significa musicalmente: **el click dejó de decir lo que dice**. Su razón de ser (D4 del 009)
es que un salto largo sin sonido es un silencio mudo; los clicks son las **celdas vacías** que se
cruzan. Cuando casi todos caen encima de una pieza, lo que se escucha son golpes sordos sobre celdas
que tienen una nota escrita y no la tocan.

Y ahora **se ve**, que es lo que hizo que apareciera. El caso que originó este spec:

```
P rot 90 en (3,2) → celdas (3,3) (4,3) (3,2) (4,2) (3,1),  puertas: entrada (4,2), salida (3,1)
Y rot 90 en (7,2) → celdas (7,4) (7,3) (7,2) (7,1) (8,2),  puertas: entrada (8,2), salida (7,1)

salto P→Y: d = 6, camino [4,1] [5,1] [6,1] [7,1] [8,1]
                                        ^^^^^ es G#5, celda de la Y
```

El recorrido entra a la `Y` **por el costado**, pisando una de sus notas sin tocarla, en vez de llegar
por su puerta. No se podía diagnosticar antes del 010: con un click de por medio, el error es un golpe
más entre catorce.

## Solución Propuesta

**Pisar una celda ocupada deja de ser gratis y pasa a costar.** La distancia entre dos puertas es el
camino de menor costo sobre las 60 celdas, con peso 1 en la celda vacía y **peso P en la ocupada**.

El peso lo pagan las celdas **intermedias** del camino —las que hoy son clicks—, **no sus dos puntas**.
Las dos puertas están sobre una pieza por definición, así que cobrarlas sumaría un `2·(P−1)` idéntico a
las 144 entradas de la matriz: no movería ningún `argmin` —todo circuito hamiltoniano tiene `n` aristas—
pero rompería la simetría que `board.test.ts` verifica hoy sobre los 3.600 pares, porque el camino de
ida y el de vuelta no tienen las mismas puntas. Con el peso sobre las intermedias, `crossed` es
exactamente el subconjunto ocupado de `path` y `d(a,b) === d(b,a)` sigue valiendo.

Y **cuando el recorrido igual pisa una celda ocupada, suena su nota como floritura**: la misma altura
que la celda muestra desde el spec 007, más corta y más suave que una nota de pieza.

### Decisiones de diseño

**D1 — Es un costo, no una prohibición, y el número que lo justifica es la curva entera.**

La primera versión de este spec decía «esquivá siempre; si no podés, cruzá», más un tope al rodeo para
que un desvío enorme no se leyera como un cuelgue. Al medirla, **esa es la peor esquina de la curva**:

| P | cruces por ciclo (3 piezas) | (5 piezas) | ciclo vs hoy |
|---|---|---|---|
| **1** — hoy | 4,39 | 10,12 | — |
| **2** | 1,92 | 5,42 | **+2 %** |
| 3 | 1,63 | 4,51 | +7 % |
| 5 | 1,08 | 3,58 | +16 % |
| **∞** — prohibir | 0,39 | 2,80 | **+40 %** |

**Con P = 2 se van más de la mitad de las pisadas por un 2 % de ciclo.** Prohibir se lleva el 91 % pero
alarga el ciclo un 40 %, y encima necesita el tope inventado.

El peso además **hace desaparecer tres cosas** que la versión anterior tenía que resolver a mano: el
caso "no existe camino libre" (ya no existe: siempre hay un camino, más caro), el tope al rodeo (P ya
es el tope, expresado como preferencia continua en vez de un corte), y el trato especial de la `X`.

`P = 2` es el punto de partida; **el valor final sale de escuchar**. Cambiarlo es cambiar un número.

**D2 — La distancia se calcula, no se deriva de una fórmula.**
Con pesos ya no hay forma cerrada. El grafo son 60 nodos, adyacencia de 4 vecinos más la arista de la
costura (`(0,0)`–`(9,5)`, D2 del 009). Medido: la matriz completa de 12×12 cuesta **0,31 ms** contra los
**1,87 ms** que Held-Karp ya paga en el mismo tablero —el número del 009, que está en su `research.md`
§5 y repetido en el docblock de `shortestCircuit`—. **El recorrido pasa a costar un 17 % más y sigue
siendo despreciable** — el argumento del 009 («`n` está acotado por las reglas del juego») vale igual.

**D3 — Un camino, su costo y sus cruces salen de la MISMA llamada.**
Es la lección de D8 del 009 —la cantidad de clicks se lee del largo del camino, no se calcula— elevada
al cuadrado: sin fórmula cerrada, dos funciones separadas no tienen nada que las obligue a coincidir.

**D4 — Un solo P para toda celda ocupada.**
Se consideró cobrar menos por la pieza de origen y destino que por un tercero. Se descarta: la `X` —cuya
celda central está rodeada por sus propios brazos y es siempre una de sus dos puertas— ya queda resuelta
con un solo peso, salir de su centro cuesta 2 y listo. Dos pesos agregan un segundo número que ajustar
de oído y una regla que explicar, para el único caso que el primero ya cubre.

**D5 — El cruce suena la nota de la celda, como floritura.**
Misma altura que la celda muestra, **más corta y más suave** que una nota de pieza. Sonarla plena
tendría un costo que este spec no quiere pagar: con P = 2 son entre 2 y 5 cruces por ciclo, y si suenan
igual que una nota de pieza el tablero toca notas fuera del turno de su pieza — que es justo la
legibilidad que el 010 acaba de construir. La floritura conserva la información (**se oye qué celda se
pisó**) sin disputarle el turno a nadie.

No cuesta **función nueva** en `voice.ts`: `scheduleVoice` ya recibe `dur` y `vel`, así que la floritura
es la misma llamada con dos valores distintos.

Pero **`dur` no tiene default, y eso es deliberado**: su docblock dice por qué —«un default sería un
número fijo en segundos que miente sobre el bpm vigente»—. `vel` sí lo tiene. Y el mismo argumento cae
sobre la constante de duración de la floritura: **va en INTERVALOS, no en segundos.** La excepción de
`CLICK_SECONDS` está justificada por escrito en que el click **no tiene altura** y su identidad
perceptual es la brevedad absoluta; el cruce sí tiene altura, así que la excepción no lo alcanza y el
precedente correcto es `NOTE_INTERVALS`. Quien multiplica por `intervalDuration(bpm)` es `engine.ts`,
que es donde vive el bpm.

**D6 — El cruce con altura es MODELO, no mezcla.**
`setClicksAudible(false)` sigue apagando solo los clicks mudos sobre celda vacía. El cruce con altura no
se apaga: es una nota del recorrido, no un adorno de mezcla.

Vale registrar de dónde viene ese botón: existe porque `pathBetween` cruza piezas y esos golpes
molestan, o sea que **es el parche del problema que este spec arregla**. Si con P = 2 y floritura el
recorrido deja de molestar, el botón se queda sin razón de ser — pero eso se decide escuchando, y
borrarlo va en su propio commit. Queda en Seguimiento.

**D7 — El desempate del camino es explícito, no un efecto del `for`.**
Hoy el camino es único porque es "primero en X, después en Y". Con pesos hay empates —entre las dos
celdas más lejanas hay 792 caminos mínimos— y sin desempate declarado gana el que salga del orden en que
se recorren los vecinos. Entre caminos de igual costo gana el **lexicográficamente menor**, exactamente
como el 009 hizo con el circuito y por su mismo argumento: sin él, dos tableros idénticos podrían sonar
distinto según cómo el motor de JS recorrió el bucle.

**D8 — La cabeza distingue los tres casos.**
Nota de pieza, cruce con floritura y click mudo son tres cosas distintas y se ven distinto: tres
escalones de grosor de borde, sin agregar color. Es D7 del 010 —si dos cosas distintas se ven igual, el
tablero miente sobre el modelo— y acá importa más, porque la diferencia entre «esta pieza está tocando»
y «la cabeza pasó por encima» es justo lo que el 010 hizo legible.

**D9 — El orden de visita de las piezas cambia, y está bien.**
Medido: en el **30 % a 48 %** de los tableros el circuito óptimo con la matriz nueva no es el mismo que
con la vieja — **con `P = ∞`, que es el escenario más agresivo** (`research.md` §9). Con `P = 2` el
crecimiento del ciclo baja del 8-17 % al 2 %, y el porcentaje de reordenamientos con ese valor **no se
midió**: 30-48 % es la cota de arriba, no el número de `P = 2`. No es daño colateral: el 009 dice que la geometría decide el orden, y los obstáculos son
geometría. Pero **cambia lo que suena**, así que va en su propio commit y lo declara el PR.

## Criterios de Aceptación

- **AC1** — El caso testigo, con test: con la `P` rot 90 en `(3,2)` y la `Y` rot 90 en `(7,2)`, el tramo
  `P→Y` **no pisa `(7,1)`**.
- **AC2** — El camino devuelto es de **costo mínimo**, contrastado contra un Dijkstra de referencia
  escrito en el propio test —no contra la implementación—, sobre los prefijos del teselado y sobre
  tableros aleatorios con semilla fija. El corolario, que es el que se lee: si existe un camino libre
  con **menos de `P − 1` pasos extra por celda ocupada evitada**, el devuelto no pisa ninguna. El
  coeficiente es `P − 1` y no `P`, porque pisar una celda no cuesta `P` pasos: cuesta `P` **en vez de**
  1. Con `P = 2` es un paso extra por celda evitada, y la versión anterior de este AC decía dos —o sea
  que habría dado en rojo sobre una implementación correcta. **Y la desigualdad es estricta, no `≤`**:
  con exactamente `P − 1` pasos extra por celda evitada los dos caminos EMPATAN en costo, y ahí no
  decide este AC sino el desempate lexicográfico de AC5, que puede devolver el que pisa. Escrito con
  `≤` el corolario daría en rojo sobre una implementación correcta — el mismo error que la versión
  anterior, un escalón más abajo.
- **AC3** — Cada celda ocupada que el recorrido igual pisa **suena su nota**, la misma que el tablero
  muestra, con la duración y el volumen de floritura. Con test sobre la `X`, que es el caso estructural.
- **AC4** — Camino, costo y cruces salen de la misma llamada (D3), y el invariante
  `camino.length === pasos - 1` del 009 sigue valiendo.
- **AC5** — **Determinismo declarado** (D7): mismo tablero, misma secuencia, y entre caminos de igual
  costo gana el lexicográficamente menor. **El orden va escrito, no sobreentendido**: se comparan las
  secuencias de celdas intermedias posición por posición, y cada celda como el par `(x, y)` —primero
  `x`, después `y`—; el primer par que difiere decide. Con test que lo ejerza sobre un tablero donde el
  empate exista de verdad, no solo que lo afirme.
- **AC6** — Held-Karp sigue dando el óptimo exacto sobre la matriz nueva, verificado por fuerza bruta
  hasta 7 piezas igual que hoy.
- **AC7** — **El cambio de audio va en su propio commit y declarado** (D9).
- **AC8** — Rendimiento: la matriz de 12×12 no supera los **4 ms**, y `buildSequence` con 12 piezas
  sigue bajo los 5 ms que ya afirma el test del 009. **El tope era 2 y se movió midiendo, no por
  conveniencia**, y es el único número del spec que cambió al implementarlo: los 0,31 ms del
  `research.md` §6 se midieron sobre un BFS de referencia que **no materializa el camino ni desempata
  lexicográficamente** (D7), o sea la mitad de lo que `routeBetween` hace, así que ese 6x de holgura
  nunca existió. Lo real es 1,31 ms aislado y **2,10-2,35 ms bajo `pnpm verify`**, que corre
  lint ‖ typecheck ‖ test ‖ mcp:test en paralelo: con el tope en 2, el test fallaba 2 de cada 3
  corridas del nodo de convergencia del repo y pasaba 3 de 3 aislado. Un test que se cae dos de cada
  tres veces no mide rendimiento, mide carga de la máquina. El techo que de verdad protege esta
  operación es el test de al lado —`buildSequence` con 12 piezas bajo 5 ms, que incluye esta matriz
  **más** el Held-Karp de 1,87 ms del 009—, y una matriz cerca de 4 ms lo revienta antes que a este.
- **AC9** — `pnpm verify` en verde, y `check_invariants` **en proceso fresco** antes y después.
- **AC10** — **A ojo con la cabeza lectora del 010**: el recorrido rodea las piezas cuando le conviene, y
  donde no, la celda que pisa se enciende con su escalón propio y suena su nota. Es la verificación que
  este spec no habría podido hacer antes de existir el 010.
- **AC11** — A oído: **`P = 2` se confirma o se cambia escuchando**. El AC no es "P vale 2", es "el valor
  quedó elegido con el tablero andando y el número quedó escrito con su motivo".
- **AC12** — **No-regresión sobre los consumidores de `cellDistance` y `pathBetween`**, que son código
  compartido y hoy tienen 13 tests que este spec no nombraba. Ninguno queda rojo ni borrado en
  silencio: cada uno se migra a `routeBetween` o se declara superado con su motivo escrito.
  - `domain/__tests__/board.test.ts:186-308` — los `describe` de `cellDistance` y `pathBetween`. Cinco
    afirman propiedades que el modelo nuevo **cambia**: "coincide con Manhattan", la simetría y la
    desigualdad triangular sobre los 3.600 pares (ahora solo valen con el tablero vacío) y "traza
    primero en X y después en Y" (ahora lo decide el desempate de AC5).
  - `domain/__tests__/sequence.test.ts:66`, `:150-151`, `:439-440`, más el `import` de `:3`.
  - `mcp-server/src/__tests__/tools.test.ts:8`, `:298-299` — **cruza el borde de paquete**: contrasta cada
    hop de `simulate_board` contra `cellDistance`/`pathBetween`. Si desaparecen, o se reescribe contra
    `routeBetween` o `pnpm verify` no compila. Es la arista que el `CLAUDE.md` avisa que existe.
  - `ROUTE` (`domain/constants/route.constants.ts`) y `RouteKind` (`domain/types/sequence.types.ts`)
    quedan **sin ningún consumidor** cuando muere `bestRoute`. Borrarlos va en su propio commit.
- **AC13** — El motor distingue **tres** clases de evento, y no dos con un campo opcional. `HIT`
  (`audio/constants/scheduler.constants.ts`, hoy `{ note, click }` y con un docblock que dice "las dos
  clases") suma una tercera clave, y el union `Hit` una tercera rama que lleva su `hz`. **No** se
  agrega `hz?: number` a la rama del click: el docblock de `Hit` rechaza esa forma por escrito —"el
  campo opcional dejaría pasar en silencio un click con altura"— y `setClicksAudible` necesita
  justamente poder distinguir el mudo del que tiene altura (D6).
- **AC14** — **Quien CONSTRUYE la tercera clase de evento, y los docblocks que argumentan por escrito la
  forma vieja.** Son contrato igual que los que AC13 ya nombra, y el spec no los tenía:
  - `audio/scheduler.ts` — `collectWindow` es quien arma los `Hit`: `:144` la nota y `:150` el click.
    La tercera clase se emite **ahí**, no en `engine.ts`, que solo despacha (`:302`). El archivo no
    figuraba en ninguna tarea ni en `research.md` §10.
  - `audio/types/scheduler.types.ts` — el docblock de `Sequence` argumenta que la celda "no es
    información que el motor pueda usar — para sonar solo hace falta CONTAR clicks", y el comentario
    del campo `clicks` lo repite. Con el cruce con altura esa mitad deja de valer; la otra —que el
    motor no puede ver `Cell`— sigue valiendo, y hay que reescribirlo diciendo cuál es cuál.
  - `domain/constants/board.constants.ts:26-28` y `domain/sequence.ts:188` explican el orden de `SEAM`
    y el invariante del largo **en términos de `bestRoute` y de `viaStart`/`viaEnd` de `ROUTE`**, que
    mueren con el borrado de AC12. Ídem `domain/sequence.ts:68` y los comentarios de
    `domain/__tests__/sequence.test.ts:106` y `:182`, que nombran a `pathBetween` como el que ignora
    obstáculos.

## Fuera de Alcance

- **Cambiar las puertas.** Entrada y salida siguen siendo la celda de la primera y la última nota del
  arpegio (D8/D9 del spec 010). Este spec cambia cómo se va de una a otra, no cuáles son.
- **Cambiar el desempate del circuito.** Held-Karp y el lexicográficamente menor se quedan.
- **Borrar el botón de Clicks.** Queda en Seguimiento (D6).
- **Que el usuario elija el camino o ajuste P.** El recorrido lo sigue decidiendo la geometría.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Cambia lo que suena** en cualquier tablero donde un tramo pisaba una pieza, que es la mayoría, y cambia el orden de visita en el 30-48 %. | Commit propio y declarado (AC7). Es un arreglo: hoy el recorrido entra a las piezas por el costado y eso no lo eligió nadie. |
| `P = 2` es un número elegido con una tabla, no con los oídos. | AC11 lo vuelve parte de la definición de terminado. La tabla de D1 dice exactamente qué se gana y qué se paga en cada valor, así que moverlo es informado y barato. |
| Con el tablero lleno no hay ninguna celda libre: todo el recorrido son cruces. | Es correcto y esperable. Lo que cambia es que suenan las notas de las celdas en vez de golpes sordos — mejor, no peor. |
| Con pesos el camino deja de ser único y el determinismo pasa a depender de la implementación. | D7: desempate lexicográfico explícito, con test que lo ejerza. |
| El cruce con altura afloja la frontera dominio↔audio. | No: el motor ya recibe números MIDI en `Step.notes`. Lo que sigue prohibido —y lo verifica el linter— es que vea `Cell`. |

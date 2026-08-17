# Spec 009 — El tablero como recorrido

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **Depende del [007](../007-nota-por-celda-y-lenguaje-visual/spec.md)** (de ahí salen la celda de
> entrada y la de salida de cada pieza) **y del [008](../008-el-intervalo-como-unidad-musical/spec.md)**
> (de ahí sale la unidad de tiempo). **Supera al
> [004](../004-fase-por-pieza-la-columna-como-posicion-en-el-compas/spec.md)**.

## Problema

Hoy el tablero es un **compás**: cada pieza suena una vez por compás, en la fracción que le da la
columna de su celda de agarre (`phaseFor`). Eso resolvió el problema del spec 004 —las piezas sonaban
todas encimadas— pero deja tres cosas sin resolver:

1. **Dos piezas en la misma columna vuelven a apilarse**, porque la columna es lo único que las separa.
   Con 10 columnas y hasta 12 piezas, las colisiones son inevitables.
2. **La fila no significa nada.** El tablero es de 10×6 y solo una de las dos dimensiones se oye.
3. **El patrón no tiene forma.** Todo dura un compás, siempre, sin importar cuántas piezas haya ni
   dónde estén: la geometría cambia *dónde* cae cada pieza dentro de una grilla fija, no *cuánto* dura
   ni *en qué orden* pasa lo que pasa.

## Solución Propuesta

**El tablero deja de ser un compás y pasa a ser un recorrido.** Un circuito cerrado visita las piezas
colocadas una por una; al llegar a una pieza suenan sus cinco notas; al salir, el recorrido cruza las
celdas vacías que la separan de la siguiente, y cada celda cruzada suena como un click. Cuando termina
la última, sigue hacia la primera: el ciclo se cierra sin marca de inicio ni de fin.

Todo cae sobre la misma grilla de intervalos del spec 008: **una celda recorrida = un intervalo**. Dos
piezas adyacentes no tienen silencio entre ellas; dos piezas lejanas tienen tantos intervalos de
recorrido como celdas las separan.

Y el tablero **se repliega sobre sí mismo**: la celda `(0,0)` y la celda `(9,5)` son adyacentes. Es una
sola arista extra sobre la grilla, y es lo que hace que el recorrido no tenga esquina de la que no se
pueda salir.

### Decisiones de diseño

**D1 — El orden lo da el circuito más corto, no el orden de colocación.**
Colocar una pieza en el medio de dos hace que suene entre las dos, que es la propiedad que se quiere:
la posición manda. El circuito se resuelve **exacto** (Held-Karp), no con vecino más cercano. Medido:
el greedy da recorridos **20 % más largos en promedio y hasta 79 % peor**, y el exacto cuesta 1,87 ms
con 12 piezas — el tope de 12 es estructural, porque hay 12 pentominós y no se repiten.

**D2 — La distancia es la de la grilla más una arista: `(0,0) ↔ (9,5)`.**
```
dist(a,b) = min( |Δ|(a,b),  |Δ|(a,(9,5)) + 1 + |Δ|((0,0),b),  |Δ|(a,(0,0)) + 1 + |Δ|((9,5),b) )
```
Función pura de dos coordenadas, en forma cerrada, sin BFS. Medido: acorta el 13,8 % de los pares de
celdas y baja la distancia máxima del tablero de 14 a 12.

**No** hay envoltura del borde entero ni toroide: es *una* costura, la que une la primera celda con la
última. Que el recorrido pueda usarla no cambia dónde se puede colocar una pieza — eso sigue plano.

La misma comparación de tres términos decide también **por dónde** pasa el recorrido, no solo cuánto
mide: ver D8.

**D3 — El silencio entre dos piezas es su distancia, sin tope.**
Si la salida de una pieza y la entrada de la siguiente están a `d` celdas, la primera nota de la
segunda suena `d` intervalos después de la última de la primera. Con `d = 1` (adyacentes) el patrón es
**contiguo**: la nota siguiente cae en el intervalo siguiente, sin costura audible. Separar dos piezas
es la forma de crear espacio, y es la razón de que no haya tope: el tope volvería la distancia
ilegible pasado cierto punto.

**D4 — Las celdas recorridas suenan.** Cada celda vacía que el recorrido cruza dispara un click corto y
sin altura, a volumen bajo. Sin él, un salto de 8 celdas es un silencio mudo de casi un segundo y el
recorrido —que es todo el modelo— se vuelve inaudible. Medido: con 8 piezas, un ciclo tiene 40 notas y
~15 clicks.

**D5 — Los cambios toman efecto al cerrar el ciclo.**
Colocar o quitar una pieza **no interrumpe** lo que está sonando: la secuencia nueva reemplaza a la
vieja en el instante en que el ciclo se cierra. Es lo que permite que el circuito se reordene entero
—que es lo que hace D1 al agregar una pieza— sin que el patrón salte a la mitad de una frase.

El precio está medido y es el riesgo principal de este spec: con 8 piezas a 110 bpm el ciclo dura
**7,5 s**, así que una pieza colocada puede tardar hasta eso en escucharse.

**D6 — El reloj sigue siendo un origen, no un cursor.**
La propiedad que el spec 002 fijó y el 004 conservó no se pierde: los onsets siguen saliendo en forma
cerrada, `origin + (k × ciclo + offset) × intervalo`, y `firstOnsetAfter` **no cambia ni una línea** —
lo que cambia es que su período es el ciclo en vez del compás, y que la fase es el offset de la pieza
dentro del ciclo en vez de la columna. Sigue sin comprometerse más de `LOOKAHEAD` de audio.

**D7 — La secuencia se arma en el dominio, no en el motor.**
El circuito, las distancias y los offsets son geometría pura: van a `domain/sequence.ts`, con tests.
El motor recibe una lista de instantes y frecuencias y **sigue sin saber qué es un pentominó**, que es
la separación que `.claude/rules/audio.md` protege.

**D8 — El recorrido produce celdas, no solo distancias.**
El modelo *es* un recorrido: la distancia es una **propiedad del camino**, no al revés. Así que
`pathBetween(a, b)` vive acá, y cada click de la secuencia lleva la celda que el recorrido cruza —
aunque para sonar solo haga falta contarlos, porque el click no tiene altura ni depende de dónde caiga.

Se evaluó dejar solo las distancias en este spec y materializar los caminos en el 010, que es el que
los dibuja. Se descartó por tres razones, la primera medida:

- **El costo no era un argumento.** Materializar los 144 caminos de una matriz de 12×12 cuesta
  0,0138 ms contra 0,0042 ms de calcular solo las distancias, y las dos cifras son ruido al lado de los
  1,87 ms que ya cuesta Held-Karp: **el 0,7 %** de lo que el spec ya acepta pagar.
- **Evita dos verdades.** Con distancias acá y caminos allá, hay dos funciones que pueden discrepar y
  hace falta un test que las ate. Con una sola decisión —`bestRoute(a, b)` elige cuál de las tres rutas
  conviene, `cellDistance` devuelve su largo y `pathBetween` materializa sus celdas— discrepar es
  imposible por construcción.
- **La extensión ya prevista lo exige.** Esquivar las piezas colocadas (BFS sobre celdas libres, fuera
  de alcance) **no tiene forma cerrada**: ahí la distancia solo se puede obtener recorriendo. Si este
  spec se apoya en la forma cerrada como concepto primario, esa extensión lo reescribe; si se apoya en
  el camino, le cambia el interior a una función.

El invariante que lo sostiene, verificado recorriendo las 3.600 combinaciones de celdas del tablero y
aseverando sobre las **3.540** que son de celdas distintas:
`pathBetween(a,b).length === cellDistance(a,b) − 1` **para todo par de celdas distintas**. El caso
`a === b` es degenerate y queda explícitamente fuera: nunca ocurre en una pata del circuito, porque la
salida de una pieza y la entrada de otra no pueden ser la misma celda si las piezas no se solapan, y la
entrada y la salida de una misma pieza son los grados 0 y 4, que son celdas distintas.

La regla del camino es **primero en X, después en Y**, y cuando conviene la costura, hasta la esquina y
cruzar. Entre el par más lejano del tablero hay 792 caminos mínimos y en un salto típico de 7 celdas
hay 35: ninguna elección es más correcta que otra, así que se elige la que se explica en una línea.

## Criterios de Aceptación

- **AC1** — El orden de reproducción es el del circuito más corto. Test: tres piezas colocadas en orden
  A, C, B suenan A, B, C si esa es la geometría.
- **AC2** — `(0,0)` y `(9,5)` están a distancia 1: cero celdas en el medio (D2). Y la distancia máxima
  entre dos celdas del tablero es 12, no 14.
- **AC3** — Dos piezas adyacentes suenan **contiguas**: la primera nota de la segunda cae exactamente
  un intervalo después de la última de la primera, sin silencio.
- **AC4** — El ciclo no tiene marca de inicio: el salto entre la última pieza y la primera se calcula
  con la misma regla que los demás, y `simulate_board` con `cycles: 2` muestra un espaciado uniforme en
  el empalme — el mismo que adentro del ciclo.
- **AC5** — Colocar o quitar una pieza no altera el ciclo en curso; la secuencia nueva empieza a sonar
  exactamente en el cierre del ciclo (D5).
- **AC6** — Nunca hay más de `LOOKAHEAD` de audio comprometido, con cualquier tamaño de ciclo (D6).
- **AC7** — Las celdas recorridas suenan: `Hit` distingue nota de click, y un salto de `d` celdas
  produce `d − 1` clicks equiespaciados, **cada uno con la celda que el recorrido cruza** (D8).
- **AC7b** — `pathBetween(a,b).length === cellDistance(a,b) − 1` para las **3.540** combinaciones de
  celdas **distintas** del tablero —60 × 60 menos las 60 de la diagonal, que quedan excluidas por D8—,
  y las celdas del camino son adyacentes de a pares y no se repiten.
- **AC8** — `phaseFor` no existe en el repo, ni sus tests, ni el campo `phase`.
- **AC9** — `simulate_board` refleja el modelo nuevo **de los dos lados**: devuelve el orden del
  circuito, los saltos, el largo del ciclo y una `timeline` con notas y clicks; y su ventana se pide en
  **ciclos**, no en compases. El parámetro `bars` pasa a `cycles` (entero, 1–4, default 2) porque en
  este modelo el compás dejó de ser una unidad del instrumento: con 10 piezas el ciclo mide 4,1
  compases, así que los dos ciclos que pide AC4 no entraban en el tope de 8 del schema viejo.
- **AC10** — El circuito se resuelve exacto en menos de 5 ms para 12 piezas, medido como la **mediana
  de 21 corridas** y no como una sola. Es lo único que separa a este AC de un test que falla por una
  pausa de GC: el margen contra los 1,87 ms medidos es de 2,7x, y una corrida suelta en una máquina
  cargada se lo come. Las 12 piezas se construyen **a mano** y no colocando al azar: 12 × 5 = 60 celdas
  es teselar el tablero entero, y el `research.md` §5 midió 0 de 200 tableros aleatorios con 12.
- **AC11** — `pnpm verify` en verde.
- **AC12** *(no-regresión)* — **`audio/` sigue sin importar nada de `domain/`.** Lo verifica
  `pnpm lint` con el override de capa de `eslint.config.js`, que también ve los `import type`. La
  `Sequence` que entra al motor no puede arrastrar `Cell` ni ningún otro tipo del dominio: si el motor
  necesita las celdas del recorrido, el spec está mal cortado (ver D7 y la advertencia del review).
- **AC13** *(no-regresión)* — **El swap del cierre de ciclo no pierde ni duplica onsets en el borde.**
  Al reemplazar la secuencia activa, `scheduledUntil` queda estrictamente **antes** del nuevo `origin`
  —la misma regla que `startClock` ya tiene y que `.claude/rules/audio.md` registra como trampa: sin
  eso se pierde el primer onset del ciclo nuevo— y ningún hit de la secuencia vieja agendado más allá
  del borde vuelve a salir desde la nueva. Test con un ciclo corto y una ventana que cruce el borde.

## Fuera de Alcance

- **La cabeza lectora**, que es el spec 010. Este spec hace que haya un recorrido; verlo es el otro.
- **Colocación envolvente.** Que una pieza pueda quedar a caballo de la costura toca `cellsAt`,
  `isValid`, el fantasma y los invariantes sobre las 96 orientaciones: es un spec propio.
- **Esquivar piezas.** La distancia ignora lo que haya en el medio. Que el recorrido rodee las piezas
  colocadas (BFS/Dijkstra sobre celdas libres) agrega el caso "no hay camino" y hace que el silencio
  entre dos piezas dependa del tablero entero. Es la extensión natural y es otro spec — pero gracias a
  D8 es un cambio **adentro** de `bestRoute`/`pathBetween`, no una reescritura del modelo.
- **Tope de silencio.** Sin tope (D3).
- **Que la forma dibuje la melodía.** Las cinco notas de una pieza suenan en el orden que fija el spec
  007, siempre, sin importar su posición. La posición manda **entre** piezas, no **dentro** de una.
  Medido en la nota del `log.md` del 2026-08-16: `F`, `T` e `Y` tienen 3 puntas y `X` tiene 4, así que
  recorrer las cinco celdas de esas piezas obliga a repetir alguna.
- **Cambiar el rango de tempo o el timbre.**

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **D5 hace esperar hasta un ciclo entero** para escuchar una pieza nueva: 4,4 s con 4 piezas y 7,5 s con 8, a 110 bpm. | Es la consecuencia directa de la continuidad que el diseño pide, y el spec 010 la vuelve legible mostrando dónde va el recorrido y dónde entró la pieza nueva. Si al usarlo resulta intolerable, la salida **no** es aplicar los cambios en caliente —eso reordena el patrón a la mitad— sino aplicarlos en el próximo *cruce por la pieza afectada*, que es una regla más fina y su propio cambio. |
| Agregar una pieza puede **reordenar el circuito entero**, no solo insertarla. | Es lo que se pidió: la posición manda sobre el orden de colocación. D5 hace que el reordenamiento nunca se oiga a mitad de frase, y el 010 lo hace visible. |
| El click de D4 puede resultar molesto o tapar las notas. | Volumen bajo y sin altura, para que no compita armónicamente. Es un parámetro suelto: si molesta, se baja o se apaga sin tocar el modelo. |
| ~~Sintetizar ruido puede no andar en `node-web-audio-api`~~ — **cerrado por medición**: `createBuffer` + `AudioBufferSourceNode` corren en ese entorno y la muestra llega intacta al render (`research.md` §7). | Sin riesgo de entorno. El oscilador de envolvente corta sigue disponible, pero como alternativa de **timbre** y no como plan B forzado. |
| Reescribir `collectHits` es tocar el corazón del audio. | La firma y `firstOnsetAfter` no cambian (D6): lo que cambia es el período y el significado de la fase. Los tests de scheduler existentes son la red, y se adaptan antes de tocar la implementación. |
| Con 12 piezas el tablero está **lleno** (12 × 5 = 60 celdas = el tablero entero), así que los saltos tienden a 1 y el modelo pierde espacio. | Medido: colocar 12 piezas al azar no ocurrió ni una vez en 200 intentos, y 11 ocurrió 4 veces. El caso de tablero lleno es un rompecabezas de teselación, no el uso normal — pero conviene verificar a mano que un tablero casi lleno sigue sonando bien. |

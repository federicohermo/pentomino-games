# Plan — Pisar una pieza cuesta

Cinco pasos. El **1 es el único que cambia lo que suena** y va en su propio commit; el 2 le da altura al
cruce; el 3 lo lleva al motor; el 4 al dibujo; el 5 a las tools.

**Los pasos 1 y 2 se mergean juntos aunque sean commits distintos.** El 1 solo deja el tablero rodeando
piezas y pisándolas igual donde no le conviene, pero sin decir qué pisó: es un estado peor que el de
hoy y que el del final.

## 0. Antes de tocar nada

`check_invariants` en un **proceso fresco**. El server MCP de la sesión cachea los módulos: consultado
sin reiniciar contesta con el código viejo y el chequeo pasa por construcción. Es la trampa que el 010
ya pisó, y ahí destapó que el MCP seguía reportando el `gates` anterior.

## 1. La distancia deja de ser una fórmula y pasa a ser un costo

`bestRoute` deja de ser tres Manhattan y un mínimo, y pasa a ser un camino de **costo mínimo** sobre las
60 celdas: adyacencia de 4 vecinos más la arista de la costura, con peso 1 en la celda vacía y `P` en la
ocupada.

```ts
// domain/board.ts
export function routeBetween(a: Cell, b: Cell, placed: readonly PlacedPiece[]): {
  path: Cell[];      // las celdas INTERMEDIAS, igual que hoy pathBetween
  steps: number;     // path.length + 1 — PASOS reales, no costo
  crossed: Cell[];   // las ocupadas que el camino igual pisa
}
```

**El peso lo pagan las celdas intermedias, no las dos puntas.** Las puertas están sobre una pieza por
definición: cobrarlas sumaría el mismo `2·(P-1)` a las 144 entradas de la matriz sin mover ningún
mínimo, y rompería la simetría que `board.test.ts` verifica sobre los 3.600 pares. Así `crossed` es
exactamente el subconjunto ocupado de `path`.

**Una sola llamada devuelve las tres cosas (D3).** Y ojo con la distinción que va a confundir a
cualquiera que lo lea después: **el costo ordena los caminos, los pasos miden el tiempo.** Un cruce
cuesta 2 pero sigue durando **un** intervalo. Si el costo se filtrara a los offsets, el ciclo se
estiraría donde no debe y el tablero sonaría distinto de lo que se ve.

Dos cosas que hay que fijar explícitamente y que hoy salen gratis:

- **El desempate (D7).** Entre caminos de igual costo gana el lexicográficamente menor, comparando las
  secuencias de celdas intermedias posición por posición y cada celda como el par `(x, y)` —primero
  `x`, después `y`—. No alcanza con fijar el orden de exploración de vecinos: eso deja el determinismo
  apoyado en un detalle de implementación, y el 009 escribió medio docblock explicando por qué eso no
  se hace. Ojo con el atajo que parece equivalente y no lo es: un Dijkstra que desempata mirando solo
  el vecino que relaja **no** da el camino lexicográficamente menor en general — hay que comparar el
  prefijo entero.
- **`P` sale de `domain/constants/`**, no del módulo. Es un valor fijo y la regla del repo es que los
  `.ts` de capa no declaran constantes. Su comentario lleva la tabla de D1: qué se gana y qué se paga en
  cada valor, para que moverlo sea informado.

`cellDistance` y `pathBetween` quedan como envoltorios finos o desaparecen, según los llamadores. Si se
borran, va en **su propio commit** — la convención del repo para borrados. **Los llamadores son más de
los que este plan decía**, y están enumerados en AC12: 13 tests en `board.test.ts`, cuatro usos en
`sequence.test.ts`, y dos asserts en `mcp-server/src/__tests__/tools.test.ts` que **cruzan el borde de
paquete**. Con el borrado se van también `ROUTE` y `RouteKind`, que se quedan sin consumidor cuando
muere `bestRoute`.

Tests: AC1 (caso testigo), AC2 (ningún cruce evitable, sobre prefijos del teselado y tableros con
semilla), AC5 (**determinismo con un test que lo EJERZA**: un tablero donde haya empate real, igual que
el 009 buscó uno donde el desempate del circuito se ejerciera de verdad), AC6 (Held-Karp exacto por
fuerza bruta hasta 7) y AC8 (mediana de 21 corridas).

**Commit propio, y el mensaje declara el cambio de audio y el cambio de orden de visita.**

## 2. El cruce lleva altura

La nota del cruce es la que la celda ya muestra desde el spec 007, o sea la cadena
`occupantCellIndex → degreeByCellIndex → notesForRotation`.

**Dos trampas medidas de esa cadena, las dos ya pisadas en este repo:**

- `degreeByCellIndex` se llama sobre la forma **canónica** y el grado viaja por índice. Correrla sobre
  la forma transformada compila igual y devuelve otro mapeo en 75 de las 96 orientaciones.
- El arpegio sale de `notesForRotation` (ascendente) y **no** de `p.notes`, que ya trae el retrógrado
  aplicado. Indexar `notes` con el grado lee la forma al derecho contra un arpegio al revés.

La derivación va en una **pura del dominio**, no adentro de `buildSequence`, por lo mismo que
`cellsByPlayOrder` salió de adentro de `gates` en el 010: una derivación escondida dentro de otra
función es la que después discrepa. Y hay una candidata obvia — `cellsByPlayOrder` ya va de pieza a
celdas en orden; lo que falta es el inverso, de celda a nota.

`Click` deja de ser solo instante y celda: puede llevar altura.

**Lo que NO hay que agregar:** la garantía de que un cruce no caiga en el mismo intervalo que una nota.
Ya vale por construcción —`buildSequence` pone los cruces en `ultima+1 … ultima+largo` y el paso
siguiente arranca en `ultima+largo+1`, o sea que ocupan exactamente el hueco— y el test del 009
(«ninguno pisa el instante de una nota») ya lo cubre. El modelo con peso alarga el camino sin tocar esa
aritmética.

## 3. El motor toca esa nota

La `Sequence` de `audio/` no puede ver `Cell` —lo verifica el linter— pero **sí puede ver un número
MIDI**: ya los recibe en `Step.notes`. El cruce viaja como instante más altura opcional, y `App.tsx`
sigue **proyectando y no traduciendo**.

Para que `tick()` pueda distinguirlos hay que sumar la **tercera clase de evento** (AC13): `HIT`
—hoy `{ note, click }` en `audio/constants/scheduler.constants.ts`— gana una clave, y el union `Hit`
una rama que lleva su `hz`. **No** un `hz?: number` sobre la rama del click: el docblock de `Hit` lo
rechaza por escrito, y sin la discriminación `setClicksAudible` no puede apagar solo los mudos (D6).

En `tick()`: cruce con altura → `scheduleVoice` con `GRACE_INTERVALS * intervalDuration(bpm)` y
`GRACE_VELOCITY`; cruce mudo → `scheduleClick`, como hoy. **No hace falta ninguna función nueva en
`voice.ts`**: `scheduleVoice` ya recibe `dur` y `vel`. Pero `dur` **no tiene default y es a propósito**
—su docblock explica que un default sería un número en segundos que miente sobre el bpm—, así que la
constante de duración va en **intervalos** y su precedente es `NOTE_INTERVALS`, no `CLICK_SECONDS`: la
excepción de `CLICK_SECONDS` está justificada en que el click no tiene altura, y el cruce sí la tiene.
`vel` sí tiene default, y `GRACE_VELOCITY` va al lado de `CLICK_VELOCITY`.

`setClicksAudible` sigue apagando solo los mudos (D6).

## 4. Que se vea distinto

`components/route-source.ts` arma la tabla por offset y hoy distingue dos casos con el booleano
`Marca.nota`, declarado en `components/types/route.types.ts`; pasan a ser tres. El booleano se queda
corto — va un const-object con su union derivada, que es lo que el repo usa para conjuntos cerrados (y
`erasableSyntaxOnly` rechaza los `enum`). **El const-object va a `components/constants/`** —los módulos
de capa no declaran constantes— y la union derivada a `components/types/route.types.ts`, cuyo docblock
argumenta hoy lo contrario («son exactamente dos casos y el tercero se expresa con la ausencia de la
marca») y hay que reescribir. Su test `components/__tests__/route-source.test.ts:120-152` afirma
`nota: true` / `nota: false` en cuatro lugares y se migra con él.

`Playhead.tsx` los dibuja con el canal que ya usa —grosor del borde, tres escalones— **sin agregar
color**: el color es identidad.

**Este paso es la verificación de los tres anteriores**, no un extra: es lo que permite ver el rodeo y
ver qué celda se pisó. Sin el 010 mergeado, este spec se implementa a ciegas.

## 5. Las tools

`simulate_board` ya reporta el camino de cada salto. Sumarle los cruces y sus notas — es lo que permite
verificar el recorrido sin oírlo, que es para lo que la tool existe. Y va a ser la forma barata de
comparar valores de `P` sin tener que escuchar cada uno.

## 6. Elegir P escuchando (AC11)

El único paso que no se puede hacer leyendo. La tabla de D1 dice qué se gana y qué se paga; lo que no
dice es cómo suena. El procedimiento: un tablero de 4 o 5 piezas con la cabeza lectora andando, y
recorrer P = 1, 2, 3, 5. Lo que hay que escuchar no es "cuántos cruces" sino si el rodeo se lee como
rodeo o como que el instrumento se colgó — el máximo medido con P = ∞ fue de +20 intervalos, 2,7 s a
110 bpm, y ese es el síntoma que P existe para evitar.

El número que se elija queda escrito con su motivo al lado.

## Lo que un revisor va a esperar y no va a encontrar

Una función `cellDistance(a, b)` de dos argumentos. **Ya no existe como tal**: la distancia dejó de
depender solo de las dos celdas y pasa a depender del tablero. Es el cambio conceptual del spec.

Una regla de "esquivar" con su excepción. **No hay regla ni excepción, hay un peso.** La primera versión
de este spec sí las tenía y las tres cosas que necesitaba para funcionar —el caso "imposible", el tope
al rodeo y el trato especial de la `X`— desaparecieron al cambiarlas por un número.

Y va a encontrar **un cambio de audio en un spec que suena a mejora visual**. Cambia la matriz de costos
y con ella el orden en que se visitan las piezas, en el 30-48 % de los tableros.

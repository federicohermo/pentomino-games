# Plan — El recorrido esquiva las piezas

Cinco pasos. El **1 es el único que cambia lo que suena** y va en su propio commit; el 2 es el caso
degradado, que es tan principal como el otro (27 % de los tramos ya con 4 piezas); el 3 lo lleva al
motor; el 4 al dibujo; el 5 a las tools.

**El orden importa por una razón concreta:** el paso 1 solo empeora el caso de la `X` —el tramo sigue
cruzando, y ahora además rodea— hasta que el paso 2 lo cierra. Mergear el 1 solo es peor que no mergear
nada, así que los dos van juntos aunque sean commits distintos.

## 0. Antes de tocar nada

`check_invariants` en un **proceso fresco**. El server MCP de la sesión cachea los módulos: si se lo
consulta sin reiniciar contesta con el código viejo y el chequeo pasa por construcción. Es la trampa que
el 010 ya pisó.

## 1. La distancia deja de ser una fórmula

`bestRoute` deja de ser tres Manhattan y un mínimo, y pasa a ser un BFS sobre las 60 celdas: adyacencia
de 4 vecinos más la arista de la costura, con las celdas ocupadas bloqueadas salvo las dos puntas.

```ts
// domain/board.ts
export function routeBetween(a: Cell, b: Cell, placed: readonly PlacedPiece[]): {
  path: Cell[];        // las celdas INTERMEDIAS, igual que hoy pathBetween
  length: number;      // path.length + 1, por construccion
  crosses: Cell[];     // las ocupadas que igual hubo que pisar (vacio en el caso feliz)
}
```

**Una sola llamada devuelve las tres cosas (D3).** Es la lección de D8 del 009 elevada al cuadrado: sin
fórmula cerrada, dos funciones separadas no tienen nada que las obligue a coincidir. `cellDistance` y
`pathBetween` quedan como envoltorios finos sobre esta, o desaparecen — se decide al ver los llamadores.

Dos cosas que hay que fijar explícitamente y que hoy salen gratis:

- **El determinismo.** Hoy el camino es "primero en X, después en Y" y es único. Con BFS depende del
  orden en que se exploran los vecinos, así que ese orden va **escrito y comentado**, no heredado del
  orden en que se escribió el array. Sin eso AC5 se apoya en un detalle de implementación.
- **El tope al rodeo (D5).** Si `length` supera al camino directo por más del tope, gana el directo con
  sus cruces. El número **sale de escuchar**, no del papel: el research midió rodeos de hasta +20, que a
  110 bpm son 2,7 s. Arrancar con algo del orden de +4 y ajustarlo con el tablero andando.

Test de AC1 con el caso testigo (`P`/90 en `(3,2)` + `Y`/90 en `(7,2)`), y de AC2 sobre los prefijos del
teselado y sobre tableros aleatorios con semilla fija.

**Commit propio, y el mensaje declara el cambio de audio.**

## 2. El cruce inevitable suena la nota de la celda

`Click` deja de ser solo un instante y una celda. La forma exacta se decide al escribirlo, pero la
propiedad es: un cruce sabe si la celda que pisa **tiene nota**, y cuál.

La nota no se inventa ni se recalcula: es la que la celda ya muestra desde el spec 007, o sea la cadena
`occupantCellIndex → degreeByCellIndex → notesForRotation`. Como `buildSequence` ya recibe `placed`, la
tiene a mano — pero **la derivación va en una pura del dominio y no adentro de `buildSequence`**, por lo
mismo que `cellsByPlayOrder` salió de adentro de `gates` en el 010: una derivación escondida adentro de
otra función es la que después discrepa.

Ojo con el invariante que el 009 ya tiene: *«dos clicks no caen nunca en el mismo instante»*. Ahora hay
que extenderlo — un cruce con nota tampoco puede caer en el mismo intervalo que la nota que una pieza
toca por derecho propio, o las dos amplitudes se suman. Va con test.

Test de AC3 sobre la **`X`**, que es el caso estructural: su celda central es siempre una puerta y está
rodeada por sus propios brazos, así que el tramo que entra o sale de ella cruza siempre.

## 3. El motor toca esa nota

La `Sequence` de `audio/` no puede ver `Cell` —lo verifica el linter— pero **sí puede ver un número
MIDI**: ya los recibe en `Step.notes`. Así que el cruce viaja al motor como `{ offset, hz? }` o
equivalente, y `App.tsx` sigue **proyectando y no traduciendo**.

En `tick()`, un cruce con altura va a `scheduleVoice` y uno sin altura sigue yendo a `scheduleClick`.
`setClicksAudible` sigue apagando solo los mudos: **el cruce con nota no es mezcla, es modelo**, y
apagarlo sería silenciar una nota del recorrido.

## 4. Que se vea distinto

La tabla por offset de `components/route-source.ts` ya distingue nota de click con un booleano; ahora
son tres casos: nota de pieza, cruce con nota, click sobre celda vacía. `Playhead.tsx` los dibuja con
los mismos dos canales que ya usa (grosor del borde), sin agregar color — el color es identidad.

**Este paso es la verificación de los tres anteriores**, no un extra: es lo que permite ver el rodeo y
ver qué celda se cruzó. Sin el 010 mergeado, este spec se verifica a ciegas.

## 5. Las tools

`simulate_board` ya reporta el camino de cada salto. Sumarle si el tramo cruzó celdas ocupadas y con qué
notas — es lo que permite verificar el recorrido sin oírlo, que es para lo que la tool existe.

## 6. Verificación

| Qué | Cómo |
|---|---|
| **AC1** | Test del caso testigo: el tramo `P→Y` no pisa `(7,1)`, y mide 8 |
| **AC2** | Sobre los prefijos del teselado y tableros aleatorios: ningún cruce evitable |
| **AC3** | Test sobre la `X`: el tramo cruza y suena la nota de la celda cruzada |
| **AC4** | El invariante `camino.length === distancia - 1`, ya cubierto por el 009, sigue verde |
| **AC5** | Determinismo: mismo tablero, misma secuencia. Y Held-Karp exacto por fuerza bruta hasta 7 piezas, igual que hoy |
| **AC7** | Medición con `performance.now()`, mediana de 21 corridas, igual que el test del 009 |
| **AC8** | `pnpm verify` y `check_invariants` en proceso fresco |
| **AC9** | **A ojo, con la cabeza lectora**: el recorrido rodea, y donde no puede, la celda cruzada se enciende y suena |

## Lo que un revisor va a esperar y no va a encontrar

Una función `cellDistance(a, b)` de dos argumentos. **Ya no existe como tal**: la distancia dejó de
depender solo de las dos celdas y pasa a depender del tablero. Es el cambio conceptual del spec y todo
lo demás cuelga de ahí.

También va a buscar el caso degradado tratado como un borde, y **es la mitad del spec**: con 4 piezas ya
es el 27 % de los tramos, y con una `X` en el tablero es inevitable por geometría.

Y va a encontrar **un cambio de audio en un spec que suena a mejora visual**. No lo es: cambia la matriz
de costos, y con ella el orden en que se visitan las piezas. Va en su commit y lo declara el PR.

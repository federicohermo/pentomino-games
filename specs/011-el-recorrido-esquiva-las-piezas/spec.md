# Spec 011 — El recorrido esquiva las piezas

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **Revisa el modelo del [009](../009-el-tablero-como-recorrido/spec.md)**: cambia `cellDistance`, y con
> ella la matriz de costos y el circuito. **Depende del [010](../010-cabeza-lectora-por-celda/spec.md)**
> para poder verificarse: el problema es invisible sin cabeza lectora.

## Problema

El recorrido del 009 va de la salida de una pieza a la entrada de la siguiente por el camino más corto,
y **`pathBetween` ignora lo que haya en el medio**. Está escrito como consecuencia conocida en
`.claude/rules/audio.md` —«un click puede caer sobre una pieza»— y se dio por aceptable porque el click
es solo un golpe sin altura. Medido, no es una excepción: es **la regla**.

Clicks que caen sobre una celda ocupada, sobre los prefijos del teselado de 12 piezas:

| piezas | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| clicks | 3 | 6 | 8 | 6 | 13 | 14 | 14 | 15 | 15 | 14 | 14 |
| **sobre pieza** | **3** | **6** | 3 | 4 | 10 | 10 | 13 | **15** | 13 | **14** | **14** |
| | 100 % | 100 % | 38 % | 67 % | 77 % | 71 % | 93 % | 100 % | 87 % | 100 % | 100 % |

Lo que eso significa musicalmente: **el click dejó de decir lo que dice**. Su razón de ser (D4 del 009)
es que un salto largo sin sonido es un silencio mudo y el recorrido se vuelve inaudible; los clicks son
las **celdas vacías** que se cruzan. Cuando el 87 % cae encima de una pieza, lo que se escucha son
golpes sordos sobre celdas que tienen una nota y no la tocan.

Y ahora **se ve**. El caso que originó este spec, medido con el dominio real:

```
P rot 90 en (3,2) → celdas (3,3) (4,3) (3,2) (4,2) (3,1),  puertas: entrada (4,2), salida (3,1)
Y rot 90 en (7,2) → celdas (7,4) (7,3) (7,2) (7,1) (8,2),  puertas: entrada (8,2), salida (7,1)

salto P→Y: d = 6, camino [4,1] [5,1] [6,1] [7,1] [8,1]
                                        ^^^^^ es G#5, celda de la Y
```

El recorrido entra a la `Y` **por el costado**, pisando una de sus notas sin tocarla, en vez de llegar
por su puerta. Eso no se podía diagnosticar antes del 010: con un click de por medio, el error es un
golpe más entre catorce.

## Solución Propuesta

1. **La distancia entre dos puertas pasa a ser el camino más corto que NO cruza celdas ocupadas**, en
   vez de la distancia Manhattan replegada. Cambia la matriz de costos y por lo tanto el circuito.
2. **Cuando no existe ningún camino libre, el recorrido cruza igual** —no hay alternativa— y cada celda
   ocupada que pisa **suena su nota** en vez de un click. La celda ya tiene una nota asignada desde el
   spec 007; lo que hoy falta es que el cruce la use.

### Decisiones de diseño

**D1 — Esquivar cuesta, y ese costo es el que reordena el circuito.**
No se trata de elegir mejor entre caminos igual de cortos. Medido sobre 400 tableros aleatorios válidos,
el rodeo medio es de **+1,6 a +2,5 intervalos** y el máximo llega a **+20**. En el caso testigo, el
camino libre mide **8 contra los 6** del actual. Como la distancia alimenta la matriz de costos de
Held-Karp, **el orden de visita de las piezas puede cambiar entero**. Es la misma clase de cambio que
D9 del 010, y por lo tanto va con la misma disciplina: commit propio y declarado.

**D2 — La distancia se calcula con BFS sobre las 60 celdas, no con una fórmula.**
Con obstáculos ya no hay forma cerrada. El grafo son 60 nodos con adyacencia de 4 vecinos más la arista
de la costura (`(0,0)`–`(9,5)`, D2 del 009). Medido: la matriz completa de 12×12 cuesta **0,31 ms**,
contra los **0,62 ms** que Held-Karp ya paga en el mismo tablero. **El costo se duplica y sigue siendo
despreciable** — el argumento del 009 («`n` está acotado por las reglas del juego») vale igual acá.

**D3 — Un camino y una distancia salen de la MISMA llamada.**
Es la lección de D8 del 009: la cantidad de clicks no se calcula, se lee del largo del camino. Con
obstáculos la tentación es peor —una función que da la distancia y otra que da el camino— y el riesgo es
el mismo elevado al cuadrado, porque ya no hay una fórmula que las obligue a coincidir. `bestRoute` pasa
a devolver el camino, y la distancia es su largo.

**D4 — Cuando no hay camino libre, el cruce suena la nota de la celda.**
No es un caso raro y el spec no puede tratarlo como tal. Medido sobre 400 tableros aleatorios válidos:

| piezas | 2 | 3 | 4 | 5 | 6 | 8 |
|---|---|---|---|---|---|---|
| pares sin camino libre | 9 % | 15 % | 27 % | 50 % | 65 % | 88 % |

Y hay una causa **estructural**, no de congestión: **la celda central de la `X` es siempre una de sus
dos puertas y está rodeada por sus propios cuatro brazos**. Con una `X` en el tablero, el tramo que
entra o sale de ella no puede evitar cruzar celdas ocupadas **nunca**, con el tablero vacío o lleno. Es
la única de las 12 piezas con esa propiedad, y sola alcanza para que el caso degradado no sea opcional.

Cruzar sonando la nota de la celda es mejor que cruzar en silencio o que cruzar con un click: la celda
**tiene** una nota desde el spec 007, se la ve escrita en el tablero, y tocarla al pasar es coherente
con que el recorrido es lo que hace sonar al instrumento.

**D5 — El rodeo tiene tope, y pasado el tope se cruza.**
Un rodeo de +20 intervalos son 2,7 s de recorrido a 110 bpm para saltar entre dos piezas vecinas: deja
de leerse como "esquivar" y pasa a leerse como que el instrumento se colgó. Si el camino libre mide más
que el directo por más de un tope a fijar, gana el directo con sus cruces sonando. El tope sale de
escuchar, no de elegirlo en el papel — el 009 ya cambió una decisión de recorrido después de oírla.

**D6 — `Click` deja de ser solo un instante.**
Hoy un cruce es `{ offset, cell }` en el dominio y `{ offset }` en el motor, y el motor lo suena con
`scheduleClick`, sin altura. Con D4 un cruce puede llevar nota, así que el tipo tiene que poder decirlo
y la proyección de `App.tsx` tiene que llevarla al motor. **Esto toca la frontera dominio↔audio**, que
es la parte más protegida del repo: el motor no puede ver `Cell`, pero sí puede ver un número MIDI —ya
los ve en `Step.notes`—, así que la proyección sigue siendo una proyección y no una traducción.

## Criterios de Aceptación

- **AC1** — El caso testigo queda cerrado, con test: con la `P` rot 90 en `(3,2)` y la `Y` rot 90 en
  `(7,2)`, el tramo `P→Y` **no pisa `(7,1)`**. El camino libre mide 8 contra los 6 del directo.
- **AC2** — Ningún tramo cruza una celda ocupada **cuando existe un camino libre dentro del tope** (D5).
  Verificable sobre los prefijos del teselado y sobre tableros aleatorios.
- **AC3** — Cuando no hay camino libre, cada celda ocupada que el tramo cruza **suena la nota de esa
  celda**, la misma que el tablero muestra. Con test sobre la `X`, que es el caso estructural.
- **AC4** — La distancia y el camino salen de la misma llamada (D3): no hay dos funciones que puedan
  discrepar, y el invariante `camino.length === distancia - 1` se mantiene.
- **AC5** — El circuito sigue siendo **determinista y exacto**: mismo tablero, misma música, y
  Held-Karp sigue dando el óptimo sobre la matriz nueva. El desempate lexicográfico del 009 no cambia.
- **AC6** — **El cambio de audio va en su propio commit y declarado.** Todo tablero con dos piezas cuyo
  tramo cruzaba una pieza suena distinto: es un arreglo, no un cambio de gusto, pero hay que poder
  revertirlo solo.
- **AC7** — Rendimiento: la matriz de 12×12 con BFS no supera los **2 ms** (medido hoy: 0,31 ms), y el
  total de `buildSequence` con 12 piezas sigue bajo los 5 ms que ya afirma el test del 009.
- **AC8** — `pnpm verify` en verde, y `check_invariants` antes y después.
- **AC9** — **A ojo con la cabeza lectora del 010**: el recorrido rodea las piezas, y donde no puede,
  la celda que cruza se enciende y suena su nota. Es la verificación que este spec no habría podido
  hacer antes.

## Fuera de Alcance

- **Cambiar las puertas.** Entrada y salida siguen siendo la primera y la última nota del arpegio
  (D8/D9 del spec 010). Este spec cambia cómo se va de una a otra, no cuáles son.
- **Cambiar el desempate del circuito.** Held-Karp y el lexicográficamente menor se quedan como están.
- **Rediseñar el click.** Sigue existiendo para las celdas vacías que el recorrido cruza; lo que se
  agrega es qué pasa cuando la celda no está vacía.
- **Hacer que el usuario elija el camino.** El recorrido lo sigue decidiendo la geometría.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Cambia lo que suena** en cualquier tablero donde un tramo cruzaba una pieza, que es la mayoría. | Commit propio y declarado (AC6). Es un arreglo: hoy el recorrido entra a las piezas por el costado, y eso no lo eligió nadie. |
| El rodeo puede ser enorme (+20 medido) y volver el ciclo interminable. | D5: tope al rodeo, y pasado el tope se cruza sonando. El número sale de escuchar. |
| Con el tablero lleno **no hay ninguna celda libre**, así que "esquivar" no significa nada y todo pasa por el caso degradado. | Es correcto y esperable: con 60 celdas ocupadas el recorrido es todo cruces. Lo que cambia es que suenan las notas de las celdas en vez de golpes sordos — que es mejor, no peor. |
| Un cruce que suena la nota puede coincidir en el mismo intervalo con la nota que la pieza toca por derecho propio, y sumarse. | Es la misma garantía que el 009 ya verifica para los clicks («dos clicks no caen nunca en el mismo instante»), extendida al caso nuevo. Va como invariante con test. |
| `Click` con altura afloja la frontera dominio↔audio. | No: el motor ya recibe números MIDI en `Step.notes`. Lo que sigue prohibido —y lo verifica el linter— es que vea `Cell`. |

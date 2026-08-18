# Research — Cabeza lectora por celda

## 1. La limitación ya estaba escrita, y el 009 la agrava

`docs/architecture/modelo-musical.md:73` la declara. Nació con el spec 004 hablando de la **fase**, y el
009 ya la reescribió sobre el **recorrido** —o sea que la limitación no se heredó sin mirarla, se
actualizó al modelo nuevo—:

> **Limitación conocida:** no hay retroalimentación visual del recorrido. Una cabeza lectora recorriendo
> el tablero es lo que volvería *legible* a este modelo; hoy se oye pero no se lee. Es la limitación
> consciente que cierra el [spec 010](../../specs/010-cabeza-lectora-por-celda/spec.md), que depende de
> este.

La misma frase está una segunda vez en `.claude/rules/domain.md:49`, y las dos se cierran con este spec.

Con el modelo del 004 eso era incómodo: había un compás y las piezas caían en fracciones de él. Con el
009 hay un recorrido de largo variable, orden no evidente y silencios de longitud geométrica. Los
números del `research.md` del 009: un ciclo de 8 piezas tiene **40 notas y ~15 clicks**, dura **7,5 s a
110 bpm**, y su orden es el del circuito más corto, que no coincide con el de colocación.

Y hay algo peor que la ilegibilidad: por D5 del 009, **una pieza recién colocada puede tardar un ciclo
entero en sonar** —hasta 7,5 s— sin ninguna señal de que fue registrada. Ese vacío es el que este spec
llena.

## 2. Ritmo de actualización

| bpm | Intervalo | Celdas por segundo |
|---|---|---|
| 60 | 0,2500 s | **4,0** |
| 110 | 0,1364 s | 7,3 |
| 160 | 0,0938 s | **10,7** |

O sea: entre 4 y 11 cambios por segundo. `requestAnimationFrame` corre a ~60 Hz, así que el loop
**lee 60 veces por segundo y escribe entre 4 y 11**: comparar la celda calculada con la anterior y
escribir solo al cambiar es lo que separa 60 escrituras de estilo por segundo de 11.

Para dimensionar la alternativa descartada: el tablero son `GRID_W × GRID_H = 60` celdas, más la lista
de colocadas y la paleta. Mover el resaltado por `useState` re-renderizaría todo eso 11 veces por
segundo.

## 3. El precedente ya está en el repo

`Spectrum.tsx` resuelve exactamente esta clase de problema, y su comentario de cabecera es la regla:

> React monta el `<canvas>` y arranca/frena el loop; el dibujo es imperativo y **NO pasa por estado**:
> 60 renders por segundo de React para pintar barras competirían con el re-render del tablero sin darle
> nada a nadie.

Lo que se toma de ahí: efecto con `[]` como dependencias, `requestAnimationFrame`, lectura directa del
motor, limpieza con `cancelAnimationFrame`. Lo que **no** se toma: el canvas. La cabeza va sobre la
grilla de `div`s que ya existe, superpuesta, porque tiene que alinearse celda a celda con un layout que
React ya calcula.

## 4. El camino ya viene resuelto, y por qué no lo resuelve este spec

La primera versión de este documento le asignaba a este spec el cálculo del camino concreto, porque el
009 solo necesitaba distancias. Se movió al 009 (su D8) al medir que materializar los 144 caminos de
una matriz de 12×12 cuesta **0,0138 ms** contra los **1,87 ms** que el 009 ya paga por resolver el
circuito: el 0,7 %. El costo era el único argumento para separarlos, y en contra había uno más fuerte
— con el camino calculado en dos lados, el dibujo y el sonido pueden discrepar.

Cuánto pueden discrepar, contando caminos mínimos sobre el grafo del tablero (grilla de 4 vecinos
**más** la costura), por BFS con conteo:

| Par | Distancia | Caminos mínimos |
|---|---|---|
| `(0,5)` → `(7,0)` — el par más lejano del tablero | 12 | **792** |
| `(2,0)` → `(6,3)` — un salto típico | 7 | **35** |
| `(1,1)` → `(8,4)` — un salto que usa la costura | 5 | 4 |
| `(0,0)` → `(9,5)` — los extremos de la costura | 1 | 1 |

Con 792 opciones igual de cortas, ninguna es "la correcta": lo que importa es que la regla sea
**determinista y explicable** —primero en X y después en Y— y que haya **una sola**. Son también 792
maneras distintas en que un cálculo propio de la UI podría dibujar un recorrido que no es el que suena,
sin que nada falle: por eso este spec lee el camino en vez de calcularlo.

Notar el último renglón: los extremos de la costura tienen **un solo** camino y no hay celda intermedia,
así que ahí la cabeza salta directamente de una esquina a la otra. Es correcto y hay que verificar que
no se lea como un error de dibujo.

## 4bis. Medir de dónde sale la celda de cada nota destapó un bug del 009

El paso de verificación de este spec —«confirmar que el 009 dejó lo necesario»— contestó que **no**: la
secuencia trae la celda de cada *click* (`Click.cell`) pero no la de cada *nota*. Al derivarla se cayó
algo más grande, y es el hallazgo más caro de este research.

El 009 eligió **grado 0 = entrada** y **grado 4 = salida** para las puertas de cada pieza. Pero el
retrógrado invierte el **orden de reproducción** sin mover qué nota le toca a qué celda —es la regla que
`describe_piece` documenta como su trampa #3 y que `Board.tsx:49-52` explica—, así que con `mirror` la
primera nota que suena es la del grado **4**. El 009 **nunca menciona la reflexión**: ni su `spec.md` ni
su `research.md` la nombran una sola vez, y su test solo verifica que las dos puertas sean distintas
(`sequence.test.ts:160`), que pasa igual con las dos invertidas.

Medido con las tools, sobre `L` rotación 0 **reflejada** en `(1,1)`:

```
describe_piece → cellMap: [1,3] es grado 0 (D4)  ·  [0,0] es grado 4 (B4)
                 notes (orden de reproducción):  B4, A4, F#4, E4, D4
simulate_board → gates: entry [1,3], exit [0,0]
                 timeline: at 0.05 → B4   (o sea: la celda [0,0], la SALIDA)
                           at 0.60 → D4   (o sea: la celda [1,3], la ENTRADA)
```

Y el salto anterior llega caminando hasta `[1,2]`, pegado a la entrada, para que lo primero que suene
esté en la punta opuesta de la pieza. **Entrada y salida están exactamente invertidas respecto de la
melodía en toda pieza reflejada**, o sea la mitad del espacio de colocación.

Es la misma incoherencia que el 009 sacó del caso de una pieza sola —«no se oye un recorrido sino dos
golpes encima del arpegio»—, sobrevivida en el caso que no miró. Y se arregla solo al hacer
`cellsByPlayOrder`, porque las puertas pasan a leerse del orden de reproducción en vez de derivarse por
segunda vez.

Lo que esto dice del spec, y es lo que hay que llevarse: **una cabeza lectora es un test de coherencia
entre lo que suena y lo que se ve**. Ningún test de audio podía encontrar esto —el circuito era válido,
las distancias correctas y los onsets los esperados—, porque el error no está en el tiempo sino en la
correspondencia entre el tiempo y el espacio, que es justamente lo que hasta hoy no se dibujaba.

## 5. La latencia de salida no se puede medir desde acá

Lo que el scheduler agenda en `ctx.currentTime` se escucha después: la diferencia es
`AudioContext.outputLatency`, y `baseLatency` es la parte del pipeline interno. Los tests corren en
`node-web-audio-api`, donde esos números no representan una salida real, así que **esto se verifica en
el navegador y a oído**, no en un test. La cadena de fallback (`outputLatency` → `baseLatency` → 0)
tiene que estar escrita antes de probar, porque el síntoma de que falte es sutil: la cabeza no se ve
"rota", se ve **adelantada de forma constante**.

Y hay una trampa de tipos medida en el árbol de hoy: `node_modules/typescript/lib/lib.dom.d.ts:2933`
declara `readonly outputLatency: number` —**no opcional**—, mientras que Firefox no lo implementa. O
sea que TypeScript va a decir que la cadena de fallback sobra justo donde hace falta. El repo prohíbe
`any` y `@ts-ignore`, así que la lectura tiene que tiparse como `number | undefined` de forma explícita
en vez de taparse.

## 6. Lo que hace falta agregar

| Qué | Dónde | Por qué |
|---|---|---|
| ~~`pathBetween`~~ y ~~las celdas de cada click~~ | ~~`domain/`~~ | **Ya lo trae el 009** (su D8), verificado: `domain/board.ts:173` y `Click.cell` |
| **`cellsByPlayOrder`** — la celda de cada NOTA | `domain/sequence.ts` | **NO lo trae el 009.** `Step` es `{ pieceId, offset, notes }`; la derivación grado→celda solo existe adentro de `gates()` para los grados 0 y 4 |
| **`gates` leyendo de ella** — el arreglo de §4bis | `domain/sequence.ts` | Cambia el circuito de los tableros reflejados. Commit propio, atribuido al 009 |
| `playheadOffset(t)` | `audio/playhead.ts` (pura) + `audio/engine.ts` (lectura del singleton) | Función pura del tiempo (D3). Módulo propio y no dentro de `engine.ts`, por el precedente de `spectrum.ts`: lo testeable va separado del nodo |
| Si el motor ya hizo el swap de ciclo | `audio/engine.ts` | Es lo que apaga el estado "pendiente" (AC5) |
| **La secuencia de dominio activa vs. la pendiente** | `components/route-source.ts`, fuera de React | El motor tiene el par pero sin celdas; la UI tiene las celdas pero solo del tablero actual (AC9) |
| `pendingIds` por props | `components/Board.tsx` | AC5: cambia una vez por ciclo, no 10 veces por segundo — D1 mide frecuencia |
| `Playhead.tsx` | `components/` | El loop de rAF, el elemento superpuesto |
| Montar `Playhead` en el `relative` de la grilla | `components/Board.tsx` | `Board` no tiene `children` desde el review del 007 |
| Orden del circuito en la lista | `components/PlacedList.tsx` | AC6; esto **sí** es estado de React, y cambia rara vez |

**No se toca `collectHits` ni el modelo de `buildSequence`.** El grueso de este spec es lectura y
dibujo — pero *"todo lo que necesita ya está calculado"* resultó falso en un punto, y es el de la
segunda fila.

## 7. Deuda adyacente detectada (fuera de alcance)

- **`occupantAt` recorre todas las piezas para cada celda** (`domain/board.ts:45`) y el render del
  tablero lo llama 60 veces por cuadro de React. Hoy no molesta porque el tablero re-renderiza poco;
  con la cabeza dibujándose aparte sigue sin molestar, **pero conviene no empeorarlo**: el loop de la
  cabeza no debe llamarlo.
- **`PlacedPiece.notes` sigue en pie** después de tres specs de seguimiento. Con la lista mostrando el
  orden del circuito, el panel lateral se toca igual: es el momento natural para sacarlo.
- **El estado "pendiente" es información del motor dibujada por la UI.** Si aparece un tercer consumidor
  de ese dato, conviene una sola lectura y no tres — hoy son dos (la cabeza y el estilo de la pieza).

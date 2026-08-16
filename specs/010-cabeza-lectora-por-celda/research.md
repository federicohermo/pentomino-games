# Research — Cabeza lectora por celda

## 1. La limitación ya estaba escrita, y el 009 la agrava

`docs/architecture/modelo-musical.md:53` la declara desde el spec 004:

> **Limitación conocida:** no hay retroalimentación visual de la fase. Una cabeza lectora recorriendo
> el tablero es lo que volvería *legible* a esta regla; hoy se oye pero no se lee.

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

## 4. Hay que elegir un camino, porque hay muchos

El 009 nunca necesitó un camino: su distancia sale en forma cerrada. Contando caminos mínimos sobre el
grafo del tablero (grilla de 4 vecinos **más** la costura), por BFS con conteo:

| Par | Distancia | Caminos mínimos |
|---|---|---|
| `(0,5)` → `(7,0)` — el par más lejano del tablero | 12 | **792** |
| `(2,0)` → `(6,3)` — un salto típico | 7 | **35** |
| `(1,1)` → `(8,4)` — un salto que usa la costura | 5 | 4 |
| `(0,0)` → `(9,5)` — los extremos de la costura | 1 | 1 |

Con 792 opciones igual de cortas, ninguna es "la correcta": lo que importa es que la regla sea
**determinista y explicable**. Primero en X y después en Y cumple las dos cosas y es una línea.

Notar el último renglón: los extremos de la costura tienen **un solo** camino y no hay celda intermedia,
así que ahí la cabeza salta directamente de una esquina a la otra. Es correcto y hay que verificar que
no se lea como un error de dibujo.

## 5. La latencia de salida no se puede medir desde acá

Lo que el scheduler agenda en `ctx.currentTime` se escucha después: la diferencia es
`AudioContext.outputLatency`, y `baseLatency` es la parte del pipeline interno. Los tests corren en
`node-web-audio-api`, donde esos números no representan una salida real, así que **esto se verifica en
el navegador y a oído**, no en un test. La cadena de fallback (`outputLatency` → `baseLatency` → 0)
tiene que estar escrita antes de probar, porque el síntoma de que falte es sutil: la cabeza no se ve
"rota", se ve **adelantada de forma constante**.

## 6. Lo que hace falta agregar

| Qué | Dónde | Por qué |
|---|---|---|
| `pathBetween(a, b): Cell[]` | `domain/board.ts` | El 009 dejó la distancia, no el camino (§4) |
| Las celdas de cada click en la secuencia | `domain/sequence.ts` | Hoy los clicks son offsets sin lugar |
| `playheadOffset(t)` | `audio/engine.ts` (lectura) + puro donde corresponda | Función pura del tiempo (D3) |
| Si el motor ya hizo el swap de ciclo | `audio/engine.ts` | Es lo que apaga el estado "pendiente" (AC5) |
| `Playhead.tsx` | `components/` | El loop de rAF, el elemento superpuesto |
| Orden del circuito en la lista | `components/PlacedList.tsx` | AC6; esto **sí** es estado de React, y cambia rara vez |

**No se toca `collectHits`, ni `buildSequence` en lo que hace a instantes.** Lo único que se agrega al
dominio es geometría que no altera ningún tiempo.

## 7. Deuda adyacente detectada (fuera de alcance)

- **`occupantAt` recorre todas las piezas para cada celda** (`domain/board.ts:60`) y el render del
  tablero lo llama 60 veces por cuadro de React. Hoy no molesta porque el tablero re-renderiza poco;
  con la cabeza dibujándose aparte sigue sin molestar, **pero conviene no empeorarlo**: el loop de la
  cabeza no debe llamarlo.
- **`PlacedPiece.notes` sigue en pie** después de tres specs de seguimiento. Con la lista mostrando el
  orden del circuito, el panel lateral se toca igual: es el momento natural para sacarlo.
- **El estado "pendiente" es información del motor dibujada por la UI.** Si aparece un tercer consumidor
  de ese dato, conviene una sola lectura y no tres — hoy son dos (la cabeza y el estilo de la pieza).

# Plan — Cabeza lectora por celda

Cuatro pasos. El 1 es dominio puro y mergeable solo; el 2 expone lo que el motor ya sabe; el 3 es el
único que dibuja; el 4 es la lista.

## 1. El camino, en el dominio

```ts
// domain/board.ts
export function pathBetween(a: Cell, b: Cell): Cell[]   // celdas INTERMEDIAS, sin a ni b
```

Regla: primero en X, después en Y. Si `cellDistance` dice que el camino corto pasa por la costura, se
va hasta la esquina correspondiente, se cruza, y se sigue igual desde la otra. La decisión de si
conviene la costura ya la toma `cellDistance`; acá se reusa esa comparación en vez de repetirla.

**El invariante que lo ata al 009**: `pathBetween(a, b).length === cellDistance(a, b) - 1`. Ese es el
test que garantiza que el dibujo y el sonido cuentan lo mismo, y es AC4.

En `domain/sequence.ts`, cada click deja de ser un offset suelto y pasa a llevar su celda. **Los
offsets no se recalculan**: se le agrega el lugar a lo que ya existía.

## 2. Lo que el motor tiene que dejar leer

```ts
// audio/engine.ts
export function playheadOffset(): number | null   // offset en intervalos, null si no suena nada
export function cycleGeneration(): number         // cuántos swaps de ciclo hubo
```

`playheadOffset` es `((now − latencia − origin) / intervalo) mod ciclo`, con la cadena de fallback de
latencia (`outputLatency` → `baseLatency` → 0). Devuelve `null` en pausa, sin contexto o con la
secuencia vacía — igual que `readSpectrum()` devuelve `null` en reposo, y por el mismo motivo: es
información, no falla.

La aritmética va en una **pura testeable**, separada de la lectura del singleton, exactamente como
`spectrum.ts` separa el mapeo de bins del `AnalyserNode`. Es lo que hace posible AC2 sin tiempo real.

`cycleGeneration` es un contador que sube en cada swap: es lo que le permite a la UI saber que la
pieza pendiente dejó de estarlo, sin exponer el `origin` ni obligar a la vista a hacer cuentas.

## 3. `Playhead.tsx`

Un componente **sin props**, montado dentro del contenedor `relative` que `Board.tsx` ya tiene (el
mismo donde cuelga la previsualización). Copia la estructura de `Spectrum.tsx`: efecto con `[]`,
`requestAnimationFrame`, limpieza con `cancelAnimationFrame`.

Por cuadro:

1. `playheadOffset()`; si es `null`, ocultar y salir.
2. Traducir el offset a una celda con la secuencia activa. **Sin `occupantAt`** (ver `research.md` §7):
   la secuencia ya tiene la celda de cada nota y de cada click.
3. Si la celda es la misma que la del cuadro anterior, **no escribir nada**. Es lo que baja de 60
   escrituras por segundo a entre 4 y 11.
4. Si cambió: mover el elemento con `transform: translate(...)` calculado desde `CELL_PX`, y aplicar la
   clase fuerte o tenue según sea nota o click (D7).

El elemento se posiciona con estilo inline y no con clases de Tailwind, porque las coordenadas salen de
`CELL_PX`, que es una constante: una clase interpolada no se generaría. Es la misma regla que ya rige
en `Board.tsx`.

**La pieza pendiente** se dibuja en el mismo loop: mientras `cycleGeneration()` sea igual a la
generación en la que se colocó, esa pieza se ve atenuada. Al cambiar, vuelve a normal — en el mismo
instante en que empieza a sonar, sin `setState`.

## 4. La lista y el orden del circuito

`PlacedList` recibe el orden del circuito además de las piezas. Esto **sí** es estado de React y está
bien que lo sea: cambia cuando cambia el tablero, no diez veces por segundo. El orden sale de la misma
`buildSequence` que ya calcula `App.tsx` para el motor — no se recalcula.

## 5. Verificación

| Qué | Cómo |
|---|---|
| AC2 | Test de la pura: offsets a `t` dentro del primer ciclo, en el borde, y varios ciclos adelante |
| **AC4** | Test: `pathBetween(a,b).length === cellDistance(a,b) - 1` sobre las 3.600 combinaciones |
| AC1 | A mano con el profiler de React: durante la reproducción, cero renders del árbol |
| AC3 | A oído en el navegador: la celda encendida coincide con la nota que se escucha. Probar en Chrome y en Firefox, que difieren en `outputLatency` |
| AC5 | Colocar una pieza con el ciclo andando: se ve atenuada y cambia justo cuando suena |
| AC6 | Colocar una pieza en el medio del recorrido: la lista se reordena |
| AC7 | Pausar: la cabeza desaparece |
| AC8 | `pnpm verify` |

Casos a mirar a ojo, todos ya identificados en el research: un salto por la costura (la cabeza salta de
esquina a esquina, sin celda intermedia), dos piezas adyacentes (no hay click y la cabeza pasa de una a
otra sin escala), y el tablero a 160 bpm (10,7 celdas por segundo, el caso más rápido).

## Lo que un revisor va a esperar y no va a encontrar

Estado de React. **La cabeza no vive en el árbol**: se lee del motor y se pinta a mano, igual que el
espectro, y el motivo está medido — 4 a 11 cambios por segundo × 60 celdas + la lista + la paleta.
También va a buscar el cálculo del camino en la capa de audio, y está en el dominio: es geometría, y no
cambia ni un instante de lo que suena.

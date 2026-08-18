# Plan — Cabeza lectora por celda

Cinco pasos. El **0 es un arreglo del 009 y va primero**, en sus propios commits; el 1 es la
verificación que lo destapó; el 2 expone lo que el motor sabe y arma el par de secuencias del lado de la
UI; el 3 es el único que dibuja; el 4 es la lista. **Este spec no calcula ningún recorrido** — lo lee.

El paso 0 no estaba en la primera versión de este plan: salió de que el paso de verificación
—«confirmar que el 009 dejó lo necesario»— encontrara que no, y de tirar del hilo. Es la mejor
justificación que tiene ese paso de existir.

## 0. El dominio: `cellsByPlayOrder`, y el bug del 009 que cae con ella

Dos commits, en este orden, **antes de tocar nada del dibujo**:

**0a — La pura.** En `domain/sequence.ts`, al lado de `gates`:

```ts
export function cellsByPlayOrder(p: PlacedPiece): Cell[] {
  const grados = degreeByCellIndex(SHAPES[p.piece]);
  // Por GRADO y no por indice del array: `grados[k]` es el grado de `p.cells[k]`,
  // asi que el inverso —la celda del grado g— es `p.cells[grados.indexOf(g)]`.
  const porGrado = grados.map((_, g) => p.cells[grados.indexOf(g)]);
  // El retrogrado ya aplicado, igual que en `PlacedPiece.notes`: asi
  // `cellsByPlayOrder(p)[j]` es la celda de `p.notes[j]` y nadie vuelve a invertir.
  return p.mirror ? porGrado.reverse() : porGrado;
}
```

Con su test de AC11 sobre las 96 combinaciones, reusando el barrido que `sequence.test.ts:136-160` ya
tiene armado.

**0b — El arreglo.** `gates` deja de buscar los grados 0 y 4 y pasa a leer de la pura:

```ts
export function gates(p: PlacedPiece): { entrada: Cell; salida: Cell } {
  const orden = cellsByPlayOrder(p);
  return { entrada: orden[0], salida: orden[orden.length - 1] };
}
```

Eso **cambia el circuito** de todo tablero con reflexión (D9), así que va solo, con el test de AC12 y
con el mensaje de commit atribuyéndolo al 009. Correr `check_invariants` antes y después, que es lo que
`.claude/rules/domain.md` obliga al tocar esta capa, y `simulate_board` sobre el caso testigo de D9 para
ver el circuito darse vuelta.

Ojo con dos consumidores que el cambio alcanza y no son de este spec: `simulate_board` reporta `gates`
por pieza (es lo que reemplazó a la fase en su respuesta) y `buildSequence` construye la matriz de
costos con ellas. Los dos son lecturas y ninguno necesita cambiar — pero las respuestas de la tool y el
audio de un tablero reflejado sí cambian, y conviene que el PR lo diga.

## 1. Lo que ya viene del 009 — verificado

Confirmado contra el código de hoy: la secuencia trae lo necesario **salvo la celda de cada nota**, que
es lo que resuelve el paso 0.

- `sequence.clicks[i].cell` — la celda que el recorrido cruza, materializada por `pathBetween` (D8 del
  009), con su invariante `pathBetween.length === cellDistance − 1` ya cubierto por el test del 009.
- `sequence.steps[i]` — la pieza, su offset en intervalos y sus notas, en orden de grado.
- `sequence.length` — el largo del ciclo en intervalos.

Verificado contra el código de hoy: los tres están (`domain/types/sequence.types.ts`, `pathBetween` en
`domain/board.ts:173`, invariante en `domain/__tests__/board.test.ts:245`).

**Lo que NO está, y es el hallazgo que este paso tenía que atrapar:** la celda de cada **nota**. `Step`
lleva `pieceId`, `offset` y `notes`, no celdas. La salida que este plan preveía para ese caso —«es un
cambio del 009 y va en su commit»— sigue siendo la correcta, solo que el 009 ya está mergeado
(`afef917`, PR #8): por eso el paso 0 existe y por eso va aparte.

Lo que sigue valiendo intacto es el motivo de D5: que el dibujo calcule su propio **camino** es lo
prohibido —entre las dos celdas más lejanas del tablero hay 792 caminos mínimos, o sea 792 formas de
mostrar un recorrido que no es el que suena—, y una pura de dominio que mapea grado→celda no es un
camino ni una distancia, así que no lo reabre.

## 2. Lo que el motor tiene que dejar leer

```ts
// audio/engine.ts
export function playheadOffset(): number | null   // offset en intervalos, null si no suena nada
export function cycleGeneration(): number         // cuántos swaps de ciclo hubo
```

La aritmética va en `audio/playhead.ts`, módulo propio: `spectrum.ts` es el precedente exacto —el
mapeo testeable vive separado del nodo que no se puede correr en `OfflineAudioContext`—, y meterla
dentro de `engine.ts` la ata al singleton que AC2 necesita no tener.

`playheadOffset` es `((now − latencia − origin) / intervalo) mod ciclo`, con la cadena de fallback de
latencia (`outputLatency` → `baseLatency` → 0). Devuelve `null` en pausa, sin contexto o con la
secuencia vacía — igual que `readSpectrum()` devuelve `null` en reposo, y por el mismo motivo: es
información, no falla.

`cycleGeneration` es un contador que sube en cada swap: es lo que le permite a la UI saber que la
pieza pendiente dejó de estarlo, sin exponer el `origin` ni obligar a la vista a hacer cuentas.

### El par activa/pendiente del lado del dominio (AC9)

El motor tiene el par `active`/`pending` (`engine.ts:125-126`) pero su `Sequence` no lleva celdas ni
`pieceId` (`audio/types/scheduler.types.ts:41-43`, y el override de eslint le prohíbe ver `Cell`). La
única secuencia con celdas es la del dominio, y la UI la deriva de `placed`, que es el tablero **de
ahora** — o sea, la pendiente. Sin más que eso, durante la espera de hasta 7,5 s que este spec existe
para hacer visible, la cabeza recorrería el circuito nuevo mientras suena el viejo.

El arreglo es espejar el par del motor, fuera de React —`.claude/rules/ui.md` lo habilita
explícitamente: *"o va afuera de React (ref o singleton de módulo)"*— y atar el swap a
`cycleGeneration()`, que es el único observador del instante exacto:

```ts
// components/route-source.ts — la Sequence del DOMINIO, con celdas, en el mismo par que el motor.
// No es estado de React a propósito: lo lee un loop de rAF, igual que readSpectrum().
let activa: Sequence = { steps: [], clicks: [], length: 0 };
let pendiente: Sequence | null = null;
let generacion = 0;

/** La llama el mismo efecto de App que ya hace setSequence: las dos colas se encolan juntas. */
export function encolar(s: Sequence): void { pendiente = s; }

/** La llama el loop de dibujo. El swap ocurre acá, en el mismo cuadro en que el motor lo reporta. */
export function rutaActiva(): Sequence {
  const g = cycleGeneration();
  if (g !== generacion) { generacion = g; if (pendiente) { activa = pendiente; pendiente = null; } }
  return activa;
}
```

Son quince líneas y no inventan un segundo reloj: el motor sigue siendo el único que decide **cuándo**
cierra el ciclo, y esto solo lo observa. El módulo vive en `components/` y no en `audio/`, porque habla
`Cell` y el override de capa se lo prohíbe al motor — es la misma frontera que `App.tsx` ya cruza al
proyectar.

Un caso a no olvidar: **el primer arranque**. Con `activa` en vacío y el reloj recién largado, el primer
ciclo del motor sale de su propio `pending`, así que `rutaActiva()` tiene que haber hecho su swap antes
del primer cuadro con sonido. Cae solo si `cycleGeneration()` arranca en 0 y sube también en el swap
inicial — verificarlo, porque el síntoma es una cabeza que no aparece en el primer ciclo y después anda.

## 3. `Playhead.tsx`

Un componente **sin props**, montado dentro del `relative overflow-x-auto` que envuelve la grilla
(`Board.tsx:127`). Copia la estructura de `Spectrum.tsx`: efecto con `[]`, `requestAnimationFrame`,
limpieza con `cancelAnimationFrame`.

`Board` **no tiene ranura de `children`** —la previsualización aparte y su `children` se retiraron en el
review del 007 (`Board.tsx:24-27`, `layout.constants.ts:44-46`)—, así que **`Board` importa `Playhead`
directo** y lo monta él. No se devuelve la ranura: `Playhead` no recibe props, o sea que no le pide nada
a `App`, y una ranura genérica reabre la puerta que el 007 cerró midiendo. `Board.tsx` entra al alcance
del spec por esta línea y por `pendingIds`.

Que quede escrito porque es contraintuitivo: el absoluto se posiciona contra el contenedor que
**scrollea**, así que la cabeza scrollea con la grilla y sigue alineada debajo de `md`. Es lo que AC10
verifica.

Por cuadro:

1. `playheadOffset()`; si es `null`, ocultar y salir.
2. Traducir el offset a una celda contra `rutaActiva()`, **no** contra `buildSequence(placed)`. **Sin
   `occupantAt`** (ver `research.md` §7): la celda del click sale de `Click.cell` y la de la nota de
   `cellsByPlayOrder` (paso 0), las dos ya calculadas. El índice de la nota dentro del paso es
   `offset − step.offset`, y si cae fuera de `[0, 5)` no es una nota sino un click.
3. Si la celda es la misma que la del cuadro anterior, **no escribir nada**. Es lo que baja de 60
   escrituras por segundo a entre 4 y 11.
4. Si cambió: mover el elemento con `transform: translate(...)` calculado desde `CELL_PX`, y aplicar la
   clase fuerte o tenue según sea nota o click (D7).

El elemento se posiciona con estilo inline y no con clases de Tailwind, porque las coordenadas salen de
`CELL_PX`, que es una constante: una clase interpolada no se generaría. Es la misma regla que ya rige
en `Board.tsx`.

**La pieza pendiente va por React, y es la excepción declarada a D1 (AC5).** Las celdas de la pieza son
DOM que renderiza `Board.tsx`, con `key={i}` y **sin refs ni `data-*`** (`Board.tsx:169-175`): un
componente sin props no tiene handle sobre esos nodos, y darle uno significaría partir el estilo de una
celda entre React y el loop — que es exactamente lo que el review del 007 pagó caro.

Y no hace falta: el estado pendiente cambia **una vez por ciclo** —7,5 s con 8 piezas a 110 bpm—, no
entre 4 y 11 veces por segundo. D1 es una medición sobre la **frecuencia**, así que no lo cubre; lo que
D1 prohíbe es mover el resaltado por `useState`, y eso sigue prohibido.

Concretamente: el loop compara `cycleGeneration()` contra lo último que vio y llama a un
`setPendingIds` **solo cuando cambió**; `Board` recibe `pendingIds` por props y pinta la atenuación por
el mismo camino declarativo que ya usa para el choque y el fantasma. Un render del árbol por cierre de
ciclo, cero durante el ciclo. Los ids salen de comparar la pendiente contra la activa de
`route-source.ts`, que ya tiene las dos.

Queda una asimetría que conviene ver de frente: la cabeza se dibuja imperativa y la pieza pendiente
declarativa, en el mismo componente. No es incoherencia — es la misma regla aplicada a dos frecuencias
distintas, y el número que las separa es 60x.

## 4. La lista y el orden del circuito

`PlacedList` recibe el orden del circuito además de las piezas. Esto **sí** es estado de React y está
bien que lo sea: cambia cuando cambia el tablero, no diez veces por segundo. El orden sale de la misma
`buildSequence` que ya calcula `App.tsx` para el motor — no se recalcula.

## 5. Verificación

| Qué | Cómo |
|---|---|
| **AC11** | Test de `cellsByPlayOrder` sobre las 96 combinaciones: `[j]` es la celda de `notes[j]` |
| **AC12** | Test de `gates` con reflexión, más el caso testigo de D9 (`L`/0/reflejada) |
| **AC13** | `git log` del PR: el arreglo de D9 en su commit, sin nada del dibujo |
| AC2 | Test de la pura: offsets a `t` dentro del primer ciclo, en el borde, y varios ciclos adelante |
| **AC4** | Revisión del diff: no hay aritmética de caminos ni de distancias en `components/` |
| AC1 | A mano con el profiler de React: durante la reproducción, cero renders del árbol |
| AC3 | A oído en el navegador: la celda encendida coincide con la nota que se escucha. Probar en Chrome y en Firefox, que difieren en `outputLatency` |
| AC5 | Colocar una pieza con el ciclo andando: se ve atenuada y cambia justo cuando suena |
| AC6 | Colocar una pieza en el medio del recorrido: la lista se reordena |
| AC7 | Pausar: la cabeza desaparece y el contador de escrituras del loop queda quieto |
| **AC9** | Colocar con el ciclo andando: la cabeza sigue el circuito viejo hasta el swap, y salta junto con el sonido |
| **AC10** | No-regresión a ojo: fantasma con nota y grado, "Quitar"/"Reset", y el scroll del tablero debajo de `md` |
| Degradados | Play con el tablero vacío (ciclo 0) y con una sola pieza (sin clicks) |
| AC8 | `pnpm verify` |

Casos a mirar a ojo, todos ya identificados en el research: un salto por la costura (la cabeza salta de
esquina a esquina, sin celda intermedia), dos piezas adyacentes (no hay click y la cabeza pasa de una a
otra sin escala), y el tablero a 160 bpm (10,7 celdas por segundo, el caso más rápido).

## Lo que un revisor va a esperar y no va a encontrar

Estado de React **para la cabeza**. No vive en el árbol: se lee del motor y se pinta a mano, igual que
el espectro, y el motivo está medido — 4 a 11 cambios por segundo × 60 celdas + la lista + la paleta. Sí
lo hay para la pieza pendiente, que cambia una vez cada 7,5 s: la regla es la frecuencia, no el dogma.

También va a buscar el cálculo del recorrido en este diff, y **no está**: lo hace el 009, y acá se lee.
Es la diferencia entre dibujar el modelo y opinar sobre él.

Y va a encontrar algo que el título del spec no anuncia: **un cambio de audio** (paso 0b, D9). Está en
su propio commit y es un arreglo del 009, no una decisión nueva de este spec — pero si el PR se lee de
arriba hacia abajo sin eso en la cabeza, parece que la cabeza lectora cambió cómo suena el instrumento.
Lo declara el cuerpo del PR.

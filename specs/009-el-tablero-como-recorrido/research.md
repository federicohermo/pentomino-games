# Research — El tablero como recorrido

Todo lo de acá se midió **ejecutando el dominio real** (`transform.ts`, `board.ts`,
`pieces.constants.ts`) sobre tableros aleatorios válidos, con un script descartable. Node 22 corre los
`.ts` del dominio sin compilar, que es la misma propiedad de la que vive el MCP server.

## 1. Lo que hay hoy, y lo que se va

| Pieza del modelo actual | Dónde | Qué le pasa |
|---|---|---|
| `phaseFor(cells, anchorIndex)` = columna / `GRID_W` | `domain/board.ts:41-57` | **muere** |
| Sus 5 tests | `domain/__tests__/board.test.ts:96-122` | mueren |
| `Job.phase` | `audio/types/scheduler.types.ts:5-15` | muere; lo reemplaza el offset dentro del ciclo |
| `Job` entero (`id`, `notes`) | ídem, `:2-16` | lo reemplaza una `Sequence` con offsets |
| `addJob` / `removeJob` / `clearJobs` | `audio/engine.ts:125-127` | los reemplaza `setSequence` |
| `jobCount` | `audio/engine.ts:128-129` | **no basta con borrarlo**: `.claude/rules/audio.md` lo nombra como la forma de verificar el audio en el navegador. Lo reemplaza el mismo dato sobre la secuencia activa |
| `bars` en el `inputSchema` de `simulate_board` | `mcp-server/src/tools/simulateBoard.ts:51-52` | pasa a `cycles` (1–4, default 2): el compás deja de ser una unidad del instrumento |
| `jobTimeline` y su corte por onset | ídem `:120-166` | se va: el corte existía porque cada job tenía su propia fase dentro del compás, y ahora hay una sola secuencia con un solo origen |
| El período de `collectHits` | `audio/scheduler.ts:81` (`const bar`) y `:110` (`at += bar`) | pasa de `bar` a `ciclo` |
| `firstOnsetAfter` | `audio/scheduler.ts:56-59` | **no cambia** |
| El docblock de `GRID_W`: *"10 es también la cantidad de posiciones dentro del compás (spec 004)"* | `domain/constants/board.constants.ts:1-7` | pasa a ser falso: el eje X deja de ser tiempo |
| `simulate_board`: `phase` en jobs y en `placements` | `mcp-server/src/tools/simulateBoard.ts:190,229` | se reescribe |
| Su `description`: *"la columna de la celda de agarre es la posición dentro del compás"* | ídem `:176-178` | pasa a ser falsa |
| **Los tests de la tool que afirman la fase** | `mcp-server/src/__tests__/tools.test.ts:202,208,211,262` | mueren o se reescriben; sin esto `pnpm mcp:test` queda rojo |
| `docs/architecture/modelo-musical.md` §fase, `audio.md#fase-por-pieza` | | se reescriben |
| Tres docs más que **nombran `phaseFor`** | `docs/architecture/overview.md:42,77` · `docs/architecture/directory-structure.md:60` · `docs/guides/mcp-domain.md:36` | quedan falsas al borrarlo |

El spec 004 pasa a `Superado`. No se reescribe: es historia, y su `research.md` sigue siendo el mejor
registro de por qué el problema existía.

## 2. La costura: qué cambia una sola arista

Con `dist` = grilla de 4 vecinos **más** la arista `(0,0) ↔ (9,5)`, sobre las 3.600 combinaciones de
pares de celdas del tablero de 10×6:

| Medición | Sin costura | Con costura |
|---|---|---|
| Distancia máxima entre dos celdas | 14 | **12** |
| Pares de celdas que se acortan | — | **496 de 3.600 (13,8 %)** |
| `(0,0)` → `(9,5)` | 14 | **1** — cero celdas en el medio |

Y cuánto se usa de verdad: en los circuitos óptimos de tableros aleatorios, **al menos un salto pasa
por la costura** en el 12 % de los tableros de 2 piezas y en el 50 % de los de 10. O sea que no es un
adorno: con el tablero poblado, la costura es parte del recorrido la mitad de las veces.

## 2b. El camino cuesta 0,7 % de lo que ya se paga

La primera versión de este spec calculaba solo **distancias** y dejaba los caminos concretos para el
spec 010, que es el que los dibuja. Medido, esa separación no se sostiene:

| Sobre una matriz de 12×12 | Tiempo |
|---|---|
| Solo distancias (`min` de tres sumas) | **0,0042 ms** |
| Materializando los 144 caminos | **0,0138 ms** |
| Held-Karp, que este spec ya acepta pagar | 1,87 ms |

O sea que materializar **todos** los caminos —no solo las 12 patas que el circuito termina usando—
cuesta el 0,7 % de resolver el circuito. El costo no era un argumento.

Lo que sí importa es que **la distancia es una propiedad del camino y no al revés**: el modelo es un
recorrido. Con una sola decisión compartida —`bestRoute(a,b)` elige cuál de las tres rutas conviene,
`cellDistance` devuelve su largo, `pathBetween` materializa sus celdas— es imposible que el dibujo y el
sonido cuenten cosas distintas. Con dos implementaciones separadas haría falta un test para atarlas.

Y hay un tercer motivo, de diseño: **esquivar las piezas colocadas** (fuera de alcance, pero previsto)
no tiene forma cerrada. Ahí la distancia solo se obtiene recorriendo, así que un modelo apoyado en la
fórmula cerrada como concepto primario tendría que reescribirse.

**El invariante, verificado sobre las 3.600 combinaciones**:
`pathBetween(a,b).length === cellDistance(a,b) − 1` para todo par de celdas **distintas**. Falla en
exactamente **60 casos**, que son las 60 celdas comparadas consigo mismas: con `d = 0` no existe un
camino de largo −1. O sea que el test recorre 3.600 pares y **asevera sobre 3.540**: 60 × 60 menos la
diagonal. Los dos números aparecen en el spec y en el plan y no son intercambiables. Ese caso queda excluido explícitamente y no ocurre en el circuito — la salida de
una pieza y la entrada de otra no pueden ser la misma celda si las piezas no se solapan, y la entrada
y la salida de una misma pieza son sus grados 0 y 4, que son celdas distintas.

Un dato del propio proceso de medición, que vale como advertencia: la primera implementación de
`pathBetween` que se escribió para medir **fallaba el invariante 114 veces**, todas en los bordes de
la costura (cuando el origen ya *es* la esquina, o el destino lo es). El invariante lo atrapó de
inmediato. No es un test decorativo: es el que hace que el dibujo y el sonido no puedan discrepar.

## 3. El circuito: exacto contra greedy

| Medición | Valor |
|---|---|
| Held-Karp con 9 piezas | **0,12 ms** por corrida |
| Held-Karp con 12 piezas | **1,87 ms** por corrida |
| Vecino más cercano vs óptimo (8 piezas, 300 tableros) | **+20,1 % en promedio** |
| Peor caso del greedy | **+79 %** |

El tope de 12 es **estructural**: hay 12 pentominós libres y no se repiten. Held-Karp es
`O(n² · 2ⁿ)`, o sea 12² × 4.096 ≈ 590 mil operaciones en el peor caso posible del juego. El argumento
habitual contra el TSP exacto —que no escala— no aplica cuando el `n` máximo está fijado por las reglas.

El circuito es **dirigido y asimétrico**: el costo de ir de la pieza `i` a la `j` es
`dist(salida(i), entrada(j))`, y no es igual al de volver. Held-Karp lo soporta sin cambios.

## 4. La forma del ciclo (medido sobre 200 tableros aleatorios por tamaño)

`ciclo = 4n + Σ saltos` intervalos: cada pieza abarca 4 intervalos de su primera a su última nota, más
lo que cuesta llegar a la siguiente.

| Piezas | Σ saltos | Ciclo (intervalos) | Ciclo a 110 bpm | Salto más largo visto | Tableros que usan la costura |
|---|---|---|---|---|---|
| 2 | 10,2 | 18,2 | **2,48 s** | 12 | 12 % |
| 3 | 13,4 | 25,4 | 3,46 s | 11 | 30 % |
| 4 | 16,3 | 32,3 | **4,40 s** | 10 | 27 % |
| 6 | 20,1 | 44,1 | 6,02 s | 8 | 40 % |
| 8 | 22,8 | 54,8 | **7,47 s** | 7 | 42 % |
| 10 | 25,8 | 65,8 | 8,98 s | 7 | 50 % |

Dos cosas que salen de acá:

- **El ciclo crece sublinealmente en saltos**: de 2 a 10 piezas los saltos apenas se duplican (10,2 →
  25,8) mientras las notas se quintuplican. Cuantas más piezas, **más denso** el patrón, no más largo
  en proporción. Es exactamente el comportamiento deseable en un instrumento.
- **El salto más largo se acorta al poblarse el tablero** (12 → 7): con más piezas, siempre hay una
  más cerca. El riesgo de "silencios enormes" es un problema de tableros vacíos, no de llenos.

Textura, a modo de referencia:

```
4 piezas → 20 notas y 12,1 clicks por ciclo · 8,0 s a 60 bpm · 4,4 s a 110 · 3,0 s a 160
8 piezas → 40 notas y 14,7 clicks por ciclo · 13,7 s a 60 bpm · 7,5 s a 110 · 5,1 s a 160
```

**Esa columna de "ciclo a 110 bpm" es también la latencia máxima de D5**: lo que se espera para
escuchar una pieza recién colocada. Es el número que hay que mirar al probarlo.

## 5. El tablero lleno es un rompecabezas, no un caso de uso

12 piezas × 5 celdas = 60 celdas = **el tablero entero**. Colocar las 12 es teselar un 6×10 con los 12
pentominós, que es un problema clásico con soluciones contadas. Medido con colocación aleatoria válida,
sobre 200 intentos por tamaño:

| Piezas pedidas | Tableros logrados | Ocupación |
|---|---|---|
| 8 | 200 / 200 | 67 % |
| 10 | 72 / 200 | 83 % |
| 11 | 4 / 200 | 92 % |
| 12 | **0 / 200** | 100 % |

O sea: el `n` real está entre 1 y 10, y el peor caso de Held-Karp (12) casi no se alcanza jugando.

## 6. Cómo queda el scheduler

La propiedad del spec 002 —*"el reloj es un origen, no un cursor"*— **sobrevive entera**:

```
hoy:    onset = origin + (k + phase) × bar          phase ∈ [0,1), fracción de compás
queda:  onset = origin + (k × ciclo + offset + j) × intervalo
```

con `offset` el desplazamiento entero de la pieza dentro del ciclo, en intervalos, y `j` el índice de
la nota dentro de la pieza. Escrito como fracción del ciclo, `phase = offset / cicloIntervalos`, es la
**misma** progresión: `firstOnsetAfter` no cambia ni una línea, y `scheduledUntil` sigue siendo lo que
evita re-emitir. Se conserva por lo tanto la propiedad audible que el 004 midió: **nunca hay más de
`LOOKAHEAD` comprometido**, así que pausar corta en 100 ms con cualquier tamaño de ciclo.

Lo que sí es nuevo:

- **El swap en el cierre de ciclo (D5).** El motor guarda una secuencia **activa** y una
  **pendiente**. `tick()` cambia una por otra al cruzar el borde del ciclo, y ese borde pasa a ser el
  nuevo `origin`. Caso especial: si la activa está **vacía**, la pendiente entra en vigor ya —si no, la
  primera pieza no sonaría nunca, porque no hay ciclo que cerrar.
- **`Hit` deja de ser una sola cosa**: hay notas y hay clicks. Conjunto cerrado, así que const-object
  más union type derivado, **nunca un `enum`** (`erasableSyntaxOnly` los rechaza, y es la opción que
  permite que node cargue el dominio sin compilar).

## 7. El click: la capa de audio solo sabe hacer osciladores

`voice.ts` tiene una sola forma de producir sonido: `OscillatorNode` + envolvente ADSR
(`DEFAULT_VOICE`, `type: 'triangle'`). Un click sin altura pide **ruido**, que es un
`AudioBufferSourceNode` con un buffer de muestras aleatorias — un nodo que la capa nunca creó.

Los tests corren contra `node-web-audio-api`, no contra el navegador, así que había que verificar que
ese entorno implemente `createBuffer`/`AudioBufferSourceNode` antes de comprometerse. **Medido —
soporta los dos**: sobre un `OfflineAudioContext(1, 44100, 44100)` de esa librería, `createBuffer`,
`getChannelData`, `createBufferSource` y `startRendering` corren y la muestra escrita en el buffer
llega intacta a la salida (`0.5` adentro, `0.5` renderizado). O sea que el ruido es viable en los tests
y la decisión ya no queda abierta al implementar.

Plan B, si el ruido igual no convence a oído: un oscilador con envolvente de ~10 ms, que suena a click
percusivo y usa solo lo que ya funciona. Pasa a ser una decisión de timbre, no de entorno.

## 8. Archivos afectados

| Archivo | Acción |
|---|---|
| `src/domain/constants/board.constants.ts` | la costura: las dos celdas que se repliegan. Y **el docblock de `GRID_W`**, que hoy dice que el ancho es la cantidad de posiciones dentro del compás |
| `src/domain/constants/route.constants.ts` | **nuevo** — el const-object de `RouteKind`: los módulos de capa no declaran constantes |
| `src/domain/board.ts` | `bestRoute`, `cellDistance` y `pathBetween`, las tres sobre la misma decisión; **sale** `phaseFor` |
| `src/domain/sequence.ts` | **nuevo** — puertas por pieza, matriz de costos, Held-Karp, offsets del ciclo y la celda de cada click |
| `src/domain/types/sequence.types.ts` | **nuevo** — `Step`, `Click`, `Sequence` y `RouteKind`: los tipos que cruzan un límite van a `<capa>/types/`, no al módulo |
| `src/domain/__tests__/sequence.test.ts` | **nuevo** — AC1, AC2, AC3, AC10 |
| `src/domain/__tests__/board.test.ts` | mueren los 5 tests de `phaseFor`; entran los de `cellDistance` |
| `src/audio/types/scheduler.types.ts` | `Job` → `Sequence`; `Hit` gana su tipo |
| `src/audio/constants/` | el tipo de hit; el volumen del click |
| `src/audio/scheduler.ts` | `collectHits` cambia de período y expande clicks; `firstOnsetAfter` no se toca |
| `src/audio/voice.ts` | `scheduleClick` |
| `src/audio/engine.ts` | `setSequence` con activa/pendiente y swap en el cierre de ciclo |
| `src/audio/__tests__/` | scheduler, voice e integración |
| `src/App.tsx` | el efecto de reconciliación arma la secuencia y la entrega entera |
| `mcp-server/src/tools/simulateBoard.ts` | reescritura: orden, saltos, ciclo, timeline con clicks |
| `mcp-server/src/__tests__/tools.test.ts` | **los cuatro asserts sobre `phase`** (`:202,208,211,262`) se caen con el campo; sin tocarlos `pnpm mcp:test` queda rojo |
| `docs/architecture/audio.md`, `modelo-musical.md` | la fase por pieza deja de existir |
| `docs/architecture/overview.md`, `directory-structure.md`, `docs/guides/mcp-domain.md` | **las tres nombran `phaseFor` en un inventario de `board.ts`**: entran `cellDistance`, `pathBetween` y `sequence.ts` |
| `.claude/rules/audio.md`, `domain.md` | ídem |
| `specs/log.md` | el 004 pasa a `Superado` |

## 9. Deuda adyacente detectada (fuera de alcance)

- **`PlacedPiece.notes` se vuelve claramente redundante** con la secuencia armada desde el mapeo del
  007. Su retiro ya estaba anotado como seguimiento; después de este spec no queda ninguna excusa.
- **`occupantAt` recorre todas las piezas por celda** y el render lo llama 60 veces. Con el 010
  dibujando la cabeza lectora a ritmo de intervalo, conviene medirlo antes de que moleste.
- **La dirección de dependencia *dentro* de `domain/` está documentada pero no linteada.**
  `sequence.ts` se apoya en `board.ts` y `music.ts`; si alguna vez se quiere hacer cumplir, es una
  regla más en el override de `eslint.config.js`.

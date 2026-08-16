# Research — El tablero como recorrido

Todo lo de acá se midió **ejecutando el dominio real** (`transform.ts`, `board.ts`,
`pieces.constants.ts`) sobre tableros aleatorios válidos, con un script descartable. Node 22 corre los
`.ts` del dominio sin compilar, que es la misma propiedad de la que vive el MCP server.

## 1. Lo que hay hoy, y lo que se va

| Pieza del modelo actual | Dónde | Qué le pasa |
|---|---|---|
| `phaseFor(cells, anchorIndex)` = columna / `GRID_W` | `domain/board.ts:41-57` | **muere** |
| Sus 5 tests | `domain/__tests__/board.test.ts:96-121` | mueren |
| `Job.phase` | `audio/types/scheduler.types.ts:6-17` | muere; lo reemplaza el offset dentro del ciclo |
| `Job` entero (`id`, `notes`) | ídem | lo reemplaza una `Sequence` con offsets |
| `addJob` / `removeJob` / `clearJobs` / `jobCount` | `audio/engine.ts:116-120` | los reemplaza `setSequence` |
| El período de `collectHits` | `audio/scheduler.ts:89` | pasa de `bar` a `ciclo` |
| `firstOnsetAfter` | `audio/scheduler.ts:38-41` | **no cambia** |
| `simulate_board`: `phase` en jobs y en `placements` | `mcp-server/src/tools/simulateBoard.ts:185,220` | se reescribe |
| Su `description`: *"la columna de la celda de agarre es la posición dentro del compás"* | ídem `:170-172` | pasa a ser falsa |
| `docs/architecture/modelo-musical.md` §fase, `audio.md#fase-por-pieza` | | se reescriben |

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

Los tests corren contra `node-web-audio-api`, no contra el navegador, así que hay que verificar que ese
entorno implemente `createBuffer`/`AudioBufferSourceNode` antes de comprometerse. Plan B: un oscilador
con envolvente de ~10 ms, que suena a click percusivo y usa solo lo que ya funciona.

## 8. Archivos afectados

| Archivo | Acción |
|---|---|
| `src/domain/constants/board.constants.ts` | la costura: las dos celdas que se repliegan |
| `src/domain/board.ts` | `cellDistance(a, b)` con la costura; **sale** `phaseFor` |
| `src/domain/sequence.ts` | **nuevo** — puertas por pieza, matriz de costos, Held-Karp, offsets del ciclo |
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
| `docs/architecture/audio.md`, `modelo-musical.md` | la fase por pieza deja de existir |
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

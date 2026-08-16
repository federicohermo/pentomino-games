# Plan — El tablero como recorrido

Seis pasos. Los tres primeros son **dominio puro y no producen ningún sonido**: se pueden mergear y
testear sin tocar el motor. El paso 4 es el que cambia lo que se oye. Es deliberado: el riesgo de este
spec está concentrado en un solo paso, y hasta el 4 el instrumento sigue sonando como el 008 lo dejó.

## 0. La línea base

Guardar `simulate_board` con un tablero fijo, **antes** de la rama. Acá no sirve para exigir igualdad
—todo va a cambiar— sino para el PR: mostrar lado a lado el patrón viejo (todo dentro de un compás) y
el nuevo (un recorrido).

## 1. La costura y la distancia → `domain/board.ts`

```ts
// domain/constants/board.constants.ts
export const SEAM: readonly [Cell, Cell] = [[0, 0], [GRID_W - 1, GRID_H - 1]];

// domain/board.ts
export function cellDistance(a: Cell, b: Cell): number
```

Tres términos y un `min`, sin BFS ni estructuras (D2). La costura sale de una constante y no de
literales: el día que se quiera mover, se mueve en un lugar.

Tests: `(0,0)`→`(9,5)` da 1; la distancia máxima del tablero es 12; simetría (`d(a,b) === d(b,a)`);
desigualdad triangular sobre las 3.600 combinaciones — barata y es la que atrapa un `min` mal escrito.

**En el mismo paso se borra `phaseFor` y sus 5 tests, en su propio commit**, como pide el repo para
los borrados.

## 2. La secuencia → `domain/sequence.ts` (nuevo)

```ts
export interface Step { pieceId: string; offset: number; notes: number[] }   // offset en intervalos
export interface Sequence { steps: Step[]; clicks: number[]; length: number } // length = ciclo

export function buildSequence(placed: readonly PlacedPiece[]): Sequence
```

Adentro, en este orden:

1. **Puertas**: la celda de entrada es la del grado 0 y la de salida la del grado 4, con el mapeo del
   spec 007 calculado sobre la forma canónica y leído por índice (su D3). Con una sola pieza, entrada y
   salida son las de esa misma pieza y el ciclo es el salto de ella a sí misma.
2. **Matriz de costos** `coste[i][j] = cellDistance(salida(i), entrada(j))`. Asimétrica.
3. **Held-Karp** sobre el circuito dirigido. Determinista: ante dos circuitos de igual costo gana el
   primero en orden de índice, y hay un test que lo fija — sin eso, dos tableros idénticos podrían
   sonar distinto según cómo el motor de JS recorrió el `for`.
4. **Offsets**: acumulando `4 + salto` intervalo a intervalo. `clicks` son las posiciones intermedias
   de cada salto: un salto de `d` produce `d − 1` clicks.

Es todo pura aritmética sobre enteros. Sin `Math.random`, sin fecha, sin flotantes: el mismo tablero da
siempre la misma secuencia, que es la propiedad que el spec 004 ya había peleado y hay que no perder.

**Casos borde que van con test desde el principio**: cero piezas (secuencia vacía, `length === 0`), una
pieza, y dos piezas adyacentes (salto 1 → contiguo, AC3).

## 3. Los tipos del motor

`Job` desaparece. `Sequence` entra al motor **tal como la devuelve el dominio** — el motor no la
recalcula ni la reordena, solo la lee.

`Hit` deja de ser una sola cosa:

```ts
// constants: conjunto cerrado = const-object + union derivado. NUNCA enum.
export const HIT = { note: 'note', click: 'click' } as const;
export type HitKind = typeof HIT[keyof typeof HIT];
```

Un click no tiene `hz`, así que el tipo se modela como unión discriminada y no como `hz` opcional: un
`hz?: number` dejaría pasar en silencio un click con altura, que es el mismo argumento por el que
`Job.phase` era obligatoria.

## 4. `collectHits` y el swap de ciclo

**`firstOnsetAfter` no se toca.** Lo único que cambia es qué se le pasa: el período es
`sequence.length × intervalDuration(bpm)` en vez del compás, y la fase de cada paso es
`offset / sequence.length`.

```ts
for (const step of sequence.steps)
  for (let at = firstOnsetAfter(from, origin, ciclo, step.offset / sequence.length); at <= until; at += ciclo)
    step.notes.forEach((m, i) => out.push({ kind: HIT.note, hz: midiToHz(m), at: at + i * intervalo }));
```
y lo mismo para `clicks`, que son offsets sueltos sin notas.

En `engine.ts`:

- `setSequence(next)` guarda la **pendiente**. No toca la activa.
- `tick()`, antes de recolectar: si el reloj cruzó el borde del ciclo y hay pendiente, la activa pasa a
  ser la pendiente y **ese borde pasa a ser el nuevo `origin`** (D5).
- Si la activa está vacía, la pendiente entra en vigor **ya**, con `origin = currentTime +
  CLOCK_START_DELAY` y `scheduledUntil` estrictamente **antes** de `origin` — la misma regla que
  `startClock` ya tiene, y por el mismo motivo: si no, se pierde el primer onset.

El `scheduleVoice` del click va aparte, en `voice.ts`, con volumen propio. Primero se verifica que
`node-web-audio-api` soporte `AudioBufferSourceNode`; si no, oscilador de envolvente corta (ver
`research.md` §7).

## 5. `App.tsx` y `simulate_board`

- El efecto de reconciliación deja de iterar piezas y pasa a **una sola llamada**:
  `setSequence(buildSequence(placed))`. Sigue siendo el único lugar del repo que le habla al motor, y
  ahora es más chico que antes. `clearJobs` en la limpieza pasa a `setSequence(vacía)`.
- `simulate_board` se reescribe: arma la secuencia con `buildSequence` —**importándola**, no
  reimplementándola— y devuelve el orden del circuito, los saltos entre piezas, el largo del ciclo en
  intervalos y en segundos, y la `timeline` con notas y clicks distinguidos. Su `description` se
  reescribe entera: la frase sobre columnas que se desfasan es del modelo viejo.

## 6. Documentación y verificación

Docs: `modelo-musical.md` (la sección de fase se reemplaza por la del recorrido), `audio.md`
(`#fase-por-pieza`), las dos reglas de `.claude/rules/`, la tabla de `CLAUDE.md`, y `log.md` con el 004
a `Superado`.

| Qué | Cómo |
|---|---|
| AC1, AC2, AC3, AC10 | `pnpm test` sobre `domain/__tests__/sequence.test.ts` |
| AC4 | `simulate_board` con `bars` que cubran **dos ciclos**: el espaciado en el empalme es igual al de adentro |
| AC5 | Test del motor: cambiar la secuencia a mitad de ciclo no altera los hits hasta el borde |
| AC6 | Test ya existente del scheduler, con un ciclo largo |
| AC7 | `simulate_board`: un salto de `d` celdas produce `d − 1` clicks equiespaciados |
| AC8 | `pnpm verify` — que `phaseFor` no exista lo verifica el compilador en los dos paquetes |
| AC9, AC11 | `pnpm verify` + una consulta a la tool |
| A oído | Un tablero de 2 piezas adyacentes (tiene que sonar contiguo), uno de 2 piezas en esquinas opuestas (tiene que sonar el recorrido), y uno de 8 |

## Lo que un revisor va a esperar y no va a encontrar

Que colocar una pieza se escuche al toque. **Puede tardar hasta un ciclo entero** —7,5 s con 8 piezas a
110 bpm— y es a propósito (D5): es el precio de que el patrón no salte a mitad de frase cuando el
circuito se reordena. Está medido en `research.md` §4 y es lo primero que hay que probar a oído.

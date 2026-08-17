# Plan — El tablero como recorrido

Seis pasos. Los tres primeros son **dominio puro y no producen ningún sonido**: se pueden mergear y
testear sin tocar el motor. El paso 4 es el que cambia lo que se oye. Es deliberado: el riesgo de este
spec está concentrado en un solo paso, y hasta el 4 el instrumento sigue sonando como el 008 lo dejó.

## 0. La línea base

Guardar `simulate_board` con un tablero fijo, **antes** de la rama. Acá no sirve para exigir igualdad
—todo va a cambiar— sino para el PR: mostrar lado a lado el patrón viejo (todo dentro de un compás) y
el nuevo (un recorrido).

## 1. La costura, la distancia y el camino → `domain/board.ts`

```ts
// domain/constants/board.constants.ts
export const SEAM: readonly [Cell, Cell] = [[0, 0], [GRID_W - 1, GRID_H - 1]];

// domain/constants/route.constants.ts — el const-object
export const ROUTE = { direct: 'direct', viaEnd: 'viaEnd', viaStart: 'viaStart' } as const;
// domain/types/sequence.types.ts — el union derivado
export type RouteKind = typeof ROUTE[keyof typeof ROUTE];

// domain/board.ts — UNA decisión, tres lecturas de ella
function bestRoute(a: Cell, b: Cell): { length: number; via: RouteKind }
export function cellDistance(a: Cell, b: Cell): number    // el largo
export function pathBetween(a: Cell, b: Cell): Cell[]     // las celdas INTERMEDIAS, sin a ni b
```

El const-object va a `constants/` y el union a `types/`, no adentro de `board.ts`: la regla del repo es
que **un módulo de capa tiene funciones y nada más** (`CLAUDE.md`, y la tabla de
`docs/architecture/directory-structure.md:163-164`). El docblock de `GRID_W` se corrige en el mismo
commit: hoy dice que el ancho del tablero es la cantidad de posiciones dentro del compás, y este spec
lo deja de ser.

`bestRoute` compara los tres términos de D2 y dice cuál gana: directo, por la costura entrando por
`(9,5)`, o por la costura entrando por `(0,0)`. `cellDistance` devuelve su largo y `pathBetween`
materializa sus celdas con la regla **primero en X, después en Y** (D8). Ninguna de las dos vuelve a
decidir: **por eso no pueden discrepar**. `RouteKind` es un conjunto cerrado, así que const-object más
union derivado, nunca un `enum`.

La costura sale de una constante y no de literales: el día que se quiera mover, se mueve en un lugar.

Tests: `(0,0)`→`(9,5)` da 1; la distancia máxima del tablero es 12; simetría (`d(a,b) === d(b,a)`);
desigualdad triangular sobre las 3.600 combinaciones — barata y es la que atrapa un `min` mal escrito.

Y el que ata el dibujo al sonido, **AC7b**: `pathBetween(a,b).length === cellDistance(a,b) − 1` sobre
las **3.540** combinaciones de celdas **distintas**, más que las celdas del camino sean adyacentes de a
pares y no se repitan. El caso `a === b` se excluye a propósito y va documentado en la función: con
`d = 0` no hay camino de largo −1, y no ocurre en ninguna pata del circuito.

Ojo con los bordes de la costura —que el origen ya *sea* la esquina, o que lo sea el destino—: es
donde falló la implementación de prueba que se usó para medir, 114 veces sobre 3.600
(`research.md` §2b). Escribir ese test **antes** que la función.

**En el mismo paso se borra `phaseFor` y sus 5 tests, en su propio commit**, como pide el repo para
los borrados.

## 2. La secuencia → `domain/sequence.ts` (nuevo)

```ts
// domain/types/sequence.types.ts — los tipos que cruzan un límite NO viven en el módulo
export interface Step { pieceId: string; offset: number; notes: number[] }   // offset en intervalos
export interface Click { offset: number; cell: Cell }                        // dónde y cuándo
export interface Sequence { steps: Step[]; clicks: Click[]; length: number } // length = ciclo

// domain/sequence.ts
export function buildSequence(placed: readonly PlacedPiece[]): Sequence
```

Un click lleva su **celda** además de su instante (D8). Para sonar alcanzaría con contarlos —el click
no tiene altura y suena igual en cualquier lado—, pero el recorrido *es* el modelo: la celda es el
dato, y el instante es lo que se deriva de ella.

Adentro, en este orden:

1. **Puertas**: la celda de entrada es la del grado 0 y la de salida la del grado 4, con el mapeo del
   spec 007 calculado sobre la forma canónica y leído por índice (su D3). Con una sola pieza, entrada y
   salida son las de esa misma pieza y el ciclo es el salto de ella a sí misma.
2. **Matriz de costos** `coste[i][j] = cellDistance(salida(i), entrada(j))`. Asimétrica.
3. **Held-Karp** sobre el circuito dirigido. Determinista: ante dos circuitos de igual costo gana el
   primero en orden de índice, y hay un test que lo fija — sin eso, dos tableros idénticos podrían
   sonar distinto según cómo el motor de JS recorrió el `for`.
4. **Offsets**: acumulando `4 + salto` intervalo a intervalo. Los `clicks` de cada salto salen de
   `pathBetween(salida, entrada)`: la celda `i` del camino suena en el intervalo `i + 1` después de la
   última nota de la pieza. Un salto de `d` da `d − 1` clicks, y **la cantidad no se calcula aparte**:
   es el largo del camino.

Es todo pura aritmética sobre enteros. Sin `Math.random`, sin fecha, sin flotantes: el mismo tablero da
siempre la misma secuencia, que es la propiedad que el spec 004 ya había peleado y hay que no perder.

**Casos borde que van con test desde el principio**: cero piezas (secuencia vacía, `length === 0`), una
pieza, y dos piezas adyacentes (salto 1 → contiguo, AC3).

## 3. Los tipos del motor

`Job` desaparece. El motor no recalcula ni reordena nada: solo lee lo que le entregan.

**Pero no es literalmente la `Sequence` del dominio.** `Click` lleva un `Cell`, que es un tipo de
`domain/types/`, y `eslint.config.js:75-91` prohíbe que `src/audio/**` importe `../domain/*` —con la
variante de `typescript-eslint`, que también ve los `import type`—. Importarlo no falla en el
navegador: falla `pnpm lint`, o sea AC11.

**La decisión: el motor no ve celdas.**

```ts
// audio/types/scheduler.types.ts — la Sequence del MOTOR, sin nada del dominio
export interface Sequence {
  steps: { offset: number; notes: number[] }[];   // sin pieceId: el motor no tiene a quién devolvérselo
  clicks: { offset: number }[];                   // sin cell: para sonar solo hace falta contar
  length: number;
}
```

El click no tiene altura y suena igual en cualquier lado (D4), así que la celda no es información que
el motor pueda usar. `App.tsx`, que ya es el único puente entre las dos capas, entrega
`buildSequence(placed)` dejando caer las celdas — una proyección, no una traducción: los `offset` y los
`notes` viajan tal cual, y el motor sigue sin recalcular ni reordenar nada.

Las celdas **no se pierden**: siguen en el dominio, que es de donde el spec 010 las va a leer para
dibujar. El 010 no necesita sacárselas al motor, y de hecho no puede — `Spectrum.tsx` es el único
componente que lee del motor, y lee el espectro, no la secuencia.

**Lo que sí hay que reponer es la observabilidad.** `jobCount()` no es un resto: `.claude/rules/audio.md`
lo nombra como **la** forma de verificar el audio en el navegador sin oírlo ("con `jobCount()` y
contando osciladores"). Si desaparece con `addJob`, esa receta queda rota. Lo reemplaza una función
igual de barata sobre la secuencia activa —cuántos pasos, cuántos clicks y cuánto mide el ciclo—, y la
regla se actualiza con el nombre nuevo en el mismo commit.

Las dos alternativas quedan registradas por si alguien las vuelve a proponer: **duplicar `Cell` en
`audio/types/`** deja dos definiciones que alguien tiene que mantener iguales, que es lo que la regla
de constantes del repo existe para evitar; **aflojar el override del linter** compra la comodidad
tirando abajo la separación que D7 dice conservar, y que desde el spec 005 sostiene el grafo de imports
y no un comentario.

Así D7 se cumple al pie de la letra —«el motor recibe una lista de instantes y frecuencias y sigue sin
saber qué es un pentominó»— y D8 también, porque el camino sigue siendo el concepto primario del
dominio. Lo verifica AC12.

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
- **En ese swap hay que bajar `scheduledUntil` a justo antes del nuevo `origin`** (AC13). No es
  simetría con el caso de abajo: es la misma trampa que `.claude/rules/audio.md` ya registra. El
  horizonte es de 100 ms y el borde se detecta cada 25 ms, así que al cruzarlo `scheduledUntil` ya está
  **adelante** del borde; si se lo deja quieto, `firstOnsetAfter` arranca la secuencia nueva después de
  su propio comienzo y **el primer onset del ciclo nuevo se pierde en silencio** — el mismo bug que
  `startClock` evita, con el mismo síntoma y sin ningún error. El precio del ajuste es el simétrico y
  hay que verificarlo en el test: los hits de la secuencia **vieja** ya agendados más allá del borde no
  tienen que volver a salir desde la nueva.
- Si la activa está vacía, la pendiente entra en vigor **ya**, con `origin = currentTime +
  CLOCK_START_DELAY` y `scheduledUntil` estrictamente **antes** de `origin` — la misma regla que
  `startClock` ya tiene, y por el mismo motivo: si no, se pierde el primer onset.
- **Con `sequence.length === 0` no hay borde que cruzar.** El período del ciclo es `length × intervalo`,
  o sea 0, y calcular el borde con eso divide por cero o lo da por cruzado en cada tick. La guarda va
  explícita: sin pasos no se recolecta y no se busca borde. Es el estado real de "quité la última
  pieza", no un caso teórico.

El `scheduleVoice` del click va aparte, en `voice.ts`, con volumen propio. Primero se verifica que
`node-web-audio-api` soporte `AudioBufferSourceNode`; si no, oscilador de envolvente corta (ver
`research.md` §7).

## 5. `App.tsx` y `simulate_board`

- El efecto de reconciliación deja de iterar piezas y pasa a **una sola llamada**:
  `setSequence(buildSequence(placed))`. Sigue siendo el único lugar del repo que le habla al motor, y
  ahora es más chico que antes. `clearJobs` en la limpieza pasa a `setSequence(vacía)`.
- `simulate_board` se reescribe: arma la secuencia con `buildSequence` —**importándola**, no
  reimplementándola— y devuelve el orden del circuito, los saltos entre piezas **con las celdas que
  cruzan**, el largo del ciclo en intervalos y en segundos, y la `timeline` con notas y clicks
  distinguidos. Que el camino salga en la respuesta es lo que permite verificar el recorrido sin
  escucharlo, que es el propósito entero de la tool. Su `description` se
  reescribe entera: la frase sobre columnas que se desfasan es del modelo viejo.
- **Y se reescribe su entrada, no solo su salida.** `bars: 1–8` pasa a `cycles: 1–4` (default 2):

  ```ts
  cycles: z.number().int().min(1).max(4).default(2)
    .describe('Cuántas vueltas del circuito simular. El ciclo lo fija el tablero, no el tempo.')
  ```

  El tope de 4 no es el de 8 dividido a ojo: con `bars` el costo del bucle de ventanas dependía del
  tempo y del tablero a la vez, y con `cycles` el peor caso está acotado —10 piezas son 8,98 s de ciclo
  a 110 bpm (`research.md` §4), o sea ~36 s de simulación con 4—. `jobTimeline` deja de existir como
  tal: el corte por onset que resolvía el problema de la fase ya no aplica, porque ahora hay una sola
  secuencia con un solo origen y el límite es el fin del último ciclo pedido.

## 6. Documentación y verificación

Docs: `modelo-musical.md` (la sección de fase se reemplaza por la del recorrido), `audio.md`
(`#fase-por-pieza`), las dos reglas de `.claude/rules/`, la tabla de `CLAUDE.md`, y `log.md` con el 004
a `Superado`.

Y las **tres que el inventario original no tenía**, todas con `phaseFor` escrito en una lista de lo que
exporta `board.ts`: `docs/architecture/overview.md:42,77`,
`docs/architecture/directory-structure.md:60` y `docs/guides/mcp-domain.md:36`. Es el mismo hallazgo
que dejó anotado el review del 007 —*un spec que cambia lo que algo dice tiene que revisar todo lo que
lo dice*—, y acá el inventario sí lo da un `grep` de un solo símbolo.

| Qué | Cómo |
|---|---|
| AC1, AC2, AC3, AC10 | `pnpm test` sobre `domain/__tests__/sequence.test.ts` |
| AC4 | `simulate_board` con `cycles: 2`: el espaciado en el empalme es igual al de adentro |
| AC5 | Test del motor: cambiar la secuencia a mitad de ciclo no altera los hits hasta el borde |
| AC6 | Test ya existente del scheduler, con un ciclo largo |
| AC7 | `simulate_board`: un salto de `d` celdas produce `d − 1` clicks equiespaciados, con su celda |
| **AC7b** | Test: `pathBetween.length === cellDistance − 1` sobre las **3.540** combinaciones de celdas distintas |
| AC8 | `pnpm verify` — que nadie **importe** `phaseFor` lo verifica el compilador en los dos paquetes; que la función y sus 5 tests estén **borrados** es el commit aparte, y no lo verifica nada automático |
| AC9, AC11 | `pnpm verify` + una consulta a la tool |
| **AC12** | `pnpm lint`: el override de `src/audio/**` de `eslint.config.js` falla si el motor importa del dominio, incluso con `import type` |
| **AC13** | Test del scheduler: un ciclo corto, una ventana que cruce el borde, y ni un onset perdido ni uno repetido en el empalme |
| A oído | Un tablero de 2 piezas adyacentes (tiene que sonar contiguo), uno de 2 piezas en esquinas opuestas (tiene que sonar el recorrido), y uno de 8 |

## Lo que un revisor va a esperar y no va a encontrar

Que colocar una pieza se escuche al toque. **Puede tardar hasta un ciclo entero** —7,5 s con 8 piezas a
110 bpm— y es a propósito (D5): es el precio de que el patrón no salte a mitad de frase cuando el
circuito se reordena. Está medido en `research.md` §4 y es lo primero que hay que probar a oído.

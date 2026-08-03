# Plan 005 — Diseño de la modularización de `src/`

## Árbol objetivo

```
src/
├── main.tsx                          entry: createRoot + StrictMode + ./styles/index.css
├── App.tsx                           estado + composición. Sin puras, sin literales de dominio
├── vite-env.d.ts
├── styles/
│   └── index.css                     @import "tailwindcss" + estilos globales
├── domain/                           puro. Sin React, sin Web Audio, sin DOM
│   ├── transform.ts                  rotate90 · normalize · rotateN · reflect
│   ├── board.ts                      cellsAt · isValid · occupantAt
│   ├── music.ts                      midiFor · midiName · notesForRotation
│   ├── invariants.ts                 checkArrayOrder · checkAnchors · checkShapes ·
│   │                                 checkBaseMap · checkNotes · checkAll
│   ├── types/                        el contrato de la capa. CERO imports
│   │   ├── transform.types.ts        Cell
│   │   ├── pieces.types.ts           PieceKey
│   │   └── board.types.ts            PlacedPiece
│   ├── constants/                    los datos del modelo. Solo importan tipos
│   │   ├── pieces.constants.ts       SHAPES · ANCHOR_INDEX
│   │   ├── board.constants.ts        GRID_W · GRID_H
│   │   └── music.constants.ts        CHROMATIC · PENT_MAJOR · PENT_MINOR · PENT_BLUES5 ·
│   │                                 BASE_MAP · DEFAULT_OCTAVE
│   └── __tests__/
│       ├── transform.test.ts
│       ├── board.test.ts
│       ├── music.test.ts
│       └── invariants.test.ts
├── audio/                            Web Audio. Habla MIDI; no conoce el dominio ni la UI
│   ├── voice.ts                      midiToHz · scheduleVoice
│   ├── scheduler.ts                  collectHits
│   ├── engine.ts                     singletons · audio() · playNow · addJob · startClock · …
│   ├── types/
│   │   ├── voice.types.ts            VoiceOpts
│   │   └── scheduler.types.ts        Job · ClockState · Hit
│   ├── constants/
│   │   ├── voice.constants.ts        DEFAULT_VOICE · NOTE_DUR · DEFAULT_VELOCITY
│   │   ├── scheduler.constants.ts    LOOKAHEAD · TICK_MS
│   │   └── engine.constants.ts       MASTER_GAIN · ARPEGGIO_SPREAD · DEFAULT_BPM ·
│   │                                 PLAY_DELAY · CLOCK_START_DELAY
│   └── __tests__/
│       ├── voice.test.ts             midiToHz + sintesis            (7 tests)
│       ├── scheduler.test.ts         scheduler                      (8 tests)
│       ├── integration.test.ts       scheduler + sintesis           (2 tests)
│       └── test-context.ts           helpers de OfflineAudioContext (no es un test)
└── components/                       un componente por archivo, presentacionales
    ├── PiecePalette.tsx
    ├── Board.tsx
    ├── PiecePreview.tsx
    ├── PlacedList.tsx
    └── constants/
        └── layout.constants.ts       CELL_PX · PREVIEW_CELL_PX · TEMPO_MIN · TEMPO_MAX
```

**`pieces.ts` no aparece**: su contenido eran dos tablas de datos sin una sola función, así que se
disuelve en `constants/pieces.constants.ts`. Su test también desaparece — lo que había que verificar de
esas tablas (5 celdas, sin repetidas, conexas) es `checkShapes` en `invariants.ts`.

Desaparecen: `src/index.tsx` (→ `main.tsx`), `src/index.css` (→ `styles/`), `src/setupTests.ts`
(muerto), `src/audio/engine.test.ts` (repartido en tres).

**Ninguna carpeta de rol vacía.** `schemas/`, `utils/`, `hooks/` y `lib/` no se crean: la tabla de D12
del spec dice dónde va cada una cuando aparezca su primer archivo.

## Las reglas que gobiernan todos los imports

1. **Dirección única.** `domain/` y `audio/` no importan nada de fuera de su carpeta, ni entre ellas.
   `components/` y `App.tsx` importan de las dos. Nadie importa hacia `components/` desde abajo.
2. **`<capa>/types/` no importa nada** y **`<capa>/constants/` solo importa tipos.** Son las hojas del
   grafo y el contrato que consume el spec 006.
3. **Los módulos `.ts` de la capa no declaran constantes.** Si aparece un literal con significado, va a
   `constants/`. Los únicos números que quedan en un módulo son los que no tienen nombre posible (un
   `+ 1` de índice, un `/ 2`).
4. **Nada de `enum`** — el `erasableSyntaxOnly` del repo los rechaza (D12b). Conjunto cerrado =
   const-object en `constants/` + union type derivado en `types/`.
5. **Sin barrels.** Ningún `index.ts` de re-exportación.
6. **Extensión explícita** en todo import local: `./types/board.types.ts`.
7. **Sin alias.** Rutas relativas.
8. **`import type`** para todo lo que sea solo tipo — `verbatimModuleSyntax` ya lo exige, y con eso los
   imports a `types/` desaparecen del bundle.

### El override del linter

En `eslint.config.js`, después del bloque general:

```js
{
  files: ['src/domain/**/*.ts'],
  rules: {
    '@typescript-eslint/no-restricted-imports': ['error', {
      patterns: [{
        group: [
          'react', 'react-dom', 'react-dom/*',
          '../audio/*', '../../audio/*',            // desde domain/ y desde domain/{types,__tests__}/
          '../components/*', '../../components/*',
          '../App*', '../../App*',
        ],
        message: 'domain/ es puro: no conoce React, ni el audio, ni la UI.',
      }],
    }],
  },
},
{
  files: ['src/audio/**/*.ts'],
  rules: {
    '@typescript-eslint/no-restricted-imports': ['error', {
      patterns: [{
        group: [
          'react', 'react-dom', 'react-dom/*',
          '../domain/*', '../../domain/*',
          '../components/*', '../../components/*',
          '../App*', '../../App*',
        ],
        message: 'audio/ habla MIDI y Web Audio; no conoce el dominio ni la UI.',
      }],
    }],
  },
},
```

Dos detalles que no son obvios:

- Se usa la variante de `typescript-eslint` (ya es dependencia) y no la core, porque **también ve los
  `import type`**, que son justo los que un refactor descuidado usaría para colarse.
- Los patrones llevan `../` **y** `../../`: los archivos de `types/` y de `__tests__/` están un nivel
  más abajo que los módulos. Con los tests sueltos alcanzaba un solo nivel; con la carpeta, no. Si
  algún día aparece un tercer nivel, hay que agregar el patrón — está anotado en `conventions.md`.

**Verificación obligatoria:** agregar a mano un import prohibido desde un módulo **y desde un test**, y
confirmar que `pnpm lint` falla en los dos casos con el mensaje del override. Una regla que no se
probó fallar no es una regla (AC3).

## Contenido módulo por módulo

### `domain/types/*` — cero imports

```ts
// transform.types.ts
export type Cell = [number, number];

// pieces.types.ts
export type PieceKey = 'F' | 'I' | 'L' | 'N' | 'P' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';

// board.types.ts
import type { Cell } from './transform.types.ts';
import type { PieceKey } from './pieces.types.ts';
export interface PlacedPiece {
  id: string; piece: PieceKey; rotation: number; mirror: boolean; cells: Cell[]; notes: number[];
}
```

**Un cambio de tipado que sí mejora, y hay que hacerlo con cuidado:** hoy `PieceKey` se deriva de
`keyof typeof BASE_MAP`, o sea que el tipo de las piezas sale de la tabla **musical**. Al declararlo
explícito en `pieces.types.ts`, `BASE_MAP` pasa a tiparse `Record<PieceKey, number>` y **agregar una
pieza sin darle tónica se vuelve error de compilación** — hoy no lo es. Es lo único del spec que
cambia una firma, y no cambia comportamiento.

`board.types.ts` es el único de los tres que importa (dos tipos de sus hermanos): sigue sin salir de
`types/`.

### `domain/constants/*` — solo importan tipos

```ts
// pieces.constants.ts   ← era el módulo pieces.ts
export const SHAPES: Record<PieceKey, Cell[]> = { … };
export const ANCHOR_INDEX: Record<PieceKey, number> = { … };

// board.constants.ts
export const GRID_W = 10;
export const GRID_H = 6;

// music.constants.ts
export const CHROMATIC = ['C','C#',…] as const;
export const PENT_MAJOR  = [0,2,4,7,9];
export const PENT_MINOR  = [0,3,5,7,10];
export const PENT_BLUES5 = [0,3,5,6,7];
export const BASE_MAP: Record<PieceKey, number> = { F:0, I:1, … };
export const DEFAULT_OCTAVE = 4;      // hoy es el `4` literal de notesForRotation(basePc, 4, rotation)
```

**Los comentarios se mudan con el dato, no se quedan huérfanos.** El de `ANCHOR_INDEX` —por qué es
índice y no coordenada, por qué se eligió una celda central— viaja a `pieces.constants.ts`. Es la
disciplina que evita que `constants/` sea una lista de números sin contexto.

`DEFAULT_OCTAVE` es constante nueva por nombre, no por valor: hoy el `4` está escrito en la llamada de
`App.tsx` y no en ningún lado más.

### `domain/transform.ts` — importa `type Cell`

```ts
export function rotate90(cells: Cell[]): Cell[]
export function normalize(cells: Cell[]): Cell[]
export function rotateN(cells: Cell[], n: number): Cell[]
export function reflect(cells: Cell[]): Cell[]
```

**El comentario del invariante del orden del array se queda acá**, con las funciones que lo sostienen,
no en `transform.types.ts`. Es la disciplina que evita que `types/` vacíe de sentido al módulo: el tipo
declara la forma, el módulo documenta la regla.

`normalize` y `rotate90` se exportan aunque `App.tsx` no las use: las necesitan `invariants.ts` —para
reconstruir la posición esperada de cada índice— y sus propios tests.

### `domain/board.ts` — importa de `types/`, `constants/board` y `transform.ts`

Acá aterriza lo que hoy está atrapado dentro del componente, con las dependencias en la firma:

```ts
/** Celdas que ocuparía `shape` si su celda de agarre cae en (x, y). */
export function cellsAt(shape: Cell[], anchorIndex: number, x: number, y: number): Cell[]

/** Dentro del tablero y sin solaparse con lo ya colocado. */
export function isValid(cells: Cell[], placed: readonly PlacedPiece[]): boolean

/** La pieza que ocupa (x, y), o null. */
export function occupantAt(placed: readonly PlacedPiece[], x: number, y: number): PlacedPiece | null
```

`cellsAt` recibe `shape` y `anchorIndex` en vez de calcularlos: quien llama ya tiene la forma
transformada memoizada, así la función no vuelve a rotar en cada hover. `placed` entra como `readonly`,
que es decir en el tipo lo que CLAUDE.md dice en prosa: **nunca mutar objetos ya entregados a React.**

### `domain/music.ts` — importa de `constants/music.constants.ts`

```ts
export function midiFor(pc: number, octave: number): number
export function midiName(m: number): string
export function notesForRotation(basePc: number, octave: number, rot: number): number[]
```

Queda como tres funciones y ninguna tabla. El mapeo rotación → fórmula **sí se queda acá**: es la
decisión de diseño del instrumento (`rot === 1 → PENT_MINOR`), no un dato. Lo que se va son las cuatro
fórmulas y el cromatismo.

Se mueve sin tocar el comportamiento, **incluido el corrimiento de octava** con su comentario: cuando
la suma pasa de B la nota sube de octava en vez de envolverse, y por eso las piezas de tónica alta
abren más registro. Es decisión documentada, no un bug a corregir de paso.

### `domain/invariants.ts` — importa los cuatro módulos anteriores

Los cinco chequeos como funciones puras que **devuelven** resultado, no que lanzan ni que asertan: así
las usan igual el test de la fase 2 y la tool `check_invariants` del
[spec 006](../006-mcp-server-de-dominio-ejecutable/spec.md).

```ts
export interface CheckResult { name: string; ok: boolean; failures: string[] }

export function checkArrayOrder(): CheckResult   // la celda k es la imagen de la celda k
export function checkAnchors(): CheckResult      // índice en rango y ancla = imagen del ancla
export function checkShapes(): CheckResult       // 5 celdas, sin repetidas, conexas por lados
export function checkBaseMap(): CheckResult      // biyección sobre las 12 clases de altura
export function checkNotes(): CheckResult        // 5 notas distintas y ascendentes
export function checkAll(): CheckResult[]
```

`CheckResult` se queda **inline**: tiene un solo dueño. Va a `types/invariants.types.ts` el día que lo
importe alguien más que su módulo y su test — por ejemplo el spec 006, si necesita tipar la respuesta
de la tool. Es exactamente el umbral de la regla de D12.

**El helper del cero.** `rotate90` y `reflect` producen `-0` cuando `x = 0`, y `toEqual` /
`deepStrictEqual` distinguen `-0` de `0` (medido: un test falló por eso al escribir el research). Toda
comparación de celdas pasa por:

```ts
const sameCell = (a: Cell, b: Cell) => a[0] + 0 === b[0] + 0 && a[1] + 0 === b[1] + 0;
```

Valores de referencia de hoy, medidos sobre las 96 combinaciones: **los cinco chequeos pasan**,
`BASE_MAP` cubre 0–11, las notas van siempre en ascenso, el ámbito varía entre 7 y 10 semitonos.

### `audio/types/*`, `voice.ts`, `scheduler.ts`, `engine.ts`

| Archivo | Contenido | Importa |
|---|---|---|
| `types/voice.types.ts` | `VoiceOpts` | nada |
| `types/scheduler.types.ts` | `Job`, `ClockState`, `Hit` | nada |
| `constants/voice.constants.ts` | `DEFAULT_VOICE`, `NOTE_DUR = 0.35`, `DEFAULT_VELOCITY = 0.8` | `type VoiceOpts` |
| `constants/scheduler.constants.ts` | `LOOKAHEAD = 0.1`, `TICK_MS = 25` | nada |
| `constants/engine.constants.ts` | `MASTER_GAIN = 0.3`, `ARPEGGIO_SPREAD = 0.15`, `DEFAULT_BPM = 110`, `PLAY_DELAY = 0.02`, `CLOCK_START_DELAY = 0.05` | nada |
| `voice.ts` | `midiToHz`, `scheduleVoice` | sus `types/` y `constants/` |
| `scheduler.ts` | `barDuration` (privada), `collectHits` | `midiToHz` de `voice.ts`, sus `types/` y `constants/` |
| `engine.ts` | singleton `ctx`/`master`, `audio()`, `playNotes`, `playNow`, el `Map` de jobs, `clock`, `setBpm`/`addJob`/`removeJob`/`clearJobs`/`jobCount`/`clockRunning`, `tick`, `startClock`, `stopClock` | `voice.ts`, `scheduler.ts`, todos sus `types/` y `constants/` |

**Acá está la primera duplicación que el cambio elimina.** Hoy el `0.35` está escrito dos veces: como
`const NOTE_DUR` (línea 180) y como valor por defecto de `scheduleVoice` (línea 52). Con la constante
extraída, la firma pasa a `dur = NOTE_DUR` y hay **una sola declaración**. Lo mismo con `vel = 0.8` →
`DEFAULT_VELOCITY`.

**La segunda es `DEFAULT_BPM`.** Hoy el `110` está en `App.tsx` (`useState(110)`) y en `engine.ts`
(`let bpm = 110`), sin nada que los mantenga iguales. Como `components/` puede importar de `audio/`, el
estado inicial del tempo pasa a ser `useState(DEFAULT_BPM)` y el motor arranca del mismo valor.

`PLAY_DELAY` y `CLOCK_START_DELAY` son dos números distintos (0.02 y 0.05) que hoy se leen como el mismo
tipo de cosa —«un ratito para adelante»— y no lo son: uno evita agendar en el pasado al disparar, el
otro fija el primer compás. Nombrarlos los separa.

**`ARPEGGIO_SPREAD` se queda en `engine.constants.ts`**, aunque el spec 006 la importe: es la única
constante que la UI necesita nombrar, y `engine.ts` sigue siendo la puerta de la capa.

`voice.ts` y `scheduler.ts` reciben el `AudioContext` por parámetro y **ya no pueden** tocar el
singleton: vive en `engine.ts` y ellos no lo importan. El invariante que hoy sostiene un comentario
pasa a sostenerlo el grafo.

Los dos comentarios largos del scheduler —el de materializar el iterable y el de la guarda de
recuperación— se mueven enteros: describen bugs ya pisados.

`engine.ts` sigue siendo lo único que importa `App.tsx` del audio, y **no** re-exporta `voice`/
`scheduler` en bloque: no es un barrel.

### Reparto de los tests de audio

| Archivo nuevo | `describe` que recibe | Tests |
|---|---|---|
| `__tests__/voice.test.ts` | `midiToHz` + `sintesis` | 7 |
| `__tests__/scheduler.test.ts` | `scheduler` | 8 |
| `__tests__/integration.test.ts` | `scheduler + sintesis integrados` | 2 |

Se mueven bloques enteros, **sin editar aserciones**. Tres ajustes y ninguno más:

- `renderVoice` (helper local del archivo actual) va a `voice.test.ts`; `integration.test.ts` arma su
  contexto inline, como ya lo hace hoy.
- `scheduler.test.ts` **no importa `ARPEGGIO_SPREAD`** (es capa 3): define su propio
  `const SPREAD = 0.15` (AC10).
- Los imports de `test-context.ts` pasan a ser `./test-context.ts` (mismo `__tests__/`), y los de los
  módulos, `../voice.ts` / `../scheduler.ts`.

### `components/*` — presentacionales

Cortes según los bloques que el JSX ya marca con comentarios:

| Componente | Sale de | Props |
|---|---|---|
| `PiecePalette.tsx` | 210–255 | `selected, rotation, mirror, tempo, loopPlaced, noteSet` + `onSelect, onRotate, onMirror, onTempo, onToggleLoopPlaced, onToggleClock, onReset` |
| `Board.tsx` | 257–285 | `placed, previewSet, previewValid, hover, selected` + `onCellClick, onCellEnter, onMouseLeave` |
| `PiecePreview.tsx` | 286–301 | `shape, anchor, noteSet` |
| `PlacedList.tsx` | 305–322 | `placed` + `onRemove` |

Reglas: sin estado, sin efectos, sin `useMemo`; una interfaz `Props` por archivo, **inline y sin
exportar** (`react-refresh/only-export-components` exige que el componente sea el único export). Las
clases de Tailwind se mueven tal cual — este spec no rediseña nada.

```ts
// components/constants/layout.constants.ts
export const CELL_PX = 28;          // hoy: '28px' en gridTemplateColumns + 'w-7 h-7' en cada celda
export const PREVIEW_CELL_PX = 20;  // hoy: '20px' + 'w-5 h-5'
export const TEMPO_MIN = 60;
export const TEMPO_MAX = 160;
```

**La única excepción a "las clases se mueven tal cual".** `w-7 h-7` es una clase estática: Tailwind
escanea el fuente, así que no se puede interpolar (`w-[${CELL_PX}px]` no se generaría). Para que
`CELL_PX` sea de verdad una sola declaración, las celdas se dimensionan con estilo inline
(`style={{ width: CELL_PX, height: CELL_PX }}`) y pierden `w-7 h-7`; ídem `w-5 h-5` en la
previsualización. `w-7` es exactamente 1.75rem = 28px, así que el render es idéntico — pero **es el
único punto donde mover una constante toca el markup**, y por eso la revisión visual de la fase 4 es
obligatoria.

El tempo inicial **no** vive acá: es `DEFAULT_BPM` de `audio/constants/engine.constants.ts`, para que la
UI y el motor arranquen del mismo número.

`App.tsx` queda con los seis `useState`, el `useRef` del id, los dos `useMemo`, `anchor`, los tres
handlers, los dos efectos, el cálculo del fantasma y ~25 líneas de JSX que componen los cuatro
componentes dentro del grid de 12 columnas.

### `main.tsx`

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
```

Con `jsx: "react-jsx"` el import default de React no hace falta. `index.html` pasa a apuntar a
`/src/main.tsx`.

## Fases

Cada fase es un commit (algunas dos) y termina con la verificación completa: `tsc`, `lint`, `test`,
`build` y **abrir la app**.

| # | Fase | Qué entrega | Riesgo |
|---|---|---|---|
| 1 | **Tipos, constantes y dominio puro** | `domain/types/*`, `domain/constants/*`, `transform.ts`, `music.ts` + sus tests; `App.tsx` importando | medio: mover 77 líneas sin editarlas, más el tipado explícito de `PieceKey` |
| 2 | **Tablero e invariantes** | `board.ts` + `board.constants.ts` con las tres funciones que estaban en el componente, `invariants.ts` y sus tests | medio: cambia la forma de llamar, no la lógica |
| 3 | **Audio en tres módulos** | `voice.ts`, `scheduler.ts`, `engine.ts`, `audio/types/*`, `audio/constants/*` + los tests repartidos | medio: toca los únicos tests que hay, y deduplica `NOTE_DUR` y `DEFAULT_BPM` |
| 4 | **Componentes** | los cuatro `components/*.tsx`, `layout.constants.ts` y `App.tsx` reducido a estado y composición | bajo pero visible: es toda la UI, y es donde `CELL_PX` toca el markup |
| 5 | **Entry, estilos y limpieza** | `main.tsx`, `styles/index.css`, borrar `setupTests.ts` (commit aparte) | bajo |
| 6 | **Linter y docs** | los overrides de dirección + toda la documentación | nulo |

**El orden importa:** las fases 1 y 2 traen los primeros tests del dominio **antes** de que la fase 4
mueva la UI, así que cuando se toca lo que no tiene cobertura ya hay una red abajo. La fase 6 va al
final porque los overrides solo pueden pasar cuando las carpetas existen.

**La fase 4 es la única realmente opcional.** Si se corta el spec ahí, las fases 1–3 y 5–6 entregan
todo el valor estructural: dominio testeable, capas verificadas por el linter y el spec 006
habilitado. La UI en un archivo grande vuelve a ser una decisión defendible a esta escala.

## Documentación a actualizar (fase 6)

| Archivo | Qué cambia |
|---|---|
| `CLAUDE.md` | la sección "Organización" completa: ya no es "todo vive en `App.tsx`" sino cuatro capas con dirección; las reglas de barrels, extensión y dirección entran a "Invariantes" |
| `docs/architecture/directory-structure.md` | árbol nuevo, tabla "dónde crear cada cosa" reescrita con los roles de D12, y `src/index.tsx` → `src/main.tsx` |
| `docs/architecture/overview.md` | el diagrama de capas y la línea de `src/index.tsx` |
| `docs/architecture/modelo-musical.md` | las puras ahora viven en `src/domain/music.ts` |
| `docs/architecture/audio.md` | los tres bloques ahora son tres archivos; la inyección de `ctx` es estructural |
| `docs/guides/conventions.md` | dirección de dependencia, las dos tablas de D12 (roles y crecimiento), sin barrels, extensión explícita, sin alias, un componente por archivo, y la nota sobre la profundidad de los patrones del linter |
| `docs/guides/troubleshooting.md` | la referencia a `src/index.tsx` |
| `specs/log.md` | estado de 005 |
| `specs/001/tasks.md` | marcar como resuelta la tarea "evaluar extraer las puras" y apuntar al módulo real |

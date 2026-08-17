# Visión General de la Arquitectura

## Descripción del Sistema

Pentomino Games es un prototipo de instrumento musical. El usuario elige uno de los 12 pentominós, lo
rota o refleja, y lo coloca en un tablero de 10×6. Cada colocación dispara un arpegio de cinco notas
cuya identidad depende de la pieza y cuya escala depende de la orientación.

No hay objetivo, puntaje ni condición de victoria: es un instrumento, no un juego con reglas de
resolución. Esa distinción importa al decidir features — lo que se evalúa es si algo se vuelve más
expresivo, no más difícil.

## Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────┐
│  src/main.tsx         createRoot().render(<App/>)       │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  src/App.tsx — el shell                                 │
│   estado · derivados · handlers · los cuatro efectos    │
│   selected · rotation · mirror · tempo                  │
│   playing · placed[] · hover                            │
└───────┬─────────────────────────────┬───────────────────┘
        │ compone                     │ playNow · setSequence · startClock
┌───────▼──────────────────┐  ┌───────▼───────────────────┐
│  src/components/         │  │  src/audio/               │
│   PiecePalette · Board   │  │   voice.ts     síntesis   │
│   PlacedList · Spectrum  │  │   scheduler.ts lookahead  │
│                          │  │   engine.ts    singletons │
│   presentacionales:      │  │   spectrum.ts  bins→barras│
│   props, sin estado      │  │                           │
└───────┬──────────────────┘  │  voice y scheduler reciben│
        │                     │  el ctx por parámetro y NO│
        │ importan            │  importan engine.ts → se  │
        │                     │  renderizan offline       │
┌───────▼─────────────────────┴───────────────────────────┐
│  src/domain/ — puro: sin React, sin Web Audio, sin DOM  │
│   transform.ts   rotate90 · normalize · rotateN · reflect│
│                  centroid · angleFromCentroid            │
│   board.ts       cellsAt · isValid · cellDistance ·      │
│                  pathBetween · occupantAt ·               │
│                  occupantCellIndex                        │
│   music.ts       midiFor · midiName · notesForRotation   │
│                  degreeByCellIndex                       │
│   sequence.ts    buildSequence                            │
│   invariants.ts  los cinco chequeos del modelo           │
│   types/ ← constants/ ← módulos                          │
└─────────────────────────────────────────────────────────┘
```

`domain/` y `audio/` son **hermanos sin aristas entre ellos**, y la dirección la verifica el linter.
Ver [conventions.md](../guides/conventions.md).

## Qué vive dónde

**El audio salió de `App.tsx`** cuando se reemplazó Tone por un motor propio, y el motivo fue la
testabilidad: las funciones de síntesis y scheduling reciben el `AudioContext` por parámetro, así que
se pueden renderizar con `OfflineAudioContext` sin montar nada de React.

**El dominio salió después, y por un motivo parecido**: `react-refresh/only-export-components` prohíbe
que un `.tsx` exporte algo además del componente, así que mientras la geometría y la música vivieran en
`App.tsx` **no podían exportarse, y por lo tanto no podían testearse**. La organización no era neutral:
condenaba al dominio a no ser verificable. Hoy `src/domain/` tiene tests donde antes había cero.

Lo que queda en `App.tsx` es el shell: estado, derivados, handlers, los cuatro efectos y la composición de
los componentes. Ninguna función pura y ningún literal de dominio.

## Las cuatro capas

### 1. Dominio — funciones puras

Sin React, sin audio, sin DOM. Determinísticas y testeables en aislamiento.

| Módulo | Símbolos | Responsabilidad |
|---|---|---|
| `transform.ts` | `rotate90`, `normalize`, `rotateN`, `reflect`, `centroid`, `angleFromCentroid` | Transformaciones de un `Cell[]`, y el centroide con el ángulo de cada celda a su alrededor |
| `board.ts` | `cellsAt`, `isValid`, `cellDistance`, `pathBetween`, `occupantAt`, `occupantCellIndex` | Las reglas del tablero, la distancia entre celdas replegando la costura `(0,0)↔(9,5)`, y qué celda de la pieza cae en `(x, y)` |
| `music.ts` | `midiFor`, `midiName`, `notesForRotation`, `degreeByCellIndex` | De pieza + rotación a cinco notas MIDI, y de la forma a qué celda lleva cuál |
| `sequence.ts` | `buildSequence` | El circuito que visita las piezas colocadas (Held-Karp sobre `cellDistance`) y los offsets del ciclo — orden, silencios y clicks |
| `invariants.ts` | `checkArrayOrder`, `checkAnchors`, `checkShapes`, `checkBaseMap`, `checkNotes`, `checkAll` | Los cinco chequeos del modelo. Los dos geométricos recorren las 96 orientaciones; los otros tres, lo que les corresponde |

Los datos (`SHAPES`, `ANCHOR_INDEX`, `BASE_MAP`, `PENT_*`, `GRID_W/H`) viven en `domain/constants/`, y
los tipos (`Cell`, `PieceKey`, `PlacedPiece`) en `domain/types/`. Detalle en
[modelo-musical.md](./modelo-musical.md).

Los chequeos **devuelven** un `CheckResult` en vez de lanzar o asertar, para que los use igual su test y
la tool `check_invariants` del spec 006.

### 2. Componente — estado y render

Todo el estado es local (`useState`). **No hay estado global**: ni Context, ni Redux, ni Zustand. A
esta escala no hace falta, y agregarlo sería la clase de complejidad que un prototipo no puede pagar.

| Estado | Tipo | Qué representa |
|---|---|---|
| `selected` | `PieceKey` | Pieza activa en la paleta |
| `rotation` | `0..3` | Cuartos de vuelta |
| `mirror` | `boolean` | Reflexión activa |
| `tempo` | `number` | BPM del reloj del motor |
| `playing` | `boolean` | Si el transporte está corriendo. Lo escribe `togglePlay` con lo que devuelve `clockRunning()`, no con la negación del valor anterior: `startClock()` es un no-op silencioso sin Web Audio |
| `placed` | `PlacedPiece[]` | Piezas en el tablero |
| `hover` | `Cell \| null` | Celda bajo el cursor, para el fantasma |

Derivados con `useMemo`: `transformedShape` y `noteSet`. Derivados sin memo (baratos, se recalculan por
render): `previewCells` y `previewValid`. `previewCells` viaja al `Board` como **array y no como `Set`
de claves `"x,y"`**: el índice de cada celda es lo que la conecta con su grado, y el `Set` lo perdía.

### 3. Audio — el motor y sus singletons

`voice.ts` (síntesis), `scheduler.ts` (lookahead), `engine.ts` (singletons y la API que consume la UI)
y `spectrum.ts` (el mapeo puro de bins a barras, separado del `AnalyserNode` para poder testearlo).
El `AudioContext` es un singleton de módulo —uno por pestaña, no uno por componente— y vive **solo** en
`engine.ts`: los otros dos lo reciben por parámetro y no importan `engine.ts`, así que el invariante que
los hace testeables lo sostiene el grafo de imports. Detalle en [audio.md](./audio.md).

### 4. Componentes — presentacionales

Uno por archivo, sin estado ni efectos propios: reciben datos y callbacks por props. `Spectrum.tsx` es
la excepción deliberada — no recibe props y lee del motor por su cuenta, para que dibujar a 60 fps no
re-renderice nada del tablero.

## Patrones clave

### Las transformaciones preservan el orden del array

`rotate90`, `normalize` y `reflect` son todos `map` sobre las celdas. Eso significa que **la celda en el
índice `k` sigue siendo la misma celda lógica después de cualquier transformación**.

De esa propiedad depende `ANCHOR_INDEX`, que guarda la celda de agarre de cada pieza como índice en vez
de coordenada: rotar la pieza mueve la celda, pero no cambia su índice. Es lo que hace que el punto de
agarre acompañe a la figura sin recalcular nada.

El [spec 001](../../specs/001-notas-por-celda-en-orden-angular/spec.md) reusa el mismo mecanismo para el
mapeo celda↔nota. **Es un invariante del que ya depende código en producción**: romperlo (por ejemplo,
haciendo que `normalize` filtre u ordene celdas) rompe la colocación de piezas de forma silenciosa.

Desde el spec 005 hay una red: `checkArrayOrder()` de `domain/invariants.ts` lo verifica sobre las 96
combinaciones, y su test comprueba que el chequeo efectivamente **da rojo** si una transformación
reordena.

### El estado es la fuente de verdad; los efectos reconcilian

Los loops de audio no se agendan ni cancelan desde los handlers. Un único `useEffect` observa
`[placed]` y le entrega al motor la secuencia del recorrido con `setSequence`. `playing` no está en
las dependencias: la secuencia es función del tablero y no del transporte.

El patrón imperativo anterior —cada handler acordándose de limpiar lo suyo— es exactamente el que
produjo el bug de loops huérfanos que sobrevivían a "Quitar" y "Reset". Ver
[audio.md](./audio.md#reconciliación-de-loops).

### El render no muta

Los cálculos derivados del hover (`previewCells`, `previewValid`, `previewSet`) se recomputan en cada
render y no se guardan. Son baratos —cinco celdas— y guardarlos introduciría una segunda fuente de
verdad que hay que invalidar.

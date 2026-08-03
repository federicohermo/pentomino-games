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
│  src/index.tsx        createRoot().render(<App/>)       │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  src/App.tsx                                            │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Dominio — funciones puras, sin React ni audio     │  │
│  │  · Geometría: SHAPES, rotate90, normalize,        │  │
│  │    rotateN, reflect, ANCHOR_INDEX                 │  │
│  │  · Música:   BASE_MAP, PENT_*, notesForRotation,  │  │
│  │              midiFor, midiName                    │  │
│  └───────────────────────────────────────────────────┘  │
│                           │                             │
│  ┌────────────────────────▼──────────────────────────┐  │
│  │ Componente App — estado y render                  │  │
│  │  selected · rotation · mirror · tempo             │  │
│  │  loopPlaced · placed[] · hover                    │  │
│  └───────────────────────────────────────────────────┘  │
│                           │                             │
│  ┌────────────────────────▼──────────────────────────┐  │
│  │ Efecto de reconciliación de loops                 │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │ playNow · addJob · startClock
┌──────────────────────────▼──────────────────────────────┐
│  src/audio/engine.ts                                    │
│   1. Síntesis   — midiToHz · scheduleVoice (ADSR)       │
│   2. Scheduler  — collectHits (lookahead)               │
│   3. App        — singleton del AudioContext, jobs      │
│                                                         │
│  1 y 2 reciben el contexto por parámetro → testeables   │
│  con OfflineAudioContext                                │
└─────────────────────────────────────────────────────────┘
```

## Qué vive dónde

**El audio ya no está en `App.tsx`.** Salió a `src/audio/engine.ts` cuando se reemplazó Tone por un
motor propio, y el motivo fue la testabilidad: las funciones de síntesis y scheduling reciben el
`AudioContext` por parámetro, así que se pueden renderizar con `OfflineAudioContext` sin montar nada de
React.

`App.tsx` conserva el dominio (geometría y música) y el componente. **Es intencional por ahora**: el
costo de saltar entre archivos supera el beneficio de separarlos a esta escala.

El siguiente límite está identificado: las funciones puras de dominio también se van a extraer, porque
testear geometría no debería requerir montar un componente. Anotado en el
[plan del spec 001](../../specs/001-notas-por-celda-en-orden-angular/plan.md) §2.

Mientras tanto, **la separación existe como orden dentro del archivo** y hay que respetarla: dominio
puro arriba, componente abajo. Una función pura nueva va con las puras, no suelta dentro de `App()`.

## Las tres capas

### 1. Dominio — funciones puras

Sin React, sin audio, sin estado. Determinísticas y testeables en aislamiento.

| Grupo | Símbolos | Responsabilidad |
|---|---|---|
| Geometría | `SHAPES`, `rotate90`, `normalize`, `rotateN`, `reflect`, `ANCHOR_INDEX` | Formas canónicas y sus transformaciones |
| Música | `BASE_MAP`, `PENT_MAJOR/MINOR/BLUES5`, `notesForRotation`, `midiFor`, `midiName` | De pieza + rotación a cinco notas MIDI |

Detalle en [modelo-musical.md](./modelo-musical.md).

### 2. Componente — estado y render

Todo el estado es local (`useState`). **No hay estado global**: ni Context, ni Redux, ni Zustand. A
esta escala no hace falta, y agregarlo sería la clase de complejidad que un prototipo no puede pagar.

| Estado | Tipo | Qué representa |
|---|---|---|
| `selected` | `PieceKey` | Pieza activa en la paleta |
| `rotation` | `0..3` | Cuartos de vuelta |
| `mirror` | `boolean` | Reflexión activa |
| `tempo` | `number` | BPM del reloj del motor |
| `loopPlaced` | `boolean` | Si las piezas colocadas re-disparan cada compás |
| `placed` | `PlacedPiece[]` | Piezas en el tablero |
| `hover` | `Cell \| null` | Celda bajo el cursor, para el fantasma |

Derivados con `useMemo`: `transformedShape` y `noteSet`. Derivados sin memo (baratos, se recalculan por
render): `anchor`, `previewCells`, `previewValid`, `previewSet`.

### 3. Audio — efectos y singletons de módulo

El motor vive en `src/audio/engine.ts`, no en `App.tsx`. Su `AudioContext` es un singleton de módulo
—uno por pestaña, no uno por componente— pero las funciones de síntesis y scheduling lo reciben por
parámetro, que es lo que las hace testeables. Detalle en [audio.md](./audio.md).

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

### El estado es la fuente de verdad; los efectos reconcilian

Los loops de audio no se agendan ni cancelan desde los handlers. Un único `useEffect` observa
`[placed, loopPlaced]` y lleva los jobs del motor a donde deben estar.

El patrón imperativo anterior —cada handler acordándose de limpiar lo suyo— es exactamente el que
produjo el bug de loops huérfanos que sobrevivían a "Quitar" y "Reset". Ver
[audio.md](./audio.md#reconciliación-de-loops).

### El render no muta

Los cálculos derivados del hover (`previewCells`, `previewValid`, `previewSet`) se recomputan en cada
render y no se guardan. Son baratos —cinco celdas— y guardarlos introduciría una segunda fuente de
verdad que hay que invalidar.

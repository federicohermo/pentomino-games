# Modelo Musical

Cómo se traduce una pieza colocada en cinco notas y en qué momento suenan. Las tres primeras reglas
viven en las funciones puras de `src/App.tsx` y no dependen de React ni de la capa de audio; la cuarta
es lo único que cruza a la capa de audio, y lo hace por un solo campo del `Job`.

## Las cuatro reglas

| Entrada | Determina | Mecanismo |
|---|---|---|
| **Qué pieza** | La tónica | `BASE_MAP` |
| **Rotación** | La fórmula de escala | `notesForRotation` |
| **Reflexión** | El orden de las notas | `ns.reverse()` — retrógrado |
| **La columna** | La posición dentro del compás | `Job.phase = ax / GRID_W` |

La **forma** de la pieza no influye hoy en el sonido. Es la carencia que ataca el
[spec 001](../../specs/001-notas-por-celda-en-orden-angular/spec.md). La **fila** (`y`) tampoco: octava,
duración y velocity son los candidatos obvios, y van de a un eje por vez.

## Columna → posición en el compás

**El eje X del tablero es tiempo.** La columna de la celda de agarre decide en qué momento del compás
arranca la pieza:

```
compás  ├────────────────────────────────────────────────┤
col 0   ●━━━━━                                              arranca en el downbeat
col 3          ●━━━━━                                       a 3/10 del compás
col 7                          ●━━━━━                       a 7/10
```

```ts
const [ax] = p.cells[ANCHOR_INDEX[p.piece]];
addJob({ …, phase: ax / GRID_W });
```

Cuatro cosas que definen la regla, y por qué son así:

- **La celda de agarre, no el borde izquierdo de la pieza.** Es la celda que el usuario clickeó —control
  directo— y `ANCHOR_INDEX` ya es el punto de referencia canónico de cada pieza, estable ante rotaciones
  por el invariante de orden del array.
- **El ancho del tablero es el compás**: 10 pasos, no 16. Con una grilla de semicorcheas, 6 de las 16
  subdivisiones no serían alcanzables desde ninguna columna. Que la grilla no sea 4/4 es aceptable: esto
  es un instrumento, no una caja de ritmos.
- **Fracción, no segundos.** Mover el tempo estira el patrón proporcionalmente en vez de reordenarlo.
- **Geometría, no reloj de pared.** Antes del spec 002, con Tone, cada pieza quedaba desfasada por el
  *momento* en que se la colocó: no era reproducible, no era visible y no se podía testear. El mismo
  tablero suena siempre igual.

El disparo al colocar (`playNow`) **no** lleva fase: hacés click y suena. Es retroalimentación del
gesto, no parte del patrón — la fase solo gobierna el loop.

**Limitación conocida:** no hay retroalimentación visual de la fase. Una cabeza lectora recorriendo el
tablero es lo que volvería *legible* a esta regla; hoy se oye pero no se lee. Encaja con el
[spec 003](../../specs/003-visualizacion-de-la-senal-con-analysernode/spec.md), que ya trae el canvas.

Detalle del scheduler que la implementa en [audio.md](./audio.md#fase-por-pieza).

## Pieza → tónica

`BASE_MAP` asigna a cada pentominó una clase de altura, en orden alfabético sobre el cromatismo:

| Pieza | F | I | L | N | P | T | U | V | W | X | Y | Z |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Clase | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
| Nota | C | C# | D | D# | E | F | F# | G | G# | A | A# | B |

Las 12 piezas cubren exactamente las 12 clases de altura. Es una coincidencia aprovechada, no un
resultado teórico: hay 12 pentominós libres y 12 semitonos.

> Cuidado con la colisión de nombres: la **pieza `F`** tiene por tónica la **nota C**, y la **nota F**
> le corresponde a la **pieza `T`**. La letra del pentominó describe su forma, no su sonido.

La octava está fija en `4` en la llamada actual (`notesForRotation(basePc, 4, rotation)`).

## Rotación → escala

```ts
rotación 0   → PENT_MAJOR  [0,2,4,7,9]     pentatónica mayor
rotación 90  → PENT_MINOR  [0,3,5,7,10]    pentatónica menor
rotación 180 → PENT_BLUES5 [0,3,5,6,7]     menor con blue note
rotación 270 → PENT_MAJOR  transpuesta +7  mayor a la quinta
```

Las cuatro son escalas de cinco grados, uno por celda del pentominó. Girar la pieza cambia **el color
armónico** manteniendo la tónica — salvo en 270°, donde la transposición de +7 semitonos la mueve a la
quinta.

### Corrimiento de octava

`notesForRotation` no confina las notas a una octava:

```ts
const total = basePc + iv + transpose;
const pc = ((total % 12) + 12) % 12;
const octShift = Math.floor((basePc + iv + transpose) / 12);
return midiFor(pc, octave + octShift);
```

Cuando la suma pasa de B, la nota sube de octava en vez de envolverse hacia abajo. Consecuencia
audible: **las piezas de tónica alta abren más registro**. Con `Z` (tónica B) en rotación 270°, los
cinco grados se reparten entre dos octavas; con `F` (tónica C) en rotación 0°, entran todos en una.

No es un bug: mantiene el contorno melódico ascendente en vez de quebrarlo con un salto hacia abajo.

## Reflexión → retrógrado

El mirror invierte el array de notas:

```ts
if (mirror) ns = [...ns].reverse();
```

Mismas cinco alturas, orden inverso. Es el **retrógrado** en el sentido clásico del término, y es lo que
promete el footer de la UI.

Se compone limpiamente con la rotación: rotar elige *qué* notas, reflejar elige *en qué orden*. Son
ortogonales a propósito, y el [spec 001](../../specs/001-notas-por-celda-en-orden-angular/spec.md) §D3
argumenta por qué mantenerlas así al agregar el mapeo espacial.

## Reproducción

`playNotes()` dispara las cinco notas como arpegio de tiempo fijo:

```ts
notes.forEach((m, i) => scheduleVoice(c, master, midiToHz(m), start + i * ARPEGGIO_SPREAD, NOTE_DUR));
```

- **0.15 s entre notas** (`ARPEGGIO_SPREAD`), independiente del tempo. El slider de BPM afecta al reloj
  del motor (los loops), no al arpegio de colocación.
- **0.35 s de duración** (`NOTE_DUR`), `0.8` de velocity, más 0.12 s de release.
- **`i` es la posición en el array**, o sea el grado de la escala. El
  [spec 001](../../specs/001-notas-por-celda-en-orden-angular/plan.md) §4 hace que ese orden pase a
  derivarse del mapeo espacial en vez de ser una coincidencia del orden del array.

Cuando el loop de piezas colocadas está activo, cada pieza reagenda la misma secuencia con el mismo
espaciado, una vez por compás. Ese camino no pasa por `playNotes()`: el espaciado lo aplica
`collectHits()` en el motor — ver [audio.md](./audio.md#los-dos-caminos-de-reproducción).

## Utilidades MIDI

```ts
midiFor(pc, octave)  // → 12*(octave+1) + pc      C4 = 60
midiName(m)          // → "C4", "D#4", …           para la UI
```

Convención estándar: C4 = MIDI 60. `midiName` es solo presentación; el motor trabaja siempre con
números MIDI, convertidos a Hz por el motor con `midiToHz`.

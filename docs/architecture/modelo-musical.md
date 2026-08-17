# Modelo Musical

Cómo se traduce una pieza colocada en cinco notas y en qué momento suenan. Las cuatro primeras reglas
viven en `src/domain/` —`music.ts`, `transform.ts` y sus constantes— y no dependen de React ni de la
capa de audio; la quinta es lo único que la cruza, y lo hace por un solo campo del `Job`.

## Las cinco reglas

| Entrada | Determina | Mecanismo |
|---|---|---|
| **Qué pieza** | La tónica | `BASE_MAP` |
| **Rotación** | La fórmula de escala | `notesForRotation` |
| **Reflexión** | El orden de las notas | `ns.reverse()` — retrógrado |
| **La forma** | Qué celda tiene qué nota | `degreeByCellIndex` — orden angular |
| **La columna** | La posición dentro del compás | `Job.phase = ax / GRID_W` |

La **forma** de la pieza decide **qué celda es dueña de cada grado** —el orden angular alrededor del
centroide, ver [abajo](#forma--qué-celda-tiene-qué-nota)— pero no decide *cuándo* suena ninguna: el
mapeo dice dónde está cada nota, no en qué momento. La **fila** (`y`) tampoco: octava, duración y
velocity son los candidatos obvios, y van de a un eje por vez.

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

El disparo al colocar (`playNow`) **no** lleva fase: cuando suena, hacés click y suena en el acto. Es
retroalimentación del gesto, no parte del patrón — la fase solo gobierna el transporte. Con el
transporte corriendo, `playNow` no se llama: la retroalimentación del gesto y el patrón del transporte
no compiten por el mismo instante — ver [audio.md](./audio.md#reconciliación-de-loops).

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
ortogonales a propósito, y el
[spec 007](../../specs/007-nota-por-celda-y-lenguaje-visual/spec.md) §D3 argumenta por qué mantenerlas
así al agregar el mapeo espacial.

## Forma → qué celda tiene qué nota

Cada celda de una pieza es **dueña de un grado de la escala**, y quién es dueña de cuál lo decide la
forma. `degreeByCellIndex` (`domain/music.ts`, apoyada en `centroid` y `angleFromCentroid` de
`domain/transform.ts`) recibe una forma y devuelve el grado **por índice de celda**:

```
centroide de la pieza → ángulo de cada celda alrededor del centroide → orden angular = grados 0..4
```

Cuatro cosas que definen la regla, y por qué son así:

- **La celda que cae sobre el centroide sale del anillo** y recibe el grado 0, la tónica; las otras
  cuatro se reparten 1–4 por ángulo. Sin esa excepción `Math.atan2(0, 0)` devuelve `0` **en silencio** y
  la mete en el anillo como si estuviera al este. Solo `I` y `X` tienen una celda así, y musicalmente el
  centro de la figura es su raíz.
- **A igual ángulo desempata el índice original menor**, escrito como tercer criterio del comparador y no
  delegado a la estabilidad del `sort`. No es una convención neutral: por índice el algoritmo reproduce
  la lámina de referencia en **12 de 12** piezas, y por radio en **10 de 12** (`F` e `I` se intercambian
  dos notas cada una). El empate se ejerce en 3 piezas y decide algo audible en 2.
- **Se calcula sobre la forma canónica y viaja por índice.** Rotar **no** reordena el mapeo: se corre una
  vez sobre `SHAPES[pieza]` sin transformar, apoyado en el invariante de orden del array. Rotar ya cambia
  la escala; si además reordenara el mapeo espacial, dos cosas ortogonales cambiarían a la vez. Queda:
  **la rotación cambia qué notas, la forma cambia dónde.**
- **La reflexión no cambia qué nota muestra una celda.** El retrógrado es del *orden de reproducción*: la
  celda de grado `g` muestra siempre `notesForRotation(...)[g]`, o sea la nota `g` del arpegio
  **ascendente**. Ojo con la fuente de datos, porque la lectura contraria suena igual y pinta otro
  tablero: `PlacedPiece.notes` y el campo `notes` de `describe_piece` vienen **ya invertidos**.

El mapeo completo de las 12 piezas —grado por índice y nota por celda— está medido en
[research.md §2](../../specs/007-nota-por-celda-y-lenguaje-visual/research.md#2-el-algoritmo-angular-reproduce-la-referencia--con-desempate-por-índice)
y congelado en un test, con las notas escritas a mano. Los colores con que el tablero lo muestra están en
[DESIGN.md](../../DESIGN.md).

## Reproducción

`playNotes()` dispara las cinco notas como arpegio medido en unidades musicales, sobre el tempo actual:

```ts
const iv = intervalDuration(bpm);
notes.forEach((m, i) => scheduleVoice(c, master, midiToHz(m), start + i * iv, NOTE_INTERVALS * iv));
```

- **Un intervalo entre notas** (`intervalDuration(bpm)`, la semicorchea del compás), así que el slider
  de BPM sí afecta al arpegio de colocación: a 100 bpm el intervalo da 0,15 s, y el arpegio completo
  (`4 × intervalo`) mide 0,375 s a 160 bpm contra 1,000 s a 60 bpm.
- **Duración de nota en intervalos** (`NOTE_INTERVALS = 1`, o sea exactamente un intervalo; 0,150 s a
  100 bpm), `0.8` de velocity, más 0.12 s de release. Un intervalo y no dos: la nota termina justo
  cuando entra la siguiente, así que lo único que se solapa es la cola del release y el arpegio se oye
  como cinco notas en vez de como un acorde desplegado. Medido a 110 bpm: con dos son 2,88 voces
  simultáneas, con una son 1,88, y antes del spec eran 3,13. El release **no** está en intervalos —son
  0,12 s absolutos, o sea 0,48 intervalos a 60 bpm y 1,28 a 160—, así que el solape que queda crece con
  el tempo.
- **`i` es la posición en el array**, o sea el grado de la escala. Desde el spec 007 ese orden es una
  decisión explícita —el orden angular alrededor del centroide— y no una coincidencia del orden en que
  alguien tipeó las coordenadas de `SHAPES`. Qué suena y cuándo no cambió; cambió de dónde sale.

Mientras el transporte está corriendo, cada pieza colocada reagenda la misma secuencia con el mismo
espaciado, una vez por compás, y el arpegio de colocación deja de sonar: son las dos caras del mismo
transporte, no dos fuentes de sonido independientes. Ese camino no pasa por `playNotes()`: el espaciado
lo aplica `collectHits()` en el motor — ver [audio.md](./audio.md#los-dos-caminos-de-reproducción).

## Utilidades MIDI

```ts
midiFor(pc, octave)  // → 12*(octave+1) + pc      C4 = 60
midiName(m)          // → "C4", "D#4", …           para la UI
```

Convención estándar: C4 = MIDI 60. `midiName` es solo presentación; el motor trabaja siempre con
números MIDI, convertidos a Hz por el motor con `midiToHz`.

# Research — Fase por pieza

## Cómo apareció

No salió de una lista de ideas: salió de escuchar. El reporte fue *"las piezas suenan siempre
superpuestas"*, y la pregunta era si el 002 lo había introducido o venía de antes. La respuesta
resultó ser **las dos cosas, en dos ejes distintos**, y separarlos es lo que definió el alcance.

## Eje 1 — Las notas dentro de un arpegio se solapan

**Preexistente, y con el 002 se solapan menos.**

Medido renderizando con `OfflineAudioContext` a 48 kHz (`node-web-audio-api`):

```
duracionAudibleDeUnaNota: 0.47 s   (NOTE_DUR 0.35 + release 0.12)
espaciadoEntreNotas:      0.15 s   (ARPEGGIO_SPREAD)
vocesSimultaneasMax:      4
picoUnaNota:              0.2363
picoArpegio1pieza:        0.4187
picoArpegio2piezas:       0.6461
```

Con Tone era mayor: `triggerAttackRelease(hz, "8n", …)` da 0.27 s de duración a 110 bpm, y el
`release` por defecto de `Tone.Synth` es de 1 s — o sea ~1.27 s de cola contra los mismos 0.15 s de
espaciado. Y era un `PolySynth`, así que cada nota tomaba su propia voz sin cortar a la anterior.

Lo que sí cambió es **la forma** del apilamiento. Tone decaía exponencialmente hacia un `sustain` de
0.3: la cola sonaba a resonancia. La envolvente del 002 mantiene un `sustain` de 0.5 **plano** durante
los 0.35 s, así que las cuatro voces se suman a nivel completo. Mismo solape, mucho más presente.

**Este eje queda fuera del spec.** Es diseño sonoro del patch, no del scheduler, y está anotado como
seguimiento en el 002.

## Eje 2 — Las piezas entre sí arrancan juntas

**Esto sí lo introdujo el 002.**

### Lo que hacía Tone

```ts
for (const p of placed){
  if (!loopPlaced || sched.has(p.id)) continue;   // ← las ya agendadas conservan su fase
  const eventId = Tone.Transport.scheduleRepeat((time) => { … }, "1m");
  sched.set(p.id, eventId);
}
```

De la documentación de `Tone.Transport.scheduleRepeat`, vía Context7:

> Si no se pasa `startTime`, el intervalo empieza en el tick actual si el Transport está corriendo, o
> en 0 si está parado.

Es decir: **cada pieza quedaba desfasada por el momento en que se la colocó**, y el efecto de
reconciliación preservaba esa fase porque solo agendaba lo que faltaba (`if (sched.has(p.id)) continue`).

### Lo que hace el motor propio

```ts
while (state.nextBar < fromTime + horizon) {
  for (const job of jobs) {
    job.notes.forEach((m, i) => out.push({ hz: midiToHz(m), at: state.nextBar + i * job.spread }));
  }
  state.nextBar += bar;
}
```

Todos los jobs se leen contra el mismo `state.nextBar`. No hay fase por pieza porque **no hay estado
por pieza**: los jobs son datos puros.

### Y eso fue una decisión, no un descuido de implementación

Está registrado como tal en el `tasks.md` del 002:

> como los jobs son datos puros (no eventos con id) alcanza con limpiar y re-agregar

Es cierto y es una simplificación buena — `clearJobs()` + re-agregar es seguro precisamente porque la
fase vive en el cursor compartido. Lo que no se registró es el precio: **esa misma propiedad elimina la
fase por pieza**. Se reportó como ganancia neta y no lo era.

Vale aclarar que el comportamiento viejo tampoco era diseñado: dependía de si el Transport estaba
corriendo cuando colocabas la pieza. Si estaba parado, `startTime` caía en 0 y **todo quedaba alineado
igual que ahora**. O sea que el 002 no rompió una feature: convirtió en determinista un comportamiento
que era una lotería. La conclusión no es "revertir", es **decidirlo**.

## Por qué la columna y no el reloj

La opción de reproducir lo viejo (`phase` = momento de colocación) está descartada en D1 del spec. Lo
que la vuelve interesante como alternativa es que sería trivial. Lo que la descarta es que el proyecto
ya tiene una regla, y esta la rompería:

| Entrada geométrica | Salida musical | Dónde vive |
|---|---|---|
| Qué pieza | tónica | `BASE_MAP` |
| Rotación | fórmula de escala | `notesForRotation` |
| Reflexión | retrógrado | `notesForRotation` |
| Forma | — | [spec 001](../001-notas-por-celda-en-orden-angular/spec.md) lo ataca |
| **Columna** | **posición en el compás** | **este spec** |
| Fila | — | fuera de alcance |

Todas las entradas actuales son geométricas y deterministas. Un tablero produce siempre la misma
música. Meter el reloj de pared como entrada rompe esa propiedad para siempre — y con ella la
posibilidad de guardar o compartir un tablero.

## El problema técnico que hay que resolver primero

Agregar `phase` al `Job` **no alcanza**. Con el cursor de compás actual, el onset de un job con
`phase: 0.9` cae en `nextBar + 0.9 * bar`, casi un compás entero por delante de la ventana.

Eso rompe una propiedad que hoy es invisible porque nunca se ejerce: **el motor nunca tiene más de
`LOOKAHEAD` (100 ms) de audio comprometido.** Es lo que hace que quitar una pieza la calle de
inmediato — `clearJobs()` deja de emitir, y lo ya agendado se agota en 100 ms. Con emisión por compás
completo, quitar una pieza dejaría hasta un compás sonando: 2.18 s a 110 bpm.

### La reformulación

Los onsets de un job son una progresión aritmética conocida:

```
onset(k) = origin + (k + phase) * bar        k ∈ ℤ≥0
```

Dado un intervalo `(desde, hasta]` se resuelve el primer `k` en forma cerrada:

```
k0 = ceil((desde - origin) / bar - phase)
```

y se emiten los `k` mientras `onset(k) ≤ hasta`. El estado del reloj pasa a ser dos escalares:

```ts
export interface ClockState {
  origin: number;          // instante del compás 0
  scheduledUntil: number;  // hasta dónde ya se emitió
}
```

`scheduledUntil` resuelve la re-emisión: los ticks son de 25 ms y el horizonte de 100 ms, así que sin
él **cada onset se emitiría cuatro veces**. Es un único escalar compartido, no estado por job.

### Tres cosas mejoran de rebote

1. **El bucle de recuperación desaparece.** Hoy hay una guarda explícita (`if (state.nextBar < fromTime)`)
   para que el `while` no intente recuperar cientos de compases tras el estrangulamiento de la pestaña.
   Con `k0` en forma cerrada los compases perdidos se saltean solos: no hay bucle que acotar.
2. **`collectHits` sigue siendo pura y testeable con tiempos arbitrarios.** La firma cambia, la
   propiedad que la hacía valiosa no.
3. **La ventana de compromiso queda acotada por construcción**, y eso pasa a ser un AC (AC5) en vez de
   una propiedad accidental.

## Estado del código relevante

Sobre `main`, con el spec 002 ya mergeado (`1f34eac`):

| Símbolo | Archivo | Qué le pasa |
|---|---|---|
| `Job` | `src/audio/engine.ts` | gana `phase: number` |
| `ClockState` | `src/audio/engine.ts` | `nextBar` → `origin` + `scheduledUntil` |
| `collectHits` | `src/audio/engine.ts` | reformulada sobre origen |
| `startClock` | `src/audio/engine.ts` | inicializa los dos escalares |
| `tick` | `src/audio/engine.ts` | sin cambios — ya delega en `collectHits` |
| efecto de reconciliación | `src/App.tsx` | pasa `phase` en `addJob` |
| `PlacedPiece` | `src/App.tsx` | ya tiene `cells`; la columna sale de ahí |

La columna de agarre se obtiene sin código nuevo, apoyándose en el invariante de orden del array:

```ts
const [ax] = p.cells[ANCHOR_INDEX[p.piece]];
const phase = ax / GRID_W;
```

`cells` se construye con `transformedShape.map(...)`, así que el índice `ANCHOR_INDEX[piece]` sigue
siendo la celda de agarre ya en coordenadas de tablero. **Es el mismo invariante del que ya depende la
colocación de piezas** — está documentado en `CLAUDE.md` y en `docs/architecture/overview.md`.

## Costo estimado

| Pieza | Tamaño |
|---|---|
| Reformulación de `collectHits` | ~20 líneas (reemplaza ~15) |
| `phase` en `Job` y en el efecto | ~4 líneas |
| Tests nuevos (AC1–AC7, AC9) | ~120 líneas |

Sin dependencias nuevas. Impacto en el bundle: nulo.

## Lo que hay que medir, no suponer

1. **Que AC2 pase de verdad.** Es el único que dice si la reformulación es equivalente. Si `phase: 0`
   no reproduce exactamente los mismos instantes que el cursor actual, la reformulación está mal y no
   hay que seguir.
2. **Cuánto baja el pico con dos piezas desfasadas** (AC7). La predicción es que dos piezas a fase 0 y
   0.5 den un pico cercano al de una sola (~0.42) en vez de 0.6461, pero a 110 bpm el arpegio dura
   1.07 s contra medio compás de 1.09 s: **entran raspando**. Si no baja lo esperado, el número real va
   al spec y `ARPEGGIO_SPREAD` deja de ser fuera de alcance.
3. **Cómo se siente con 4–6 piezas.** Es lo único que no se puede medir con un test.

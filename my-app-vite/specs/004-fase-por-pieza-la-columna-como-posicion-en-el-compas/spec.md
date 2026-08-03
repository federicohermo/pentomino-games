# Spec 004 — Fase por pieza: la columna como posición en el compás

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **Depende del [spec 002](../002-motor-de-audio-propio-sobre-web-audio/spec.md)**: se apoya en
> `collectHits`, `Job` y `ClockState` del motor propio. Contra el scheduler de Tone no aplica.

## Problema

**Todas las piezas colocadas suenan en el mismo instante, exacto a la muestra.** El scheduler recorre
todos los jobs contra un único cursor de compás, así que la nota `i` de la pieza A y la nota `i` de la
pieza B caen en el mismo sample:

```ts
while (state.nextBar < fromTime + horizon) {
  for (const job of jobs) {
    job.notes.forEach((m, i) => out.push({ hz: midiToHz(m), at: state.nextBar + i * job.spread }));
  }
  state.nextBar += bar;
}
```

Medido con `OfflineAudioContext` a 110 bpm (detalle en `research.md`):

| | pico |
|---|---|
| una nota sola | 0.2363 |
| arpegio de 1 pieza | 0.4187 |
| arpegio de 2 piezas | **0.6461** |

Agregar la segunda pieza no agrega una voz nueva: **agrega volumen a la misma voz**. Con cuatro piezas
el instrumento no se vuelve más rico, se vuelve más fuerte y más barroso, y el limitador implícito del
master (`gain 0.3`) lo aplana.

Hay dos consecuencias, una técnica y una de producto:

**Técnica.** La fase por pieza existía antes y se perdió sin que nadie lo notara. Con Tone, cada pieza
se agendaba con `Tone.Transport.scheduleRepeat(cb, "1m")` sin `startTime`, que según la documentación
*"empieza en el tick actual si el Transport está corriendo"*. Cada pieza quedaba desfasada por el
momento en que se la colocó. Era **accidental** —dependía de si el Transport estaba corriendo o
parado— y no estaba documentado ni testeado, así que el rediseño del 002 lo eliminó como efecto
colateral de una simplificación legítima.

**De producto.** El proyecto se trata de que la geometría produzca música, y hoy la posición en el
tablero **no determina nada**:

| Entrada | Determina |
|---|---|
| Qué pieza | La tónica |
| Rotación | La escala |
| Reflexión | El orden de las notas |
| La forma | Nada, hoy — lo ataca el [spec 001](../001-notas-por-celda-en-orden-angular/spec.md) |
| **Dónde se coloca** | **Nada** |

Un tablero de 10×6 donde mover una pieza a la izquierda o a la derecha no cambia absolutamente nada es
una superficie desaprovechada.

## Solución Propuesta

**La columna de la celda de agarre determina en qué momento del compás arranca la pieza.** El tablero
deja de ser un lienzo y pasa a ser un secuenciador: el eje X es tiempo.

```
compás  ├────────────────────────────────────────────────┤
col 0   ●━━━━━                                              pieza en x=0 → arranca en el downbeat
col 3          ●━━━━━                                       pieza en x=3 → a 3/10 del compás
col 7                          ●━━━━━                       pieza en x=7 → a 7/10
```

Tres cambios, en orden de dependencia:

1. **`Job` gana un campo `phase`**, fracción `0 ≤ phase < 1` del compás.
2. **`collectHits` se reformula sobre un origen** en vez de un cursor de compás (D2). Es lo que permite
   que cada job tenga su propio desplazamiento sin perder la garantía de agendado corto.
3. **`App.tsx` calcula la fase al colocar**, desde la columna de la celda de agarre.

### Decisiones de diseño

**D1 — La fase se deriva de la geometría, no del reloj de pared.**

La alternativa obvia era reproducir el comportamiento viejo: `phase = (ahora − inicioDelCompás) / compás`
al colocar. Se rechaza por tres motivos:

- **No es reproducible.** El mismo tablero suena distinto según con qué timing lo armaste. No se puede
  guardar, compartir ni testear.
- **No es visible.** El usuario oye un desfase y no tiene forma de saber de dónde salió ni cómo
  cambiarlo.
- **No es del proyecto.** El resto del instrumento mapea decisiones geométricas a decisiones musicales.
  Meter el reloj de pared como entrada rompe esa regla.

Derivarla de la columna cumple las tres: determinista, visible en el tablero, y coherente con
`BASE_MAP` y `notesForRotation`.

**D2 — El cursor de compás se reemplaza por un origen más un `scheduledUntil`.**

Con el cursor actual, la única forma de agendar una pieza desfasada es emitir todo su compás de una:
`nextBar + phase * bar` puede caer hasta un compás entero en el futuro. Eso rompe la propiedad que hace
responsivo al motor — **hoy nunca hay más de 100 ms comprometidos**, así que quitar una pieza la calla
casi al instante. Con emisión por compás, quitarla dejaría hasta 2.18 s de notas ya agendadas sonando a
110 bpm.

La reformulación mantiene la ventana corta:

```ts
export interface ClockState {
  /** instante del compás 0 en el reloj del contexto */
  origin: number;
  /** hasta dónde ya se emitió; evita re-emitir el mismo onset en ticks sucesivos */
  scheduledUntil: number;
}
```

Los onsets de un job son `origin + (k + phase) * bar` para `k` entero. Dado un intervalo se resuelve el
primer `k` en forma cerrada y se emiten solo los que caen adentro. No hay bucle de recuperación: los
compases perdidos por el estrangulamiento de la pestaña **se saltean solos**, porque el primer `k` se
calcula desde el instante actual. La guarda explícita de recuperación del 002 desaparece.

**D3 — `phase` es una fracción del compás, no segundos.**

Guardarla en segundos la ataría al tempo con el que se colocó la pieza: mover el slider dejaría los
desfases donde estaban y el resultado no tendría relación con la grilla. Como fracción, el patrón se
mantiene proporcional a cualquier tempo. `collectHits` ya recibe `bpm`; la multiplicación vive ahí.

**D4 — La celda de agarre, no el borde izquierdo de la pieza.**

Las dos son defendibles: el borde izquierdo es lo que un usuario lee como "cuándo empieza" en un
secuenciador. Se elige la celda de agarre porque **es la celda que el usuario clickeó** —control
directo, sin intermediarios— y porque `ANCHOR_INDEX` ya es el punto de referencia canónico de cada
pieza, estable ante rotaciones por el invariante de orden del array.

**D5 — El disparo al colocar sigue siendo inmediato.**

`playNow` no lleva fase. Hacés click y suena: es retroalimentación del gesto, no parte del patrón. La
fase solo gobierna el loop.

**D6 — El ancho del tablero es el compás.**

`phase = x / GRID_W`, es decir 10 pasos por compás y no 16. Es lo que el tablero muestra, y hacerlo
coincidir con una grilla de semicorcheas obligaría a que 6 de las 16 subdivisiones no fueran
alcanzables desde ninguna columna. Que la grilla resultante no sea 4/4 es aceptable: esto es un
instrumento, no una caja de ritmos.

## Criterios de Aceptación

- **AC1** — `Job` tiene `phase: number` y `collectHits` lo respeta: los onsets del job caen en
  `origin + (k + phase) * bar + i * spread`.
- **AC2** — `phase: 0` en todos los jobs reproduce exactamente el comportamiento actual. Es el test de
  no-regresión de la reformulación de D2.
- **AC3** — Ningún onset se emite dos veces aunque los ticks se solapen: llamar a `collectHits` en
  ventanas consecutivas de 25 ms sobre un horizonte de 100 ms produce cada onset una sola vez.
- **AC4** — Ningún onset se emite en el pasado: para cualquier llamada, todo `hit.at ≥ fromTime`.
- **AC5** — **Ningún onset se agenda con más de `horizon` de anticipación**, con cualquier `phase`
  incluida 0.99. Se mide sobre el instante del onset, no sobre la última nota del arpegio: el arpegio
  extiende `(notes − 1) × spread` más allá, exactamente igual que hoy. Es la garantía que protege D2;
  sin ella quitar una pieza deja hasta un compás de notas colgadas.
- **AC6** — Recuperación de la pestaña oculta: con un salto grande de tiempo entre llamadas, los
  compases perdidos se saltean y **no** se emite una avalancha de onsets atrasados. Un salto de 10
  compases produce como mucho los onsets del horizonte pedido.
- **AC7** — Medido con `OfflineAudioContext` a 110 bpm: el pico de dos piezas con `phase` 0 y 0.5 es
  **menor** que el de las mismas dos piezas con `phase` 0, y su cantidad de onsets detectados es el
  doble. Es el AC que expresa el problema real — deja de apilarse volumen y empiezan a aparecer eventos.
- **AC8** — En `App.tsx`, la fase sale de la columna de la celda de agarre: colocar la misma pieza en
  dos columnas distintas produce jobs con `phase` distinta, y en la misma columna produce la misma.
- **AC9** — Cambiar el tempo no cambia el patrón relativo (D3): las fases son fracciones y siguen
  proporcionales.
- **AC10** — `npx tsc -b --noEmit` en 0, `npm run lint` en 0, `npm test` en verde, `npm run build` en
  verde.

## Fuera de Alcance

- **Mostrar la fase en la UI.** Una cabeza lectora recorriendo el tablero, o marcar la columna que está
  sonando, es la feature que hace *entendible* a esta. Merece su propio spec y encaja naturalmente con
  el [spec 003](../003-visualizacion-de-la-senal-con-analysernode/spec.md), que ya trae el canvas.
  **Sin eso, esta feature se oye pero no se lee.** Es la limitación consciente de este spec.
- **Que la fila (`y`) determine algo.** Octava, duración y velocity son candidatos obvios. Un eje por
  vez: primero se comprueba que el eje X se sienta bien.
- **Cuantización configurable.** D6 fija `x / GRID_W`. Un selector de grilla (10 pasos / semicorcheas /
  tresillos) es una decisión de producto que conviene tomar después de escuchar la primera versión.
- **`ARPEGGIO_SPREAD` en unidades musicales.** Hoy son 0.15 s absolutos, independientes del tempo: a
  160 bpm el arpegio ocupa una fracción mucho mayor del compás que a 60. Es una inconsistencia real y
  **este spec la deja intacta a propósito** — cambiarla altera cómo suena todo, incluido el disparo al
  colocar, y merece medirse aparte.
- **Silenciar o aislar piezas** (mute / solo). Otra feature, otro spec.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **La reformulación de `collectHits` (D2) es un cambio de fondo en el corazón del scheduler**, no un agregado. Un error de un compás acá se oye como el instrumento entero desafinado en el tiempo. | AC2 es explícitamente el test de no-regresión: con `phase: 0` el comportamiento tiene que ser idéntico al actual. AC3–AC6 cubren re-emisión, pasado, anticipación y recuperación — los cuatro modos en que un scheduler basado en origen se rompe. |
| Con el tablero lleno, 6 piezas × 5 notas = 30 voces por compás. Hoy son 30 pero simultáneas; con fase quedan repartidas, aunque el pico de concurrencia sigue siendo alto. | Es una mejora, no un empeoramiento: repartir baja el pico. Si aun así satura, el seguimiento de D2 del spec 002 (pool de voces / voice stealing) es el lugar donde se ataca, no acá. |
| A tempos rápidos el arpegio de una pieza se solapa con el de la siguiente. A 160 bpm el compás dura 1.5 s y el arpegio 1.07 s, así que dos piezas a media fase se pisan. | **Es el comportamiento deseado**: solaparse *desfasadas* produce textura; solaparse *alineadas* produce volumen. AC7 se mide a 110 bpm, el tempo por defecto, y el spec no promete separación total a cualquier tempo. |
| Sin retroalimentación visual, el usuario oye un desfase y lo lee como un bug del motor. | Riesgo real y aceptado, anotado arriba en Fuera de Alcance. Si al escuchar la primera versión se siente arbitrario, la cabeza lectora deja de ser seguimiento y pasa a ser bloqueante. |
| `phase` derivada de la columna hace que mover una pieza cambie *cuándo* suena, y hoy no hay "mover" — solo quitar y volver a colocar. | Coherente con el modelo actual: el `id` cambia, el job se recrea con su fase nueva. El efecto de reconciliación ya cubre ese camino sin cambios. |

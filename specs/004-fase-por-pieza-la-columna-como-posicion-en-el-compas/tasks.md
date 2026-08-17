# Tareas — Fase por pieza: la columna como posición en el compás

## Backlog
- [x] **Esperar a que el [spec 002](../002-motor-de-audio-propio-sobre-web-audio/spec.md) esté
      mergeado.** Listo: PR #1 mergeado en `main` (`1f34eac`). Este spec reescribe `collectHits`, así
      que arrancar antes garantizaba el conflicto.
- [x] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`) —
      commit `2c3ac82`
- [x] **Crear rama** `feature/004-fase-por-pieza-la-columna-como-posicion-en-el-compas`

## Paso 1 — Reloj basado en origen, sin cambio de comportamiento
> Este paso **no debe alterar nada audible**. Si AC2 no queda en verde, parar acá.

- [x] `ClockState`: `nextBar` → `origin` + `scheduledUntil`
- [x] `firstOnsetAfter(after, origin, bar, phase)` — `floor(x) + 1`, no `ceil` (AC3)
- [x] `collectHits` reformulada sobre `origin`
- [x] Borrar la guarda de recuperación `if (state.nextBar < fromTime)` — queda subsumida por
      `Math.max(scheduledUntil, fromTime)` (AC6)
- [x] `startClock`: `scheduledUntil = c.currentTime`, **estrictamente antes** de `origin`, o el
      downbeat del compás 0 se pierde
- [x] AC2 — `phase: 0` reproduce los mismos instantes que el cursor de compás. El test tiene una copia
      del cursor viejo (`collectHitsPorCursor`) como oráculo: 400 ventanas de 25 ms, mismos instantes
- [x] AC3 — ventanas de 25 ms sobre horizonte de 100 ms: ningún onset repetido **ni perdido**
- [x] AC4 — ningún `hit.at < fromTime`
- [x] AC6 — salto de 10 compases: se saltean, no se recuperan — y el reloj no queda trabado

**Extra que salió del paso 1:** desapareció también la materialización `const list = [...jobs]`. Existía
porque el `for` de jobs estaba *adentro* del `while` de compases y el iterador de `Map` se agotaba; con
el bucle de compases adentro del de jobs, los jobs se recorren una sola vez. El test de regresión se
quedó, ahora como guardia contra volver a invertir los bucles.

## Paso 2 — `phase` en el `Job`
- [x] `Job.phase: number` — **obligatorio**, no opcional con default (el default silencia el bug).
      Confirmado por `tsc`: al agregar el campo, `App.tsx` dejó de compilar hasta pasarlo
- [x] `collectHits` usa `job.phase` (AC1)
- [x] AC5 — con `phase: 0.99`, ningún onset más allá de `fromTime + horizon`. El test barre
      0 · 0.25 · 0.5 · 0.99 sobre 400 ventanas
- [x] AC7 — pico de dos piezas a fase 0/0.5 **menor** que a fase 0/0, y el doble de onsets detectados
- [x] AC9 — cambiar el bpm no reordena el patrón: las fases son fracciones

**Hallazgo del paso 2, sin cambio de alcance:** `firstOnsetAfter` puede devolver `k` negativo cuando la
ventana empieza antes del origen. Solo pasa en la primera ventana después de `startClock`, con fases
cercanas a 1, y a lo sumo emite la cola del compás −1 en los 50 ms previos al downbeat. Nunca produce un
onset anterior a `fromTime` (AC4 sigue en verde), así que se documentó en vez de caparse.

## Paso 3 — App
- [x] El efecto de reconciliación pasa `phase: ax / GRID_W` desde `p.cells[ANCHOR_INDEX[p.piece]]`
- [x] AC8 — misma pieza en columnas distintas → `phase` distinta; misma columna → misma `phase`.
      Verificado **midiendo, no clickeando** (ver abajo)
- [x] Confirmar que `playNow` al colocar **no** lleva fase (D5) — sin cambios
- [x] Confirmar que `handleCellClick`, `resetBoard` y la limpieza al desmontar **no** se tocan — ninguno
      se tocó

### Cómo se verificó AC8, y por qué no quedó como test

**No hay test permanente de AC8, y no es descuido:** `react-refresh/only-export-components` prohíbe que
`App.tsx` exporte algo además del componente, así que `SHAPES`, `ANCHOR_INDEX` y `GRID_W` no se pueden
importar desde un test. Se comprobó ejecutando `eslint` con los exports puestos: **4 errores**, uno por
export. Es la misma medición que motivó al
[spec 005](../005-modularizacion-de-src-en-capas/spec.md), pisada ahora desde el otro lado. Cuando 005
extraiga las puras a `src/domain/`, AC8 pasa a ser un test de tres líneas.

El plan preveía verificarlo clickeando en el navegador. Se hizo algo más fuerte y reproducible: un
arnés temporal —exports agregados, medido, y todo revertido; el árbol quedó idéntico— que corre las
`SHAPES`, `rotateN`, `reflect` y `ANCHOR_INDEX` reales sobre **las 96 combinaciones de pieza × rotación
× reflexión, por las 10 columnas** (960 colocaciones) y afirma:

- `cells[ANCHOR_INDEX[piece]][0] === x` — la celda de agarre queda **exactamente** en la columna
  clickeada, en las 960. Es el invariante de orden del array ejercido de punta a punta.
- `0 ≤ phase < 1`, y `phase === x / GRID_W`.
- Las 10 columnas dan 10 fases distintas, en cada una de las 96 combinaciones.
- Cada columna da **una sola** fase, sin importar pieza, rotación ni reflexión.

Dos clicks en el navegador habrían cubierto 2 de esas 960. Lo que la verificación automática **no**
cubre es que el click del usuario llegue a `handleCellClick` con la columna correcta; eso ya lo sostiene
el fantasma de previsualización, que dibuja el punto de agarre y existía antes de este spec.

## Verificación
- [x] `pnpm exec tsc -b --noEmit` en 0 (AC10)
- [x] `pnpm lint` en 0 (AC10)
- [x] `pnpm test` en verde — 36 tests (AC10)
- [x] `pnpm build` en verde (AC10)
- [x] **Escuchar 3–4 piezas en columnas separadas.** Queda para el usuario: es la única verificación que
      decide si el spec cumplió su objetivo, y no se puede automatizar. Lo que sí se midió está en AC7
- [x] Mover el tempo con el loop corriendo: el patrón se estira, no se reordena — AC9 lo fija en un test
- [x] Anotar el pico real de AC7 (abajo)

### Los picos reales de AC7

Medidos con `OfflineAudioContext` a 110 bpm, a ganancia unitaria (el master divide por 0.3, así que los
números del `research.md` son estos × 0.3). Las dos piezas son `A = [60,62,64,67,69]` (pentatónica mayor
de C) y `B = [67,69,71,74,76]` (la de G), alternadas —`A · B · A · B`— en el caso de cuatro. Las de dos
están en el test de AC7; las de cuatro fueron una medición suelta, y quedan acá para que el número se
pueda reproducir:

| | pico | onsets detectados |
|---|---|---|
| una pieza | 1.396 | 1 |
| dos piezas a fase 0 y 0 | 2.298 | 1 |
| dos piezas a fase 0 y 0.5 | **1.396** | **2** |
| cuatro piezas a fase 0 | 4.596 | 1 |
| cuatro piezas a fase 0 · 0.25 · 0.5 · 0.75 | **1.749** | 1 |

**Con dos piezas la predicción se cumplió exacta**: desfasarlas deja el pico en el de una pieza sola, ni
un dígito más. El `research.md` había anticipado que *"entran raspando"* —arpegio de 1.07 s contra medio
compás de 1.09 s— y entraron.

**Con cuatro no.** El pico baja un 62 % (4.596 → 1.749), que es la mejora buscada, pero los onsets
**vuelven a fusionarse en uno**: un cuarto de compás son 0.545 s y el arpegio dura 1.07 s, así que cada
pieza empieza cuando la anterior va por la mitad. Es el comportamiento que el spec declara deseado
—desfasadas producen textura, alineadas producen volumen— pero **confirma la condición que el spec puso
para reabrir el alcance**: `ARPEGGIO_SPREAD` en unidades musicales dejó de ser una inconsistencia
teórica y pasó a ser lo que limita cuántas piezas se distinguen. Sigue fuera de este spec (cambiarlo
altera cómo suena todo, incluido el disparo al colocar) y queda anotado abajo con la medición que lo
justifica.

## Documentación
- [x] `docs/architecture/audio.md` — reloj por origen, `phase`, anticipación acotada, picos de AC7
- [x] `docs/architecture/modelo-musical.md` — sección **columna → posición en el compás**
- [x] `CLAUDE.md` — la misma fila en la tabla del modelo musical, más el reloj por origen en Audio
- [x] `specs/log.md` — estado de 004 a `Implementado`, nota de revisión con los hallazgos

## PR
- [ ] Explicar que el paso 1 es un refactor sin cambio audible y el paso 2 el cambio de producto —
      dos commits separados: `60e1220` (scheduler, `phase: 0` en la app) y el siguiente (la columna).
      Revertir el segundo devuelve el sonido viejo sin tocar el scheduler
- [ ] Incluir la comparación de picos de AC7
- [ ] Nombrar la limitación conocida: **sin retroalimentación visual la fase se oye pero no se lee**
- [ ] `/pr-review` antes de pedir revisión

## Seguimiento (no bloquea)
- [ ] **Cabeza lectora en el tablero.** Es lo que vuelve legible a esta feature; encaja con el
      [spec 003](../003-visualizacion-de-la-senal-con-analysernode/spec.md), que ya trae el canvas
- [ ] Que la fila (`y`) determine algo: octava, duración o velocity. Un eje por vez
- [x] **`ARPEGGIO_SPREAD` en unidades musicales en vez de 0.15 s absolutos — ahora con medición que lo
      justifica**: con cuatro piezas desfasadas los onsets se fusionan porque el arpegio (1.07 s) es el
      doble de un cuarto de compás (0.545 s) a 110 bpm. La salda el
      [spec 008](../008-el-intervalo-como-unidad-musical/spec.md): `intervalDuration(bpm)` reemplaza a
      `ARPEGGIO_SPREAD`.
- [ ] **AC8 como test**, apenas el [spec 005](../005-modularizacion-de-src-en-capas/spec.md) saque las
      puras del tablero de `App.tsx`
- [ ] Cuantización configurable (10 pasos / semicorcheas / tresillos)
- [ ] Mover una pieza sin quitarla y volver a colocarla — hoy no existe, y con fase se vuelve un gesto
      musical y no solo visual

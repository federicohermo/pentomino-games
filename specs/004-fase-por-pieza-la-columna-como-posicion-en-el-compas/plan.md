# Plan de Implementación — Fase por pieza

> **Desbloqueado.** Se apoya en `collectHits`, `Job` y `ClockState`, que solo existen con el
> [spec 002](../002-motor-de-audio-propio-sobre-web-audio/plan.md) mergeado (`1f34eac`).

## Orden

1. Reformular `collectHits` sobre un origen, **con `phase` fija en 0** → AC2 en verde
2. Recién ahí, agregar `phase` al `Job` → AC1, AC5, AC7
3. Conectar `App.tsx` → AC8
4. Verificación y documentación

**El paso 1 no cambia ningún comportamiento audible.** Esa es toda su gracia: separa el cambio
estructural riesgoso del cambio de producto, y AC2 dice si salió bien antes de que haya nada nuevo que
escuchar. Si el paso 1 no queda idéntico, no se sigue.

## 1. Reformular el reloj — `src/audio/engine.ts`

### El estado

```ts
export interface ClockState {
  /** instante del compás 0 en el reloj del contexto */
  origin: number;
  /**
   * Hasta dónde ya se emitieron onsets. Sin esto cada onset se emitiría cuatro
   * veces: los ticks son de 25 ms y el horizonte de 100 ms, así que ventanas
   * consecutivas se solapan.
   */
  scheduledUntil: number;
}
```

### El cálculo del primer onset

```ts
/**
 * Primer onset del job estrictamente posterior a `after`.
 *
 * `floor(x) + 1` y no `ceil(x)`: queremos el primer k con at > after, no >=.
 * Con `ceil`, un onset que cae exactamente en el borde de la ventana se emitiría
 * dos veces — una al cerrar una ventana y otra al abrir la siguiente.
 */
function firstOnsetAfter(after: number, origin: number, bar: number, phase: number): number {
  const k = Math.floor((after - origin) / bar - phase) + 1;
  return origin + (k + phase) * bar;
}
```

### `collectHits`

```ts
export function collectHits(
  fromTime: number,
  horizon: number,
  bpm: number,
  jobs: Iterable<Job>,
  state: ClockState,
): Hit[] {
  const bar = barDuration(bpm);
  const until = fromTime + horizon;
  const out: Hit[] = [];

  // Recuperación del estrangulamiento de la pestaña: si el reloj de audio se
  // adelantó mucho, scheduledUntil quedó atrás. Arrancar desde fromTime DESCARTA
  // los compases perdidos en vez de recuperarlos. No hay bucle que acotar: el
  // primer k sale en forma cerrada, así que saltear 10 compases cuesta lo mismo
  // que saltear 1.
  const from = Math.max(state.scheduledUntil, fromTime);
  if (from >= until) return out;

  for (const job of jobs) {
    for (let at = firstOnsetAfter(from, state.origin, bar, job.phase); at <= until; at += bar) {
      job.notes.forEach((m, i) => out.push({ hz: midiToHz(m), at: at + i * job.spread }));
    }
  }

  state.scheduledUntil = until;
  return out;
}
```

**Sobre el `at += bar` del bucle:** acumula error de punto flotante, pero el bucle da como mucho una
vuelta por llamada —el horizonte es 100 ms y el compás 2.18 s a 110 bpm— y cada llamada recalcula desde
`origin`. No hay deriva que acumular entre llamadas, que es donde sí importaría.

### `startClock`

```ts
export function startClock(): void {
  if (timer !== null) return;
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  clock.origin = c.currentTime + 0.05;
  // Estrictamente ANTES de origin, para que el downbeat del compás 0 entre en la
  // primera ventana. Con scheduledUntil = origin, firstOnsetAfter lo saltearía y
  // el primer sonido llegaría un compás tarde.
  clock.scheduledUntil = c.currentTime;
  timer = window.setInterval(tick, TICK_MS);
}
```

`tick()` no cambia: ya delega todo en `collectHits`.

### Tests del paso 1 (AC2, AC3, AC4, AC6)

```ts
const job = (phase = 0): Job => ({ id: 'a', notes: [60, 64, 67], spread: 0.15, phase });

it('AC2 — phase 0 reproduce los instantes del cursor de compás', () => {
  // Recorre 20 ventanas de 25 ms y compara contra la progresión origin + k*bar,
  // que es exactamente lo que producía la implementación anterior.
});

it('AC3 — ventanas solapadas no re-emiten', () => {
  const st = { origin: 0, scheduledUntil: 0 };
  const all: number[] = [];
  for (let t = 0; t < 10; t += 0.025)
    all.push(...collectHits(t, 0.1, 110, [job()], st).map(h => h.at));
  expect(new Set(all).size).toBe(all.length);   // ningún instante repetido
});

it('AC4 — nada en el pasado', () => { /* todo hit.at >= fromTime */ });

it('AC5 — nada más allá del horizonte', () => {
  // con phase 0.99, el peor caso
  for (const h of collectHits(5, 0.1, 110, [job(0.99)], st))
    expect(h.at - h.i * 0.15).toBeLessThanOrEqual(5.1);
});

it('AC6 — un salto de 10 compases no dispara una avalancha', () => {
  const st = { origin: 0, scheduledUntil: 0 };
  collectHits(0, 0.1, 110, [job()], st);
  const tras = collectHits(0.1 + 10 * (60 / 110) * 4, 0.1, 110, [job()], st);
  expect(tras.length).toBeLessThanOrEqual(3);   // un solo compás de notas
});
```

## 2. `phase` en el `Job`

```ts
export interface Job {
  id: string;
  notes: number[];
  /** segundos entre notas consecutivas del arpegio */
  spread: number;
  /**
   * Posición dentro del compás, 0 ≤ phase < 1. Fracción y no segundos: así el
   * patrón se mantiene proporcional al cambiar el tempo (D3).
   */
  phase: number;
}
```

Es un campo obligatorio y no opcional con default 0: **hacerlo opcional deja pasar silenciosamente el
caso en que alguien agrega un job y se olvida de la fase**, que es exactamente el bug que este spec
corrige. Que TypeScript lo exija es la mitad del valor del cambio.

### Test del paso 2 (AC1, AC7, AC9)

```ts
it('AC7 — desfasar dos piezas baja el pico y duplica los onsets', async () => {
  const alineadas = await renderJobs([job(0), job(0)]);
  const desfasadas = await renderJobs([job(0), job(0.5)]);
  expect(peak(desfasadas)).toBeLessThan(peak(alineadas));
  expect(detectOnsets(desfasadas).length).toBe(detectOnsets(alineadas).length * 2);
});
```

`detectOnsets` ya existe en `src/audio/test-context.ts` (seguidor de envolvente con histéresis; ver el
spec 002 — un umbral crudo no sirve).

## 3. Conectar `App.tsx`

El efecto de reconciliación **conserva su forma**; solo calcula un campo más:

```ts
useEffect(()=>{
  clearJobs();
  if (!loopPlaced) return;
  for (const p of placed){
    // La columna de la celda de agarre es la posición en el compás (D4). Sale por
    // índice y no por búsqueda gracias al invariante de orden del array: cells se
    // construye con transformedShape.map(...), así que ANCHOR_INDEX sigue
    // apuntando a la celda de agarre ya en coordenadas de tablero.
    const [ax] = p.cells[ANCHOR_INDEX[p.piece]];
    addJob({ id: p.id, notes: p.notes, spread: ARPEGGIO_SPREAD, phase: ax / GRID_W });
  }
}, [placed, loopPlaced]);
```

**No hace falta tocar `handleCellClick`, `resetBoard` ni la limpieza al desmontar.** Que un cambio de
producto entre por una sola línea dentro del efecto es la prueba de que el patrón de reconciliación del
002 se sostiene.

`playNow(noteSet)` al colocar queda como está: sin fase (D5).

## 4. Verificación

```bash
npx tsc -b --noEmit
npm run lint
npm test
npm run build
```

En el navegador, con el dev server:

- **AC8** — colocar la misma pieza en la columna 0 y en la 7 y confirmar dos `phase` distintas:
  ```js
  const e = await import('/src/audio/engine.ts');
  // exponer temporalmente los jobs, o inspeccionar por el conteo de onsets
  ```
- **La verificación que importa es auditiva**: colocar 3–4 piezas en columnas separadas, activar el
  loop, y confirmar que se oyen como eventos distintos y no como un acorde que se repite.
- Mover el slider de tempo con el loop corriendo: el patrón tiene que estirarse proporcionalmente, sin
  reordenarse (AC9).

## 5. Documentación

- `docs/architecture/audio.md` — el reloj basado en origen reemplaza al cursor de compás; documentar
  `phase` y la garantía de anticipación acotada.
- `docs/architecture/modelo-musical.md` — agregar la fila **columna → posición en el compás** a la
  tabla de entradas geométricas. Es el cambio de documentación que más importa: es la primera vez que
  el tablero significa algo.
- `CLAUDE.md` — la tabla del modelo musical tiene la misma fila.
- `specs/log.md` — estado de 004 a `Implementado`.

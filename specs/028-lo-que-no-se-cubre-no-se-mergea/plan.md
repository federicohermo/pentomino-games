# Plan — 028

## Orden, y por qué este

El spec tiene una asimetría que gobierna todo el plan: **el 60 % del trabajo no depende del 024** —la
configuración, el `mcp-server`, `invariants.ts`, `route-source.ts`, los presupuestos— y el 40 %
restante no se puede ni empezar sin él. Así que las fases 1, 2 y 3 se pueden hacer con el 024 todavía
en `Propuesto`, y sólo la 4 lo espera.

Y una decisión de secuencia que evita una rama en rojo durante días:

> **El umbral 100 se pone en la última tarea, no en la primera.** Hasta ahí el nodo `coverage` corre y
> reporta sin `thresholds`. Poner el gate primero deja `pnpm verify` en rojo desde el commit 1 hasta el
> final, y una verificación que se sabe rota deja de mirarse — que es justo el hábito que este spec
> viene a cerrar.

## Fase 1 — El instrumento (no depende del 024)

Instalar `@vitest/coverage-v8`, escribir el bloque `coverage` en `vite.config.ts` con `include`,
`exclude` y el reporter `text`, y agregar el script `coverage`. `verify` pasa a cinco nodos.

El regex de `verify` es el punto delicado: `"/^(lint|typecheck|test|coverage|mcp:test)$/"`. El ancla
`$` que `CLAUDE.md` documenta sigue siendo obligatoria y ahora hay **dos** motivos, no uno — sin ella
el patrón engancha `test:watch` **y** cualquier `coverage:*` futuro.

Al terminar la fase, `pnpm coverage` imprime la tabla del research y devuelve **0**: todavía no hay
gate.

## Fase 2 — Lo que se cierra sin navegador

Cuatro frentes independientes entre sí, todos en `environment: 'node'`:

1. **Los dos presupuestos de performance.** `skipIf` sobre una env var que el script `coverage` fija.
   El comentario tiene que llevar el número medido (11,3 ms contra un techo de 5), porque un `skipIf`
   sin la medición al lado se lee como un test que alguien apagó.
2. **`domain/invariants.ts` al 100 % de ramas.** Es el frente con más valor y el que más se parece a
   escribir tests de verdad: cada rama que falta es el camino de **violación** de un invariante. Se
   construye el tablero o la pieza que lo viola y se afirma el reporte.
3. **`components/route-source.ts`, ramas 141 y 148-181.** Si alguna resulta inalcanzable, D4 manda:
   se borra o se vuelve alcanzable, y se anota en `research.md`.
4. **`mcp-server` al 100 %.** Los flags de node primero —sin umbral—, después los tests: el `run` de
   `findSymbol` y de `specStatus`, `specs.ts` 176-237, `symbols.ts` 241-295. Recién al final los tres
   `--test-coverage-*=100`.

Los cuatro son paralelizables: no comparten archivo.

## Fase 3 — `audio/engine.ts` (depende del 024)

374 líneas y el archivo con más riesgo técnico del spec, por el estado de módulo. La estrategia está
en §8 del research: un archivo propio, `vi.resetModules()` entre casos y `await import()` dinámico,
para que cada test vea un `AudioContext` nuevo.

Va antes que la UI aunque las dos dependan del 024, por dos motivos: es la única de las dos que **no
es UI** —o sea, la que el repo más echa de menos— y desbloquea la mitad de los tests de `Spectrum.tsx`
y `use-engine.ts`, que leen del motor.

Se parte en tres bloques que se pueden hacer en paralelo: el grafo (`audio`, `readSpectrum`,
`playNotes`, `playNow`), el reloj (`startClock`, `stopClock`, `tick`, `outputLatency`,
`playheadOffset`) y los accesores (`setBpm`, `setClicksAudible`, `setSequence`, `sequenceInfo`,
`clockRunning`, `cycleGeneration`).

## Fase 4 — La UI (depende del 024)

Nueve archivos, 1 019 líneas. Un archivo de test por archivo de fuente, con el sufijo `.browser.test.tsx`
que fija D2 del 024.

Orden por dependencia, no por tamaño: primero los dos **hooks** (`use-engine.ts`, `use-input.ts`) con
`renderHook`, porque son los que `App.tsx` compone; después los seis `.tsx` de abajo hacia arriba
(`TransportPanel` → `OrientationPanel` → `PiecePalette` → `Spectrum` → `Playhead` → `Board`); y
`App.tsx` al final, que es el único que puede apoyarse en que todo lo demás ya tiene test.

**No se re-testea lo que el 024 ya cubrió.** Sus seis invariantes de layout ya existen; acá se agrega
lo que falta para el 100 %, y donde el 024 dejó un test se extiende, no se duplica.

## Fase 5 — El gate y el registro

En este orden, y sólo cuando `pnpm coverage` ya reporta 100 sin umbral:

1. `thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 }` y los tres
   `--test-coverage-*=100` del server.
2. **Verificar que el gate muerde**: comentar una rama cubierta, correr `pnpm verify`, confirmar exit
   1 y el mensaje, revertir. Un gate que nunca se vio fallar no es un gate.
3. `grep` de `v8 ignore` y `c8 ignore` — AC10.
4. `CLAUDE.md`: cinco nodos, la medición nueva de serie contra paralelo, y el segundo motivo del `$`.
5. `docs/guides/quickstart.md`: el paso de Chromium antes del primer `verify`.
6. `deuda.md`: el ítem de tests de UI, que el 024 dejó reescrito, se vuelve a mirar — con el 100 % la
   mitad que quedaba abierta cambia de forma otra vez.
7. `log.md` y `revisiones.md`.

## Verificación

- `pnpm verify` en verde con los cinco nodos.
- El gate visto fallar y revertido (paso 2 de la fase 5).
- `pnpm test` sin instrumentar sigue midiendo los dos presupuestos contra 5 ms y 4 ms.
- **[M]** Abrir la app y confirmar que suena igual: el spec no toca `src/` salvo si D4 obliga a borrar
  una rama muerta, y ese caso queda anotado.

## Fuera del plan

Snapshots visuales, mutation testing, migrar los 322 tests de `node`, y el reporte HTML. Están en
§Fuera de alcance del spec con su motivo.

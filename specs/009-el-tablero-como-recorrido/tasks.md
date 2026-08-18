# Tareas — El tablero como recorrido

## Backlog
- [x] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [x] Fila del 009 en `specs/log.md` (`Propuesto`)
- [x] Verificar que el **007 y el 008 estén mergeados**: este spec necesita el mapeo celda→grado y el
      intervalo. **Verificar por `git log`, no por `log.md`**: al 2026-08-17 los dos figuran ahí como
      `Propuesto` y los dos están mergeados (`4f6c40f`, PR #7) — mover el estado quedó pendiente del
      merge del 008. Si sigue así, corregirlo en la misma tarea de `log.md` de más abajo
- [x] Línea base de `simulate_board` (para el antes/después del PR, no para exigir igualdad)
- [x] **Crear rama** `feature/009-el-tablero-como-recorrido`

## La costura, la distancia y el camino
- [x] `SEAM` en `domain/constants/board.constants.ts`
- [x] Corregir el docblock de `GRID_W`: deja de ser "la cantidad de posiciones dentro del compás"
- [x] `RouteKind`: const-object en `domain/constants/route.constants.ts` + union derivado en
      `domain/types/sequence.types.ts` (nunca `enum`, y **nunca adentro del módulo**)
- [x] `bestRoute(a, b)` en `domain/board.ts`: **la única** decisión de cuál de las tres rutas conviene
- [x] `cellDistance` devuelve su largo; `pathBetween` materializa sus celdas intermedias (D8)
- [x] Documentar en `pathBetween` que `a === b` queda excluido y por qué no ocurre en el circuito
- [x] **Escribir AC7b antes que la función**: es donde falló 114 veces la implementación de prueba
- [x] Test AC7b — `pathBetween.length === cellDistance − 1` sobre los pares **distintos**: se recorren
      3.600 combinaciones y se asevera sobre **3.540** (60 × 60 menos la diagonal)
- [x] Test — las celdas del camino son adyacentes de a pares y no se repiten
- [x] Test — los bordes de la costura: origen que ya es la esquina, destino que ya es la esquina
- [x] Test — `(0,0)` ↔ `(9,5)` da 1 (AC2)
- [x] Test — la distancia máxima del tablero es 12, no 14 (AC2)
- [x] Test — simetría y desigualdad triangular sobre las 3.600 combinaciones
- [x] **Commit aparte**: borrar `phaseFor` y sus 5 tests de `board.test.ts`

## La secuencia (dominio puro, sin sonido)
- [x] `domain/types/sequence.types.ts`: `Step`, `Click`, `Sequence` — los tipos que cruzan un límite
      van a `<capa>/types/`, no al módulo (`directory-structure.md:163`)
- [x] `domain/sequence.ts`: puertas por pieza (grado 0 = entrada, grado 4 = salida)
- [x] Matriz de costos asimétrica `dist(salida(i), entrada(j))`
- [x] Held-Karp exacto, con desempate determinista por índice
- [x] Offsets acumulados (`4 + salto`); los clicks salen de `pathBetween`, con su celda y su instante
- [x] Test — AC1: el orden es el del circuito más corto, no el de colocación
- [x] Test — AC3: dos piezas adyacentes quedan contiguas (salto 1, sin silencio)
- [x] Test — AC10: 12 piezas en menos de 5 ms, **mediana de 21 corridas** y no una sola (2,7x de
      margen no sobrevive a una pausa de GC). Las 12 se arman **a mano**: colocarlas al azar es
      teselar el tablero entero y salió 0 de 200 (`research.md` §5)
- [x] Test — determinismo: el mismo tablero da siempre la misma secuencia
- [x] Test — bordes: cero piezas, una pieza

## Los tipos del motor
- [x] `Job` → `Sequence` en `audio/types/scheduler.types.ts`, **sin celdas**: `clicks` es solo
      `{ offset }`. `Cell` es del dominio y `eslint.config.js:75-91` prohíbe que `audio/` lo importe,
      también como `import type` (plan §3, AC12)
- [x] `HIT` como const-object + union derivado — **nunca `enum`**
- [x] `Hit` como unión discriminada: un click no tiene `hz` (y no se modela con `hz?`)

## El scheduler y el motor
- [x] `collectHits` con período de ciclo; **`firstOnsetAfter` no se toca**
- [x] Expansión de los clicks del recorrido
- [x] ~~Verificar si `node-web-audio-api` soporta `AudioBufferSourceNode`~~ — **medido, sí**
      (`research.md` §7). El oscilador corto queda como alternativa de timbre, no como plan B
- [x] `scheduleClick` en `audio/voice.ts`, con volumen propio
- [x] `setSequence` con activa + pendiente
- [x] Reponer la observabilidad que se va con `jobCount()`: pasos, clicks y largo del ciclo de la
      secuencia activa. `.claude/rules/audio.md` lo nombra como la receta para verificar en el
      navegador, así que borrarlo sin reemplazo rompe la regla
- [x] Swap en el cierre de ciclo, y el borde pasa a ser el nuevo `origin` (D5)
- [x] **En el swap, bajar `scheduledUntil` a justo antes del nuevo `origin`**: al cruzar el borde ya
      quedó adelante, y sin esto se pierde el primer onset del ciclo nuevo, callado (AC13)
- [x] Guarda de `length === 0`: sin pasos no hay borde de ciclo que calcular ni período por el que dividir
- [x] Caso especial: con la activa vacía, la pendiente entra ya, con `scheduledUntil` **antes** de `origin`
- [x] Test — AC5: cambiar la secuencia a mitad de ciclo no altera los hits hasta el borde
- [x] Test — AC6: nunca más de `LOOKAHEAD` comprometido, con un ciclo largo
- [x] Test — **AC13**: en el empalme del swap no se pierde ni se repite ningún onset

## Integración
- [x] `App.tsx`: el efecto pasa a `setSequence(buildSequence(placed))`, una sola llamada
- [x] `App.tsx` deja caer las celdas de los clicks al entregarle la secuencia al motor: es el único
      puente entre las capas y el motor no puede ver `Cell` (AC12)
- [x] La limpieza al desmontar pasa a `setSequence` vacía

## MCP server
- [x] `simulate_board` reescrita: **importa** `buildSequence`, no la reimplementa
- [x] `inputSchema`: `bars` (1–8) pasa a `cycles` (1–4, default 2) — sin esto los dos ciclos de AC4 no
      son expresables con 10 piezas (4,1 compases por ciclo)
- [x] Se va `jobTimeline` y su corte por onset: existía por la fase de cada job dentro del compás
- [x] Devuelve orden del circuito, saltos **con sus celdas**, ciclo (intervalos y segundos) y timeline
      con notas y clicks — el camino en la respuesta es lo que permite verificar el recorrido sin oírlo
- [x] Reescribir su `description`: la frase sobre columnas que se desfasan es del modelo viejo
      (`simulateBoard.ts:176-178`)
- [x] **`mcp-server/src/__tests__/tools.test.ts`: los cuatro asserts sobre `phase`** (`:202,208,211,262`)
      se caen con el campo. Sin tocarlos `pnpm mcp:test` queda rojo y AC11 no se puede cumplir
- [x] `pnpm mcp:test` en verde

## Documentación
- [x] `docs/architecture/modelo-musical.md`: la fase por pieza sale, entra el recorrido
- [x] `docs/architecture/audio.md`: `#fase-por-pieza`
- [x] `docs/architecture/overview.md:42,77`: `phaseFor` sale del inventario de `board.ts`
- [x] `docs/architecture/directory-structure.md:60`: ídem, más `sequence.ts` y su `types/`
- [x] `docs/guides/mcp-domain.md:36`: ídem, y qué ejecuta hoy `simulate_board`
- [x] `.claude/rules/audio.md` y `.claude/rules/domain.md`
- [x] `CLAUDE.md`: la tabla del modelo
- [x] `specs/log.md`: el 004 pasa a `Superado`, con el 009 como motivo

## Verificación
- [x] `pnpm verify` en verde (AC8, AC9, AC11, AC12)
- [x] AC12 — `pnpm lint`: `audio/` sigue sin importar nada de `domain/`, ni siquiera como `import type`
- [x] AC4 — `simulate_board` con `cycles: 2`: el empalme tiene el mismo espaciado que el interior
- [x] AC7 — un salto de `d` celdas produce `d − 1` clicks equiespaciados
- [ ] [M] A oído: 2 piezas adyacentes (contiguo), 2 piezas en esquinas opuestas (se oye el recorrido), 8 piezas
- [ ] [M] **A oído, lo que decide el spec**: colocar una pieza con 8 en el tablero y confirmar que esperar
      hasta 7,5 s es tolerable. Si no lo es, ver el riesgo de D5 antes de improvisar
- [ ] [M] Un tablero casi lleno (10 piezas): que los saltos de 1 no lo vuelvan un borrón

## PR
- [x] Antes/después de `simulate_board`: el compás contra el recorrido
- [x] Aclarar la latencia de D5: **es una decisión, no un bug**
- [x] Aclarar que `firstOnsetAfter` no cambió: el reloj sigue siendo un origen, no un cursor
- [ ] [M] `/pr-review` antes de pedir revisión — **quedó sin correr y el PR ya está mergeado.** Registro,
      no pendiente

## Seguimiento (no bloquea)

> **Cierre del seguimiento — 2026-08-18.** Todo lo de esta sección se resolvió o se movió a su
> lugar definitivo en la rama `chore/cierre-seguimientos-007-010`. Lo que quedó abierto dice dónde vive.

- [x] Retirar `PlacedPiece.notes` — ya no queda ninguna excusa. **Hecho**: lo deriva `arpeggioFor` y
      `buildSequence` la llama por paso. Sin cambio de audio
- [x] Medir `occupantAt` antes de que el 010 dibuje a ritmo de intervalo. **Medido**: un render entero
      del tablero con las 12 piezas —el peor caso, porque no queda celda vacía que corte antes— son 60
      llamadas y **4,1 µs** en total (p95 7,4 µs), o sea el 0,02 % de un cuadro de 16,7 ms. A 160 bpm el
      intervalo mide 93,75 ms: sobra por cuatro órdenes de magnitud. El número quedó en su docblock, y
      la cabeza del 010 igual no la usa
- [x] Esquivar piezas colocadas (BFS sobre celdas libres) — spec propio, con el caso "no hay camino".
      **Es el [spec 011](../011-el-recorrido-esquiva-las-piezas/spec.md)**, que además reemplazó el BFS
      sobre celdas libres por un PESO: rodear con excepción resultó ser la peor esquina de la curva
- [ ] Colocación envolvente sobre la costura — spec propio. **Sigue abierta y deja de vivir acá**: pasó
      a Deuda conocida de `specs/log.md`, que es la única fuente de lo que no tiene spec todavía
- [x] La dirección de dependencia dentro de `domain/` podría lintearse como la de capas. **Hecho**:
      `DOMAIN_INTERNO` en `eslint.config.js`, módulo por módulo y en tres niveles. Era la única
      dirección del repo que vivía sólo como dibujo

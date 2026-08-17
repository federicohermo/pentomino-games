# Tareas — El tablero como recorrido

## Backlog
- [ ] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [ ] Fila del 009 en `specs/log.md` (`Propuesto`)
- [ ] Verificar que el **007 y el 008 estén mergeados**: este spec necesita el mapeo celda→grado y el
      intervalo. **Verificar por `git log`, no por `log.md`**: al 2026-08-17 los dos figuran ahí como
      `Propuesto` y los dos están mergeados (`4f6c40f`, PR #7) — mover el estado quedó pendiente del
      merge del 008. Si sigue así, corregirlo en la misma tarea de `log.md` de más abajo
- [ ] Línea base de `simulate_board` (para el antes/después del PR, no para exigir igualdad)
- [ ] **Crear rama** `feature/009-el-tablero-como-recorrido`

## La costura, la distancia y el camino
- [ ] `SEAM` en `domain/constants/board.constants.ts`
- [ ] Corregir el docblock de `GRID_W`: deja de ser "la cantidad de posiciones dentro del compás"
- [ ] `RouteKind`: const-object en `domain/constants/route.constants.ts` + union derivado en
      `domain/types/sequence.types.ts` (nunca `enum`, y **nunca adentro del módulo**)
- [ ] `bestRoute(a, b)` en `domain/board.ts`: **la única** decisión de cuál de las tres rutas conviene
- [ ] `cellDistance` devuelve su largo; `pathBetween` materializa sus celdas intermedias (D8)
- [ ] Documentar en `pathBetween` que `a === b` queda excluido y por qué no ocurre en el circuito
- [ ] **Escribir AC7b antes que la función**: es donde falló 114 veces la implementación de prueba
- [ ] Test AC7b — `pathBetween.length === cellDistance − 1` sobre los pares **distintos**: se recorren
      3.600 combinaciones y se asevera sobre **3.540** (60 × 60 menos la diagonal)
- [ ] Test — las celdas del camino son adyacentes de a pares y no se repiten
- [ ] Test — los bordes de la costura: origen que ya es la esquina, destino que ya es la esquina
- [ ] Test — `(0,0)` ↔ `(9,5)` da 1 (AC2)
- [ ] Test — la distancia máxima del tablero es 12, no 14 (AC2)
- [ ] Test — simetría y desigualdad triangular sobre las 3.600 combinaciones
- [ ] **Commit aparte**: borrar `phaseFor` y sus 5 tests de `board.test.ts`

## La secuencia (dominio puro, sin sonido)
- [ ] `domain/types/sequence.types.ts`: `Step`, `Click`, `Sequence` — los tipos que cruzan un límite
      van a `<capa>/types/`, no al módulo (`directory-structure.md:163`)
- [ ] `domain/sequence.ts`: puertas por pieza (grado 0 = entrada, grado 4 = salida)
- [ ] Matriz de costos asimétrica `dist(salida(i), entrada(j))`
- [ ] Held-Karp exacto, con desempate determinista por índice
- [ ] Offsets acumulados (`4 + salto`); los clicks salen de `pathBetween`, con su celda y su instante
- [ ] Test — AC1: el orden es el del circuito más corto, no el de colocación
- [ ] Test — AC3: dos piezas adyacentes quedan contiguas (salto 1, sin silencio)
- [ ] Test — AC10: 12 piezas en menos de 5 ms, **mediana de 21 corridas** y no una sola (2,7x de
      margen no sobrevive a una pausa de GC). Las 12 se arman **a mano**: colocarlas al azar es
      teselar el tablero entero y salió 0 de 200 (`research.md` §5)
- [ ] Test — determinismo: el mismo tablero da siempre la misma secuencia
- [ ] Test — bordes: cero piezas, una pieza

## Los tipos del motor
- [ ] `Job` → `Sequence` en `audio/types/scheduler.types.ts`, **sin celdas**: `clicks` es solo
      `{ offset }`. `Cell` es del dominio y `eslint.config.js:75-91` prohíbe que `audio/` lo importe,
      también como `import type` (plan §3, AC12)
- [ ] `HIT` como const-object + union derivado — **nunca `enum`**
- [ ] `Hit` como unión discriminada: un click no tiene `hz` (y no se modela con `hz?`)

## El scheduler y el motor
- [ ] `collectHits` con período de ciclo; **`firstOnsetAfter` no se toca**
- [ ] Expansión de los clicks del recorrido
- [ ] ~~Verificar si `node-web-audio-api` soporta `AudioBufferSourceNode`~~ — **medido, sí**
      (`research.md` §7). El oscilador corto queda como alternativa de timbre, no como plan B
- [ ] `scheduleClick` en `audio/voice.ts`, con volumen propio
- [ ] `setSequence` con activa + pendiente
- [ ] Reponer la observabilidad que se va con `jobCount()`: pasos, clicks y largo del ciclo de la
      secuencia activa. `.claude/rules/audio.md` lo nombra como la receta para verificar en el
      navegador, así que borrarlo sin reemplazo rompe la regla
- [ ] Swap en el cierre de ciclo, y el borde pasa a ser el nuevo `origin` (D5)
- [ ] **En el swap, bajar `scheduledUntil` a justo antes del nuevo `origin`**: al cruzar el borde ya
      quedó adelante, y sin esto se pierde el primer onset del ciclo nuevo, callado (AC13)
- [ ] Guarda de `length === 0`: sin pasos no hay borde de ciclo que calcular ni período por el que dividir
- [ ] Caso especial: con la activa vacía, la pendiente entra ya, con `scheduledUntil` **antes** de `origin`
- [ ] Test — AC5: cambiar la secuencia a mitad de ciclo no altera los hits hasta el borde
- [ ] Test — AC6: nunca más de `LOOKAHEAD` comprometido, con un ciclo largo
- [ ] Test — **AC13**: en el empalme del swap no se pierde ni se repite ningún onset

## Integración
- [ ] `App.tsx`: el efecto pasa a `setSequence(buildSequence(placed))`, una sola llamada
- [ ] `App.tsx` deja caer las celdas de los clicks al entregarle la secuencia al motor: es el único
      puente entre las capas y el motor no puede ver `Cell` (AC12)
- [ ] La limpieza al desmontar pasa a `setSequence` vacía

## MCP server
- [ ] `simulate_board` reescrita: **importa** `buildSequence`, no la reimplementa
- [ ] `inputSchema`: `bars` (1–8) pasa a `cycles` (1–4, default 2) — sin esto los dos ciclos de AC4 no
      son expresables con 10 piezas (4,1 compases por ciclo)
- [ ] Se va `jobTimeline` y su corte por onset: existía por la fase de cada job dentro del compás
- [ ] Devuelve orden del circuito, saltos **con sus celdas**, ciclo (intervalos y segundos) y timeline
      con notas y clicks — el camino en la respuesta es lo que permite verificar el recorrido sin oírlo
- [ ] Reescribir su `description`: la frase sobre columnas que se desfasan es del modelo viejo
      (`simulateBoard.ts:176-178`)
- [ ] **`mcp-server/src/__tests__/tools.test.ts`: los cuatro asserts sobre `phase`** (`:202,208,211,262`)
      se caen con el campo. Sin tocarlos `pnpm mcp:test` queda rojo y AC11 no se puede cumplir
- [ ] `pnpm mcp:test` en verde

## Documentación
- [ ] `docs/architecture/modelo-musical.md`: la fase por pieza sale, entra el recorrido
- [ ] `docs/architecture/audio.md`: `#fase-por-pieza`
- [ ] `docs/architecture/overview.md:42,77`: `phaseFor` sale del inventario de `board.ts`
- [ ] `docs/architecture/directory-structure.md:60`: ídem, más `sequence.ts` y su `types/`
- [ ] `docs/guides/mcp-domain.md:36`: ídem, y qué ejecuta hoy `simulate_board`
- [ ] `.claude/rules/audio.md` y `.claude/rules/domain.md`
- [ ] `CLAUDE.md`: la tabla del modelo
- [ ] `specs/log.md`: el 004 pasa a `Superado`, con el 009 como motivo

## Verificación
- [ ] `pnpm verify` en verde (AC8, AC9, AC11, AC12)
- [ ] AC12 — `pnpm lint`: `audio/` sigue sin importar nada de `domain/`, ni siquiera como `import type`
- [ ] AC4 — `simulate_board` con `cycles: 2`: el empalme tiene el mismo espaciado que el interior
- [ ] AC7 — un salto de `d` celdas produce `d − 1` clicks equiespaciados
- [ ] A oído: 2 piezas adyacentes (contiguo), 2 piezas en esquinas opuestas (se oye el recorrido), 8 piezas
- [ ] **A oído, lo que decide el spec**: colocar una pieza con 8 en el tablero y confirmar que esperar
      hasta 7,5 s es tolerable. Si no lo es, ver el riesgo de D5 antes de improvisar
- [ ] Un tablero casi lleno (10 piezas): que los saltos de 1 no lo vuelvan un borrón

## PR
- [ ] Antes/después de `simulate_board`: el compás contra el recorrido
- [ ] Aclarar la latencia de D5: **es una decisión, no un bug**
- [ ] Aclarar que `firstOnsetAfter` no cambió: el reloj sigue siendo un origen, no un cursor
- [ ] `/pr-review` antes de pedir revisión

## Seguimiento (no bloquea)
- [ ] Retirar `PlacedPiece.notes` — ya no queda ninguna excusa
- [ ] Medir `occupantAt` antes de que el 010 dibuje a ritmo de intervalo
- [ ] Esquivar piezas colocadas (BFS sobre celdas libres) — spec propio, con el caso "no hay camino"
- [ ] Colocación envolvente sobre la costura — spec propio
- [ ] La dirección de dependencia dentro de `domain/` podría lintearse como la de capas

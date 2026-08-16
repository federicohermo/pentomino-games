# Tareas — El tablero como recorrido

## Backlog
- [ ] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [ ] Fila del 009 en `specs/log.md` (`Propuesto`)
- [ ] Verificar que el **007 y el 008 estén mergeados**: este spec necesita el mapeo celda→grado y el intervalo
- [ ] Línea base de `simulate_board` (para el antes/después del PR, no para exigir igualdad)
- [ ] **Crear rama** `feature/009-el-tablero-como-recorrido`

## La costura, la distancia y el camino
- [ ] `SEAM` en `domain/constants/board.constants.ts`
- [ ] `RouteKind` como const-object + union derivado (nunca `enum`)
- [ ] `bestRoute(a, b)` en `domain/board.ts`: **la única** decisión de cuál de las tres rutas conviene
- [ ] `cellDistance` devuelve su largo; `pathBetween` materializa sus celdas intermedias (D8)
- [ ] Documentar en `pathBetween` que `a === b` queda excluido y por qué no ocurre en el circuito
- [ ] **Escribir AC7b antes que la función**: es donde falló 114 veces la implementación de prueba
- [ ] Test AC7b — `pathBetween.length === cellDistance − 1` sobre los pares **distintos** (3.600 combinaciones)
- [ ] Test — las celdas del camino son adyacentes de a pares y no se repiten
- [ ] Test — los bordes de la costura: origen que ya es la esquina, destino que ya es la esquina
- [ ] Test — `(0,0)` ↔ `(9,5)` da 1 (AC2)
- [ ] Test — la distancia máxima del tablero es 12, no 14 (AC2)
- [ ] Test — simetría y desigualdad triangular sobre las 3.600 combinaciones
- [ ] **Commit aparte**: borrar `phaseFor` y sus 5 tests de `board.test.ts`

## La secuencia (dominio puro, sin sonido)
- [ ] `domain/sequence.ts`: puertas por pieza (grado 0 = entrada, grado 4 = salida)
- [ ] Matriz de costos asimétrica `dist(salida(i), entrada(j))`
- [ ] Held-Karp exacto, con desempate determinista por índice
- [ ] Offsets acumulados (`4 + salto`); los clicks salen de `pathBetween`, con su celda y su instante
- [ ] Test — AC1: el orden es el del circuito más corto, no el de colocación
- [ ] Test — AC3: dos piezas adyacentes quedan contiguas (salto 1, sin silencio)
- [ ] Test — AC10: 12 piezas en menos de 5 ms
- [ ] Test — determinismo: el mismo tablero da siempre la misma secuencia
- [ ] Test — bordes: cero piezas, una pieza

## Los tipos del motor
- [ ] `Job` → `Sequence` en `audio/types/scheduler.types.ts`
- [ ] `HIT` como const-object + union derivado — **nunca `enum`**
- [ ] `Hit` como unión discriminada: un click no tiene `hz` (y no se modela con `hz?`)

## El scheduler y el motor
- [ ] `collectHits` con período de ciclo; **`firstOnsetAfter` no se toca**
- [ ] Expansión de los clicks del recorrido
- [ ] Verificar si `node-web-audio-api` soporta `AudioBufferSourceNode`; si no, oscilador corto
- [ ] `scheduleClick` en `audio/voice.ts`, con volumen propio
- [ ] `setSequence` con activa + pendiente
- [ ] Swap en el cierre de ciclo, y el borde pasa a ser el nuevo `origin` (D5)
- [ ] Caso especial: con la activa vacía, la pendiente entra ya, con `scheduledUntil` **antes** de `origin`
- [ ] Test — AC5: cambiar la secuencia a mitad de ciclo no altera los hits hasta el borde
- [ ] Test — AC6: nunca más de `LOOKAHEAD` comprometido, con un ciclo largo

## Integración
- [ ] `App.tsx`: el efecto pasa a `setSequence(buildSequence(placed))`, una sola llamada
- [ ] La limpieza al desmontar pasa a `setSequence` vacía

## MCP server
- [ ] `simulate_board` reescrita: **importa** `buildSequence`, no la reimplementa
- [ ] Devuelve orden del circuito, saltos **con sus celdas**, ciclo (intervalos y segundos) y timeline
      con notas y clicks — el camino en la respuesta es lo que permite verificar el recorrido sin oírlo
- [ ] Reescribir su `description`: la frase sobre columnas que se desfasan es del modelo viejo
- [ ] `pnpm mcp:test` en verde

## Documentación
- [ ] `docs/architecture/modelo-musical.md`: la fase por pieza sale, entra el recorrido
- [ ] `docs/architecture/audio.md`: `#fase-por-pieza`
- [ ] `.claude/rules/audio.md` y `.claude/rules/domain.md`
- [ ] `CLAUDE.md`: la tabla del modelo
- [ ] `specs/log.md`: el 004 pasa a `Superado`, con el 009 como motivo

## Verificación
- [ ] `pnpm verify` en verde (AC8, AC9, AC11)
- [ ] AC4 — `simulate_board` sobre **dos ciclos**: el empalme tiene el mismo espaciado que el interior
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

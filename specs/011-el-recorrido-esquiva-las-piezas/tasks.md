# Tareas — El recorrido esquiva las piezas

## Backlog
- [ ] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [ ] Fila del 011 en `specs/log.md` (`Propuesto`)
- [ ] **Verificar que el 010 esté mergeado.** No es una dependencia de código —este spec no importa nada
      del 010— pero sí de verificación: AC9 se hace mirando la cabeza lectora, y sin ella este spec se
      prueba a ciegas. Fue la cabeza lectora la que encontró el problema
- [ ] `check_invariants` **en proceso fresco**: el MCP de la sesión cachea los módulos y contesta con el
      código viejo. Lo pisó el 010
- [ ] **Crear rama** `feature/011-el-recorrido-esquiva-las-piezas`

## Lo que ya está medido (no volver a medirlo)
- [x] El caso testigo reproducido: `P`/90 en `(3,2)` + `Y`/90 en `(7,2)`, el tramo `P→Y` pisa `(7,1)`,
      que es G#5 de la `Y` (`research.md` §1)
- [x] No hay camino mínimo libre en ese caso: el libre mide **8** contra los **6** del directo
- [x] Los clicks caen sobre celdas ocupadas entre el 38 % y el 100 % según el tablero (§2)
- [x] Rodeo medio +1,6 a +2,5, máximo **+20**; pares sin camino libre del 9 % (2 piezas) al 88 % (8) (§3)
- [x] **La celda central de la `X` es siempre una de sus puertas y está rodeada por sus propios brazos**
      — el caso degradado es estructural, no de congestión (§4)
- [x] La variante "permitir cruzar origen y destino" **no sirve**: no arregla el caso testigo (§5)
- [x] Matriz 12×12 con BFS: **0,31 ms**, contra 0,62 ms de Held-Karp (§6)

## Paso 1 — La distancia deja de ser una fórmula
- [ ] `routeBetween(a, b, placed)` en `domain/board.ts`: BFS sobre las 60 celdas, 4 vecinos más la
      arista de la costura, devolviendo **camino, largo y cruces en una sola llamada** (D3)
- [ ] **Fijar el orden de exploración de los vecinos, escrito y comentado.** Hoy el camino es único
      porque es "primero X, después Y"; con BFS el determinismo pasa a depender de ese orden y AC5 no
      puede apoyarse en un detalle de implementación
- [ ] Tope al rodeo (D5): si el libre supera al directo por más del tope, gana el directo con cruces.
      Arrancar en ~+4 y **ajustarlo escuchando**, no en el papel
- [ ] `cellDistance` y `pathBetween`: envoltorios o borrado, según los llamadores. Si se borran, va en
      **su propio commit** (convención del repo)
- [ ] La matriz de costos de `buildSequence` pasa `placed` — ya lo tiene como parámetro
- [ ] Test AC1: el caso testigo, con los dos números escritos a mano (no pisa `(7,1)`, mide 8)
- [ ] Test AC2: ningún cruce evitable, sobre los prefijos del teselado y tableros aleatorios con semilla
- [ ] Test AC5: determinismo, y Held-Karp exacto por fuerza bruta hasta 7 piezas (el test del 009 sigue)
- [ ] Test AC7: mediana de 21 corridas con 12 piezas, tope 5 ms
- [ ] **Commit propio, declarando el cambio de audio** (AC6)

## Paso 2 — El cruce inevitable suena la nota de la celda
- [ ] La derivación celda→nota va en una **pura del dominio**, no adentro de `buildSequence`: es la
      misma razón por la que `cellsByPlayOrder` salió de adentro de `gates` en el 010
- [ ] `Click` (o su reemplazo) puede llevar la nota — `domain/types/sequence.types.ts`
- [ ] Extender el invariante del 009: un cruce con nota **tampoco** puede caer en el mismo intervalo que
      la nota que una pieza toca por derecho propio, o las amplitudes se suman
- [ ] Test AC3 sobre la **`X`**, que es el caso estructural
- [ ] `check_invariants` antes y después (lo obliga `.claude/rules/domain.md`)

## Paso 3 — El motor toca esa nota
- [ ] El cruce viaja al motor con altura MIDI, sin `Cell` — `audio/types/scheduler.types.ts`
- [ ] `App.tsx` sigue **proyectando y no traduciendo**: la nota viaja tal cual, igual que `Step.notes`
- [ ] `tick()`: cruce con altura → `scheduleVoice`; cruce mudo → `scheduleClick`
- [ ] `setClicksAudible` apaga solo los mudos. **El cruce con nota es modelo, no mezcla**

## Paso 4 — Que se vea distinto
- [ ] `components/route-source.ts`: la tabla por offset pasa de dos casos a tres
- [ ] `Playhead.tsx` los distingue con los canales que ya usa (grosor del borde), **sin agregar color**

## Paso 5 — Las tools
- [ ] `simulate_board` reporta si el tramo cruzó celdas ocupadas y con qué notas

## Documentación
- [ ] `.claude/rules/audio.md`: la línea «un click puede caer sobre una pieza — los 21 del ciclo, en el
      tablero lleno» describe justamente lo que este spec arregla
- [ ] `.claude/rules/domain.md` y `docs/architecture/modelo-musical.md`: la distancia deja de depender
      solo de las dos celdas
- [ ] `docs/architecture/audio.md`: el cruce con altura como tercer camino a sonido
- [ ] `specs/log.md`: estado del 011, y nota de revisión con cómo se encontró (mirando la cabeza lectora
      del 010, no leyendo código)

## Verificación
- [ ] `pnpm verify` en verde (AC8)
- [ ] `check_invariants` en **proceso fresco**, antes y después
- [ ] **AC9 — a ojo con la cabeza lectora**: el recorrido rodea las piezas, y donde no puede, la celda
      cruzada se enciende y suena su nota
- [ ] A oído: que el rodeo no se lea como que el instrumento se colgó. Es lo que fija el tope de D5
- [ ] El tablero lleno (12 piezas): no hay celda libre, así que todo es cruce. Tiene que sonar **mejor**
      que hoy, no peor — son notas en vez de golpes sordos
- [ ] Un tablero con `X`: el caso estructural, cruzando siempre

## PR
- [ ] **Declarar el cambio de audio arriba de todo**: cambia la matriz de costos y con ella el orden de
      visita de las piezas. No es una mejora visual
- [ ] Aclarar que `cellDistance(a, b)` de dos argumentos **ya no existe**: es el cambio conceptual
- [ ] Aclarar que el caso degradado es **la mitad del spec** y no un borde, con el número (27 % de los
      tramos ya con 4 piezas) y con la `X`
- [ ] Un GIF con la cabeza lectora: es la única forma de revisar esto sin escucharlo
- [ ] `/pr-review` antes de pedir revisión

## Seguimiento (no bloquea)
- [ ] Los tramos de ida y vuelta se pisan (`research.md` §1). Con obstáculos pasa menos, no desaparece
- [ ] Si el tope de D5 termina siendo el caso frecuente, revisar si esquivar valía la pena en ese rango

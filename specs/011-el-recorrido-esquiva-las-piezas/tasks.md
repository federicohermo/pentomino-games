# Tareas — Pisar una pieza cuesta

## Backlog
- [ ] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [ ] Fila del 011 en `specs/log.md` (`Propuesto`)
- [ ] **Verificar que el 010 esté mergeado.** No es dependencia de código —este spec no importa nada del
      010— pero sí de verificación: AC10 se hace mirando la cabeza lectora, y fue ella la que encontró
      el problema. Sin el 010, este spec se implementa a ciegas
- [ ] `check_invariants` **en proceso fresco**: el MCP de la sesión cachea los módulos y contesta con el
      código viejo. Lo pisó el 010
- [ ] **Crear rama** `feature/011-pisar-una-pieza-cuesta`

## Lo que ya está medido (no volver a medirlo)
- [x] Caso testigo reproducido: `P`/90 en `(3,2)` + `Y`/90 en `(7,2)`, el tramo `P→Y` pisa `(7,1)`, que
      es G#5 de la `Y` (`research.md` §1)
- [x] Hoy pisan una celda ocupada entre el **71 % y el 88 %** de los tramos (§7)
- [x] **La curva de P** — cruces por ciclo y crecimiento del ciclo para P = 1, 2, 3, 5, ∞ (§8). Es la
      medición que define el spec
- [x] El orden de visita cambia en el **30-48 %** de los tableros, y el ciclo crece 8-17 % (§9)
- [x] La celda central de la `X` está rodeada por sus propios brazos y es siempre una de sus puertas —
      con un peso deja de ser caso especial (§4)
- [x] Elegir mejor entre caminos **mínimos**, sin pagar nada, solo evita el 11-30 % de las pisadas: no
      alcanza como solución sola (§7)
- [x] La variante "permitir cruzar origen y destino" **no arregla el caso testigo** (§5)
- [x] Matriz 12×12: **0,31 ms** contra 0,62 ms de Held-Karp (§6)
- [x] `scheduleVoice` ya recibe `dur` y `vel`: la floritura **no necesita función nueva** en `voice.ts`.
      **Corregido en review:** `vel` tiene default, **`dur` no** — y su docblock dice que es a propósito,
      «un default sería un número fijo en segundos que miente sobre el bpm vigente». De ahí que la
      constante de duración vaya en INTERVALOS y no en segundos

## Paso 1 — La distancia pasa a ser un costo
- [ ] `routeBetween(a, b, placed)` en `domain/board.ts`: camino de costo mínimo, peso 1 en celda vacía y
      `P` en ocupada, con la arista de la costura. Devuelve **camino, pasos y cruces en una sola
      llamada** (D3)
- [ ] **El costo ordena, los pasos miden el tiempo.** Un cruce cuesta `P` pero dura **un** intervalo. Si
      el costo se filtra a los offsets, el ciclo se estira donde no debe
- [ ] **El peso lo pagan las celdas INTERMEDIAS, no las dos puntas.** Las puertas están sobre una pieza
      por definición: cobrarlas sumaría el mismo `2·(P-1)` a las 144 entradas de la matriz sin mover
      ningún mínimo, y rompería la simetría de la distancia. Así `crossed` es exactamente el subconjunto
      ocupado de `path`
- [ ] **Desempate lexicográfico explícito** (D7): secuencias de celdas intermedias comparadas posición
      por posición, cada celda como el par `(x, y)`. No alcanza con fijar el orden de exploración, ni
      con desempatar mirando solo el vecino que relaja: hay que comparar el prefijo entero
- [ ] `P` va a `domain/constants/`, con la tabla de D1 en su comentario
- [ ] `cellDistance` y `pathBetween`: envoltorios o borrado según los llamadores. Si se borran, **commit
      propio**
- [ ] **Los llamadores, enumerados** (AC12) — ninguno queda rojo ni borrado en silencio:
      `domain/__tests__/board.test.ts:186-306` (13 tests; cinco afirman propiedades que el modelo nuevo
      **cambia**: Manhattan, simetría, desigualdad triangular y «traza primero en X»),
      `domain/__tests__/sequence.test.ts:57`, `:141-142`, `:430-431`, y
      `mcp-server/src/__tests__/tools.test.ts:8`, `:298-299`, que **cruza el borde de paquete**
- [ ] `ROUTE` (`domain/constants/route.constants.ts`) y `RouteKind` (`domain/types/sequence.types.ts`)
      quedan **sin consumidor** al morir `bestRoute`. Borrado en **su propio commit**
- [ ] La matriz de costos de `buildSequence` pasa `placed` — ya lo tiene como parámetro
- [ ] Test AC1: caso testigo, con los números escritos a mano
- [ ] Test AC2: ningún cruce evitable, prefijos del teselado + tableros aleatorios con semilla
- [ ] Test AC5: determinismo, **con un tablero donde el empate se ejerza de verdad**. El 009 buscó uno
      así para su desempate de circuito; acá hace falta el equivalente para el de camino
- [ ] Test AC6: Held-Karp exacto por fuerza bruta hasta 7 piezas
- [ ] Test AC8: mediana de 21 corridas con 12 piezas, tope 5 ms
- [ ] **Commit propio declarando el cambio de audio Y el cambio de orden de visita** (AC7)

## Paso 2 — El cruce lleva altura
- [ ] La derivación celda→nota va en una **pura del dominio**, no adentro de `buildSequence` (la razón
      es la misma por la que `cellsByPlayOrder` salió de adentro de `gates` en el 010)
- [ ] Cuidado con las dos trampas de la cadena: `degreeByCellIndex` sobre la forma **canónica** (sobre
      la transformada cambia en **74** de 96 — el docblock de `cellsByPlayOrder` tiene el número; acá
      decía 75), y el arpegio **ascendente** de `notesForRotation` y **nunca** el que ya trae el
      retrógrado aplicado
- [ ] **Ojo con el nombre:** el arpegio con retrógrado es hoy `PlacedPiece.notes`, y hay un cambio **sin
      commitear** en el árbol que borra ese campo y lo reemplaza por `arpeggioFor(piece, rotation,
      mirror)` en `domain/music.ts`. Si ese trabajo mergea primero, la trampa no cambia pero el nombre
      sí — verificar cuál está en `main` antes de escribir el paso 2
- [ ] `Click` puede llevar altura — `domain/types/sequence.types.ts`
- [ ] **NO agregar** la garantía de que un cruce no coincida con una nota: ya vale por construcción y el
      test del 009 la cubre
- [ ] Test AC3 sobre la **`X`**, que es el caso estructural
- [ ] `check_invariants` antes y después

## Paso 3 — El motor toca esa nota
- [ ] El cruce viaja al motor con altura MIDI, sin `Cell` — `audio/types/scheduler.types.ts`
- [ ] **Tercera clase de evento** (AC13): `HIT` pasa de `{ note, click }` a tres claves en
      `audio/constants/scheduler.constants.ts` —su docblock dice hoy «las dos clases»— y el union `Hit`
      gana una tercera rama con su `hz`. **NO** un `hz?: number` sobre la rama del click: el docblock de
      `Hit` lo rechaza por escrito, y sin discriminar `setClicksAudible` no puede apagar solo los mudos
- [ ] `App.tsx` sigue **proyectando y no traduciendo**
- [ ] `GRACE_INTERVALS` y `GRACE_VELOCITY` en `voice.constants.ts`. `GRACE_VELOCITY` va al lado de
      `CLICK_VELOCITY`, que es su precedente exacto; `GRACE_INTERVALS` **no** al lado de
      `CLICK_SECONDS`, sino de `NOTE_INTERVALS`: la excepción de los segundos está justificada por
      escrito en que el click **no tiene altura**, y el cruce sí la tiene
- [ ] `tick()`: cruce con altura → `scheduleVoice(…, GRACE_INTERVALS * intervalDuration(bpm),
      GRACE_VELOCITY)`; mudo → `scheduleClick`. **Sin función nueva en `voice.ts`**
- [ ] `setClicksAudible` apaga solo los mudos (D6)

## Paso 4 — Que se vea distinto
- [ ] `route-source.ts`: la tabla por offset pasa de dos casos a tres. El booleano `Marca.nota` se queda
      corto — va const-object con union derivada (`erasableSyntaxOnly` rechaza los `enum`). **El
      const-object a `components/constants/`** (los módulos de capa no declaran constantes) y la union a
      `components/types/route.types.ts`, cuyo docblock argumenta hoy lo contrario y hay que reescribir
- [ ] `components/__tests__/route-source.test.ts:120-152` afirma `nota: true` / `nota: false` en cuatro
      lugares: se migra con el tipo
- [ ] `Playhead.tsx`: tres escalones de grosor de borde, **sin agregar color**

## Paso 5 — Las tools
- [ ] `simulate_board` reporta los cruces y sus notas. Es además la forma barata de comparar valores de
      `P` sin escuchar cada uno
- [ ] **La descripción de la tool afirma lo contrario de lo que va a pasar** y es contrato, no prosa: un
      agente la lee antes de llamarla. `mcp-server/src/tools/simulateBoard.ts:180-184` dice «el camino
      ignora lo que haya en el medio … los 21 clicks caen sobre celdas con pieza». Lo mismo el
      comentario de `tools.test.ts:321-325`, que además cita el «Fuera de Alcance» del 009

## Paso 6 — Elegir P escuchando (AC11)
- [ ] Tablero de 4-5 piezas con la cabeza lectora andando, recorriendo P = 1, 2, 3, 5
- [ ] Lo que hay que escuchar no es cuántos cruces, sino **si el rodeo se lee como rodeo o como que el
      instrumento se colgó**
- [ ] El valor elegido queda escrito con su motivo

## Documentación
- [ ] `.claude/rules/audio.md`: la línea «un click puede caer sobre una pieza — los 21 del ciclo, en el
      tablero lleno» describe justamente lo que este spec arregla
- [ ] `.claude/rules/domain.md` y `docs/architecture/modelo-musical.md`: la distancia deja de depender
      solo de las dos celdas
- [ ] `docs/architecture/audio.md`: el cruce con altura como tercer camino a sonido
- [ ] `docs/architecture/overview.md:42-43`, `:79`, `:81` y `docs/architecture/directory-structure.md:60`,
      `:70`, `:75`: las dos tablas de símbolos nombran `cellDistance` y `pathBetween`, y
      `directory-structure.md` lista además `RouteKind` y `ROUTE`
- [ ] `DESIGN.md`: el tercer escalón de la cabeza. La sección «La cabeza lectora: el estado va al borde»
      **ya existe** —se escribió en el review de este spec, porque el 010 no había documentado nada— y su
      tabla de escalones tiene hoy dos filas más una cita en bloque que declara la tercera como pendiente
      de este spec. La tarea es agregar la fila con sus dos números y **borrar la cita**
- [ ] `specs/log.md`: estado del 011, y nota de revisión con **cómo se encontró** — mirando la cabeza
      lectora del 010, no leyendo código. Es el segundo hallazgo que sale del mismo lugar

## Verificación
- [ ] `pnpm verify` en verde (AC9). Es el nodo que atrapa el borde de paquete: typechequea `mcp-server/`
      contra `src/`, y ahí viven los dos asserts de `tools.test.ts` que importan `cellDistance` y
      `pathBetween`
- [ ] `check_invariants` en **proceso fresco**, antes y después
- [ ] **AC10 — a ojo con la cabeza lectora**: el recorrido rodea cuando le conviene, y donde no, la
      celda pisada se enciende con su escalón propio y suena
- [ ] El tablero lleno (12 piezas): no hay celda libre, todo es cruce. Tiene que sonar **mejor** que
      hoy, no peor — notas en vez de golpes sordos
- [ ] Un tablero con `X`: el caso estructural
- [ ] **Ningún símbolo queda huérfano**: `ROUTE`, `RouteKind` y lo que el borrado de `bestRoute` arrastre.
      `find_symbol` responde `usedBy` en una consulta

## PR
- [ ] **Declarar el cambio de audio arriba de todo**: cambia la matriz de costos y con ella el orden de
      visita en el 30-48 % de los tableros. No es una mejora visual
- [ ] Aclarar que `cellDistance(a, b)` de dos argumentos **ya no existe**: es el cambio conceptual
- [ ] Aclarar que **no hay regla de esquivar con excepción, hay un peso** — y que la primera versión del
      spec sí tenía la regla, y que el caso "imposible", el tope al rodeo y el trato especial de la `X`
      desaparecieron los tres al cambiarla por un número
- [ ] La tabla de P, que es lo que hace revisable la elección
- [ ] Declarar el **borde de paquete**: `mcp-server/` importa `cellDistance` y `pathBetween`, así que la
      firma nueva le llega. No pasa silencioso —`pnpm verify` lo typechequea— pero el revisor lo espera
      escrito
- [ ] Un GIF con la cabeza lectora: es la única forma de revisar esto sin escucharlo
- [ ] `/pr-review` antes de pedir revisión

## Seguimiento (no bloquea)
- [ ] **Borrar el botón de Clicks** (D6). Nació para tapar los golpes sordos que este spec arregla; si
      con `P` y floritura el recorrido deja de molestar, se queda sin razón de ser. Commit propio
- [ ] Los tramos de ida y vuelta se pisan entre sí (`research.md` §1). Con pesos pasa menos, no
      desaparece

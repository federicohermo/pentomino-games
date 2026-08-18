# Tareas — Pisar una pieza cuesta

> **Primer spec con la convención de [`README.md`](../README.md#formato-de-una-tarea):** cada tarea
> lleva un `T0NN` estable, `[P]` marca las que no dependen entre sí ni comparten archivo, y `[M]` las
> que piden una persona —oído, navegador, captura— y por eso no bloquean el cierre. Los IDs no se
> renumeran al insertar una tarea nueva: se sigue contando desde `T075` (el review gastó T072-T074).

## Backlog
- [x] T001 Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`). Hecho en
      seis commits, de `1fda1ea` a `b3703ee`, y `feature/011-*` todavía no existe. **Las ediciones del
      review van al mismo lugar**: se commitean a `main` antes de sacar la rama de T005, no adentro
- [x] T002 Fila del 011 en `specs/log.md` (`Propuesto`) — `specs/log.md:26`
- [x] T003 [P] **Verificar que el 010 esté mergeado.** Lo está: `log.md:25` lo da `Implementado`, y `spec_status`
      le reporta `pendientes: 0`. No es dependencia de código —este spec no importa nada del
      010— pero sí de verificación: AC10 se hace mirando la cabeza lectora, y fue ella la que encontró
      el problema. Sin el 010, este spec se implementa a ciegas
- [x] T004 [P] `check_invariants` **en proceso fresco**: el MCP de la sesión cachea los módulos y contesta con el
      código viejo. Lo pisó el 010
- [x] T005 **Crear rama** `feature/011-pisar-una-pieza-cuesta`

## Lo que ya está medido (no volver a medirlo)
- [x] T006 Caso testigo reproducido: `P`/90 en `(3,2)` + `Y`/90 en `(7,2)`, el tramo `P→Y` pisa `(7,1)`, que
      es G#5 de la `Y` (`research.md` §1)
- [x] T007 Hoy pisan una celda ocupada entre el **71 % y el 88 %** de los tramos (§7)
- [x] T008 **La curva de P** — cruces por ciclo y crecimiento del ciclo para P = 1, 2, 3, 5, ∞ (§8). Es la
      medición que define el spec
- [x] T009 El orden de visita cambia en el **30-48 %** de los tableros, y el ciclo crece 8-17 % (§9). **Los
      dos números son de `P = ∞`**, el escenario más agresivo: con `P = 2` el ciclo crece 2 % y el
      porcentaje de reordenamientos con ese valor no se midió. 30-48 % es cota de arriba
- [x] T010 La celda central de la `X` está rodeada por sus propios brazos y es siempre una de sus puertas —
      con un peso deja de ser caso especial (§4)
- [x] T011 Elegir mejor entre caminos **mínimos**, sin pagar nada, solo evita el 11-30 % de las pisadas: no
      alcanza como solución sola (§7)
- [x] T012 La variante "permitir cruzar origen y destino" **no arregla el caso testigo** (§5)
- [x] T013 Matriz 12×12: **0,31 ms** contra **1,87 ms** de Held-Karp (§6). El 0,62 ms que decía esta tarea
      es el número que §6 ya corrigió: el que el 009 midió y escribió en su `research.md` §5 y en el
      docblock de `shortestCircuit` es 1,87 ms, y con él el recorrido crece 17 % y no 50 %
- [x] T014 `scheduleVoice` ya recibe `dur` y `vel`: la floritura **no necesita función nueva** en `voice.ts`.
      **Corregido en review:** `vel` tiene default, **`dur` no** — y su docblock dice que es a propósito,
      «un default sería un número fijo en segundos que miente sobre el bpm vigente». De ahí que la
      constante de duración vaya en INTERVALOS y no en segundos

## Paso 1 — La distancia pasa a ser un costo
- [x] T015 `routeBetween(a, b, placed)` en `domain/board.ts`: camino de costo mínimo, peso 1 en celda vacía y
      `P` en ocupada, con la arista de la costura. Devuelve **camino, pasos y cruces en una sola
      llamada** (D3)
- [x] T016 **El costo ordena, los pasos miden el tiempo.** Un cruce cuesta `P` pero dura **un** intervalo. Si
      el costo se filtra a los offsets, el ciclo se estira donde no debe
- [x] T017 **El peso lo pagan las celdas INTERMEDIAS, no las dos puntas.** Las puertas están sobre una pieza
      por definición: cobrarlas sumaría el mismo `2·(P-1)` a las 144 entradas de la matriz sin mover
      ningún mínimo, y rompería la simetría de la distancia. Así `crossed` es exactamente el subconjunto
      ocupado de `path`
- [x] T018 **Desempate lexicográfico explícito** (D7): secuencias de celdas intermedias comparadas posición
      por posición, cada celda como el par `(x, y)`. No alcanza con fijar el orden de exploración, ni
      con desempatar mirando solo el vecino que relaja: hay que comparar el prefijo entero
- [x] T019 [P] `P` va a **`domain/constants/board.constants.ts`**, al lado de `SEAM`: es una propiedad del
      grafo del tablero, igual que la costura. **No** a `route.constants.ts`, que T022 borra. Con la
      tabla de D1 en su comentario
- [x] T020 `cellDistance` y `pathBetween`: envoltorios o borrado según los llamadores. Si se borran, **commit
      propio**
- [x] T021 **Los llamadores, enumerados** (AC12) — ninguno queda rojo ni borrado en silencio:
      `domain/__tests__/board.test.ts:186-308` (13 tests; cinco afirman propiedades que el modelo nuevo
      **cambia**: Manhattan, simetría, desigualdad triangular y «traza primero en X»),
      `domain/__tests__/sequence.test.ts:66`, `:150-151`, `:439-440` con el `import` de `:3`, y
      `mcp-server/src/__tests__/tools.test.ts:8`, `:298-299`, que **cruza el borde de paquete**
- [x] T022 `ROUTE` (`domain/constants/route.constants.ts`) y `RouteKind` (`domain/types/sequence.types.ts`)
      quedan **sin consumidor** al morir `bestRoute`. Borrado en **su propio commit**
- [x] T074 Los docblocks que nombran a **`bestRoute`** y a **`ROUTE`** y mueren con T022 (AC14):
      `domain/constants/board.constants.ts:26-28` explica el orden de `SEAM` en términos de `viaStart`/
      `viaEnd`, y `domain/sequence.ts:188` dice que el invariante del largo «lo garantiza `bestRoute`».
      Ídem `domain/sequence.ts:68` y los comentarios de `domain/__tests__/sequence.test.ts:106` y
      `:182`, que nombran a `pathBetween` como el que ignora obstáculos
- [x] T023 La matriz de costos de `buildSequence` pasa `placed` — ya lo tiene como parámetro
- [x] T024 [P] Test AC1 en `domain/__tests__/board.test.ts`: caso testigo, con los números escritos a mano.
      **Es el único `[P]` de los cinco tests**: T025 y T026 caen en el MISMO archivo, así que van
      detrás de este y no en paralelo
- [x] T025 Test AC2 en `domain/__tests__/board.test.ts`: ningún cruce evitable, prefijos del teselado +
      tableros aleatorios con semilla, contrastado contra un Dijkstra de referencia escrito en el propio
      test. **Ojo con el corolario de AC2: la desigualdad es ESTRICTA** — con exactamente `P − 1` pasos
      extra por celda evitada los caminos empatan y decide el desempate lexicográfico, no este AC
- [x] T026 Test AC5 en `domain/__tests__/board.test.ts`: determinismo, **con un tablero donde el empate se
      ejerza de verdad**. El 009 buscó uno así para su desempate de circuito; acá hace falta el
      equivalente para el de camino
- [x] T027 [P] Test AC6 en `domain/__tests__/sequence.test.ts:365`: Held-Karp exacto por fuerza bruta hasta 7
      piezas. `[P]` con T024 porque es otro archivo; **no** con T028, que es este mismo
- [x] T028 Test AC8 en `domain/__tests__/sequence.test.ts:528`: mediana de 21 corridas con 12 piezas, tope
      5 ms
- [x] T029 **Commit propio declarando el cambio de audio Y el cambio de orden de visita** (AC7)

## Paso 2 — El cruce lleva altura
- [x] T030 La derivación celda→nota va en una **pura del dominio**, no adentro de `buildSequence` (la razón
      es la misma por la que `cellsByPlayOrder` salió de adentro de `gates` en el 010)
- [x] T031 Cuidado con las dos trampas de la cadena: `degreeByCellIndex` sobre la forma **canónica** (sobre
      la transformada cambia en **74** de 96 — el docblock de `cellsByPlayOrder` tiene el número; acá
      decía 75), y el arpegio **ascendente** de `notesForRotation` y **nunca** el que ya trae el
      retrógrado aplicado
- [x] T032 **Ojo con el nombre:** el arpegio con retrógrado era `PlacedPiece.notes` cuando se escribió este
      spec. El cierre de los seguimientos del 007/009/010 borró el campo y lo reemplazó por
      `arpeggioFor(piece, rotation, mirror)` en `domain/music.ts`. La trampa no cambió, el nombre sí
- [x] T033 [P] `Click` puede llevar altura — `domain/types/sequence.types.ts`
- [x] T034 **NO agregar** la garantía de que un cruce no coincida con una nota: ya vale por construcción y el
      test del 009 la cubre
- [x] T035 [P] Test AC3 sobre la **`X`**, que es el caso estructural
- [x] T036 `check_invariants` antes y después

## Paso 3 — El motor toca esa nota
- [x] T037 El cruce viaja al motor con altura MIDI, sin `Cell` — `audio/types/scheduler.types.ts`
- [x] T038 **Tercera clase de evento** (AC13): `HIT` pasa de `{ note, click }` a tres claves en
      `audio/constants/scheduler.constants.ts` —su docblock dice hoy «las dos clases»— y el union `Hit`
      gana una tercera rama con su `hz`. **NO** un `hz?: number` sobre la rama del click: el docblock de
      `Hit` lo rechaza por escrito, y sin discriminar `setClicksAudible` no puede apagar solo los mudos
- [x] T039 [P] `App.tsx` sigue **proyectando y no traduciendo**
- [x] T040 [P] `GRACE_INTERVALS` y `GRACE_VELOCITY` en `voice.constants.ts`. `GRACE_VELOCITY` va al lado de
      `CLICK_VELOCITY`, que es su precedente exacto; `GRACE_INTERVALS` **no** al lado de
      `CLICK_SECONDS`, sino de `NOTE_INTERVALS`: la excepción de los segundos está justificada por
      escrito en que el click **no tiene altura**, y el cruce sí la tiene
- [x] T041 `tick()`: cruce con altura → `scheduleVoice(…, GRACE_INTERVALS * intervalDuration(bpm),
      GRACE_VELOCITY)`; mudo → `scheduleClick`. **Sin función nueva en `voice.ts`**
- [x] T042 `setClicksAudible` apaga solo los mudos (D6)
- [x] T072 **`audio/scheduler.ts` es quien CONSTRUYE los `Hit`** (AC14): `collectWindow` los arma —`:144` la
      nota, `:150` el click—. La tercera clase se emite ahí; `engine.ts:302` solo despacha. El archivo
      no estaba en ninguna tarea ni en `research.md` §10, y es donde el `Hit` con `hz` nace
- [x] T073 [P] El docblock de `Sequence` en `audio/types/scheduler.types.ts` argumenta que la celda «no es
      información que el motor pueda usar — para sonar solo hace falta CONTAR clicks», y el comentario
      del campo `clicks` repite «Sin `cell`: para sonar solo hace falta contar». Con el cruce con altura
      la primera mitad deja de valer y la segunda —no ver `Cell`— sigue valiendo: hay que reescribirlo
      diciendo cuál es cuál, igual que se hace con el docblock de `Hit` en T038

## Paso 4 — Que se vea distinto
- [x] T043 `route-source.ts`: la tabla por offset pasa de dos casos a tres. El booleano `Marca.nota` se queda
      corto — va const-object con union derivada (`erasableSyntaxOnly` rechaza los `enum`). **El
      const-object a `components/constants/route.constants.ts`** —archivo nuevo, que es el que espeja a
      `components/types/route.types.ts`; los dos que hay hoy son `layout` y `palette` y no es ninguno de
      esos— porque los módulos de capa no declaran constantes, y la union a
      `components/types/route.types.ts`, cuyo docblock argumenta hoy lo contrario y hay que reescribir
- [x] T044 `components/__tests__/route-source.test.ts:120-152` afirma `nota: true` / `nota: false` en cuatro
      lugares: se migra con el tipo
- [x] T045 [P] `Playhead.tsx`: tres escalones de grosor de borde, **sin agregar color**

## Paso 5 — Las tools
- [x] T046 `simulate_board` reporta los cruces y sus notas. Es además la forma barata de comparar valores de
      `P` sin escuchar cada uno
- [x] T047 **La descripción de la tool afirma lo contrario de lo que va a pasar** y es contrato, no prosa: un
      agente la lee antes de llamarla. `mcp-server/src/tools/simulateBoard.ts:180-184` dice «el camino
      ignora lo que haya en el medio … los 21 clicks caen sobre celdas con pieza». Lo mismo el
      comentario de `tools.test.ts:321-325`, que además cita el «Fuera de Alcance» del 009

## Paso 6 — Elegir P escuchando (AC11)
- [ ] T048 [M] Tablero de 4-5 piezas con la cabeza lectora andando, recorriendo P = 1, 2, 3, 5
- [ ] T049 [M] Lo que hay que escuchar no es cuántos cruces, sino **si el rodeo se lee como rodeo o como que el
      instrumento se colgó**
- [ ] T050 El valor elegido queda escrito con su motivo

## Documentación
- [x] T051 [P] `.claude/rules/audio.md`: la línea «un click puede caer sobre una pieza — los 21 del ciclo, en el
      tablero lleno» describe justamente lo que este spec arregla
- [x] T052 [P] `.claude/rules/domain.md` y `docs/architecture/modelo-musical.md`: la distancia deja de depender
      solo de las dos celdas
- [x] T053 [P] `docs/architecture/audio.md`: el cruce con altura como tercer camino a sonido. Tres lugares
      concretos: `:157` reproduce el tipo con `clicks: { offset: number }[]  // sin cell: para sonar
      solo hace falta contar`, `:162` argumenta que el click no tiene altura, y la sección «El click»
      (`:202-219`) dice que el camino ignora obstáculos y que esquivar «es un spec propio» — que es
      justamente este
- [x] T054 [P] `docs/architecture/overview.md:42-43`, `:79`, `:81` y `docs/architecture/directory-structure.md:60`,
      `:70`, `:75`: las dos tablas de símbolos nombran `cellDistance` y `pathBetween`, y
      `directory-structure.md` lista además `RouteKind` y `ROUTE`
- [x] T055 [P] `DESIGN.md`: el tercer escalón de la cabeza. La sección «La cabeza lectora: el estado va al borde»
      **ya existe** —se escribió en el review de este spec, porque el 010 no había documentado nada— y su
      tabla de escalones tiene hoy dos filas más una cita en bloque que declara la tercera como pendiente
      de este spec. La tarea es agregar la fila con sus dos números y **borrar la cita**
- [ ] T056 [P] `specs/log.md`: estado del 011, y nota de revisión con **cómo se encontró** — mirando la cabeza
      lectora del 010, no leyendo código. Es el segundo hallazgo que sale del mismo lugar

## Verificación
- [x] T057 [P] `pnpm verify` en verde (AC9). Es el nodo que atrapa el borde de paquete: typechequea `mcp-server/`
      contra `src/`, y ahí viven los dos asserts de `tools.test.ts` que importan `cellDistance` y
      `pathBetween`
- [x] T058 [P] `check_invariants` en **proceso fresco**, antes y después
- [ ] T059 [P] [M] **AC10 — a ojo con la cabeza lectora**: el recorrido rodea cuando le conviene, y donde no, la
      celda pisada se enciende con su escalón propio y suena
- [ ] T060 [P] [M] El tablero lleno (12 piezas): no hay celda libre, todo es cruce. Tiene que sonar **mejor** que
      hoy, no peor — notas en vez de golpes sordos
- [ ] T061 [P] [M] Un tablero con `X`: el caso estructural
- [x] T062 [P] **Ningún símbolo queda huérfano**: `ROUTE`, `RouteKind` y lo que el borrado de `bestRoute` arrastre.
      `find_symbol` responde `usedBy` en una consulta

## PR
- [x] T063 **Declarar el cambio de audio arriba de todo**: cambia la matriz de costos y con ella el orden de
      visita en el 30-48 % de los tableros. No es una mejora visual
- [x] T064 Aclarar que `cellDistance(a, b)` de dos argumentos **ya no existe**: es el cambio conceptual
- [x] T065 Aclarar que **no hay regla de esquivar con excepción, hay un peso** — y que la primera versión del
      spec sí tenía la regla, y que el caso "imposible", el tope al rodeo y el trato especial de la `X`
      desaparecieron los tres al cambiarla por un número
- [x] T066 La tabla de P, que es lo que hace revisable la elección
- [x] T067 Declarar el **borde de paquete**: `mcp-server/` importa `cellDistance` y `pathBetween`, así que la
      firma nueva le llega. No pasa silencioso —`pnpm verify` lo typechequea— pero el revisor lo espera
      escrito
- [ ] T068 [M] Un GIF con la cabeza lectora: es la única forma de revisar esto sin escucharlo
- [ ] T069 [M] `/pr-review` antes de pedir revisión

## Hallazgos de la implementación (encontrados probando, no leyendo)

- [x] T075 **El desempate del circuito gana por PASOS a igual costo, y recién después por índice.**
      Encontrado probando la app: el orden de colocación cambiaba lo que suena. Con el peso, el costo de
      un tramo dejó de ser su cantidad de pasos —un cruce cuesta `CROSS_COST` y dura **un** intervalo—,
      así que dos circuitos pueden empatar en costo y durar distinto; ahí decidía el índice, que **es**
      el orden de colocación. Medido sobre `N`/3(5,1) `V`/2(2,5) `Z`/2(4,0) `U`(8,4) `F`/3(4,4): dos
      circuitos a costo 27 con **28 y 24 pasos**, o sea ciclos de 48 y 44. Pasaba en el **8,3 %** de los
      tableros de 5 piezas y ahora en el **0 %**. Es una regresión que introdujo este spec contra lo que
      el 009 promete —«la geometría decide el orden»—, así que se arregla acá y no en Seguimiento
- [x] T076 **`CROSS_COST` quedó en 5 y no en 2.** El 2 del spec se eligió mirando el caso testigo, que es
      UN tramo. Sobre 200 tableros aleatorios por tamaño la pregunta que importa es otra: con 2 el
      recorrido cruzaba una pieza **teniendo rodeo libre disponible** en el 20,4 % de los tramos, con 5
      baja al 9,9 % y el ciclo crece 7,1 %. Prohibir de hecho (61) lo lleva a 0 % pero cuesta +19,3 % de
      ciclo y admite rodeos de +20 intervalos, que es el síntoma que T049 existe para juzgar. La tabla
      completa está en el docblock de la constante
- [ ] T077 **El `onsets` de `simulate_board` sumaba mal y nadie lo veía**: contaba los cruces con altura
      dentro de `clicks`, así que `notes + clicks !== total` y el propio comentario del campo decía que
      si difieren «o se duplicó un onset o dos eventos colisionaron». Se partió en `clicks` y `crosses`.
      Queda sin marcar solo porque conviene mirarlo en la revisión: es cambio de contrato de la tool

## Seguimiento (no bloquea)
- [ ] T070 **Borrar el botón de Clicks** (D6). Nació para tapar los golpes sordos que este spec arregla; si
      con `P` y floritura el recorrido deja de molestar, se queda sin razón de ser. Commit propio
- [ ] T071 Los tramos de ida y vuelta se pisan entre sí (`research.md` §1). Con pesos pasa menos, no
      desaparece

# Log de Specs

Registro de todo el trabajo especificado, en orden, y las dependencias entre specs. La convención de
formato está en [README.md](./README.md); la deuda sin spec, en [deuda.md](./deuda.md); el por qué de
cada decisión, en [revisiones.md](./revisiones.md).

**Estados:** `Propuesto` (spec escrito, sin implementar) · `En curso` (rama abierta) ·
`Implementado` (mergeado) · `Descartado` (con el motivo anotado) · `Superado` (se implementó y otro
spec posterior reemplazó lo que hacía; el spec queda como historia y no se reescribe).

Los dos últimos son **terminales**: de ahí no sale trabajo, y `spec_status` deja de ofrecer sus
casillas abiertas como próxima tarea.

| Spec | Fecha | Estado | Descripción |
|------|-------|--------|-------------|
| [001](./001-notas-por-celda-en-orden-angular/spec.md) | 2026-08-02 | Descartado | Asignar cada nota a una celda de la pieza, en orden angular alrededor del centroide. **Absorbido por el [007](./007-nota-por-celda-y-lenguaje-visual/spec.md)**, que conserva su mapeo (D1 y D3) y revisa su desempate (D2) con una medición |
| [002](./002-motor-de-audio-propio-sobre-web-audio/spec.md) | 2026-08-02 | Implementado | Reemplazar Tone.js por un motor propio sobre Web Audio: síntesis, scheduler con lookahead y audio testeable |
| [003](./003-visualizacion-de-la-senal-con-analysernode/spec.md) | 2026-08-02 | Implementado | Visualizar la señal con `AnalyserNode`: espectro en canvas, con el mapeo bins→barras como función pura testeable |
| [004](./004-fase-por-pieza-la-columna-como-posicion-en-el-compas/spec.md) | 2026-08-02 | Superado | La columna de la celda de agarre determina en qué momento del compás arranca la pieza: el tablero pasa a ser un secuenciador. **Superado por el [009](./009-el-tablero-como-recorrido/spec.md)** |
| [005](./005-modularizacion-de-src-en-capas/spec.md) | 2026-08-03 | Implementado | `src/` en capas (`domain` · `audio` · `components`) con dirección de dependencia verificada por el linter, carpetas por rol y los primeros tests del dominio. Sin cambio de comportamiento |
| [006](./006-mcp-server-de-dominio-ejecutable/spec.md) | 2026-08-03 | Implementado | MCP server que **ejecuta** el dominio en vez de indexar el código: forma, notas, simulación del scheduler e invariantes, en una llamada. Las tools importan de `src/`, no reimplementan |
| [007](./007-nota-por-celda-y-lenguaje-visual/spec.md) | 2026-08-16 | Implementado | Cada celda es dueña de un grado de la escala, y el tablero lo muestra: color por pieza y nota por celda. Absorbe al 001. **Sin cambio de audio** |
| [008](./008-el-intervalo-como-unidad-musical/spec.md) | 2026-08-16 | Implementado | El espaciado del arpegio deja de ser 0,15 s fijos y pasa a ser la semicorchea del tempo; `Job` pierde `spread`; el checkbox de loop y el botón de reloj se funden en un play/pausa con estado |
| [009](./009-el-tablero-como-recorrido/spec.md) | 2026-08-16 | Implementado | El tablero deja de ser un compás y pasa a ser un circuito cerrado: el orden y los silencios salen de la geometría, `(0,0)` y `(9,5)` se repliegan, las celdas recorridas suenan. Muere `phaseFor` y **supera al 004** |
| [010](./010-cabeza-lectora-por-celda/spec.md) | 2026-08-16 | Implementado | Cabeza lectora celda por celda, fuera del estado de React: cierra la limitación que el 004 dejó anotada y da señal visual a la espera de un ciclo que introduce el 009 |
| [011](./011-el-recorrido-esquiva-las-piezas/spec.md) | 2026-08-17 | Propuesto | Pisar una celda ocupada deja de ser gratis y pasa a **costar**: el recorrido rodea las piezas cuando le conviene y las cruza cuando rodear sale caro, y el cruce **suena la nota de esa celda** como floritura en vez de un golpe sordo. Medido: hoy pisan entre el 71 % y el 88 % de los tramos. **Cambia la matriz de costos y con ella el orden de visita en el 30-48 % de los tableros**; revisa el modelo del 009 |
| [012](./012-el-arpegio-camina-la-pieza/spec.md) | 2026-08-19 | Propuesto | El orden de las notas dentro de una pieza deja de ser el anillo angular y pasa a ser un **camino**: cada nota suena en una celda vecina de la anterior, arriba, abajo, izquierda o derecha. Medido: los saltos bajan de **13 a 5 sobre 48 pasos** y las piezas continuas de 3 a 8 de 12; las cuatro que siguen saltando no admiten camino y está probado. **Revisa el mapeo del 007** —9 de 12 piezas cambian qué nota muestra cada celda, y la lámina deja de ser la referencia— y **mueve las puertas del 009/010**: el 56 % de los tableros cambia el orden de visita |

## Dependencias entre specs

- **001 y 002 son ortogonales.** Uno decide qué nota va en qué celda; el otro, cómo se produce el
  sonido. Se pueden implementar en cualquier orden.
- **003 dependía de 002, y ya está desbloqueado.** Con Tone el grafo era interno a la librería y no
  había dónde insertar el analizador; con el motor propio, `master.connect(analyser)` es una línea. Su
  paso 1 (el mapeo puro) es independiente y mergeable solo.
- **El prerrequisito de Vitest está resuelto y versionado** por el spec 002: `vitest` +
  `node-web-audio-api`, bloque `test` en `vite.config.ts`, `environment: 'node'`. El spec 001 lo hereda.
- **004 dependía de 002, y más fuerte que 003.** No solo se apoyaba en el motor propio: **reescribió
  `collectHits`**. Ya implementado.
- **004 y 003 se refuerzan pero no se bloquean.** 004 hace que la posición en el tablero suene
  distinto; 003 trae el canvas donde se podría *ver* esa posición. Sin 003, la fase de 004 se oye pero
  no se lee — está anotado como su limitación consciente.
- **004 y 001 son ortogonales.** 001 decide qué nota va en qué celda de la pieza; 004, en qué momento
  del compás arranca la pieza según su columna. Ambos usan el mismo invariante de orden del array.
- **005 conviene primero, y le ahorra trabajo a 001, 003 y 004.** Es el único que reorganiza `src/`
  sin cambiar comportamiento; los tres tocan `App.tsx` o `engine.ts`, así que mergearlo antes hace más
  chicas sus ramas. En particular resuelve la tarea que 001 tiene anotada como "preferible" —extraer
  las puras— y le deja a 004 un `scheduler.ts` de 50 líneas en vez de un `engine.ts` de 244.
- **006 depende de 005, y de forma material, no estética.** Node no carga `.tsx` y las puras de
  `App.tsx` no están exportadas: sin los módulos de `src/domain/` no hay nada que el server pueda
  ejecutar. Le alcanzan las **fases 1–3** de 005 (tipos, dominio, tablero, invariantes, audio); la fase
  4 —los componentes— no lo bloquea.
- **Separar 005 de 006 eliminó una duplicación que ya estaba planificada.** Mientras eran un spec solo,
  el server iba a tener su propio `board.ts` con la colocación y la validez, porque las de la app viven
  atrapadas dentro del componente: dos copias de la regla del juego. Con `domain/board.ts` en 005, las
  tools de 006 importan y no reimplementan.
- **006 se acopla a `collectHits`, y 004 ya la reescribió.** Queda resuelto por orden: `simulate_board`
  se escribe contra la firma nueva —`ClockState` es `{ origin, scheduledUntil }` y `Job` lleva `phase`
  obligatoria—, sin trabajo de migración.
- **006 casi no toca `src/`, y lo que tocó fue del 005.** Es tooling puro, salvo un commit aparte que
  bajó `phase = ax / GRID_W` del efecto de reconciliación de `App.tsx` a `phaseFor` en
  `domain/board.ts`: la regla más central del spec 004 vivía en el único lugar del repo que ni los
  tests ni node pueden importar, así que `simulate_board` habría tenido que escribirla por segunda vez.
  Es exactamente el caso que el 006 dejó previsto —"si hace falta un export nuevo en el dominio, es un
  cambio del 005 y va en su commit"— y se resolvió así.

- **007 absorbe al 001 y es el cimiento de tres specs que todavía no están escritos.** El plan acordado
  parte el rediseño del instrumento en cuatro: **007** (nota por celda y lenguaje visual, sin tocar el
  audio) · **008** (el intervalo del arpegio deriva del BPM, y el checkbox de loop más el botón de reloj
  se funden en un play/pause) · **009** (el tablero como recorrido: el orden y los silencios salen de la
  geometría, muere `phaseFor` y se reescribe `collectHits`) · **010** (cabeza lectora por celda). **007 y
  008 son ortogonales entre sí** y los dos son mergeables sin cambiar el modelo temporal; **009 necesita
  a los dos** —del 007, la celda de entrada y la de salida de cada pieza; del 008, la unidad de tiempo— y
  **010 necesita al 009**. El corte es deliberado: si el 009 no suena bien, revertirlo no arrastra nada.
- **El 009 supera al 004.** La columna de la celda de agarre deja de ser la posición dentro del compás;
  el orden lo da el recorrido entre piezas. El 004 no se reescribe —es historia— pero su estado pasa a
  `Superado`, y con él se van `phaseFor`, sus tests, el campo `phase` de `Job` y la mitad de
  `simulate_board` que lo reporta.
- **El 012 y el 011 son ortogonales, y los dos cambian el circuito.** El 011 cambia la **matriz de
  costos** —cuánto cuesta ir de una puerta a otra—; el 012 cambia **cuáles son las puertas**. El 012 se
  midió e implementó sobre el código **con el 011 puesto**, así que sus porcentajes ya lo incluyen.
  Donde sí se tocan es en los **casos testigo**: el 012 le saca a la `X` la propiedad de tener una puerta
  rodeada por sus propios brazos, que es sobre la que el 011 eligió su caso estructural del cruce
  (`012/research.md` §9). El cruce sigue existiendo —32 % de los tableros de 3 piezas— pero deja de ser
  inevitable por la forma.
- **El 012 sale del mismo lugar que el 011: mirar la cabeza lectora del 010.** Es el tercer hallazgo de
  esa fuente. El 011 vio que el recorrido pisaba piezas sin costo; el 012, que adentro de la pieza el
  recorrido no camina sino que se teletransporta. Los dos son cosas que el modelo decía desde el 007 y
  que nadie había visto hasta que hubo algo que las mostrara moviéndose.
- **El 011 salió de mirar la cabeza lectora del 010 recorriendo el tablero, no de leer código.** Es el
  segundo hallazgo que sale del mismo lugar — el primero fue el bug de reflexión invertida del 009 que
  el review del 010 encontró (nota del 2026-08-17 en [revisiones.md](./revisiones.md)). Con la cabeza
  marcando qué celda suena en cada instante quedó a la vista que el recorrido pisaba piezas sin costo;
  no hizo falta leer `pathBetween` para notarlo, alcanzó con mirar.

## Lo que dejó de vivir acá

Este archivo llegó a 422 líneas sosteniendo cuatro cosas, y sólo la primera es un log. Las otras dos se
mudaron sin perder una línea:

- **[deuda.md](./deuda.md)** — lo registrado que todavía no tiene spec.
- **[revisiones.md](./revisiones.md)** — qué se aprendió escribiendo o revisando cada spec, con fecha.

`spec_status` lee de acá sólo la tabla, así que la mudanza no le cambió nada.

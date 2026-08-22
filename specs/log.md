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
| [012](./012-el-arpegio-camina-la-pieza/spec.md) | 2026-08-19 | Propuesto | El orden de las notas dentro de una pieza deja de ser el anillo angular y pasa a ser un **camino**: cada nota suena en una celda que toca a la anterior, preferentemente por un lado y —en las cuatro piezas que no admiten recorrido ortogonal— por una esquina. Medido: los pasos que **pasaban por encima** de una celda que no había sonado bajan de **4 a 0** y las 12 piezas se recorren enteras. **Revisa el mapeo del 007** —9 de 12 piezas cambian qué nota muestra cada celda, y la lámina deja de ser la referencia— y **mueve las puertas del 009/010**: el 56 % de los tableros cambia el orden de visita |
| [013](./013-control-directo/spec.md) | 2026-08-19 | Implementado | El instrumento se toca sin ir al panel: rueda y `Shift` rotan, botón derecho y `Ctrl` reflejan, la barra espaciadora es el transporte. **No cambia una nota**. Crea la primera capa de entrada del repo —hoy `src/` no tiene un solo listener de teclado— y fija la tabla de modificadores que el 014 necesita. Los tres choques reales están resueltos: el scroll bajo la rueda, el `Ctrl`+click de Mac que cancelaría la reflexión, y el doble disparo del espacio con el botón enfocado |
| [014](./014-el-tablero-se-edita-en-el-tablero/spec.md) | 2026-08-19 | Implementado | Click sobre una pieza colocada la **quita**, `Alt`+click la **mutea**, y `Alt`+click en celda vacía la coloca ya muteada. Una pieza muteada conserva su lugar y su tiempo en el circuito y suena como clicks: se ve con la baldosa **blanca**, conservando nota y `#N`. **Borra `PlacedList.tsx` entero** y con él el único lugar donde se leía el orden del recorrido. Medido: `CELL_PX` 63 → **71**, y la novena columna no le compra nada al tablero |
| [015](./015-el-click-deja-de-ser-ruido/spec.md) | 2026-08-19 | Implementado | El click del recorrido deja de ser ruido blanco —centroide medido en **11 260 Hz**— y pasa a ser una campana de altura **fija** a 2 093 Hz (`C7`), 50 ms, centroide **2 645 Hz** con ventana rectangular —2 093 exactos con Hann: ese número medía el borde de la ventana y no el timbre—. Y arranca **apagado**, dando vuelta D4 del 009. Medido: con 3 piezas el 44 % de los eventos del ciclo son clicks. **Cierra el `T070` del 011 con un "no"**: con el default apagado el botón es la única forma de encenderlos |
| [016](./016-la-pieza-se-ve-antes-de-colocarse/spec.md) | 2026-08-19 | Implementado | El botón de la paleta deja de ser una letra y pasa a ser la **forma**, en caja fija de 5×5 y en la orientación actual. La caja fija es lo que lo hace posible: con cajas ajustadas al contenido la `I` pasa de 5×1 a 1×5 y los doce botones reflowean en cada rotación. **No cambia una nota**; consume las columnas del 014 y empuja `CELL_PX` de 71 a **73** |
| [017](./017-el-regimen-de-rotacion/spec.md) | 2026-08-19 | Implementado | La rotación pasa a tener **dos regímenes**: `escala` (el de hoy, cuatro fórmulas) y `orden` (pentatónica mayor fija, y la rotación corre cíclicamente el arpegio). A 0° los dos son idénticos, así que la comparación es auditable. Medido: **36 de 48** arpegios cambian, los conjuntos de alturas bajan de 43 a 12, y **ninguna celda conserva su nota al rotar** en `orden` —garantizado, porque 5 es primo— contra 36 de 180 en `escala`. Existe para poder decidir escuchando cuál se queda |
| [018](./018-la-pieza-se-elige-con-su-letra/spec.md) | 2026-08-20 | Propuesto | Apretar la letra de una pieza la selecciona: las doce (`F I L N P T U V W X Y Z`), insensibles a mayúsculas, y **nada más** —repetir la letra es un no-op—. Medido: **cero colisiones** con la tabla de teclas del 013/014, que gastó modificadores y la barra justamente para no gastar letras. Es la primera entrada de teclado que no es un modificador, y `abreTapLimpio` ya la cubre sin tocarla: `Shift`+`f` selecciona y al soltar **no** rota. **No cambia una nota** |
| [019](./019-el-panel-se-queda-sin-botones/spec.md) | 2026-08-20 | Propuesto | Mueren los cuatro botones de grados y el ON/OFF de Reflexión —desde el 013 rueda, `Shift`, botón derecho y `Ctrl` hacen lo mismo sin soltar el tablero—; `Recorrido en el vacío` se muda a la fila de transporte como metrónomo **SVG** solo-icono (Unicode no tiene metrónomo) y `Reset` pasa a `↺`. Medido: borrar esas filas se come **exactamente** los 50 px de aire muerto de la tarjeta del tablero, y `CELL_PX` re-derivado sigue en **73** por 0,1 px. Y otra medición lo obliga a no ser sólo una resta: **29 de 96 orientaciones suenan distinto sin verse distinto**, así que agrega un lector textual de la orientación. **No cambia una nota** |
| [020](./020-la-orientacion-es-de-la-pieza/spec.md) | 2026-08-20 | Propuesto | La rotación y la reflexión dejan de ser del instrumento y pasan a ser **de cada pieza**: `Record<PieceKey, Orientacion>`, las doce miniaturas cada una en la suya, y un botón `0°` sobre la seleccionada. Medido: hoy rotar una pieza **mueve 11 de las 12 miniaturas**, y la orientación que queda no es la elegida sino la que dejó la última pieza tocada. `↺` **no** toca las orientaciones (D3). **No toca `domain/`**: `PlacedPiece` ya guarda la suya |
| [021](./021-el-tablero-es-la-pantalla/spec.md) | 2026-08-20 | Propuesto | Muere el `max-w-6xl grid-cols-12`: el tablero llena el viewport y los paneles de piezas y señal flotan encima, plegables. `CELL_PX` deja de ser constante y pasa a `max(73, min(vw/10, vh/6))` con tipografía proporcional — en escritorio la celda va de 73 a **120–180 px**, o sea entre 2,7× y 6× de área. Medido: el tablero ocupa hoy el **15 %** de una pantalla de 1920×1080; los dos flotantes tapan **11 de 60** celdas y **ninguna de la costura**. El piso salió **73 y no 60**: los 60 valían con la fuente clavada. **No cambia una nota** |
| [022](./022-el-puente-con-el-motor-sale-del-shell/spec.md) | 2026-08-20 | Implementado | **`App.tsx` pierde los seis efectos** y baja de 455 líneas a 312; `PiecePalette` pasa de dieciséis props a **dos**, partida en `OrientationPanel` y `TransportPanel`; se borra la única duplicación real de `src/` —la proyección al motor, escrita dos veces—; y los comentarios que cuentan *cómo se llegó* se mudan a `revisiones.md`. Cierra los **tres ítems de dependencias huérfanas de `deuda.md`** —las siete `devDependencies`— y le saca al de «No hay tests de UI» la parte de AC10 del 008, que esperaba desde hace catorce specs y pedía testing-library: se cierra por la otra vía que el propio registro nombra, **sin jsdom**. Medido: se mudan **166 líneas** de efectos y el **75 % son comentario**; el precio son **31 tareas** de 018–021 que cambian de destino. **No cambia una nota, ni un píxel** |
| [023](./023-la-verificacion-la-corre-la-maquina/spec.md) | 2026-08-20 | Propuesto | `pnpm verify` deja de depender de que alguien se acuerde de correrlo: entra a GitHub Actions sobre cada PR. Medido: hoy el único gate automático es Netlify, que corre `tsc -b` dentro de `build`, así que **los 562 tests del repo, el lint entero y el gate de coverage al 100 no corren nunca solos**. El workflow corre el **script** y no la lista de nodos, que es lo que hizo que el [029](./029-lo-que-no-se-cubre-no-se-mergea/spec.md) le pudiera cambiar la forma —`test` pasó a ser `suite`— sin tocar el YAML. Instala **Chromium** antes de `verify`, porque desde el 029 el navegador está adentro del nodo: con eso cierra **AC13 del 029** y **AC10 del 024**, las dos cosas que el registro le difería. Y el paquete raíz declara `engines`, que hoy sólo declara el de tooling. **No toca `eslint.config.js` ni un archivo de producción de la app**; de `src/` toca sólo lo que la propia CI falsificó en su primera corrida —la guarda que saltea en Actions los dos presupuestos del 009, y el comparador de `walk()` en `mcp-server/src/symbols.ts`, cuya cobertura dependía del orden del filesystem— |
| [024](./024-los-componentes-se-verifican-en-un-navegador/spec.md) | 2026-08-20 | Superado | Cierra el ítem más viejo de `deuda.md` —«no hay tests de UI»— por la vía que ese ítem no había evaluado: **no jsdom**, sino el browser mode de Vitest 4. Seis invariantes que hoy sólo sabe un comentario pasan a tener test en Chromium real. Medido: el bug de la rueda pasiva **se atrapa** —un `wheel` cancelable con `defaultPrevented === true` pasa hoy y fallaría con el listener en una prop de JSX—, y **sin importar la hoja de estilos `getComputedStyle` miente**: `z-10` en el `className` y `auto` computado. **Superado por el [029](./029-lo-que-no-se-cubre-no-se-mergea/spec.md)**, que mientras el 024 seguía en `Propuesto` y sin rama construyó su diseño entero para poder cubrir `Spectrum.tsx` y `engine.ts`: los dos proyectos de Vitest, el sufijo `*.browser.test.tsx`, el setup con la hoja de estilos **y los seis invariantes, los seis con test**. Es el primer spec del registro que queda terminal **sin haber tenido rama**: no se descartó ni se implementó — se cumplió, y lo cumplió otro. De sus once ACs quedan diez; el único vivo es **AC10** —el paso de `playwright install` en la CI—, que se muda al [023](./023-la-verificacion-la-corre-la-maquina/spec.md) porque es quien crea el workflow. Su D3 quedó falsificado: con `extends: true` los `projects[]` **sí** heredan `plugins`, y también el bloque `coverage`, que es lo que hace que los dos reporten contra un umbral único |
| [025](./025-el-estado-que-se-pinta-tambien-se-anuncia/spec.md) | 2026-08-20 | Propuesto | El documento deja de declararse en inglés teniendo una interfaz entera en español (WCAG 3.1.1 — y el único texto pensado para un lector de pantalla en todo el repo, el `aria-label` de las miniaturas del 016, está en español a propósito). El slider de Tempo gana nombre accesible y unidad. Y los cuatro controles que comunican su estado **sólo con color** lo anuncian también: medido, **cero** `aria-pressed`, `aria-checked` y `role=` en los 22 botones. Es la mitad no visual de la regla que `DESIGN.md` ya defiende. **El 019 se lleva dos de sus seis frentes**, y lo que sobrevive es la regla. **No cambia un píxel** |
| [026](./026-el-tablero-se-toca-con-el-teclado/spec.md) | 2026-08-20 | Propuesto | **Cierra el ítem de `deuda.md` que pide spec propio**, y contesta su pregunta abierta: **una parada de tabulación y flechas**, no sesenta. Medido: **cero** `tabIndex`, `role` y estilos de foco en todo `src/`, y desde el 014 hay una operación **destructiva** que sólo existe ahí y no tiene deshacer. El hallazgo es que no hace falta inventar nada visual —el cursor de teclado escribe el mismo `hover` que el mouse, así que fantasma, nota y validez ya funcionan— salvo el anillo de foco, que usa el **único canal libre** de la celda: la caja de afuera. Y resuelve un choque que el registro no nombraba: con el tablero enfocado, la barra espaciadora **colocaría una pieza y además arrancaría el transporte**. **No cambia una nota** |
| [027](./027-lo-que-falla-en-silencio/spec.md) | 2026-08-20 | Propuesto | Un bug **reproducido** y cuatro cosas que andan mal sin que nada falle. El bug: tras `Reset` con el transporte parado, **el velo de una pieza que ya no está en el tablero sigue dibujado** —`route-source.ts` sólo avanza cuando sube `cycleGeneration()`, y ese contador sólo sube con el reloj andando—. Más: si Web Audio falla a mitad, `clockRunning()` queda en `true` y el botón dice «Pausa» sin sonido; `Spectrum` redibuja el reposo **3.300 operaciones por segundo** —55 por cuadro y no 54: la cuenta vieja veía un solo `fillStyle` y hay dos— mientras `playhead-loop.ts` sí tiene la guarda, y no como booleano sino como **clave de lo último dibujado**, porque las transiciones son tres y no dos; y el re-render de las doce miniaturas por cada celda que cruza el cursor —**337 elementos**— es la única frecuencia del sistema sin medir. **No cambia una nota** |
| [028](./028-la-app-deja-de-llamarse-react-app/spec.md) | 2026-08-20 | Propuesto | Cierra el ítem del `manifest.json` de `deuda.md`, y **más grande de lo que estaba registrado: no es un archivo, son ocho**. El que no estaba anotado es el más visible: **`README.md` son 69 líneas de la plantilla de Vite que no nombran el proyecto ni una vez**, y encima describen mal la config de ESLint de este repo: proponen como pendiente el `recommendedTypeChecked` que el [030](./030-el-linter-verifica-lo-que-claude-md-declara/spec.md) ya adoptó, al lado de tres cosas que el repo descartó y dos plugins que no están instalados. Cinco afirmaciones, las cinco mal, y dos con el signo cambiado en cinco días — que es el argumento más fuerte de por qué el README nuevo **enlaza y no describe** el tooling. Instalar la app hoy pone en el escritorio un ícono de React llamado «React App». Se lleva de paso el color de fondo escrito en dos archivos y un `parseInt` sin base. **Ortogonal a todo**: no toca un componente, ni una regla, ni el tooling |
| [029](./029-lo-que-no-se-cubre-no-se-mergea/spec.md) | 2026-08-20 | Implementado | `pnpm verify` gana el gate de **coverage**, con umbral **100** en las cuatro métricas, y `mcp:test` gana los suyos. Medido: el repo tenía 407 tests y **ningún proveedor de coverage instalado**, así que el número no se había mirado nunca — **61,97 % de statements en `src/`** y 92,38 % de líneas en el server, con **1 393 líneas en cero absoluto** repartidas entre `engine.ts` (374, y no es UI), los seis `.tsx`, `App.tsx` y los dos hooks del 022. Ahora: **100 % en las cuatro** y 562 tests. **No construyó el proyecto de navegador re-decidiendo la herramienta: lo construyó siguiendo el diseño del 024**, que seguía en `Propuesto` y sin rama, así que cumple su AC1 y su AC2 — y, midiendo, le terminó cubriendo **también los seis invariantes de layout**, cada uno más fuerte de lo que su AC pedía: las ocho orientaciones en vez de dos, las dos capas de `Playhead` en vez de una, el `lineHeight` computado en vez de un número de memoria. Por eso el 024 queda **`Superado`** y no `Propuesto` con trabajo. Cierra «No hay tests de UI» de `deuda.md`, el ítem que sobrevivió veintidós specs. **No cambia una nota, ni un píxel** |
| [030](./030-el-linter-verifica-lo-que-claude-md-declara/spec.md) | 2026-08-20 | Implementado | Las **seis reglas** que `CLAUDE.md` declara y no verificaba nadie pasan a fallar `pnpm lint`, y la dirección de dependencia deja de prohibirse por el *string* del import para prohibirse por **ruta**: se van `especificadores()`, el conteo de `../` y los siete overrides que se pisaban entre sí, y con ellos la advertencia que el archivo llevaba escrita —«es una red, no una prueba formal»—. Verificado: un `domain/sub/x.ts` que hoy no existe ya queda cubierto. Entra linting con tipos (**100 hallazgos, 97 de un solo patrón de `node:test`**), react-hooks pasa de **2 reglas a 17** sin cambiar una línea de componente, y `.only` deja de poder pasar en verde. Medido y es el precio: el nodo `lint` va de ~2,5 s a **11,0 s** — ya sin los 15 s de `import-x/no-cycle`, que encontraba cero ciclos. Con el 029 mergeado el que manda el reloj de `verify` igual es `suite`, no el lint. **No cambia una nota, ni un píxel** |
| [031](./031-el-tablero-crece-hasta-la-pantalla/spec.md) | 2026-08-22 | Propuesto | `GRID_W` y `GRID_H` dejan de ser constantes: las dimensiones del tablero salen del viewport y la celda se queda en los **73 px de siempre**. Es la otra mitad de lo que el 021 quiso —aquel llenó la pantalla estirando la celda hasta 180 px, con el nombre de la nota a 46,8— y lo primero de todo es que **no haya scroll**: se van el `overflow-x-auto` y el `max-h-full` de `Board.tsx`, porque `cols · cell ≤ vw` por construcción. Medido: a 1920 × 1080 el tablero pasa de 60 a **390 celdas** con la celda en 72,0 px, y en los nueve viewports de la tabla lo que sobra es siempre **menos de una celda**. El hallazgo que le da forma al spec es otro: el circuito se resuelve con **Held-Karp exacto**, `O(n²·2ⁿ)`, y hasta hoy el tope de 12 piezas lo garantizaba el ÁREA (60 ÷ 5) y no una regla — con 390 celdas ese tope sería 78. Medido, 12 piezas 3,1 ms y 16 piezas 18,6 ms, duplicando por pieza: el tope pasa a ser explícito en **12**, que es exactamente lo que hoy es cierto. Y para que el tablero grande entre en el presupuesto del 009, los **144 Dijkstras pasan a ser 12** —uno por destino, cacheado— : 10,9 ms → **3,1 ms** en 364 celdas, y también baja en el tablero de hoy (2,3 → 1,9). Verificado con 279 tableros deterministas: **cero** secuencias distintas. **No cambia una nota** |
| [032](./032-la-documentacion-tambien-se-verifica/spec.md) | 2026-08-22 | Propuesto | El hermano del **030** para el otro lado del repo: si aquel hizo que el linter verificara lo que `CLAUDE.md` declara sobre el código, este mete la **documentación misma** al nodo de convergencia. Markdown entra a `pnpm lint` con `@eslint/markdown`, en **dos carriles** —preset completo en los docs vivos, y sólo las reglas que cazan un error de **renderizado** en los specs congelados, porque la Desviación 2 dice que un spec mergeado no se reescribe—; y cuatro tests nuevos verifican lo que ningún linter puede ver de un archivo solo: que los enlaces resuelvan, que `directory-structure.md` sea el mapa real de `src/`, y que `specs/` cumpla la convención que su README documenta. **Cinco hallazgos reales, medidos antes de escribir una línea de config**: una tabla del 027 que GitHub renderiza mal y **descarta dos celdas**, un ancla muerta en `mcp-domain.md`, **4 archivos de `src/`** que el mapa no nombra, y dos números de `CLAUDE.md` que son falsos —dice que quedan **dos** aserciones no nulas en producción y son **tres** (`Board.tsx:246`, anotada), y **66** en tests cuando son **95**—. Los dos números dejan de escribirse a mano: `no-non-null-assertion` con override por archivo pasa a ser la única fuente. Y `CLAUDE.md` baja de **284 a menos de 200 líneas**, que es el presupuesto que Anthropic publica para un archivo que se carga entero en cada request — el detalle no se borra, se muda a `docs/`, que es donde su propia línea 3 dice que vive. Se midió y **no** entra el gate «toda ruta que la prosa nombra existe»: 24 de 311 no existen a propósito. **No cambia una nota, ni un píxel** |

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

- **013 → 014 → 015 → 016 → 017 es una cadena, y cada eslabón tiene su motivo.** El lote sale de un
  pedido de nueve features y se cortó en cinco specs: los tres primeros gestos van juntos (013) porque
  la tabla de modificadores es **una** decisión y no tres, y quitar y mutear van juntos (014) porque
  los dos redefinen qué hace el click sobre una celda ocupada y el primero mata el panel donde vive el
  botón del segundo.
- **013 va primero porque reserva `Alt`.** Es lo único que el 014 le pide, pero sin eso los dos specs
  estarían decidiendo la misma tabla de teclas por separado.
- **014 y 016 se pasan las columnas, y está medido.** Al morir `PlacedList` quedan dos columnas libres,
  y la medición dice que **la novena no le compra un solo píxel al tablero**: a partir de `col-span-8`
  el que limita `CELL_PX` deja de ser el ancho y pasa a ser el alto. Así que una va al tablero (63 →
  71) y la otra a la paleta, que es donde el 016 va a meter las doce miniaturas. Y cuando el 016 haga
  la paleta más alta, `CELL_PX` sube solo a 73 — el techo por ancho.
- **015 debería escucharse antes de juzgar el 014.** El 014 mergea primero, así que hasta el 015 una
  pieza muteada suena como cinco ráfagas de ruido blanco de 20 ms, que es el click de hoy. No es un
  problema de orden: es que el AC del 014 que se verifica a oído queda postergado un spec.
- **015 y el 011 se contradicen sobre el mismo botón, y el 015 lo resuelve.** El `T070` del 011 quería
  **borrar** el botón de clicks; el 015 lo deja **más** necesario, porque con el default apagado pasa a
  ser la única forma de encenderlos. Es la única vez que este lote toca el `tasks.md` de un spec viejo.
- **017 va último porque es el único que toca `domain/` y cruza el borde de paquete.** `arpeggioFor` y
  `notesForRotation` cambian de firma, así que `describe_piece` y `simulate_board` dejan de compilar
  hasta que acepten y **reporten** el régimen. Los otros cuatro no tocan una nota, salvo el 014 —que la
  cambia sólo donde hay una pieza muteada— y el 015 —que cambia el timbre del click.
- **El 017 salió distinto de lo previsto, midiendo.** Se escribió esperando que el régimen `orden`
  fuera "el mismo material con otro orden", y generar los 48 arpegios desmintió dos cosas: el arpegio
  **deja de subir siempre** —mete un descenso de hasta 9 semitonos donde antes había 3— y el registro
  del instrumento **se angosta 7 semitonos** por arriba, porque la fórmula fija no tiene la
  transposición `+7` de la rotación 3. Las dos están escritas como consecuencia del pedido, con la
  variante que las evitaría anotada al lado.

- **018 → 019 → 020 → 021 sale de un pedido de seis features cortado en cuatro specs.** El corte no es
  por tamaño: **2, 3 y 4 del pedido son una sola decisión** —qué queda en el panel y con qué idioma— y
  por eso van juntos en el 019. Los otros tres son independientes entre sí.
- **018 es un carril suelto, pero no es ortogonal al 020: converge con él en `src/components/input.ts`
  y su test.** Uno decide
  *qué pieza* está en la mano; el otro, *en qué orientación*, y en el **modelo** eso sí es ortogonal
  —con la memoria por pieza del 020, seleccionar por letra restaura la orientación recordada **sin una
  línea de handler**: los consumidores leen `orientaciones[selected]` y el cambio de `selected` alcanza—.
  En el **archivo** ya casi no lo es, y el 022 es quien lo cambió. Este párrafo decía «los dos escriben
  la misma cadena de `if`/`else` del efecto de teclado» **en `App.tsx`**, y esa cadena dejó de vivir ahí:
  vive en `despachar`, adentro de `useAtajosDeTeclado` (`src/components/use-input.ts`), donde los tres
  callbacks del shell son opacos y el archivo **no menciona `rotation` ni `mirror`**. O sea que el 020 ya
  no reescribe esa cadena y el riesgo quedó **estructuralmente cerrado por el 022** (`020/tasks.md` T040,
  que hoy sólo verifica). Lo que queda del cruce es de **merge y no de diseño**: los dos escriben
  `components/input.ts` y `components/__tests__/input.test.ts` —el 018 agrega `piezaDeTecla` y ensancha
  el factory `tecla`, el 020 acota `rotacionPorRueda` a `Rotacion`—, y hasta este review no lo declaraba
  ninguno de los dos. Por eso el **018 cierra antes que el 020**, y el 020 lleva la
  tarea de verificar que la rama `ACCION.seleccionar` sobrevivió (`020/tasks.md` T040) — que con el 018
  adelante **ya no tiene salida por «no existía»**: la rama existe y hay que abrir el archivo.
- **019 va antes que 020, y es lo que evita escribir el lector dos veces.** El 019 borra los botones de
  grados y tiene que compensarlo con una línea de texto que diga la orientación, porque la miniatura no
  puede: **29 de 96 orientaciones suenan distinto sin verse distinto**, en 6 de 12 piezas (`I T U V W
  X`). La `X` es el testigo — cuatro rotaciones, cuatro arpegios, **una sola forma**. El 020 vuelve esa
  línea *por pieza*, que es un cambio de una línea; al revés habría que escribirla dos veces.
- **El 019 saca botones del panel y el 020 devuelve uno.** El `0°` vive en el 020 y no en el 019 porque
  sólo existe si hay memoria por pieza: lo que hoy deja las doce orientaciones mal de golpe es
  precisamente la rotación global que el 020 borra, así que un «resetear las doce» pierde su caso de uso
  en el mismo movimiento que lo haría posible. La asimetría es real y se anota en vez de disimularse.
- **019 y 020 se pasan el colchón de alto, y está medido.** El 019 borra tres filas del panel: la paleta
  baja de 520 a 470 px, que son **exactamente** los 50 px de aire muerto que la tarjeta del tablero
  tenía abajo de la grilla. `CELL_PX` re-derivado sigue en 73 —73,0 por alto contra 73,1 por ancho— o
  sea que **sobrevive por 0,1 px**. Pero ese −50 es la **resta sola**, y el 019 no es sólo una resta: en
  el mismo commit suma la línea de orientación (~+20 px), así que la paleta real queda en ~490 y el
  colchón baja de 50 a **~30**, con el **ancho** siguiendo al mando. Y el 020 **no lo devuelve**: su
  botón `0°` va *junto a* esa línea y no en una fila nueva, o sea que **gasta** ~10 px más. Es la
  tercera vez que este número cambia de mano y la primera en que el margen es de décimas: la próxima
  fila que salga del panel sí achica el tablero. **El número final no lo fija esta entrada sino la
  medición de T022 del 019** en el navegador, remedida por el `T039` del 020 con el botón `0°` puesto.
  **El piso del 021 NO sale de ahí**, y este párrafo decía que sí: su `CELL_PX_MIN = 73` es una
  medición *tipográfica* —la celda donde la nota vale los 19 px que el repo midió como legibles
  (`021/research.md` §3 y §11)— y no el reparto de columnas que persigue esta entrada. Que los dos den
  73 es **coincidencia aritmética**: si esta cadena hubiera dado 72, el piso del 021 seguiría siendo 73.
  Encadenarlos tenía un costo concreto — mover las proporciones `19/73` y `13/73` rompe el AC4 del 021,
  que pide que a la celda del piso la nota renderice a 19 px exactos.
- **021 va último porque borra el layout sobre el que trabajan los otros tres.** Toca los cuatro
  componentes, mata el `max-w-6xl grid-cols-12`, y reescribe docblocks que el 019 acaba de tocar. Al
  revés, el 019 mediría un colchón de alto que el 021 hace desaparecer.
- **El riesgo central del 021 no es el layout, es la cabeza lectora.** `Playhead.tsx` se posiciona
  imperativamente con `CELL_PX` a 60 fps, **fuera del estado de React** y a propósito desde el 010. Si
  `CELL_PX` pasa a ser estado, la cabeza se desalinea de la grilla en cuanto alguien redimensiona. La
  salida es una custom property de CSS (`--cell`): dibujo y cabeza leen el mismo valor y lo resuelve el
  navegador, así que AC6 y AC7 dejan de pelearse y la tipografía proporcional sale gratis.
- **El 021 salió distinto de lo previsto en un número, y midiendo.** El piso de `CELL_PX` iba a ser
  **60**, que es el que el docblock tiene medido con un `Range`. Pero esos 60 valen **con la fuente
  clavada en 19 px**, y el 021 la vuelve proporcional: a 60 de celda la nota renderiza a 15,6 px, o sea
  por debajo de lo que el repo midió como necesario. El piso coherente es **73**, que además deja la
  promesa de que el tablero nunca es más chico que hoy, sólo más grande.

- **022 va antes del lote 018–021, y es el mismo argumento con el que el 005 fue antes del 001, 003 y
  004.** Es el único que reordena `src/` **sin cambiar comportamiento**, y los cuatro que vienen escriben
  `App.tsx` y `PiecePalette.tsx`: mergearlo antes hace más chicas sus ramas. La diferencia con el 005 es
  que acá el precio está **medido y escrito**: **31 tareas** de esos cuatro specs cambian de archivo de
  destino —018 (3), 019 (10), 020 (13) y 021 (5)— y el 022 las reescribe una por una (`T018`,
  `T039`–`T041`, `T054`–`T056`). No es gratis y no se disimula.
- **Lo que compra pagarlo es que el 020 se achica.** Los dos hooks de entrada del 022 reciben
  **callbacks y no setters**, así que cuando el 020 convierta `rotation` y `mirror` en una ranura de un
  `Record`, ese cambio cae en `App.tsx` y no adentro del hook: cinco tareas sobre el cuerpo de un efecto
  pasan a ser tres callbacks. La colisión se paga una vez en el 022 y deja de existir para el 020.
- **Y una arista que hoy no declara nadie pasa a estar escrita.** `tapLimpio` lo escriben **los dos**
  efectos —el del teclado en cada `keydown` y el de la rueda a `false`— y lo lee el del teclado, todo por
  cierre léxico; lo único que lo explica es un comentario de seis líneas. Al mudarlos, el ref entra por parámetro a los dos hooks y la arista queda en las dos
  firmas. Es también el riesgo más alto del 022 —si alguien lo mete adentro del hook del teclado,
  `Ctrl`+rueda vuelve a reflejar la pieza al soltar— y **ningún test automático lo atrapa**: por eso
  tiene AC propio (AC15) y verificación en el navegador.
- **El 022 le dejó tres tareas para recontar al 021, y ya están recontadas.** Sus `T059`, `T060` y
  `T049` actualizaban «los seis efectos» a «siete» en cuatro archivos; con el 022 puesto el número base
  dejó de ser seis. Lo arregló el `T018` del 022, con el precedente de siempre: el 015 cerró el `T070`
  del 011 y el 021 cierra el `T033` del 016. **Este párrafo describía el texto viejo de esas tres
  tareas**: hoy dicen lo contrario —que no queda ningún «seis» que pasar a «siete»— y el review del
  lote las volvió a mover, esta vez de *reescribir* a *verificar*, porque el efecto de `--cell` del 021
  ya no va al shell sino a `components/use-cell-px.ts` y las tres afirmaciones de `overview.md`
  (`:22`, `:74`, `:180`) siguen siendo ciertas tal como están.
- **El 022 no difiere nada, y eso fue una decisión explícita.** Su primera versión dejaba tres de sus
  seis frentes para después del 020 y del 021 —el teclado, la rueda y la paleta— anotados en `deuda.md`
  con su dueño al lado. Se amplió a los seis con el costo a la vista, y por eso `deuda.md` **pierde tres
  ítems y no gana ninguno**. Lo que queda abierto ahí es lo que el 022 no toca: los tests de UI y el
  `manifest.json`.

- **029 dependía del 024, y terminó adelantándolo.** El 024 traía el proyecto de navegador, que es la
  única forma de cubrir `Spectrum.tsx` —canvas, `ResizeObserver`, `matchMedia` y
  `getBoundingClientRect` reales— y `audio/engine.ts`, que usa `new AudioContext()` y
  `window.setInterval`. Como seguía en `Propuesto` y sin rama, **el 029 construyó esa infra él mismo
  siguiendo el diseño que el 024 ya había fijado** —segundo *project* de Vitest, sufijo
  `*.browser.test.tsx`, setup con la hoja de estilos— para que no haya dos versiones cuando se
  implemente. Al 024 le quedan sus seis invariantes de layout; su AC1 y su AC2 ya están cumplidos.
- **029 revisa AC2 del 024, y su propia previsión.** El 024 fija que `verify` tiene cuatro nodos y el
  029 preveía llevarlo a cinco, porque los dos presupuestos de performance del 009 no sobreviven la
  instrumentación. Midiendo apareció el segundo motivo: con cinco procesos pesados en paralelo la
  contención de CPU tira abajo los presupuestos **también en la pasada limpia**. La salida fue
  encadenarlos (`suite = test && coverage`), así que **quedan cuatro nodos** y el AC2 del 024 sigue en
  pie. Ver `revisiones.md` §3.
- **AC13 del 029 queda diferido al 023.** Pide que la CI corra `coverage` y falle el PR si baja del
  100; el repo todavía no tiene `.github/workflows` porque el 023 no está implementado. El gate existe
  y muerde localmente —`pnpm verify` devuelve exit 1 nombrando la métrica—, pero **nada lo obliga en
  un PR** hasta que el 023 mergee. Lo mismo vale para tener Chromium instalado antes de correrlo.
- **AC10 del 024 se muda al 023 por el mismo camino, y no es opcional.** El paso es
  `playwright install --with-deps chromium` **antes** de `pnpm verify`. Desde el 029 `verify` → `suite`
  → proyecto `browser`, y **Chromium no está en el lockfile**: el workflow del 023, sin ese paso, falla
  en el primer runner limpio. Y falla de la peor forma posible para el propio 023 — su AC de «el PR se
  pone rojo con un error plantado» se vuelve infalsificable, porque el rojo viene de un binario que
  falta y no del error. Con el 024 `Superado`, el paso es del 023 y de nadie más.

- **El lote 023–028 sale de una auditoría del repo contra la documentación vigente de React 19, Vite 7,
  Vitest 4 y Tailwind 4.** Se cortó en seis por la misma regla de siempre —una decisión por spec— y
  **ninguno toca `domain/`**; el único que toca `audio/` es el 027, que arregla dos fallas del motor sin
  cambiar una nota.
- **023 va primero, y es lo que vuelve real a todo lo demás.** Los otros cinco agregan tests, reglas y
  ACs que hoy sólo corre quien se acuerda. Su workflow corre el **script** `verify` y no sus nodos, y esa
  decisión existe para no pelearse con los dos specs que le están cambiando la forma al script: el del
  linter le encarece el nodo `lint` de ~2,5 s a 11,0 s y el
  [029](./029-lo-que-no-se-cubre-no-se-mergea/spec.md) le cambió `test` por `suite`. Con los dos puestos
  `verify` mide **23,7 s en paralelo** contra 41,2 s en serie, y el nodo que manda el reloj es `suite`.
- **El 024 dejó de ser precondición de nadie, y por eso el lote es plano.** El 025 verifica sus ACs
  leyendo el **árbol de accesibilidad**, el 026 los suyos con eventos de teclado sobre un elemento
  enfocado, y el 027 mide re-renders provocados por el mouse: ninguna de las tres cosas existe en
  `environment: 'node'`, y las tres necesitan el proyecto de navegador. Pero **ese proyecto ya está en
  `main`**: lo diseñó el 024 y lo construyó el 029, que también lo consumía. Así que los tres pueden
  implementarse hoy, **sin esperar al 024** — y los tests que el 026 usa como oráculo de layout
  (`Board.browser.test.tsx:73-95`) los trajo el 029. Lo único que el 024 todavía le debía a otro spec es
  su AC10, y lo paga el 023.
- **«Sin esperar al 024» no es «sin esperar a nadie»: el 026 va último de los tres.** Este párrafo decía
  «en carriles independientes» y el propio review del lote lo desmintió al escribir las tareas, de los
  dos lados y sin volver acá. Son **tres aristas**, y todas entran al 026:
  - **027 → 026**, sobre `App.tsx:253-257`. El `T018` del 027 escribe ahí el número de re-renders de la
    paleta y dice «este spec va primero y mide sólo su mitad»; el `T063` del 026 dice «el número del 027
    se escribe ahí primero y esta nota va debajo». Es la arista dura: el 026 anota que el número quedó
    corto, y sin el número la nota no tiene de qué colgarse.
  - **025 → 026**, sobre `.claude/rules/ui.md` (`T038` del 026: «debajo de lo que ya escribió el 025»).
  - **025 → 026**, sobre `DESIGN.md` (`T039`: «ese párrafo lo toca el 025 primero», y `T061`, que escribe
    que el anillo de foco y el canal del 025 son complementarios).
  Las dos del 025 son de posición y la del 027 es de contenido, pero el efecto de carril es el mismo: un
  PR apilado tiene una sola base, así que el 026 no puede apilarse sobre los dos a la vez y **el lote se
  reparte en tres carriles y no en cinco** — `025 → 027 → 026`, `023`, `028`.
- **La versión que el 023 le pasaba al 024 ya la puso el 029.** `@vitest/browser-playwright` se publica
  **pinneado a la versión exacta** de `vitest`, así que el patch a 4.1.11 era precondición y no mejora.
  Hoy `package.json` tiene los dos —y `@vitest/browser` y `@vitest/coverage-v8`— en `4.1.11` **sin
  caret**, puestos por el 029 por ese mismo motivo. Al 023 no le queda trabajo ahí: su tarea pasa a
  **verificar el pin**, y volver a escribir `^4.1.11` sería la regresión que parte el árbol en dos
  runners.
- **026 conviene antes que el 021.** Los dos reescriben `Board.tsx`: el 026 le pone filas de verdad
  —`role="grid"` las exige— y el 021 mueve `CELL_PX` a una custom property. Lo que agrega el 026 es
  ortogonal a la medida y sobrevive, pero al revés habría que reescribirlo sobre un layout nuevo.
  **Con el 026 ya en `main`, «sobrevive» se pudo verificar en vez de suponer, y sobrevive en tres de
  las cuatro cosas que agrega:** las filas de verdad sólo mudan el `gridTemplateColumns` del
  contenedor a la fila, el `tabIndex` roving es un índice plano que no toca píxeles, y el
  `closest('[role="grid"]')` no depende del layout. **La cuarta no**: el anillo de foco
  (`ANILLO_FOCO_OSCURO`/`ANILLO_FOCO_CLARO`) está **derivado del aire de 2 px de la baldosa**, que el
  021 vuelve proporcional — a celda 180 ese aire mide 4,93 px y la banda clara desaparece, que es el
  modo de falla que esos dos números existen para evitar. Es trabajo nuevo del 021 (su `T065`), y es
  el **sexto** número fijo de la baldosa: su spec contaba cinco.
- **025 pierde dos de sus seis frentes con el 019, y está medido.** El 019 borra los cuatro botones de
  grados y el ON/OFF de Reflexión. No se difiere por eso —son un defecto de accesibilidad hoy y el
  trabajo perdido son dos atributos— y lo que **no** se pierde es la regla en `.claude/rules/ui.md`, que
  es lo que evita que el botón solo-icono que el 019 **crea** nazca mudo.
- **025 le deja al 026 la decisión del modelo de foco.** Rotación y régimen van como `role="group"` con
  `aria-pressed` y no como `radiogroup`, porque un radiogroup obliga a una parada de tabulación con
  flechas — que es justo la pregunta que `deuda.md` tiene abierta para el tablero y que contesta el 026.
  Decidirla de refilón para seis botones sería decidirla dos veces y probablemente distinto.
- **026 y 018 son las dos mitades de tocar sin mouse, y no chocan.** Uno usa letras; el otro, flechas,
  `Enter`, barra y `Alt`. Cero superposición en la tabla de teclas.
- **027 arregla el único bug funcional del lote, y está reproducido con un test escrito antes que el
  spec.** Su paso 4 —el re-render de la paleta— puede terminar en «no se toca una línea»: el AC es que
  **exista el número**, porque `App.tsx` tiene una decisión escrita en contra de memoizar y pisarla sin
  evidencia es lo que este repo no hace.
- **028 es ortogonal en semántica y no en texto.** No toca un componente por su lógica, ni una regla, ni
  el tooling: nada de lo que cambia altera lo que otro spec decide, así que se puede implementar en
  cualquier momento, incluso primero. Pero comparte **cuatro archivos** con el lote —`App.tsx`
  (024/026/027), `TransportPanel.tsx` (025), `index.css` (024) e `index.html` (025)—, entre una y tres
  líneas en cada uno. No hay que coordinar decisiones; sí rebases, y el más ajustado es
  `TransportPanel.tsx:22`, que el 025 y el 028 reescriben los dos. `DESIGN.md` y `CLAUDE.md` los **lee y
  no los edita**.
- **032 es ortogonal a todo el lote abierto, y es el único que puede entrar en cualquier momento.** No
  toca `src/` de producción ni una línea: sus cuatro tests viven en `src/__tests__/`, junto a los dos
  «sincronizado» que ya están, y lo demás es `eslint.config.js`, `docs/` y `specs/`. El único cruce con
  el lote es de **texto**: recorta `CLAUDE.md`, que el 031 lee y no edita. Y hay un orden preferible
  aunque no obligatorio — **conviene después del 031**, porque el 031 agrega archivos a `src/` y con el
  032 ya mergeado tendría que documentarlos en `directory-structure.md` en su misma rama: es
  exactamente lo que el gate existe para conseguir, pero encarece un rebase si los dos están abiertos.
- **`deuda.md` pierde dos ítems con este lote** —el teclado del tablero (026) y el `manifest.json`
  (028)— y **gana uno**: «tampoco hay deshacer», que hoy viaja pegado al ítem del teclado y que el 026
  deja **más** necesario, porque la operación destructiva pasa a alcanzarse también con una tecla. Lo
  escribe el `T037` del 026, al separarlo del ítem que borra. Eran tres cuando se escribió el lote: el
  de los tests de UI lo cerró el **029** y **el 024 no tiene que volver a tocarlo**. Su mitad abierta
  salió además más chica de lo que el 024 preveía — no la superficie de seis componentes, sino sólo los
  snapshots visuales, que siguen explícitamente fuera de alcance.

## Lo que dejó de vivir acá

Este archivo llegó a 422 líneas sosteniendo cuatro cosas, y sólo la primera es un log. Las otras dos se
mudaron sin perder una línea:

- **[deuda.md](./deuda.md)** — lo registrado que todavía no tiene spec.
- **[revisiones.md](./revisiones.md)** — qué se aprendió escribiendo o revisando cada spec, con fecha.

`spec_status` lee de acá sólo la tabla, así que la mudanza no le cambió nada.

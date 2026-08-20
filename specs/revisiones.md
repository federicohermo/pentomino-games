# Notas de revisión

Qué se aprendió escribiendo o revisando cada spec, y qué medición lo cambió. Es el archivo donde vive
el *por qué* de las decisiones que el código no explica: un spec que salió distinto de lo previsto deja
acá el motivo, con fecha.

Se lee de arriba abajo en orden cronológico. El registro de specs está en [log.md](./log.md) y la deuda
sin spec en [deuda.md](./deuda.md).

- **2026-08-02 — Review del spec 002.** Ejecutar los tests propuestos corrigió dos cosas que leyendo el
  plan no se veían: la detección de onsets necesita un seguidor de envolvente (un umbral crudo dio 21
  falsos onsets para 3 notas) y la tolerancia de AC5 es ±6 ms, no ±1 ms. Además, investigar las
  implementaciones de audio de ElevenLabs promovió la visualización de "seguimiento" vago a spec 003, y
  descartó explícitamente la síntesis por `AudioWorklet`.
- **2026-08-02 — El spec 004 salió de escuchar, no de planificar.** El reporte fue "las piezas suenan
  siempre superpuestas". Separarlo en dos ejes medibles mostró que uno (las notas dentro de un arpegio)
  es preexistente y con el 002 se solapa *menos*, y que el otro (las piezas entre sí) **lo introdujo el
  002**: la simplificación de "los jobs son datos puros" eliminó la fase por pieza, y eso no se
  registró como precio. Ver su `research.md`.
- **2026-08-02 — El spec 006 salió de copiar un server ajeno y medir que no servía.** El pedido era
  "un MCP server como el de `bait-landing-frontend`". Medir los dos repos descartó lo esencial de ese
  diseño: allá el server indexa 135 archivos con `ts-morph` porque localizar es el costo dominante;
  acá `src/` son 8 archivos y 25 KB, así que un índice de símbolos cuesta todo y ahorra nada. Lo caro
  de este repo se midió corriendo las puras sobre las 96 combinaciones de pieza × rotación × mirror:
  96 entradas dan **67 formas distintas**, `X` tiene una sola forma y cuatro escalas, y en seis piezas
  la reflexión se oye pero no se ve. Nada de eso se lee en el código. Se heredó el andamiaje y se
  cambió la capa de datos.
- **2026-08-03 — El spec 005 nació de partir en dos al 006, y la estructura la decidió el linter.** El
  server necesitaba el dominio como módulo, así que el spec original hacía dos cosas: reorganizar `src/`
  y montar el tooling. Separarlos dejó ver que la reorganización se justifica sola. La medición que la
  decidió no fue de gusto: `npx eslint` sobre un `.tsx` que exporta una constante además del componente
  **falla hoy** (`react-refresh/only-export-components`), o sea que **la organización actual prohíbe
  exportar el dominio, y por lo tanto testearlo** — de ahí que la geometría y la música tengan cero
  cobertura mientras el audio tiene 17 tests. La misma regla, con otro mensaje, prohíbe fusionar el
  entry con el componente raíz. El resto se investigó con context7: Vite documenta los barrel files
  como problema de performance y recomienda rutas de import explícitas; React avala componentes de un
  solo uso y desaconseja los hooks sin propósito específico; de bulletproof-react se tomaron la
  dirección única entre capas, hacerla cumplir con el linter y las subcarpetas por rol, y se
  descartaron `features/`, `stores/`, `api/` y `config/` por vacías a esta escala. Extender la regla a
  las constantes destapó **cuatro pares de números que hoy tienen que coincidir y nada sincroniza**: el
  `0.35` de `NOTE_DUR` está también como default de `scheduleVoice`, el `110` del tempo está en la UI y
  en el motor, y los tamaños de celda (`28px`/`w-7`, `20px`/`w-5`) conviven con su clase de Tailwind. Y
  sobre `enum`: **no hay ninguno y el repo no los admite** — `erasableSyntaxOnly` los rechaza con
  `TS1294`, que es la misma opción que hace type-strippable al código y por lo tanto sostiene al spec
  006. El reemplazo es const-object en `constants/` + union type en `types/`.
- **2026-08-03 — El repo migró de npm a pnpm, y el que más cambia es el 006.** Se midió antes de
  decidir, sobre este mismo `package.json` y en el mismo volumen: install en frío `pnpm` **2,2 s** ·
  `bun` 5,6 s · `npm ci` 6,9 s; y `node_modules` con **19 entradas directas** contra las 196 planas de
  npm. Bun se descartó con evidencia, no por gusto: falla al migrar el `package-lock.json` de este repo
  (`Could not resolve package 'tslib' … NotAllPackagesGotResolved`), **ignora el lockfile en silencio**
  y resuelve versiones nuevas —subió vite 7.1.5 → 7.3.6 y react 19.1.1 → 19.2.8 sin pedirlo—, además de
  ser más lento que pnpm en Windows y de dejar el `node_modules` plano, que es justo lo que no sirve
  acá. El beneficio grande no es el disco: el **spec 006** tenía toda una estrategia montada alrededor
  de un bug de npm (`npm --prefix mcp-server install` ensucia el `package.json` del server con un
  `file:..`, de ahí el `cd mcp-server` obligatorio). Con el workspace de pnpm eso desaparece — un
  `pnpm install` desde la raíz, el aislamiento garantizado por el gestor y un solo lockfile. Verificado
  sobre un prototipo del layout de dos paquetes antes de reescribir el plan. El `node_modules` estricto
  además ataja de antemano el riesgo que el 006 ya tenía anotado: un import fantasma que Vite resuelve
  y `node` no.

- **2026-08-03 — Implementación del 004: la predicción de AC7 se cumplió exacta, y la de cuatro piezas
  no.** Desfasar dos piezas a fase 0 y 0.5 deja el pico **exactamente** en el de una pieza sola (1.396
  contra 2.298 alineadas, a ganancia unitaria), justo lo que el `research.md` había anticipado
  *"entran raspando"*. Con cuatro piezas a 0 · 0.25 · 0.5 · 0.75 el pico baja un 62 % (4.596 → 1.749)
  pero los onsets **vuelven a fusionarse en uno**: el arpegio dura 1.07 s y un cuarto de compás 0.545 s.
  Es el comportamiento deseado —desfasadas producen textura, alineadas producen volumen— pero confirma
  que `ARPEGGIO_SPREAD` en unidades musicales dejó de ser una inconsistencia teórica.
  Lo otro que salió de implementarlo: **AC8 no se puede testear todavía**.
  `react-refresh/only-export-components` prohíbe que `App.tsx` exporte las puras del tablero, así que la
  regla columna→fase se verifica en el navegador hasta que el spec 005 las extraiga. Es la misma
  medición que motivó al 005, ahora pisada desde el otro lado.
- **2026-08-16 — Implementación del 006: dos supuestos del research se cayeron al ejecutarlos.** El
  primero es del propio 006: el research decía que en **I, T, U, V, W y X la reflexión no cambia la
  forma**, y medido celda por celda eso vale para I y X en las cuatro rotaciones y para T y U en las
  rotaciones 0 y 180°. En **V y W el espejo sí cambia la forma** — lo que no cambia es el conjunto de
  formas alcanzables, porque cae sobre otra rotación de la misma pieza. La frase original mezclaba dos
  propiedades distintas: "el espejo es la identidad acá" y "el espejo no agrega orientaciones nuevas".
  La descripción de `describe_piece` dice la versión exacta y hay un test que la fija sobre las 48
  combinaciones. El segundo es de aritmética de AC7: los **20 onsets en 10 instantes con
  `maxPerInstant` 2** se midieron cuando la fase no existía, y con el spec 004 implementado ese número
  solo aparece con las dos piezas en la **misma columna**; en columnas distintas da 20 instantes y
  `maxPerInstant` 1. Queda cerrada así la tarea de seguimiento que pedía verificar esa baja, y
  `simulate_board` es el instrumento que la mide sin escuchar.
  Lo tercero no era un supuesto sino un bug propio, y vale anotarlo porque es genérico: **en
  JavaScript el punto de una expresión regular no matchea el retorno de carro** —lo trata como
  terminador de línea—, así que sobre los archivos de este repo, que están en CRLF, todo patrón
  terminado en `(.*)$` dejaba de matchear y `parseTasks` devolvía CERO tareas sin ningún error. Un
  parseo de markdown que cuente cosas tiene que cortar las líneas aceptando CRLF.

- **2026-08-16 — El 007 salió de una lámina de referencia, y medirla contra el código corrigió al 001
  en dos puntos.** La lámina de las 12 piezas coloreadas no era un diseño nuevo: es el algoritmo del
  spec 001 renderizado. Correrlo sobre las 12 piezas lo confirma —coincide celda por celda— pero solo
  con **desempate por índice del array**; con el desempate por radio que el 001 había decidido en su
  D2, `F` e `I` salen distintas (`F` intercambia G4 y A4 entre `(1,0)` y `(1,1)`). Y la afirmación del
  001 de que «`F`, `I`, `T` y `X` tienen empates en todas sus rotaciones» se cae en parte: **`X` no
  tiene ninguno** una vez aplicada su propia regla D1, porque el empate lo fabricaba el
  `atan2(0,0) = 0` de la celda central que D1 saca del anillo. El desempate se ejerce en 3 piezas y
  decide algo audible en 2.
  Lo otro que salió de medir, y que **descartó una idea antes de escribirla**: se evaluó que el
  recorrido del tablero también atravesara las celdas *dentro* de cada pieza, de modo que la forma
  dibujara la melodía. No se puede sin repetir celdas: `F`, `T` e `Y` tienen 3 puntas y `X` tiene 4, y
  un grafo con tres o más hojas no admite camino hamiltoniano. La caminata mínima que cubre las cinco
  celdas cuesta 6 pasos en `F`/`T`/`Y` y **7 en `X`**, con su centro repetido dos veces. Se decidió que
  la geometría gobierne el tiempo **entre** piezas y no **dentro** de una, que es lo que deja al 007
  sin nada temporal y al 009 acotado.
- **2026-08-16 — El corte entre el 009 y el 010 estaba mal hecho, y lo delató una pregunta.** La
  primera versión dejaba las **distancias** en el 009 —que es todo lo que necesita para sonar, porque
  el click no tiene altura y solo hay que contarlos— y los **caminos** en el 010, que es el que los
  dibuja. La objeción fue de una línea: *si el modelo es un recorrido, ¿no debería calcular caminos?*.
  Medirlo la confirmó por tres lados. Uno, el costo era el único argumento a favor de separarlos y no
  existe: materializar los 144 caminos de una matriz de 12×12 cuesta **0,0138 ms** contra 0,0042 ms de
  calcular solo las distancias, y las dos son ruido al lado de los **1,87 ms** que el 009 ya paga por
  Held-Karp — el 0,7 %. Dos, la distancia **es una propiedad del camino**, así que derivar lo primario
  de lo derivado obliga a dos implementaciones que pueden discrepar: entre las dos celdas más lejanas
  del tablero hay **792 caminos mínimos**, o sea 792 formas de dibujar un recorrido que no es el que
  suena. Tres, la extensión ya prevista —esquivar las piezas colocadas— **no tiene forma cerrada**: con
  el camino como concepto primario le cambia el interior a una función, y con la distancia como
  primario reescribe el modelo. Quedó una sola decisión (`bestRoute`) con dos lecturas (`cellDistance`,
  `pathBetween`), y el 010 no toca el dominio.
  El propio experimento dejó la advertencia que ahora es tarea: la implementación de prueba de
  `pathBetween` **falló el invariante 114 veces sobre 3.600**, todas en los bordes de la costura —
  cuando el origen ya *es* la esquina, o lo es el destino. Y el invariante vale para pares
  **distintos**: los 60 casos de una celda contra sí misma tienen distancia 0 y no admiten un camino de
  largo −1.
- **2026-08-16 — El 006 dijo "sin índice de símbolos" con una medición que caducó en un día, y ahora
  hay índice.** La nota del 2026-08-02 acá arriba dice, en presente, que «acá `src/` son 8 archivos y
  25 KB, así que un índice de símbolos cuesta todo y ahorra nada». Era cierta **al escribirse** y dejó
  de serlo al día siguiente: `f2b2dad` (spec 005) partió `App.tsx` en capas, y hoy `src/` son **38
  archivos, 1.303 líneas de fuente y 84 símbolos exportados**. O sea que la medición que justificó no
  indexar se tomó sobre el repo *anterior* al cambio que el propio 006 requería —005 salió de partirlo
  en dos—, y nadie la volvió a mirar durante 13 días. Es la misma clase de dato derivado escrito a mano
  que `e257caf` sacó de `docs/`: si un número va a envejecer, o se fecha o se calcula.
  Lo que **no** cambió es la conclusión que el conteo pretendía sostener. El conteo era un proxy del
  costo de localizar, y el proxy se rompió al revés: los 30 archivos nuevos los trajo la
  modularización, así que hoy hay más archivos y cada uno es más fácil de ubicar (un módulo por razón
  de cambio, ninguno arriba de 217 líneas). Lo que sí se volvió caro es otra cosa, y es la que decidió
  agregar la tool: **el costo en tokens de localizar leyendo**. Medido sobre "¿dónde está
  `notesForRotation` y quién depende de él?" — `grep` sobre los dos paquetes da 4.544 bytes en 40 hits,
  la mayoría call-sites repetidos del mismo test, y como no trae la firma hay que abrir `music.ts`
  (1.663) igual: 6.207 bytes contra los 433 de `find_symbol`, **14x**. Su entrada del catálogo cuesta
  1.705 y se paga con la primera consulta.
  De la decisión original sobrevive lo que de verdad importaba, y por eso esto no es una vuelta atrás
  completa: **no hay artefacto**. El índice se construye en la consulta (112 ms en frío, ~50 ms después,
  sobre 36 archivos indexados más 16 que solo aportan aristas) y no se persiste, así que sigue sin haber
  build ni nada que regenerar. Si algún día eso duele, cachear por `mtime` — no generar un archivo. Y se
  parsea con el AST de `typescript`, no con regex, por dos motivos: `usedBy` se resuelve por el grafo de
  imports y no por coincidencia de texto (un homónimo de otro módulo no cuenta como usuario), y una
  regex de líneas sobre este repo se equivoca en silencio con CRLF, que es exactamente el bug de la nota
  anterior.
  **Y el grafo cruza el borde de paquete, que fue el defecto de la primera versión.** `usedBy` salía de
  `src/` solamente, así que escondía los **31 símbolos del dominio que importa `mcp-server/`**: para
  `notesForRotation` contestaba 2 usuarios donde hay 4. Eso hacía a la tool *menos* completa que el
  `grep` que venía a reemplazar —un grep sí encuentra `describePiece.ts`— y contradecía su propia
  descripción, que vende el `usedBy` como grafo y no como coincidencia de texto. Vale precisar qué
  arreglaba y qué no: romper una firma del dominio **nunca pasó silencioso**, porque el tsconfig del
  server typechequea cruzando el borde y `pnpm verify` falla señalando `describePiece.ts` y
  `simulateBoard.ts` (verificado rompiendo la firma a propósito). Lo que estaba mal era el input de
  planificación. El arreglo es asimétrico a propósito: de `mcp-server/src/` se leen los **imports** y no
  los **exports**, porque el índice describe la superficie de `src/` y las tools no son parte de la app.
  **Y el grafo volvió a sub-reportar por el otro lado, que es el patrón a recordar.** El code review
  encontró que solo se leían los `namedBindings`: el binding por defecto vive en `importClause.name`, así
  que los seis `export default` de `src/` —`App` y los cinco componentes, o sea la capa de UI entera—
  contestaban `usedBy: []`. Eso es peor que sub-reportar: `usedBy: []` se lee como *código muerto, se
  puede borrar*. Junto con eso, un alias guardaba el nombre local en vez del exportado
  (`{ isValid as esValida }` escondía a `isValid`), y `includeTests` filtraba `usedBy` pero no los
  matches, así que un helper de `__tests__/` salía presentado como superficie de `src/` y sin usuarios.
  Las tres son la misma falla de fondo: **el grafo tiene dos puntas —qué nombre y qué archivo— y cada
  atajo en una de ellas falla callado**, porque una lista vacía es una respuesta válida. Un grep se
  equivoca de más y se nota; este índice se equivocaba de menos. La lección operativa es la que salvó al
  review: cuando lo que se audita es la herramienta, verificar sus respuestas con una fuente
  independiente en vez de tomarla como oráculo.

- **2026-08-16 — El review del PR del spec 007 cambió el tablero más que la implementación.** Tres de
  los siete hallazgos eran del código y se arreglaron solos; los que movieron el producto salieron de
  mirar la pantalla. **El fantasma seguía hablando el idioma viejo**: el spec sacó la letra repetida
  cinco veces de la celda ocupada y nadie miró que la celda de previsualización la seguía mostrando,
  en verde, justo cuando es la que decide la jugada. Arreglarlo obligó a un cambio de contrato que el
  plan no tenía —`previewCells` viaja como array y no como `Set`, porque el índice es lo que conecta
  la celda con su grado— y **volvió redundante a `PiecePreview` entero**, que mostraba la pieza aparte
  y sin notas mientras el fantasma la muestra en su lugar y con la nota de cada celda. El componente
  se retira, con `PREVIEW_CELL_PX` y la ranura `children` del `Board`. La lección es de altura, no de
  código: **un spec que cambia lo que una celda dice tiene que revisar TODAS las celdas que dicen
  algo**, y el inventario de superficies no lo da el diff.
  Lo segundo es que el riesgo que el spec sí había declarado —el tablero de 440 px debajo de `md`— se
  midió fallando y se estaba mergeando como «decisión abierta» anotada en el cuerpo del PR. Se cerró
  con `overflow-x-auto` en el contenedor de la grilla, que scrollea el tablero en vez de la página y
  deja `CELL_PX` en 44: achicar la celda devuelve el problema que ese número existe para resolver.

- **2026-08-16 — El test de la paleta medía bien y elegía mal: pasó de WCAG 2.1 a APCA.** El reporte
  fue de una línea y mirando la pantalla: *«`I`, `P`, `X` y `T` deberían tener texto blanco»*. La
  primera respuesta fue defender la tabla —las cuatro fallan AA (4,5:1) con blanco: 4,15 · 3,37 · 4,00
  · 2,93— y ofrecer oscurecer los cuatro fondos para hacerle lugar. **Esa respuesta era correcta sobre
  el test y falsa sobre el asunto**, y confundir las dos cosas es lo que vale registrar: que un color
  no pase *el test que este repo tiene escrito* no es lo mismo que que se lea peor.
  Medirlo con APCA —el algoritmo candidato de WCAG 3, que existe porque 2.x mispredice— lo dio vuelta
  entero. El caso testigo es `T` (`#FF0000`): 2.1 da negro 5,25 contra blanco 4,00 y elige **negro**;
  APCA da negro **37,6** contra blanco **69,6**, con el piso de texto de cuerpo en Lc 60. O sea que el
  negro que la tabla venía eligiendo estaba *debajo* del piso de legibilidad, en `I`, `P`, `T`, `U` y
  `X`. La razón es conocida: 2.1 pondera el verde al 71,5% y el rojo al 21,3% y falla justo en los
  saturados de tono medio, que son buena parte de esta lámina; y usa un cociente, así que no modela la
  **polaridad** —texto claro sobre fondo oscuro no es el simétrico de su inverso—, que es exactamente
  la asimetría que este caso necesitaba.
  El resultado práctico es que **no hubo que tocar ni un color**: la propuesta de oscurecer los cuatro
  fondos existía solo para satisfacer un criterio equivocado, y cambiar el criterio la volvió
  innecesaria. Cambió el `fg` de seis piezas (`I`, `L`, `P`, `T`, `U`, `X`), y `U` no estaba en el
  pedido — es el caso más fuerte de los seis (37,1 contra 72,5) y apareció solo al medir las 12 en vez
  de las cuatro reportadas. La lección operativa es doble: **el ojo sobre la pantalla es un dato, no
  una opinión**, y cuando un test contradice lo que se ve, el sospechoso es el modelo del test —no hay
  que medir solo lo reportado, hay que medir el conjunto.
  Lo que el cambio dejó abierto está en Deuda conocida: `L` (55,8) e `Y` (56,9) no llegan a Lc 60 con
  ningún `fg`. `specs/007/research.md` **no se reescribió** — documenta lo que se midió entonces y con
  qué modelo, y pisarlo borraría el registro de por qué en su momento se eligió negro.

- **2026-08-16 — El 008 cierra la deuda del 004 sobre `ARPEGGIO_SPREAD`.** La tarea de seguimiento
  anotada en [`004/tasks.md`](./004-fase-por-pieza-la-columna-como-posicion-en-el-compas/tasks.md#seguimiento-no-bloquea)
  pedía llevar el espaciado del arpegio a unidades musicales, con la medición de que a 110 bpm cuatro
  piezas desfasadas fusionan sus onsets porque el arpegio (1.07 s) dobla a un cuarto de compás
  (0.545 s). El 008 la salda: `intervalDuration(bpm)` reemplaza a `ARPEGGIO_SPREAD`, definida sobre
  `barDuration` como `barDuration(bpm) / (BEATS_PER_BAR * SUBDIVISIONS_PER_BEAT)`. A 100 bpm el
  intervalo da 0,15 s —el mismo valor que `ARPEGGIO_SPREAD` tenía fijo—, así que a ese tempo el patrón
  no cambia; a 160 bpm el arpegio de 5 notas pasa a medir 0,375 s en vez de mantener 0,6 s fijos
  mientras el compás baja a 1,5 s, que era lo que espesaba el instrumento en vez de acelerarlo.

- **2026-08-17 — El 008 se implementó con `NOTE_INTERVALS = 1`, y su D3 decía 2.** La desviación salió
  de escuchar la rama y está medida: con 2 la nota dura el doble de lo que tarda en llegar la siguiente,
  así que el arpegio suena con **2,88 voces encimadas de forma permanente** a 110 bpm —contando
  `(NOTE_INTERVALS × intervalo + release) / intervalo`—, y se oye como un acorde desplegado en vez de
  como cinco notas. Con 1 la nota termina justo cuando entra la que sigue y quedan **1,88**, contra las
  **3,13** de antes del spec. No mueve ningún onset, así que AC3 y AC4 se re-verificaron intactos
  después del cambio. `spec.md` **no se reescribió** —es historia, igual que el `research.md` del 007—,
  pero el número que quedó vivo es 1: está en la constante, en su comentario y acá.

  Lo que la desviación deja abierto: `DEFAULT_VOICE.release` sigue en 0,12 s absolutos, o sea 0,48
  intervalos a 60 bpm y **1,28 a 160**, y es lo único del modelo temporal que no quedó en unidades
  musicales. Es lo que hace que el solape restante del arpegio crezca con el tempo en vez de quedarse
  quieto. Anotado en el Seguimiento del 008.

- **2026-08-17 — El review del spec 010 encontró un bug del 009 que ningún test de audio podía
  encontrar: con la pieza reflejada, el circuito la recorre al revés que la melodía.** El 009 eligió
  grado 0 = entrada y grado 4 = salida para las puertas, y **nunca menciona la reflexión** —ni su
  `spec.md` ni su `research.md` la nombran una sola vez—; su test solo pide que las dos puertas sean
  distintas (`sequence.test.ts:160`), que pasa igual con las dos invertidas. Pero el retrógrado invierte
  el **orden de reproducción** sin mover qué nota le toca a qué celda, así que con `mirror` la primera
  nota que suena es la del grado 4. Medido sobre `L`/0/reflejada en `(1,1)`: `gates` entra por `[1,3]`
  (grado 0, D4) mientras el timeline arranca en B4, que vive en `[0,0]` — la punta opuesta, y encima el
  salto anterior venía caminando hasta `[1,2]`, pegado a la entrada. **Entrada y salida están
  exactamente invertidas en toda pieza reflejada**, o sea la mitad del espacio de colocación. Es la
  misma incoherencia que el 009 sacó del caso de una pieza sola —«no se oye un recorrido sino dos golpes
  encima del arpegio»— sobrevivida en el caso que no miró. **Y cambia lo que suena, no solo lo que se
  dibuja**: con esa `L` reflejada más una `P` rotación 0 en `(7,1)`, el ciclo pasa de 23 a 21 intervalos;
  todo tablero **sin** reflexión suena exactamente igual que antes de este arreglo.
  Cómo apareció, que es lo que vale registrar: **no se buscó**. El paso de verificación del 010
  —"confirmar que el 009 dejó lo necesario"— contestó que no (la secuencia trae la celda de cada *click*
  pero no la de cada *nota*), y derivar la que faltaba dejó a la vista que la derivación que ya existía
  estaba mal. Dos derivaciones del mismo hecho, y la vieja equivocada. El arreglo es unificarlas:
  `cellsByPlayOrder` como única fuente y `gates` leyendo de ella, que es el mismo movimiento con el que
  el 009 hizo que la cantidad de clicks se lea del largo del camino en vez de calcularse.
  Y la lección de fondo: **una cabeza lectora es un test de coherencia entre lo que suena y lo que se
  ve**. El circuito era válido, las distancias correctas y los onsets los esperados — el error no estaba
  en el tiempo sino en la correspondencia entre el tiempo y el espacio, que es exactamente lo que hasta
  hoy no se dibujaba. Es el mismo patrón que la nota del 007 («el ojo sobre la pantalla es un dato, no
  una opinión»), un spec más tarde.
  El arreglo va en la rama del 010, en su propio commit y atribuido al 009 (AC13 del 010) — el mismo
  procedimiento con el que el 006 bajó `phaseFor` al dominio en un commit del 005.

- **2026-08-18 — Cerrar los seguimientos de cuatro specs de una vez mostró que la mitad no eran tareas
  sino deudas de registro.** Las cuatro secciones de Seguimiento sumaban 16 ítems, y se repartieron en
  cinco clases muy distintas; confundirlas es lo que las había dejado abiertas tanto tiempo.
  **Tarea real y chica** (10 ítems, 7 tareas distintas): retirar `PlacedPiece.notes`, el `asciiDegrees`
  del MCP, el `title` de la celda, el slider en bpm, el release en intervalos, el lint adentro de
  `domain/` y la medición de `occupantAt`. Ninguna pasó de un commit. `PlacedPiece.notes` estaba anotada **cuatro
  veces** —001, 007, 009 y 010— y cada spec la postergaba al siguiente: la señal de que una tarea se
  repite en cuatro seguimientos es que ya nadie la considera suya.
  **Lo que no era una tarea sino una decisión ya tomada** (2): `CLOCK_START_DELAY` y `PLAY_DELAY` «se
  quedan en segundos a propósito» era una respuesta, no un pendiente, y estaba anotada en el único lugar
  donde no la va a leer quien intente cambiarlos. Cerrarla fue mover el porqué a la constante. Lo mismo
  con el tercer consumidor del motor del 010: era condicional y la condición no se cumplió.
  **Lo que no tenía dueño** (2): AC10 del 008 —el botón de transporte sin test— y la colocación
  envolvente del 009. Las dos vivían en el seguimiento de un spec cerrado, que es donde nadie las va a
  buscar; su lugar es Deuda conocida, que es la única fuente que este repo declara.
  **Lo que ya era otro spec** (1): «esquivar piezas colocadas» es el 011, que además reemplazó el BFS
  que el 009 proponía por un peso.
  Y **lo que no se puede cerrar leyendo código** (1 acá, más las verificaciones a oído y a ojo que el 009 y
  el 010 dejaron sin marcar): la decisión sobre `TEMPO_MAX`. Siguen abiertas y ahora dicen que lo
  están, con el motivo escrito al lado.
  Dos hallazgos del camino, los dos por medir en vez de suponer. **El release era el último número del
  modelo temporal en segundos**, y su costo no era estético: las voces simultáneas son
  `1 + release/intervalo`, así que el instrumento se espesaba al acelerar —2,28 voces a 160 bpm contra
  1,88 a 110— justo lo que el 008 había arreglado para el espaciado y la duración. El valor que lo cierra
  no es redondo a propósito: `0,88 = 0,12 / intervalDuration(110)` deja el tempo por defecto sonando
  idéntico. Y **el argumento de costo con el que `route-source.ts` justificaba no usar `occupantAt` era
  falso**: son 4,1 µs un tablero entero con 12 piezas. La razón real —contesta sobre el tablero de ahora
  y no sobre la ruta que suena— ya estaba escrita al lado; el costo inventado la tapaba. Un comentario
  que da dos razones y sólo una es cierta es peor que uno que da una sola.

- **2026-08-19 — El 012 dijo «el grado 0 es la puerta de entrada» y era cierto en la mitad del espacio
  de colocación.** El pedido fue un reporte de uso, no de código: *el punto de entrada a la pieza
  siempre debe ser el cuadrado número 0 y mantener el orden ascendente*. Reproducido con
  `L`/0/reflejada en `(1,1)`, la cabeza lectora entraba por `[0,0]` —que la celda rotulaba `#4`— y
  contaba hacia atrás. El comportamiento **no era el bug**: el retrógrado del 009/010 estaba bien y el
  012 lo declaró explícitamente fuera de alcance. El bug era el **rótulo**, y una afirmación falsa en
  D3 que se propagó a cuatro archivos —`music.ts`, `modelo-musical.md`, `DESIGN.md` y
  `.claude/rules/domain.md`— sin que nada se pusiera en rojo, porque el grado y el paso **son el mismo
  número en las 48 orientaciones al derecho**.
  La lección es sobre qué pregunta contesta un número en pantalla. El `#N` de la celda nació en el 007
  como el grado —qué lugar ocupa la nota en el arpegio ascendente—, y era la lectura correcta mientras
  el tablero era un compás. Desde el 010 hay una cabeza lectora encima, y entonces la pregunta que la
  celda contesta de hecho pasó a ser *cuándo suena esta*, que es el paso. **Un dibujo nuevo puede
  cambiar qué pregunta hace un dato viejo**, y eso no lo detecta ningún test: los 238 estaban en verde,
  y ninguno miraba la relación entre el rótulo y la puerta.
  El arreglo introduce `playOrderByCellIndex(forma, mirror)` como **única** derivación del retrógrado
  sobre celdas: `cellsByPlayOrder` tenía su propio `reverse` y era la segunda copia. Que la regla que
  se pinta en pantalla y la que arma el circuito salgan del mismo lugar es el mismo movimiento con el
  que el 010 unificó `gates`, y por el mismo motivo. Ni una nota cambia: el grado sigue diciendo qué
  altura tiene cada celda, y las dos numeraciones conviven documentadas porque cruzarlas compila
  —`ascendente[paso]` da la nota espejada en las 48 reflejadas— y ahora hay tests que lo ejercen.
  Y una segunda lección, del review del propio arreglo: **las puras estaban bien, y no alcanzó**.
  `playOrderByCellIndex`, `degreeByCellIndex` y `gates` daban todas la respuesta correcta; lo que estaba
  mal era cuál de ellas llamaba la pantalla, y esa elección vivía adentro de `Board.tsx`, donde
  `react-refresh/only-export-components` impide exportarla y por lo tanto testearla — el mismo motivo
  por el que el dominio salió de `App.tsx` en su momento. Por eso el encadenado se fue a
  `components/cell-text.ts` con su test al lado: **un test del dominio no cubre la decisión de qué le
  pide el componente al dominio**, y era justo ahí donde no había ninguno.

- **2026-08-19 — El 014 y el 015 se contradecían sobre si una pieza muteada suena, y ninguno de los dos
  podía verlo solo.** El 014 hace que la pieza muteada emita cinco `Click` **sin `note`** (T007, D3:
  reusar `Click` en vez de un `Step` con bandera). El 015 pone `clicks` en `false` por default (T013 y
  T035, AC6). Pero el gate de `engine.ts` es `else if (clicksAudible)` sobre la rama muda —la del
  `Click` sin altura—, así que con los dos mergeados **una pieza muteada es silencio total al abrir la
  app**, y el AC11 del 015 pedía verificar exactamente lo contrario: que sonara con la campana nueva.
  Ninguna de las dos ramas habría fallado un test. El 014 no menciona `clicksAudible` y el 015 no
  menciona el muteo; cada spec por separado es consistente, y la contradicción vive **entre** los dos.
  Salió de derivar el grafo del lote 013–017 para `/spec-implement-batch`, cruzando qué archivo y qué
  constante toca cada spec — no de leer ninguno de los dos.
  **La decisión fue el silencio**, y conviene por qué y no sólo qué: mutear una pieza es sacarla del
  sonido, así que silencio es la lectura correcta del gesto. La alternativa era separar los dos
  significados que el 014 le encima al mismo `Click` sin `note` —«celda vacía» y «celda de pieza
  muteada»—, y eso cuesta un cuarto `HIT` y un discriminante en `Click`, que es justo lo que el
  docblock de `sequence.types.ts` evita al afirmar que «sin `note` significa exactamente que esa celda
  estaba vacía». Se corrigieron el AC11 y el T019 del 015, que ahora piden verificar las **dos**
  mitades —apagado no suena, encendido suena—, y entró un T037 para que el porqué quede escrito en la
  rama de `engine.ts` donde se lo va a preguntar quien lea los dos specs juntos.
  La lección de método: **un lote de specs puede estar compuesto de specs individualmente correctos y
  ser contradictorio igual**, y la contradicción no aparece leyéndolos en orden — aparece cruzando qué
  toca cada uno. Es lo que ahora hace el Paso 2 de `/spec-implement-batch`.
- **2026-08-19 — El review del spec 016 encontró un canal que se anula solo en un estado.** El hallazgo
  no fue un bug de lógica: `miniCells` y su test están bien, y las 96 combinaciones pasan. Fue que el
  borde de la miniatura se implementó con `slate-900` —el idioma del tablero desde el 007, y la
  justificación literal de D3— sin notar que **el botón seleccionado tiene ese mismo color de fondo**.
  Razón de contraste 1,00: en ese estado el borde no existe. Y ahí es donde hace falta, porque `W`
  (`#0000FF`) queda a **2,08** contra `slate-900`, bajo el piso de 3:1 que WCAG 1.4.11 pide para un
  objeto gráfico.
  Lo que hizo decidible el fix fue medir las 12 contra los **dos** fondos en vez de contra uno: los
  conjuntos que fallan son **disjuntos** —7 de 12 contra el botón claro (peor `V`, 1,02, el amarillo
  sobre el gris); una sola contra el seleccionado— así que ningún color de borde fijo cubre los dos
  estados. `slate-400`, que es el que llevaba el punto de color y el que AC7 mandaba heredar, da 2,34
  sobre el claro: también bajo el piso. El borde se invierte con el estado (T040).
  Dos lecciones. La primera es de método: **el contraste hay que medirlo contra todos los fondos que el
  elemento puede tener, no contra el de reposo.** El repo ya tenía la disciplina de medir —`DESIGN.md`
  usa el contraste como test y `palette.test.ts` lo recalcula— pero medía el color de pieza contra la
  tarjeta blanca, que es un fondo solo. La segunda es que el criterio no es siempre el mismo: para
  elegir el color de TEXTO sobre un color de pieza el repo usa APCA desde el 007 y con razón, pero
  para un objeto **gráfico** —una celda pintada, un borde— el umbral que aplica es el 3:1 de WCAG
  1.4.11, y confundirlos hace mirar la tabla equivocada.
- **2026-08-19 — El 017 confirmó sus cinco mediciones y encontró una sexta que no estaba escrita.**
  Los números del spec se re-derivaron ejecutando el dominio real y todos dieron: 36 de 48 arpegios
  cambian, los conjuntos de alturas bajan de 43 a 12, `orden` conserva 0 de 180 celdas al rotar contra
  36 de 180 de `escala` (con la descomposición 24 / 12 / 0), el descenso de `orden` es de **9 semitonos
  exactos** y no «hasta 9» —36 de ellos, uno por arpegio movido— y el registro se angosta de `C4`–`D#6`
  a `C4`–`G#5`. Los cinco están hoy bajo test, no sólo en el `research.md`.
  Lo que no estaba escrito: **`escala` y `orden` no son disjuntos fuera de la rotación 0.** Al escribir
  el test de `noteAtCell` bajo los dos regímenes salió que coinciden en 24 de las 60 celdas de la
  **rotación 3**, y en ninguna de las rotaciones 1 y 2. Tiene explicación exacta y no es ruido: la
  rotación 3 de `escala` es `PENT_MAJOR` transpuesta `+7` —grados `[7, 9, 11, 14, 16]` sobre la tónica—
  y la de `orden` es la mayor corrida 3 —`[7, 9, 0, 2, 4]`—, así que los **dos primeros grados son los
  mismos** en las 12 piezas. El spec afirmaba que los dos regímenes «tienen un origen común y divergen
  a medida que se rota», que es cierto de los arpegios enteros pero no de sus notas una por una.
  La lección de método: **el número que un spec no midió es el que aparece al escribir el test que
  cruza sus dos ramas.** El `research.md` comparó los 48 arpegios de cada régimen como conjuntos y como
  listas; nadie los había comparado *celda contra celda al mismo ángulo*, que es justo la comparación
  que hace el consumidor real — `noteAtCell`, o sea la altura que suena al pisar una celda cruzada.
- **2026-08-20 — El ítem de deuda más viejo del repo pedía infra y lo cerró una firma.** AC10 del spec
  008 —que el botón de transporte diga si el reloj *arrancó de verdad* y no si se lo apretó— esperaba
  desde hace catorce specs, y el registro nombraba las dos salidas: «extraer el handler de `App.tsx`
  **o** agregar testing-library». La segunda arrastraba `jsdom` en su propio bloque de config; la
  primera resultó ser **tres líneas**. Lo que la hizo posible no fue extraer sino **cómo**: el motor
  entra a `alternarTransporte` por parámetro y no por import, así que la discrepancia que hay que
  testear —se pidió arrancar y no arrancó— se escribe con un objeto de una línea
  (`corriendo: () => false`) en vez de armarse desde un mock. La lección de método es la que conviene
  recordar la próxima vez que un ítem de deuda diga «cuando exista la infra»: **antes de agregar la
  infra, mirar si la firma la vuelve innecesaria.** Y el corolario del registro: el ítem había
  escrito las dos salidas, así que la información para cerrarlo estaba ahí desde el 008 — lo que
  faltaba era leerlo como una decisión y no como una espera.
- **2026-08-20 — El 022 no pudo partir `PiecePalette` como decía su propio plan, y el motivo estaba a
  medio medir.** El spec pedía que `OrientationPanel` se llevara las doce miniaturas, el régimen, la
  reflexión y el lector de notas, devolviendo un **fragmento** para no tocar el ritmo vertical del
  `space-y-2`. Su `research.md` §10 había medido la trampa a medias: vio que la fila de los clicks
  (transporte) cae **entre** dos bloques de orientación, pero no que el bloque de tónica + `Notas
  actuales` viene **después** de esa fila, ni que la grilla de miniaturas cuelga de la tarjeta y no del
  `space-y-2`. Con las tres cosas juntas la orientación vive en **tres regiones no adyacentes y en dos
  niveles de anidamiento**, y ningún componente puede cubrirlas con el único nodo que devuelve. Se
  resolvió a favor del oráculo duro —AC18, cero cambio visual, del que dependen tres specs que ya
  midieron sobre ese DOM—: cada panel se llevó un subárbol **contiguo** (las miniaturas y el bloque
  `border-t`) y las cuatro filas del medio quedaron en el contenedor. La lección de método:
  **cuando se mide una interpolación, hay que contar todas las regiones, no la primera que aparece.**
  Contar una sola hizo que el plan pareciera posible con un fragmento, y eso se descubrió al escribir
  el JSX y no al escribir el spec.
  La segunda mitad es sobre cómo se verificó: se renderizó la versión de `main` y la nueva con
  `renderToStaticMarkup` sobre las **32** combinaciones de rotación × reflexión × `playing` × `clicks`
  y se comparó el markup carácter por carácter. Salió idéntico en las 32, y eso costó veinte líneas de
  test temporal. **«Cero cambio visual» era verificable sin jsdom y el spec lo daba por verificable
  sólo a ojo**: `react-dom/server` corre en `environment: 'node'` sin DOM, así que la afirmación que
  parecía pedir navegador se podía falsar en un segundo. Vale para cualquier refactor de JSX que
  prometa no mover un píxel.
- **2026-08-20 — Un hook que cablea un módulo va al lado del módulo, y eso contradecía la tabla de
  roles.** `conventions.md` mandaba los hooks a `<capa>/hooks/` como `useCamelCase.ts`, y los dos que
  este spec creó fueron a `components/` en kebab-case: `use-engine.ts` al lado de
  `engine-bridge.ts`, y `use-input.ts` al lado de `input.ts`. La regla nueva no es un permiso, es lo
  que hace legible la partición: **la decisión vive en el archivo sin `use-` y el cableado en el que
  lo tiene**, y mandar el segundo a otra carpeta parte cada par en dos lugares por una convención de
  nombre. `hooks/` queda reservado para un hook que no sea el cableado de ningún módulo — y sigue
  sin existir.

## 2026-08-20 — El pase de comentarios del spec 022

Lo que sale de acá para abajo **estaba en `src/`** y se mudó, no se borró: es la crónica de cómo se
llegó a cada decisión, separada de la restricción que hoy obliga al código a ser así — que se quedó
donde estaba, con un puntero a esta entrada. El criterio está en
[`docs/guides/conventions.md`](../docs/guides/conventions.md#el-eje-del-tiempo-restricción-vigente-contra-crónica).
Sin objetivo porcentual y con la regla de que ante la duda se queda: de los seis bloques que se
miraron, cuatro se partieron en dos y dos se dejaron intactos.

### El default de los clicks del recorrido, y sus tres etiquetas (`App.tsx` y `PiecePalette.tsx`)

El flag `clicks` **pasó por los dos estados** y el argumento del que venía sigue siendo bueno, así que
conviene que quede escrito.

Hasta el spec 015 venía **encendido**, por D4 del 009: sin clicks un salto largo por celdas vacías es un
silencio mudo y el recorrido se vuelve inaudible. Ese argumento no se negó nunca — está medido y es
grande: en un tablero de 3 piezas el **44 %** de los eventos del ciclo son clicks, así que apagarlos
apaga casi la mitad de lo que el tablero dice. Lo que cambió es **quién decide**: el default lo elige
quien escucha el instrumento, y con el click en ruido blanco molestaba. Con la campana del 015 puede
volver a `true`.

La etiqueta del botón cambió dos veces por el mismo movimiento. Dijo **«Clicks mudos»** desde el spec
011 hasta el 015, y el motivo de la palabra «mudos» sigue valiendo aunque la palabra se haya ido: el
recorrido tiene dos clases de cruce y el botón apaga sólo una. Con el default dado vuelta a `false`,
«Clicks mudos» con un ON/OFF quedaba retorcido dos veces —un click *mudo* que está *encendido*, y un
apagado del que no se sabe si apaga el click o apaga el mute—, así que pasó a **«Recorrido en el
vacío»**, que dice qué se oye cuando está encendido en el idioma que el instrumento usa desde el 009. Y
además ya no dice «click», que desde el 015 tampoco es cierto: es una campana de altura fija.

Y el botón nació para tapar los golpes sordos de cruzar una pieza, o sea **el problema que el 011
arregla**. Su `T070` propuso borrarlo por eso, y el 015 lo cerró con un «no»: con el default apagado el
botón es la única forma de **encender** el recorrido, así que borrarlo lo dejaría inalcanzable. La
historia se conserva; lo que cambió es la conclusión.

### El ciclo de una sola pieza (`domain/sequence.ts`)

El plan del spec 009 decía que el ciclo de una pieza sola era «el salto de la pieza a sí misma», de la
salida (grado 4) a la entrada (grado 0). **Se cambió después de escucharlo**: con la `Z` en
`(0,1)(1,1)(1,0)(2,0)(3,0)` ese salto mide 3 y su camino era `[[2,0],[1,0]]`, o sea que los dos clicks
caían **sobre la propia pieza que acababa de sonar**. No se oía un recorrido —no hay a dónde ir— sino
dos golpes encima del arpegio.

El spec 011 le sacó el síntoma y no el motivo: `routeBetween` rodea la pieza en vez de pisarla, así que
hoy esos clicks caerían en celdas vacías. Siguen sobrando, y el que se queda en el código es el motivo:
el recorrido existe **entre** piezas.

### El esquema de columnas de la paleta (`OrientationPanel.tsx`)

El esquema **se remidió entero para el spec 016 y no se heredó**: la cuenta anterior estaba hecha sobre
la letra más el punto de color, y ninguno de los dos gobierna ya el ancho — hoy manda la caja de la
miniatura, que no depende ni de la pieza ni de la orientación, así que el peor caso dejó de ser el `W` y
pasó a ser el mismo para las doce.

Lo que sí se heredó es la **métrica**, que es la que atrapó el bug la vez pasada: con el esquema viejo el
padding efectivo llegaba a **-4,6 px a 768**, o sea la letra cruzando su propio borde. Y a `md` el punto
más apretado del rango era el mismo entonces que ahora, que es lo que hace que la tabla de viewports se
tenga que leer completa y no en su extremo ancho.

### El punto de color de los botones de pieza (`OrientationPanel.tsx`)

Hasta el spec 016 la identidad de la pieza entraba en el botón como un **punto de 8 px al costado de la
letra**. Con la forma pintada del color de la pieza, el punto decía lo mismo dos veces y se fue. De él
se heredó el **borde** de las celdas de la miniatura, y lo que **no** se heredó es su color fijo: el
punto vivía con `slate-400` porque tenía que verse sobre los dos fondos del botón, y la miniatura
resuelve eso invirtiendo el borde con el estado — que es la parte que se quedó en el código, con sus
números de contraste.

### El transporte antes de ser un botón (`TransportPanel.tsx`)

Antes del spec 008 el transporte eran **dos controles**: un checkbox que decidía si sonaba y un botón que
arrancaba el reloj, y ninguno de los dos mostraba si el reloj estaba corriendo. Los dos se fundieron en
un play/pausa con estado, y de ahí sale la regla que se quedó: el icono **es** el estado.

### Los dos bloques que se dejaron intactos, y por qué

- El docblock de `audio/types/scheduler.types.ts` sobre por qué la celda no cruza el borde de capa. Se
  lee como historia —«de las dos razones que había sobrevive una sola»— pero las dos mitades son
  restricciones de hoy: una es el override de eslint, y la otra explica por qué el número MIDI **sí**
  cruza. Y las dos salidas fáciles que descarta (duplicar `Cell`, aflojar el linter) siguen siendo las
  dos que alguien va a volver a proponer.
- El docblock de `components/route-source.ts` sobre por qué se guarda la tabla por offset y no la
  `Sequence` cruda. Nombra el spec 010 y el spec 014, pero cada párrafo justifica una línea de código
  que hoy tiene que ser así.

## 2026-08-20 — El segundo code review del 022: el barrido por oráculo tiene un punto ciego

El spec 022 barrió la documentación con un oráculo duro —AC9: que ningún archivo afirme «los seis
efectos» en presente— y lo cumplió: `grep` devuelve cero fuera de `specs/`. El segundo review encontró
igual **tres afirmaciones falsas** que el barrido no podía ver, y las tres por el mismo motivo: **no
contenían la frase del oráculo.**

- `overview.md:171` decía «Un único `useEffect` observa `[placed]`» — la MISMA afirmación que el spec sí
  actualizó en `audio.md:280` y en `conventions.md:221`, escrita con otras palabras.
- `troubleshooting.md:98` daba `@types/jest` por presente en el árbol para explicar por qué `globals`
  está desactivado, cuando el paso 3 lo había borrado — y el propio `tasks.md` del spec lo registraba al
  revés en su seguimiento.
- `troubleshooting.md:127` mostraba `setSequence(buildSequence(placed, regimen))`, que es el mismo
  snippet sin proyección que el primer review ya había arreglado en `audio.md`. Apareció recién al ir a
  arreglar los dos de arriba.

**La lección de método: un oráculo de `grep` mide la ejecución del barrido, no su cobertura.** Encuentra
todas las apariciones de la frase que nombra y ninguna del hecho que la frase describe. La sonda que sí
funciona es la inversa y cuesta un minuto: cuando se actualiza un párrafo, buscar su **gemelo** —el que
dice lo mismo en el otro registro— por el hecho y no por la redacción. Acá el hecho era «dónde vive el
efecto de reconciliación y qué observa», y estaba escrito en cinco lugares con cinco redacciones.

El corolario para escribir el próximo spec: **el oráculo se elige después de contar los lugares, no
antes.** AC9 midió cuatro y nombró cuatro; los otros tres nunca entraron a la lista, así que el AC podía
darse por cumplido con el trabajo a medias y sin que nada fallara.

## 2026-08-20 — Los nombres de archivo del 022 estaban en castellano, y era el único lugar del repo

**El 022 estrenó una convención que no existía, sin decirlo.** En el commit base había **57 archivos
en `src/` y cero con nombre en castellano**; los siete que agregó el spec fueron los primeros:
`motor.ts`, `use-motor.ts`, `use-entrada.ts`, `PanelDeOrientacion.tsx`, `PanelDeTransporte.tsx`,
`types/motor.types.ts` y `__tests__/motor.test.ts`.

El caso peor era `motor.ts`: es el puente con `audio/engine.ts`, o sea que la misma cosa quedó
nombrada de dos formas en dos idiomas, que es peor que cualquiera de las dos por separado.

**Pero el código sí tenía castellano antes, y eso es lo que hace que la decisión no sea simétrica.**
Medido sobre el mismo commit: **21 identificadores exportados** en castellano, y **los 21 en
`components/`** — `abreTapLimpio`, `accionDeTecla`, `accionDeClick`, `esLaPiezaEnLaMano`,
`frenaElDefault`, `rotacionPorRueda`, `reflejaElContextMenu`, `Accion`/`ACCION`,
`Edicion`/`EDICION`, `EventoDeTecla`, `EventoDeModificador` en `input.ts`; `rutaActiva`, `encolar`,
`Marca`, `MarcaKind`, `Visita`, `CeldaPorEstrenar` en `route-source.ts` y `types/route.types.ts`; y
`MARCA` y `LC_EXCEPCIONES` en `constants/`. `domain/` y `audio/` son **100 % inglés**. O sea que
`proyectarAlMotor` y `useAtajosDeTeclado` sí tenían precedente local; los nombres de archivo no
tenían ninguno.

La regla de `CLAUDE.md` no decidía el empate: enumera **tres** cosas —comentarios, commits y specs—
y el código no está en la lista. No prohíbe identificadores en castellano ni los autoriza; lo único
que los autorizaba era `input.ts`.

**Por eso el renombre es de archivos y no de identificadores.** Así queda coherente con las dos
convenciones que el repo ya tenía —archivos en inglés siempre, identificadores en castellano dentro
de `components/`— en vez de coherente con ninguna:

| Antes | Ahora |
|---|---|
| `components/motor.ts` | `components/engine-bridge.ts` |
| `components/use-motor.ts` | `components/use-engine.ts` |
| `components/use-entrada.ts` | `components/use-input.ts` |
| `components/PanelDeOrientacion.tsx` | `components/OrientationPanel.tsx` |
| `components/PanelDeTransporte.tsx` | `components/TransportPanel.tsx` |
| `components/types/motor.types.ts` | `components/types/engine.types.ts` |
| `components/__tests__/motor.test.ts` | `components/__tests__/engine-bridge.test.ts` |

`types/panel.types.ts` no se toca: ya estaba en inglés. Los dos componentes sí cambian de nombre
además de archivo, porque el nombre del componente y el del `.tsx` son la misma decisión.

**El momento se eligió midiendo, no por prolijidad.** Los cuatro specs 018–021 están en `Propuesto`,
y entre sus `tasks.md` hay **31 tareas** que el 022 reescribió apuntando a estas rutas. Renombrar
antes de implementarlos cuesta un `sed`; después cuesta lo mismo más todo el código que se escriba
encima.

**Los cuatro archivos del spec 022 quedaron sin tocar, a propósito** (desviación 2 de
[README.md](./README.md)): un spec mergeado es un ADR y no se reescribe, así que sus rutas siguen
diciendo `motor.ts`. Lo que se mantiene al día es `docs/`, `.claude/rules/` y `CLAUDE.md` — y eso es
lo que este cambio actualizó, junto con los `tasks.md` de 018–021, que todavía no se implementaron.

Verificado: `pnpm verify` en verde (322 tests de `src/` + 85 del MCP server), **cero** referencias a
los nombres viejos fuera de `specs/022-*`, y el diagrama de cajas de `overview.md` y el árbol de
`directory-structure.md` re-alineados a mano — `engine-bridge.ts` mide siete columnas más que
`motor.ts` y les rompía el ancho fijo.

## 2026-08-20 — El spec 029: tres cosas salieron distinto, y las tres se descubrieron midiendo

### 1. El coverage no se puede medir sin decidir antes qué es el denominador

El primer número que salió —61,97 %— no era el primero que se midió. Sin `--coverage.all`, vitest
mide **sólo los archivos que algún test importó**, así que los diez que estaban en cero absoluto no
aparecían en la tabla: el número salía más lindo y no significaba nada. La lección es que un reporte
de coverage sin el denominador declarado responde una pregunta distinta de la que uno cree estar
haciendo. (Y en vitest 4 el flag `all` ya no existe: alcanza con declarar `include`, y el typecheck
rechaza el `all` que la 3 pedía.)

### 2. `App.tsx` no era el problema; el `.tsx` sí

La hipótesis al escribir el spec era que el hueco grande era UI y que la UI se cubre montando
componentes. Resultó ser más específico y más interesante: **tres archivos no podían llegar al 100 %
por una regla del repo**, no por una limitación del test. `react-refresh/only-export-components`
prohíbe que un `.tsx` exporte algo además del componente, así que el bucle de `Playhead` (100 líneas),
el de `Spectrum` (80) y sus guardas no se podían exportar y por lo tanto no se podían llamar. La
salida fue la misma que el 005 usó para el dominio y el 022 para la proyección al motor: sacarlos a un
`.ts` —`playhead-loop.ts` y `spectrum-loop.ts`— sin cambiar una línea de comportamiento.

O sea que el spec de coverage terminó siendo, en su parte más difícil, un spec de **dónde vive la
lógica**. Y eso no es un desvío: es el mismo mecanismo que hizo nacer `domain/`. Un archivo que no se
puede exportar es un archivo que no se puede verificar, y el coverage sólo lo hace visible.

### 3. El quinto nodo de `verify` rompía los presupuestos del 009, y la primera solución no alcanzaba

El spec preveía un nodo `coverage` al lado de `test`, y preveía **un** motivo para que fueran dos:
bajo instrumentación v8 los presupuestos de performance miden 11,3 ms contra un techo de 5, o sea que
medirían el instrumento. Eso se resolvió con `skipIf`.

Lo que el spec **no** preveía es el segundo motivo, que apareció corriendo `verify`: con cinco
procesos pesados en paralelo —dos de ellos vitest, uno con navegador— la contención de CPU sube la
mediana igual, y el presupuesto se caía en la pasada limpia. Es exactamente el modo de falla que el
comentario de AC8 en `sequence.test.ts` ya había documentado cuando subió su techo de 2 a 4: «un test
que se cae dos de cada tres veces en el nodo de convergencia no mide rendimiento, mide carga de la
máquina».

La salida fue encadenarlas en un solo script (`suite = test && coverage`), lo que deja **cuatro**
nodos concurrentes — la misma contención que había antes del spec — en vez de aflojar un techo. Medido
en tres corridas: 25,0 / 25,6 / 26,0 s, verde las tres. La forma que el spec declaraba (cinco nodos)
era la equivocada, y el AC2 quedó revisado por su propia verificación.

### 4. El pase de mutación encontró cuatro tests que estaban verdes con el código roto

Y ésta es la nota que más vale la pena guardar, porque contradice la intuición de que el 100 % de
coverage dice algo sobre la calidad de los tests. Con las cuatro métricas en 100, **cuatro de
dieciocho mutaciones sobrevivieron**: la caja fija de las miniaturas, el rearmado del velo, la
idempotencia de `startClock` y —aparentemente— el listener no pasivo.

El cuarto resultó ser un falso positivo con una lección propia: la cadena `{ passive: false }`
aparece **primero en un comentario** tres líneas más arriba, así que la mutación editaba el comentario
y no el código. **Un pase de mutación también hay que verificarlo**: un mutante que "sobrevive" puede
ser un mutante que nunca nació.

Los otros tres eran reales y compartían la misma forma de error: **el test afirmaba una consecuencia
que se cumplía por otro camino.** Los anchos de las miniaturas se comparaban entre sí, y con
`min-content` colapsan todos por igual. El velo se comprobaba con la cabeza todavía parada sobre la
celda, que la volvía a destapar sola. `startClock` se comprobaba con `clockRunning()`, que sigue
diciendo que sí porque lo que queda roto es un timer huérfano. En los tres casos el arreglo fue
afirmar la **causa** y no el síntoma.

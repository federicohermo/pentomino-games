# Log de Specs

Registro de todo el trabajo especificado, en orden. La convención de formato está en
[README.md](./README.md).

**Estados:** `Propuesto` (spec escrito, sin implementar) · `En curso` (rama abierta) ·
`Implementado` (mergeado) · `Descartado` (con el motivo anotado).

| Spec | Fecha | Estado | Descripción |
|------|-------|--------|-------------|
| [001](./001-notas-por-celda-en-orden-angular/spec.md) | 2026-08-02 | Descartado | Asignar cada nota a una celda de la pieza, en orden angular alrededor del centroide. **Absorbido por el [007](./007-nota-por-celda-y-lenguaje-visual/spec.md)**, que conserva su mapeo (D1 y D3) y revisa su desempate (D2) con una medición |
| [002](./002-motor-de-audio-propio-sobre-web-audio/spec.md) | 2026-08-02 | Implementado | Reemplazar Tone.js por un motor propio sobre Web Audio: síntesis, scheduler con lookahead y audio testeable |
| [003](./003-visualizacion-de-la-senal-con-analysernode/spec.md) | 2026-08-02 | Implementado | Visualizar la señal con `AnalyserNode`: espectro en canvas, con el mapeo bins→barras como función pura testeable |
| [004](./004-fase-por-pieza-la-columna-como-posicion-en-el-compas/spec.md) | 2026-08-02 | Implementado | La columna de la celda de agarre determina en qué momento del compás arranca la pieza: el tablero pasa a ser un secuenciador |
| [005](./005-modularizacion-de-src-en-capas/spec.md) | 2026-08-03 | Implementado | `src/` en capas (`domain` · `audio` · `components`) con dirección de dependencia verificada por el linter, carpetas por rol y los primeros tests del dominio. Sin cambio de comportamiento |
| [006](./006-mcp-server-de-dominio-ejecutable/spec.md) | 2026-08-03 | Implementado | MCP server que **ejecuta** el dominio en vez de indexar el código: forma, notas, simulación del scheduler e invariantes, en una llamada. Las tools importan de `src/`, no reimplementan |
| [007](./007-nota-por-celda-y-lenguaje-visual/spec.md) | 2026-08-16 | Propuesto | Cada celda es dueña de un grado de la escala, y el tablero lo muestra: color por pieza y nota por celda. Absorbe al 001. **Sin cambio de audio** |
| [008](./008-el-intervalo-como-unidad-musical/spec.md) | 2026-08-16 | Propuesto | El espaciado del arpegio deja de ser 0,15 s fijos y pasa a ser la semicorchea del tempo; `Job` pierde `spread`; el checkbox de loop y el botón de reloj se funden en un play/pausa con estado |
| [009](./009-el-tablero-como-recorrido/spec.md) | 2026-08-16 | Propuesto | El tablero deja de ser un compás y pasa a ser un circuito cerrado: el orden y los silencios salen de la geometría, `(0,0)` y `(9,5)` se repliegan, las celdas recorridas suenan. Muere `phaseFor` y **supera al 004** |

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
- **009 va a superar al 004.** La columna de la celda de agarre deja de ser la posición dentro del
  compás; el orden lo va a dar el recorrido entre piezas. El 004 no se reescribe —es historia— pero su
  estado pasa a `Superado` cuando el 009 se mergee, y con él se van `phaseFor`, sus tests, el campo
  `phase` de `Job` y la mitad de `simulate_board` que lo reporta.

## Deuda conocida

Lo que está registrado y todavía no tiene spec. Vivía en `CLAUDE.md`, que declaraba a este archivo como
única fuente y sostenía un segundo registro en paralelo.

- **`public/manifest.json` tiene los valores por defecto de CRA** (`"name": "Create React App
  Sample"`).
- **Las `@testing-library/*` siguen sin consumidor.** No hay tests de componentes, y montarlos va a
  requerir `jsdom` en su propio bloque de config, sin tocar el `environment: 'node'` global que
  necesita el audio.
- **No hay tests de UI**, así que los cinco componentes de `components/` se verifican a ojo.
- **`postcss` y `autoprefixer`** están en `devDependencies` sin ningún config que los use — Tailwind 4
  va por el plugin de Vite. Candidatos a borrar.
- **`@types/jest`** sigue en el árbol y es lo que impide usar `globals: true` en Vitest.
- **La rotación es un `number` sin acotar**, comparada contra `0|1|2|3` en cuatro lugares. El reemplazo
  ya está decidido —const-object en `constants/` + union type derivado en `types/`, **nunca un `enum`**,
  que el `erasableSyntaxOnly` del tsconfig rechaza— pero cambia firmas, así que quedó como seguimiento
  del spec 005.

Ya resueltos: los archivos huérfanos de las plantillas de CRA y Vite (`src/App.css`, `src/logo.svg`,
`src/assets/react.svg`, `public/vite.svg`, `src/setupTests.ts`) y la dependencia `web-vitals`, que
quedó sin consumidor cuando `reportWebVitals.ts` no se migró. También el anclaje de la fase a la
columna (spec 004, AC8), que no tenía test automático porque las puras no se podían exportar desde
`App.tsx`: hoy vive en `domain/board.ts` y lo cubre `domain/__tests__/board.test.ts`.

## Notas de revisión

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

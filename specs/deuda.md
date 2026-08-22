# Deuda conocida

Lo que está registrado y todavía no tiene spec. Cuando algo de acá se convierte en trabajo, sale de
esta lista y entra como fila en [log.md](./log.md).

> Vivía en `CLAUDE.md`, que declaraba a `log.md` como única fuente y sostenía un segundo registro en
> paralelo. Se mudó al log, y de ahí acá: el log había quedado con el registro, las dependencias, la
> deuda y las notas de revisión en un archivo de 422 líneas, y sólo la primera de esas cuatro cosas es
> un log.

- **~~`public/manifest.json` tiene los valores por defecto de CRA~~ (`"name": "Create React App
  Sample"`) — CERRADO por el spec 028.** Era un ítem y resultaron ocho: el manifest —que pasa a tener
  `name`/`short_name` propios y `theme_color`/`background_color` = `#f8fafc`— más los tres íconos de
  la plantilla de CRA —el logo de React—, reemplazados por `favicon.ico`, `icon-192.png` e
  `icon-512.png` dibujados con el lenguaje de `DESIGN.md`; las
  tres metas de `index.html` (`description`, `theme-color`, `apple-touch-icon`); y el `README.md`,
  que no estaba registrado acá y era el más visible de los ocho — 69 líneas de la plantilla de Vite
  que no nombraban el proyecto ni una vez.
- **~~No hay tests de UI~~ — CERRADO por el spec 029.** Los seis componentes, el shell y los dos
  hooks del 022 pasaron de cero a **100 % en las cuatro métricas**, en un Chromium de verdad por
  Playwright. El ítem había sobrevivido veintidós specs por un motivo bueno —la única infra evaluada
  era testing-library sobre jsdom, y jsdom no sirve acá: `Spectrum.tsx` necesita canvas 2D,
  `ResizeObserver`, `matchMedia` y `getBoundingClientRect`, y `audio/engine.ts` necesita
  `new AudioContext()` y `window.setInterval`—. Lo que faltaba no era voluntad sino el browser mode
  de Vitest.
  **Lo que el 029 deja escrito y no se cierra con él:** las mediciones que ahora revalida un test son
  las que estaban en los docblocks —el `z-10`, la caja fija de las miniaturas, los dos renglones
  reservados, el ancho de la grilla, el listener no pasivo—; lo que **no** hay es una verificación de
  que la app se vea BIEN, que es otra cosa y otro spec (snapshots visuales, explícitamente fuera de
  alcance).
- **`L` (`#29ABE2`) e `Y` (`#FF7BAC`) no llegan al piso de contraste con ningún color de texto**: Lc
  55,8 y 56,9 contra un piso de 60. Les falta contraste al `bg`, no al `fg`, así que ninguna elección
  de texto las arregla y subirlas exige mover el color de la lámina — o sea, es una decisión de
  identidad visual y no un arreglo. Están en `LC_EXCEPCIONES` de `palette.constants.ts`, y
  `palette.test.ts` verifica que la excepción **siga haciendo falta**: si alguien retoca esos dos
  fondos, el test falla y obliga a sacarlas de la lista.
- **No hay deshacer.** Venía como la última oración del ítem del teclado —«tampoco hay deshacer»— y se
  queda cuando ese ítem se va con el spec 026, porque el 026 lo hace **más** necesario y no menos.
  Desde el spec 014 la única forma de quitar una pieza es clickearla en el tablero, y eso ya era una
  operación destructiva sin vuelta atrás; el 026 le agrega la segunda vía —una tecla sobre la celda
  enfocada— y con eso la vuelve alcanzable **sin querer**: hasta ahora había que apuntarle a la pieza,
  y ahora alcanza con que el foco esté en el tablero. Cinco celdas se van y el tablero no tiene forma
  de traerlas. El reset —que desde el spec 019 se llama `↺` y no «Reset», sin que eso cambie lo que
  hace ni le agregue una vuelta atrás— es el mismo agujero en grande, y también lo es el `submit` accidental que
  `.claude/rules/ui.md` evita pidiendo `type="button"` en todo `<button>`: los tres pierden el tablero
  entero y ninguno pregunta. Necesita spec propio — un historial de estados del tablero toca dónde vive
  `placed`, o sea el shell.
  **El 021 le suma una cara nueva, y es de alcanzabilidad y no de reversión**: con dos paneles `fixed`
  encima del tablero, el gesto destructivo puede quedar **debajo de uno de ellos**. Un `fixed` no
  participa del scroller del tablero, así que el `.focus()` que mueve el cursor de teclado puede
  llevarlo a una celda que nada destapa — el 026 hizo la operación alcanzable sin querer, y el 021 la
  puede volver invisible en el mismo movimiento.
- **La colocación no se repliega sobre la costura.** El *recorrido* sí —`(0,0)` y `(9,5)` son
  adyacentes desde el spec 009— pero una pieza no se puede colocar cruzando ese borde: `isValid`
  rechaza toda celda fuera de la grilla. O sea que el tablero es un cilindro para el circuito y un
  rectángulo para las piezas, y esa asimetría no está justificada por nada — es sólo lo que quedó.
  Necesita spec propio: cambia `cellsAt`, `isValid` y el fantasma, y hay que decidir qué muestra el
  tablero de una pieza partida en dos bordes. Venía del seguimiento del 009.
- **Los dos flotantes del spec 021 agrandan la deuda de accesibilidad del tablero, y en tres puntos.**
  Ninguno es «los paneles sólo se alcanzan con el mouse»: sus encabezados son `<button>` con
  `aria-expanded`, así que ésa sería falsa.
  1. **Once celdas dejan de ser alcanzables sin plegar un panel, y para el teclado es PEOR que para el
     mouse.** La premisa vieja de este ítem —«las celdas siguen sin recibir foco»— es falsa desde el
     026: la celda es un `role="gridcell"` con `tabIndex` roving, `aria-label` y anillo de foco. Lo que
     el 021 agrega no es «no llegan», es **«llegan y no se ven»**: el `.focus()` de `Board.tsx` mueve el
     foco a una celda que un panel `fixed` está tapando, y un `fixed` **no participa del scroller del
     tablero**, así que no hay `scrollIntoView` que la destape. El cursor de teclado queda invisible
     debajo del panel; el mouse al menos ve el panel que tapa.
  2. **El orden de tabulación deja de seguir al orden visual.** Dos paneles `position: fixed` se pintan
     donde el `fixed` los pone y se tabulan donde el DOM los tiene, y eso no lo arregla el
     `aria-controls`. Pesa más desde el 026, cuando el tablero pasó a ser una parada de tabulación de
     verdad.
  3. **La operación destructiva puede quedar debajo de un panel.** Ya no es «sólo de mouse» —el 026 le
     dio `Enter` y barra— pero sigue sin deshacer, y este spec le suma que el gesto puede caer tapado.
  Lo que lo achica sin cerrarlo es que plegar es **un click y un `Tab`**, y que plegado no queda ni una
  celda tapada — medido en el DOM. Necesita spec propio: la salida probablemente sea que el foco
  entrando a una celda tapada pliegue el panel que la tapa, y eso es una decisión de producto.
- **`Orientacion` y `PlacedPiece` repiten los mismos dos campos.** Los dos llevan `rotation` y `mirror`,
  y la tentación es compartir un tipo de `domain/`. No se hizo en el spec 020 y no es un olvido: son dos
  cosas distintas que coinciden de forma. `PlacedPiece` guarda **cómo se colocó** una pieza —un hecho del
  tablero, que no cambia porque después gires la que tenés en la mano— y `Orientacion` guarda una
  preferencia de quien toca sobre la pieza **por colocar**. Unificarlos es un refactor de `domain/` que
  cruza el borde de paquete hacia `mcp-server/`, con beneficio cero de comportamiento. Venía del
  seguimiento del 020.
- **La rotación es un `number` sin acotar EN `domain/`.** Era la deuda entera hasta el spec 020, que la
  **achicó y no la cerró**, así que conviene leer las dos mitades por separado.
  **Lo que se cerró:** la fuente. El 020 creó `ROTACION` en `components/constants/orientation.constants.ts`
  y el union `Rotacion` en `components/types/orientation.types.ts` —const-object + union derivado,
  **nunca un `enum`**, que el `erasableSyntaxOnly` del tsconfig rechaza—, y con él acotó
  `Orientacion.rotation` y los dos extremos de `rotacionPorRueda`. La rotación entra al modelo **desde**
  `Orientacion`, así que por esta vía `domain/` ya no puede recibir un valor fuera de `0..3`.
  **Lo que queda:** el tramo de `domain/` —`rotateN`, `arpeggioFor`, `PlacedPiece.rotation`—, que sigue
  tomando `number`. Ése es el que cruza el borde de paquete hacia `mcp-server/`, que importa 31 símbolos
  del dominio, así que acotarlo cambia firmas de las dos partes y necesita spec propio.
  La cuenta de «cuatro lugares» que este ítem traía desde el spec 005 ya iba por **siete**: el 013
  declaró el quinto, el 016 el sexto y el 019 el séptimo (`textoDeOrientacion(rotation, mirror)`, con
  `rotation: number` — su hogar terminó siendo `orientation.types.ts` y no ese módulo). De los siete, el
  020 acotó los de `components/`.
  **El spec 017 le dio su argumento más fuerte hasta ahora**: el régimen `orden` usa la rotación como
  índice de corrimiento del arpegio, no sólo como discriminante de una cadena de `if`. Ahí un valor
  fuera de `0..3` no cae a ningún `else`: `base[j + rot]` daría `undefined`, y `midiName` de eso no
  explota — devuelve `undefinedNaN` y lo pinta en la celda. La implementación lo tapó con un módulo
  (`music.ts`, comentado ahí), que es una red y no el arreglo: el arreglo es que el tipo no admita el
  valor. **Y la red tardó dos intentos en cerrar**, que es la mejor medida de por qué el tipo tiene que
  acotarse: el primer `%` a secas dejaba pasar la rotación negativa —el `%` de JS conserva el signo del
  dividendo, así que `base[-1]` volvía a ser `undefined`— y hoy va con el `+ largo` que la normaliza.
  Ese módulo además le cambia el comportamiento al caso fuera de rango entre los dos regímenes
  —`escala` cae a la fórmula mayor, `orden` corre `rot` módulo 5—, que es exactamente la clase de
  divergencia que el tipo acotado haría imposible de escribir.

Ya resueltos: los archivos huérfanos de las plantillas de CRA y Vite (`src/App.css`, `src/logo.svg`,
`src/assets/react.svg`, `public/vite.svg`, `src/setupTests.ts`) y la dependencia `web-vitals`, que
quedó sin consumidor cuando `reportWebVitals.ts` no se migró.

También las **siete `devDependencies` sin consumidor** —las cuatro `@testing-library/*`, `@types/jest`,
`postcss` y `autoprefixer`—, que el spec 022 borró en su propio commit. Con `@types/jest` fuera del
árbol, `globals: true` queda **disponible y sin ejercer** en Vitest: ejercerlo es sacarle el import a 16
archivos de test y no compra nada.

Y con ellas **AC10 del spec 008**, que era el ítem más viejo del registro: que el botón de transporte
refleje si el reloj *arrancó de verdad* y no si se lo apretó. Pedía «extraer el handler de `App.tsx` **o**
agregar testing-library», y se cerró por la primera de las dos vías que él mismo nombraba —
`alternarTransporte` en `components/engine-bridge.ts`, con el motor por parámetro, y un motor falso de una línea
(`corriendo: () => false`) para la rama en la que se pidió arrancar y no arrancó—. **Sin jsdom.** Vale
anotar la forma, porque es la que va a servir la próxima vez: el ítem pedía infra y lo cerró una firma.

También está resuelto el anclaje de la fase a la columna (spec 004, AC8), que no tenía test automático
porque las puras no se podían exportar desde `App.tsx`: hoy vive en `domain/board.ts` y lo cubre
`domain/__tests__/board.test.ts`.

Y la tarea de seguimiento que preveía que `occupantAt` devolviera **además** el índice de la celda
dentro de la pieza —anotada como «`cellOccupied` devuelve también el índice de celda dentro de la
pieza», con el nombre que la función tenía antes del 005, en
[`001/tasks.md:35`](./001-notas-por-celda-en-orden-angular/tasks.md)—: la cierra el 007 **sin cambiar la
firma**, con una pura hermana al lado (`occupantCellIndex`). Ensanchar el retorno le habría cambiado el
tipo a todos los llamadores que solo quieren saber qué pieza ocupa una celda, para servir a uno solo.

- **El Dijkstra del recorrido no entra en presupuesto en 4K.** Medido con el spec 031: en un tablero de
  53 × 30 —1.590 celdas, que es lo que da una pantalla de 3840 × 2160— `buildSequence` con 12 piezas
  tarda **30,9 ms**, seis veces el techo de 5 ms del AC10 del 009. En 1920 × 1080 (390 celdas) da 3,1 ms,
  así que no muerde en ninguna pantalla común. La salida está identificada y no probada: los pesos son
  sólo dos (1 y `CROSS_COST`), así que una **cola de baldes** baja la búsqueda lineal del mínimo de
  `O(N²)` a `O(N · C)`. `revisiones.md` registra que a `N = 60` esa cola se probó y salió **peor**
  (1,41 ms contra 0,68) — es exactamente el resultado que se da vuelta cuando `N` crece dos órdenes.

- **El dock de piezas mide en celdas y con la celda de 73 px muestra una sola columna.** Su caja es
  `calc(var(--cell) * 2)`, que con la celda del spec 021 daba entre 240 y 360 px y desde el 031 da
  siempre **146**. Ahí adentro `MINI_PISTA_PX` (58) entra dos veces por 1 px, así que la barra de
  scroll vertical tira la segunda columna y las doce miniaturas quedan en fila. Se arregla ensanchando
  el dock a tres o cuatro celdas —hay que remedir qué celdas del tablero tapa, que es lo que la medida
  en celdas existe para poder contestar— o bajando `MINI_PISTA_PX`. Es diseño del dock, no del tablero.

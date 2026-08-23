# Tasks — Spec 021

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — `--cell`, la única fuente del tamaño de celda

- [x] T001 `layout.constants.ts`: `CELL_PX` pasa a `CELL_PX_MIN = 73` (el **piso**, no el tamaño).
      **El 73 NO se lee de la medición del 019 ni de la del 020**, y hay que decirlo porque el número
      coincide y esa coincidencia invita a encadenarlos. El piso de este spec sale del **§3** del
      research: es la celda donde la nota vale los **19 px** que el repo midió con un `Range` como
      legibles, o sea una medición **tipográfica**. El 73 del 019 (su AC9, medido por su `T022`) y el
      del 020 (su AC15, remedido por su `T039` con el botón `0°` puesto) salen de dividir el interior
      de una tarjeta que **este spec borra** (T012, T016): son no-regresiones de un layout que deja de
      existir. Si cualquiera de las dos hubiera dado 72 o 74, el piso de acá seguiría siendo 73 y las
      dos proporciones de T003 —`19/73` y `13/73`— **no se mueven**: moverlas rompería AC4, que pide
      que a `CELL_PX = 73` la nota renderice a 19 px exactos. Lo dice el **§11** de este mismo research
      («que el 019 lo re-derive por geometría y le dé el mismo número es coincidencia aritmética, no
      dependencia»), y la versión anterior de esta tarea lo contradecía. La única cifra del 019 y del
      020 que este spec necesita es ninguna
- [x] T002 `layout.constants.ts` (`:1-68`): reescribir el docblock entero — se va la tabla de repartos
      de columnas, se queda la medición del `Range`, y entra **por qué el piso se movió de 60 a 73** al
      volverse proporcional la fuente — **AC15**. **El texto de partida NO es el de `main`**: el 019 ya
      reescribe este mismo docblock (su `T016` agrega una fila a la tabla de «quién manda», su `T017`
      rehace el párrafo del colchón, su `T033` el párrafo del techo útil y el bullet de `730,7 × 464`),
      y su propio `tasks.md:108-113` declara que este `T002` se lo lleva entero. Leer el docblock que
      el 019 deja y reescribir sobre ése: de las dos versiones lo único que sobrevive es la medición
      del `Range` —los 35,4 px de `D#5` a 19 px—, que es lo que el §3 del research re-lee
- [x] T003 `layout.constants.ts`: las dos proporciones tipográficas (`19/73 = 0,2603`,
      `13/73 = 0,1781`) como constantes, con los números que las originaron escritos al lado.
      **El 73 del denominador es el `CELL_PX_MIN` de T001 y no un literal de acá** — derivarlo del
      símbolo y no reescribirlo a mano, que es lo que evita el segundo lugar donde vive el mismo
      número. Lo que **no** hay que hacer es recalcularlas contra la medición del 019 o la del 020:
      esas dos miden un layout que este spec borra, y el piso de acá es tipográfico (T001, research
      §3 y §11). Si alguna de las dos da 72, estas razones **siguen siendo** `19/73` y `13/73`
- [x] T004 Pura `cellPxPara(vw, vh)` en `src/components/cell-px.ts`, con la fórmula. Es lo único del
      spec testeable en `environment: 'node'` — **AC2**
- [x] T005 Test en `src/components/__tests__/cell-px.test.ts` con la tabla de viewports del research
      (ocho casos, incluidos los dos donde gana el piso) — **AC2**, **AC5**. **No lleva `[P]`**: la
      escribe contra la firma de T004, así que depende de ella. **Y la tabla tampoco es un literal
      independiente**: sus dos últimas filas (430×932 y 375×667) son las dos donde gana el piso, así
      que su valor esperado es el `CELL_PX_MIN` de T001 y no un `73` escrito a mano. Lo que **no** las
      mueve es la medición del 019 ni la del 020: el piso es tipográfico (T001), así que esas dos
      celdas valen 73 aunque el navegador de aquéllas hubiera dado otra cosa
- [x] T054 `src/App.tsx`: `ref` propio sobre el **contenedor raíz** (el que el paso 3 deja a `100dvh`)
      para colgar ahí `--cell`. **No es `boardRef`**: la custom property hereda hacia abajo y los dos
      flotantes de T017/T018 son `fixed` fuera de `Board`, así que colgada de `boardRef`
      (hoy `Board.tsx:294`, no `:193`: el 026 reescribió el archivo entero y lo corrió 101 líneas) el
      `calc(var(--cell) * n)` de T045 no resuelve en ninguno de los dos. Es el **contenedor raíz** y no
      una celda: las 60 celdas van `key={i}` y **sin refs ni `data-*`** (`.claude/rules/ui.md:43-47`),
      y esta tarea no toca esa regla. `boardRef` queda como está, para los listeners del 013 —
      **AC8**, **AC9**
- [x] T006 **El efecto NO va en `App.tsx`**, y esto corrige lo que este spec decía. Desde el 022 el
      shell **no declara un solo `useEffect`** —`.claude/rules/ui.md:15-16`, `CLAUDE.md:136-138`,
      `docs/architecture/overview.md:22`, `:74` y `:180`—, y hoy el archivo ni siquiera lo importa
      (`App.tsx:1`: `useMemo, useState, useRef, useCallback`). Un listener de `resize` es exactamente
      el caso que `.claude/rules/ui.md:206-209` ya resuelve: **«el listener global vive en un hook de
      `components/`, en un efecto propio»**, con el `ref` creado en el shell — el precedente literal es
      `useRuedaRota` de `use-input.ts` recibiendo `boardRef`. Va entonces un hook nuevo
      `src/components/use-cell-px.ts` que recibe `raizRef`, llama a `cellPxPara` y escribe
      `raiz.style.setProperty('--cell', px + 'px')`. **Con la unidad**: un `--cell` sin `px` deja
      inválidos a todos los `calc(var(--cell) * n)` y la grilla colapsa sin un solo error. **Sin
      debounce**, con el motivo escrito. **Sin estado de React para `cellPx`**: guardarlo en `useState`
      re-renderiza las 60 celdas por evento de resize, que es el re-render que la custom property
      existe para evitar (§1). Con el hook el cableado además es testeable con `renderHook` en el
      proyecto `browser` — ver T064, que el umbral 100 del 029 vuelve obligatorio
- [x] T043 `src/components/use-cell-px.ts` (no `App.tsx`, ver T006): la primera escritura de `--cell`
      va en `useLayoutEffect` y no en `useEffect`. Con `--cell` sin definir, `repeat(10, var(--cell))`
      es inválido y la grilla colapsa a una columna durante el primer cuadro. Como el efecto vive en un
      hook de `components/`, las cuatro afirmaciones de `docs/`, `CLAUDE.md` y `.claude/rules/` sobre el
      shell **siguen siendo ciertas**, y T049/T059/T060 pasan de reescribirlas a verificarlas
- [x] T007 `App.tsx`: `100dvh` (o `visualViewport.height` cuando existe) y no `100vh` — en iOS `100vh`
      incluye la barra del navegador y el tablero salta. El `vh` que entra a la fórmula de T004 y el
      alto del contenedor tienen que ser **el mismo número**: si uno mide `innerHeight` y el otro
      `100dvh`, la celda se calcula contra un alto que la caja no tiene y el tablero desborda por unos
      píxeles sin que nada falle
- [x] T008 Comentario en `use-cell-px.ts`: por qué `setProperty` sobre el ref y **no**
      `style={{ '--cell': … }}`, que pide un `as React.CSSProperties`
- [x] T064 `src/components/__tests__/use-cell-px.browser.test.tsx`: el **cableado** del hook, montado
      con `renderHook` como los dos hooks del 022. T005 cubre la pura y no toca el DOM; esto cubre lo
      otro, que es donde estarían los bugs: que `--cell` quede escrita **con unidad**, que se escriba
      antes del primer paint, que un `resize` la reescriba, y que la limpieza saque el listener
      (StrictMode monta dos veces). **No es opcional**: desde el 029 el umbral es **100 en las cuatro
      métricas** y no hay `/* v8 ignore */`, así que un hook sin test hace fallar `pnpm verify` (T028)

## Paso 2 — El tablero deriva todo de `--cell`

- [x] T009 `Board.tsx`: `gridTemplateColumns: repeat(10, var(--cell))` y la celda a `var(--cell)`.
      **El `gridTemplateColumns` ya no está en el contenedor**: el 026 metió filas de verdad
      (`role="row"`) y lo mudó a la fila (`Board.tsx:327`), así que se escribe una vez y se evalúa
      seis. La caja de la celda es el `const caja: CSSProperties = { width: CELL_PX, height: CELL_PX }`
      de `:412`, que es el mismo objeto donde el 026 cuelga el anillo de foco — ver T065. El `w-max`
      del contenedor (`:314`) **se queda**: es de lo que depende el `overflow-x-auto`
- [x] T010 `Board.tsx`: la nota a `calc(var(--cell) * 0.2603)` y el `#N` a `calc(var(--cell) * 0.1781)`
      — **AC3**. Hoy son el `text-[19px]` de la baldosa (`:522`) y el `text-[13px]` del `#N` (`:527`),
      los dos clases de Tailwind: pasan a estilo inline, que es lo que `.claude/rules/ui.md:86-87` ya
      manda para todo lo que salga de una constante
- [x] T011 `Board.tsx`: el aire entre baldosas, el redondeo y la posición del `#N` pasan a `calc()`
      con su proporción de hoy sobre 73. No es cosmética: de esas tres medidas depende que la baldosa
      «se lea como una ficha y no como un casillero» — **AC18**. Dónde están hoy, después del 026: el
      aire es el `p-0.5` de `:483` (la caja de afuera, no la baldosa) y el redondeo aparece **dos
      veces** —`rounded-lg` en `:483` y `rounded-lg` en `:522`—, porque el 026 repitió la forma en la
      caja externa para que el anillo de foco no salga cuadrado alrededor de una baldosa redondeada
      (su comentario, `:477-482`): se convierten las dos o el anillo deja de seguir el radio. La
      posición del `#N` es el `bottom-0.5 right-1.5` de `:527`. **Y del aire de `:483` cuelgan
      `ANILLO_FOCO_OSCURO` y `ANILLO_FOCO_CLARO`** — ver T065, que es trabajo nuevo traído por el 026
- [x] T065 `layout.constants.ts` + `Board.tsx`: **el anillo de foco del spec 026 es el sexto número
      fijo de la baldosa, y este spec lo rompe.** No estaba escrito acá porque el 026 se mergeó después
      de redactarse este spec. `ANILLO_FOCO_OSCURO` y `ANILLO_FOCO_CLARO` valen **2 px cada uno**
      (`layout.constants.ts:158-159`) y su docblock (`:118-157`) deriva los dos números **del aire de
      2 px de la baldosa**: «0 → 2 px banda OSCURA sobre el aire, o sea sobre el blanco del panel;
      2 → 4 px banda CLARA sobre el borde negro de la baldosa y el arranque de su color». Con T011 el
      aire pasa a `calc(var(--cell) * 0,0274)`, o sea **4,93 px a celda 180**: las dos bandas caen
      enteras adentro del aire blanco, la clara desaparece contra el panel y el anillo queda de un solo
      tono — que es exactamente el modo de falla que esos dos números existen para evitar, y que el
      docblock declara resuelto para los dos extremos de la lámina (`#FFFF00` de la `V` y `#0000FF` de
      la `W`). Los dos pasan a `calc()` con su razón sobre 73 (`2/73 = 0,0274`), incluido el
      `outlineOffset` negativo de `Board.tsx:416`, que es la suma de los dos; y el docblock se reescribe
      con el reparto dicho en proporciones y no en px — **AC21**
- [x] T012 `Board.tsx`: muere la tarjeta (`col-span-8 bg-white rounded-2xl shadow p-4`) y con ella la
      tabla de repartos del docblock — **AC1**
- [x] T013 `Board.tsx`: **conservar** el `overflow-x-auto` y su comentario — sigue siendo lo que evita
      que la grilla empuje scroll horizontal a la página cuando gana el piso — **AC5**
- [x] T053 `Board.tsx`: el `pb-2` de la baldosa (`:522`, con su comentario en `:511-519`) es el
      **cuarto** número fijo, y ese comentario lo declara portante («no es estética: es lo que deja
      crecer la nota»). Pasa a `calc()` con `8/73 = 0,1096` — **AC18**
- [x] T062 `Board.tsx`: el `border border-slate-900` de la baldosa (hoy `:522`, no `:292`) es el **quinto** número
      fijo y **se queda fijo a propósito** —es la única de las cinco que no se convierte—. Escribir el
      porqué al lado, porque sin eso el próximo que lea el archivo lo va a leer como un olvido de este
      spec: (a) un filete de 1 px es un **delimitador**, no un elemento tipográfico —`DESIGN.md:83` ya
      lo argumenta así, «el tablero se define reforzando la celda, no rellenando el fondo»— y crece a
      2,5 px a celda 180, donde 60 baldosas contorneadas dejan de leerse como fichas y pasan a leerse
      como una grilla dibujada; (b) un borde en `calc()` da píxeles fraccionarios que el navegador
      redondea distinto por arista, y sobre 60 celdas **adyacentes** eso se ve como un enrejado
      irregular — el artefacto más visible posible justo en el elemento que se repite 60 veces.
      No toca la alineación que T054/T055 cuidan: el borde se dibuja **adentro** de la caja de la
      baldosa — **AC20**. **El mismo argumento cubre por analogía otros filetes que este spec tampoco
      convierte, y hay que nombrarlos para que no se lean como olvidos**: el `border-2 border-dashed`
      de `VELO_TAPA` (`constants/playhead.constants.ts:84`) y los tres escalones de grosor de la cabeza
      (`NOTA` 3/2, `CRUCE` 2/1, `CLICK` 2/0, `:57-72`), fijados en `DESIGN.md:289-291`. Son **grados
      del mismo filete**: si el borde base se queda en 1 px, lo que lo engorda se queda también, o el
      escalón deja de medirse contra nada
- [ ] T063 [M] Navegador: al **techo** (celda 180, viewport 1920×1080) el filete de 1 px sigue
      separando las baldosas y no desaparece contra el fondo. Es lo que vuelve falsable a T062: la
      decisión de dejarlo fijo se apoya en que a 180 todavía se lee, y eso es exactamente lo que ningún
      cálculo contesta — **AC20**
- [x] T014 Los **seis** sitios que dependen del tamaño de celda pasan a `calc(var(--cell) * n)`.
      **No están todos en `Playhead.tsx` y ninguna de las líneas que este spec citaba existe**: el 029
      sacó el bucle a `playhead-loop.ts` para poder testearlo, y `Playhead.tsx` quedó en 108 líneas.
      `find_symbol CELL_PX` da **tres** consumidores, no dos. Los seis, hoy:
      - `playhead-loop.ts:72-75` — las cuatro escrituras de `rearmar`, que son las del **velo**
        (`left`, `top`, `width`, `height`)
      - `playhead-loop.ts:140` — el `transform: translate(…)` de la cabeza
      - `Playhead.tsx:100` — el `style={{ width: CELL_PX, height: CELL_PX, display: 'none' }}` del
        JSX, que es la caja propia de la cabeza: si queda en 73, el anillo marca un cuadrado de 73 px
        en el medio de una celda de 180

      Los cinco de `playhead-loop.ts` son escrituras de string y admiten `calc(var(--cell) * 3)` tal
      cual; el sexto es una prop de estilo de React. Convertidos, `playhead-loop.ts` deja de importar
      `CELL_PX` y su comentario de `:136-138` —«las coordenadas salen de `CELL_PX`, que es una
      constante»— pasa a ser falso: lo reescribe T015 — **AC6**, **AC17**
- [x] T044 `VELO_CAJA` (`'absolute p-[2px]'`) y el `rounded-lg` de `VELO_TAPA` repiten **a propósito**
      el aire y el redondeo de la baldosa de `Board.tsx`, y su docblock lo dice. **Ya no están en
      `Playhead.tsx:129-130`**: el 029 los mudó a `src/components/constants/playhead.constants.ts:83-84`,
      con su docblock en `:77-82`. Si T011/T053 los vuelven `calc()` allá y acá quedan literales, el
      velo deja de cubrir la baldosa exacta — que es lo único que esas dos constantes existen para
      garantizar. Y son **clases de Tailwind**, que no admiten interpolación
      (`.claude/rules/ui.md:86-87`): el aire y el radio del velo pasan a estilo inline escrito por
      `rearmar` (`playhead-loop.ts:71-79`), al lado de las cuatro escrituras de T014, y el docblock de
      las dos constantes tiene que decir qué quedó en la clase y qué se fue al estilo — **AC17**
- [x] T055 `Playhead.tsx`: el **segundo par**, el de la cabeza y no el del velo — el `p-0.5` de su
      caja (hoy `:99`, dentro del `className`) y el `rounded-lg` de su resalte (hoy `:104`), cuyo
      comentario al lado (hoy `:102-103`)
      dice «Misma caja que la baldosa de `Board.tsx` —2 px de aire y `rounded-lg`— para que el borde
      cubra la celda exacta y no medio pixel afuera». Con T011 en `calc()` y estos dos literales, a
      celda 180 el anillo de la cabeza cubre 2 px de aire sobre una baldosa que tiene 4,9 — **AC17**
- [x] T015 Docblock con por qué, y va **en los dos archivos**, porque el 029 partió el componente del
      bucle: en `Playhead.tsx` (`:6-64`), por qué la cabeza sigue fuera del estado de React (**AC7**) y
      sigue alineada al redimensionar (**AC6**) —las dos leen el mismo valor, resuelto por el
      navegador—; y en `playhead-loop.ts`, el reemplazo del comentario de `:136-138`, que hoy explica
      por qué las coordenadas van inline «porque salen de `CELL_PX`, que es una constante» y después de
      T014 ya no salen de ahí. La razón de fondo no cambia —Tailwind escanea el fuente— pero el sujeto sí

## Paso 3 — El layout de la página

- [x] T016 `App.tsx`: mueren el `min-h-screen … p-4` de `:323` y el `max-w-6xl mx-auto grid
      grid-cols-12 gap-4` de `:324`; el tablero centrado a pantalla, sin scroll vertical de página —
      **AC1**. **`bg-fondo text-slate-900` del raíz sobreviven**: el 028 hizo del `div` raíz uno de los
      cuatro lugares donde vive el color de fondo, y `src/__tests__/fondo-sincronizado.test.ts` existe
      para que no se desincronicen. Y el `<div aria-live="polite" className="sr-only">` de `:428` (spec
      026) **se queda**: es `sr-only`, así que no ocupa layout, pero tiene que seguir montado desde el
      primer render o el primer anuncio no se escucha (su comentario, `:412-427`)
- [x] T017 `PiecePalette.tsx`: de tarjeta en columna a dock `fixed` pegado al borde derecho, centrado
      en vertical — **AC8**. **La barrera de memoización del 027 no se toca y hay que dejarlo dicho**:
      `orientacion` es un `useMemo` de `App.tsx:313-320` y `OrientationPanel` está envuelto en `memo`
      (`OrientationPanel.tsx:31`), y las dos mitades son **una sola** barrera —«sin el `useMemo`, la
      prop tiene identidad nueva por render y la memo no cierra nunca», dice su docblock—, medida en
      4,9 ms → 1,9 ms por escritura de `hover` y fijada por `src/__tests__/App.browser.test.tsx:481`.
      Este spec cambia dónde se pinta `PiecePalette`, no quién consume qué: `orientacion` sigue
      bajando por la misma prop y `transporte` sigue inline. Lo único que podría romperla es partir el
      subárbol o rearmar el objeto adentro del dock — no hacerlo, y correr ese test.
      **Y con la tarjeta se van sus dos bloques de comentario**, igual que T012 se lleva la tabla de
      repartos de `Board.tsx`: (a) el comentario del `md:col-span-4` —«el reparto sale MEDIDO y no
      elegido… el interior de esta tarjeta pasa de 252 a 349,3 px»—, que sin `grid-cols-12` no tiene
      referente y que además se declara «la premisa de la tabla de columnas de `OrientationPanel.tsx`»,
      así que esa premisa queda colgada si no se toca; y (b) el docblock «## Por que este archivo se
      queda con cuatro filas», cuyo argumento entero es el `space-y-2` de una tarjeta en una columna.
      Los dos los acaba de reescribir el 019 (su `T035`, su `T011`) y el 020 le suma el comentario del
      `0°` (su `T017`): esto no es rehacer su trabajo, es **cambiarles el marco**. Anclar por texto y
      no por número de línea
- [x] T018 `App.tsx`: el espectro pasa a franja `fixed` abajo a la izquierda — **AC8**
- [x] T019 Comentario junto a las clases de posición de los dos: las posiciones salen de la medición y
      dejan libres `(0,0)` y `(9,5)`, que es donde el circuito cierra (009) y donde arranca la cabeza
      (010). Leyendo `fixed right-4 top-1/2` no se adivina — **AC9**
- [x] T045 Las cajas de los dos flotantes se miden **en celdas**, no en px: dock `2 × 4`, franja
      `3 × 1`, vía `calc(var(--cell) * n)`. Con px fijos, a 1366×768 el dock tapa `(9,5)` (§4 del
      research) — **AC9**
- [x] T046 `src/components/PiecePalette.tsx`: scroll interno propio. A `CELL_PX = 73` el dock queda en
      146 × 292 px y el panel mide hoy del orden de 349 × 496 (medición sobre `main`; el 019 y el 020
      la mueven, ver §4 del research) — sin scroll, crece y se come celdas — **AC19**
- [x] T073 `src/components/OrientationPanel.tsx`: **el scroll de T046 es vertical y el problema del
      dock también es de ancho.** La grilla de las doce miniaturas es hoy
      `grid-cols-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6` (`OrientationPanel.tsx:66`), o sea
      columnas atadas al **breakpoint del viewport** — y después de este spec el ancho del contenedor
      ya no lo da el viewport sino `calc(var(--cell) * 2)`. **Son dos variables distintas, y ahí AC19
      se cae**: a 1366 × 768 —el viewport con el que el §4 falsificó el dock de medidas fijas— el
      breakpoint es `xl`, o sea **seis columnas adentro de un dock de 256 px**; y al piso son tres
      columnas adentro de 146. La tabla de columnas pasa a derivar del **ancho real del contenedor**
      —`repeat(auto-fill, minmax(…, 1fr))`, que lo resuelve el navegador contra la caja y no contra la
      pantalla—, que es la misma decisión de una sola fuente del número que el §1 tomó para la grilla
      y T045 para las dos cajas flotantes. Medir el mini con `MINI_BOX × MINI_CELL_PX` (5 × 8 = 40 px)
      más el `px-2` del botón y su borde, y que el `minmax` salga de ahí y no de un número tipeado.
      **Esto es lo que el `T017` deja colgado y no cierra**: ahí se borra el comentario del
      `md:col-span-4` que se declara «la premisa de la tabla de columnas de `OrientationPanel.tsx`»,
      pero la tabla misma queda con la premisa vieja adentro. Falsable donde AC19 ya pide: al piso,
      146 × 292, sin desborde horizontal — **AC19**
- [x] T074 `src/components/TransportPanel.tsx`: **la fila de transporte tiene el mismo problema en el
      mismo eje.** El bloque de Tempo es un `flex items-center justify-between` con la etiqueta, el
      `<input type="range">` y un lector `tabular-nums w-16` (64 px clavados) — tres cosas en una
      fila, dimensionadas para la tarjeta de ~349 px que este spec borra, no para 146. Y abajo el
      `flex gap-2` de Play + Reset, que el 019 vuelve tres controles al mudarle el metrónomo (su
      `T011`). Al piso se apila en vez de repartirse: el slider a lo ancho con el lector debajo o al
      lado sin `w-16` fijo, y los botones envolviendo. **No se resuelve con el `overflow-y` de T046**
      —eso corta lo que sobra por abajo, no lo que sobra por el costado— ni con `overflow-x`, que es
      justamente el desborde que AC19 prohíbe. Es el archivo que el 019 y el 020 acaban de tocar, así
      que anclar por texto y no por número de línea — **AC19**
- [x] T066 `src/components/Spectrum.tsx`: **la franja de `3 × 1` celdas no entra, y AC19 sólo mide el
      dock.** A `CELL_PX = 73` la franja mide 219 × **73 px**, y adentro tienen que caber el
      `<h2>Señal</h2>` que T022 vuelve `<button>` (`text-lg font-semibold mb-2`, ~28 px + 8 de margen)
      **más** el `<div className="h-24 w-full">` de `Spectrum.tsx:26`, que son **96 px clavados**: 132
      contra 73. O el alto del canvas pasa a derivar de `--cell` como todo lo demás, o la franja deja
      de medir una celda de alto — y la segunda salida hay que recalcularla contra el §4, porque el
      `3 × 1` es lo que garantiza que la franja tape `(0,5)`…`(2,5)` y **no** `(9,5)`. La primera es la
      coherente con el resto del spec. Ojo con el orden: quien observa ese `div` es el
      `ResizeObserver` de `spectrum-loop.ts:118`, así que cambiarle el alto es justamente lo que T024
      verifica — **AC22**, **AC9**
- [x] T047 `src/App.tsx`: el `<footer>` con la leyenda de gestos (**hoy `:433-439`**, con su
      comentario en `:430-432`; ni `:446-455` ni `:303-309`, que son dos estados anteriores del
      archivo — el 025 y el 026 lo volvieron a correr y `App.tsx` está en 442 líneas) **se muda adentro de un flotante**, no se
      borra: es hoy el único lugar donde los cuatro gestos del 013 están escritos, y dejarlo debajo del
      tablero da scroll vertical de página — **AC1**, **AC16**
- [x] T020 `z-index` explícito por encima del tablero, y fondo semiopaco con `backdrop-blur`: abajo hay
      celdas con nota, y un panel opaco las esconde mientras uno translúcido dice que están ahí

## Paso 4 — Plegar y desplegar

- [x] T021 `App.tsx`: dos `useState<boolean>`, los dos en `true` — **AC10**
- [x] T022 El encabezado de cada panel es un `<button>` con `aria-expanded` y `aria-controls`. Si no,
      es un control que sólo existe para el mouse, y este spec ya agranda esa deuda
- [x] T023 Plegado deja **sólo** el encabezado, no un icono suelto: el panel sigue diciendo qué es
- [x] T072 **Plegar OCULTA, no desmonta**, y de eso dependen dos cosas medidas. (a) **AC11**: el
      `ResizeObserver` de `spectrum-loop.ts:118` redibuja porque su contenedor **cambia de tamaño**; si
      plegar desmonta el `<canvas>`, no hay observador que se dispare —se ejecuta la limpieza de
      `iniciarEspectro` y al desplegar se monta un loop nuevo—, así que la premisa de T024 y de AC11
      («sale casi gratis, sin tocar una línea») deja de valer. (b) La barrera del 027: desmontar y
      remontar `OrientationPanel` le cuesta las ejecuciones que el `memo` existe para ahorrar, y el
      test de `App.browser.test.tsx:481` cuenta ejecuciones. Con `hidden`/altura cero el árbol
      sobrevive al plegado y las dos siguen valiendo
- [ ] T024 [M] Verificar que el `ResizeObserver` redibuja al plegar y desplegar, **sin tocar su
      código**. Desde el 029 no vive en `Spectrum.tsx` —que quedó en 30 líneas— sino en
      `spectrum-loop.ts:118-119`, sobre `canvas.parentElement`; el contenedor observado es el
      `<div className="h-24 w-full">` de `Spectrum.tsx:26`, que es justamente el que T066 tiene que
      resolver — **AC11**. Lleva `[M]` porque es una comprobación de navegador y sin el
      marcador `spec_status` la reporta pendiente para siempre; se cierra junto con T036

## Paso 5 — Reescribir lo que dejó de ser cierto

- [x] T025 [P] `MINI_CELL_PX`: su docblock justifica el tamaño con «la paleta manda el alto de toda la
      fila». **Con el layout nuevo no hay fila** — el argumento entero desaparece y hay que
      reemplazarlo por el que corresponda al dock
- [x] T026 [P] `docs/guides/conventions.md:247-248`: las celdas ya no se dimensionan con
      `style={{ width: CELL_PX, … }}` sino con `var(--cell)`
- [x] T059 [P] `docs/architecture/overview.md`: **el archivo afirma en presente que el shell no tiene
      efectos, y son TRES lugares y no dos** — el diagrama, «el shell, sin un solo efecto» (`:22`); la
      prosa de «Qué vive dónde», «con **cero `useEffect`**» (`:74`); y **`:180`**, que este spec no
      tenía: «`App.tsx` no declara un solo `useEffect`». Con T006/T043 poniendo el efecto en
      `components/use-cell-px.ts` y no en el shell, **las tres siguen siendo ciertas** y la tarea es
      verificarlo y dejarlo dicho, no reescribirlas. Lo que sí cambia es la enumeración de hooks de
      `:71-73` y `:179-180`, que pasa de dos a tres. Sigue sin tocarse la tabla de estado de `App.tsx`
      (sección «2. Componente — estado y render», que arranca en `:114`, ni `:119-127` ni `:101-109`):
      ya venía corta antes de este spec —el 025 y el 026 le agregaron `focoEnTablero` y `anuncio` sin
      listarlos— y este spec agrega dos más (T021); es deuda previa, más vieja pero no de acá.
      **Y ese diagrama lo escribe también el 020, en la misma caja**: su `T036` cambia el renglón
      `:24` —`selected · rotation · mirror · tempo`— por la memoria por pieza. Son dos renglones
      distintos de un bloque de **ancho fijo**, y `Record<PieceKey, Orientacion>` es más largo que
      `rotation · mirror`: el borde derecho se re-alinea **acá**, con el renglón del 020 ya puesto,
      porque este spec mergea segundo. Es el mismo trabajo a mano que `specs/revisiones.md`
      (2026-08-20) documenta al renombrar `motor.ts` a `engine-bridge.ts`, siete columnas más ancho —
      y es el único archivo compartido del lote que el `log.md` no declaraba
- [x] T060 [P] `CLAUDE.md`: la línea 4 de «Arquitectura» está hoy en **`:136-138`** (no `:74-76`) y
      dice «el shell: estado, derivados, handlers y la composición. Desde el spec 022 **sin un solo
      `useEffect`**: los cuatro de reconciliación viven en `components/use-engine.ts` y los dos de
      entrada en `components/use-input.ts`». Con T006/T043 la frase **sigue siendo cierta**: la tarea
      es verificarlo y agregar el tercer hook —`use-cell-px.ts`, el que escribe `--cell` al medir el
      viewport— a la enumeración. **No** cambiarla por «con un `useEffect`», que es lo que este spec
      decía antes de que el efecto se mudara al hook
- [x] T048 [P] `DESIGN.md:79-83`: la tabla afirma en presente `CELL_PX` **73**, «Tablero **730 × 438
      px**», «Tarjeta del tablero **`md:col-span-8`**» y —las dos filas que faltaban en esta lista—
      «Aire de la baldosa **2 px** por lado» y «Borde de la baldosa **1 px**». Y `:99-102` (la baldosa
      con sus medidas fijas) y `:110-114` (el párrafo de debajo de `md`, que habla del «panel» y de los
      730 px fijos). Es el archivo que más queda mintiendo. **Y hay una quinta región que este spec no
      tenía, porque la escribió el 026**: `:237-242`, «Cada celda son dos: la de `CELL_PX` y la baldosa
      redondeada de adentro, **con 2 px de aire** entre las dos», que es de donde sale el anillo de
      foco de T065 — el mismo «2 px» en presente, dicho por tercera vez en el repo
- [x] T049 [P] `.claude/rules/ui.md`, **tres regiones del mismo archivo** —por eso van en una sola
      tarea y no en tres `[P]` que se pisarían—. Ninguna de las líneas que este spec citaba sigue
      donde estaba: el 025, el 026 y el 029 agregaron tres secciones y el archivo está en 251 líneas.
      1. **`:103-105`** (era `:66-68`, después `:84-86`), bajo «## El tablero se edita en el tablero»:
         «Los `col-span` no viven en `App.tsx`, sino en la tarjeta de cada componente» y «`CELL_PX` es
         un número **medido**… sale de `min(interior / 10, interior / 6)` sobre la tarjeta real, así
         que mover un `col-span` obliga a remedirlo en el DOM». Sin tarjetas (T012 mata la de
         `Board.tsx`; T017 vuelve la de `PiecePalette.tsx` un dock `fixed`) las dos reglas quedan sin
         referente y hay que reemplazarlas por la fórmula y `--cell`
      2. **`:178-185`**, sección «El foco se mueve por regiones» — **es del 026 y este spec no la
         tenía**: «Una celda son dos cajas —la de `CELL_PX` y la baldosa redondeada de adentro, **con
         2 px de aire**—». Ese «2 px» en presente es el mismo número que T011 vuelve proporcional y
         que T065 le propaga al anillo: pasa a decirse como razón, no como px
      3. **`:15-16`** (no `:9`): «Desde el spec 022 **no declara un solo `useEffect`**: los cuatro de
         reconciliación viven en `components/use-engine.ts` y los dos de entrada en
         `components/use-input.ts`». Con T006/T043 poniendo el efecto en un hook de `components/` y no
         en el shell, esta frase **sigue siendo cierta** y la tarea es **verificarlo**, no reescribirla
         — lo único que cambia es que ahora los hooks son tres: se agrega `use-cell-px.ts` a la
         enumeración. Tampoco tocar `:84-85`, que dice en pasado «la que le sacó al shell sus seis
         `useEffect` con el spec 022»
- [x] T027 [P] `specs/deuda.md`: anotar **en qué** este spec agranda la deuda de accesibilidad del
      tablero. **Los tres puntos de los Límites de Alcance están escritos contra el tablero de antes
      del 025 y del 026, que ya están en `main`, y con ellos puestos dos de los tres cambian de
      forma:**
      1. «Las celdas siguen sin recibir foco» **es falso desde el 026**: la celda es un
         `role="gridcell"` con `tabIndex` roving, `aria-label` y anillo de foco, y el tablero es un
         `role="grid"` con flechas, `Home` y `End`. Lo que este spec agranda ya no es «no llegan», es
         **«llegan y no se ven»**: `.focus()` sobre una celda tapada por un panel `fixed` **no la
         destapa** —un `fixed` no participa del scroller del tablero, así que no hay
         `scrollIntoView` que lo corra—, y el cursor de teclado puede quedar invisible debajo del
         `backdrop-blur` de T020. Es **peor** que para el mouse, que al menos ve el panel que tapa.
         Falsable: T070
      2. El orden de tabulación que deja de seguir al visual: **sigue valiendo tal cual**, y ahora
         pesa más, porque desde el 026 el tablero **es** una parada de tabulación real y no un hueco
      3. La operación destructiva sólo de mouse: **también cambió**. El 026 la hizo alcanzable con
         `Enter`/barra, y `specs/deuda.md` ya registra que eso **agravó** la falta de deshacer. Lo que
         este spec agrega es que además puede quedar debajo de un panel

      **No** escribir «dos paneles que sólo se alcanzan con el mouse»: T022 los hace `<button>` con
      `aria-expanded`, así que esa frase sería falsa. Y actualizar los Límites de Alcance de
      `spec.md` con estas tres, que es de donde el texto de `deuda.md` sale

## Verificación

- [x] T028 `pnpm verify` en verde
- [ ] T029 [M] **El criterio del spec**: redimensionar la ventana **con el transporte corriendo** y
      confirmar que la cabeza lectora sigue clavada en su celda — **AC6**, **AC7**
- [ ] T030 [M] Navegador: medir `CELL_PX` efectivo en cinco viewports y contrastarlo con la tabla del
      research — **AC2**
- [ ] T031 [M] Navegador: a `CELL_PX = 73` el tablero se ve **igual que hoy** (nota 19 px, `#N` 13 px)
      — **AC4**
- [ ] T032 [M] Navegador: colocar, quitar y mutear en celdas de los cuatro bordes, a celda 180 y a
      celda 73 — **AC12**
- [ ] T033 [M] Navegador: rueda, `Shift`, botón derecho, `Ctrl` y `Alt`+click sobre el tablero nuevo —
      **AC13**
- [ ] T034 [M] Navegador: la rueda no scrollea la página y `Ctrl`+rueda sigue haciendo zoom — **AC14**
- [ ] T035 [M] Navegador: `(0,0)` y `(9,5)` alcanzables con los dos paneles abiertos, en 1920×1080 y
      en 1366×768 — **AC9**
- [ ] T036 [M] Navegador: plegar y desplegar los dos; el espectro se redibuja — **AC10**, **AC11**
- [ ] T037 [M] Navegador: abajo de 730 px de viewport, el tablero scrollea horizontal y la celda queda
      en 73 — **AC5**
- [ ] T050 [M] Navegador: `document.documentElement.scrollHeight === innerHeight` en los cinco
      viewports de escritorio de la tabla, y los dos paneles **no empujan** la grilla — **AC1**, **AC8**
- [ ] T051 [M] Navegador: la leyenda de gestos sigue visible desde el tablero — **AC16**
- [ ] T052 [M] Navegador: a celda 180, el anillo de la cabeza y el velo cubren la baldosa exacta —
      **AC17**
- [ ] T056 [M] Navegador: a celda 180, leer `padding`, `border-radius` y `padding-bottom` computados de
      la baldosa y confirmar que divididos por `CELL_PX` dan las mismas razones que a 73 (±0,5 px).
      Es la contraparte de T011 y T053, que hasta ahora apuntaban a **AC3** y AC3 sólo habla de las dos
      fuentes — **AC18**
- [ ] T057 [M] Navegador: a `CELL_PX = 73` (dock de 146 × 292 px) las doce miniaturas y todos los
      controles de la paleta se alcanzan con el scroll interno, sin desbordar ni empujar la grilla —
      **AC19**
- [ ] T058 [M] Navegador: en un viewport apaisado y bajo (`vh < 438`, p. ej. 1280 × 400) el desborde
      vertical lo absorbe el contenedor del tablero y **no la página** — es la mitad de **AC5** que
      T037 no cubre, y la que sostiene **AC1** en ese viewport — **AC5**, **AC1**
- [x] T067 `src/components/__tests__/Board.browser.test.tsx`: **hay tests que afirman la geometría en
      px y este spec los rompe.** `:74-80` («cada una mide CELL_PX») y `:83-99` («la grilla mide 10 ×
      CELL_PX y NO le empuja scroll horizontal a la página») comparan `getBoundingClientRect()` contra
      `CELL_PX`, que después de T001 ya no existe con ese nombre ni con ese significado. Y `Board` se
      monta **solo**, sin el contenedor raíz de T054, así que `var(--cell)` no resuelve y la grilla
      colapsa a una columna: el test tiene que escribir `--cell` sobre el nodo que monta, que es la
      forma de que además verifique la herencia. `:424-429` (el anillo no agranda la región
      scrolleable) se conserva y se re-corre a celda 180, que es donde el anillo de T065 es más grande
- [x] T068 `src/components/__tests__/Playhead.browser.test.tsx`: mismo caso. `:86-95` compara
      `cabeza.style.transform` contra la cadena exacta `translate(${3 * CELL_PX}px, ${2 * CELL_PX}px)`
      y `:176-178` compara `tapas[0].style.left` y `.width` contra `${CELL_PX}px`. Después de T014 el
      valor escrito es un `calc(var(--cell) * n)`, así que el test pasa a leer el **computado**
      (`getComputedStyle`) con un `--cell` puesto por él: comparar la cadena literal volvería a atar el
      test a la sintaxis en vez de a la posición
- [x] T069 `src/__tests__/App.browser.test.tsx:139`: el caso se llama «monta las **tres tarjetas** y el
      pie con los gestos», y este spec deja cero tarjetas y muda el pie adentro de un flotante (T012,
      T016, T017, T018, T047). Reescribirlo contra lo que el layout nuevo promete —el tablero, los dos
      flotantes y la leyenda de gestos alcanzable— y **por rol y nombre, nunca por `className`**, que
      es lo que `.claude/rules/ui.md:139-142` manda
- [ ] T070 [M] Navegador, **el que el 026 vuelve necesario**: entrar al tablero con `Tab`, moverse con
      las flechas hasta `(9,2)` —una de las ocho que tapa el dock— y confirmar qué pasa. El `.focus()`
      de `Board.tsx:233` mueve el foco pero un panel `fixed` no participa del scroller, así que no hay
      nada que destape la celda: si el anillo queda debajo del panel, el cursor de teclado es invisible
      y eso es el punto 1 de T027 medido en vez de supuesto — **AC23**
- [ ] T071 [M] Navegador: a celda 180, con el foco en una celda sobre la pieza `V` (`#FFFF00`) y sobre
      la `W` (`#0000FF`), las dos bandas del anillo se siguen viendo — que es la promesa del docblock
      de `ANILLO_FOCO_*` y lo que T065 tiene que conservar. Es la contraparte falsable de T065, y el
      caso que sólo se ve al techo — **AC21**
- [x] T061 [P] `specs/016-la-pieza-se-ve-antes-de-colocarse/tasks.md`: declarar que este spec cierra su
      `T033`. Proponía «alinear la grilla arriba y dejar el sobrante abajo» si el aire muerto de la
      tarjeta del tablero quedaba feo, y acá **muere la tarjeta entera** (T012): no queda ni aire que
      alinear ni tarjeta donde hacerlo. Ya está marcada cerrada del lado del 016 —esto es la otra
      mitad—; cerrarla en un solo lado deja a `spec_status` reportando trabajo que ya no existe

## PR

- [x] T038 Rama `feature/021-el-tablero-es-la-pantalla`
- [x] T039 Actualizar la fila del 021 en `specs/log.md` a `Implementado`
- [x] T040 Anotar en `specs/revisiones.md` qué se aprendió — el piso que se movió de 60 a 73 al
      cambiar de régimen tipográfico es candidato

## Seguimiento (no bloquea)

- [ ] T041 El estado plegado no persiste: recargar abre los dos. Fuera de alcance a propósito
- [ ] T042 `requestFullscreen` del navegador queda sin hacer: el tablero llena el **viewport**, que es
      otra cosa
- [ ] T075 **`calc(var(--cell) * n)` se escribe en CINCO lugares y el argumento que lo permite quedó
      corto.** `playhead-loop.ts:23-33` justifica la duplicación con «son dos archivos que no se
      importan entre sí y el string es de una línea», y eso era cierto cuando eran dos. Hoy son tres
      copias de la pura `celdas` —`Board.tsx:26`, `Playhead.tsx:6`, `playhead-loop.ts:33`— más dos
      literales sueltos: `App.tsx:559` (la franja de Señal) y `PiecePalette.tsx:74` (el dock). No se
      unifica en este PR a propósito: el destino natural es un export de `components/cell-px.ts`, y
      eso toca cinco archivos de los que tres los toca también el resto del lote 018–021, así que el
      arreglo cuesta un conflicto de rebase por cada uno. Cuando el lote esté mergeado, mover `celdas`
      a `cell-px.ts` y hacer que los cinco lo importen — y borrar el párrafo de `playhead-loop.ts` que
      argumenta lo contrario

# Tasks — Spec 021

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — `--cell`, la única fuente del tamaño de celda

- [ ] T001 `layout.constants.ts`: `CELL_PX` pasa a `CELL_PX_MIN = 73` (el **piso**, no el tamaño)
- [ ] T002 `layout.constants.ts`: reescribir el docblock entero — se va la tabla de repartos de
      columnas, se queda la medición del `Range`, y entra **por qué el piso se movió de 60 a 73** al
      volverse proporcional la fuente — **AC15**
- [ ] T003 `layout.constants.ts`: las dos proporciones tipográficas (`19/73 = 0,2603`,
      `13/73 = 0,1781`) como constantes, con los números que las originaron escritos al lado
- [ ] T004 Pura `cellPxPara(vw, vh)` en `src/components/cell-px.ts`, con la fórmula. Es lo único del
      spec testeable en `environment: 'node'` — **AC2**
- [ ] T005 Test en `src/components/__tests__/cell-px.test.ts` con la tabla de viewports del research
      (ocho casos, incluidos los dos donde gana el piso) — **AC2**, **AC5**. **No lleva `[P]`**: la
      escribe contra la firma de T004, así que depende de ella
- [ ] T006 `src/App.tsx`: efecto de `resize` que llama a `cellPxPara` y escribe
      `boardRef.current.style.setProperty('--cell', …)`. **Sin debounce**, con el motivo escrito.
      **Sin estado de React para `cellPx`**: guardarlo en `useState` re-renderiza las 60 celdas por
      evento de resize, que es el re-render que la custom property existe para evitar (§1)
- [ ] T043 `src/App.tsx`: la primera escritura de `--cell` va en `useLayoutEffect` y no en
      `useEffect`. Con `--cell` sin definir, `repeat(10, var(--cell))` es inválido y la grilla colapsa
      a una columna durante el primer cuadro
- [ ] T007 `App.tsx`: `100dvh` (o `visualViewport.height` cuando existe) y no `100vh` — en iOS `100vh`
      incluye la barra del navegador y el tablero salta
- [ ] T008 Comentario: por qué `setProperty` sobre el ref y **no** `style={{ '--cell': … }}`, que pide
      un `as React.CSSProperties`

## Paso 2 — El tablero deriva todo de `--cell`

- [ ] T009 `Board.tsx`: `gridTemplateColumns: repeat(10, var(--cell))` y la celda a `var(--cell)`
- [ ] T010 `Board.tsx`: la nota a `calc(var(--cell) * 0.2603)` y el `#N` a `calc(var(--cell) * 0.1781)`
      — **AC3**
- [ ] T011 `Board.tsx`: el aire entre baldosas, el redondeo y la posición del `#N` pasan a `calc()`
      con su proporción de hoy sobre 73. No es cosmética: de esas tres medidas depende que la baldosa
      «se lea como una ficha y no como un casillero»
- [ ] T012 `Board.tsx`: muere la tarjeta (`col-span-8 bg-white rounded-2xl shadow p-4`) y con ella la
      tabla de repartos del docblock — **AC1**
- [ ] T013 `Board.tsx`: **conservar** el `overflow-x-auto` y su comentario — sigue siendo lo que evita
      que la grilla empuje scroll horizontal a la página cuando gana el piso — **AC5**
- [ ] T053 `Board.tsx`: el `pb-2` de la baldosa es el **cuarto** número fijo y su comentario lo
      declara portante («no es estética: es lo que deja crecer la nota»). Pasa a `calc()` con `8/73 =
      0,1096` — **AC3**
- [ ] T014 `Playhead.tsx`: los **seis** sitios que dependen del tamaño de celda pasan a
      `calc(var(--cell) * n)`. No son cuatro: las cuatro escrituras de `rearmar` (`:172-175`) son las
      del **velo**, y la cabeza usa además el `transform` (`:240`) **y el
      `style={{ width: CELL_PX, height: CELL_PX }}` del JSX (`:270`)**, que es su propia caja — si ese
      queda en 73, el anillo marca un cuadrado de 73 px en el medio de una celda de 180 —
      **AC6**, **AC17**
- [ ] T044 `Playhead.tsx`: `VELO_CAJA` (`p-[2px]`) y el `rounded-lg` de `VELO_TAPA` repiten **a
      propósito** el aire y el redondeo de la baldosa de `Board.tsx`. Si T011/T011b los vuelven
      `calc()` allá y acá quedan literales, el velo deja de cubrir la baldosa exacta — que es lo único
      que esas dos constantes existen para garantizar — **AC17**
- [ ] T015 `Playhead.tsx`: docblock con por qué. Es lo que deja que la cabeza siga fuera del estado de
      React (**AC7**) **y** siga alineada al redimensionar (**AC6**): las dos leen el mismo valor,
      resuelto por el navegador

## Paso 3 — El layout de la página

- [ ] T016 `App.tsx`: mueren `min-h-screen p-4` y `max-w-6xl mx-auto grid grid-cols-12 gap-4`; el
      tablero centrado a pantalla, sin scroll vertical de página — **AC1**
- [ ] T017 `PiecePalette.tsx`: de tarjeta en columna a dock `fixed` pegado al borde derecho, centrado
      en vertical — **AC8**
- [ ] T018 `App.tsx`: el espectro pasa a franja `fixed` abajo a la izquierda — **AC8**
- [ ] T019 Comentario junto a las clases de posición de los dos: las posiciones salen de la medición y
      dejan libres `(0,0)` y `(9,5)`, que es donde el circuito cierra (009) y donde arranca la cabeza
      (010). Leyendo `fixed right-4 top-1/2` no se adivina — **AC9**
- [ ] T045 Las cajas de los dos flotantes se miden **en celdas**, no en px: dock `2 × 4`, franja
      `3 × 1`, vía `calc(var(--cell) * n)`. Con px fijos, a 1366×768 el dock tapa `(9,5)` (§4 del
      research) — **AC9**
- [ ] T046 `src/components/PiecePalette.tsx`: scroll interno propio. A `CELL_PX = 73` el dock queda en
      146 × 292 px y el panel de hoy mide 349 × 496 — sin scroll, crece y se come celdas
- [ ] T047 `src/App.tsx`: el `<footer>` con la leyenda de gestos (`:446-455`) **se muda adentro de un
      flotante**, no se borra: es hoy el único lugar donde los cuatro gestos del 013 están escritos, y
      dejarlo debajo del tablero da scroll vertical de página — **AC1**, **AC16**
- [ ] T020 `z-index` explícito por encima del tablero, y fondo semiopaco con `backdrop-blur`: abajo hay
      celdas con nota, y un panel opaco las esconde mientras uno translúcido dice que están ahí

## Paso 4 — Plegar y desplegar

- [ ] T021 `App.tsx`: dos `useState<boolean>`, los dos en `true` — **AC10**
- [ ] T022 El encabezado de cada panel es un `<button>` con `aria-expanded` y `aria-controls`. Si no,
      es un control que sólo existe para el mouse, y este spec ya agranda esa deuda
- [ ] T023 Plegado deja **sólo** el encabezado, no un icono suelto: el panel sigue diciendo qué es
- [ ] T024 [M] Verificar que el `ResizeObserver` de `Spectrum.tsx` redibuja al plegar y desplegar,
      **sin tocar el archivo** — **AC11**. Lleva `[M]` porque es una comprobación de navegador y sin el
      marcador `spec_status` la reporta pendiente para siempre; se cierra junto con T036

## Paso 5 — Reescribir lo que dejó de ser cierto

- [ ] T025 [P] `MINI_CELL_PX`: su docblock justifica el tamaño con «la paleta manda el alto de toda la
      fila». **Con el layout nuevo no hay fila** — el argumento entero desaparece y hay que
      reemplazarlo por el que corresponda al dock
- [ ] T026 [P] `docs/guides/conventions.md:247-248`: las celdas ya no se dimensionan con
      `style={{ width: CELL_PX, … }}` sino con `var(--cell)`. **`docs/architecture/overview.md` sale de
      la lista**: se verificó y no tiene ninguna afirmación de `col-span`, `max-w-6xl` ni `CELL_PX`
- [ ] T048 [P] `DESIGN.md:79-81`: la tabla afirma en presente `CELL_PX` **73**, «Tablero **730 × 438
      px**» y «Tarjeta del tablero **`md:col-span-8`**». Y `:99-102` y `:112`, las medidas fijas de la
      baldosa. Es el archivo que más queda mintiendo
- [ ] T049 [P] `.claude/rules/ui.md:66-68`: «los `col-span` no viven en `App.tsx` sino en la tarjeta de
      cada componente» y «`CELL_PX` sale de `min(interior/10, interior/6)` sobre la tarjeta real». Sin
      tarjetas las dos reglas quedan sin referente
- [ ] T027 [P] `specs/deuda.md`: anotar que este spec **agranda** la deuda de accesibilidad del
      tablero — dos paneles plegables más que sólo se alcanzan con el mouse

## Verificación

- [ ] T028 `pnpm verify` en verde
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

## PR

- [ ] T038 Rama `feature/021-el-tablero-es-la-pantalla`
- [ ] T039 Actualizar la fila del 021 en `specs/log.md` a `Implementado`
- [ ] T040 Anotar en `specs/revisiones.md` qué se aprendió — el piso que se movió de 60 a 73 al
      cambiar de régimen tipográfico es candidato

## Seguimiento (no bloquea)

- [ ] T041 El estado plegado no persiste: recargar abre los dos. Fuera de alcance a propósito
- [ ] T042 `requestFullscreen` del navegador queda sin hacer: el tablero llena el **viewport**, que es
      otra cosa

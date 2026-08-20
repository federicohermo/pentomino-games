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
- [ ] T004 [P] Pura `cellPxPara(vw, vh)` en `components/`, con la fórmula. Es lo único del spec
      testeable en `environment: 'node'` — **AC2**
- [ ] T005 [P] Test de la pura con la tabla de viewports del research (ocho casos, incluidos los dos
      donde gana el piso) — **AC2**, **AC5**
- [ ] T006 `App.tsx`: estado `cellPx` + efecto de `resize` que escribe
      `boardRef.current.style.setProperty('--cell', …)`. **Sin debounce**, con el motivo escrito
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
- [ ] T014 `Playhead.tsx`: las cuatro escrituras de `style` y el `transform` de las marcas pasan a
      `calc(var(--cell) * n)` — **AC6**
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
- [ ] T020 `z-index` explícito por encima del tablero, y fondo semiopaco con `backdrop-blur`: abajo hay
      celdas con nota, y un panel opaco las esconde mientras uno translúcido dice que están ahí

## Paso 4 — Plegar y desplegar

- [ ] T021 `App.tsx`: dos `useState<boolean>`, los dos en `true` — **AC10**
- [ ] T022 El encabezado de cada panel es un `<button>` con `aria-expanded` y `aria-controls`. Si no,
      es un control que sólo existe para el mouse, y este spec ya agranda esa deuda
- [ ] T023 Plegado deja **sólo** el encabezado, no un icono suelto: el panel sigue diciendo qué es
- [ ] T024 Verificar que el `ResizeObserver` de `Spectrum.tsx` redibuja al plegar y desplegar, **sin
      tocar el archivo** — **AC11**

## Paso 5 — Reescribir lo que dejó de ser cierto

- [ ] T025 [P] `MINI_CELL_PX`: su docblock justifica el tamaño con «la paleta manda el alto de toda la
      fila». **Con el layout nuevo no hay fila** — el argumento entero desaparece y hay que
      reemplazarlo por el que corresponda al dock
- [ ] T026 [P] `docs/architecture/overview.md` y `docs/guides/conventions.md`: el layout de tres
      tarjetas
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

## PR

- [ ] T038 Rama `feature/021-el-tablero-es-la-pantalla`
- [ ] T039 Actualizar la fila del 021 en `specs/log.md` a `Implementado`
- [ ] T040 Anotar en `specs/revisiones.md` qué se aprendió — el piso que se movió de 60 a 73 al
      cambiar de régimen tipográfico es candidato

## Seguimiento (no bloquea)

- [ ] T041 El estado plegado no persiste: recargar abre los dos. Fuera de alcance a propósito
- [ ] T042 `requestFullscreen` del navegador queda sin hacer: el tablero llena el **viewport**, que es
      otra cosa

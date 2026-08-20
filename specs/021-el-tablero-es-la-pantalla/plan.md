# Plan — Spec 021

Cinco pasos. El paso 1 es el que sostiene todo lo demás: si `--cell` no existe, los pasos 2 y 3 se
convierten en dos copias del mismo número y AC6 deja de ser verificable.

## Paso 1 — `--cell`, la única fuente del tamaño de celda

`layout.constants.ts`:

- `CELL_PX = 73` deja de ser «el tamaño de la celda» y pasa a ser `CELL_PX_MIN`, el **piso**. El
  docblock se reescribe entero según §3 del research: se va la tabla de repartos de columnas, se queda
  la medición del `Range`, y entra el porqué el piso se movió de 60 a 73 al volverse proporcional la
  fuente.
- Las dos proporciones tipográficas como constantes, con los números que las originaron (`19/73` y
  `13/73`) escritos al lado — si alguien cambia una, tiene que saber contra qué se midió.

`App.tsx`:

- La fórmula `max(CELL_PX_MIN, min(vw/10, vh/6))` va como **pura** en `components/cell-px.ts`, no
  inline en el shell: es lo único de este spec que se puede testear en `environment: 'node'`, y la
  tabla de viewports del research es su tabla de casos.
- **Sin estado de React para `cellPx`.** Un `useState` re-renderiza `App` y con él las 60 celdas de
  `Board` por cada evento de resize, que es exactamente el re-render que la custom property existe
  para evitar. El número vive en `--cell` y en ningún otro lado.
- Un `useLayoutEffect` que escucha `resize` y escribe `--cell` sobre el **contenedor raíz de
  `App.tsx`** (un `ref` propio, no `boardRef`). **Sobre la raíz y no sobre el tablero**: la custom
  property hereda hacia abajo, y los dos flotantes del paso 3 son `fixed` y viven fuera de `Board`, o
  sea que colgándola de `boardRef` (`Board.tsx:193`) el `calc(var(--cell) * n)` de sus cajas no
  resuelve. La raíz es el ancestro común de la grilla, la cabeza lectora y los dos paneles.
  **Layout y no `useEffect`**: con `--cell` sin
  definir, `repeat(10, var(--cell))` es inválido y la grilla colapsa a una columna en el primer cuadro.
  **Sin debounce**, con el motivo escrito: la única escritura por evento es una custom property, el
  navegador ya coalesce por frame, y el debounce le mete latencia a un gesto continuo.
- `100dvh` y no `100vh`, o `visualViewport.height` cuando existe: en iOS `100vh` incluye la barra del
  navegador y el tablero salta al scrollear.

`--cell` se setea por `setProperty` sobre ese ref y **no** por `style={{ '--cell': … }}`, que necesita un
`as React.CSSProperties`. El repo prohíbe `any` y `@ts-ignore` porque tapan problemas de diseño, y un
cast que existe sólo para saltear el tipado es de la misma familia.

## Paso 2 — El tablero deriva todo de `--cell`

`Board.tsx`:

- `gridTemplateColumns: repeat(10, var(--cell))`, y la celda a `width/height: var(--cell)`.
- La nota a `calc(var(--cell) * 0.2603)` y el `#N` a `calc(var(--cell) * 0.1781)`.
- Los tres números del §8 del research —el aire entre baldosas, el redondeo, y la posición del `#N`—
  pasan a `calc()` con la proporción que tienen hoy sobre 73.
- Muere la tarjeta (`col-span-8 bg-white rounded-2xl shadow p-4`) y con ella la tabla de repartos del
  docblock.
- **El `overflow-x-auto` se queda**, y su comentario también: sigue siendo lo que evita que la grilla
  empuje scroll horizontal a la página cuando gana el piso.

`Playhead.tsx`: son **seis** sitios de `CELL_PX`, no cuatro. Las cuatro escrituras de `style` (`left`,
`top`, `width`, `height`, `:172-175`) son las del **velo**; la cabeza usa además el `transform`
(`:240`) y su propia caja en el JSX (`style={{ width: CELL_PX, height: CELL_PX }}`, `:270`). Los seis
pasan a `calc(var(--cell) * n)`. Y hay **cuatro más** que no nombran a `CELL_PX` pero repiten a
propósito el aire y el redondeo de la baldosa de `Board.tsx`, en dos pares: `VELO_CAJA` / `VELO_TAPA`
(`:129-130`) del velo, y el `p-0.5` de la caja de la cabeza (`:269`) con el `rounded-lg` de su resalte
(`:274`). Si allá pasan a `calc()` y acá no, ni el velo ni el anillo cubren la baldosa exacta.
Eso es todo el cambio del archivo, y es lo que hace que
AC6 y AC7 no se peleen: la cabeza deja de leer un número de JS y pasa a leer el mismo valor que la
grilla, resuelto por el navegador. El docblock tiene que decir por qué — es el punto entero del paso.

## Paso 3 — El layout de la página

`App.tsx`: mueren el `min-h-screen p-4` y el `max-w-6xl mx-auto grid grid-cols-12 gap-4`. Queda un
contenedor a pantalla que no scrollea vertical, con el tablero centrado y los dos paneles en
`position: fixed` sobre él.

- **Piezas**: dock pegado al borde derecho, centrado en vertical, de `2 × 4` celdas.
- **Señal**: franja abajo a la izquierda, de `3 × 1` celdas.

Las dos cajas se miden **en celdas** (`calc(var(--cell) * n)`) y no en px: con px fijos la cuenta del
§4 vale sólo a 1920×1080 y a 1366×768 el dock tapa `(9,5)`. A `CELL_PX = 73` el dock queda en
146 × 292 px contra los 349 × 496 de la paleta de hoy, así que el panel necesita scroll interno propio.

El `<footer>` con la leyenda de gestos **se muda adentro del dock de piezas**, no se borra: es hoy el
único lugar donde los cuatro gestos del 013 están escritos, y dejarlo debajo del tablero da el scroll
vertical de página que AC1 prohíbe.

Las posiciones salen de la medición (§4 del research) y no del gusto: son las que dejan libres `(0,0)` y
`(9,5)`, que es donde el circuito cierra y donde arranca la cabeza. Ese porqué va como comentario junto
a las clases de posición, porque leyendo `fixed right-4 top-1/2` nadie lo adivina.

`z-index` explícito y por encima del tablero, y `backdrop-blur` con fondo semiopaco: lo que hay abajo
son celdas con nota, y un panel opaco las esconde mientras que uno translúcido dice que están ahí.

## Paso 4 — Plegar y desplegar

Dos `useState<boolean>` en `App.tsx`, los dos en `true`. Cada panel recibe el suyo y el toggle; el
click va en el encabezado, que es superficie grande y ya existe (`<h2>Piezas</h2>`, `<h2>Señal</h2>`).

`aria-expanded` y `aria-controls` en el encabezado, y el encabezado como `<button>` — si no, es un
control que sólo existe para el mouse, y este spec ya agranda la deuda de accesibilidad lo suficiente.

Plegado deja **sólo** el encabezado, no un icono suelto: así el panel sigue diciendo qué es.

El espectro no necesita nada: su `ResizeObserver` ya se dispara al cambiar el tamaño del contenedor
(§6 del research), así que plegarlo y desplegarlo lo redibuja solo. Se verifica, no se implementa.

## Paso 5 — Reescribir lo que dejó de ser cierto

Tres bloques largos de documentación quedan mintiendo si no se tocan:

1. El docblock de `CELL_PX` — ya en el paso 1.
2. La tabla de repartos de `Board.tsx` — se va con la tarjeta.
3. El docblock de `MINI_CELL_PX`, que justifica el tamaño de las miniaturas con «la paleta manda el
   alto de toda la fila, así que inflarla no agranda el tablero». **Con el layout nuevo no hay fila**:
   el argumento entero desaparece y hay que reemplazarlo por el que corresponda al dock.

Y tres archivos que lo afirman en presente: `DESIGN.md` (la tabla de `:79-81` con `CELL_PX` 73, el
tablero de 730 × 438 y el `md:col-span-8`, más las medidas de la baldosa en `:99-102` y `:112`),
`.claude/rules/ui.md:66-68` (los `col-span` en la tarjeta de cada componente, y `CELL_PX` derivado de
la tarjeta real) y `docs/guides/conventions.md:247-248` (las celdas dimensionadas con
`style={{ width: CELL_PX, … }}`).

**`docs/architecture/overview.md` sí entra, aunque no por el layout**: no menciona `col-span` ni
`max-w-6xl`, pero afirma en presente «los seis efectos» (`:23`) y la tabla de estado de `App.tsx`
(`:101-109`), y este spec agrega un `useLayoutEffect` y dos `useState`. Lo mismo con la línea de
`CLAUDE.md` que describe `App.tsx` como «el shell: estado, derivados, handlers, los seis efectos y la
composición». Los dos son de los archivos que este repo mantiene al día, así que la corrección es
obligatoria y no opcional. Ver §9 del research.

## Verificación

`pnpm verify`, más el test de la pura de la fórmula con la tabla de viewports.

Lo que sólo se ve en el navegador va como `[M]`, y hay uno que es **el** criterio del spec: redimensionar
la ventana **con el transporte corriendo** y confirmar que la cabeza lectora sigue clavada en su celda.
Es donde se rompería la arquitectura vieja, y es lo que la custom property existe para hacer imposible.

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

- Estado `cellPx`, derivado del viewport con `max(CELL_PX_MIN, min(vw/10, vh/6))`. La fórmula va como
  **pura** en un módulo de `components/`, no inline en el shell: es lo único de este spec que se puede
  testear en `environment: 'node'`, y la tabla de viewports del research es su tabla de casos.
- Un efecto que escucha `resize` y escribe `boardRef.current.style.setProperty('--cell', …)`.
  **Sin debounce**, con el motivo escrito: la única escritura por evento es una custom property, el
  navegador ya coalesce por frame, y el debounce le mete latencia a un gesto continuo.
- `100dvh` y no `100vh`, o `visualViewport.height` cuando existe: en iOS `100vh` incluye la barra del
  navegador y el tablero salta al scrollear.

`--cell` se setea por `setProperty` sobre el ref y **no** por `style={{ '--cell': … }}`, que necesita un
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

`Playhead.tsx`: las cuatro escrituras de `style` (`left`, `top`, `width`, `height`) y el `transform` de
las marcas pasan a `calc(var(--cell) * n)`. **Ese es todo el cambio del archivo**, y es lo que hace que
AC6 y AC7 no se peleen: la cabeza deja de leer un número de JS y pasa a leer el mismo valor que la
grilla, resuelto por el navegador. El docblock tiene que decir por qué — es el punto entero del paso.

## Paso 3 — El layout de la página

`App.tsx`: mueren el `min-h-screen p-4` y el `max-w-6xl mx-auto grid grid-cols-12 gap-4`. Queda un
contenedor a pantalla que no scrollea vertical, con el tablero centrado y los dos paneles en
`position: fixed` sobre él.

- **Piezas**: dock pegado al borde derecho, centrado en vertical.
- **Señal**: franja abajo a la izquierda.

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

Y `docs/architecture/overview.md` y `docs/guides/conventions.md`, donde el layout de tres tarjetas está
descrito.

## Verificación

`pnpm verify`, más el test de la pura de la fórmula con la tabla de viewports.

Lo que sólo se ve en el navegador va como `[M]`, y hay uno que es **el** criterio del spec: redimensionar
la ventana **con el transporte corriendo** y confirmar que la cabeza lectora sigue clavada en su celda.
Es donde se rompería la arquitectura vieja, y es lo que la custom property existe para hacer imposible.

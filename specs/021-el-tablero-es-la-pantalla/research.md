# Research — Spec 021

Medido en el DOM sobre `main` con los specs 013–017 mergeados, y leyendo los cuatro componentes.

## 1. El hallazgo que decide la arquitectura: `CELL_PX` no lo lee sólo React

`grep` sobre `src/` da **dos** consumidores, y el segundo es el que complica todo:

| Consumidor | Cómo lo usa |
|---|---|
| `Board.tsx` | `gridTemplateColumns` y `style={{ width: CELL_PX, height: CELL_PX }}` — dentro del render |
| `Playhead.tsx` | `nodo.style.left = entrada.cell[0] * CELL_PX` — **fuera de React, en un `requestAnimationFrame`** |

**No son cuatro sitios, son seis, y los seis hay que convertirlos.** Las cuatro escrituras de
`style` de arriba (`Playhead.tsx:172-175`) son las del **velo**, no las de la cabeza; la cabeza usa
otras dos: el `transform` de `Playhead.tsx:240` y —el que se pasa por alto— el
`style={{ width: CELL_PX, height: CELL_PX }}` del JSX en `Playhead.tsx:270`, que es su propia caja.
Si ese ultimo queda en 73 mientras la grilla va a 180, el anillo de la cabeza marca un cuadrado de 73
px en el medio de una celda de 180.

Y hay dos constantes mas del mismo archivo que no mencionan a `CELL_PX` pero dependen de la baldosa:
`VELO_CAJA = 'absolute p-[2px]'` y el `rounded-lg` de `VELO_TAPA` (`Playhead.tsx:126-127`) **repiten a
proposito** el aire y el redondeo de la baldosa de `Board.tsx` —su comentario lo dice: «es la misma
caja, y poner los numeros a mano seria un segundo lugar donde mantenerlos»—. El §8 vuelve esos dos
numeros `calc()` **en `Board.tsx`**: si aca quedan literales, el velo deja de cubrir la baldosa exacta,
que es lo que esas dos constantes existen para garantizar.

`Playhead` existe justamente para dibujarse sin pasar por el estado (spec 010): lee de
`route-source.ts`, se posiciona imperativamente y no re-renderiza nada. Si `CELL_PX` pasa a ser estado
de React, la cabeza lectora se queda con el valor que tenía al montar y **se desalinea de la grilla en
cuanto alguien redimensiona la ventana** — que es justo el escenario que este spec crea.

Hay dos salidas y una es claramente mejor.

- **Una custom property de CSS.** El contenedor del tablero declara `--cell: 180px`, y **todo** lo
  demás se deriva en CSS: `grid-template-columns: repeat(10, var(--cell))`, el tamaño de cada celda, y
  la posición de la cabeza con `calc(var(--cell) * 9)`. Redimensionar actualiza una sola propiedad y
  el navegador reposiciona todo, incluida la cabeza, **sin una línea de JS y sin un re-render**.
  De paso, la tipografía proporcional sale gratis: `font-size: calc(var(--cell) * 0.2603)`.
- Pasarle el número vivo a `Playhead` por un ref o un singleton de módulo. Funciona, pero mete a la
  cabeza lectora en la cadena de actualización de la que el 010 la sacó a propósito, y deja dos
  fuentes del mismo número.

Se va por la custom property. Es lo que hace que AC6 y AC7 no se peleen.

**Corolario que el plan tiene que respetar: no hay estado de React para `cellPx`.** Si el numero se
guarda en un `useState`, cada evento de `resize` re-renderiza `App` y con el las 60 celdas de `Board`,
que es exactamente el re-render que este parrafo argumenta evitar. El efecto calcula y escribe la
custom property; nadie mas necesita el numero. La pura sigue existiendo y sigue siendo testeable —lo
que no existe es la copia en estado—.

**Y la primera escritura va antes del primer paint.** `--cell` sin definir hace que
`repeat(10, var(--cell))` sea invalido en tiempo de valor computado: la declaracion entera cae a
`none` y la grilla colapsa a una columna por un cuadro. Se resuelve con `useLayoutEffect` —corre antes
de pintar— o con un fallback en cada uso (`var(--cell, 73px)`). Se recomienda `useLayoutEffect`: deja
un solo lugar donde vive el piso.

**Cómo se setea sin cast**: `style={{ '--cell': …}}` no typechequea contra `React.CSSProperties`, y el
arreglo habitual es un `as`. Acá se hace con un efecto sobre el `ref` que ya existe
(`boardRef.current.style.setProperty('--cell', …)`), que está tipado y no pide cast. `boardRef` ya está
en `App.tsx` desde el 013.

## 2. La fórmula, medida sobre viewports reales

```
viewport      vw/10    vh/6    CELL_PX   nota      scroll-x
1920 × 1080   192,0   180,0     180,0    46,8 px
1512 ×  982   151,2   163,7     151,2    39,4 px
1440 ×  900   144,0   150,0     144,0    37,5 px
1366 ×  768   136,6   128,0     128,0    33,3 px
1280 ×  720   128,0   120,0     120,0    31,2 px
 834 × 1112    83,4   185,3      83,4    21,7 px
 430 ×  932    43,0   155,3      73,0    19,0 px    sí
 375 ×  667    37,5   111,2      73,0    19,0 px    sí
```

Manda el **alto** en escritorio apaisado y el **ancho** en tablet y celular, que es el cruce esperado
para un tablero de relación 10:6 = 1,67 contra pantallas de 1,78.

## 3. El piso: 60 era del régimen anterior

El docblock de `CELL_PX` mide el piso así:

> **60 es el PISO**, medido con un `Range` sobre el nodo de texto a la fuente que se renderiza: los
> nombres con sostenido ocupan **35,4 px a los 19 px** de `text-[19px]`. […] El piso sube con la
> fuente, y por eso este número hay que remedirlo cada vez que se toca `text-[…]`.

El propio docblock avisa de la trampa, y este spec la pisaría: **toca la fuente**. Re-medido:

```
D#5 a 19 px            35,4 px de ancho
baldosa a CELL_PX 73   69 px      → 16,8 px de aire por lado
ratio nota  19/73 = 0,2603
ratio #N    13/73 = 0,1781
```

Con la fuente proporcional, el texto **siempre** entra —crece y se achica con la baldosa— así que deja
de haber un piso *geométrico*. Lo que queda es un piso de **legibilidad**, y el número que el repo ya
midió para eso son los 19 px. La celda donde la nota vale 19 px es **73**.

Entonces el piso se mueve de 60 a 73, y no es un cambio de criterio sino la misma medición leída en el
régimen nuevo. Efecto secundario bueno: a `CELL_PX = 73` el tablero renderiza **idéntico** a hoy
(AC4), así que el spec no puede romper el aspecto en el caso base.

## 4. Qué tapan los flotantes — medido sobre la geometría de 1920 × 1080

Tablero de 1800 × 1080 (celda 180) centrado, o sea 60 px de margen a cada lado:

```
dock derecha  360 × 640, centrado en vertical
  tapa: (8,1) (9,1) (8,2) (9,2) (8,3) (9,3) (8,4) (9,4)      8 celdas

franja abajo-izquierda  600 × 110
  tapa: (0,5) (1,5) (2,5)                                    3 celdas

total 11 de 60        tapa (0,0): NO        tapa (9,5): NO
```

Las dos celdas de la costura (`SEAM = [[0,0],[9,5]]` en `domain/constants/board.constants.ts`) quedan
libres, que es el criterio que eligió las posiciones. Una barra superior a lo ancho tapa el borde de
arriba entero, `(0,0)` incluida — por eso se descartó.

Los 11 tapados no son inalcanzables: los dos paneles se pliegan.

### Los 360 × 640 fijos NO sobreviven a 1366 × 768 — remedido

La cuenta de arriba vale **solo** a 1920 × 1080, y AC9 dice «en ningún viewport de escritorio». Rehecha
con la misma aritmética a 1366 × 768, que es justamente el segundo viewport que T035 verifica:

```
CELL_PX = min(136,6 · 128,0) = 128        tablero 1280 × 768, margen (1366-1280)/2 = 43 px
columnas: x=7 → 939..1067   x=8 → 1067..1195   x=9 → 1195..1323
filas:    y=0 →   0..128    y=5 →  640..768

dock 360 × 640 pegado a la derecha y centrado en vertical
  ocupa x 1006..1366  → entra en la columna 7
  ocupa y   64..704   → entra en la fila 0 Y en la fila 5

  tapa (9,5): SÍ        tapa parte de (7,0)…(9,0): SÍ
```

O sea que **con medidas fijas AC9 se rompe en el viewport de escritorio más común**, y se rompe en la
única celda que el spec declaró intocable. El 640 y el 360 no son números: son proporciones del
tablero que se calcularon una vez a 1920.

**La geometría de los dos flotantes tiene que derivar de `--cell`**, que es la misma decisión que el §1
tomó para la grilla y por la misma razón —una sola fuente del número—:

```
dock piezas    ancho ≤ calc(var(--cell) * 2)     alto ≤ calc(var(--cell) * 4)   centrado en vertical
franja señal   ancho ≤ calc(var(--cell) * 3)     alto ≤ calc(var(--cell) * 1)   pegada abajo-izquierda
```

Con eso los 11 de 60 del §4 valen **en todo viewport**, no en uno: el dock cubre por construcción las
filas 1..4 de las columnas 8..9 y la franja la fila 5 de las columnas 0..2, que es lo que las tablas de
arriba dicen. Y a `CELL_PX = 73` el dock queda en 146 × 292, que es más chico que la paleta de hoy: el
panel necesita **scroll interno propio**, no crecer y comerse celdas. Eso es una restricción del paso 3,
no un detalle.

Los 11 tapados no son inalcanzables: los dos paneles se pliegan.

## 5. Lo que muere del layout de hoy

```
App.tsx           <div className="min-h-screen … p-4"> + <div className="max-w-6xl mx-auto grid grid-cols-12 gap-4">
PiecePalette.tsx  col-span-12 md:col-span-4 bg-white rounded-2xl shadow p-3
Board.tsx         col-span-12 md:col-span-8 bg-white rounded-2xl shadow p-4
App.tsx (señal)   col-span-12 bg-white rounded-2xl shadow p-3
```

Y con ellos, dos bloques largos de documentación que dejan de ser ciertos:

- La tabla de repartos de `Board.tsx` (`3/7`, `4/8`, `3/9`) — se va entera: no hay columnas que
  repartir.
- La tabla de «quién manda» de `CELL_PX` y el párrafo del colchón de alto — se van, y los reemplaza la
  fórmula con la tabla del §2. **La medición del piso se queda**, reescrita según el §3.

El `overflow-x-auto` del contenedor de la grilla **se queda**, y su comentario también: sigue siendo lo
que evita que la grilla empuje scroll horizontal a la página entera cuando el piso gana.

**Falta uno en la lista, y es el que rompe AC1:** el `<footer>` de `App.tsx:446-455`, la leyenda de
gestos que el spec 013 escribió. Con el tablero a `100dvh` y un footer debajo, la página scrollea
vertical — que es exactamente lo que AC1 prohíbe. No es un descuido cosmético: ese footer es hoy el
**único** lugar donde los cuatro gestos del 013 están escritos, así que borrarlo sin más deja los
atajos otra vez invisibles, que es el problema que su propio comentario dice haber resuelto. Tiene que
mudarse adentro de un flotante (el de piezas es el candidato: ya es el panel de controles) y no
desaparecer.

Y con el mismo criterio hay que mirar el **piso en vertical**: a `CELL_PX = 73` la grilla mide 438 px
de alto, así que en un viewport apaisado y bajo (`vh < 438`, p. ej. 1280 × 400) el tablero desborda
hacia abajo. El `overflow-x-auto` de Tailwind fija **solo** el eje X y el Y computa a `auto` —está
medido en el docblock de `Playhead.tsx`—, así que scrollea el contenedor del tablero y no la página:
AC1 se salva, pero AC5 hoy solo nombra el caso horizontal y hay que decir el otro.

## 6. Lo que ya está resuelto y no hay que inventar

- **El espectro ya observa su contenedor.** `Spectrum.tsx` monta un `ResizeObserver` sobre
  `canvas.parentElement` y recalcula el backing store con el `devicePixelRatio`, con un comentario que
  explica por qué no observa el canvas. Mudarlo a una franja flotante y plegarlo entran por esa puerta
  sin tocar una línea — AC11 sale casi gratis.
- **Los gestos ya cuelgan del nodo correcto.** El `wheel` no pasivo y el `contextmenu` enganchan en el
  `div` que envuelve la grilla, elegido a propósito porque «cubre exactamente el área del tablero».
  Ese div sobrevive; lo que cambia es su tarjeta.
- **La cabeza lectora ya vive dentro del contenedor que scrollea**, con `position: absolute` contra la
  caja de padding. Eso también sobrevive.

## 7. El resize: quién lo escucha

`Spectrum.tsx` ya usa `ResizeObserver`, así que hay precedente y no hace falta un `window.resize`.
Para el tablero conviene igual `window.resize` + `visualViewport`: lo que se mide es el **viewport**, no
un elemento. Un `ResizeObserver` sobre el contenedor sería circular — el contenedor mide lo que la
fórmula decide.

Hay que decidir si se hace `debounce`. Se recomienda **no**: la única escritura por evento es una
custom property, el navegador ya coalesce los eventos de resize por frame, y un debounce le agrega
latencia visible a un gesto continuo.

## 8. Los detalles de la baldosa que también escalan

Además de las dos fuentes, hay tres números en px fijos que a 180 px de celda se ven mal:

| Hoy | Qué es | A 180 |
|---|---|---|
| `p-0.5` (2 px) | el aire entre baldosas | queda como un pelo |
| `rounded-lg` (8 px) | el redondeo de la baldosa | queda casi recto |
| `bottom-0.5 right-1.5` | la posición del `#N` | queda pegado al borde |
| `pb-2` (8 px) | el alto que la baldosa le **reserva** al `#N` | la nota flota alta y la reserva no guarda proporción |

Los cuatro pasan a `calc(var(--cell) * …)` con la proporción que tienen hoy sobre 73. No es cosmética
opcional: el comentario de `Board.tsx` dice que la baldosa «se lee como una ficha y no como un
casillero», y eso depende de esas medidas.

El `pb-2` es el que casi se escapa, y es el más cargado de los cuatro: su comentario en `Board.tsx`
dice que **no es estética** sino «lo que deja crecer la nota» — la nota se centra en el alto que el
`#N` no usa, y los 19 px entran con 2,3 px de separación *medidos con esa reserva de 8 px*. Con las dos
fuentes proporcionales y el `pb` clavado, la relación que esos 2,3 px describen deja de valer para toda
celda que no sea 73. Proporción: `8 / 73 = 0,1096`.

## 9. Archivos afectados

| Archivo | Qué cambia |
|---|---|
| `src/App.tsx` | El layout entero; el estado de `CELL_PX` y de los dos plegados; el efecto de resize |
| `src/components/Board.tsx` | La tarjeta muere; la grilla y la celda pasan a `var(--cell)`; tres docblocks |
| `src/components/Playhead.tsx` | Las cuatro escrituras de `style` pasan a `calc(var(--cell) * n)` |
| `src/components/PiecePalette.tsx` | De tarjeta en columna a dock flotante plegable |
| `src/components/Spectrum.tsx` | Contenedor nuevo; el `ResizeObserver` no cambia |
| `src/components/constants/layout.constants.ts` | `CELL_PX` → piso + proporciones; docblock reescrito |
| `DESIGN.md` | Afirma en presente `CELL_PX` = 73, «Tablero **730 × 438 px**» y «Tarjeta del tablero **`md:col-span-8`**» (líneas 79-81), y la baldosa con sus medidas fijas (99-102, 112). Es la tabla que más queda mintiendo |
| `.claude/rules/ui.md` | Afirma en presente que «los `col-span` no viven en `App.tsx` sino en la tarjeta de cada componente» y que `CELL_PX` «sale de `min(interior/10, interior/6)` sobre la tarjeta real» (líneas 66-68). Sin tarjetas, las dos reglas quedan sin referente |
| `docs/guides/conventions.md` | Líneas 247-248: las celdas «se dimensionan con `style={{ width: CELL_PX, … }}`». Pasan a `var(--cell)` |

`docs/architecture/overview.md` **no** describe el layout de tarjetas —se verificó, no tiene ninguna
afirmación de `col-span`, `max-w-6xl` ni `CELL_PX`—: figuraba en el plan por analogía y no hay nada que
corregir ahí.

## 10. Riesgos

| Riesgo | Cuánto | Mitigación |
|---|---|---|
| La cabeza lectora se desalinea al redimensionar | **Alto — es el riesgo central** | La custom property lo hace estructuralmente imposible: dibujo y cabeza leen el mismo `var(--cell)`. AC6 lo verifica **con el transporte corriendo**, que es donde se rompería |
| El hit-testing usa un número y el dibujo otro | Alto si se hace con dos fuentes | Una sola fuente: el click sale de la celda que el navegador resolvió, no de una cuenta. AC12 |
| `--cell` seteada por `as React.CSSProperties` | Bajo, pero es un cast | Se setea por `ref.style.setProperty`, que está tipado. El repo prohíbe `any` y `@ts-ignore`, y un cast innecesario es de la misma familia |
| Los paneles tapan celdas | **Real, 11 de 60** | Medido en §4, ninguna de la costura, y los dos se pliegan |
| El spec agranda la deuda de accesibilidad | **Real** | Escrito en los límites de alcance. Dos paneles plegables más que sólo se alcanzan con el mouse |
| `100vh` en iOS incluye la barra del navegador y salta | Medio | `100dvh`, o `visualViewport.height` cuando existe |
| El debounce del resize agrega latencia | Bajo | No se hace debounce; se escribe por qué |
| Perder el aire de la tarjeta hace el tablero áspero | Medio | Los tres números del §8 escalan; tarea `[M]` que lo mira a ojo |

## 11. Orden dentro del lote

Va **último**. Toca los cuatro componentes, borra el layout sobre el que los otros tres trabajan, y
reescribe docblocks que el 019 acaba de tocar. Al revés, el 019 mediría un colchón de alto que este
spec hace desaparecer.

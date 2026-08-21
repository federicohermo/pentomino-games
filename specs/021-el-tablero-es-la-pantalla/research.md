# Research — Spec 021

Medido en el DOM sobre `main` con los specs 013–017 mergeados, y leyendo los cuatro componentes.

## 1. El hallazgo que decide la arquitectura: `CELL_PX` no lo lee sólo React

`find_symbol CELL_PX` da **tres** consumidores —eran dos cuando se escribió este research; el spec 029
sacó el bucle de la cabeza a su propio `.ts` para poder testearlo— y los dos últimos son los que
complican todo:

| Consumidor | Cómo lo usa |
|---|---|
| `Board.tsx` | el `gridTemplateColumns` de la **fila** (`:327`, lo mudó el 026 al meter `role="row"`) y `const caja = { width: CELL_PX, height: CELL_PX }` (`:412`) — dentro del render |
| `Playhead.tsx` | `style={{ width: CELL_PX, height: CELL_PX }}` (`:100`) — la caja propia de la cabeza, dentro del render |
| `playhead-loop.ts` | las cuatro escrituras del velo (`:72-75`) y el `transform` de la cabeza (`:140`) — **fuera de React, en un `requestAnimationFrame`** |

Y un cuarto que no importa `CELL_PX` pero depende de él: `constants/layout.constants.ts:158-159`, los
dos anchos del **anillo de foco** que agregó el 026, derivados del aire de 2 px de la baldosa. Ver §12.

**No son cuatro sitios, son seis, y los seis hay que convertirlos.** Las cuatro escrituras de
`style` de arriba (`Playhead.tsx:172-175`) son las del **velo**, no las de la cabeza; la cabeza usa
otras dos: el `transform` de `Playhead.tsx:240` y —el que se pasa por alto— el
`style={{ width: CELL_PX, height: CELL_PX }}` del JSX en `Playhead.tsx:270`, que es su propia caja.
Si ese ultimo queda en 73 mientras la grilla va a 180, el anillo de la cabeza marca un cuadrado de 73
px en el medio de una celda de 180.

Y hay **cuatro** lugares mas del mismo archivo que no mencionan a `CELL_PX` pero dependen de la
baldosa, en dos pares:

- **El velo.** `VELO_CAJA = 'absolute p-[2px]'` y el `rounded-lg` de `VELO_TAPA`
  (`Playhead.tsx:129-130`, con su docblock en `:123-128`) **repiten a proposito** el aire y el
  redondeo de la baldosa de `Board.tsx` —el docblock lo dice: «es la misma caja, y poner los numeros a
  mano seria un segundo lugar donde mantenerlos»—.
- **La cabeza, que casi se escapa.** Su propia caja lleva `p-0.5` en las clases del JSX
  (`Playhead.tsx:269`) y el resalte de adentro lleva `rounded-lg` (`Playhead.tsx:274`), con el mismo
  comentario al lado (`:272-273`): «Misma caja que la baldosa de `Board.tsx` —2 px de aire y
  `rounded-lg`— para que el borde cubra la celda exacta y no medio pixel afuera».

El §8 vuelve esos dos numeros `calc()` **en `Board.tsx`**: si aca quedan literales, ni el velo ni el
anillo de la cabeza cubren la baldosa exacta a ninguna celda que no sea 73 — que es lo unico que esos
cuatro lugares existen para garantizar. O sea que del archivo salen **seis** sitios de `CELL_PX` mas
**cuatro** de geometria de baldosa: diez conversiones, no seis.

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

**Y el efecto NO va en `App.tsx`.** Este research lo daba por sentado y hoy es una regla escrita: desde
el 022 el shell **no declara un solo `useEffect`** (`.claude/rules/ui.md:15-16`, `CLAUDE.md:136-138`,
`docs/architecture/overview.md:22`, `:74`, `:180`), y el caso exacto de un listener global ya tiene su
patrón en el mismo archivo de reglas (`:206-209`): «el listener global vive en un hook de
`components/`, en un efecto propio», con el `ref` creado en el shell. El precedente literal es
`useRuedaRota` de `use-input.ts` recibiendo `boardRef`. Va entonces a `components/use-cell-px.ts`, al
lado de la pura `cell-px.ts`. Beneficio que no es cosmético: un hook de `components/` se monta con
`renderHook` en el proyecto `browser`, así que el cableado tiene test — y desde el 029 eso no es
opcional, el umbral es 100 en las cuatro métricas y no hay `/* v8 ignore */`.

**Cómo se setea sin cast**: `style={{ '--cell': …}}` no typechequea contra `React.CSSProperties`, y el
arreglo habitual es un `as`. Se hace con un efecto sobre un `ref`
(`ref.current.style.setProperty('--cell', …)`), que está tipado y no pide cast. **Y el valor va con
unidad** (`'180px'`, no `'180'`): un `--cell` sin unidad deja inválidos a todos los
`calc(var(--cell) * n)` y la grilla colapsa a una columna sin un solo error en consola — el mismo modo
de falla que el `useLayoutEffect` de acá arriba viene a cerrar, por otra puerta.

**Sobre qué nodo, y NO sobre `boardRef`.** Una custom property **hereda hacia abajo del árbol**, y
`boardRef` cuelga del `div className="relative overflow-x-auto"` de adentro de `Board`
(hoy `Board.tsx:294`; el 026 reescribió el archivo entero y lo corrió 101 líneas). Los dos flotantes del §4 son `position: fixed` y viven en `App.tsx` **fuera** de
`Board`: no son descendientes de ese nodo, así que ahí `var(--cell)` no resuelve a nada y los
`calc(var(--cell) * n)` que el §4 exige para las dos cajas caen a inválido. `--cell` va sobre el
**contenedor raíz de `App.tsx`** —el mismo que el paso 3 deja a `100dvh`—, que es el ancestro común
del tablero, de la cabeza lectora y de los dos paneles. `boardRef` sigue existiendo para lo que el 013
lo creó (los listeners de entrada) y no se toca.

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

Los **349 × 496 px** de la paleta son la medición sobre `main` y **no valen contra la base real de
este spec**, que es `main` + 018 + 019 + 020: el 019 borra tres filas de controles de `PiecePalette` y
el 020 devuelve una. El número que importa igual no es ése —es el 146 × 292 del dock, que sale de
`--cell`—, así que el 349 × 496 queda sólo como orden de magnitud del recorte y la conclusión (hace
falta scroll interno) no depende de él.

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

**Falta uno en la lista, y es el que rompe AC1:** el único `<footer>` de `App.tsx` —el de
`className="text-center text-xs text-slate-500 pt-4"`, con el comentario que arranca «El footer
explicaba el modelo y no mencionaba un solo gesto»—, la leyenda de gestos que el spec 013 escribió.
Se ancla por texto y no por número de línea a propósito: sobre `main` va de `:443` a `:452`, pero el
018 y el 019 escriben más arriba en el mismo archivo y el rango se corre antes de que este spec se
implemente. Con el tablero a `100dvh` y un footer debajo, la página scrollea
vertical — que es exactamente lo que AC1 prohíbe. No es un descuido cosmético: ese footer es hoy el
**único** lugar donde están escritos los gestos —cuatro sobre `main`, y **cinco** si el 018 ya mergeó
su fila de las doce letras—, así que borrarlo sin más deja los
atajos otra vez invisibles, que es el problema que su propio comentario dice haber resuelto. Tiene que
mudarse adentro de un flotante (el de piezas es el candidato: ya es el panel de controles) y no
desaparecer.

Y con el mismo criterio hay que mirar el **piso en vertical**: a `CELL_PX = 73` la grilla mide 438 px
de alto, así que en un viewport apaisado y bajo (`vh < 438`, p. ej. 1280 × 400) el tablero desborda
hacia abajo. El `overflow-x-auto` de Tailwind fija **solo** el eje X y el Y computa a `auto` —está
medido en el docblock de `Playhead.tsx`—, así que scrollea el contenedor del tablero y no la página:
AC1 se salva, pero AC5 hoy solo nombra el caso horizontal y hay que decir el otro.

## 6. Lo que ya está resuelto y no hay que inventar

- **El espectro ya observa su contenedor.** Desde el 029 el `ResizeObserver` no está en
  `Spectrum.tsx` —que quedó en 30 líneas— sino en `spectrum-loop.ts:118-119`, sobre
  `canvas.parentElement`, y recalcula el backing store con el `devicePixelRatio`. Mudarlo a una franja
  flotante y plegarlo entran por esa puerta sin tocar una línea — AC11 sale casi gratis, **con una
  condición que no estaba escrita**: plegar tiene que **ocultar** y no desmontar. Un `ResizeObserver`
  se dispara cuando su nodo cambia de tamaño, no cuando desaparece; si el `<canvas>` se desmonta, lo
  que corre es la limpieza del loop y al desplegar arranca uno nuevo. T072.
- **Y hay una barrera de memoización medida que el layout no puede partir.** El 027 memoizó el objeto
  `orientacion` (`App.tsx:313-320`) contra el `memo` de `OrientationPanel`
  (`OrientationPanel.tsx:31`): son **una sola** barrera —sin el `useMemo` la prop tiene identidad nueva
  por render y la memo no cierra nunca— y vale 4,9 ms → 1,9 ms por escritura de `hover`, fijada por
  `src/__tests__/App.browser.test.tsx:481`. Este spec mueve **dónde se pinta** `PiecePalette`, no quién
  consume qué, así que la barrera sobrevive; lo que la rompería es partir el subárbol de la paleta o
  rearmar el objeto adentro del dock. `transporte` sigue inline, también por medición: nadie lo consume
  detrás de una barrera.
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

| `ANILLO_FOCO_OSCURO` / `_CLARO` (2 px + 2 px) | las dos bandas del anillo de foco del 026 | las dos caen adentro del aire de 4,93 px y la clara desaparece contra el blanco |

Los cinco pasan a `calc(var(--cell) * …)` con la proporción que tienen hoy sobre 73. La última fila la
agregó la revisión: el 026 entró a `main` después de escribirse este research. Ver §12. No es cosmética
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
| `src/components/Playhead.tsx` | **Un** sitio de `CELL_PX` (`:100`, la caja de la cabeza) y el par `p-0.5`/`rounded-lg` de `:99`/`:104` |
| `src/components/playhead-loop.ts` | Los **cinco** sitios restantes (`:72-75` el velo, `:140` el `transform`) y el comentario de `:136-138` |
| `src/components/constants/playhead.constants.ts` | `VELO_CAJA` y `VELO_TAPA` (`:83-84`): el aire y el radio del velo salen de la clase al estilo inline |
| `src/components/PiecePalette.tsx` | De tarjeta en columna a dock flotante plegable |
| `src/components/Spectrum.tsx` | Contenedor nuevo; el `ResizeObserver` no cambia |
| `src/components/constants/layout.constants.ts` | `CELL_PX` → piso + proporciones; docblock reescrito (`:1-68`) **y** los dos anchos del anillo de foco (`:118-159`) |
| `src/components/__tests__/Board.browser.test.tsx` | `:74-80` y `:83-99` afirman la geometría en px contra `CELL_PX` |
| `src/components/__tests__/Playhead.browser.test.tsx` | `:86-95` y `:176-178` comparan `style.transform` / `style.left` contra cadenas exactas de `CELL_PX` |
| `src/__tests__/App.browser.test.tsx` | `:139`, «monta las **tres tarjetas** y el pie con los gestos» |
| `DESIGN.md` | `:79-83` (la tabla: `CELL_PX` 73, «Tablero **730 × 438 px**», «Tarjeta del tablero **`md:col-span-8`**», «Aire **2 px**», «Borde **1 px**»), `:99-102` (la baldosa), `:110-114` (debajo de `md`) y **`:237-242`**, que es del 026 y repite el «2 px de aire» al derivar el anillo. Es el archivo que más queda mintiendo |
| `.claude/rules/ui.md` | **Tres** regiones: `:103-105` (los `col-span` en la tarjeta de cada componente y `CELL_PX` derivado de la tarjeta real), `:178-185` (del 026: «dos cajas… con 2 px de aire») y `:15-16` (el shell sin un solo `useEffect`, que **sigue siendo cierto** y sólo suma el tercer hook) |
| `docs/guides/conventions.md` | **`:345-346`** (no `:247-248`): las celdas «se dimensionan con `style={{ width: CELL_PX, … }}`». Pasan a `var(--cell)` |
| `docs/architecture/overview.md` | Los **tres** «sin efectos» (`:22`, `:74`, `:180`) y la tabla de estado (sección que arranca en `:114`) — ver abajo |
| `CLAUDE.md` | `:136-138`, la descripción de `App.tsx` — ver abajo |

`docs/architecture/overview.md` **no** describe el layout de tarjetas —se verificó, no tiene ninguna
afirmación de `col-span`, `max-w-6xl` ni `CELL_PX`—. Pero ése era el test equivocado, y el archivo
entra igual **por el otro lado**: afirma en presente el inventario del shell, y este spec lo cambia.

**Y el conteo de efectos cambió de signo desde que se escribió esto.** Aquel párrafo decía «`App.tsx`
tiene hoy seis `useEffect` (`:98`, `:99`, `:216`, `:247`, `:286`, `:340`), pasan a siete». Medido de
nuevo: **`App.tsx` tiene hoy CERO**, y ni siquiera importa `useEffect` (`:1`). El 022 los mudó a
`use-engine.ts` y `use-input.ts`, y con el efecto de este spec yendo a `use-cell-px.ts` por la misma
regla, las afirmaciones de los tres archivos **no cambian de valor de verdad**: la tarea pasa de
reescribirlas a verificarlas y sumar el tercer hook a la enumeración.

| Dónde | Qué afirma hoy | Qué le hace el 021 |
|---|---|---|
| `docs/architecture/overview.md:22`, `:74`, `:180` | «el shell, sin un solo efecto» · «cero `useEffect`» · «no declara un solo `useEffect`» | **nada**: el efecto vive en `components/use-cell-px.ts`. Se agrega el hook a la enumeración de `:71-73` y `:179-180` |
| `docs/architecture/overview.md`, sección «2. Componente — estado y render» (`:114`) | la tabla de estado de `App.tsx` | agrega los dos `useState<boolean>` del plegado |
| `CLAUDE.md:136-138` | «Desde el spec 022 **sin un solo `useEffect`**» | **nada**, más el tercer hook |

La tabla de `overview.md` ya venía corta —el 025 y el 026 le agregaron `focoEnTablero` y `anuncio` sin
listarlos— y eso es deuda previa que este spec no arrastra; lo que sí es de este spec son las dos filas
del plegado.

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
| Perder el aire de la tarjeta hace el tablero áspero | Medio | Los **cuatro** números del §8 escalan, con AC18 y T056 que los miden en el DOM en vez de mirarlos a ojo |
| `--cell` colgada del nodo equivocado | **Alto, y es silencioso** | Va sobre la raíz de `App.tsx` y no sobre `boardRef`: los dos flotantes son `fixed` y viven fuera de `Board`, así que colgada del tablero sus `calc()` no resuelven y las cajas caen a su tamaño de contenido — se ve como «los paneles quedaron raros», no como un error. §1 y T054 |
| El anillo de foco del 026 deja de verse al techo | **Alto, y silencioso** | Sexto número fijo, derivado del aire de 2 px que este spec vuelve proporcional. A celda 180 las dos bandas caen en el aire blanco y la clara desaparece sobre `#FFFF00`. §12, AC21, T065, T071 |
| El cursor de teclado del 026 queda debajo de un panel `fixed` | **Alto** | Un `fixed` no participa del scroller, así que `.focus()` no lo destapa. Es el punto 1 de los Límites de Alcance, medido por T070 |
| Los tests que ya existen afirman la geometría en px | **Alto, y rompe `verify`** | Tres archivos de test comparan contra `CELL_PX`. T067, T068, T069 |
| La franja de Señal no entra en su celda de alto | Medio | 132 px de contenido en 73 de caja al piso. AC22, T066 |
| El dock no entra a `CELL_PX = 73` | Medio | 146 × 292 px para doce miniaturas y los controles. Scroll interno propio (T046) y AC19, que lo verifica en el piso y no a 1920 |

## 12. Lo que trajo el 026, que ya está en `main`

El `log.md` decía «026 conviene antes que el 021: los dos reescriben `Board.tsx`, y lo que agrega el
026 es ortogonal a la medida y sobrevive». Está mergeado, y **casi** sobrevive: tres cosas de las
cuatro son ortogonales de verdad, y la cuarta no.

- **Filas de verdad (`role="row"`).** El `gridTemplateColumns` se mudó del contenedor a la fila
  (`Board.tsx:327`), así que la declaración se escribe una vez y se evalúa seis. No cambia la
  conversión, cambia dónde se escribe. Ortogonal.
- **`tabIndex` roving y `.focus()` imperativo.** El índice plano
  (`querySelectorAll('[role="gridcell"]')[dy * GRID_W + dx]`, `:233`) sigue valiendo con filas y con
  cualquier tamaño de celda: no toca píxeles. Ortogonal. Lo que **no** es ortogonal es su consecuencia
  de accesibilidad: el foco puede ir a parar debajo de un panel `fixed` y nada lo destapa. Ver los
  Límites de Alcance y T070.
- **El `closest('[role="grid"]')`.** Sobrevive: el layout no cambia la anidación.
- **El anillo de foco. Éste NO sobrevive.** `ANILLO_FOCO_OSCURO` y `ANILLO_FOCO_CLARO` valen 2 px cada
  uno y su docblock (`layout.constants.ts:118-157`) los **deriva del aire de 2 px de la baldosa**, con
  el reparto escrito en píxeles: `0 → 2 px` la banda oscura sobre el aire, `2 → 4 px` la clara sobre
  el borde negro y el arranque del color. Este spec vuelve el aire proporcional, así que a celda 180
  mide **4,93 px** y las dos bandas caen enteras adentro del aire blanco: la clara desaparece contra
  el panel y queda un anillo de un solo tono — que es exactamente lo que esos dos números existen para
  evitar sobre los dos extremos de la lámina. Es un **sexto** número fijo de la baldosa, y hay que
  convertirlo con el resto (`2/73 = 0,0274`, incluido el `outlineOffset` negativo de `Board.tsx:416`,
  que es la suma de los dos). AC21, T065 y T071.

Y una cosa que el 029 trajo y también manda: **lo que se agregue viene con su test**. Tres archivos de
test ya existentes afirman la geometría en píxeles contra `CELL_PX` —`Board.browser.test.tsx:74-99`,
`Playhead.browser.test.tsx:86-95` y `:176-178`, `App.browser.test.tsx:139`— y este spec los rompe a
los tres. Con el umbral en 100 y sin `/* v8 ignore */`, eso no es una nota al pie: es `pnpm verify` en
rojo. T067, T068 y T069.

## 11. Orden dentro del lote

Va **último**. Toca los cuatro componentes, borra el layout sobre el que los otros tres trabajan, y
reescribe docblocks que el 019 acaba de tocar. Al revés, el 019 mediría un colchón de alto que este
spec hace desaparecer.

**Y hay que decir qué pasa con esa medición del 019 cuando este spec entra.** El 019 borra tres filas
de controles, mide que eso se come exactamente los 26 px de aire muerto de la tarjeta del tablero, y
re-deriva que `CELL_PX` sobrevive en 73 porque el alto pasa a mandar por un décimo de píxel (73,0
contra 73,1). Ese cálculo entero **deja de aplicar acá**: este spec borra la tarjeta, el `max-w-6xl` y
la fila, así que no hay «interior de tarjeta» del que dividir ni colchón que gastar. No es una
contradicción a resolver — es la misma cadena leída en el régimen nuevo, igual que el piso del §3.

**Y el 73 de este spec no depende de esa cadena.** El `CELL_PX_MIN = 73` sale del §3, que es una
medición **tipográfica** (la celda donde la nota vale los 19 px que el repo midió como legibles), no
del reparto de columnas. Que el 019 lo re-derive por geometría y le dé el mismo número es coincidencia
aritmética, no dependencia: si el 019 hubiera dado 72 o 74, el piso de este spec seguiría siendo 73.

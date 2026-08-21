# Research 026 — El tablero se toca con el teclado

Medido sobre `main` en `052aedf`, y **re-verificado sobre `37abf53`** —el `main` de hoy, con el 029 y
el 030 mergeados—. Los cuatro anclajes que el 029 podia haber movido siguen exactos: `Board.tsx:266`,
`use-input.ts:62-63`, `input.ts:94-100` y el conteo de foco de la seccion 1.

## 1. El estado del foco, hoy

Búsqueda de `tabIndex`, `role=`, `focus` y `outline` en `src/**/*.tsx`:

```
src/components/Board.tsx:266:   `role`, sin `tabIndex` y sin nombre accesible, y un `title` sobre un
```

**Una sola línea, y es el comentario que documenta este hueco.** Cero atributos, cero estilos de foco en
todo el repo — incluidos los 22 botones, que hoy se ven enfocados sólo con el anillo por defecto del
navegador.

La celda, tal como la produce `Board.tsx`:

```tsx
<div key={i}
  onClick={(e) => onCellClick(x, y, e.altKey)}
  onMouseEnter={() => onCellEnter([x, y])}
  style={{ width: CELL_PX, height: CELL_PX }}
  className={`p-0.5 ${…}`}
  title={cell ? `(${x},${y}) · ${cell.note} · paso ${cell.step}` : `(${x},${y})`}
>
```

Y el propio archivo ya escribió el diagnóstico completo, incluido que el `title` **no** lo cubre:

> NO es accesibilidad: la celda es un `div` con `onClick` y sin `role`, sin `tabIndex` y sin nombre
> accesible, y un `title` sobre un elemento genérico que no recibe foco no lo anuncia ningún lector de
> pantalla — es un tooltip de mouse y nada más.

## 2. Lo que hay que reusar, y ya está en su lugar

El trabajo pesado está hecho por specs anteriores. Este spec es sobre todo cableado:

| Qué | Dónde | Reusable tal cual |
|---|---|---|
| Qué hace un gesto sobre una celda | `input.ts::accionDeClick` (pura, testeada) | **Sí** — el teclado la llama con los mismos argumentos |
| Si la celda es de la pieza en la mano | `input.ts::esLaPiezaEnLaMano` | Sí |
| El fantasma y su validez | `App.tsx`, derivado de `hover` | **Sí** — D2 |
| Nota, paso y ocupación de una celda | `cell-text.ts::cellTextFor` + `occupantAt` | Sí — el nombre accesible sale de acá |
| El texto que hoy va al `title` | `Board.tsx` | Sí — pasa a ser el nombre |

`hover` es la pieza clave. `App.tsx` la usa para tres cosas —fantasma, cursor y `hoverEdita`— y la
escribe un solo handler (`onCellEnter`). Que el teclado escriba **ese mismo estado** es lo que hace que
no haga falta ni una línea de dibujo nueva.

## 3. El choque de la barra espaciadora, leído en el código

`use-input.ts`:

```ts
const esControl = (t: EventTarget | null) =>
  t instanceof HTMLButtonElement || t instanceof HTMLInputElement;
```

y `input.ts`:

```ts
export function accionDeTecla(e: EventoDeTecla): Accion | null {
  if (e.targetEsControl) return null;
  …
  if (e.key === ' ') return e.tipo === 'keydown' ? ACCION.transporte : null;
```

Una celda enfocada es un `div`. **No** matchea ninguno de los dos `instanceof`, así que con el tablero
enfocado:

1. el handler de la celda coloca la pieza, y
2. el listener global de `window` alterna el transporte.

Un solo golpe de barra, dos acciones. Es exactamente el «doble disparo del espacio» que el 013 declara
haber resuelto —para el caso del botón enfocado— y que vuelve por una puerta que ese spec no podía
prever, porque el tablero no recibía foco.

### Por qué ensanchar `esControl` sería un bug

`targetEsControl` es la **primera** guarda de `accionDeTecla` y apaga las tres acciones. Si la celda
matcheara ahí, con el tablero enfocado se apagarían también `Shift` (rotar) y `Ctrl` (reflejar) — los
dos gestos que el 013 creó con el argumento de «no soltar el tablero».

O sea: ensanchar la guarda vieja **apaga tres atajos para arreglar uno**, y encima los apaga justo donde
más se usan. De ahí el campo nuevo de D4.

## 4. La estructura del DOM, y por qué cambia

`Board.tsx` hoy:

```tsx
<div className="grid w-max" style={{ gridTemplateColumns: `repeat(${GRID_W}, ${CELL_PX}px)` }}>
  {Array.from({ length: GRID_W * GRID_H }, (_, i) => { … })}
</div>
```

`GRID_W = 10`, `GRID_H = 6` (`domain/constants/board.constants.ts`) → **60 hijos planos**.

`role="grid"` exige hijos `role="row"`. Las dos salidas:

| | `display: contents` en filas ficticias | **Seis filas reales** |
|---|---|---|
| Cambia el DOM | Sí (nodos nuevos) | Sí (nodos nuevos) |
| Cambia el layout | No | **No** — sin `gap`, seis filas de diez a `CELL_PX` dan la misma caja |
| Riesgo | El nodo con `display: contents` ha desaparecido del árbol de accesibilidad en varios navegadores | Ninguno |
| Verificable | Pide inspeccionar el árbol de accesibilidad | Se ve en el DOM |

Se elige filas reales. `display: contents` sobre un elemento con rol es precisamente la clase de
tecnicismo que puede fallar **en silencio y sólo en un navegador**, que es lo que este spec viene a no
hacer.

Que el layout no cambia lo verifica el test que ya afirma «la grilla mide 10 × `CELL_PX` y el `body` no
gana scroll horizontal» (`Board.browser.test.tsx:73-95`). Lo trajo el **029**, no el 024.

Dos cosas que ese oráculo NO da gratis, y que son trabajo de este spec:

1. **El `gridTemplateColumns` se muda.** Hoy vive en el contenedor (`Board.tsx:197-198`:
   `className="grid w-max"` + `repeat(GRID_W, CELL_PX px)`) y sus hijos son las 60 celdas. Con filas,
   los hijos del contenedor pasan a ser seis, así que las diez columnas tienen que vivir **en la fila**
   y el contenedor queda como columna. Dejarlo donde está pone seis filas dentro de una grilla de diez
   columnas, que es exactamente el píxel que AC11 prohíbe mover.
2. **Los tres selectores estructurales se rompen.** `Board.browser.test.tsx:57` (`div.grid > div`),
   `:82` (`div.grid`) y `App.browser.test.tsx:55` y `:202` (`div.grid.w-max`) leen los hijos directos
   del contenedor: con filas devuelven **seis** en vez de sesenta, y si el contenedor pierde la clase
   `grid` el `querySelector(...)!` tira. O sea que esos tests **no confirman: fallan**, y actualizarlos
   es parte del paso — leerlos verdes recién después dice algo.

**`Playhead.tsx` no se entera.** Sus dos capas son `absolute` contra el contenedor `relative
overflow-x-auto` y se ubican con `transform: translate(x·CELL_PX, y·CELL_PX)`: aritmética de píxeles,
no colocación de grid. Verificado leyendo su `draw()`.

## 5. Los canales visuales, y cuál queda libre

La baldosa de adentro tiene todos sus canales tomados, cada uno con su spec y su medición:

| Canal | Quién | Origen |
|---|---|---|
| Fondo de color | Identidad de pieza | 007, medido con APCA contra Lc 60 |
| Blanco | Muteada | 014, «el canal que quedaba» |
| Rosa | Jugada inválida | 007 |
| `slate-300` | Fantasma | 007, «el fantasma es estado y el color es identidad» |
| `box-shadow` interior + exterior | Cabeza lectora, tres escalones (3/2, 2/1, 2/0) | 010 y 011, fijados en `DESIGN.md` |
| Opacidad + punteado | Velo de «no se estrenó» | 010 |

La caja **de afuera** —el `div` de `CELL_PX` con `p-0.5`— hoy pinta **cero**: sólo lleva `width`,
`height`, el padding y el cursor. Ahí va el foco.

Sobre la forma del anillo: tiene que verse sobre `#FFFF00` (la `V`) y sobre `#0000FF` (la `W`), así que
un solo color no alcanza. Un anillo de dos tonos —claro pegado al borde, oscuro afuera— es la forma
estándar y la única que funciona contra los dos extremos.

Y va con `outline`, no con `transform: scale`, por un motivo que el repo ya midió del otro lado:
`components/constants/playhead.constants.ts:40-48` —y `DESIGN.md:224-231`, que lo repite— documentan que
`scale` **agranda la región scrolleable** y hace aparecer las dos barras del `overflow-x-auto`. Medido
con `CELL_PX` en 63 y la cabeza en `(9,5)`: `scrollHeight` de 378 a 381. `outline` es ink overflow
—pinta afuera sin agrandar la caja— igual que el `box-shadow` que la cabeza lectora eligió por eso.

**El anillo son DOS propiedades, no una.** Un `outline` de CSS tiene un solo color, así que «claro por
dentro, oscuro por fuera» no sale de `outline` solo. La forma es `outline` para el tono claro pegado al
borde más `box-shadow` con spread para el oscuro de afuera, las dos sobre la **caja de afuera**. Y eso no
choca con nada: el `box-shadow` de la cabeza lectora lo escribe el loop sobre un **nodo propio**
(`playhead-loop.ts:141`, `resalteRef`) y lo único que la baldosa lleva es un `shadow-sm` de Tailwind —otro
elemento—, así que no hay una sola caja con dos `box-shadow` peleándose. Los dos anchos son los dos
números que van a `layout.constants.ts`.

## 6. El nombre accesible de la celda

El `title` de hoy es `(3,2) · D#5 · paso 3`, o `(3,2)` en una celda vacía. Le falta lo que el color dice
y el texto no: **qué pieza es y si está muteada**.

Propuesto, derivado de lo que ya existe (`occupantAt` + `cellTextFor`):

| Celda | Nombre accesible |
|---|---|
| Vacía | `(3,2), vacía` |
| Ocupada | `(3,2), F, D#5, paso 3` |
| Ocupada y muteada | `(3,2), F muteada, D#5, paso 3` |
| Con fantasma encima | El de arriba, sin cambio. El fantasma es transitorio y **no** entra al nombre: renombrar la celda bajo el cursor haría que el lector reanunciara la celda en cada movimiento del mouse. Y no hay dónde delegarlo: **`src/` no tiene un solo `aria-live` hoy** —sólo `aria-label` en `OrientationPanel.tsx:83` y `TransportPanel.tsx:53`— y el del 025 para lo que cambia solo está en su **Seguimiento** (`T027`), o sea que tampoco va a existir al implementarlo. Queda anotado como decisión, no como delegación |

Todo sale de puras ya testeadas. Lo único nuevo es el armado de la cadena, que —por la regla del repo—
va a un `.ts` de `components/` con su test, no adentro del `.tsx`. El precedente exacto es `cell-text.ts`,
que nació por esto mismo.

## 7. Archivos que toca

| Archivo | Qué cambia |
|---|---|
| `Board.tsx` | **Casi entero**: filas, roles, `tabIndex`, foco, teclado de la grilla, nombre accesible |
| `components/cell-name.ts` | **Nuevo** — el nombre accesible como pura, con test |
| `components/input.ts` | `accionDeTecla` y `frenaElDefault` miran `targetEsCelda` |
| `components/types/input.types.ts` | `EventoDeTecla` gana el campo |
| `components/use-input.ts` | El predicado del DOM para la celda |
| `App.tsx` | El cursor de teclado escribe `hover`; el `aria-live` |
| `components/constants/layout.constants.ts` | Los dos anchos del anillo |
| `__tests__/input.test.ts` | Los casos del campo nuevo |
| `src/__tests__/App.browser.test.tsx` | AC1, AC2, AC4, AC5, AC6 — y **arreglar sus selectores**: `:55` y `:202` buscan `div.grid.w-max > div` |
| `components/__tests__/Board.browser.test.tsx` | **Arreglar sus selectores**: `:57` (`div.grid > div`) y `:82` (`div.grid`) |
| `.claude/rules/ui.md`, `DESIGN.md`, `deuda.md` | Registro |

**Cero cambios en `domain/` y en `audio/`.** Este spec no toca una nota.

## 8. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Un roving tabindex mal hecho deja el tablero inalcanzable — **peor que hoy** | Media | AC1 y AC2 con test de navegador; el estado «qué celda tiene el 0» es uno solo y vive en el shell |
| La barra dispara dos acciones (§3) | **Alta si no se hace D4** | AC5 y AC6 son dos ACs distintos a propósito: uno verifica que se apagó y el otro que **no** se apagó de más |
| El anillo de foco se confunde con la cabeza lectora | Media | Canales distintos (D3): la cabeza vive en la baldosa de adentro y el foco en la caja de afuera |
| Las filas nuevas mueven un píxel | Baja | AC11, y el test de ancho de `Board.browser.test.tsx:73-95` —del **029**— lo ataja, con su selector arreglado |
| Cambia el orden del DOM y `Playhead` queda debajo | Baja | `Playhead` se monta antes que la grilla y lleva `z-10`; el test de `z-index` de `Playhead.browser.test.tsx:56-66` —del **029**— lo cubre |
| El `aria-live` habla de más | Media | `polite`, y sólo en las tres ediciones. Nada del recorrido ni de la cabeza |
| **`Alt`+`Espacio` no llega a la página**: en Windows es el menú de ventana del sistema, y este repo se desarrolla en Windows (`input.ts:27-28`) | **Alta** | Hay que medirlo antes de prometerlo. `Alt`+`Enter` no tiene ese problema; si la barra con `Alt` no llega, `Alt`+`Enter` queda como la única forma y la tabla de D5 lo dice |
| **El mouse y el teclado escriben el mismo `hover` y pueden discrepar**: `onMouseLeave` lo pone en `null` (`App.tsx:286`) aunque haya una celda enfocada, y ahí el fantasma se apaga contra AC3 | Media | Hay que decidir quién gana y escribirlo: el foco del DOM es el que manda mientras esté adentro del tablero |

## 9. Dependencias con otros specs

- **El 024 está `Superado` por el 029, y no es precondición de nadie.** Cinco de los trece ACs se verifican en
  navegador y dos de ellos —AC5 y AC6— son sobre eventos de teclado con foco, que en
  `environment: 'node'` no existen. Esa infra **ya existe**: el 029 construyó el segundo *project* de
  Vitest siguiendo el diseño del 024 (`vite.config.ts`, `src/components/__tests__/browser-setup.ts`,
  sufijo `*.browser.test.tsx`), y con ella entraron `App.browser.test.tsx` y `Board.browser.test.tsx`.
  O sea que **este spec no está bloqueado por nada del lote**, y los tests que la sección 4 usa como
  oráculo son del **029**, no del 024.
- **El umbral de coverage es 100 en las cuatro métricas** (029). Todo lo que este spec agregue —
  `cell-name.ts`, las ramas nuevas de `input.ts`, los handlers de `Board.tsx` y `App.tsx`— viene con su
  test o no mergea.
- **021 reescribe `Board.tsx`.** Es la colisión grande: mueve `CELL_PX` a una custom property de CSS y
  cambia el layout entero. Lo que este spec agrega —roles, filas, `tabIndex`, teclado— es **ortogonal a
  la medida** y sobrevive, pero el archivo se toca dos veces. Con el 026 primero, el 021 hereda una
  estructura con filas y tiene que respetarla; al revés, el 026 tendría que reescribirse sobre un
  layout nuevo. **Conviene el 026 antes.**
- **018 es complementario y no choca.** Elegir la pieza con su letra y tocar el tablero con flechas son
  las dos mitades de tocar sin mouse. El 018 usa letras; este spec, flechas, `Enter`, barra y `Alt`.
  Cero superposición en la tabla de teclas.
- **El 025 va PRIMERO, y en dos archivos compartidos.** Toca `.claude/rules/ui.md` y `DESIGN.md` antes
  que este spec, así que lo de acá se escribe **debajo** de lo suyo y no lo pisa (`T038`, `T039`). Su
  `radiogroup` quedó esperando el modelo de foco: fijado acá, el `T025` de su Seguimiento se cierra por
  su nombre. Y los dos canales **no compiten**: el 025 reclama el no visual —árbol de accesibilidad— y
  este spec la caja de afuera.
- **El 027 va PRIMERO y mide sólo la frecuencia del mouse.** Este spec le da a `hover` un segundo
  escritor con la misma frecuencia por pulsación, así que su medición de **337 elementos** describe la
  mitad del sistema una vez que este merge entra. Declarado de los dos lados (`T062`).

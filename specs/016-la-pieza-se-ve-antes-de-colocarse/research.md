# Research — Spec 016

Medido el 2026-08-19 sobre `main` en `c958dde`, en el navegador contra el dev server (viewport
1536 × 695), con un prototipo de la miniatura inyectado en el DOM.

> Las mediciones de layout se hacen con `style.gridColumn` y `style.gridTemplateColumns` **inline**,
> no reemplazando clases: Tailwind escanea el fuente, así que una clase que no está en ningún `.tsx`
> no existe como regla. Es la misma trampa que documentó el `research.md` del 014.

## 1. El botón de hoy

```
caja                   57,0 × 29,6 px
pistas de la grilla    57px 57px 57px 57px        (grid-cols-6 md:grid-cols-3 lg:grid-cols-4)
min-content por pieza  I 33,3 · L 36,2 · F 36,4 · Z 37,6 · Y 37,4 · X 37,9 · P 37,5
                       T 36,9 · V 38,3 · U 39,2 · N 40,1 · W 42,7
```

El `W` con 42,7 px es el peor caso, y es el número sobre el que `PiecePalette.tsx` argumenta su
esquema de columnas — con la cuenta hecha para la letra + el punto de color + `px-2` + borde.

**Todo ese razonamiento se recicla, no se hereda.** El contenido cambia entero: sale el punto, sale la
letra del centro, entra una caja de 5×5. Los anchos de min-content de arriba dejan de gobernar y el que
manda pasa a ser el ancho de la caja.

## 2. La caja de 5×5 es el mínimo que no reflowea

Bounding box de cada pieza en sus 8 orientaciones, sobre `SHAPES`:

| Pieza | Canónica | Rotada 90° |
|---|---|---|
| `I` | 5 × 1 | **1 × 5** |
| `L`, `N`, `Y` | 2 × 4 | 4 × 2 |
| `F`, `T`, `U`, `V`, `W`, `X`, `Z`, `P` | 3 × 3 o 3 × 2 | idem transpuesto |

El máximo en un eje es **5** (`I`) y el máximo simultáneo es 3 × 3. O sea que **5 × 5 contiene
cualquier pentominó en cualquier orientación** con margen, y es la caja más chica que lo hace: con 4×4
la `I` no entra.

Es lo que compra D1: la caja es constante, así que rotar no mueve un pixel de la grilla de botones. Con
cajas ajustadas al contenido, la `I` sola haría saltar la fila entera entre 5 y 1 celdas de ancho.

## 3. El prototipo, medido

Miniatura de 5×5 inyectada en los 12 botones, con la paleta ya en `col-span-4` (349,3 px de interior,
que es lo que le deja el spec 014) y el tablero en `col-span-8`:

| Columnas | Mini-celda | Botón | Grilla de botones | Paleta (caja) | Tablero interior | `CELL_PX` | Documento |
|---|---|---|---|---|---|---|---|
| — | — (hoy) | 57 × 29,6 | 104,8 | 461,6 | 730,7 × 429,6 | 71 | 698 |
| 4 | 6 px | 81 × 76 | — | 600 | 730,7 × 568 | **73** | 835 |
| 4 | 8 px | 81 × 86 | — | 630 | 730,7 × 598 | **73** | 866 |
| 4 | 10 px | 81 × 96 | — | 660 | 730,7 × 628 | **73** | 895 |
| **6** | **6 px** | **52 × 76** | — | **516** | 730,7 × 484 | **73** | **752** |
| 6 | 8 px | 52 × 86 | — | 536 | 730,7 × 504 | **73** | 772 |
| 6 | 10 px | 52 × 96 | — | 556 | 730,7 × 524 | **73** | 792 |
| 3 | 12 px | 111 × 106 | 446,4 | 803 | 730,7 × 771 | **73** | — |

> El prototipo **conservaba el punto de color**, que D3 saca. Los altos de botón de arriba están
> sobreestimados en la altura de ese `<span>` más su gap; hay que remedir con el punto afuera.

### Lo que la tabla decide

**`CELL_PX` se clava en 73 en todos los casos.** El techo por ancho del tablero a `col-span-8` es
730,7 / 10 = 73,1 px, así que en cuanto la paleta pasa de ~470 px de caja el tablero deja de poder
aprovechar el alto extra. Eso convierte la elección del tamaño de la miniatura en una decisión sobre
**cuánto aire muerto** dejar en la tarjeta del tablero, y no sobre el tablero.

| Paleta (caja) | Alto que el tablero puede usar | Aire muerto |
|---|---|---|
| ~470 | 438 = 6 × 73 | 0 |
| 516 | 484 | 46 px |
| 600 | 568 | 130 px |
| 803 | 771 | 333 px |

**Seis columnas son 2 filas; cuatro son 3.** De ahí que 6 × 6 px (516) sea más compacto que 4 × 6 px
(600) con la misma mini-celda.

El objetivo es 470–520 px de caja, y ahí caen las filas de 6 columnas con mini-celda de 6 px (516) y,
una vez sacado el punto, probablemente también la de 8 px.

## 4. `CELL_PX` viene de dos specs seguidos y hay que dejar el rastro

- Antes del 014: **63**, limitado por el **ancho** (`col-span-7`, 633,3 px de interior).
- Con el 014: **71**, limitado por el **alto** (`col-span-8` da 73,1 de ancho contra 71,6 de alto).
- Con este spec: **73**, otra vez limitado por el **ancho**, porque la paleta más alta suelta el alto.

El que limita cambia de lado dos veces. El docblock tiene que decir **cuál manda hoy y por qué**, o el
próximo que quiera un tablero más grande va a mirar el ancho de la tarjeta cuando el problema esté en
el alto de la paleta — que es exactamente el error que este research encontró midiendo.

El **piso de 60 px** no se mueve en ninguno de los tres pasos: depende del tamaño de la fuente de la
nota, no del layout, y el docblock ya advierte que hay que remedirlo si se toca el `text-[…]`.

## 5. Lo que `PiecePreview.tsx` dejó anotado en el 007

`layout.constants.ts` conserva la lápida:

```
/* `PREVIEW_CELL_PX` (20) se fue con `PiecePreview.tsx`: la previsualizacion aparte
   dejo de existir cuando el fantasma del tablero paso a mostrar la nota de cada
   celda. */
```

Dos cosas que importan:

- **El motivo del retiro era la repetición de las notas**, no la forma. El fantasma repite la nota de
  cada celda; **no** repite "cuál de las 12 piezas es la `N`" antes de elegirla, porque para ver el
  fantasma ya hay que haber elegido.
- **20 px era el tamaño de aquella mini-celda**, con la miniatura sola en un panel de 252 px de ancho.
  Este spec pone doce miniaturas en el lugar donde entraba una, así que 6–8 px no es una degradación de
  ese número: es otro problema.

El comentario se actualiza para que no parezca que este spec deshace aquel retiro.

## 6. La pura nueva, y por qué el centrado no es trivial

`miniCells(piece, rotation, mirror): Cell[]` — las cinco celdas en coordenadas de la caja de 5×5.

```
SHAPES[piece]  →  rotateN(·, rotation)  →  reflect si mirror  →  centrar en 5×5
```

Las tres primeras ya existen en `domain/transform.ts` y **`components/` puede importarlas**: la
dirección de dependencia permite que los componentes importen de `domain/` y de `audio/`.

El centrado es lo único nuevo, y es donde se puede equivocar en silencio: `normalize` deja la forma
pegada a `(0,0)`, así que hay que correrla por `floor((5 - ancho) / 2)` y `floor((5 - alto) / 2)`. Con
un `Math.round` en lugar de `floor`, o con el ancho leído del array sin normalizar antes, la pieza
queda pegada a un borde en algunas orientaciones y **compila igual**. Por eso AC4 lo verifica sobre las
96 combinaciones y no sobre una muestra.

El invariante de orden del array **no importa acá**: la miniatura no numera celdas ni las conecta con
grados. Es la primera derivación del repo que puede reordenar celdas sin romper nada — conviene que el
docblock lo diga, porque el resto del dominio afirma lo contrario y con razón.

## 7. Archivos que toca

| Archivo | Qué |
|---|---|
| `src/components/piece-mini.ts` *(nuevo)* | `miniCells` (§6) |
| `src/components/__tests__/piece-mini.test.ts` *(nuevo)* | AC4, AC5 sobre las 96 combinaciones |
| `src/components/PiecePalette.tsx` | El botón: miniatura + letra, sin el punto |
| `src/components/constants/layout.constants.ts` | `CELL_PX` 71 → 73, el docblock (§4) y la lápida (§5) |
| `DESIGN.md` | Qué muestra la paleta ahora (AC14) |

**No se toca** `domain/`, `audio/` ni `mcp-server/`: este spec no puede cambiar una nota, y que la
lista lo muestre es parte de la verificación (AC11).

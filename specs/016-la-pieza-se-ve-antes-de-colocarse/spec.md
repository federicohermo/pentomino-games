# Spec 016 — La pieza se ve antes de colocarse

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **No cambia una nota.** Toca `PiecePalette.tsx` y una pura nueva de `components/`. Consume las dos
> columnas que le dejó el [014](../014-el-tablero-se-edita-en-el-tablero/spec.md), y al hacer más alta
> la paleta **empuja `CELL_PX` de 71 a 73** — medido, ver D6.
>
> **Prerrequisito duro: el 014 tiene que estar mergeado antes de arrancar este spec.** Hoy en `main`
> la paleta es `md:col-span-3` y `CELL_PX` vale **63** (`src/components/PiecePalette.tsx:36`,
> `src/components/constants/layout.constants.ts:47`); el reparto 4/8 y el 71 los deja el 014, que
> está en `Propuesto`. Toda la tabla de D6, el objetivo de 470–520 px de caja y el «71 → 73» de AC9
> están medidos sobre ese reparto: implementar el 016 antes es medir contra otro layout.

## Problema

**La paleta pide elegir una forma y muestra una letra.** Los doce botones dicen `F I L N P T U V W X
Y Z`, y esas letras son nombres arbitrarios: la `N` no se parece a una N, y la `V` y la `L` son la
misma forma con un brazo de distinto largo. Hay que aprenderse doce nombres antes de poder elegir.

La forma **existe** en la app: `SHAPES` la tiene, el tablero la dibuja, el fantasma la muestra. Pero
sólo aparece **después** de llegar al tablero con la pieza ya elegida. O sea que el orden de las
operaciones está invertido: se elige a ciegas y se ve al colocar.

Y la orientación pasa lo mismo. `Rotación 180°` + `Reflexión ON` son dos controles que describen una
transformación, y lo que producen no se ve en ningún lado hasta que el cursor entra al tablero.

Hubo una previsualización aparte y **se retiró a conciencia** en el spec 007: `PiecePreview.tsx` y su
`PREVIEW_CELL_PX = 20`, sacados cuando el fantasma pasó a mostrar la nota de cada celda, porque decía
lo mismo dos veces. El comentario sigue en `layout.constants.ts`. Ese retiro fue correcto **para lo que
el panel repetía** —la nota de cada celda— y se llevó puesto lo que no repetía: la forma.

## Solución Propuesta

**El botón de la paleta deja de ser una letra y pasa a ser la pieza**, dibujada en miniatura, en el
color de la pieza, y **en la orientación que está seleccionada ahora mismo**. La letra se queda chica
debajo, porque es el nombre con el que se habla de la pieza en todo el repo.

```
   ┌─────────┐
   │  ▓      │      caja fija de 5×5, la forma centrada adentro
   │  ▓▓     │      pintada con PIECE_COLOR[key].bg
   │  ▓      │
   │  ▓      │
   │    N    │      la letra, chica
   └─────────┘
```

No es una superficie nueva: es la que ya existía, contando otra cosa. Y contesta las dos preguntas en
el mismo lugar donde se toman las dos decisiones — cuál pieza y en qué orientación.

### Decisiones de diseño

**D1 — La caja es fija de 5×5, y eso es lo que permite mostrar la orientación actual.**
La objeción a dibujar la orientación era medible: la caja de la `I` pasa de 5×1 a 1×5 al rotar, así que
con miniaturas ajustadas a su contenido **los doce botones reflowean en cada rotación**. Es exactamente
el bug que `PiecePalette.tsx` ya documenta para la línea de notas — *"un panel de control que se
acomoda solo cuando lo tocás es el bug: el botón se corre justo cuando vas a apretarlo"*.

Con una caja de 5×5 la objeción desaparece: **cualquier pentominó en cualquiera de sus 8 orientaciones
entra** —el máximo en un eje es **5** y lo pone sola la `I`; ninguna otra pieza pasa de 4×2 ni de
3×3 (`research.md` §2)— así que la caja nunca cambia de tamaño y nada se
mueve. La forma se centra adentro.

**D2 — Muestra la orientación actual y no la canónica.**
Con la caja fija resuelto, la elección es entre una paleta que es un **baúl de referencia** (siempre
canónica) y una que es un **espejo del estado** (la orientación que se va a colocar). Gana la segunda:
la rotación y la reflexión son estado **global** —se aplican a lo que sea que se coloque— así que
mostrar las doce rotadas no miente, dice la verdad. Y hace que los gestos del spec 013 tengan una
respuesta visual inmediata sin bajar la vista al tablero.

**D3 — Se va el puntito de color.**
Hoy la identidad entra como un `<span>` de 8 px con borde propio al lado de la letra. Con la forma
pintada del color de la pieza, el punto dice lo mismo dos veces — y su docblock explica que existía
porque *el fondo del botón no puede tomar el color de pieza*, que sigue siendo cierto y ahora lo
resuelve la miniatura.

El borde que el punto llevaba encima **sí se hereda**: varios de los 12 colores (el amarillo de `V`, el
lima de `F`) casi no se ven contra el gris claro del botón sin apoyarse. Las celdas de la miniatura
llevan el mismo borde, que además es el idioma del tablero desde el 007 —ahí todas las baldosas tienen
borde negro por el mismo motivo.

**D4 — El fondo del botón sigue siendo el canal de "seleccionada".**
No se toca. Es la razón por la que el fondo no puede tomar el color de la pieza, y sigue siendo el
mismo idioma que `Rotación` y `Reflexión` usan en la misma tarjeta: activo en oscuro.

**D5 — La letra se queda, y es además el nombre accesible.**
Una forma dibujada con `div`s **no tiene nombre accesible**: el botón, que hoy lo tiene gratis por su
texto, se quedaría sin ninguno. Y la letra es el vocabulario con el que se habla de las piezas en
`describe_piece`, en el tooltip del tablero y en `DESIGN.md` — que además advierte la colisión de
nombres entre la pieza `F` y la nota F.

Va como texto chico debajo de la miniatura **y** como `aria-label` del botón, con la orientación
adentro para que el lector de pantalla diga lo mismo que el ojo ve.

**D6 — El tamaño de la miniatura sale de dos restricciones medidas, y de ninguna preferencia.**
La primera es de legibilidad; la segunda es que **la paleta manda el alto de toda la fila**, así que
inflarla desperdicia espacio en la tarjeta del tablero. Medido con un prototipo inyectado en el DOM,
con la paleta ya en `col-span-4` (349,3 px de interior):

| Columnas | Mini-celda | Botón | Paleta (caja) | `CELL_PX` | Documento |
|---|---|---|---|---|---|
| 4 | 6 px | 81 × 76 | 600 | 73 | 835 px |
| 4 | 8 px | 81 × 86 | 630 | 73 | 866 px |
| **6** | **6 px** | **52 × 76** | **516** | **73** | **752 px** |
| 6 | 8 px | 52 × 86 | 536 | 73 | 772 px |
| 6 | 12 px | 52 × 106 | ~660 | 73 | — |

Dos lecturas:

- **`CELL_PX` llega a 73 en todos los casos y ahí se queda.** El techo por ancho a `col-span-8` es
  73,1 px, así que a partir del momento en que la paleta pasa de ~470 px de caja, el tablero ya no
  puede aprovechar el alto extra. Todo lo que la paleta crezca por encima de eso es aire muerto en la
  tarjeta del tablero.
- **Seis columnas es más compacto que cuatro**, porque son 2 filas en vez de 3.

O sea que el objetivo es una paleta de **~470 a 520 px de caja**, y la fila de 6 columnas × 6 px es la
que cae adentro. El número exacto se remide en implementación: el prototipo todavía tenía el puntito de
color, que D3 saca.

**D7 — La miniatura no dice notas ni pasos.**
Sólo la forma y el color. La nota de cada celda y el `#N` los dice el tablero a 73 px por celda; en una
mini-celda de 6 px no entra un `D#5` y el intento de meterlo es lo que hacía que la previsualización
del 007 repitiera al fantasma. La paleta contesta **cuál** y **cómo está girada**; el tablero contesta
**qué suena**.

**D8 — La forma dibujada sale de una pura testeable, no de un `.tsx`.**
`miniCells(piece, rotation, mirror)` devuelve las cinco celdas ya rotadas, reflejadas y **centradas en
la caja de 5×5**. Vive en `components/` al lado de `cell-text.ts`, por el motivo de siempre:
`react-refresh/only-export-components` prohíbe exportar algo que no sea el componente, y el centrado es
aritmética que se puede equivocar en silencio.

Compone las primitivas que ya existen —`rotateN`, `reflect`— y no las reimplementa.

Las **dos constantes** que aparecen no se declaran en el módulo, que es lo que la regla del repo
prohíbe: el lado de la caja (5) y el tamaño de la mini-celda en px van a
`components/constants/layout.constants.ts`, que es exactamente donde vivía `PREVIEW_CELL_PX` antes
del 007 y donde ya está `CELL_PX`. El 5 va ahí y no en `domain/constants/` —donde vive
`CELLS_PER_PIECE`, que es otra cosa: cinco celdas por pieza, no cinco casillas de caja— porque AC11
prohíbe tocar `domain/` y porque el lado de la caja es una decisión de layout.

## Criterios de Aceptación

- **AC1** — Cada botón de la paleta muestra la forma de su pieza, pintada con `PIECE_COLOR[key].bg`, en
  una caja de 5×5 celdas.
- **AC2** — **La caja no cambia de tamaño con la rotación ni con la reflexión** (D1), y por lo tanto la
  grilla de botones no reflowea. La garantía es de implementación y se verifica por lectura: la caja
  se dibuja con **5 pistas fijas** de `MINI_CELL_PX` y no con `min-content` ni `auto`, así que su
  tamaño no depende de qué celdas estén ocupadas. Medido además sobre las 8 orientaciones de la `I`,
  que es el peor caso: el `getBoundingClientRect()` del contenedor de la grilla no cambia.
- **AC3** — La miniatura muestra la **orientación actual** (D2): rotar o reflejar redibuja las doce.
- **AC4** — La forma queda **centrada** en la caja, con test de `miniCells` sobre las 96 combinaciones:
  las cinco celdas caen dentro de `0..4` en los dos ejes, y el centrado es determinista.
- **AC5** — `miniCells` compone `rotateN` y `reflect` y **no reimplementa** la geometría (D8). Como
  la función devuelve las celdas **ya centradas**, el test compara
  `normalize(miniCells(p, r, m))` contra `mirror ? reflect(rotateN(SHAPES[p], r)) : rotateN(SHAPES[p], r)`
  — no hay un «resultado sin centrar» que la firma exponga, y no hace falta exponerlo.
- **AC6** — La letra se queda debajo y el botón conserva un **nombre accesible** que incluye la
  orientación (D5).
- **AC7** — El puntito de color se va (D3), y las celdas de la miniatura heredan su borde, con el
  motivo escrito.
- **AC8** — El fondo del botón sigue siendo el único canal de "seleccionada" (D4).
- **AC9** — **La paleta queda entre ~470 y 520 px de caja** (D6), remedido con el puntito ya sacado, y
  `CELL_PX` se remide y queda en **73**, con el docblock actualizado — el 014 lo dejó en 71 y anotó
  este número.
- **AC10** — El layout responsivo sigue andando debajo de `md`, donde la tarjeta es `col-span-12`: la
  cantidad de columnas de la grilla de botones se remide en ese rango como se hizo en el 007, y no se
  hereda. «Sigue andando» tiene la métrica que el propio comentario de `PiecePalette.tsx:38-52` ya
  usa, y es la que se verifica: en **todo** el rango de 375 px a `max-w-6xl` saturado, el padding
  efectivo del botón más ancho **nunca es negativo** —a 768 llegó a −4,6 px con el esquema viejo— y
  la tarjeta no gana scroll horizontal.
- **AC11** — **No cambia una nota**: el diff no toca `domain/`, `audio/` ni `mcp-server/`.
- **AC12** — `pnpm verify` en verde.
- **AC13** — `[M]` A ojo: se puede elegir la pieza correcta **sin leer la letra**, y rotar con la rueda
  (spec 013) se ve en la paleta sin bajar la vista al tablero.
- **AC14** — `DESIGN.md` dice qué muestra la paleta ahora. Son **dos** lugares, no uno: la fila
  `PiecePalette` de la tabla de *El color comunica identidad* (`DESIGN.md:128`), que hoy dice «el
  color entra al costado», y la fila `CELL_PX` de la tabla de *Qué muestra una celda*
  (`DESIGN.md:79`), que va a quedar mintiendo con el número nuevo.
- **AC15** — `docs/architecture/directory-structure.md` lista los dos archivos nuevos. Ese doc
  enumera `components/` archivo por archivo —`cell-text.ts` y su test están ahí, agregados por el
  012— así que agregar `piece-mini.ts` sin tocarlo lo deja incompleto. Mismo movimiento que el T035
  del 014.
- **AC16** — Las constantes nuevas viven en `components/constants/layout.constants.ts` y no en
  `piece-mini.ts` ni en el `.tsx` (D8).

## Fuera de Alcance

- **La celda de agarre.** La previsualización vieja marcaba con un punto **dónde agarra el cursor**
  (`ANCHOR_INDEX`), y es información que hoy no se ve en ningún lado. No entra acá por una razón
  concreta: en el momento en que esa información hace falta —al apuntar al tablero— el fantasma ya
  muestra la pieza entera en su lugar real, que es más que un punto. Queda anotado como seguimiento.
- **La pieza pegada al cursor.** Competiría con el fantasma, que ya dibuja la pieza a tamaño real sobre
  la grilla.
- **Un panel de previsualización aparte.** Lo retiró el 007 y sigue retirado.
- **Las notas y el `#N` en la miniatura** (D7).
- **Reordenar o agrupar las piezas** por forma o por tónica. Siguen en orden alfabético.
- **El tamaño de la celda del tablero como decisión propia.** `CELL_PX` cambia como **consecuencia**
  medida de que la paleta crece (D6), no porque este spec quiera un tablero más grande.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **La paleta se infla y el tablero desperdicia alto.** Es un riesgo medido, no hipotético: a 12 px de mini-celda la paleta llega a ~660 px de caja y `CELL_PX` sigue en 73. | D6 fija el objetivo en 470–520 px con la tabla medida, y AC9 lo remide con el punto de color ya sacado. |
| Una mini-celda de 6 px es chica y doce formas de 30 × 30 px pueden no distinguirse. | Los pentominós son distintivos por construcción —son las 12 formas **distintas** de cinco cuadrados— y van pintados con 12 colores ya medidos en contraste. AC13 lo pone a ojo, que es lo único que lo contesta. |
| Redibujar 12 miniaturas en cada rotación (D2) es trabajo en cada cambio de estado. | Son 12 × 25 `div`s sin estado ni efectos, y la rotación cambia como mucho a la cadencia de un gesto humano. La misma `PiecePalette` ya se re-renderiza entera con cada rotación hoy. |
| El centrado en la caja de 5×5 es aritmética silenciosa: un `Math.floor` de más y una pieza queda pegada al borde en algunas orientaciones. | AC4 lo cubre sobre las 96 combinaciones, que es el mismo espacio que `check_invariants` recorre para lo suyo. |
| Sacar la letra del centro del botón cambia el tamaño de clic efectivo y la fila de 6 columnas deja botones de 52 px. | 52 × ~66 px sigue por encima del objetivo de 44 px de área táctil, y el botón entero es clickeable, no sólo la letra. |
| `DESIGN.md` describe el botón actual y quedaría mintiendo. | AC14. |

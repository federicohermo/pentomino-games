# Plan — Nota por celda y lenguaje visual

Cinco pasos. Los tres primeros son mergeables por separado y **ninguno cambia el audio**; el paso 1 no
cambia siquiera lo que se ve. El orden importa: 2 y 3 dependen de 1, y 4 documenta lo que 3 hizo.

## 1. El mapeo, en el dominio

### 1.1 Geometría pura → `domain/transform.ts`

```ts
export function centroid(cells: readonly Cell[]): [number, number]
export function angleFromCentroid(cell: Cell, cent: readonly [number, number]): number
```

`angleFromCentroid` normaliza a `[0, 2π)`. Va con el comentario del eje: **`y` crece hacia abajo**, así
que el anillo se recorre en sentido **horario en pantalla**. No está mal y es exactamente la clase de
detalle que alguien "arregla" por error — la regla del repo ya lo dice en `.claude/rules/domain.md`, y
acá pasa a tener un test.

Van a `transform.ts` y no a `music.ts` porque son geometría sin una sola noción musical, y porque
`music.ts` puede importar de `transform.ts` (la dirección de dependencia dentro de `domain/` es
`transform.ts ← music.ts`). Ojo con el alcance de esa red: es **convención documentada en `CLAUDE.md`,
no regla del linter**. El override de `src/domain/**` en `eslint.config.js:58-74` corta contra React,
`audio/`, `components/`, `App*` y `mcp-server/`, y no dice nada del orden interno de la capa — un
import al revés (`transform.ts` importando de `music.ts`) pasaría `pnpm lint` sin chistar.

### 1.2 El mapeo → `domain/music.ts`

```ts
export function degreeByCellIndex(cells: readonly Cell[]): number[]
```

Devuelve el grado (`0..4`) de cada celda, **por índice**. Recibe la forma y no la `PieceKey`: es lo que
la hace testeable sobre formas arbitrarias y lo que evita que `music.ts` tenga que conocer `SHAPES`.

Tres reglas adentro, en este orden:

1. **D1** — las celdas cuya distancia al centroide es `< 1e-9` salen del anillo y toman los primeros
   grados. La comparación es contra un epsilon y no contra `0` porque el centroide es un promedio de
   quintos: `2/5 + 2/5 + 1/5` no siempre da exactamente `1`.
2. Las demás se ordenan por **ángulo ascendente**.
3. **D2′** — a igual ángulo (dentro del mismo epsilon), gana el **índice original menor**. Escrito como
   tercer criterio del comparador, no delegado a que el `sort` sea estable.

**No se precomputa una constante `DEGREES` por pieza.** El repo prohíbe que un módulo de capa declare
constantes, y una tabla derivada tampoco es un valor fijo: es el resultado de una función. Quien lo
necesite por render lo memoiza en el borde, que es lo que `App.tsx` ya hace con `noteSet` y
`transformedShape`.

### 1.3 Tests → `domain/__tests__/`

- `transform.test.ts`: centroide de las 12 piezas; el ángulo de una celda al **sur** del centroide es
  `π/2` y no `-π/2` (el eje Y).
- `music.test.ts`: AC1 (permutación), AC2 (`I` y `X`), AC3 (96 orientaciones), AC4 (el desempate por
  índice, sobre `F`/`I`/`T`), **AC5 (la referencia, con los nombres de nota escritos a mano)**.
- `board.test.ts`: AC14 (`occupantCellIndex` — ver §2.3, que es donde se explica por qué existe).

AC5 es el test que hay que escribir primero y con más cuidado: es el que convierte la lámina de
referencia en algo que el repo puede verificar solo. Sus datos están en `research.md` §2.

## 2. El lenguaje visual

### 2.1 `components/constants/palette.constants.ts` (nuevo)

Los 12 colores medidos, cada uno con su color de texto:

```ts
export const PIECE_COLOR: Record<PieceKey, { bg: string; fg: string }> = { … };
```

Un solo record y no dos, para que agregar una pieza sin color sea error de compilación — el mismo
motivo por el que `BASE_MAP` está tipado `Record<PieceKey, number>` y no `as const`.

### 2.2 `components/__tests__/palette.test.ts` (nuevo)

AC7: recalcula el contraste WCAG **desde `bg`** y verifica que `fg` sea el mejor de negro/blanco y que
supere 4.5:1. Es lo que impide que `bg` y `fg` se desincronicen, que es la falla que el spec 005
documentó con cuatro casos.

Es el primer test de `components/`, y es **puro**: constantes y aritmética, sin DOM. Corre en el
`environment: 'node'` que ya está configurado, sin tocar la config ni traer jsdom.

### 2.3 `Board.tsx` + `layout.constants.ts`

- `CELL_PX`: 28 → **44**.
- Celda ocupada: fondo `PIECE_COLOR[occ.piece].bg`, texto `.fg`, contenido = **el nombre de su nota**.
  El grado va como número chico en la esquina, como en la referencia.
- Los colores salen de una constante, así que van por **estilo inline** y no por clase de Tailwind:
  una clase interpolada (`bg-[${color}]`) no se generaría porque Tailwind escanea el fuente. Es la
  misma regla que ya obliga a `style={{width: CELL_PX}}` en este archivo.
- El fantasma de previsualización, el choque (`bg-rose-500`) y el hover **no cambian**: siguen ganando
  sobre el color de pieza, porque comunican estado y no identidad.

#### De `(x, y)` al nombre de nota, sin lógica en el componente

Para saber qué nota va en una celda hacen falta dos cosas que `Board` no puede derivar sola: el índice
de la celda dentro de la pieza y el mapeo. `occupantAt` devuelve la pieza pero no el índice.

**Va una pura nueva al lado de `occupantAt`, en `domain/board.ts`**, y no un `findIndex` adentro del
componente:

```ts
export function occupantCellIndex(p: PlacedPiece, x: number, y: number): number
```

Así el camino completo se compone de funciones del dominio, cada una con test en `environment: 'node'`
— es AC14:

```ts
const i  = occupantCellIndex(occ, x, y);
const g  = degreeByCellIndex(SHAPES[occ.piece])[i];
const asc = notesForRotation(BASE_MAP[occ.piece], DEFAULT_OCTAVE, occ.rotation);
midiName(asc[g]);   // lo que se imprime en la celda
```

Dos decisiones adentro de esas cuatro líneas:

- **La primera versión del plan dejaba el `findIndex` en el componente**, con el argumento de que
  cinco comparaciones sobre máximo 60 celdas es irrelevante —lo es— y de que no valía cambiar el
  dominio por una necesidad de render. El argumento que lo da vuelta no es de costo sino de
  cobertura: AC6 es de firma humana, así que dejar ahí la única lógica de la que depende lo que se ve
  la deja verificada por captura, dentro de la deuda «no hay tests de UI» (`log.md:84`). Una captura
  no distingue un mapeo correcto de uno corrido en uno. La pura cuesta una función y un test.
- **El arpegio sale de `notesForRotation`, no de `occ.notes`.** `PlacedPiece.notes` (`App.tsx:64`)
  viene con el retrógrado ya aplicado, así que indexarlo con el grado implementa la lectura que AC12
  descarta, y "des-invertirlo" con `occ.mirror` crearía un segundo lugar donde el retrógrado tiene que
  estar bien. Pedirle el ascendente al dominio evita las dos cosas — y de paso deja a `Board` **sin
  consumir `occ.notes`**, que es el campo que el spec ya quiere retirar después del 009.

### 2.4 Los otros tres componentes

Por **D7** —el color va donde ya se comunicaba identidad, nunca sobre el canal de estado—, y no por
«donde ya mostraban la letra», que no decide nada en dos de los tres:

- **`PiecePreview`**: las celdas pasan de `bg-slate-800` (`:33`) al color de pieza; el punto del ancla
  queda. Sigue **sin** nombres de nota, porque ya los lista debajo en texto.
- **`PiecePalette`**: el fondo del botón **no se toca** —es el canal de "seleccionado" (`:41`)—; el
  color de pieza entra como punto o barra al costado.
- **`PlacedList`**: la letra de `:25` toma el color de pieza. Es texto plano sobre `bg-slate-50`.

Sin cambio de layout ni de tamaño en ninguno: `PREVIEW_CELL_PX` se queda en 20 (AC13).

## 3. `describe_piece` reporta el mapeo

En `mcp-server/src/tools/describePiece.ts`, la respuesta gana el grado y la nota **por celda**:

```ts
cellMap: cells.map((c, k) => ({ cell: c, degree: degrees[k], note: midiName(ascending[degrees[k]]) }))
```

Con `degrees` viniendo de `degreeByCellIndex(SHAPES[piece])` — la forma **canónica**, no la
transformada, que es D3 ejecutándose en vez de describirse.

Dos cosas de la firma que no son de estilo:

- **Es `ascending` y no `notes`.** `notes` en ese archivo (`describePiece.ts:69`) ya tiene el
  retrógrado aplicado, así que indexarlo con el grado invertiría el mapeo cuando `mirror` es `true` —
  la lectura que AC12 descarta. La nota de una celda sale del arpegio ascendente; el retrógrado es del
  orden de reproducción y ya lo reporta el campo `notes`.
- **Campo nuevo, y `cells` intacto.** Pisar `cells` —hoy `Cell[]`— cambiaría el contrato de la tool en
  silencio: el único test que lo toca es `tools.test.ts:70`, que solo chequea `.length`, así que
  `pnpm mcp:test` seguiría verde mientras la descripción de la tool (`describePiece.ts:52`, «devuelve
  las celdas ya transformadas (en orden de array)») pasa a mentir. Y esa descripción es la doc que
  leen los agentes: no hay revisión humana que la ataje.
  Va `cellMap` al lado, y `cells` se queda como está. La descripción de la tool suma **una frase** que
  nombre el campo nuevo — es doc, no cosmética: una tool que devuelve algo que su descripción no
  menciona es una tool que nadie va a consultar.

La tool es una fachada: **no** recalcula el mapeo, lo importa. Si aparece la tentación de derivarlo
acá, falta un export en `domain/` — y eso es un cambio de `src/`, en su propio commit.

Ojo con el ASCII de `renderAscii`: hoy dibuja la letra de la pieza y el ancla. **No se toca** en este
spec; el grado por celda va en el JSON, que es lo que se consulta.

## 4. `DESIGN.md` y la documentación

- **`DESIGN.md`** en la raíz: los 12 colores con su hex y su tónica, la regla de contraste y por qué es
  un test, el tamaño de celda y qué muestra una celda (nota + grado), y qué **no** se comunica con
  color (estado: hover, fantasma, choque). Enlaza a `research.md` §1 para las mediciones en vez de
  copiarlas.
- **`CLAUDE.md`**: fila nueva en la tabla de documentación.
- **`.claude/rules/domain.md`**: la fila «La forma → **Nada, hoy** — es lo que ataca el spec 001»
  (`:36`) pasa a «La forma → qué celda tiene qué nota (spec 007)». El renglón sobre el tiempo **no** se
  toca: eso sigue siendo del 009.
- **`docs/architecture/modelo-musical.md`**: ahí **no es una fila**, es prosa —«La **forma** de la
  pieza no influye hoy en el sonido. Es la carencia que ataca el spec 001» (`:16-18`)—, así que hay que
  reescribir el párrafo y sumar la forma a la tabla «Las cuatro reglas» (`:9-14`), que pasa a cinco. La
  frase sobre la fila (`y`) que sigue **sí** queda como está.
- **`docs/architecture/directory-structure.md`**: el árbol de `components/` (`:85-92`) enumera archivo
  por archivo y lista `constants/ └── layout.constants.ts` como único hijo. Entran
  `constants/palette.constants.ts` y el directorio `components/__tests__/`, que hoy no existe.
- **`specs/log.md`**: fila del 007 en `Propuesto`; el 001 pasa a `Descartado` con este spec como
  motivo; una nota de dependencia que diga que 007 y 008 son ortogonales y que el 009 necesita a los
  dos.

## 5. Verificación

| Qué | Cómo |
|---|---|
| AC1–AC5, AC7, AC12, AC14 | `pnpm test` |
| AC13 (no-regresión de los tres componentes) | `pnpm verify` + captura de la paleta, la previsualización y la lista de colocadas antes/después: mismas notas, mismo orden, mismo tamaño |
| AC8 (el audio no cambió) | `simulate_board` con dos o tres piezas fijas, **antes** de empezar y al terminar: la `timeline` completa tiene que ser idéntica. Guardar la salida del "antes" al crear la rama |
| AC9 | `describe_piece` sobre `X` (celda central = tónica) y sobre `F` (la pieza donde el desempate decide) |
| AC6, AC10, AC11 | `pnpm verify` + captura del tablero con `X`, `I` y `F` colocadas |
| Riesgo de legibilidad | Captura a 44 px con `D#5`; si no entra, aplicar el fallback declarado (nombre sin octava) y anotarlo en `DESIGN.md` |
| Riesgo de layout | Captura a 375 px de ancho |

## Lo que un revisor va a esperar y no va a encontrar

Que esto cambie cómo suena. **No cambia nada del audio**: cambia de dónde sale el orden de las notas
—de una decisión explícita en vez de un accidente del `sort`— y qué se ve en el tablero. AC8 está
justamente para que eso sea verificable y no una promesa: el mismo tablero produce la misma línea de
tiempo antes y después.

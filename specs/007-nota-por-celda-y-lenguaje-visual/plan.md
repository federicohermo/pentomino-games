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
`transform.ts ← music.ts`, verificada por el linter).

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
- `music.test.ts`: AC1 (permutación), AC2 (`I` y `X`), AC3 (96 orientaciones), AC4 (orden total
  estricto), **AC5 (la referencia, con los nombres de nota escritos a mano)**.

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

Para saber qué nota va en una celda hacen falta dos cosas que `Board` ya no puede derivar sola: el
índice de la celda dentro de la pieza y el mapeo. `occupantAt` devuelve la pieza pero no el índice. Se
resuelve en el componente con un `findIndex` sobre `occ.cells` — cinco comparaciones por celda ocupada,
como máximo 60 celdas: es irrelevante y evita cambiar la firma de una pura del dominio por una
necesidad de render. Si al medirlo molesta, la alternativa es que `occupantAt` devuelva
`{ piece, cellIndex }`, y eso sí es un cambio del dominio en su propio commit.

### 2.4 Los otros tres componentes

`PiecePalette`, `PiecePreview` y `PlacedList` heredan el color de pieza **solo donde ya mostraban la
letra**. Sin cambio de layout ni de tamaño: `PREVIEW_CELL_PX` se queda en 20 y la previsualización
sigue sin nombres de nota, porque ya los lista debajo en texto.

## 3. `describe_piece` reporta el mapeo

En `mcp-server/src/tools/describePiece.ts`, la respuesta gana el grado y la nota **por celda**:

```ts
cells: cells.map((c, k) => ({ cell: c, degree: degrees[k], note: midiName(notes[degrees[k]]) }))
```

Con `degrees` viniendo de `degreeByCellIndex(SHAPES[piece])` — la forma **canónica**, no la
transformada, que es D3 ejecutándose en vez de describirse.

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
- **`docs/architecture/modelo-musical.md`** y **`.claude/rules/domain.md`**: la fila «La forma →
  **Nada, hoy** — es lo que ataca el spec 001» pasa a «La forma → qué celda tiene qué nota (spec 007)».
  El renglón sobre el tiempo **no** se toca: eso sigue siendo del 009.
- **`specs/log.md`**: fila del 007 en `Propuesto`; el 001 pasa a `Descartado` con este spec como
  motivo; una nota de dependencia que diga que 007 y 008 son ortogonales y que el 009 necesita a los
  dos.

## 5. Verificación

| Qué | Cómo |
|---|---|
| AC1–AC5, AC7 | `pnpm test` |
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

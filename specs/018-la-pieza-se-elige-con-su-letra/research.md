# Research — Spec 018

Estado del código relevante, medido sobre `main` con los specs 013–017 mergeados.

## 1. La capa de entrada ya existe, y este spec es su cuarto inquilino

El spec 013 creó `src/components/input.ts` con la decisión de cada gesto separada del cableado que la
ejecuta, y `src/components/constants/input.constants.ts` con el const-object `ACCION`. Hoy tiene tres
valores: `rotar`, `reflejar`, `transporte`.

La razón por la que las puras reciben **campos** y no el evento está escrita en el docblock del
archivo, y sigue valiendo entera: los tests de `src/` corren en `environment: 'node'` y el repo no
tiene jsdom, así que no hay `KeyboardEvent` que fabricar. Este spec no la cambia.

El cableado vive en un `useEffect` de `App.tsx` con dos listeners sobre `window` (`keydown` y
`keyup`), que despacha por `accionDeTecla` y pregunta aparte por `frenaElDefault`.

## 2. Las doce letras no chocan con nada — medido

```
letras: F I L N P T U V W X Y Z
colisiones con la tabla del 013 (Shift / Control / ' ' / Alt / Meta): 0
```

La tabla del 013 usa **modificadores y la barra**, o sea ninguna tecla imprimible. La tabla del 014
agregó `Alt`, que también es modificador. El espacio de las letras estaba entero libre, y eso no es
casualidad: el 013 eligió modificadores justamente para no gastar letras.

## 3. `abreTapLimpio` ya cubre AC3 sin tocarla

```ts
return (e.key === 'Shift' || e.key === 'Control') && !otroAbajo;
```

Devuelve `false` para cualquier tecla que no sea `Shift` ni `Control`, y `App.tsx` la llama en **todo**
`keydown` (`tapLimpio.current = abreTapLimpio(e)`). O sea que apretar `F` ya ensucia el tap.

Consecuencia concreta: escribir `F` mayúscula —`Shift` abajo, `f`, soltar `Shift`— **no rota la pieza**,
y no hay que escribir una línea para conseguirlo. Es exactamente el caso que la función existe para
resolver, y el spec 013 lo dejó anotado con `Ctrl`+`Shift` como testigo.

## 4. Dónde se decide hoy que un evento «no es nuestro»

`accionDeTecla` tiene cuatro guardas y las dos primeras aplican tal cual a este spec:

```ts
if (e.targetEsControl) return null;   // AC5
if (e.repeat) return null;
```

`targetEsControl` lo calcula `App.tsx` (`t instanceof HTMLButtonElement || t instanceof HTMLInputElement`)
porque los tipos del DOM no pueden cruzar a `input.ts`, que se carga en node. Este spec **no** agrega
una guarda nueva ahí.

La guarda de `repeat` sí merece una decisión propia: mantener `F` apretada dispara `keydown` repetidos,
y seleccionar la pieza que ya está seleccionada es idempotente. Dejar pasar el repeat no rompe nada,
pero cortarlo es gratis y evita doce `setState` por segundo que React igual descartaría. Se corta.

## 5. Lo que **no** está en `EventoDeTecla` y hace falta

El tipo de hoy (`components/types/input.types.ts`) lleva `key`, `tipo`, `repeat`, `targetEsControl` y
`tapLimpio`. **No lleva `ctrlKey`, `metaKey` ni `altKey`**, porque hasta ahora ninguna acción de tecla
los necesitaba: los modificadores *eran* la acción.

AC4 los necesita. Hay dos formas y una es peor:

- **Ensanchar `EventoDeTecla`** con los tres campos. Los llena `App.tsx` desde el evento real, y
  `accionDeTecla` los mira solo en la rama de las letras.
- Filtrar en `App.tsx` antes de llamar a la pura. Deja la guarda **fuera** del test, que es justo lo
  que AC8 pide evitar y lo que el docblock de `input.ts` nombra como el motivo del archivo.

Se ensancha el tipo.

## 6. `EventoDeModificador` ya los tiene, y eso es una pista

```ts
// types/input.types.ts, hoy
EventoDeModificador → { key, shiftKey, ctrlKey, altKey, metaKey }
```

Los cinco campos ya viajan para `abreTapLimpio`. O sea que `App.tsx` ya los lee del evento en el
`keydown`; lo único que falta es pasárselos también al otro tipo. No hay información nueva que sacar
del DOM.

## 7. Archivos afectados

| Archivo | Qué cambia |
|---|---|
| `src/components/constants/input.constants.ts` | `ACCION` gana `seleccionar` |
| `src/components/types/input.types.ts` | `EventoDeTecla` gana `ctrlKey`, `metaKey`, `altKey` |
| `src/components/input.ts` | `accionDeTecla` gana la rama de las letras; nueva pura `piezaDeTecla` |
| `src/components/__tests__/input.test.ts` | Los casos de AC1–AC7 y AC11, **y el factory `tecla` de la línea 19**, que arma el evento con defaults y deja de compilar apenas el tipo gana tres campos obligatorios |
| `src/App.tsx` | Llena los tres campos nuevos; despacha `ACCION.seleccionar` **antes** del `else togglePlay()` de la línea 311, que hoy es el catch-all sin condición; footer (líneas 446-452) |
| `docs/guides/quickstart.md` | La tabla «Cómo se toca» (encabezado en la línea 57, filas 63-70) es la única doc que enumera los gestos: gana la fila de las letras, y el párrafo de la línea 59 deja de decir «los **tres** gestos». El footer de AC9 no la reemplaza |

Ninguno en `domain/` ni en `audio/`. **No cruza el borde de paquete**: `mcp-server/` importa 31
símbolos del dominio y este spec no toca ninguno.

## 8. Por qué la validación va contra `SHAPES` y no contra una lista

`SHAPES` es el único lugar **con existencia en runtime** donde las doce piezas están enumeradas, y por
eso es contra él que se valida. La dirección es al revés de lo que parece: `PieceKey` está **declarado
explícito** en `domain/types/pieces.types.ts` y `SHAPES` es un `Record<PieceKey, Cell[]>` — no se
deriva de él. Es a propósito y su docblock dice por qué: así el tipo de las piezas sale de la
geometría y no de la tabla musical. Para validar una tecla hace falta un valor, y el valor es
`SHAPES`. Una lista
`['F','I',...]` escrita en `input.constants.ts` sería el quinto lugar donde las doce letras están
enumeradas, y el único que nada sincroniza — exactamente lo que la regla «los módulos no declaran
constantes» existe para evitar, con el agravante de que el desincronizado sería silencioso: agregar
una pieza trece y olvidarse de la lista deja una tecla muerta que no falla en ningún test.

`input.ts` puede importar de `domain/`, y conviene ser preciso sobre por qué: `eslint.config.js` **no
tiene** un override para `components/**`. El único bloque que le aplica es el de `src/**/*.{ts,tsx}`,
que restringe solo `MCP_SERVER`; los overrides con `FUERA_DE_DOMAIN` y su hermano de `audio/` valen
para `src/domain/**` y `src/audio/**`, no acá. O sea que la dirección `components/ → domain/` está
permitida por omisión y es la correcta. `input.ts` ya lo hace para `PieceKey` y `PlacedPiece`, aunque
esos son `import type`: `SHAPES` sería el **primer import de valor** del archivo hacia `domain/`, que
es exactamente lo que `App.tsx`, `PiecePalette.tsx`, `cell-text.ts` y `piece-mini.ts` ya hacen.

`Object.keys(SHAPES)` devuelve `string[]`, así que la pura tiene que estrechar. El `in`-check **a secas
no estrecha**, y está medido: `return k in SHAPES ? k : null` falla con `TS2322: Type 'string' is not
assignable to type 'PieceKey | null'`. El `in` de TS 4.9 estrecha el operando **derecho** —el objeto—,
no el izquierdo. Lo que sí compila, y sin un solo `as`, es un type predicate propio:

```ts
function esPieza(k: string): k is PieceKey { return k in SHAPES; }
```

Medido con `tsc --noEmit --strict --erasableSyntaxOnly` sobre las dos versiones: la primera es error, la
segunda sale limpia. El `in` sigue siendo el runtime correcto; lo que hacía falta era la firma.

## 9. Riesgos

| Riesgo | Cuánto | Mitigación |
|---|---|---|
| Un layout de teclado no latino no emite `f` en `e.key` | Real pero acotado | `e.key` respeta el layout activo, que es lo correcto: el usuario aprieta la tecla que dice `F` en *su* teclado. Usar `e.code` (`KeyF`) haría lo contrario — atarlo a la posición física QWERTY |
| El usuario espera que la letra también rote | Bajo | Está fuera de alcance a propósito y escrito en el spec |
| `Alt`+letra en Windows abre menús | No aplica | AC4 lo veta antes: con `Alt` abajo la tecla no es nuestra |
| AC5 no se puede testear sin jsdom | Sí | La pura recibe `targetEsControl` ya calculado y se testea con los dos valores; que `App.tsx` lo llene bien queda como tarea `[M]`, igual que en el 013 |

## 10. Lo que este spec le deja al 020

Nada que lo bloquee, y una cosa que conviene saber: cuando el 020 haga la orientación por pieza,
seleccionar por letra va a restaurar también la rotación y la reflexión recordadas de esa pieza
**sin una línea de handler**. El `log.md` decía que era «un cambio del handler de `App.tsx`» y con el
diseño que el 020 terminó eligiendo no lo es: la orientación se deriva de `orientaciones[selected]`, así
que el `setSelected` que ya hace esta rama alcanza y los consumidores re-derivan solos. Esta pura no se
entera: `piezaDeTecla` sigue contestando qué pieza, y nada más.

Ortogonales **en el modelo**, no en el archivo: los dos escriben el mismo `despachar` del efecto de
teclado de `App.tsx` (el 020 lo declara en su T009, «el efecto de teclado escribe una sola ranura con
setter funcional»), y el 020 además le cambia las dependencias que este spec da por fijas
(`[rotation, mirror, togglePlay]`, `App.tsx:329`). El cruce es de **merge**, no de diseño: en el orden
018 → 020 el 020 reescribe una cadena que ya tiene la rama `seleccionar`; en el orden inverso, T013 y
T014 se aplican sobre una cadena distinta de la citada acá. Cualquiera de los dos órdenes funciona
mientras los dos no se implementen en carriles paralelos.

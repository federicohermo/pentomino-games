# Research — Spec 018

Estado del código relevante. Medido primero sobre `main` con los specs 013–017 mergeados; **releído el
2026-08-21 contra el `main` de hoy**, que además tiene el 022 (los efectos salen de `App.tsx`), el 025,
el **026** (el tablero se toca con el teclado) y el 029 (coverage 100 y un proyecto de Vitest en
Chromium). Lo que cambió está corregido en su lugar; los porqués aguantaron enteros.

## 1. La capa de entrada ya existe, y este spec es su cuarto inquilino

El spec 013 creó `src/components/input.ts` con la decisión de cada gesto separada del cableado que la
ejecuta, y `src/components/constants/input.constants.ts` con el const-object `ACCION`. Hoy tiene tres
valores: `rotar`, `reflejar`, `transporte`.

La razón por la que las puras reciben **campos** y no el evento está escrita en el docblock del
archivo, y sigue valiendo entera: los tests de `src/` corren en `environment: 'node'` y el repo no
tiene jsdom, así que no hay `KeyboardEvent` que fabricar. Este spec no la cambia.

El cableado ya **no** vive en `App.tsx`: desde el spec 022 es `useAtajosDeTeclado`, en
`src/components/use-input.ts`, con los dos listeners sobre `window` (`keydown` y `keyup`). Su
`despachar` (`use-input.ts:81-102`) arma el objeto `evento`, pregunta aparte por `frenaElDefault` y
despacha la cadena `if`/`else if`/`else transporte()`. `App.tsx` sólo le pasa los tres callbacks
(`App.tsx:258-261`) — el hook recibe **callbacks y no setters** a propósito, y el porqué está en su
docblock (`use-input.ts:18-21`).

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

`accionDeTecla` tiene **cinco** guardas —eran cuatro hasta el 026, que agregó `targetEsCelda`— y las
dos primeras aplican tal cual a este spec:

```ts
if (e.targetEsControl) return null;   // AC5
if (e.repeat) return null;
```

`targetEsControl` lo calcula `use-input.ts` (`t instanceof HTMLButtonElement || t instanceof
HTMLInputElement`, línea 68) porque los tipos del DOM no pueden cruzar a `input.ts`, que se carga en
node. Este spec **no** agrega una guarda nueva ahí.

La quinta guarda del 026, `targetEsCelda`, **no** entra en la rama de las letras y eso es una decisión
y no un olvido (AC13): vive adentro de la rama de la barra por el mismo motivo por el que este spec la
deja afuera de la suya —apaga una tecla, no todas—, y una letra no la maneja el `onKeyDown` de la celda
(`Board.tsx:197-206`, `switch` con `default: return`), así que no hay doble disparo que evitar.

La guarda de `repeat` sí merece una decisión propia: mantener `F` apretada dispara `keydown` repetidos,
y seleccionar la pieza que ya está seleccionada es idempotente. Dejar pasar el repeat no rompe nada,
pero cortarlo es gratis y evita doce `setState` por segundo que React igual descartaría. Se corta.

## 5. Lo que **no** está en `EventoDeTecla` y hace falta

El tipo de hoy (`components/types/input.types.ts:22-54`) lleva `key`, `tipo`, `repeat`,
`targetEsControl`, `targetEsCelda` (spec 026) y `tapLimpio`. **No lleva `ctrlKey`, `metaKey` ni
`altKey`**, porque hasta ahora ninguna acción de tecla
los necesitaba: los modificadores *eran* la acción.

AC4 los necesita. Hay dos formas y una es peor:

- **Ensanchar `EventoDeTecla`** con los tres campos. Los llena `use-input.ts` desde el evento real, y
  `accionDeTecla` los mira solo en la rama de las letras.
- Filtrar en `use-input.ts` antes de llamar a la pura. Deja la guarda **fuera** del test, que es justo lo
  que AC8 pide evitar y lo que el docblock de `input.ts` nombra como el motivo del archivo.

Se ensancha el tipo.

## 6. `EventoDeModificador` ya los tiene, y eso es una pista

```ts
// types/input.types.ts, hoy
EventoDeModificador → { key, shiftKey, ctrlKey, altKey, metaKey }
```

Los cinco campos ya viajan para `abreTapLimpio`. O sea que `use-input.ts` ya los lee del evento en el
`keydown` (`onKeyDown` le pasa el `KeyboardEvent` entero, línea 108); lo único que falta es pasárselos también al otro tipo. No hay información nueva que sacar
del DOM.

## 7. Archivos afectados

| Archivo | Qué cambia |
|---|---|
| `src/components/constants/input.constants.ts` | `ACCION` gana `seleccionar` |
| `src/components/types/input.types.ts` | `EventoDeTecla` gana `ctrlKey`, `metaKey`, `altKey` |
| `src/components/input.ts` | `accionDeTecla` gana la rama de las letras; nueva pura `piezaDeTecla` |
| `src/components/__tests__/input.test.ts` | Los casos de AC1–AC7 y AC11, **y el factory `tecla` (docblock en la línea 19, cuerpo en la 20-22)**, que arma el evento con defaults y deja de compilar apenas el tipo gana tres campos obligatorios. Ya importa `SHAPES` como valor (línea 7) |
| `src/components/use-input.ts` | **Acá vive el cableado desde el 022, no en `App.tsx`.** El objeto `evento` de `despachar` (líneas 82-87) llena los tres campos nuevos; la interfaz `Acciones` (36-40) gana `seleccionar`; la cadena despacha `ACCION.seleccionar` **antes** del `else transporte()` de la línea 101, que es el catch-all sin condición; el array de dependencias (línea 119) suma `seleccionar` |
| `src/components/__tests__/use-input.browser.test.tsx` | **Existe desde el 029 y el spec original no lo conocía.** Su factory `acciones()` (línea 24) devuelve los tres mocks y deja de typechequear en cuanto `Acciones` gana un campo; y la rama nueva de `despachar` necesita su test o el umbral 100 no cierra |
| `src/App.tsx` | Un callback nuevo junto a `rotarConTecla` / `reflejarConTecla` (líneas 249-250) y un campo más en la llamada a `useAtajosDeTeclado` (258-261); footer en las **líneas 433-439**, con los tres `<span>` de gesto en 436-438 |
| `src/__tests__/App.browser.test.tsx` | El callback nuevo de `App.tsx` es una **función** en el conteo de coverage, y `App.tsx` no está excluido (`vite.config.ts:126-134`): sin un test que apriete la letra de punta a punta, `functions` baja de 100 |
| `docs/guides/quickstart.md` | La tabla «Cómo se toca» (encabezado en la línea **71**, filas **79-84**) es la única doc que enumera los gestos: gana la fila de las letras, y el párrafo de la línea **73** deja de decir «los **tres** gestos». El footer de AC9 no la reemplaza |

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

`input.ts` puede importar de `domain/`, y conviene ser preciso sobre por qué — **el mecanismo cambió con
el spec 030 y la conclusión no**. La dirección ya no se prohíbe por el string del import sino por ruta,
con `import-x/no-restricted-paths` y las zonas de `ZONAS` (`eslint.config.js:71-92`). Ahí el `target` es
**quien importa**: la zona 1 dice que `./src/domain` no puede importar de `components/`, `audio/`,
`App.tsx` ni `main.tsx` — la flecha contraria, `components/ → domain/`, **no tiene zona y está
permitida**, que es lo correcto. `input.ts` ya lo hace para `PieceKey` y `PlacedPiece`, aunque esos son
`import type`: `SHAPES` sería el **primer import de valor** del archivo hacia `domain/`, que es
exactamente lo que `App.tsx`, `OrientationPanel.tsx`, `cell-text.ts`, `piece-mini.ts` y el propio
`input.test.ts` ya hacen (`find_symbol SHAPES`, 2026-08-21). Lo único que el linter sí exige es la
**extensión explícita**, y sobre las cuatro formas de import (`no-restricted-syntax`,
`eslint.config.js:116-129`).

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

Ortogonales **en el modelo**, no en el archivo: los dos escriben el mismo `despachar` —que desde el 022
vive en `src/components/use-input.ts:81-102` y no en `App.tsx`— (el 020 lo declara en su T009, «el
efecto de teclado escribe una sola ranura con setter funcional»), y el 020 además le cambia las
dependencias que este spec da por fijas (hoy `[rotar, reflejar, transporte, tapLimpio]`,
`use-input.ts:119`; los callbacks los arma el shell en `App.tsx:249-261`). El cruce es de **merge**, no de diseño: en el orden
018 → 020 el 020 reescribe una cadena que ya tiene la rama `seleccionar`; en el orden inverso, T013 y
T014 se aplican sobre una cadena distinta de la citada acá. Cualquiera de los dos órdenes funciona
mientras los dos no se implementen en carriles paralelos.

## 11. Lo que el spec 029 le agrega al costo, y que el research original no podía ver

Cuando esto se escribió, `src/` tenía tests pero no tenía **gate**. Hoy `pnpm suite` corre dos pasadas
de vitest y la segunda pide **100 en las cuatro métricas** (`vite.config.ts:157`), con `App.tsx`
**adentro** del conteo —los únicos excluidos son `__tests__/`, `vite-env.d.ts` y `main.tsx`
(`vite.config.ts:126-134`)—. Consecuencia directa para este spec: las ramas nuevas de `use-input.ts` y
el callback nuevo de `App.tsx` **no pueden mergear sin test**, y ninguno de los dos se puede testear en
`environment: 'node'`. Van al proyecto `browser`, con el sufijo `*.browser.test.tsx`:

| Archivo | Qué agrega |
|---|---|
| `src/components/__tests__/use-input.browser.test.tsx` | `acciones()` (línea 24) suma `seleccionar: vi.fn()` —sin eso el archivo entero no typechequea— y un test que apriete una letra y verifique que llama a `seleccionar` **y no a `transporte`** |
| `src/__tests__/App.browser.test.tsx` | Un test de punta a punta que apriete la letra y verifique la pieza en la mano, para cubrir el callback nuevo. Ya hay un vecino exacto: `it('elegir otra pieza cambia lo que hay en la mano')`, línea 445, y los tests de teclado del 026 en `describe('App — el tablero se toca con el teclado (spec 026)')`, línea 552 |

Dos hechos medidos que conviene tener a mano al escribir los tests:

- **Ningún test de hoy usa una de las doce letras.** `input.test.ts:246-256` barre
  `['a','Enter','Alt','ArrowUp','Escape']` y `use-input.browser.test.tsx` usa `'q'` (línea 121) y
  `'c'` (línea 111): ninguna es pentominó, así que **no hay regresión** y esos tres literales pasan a
  ser load-bearing. Vale un comentario al lado cuando se los toque.
- **Los `describe` de `input.test.ts` nombran «AC1», «AC3»… de tres specs distintos** (013, 014 y 026)
  sin decir de cuál. Los de este spec se escriben con el número adelante —`018 AC1`— para no agregar el
  cuarto homónimo; renombrar los viejos es de otro spec.

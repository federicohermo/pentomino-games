# Research — Spec 020

Medido ejecutando `domain/transform.ts` y `domain/music.ts` reales con node, y leyendo `App.tsx` sobre
`main` con los specs 013–017 mergeados.

> **Re-anclado en el review.** Lo medido sobre el dominio (§1, §3, §6) no envejeció: son funciones
> puras que ningún spec de por medio tocó. Lo que sí envejeció es todo lo que afirma la **forma de
> `App.tsx`**: desde que esto se escribió entraron el **022** (los seis efectos se van del shell;
> `PiecePalette` se parte en `OrientationPanel` + `TransportPanel`), el **026** y el **027** (el
> objeto `orientacion` pasa a ser un `useMemo` y `OrientationPanel` queda envuelto en `memo`).
> `App.tsx` pasó de 312 a **442** líneas: los números de línea de §2 y §8 estaban todos podridos y
> las secciones marcadas abajo se reescribieron contra el árbol de hoy.

## 1. El tamaño del problema, medido

```
rotar una vez, hoy (rotación global):
  0° → 90°    cambian 11/12 miniaturas   quieta: X
  90° → 180°  cambian 11/12              quieta: X
  180° → 270° cambian 11/12              quieta: X
  270° → 0°   cambian 11/12              quieta: X
reflejar a 0°: cambian 8/12              quietas: I T U X
```

Once de doce. La `X` es la única que se salva y no por diseño: es simétrica de orden 4, así que sus
cuatro rotaciones dan la misma forma.

Y el número engaña para abajo, porque **la orientación de una pieza no colocada no es sólo visual**:
`arpeggioFor(piece, rotation, mirror, regimen)` mira las dos, así que al rotar la `F` las otras once
también cambian de arpegio. Lo que pasa es que no suenan hasta que se colocan, así que el cambio es
invisible **y** inaudible hasta que ya es tarde.

## 2. Dónde vive hoy la orientación

`App.tsx`, dos `useState` sueltos:

```ts
const [rotation, setRotation] = useState<number>(0); // 0..3
const [mirror, setMirror] = useState<boolean>(false);
```

Y no son ocho consumidores sino **diez**. La cuenta de ocho es de antes del 022 y del 027, y las
líneas que citaba no existen más. Re-derivado sobre `App.tsx` de hoy —**por símbolo**, que es como
hay que citarlas de acá en adelante, porque el 018 y el 019 escriben este archivo antes que este
spec y cualquier número se corre otra vez:

| Consumidor (por símbolo) | Qué hace con ellos |
|---|---|
| los dos `useState` | `rotation` (`0..3`) y `mirror` |
| `transformedShape` (`useMemo`) | `rotateN` + `reflect` para el fantasma y la colocación |
| `noteSet` (`useMemo`) | `arpeggioFor(selected, rotation, mirror, regimen)` |
| `handleCellClick` | los guarda en el `PlacedPiece` nuevo |
| `rotarConTecla` (`useCallback`) | `setRotation((rotation + 1) % 4)` |
| `reflejarConTecla` (`useCallback`) | `setMirror(!mirror)` |
| `alRotar` (`useCallback`, **deps vacías**) | `setRotation(r => rotacionPorRueda(r, deltaY))` |
| `handleContextMenu` | `setMirror(m=>!m)` — es la mitad «botón derecho» de **AC2** |
| `orientacion` (**`useMemo`**, spec 027) | los baja a `PiecePalette` junto con `onRotate`/`onMirror` |
| `<Board rotation mirror>` | el `title` y el texto del fantasma |

Tres diferencias con la cuenta vieja, y las tres cambian trabajo:

1. **«El efecto de teclado» ya no existe en este archivo.** El 022 lo mudó a `useAtajosDeTeclado`
   (`components/use-input.ts`) y lo que queda del lado del shell son **dos** `useCallback`
   —`rotarConTecla` y `reflejarConTecla`—, que es lo que T009 reescribe. Lo mismo con «el efecto de
   la rueda»: quedó `useRuedaRota`, y del lado del shell sólo `alRotar`.
2. **`orientacion` es un `useMemo` y no un literal inline** desde el 027, con `rotation` y `mirror`
   en su array de dependencias y `OrientationPanel` envuelto en `memo` del otro lado. Es la mitad
   del spec que la cuenta vieja no podía ver, y es donde entra el campo nuevo del botón `0°`.
3. **Y hay una undécima superficie que no es de producción**: los fixtures de `PropsDeOrientacion`
   en `OrientationPanel.browser.test.tsx` y `PiecePalette.browser.test.tsx`, que arman
   `rotation: 0, mirror: false` a mano. El typecheck de T004 los enumera igual, pero no había tarea
   que los arreglara: la agrega T044.

**El que se escapa leyendo sigue siendo `handleContextMenu`.** No está en ningún `useMemo` ni en
ningún efecto: es una función suelta del cuerpo del componente, y es la única vía del gesto que AC2
nombra primero. La técnica del paso 2 —borrar los dos `useState` y dejar que el typecheck enumere—
lo atrapa igual, y por eso no es un bloqueante; pero enumerarlo acá es lo que evita que la tarea que
lo arregla quede sin escribir. No necesita nada nuevo: al ser una función del cuerpo, lee `selected`
sin pasar por dependencias.

Los diez pasan a leer `orientaciones[selected]` (o `orientaciones` entera, en el caso del `useMemo`
de `orientacion`). **Ninguno cambia de forma**, lo que cambia es de dónde sale el par — que es lo
que hace este spec barato pese a tocar diez lugares.

## 3. `PlacedPiece` ya resuelve la mitad difícil

```ts
// domain/types/board.types.ts, hoy
{ id, piece, rotation, mirror, cells, muted }
```

Una pieza colocada **ya lleva su propia orientación**, congelada en el momento del click. Por eso AC11
sale gratis: rotar la pieza en la mano nunca pudo cambiar lo que está en el tablero, y este spec no
abre esa puerta.

O sea que el modelo ya trataba la orientación como una propiedad de la pieza; el único lugar donde
seguía siendo global era la **pieza por colocar**, que es la que no tiene registro propio.

**AC5 tampoco cuesta un handler.** «Elegir una pieza restaura su orientación» cae solo: los ocho
consumidores pasan a leer `orientaciones[selected]`, así que cambiar `selected` ya los re-deriva.
Vale para las dos vías de selección —el `onSelect` de la paleta y la tecla de letra que agrega el
018, que también es un `setSelected` y nada más—, o sea que **el handler del 018 no se toca**. Lo
único que este spec le agrega a `App.tsx` en materia de escritura es el handler del botón `0°`.

## 4. Los dos efectos de entrada, y el que cambia de forma

> **Reescrita en el review.** Los dos efectos se fueron de `App.tsx` con el 022 y viven en
> `components/use-input.ts`. Y con ellos apareció **AC16 del 022**, que da vuelta la conclusión que
> esta sección tenía: la salida ya no es agregar `selected` a las dependencias.

**El teclado** — `useAtajosDeTeclado` declara `[rotar, reflejar, transporte, tapLimpio]`, o sea las
identidades de los tres callbacks del shell. El hook **no se toca**: lo que este spec reescribe son
`rotarConTecla` y `reflejarConTecla`, los dos `useCallback` que se los arman (T009). Con setter
funcional sobre la ranura de `selected`, sus dependencias quedan en `[selected]`.

**La rueda** es el caso interesante, y ahora por un motivo más fuerte. `useRuedaRota` se suscribe
**una sola vez por montaje** y su docblock lo dice explícito:

> Este efecto se suscribe UNA SOLA VEZ por montaje […]: acá no hay ningún valor que el handler tenga
> que leer. Del lado del shell eso obliga a que `alRotar` vaya envuelto en un `useCallback` de
> dependencias vacías […]; si algún día `alRotar` gana una dependencia, este listener pasa a
> re-suscribirse con ella y la cardinalidad que **AC16 del 022** protege se rompe.

Con memoria por pieza **sí hay** un valor que leer: el handler necesita saber *cuál* pieza está en la
mano. Y las dos salidas que esta sección listaba ya no son dos:

- **Agregar `selected` a las dependencias de `alRotar`** era la elegida. **Deja de estar disponible**:
  rompe AC16 del 022, que es una AC de un spec ya mergeado y no una preferencia. El argumento que la
  sostenía —«dos `addEventListener`, no es un costo»— sigue siendo cierto y ya no alcanza, porque lo
  que hay del otro lado ahora es un criterio escrito.
- **Un `selectedRef`.** Es la que queda. Y el reparo que esta sección le ponía —«esconde de dónde sale
  el valor»— hay que releerlo con lo que el 022 dejó: el `ref` va **nombrado y comentado** al lado de
  `alRotar`, así que de dónde sale `selected` se lee en el archivo; lo único que no hace es disparar
  una re-suscripción. La frase que se citaba en contra («la alternativa es un ref con el estado […],
  la optimización que este repo no necesita») es del docblock del efecto **del teclado**, que
  justamente sí se re-suscribe y puede darse el lujo.

Se usa el `ref`. Y el comentario de `alRotar` hay que **reescribirlo**, no dejarlo: hoy dice que su
cuerpo «usa el setter funcional y no lee `rotation`», y va a estar afirmando lo contrario de lo que
hace el código (T010, T011).

**Lo que NO es una salida**, y conviene dejarlo escrito porque parece una: resolver la ranura adentro
del setter funcional. `setOrientaciones(o => …)` recibe el `Record` anterior y nada más — no hay
ninguna forma de que sepa cuál es la pieza en la mano sin cerrar sobre `selected` o sin leer el
`ref`.

## 5. Dónde va el tipo `Orientacion`

Hay dos candidatos y uno es una trampa.

`domain/types/transform.types.ts` parece natural —la rotación y la reflexión son operaciones de
`transform.ts`— y además dejaría a `PlacedPiece` reusarlo en vez de repetir los dos campos inline. Pero
eso es un refactor de `domain/` que cruza el borde de paquete: `mcp-server/` importa 31 símbolos del
dominio, y aunque agregar un tipo sea aditivo, cambiar la forma de `PlacedPiece` no lo es.

`components/types/` es lo correcto: la **memoria** de las doce orientaciones es estado del shell, no
del modelo. El modelo ya tiene su representación y es `PlacedPiece`.

El valor inicial (`{ rotation: 0, mirror: false }`) va a `components/constants/`, porque los módulos de
este repo no declaran constantes.

**Y los dos archivos se llaman en inglés**: `types/orientation.types.ts` y
`constants/orientation.constants.ts`. Los 57 archivos de `src/` están en inglés y los siete que el
022 estrenó en castellano se revirtieron (`specs/revisiones.md`, 2026-08-20). La regla no es
simétrica: **archivo en inglés siempre; identificador en castellano sólo dentro de `components/`**,
donde hay 21 exportados así. O sea que el tipo se llama `Orientacion` y el archivo no.

## 6. La paleta con doce orientaciones independientes

`miniCells(key, rotation, mirror)` ya recibe la orientación por parámetro (spec 016), así que la
paleta pasa de llamarla doce veces con el mismo par a llamarla doce veces con doce pares. **La firma
no cambia.**

Y la caja fija de 5×5 del 016 pasa a ser **más** necesaria, no menos. Su docblock
(`src/components/piece-mini.ts:19`, sección «Por qué la caja es fija, y por qué mide 5») dice:

> La `I` pasa de 5×1 a 1×5 al rotar: con cajas ajustadas, los doce botones reflowearían en cada
> rotación.

El mismo argumento está en **`DESIGN.md:165`** —el bullet «La caja es fija, de 5×5 celdas»; esta
sección decía `:149` y el archivo mide hoy 313 líneas— y el número 5 se declara en
`src/components/constants/layout.constants.ts` (`MINI_BOX`), que son los tres lugares donde el
comentario de este spec tiene que quedar coherente.

Con rotación global eso pasaba en bloque y una vez por rotación. Con doce orientaciones independientes
podría pasar en cualquier momento y por una sola pieza. AC12 lo verifica.

## 7. La lectura de la orientación: por qué el 019 va primero

El spec 019 borra los botones de grados y agrega en su lugar una línea de texto que dice la
orientación, porque **29 de 96 orientaciones suenan distinto sin verse distinto** (6 de 12 piezas: `I T
U V W X`; el detalle está en `019/research.md` §3).

Esa línea es el único lector de la orientación después del 019, y este spec la vuelve **por pieza**:
pasa a decir la de la seleccionada y a cambiar al elegir otra (AC9). Es un cambio de una línea, y es
la razón por la que este spec va después del 019 y no antes: al revés, habría que escribir el lector
dos veces.

El botón `0°` va **acá** y no en el 019 porque sólo existe si hay memoria por pieza. O sea que el 019
saca botones del panel y el 020 devuelve uno — asimetría real, escrita en las dependencias del log.

### 7.1 Lo que ese botón le cuesta al alto, contra la base `main` + 019

El 019 mide su propio colchón así: la paleta baja de 520 a 470 px al borrar tres filas, su línea de
orientación devuelve ~20 px, y queda en ~490 px con **~30 px** de aire muerto en la tarjeta del
tablero. `CELL_PX` re-derivado da 73,1 por ancho contra ~76,3 por alto: manda el **ancho**, y `73`
sobrevive.

Este spec **no agrega una fila**: el `0°` va inline al lado de esa misma línea. Lo que crece es el
alto de esa fila —de texto (~20 px) a botón (`px-2 py-1` + borde, ~30 px como los que ya están)—, o
sea ~10 px de los ~30 que quedaban. Por cálculo el alto pasa a ~74,7 y el ancho sigue mandando con
73,1, así que `CELL_PX = 73` no se mueve. **Pero es cálculo, no medición**, y con ~20 px de colchón el
número dejó de tener margen: AC15 lo manda a medir en el DOM y T039 lo hace.

Nota para quien lea el 019: su tabla de riesgos **ya dice lo mismo que esta sección** —«el 020 no
devuelve el margen: su botón `0°` va *junto a* la línea de AC4 y no en una fila nueva, así que gasta
~10 px más (lo mide su AC15)»— y no hay nada que corregirle. Este párrafo decía lo contrario, que el
019 anotaba «el 020 devuelve el margen», y mandaba a buscar una discrepancia que no existe: el riesgo
de dejarlo era que alguien «arreglara» la fila del 019, que está bien. Lo que esta sección agrega es
el número: el 019 ya se había cobrado esos ~20 px con su propia línea
de AC4, y este spec **gasta**, no devuelve. El número que vale es el de acá.

## 8. Archivos afectados

Re-derivada en el review contra el árbol de hoy: la versión anterior era de antes del 022 y le
faltaban cinco archivos.

| Archivo | Qué cambia |
|---|---|
| `src/components/types/orientation.types.ts` | **nuevo** — `Orientacion`, `Rotacion` y el tipo de la memoria |
| `src/components/constants/orientation.constants.ts` | **nuevo** — `ROTACION`, la orientación inicial y la memoria inicial |
| `src/App.tsx` | Los dos `useState` → un `Record`; los diez consumidores de §2; los dos `useCallback` del teclado; `alRotar` + su `ref`; el `useMemo` de `orientacion`; el handler del botón `0°` |
| `src/components/types/panel.types.ts` | `PropsDeOrientacion` pierde `rotation`/`mirror` y gana `orientaciones` + el handler del `0°` (T008, T038) |
| `src/components/OrientationPanel.tsx` | Las doce miniaturas leen doce pares (`miniCells`, `aria-label`) — se mudaron acá con el 022 |
| `src/components/PiecePalette.tsx` | El botón `0°`; la línea de orientación del 019 lee `orientaciones[selected]` |
| `src/components/input.ts` | `rotacionPorRueda` pasa a `Rotacion` en los dos extremos (T041) |
| `src/components/constants/layout.constants.ts` | El docblock de `MINI_BOX` (T018). **Superficie compartida con el 019**, que reescribe en el mismo archivo el docblock de `CELL_PX` y verifica el de `MINI_CELL_PX`: son bloques distintos, pero el orden importa y el 019 va primero |
| `src/components/__tests__/OrientationPanel.browser.test.tsx` | Fixture de `PropsDeOrientacion`; AC3/AC4/AC12 mecánicos (T044, T045) |
| `src/components/__tests__/PiecePalette.browser.test.tsx` | Fixture de `PropsDeOrientacion` (T044) |
| `src/components/__tests__/` (proyecto `node`) | Test de `ORIENTACIONES_INICIALES` derivada de `SHAPES` (T046) |
| `docs/architecture/overview.md` | El diagrama (`:24`) y la tabla de estado (**`:122`–`:123`**, no `:104`–`:105`) declaran `rotation` `0..3` y `mirror` `boolean` como dos escalares del shell. Este spec los reemplaza por un `Record` |
| `DESIGN.md` | **`:158`–`:159`** (no `:142`) afirma que el botón se dibuja «en la orientación que está seleccionada ahora mismo» — singular y global. Pasa a ser la **suya** |

`domain/`, `audio/` y `mcp-server/` no se tocan.

Los dos de documentación no son alcance opcional: `docs/` y `DESIGN.md` son lo que este repo
**sí** mantiene al día —los specs mergeados no se reescriben, la desviación 2 de `specs/README.md`—,
así que dejarlos afirmando en presente algo que este spec falsifica es la deuda que los commits
`d936597` y `eb154a0` ya tuvieron que pagar en lote.

## 9. Riesgos

| Riesgo | Cuánto | Mitigación |
|---|---|---|
| Un consumidor de los ocho se queda leyendo el par viejo | **Alto si se hace a mano** | Borrar los dos `useState` **primero**: el typecheck marca los ocho. Es la misma técnica que el 017 usó al sacarle el default al parámetro del régimen |
| Doce orientaciones independientes vuelven la paleta ruidosa | Medio | Es información honesta y a pedido; la alternativa (mostrar las once en canónica) haría que el botón prometa una forma que al apretarlo no entrega |
| ~~El efecto de la rueda re-suscribe al cambiar de pieza~~ | **Ya no es una opción** | AC16 del 022 protege la suscripción única de `useRuedaRota`, así que `alRotar` **no puede** ganar una dependencia. La salida es un `selectedRef` nombrado y comentado (§4, T010, T011) |
| El fixture de `PropsDeOrientacion` de los dos tests de navegador deja de compilar | Cierto, no riesgo | Es la mitad del typecheck en rojo de T004 que cae en `__tests__/`. T044 lo arregla; sin esa tarea, T020 no puede dar verde |
| Estado invisible que sobrevive a `↺` | **Real, y aceptado** | Es la decisión de D3: `↺` conserva alcance único y la orientación tiene su propio botón. Queda escrito en el spec, no tapado |
| El comentario del efecto de la rueda queda mintiendo | Medio | Tarea explícita de reescribirlo. Un comentario que afirma lo contrario del código es peor que ninguno |

## 10. Lo que este spec le deja al 021

Nada que lo bloquee. El 021 mueve el panel a un dock flotante, y un panel con doce miniaturas que ya no
reflowean es más fácil de dimensionar que uno que cambia de alto al rotar.

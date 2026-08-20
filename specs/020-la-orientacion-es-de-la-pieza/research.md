# Research — Spec 020

Medido ejecutando `domain/transform.ts` y `domain/music.ts` reales con node, y leyendo `App.tsx` sobre
`main` con los specs 013–017 mergeados.

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

Y **ocho** consumidores, todos derivados de esos dos:

| Consumidor | Qué hace con ellos |
|---|---|
| `transformedShape` (`useMemo`, `App.tsx:101`) | `rotateN` + `reflect` para el fantasma y la colocación |
| `noteSet` (`useMemo`, `App.tsx:124`) | `arpeggioFor(selected, rotation, mirror, regimen)` |
| `handleCellClick` (`App.tsx:153`) | los guarda en el `PlacedPiece` nuevo |
| `PiecePalette` (props, `App.tsx:401`) | las doce miniaturas (`miniCells(key, rotation, mirror)`) |
| `Board` (props, `App.tsx:424`) | el `title` y el texto del fantasma |
| efecto de teclado (`App.tsx:306`) | `setRotation((rotation + 1) % 4)` y `setMirror(!mirror)` |
| efecto de la rueda (`App.tsx:361`) | `setRotation(r => rotacionPorRueda(r, e.deltaY))` |
| `handleContextMenu` (`App.tsx:374`) | `setMirror(m=>!m)` — es la mitad «botón derecho» de **AC2** |

**El octavo es el que se escapa leyendo.** `handleContextMenu` no está en ningún `useMemo` ni en
ningún efecto: es una función suelta del cuerpo del componente, y es la única vía del gesto que AC2
nombra primero. La técnica del paso 2 —borrar los dos `useState` y dejar que el typecheck enumere—
lo atrapa igual, y por eso no es un bloqueante; pero enumerarlo acá es lo que evita que la tarea que
lo arregla quede sin escribir. No necesita nada nuevo: al ser una función del cuerpo, lee `selected`
sin pasar por dependencias.

Los ocho pasan a leer `orientaciones[selected]`. **Ninguno cambia de forma**, lo que cambia es de
dónde sale el par — que es lo que hace este spec barato pese a tocar ocho lugares.

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

**El teclado** (`useEffect` con `[rotation, mirror, togglePlay]`) ya declara sus dependencias reales.
Pasa a `[orientaciones, selected, togglePlay]` o —mejor— a setters funcionales, que lo dejan en
`[selected, togglePlay]`.

**La rueda** es el caso interesante. Hoy se suscribe **una sola vez** y su comentario lo dice explícito:

> Con el setter funcional este efecto no depende de `rotation` y se suscribe una sola vez […]: acá no
> hay ningún valor que el handler tenga que leer.

Con memoria por pieza **sí hay**: el handler necesita saber *cuál* pieza está en la mano para escribir
en la ranura correcta. Dos salidas:

- **Agregar `selected` a las dependencias.** El efecto se re-suscribe al cambiar de pieza: doce valores
  posibles, dos `addEventListener` sobre un nodo. No es un costo.
- Un `selectedRef`. Suscribe una sola vez y **esconde de dónde sale el valor**, que es exactamente lo
  que `App.tsx` ya rechazó por escrito para el efecto del teclado: «la alternativa es un ref con el
  estado para suscribir una sola vez, que es la optimización que este repo no necesita».

Se agrega `selected`. Y el comentario del efecto de la rueda hay que **reescribirlo**, no dejarlo:
va a estar afirmando lo contrario de lo que hace el código.

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

## 6. La paleta con doce orientaciones independientes

`miniCells(key, rotation, mirror)` ya recibe la orientación por parámetro (spec 016), así que la
paleta pasa de llamarla doce veces con el mismo par a llamarla doce veces con doce pares. **La firma
no cambia.**

Y la caja fija de 5×5 del 016 pasa a ser **más** necesaria, no menos. Su docblock
(`src/components/piece-mini.ts:19`, sección «Por qué la caja es fija, y por qué mide 5») dice:

> La `I` pasa de 5×1 a 1×5 al rotar: con cajas ajustadas, los doce botones reflowearían en cada
> rotación.

El mismo argumento está en `DESIGN.md:149` —el bullet «La caja es fija, de 5×5 celdas»— y el número 5 se declara en
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

Nota para quien lea el 019: su tabla de riesgos anota «el 020 devuelve el margen al agregar una
línea». Con el `0°` inline eso no pasa — el 019 ya se había cobrado esos ~20 px con su propia línea
de AC4, y este spec **gasta**, no devuelve. El número que vale es el de acá.

## 8. Archivos afectados

| Archivo | Qué cambia |
|---|---|
| `src/components/types/` | `Orientacion` y el tipo de la memoria |
| `src/components/constants/` | La orientación inicial |
| `src/App.tsx` | Los dos `useState` → un `Record`; los ocho consumidores; los dos efectos; el handler del botón `0°` |
| `src/components/PiecePalette.tsx` | Las doce miniaturas leen doce pares; el botón `0°` y su prop; la línea del 019; salen las props `rotation` y `mirror` |
| `src/components/constants/layout.constants.ts` | El docblock de `MINI_BOX` (T018). **Superficie compartida con el 019**, que reescribe en el mismo archivo el docblock de `CELL_PX` y verifica el de `MINI_CELL_PX`: son bloques distintos, pero el orden importa y el 019 va primero |
| `docs/architecture/overview.md` | El diagrama (`:24`) y la tabla de estado (`:104`–`:105`) declaran `rotation` `0..3` y `mirror` `boolean` como dos escalares del shell. Este spec los reemplaza por un `Record` |
| `DESIGN.md` | `:142` afirma que el botón se dibuja «en la orientación que está seleccionada ahora mismo» — singular y global. Pasa a ser la **suya** |

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
| El efecto de la rueda re-suscribe al cambiar de pieza | Bajo | Doce valores posibles, dos `addEventListener`. Se elige eso antes que un ref que esconda de dónde sale `selected` |
| Estado invisible que sobrevive a `↺` | **Real, y aceptado** | Es la decisión de D3: `↺` conserva alcance único y la orientación tiene su propio botón. Queda escrito en el spec, no tapado |
| El comentario del efecto de la rueda queda mintiendo | Medio | Tarea explícita de reescribirlo. Un comentario que afirma lo contrario del código es peor que ninguno |

## 10. Lo que este spec le deja al 021

Nada que lo bloquee. El 021 mueve el panel a un dock flotante, y un panel con doce miniaturas que ya no
reflowean es más fácil de dimensionar que uno que cambia de alto al rotar.

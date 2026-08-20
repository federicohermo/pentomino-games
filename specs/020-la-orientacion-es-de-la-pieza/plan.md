# Plan — Spec 020

Cinco pasos. La técnica del paso 2 es la que hace barato el spec: **borrar los dos `useState`
primero** y dejar que el typecheck enumere los ocho consumidores, en vez de buscarlos a mano.

## Paso 1 — El tipo y el valor inicial

`components/types/`: `Orientacion` (`{ rotation: number; mirror: boolean }`) y el tipo de la memoria
(`Record<PieceKey, Orientacion>`).

`components/constants/`: la orientación inicial, y la memoria inicial derivada de `SHAPES` —no escrita
a mano con las doce letras, por lo mismo que el 018 valida contra `SHAPES` y no contra una lista: sería
otro lugar donde las doce están enumeradas y nada lo sincroniza.

`rotation` sigue siendo `number` y no un union acotado, y el motivo **no** es que acotarlo cruce el
borde de paquete: eso se midió y es falso. `rotateN(cells, n: number)` (`domain/transform.ts:29`),
`arpeggioFor(piece, rotation: number, …)` (`domain/music.ts:141`), `miniCells(piece, rotation: number,
…)` (`components/piece-mini.ts:42`) y `PlacedPiece.rotation` aceptan un `0|1|2|3` **sin cambiar una
sola firma** —un union es asignable a `number`—, así que acotar la rotación del lado del shell no
toca `domain/` ni el borde de paquete. Lo único que habría que convertir está todo en `components/`:
`rotacionPorRueda` (`components/input.ts:43`), que devuelve `number`, y el `(rotation + 1) % 4` del
efecto de teclado.

Se difiere igual, y por alcance, no por acoplamiento: saldar la deuda pide el const-object en
`components/constants/` + el union derivado en `components/types/` **y** la conversión de esos dos
productores, que es un segundo eje adentro de un spec que ya reescribe ocho consumidores. El costo de
diferirlo queda escrito: `Orientacion.rotation` es un lugar **más** donde la rotación es un `number`
sin acotar, y crear el tipo es justamente el momento más barato para acotarla. Si se decide saldarla,
entra acá y no en otro spec.

## Paso 2 — La memoria entra al shell, y el typecheck enumera el trabajo

En `App.tsx`, **borrar** los dos `useState` y poner en su lugar:

```ts
const [orientaciones, setOrientaciones] = useState(ORIENTACIONES_INICIALES);
```

A partir de ahí el typecheck marca los **ocho** consumidores del §2 del research. Se los arregla uno
por uno leyendo `orientaciones[selected]`:

- `transformedShape`, `noteSet`: el `useMemo` cambia sus dependencias a `[selected, orientaciones, …]`.
- `handleCellClick`: el `PlacedPiece` nuevo se arma con el par de la pieza en la mano.
- `PiecePalette`: recibe `orientaciones` entera (las doce miniaturas necesitan las doce), **no** el par
  de la seleccionada.
- `Board`: sigue recibiendo `rotation` y `mirror` sueltos, que son los de la pieza en la mano — no
  necesita las doce.
- `handleContextMenu`: escribe una sola ranura, igual que los dos efectos. Es el consumidor que no
  está en ningún efecto ni `useMemo` —una función suelta del cuerpo— y es la mitad «botón derecho» de
  AC2, o sea el más fácil de olvidar y el que más se nota olvidado. Al ser del cuerpo lee `selected`
  sin tocar dependencias.

- **El handler del botón `0°`**: es el noveno escritor y no existe hoy, porque hoy no hay nada que
  resetear por pieza. Escribe una sola ranura con `ORIENTACION_INICIAL` y baja a `PiecePalette` como
  prop. Sin él AC7 no tiene implementación: el componente es presentacional y el 019 justamente le
  saca `onRotate` y `onMirror`, así que no queda ninguna prop de gesto que reusar.

Un derivado local (`const { rotation, mirror } = orientaciones[selected]`) mantiene el resto del
archivo legible sin re-escribir cada uso.

**Los dos efectos:**

- **Teclado**: `setRotation((rotation + 1) % 4)` pasa a un setter funcional que escribe una sola ranura.
  Las dependencias quedan en `[selected, togglePlay]`.
- **Rueda**: agrega `selected` a las dependencias y **su comentario se reescribe**. Hoy afirma que «acá
  no hay ningún valor que el handler tenga que leer», y con este spec lo hay. Un comentario que dice lo
  contrario del código es peor que ninguno — y este repo lo trata así.

Los dos escriben con setter funcional sobre el `Record`, y siempre con objeto nuevo:

```ts
setOrientaciones(o => ({ ...o, [selected]: { ...o[selected], rotation: … } }));
```

Nunca `o[selected].rotation = …`: no se muta lo que ya se entregó a React, que es la misma regla que
`handleCellClick` sigue con `placed`.

## Paso 3 — La paleta muestra doce orientaciones

`PiecePalette.tsx`:

- `miniCells(key, rotation, mirror)` pasa a llamarse con el par de **cada** pieza. La firma no cambia.
- El `aria-label` de cada botón ya dice la orientación (`F, rotación 180°, reflejada`) y ahora dice la
  **suya**, que es lo que el lector de pantalla necesita cuando cada botón muestra algo distinto.
- La línea de orientación que agregó el 019 pasa a leer la de la seleccionada (AC9).
- El botón `0°`, al lado de esa línea, cableado a una **prop nueva** —`PiecePalette` es presentacional
  y el handler vive en `App.tsx` (paso 2)—, con `aria-label` y `title` que digan las dos cosas que
  hace («Orientación de F a 0°, sin reflejar»), porque la etiqueta sólo dice los grados.
- `rotation` y `mirror` **salen** de las props: con `selected` + `orientaciones` los tres lectores del
  componente ya tienen de dónde leer, y dejarlas sería una segunda fuente de la misma verdad.

`0°` **no** va en la fila de transporte: no es transporte, y ahí está el `↺` con el que no se puede
confundir pero sí compartir vecindad.

## Paso 4 — Verificar que `↺` no toca las orientaciones

`resetBoard` **no se toca**. El paso existe igual, porque es un criterio de aceptación (AC8) y porque
es la decisión que más fácil se «arregla» sin querer: alguien que lea `resetBoard` y vea que existe
`ORIENTACIONES_INICIALES` va a querer usarla ahí.

Se le agrega el comentario que dice por qué **no**: `↺` tiene un alcance único y nombrable —las piezas
colocadas— y el estado de orientación tiene su propio botón. Con el costo escrito: se renuncia al
invariante «después de `↺` la app queda como recién abierta».

## Paso 5 — Los dos documentos que lo afirman en presente

`docs/architecture/overview.md` declara el estado del shell como dos escalares (`:24` y `:104`–`:105`)
y `DESIGN.md:142` dice que el botón se dibuja «en la orientación que está seleccionada ahora mismo».
Los dos quedan falsos con este spec, y los dos son de lo que este repo mantiene al día — el spec
mergeado no se reescribe, la documentación sí. No cambia código: es el mismo movimiento de `d936597`
y `eb154a0`, adelantado a su spec en vez de acumulado.

## Verificación

`pnpm verify`, más tests de las puras que se agreguen. Lo que sólo se puede ver en el navegador y va
como `[M]`: que las once miniaturas no se muevan (AC3), que volver a una pieza restaure su orientación
(AC5), que la grilla no reflowee con las doce en orientaciones distintas (AC12) —que es la que
necesita ponerlas a las doce en ángulos distintos a propósito—, y **medir `CELL_PX` en el DOM con el
botón `0°` puesto** (AC15), que es la no-regresión sobre lo que este spec comparte con el 019: el
colchón de alto quedó en ~30 px y este botón gasta parte de eso.

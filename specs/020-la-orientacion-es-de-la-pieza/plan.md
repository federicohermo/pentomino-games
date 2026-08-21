# Plan — Spec 020

Cinco pasos. La técnica del paso 2 es la que hace barato el spec: **borrar los dos `useState`
primero** y dejar que el typecheck enumere los consumidores, en vez de buscarlos a mano. Son **diez**
en producción más los dos fixtures de test, re-derivados en el review contra el árbol de hoy: la
cuenta de ocho del research era de antes del 022 y del 027 (§2).

## Paso 1 — El tipo y el valor inicial

`components/types/orientation.types.ts`: `Orientacion` (`{ rotation: Rotacion; mirror: boolean }`),
el union `Rotacion` y el tipo de la memoria (`Record<PieceKey, Orientacion>`).

`components/constants/orientation.constants.ts`: el const-object `ROTACION`, la orientación inicial, y
la memoria inicial derivada de `SHAPES` —no escrita a mano con las doce letras, por lo mismo que el 018
valida contra `SHAPES` y no contra una lista: sería otro lugar donde las doce están enumeradas y nada
lo sincroniza.

**Los dos archivos se llaman en inglés.** Los 57 archivos de `src/` lo están, y los siete que el 022
estrenó en castellano se revirtieron (`specs/revisiones.md`, 2026-08-20). La regla no es simétrica:
archivo en inglés siempre, identificador en castellano sólo dentro de `components/`. `Orientacion`,
`Rotacion` y `ROTACION` son identificadores y se quedan en castellano.

**`rotation` se acota acá, no se difiere.** Este paso decía lo contrario y la decisión se dio vuelta
—AC16, T003, T041, T043—, así que el argumento que sostiene lo que hoy hay que hacer es éste:

- **No cruza el borde de paquete**, y está medido. `rotateN(cells, n: number)`
  (`domain/transform.ts:29`), `arpeggioFor(piece, rotation: number, …)` (`domain/music.ts:141`),
  `miniCells(piece, rotation: number, …)` (`components/piece-mini.ts:42`) y `PlacedPiece.rotation`
  aceptan un `0|1|2|3` **sin cambiar una sola firma** —un union es asignable a `number`—, así que
  `mcp-server/` ni se entera.
- **Lo único que hay que convertir está todo en `components/`**: `rotacionPorRueda`
  (`components/input.ts:44` — verificado hoy; este paso decía `:43`), cuyo `(rotation + 4 + delta) % 4`
  **ya es** la normalización y no cambia de cuerpo, y el `(rotation + 1) % 4` de `rotarConTecla`.
- **Y este spec crea el hogar del tipo**: estrenar `orientation.types.ts` con un `number` sin acotar
  sería replicar la deuda en un archivo nuevo teniendo el const-object al lado, que es peor que
  dejarla donde estaba.

No cierra la deuda de `specs/deuda.md` —`domain/` sigue tomando `number`, y ese tramo es el que cruza
el borde— pero cierra la **vía**: con la fuente acotada, `domain/` no puede recibir un valor fuera de
`0..3` desde acá. T043 lo deja escrito al lado de `Rotacion` y T031 pone al día la entrada de la deuda
con el alcance nuevo.

## Paso 2 — La memoria entra al shell, y el typecheck enumera el trabajo

En `App.tsx`, **borrar** los dos `useState` y poner en su lugar:

```ts
const [orientaciones, setOrientaciones] = useState(ORIENTACIONES_INICIALES);
```

A partir de ahí el typecheck marca los **diez** consumidores del §2 del research —más los dos
fixtures de `PropsDeOrientacion` de `__tests__/`, que caen en la misma pasada (T044)—. Se los arregla
uno por uno leyendo `orientaciones[selected]`:

- `transformedShape`, `noteSet`: el `useMemo` cambia sus dependencias a `[selected, orientaciones, …]`.
- `handleCellClick`: el `PlacedPiece` nuevo se arma con el par de la pieza en la mano.
- `PiecePalette`: recibe `orientaciones` entera (las doce miniaturas, que desde el 022 dibuja
  `OrientationPanel.tsx`, necesitan las doce), **no** el par de la seleccionada. Ojo con la forma: el
  objeto `orientacion` **no es un literal inline**, es un `useMemo` desde el 027 —la otra mitad del
  `memo` de `OrientationPanel`, medido en 4,9 ms → 1,9 ms por escritura de `hover`—, así que lo que
  cambia es su cuerpo **y su array de dependencias**, que pierde `rotation`/`mirror` y gana
  `orientaciones`. Lo verifica `react-hooks/exhaustive-deps` en el lint.
- `Board`: sigue recibiendo `rotation` y `mirror` sueltos, que son los de la pieza en la mano — no
  necesita las doce.
- `handleContextMenu`: escribe una sola ranura, igual que los dos efectos. Es el consumidor que no
  está en ningún efecto ni `useMemo` —una función suelta del cuerpo— y es la mitad «botón derecho» de
  AC2, o sea el más fácil de olvidar y el que más se nota olvidado. Al ser del cuerpo lee `selected`
  sin tocar dependencias.

- **El handler del botón `0°`**: es el único escritor que no existe hoy, porque hoy no hay nada que
  resetear por pieza. Escribe una sola ranura con `ORIENTACION_INICIAL` y baja a `PiecePalette` como
  un campo más de `PropsDeOrientacion`, escrito adentro del `useMemo` de `orientacion` como los otros
  cuatro handlers. Sin él AC7 no tiene implementación: el componente es presentacional y el 019 justamente le
  saca `onRotate` y `onMirror`, así que no queda ninguna prop de gesto que reusar.

Un derivado local (`const { rotation, mirror } = orientaciones[selected]`) mantiene el resto del
archivo legible sin re-escribir cada uso.

**Los dos efectos:**

- **Teclado**: `setRotation((rotation + 1) % 4)` pasa a un setter funcional que escribe una sola ranura.
  Las dependencias quedan en `[selected, togglePlay]`.
- **Rueda**: `alRotar` **se queda con dependencias vacías** y lee `selected` de un `selectedRef`
  nombrado y comentado. Agregarle `selected` a las dependencias —que era lo que este paso decía— rompe
  la suscripción única de `useRuedaRota`, que es **AC16 del 022** y no una preferencia. Su comentario
  se reescribe igual: hoy afirma que el cuerpo «usa el setter funcional y no lee `rotation`», y con
  este spec sí necesita saber qué ranura rotar. Un comentario que dice lo contrario del código es peor
  que ninguno — y este repo lo trata así. **No sirve** resolver la ranura adentro del setter funcional:
  `setOrientaciones(o => …)` recibe el `Record` anterior y nada más.

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

`docs/architecture/overview.md` declara el estado del shell como dos escalares (`:24` y
**`:122`–`:123`**, no `:104`–`:105`) y **`DESIGN.md:158`–`:159`** (no `:142`) dice que el botón se
dibuja «en la orientación que está seleccionada ahora mismo».
Los dos quedan falsos con este spec, y los dos son de lo que este repo mantiene al día — el spec
mergeado no se reescribe, la documentación sí. No cambia código: es el mismo movimiento de `d936597`
y `eb154a0`, adelantado a su spec en vez de acumulado.

## Verificación

`pnpm verify`, más tests. Y «más tests» dejó de ser opcional: desde el 029 `suite` exige **coverage
100 en las cuatro métricas** y **cero `/* v8 ignore */`**, así que lo que este spec agregue viene con
su prueba o no mergea. Tres cosas concretas, que son T044–T046:

- Los fixtures de `PropsDeOrientacion` de `OrientationPanel.browser.test.tsx` y
  `PiecePalette.browser.test.tsx` **dejan de compilar** con T008 y hay que reescribirlos: es la parte
  del typecheck en rojo del paso 2 que cae en `__tests__/`.
- **AC3, AC4 y AC12 tienen contraparte mecánica** y dos ya existen a medias en
  `OrientationPanel.browser.test.tsx` («el nombre accesible dice la orientacion ACTUAL» y «rotar NO
  mueve un pixel de la grilla»): se extienden de un par para las doce a doce pares distintos.
- **AC6** se verifica sobre `ORIENTACIONES_INICIALES` en el proyecto `node`, que es lo que atrapa que
  la derivación desde `SHAPES` se rompa.

Lo que sólo se puede ver en el navegador y va como `[M]` —ahora como confirmación a ojo de lo que los
tests de arriba ya afirman, no como única prueba—: que las once miniaturas no se muevan (AC3), que volver a una pieza restaure su orientación
(AC5), que la grilla no reflowee con las doce en orientaciones distintas (AC12) —que es la que
necesita ponerlas a las doce en ángulos distintos a propósito—, y **medir `CELL_PX` en el DOM con el
botón `0°` puesto** (AC15), que es la no-regresión sobre lo que este spec comparte con el 019: el
colchón de alto quedó en ~30 px y este botón gasta parte de eso.

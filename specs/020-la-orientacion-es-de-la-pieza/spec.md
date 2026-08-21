# Spec 020 — La orientación es de la pieza

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **No cambia una nota** de lo que ya está en el tablero: `PlacedPiece` guarda su propia rotación y su
> propia reflexión desde siempre, y este spec no la toca. Lo que cambia es la pieza **por colocar**.
>
> **Medido: hoy rotar una pieza mueve 11 de las 12 miniaturas de la paleta.**

## Problema

La rotación y la reflexión no son de la pieza: son del **instrumento**. Hay un solo `rotation` y un
solo `mirror` en el shell, y valen para las doce.

La consecuencia se ve en la paleta, y está medida:

```
0° → 90°     cambian 11/12 miniaturas   (la única quieta es la X, que es simétrica)
90° → 180°   cambian 11/12
180° → 270°  cambian 11/12
270° → 0°    cambian 11/12
reflejar     cambian 8/12               (quietas: I T U X)
```

O sea que girar la rueda para acomodar una `F` **reorienta las otras once sin que nadie lo haya
pedido**, y la orientación que queda no es la que vos elegiste para esa pieza: es la que dejó la última
pieza que tocaste. Elegir `T` después de haber trabajado con `F` a 180° te da una `T` a 180° que nunca
pediste.

Es exactamente al revés de cómo se usa el instrumento. La orientación es una decisión **sobre una
pieza**: la `L` acostada y la `V` mirando a la izquierda son cosas distintas, y no hay ninguna razón
por la que decidir una tenga que decidir la otra.

## Solución Propuesta

**Cada una de las doce piezas recuerda su propia orientación.**

```
rotation: number  +  mirror: boolean          →   Record<PieceKey, Orientacion>
(uno para las doce)                               (uno por pieza)
```

- Rotar o reflejar cambia **sólo la pieza en la mano**. Las otras once no se mueven.
- Elegir una pieza **restaura** su orientación recordada. Volver a `F` la trae como la dejaste.
- Las doce arrancan a 0° sin reflejar, así que abrir la app se ve como hoy.
- Un botón `0°` devuelve **la pieza en la mano** —y sólo esa— a 0° sin reflejar.

### Por qué memoria y no «se resetea al elegir otra»

Las dos arreglan la queja. La diferencia es qué instrumento queda: con memoria podés dejar preparadas
doce orientaciones y alternar entre ellas sin volver a rotar, que es una forma de tocar; con reset,
cada cambio de pieza borra trabajo y la única forma de volver a una orientación es rehacerla.

Para un instrumento, la pregunta es cuál lo vuelve más expresivo, y es la primera.

### Por qué el botón `0°` resetea sólo la seleccionada

Lo que hoy te deja las doce mal de golpe es **precisamente la rotación global que este spec borra**.
Con memoria por pieza eso no puede volver a pasar: si la `T` está a 90°, es porque rotaste la `T`.

Lo que sí sigue pasando es pasarse de vuelta con la rueda sobre la que tenés en la mano — y para eso el
botón es de una sola pieza. Un «resetear las doce» perdió su caso de uso en el mismo movimiento que lo
haría posible.

### Por qué `0°` y no un icono

Al lado va a haber un `↺` (spec 019), y dos botones de «volver atrás» tienen que decir cosas distintas
de un vistazo. `0°` dice literalmente adónde te lleva, recupera el vocabulario de los botones de grados
que el 019 borra, y es tipográficamente incompatible con `↺`.

Resetea la **orientación entera** —rotación *y* reflexión—, no sólo los grados: una `X` reflejada suena
distinto y no se ve (29 de 96 orientaciones, spec 019 §3), así que un botón que la dejara «a 0° pero
reflejada» dejaría vivo justo el estado invisible. Que la etiqueta diga sólo los grados no engaña,
porque la línea de orientación que el 019 puso al lado dice las dos cosas y cambia junto con el botón.

### Qué NO hace `↺`

**`↺` no toca las orientaciones recordadas.** Vacía el tablero y frena el transporte, como siempre.

Es una decisión con un costo escrito: se renuncia al invariante «después de `↺` la app queda como
recién abierta». A cambio, `↺` conserva un alcance único y nombrable —**las piezas colocadas**— en vez
de convertirse en un botón que hace dos cosas de dominios distintos. El estado de orientación tiene su
propio botón, y es el de al lado.

## Criterios de Aceptación

- **AC1** — Rotar con la rueda o con `Shift` cambia sólo la orientación de la pieza seleccionada.
- **AC2** — Reflejar con el botón derecho o con `Ctrl` cambia sólo la de la pieza seleccionada.
- **AC3** — Las once miniaturas que no están seleccionadas **no se mueven** al rotar o reflejar.
- **AC4** — Cada miniatura de la paleta se dibuja en **su propia** orientación recordada.
- **AC5** — Elegir una pieza restaura su orientación: con `F` a 180°, ir a `T` y volver a `F` la deja
  a 180°.
- **AC6** — Al cargar, las doce están a 0° sin reflejar.
- **AC7** — El botón `0°` deja la pieza seleccionada a 0° sin reflejar, y **no toca** las otras once.
- **AC8** — `↺` vacía el tablero y frena el transporte, y **no** cambia ninguna orientación recordada.
- **AC9** — La línea de orientación del 019 dice la de la pieza seleccionada, y cambia al elegir otra.
- **AC10** — El fantasma del tablero, el arpegio del panel y la pieza que se coloca usan los tres la
  orientación de la pieza en la mano — o sea, ninguno se puede desincronizar.
- **AC11** — Las piezas ya colocadas conservan la orientación con la que se colocaron. Rotar la pieza
  en la mano no cambia ni una nota de lo que está en el tablero.
- **AC12** — La grilla de doce botones **no reflowea** al rotar, con las doce en orientaciones
  distintas. Es la caja fija de 5×5 del spec 016 haciendo su trabajo, ahora con doce formas
  independientes en vez de doce iguales.
- **AC13** — La decisión de cada gesto sigue viviendo en puras testeadas en `environment: 'node'`.
- **AC14** — No hay estado global: la memoria vive en `App.tsx` y baja por props.
- **AC15** — `CELL_PX` sigue midiendo **73** en el DOM, y la medición se toma **con el botón `0°` ya
  puesto**. Es el AC de no-regresión sobre la superficie que este spec comparte con el 019: el 019
  deja el colchón de alto de la tarjeta del tablero en ~30 px —bajó de 50 al borrar tres filas y
  recuperó ~20 con su línea de orientación (019 §AC9)— y este spec mete un botón en esa misma fila,
  o sea que gasta parte de lo poco que queda. `73` sobrevive por cálculo (el que manda sigue siendo
  el **ancho**, 73,1) pero es la primera vez que el número no tiene margen, así que se mide y no se
  afirma. Si la medición da otra cosa, el `0°` baja a una fila propia antes que `CELL_PX` cambie.
- **AC16** — `Orientacion.rotation` es un union acotado (`Rotacion`, derivado del const-object
  `ROTACION`), **no** un `number`. Es falsable de dos formas y las dos son mecánicas: asignarle un `5`
  a una ranura del `Record` **no compila**, y `pnpm lint` no reporta ningún `enum` (`erasableSyntaxOnly`
  lo rechaza y la deuda lo dejó excluido por escrito). No cierra la deuda de la rotación sin acotar
  —`domain/` sigue tomando `number` y ese tramo cruza el borde de paquete— pero **sí** cierra la vía:
  con la fuente acotada, `domain/` no puede recibir un valor fuera de `0..3` desde acá.

## Límites de Alcance

- **No toca `domain/`.** `PlacedPiece` ya guarda su rotación y su reflexión; `transform.ts`, `music.ts`
  y `sequence.ts` no se enteran. **No cruza el borde de paquete.**
- **No agrega persistencia.** Cerrar la pestaña olvida las doce orientaciones, como olvida el tablero.
- **No agrega teclas para ir a un ángulo concreto.** El 018 lo dejó anotado como fuera de alcance
  justamente hasta que este spec decidiera si la rotación es global o por pieza; ahora que se sabe,
  sigue siendo otro spec.
- **No unifica el tipo con `PlacedPiece`.** Los dos llevan `rotation` y `mirror` y la tentación es
  compartir un tipo de `domain/`; eso es un refactor de dominio con alcance cruzando el borde de
  paquete y beneficio cero de comportamiento. Queda como seguimiento.
- **No cambia el layout.** Eso es el 021 — «layout» acá quiere decir **dónde va cada tarjeta**: los
  `col-span`, el dock flotante, la pantalla completa. Lo que este spec **sí** toca es el alto de la
  paleta, porque le agrega un botón; eso no es alcance opcional y lo cubre **AC15**.

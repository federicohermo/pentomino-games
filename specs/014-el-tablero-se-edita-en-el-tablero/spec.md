# Spec 014 — El tablero se edita en el tablero

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **Borra `PlacedList.tsx` entero** y con él la única superficie que decía en qué orden visita el
> circuito a cada pieza. **Cambia lo que suena** en todo tablero que tenga una pieza muteada, y
> **cambia el layout de la app**: `CELL_PX` pasa de 63 a 71, medido.
>
> Depende del [013](../013-control-directo/spec.md), que reserva `Alt`.

## Problema

**El tablero es de solo lectura.** Se puede poner una pieza, y nada más: para sacarla hay que ir al
panel derecho, encontrar su tarjeta entre las 12 y apretar `Quitar`. La pieza está ahí, en pantalla, y
la operación más simple que se le puede hacer vive a 800 px de distancia y en otro idioma — una lista
ordenada por el circuito, donde la pieza que uno quiere sacar no está en el lugar donde uno la puso.

Y hay una operación que directamente no existe: **apagar una pieza sin sacarla**. Hoy toda pieza
colocada suena, así que la única forma de escuchar el tablero sin ella es quitarla — y quitarla
**cambia el circuito**, porque el recorrido pasa a visitar una pieza menos y se reordena. O sea que
"¿cómo suena esto sin la `N`?" no se puede contestar: la pregunta cambia la respuesta.

`PlacedList` además ya no tiene mucho que decir. Muestra las notas —que el tablero pinta celda por
celda desde el 007—, las celdas en coordenadas crudas —`(3,3) (2,2) (3,2)…`—, y el orden del circuito.
De las tres, las dos primeras son repetición.

## Solución Propuesta

**El tablero se edita en el tablero.** Sobre una pieza ya colocada, y solo con **esa misma pieza
seleccionada** en la paleta:

| Gesto | Sobre una pieza colocada | Sobre una celda vacía |
|---|---|---|
| Click | **Quita** la pieza | Coloca (como hoy) |
| `Alt`+click | **Mutea / desmutea** la pieza | Coloca **muteada** |

Una pieza muteada **sigue estando**: ocupa sus cinco celdas, sigue siendo un nodo del circuito, sigue
gastando su tiempo. Lo que no hace es sonar sus notas — con los clicks encendidos suena un click por
celda, igual que una celda vacía que el recorrido pisa.

Y `PlacedList.tsx` se borra.

### Decisiones de diseño

**D1 — El click quita y `Alt`+click mutea, y no al revés.**
Se evaluó la variante contraria —el click mutea, y el quitar se muda a un basurero que aparece en la
esquina al hacer hover sobre una pieza muteada con la misma pieza seleccionada— y se descarta por dos
razones concretas:

1. Deja a **quitar** alcanzable únicamente *a través de* mutear. Para borrar una pieza que nunca se
   quiso mutear hay que mutearla primero, o sea cambiar su estado para llegar a otra operación.
2. Son tres condiciones simultáneas (muteada + hover + misma pieza) para descubrir la operación más
   básica del tablero, sobre una baldosa que ya carga la nota a 19 px, el `#N` en la esquina inferior
   derecha y el velo de la cabeza lectora encima.

Con el reparto elegido las dos operaciones cuestan un gesto, y la destructiva es además casi
reversible: con la misma pieza y la misma orientación seleccionadas, volver a clickear la repone en el
mismo lugar.

**D2 — La llave es «la misma pieza seleccionada», y se mide sobre la celda clickeada.**
La regla exacta: el gesto edita si la celda clickeada está ocupada por una pieza cuyo `piece` es igual
a `selected`. No es «la jugada es inválida» —eso también pasa al chocar contra una pieza distinta, y
ahí no tiene que pasar nada— y no es «hay alguna pieza de ese tipo en el tablero».

Es lo que evita que editar sea un accidente: para tocar la `N` hay que tener la `N` en la mano. Y con
dos `N` colocadas, `occupantAt` devuelve la que se clickeó, así que se edita esa y no la otra.

**D3 — Una pieza muteada emite clicks, no un `Step` con las notas apagadas.**
`buildSequence` deja de emitir un `Step` para la pieza muteada y emite en su lugar **cinco `Click`s**,
uno por celda, en los mismos offsets que habrían tenido sus cinco notas. El largo del ciclo y el
recorrido no cambian ni un intervalo.

Esto sale de `Click`, que ya tiene exactamente la forma que hace falta: `{ offset, cell, note? }`, con
la ausencia de `note` significando "esa celda estaba vacía". Una celda muteada **es** una celda que el
recorrido pisa y no tiene nota que dar, así que reusa el caso que ya existe en vez de inventar un
tercero. La alternativa —un `Step` con `muted: true` y las notas adentro— deja al motor decidiendo si
suena algo que ya está en el mensaje, que es justo el reparto que `.claude/rules/audio.md` no quiere.

Consecuencia que hay que resolver, no ignorar: `route-source.ts` arma su velo de "todavía no se
estrenó" a partir de `s.steps` (`porPieza`), así que una pieza sin `Step` se queda sin velo. Está en
`research.md` §5 con las dos salidas.

La regla vale también hacia adentro: **un tramo que CRUZA una pieza muteada tampoco suena su nota.**
`clickEn` (`sequence.ts:129`) le pone `note` al click de cruce leyendo `noteAtCell` del ocupante — es
la floritura del 011, y sobre una pieza muteada esa floritura es exactamente la nota que el muteo
apagó. El cruce no desaparece: sigue siendo un click, mudo, igual que sobre una celda vacía. Sin esa
condición AC7 es falso en el 32 % de los tableros de tres piezas, que es donde el 011 midió que el
cruce sobrevive (`research.md` §9).

Y hacia el otro borde: `buildSequence` tiene un **retorno temprano para `n === 1`**
(`sequence.ts:320-326`) que arma su `Step` sin pasar por el bucle. Una implementación que solo toque el
bucle deja al único tablero enteramente muteado —el de una sola pieza— como el único que suena.

**D4 — La pieza muteada se ve con la baldosa BLANCA, conservando la nota y el `#N`.**
Los dos canales obvios estaban tomados y las reglas del tablero los protegen:

- **El color no puede ser el canal**: es identidad de pieza, nunca estado (`DESIGN.md`), y los 12 pares
  `bg`/`fg` están medidos en contraste con un test que los sostiene. Desaturarlos rompe la medición.
- **La opacidad tampoco**: es lo que `Playhead.tsx` usa para el velo de "esta celda no se estrenó". Si
  muteado también atenuara, una pieza muteada recién colocada sería indistinguible de una esperando su
  turno.

El canal elegido es **la ausencia de color**: la baldosa cae al blanco de una celda libre y **conserva
la nota y el `#N`**. Dice exactamente lo que pasó —esta pieza dejó de afirmar que suena, pero sigue
siendo esta pieza, en estas celdas, con estas notas y estos pasos— sin inventar un símbolo nuevo ni
gastar la opacidad.

El texto **no** puede seguir usando `PIECE_COLOR[piece].fg`: ese valor está elegido contra el `bg` de
su pieza, y sobre blanco varios son ilegibles (el `fg` de `V`, el de `F`). La celda muteada usa el gris
oscuro del tablero, que es el mismo que ya usa una celda libre.

**D5 — El orden del circuito no se repone en ningún lado.**
`PlacedList` era el único lugar donde se leía que una pieza es la 3ª del recorrido, y con él ese dato
desaparece. Se evaluó mudarlo a una insignia sobre la celda de entrada de cada pieza y se descarta: no
hay razón para que el usuario tenga que ver el orden. El instrumento se escucha, y desde el spec 010 la
cabeza lectora lo muestra recorriéndolo. Un número estático además decía el circuito **pendiente** y no
el que suena —el propio `PlacedList` lo documenta— así que podía contradecir a lo que se estaba oyendo.

**D6 — De las dos columnas que quedan libres, una va al tablero y otra a la paleta. Medido.**
Hoy el reparto es paleta 3 / tablero 7 / lista 2, y `CELL_PX` está clavado en 63 porque lo limita el
**ancho** (633,3 px de interior dan 63,3 por celda, contra 71,6 disponibles de alto).

Medido en el navegador moviendo `gridColumn` inline:

| Reparto | Tablero interior | `CELL_PX` | Paleta |
|---|---|---|---|
| 3 / 7 (hoy, con la lista) | 633,3 × 429,6 | **63** (ancho) | 252 |
| 3 / 9 | 828,0 × 429,6 | **71** (alto) | 252 |
| **4 / 8** | 730,7 × 429,6 | **71** (alto) | **349,3** |
| 5 / 7 | 633,3 × 429,6 | 63 (ancho) | 446,7 |

A partir de `col-span-8` el que limita pasa a ser el **alto**, así que **la novena columna no le compra
un solo píxel al tablero**. Va a la paleta, que la necesita para el spec 016: 252 → 349,3 px de
interior.

Y hay un segundo efecto medido: si la paleta crece de alto —que es exactamente lo que el 016 le va a
hacer—, el tablero crece con ella y `CELL_PX` llega a **73**. Este spec deja 71; el 016 lo vuelve a
medir.

**D7 — `muted` va en `PlacedPiece`, y ahí no contradice al docblock del tipo.**
`PlacedPiece` sacó su campo `notes` justamente por ser derivable. `muted` **no lo es**: no sale de la
pieza, ni de la rotación, ni de las celdas — sale de un gesto, igual que `cells`. Es el mismo argumento
que el tipo ya tiene escrito para `cells`, aplicado a un campo nuevo.

Cruza el borde de paquete: `mcp-server/src/tools/simulateBoard.ts` construye `PlacedPiece` y va a
dejar de compilar hasta que lo contemple (`research.md` §6). Es deseable que falle así — `pnpm verify`
typechequea cruzando el borde, que es la red que `CLAUDE.md` describe.

**D8 — `Alt`+click sobre una celda vacía coloca la pieza ya muteada.**
`Alt` significa "muteado" en los dos lados del gesto, y sirve: mete una pieza al circuito por su
**espacio y su tiempo** —mueve el orden de visita y agrega distancia— sin agregar cinco notas. Es la
única forma de componer con silencio en un instrumento donde hoy toda pieza colocada suena.

**D9 — El arpegio de cortesía no suena al colocar muteada.**
Colocar dispara `playNow(noteSet)` con el transporte parado, que es el único modo de escuchar la pieza
recién puesta. Colocar **muteada** no lo dispara: la pieza se está poniendo justamente para que no
suene, y un arpegio de cortesía contradiría el gesto en el momento exacto de hacerlo.

## Criterios de Aceptación

- **AC1** — Click sobre una celda ocupada **con la misma pieza seleccionada** quita esa pieza. Con dos
  piezas del mismo tipo colocadas, quita la clickeada (D2).
- **AC2** — Click sobre una celda ocupada **con otra pieza seleccionada** no hace nada, como hoy.
- **AC3** — `Alt`+click sobre una celda ocupada con la misma pieza seleccionada **alterna** el muteo, y
  con otra pieza seleccionada no hace nada.
- **AC4** — `Alt`+click sobre una celda vacía coloca la pieza **muteada** (D8) y **no** dispara el
  arpegio de cortesía (D9).
- **AC5** — **Una pieza muteada no cambia el circuito**: mismo orden de visita, mismos offsets y mismo
  `length` que la misma pieza sin mutear. Con test sobre `buildSequence`, comparando las dos secuencias
  campo por campo salvo por lo que D3 cambia.
- **AC6** — Una pieza muteada emite **cinco `Click`s sin `note`**, en los offsets donde estarían sus
  notas, y **ningún `Step`** (D3). Con test.
- **AC7** — El motor no recibe notas de una pieza muteada: la proyección de `App.tsx` no le manda un
  `Step` que él tenga que decidir si suena.
- **AC8** — **La celda muteada se ve blanca y conserva nota y `#N`** (D4), con el texto en el gris del
  tablero y no en el `fg` de la pieza. La derivación sigue saliendo de `cellTextFor`, sin una segunda
  copia en `Board.tsx`.
- **AC9** — El velo de la cabeza lectora sigue funcionando sobre las piezas **no** muteadas, y lo que
  pase con las muteadas queda decidido y escrito, no accidental (`research.md` §5).
- **AC10** — `PlacedList.tsx` **borrado**, su import fuera de `App.tsx`, y el borrado en **su propio
  commit** — es la regla del repo, para que revertirlo sea trivial.
- **AC11** — El layout queda en paleta 4 / tablero 8 y `CELL_PX` en **71**, con el número remedido y su
  motivo escrito en `layout.constants.ts` (D6). Las clases `md:col-span-*` **no viven en `App.tsx`**
  sino en `PiecePalette.tsx:36` y `Board.tsx:132`, así que los dos archivos entran al alcance. Y quedan
  al día los **dos** comentarios que explican el 63 con un `col-span-7`: el docblock de `CELL_PX` y el
  de `Board.tsx:125`.
- **AC12** — `PlacedPiece.muted` existe y `mcp-server` compila: `simulate_board` acepta y reporta el
  muteo (D7).
- **AC13** — `pnpm verify` en verde y `check_invariants` en proceso fresco antes y después.
- **AC14** — `[M]` A oído: un tablero de 4 piezas suena, se mutea una, y el resto **entra en el mismo
  momento que antes** — el hueco se escucha como un silencio en su lugar, no como un patrón acortado.
- **AC15** — `[M]` A ojo: quitar y reponer la misma pieza en la misma casilla con la misma orientación
  devuelve el tablero al estado anterior (D1).
- **AC16** — La documentación al día: `DESIGN.md` (el canal nuevo y por qué no es color ni opacidad,
  **y la fila de `PlacedList` de la tabla de contraste con su párrafo**, `DESIGN.md:129-131`),
  `docs/architecture/directory-structure.md:99` **y `docs/architecture/overview.md:30`** —los dos
  nombran a `PlacedList` en el árbol de componentes—, `docs/architecture/modelo-musical.md` (una pieza
  puede no sonar) y `.claude/rules/ui.md`.
- **AC17** — **Un cruce sobre una pieza muteada no suena**: el `Click` de ese tramo sale **sin `note`**
  (D3). Con test sobre un tablero donde el cruce existe de verdad, no sobre uno inventado.
- **AC18** — Con **una sola** pieza colocada y muteada, `buildSequence` devuelve cinco `Click`s sin
  `note`, cero `Step` y `length === CELLS_PER_PIECE`: es la rama `n === 1`, que es un retorno temprano
  aparte del bucle (D3). Con test.
- **AC19** — Las celdas de una pieza muteada pasan a marcarse `MARCA.click` en vez de `MARCA.nota`
  —`route-source.ts` las arma de `s.clicks` y no de `s.steps`—, o sea que la cabeza lectora las recorre
  con el borde del click. Queda **decidido y escrito**, no accidental.
- **AC20** — El hover sobre una celda ocupada por la **misma** pieza seleccionada deja de mostrar
  `cursor-not-allowed` (`Board.tsx:190`): sobre una celda donde el click ahora **borra**, ese cursor
  dice lo contrario de lo que pasa. Qué hace el fantasma rosa en ese caso se decide y se escribe.

## Fuera de Alcance

- **El orden del circuito en pantalla** (D5). No se repone.
- **Mutear celdas sueltas.** El muteo es por pieza.
- **Deshacer.** Quitar es reversible a mano (AC15), no hay pila de undo.
- **El timbre del click que suena en lugar de las notas.** Es el spec 015, que además lo deja apagado
  por default. Ver el riesgo de abajo: este spec merge**a antes**.
- **La paleta.** Las columnas que gana son para el 016; acá solo cambia el `col-span`.
- **Que una pieza muteada se pueda arrastrar o rotar en el lugar.** Sigue sin poder editarse la
  orientación de una pieza colocada.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Un click destinado a colocar termina borrando.** Con la misma pieza en la mano, apuntar mal a una celda propia ya no es "jugada inválida, no pasa nada" sino un borrado. | La regla de D2 es estrecha —solo si la celda clickeada está ocupada por una pieza **de ese mismo tipo**— y el fantasma ya pinta rosa la jugada inválida antes del click. Reponer cuesta un click (AC15). |
| **Este spec mergea antes que el 015**, así que una pieza muteada va a sonar como cinco ráfagas de ruido blanco de 20 ms, que es el click de hoy. | Está declarado. El 015 le cambia el timbre y lo deja apagado por default; hasta entonces, el botón `Clicks mudos` ya permite apagarlo. Es un argumento para no evaluar D3 a oído antes del 015. |
| Una pieza sin `Step` se queda sin velo de estreno (D3). | `research.md` §5 tiene las dos salidas y AC9 obliga a elegir una y escribirla. Lo que no puede pasar es que el velo desaparezca sin que nadie lo haya decidido. |
| `PlacedPiece` gana un campo y rompe `mcp-server`. | Es deseable: `pnpm verify` typechequea cruzando el borde de paquete y lo atrapa (D7, AC12). |
| Borrar `PlacedList` se lleva por delante el único consumidor de `arpeggioFor` en `components/`. | `arpeggioFor` sigue teniendo consumidores en `domain/sequence.ts` y en el MCP server. Si quedara sin ninguno, se anota — no se borra en el mismo commit. |
| `CELL_PX` es un número medido y su docblock arrastra dos mediciones viejas que dejan de valer. | AC11: se remide y se reescribe el docblock, incluida la parte que dice que el techo sale de un `col-span-7`. El piso de 60 px no cambia, porque depende de la fuente y no del ancho. |
| **El muteo no se escucha al instante.** `setSequence` no interrumpe el ciclo en curso (D5 del 009), así que alternar el muteo tarda hasta un ciclo entero —7,5 s con 8 piezas a 110 bpm— en oírse. Sobre un gesto que se hace *tocando*, eso se lee como que no funcionó. | No lo abre este spec: es el precio del 009 y lo paga igual quitar una pieza. Queda declarado para que AC14 se escuche sabiéndolo, y para que si molesta se abra como spec propio y no como bug del 014. |
| El blanco de una celda muteada se puede confundir con una celda libre. | Una celda libre no tiene texto: la muteada conserva nota y `#N` (D4). Es la misma distinción que ya separa a una celda libre de una del fantasma. |

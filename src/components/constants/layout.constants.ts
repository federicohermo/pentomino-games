/**
 * Tamano de celda del tablero, en px.
 *
 * Gobierna el `gridTemplateColumns` **y** el ancho/alto de cada celda. Las celdas
 * se dimensionan con estilo inline y no con `w-7 h-7`: Tailwind escanea el fuente,
 * asi que una clase interpolada (`w-[${CELL_PX}px]`) no se generaria y el numero
 * volveria a estar escrito dos veces. `w-7` era exactamente 1.75rem = 28px.
 *
 * 28 → 63 en el spec 007: en 28 px no entra un nombre de nota. La celda dejo de
 * mostrar la letra de la pieza —eso ahora lo dice el color— y pasa a mostrar SU
 * nota. **63 → 71 en el spec 014**, al morir `PlacedList` y liberar dos columnas.
 *
 * Los dos numeros que ACOTAN el 71 son distintos y conviene no confundirlos:
 *
 * - **60 es el PISO**, medido con un `Range` sobre el nodo de texto a la fuente
 *   que se renderiza: los nombres con sostenido —`D#4`, `D#5`, todos iguales
 *   porque `tabular-nums` iguala los digitos— ocupan **35,4 px a los 19 px de
 *   `text-[19px]`**, que es lo que usa la celda en `Board.tsx`. Los ~24 px de
 *   aire alrededor del texto son los mismos de siempre: daban 44 cuando la celda
 *   renderizaba a 11 px y el nombre media 20,5, y 52 cuando paso a 15 px y 28.
 *   El piso sube con la fuente, y por eso este numero hay que remedirlo cada vez
 *   que se toca `text-[…]` en `Board.tsx` — es la trampa que ya se piso dos veces.
 *   **No lo movio el 014**: depende de la fuente, no del ancho de la tarjeta.
 *
 *   Lo que limita el tamano de la NOTA, en cambio, no es este ancho: sobran 10,8
 *   px de aire por lado. Es el `#N` de la esquina, que compite por el alto. Esta
 *   explicado en `Board.tsx`.
 * - **71 es el TECHO util**, y sale de la tarjeta, medida en el DOM con el reparto
 *   `md:col-span-4` (paleta) / `md:col-span-8` (tablero) de un `max-w-6xl`:
 *   **730,7 × 429,6 px** de interior descontando el `gap-4` y el `p-4`. Por ancho
 *   daria 73,1 y por alto 71,6, asi que **el que limita es el ALTO** — que es lo
 *   contrario de lo que pasaba con `col-span-7`, donde el interior era
 *   633,3 × 429,6 y mandaba el ancho (63,3 contra 71,6).
 *
 *   Ese cambio de lado es el que decide el reparto entero: con `col-span-9` el
 *   interior seria 828,0 × 429,6, o sea 82,8 por ancho y **los mismos 71,6 por
 *   alto**. La novena columna no le compra al tablero un solo pixel, y por eso va
 *   a la paleta (`PiecePalette.tsx`), que la necesita para el spec 016.
 *
 * Se usa el techo y no el piso porque la nota es lo que hay que leer.
 *
 * **El alto de la tarjeta lo fija la PALETA**, que es la mas alta de la fila, y el
 * tablero se estira con ella. Medido inyectando 80 px de relleno en la paleta: el
 * interior del tablero pasa a 730,7 × 509,6 y `CELL_PX` sube a **73**, que es donde
 * se detiene porque ahi vuelve a mandar el ancho (73,1). O sea que cuando el spec
 * 016 haga mas alta la paleta con sus miniaturas, este numero sube solo — no hay
 * que redescubrirlo, hay que remedirlo.
 *
 * **Debajo de `md` no entra**, y eso es lo que la primera version de este
 * comentario decia mal: a 375 px de viewport el panel queda en 343 px y su interior
 * util en 311, contra las pistas fijas. Lo absorbe el `overflow-x-auto` del
 * contenedor de la grilla en `Board.tsx`, no un `CELL_PX` mas chico: achicar la
 * celda devuelve el problema que este numero existe para resolver.
 */
export const CELL_PX = 71;

/* `PREVIEW_CELL_PX` (20) se fue con `PiecePreview.tsx`: la previsualizacion aparte
   dejo de existir cuando el fantasma del tablero paso a mostrar la nota de cada
   celda. */

/** Extremos del slider de tempo, en bpm. El valor inicial es DEFAULT_BPM del motor. */
export const TEMPO_MIN = 60;
export const TEMPO_MAX = 160;

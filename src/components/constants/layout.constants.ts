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
 * **71 → 73 en el spec 016**, cuando las miniaturas hicieron mas alta la paleta.
 *
 * ## Cual es la restriccion que manda HOY
 *
 * **El ANCHO.** Y hay que decirlo porque cambio de lado dos veces en dos specs, asi
 * que el proximo que quiera un tablero mas grande va a mirar la tarjeta equivocada:
 *
 * | | `CELL_PX` | Manda | Por que |
 * |---|---|---|---|
 * | antes del 014 | 63 | ancho | `col-span-7`: 633,3 de interior contra 429,6 de alto |
 * | con el 014 | 71 | **alto** | `col-span-8` da 73,1 por ancho contra 71,6 por alto |
 * | con el 016 | **73** | ancho | la paleta subio a 496 px de caja y solto el alto: 77,3 por alto contra los mismos 73,1 por ancho |
 *
 * O sea que **agrandar el tablero hoy pide mas ANCHO de tarjeta**, no mas alto de
 * paleta: el alto ya sobra. Y no hay ancho que ganar sin sacarselo a la paleta, que
 * es la otra mitad del `max-w-6xl`.
 *
 * Los dos numeros que ACOTAN el 73 son distintos y conviene no confundirlos:
 *
 * - **60 es el PISO**, medido con un `Range` sobre el nodo de texto a la fuente
 *   que se renderiza: los nombres con sostenido —`D#4`, `D#5`, todos iguales
 *   porque `tabular-nums` iguala los digitos— ocupan **35,4 px a los 19 px de
 *   `text-[19px]`**, que es lo que usa la celda en `Board.tsx`. Los ~24 px de
 *   aire alrededor del texto son los mismos de siempre: daban 44 cuando la celda
 *   renderizaba a 11 px y el nombre media 20,5, y 52 cuando paso a 15 px y 28.
 *   El piso sube con la fuente, y por eso este numero hay que remedirlo cada vez
 *   que se toca `text-[…]` en `Board.tsx` — es la trampa que ya se piso dos veces.
 *   **No lo movieron ni el 014 ni el 016**: depende de la fuente, no del layout.
 *
 *   Lo que limita el tamano de la NOTA, en cambio, no es este ancho: sobran 10,8
 *   px de aire por lado. Es el `#N` de la esquina, que compite por el alto. Esta
 *   explicado en `Board.tsx`.
 * - **73 es el TECHO util**, y sale de la tarjeta, medida en el DOM con el reparto
 *   `md:col-span-4` (paleta) / `md:col-span-8` (tablero) de un `max-w-6xl`:
 *   **730,7 × 464 px** de interior descontando el `gap-4` y el `p-4`. Por ancho da
 *   73,1 y por alto 77,3, asi que manda el ancho. El 73,1 no se mueve con nada que
 *   pase adentro de las tarjetas: es `730,7 / 10` y solo cambia con el `col-span`.
 *
 *   El alto SI se movio, y por eso el numero subio: el alto de la fila lo fija la
 *   PALETA, que es la tarjeta mas alta, y el spec 016 la llevo de 461,6 a 496 px de
 *   caja al meterle las doce miniaturas. Con el 014 solo, el interior del tablero
 *   media 730,7 × 429,6 y el alto mandaba con 71,6.
 *
 * Se usa el techo y no el piso porque la nota es lo que hay que leer.
 *
 * **Inflar la paleta ya no compra nada**, y es lo que fija su tamano: pasado el
 * techo por ancho, todo lo que la paleta crezca es aire muerto en la tarjeta del
 * tablero. Medido: a 496 px de paleta sobran 26 px de alto (464 contra los 438 que
 * usan seis celdas de 73), y a 660 px de paleta sobrarian 190. Ver el docblock de
 * `MINI_CELL_PX`, que es donde esa decision se toma.
 *
 * **Debajo de `md` no entra**, y eso es lo que la primera version de este
 * comentario decia mal: a 375 px de viewport el panel queda en 343 px y su interior
 * util en 311, contra las pistas fijas. Lo absorbe el `overflow-x-auto` del
 * contenedor de la grilla en `Board.tsx`, no un `CELL_PX` mas chico: achicar la
 * celda devuelve el problema que este numero existe para resolver.
 */
export const CELL_PX = 73;

/* `PREVIEW_CELL_PX` (20) se fue con `PiecePreview.tsx`: la previsualizacion aparte
   dejo de existir cuando el fantasma del tablero paso a mostrar la nota de cada
   celda.

   El spec 016 **no deshace ese retiro**, y conviene que quede escrito porque se le
   parece. Aquel panel se fue por repetir las NOTAS —el fantasma las dice mejor,
   sobre la celda donde van a caer— y la miniatura de la paleta no dice ni una nota
   ni un `#N` (D7): dice la FORMA, que es lo que aquel retiro se llevo puesto de
   paso y lo unico que el fantasma no puede contestar, porque para verlo ya hay que
   haber elegido la pieza. Y aquel 20 era una miniatura sola en un panel de 252 px;
   aca son doce en el mismo lugar. */

/**
 * El lado de la caja de la miniatura de la paleta, en celdas.
 *
 * 5 es la caja mas chica que contiene cualquier pentomino en cualquiera de sus 8
 * orientaciones: el maximo en un eje lo pone sola la `I` —5×1 acostada, 1×5 parada— y
 * ninguna otra pieza pasa de 4×2 ni de 3×3. Con 4 la `I` no entra.
 *
 * **No se toma `CELLS_PER_PIECE` de `domain/`**, aunque valga 5 tambien. Son dos
 * numeros distintos que coinciden por casualidad: aquel dice cuantas celdas tiene una
 * pieza —una propiedad del modelo— y este cuantas casillas mide la caja donde se
 * dibuja, que es una decision de layout. Atarlos haria que cambiar el pentomino a
 * hexomino moviera el layout, y que agrandar la caja pareciera un cambio de modelo.
 */
export const MINI_BOX = 5;

/**
 * El lado de una celda de la miniatura, en px.
 *
 * El numero no sale de una preferencia sino de dos restricciones medidas, y la segunda
 * es la que sorprende: **la paleta manda el alto de toda la fila**, asi que inflarla no
 * agranda el tablero, le deja aire muerto. El techo por ancho del tablero a
 * `md:col-span-8` es 73,1 px, o sea que en cuanto la paleta pasa de ~470 px de caja el
 * tablero ya no puede aprovechar el alto extra y `CELL_PX` se clava en 73.
 *
 * De ahi el objetivo de 470–520 px de caja para la paleta, y de ahi 6 columnas × 8 px:
 * con seis columnas son dos filas de botones en vez de tres, que es lo que la hace mas
 * compacta que cualquier variante de cuatro. Medido con este commit puesto — ver
 * `CELL_PX` para el resto de la cadena.
 */
export const MINI_CELL_PX = 8;

/** Extremos del slider de tempo, en bpm. El valor inicial es DEFAULT_BPM del motor. */
export const TEMPO_MIN = 60;
export const TEMPO_MAX = 160;

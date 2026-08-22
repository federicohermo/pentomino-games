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
 * **El 019 lo dejo en 73**, achicando la paleta: no lo movio porque el 73 ya no
 * dependia de ella.
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
 * | con el 016 | 73 | ancho | la paleta subio a 496 px de caja y solto el alto: 77,3 por alto contra los mismos 73,1 por ancho |
 * | con el 019 | **73** | ancho | la paleta bajo a **428** px y dejo de ser la tarjeta mas alta: el alto salio de la ecuacion |
 *
 * La ultima fila es un cambio de CLASE y no de numero, y por eso vale la pena leerla
 * despacio. Hasta el 016 el alto disponible lo fijaba la paleta —la tarjeta mas alta de
 * la fila, con el tablero estirandose a su altura— asi que «el alto sobra» queria decir
 * «sobran 26 px». El 019 le saco tres filas y la dejo en 428 px de caja natural, contra
 * los 470 que mide el tablero con sus seis celdas de 73: **la paleta paso a ser la mas
 * baja**, o sea que la que fija la altura de la fila ahora es la tarjeta del tablero.
 * Medido en el DOM con `align-items: start` sobre la grilla, que es la unica forma de
 * ver la altura natural de las dos con el estiramiento apagado.
 *
 * O sea que **agrandar el tablero pide mas ANCHO de tarjeta**, y ahora es lo unico que
 * pide: el alto dejo de ser un techo, no dejo un colchon. No hay ancho que ganar sin
 * sacarselo a la paleta, que es la otra mitad del `max-w-6xl`.
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
 *   **730,7 px** de interior de ancho descontando el `gap-4` y el `p-4`. Da 73,1, y
 *   no se mueve con nada que pase adentro de las tarjetas: es `730,7 / 10` y solo
 *   cambia con el `col-span`.
 *
 *   El alto SI se movio dos veces, y la segunda lo saco de la competencia. El alto de
 *   la fila lo fijaba la PALETA, que era la tarjeta mas alta: con el 014 solo el
 *   interior del tablero media 730,7 × 429,6 y mandaba el alto con 71,6; el 016 llevo
 *   la paleta de 461,6 a 496 px y el alto paso a dar 77,3. El 019 le saco tres filas y
 *   la dejo en **428**, debajo de los 470 del tablero, asi que hoy la fila la fija el
 *   tablero y su interior es **730,7 × 438**, o sea 6 × 73 exactos.
 *
 * Se usa el techo y no el piso porque la nota es lo que hay que leer.
 *
 * **Inflar la paleta ya no compra nada**, y es lo que fija su tamano: pasado el
 * techo por ancho, todo lo que la paleta crezca es aire muerto en la tarjeta del
 * tablero. Con el 016 eso se medía como colchon —a 496 px de paleta sobraban 26 px de
 * alto, y a 660 sobrarian 190—; despues del 019 no hay colchon que medir, porque la
 * paleta ni siquiera llega al alto del tablero. Lo que hay es **al reves**: 42 px de
 * margen antes de que la paleta vuelva a mandar (470 − 428).
 *
 * Ese margen tiene dueno anunciado: el spec 020 le devuelve a la paleta un boton `0°`,
 * INLINE en la linea de orientacion y no como fila nueva, o sea unos 10 px de los 42.
 * El aire que el 019 dejo en la tarjeta se lo lleva entero el 021, que la convierte en
 * un dock — y con el, este docblock entero.
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
 * **Con el spec 020 la caja fija pasa a ser MAS necesaria, no menos.** Hasta ahi las doce
 * miniaturas se dibujaban en la misma orientacion, asi que si una fila se descuadraba al
 * rotar se descuadraba entera y de una vez. Hoy cada pieza recuerda la suya y las doce
 * cambian por separado: sin la caja fija, rotar la `I` sola movería a sus once vecinas de
 * la grilla. El argumento esta duplicado en `piece-mini.ts` y en `DESIGN.md`, y los tres
 * tienen que decir lo mismo.
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
 *
 * El **umbral** de los ~470 sigue siendo cierto y por eso el numero no se toca; lo que
 * el spec 019 falsifico es el OBJETIVO: al borrar tres filas la paleta cayo a 428 px,
 * debajo de la banda, y con eso el alto dejo de acotar `CELL_PX`. Seis columnas siguen
 * siendo lo correcto por lo que dice el parrafo de arriba —dos filas de botones y no
 * tres—, no por llegar a una banda que ya no aplica.
 */
export const MINI_CELL_PX = 8;

/** Extremos del slider de tempo, en bpm. El valor inicial es DEFAULT_BPM del motor. */
export const TEMPO_MIN = 60;
export const TEMPO_MAX = 160;

/**
 * Los dos anchos del anillo de foco de la celda, en px — el spec 026.
 *
 * ## Por que son DOS y no uno
 *
 * Porque abajo de la celda enfocada puede haber cualquiera de los 12 colores, y los dos
 * extremos de la lamina son `#FFFF00` (la `V`) y `#0000FF` (la `W`): un solo tono se
 * pierde contra alguno de ellos. Van claro adentro y oscuro afuera, y como un `outline`
 * de CSS tiene un unico color hacen falta DOS propiedades — es lo que DESIGN.md fija.
 *
 * ## Donde cae cada banda, que es lo que decide los numeros
 *
 * Una celda son dos cajas: la de `CELL_PX` y la baldosa redondeada de adentro, con 2 px
 * de aire entre las dos (el `p-0.5` de `Board.tsx`). Las dos bandas se reparten ese aire
 * y el borde de la baldosa, y las dos se dibujan HACIA ADENTRO de la caja de afuera:
 *
 * ```
 *   0 → 2 px  banda OSCURA   sobre el aire, o sea sobre el blanco del panel
 *   2 → 4 px  banda CLARA    sobre el borde negro de la baldosa y el arranque de su color
 * ```
 *
 * De ahi que los dos valgan 2: el aire mide 2 px, y la banda clara tiene que pisar la
 * baldosa para quedar sobre el color de la pieza, que es contra lo que se la eligio. Con
 * ese reparto el anillo se ve SIEMPRE: sobre `#FFFF00` la clara desaparece pero la oscura
 * esta sobre blanco, y sobre `#0000FF` pasa lo contrario.
 *
 * ## Por que hacia adentro y no hacia afuera, que es lo obvio
 *
 * Por el orden de pintado. Los `outline` se pintan al final del contexto de apilamiento
 * —arriba de todo—, pero un `box-shadow` se pinta en la fase de fondo del elemento, y las
 * baldosas de las 60 celdas son `relative`, o sea POSICIONADAS: se pintan despues. Un
 * anillo hacia afuera dejaria la banda oscura tapada por las baldosas vecinas en los
 * cuatro lados y la clara visible encima — o sea un anillo de un solo tono, que es
 * justamente lo que estos dos numeros existen para evitar. Hacia adentro no hay
 * competencia: la oscura cae en el aire, que no lo pinta nadie.
 *
 * Y de paso resuelve solo lo que AC7 manda medir: dibujado hacia adentro el anillo no
 * asoma ni un pixel fuera de la caja, asi que no puede agrandar la region scrolleable ni
 * quedar recortado por el `overflow-x-auto` en las celdas del borde.
 */
export const ANILLO_FOCO_OSCURO = 2;
export const ANILLO_FOCO_CLARO = 2;

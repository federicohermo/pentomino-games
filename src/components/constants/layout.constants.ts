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
 * nota.
 *
 * Los dos numeros que fijan el 52 son distintos y conviene no confundirlos:
 *
 * - **44 es el PISO**, medido: `D#5` —el nombre mas ancho— ocupa 20,2 px a 11 px
 *   de fuente, medido con un `Range` sobre el nodo de texto. Abajo de 44 la nota
 *   deja de entrar comoda.
 * - **63 es el TECHO util**, y sale del tamano de la tarjeta, medido en el DOM: el
 *   tablero vive en un `md:col-span-7` de un `max-w-6xl`, o sea **633 × 380 px**
 *   de interior descontando el `gap-4` y el `p-4`. 10 × 63 = 630 y 6 × 63 = 378:
 *   entra con ~2 px por lado y el padding queda parejo en los cuatro lados. Con
 *   `col-span-6` la tarjeta media 536 × 380 y el tablero llenaba el ancho pero
 *   dejaba 68 px de alto muerto, porque 10 × 6 no tiene esa proporcion.
 *
 * Se usa el techo y no el piso porque la nota es lo que hay que leer.
 *
 * **Debajo de `md` no entra**, y eso es lo que la primera version de este
 * comentario decia mal: a 375 px de viewport el panel queda en 343 px y su interior
 * util en 311, contra las pistas fijas. Lo absorbe el `overflow-x-auto` del
 * contenedor de la grilla en `Board.tsx`, no un `CELL_PX` mas chico: achicar la
 * celda devuelve el problema que este numero existe para resolver.
 */
export const CELL_PX = 63;

/* `PREVIEW_CELL_PX` (20) se fue con `PiecePreview.tsx`: la previsualizacion aparte
   dejo de existir cuando el fantasma del tablero paso a mostrar la nota de cada
   celda. */

/** Extremos del slider de tempo, en bpm. El valor inicial es DEFAULT_BPM del motor. */
export const TEMPO_MIN = 60;
export const TEMPO_MAX = 160;

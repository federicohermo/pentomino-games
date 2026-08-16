/**
 * Tamano de celda del tablero, en px.
 *
 * Gobierna el `gridTemplateColumns` **y** el ancho/alto de cada celda. Las celdas
 * se dimensionan con estilo inline y no con `w-7 h-7`: Tailwind escanea el fuente,
 * asi que una clase interpolada (`w-[${CELL_PX}px]`) no se generaria y el numero
 * volveria a estar escrito dos veces. `w-7` era exactamente 1.75rem = 28px.
 *
 * 28 → 44 en el spec 007: en 28 px no entra un nombre de nota. La celda dejo de
 * mostrar la letra de la pieza —eso ahora lo dice el color— y pasa a mostrar SU
 * nota, y `A#4` a 11 px mide ~21 px. El tablero pasa de 280 a 440 px de ancho;
 * vive en un `md:col-span-6` de un `max-w-6xl` (1.152 px), o sea ~540 px
 * disponibles descontando el `gap-4`: entra con margen y el layout no cambia.
 */
export const CELL_PX = 44;

/** Idem para la previsualizacion. `w-5` era 1.25rem = 20px. */
export const PREVIEW_CELL_PX = 20;

/** Extremos del slider de tempo, en bpm. El valor inicial es DEFAULT_BPM del motor. */
export const TEMPO_MIN = 60;
export const TEMPO_MAX = 160;

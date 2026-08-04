/**
 * Tamano de celda del tablero, en px.
 *
 * Gobierna el `gridTemplateColumns` **y** el ancho/alto de cada celda. Las celdas
 * se dimensionan con estilo inline y no con `w-7 h-7`: Tailwind escanea el fuente,
 * asi que una clase interpolada (`w-[${CELL_PX}px]`) no se generaria y el numero
 * volveria a estar escrito dos veces. `w-7` era exactamente 1.75rem = 28px.
 */
export const CELL_PX = 28;

/** Idem para la previsualizacion. `w-5` era 1.25rem = 20px. */
export const PREVIEW_CELL_PX = 20;

/** Extremos del slider de tempo, en bpm. El valor inicial es DEFAULT_BPM del motor. */
export const TEMPO_MIN = 60;
export const TEMPO_MAX = 160;

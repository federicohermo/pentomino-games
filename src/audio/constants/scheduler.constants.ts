/** Cuanto futuro se agenda en cada vuelta del temporizador, en segundos. */
export const LOOKAHEAD = 0.1;

/** Cada cuanto despierta el temporizador, en ms. No dispara notas: decide cuando mirar. */
export const TICK_MS = 25;

/**
 * Pulsos por compas. El instrumento esta en 4/4.
 *
 * No confundir con `GRID_W`: el ancho del tablero es en cuantas POSICIONES se
 * puede caer dentro del compas (10), no en cuantos pulsos se divide (4).
 */
export const BEATS_PER_BAR = 4;

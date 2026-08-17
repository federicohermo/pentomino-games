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

/**
 * En cuantas partes se divide el pulso. Con 4, la unidad es la semicorchea.
 *
 * Es la grilla mas fina del instrumento: todo lo que se mide en tiempo —el paso
 * del arpegio y la duracion de una nota— se cuenta en intervalos, no en segundos.
 * Que sea una constante y no un numero suelto es lo que permite cambiar la
 * subdivision en un solo lugar sin que el arpegio y la nota se desincronicen.
 */
export const SUBDIVISIONS_PER_BEAT = 4;

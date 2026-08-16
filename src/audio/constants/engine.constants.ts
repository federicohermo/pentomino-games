/** Ganancia del master. */
export const MASTER_GAIN = 0.3;

/** Espaciado del arpegio, en segundos. Igual para el disparo directo y el loop. */
export const ARPEGGIO_SPREAD = 0.15;

/** Tempo inicial. Lo comparten el motor y el estado de la UI: es un solo numero. */
export const DEFAULT_BPM = 110;

/** Margen al disparar ya mismo, para no agendar en el pasado. */
export const PLAY_DELAY = 0.02;

/**
 * Margen entre arrancar el reloj y el compas 0.
 *
 * Le da al primer tick (25 ms) tiempo de llegar antes del downbeat. Si el
 * temporizador se atrasa mas que esto, el compas 0 se saltea en vez de
 * recuperarse — coherente con el resto del reloj.
 */
export const CLOCK_START_DELAY = 0.05;

/** 128 bins (fftSize / 2). Suficiente para visualizar, insuficiente para afinar. */
export const FFT_SIZE = 256;

/** Promediado temporal entre lecturas: sin el la animacion tiembla; de mas, es melaza. */
export const SMOOTHING = 0.8;

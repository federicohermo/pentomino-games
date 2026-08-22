import { GRID_W, GRID_H } from '../domain/constants/board.constants.ts';
import { CELL_PX_MIN, CELL_PX_MAX } from './constants/layout.constants.ts';

/**
 * El tamaño de celda que entra en un viewport de `vw × vh`, en px.
 *
 * ```
 * min(CELL_PX_MAX, max(CELL_PX_MIN, min(vw / GRID_W, vh / GRID_H)))
 * ```
 *
 * Las cuatro partes, en orden:
 *
 * - **`min` de los dos ejes** — el tablero es una grilla de `GRID_W × GRID_H` celdas
 *   cuadradas, así que la que manda es la dimensión más apretada. Tomar el máximo daría
 *   una grilla que desborda por el otro eje.
 * - **`GRID_W` y `GRID_H` y no `10` y `6`** — el tablero mide lo que el dominio dice que
 *   mide. Este spec no lo cambia, pero escribir los números acá crearía el segundo lugar
 *   donde vive el tamaño del tablero, que es exactamente el problema que las constantes de
 *   este repo existen para evitar.
 * - **`max` con el piso** — abajo de 730 px de viewport la celda se queda en 73 y el
 *   tablero scrollea horizontalmente, que es lo que ya hacía debajo de `md`. La promesa que
 *   deja escrita es que **el tablero nunca es más chico que antes del spec 021**. El porqué
 *   del 73 —tipográfico, no geométrico— está en `CELL_PX_MIN`.
 * - **`min` con el techo** — y hoy el techo vale lo mismo que el piso, así que esta línea
 *   es la que devuelve la celda al tamaño fijo que tenía antes del 021: sin ella, en un
 *   escritorio la baldosa medía 180 px y el nombre de la nota 46,8. El porqué y qué cuesta
 *   aflojarlo están en `CELL_PX_MAX`.
 *
 * No redondea. Un `CELL_PX` de 151,2 px es perfectamente dibujable, y redondear a 151
 * dejaría 2 px de tablero sin usar por nada: la grilla mide `10 × --cell` y el navegador
 * resuelve la fracción una sola vez, en la custom property, en vez de sesenta veces.
 *
 * Es una pura y vive acá y no en `use-cell-px.ts` por el motivo de siempre: así se testea
 * en `environment: 'node'`, sin navegador y sin fabricar un `resize`. Lo que queda del otro
 * lado es cableado —leer la caja y escribir la custom property— y eso lo cubre el proyecto
 * `browser`.
 */
export function cellPxPara(vw: number, vh: number): number {
  return Math.min(CELL_PX_MAX, Math.max(CELL_PX_MIN, Math.min(vw / GRID_W, vh / GRID_H)));
}

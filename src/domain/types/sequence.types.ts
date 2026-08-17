import type { Cell } from './transform.types.ts';
import { ROUTE } from '../constants/route.constants.ts';

/**
 * Cual de las tres rutas de `ROUTE` gano al medir la distancia entre dos celdas.
 *
 * Se deriva del const-object en vez de escribirse como union literal a mano: asi
 * agregar una ruta a `ROUTE` es un solo lugar, y una ruta que exista en el tipo
 * pero no en el objeto —o al reves— no puede compilar.
 */
export type RouteKind = typeof ROUTE[keyof typeof ROUTE];

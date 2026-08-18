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

/**
 * Una pieza dentro del circuito: cuando arranca su arpegio y que cinco notas toca.
 *
 * `offset` va en INTERVALOS, no en segundos: la unidad es la celda recorrida (spec
 * 008) y el dominio no conoce el tempo. Convertir a tiempo es del motor, y que la
 * cuenta viva en enteros es lo que hace que el mismo tablero suene siempre igual —
 * no hay acumulacion de error de punto flotante que dependa del orden de la suma.
 *
 * `pieceId` y no la `PlacedPiece` entera para que el motor pueda reconciliar dos
 * secuencias sin conocer la geometria: es la unica parte de la pieza que la capa de
 * audio necesita, y llevarse el resto la ataria al dominio.
 *
 * `notes` ya viene en ORDEN DE REPRODUCCION: si la pieza se coloco reflejada, el
 * retrogrado ya lo aplico `arpeggioFor` —la unica derivacion de pieza a arpegio del
 * dominio—, asi que `buildSequence` lo toma tal cual y no vuelve a invertir nada.
 */
export interface Step {
  pieceId: string;
  offset: number;
  notes: number[];
}

/**
 * Una celda vacia cruzada por el recorrido: donde suena y cuando.
 *
 * La `cell` no es decorativa aunque el motor solo necesite el `offset`. Es lo que
 * permite que la garantia de "dos clicks no caen nunca en el mismo instante" se
 * verifique en el dominio, que es donde se puede distinguir un click de otro: si
 * dos coincidieran, el motor los agendaria a los dos y las amplitudes se sumarian,
 * que es exactamente lo que D4 pide evitar. Tambien es lo que deja que la celda que
 * se ilumina y la que suena salgan del MISMO dato (D8).
 */
export interface Click {
  offset: number;
  cell: Cell;
}

/**
 * El circuito entero, listo para agendar: los arpegios, los clicks y el largo del
 * ciclo.
 *
 * `length` es el ciclo COMPLETO —incluye el salto de la ultima pieza de vuelta a la
 * primera—, asi que no es el offset del ultimo paso sino donde el recorrido vuelve
 * a empezar. Sin ese salto el loop se cerraria antes de tiempo y la costura se
 * escucharia.
 */
export interface Sequence {
  steps: Step[];
  clicks: Click[];
  length: number;
}

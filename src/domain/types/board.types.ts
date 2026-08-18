import type { Cell } from './transform.types.ts';
import type { PieceKey } from './pieces.types.ts';

/**
 * Una pieza ya colocada en el tablero, con sus celdas en coordenadas de tablero.
 *
 * NO lleva las notas. Las llevaba —`notes: number[]`, poblado al colocar— y era un dato
 * DERIVABLE guardado en el estado: `arpeggioFor(piece, rotation, mirror)` da exactamente
 * lo mismo, asi que el campo solo agregaba la posibilidad de que se contradijeran. Nada
 * impedia construir una pieza con `rotation: 1` y las notas de la rotacion 0, y ahi el
 * tablero —que ya derivaba, ver `Board.tsx`— y el motor —que leia el campo— decian cosas
 * distintas. Su retiro estaba anotado en el seguimiento del 001, el 007, el 009 y el 010.
 *
 * `cells` en cambio NO es derivable de las demas: depende de donde se hizo click, que es
 * informacion que solo existe en el gesto.
 */
export interface PlacedPiece {
  id: string;
  piece: PieceKey;
  rotation: number;
  mirror: boolean;
  cells: Cell[];
}

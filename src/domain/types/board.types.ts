import type { Cell } from './transform.types.ts';
import type { PieceKey } from './pieces.types.ts';

/** Una pieza ya colocada en el tablero, con sus celdas en coordenadas de tablero. */
export interface PlacedPiece {
  id: string;
  piece: PieceKey;
  rotation: number;
  mirror: boolean;
  cells: Cell[];
  notes: number[];
}

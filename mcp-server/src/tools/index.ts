import type { ToolDef } from './types.ts';
import { describePiece } from './describePiece.ts';

/**
 * El registro. Agregar una tool es un archivo mas una linea aca: el entrypoint no
 * se toca y no hay ningun `switch` que mantener sincronizado.
 */
export const tools: readonly ToolDef[] = [
  describePiece,
];

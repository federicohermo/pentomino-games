import { z } from 'zod';
import { defineTool, json } from './types.ts';
import { PIECE_KEYS } from '../pieces.ts';
import { checkAll } from '../../../src/domain/invariants.ts';

/**
 * Los chequeos del modelo, corridos de verdad. Es la tool mas chica del spec
 * justamente porque **toda la logica ya vive en `src/domain/invariants.ts`**:
 * aca no hay ni un chequeo escrito, solo el formato de la respuesta.
 *
 * Itera sobre lo que devuelve `checkAll()` y no sobre una lista propia, asi que
 * si el dominio agrega un sexto chequeo la tool lo expone sin tocar este archivo.
 */

/** Rotaciones x reflexion: es la grilla que `invariants.ts` recorre por pieza. */
const ORIENTATIONS_PER_PIECE = 4 * 2;

/**
 * De que pieza habla un fallo, leyendo el prefijo del mensaje (`Z: …` o `Z rot3 …`).
 *
 * Es un acoplamiento al FORMATO de los mensajes de `invariants.ts`, y por eso se
 * eligio que degrade hacia mostrar de mas: si el formato cambia, el fallo deja de
 * reconocerse como de una pieza y pasa a reportarse siempre, en vez de esconderse
 * al filtrar. Los mensajes que no empiezan con una letra de pieza —los de
 * `BASE_MAP`, que hablan del conjunto— son globales de verdad.
 *
 * Se exporta para testearla: con los cinco chequeos en verde no hay ni un fallo
 * real con el que ejercitar el filtro desde la tool.
 */
export function pieceOf(failure: string): string | null {
  const head = failure.split(/[: ]/, 1)[0];
  return (PIECE_KEYS as readonly string[]).includes(head) ? head : null;
}

const inputSchema = z.object({
  piece: z.enum(PIECE_KEYS).optional()
    .describe('Acota los fallos reportados a esta pieza. Los chequeos igual corren sobre las 12.'),
});

export const checkInvariants = defineTool({
  name: 'check_invariants',
  description:
    'Corre los chequeos del modelo sobre las 96 combinaciones de pieza × rotación × reflexión y ' +
    'devuelve cuáles pasan, con contraejemplos. Usar antes de tocar geometría, tablas de piezas o ' +
    'el modelo musical, y otra vez después: el invariante más peligroso del repo —que la celda del ' +
    'índice k siga siendo la misma celda lógica después de transformar— se rompe SIN producir ' +
    'ningún error visible, y lo único que lo delata es este chequeo. Ejecuta checkAll() de ' +
    'src/domain/invariants.ts; no reimplementa ninguna verificación.',
  inputSchema,
  run: ({ piece }) => {
    const checks = checkAll();

    return json({
      scope: piece ?? 'todas',
      checked: {
        pieces: PIECE_KEYS.length,
        combinations: PIECE_KEYS.length * ORIENTATIONS_PER_PIECE,
      },
      // `ok` es el del modelo entero, tambien cuando se filtra por pieza: un
      // "todo bien" acotado a la Z mientras la F esta rota seria una respuesta
      // engañosa.
      ok: checks.every(c => c.ok),
      checks: checks.map(c => {
        const relevantes = piece
          ? c.failures.filter(f => { const p = pieceOf(f); return p === null || p === piece; })
          : c.failures;
        return {
          name: c.name,
          ok: c.ok,
          failures: relevantes,
          failuresOtherPieces: c.failures.length - relevantes.length,
        };
      }),
    });
  },
});

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

/**
 * Rotaciones x reflexion: el ESPACIO del modelo por pieza.
 *
 * No es cobertura, y la diferencia importa: de los cinco chequeos, solo `orden
 * del array` y `ancla` recorren las 96 orientaciones. `formas` mira las 12 formas
 * canonicas —rotar y reflejar no cambian ni la cantidad de celdas ni la conexidad—,
 * `notas` recorre 48 porque el espejo solo invierte el orden, y `BASE_MAP` mira el
 * conjunto una sola vez. Por eso la respuesta lo reporta como `modelSpace` y no
 * como `checked`: afirmar 96 para los cinco seria prometer de mas.
 *
 * Es, junto con `SCALE_LABEL` de `describePiece.ts`, uno de los dos supuestos del
 * server sobre el dominio: si `invariants.ts` cambia la grilla que recorre, esto
 * hay que actualizarlo a mano.
 */
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
    'Corre los cinco chequeos del modelo y devuelve cuáles pasan, con contraejemplos. El espacio ' +
    'del modelo son 12 piezas × 4 rotaciones × reflexión = 96 orientaciones, y cada chequeo ' +
    'recorre lo que le corresponde: el orden del array y el ancla las 96, las notas 48, las formas ' +
    'las 12 canónicas y BASE_MAP el conjunto una vez. ' +
    'Usar antes de tocar geometría, tablas de piezas o ' +
    'el modelo musical, y otra vez después: el invariante más peligroso del repo —que la celda del ' +
    'índice k siga siendo la misma celda lógica después de transformar— se rompe SIN producir ' +
    'ningún error visible, y lo único que lo delata es este chequeo. Ejecuta checkAll() de ' +
    'src/domain/invariants.ts; no reimplementa ninguna verificación.',
  inputSchema,
  run: ({ piece }) => {
    const checks = checkAll();

    return json({
      scope: piece ?? 'todas',
      // El espacio del modelo, NO lo que recorre cada chequeo: ver
      // `ORIENTATIONS_PER_PIECE`.
      modelSpace: {
        pieces: PIECE_KEYS.length,
        orientationsPerPiece: ORIENTATIONS_PER_PIECE,
        orientations: PIECE_KEYS.length * ORIENTATIONS_PER_PIECE,
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

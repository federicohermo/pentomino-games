import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';

/**
 * `CLAUDE.md` bajo 200 lineas.
 *
 * No es una regla de estilo importada de afuera: es el presupuesto que Anthropic
 * publica para ese archivo, y el motivo es mecanico. `CLAUDE.md` se carga **entero al
 * arranque de cada sesion y persiste en cada request**, asi que cada linea de mas se
 * paga en todas las respuestas, no una vez. La documentacion de Claude Code lo dice en
 * dos lugares —`docs/en/memory` y `docs/en/features-overview`— y recomienda mover el
 * material de referencia a reglas con `paths` (este repo ya tiene `.claude/rules/`) o
 * a `docs/`.
 *
 * Y sobre todo: **el propio archivo escribe la regla en su segunda linea** —«Es un
 * *cheat sheet*: lo que no se puede averiguar mirando un archivo. El detalle vive en
 * `docs/`»— y despues no la cumplia. Llego a 294 lineas, un 47 % por encima.
 *
 * El criterio de que se queda es el que ese parrafo ya fijo: la afirmacion y el numero
 * medido se quedan (no estan en ningun otro archivo); las cuatro paginas que explican
 * como se llego a ese numero se van a `docs/`. **Nada se borra.**
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TECHO = 200;

describe('`CLAUDE.md` entra en su presupuesto', () => {
  it(`tiene menos de ${TECHO} lineas`, () => {
    const lineas = readFileSync(join(RAIZ, 'CLAUDE.md'), 'utf8').split(/\r?\n/).length;

    expect(
      lineas,
      `CLAUDE.md tiene ${lineas} lineas y el techo es ${TECHO}.\n` +
      'Se carga entero en cada request, asi que cada linea de mas se paga siempre.\n' +
      'La convencion es de code.claude.com/docs/en/memory, y la segunda linea del propio\n' +
      'archivo ya la escribe: el detalle va a docs/, y aca queda la afirmacion mas el enlace.',
    ).toBeLessThan(TECHO);
  });
});

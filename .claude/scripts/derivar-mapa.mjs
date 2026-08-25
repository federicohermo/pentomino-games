/**
 * Deriva `specs/mapa.json` desde los PR y los issues, en vez de recordarlo (spec 043).
 *
 * **El estado de un spec no es un dato que alguien escribe: es una consecuencia.** Su PR
 * aterrizo o no, y eso no lo escribe nadie a mano. Mientras el mapa fue una afirmacion
 * humana se desincronizo cinco veces seguidas —los specs 038 a 042, todos mergeados y
 * todos diciendo `Propuesto`— y el gate que lo cazaba estuvo **en verde** todo el tiempo:
 * no podia correr, porque le faltaba `gh` en la maquina y credenciales en la CI.
 *
 * Y aunque hubiera corrido, tampoco lo habria arreglado. Los dos tests del gate del 038
 * se miran en espejo —un PR aterrizado con el mapa en `Propuesto` es mentira, y un
 * `Implementado` sin PR aterrizado es la mentira al reves— asi que juntos **prohiben
 * actualizar el mapa adentro del PR que lo justifica**: mientras ese PR esta abierto el
 * mapa tiene que decir `Propuesto`, y en cuanto se mergea tiene que decir otra cosa. No
 * hay ningun commit del propio PR que deje las dos cosas ciertas. El paso queda para un
 * commit posterior, a mano, en `main` — que es exactamente el que se olvida. Los cinco no
 * se desincronizaron por descuido: se desincronizaron **por diseno**.
 *
 * De ahi que esto exista y que lo corra una Action en el push a `main`
 * (`.github/workflows/mapa.yml`). El gate del 038 queda como confirmacion de un calculo,
 * no como recordatorio de una tarea.
 *
 * ## Lo que NO hace, y esta medido
 *
 * **No cierra issues.** Los cinco issues de los specs 038 a 042 se cerraron **un segundo
 * despues** del merge de su PR, solos, por el `Closes #N` del cuerpo. Esa mitad ya es
 * automatica: de las dos copias que el registro mantiene, la del issue se sincroniza sola
 * y la del mapa no se sincronizaba nunca. Por eso el workflow no pide `issues: write`.
 *
 * Y si un issue igual queda abierto —un PR sin `Closes #N`—, este script pone
 * `Implementado` y **el gate se pone en rojo**, que es lo correcto: ahi hay una pregunta
 * real —¿ese PR implemento el spec?— que ninguna maquina puede contestar.
 *
 * Uso:
 *   node .claude/scripts/derivar-mapa.mjs              # deriva y escribe si cambia algo
 *   node .claude/scripts/derivar-mapa.mjs --verificar  # no escribe; sale 1 si escribiria
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { derivarYGuardar } from './lib/derivacion.ts';
import { LIMITE_DE_LISTA } from './lib/specs.ts';
// El lanzador de `gh` que explica sus fallos en vez de tirar un `ENOENT` crudo (issue #125).
import { gh as lanzarGh } from './lib/gh.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MAPA_JSON = join(RAIZ, 'specs', 'mapa.json');
const REPO = 'federicohermo/pentomino-games';

const VERIFICAR = process.argv.includes('--verificar');

const ghJson = (args) => JSON.parse(lanzarGh(args, { encoding: 'utf8', maxBuffer: 1 << 28 }));

const codigo = derivarYGuardar({
  issues: () => ghJson([
    'issue', 'list', '--repo', REPO,
    '--state', 'all', '--limit', String(LIMITE_DE_LISTA), '--json', 'number,state,title',
  ]),
  prs: () => ghJson([
    'pr', 'list', '--repo', REPO,
    '--state', 'all', '--limit', String(LIMITE_DE_LISTA), '--json', 'number,headRefName,state',
  ]),
  leerTexto: () => readFileSync(MAPA_JSON, 'utf8'),
  guardar: (texto) => { writeFileSync(MAPA_JSON, texto, 'utf8'); },
  informar: (linea) => { console.log(linea); },
  // El techo lo comparte con el gate del 038, que es quien confirma lo que este script
  // escribe. El porque de que sea uno solo esta en el docblock de `LIMITE_DE_LISTA`.
  limite: LIMITE_DE_LISTA,
  verificar: VERIFICAR,
});

process.exit(codigo);

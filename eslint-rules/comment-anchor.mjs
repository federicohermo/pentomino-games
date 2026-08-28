import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { bloquesDeComentario } from './bloques.mjs';

/*
 * # Un comentario no puede citar algo que ya no esta
 *
 * Portada de `bait-landing-frontend`, y **dada vuelta**. Alla el chequeo `path`
 * PROHIBE nombrar un archivo en un comentario, con un argumento que es bueno alla:
 * sus citas apuntan afuera del repo —Cloud Functions, rutas A/B— asi que no hay
 * contra que verificarlas. Aca esa misma regla da 184 hallazgos y **309 de esas
 * citas resuelven perfectamente**, y un gate que enciende en rojo el arbol entero
 * no se arregla: se apaga.
 *
 * La adaptacion es invertirla: **en vez de prohibir la cita, verificar que
 * resuelva**. Caza las 12 muertas y deja pasar las 309 vivas. No hay prior art de
 * esto en el ecosistema ESLint (spec 051, research M0 y M3).
 *
 * De los ocho chequeos del original no se conserva ninguno tal cual. `cita`,
 * `ticket`, `url`, `cf` y `ruta-version` dan cero hallazgos o no aplican; y `spec`
 * —que alla prohibe nombrar una spec— aca esta al reves: **el puntero al issue de
 * un spec ES la convencion escrita del repo** desde el spec 035.
 *
 * Lo que si se conserva, porque es lo que hace comparables los numeros medidos:
 * las corridas de `//` consecutivos son UN comentario, y las directivas no se
 * miran.
 */

/**
 * Toda cita con forma de archivo. Se aplica al bloque entero y con `g`: el
 * hallazgo es **la cita**, no el bloque, porque un bloque puede tener dos muertas
 * —pasa hoy en `symbols.test.ts`— y arreglar una no arregla la otra.
 */
const CITA = /[\w@./-]*[\w-]\.(?:tsx?|css|mjs|cjs|json|md|yml|yaml)\b/g;

/**
 * Lo que tiene forma de archivo y no es un archivo de este arbol: las librerias de
 * TypeScript. `lib.dom.d.ts` sale citado tres veces en `src/` y ninguna es un error.
 *
 * Los builtins de node **no estan en esta lista y no hacen falta**: `CITA` no admite `:`,
 * asi que un `node:fs` citado en un comentario no llega a ser candidato. Estuvieron un
 * rato, y sacarlos es a proposito: una alternativa que el regex de arriba no puede
 * producir hace que el caso `valid` de `node:fs` pase por un motivo distinto del que
 * declara, que es fallar en verde con otra cara.
 */
const DE_AFUERA = /^lib\.[\w.]+\.d\.ts$/;

/**
 * Los cuatro archivos de un spec. Se descartan **antes** de resolver, y el motivo
 * es el AC5: su directorio es una cache gitignoreada desde el spec 034 y **en la
 * CI esta vacia**. Medido sobre el arbol de hoy, las citas muertas son 12 con la
 * cache puesta y 43 sin ella, y las 31 de diferencia son todas `research.md` y
 * `tasks.md` citadas como fuente de un numero medido, que es la convencion del
 * repo. Resolver contra el arbol de trabajo daria verde local y rojo en Actions.
 *
 * `log.md` NO esta en esta lista a proposito: es justo la cita que hay que cazar
 * —la borro la mudanza de los specs a Issues y sigue nombrada siete veces—.
 */
const CACHE_DE_SPECS = new Set(['spec.md', 'research.md', 'plan.md', 'tasks.md']);

// Una ruta que entra a la cache de specs, que es `specs/` + un directorio que
// empieza con digito (`specs/[0-9]*/`). Va como `//` y no dentro de un bloque
// porque ese glob termina en `*` + `/`, que cierra un comentario de bloque.
const EN_CACHE_DE_SPECS = /(?:^|\/)specs\/[0-9]/;

/** Lo que el indice no camina: nada de adentro es codigo de este repo. */
const DIRS_SALTEADOS = new Set(['node_modules', '.git', 'dist', 'coverage']);

/**
 * Narrativa historica, en tres patrones. El de origen es uno solo y arranca con
 * `antes`, y aca da falsos positivos: caza `// Despues del isValid, no antes`,
 * que es **posicional** y no cronica. `antes` es la palabra mas ambigua del
 * castellano tecnico, y el lookahead del tercero es lo que salva `antes de`,
 * `antes del`, `antes que` y `antes nada`.
 *
 * **El cuarto candidato se midio y quedo afuera** (research M4): `era`, `estaba`,
 * `habia`, `tenia`, `hacia` o `decia` seguidos de articulo dan **56 bloques, 48 de
 * ellos en solitario**, y son castellano descriptivo en pasado y no cronica. Sus
 * 48 hallazgos serian casi todo ruido. Con los tres que quedan la regla apunta a
 * ~70 bloques y `ya no` es el 94 % de la senal.
 */
const HISTORIA = [
  /\b(anteriormente|previamente|sol[ií]a|hasta\s+hace)\b/i,
  /\bya\s+no\b/i,
  /\bantes\s+(?!de\b|del\b|que\b|nada\b)\w+(?:ba|ía|aba|ó|é)\b/i,
];

/** Un indice por raiz, armado **una vez por proceso**: ver `resuelve`. */
const indices = new Map();

/**
 * Todos los basenames del arbol, salteando lo que no es codigo de este repo.
 *
 * Es iterativo y no recursivo por nada profundo —la pila explicita evita el
 * limite de recursion en un arbol con `node_modules` desanidado— y devuelve
 * basenames y no rutas: ver `resuelve`.
 */
function indexar(raiz) {
  const nombres = new Set();
  const pendientes = [''];
  while (pendientes.length > 0) {
    const rel = pendientes.pop();
    for (const entrada of readdirSync(join(raiz, rel), { withFileTypes: true })) {
      if (!entrada.isDirectory()) {
        nombres.add(entrada.name);
        continue;
      }
      if (DIRS_SALTEADOS.has(entrada.name) || (rel === 'specs' && /^[0-9]/.test(entrada.name))) continue;
      pendientes.push(rel === '' ? entrada.name : `${rel}/${entrada.name}`);
    }
  }
  return nombres;
}

/** El indice de `raiz`, armado la primera vez que alguien lo pide. */
function basenames(raiz) {
  const cacheado = indices.get(raiz);
  if (cacheado !== undefined) return cacheado;
  const nuevo = indexar(raiz);
  indices.set(raiz, nuevo);
  return nuevo;
}

/**
 * Si la cita apunta a algo que existe.
 *
 * **El indice primero y `existsSync` despues, y ese orden esta medido**: el
 * prototipo llamaba `existsSync` por cada cita antes de mirar en memoria y
 * gastaba ~315 syscalls que el indice contestaba gratis (research M5).
 *
 * **Empareja por basename y no por ruta, a proposito.** `// ver
 * constants/piece.constants.ts` pasa aunque la ruta este mal si existe algun
 * `piece.constants.ts`. La alternativa —exigir la ruta exacta desde la raiz—
 * convertiria las 309 citas vivas en un problema de formato. Lo que este chequeo
 * caza es **el archivo borrado o renombrado**, que es el modo de falla medido
 * sobre mas de 3000 proyectos en arXiv:2212.01479. Endurecerlo a ruta exacta no
 * es un arreglo: es otra regla, y una que este repo ya midio que no le sirve.
 *
 * El `existsSync` de atras no mira adentro de la cache de specs por el mismo
 * motivo que el indice no la camina: lo que resuelve tiene que resolver igual en
 * un checkout sin hidratar, que es el arbol que ve Actions.
 */
function resuelve(raiz, cita, base) {
  return basenames(raiz).has(base) || (!EN_CACHE_DE_SPECS.test(cita) && existsSync(join(raiz, cita)));
}

/** @type {import('eslint').Rule.RuleModule} */
const commentAnchor = {
  meta: {
    type: 'problem',
    docs: { description: 'Un comentario no puede citar un archivo que no existe ni contar historia' },
    schema: [],
    messages: {
      muerta:
        'El comentario cita `{{cita}}` y no resuelve contra el árbol. Un archivo borrado o renombrado deja el comentario mintiendo: actualizá la cita o describí el rol en vez de la ubicación.',
      historia:
        'El comentario narra historia («{{forma}}»). Si es una restricción que hoy hace que el código tenga que ser así, reescribila sin la forma histórica y se queda; si cuenta cómo se llegó, mudala al issue de su spec y dejá el puntero de una línea.',
    },
  },
  create(context) {
    const source = context.sourceCode;
    const raiz = context.cwd;
    return {
      Program() {
        for (const corrida of bloquesDeComentario(source)) {
          const texto = corrida.map((c) => c.value).join('\n');

          for (const cita of texto.match(CITA) ?? []) {
            const base = cita.slice(cita.lastIndexOf('/') + 1);
            if (DE_AFUERA.test(cita) || CACHE_DE_SPECS.has(base)) continue;
            if (resuelve(raiz, cita, base)) continue;
            context.report({ node: corrida[0], messageId: 'muerta', data: { cita } });
          }

          for (const patron of HISTORIA) {
            const encontrado = texto.match(patron);
            if (encontrado) {
              context.report({ node: corrida[0], messageId: 'historia', data: { forma: encontrado[0].trim() } });
              break;
            }
          }
        }
      },
    };
  },
};

export default commentAnchor;

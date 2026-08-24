/**
 * Trae los specs desde sus issues y reconstruye `specs/NNN-<slug>/` (spec 034).
 *
 * Desde el 034 el registro **vive en GitHub Issues** y `specs/[0-9]…/` esta en el
 * `.gitignore`. O sea que un clone nuevo, y sobre todo un **worktree**, no los tiene:
 * `git worktree add` hace checkout de lo trackeado, y un archivo ignorado no viaja.
 * Medido antes de la mudanza: a un worktree llegaban 136 archivos de `specs/`, y
 * despues llegan **3** — los tres registros.
 *
 * Eso rompe en silencio a `/pr-review-batch` y a `/spec-implement-batch`, que corren
 * cada agente en su propio worktree y leen `specs/NNN-…/spec.md` desde ahi. Este
 * script es lo que lo cierra.
 *
 * ## Explicito y no un hook (D4)
 *
 * Se corre a mano. Un hook en `worktree add` bajaria 34 issues cada vez, es lento y
 * falla sin red — y falla **en medio de otra cosa**, que es donde un error se lee como
 * ruido. Explicito, el fallo esta a la vista.
 *
 * ## El mapa es `log.md` (D2)
 *
 * No hay archivo de mapa aparte: la columna del enlace de `specs/log.md` **es** el
 * mapa spec<->issue, y `log.md` se queda trackeado justamente por eso. Tampoco podia
 * ser aritmetico —`NNN` -> `#NNN`— porque issues y PRs comparten contador: el spec
 * 001 es el issue **#63**.
 *
 * Uso:
 *   node .claude/scripts/hidratar-specs.mjs            # los que falten
 *   node .claude/scripts/hidratar-specs.mjs 021 032    # solo esos
 *   node .claude/scripts/hidratar-specs.mjs --forzar   # rehace los que ya estan
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SPECS = join(RAIZ, 'specs');

const args = process.argv.slice(2);
const FORZAR = args.includes('--forzar');
const PEDIDOS = args.filter((a) => /^\d{3}$/.test(a));

/**
 * El mapa, leido de `log.md`. Necesita las dos cosas de cada fila: el numero de issue
 * —de la columna del enlace— y el **slug** de la carpeta, que sale del titulo del
 * issue y no de aca, porque `log.md` ya no lo escribe.
 */
const LOG = readFileSync(join(SPECS, 'log.md'), 'utf8');
const filas = [...LOG.matchAll(/^\|\s*\[(\d{3})\]\((https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/(\d+))\)/gm)]
  .map((m) => ({ id: m[1], url: m[2], numero: m[3] }));

if (filas.length === 0) {
  console.error(
    'log.md no tiene filas que enlacen a un issue.\n' +
    'O el registro todavia vive en el repo —y entonces no hay nada que hidratar—,\n' +
    'o la tabla se rompio. Las dos cosas se ven abriendo specs/log.md.',
  );
  process.exit(1);
}

const gh = (args_) => execFileSync('gh', args_, { encoding: 'utf8', maxBuffer: 1 << 28 });

/** `# Spec 021 — El tablero es la pantalla` → `021-el-tablero-es-la-pantalla`. */
const slugDe = (titulo, id) => {
  const sinPrefijo = titulo.replace(/^Spec\s+\d{3}\s*[—–-]\s*/, '');
  const slug = sinPrefijo
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // se van los acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-').slice(0, 8).join('-');                  // carpetas cortas, como las de hoy
  return `${id}-${slug}`;
};

/**
 * Un comentario del issue vuelve a ser su archivo. El encabezado que `publicar.mjs`
 * le puso adelante —`## \`research.md\``— es lo que dice cual es, asi que se lee y se
 * saca: no forma parte del archivo original.
 */
const archivoDeComentario = (cuerpo) => {
  const m = /^##\s+`([a-z]+\.md)`\s*\n\n?/.exec(cuerpo);
  if (!m) return null;
  return { nombre: m[1], contenido: cuerpo.slice(m[0].length) };
};

const aHidratar = PEDIDOS.length ? filas.filter((f) => PEDIDOS.includes(f.id)) : filas;
let hechos = 0;

for (const fila of aHidratar) {
  const datos = JSON.parse(gh([
    'issue', 'view', fila.numero, '--repo', fila.url.split('/').slice(3, 5).join('/'),
    '--json', 'title,body,comments',
  ]));

  const carpeta = join(SPECS, slugDe(datos.title, fila.id));
  if (existsSync(carpeta) && !FORZAR) { console.log(`${fila.id}  ya esta`); continue; }

  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, 'spec.md'), datos.body, 'utf8');

  let n = 1;
  for (const c of datos.comments) {
    const archivo = archivoDeComentario(c.body);
    // Un comentario sin el encabezado no es un archivo: es una discusion del issue, y
    // esas NO se escriben al disco. Es la unica forma de distinguirlos, y por eso el
    // encabezado que pone `publicar.mjs` no es decorativo.
    if (!archivo) continue;
    writeFileSync(join(carpeta, archivo.nombre), archivo.contenido, 'utf8');
    n += 1;
  }

  hechos += 1;
  console.log(`${fila.id}  #${fila.numero} → ${slugDe(datos.title, fila.id)}/  (${n} archivos)`);
}

console.log(`\nhidratados: ${hechos} de ${aHidratar.length}`);

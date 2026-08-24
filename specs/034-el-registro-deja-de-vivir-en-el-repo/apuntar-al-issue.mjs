/**
 * Reapunta al issue todo lo que hoy cita un archivo de spec por ruta (spec 034, T016
 * y T022-T023).
 *
 * Son dos cosas y van juntas por necesidad, no por comodidad:
 *
 * 1. **`log.md`**: la columna del enlace pasa de `./NNN-…/spec.md` a la URL del issue.
 *    Eso ES el mapa spec<->issue del AC3, y es lo que hace que el registro cambie de
 *    regimen — los gates leen esa columna para saber que mundo verificar.
 * 2. **Las 16 citas de afuera de `specs/`**: 13 en `docs/`, 2 en `mcp-server/` y 1 en
 *    `DESIGN.md`.
 *
 * Si se hiciera solo lo primero, el gate de enlaces quedaria en rojo con esas 16
 * apuntando a archivos que el repo ya no promete tener. Si se hiciera solo lo segundo,
 * el regimen no cambiaria y no serviria de nada.
 *
 * **Lo que este script NO toca son los `specs/[0-9]…/`**, y es el punto entero: la
 * Desviacion 2 dice que un spec mergeado no se reescribe, asi que sus 119 citas
 * internas se traducen **al publicar** (`publicar.mjs`) y el archivo queda como se
 * escribio. Un enlace que apunta a un archivo que ya no esta en el repo es historia
 * correcta: asi se escribio cuando se escribio.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../..');
const mapa = JSON.parse(readFileSync(join(AQUI, 'mapa.json'), 'utf8'));

const DRY = process.argv.includes('--dry');

/** Las zonas que SI se reescriben. `specs/[0-9]…/` esta deliberadamente afuera. */
const ZONAS = ['docs', 'mcp-server', 'DESIGN.md', 'CLAUDE.md', 'README.md', '.claude'];
const IGNORAR = new Set(['node_modules', 'dist', '.git', 'worktrees', '__screenshots__']);

const caminar = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (IGNORAR.has(e.name)) return [];
    const ruta = join(dir, e.name);
    return e.isDirectory() ? caminar(ruta) : [ruta];
  });

const archivos = ZONAS.flatMap((z) => {
  const ruta = join(RAIZ, z);
  if (!existsSync(ruta)) return [];
  return readdirSync(RAIZ, { withFileTypes: true }).some((e) => e.name === z && e.isDirectory())
    ? caminar(ruta)
    : [ruta];
}).filter((r) => /\.(md|ts|tsx|js)$/.test(r));

/** El mismo regex que `publicar.mjs`, contra las tres formas reales del repo. */
const REF = /(?:\.{1,2}\/)*(?:specs\/)(\d{3})-[a-z0-9-]+\/(?:spec|research|plan|tasks|baseline)\.md/g;

let tocados = 0;
let citas = 0;

for (const archivo of archivos) {
  const antes = readFileSync(archivo, 'utf8');
  const despues = antes.replace(REF, (original, id) => {
    if (!mapa[id]) return original;
    citas += 1;
    return mapa[id].url;
  });
  if (antes === despues) continue;
  tocados += 1;
  if (!DRY) writeFileSync(archivo, despues, 'utf8');
  console.log(`  ${archivo.replace(RAIZ, '').slice(1)}`);
}

console.log(`\ncitas reapuntadas: ${citas} en ${tocados} archivos${DRY ? '  [dry]' : ''}`);

/* ── `log.md`: la columna del enlace pasa a ser el mapa ───────────────────── */
const LOG = join(RAIZ, 'specs/log.md');
const crudo = readFileSync(LOG, 'utf8');
const eol = crudo.includes('\r\n') ? '\r\n' : '\n';

let filas = 0;
const nuevo = crudo.split(/\r?\n/).map((linea) => {
  const m = /^\|\s*\[(\d{3})\]\(\.\/\d{3}-[a-z0-9-]+\/spec\.md\)/.exec(linea);
  if (!m || !mapa[m[1]]) return linea;
  filas += 1;
  return linea.replace(/\(\.\/\d{3}-[a-z0-9-]+\/spec\.md\)/, `(${mapa[m[1]].url})`);
}).join(eol);

if (!DRY) writeFileSync(LOG, nuevo, 'utf8');
console.log(`filas de log.md reapuntadas: ${filas}${DRY ? '  [dry]' : ''}`);

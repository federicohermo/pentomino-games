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
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filasDeLog, slugDe, archivoDeComentario, carpetaExistente } from './lib/specs.ts';

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
const filas = filasDeLog(LOG);

if (filas.length === 0) {
  console.error(
    'log.md no tiene filas que enlacen a un issue.\n' +
    'O el registro todavia vive en el repo —y entonces no hay nada que hidratar—,\n' +
    'o la tabla se rompio. Las dos cosas se ven abriendo specs/log.md.',
  );
  process.exit(1);
}

const gh = (args_) => execFileSync('gh', args_, { encoding: 'utf8', maxBuffer: 1 << 28 });

/** Las carpetas de spec que ya estan, para no crear una segunda por cambiar un titulo. */
const yaEnDisco = () => readdirSync(SPECS, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\d{3}-/.test(e.name))
  .map((e) => e.name);

const aHidratar = PEDIDOS.length ? filas.filter((f) => PEDIDOS.includes(f.id)) : filas;
let hechos = 0;

for (const fila of aHidratar) {
  // La que ya este manda sobre el nombre que saldria del titulo: emparejar por `NNN`
  // es lo que evita una segunda carpeta para el mismo spec cuando el titulo cambio.
  //
  // Y va ANTES del `gh`: la corrida tipica es «los que falten» sobre un checkout casi
  // completo, asi que preguntar primero ahorra las 34 llamadas de red que despues se
  // iban a descartar.
  const nombre = carpetaExistente(yaEnDisco(), fila.id);
  if (nombre !== null && !FORZAR) { console.log(`${fila.id}  ya esta (${nombre}/)`); continue; }

  const datos = JSON.parse(gh([
    'issue', 'view', fila.numero, '--repo', fila.url.split('/').slice(3, 5).join('/'),
    '--json', 'title,body,comments',
  ]));

  const destino = nombre ?? slugDe(datos.title, fila.id);
  const carpeta = join(SPECS, destino);
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, 'spec.md'), datos.body, 'utf8');

  let n = 1;
  for (const c of datos.comments) {
    const archivo = archivoDeComentario(c.body);
    // Un comentario sin el encabezado no es un archivo: es una discusion del issue, y
    // esas NO se escriben al disco. Es la unica forma de distinguirlos, y por eso el
    // encabezado que pone `publicar-spec.mjs` no es decorativo.
    if (!archivo) continue;
    writeFileSync(join(carpeta, archivo.nombre), archivo.contenido, 'utf8');
    n += 1;
  }

  hechos += 1;
  console.log(`${fila.id}  #${fila.numero} → ${destino}/  (${n} archivos)`);
}

console.log(`\nhidratados: ${hechos} de ${aHidratar.length}`);

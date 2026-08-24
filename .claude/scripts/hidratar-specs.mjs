/**
 * Trae los specs desde sus issues y reconstruye `specs/NNN-<slug>/` (spec 034).
 *
 * Desde el 034 el registro **vive en GitHub Issues** y `specs/[0-9]…/` esta en el
 * `.gitignore`. O sea que un clone nuevo, y sobre todo un **worktree**, no los tiene:
 * `git worktree add` hace checkout de lo trackeado, y un archivo ignorado no viaja.
 * Medido antes de la mudanza: a un worktree llegaban 136 archivos de `specs/`, y
 * despues llegan **4**, ninguno de ellos un spec — el `README.md`, el mapa y los dos gates.
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
 * ## El mapa es `specs/mapa.json`
 *
 * No puede ser aritmetico —`NNN` -> `#NNN`— porque issues y PRs comparten contador: el
 * spec 001 es el issue **#63**. Fue la columna del enlace de `log.md` hasta el spec
 * 035, que lo bajo a un JSON de 6 KB con cinco campos por spec.
 *
 * De ahi sale tambien **el nombre de la carpeta**, que antes se derivaba del titulo del
 * issue con `slugDe`. Esa derivacion estaba mal y se midio: reproducia 28 de los 35
 * nombres historicos y fallaba en 7, o sea que un arbol recien hidratado inventaba
 * siete carpetas que ninguna cita del repo conoce.
 *
 * Uso:
 *   node .claude/scripts/hidratar-specs.mjs            # los que falten
 *   node .claude/scripts/hidratar-specs.mjs 021 032    # solo esos
 *   node .claude/scripts/hidratar-specs.mjs --forzar   # rehace los que ya estan
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerMapa, archivoDeComentario, carpetaExistente } from './lib/specs.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SPECS = join(RAIZ, 'specs');

const args = process.argv.slice(2);
const FORZAR = args.includes('--forzar');
const PEDIDOS = args.filter((a) => /^\d{3}$/.test(a));

/**
 * El mapa. Trae las dos cosas que hacen falta por spec: el numero de issue y el nombre
 * de la carpeta.
 *
 * `leerMapa` grita si el archivo no esta o esta vacio, en vez de devolver un mapa sin
 * entradas — que se leeria como «no hay nada que hidratar», que es lo contrario de lo
 * que pasa.
 */
const MAPA = leerMapa(readFileSync(join(SPECS, 'mapa.json'), 'utf8'));
const REPO = 'federicohermo/pentomino-games';
const ids = Object.keys(MAPA).sort();

const gh = (args_) => execFileSync('gh', args_, { encoding: 'utf8', maxBuffer: 1 << 28 });

/** Las carpetas de spec que ya estan, para no crear una segunda por cambiar un titulo. */
const yaEnDisco = () => readdirSync(SPECS, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\d{3}-/.test(e.name))
  .map((e) => e.name);

const aHidratar = PEDIDOS.length ? ids.filter((id) => PEDIDOS.includes(id)) : ids;
let hechos = 0;

for (const id of aHidratar) {
  const entrada = MAPA[id];

  // La que ya este manda sobre el nombre del mapa: emparejar por `NNN` es lo que evita
  // una segunda carpeta para el mismo spec cuando una cache vieja quedo con otro nombre.
  //
  // Y va ANTES del `gh`: la corrida tipica es «los que falten» sobre un checkout casi
  // completo, asi que preguntar primero ahorra las 34 llamadas de red que despues se
  // iban a descartar.
  const nombre = carpetaExistente(yaEnDisco(), id);

  // Una cache con el nombre viejo se RENOMBRA, y esa linea es el arreglo de un no-op.
  // `spec_status` dice «cache vieja, volver a hidratar» cuando el nombre en disco no es
  // el del mapa, pero mientras el destino salia de `nombre ?? entrada.carpeta` volver a
  // hidratar —hasta con `--forzar`— reescribia adentro de la carpeta vieja y nunca la
  // renombraba: seguir el consejo no cambiaba nada y el ENOENT de `spec_write` volvia
  // en la consulta siguiente.
  if (nombre !== null && nombre !== entrada.carpeta) {
    if (existsSync(join(SPECS, entrada.carpeta))) {
      // Dos carpetas con el mismo NNN es el estado que `carpetaExistente` viene a
      // evitar. Renombrar encima tiraria un ENOTEMPTY que no dice esto, asi que se dice.
      console.log(`${id}  OJO: conviven ${nombre}/ y ${entrada.carpeta}/ — borrar la que sobra a mano`);
    } else {
      renameSync(join(SPECS, nombre), join(SPECS, entrada.carpeta));
      console.log(`${id}  renombrada ${nombre}/ → ${entrada.carpeta}/  (el mapa manda sobre el nombre)`);
    }
  }

  // El nombre sale del MAPA y no del titulo ni del disco: ver el encabezado de este
  // archivo, y el renombrado de arriba es lo que hace que eso sea cierto.
  const destino = entrada.carpeta;
  if (nombre !== null && !FORZAR) { console.log(`${id}  ya esta (${destino}/)`); continue; }

  const datos = JSON.parse(gh([
    'issue', 'view', String(entrada.issue), '--repo', REPO,
    '--json', 'title,body,comments',
  ]));

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
  console.log(`${id}  #${entrada.issue} → ${destino}/  (${n} archivos)`);
}

console.log(`\nhidratados: ${hechos} de ${aHidratar.length}`);

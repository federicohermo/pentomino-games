/**
 * Publica los specs de `specs/NNN-…/` como issues de GitHub (spec 034, paso 2).
 *
 * **Vive en `.claude/scripts/` y no dentro del 034, y eso se corrigio sobre la
 * marcha.** El 034 lo escribio dando por hecho que publicar era una migracion de un
 * solo uso; no lo es: **cada spec nuevo se publica**, y el 035 lo estreno el mismo dia.
 * Una herramienta de un solo uso puede vivir adentro de su spec — esta no lo era, y
 * ademas ahi quedaba en un directorio ignorado, o sea sin versionar justo cuando se le
 * estaban arreglando bugs.
 *
 * ## Por que `gh` y no el MCP de GitHub
 *
 * Medido: son 137 archivos y **1,69 MB**. Por el MCP, cada archivo tiene que pasar por
 * el contexto del agente dos veces —al leerlo y al escribirlo como parametro—, o sea
 * ~3,4 MB contra una ventana de 1 M tokens. No entra, y el modo de falla es el peor
 * posible: quedarse a mitad con la mitad de los issues creados y el mapa incompleto,
 * que es el estado `mezclado` que el propio spec define como invalido.
 *
 * Con `gh` el contenido va del disco a la API sin pasar por el medio.
 *
 * ## Dos fases, y por que no una
 *
 * Los specs se citan entre si: 119 de las 135 citas por ruta son internas. Para
 * traducir `./005-…/spec.md` a la URL de su issue hace falta que el issue del 005 ya
 * exista, asi que **no se puede traducir en la misma pasada que crea**.
 *
 *   fase `crear`     — un issue por spec, con un cuerpo minimo, y se anota el mapa.
 *   fase `publicar`  — con el mapa completo, se sube el contenido ya traducido.
 *
 * El mapa se persiste en disco entre las dos, asi que la fase 2 se puede repetir sin
 * volver a crear nada. Es idempotente a proposito: 171 llamadas a una API son
 * suficientes para que algo falle a la mitad.
 *
 * Uso:
 *   node .claude/scripts/publicar-spec.mjs crear     [--dry]
 *   node .claude/scripts/publicar-spec.mjs publicar  [--dry]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../..');
const SPECS = join(RAIZ, 'specs');
// El mapa vive con los specs y no con el script: es dato, no herramienta. (El 035 lo
// muda a `specs/mapa.json` y lo hace la unica fuente; hasta entonces convive con la
// columna de enlace de `log.md`.)
const MAPA_JSON = join(SPECS, '034-el-registro-deja-de-vivir-en-el-repo', 'mapa.json');
const REPO = 'federicohermo/pentomino-games';

const [fase] = process.argv.slice(2);
const DRY = process.argv.includes('--dry');

/** Los cuatro archivos, en el orden en que se publican. El `spec.md` va al body. */
const CUERPO = 'spec.md';
const COMENTARIOS = ['research.md', 'plan.md', 'tasks.md', 'baseline.md'];

const carpetas = readdirSync(SPECS, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\d{3}-/.test(e.name))
  .map((e) => e.name)
  .sort();

const LOG = readFileSync(join(SPECS, 'log.md'), 'utf8');

/** El estado que `log.md` declara para un spec. Decide si el issue queda abierto. */
const estadoDe = (id) => {
  const m = new RegExp(`^\\|\\s*\\[${id}\\]\\([^)]*\\)\\s*\\|[^|]*\\|([^|]*)\\|`, 'm').exec(LOG);
  return m ? m[1].trim() : null;
};

/** `# Spec 017 — El régimen de rotación` → el titulo del issue, tal cual. */
const tituloDe = (carpeta) => {
  const primera = readFileSync(join(SPECS, carpeta, CUERPO), 'utf8').split(/\r?\n/)[0];
  const t = primera.replace(/^#\s*/, '').trim();
  if (!t) throw new Error(`${carpeta}/${CUERPO} no arranca con un encabezado`);
  return t;
};

const gh = (args, stdin) => {
  if (DRY) { console.log('   [dry] gh', args.slice(0, 6).join(' '), stdin ? `(+${stdin.length}B)` : ''); return 'DRY'; }
  return execFileSync('gh', args, { input: stdin, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
};

const leerMapa = () => (existsSync(MAPA_JSON) ? JSON.parse(readFileSync(MAPA_JSON, 'utf8')) : {});

/**
 * **En `--dry` no se escribe.** No es prolijidad: un mapa con los numeros en 0 haria
 * que la corrida de verdad viera «ya existe» para los 34 y no creara ninguno,
 * dejando el trabajo hecho a medias sin un solo error. Es el mismo «fallar en verde»
 * que el spec 034 persigue, y se cuela hasta en su propia herramienta.
 */
const guardarMapa = (m) => {
  if (DRY) return;
  writeFileSync(MAPA_JSON, `${JSON.stringify(m, null, 2)}\n`, 'utf8');
};

/* ── Fase 1: crear ────────────────────────────────────────────────────────── */
if (fase === 'crear') {
  const mapa = leerMapa();
  for (const carpeta of carpetas) {
    const id = carpeta.slice(0, 3);
    if (mapa[id]) { console.log(`${id}  ya existe → #${mapa[id].numero}`); continue; }

    const url = gh([
      'issue', 'create', '--repo', REPO,
      '--title', tituloDe(carpeta),
      // Cuerpo minimo a proposito: el de verdad lo sube la fase 2, ya traducido. Si
      // esto quedara publicado por un fallo a mitad, dice que le falta.
      '--body', `Spec \`${carpeta}\`. El contenido lo sube la fase 2 de \`publicar.mjs\`.`,
    ]);
    const numero = DRY ? 0 : Number(url.split('/').at(-1));
    mapa[id] = { carpeta, numero, url: DRY ? '(dry)' : url };
    guardarMapa(mapa);
    console.log(`${id}  creado → #${numero}`);
  }
  console.log(`\nmapa: ${Object.keys(mapa).length} specs en ${MAPA_JSON}`);
}

/* ── Fase 2: publicar el contenido, ya traducido ──────────────────────────── */
if (fase === 'publicar') {
  const mapa = leerMapa();
  const faltan = carpetas.filter((c) => !mapa[c.slice(0, 3)]);
  if (faltan.length) throw new Error(`el mapa no tiene: ${faltan.join(', ')} — corre la fase "crear" primero`);

  /**
   * Traduce las referencias a otro spec por su URL de issue. **Es lo que permite no
   * tocar un solo archivo de `specs/[0-9]…/`**: la Desviacion 2 dice que un spec
   * mergeado no se reescribe, asi que la traduccion pasa a la publicacion.
   *
   * Cubre las dos formas que existen en el repo: la relativa desde adentro de
   * `specs/` (`./005-…/spec.md`) y la que llega desde afuera (`specs/005-…/spec.md`,
   * con o sin `../` adelante).
   */
  const traducir = (texto) => texto.replace(
    /(?:\.{1,2}\/)*(?:specs\/)?(\d{3})-[a-z0-9-]+\/(?:spec|research|plan|tasks|baseline)\.md/g,
    (original, id) => (mapa[id] ? mapa[id].url : original),
  );

  for (const carpeta of carpetas) {
    const id = carpeta.slice(0, 3);
    const { numero } = mapa[id];

    gh(['issue', 'edit', String(numero), '--repo', REPO, '--body-file', '-'],
      traducir(readFileSync(join(SPECS, carpeta, CUERPO), 'utf8')));

    // Los comentarios que ya estan, por el archivo que representan. **Sin esto el
    // script no es idempotente**: `gh issue comment` AGREGA uno nuevo cada vez, asi
    // que una segunda corrida deja 6 comentarios donde tiene que haber 3 — medido,
    // paso de verdad al publicar el 035. Y no falla: duplicar en silencio es peor que
    // romper.
    const actual = DRY
      ? { comments: [], state: 'OPEN' }
      : JSON.parse(gh(['issue', 'view', String(numero), '--repo', REPO, '--json', 'comments,state']));

    const yaEstan = new Map(
      actual.comments
        .map((c) => [/^##\s+`([a-z]+\.md)`/.exec(c.body)?.[1], c.url.split('-').at(-1)])
        .filter(([nombre]) => nombre !== undefined),
    );

    let n = 0;
    for (const archivo of COMENTARIOS) {
      const ruta = join(SPECS, carpeta, archivo);
      if (!existsSync(ruta)) continue;
      const cuerpo = `## \`${archivo}\`\n\n${traducir(readFileSync(ruta, 'utf8'))}`;
      // El limite de un body y de un comentario son 65.536 bytes. Medido: el peor
      // archivo del repo es el `tasks.md` del 021 con 41.051, o sea el 63 %. Si algun
      // dia se pasa, se parte en dos comentarios — pero que falle fuerte y no que
      // GitHub lo trunque en silencio.
      const bytes = Buffer.byteLength(cuerpo, 'utf8');
      if (bytes > 65536) throw new Error(`${carpeta}/${archivo}: ${bytes} B, no entra en un comentario`);

      const existente = yaEstan.get(archivo);
      if (existente) {
        gh(['api', '--method', 'PATCH', `repos/${REPO}/issues/comments/${existente}`,
          '--field', `body=@-`, '--silent'], cuerpo);
      } else {
        gh(['issue', 'comment', String(numero), '--repo', REPO, '--body-file', '-'], cuerpo);
      }
      n += 1;
    }

    // Los terminales y los implementados se cierran; `Propuesto` queda abierto.
    //
    // **Un estado que no se pudo leer NO cierra.** Sin esta guarda, un spec que
    // todavia no tiene fila en el registro caia en el `else` y se cerraba — que es lo
    // contrario de lo correcto, porque un spec recien escrito es justamente el que
    // tiene que quedar abierto. Paso de verdad con el 035.
    //
    // Y **solo si esta abierto**: `gh issue close` sobre uno ya cerrado devuelve error,
    // asi que sin esta condicion el script se cae en la segunda corrida. Es la misma
    // clase de bug que los comentarios duplicados — una herramienta que se usa una vez
    // igual tiene que poder correrse dos.
    const estado = estadoDe(id);
    const cerrar = estado !== null && estado !== 'Propuesto' && estado !== 'En curso';
    if (estado === null) {
      console.log(`${id}  SIN ESTADO en el registro: se deja abierto y no se toca`);
    } else if (cerrar && actual.state === 'OPEN') {
      gh(['issue', 'close', String(numero), '--repo', REPO,
        '--reason', estado === 'Descartado' ? 'not planned' : 'completed']);
    }
    console.log(`${id}  #${numero}  body + ${n} comentarios  [${estado}]`);
  }
}

if (fase !== 'crear' && fase !== 'publicar') {
  console.error('uso: node .claude/scripts/publicar-spec.mjs crear|publicar [--dry]');
  process.exit(1);
}

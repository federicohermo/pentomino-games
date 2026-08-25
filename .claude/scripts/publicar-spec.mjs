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
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerMapa, estadoDe, enVuelo, traducir, escribirMapa, NOMBRE_PUBLICABLE } from './lib/specs.ts';
// El lanzador de `gh` que explica sus fallos en vez de tirar un `ENOENT` crudo (issue #125).
import { gh as lanzarGh } from './lib/gh.ts';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../..');
const SPECS = join(RAIZ, 'specs');
// **El mapa es uno solo y esta trackeado** (spec 035). Antes eran dos —la tabla de
// `log.md` como fuente, y un `mapa.json` adentro de la carpeta del 034 como buffer del
// hueco entre crear el issue y anotar su fila—, y ese segundo vivia en un directorio
// IGNORADO. O sea que vaciar e hidratar `specs/` —la verificacion fuerte del 034— lo
// borraba, y si hubiera sido la unica fuente, la corrida siguiente de `crear` no
// habria reconocido ni un spec: **34 issues duplicados** sin un solo error.
//
// Con `specs/mapa.json` trackeado el problema no existe: la fuente y el buffer son el
// mismo archivo, y sobrevive al vaciado porque no es cache.
const MAPA_JSON = join(SPECS, 'mapa.json');
const REPO = 'federicohermo/pentomino-games';

const [fase] = process.argv.slice(2);
const DRY = process.argv.includes('--dry');

/** El `spec.md` va al body del issue; todo el resto va como comentario. */
const CUERPO = 'spec.md';

/**
 * Los `.md` de la carpeta que NO son el body, en orden de lectura.
 *
 * Era una lista hardcodeada —`research`, `plan`, `tasks`, `baseline`— y eso la
 * convertia en un lugar mas que hay que acordarse de editar. El 035 escribio un
 * `reparto.md` y la publicacion **lo dejo afuera sin decir nada**: el issue quedo con
 * tres comentarios y el archivo solo en el disco, que es un directorio ignorado. O sea
 * que el artefacto que hace auditable un AC se habria perdido al hidratar, en verde.
 *
 * Los tres canonicos van primero y en su orden; cualquier otro va detras, alfabetico.
 * El nombre se acepta con `NOMBRE_PUBLICABLE`, que es **la misma constante** que usa
 * `archivoDeComentario` para reconocerlo al bajar: mientras aca decia `[a-z]+.md` y
 * alla tambien, un `reparto-de-lote.md` o un `research-2.md` volvia a caer en el mismo
 * agujero que este comentario dice haber tapado —afuera y sin decirlo—.
 *
 * Y lo que igual no entra **grita**, en vez de quedar afuera en silencio. No es
 * exageracion: `specs/[0-9]…/` esta ignorado, asi que un `.md` no publicado no queda
 * "para la proxima" — se pierde en la hidratacion siguiente. Es la misma politica que
 * el limite de 65.536 bytes de mas abajo, y el arreglo es renombrar el archivo.
 */
const CANONICOS = ['research.md', 'plan.md', 'tasks.md'];
const comentariosDe = (carpeta) => {
  const todos = readdirSync(join(SPECS, carpeta)).filter((f) => f.endsWith('.md') && f !== CUERPO);
  const afuera = todos.filter((f) => !NOMBRE_PUBLICABLE.test(f));
  if (afuera.length) {
    throw new Error(`${carpeta}: ${afuera.join(', ')} no se puede publicar y specs/ esta ignorado, ` +
      'asi que se perderia al hidratar. El nombre va en minusculas, digitos y guiones: [a-z0-9-]+.md');
  }
  const extras = todos.filter((f) => !CANONICOS.includes(f)).sort();
  return [...CANONICOS.filter((f) => todos.includes(f)), ...extras];
};

const carpetas = readdirSync(SPECS, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\d{3}-/.test(e.name))
  .map((e) => e.name)
  .sort();


/** `# Spec 017 — El régimen de rotación` → el titulo del issue, tal cual. */
const tituloDe = (carpeta) => {
  const primera = readFileSync(join(SPECS, carpeta, CUERPO), 'utf8').split(/\r?\n/)[0];
  const t = primera.replace(/^#\s*/, '').trim();
  if (!t) throw new Error(`${carpeta}/${CUERPO} no arranca con un encabezado`);
  return t;
};

const gh = (args, stdin) => {
  if (DRY) { console.log('   [dry] gh', args.slice(0, 6).join(' '), stdin ? `(+${stdin.length}B)` : ''); return 'DRY'; }
  return lanzarGh(args, { input: stdin, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
};

/** El mapa, de su unico archivo. */
const mapaDelDisco = () => leerMapa(readFileSync(MAPA_JSON, 'utf8'));

/**
 * **En `--dry` no se escribe.** No es prolijidad: un mapa con los numeros en 0 haria
 * que la corrida de verdad viera «ya existe» para los 34 y no creara ninguno,
 * dejando el trabajo hecho a medias sin un solo error. Es el mismo «fallar en verde»
 * que el spec 034 persigue, y se cuela hasta en su propia herramienta.
 */
const guardarMapa = (m) => {
  if (DRY) return;
  // El formato —una entrada por linea, ordenadas por `NNN`— vive en `escribirMapa` desde
  // el 043, porque escriben dos: este script y el derivador de la Action. Mientras estuvo
  // aca inline, la segunda copia habria sido el lugar donde el diff de una linea se
  // vuelve uno de cuarenta y dos sin que nada falle.
  writeFileSync(MAPA_JSON, escribirMapa(m), 'utf8');
};

/* ── Fase 1: crear ────────────────────────────────────────────────────────── */
if (fase === 'crear') {
  const mapa = mapaDelDisco();
  for (const carpeta of carpetas) {
    const id = carpeta.slice(0, 3);
    if (mapa[id]) { console.log(`${id}  ya existe → #${mapa[id].issue}`); continue; }

    const url = gh([
      'issue', 'create', '--repo', REPO,
      '--title', tituloDe(carpeta),
      // Cuerpo minimo a proposito: el de verdad lo sube la fase 2, ya traducido. Si
      // esto quedara publicado por un fallo a mitad, dice que le falta.
      '--body', `Spec \`${carpeta}\`. El contenido lo sube la fase 2 de \`publicar-spec.mjs\`.`,
    ]);
    const numero = DRY ? 0 : Number(url.split('/').at(-1));
    // Los cinco campos que el mapa declara, y los cinco los mira un gate. `estado`
    // arranca en `Propuesto` porque un spec recien publicado no puede estar en otro, y
    // `fecha` es la de hoy: es la que `log.md` ponia en su columna Fecha, que era el dia
    // en que el spec se escribio — y publicarlo es el mismo dia.
    mapa[id] = {
      issue: numero,
      carpeta,
      fecha: new Date().toISOString().slice(0, 10),
      estado: 'Propuesto',
      titulo: tituloDe(carpeta),
    };
    guardarMapa(mapa);
    console.log(`${id}  creado → #${numero}`);
  }
  console.log(`\nmapa: ${Object.keys(mapa).length} specs en ${MAPA_JSON}`);
}

/* ── Fase 2: publicar el contenido, ya traducido ──────────────────────────── */
if (fase === 'publicar') {
  const mapa = mapaDelDisco();
  const faltan = carpetas.filter((c) => !mapa[c.slice(0, 3)]);
  if (faltan.length) throw new Error(`el mapa no tiene: ${faltan.join(', ')} — corre la fase "crear" primero`);

  for (const carpeta of carpetas) {
    const id = carpeta.slice(0, 3);
    const numero = mapa[id].issue;

    gh(['issue', 'edit', String(numero), '--repo', REPO, '--body-file', '-'],
      traducir(readFileSync(join(SPECS, carpeta, CUERPO), 'utf8'), mapa, REPO));

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
        // El mismo alfabeto que `NOMBRE_PUBLICABLE`, sin el ancla de fin: aca lo que
        // sigue es el cuerpo del archivo. Si este reconociera menos nombres que los que
        // se suben, la segunda corrida no vería el comentario que ella misma escribió y
        // agregaría uno nuevo — que es el bug de idempotencia que ya pasó con el 035.
        .map((c) => [/^##\s+`([a-z0-9-]+\.md)`/.exec(c.body)?.[1], c.url.split('-').at(-1)])
        .filter(([nombre]) => nombre !== undefined),
    );

    let n = 0;
    for (const archivo of comentariosDe(carpeta)) {
      const ruta = join(SPECS, carpeta, archivo);
      if (!existsSync(ruta)) continue;
      const cuerpo = `## \`${archivo}\`\n\n${traducir(readFileSync(ruta, 'utf8'), mapa, REPO)}`;
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
    const estado = estadoDe(mapa, id);
    // `enVuelo` y no el conjunto escrito acá a mano: mientras lo estuvo, decía
    // `estado !== 'Propuesto' && estado !== 'En curso'`, así que el 038 —que saca `En
    // curso`— habría dejado esta línea mirando un estado que ya no existe, en verde.
    const cerrar = estado !== null && !enVuelo(estado);
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

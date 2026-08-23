import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve, relative } from 'node:path';

/**
 * Todo enlace relativo de todo `.md` del repo resuelve: el archivo existe, y si el
 * enlace trae ancla, el encabezado existe.
 *
 * Es el gate que ningun linter puede dar. `markdown/no-missing-link-fragments` mira
 * las anclas de UN archivo contra sus propios encabezados, y este repo enlaza sobre
 * todo hacia AFUERA —`CLAUDE.md` a `docs/`, `docs/` entre si, los specs a los specs—,
 * que es justo lo que esa regla no ve. Por eso esta apagada en `eslint.config.js` y
 * por eso existe este archivo.
 *
 * El otro motivo de que sea un test y no una regla es el slugger. El de la regla no
 * coincide con el de GitHub sobre un encabezado con backticks y guion bajo, asi que
 * declaraba roto el unico enlace a `#find_symbol` de `mcp-domain.md`, que en GitHub
 * resuelve: **«arreglarlo» lo habria roto de verdad**. Las dos diferencias estan
 * abajo, cada una con el falso positivo que produce si se escribe de la otra forma.
 *
 * Es un test del proyecto `node`: son archivos leidos del disco y comparados como
 * texto, sin un DOM en el medio. Vive en `src/__tests__/`, que el `exclude` de
 * coverage ya saca, junto a los otros tres tests del repo —y no de `src/`— que ya
 * hacian esto mismo con tres valores puntuales.
 */

/**
 * La raiz del repo: este archivo vive en `src/__tests__/`.
 *
 * Con `fileURLToPath` y no con `.pathname`: en Windows el pathname de un `file://`
 * viene como `/D:/...`, con una barra de mas adelante, y `resolve` sobre eso da una
 * ruta que no existe.
 */
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Existe y es un archivo o un directorio. */
const existe = (ruta: string) => existsSync(ruta);

/**
 * Lo que no se camina. `node_modules` es obvio; `.claude/worktrees/` no lo es y es el
 * que importa: adentro vive un checkout completo del repo, asi que sin esta linea
 * cada `.md` del proyecto se verifica una vez de mas por cada tarea en paralelo que
 * este corriendo, y el test pasa a depender de si hay una.
 */
const IGNORADOS = new Set(['node_modules', 'dist', '.git', 'worktrees', '__screenshots__']);

const caminar = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (IGNORADOS.has(e.name)) return [];
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return caminar(ruta);
    return e.name.endsWith('.md') ? [ruta] : [];
  });

const ARCHIVOS = caminar(RAIZ);

/**
 * El slug de un encabezado, con las reglas de GitHub y las **dos** diferencias que
 * costaron un falso positivo cada una:
 *
 * 1. **Los espacios NO se colapsan** (`/\s/g` y no `/\s+/g`). GitHub reemplaza cada
 *    espacio por un guion, uno a uno. Un encabezado con `→` —que se borra por no ser
 *    alfanumerico— queda con dos espacios seguidos y por lo tanto con DOS guiones.
 *    Con el `+` daba 4 falsos positivos, los 4 sobre encabezados con flecha.
 * 2. **El `_` se conserva.** Al limpiar los backticks es tentador barrer tambien el
 *    guion bajo; si se hace, `### \`find_symbol\`` deja de dar `find_symbol` y
 *    reaparece el falso positivo del enlace de `docs/guides/mcp-domain.md`, que en
 *    GitHub anda. El guion bajo es uno de los pocos signos que GitHub NO borra.
 */
const slug = (encabezado: string) =>
  encabezado
    .trim()
    .toLowerCase()
    // Se van los signos, y se conservan letras (con acentos), numeros, espacios,
    // guiones y guiones bajos. `\p{L}` cubre la `ñ` y las vocales acentuadas, que en
    // este repo aparecen en casi todos los encabezados.
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/\s/g, '-');

/**
 * Los encabezados de un `.md`, ya como slugs y con el sufijo que GitHub le agrega a
 * los repetidos (`-1`, `-2`, …). Sin el sufijo, un enlace legitimo a la segunda
 * aparicion de un titulo daria roto.
 *
 * Los fences se saltean: un `# comentario` adentro de un bloque de codigo no es un
 * encabezado, y este repo tiene arboles de directorios llenos de `#`.
 */
const anclasDe = (contenido: string) => {
  const vistos = new Map<string, number>();
  const anclas = new Set<string>();
  let enFence = false;

  for (const linea of contenido.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(linea)) { enFence = !enFence; continue; }
    if (enFence) continue;

    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(linea);
    if (!m) continue;

    const base = slug(m[2]);
    const n = vistos.get(base) ?? 0;
    vistos.set(base, n + 1);
    anclas.add(n === 0 ? base : `${base}-${n}`);
  }
  return anclas;
};

/** Cache: los archivos destino se leen una vez aunque los apunten veinte enlaces. */
const cacheAnclas = new Map<string, Set<string>>();
const anclasDeArchivo = (ruta: string) => {
  const yaEsta = cacheAnclas.get(ruta);
  if (yaEsta) return yaEsta;
  const calculadas = anclasDe(readFileSync(ruta, 'utf8'));
  cacheAnclas.set(ruta, calculadas);
  return calculadas;
};

/**
 * Los enlaces `[texto](destino)` de un archivo, ya descartados los externos.
 *
 * Se saltea el contenido de los fences por el mismo motivo que en `anclasDe`: un
 * ejemplo de sintaxis adentro de un bloque de codigo no es un enlace del documento.
 */
const enlacesDe = (contenido: string) => {
  const enlaces: { destino: string; linea: number }[] = [];
  let enFence = false;

  contenido.split(/\r?\n/).forEach((texto, i) => {
    if (/^\s*(```|~~~)/.test(texto)) { enFence = !enFence; return; }
    if (enFence) return;

    for (const m of texto.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const destino = m[1];
      // Externos y protocolos: no son cosa de este gate.
      if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(destino)) continue;
      enlaces.push({ destino, linea: i + 1 });
    }
  });
  return enlaces;
};

describe('los enlaces relativos de la documentacion resuelven', () => {
  it('camina todos los `.md` del repo, y son mas de cien', () => {
    // El gate mas importante del archivo y el que parece de adorno: si el caminante
    // se rompe o si un `IGNORADOS` de mas se come medio repo, los otros dos tests
    // pasan **sin haber mirado nada**. Es el mismo «fallar en verde» que el `--filter
    // "{.}"` de `verify`, aca con otra cara.
    expect(ARCHIVOS.length).toBeGreaterThan(100);
  });

  it('cada enlace apunta a un archivo que existe', () => {
    const rotos: string[] = [];

    for (const archivo of ARCHIVOS) {
      for (const { destino, linea } of enlacesDe(readFileSync(archivo, 'utf8'))) {
        const [ruta] = destino.split('#');
        if (ruta === '') continue; // ancla propia: la mira el test de abajo
        const absoluto = resolve(dirname(archivo), ruta);
        if (!ARCHIVOS.includes(absoluto) && !existe(absoluto)) {
          rotos.push(`${relative(RAIZ, archivo)}:${linea} → ${destino}`);
        }
      }
    }

    // La lista entera y no el primero: son 162 archivos, y un gate que dice «fallo»
    // sin decir donde es un gate que se apaga.
    expect(rotos, `enlaces a un archivo que no existe:\n${rotos.join('\n')}`).toEqual([]);
  });

  it('cada ancla apunta a un encabezado que existe, propia o ajena', () => {
    const rotas: string[] = [];

    for (const archivo of ARCHIVOS) {
      const contenido = readFileSync(archivo, 'utf8');
      for (const { destino, linea } of enlacesDe(contenido)) {
        const [ruta, ancla] = destino.split('#');
        if (!ancla) continue;

        const objetivo = ruta === '' ? archivo : resolve(dirname(archivo), ruta);
        if (!existe(objetivo)) continue; // ya lo reporta el test de arriba
        if (!objetivo.endsWith('.md')) continue;

        if (!anclasDeArchivo(objetivo).has(ancla.toLowerCase())) {
          rotas.push(`${relative(RAIZ, archivo)}:${linea} → ${destino}`);
        }
      }
    }

    expect(rotas, `anclas que no existen:\n${rotas.join('\n')}`).toEqual([]);
  });
});

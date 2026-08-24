import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';

/**
 * La convencion que `specs/README.md` documenta, verificada.
 *
 * El punto que le da sentido al archivo entero es el del formato de tarea. `parseTasks`
 * (`mcp-server/src/specs.ts`) **no valida: cuenta lo que matchea**, asi que una linea
 * que empieza con `- [ ]` y no encaja en el formato no se cuenta y no avisa. O sea que
 * una tarea mal escrita baja el total de `spec_status` en silencio, y el estado del
 * trabajo planificado pasa a ser mas optimista de lo que es sin que nada lo diga.
 *
 * Es la familia «fallar en verde» que este repo ya se comio dos veces con el
 * `--filter "{.}"` y con el `$` del regex de `verify`. Hoy hay **cero** lineas
 * malformadas, asi que el gate entra gratis — y a partir de ahi la leniencia del parser
 * deja de tener consecuencia: no puede haber una linea que descarte.
 *
 * Los dos limites del gate estan en el AC9 del spec y no son negociables:
 * **no** exige IDs consecutivos ni una ruta de archivo por tarea, aunque Spec Kit pida
 * las dos cosas. Un gate que falla sobre specs cerrados es un gate que se apaga a la
 * semana, y la Desviacion 2 prohibe reescribirlos para satisfacerlo.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SPECS = join(RAIZ, 'specs');

/**
 * Las carpetas de spec: `NNN-descripcion-kebab`.
 *
 * Se listan TODAS y se descuenta una sola por nombre, en vez de filtrar por
 * `/^\d{3}-/`. La diferencia importa: con el filtro, el gate «cada carpeta se llama
 * `NNN-descripcion-kebab`» solo podria ver las que ya cumplen, o sea que no podria
 * fallar nunca. Una carpeta mal nombrada tiene que seguir siendo roja.
 *
 * `__tests__` es la excepcion y es este mismo directorio: los gates del registro
 * viven al lado de lo que verifican (spec 035).
 */
const CARPETAS = readdirSync(SPECS, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== '__tests__')
  .map((e) => e.name)
  .sort();

const LOG = readFileSync(join(SPECS, 'log.md'), 'utf8');

/**
 * El formato de tarea, **el mismo regex que `parseTasks`**. Que sea el mismo es el
 * punto: si aca se escribiera uno mas permisivo, el gate diria que el archivo esta bien
 * y la tool seguiria descartando la linea igual.
 */
const TAREA = /^\s*-\s\[([ xX])\]\s*(?:(T\d{3})\s+)?((?:\[[PM]\]\s*)*)(.*)$/;

/** Toda linea que ARRANCA como checkbox, matchee o no el formato completo. */
const PARECE_TAREA = /^\s*-\s\[.\]/;

/* ────────────────────────────────────────────────────────────────────────────
 * El regimen, y por que existe (spec 034)
 *
 * El 034 saca `specs/NNN-…/` del repo: el spec pasa a vivir en un issue y el
 * directorio local queda como cache. O sea que estos gates tienen que valer en
 * DOS mundos, y el modo de falla a evitar esta medido — con `specs/` ignorado,
 * el gate «cada spec tiene sus cuatro archivos» **pasaba en verde con cero
 * carpetas**, porque `flatMap` sobre una lista vacia devuelve `[]`.
 *
 * La regla que dejo esa medicion: **la red anti-vacio ES el gate.** La asercion
 * que mira el contenido es la que sobra cuando no hay contenido.
 *
 * Asi que el regimen **no se infiere** de si los directorios estan o no —eso es
 * exactamente el gate apagandose solo—: lo **declara `log.md`**, en la unica
 * columna que ya apunta a algo. Si sus filas enlazan a `./NNN-…/spec.md` el
 * registro vive en el repo; si enlazan a un issue, vive en GitHub. Y tiene que
 * ser uniforme: media tabla migrada es justo el estado que el 034 evita.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Una fila de la tabla de `log.md`: su `NNN` y a donde enlaza. */
const filasDeLog = (log: string) =>
  [...log.matchAll(/^\|\s*\[(\d{3})\]\(([^)]*)\)/gm)].map((m) => ({ id: m[1], href: m[2].trim() }));

const ES_RUTA = /^\.\/\d{3}-[a-z0-9-]+\/spec\.md$/;
const ES_ISSUE = /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/;

/**
 * `archivo` · `issue` · `mezclado` · `vacio`. Los dos ultimos son estados invalidos y
 * un gate los reporta: sin eso, un `log.md` que no matchea nada dejaria a todos los
 * demas sin saber que verificar, que es la forma en la que este archivo se apagaria.
 */
const regimenDe = (log: string) => {
  const filas = filasDeLog(log);
  if (filas.length === 0) return 'vacio';
  const rutas = filas.filter((f) => ES_RUTA.test(f.href)).length;
  const issues = filas.filter((f) => ES_ISSUE.test(f.href)).length;
  if (rutas === filas.length) return 'archivo';
  if (issues === filas.length) return 'issue';
  return 'mezclado';
};

const FILAS = filasDeLog(LOG);
const REGIMEN = regimenDe(LOG);

describe('el regimen del registro esta declarado y es uniforme', () => {
  // Este bloque va PRIMERO y es la condicion de los demas: si no se sabe en que
  // regimen esta el registro, ningun gate de abajo sabe que tiene que verificar, y
  // «no saber» tiene que ser rojo y no verde.
  it('`log.md` declara un regimen, y no es ni vacio ni mezclado', () => {
    expect(
      REGIMEN,
      REGIMEN === 'vacio'
        ? 'No se leyo ninguna fila de log.md. O la tabla se rompio, o el regex de filasDeLog dejo de matchear su formato.'
        : 'La tabla de log.md tiene filas que enlazan a una ruta y filas que enlazan a un issue.\n' +
          'Media tabla migrada es el estado que el spec 034 existe para evitar: mientras dure,\n' +
          'ningun gate sabe si un spec deberia estar en el disco o no.',
    ).toMatch(/^(archivo|issue)$/);
  });

  it('hay filas que verificar', () => {
    // La red anti-vacio del registro, que vale en los DOS regimenes: `log.md` se
    // queda trackeado pase lo que pase, asi que sus filas son lo unico que siempre
    // esta. Sin esto, un `log.md` truncado deja todo lo de abajo corriendo sobre
    // listas vacias.
    expect(FILAS.length).toBeGreaterThan(20);
  });

  it('cada fila enlaza a algo que existe: su carpeta, o su issue', () => {
    // El reemplazo del viejo «cada fila de log.md tiene su carpeta», que en regimen
    // `issue` no tendria a que apuntar. Es tambien el mapa spec<->issue del AC3: en
    // regimen `issue`, esta columna ES el mapa, y verificar que cada fila lo tenga es
    // verificar que el mapa este completo.
    const carpetas = new Set(CARPETAS.map((c) => c.slice(0, 3)));
    const rotas = FILAS.filter((f) => (REGIMEN === 'archivo'
      ? !carpetas.has(f.id) || !f.href.startsWith(`./${f.id}-`)
      : !ES_ISSUE.test(f.href)));

    expect(rotas.map((f) => `${f.id} → ${f.href}`), `filas que no resuelven (regimen ${REGIMEN})`).toEqual([]);
  });

  it('cada fila trae fecha ISO y un estado del conjunto cerrado', () => {
    // Los cinco estados los declara `log.md` arriba de su propia tabla. Se listan aca
    // porque el gate tiene que fallar ante uno inventado, que es la forma en la que una
    // tabla de estados se desarma: alguien escribe «En progreso» y `spec_status` lo lee
    // como no-terminal sin que nada avise.
    //
    // Corre en los dos regimenes: `log.md` se queda trackeado pase lo que pase, y estas
    // dos columnas son suyas y no del directorio.
    const ESTADOS = ['Propuesto', 'En curso', 'Implementado', 'Descartado', 'Superado'];
    const problemas: string[] = [];

    for (const { id } of FILAS) {
      const fila = new RegExp(`^\\|\\s*\\[${id}\\]\\([^)]*\\)\\s*\\|([^|]*)\\|([^|]*)\\|`, 'm').exec(LOG);
      if (!fila) { problemas.push(`${id}: la fila no tiene las tres columnas`); continue; }

      const fecha = fila[1].trim();
      const estado = fila[2].trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) problemas.push(`${id}: fecha "${fecha}" no es ISO`);
      if (!ESTADOS.includes(estado)) problemas.push(`${id}: estado "${estado}" no esta en el conjunto`);
    }

    expect(problemas, `filas de log.md con problemas:\n${problemas.join('\n')}`).toEqual([]);
  });

  /**
   * La direccion que falta: toda carpeta que ESTE tiene su fila.
   *
   * **Corre en los dos regimenes**, y eso costo una falsificacion: cuando vivia en el
   * bloque de regimen `archivo`, borrar la fila del 031 con el registro ya migrado
   * **no fallaba** — el gate se salteaba y nadie miraba. Y ahi es cuando mas importa:
   * `log.md` ES el mapa spec<->issue, asi que una carpeta sin fila es un spec al que
   * no se puede llegar ni hidratar.
   *
   * En regimen `issue` sin hidratar no hay carpetas y no hay nada que cruzar, que es
   * correcto — pero entonces no aporta nada, y por eso el conteo va en el mensaje: un
   * cero ahi significa «no habia nada que mirar» y no «esta todo bien».
   *
   * Es la asimetria con `mapa-de-directorios.test.ts`, y no es incoherencia: alla la
   * direccion inversa borraria el registro de los archivos eliminados a proposito. Aca
   * no hay equivalente: los specs que no prosperaron no se borran, quedan con estado
   * `Descartado` y su carpeta puesta, como el 001.
   */
  it('cada carpeta que este tiene su fila en `log.md`', () => {
    const conFila = new Set(FILAS.map((f) => f.id));
    const huerfanas = CARPETAS.filter((c) => !conFila.has(c.slice(0, 3)));

    expect(
      huerfanas,
      `se cruzaron ${CARPETAS.length} carpetas contra ${FILAS.length} filas.\n` +
      `carpetas sin fila en log.md:\n${huerfanas.join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * El detector de regimen, contra fixtures, para que **las dos ramas esten verificadas
 * antes de que exista la segunda**.
 *
 * Sin esto, la rama `issue` de todo este archivo es codigo que nadie ejecuto nunca y
 * que recien se estrena el dia de la mudanza — que es el peor momento para descubrir
 * que no anda.
 */
describe('el detector de regimen', () => {
  const fila = (id: string, href: string) => `| [${id}](${href}) | 2026-08-23 | Propuesto | x |`;
  const RUTA = (id: string) => `./${id}-un-spec-cualquiera/spec.md`;
  const ISSUE = (n: number) => `https://github.com/federicohermo/pentomino-games/issues/${n}`;

  it('reconoce el regimen `archivo`', () => {
    expect(regimenDe([fila('001', RUTA('001')), fila('002', RUTA('002'))].join('\n'))).toBe('archivo');
  });

  it('reconoce el regimen `issue`', () => {
    expect(regimenDe([fila('001', ISSUE(70)), fila('002', ISSUE(71))].join('\n'))).toBe('issue');
  });

  it('llama `mezclado` a la tabla a medio migrar', () => {
    // El estado que el 034 evita: mientras dure, ningun gate sabe si un spec deberia
    // estar en el disco. Tiene que ser rojo, no un default silencioso a uno de los dos.
    expect(regimenDe([fila('001', RUTA('001')), fila('002', ISSUE(71))].join('\n'))).toBe('mezclado');
  });

  it('llama `vacio` a lo que no tiene filas', () => {
    expect(regimenDe('# Log\n\nsin tabla')).toBe('vacio');
  });

  it('no confunde un issue de otro repo con una ruta ni al reves', () => {
    // Un `href` que no es ninguna de las dos formas cae en `mezclado`, que es rojo. Es
    // deliberado: el gate no tiene por que adivinar que quiso decir.
    expect(regimenDe(fila('001', 'https://example.com/algo'))).toBe('mezclado');
  });
});

/**
 * Lo que sigue mira los CUATRO ARCHIVOS de cada spec, asi que sólo corre en regimen
 * `archivo`. En regimen `issue` el contenido no esta en el repo — puede estar como
 * cache hidratada, o no estar — y un gate del repo no puede verificar lo que el repo
 * no tiene.
 *
 * `describe.runIf` y no un `if` adentro de cada test: asi el reporte **dice** que se
 * saltearon en vez de decir que pasaron, que es la diferencia entre un gate que no
 * aplica y un gate que se apago. Cuando llegue el regimen `issue`, lo que verifica el
 * formato de las tareas es el gate del propio issue, no este archivo.
 */
describe.runIf(REGIMEN === 'archivo')('los specs cumplen la convencion que su README documenta', () => {
  it('hay specs que verificar', () => {
    // Sin esto, un `readdirSync` que devuelva vacio deja los seis gates de abajo
    // pasando sobre listas vacias. Es el modo de falla que este spec vino a cerrar,
    // asi que el gate no puede tenerlo.
    //
    // Medido en el research del 034: es el UNICO que atrapa el caso de cero carpetas.
    // El de «cada spec tiene sus cuatro archivos» pasaba en verde, porque `flatMap`
    // sobre vacio da `[]`.
    expect(CARPETAS.length).toBeGreaterThan(20);
  });

  it('cada carpeta se llama `NNN-descripcion-kebab`', () => {
    const mal = CARPETAS.filter((c) => !/^\d{3}-[a-z0-9]+(-[a-z0-9]+)*$/.test(c));

    expect(mal, `carpetas fuera de convencion:\n${mal.join('\n')}`).toEqual([]);
  });

  it('cada spec tiene sus cuatro archivos', () => {
    const CUATRO = ['spec.md', 'research.md', 'plan.md', 'tasks.md'];
    const vistos = CARPETAS.flatMap((c) =>
      CUATRO.map((a) => ({ ruta: `${c}/${a}`, esta: existsSync(join(SPECS, c, a)) })));
    const faltan = vistos.filter((v) => !v.esta).map((v) => v.ruta);

    // La red anti-vacio, y no es ceremonia: **este gate pasaba en verde con cero
    // carpetas** —medido en el research del 034, simulando la mudanza con un
    // worktree—, porque `flatMap` sobre una lista vacia devuelve `[]` y `[]` es
    // igual a `[]`. Contar lo que se MIRO, y no solo lo que fallo, es lo que
    // distingue «no hay nada mal» de «no hay nada».
    expect(vistos.length, 'no se miro un solo archivo de spec').toBeGreaterThan(80);
    expect(faltan, `archivos que faltan:\n${faltan.join('\n')}`).toEqual([]);
  });


  it('toda linea que arranca como checkbox parsea con el formato documentado', () => {
    const malformadas: string[] = [];
    let tareas = 0;

    for (const carpeta of CARPETAS) {
      const ruta = join(SPECS, carpeta, 'tasks.md');
      if (!existsSync(ruta)) continue;

      readFileSync(ruta, 'utf8').split(/\r?\n/).forEach((linea, i) => {
        if (!PARECE_TAREA.test(linea)) return;
        tareas += 1;
        if (!TAREA.test(linea)) malformadas.push(`${carpeta}/tasks.md:${i + 1}  ${linea.trim().slice(0, 80)}`);
      });
    }

    // Que el conteo sea alto es lo que prueba que el gate miro los archivos: si el
    // `existsSync` fallara para todos, `malformadas` seria `[]` y el test verde.
    expect(tareas).toBeGreaterThan(1000);
    expect(malformadas, `lineas que \`parseTasks\` descartaria en silencio:\n${malformadas.join('\n')}`).toEqual([]);
  });

  it('los IDs `T###` son unicos dentro de su spec', () => {
    const repetidos: string[] = [];

    for (const carpeta of CARPETAS) {
      const ruta = join(SPECS, carpeta, 'tasks.md');
      if (!existsSync(ruta)) continue;

      const vistos = new Set<string>();
      for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
        const id = TAREA.exec(linea)?.[2];
        if (!id) continue;
        if (vistos.has(id)) repetidos.push(`${carpeta}: ${id}`);
        vistos.add(id);
      }
    }

    expect(repetidos, `IDs repetidos dentro de un mismo spec:\n${repetidos.join('\n')}`).toEqual([]);
  });

  /**
   * El limite explicito del AC9, escrito como test para que no se pierda: **no** se
   * exige que los IDs sean consecutivos.
   *
   * Medido: ordenados los `T###` de cada spec, 4 de 23 tienen huecos —012, 022, 029 y
   * 033, que numeran por bloques de diez a proposito, un bloque por paso—. Y 585 de las
   * 1 637 tareas no tienen ID, que tambien es correcto: `specs/README.md` los pide «en
   * specs nuevos», y los diez primeros son anteriores a la convencion.
   *
   * El gate tampoco puede exigir que el primer ID sea `T001`, por lo mismo.
   */
  it('NO exige IDs consecutivos, y hay specs que los tienen con huecos', () => {
    const conHuecos = CARPETAS.filter((carpeta) => {
      const ruta = join(SPECS, carpeta, 'tasks.md');
      if (!existsSync(ruta)) return false;
      const ids = readFileSync(ruta, 'utf8').split(/\r?\n/)
        .map((l) => TAREA.exec(l)?.[2]).filter((id) => id !== undefined)
        .map((id) => Number(id.slice(1))).sort((a, b) => a - b);
      return ids.some((n, i) => i > 0 && n !== ids[i - 1] + 1);
    });

    // Si esto diera vacio, la excepcion habria dejado de tener motivo y convendria
    // revisarla en vez de arrastrarla. Hoy tiene cuatro.
    expect(conHuecos.length).toBeGreaterThan(0);
  });
});

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

/** Las carpetas de spec: `NNN-descripcion-kebab`. */
const CARPETAS = readdirSync(SPECS, { withFileTypes: true })
  .filter((e) => e.isDirectory())
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

describe('los specs cumplen la convencion que su README documenta', () => {
  it('hay specs que verificar', () => {
    // Sin esto, un `readdirSync` que devuelva vacio deja los seis gates de abajo
    // pasando sobre listas vacias. Es el modo de falla que este spec vino a cerrar,
    // asi que el gate no puede tenerlo.
    expect(CARPETAS.length).toBeGreaterThan(20);
  });

  it('cada carpeta se llama `NNN-descripcion-kebab`', () => {
    const mal = CARPETAS.filter((c) => !/^\d{3}-[a-z0-9]+(-[a-z0-9]+)*$/.test(c));

    expect(mal, `carpetas fuera de convencion:\n${mal.join('\n')}`).toEqual([]);
  });

  it('cada spec tiene sus cuatro archivos', () => {
    const CUATRO = ['spec.md', 'research.md', 'plan.md', 'tasks.md'];
    const faltan = CARPETAS.flatMap((c) =>
      CUATRO.filter((a) => !existsSync(join(SPECS, c, a))).map((a) => `${c}/${a}`));

    expect(faltan, `archivos que faltan:\n${faltan.join('\n')}`).toEqual([]);
  });

  it('cada spec tiene su fila en `log.md`, con fecha ISO y un estado del conjunto cerrado', () => {
    // Los cinco estados los declara `log.md` arriba de su propia tabla. Se listan aca
    // porque el gate tiene que fallar ante uno inventado, que es la forma en la que una
    // tabla de estados se desarma: alguien escribe «En progreso» y `spec_status` lo lee
    // como no-terminal sin que nada avise.
    const ESTADOS = ['Propuesto', 'En curso', 'Implementado', 'Descartado', 'Superado'];
    const problemas: string[] = [];

    for (const carpeta of CARPETAS) {
      const id = carpeta.slice(0, 3);
      const fila = new RegExp(`^\\|\\s*\\[${id}\\]\\([^)]*\\)\\s*\\|([^|]*)\\|([^|]*)\\|`, 'm').exec(LOG);
      if (!fila) { problemas.push(`${carpeta}: sin fila en log.md`); continue; }

      const fecha = fila[1].trim();
      const estado = fila[2].trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) problemas.push(`${carpeta}: fecha "${fecha}" no es ISO`);
      if (!ESTADOS.includes(estado)) problemas.push(`${carpeta}: estado "${estado}" no esta en el conjunto`);
    }

    expect(problemas, `filas de log.md con problemas:\n${problemas.join('\n')}`).toEqual([]);
  });

  /**
   * Y la direccion inversa, que aca SI se verifica: toda fila de `log.md` tiene su
   * carpeta.
   *
   * Es la asimetria con `mapa-de-directorios.test.ts`, y no es incoherencia: alla el
   * doc nombra archivos borrados **a proposito**, para que nadie los vuelva a crear.
   * Aca no hay equivalente — una fila sin carpeta es un spec fantasma, y `spec_status`
   * lo reportaria como trabajo que no existe. Los specs que no prosperaron no se borran
   * del registro: quedan con estado `Descartado` y su carpeta puesta, como el 001.
   */
  it('cada fila de `log.md` tiene su carpeta', () => {
    const ids = new Set(CARPETAS.map((c) => c.slice(0, 3)));
    const fantasmas = [...LOG.matchAll(/^\|\s*\[(\d{3})\]\(/gm)]
      .map((m) => m[1])
      .filter((id) => !ids.has(id));

    expect(fantasmas, `filas de log.md sin carpeta:\n${fantasmas.join('\n')}`).toEqual([]);
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

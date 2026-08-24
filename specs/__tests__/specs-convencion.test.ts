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
 * `--filter "{.}"` y con el `$` del regex de `verify`.
 *
 * Los dos limites del gate estan en el AC9 del spec 033 y no son negociables:
 * **no** exige IDs consecutivos ni una ruta de archivo por tarea, aunque Spec Kit pida
 * las dos cosas. Un gate que falla sobre specs cerrados es un gate que se apaga a la
 * semana, y la Desviacion 2 prohibe reescribirlos para satisfacerlo.
 *
 * ## Lo que este archivo NO verifica, y por que (spec 035)
 *
 * El registro es `specs/mapa.json` y lo verifica `mapa-de-specs.test.ts`, que ademas
 * lo contrasta contra los issues. Aca quedo lo que mira las CARPETAS, que desde el
 * spec 034 son una **cache** de lo que vive en los issues.
 *
 * Antes de eso, este archivo detectaba un «regimen»: `log.md` declaraba si el registro
 * vivia en el repo o en GitHub, y seis gates corrian solo en el primero. Esa
 * bifurcacion se cayo con `log.md` — hoy hay un solo mundo, y la pregunta que quedo no
 * es en que regimen esta el registro sino **cuanto de la cache hay en el disco**.
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

/** El registro. Esta trackeado, asi que a diferencia de las carpetas SIEMPRE esta. */
const MAPA = JSON.parse(readFileSync(join(SPECS, 'mapa.json'), 'utf8')) as Record<string, unknown>;
const IDS = Object.keys(MAPA);

/**
 * El formato de tarea, **el mismo regex que `parseTasks`**. Que sea el mismo es el
 * punto: si aca se escribiera uno mas permisivo, el gate diria que el archivo esta bien
 * y la tool seguiria descartando la linea igual.
 */
const TAREA = /^\s*-\s\[([ xX])\]\s*(?:(T\d{3})\s+)?((?:\[[PM]\]\s*)*)(.*)$/;

/** Toda linea que ARRANCA como checkbox, matchee o no el formato completo. */
const PARECE_TAREA = /^\s*-\s\[.\]/;

/** Los cuatro archivos que todo spec tiene. */
const CUATRO = ['spec.md', 'research.md', 'plan.md', 'tasks.md'];

describe('las carpetas de `specs/` y el registro dicen lo mismo', () => {
  // Este bloque corre SIEMPRE, hidratado o no, porque cruza la cache contra algo que
  // siempre esta. Es la mitad del archivo que no puede apagarse sola.

  it('el registro tiene entradas que cruzar', () => {
    // La red anti-vacio, primero: sin ella, un `mapa.json` truncado deja lo de abajo
    // corriendo sobre listas vacias, y `[]` pasa cualquier asercion sobre lo que falta.
    expect(IDS.length).toBeGreaterThan(20);
  });

  /**
   * Toda carpeta que ESTE tiene su entrada en el mapa.
   *
   * Corre siempre, y eso costo una falsificacion: cuando el equivalente vivia en el
   * bloque condicional, borrar la fila del 031 con el registro ya migrado **no
   * fallaba** — el gate se salteaba y nadie miraba. Y ahi es cuando mas importa: el
   * mapa es lo unico que sabe a que issue pertenece una carpeta, asi que una carpeta
   * sin entrada es un spec al que no se puede volver a llegar ni hidratar.
   *
   * Sin hidratar no hay carpetas y no hay nada que cruzar, que es correcto — pero
   * entonces no aporta nada, y por eso el conteo va en el mensaje: un cero ahi
   * significa «no habia nada que mirar» y no «esta todo bien».
   *
   * Es la asimetria con `mapa-de-directorios.test.ts`, y no es incoherencia: alla la
   * direccion inversa borraria el registro de los archivos eliminados a proposito. Aca
   * no hay equivalente: los specs que no prosperaron no se borran, quedan con estado
   * `Descartado` y su entrada puesta, como el 001.
   */
  it('cada carpeta que este tiene su entrada en `mapa.json`', () => {
    const huerfanas = CARPETAS.filter((c) => !IDS.includes(c.slice(0, 3)));

    expect(
      huerfanas,
      `se cruzaron ${CARPETAS.length} carpetas contra ${IDS.length} entradas del mapa.\n` +
      `carpetas sin entrada:\n${huerfanas.join('\n')}`,
    ).toEqual([]);
  });

  it('cada carpeta se llama `NNN-descripcion-kebab`', () => {
    const mal = CARPETAS.filter((c) => !/^\d{3}-[a-z0-9]+(-[a-z0-9]+)*$/.test(c));

    expect(mal, `carpetas fuera de convencion:\n${mal.join('\n')}`).toEqual([]);
  });
});

/**
 * Cuanto de la cache hay en el disco. **No es un regimen: es un conteo.**
 *
 * `specs/NNN-…/` esta en el `.gitignore` desde el 034, asi que un clone nuevo, la CI y
 * un worktree recien creado tienen CERO carpetas, y un checkout de trabajo puede tener
 * una sola —la del spec que se esta escribiendo—. Los gates de abajo miran el
 * contenido de esas carpetas, o sea que sin carpetas no tienen nada que verificar.
 */
const HIDRATADOS = CARPETAS.length;

it('dice cuantos specs hidratados se miraron, en vez de callarse', () => {
  // El test que hace que saltear sea una declaracion y no un silencio, igual que el
  // del gate remoto en `mapa-de-specs.test.ts`. No falla con cero —eso obligaria a
  // hidratar 35 specs para correr `pnpm verify`, y la CI no tiene por que— pero deja
  // la linea escrita al lado de los `skipped`.
  const veredicto = HIDRATADOS === 0
    ? `sin specs hidratados: el formato de las ${CUATRO.length} archivos y de las tareas NO se verifico. ` +
      '`node .claude/scripts/hidratar-specs.mjs`'
    : `${HIDRATADOS} de ${IDS.length} specs hidratados: se verifican abajo`;

  expect(veredicto).toBeTruthy();
  console.info(`[specs] ${veredicto}`);
});

/**
 * Lo que mira el CONTENIDO de cada carpeta, o sea lo que solo se puede verificar sobre
 * la cache hidratada.
 *
 * Las aserciones anti-vacio de adentro cuentan contra `HIDRATADOS` y no contra un
 * numero fijo. Es deliberado y es la diferencia con la version del 034: un `> 80` fijo
 * daba rojo sobre un checkout con un solo spec hidratado, que es la forma normal de
 * trabajar hoy — y un gate que da rojo cuando no pasa nada malo es un gate que alguien
 * apaga.
 */
describe.runIf(HIDRATADOS > 0)('los specs hidratados cumplen la convencion que su README documenta', () => {
  it('cada spec tiene sus cuatro archivos', () => {
    const vistos = CARPETAS.flatMap((c) =>
      CUATRO.map((a) => ({ ruta: `${c}/${a}`, esta: existsSync(join(SPECS, c, a)) })));
    const faltan = vistos.filter((v) => !v.esta).map((v) => v.ruta);

    // La red anti-vacio, y no es ceremonia: **este gate pasaba en verde con cero
    // carpetas** —medido en el research del 034, simulando la mudanza con un
    // worktree—, porque `flatMap` sobre una lista vacia devuelve `[]` y `[]` es
    // igual a `[]`. Contar lo que se MIRO, y no solo lo que fallo, es lo que
    // distingue «no hay nada mal» de «no hay nada».
    expect(vistos.length, 'no se miro un solo archivo de spec').toBe(HIDRATADOS * CUATRO.length);
    expect(faltan, `archivos que faltan:\n${faltan.join('\n')}`).toEqual([]);
  });

  it('toda linea que arranca como checkbox parsea con el formato documentado', () => {
    const malformadas: string[] = [];
    let tareas = 0;
    let leidos = 0;

    for (const carpeta of CARPETAS) {
      const ruta = join(SPECS, carpeta, 'tasks.md');
      if (!existsSync(ruta)) continue;
      leidos += 1;

      readFileSync(ruta, 'utf8').split(/\r?\n/).forEach((linea, i) => {
        if (!PARECE_TAREA.test(linea)) return;
        tareas += 1;
        if (!TAREA.test(linea)) malformadas.push(`${carpeta}/tasks.md:${i + 1}  ${linea.trim().slice(0, 80)}`);
      });
    }

    // Que se hayan leido los `tasks.md` que hay es lo que prueba que el gate miro los
    // archivos: si el `existsSync` fallara para todos, `malformadas` seria `[]` y el
    // test verde. El conteo de tareas va aparte porque un spec puede no tener ninguna.
    expect(leidos, 'no se leyo un solo tasks.md').toBe(HIDRATADOS);
    expect(tareas).toBeGreaterThan(0);
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

  /*
   * Aca vivia el test del limite explicito del AC9: «NO exige IDs consecutivos, y hay
   * specs que los tienen con huecos». Afirmaba `conHuecos.length > 0` para que la
   * excepcion no sobreviviera a su motivo — 4 de 23 specs numeran por bloques de diez
   * a proposito, un bloque por paso.
   *
   * Se borra con el spec 035, y no por cambiar de opinion: esa asercion necesita ver
   * los 35 specs, y desde que las carpetas son una cache este bloque corre sobre las
   * que haya. Con un solo spec hidratado daba rojo sin que pasara nada malo, que es la
   * forma en la que un gate se termina apagando a mano. El limite sigue escrito arriba,
   * en el encabezado del archivo, que es donde se lee antes de agregar una regla.
   */
});

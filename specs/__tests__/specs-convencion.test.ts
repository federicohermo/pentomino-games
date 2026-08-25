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
  //
  // **`--todos` y no el comando pelado**, desde el 038: el default pasó a traer sólo
  // los que siguen en vuelo, o sea uno o dos. Decir el comando pelado acá dejaria a
  // quien lo copie con `HIDRATADOS = 1` y estos gates en verde habiendo mirado un
  // spec — que es el mismo «fallar en verde» que este test existe para evitar.
  const veredicto = HIDRATADOS === 0
    ? `sin specs hidratados: el formato de las ${CUATRO.length} archivos y de las tareas NO se verifico. ` +
      '`node .claude/scripts/hidratar-specs.mjs --todos`'
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

/**
 * El corte: **desde el spec 039, `[M]` deja de ser un marcador legal.**
 *
 * `[M]` decia «pide una persona — navegador, oido, captura» y por eso no bloqueaba el
 * cierre del spec. La medicion lo desmintio: hay **137 casillas `[M]` repartidas en 35
 * specs** —contadas con el `TAREA` de arriba, que es el mismo que usa `parseTasks`— y
 * de todas ellas solo **6** se cerraron alguna vez. O sea que en la
 * practica `[M]` no significaba «espera a una persona» sino «no se va a hacer, pero
 * queda escrito», que es una forma cara de no anotar nada.
 *
 * La regla que lo reemplaza: **volverlo verificable, o no anotarlo.**
 *
 * ## Por que un corte por numero y no una prohibicion
 *
 * Los 137 estan en specs mergeados, y la **Desviacion 2** prohibe reescribirlos: son
 * ADR, registro de que se decidio y con que evidencia. Un gate sin corte daria rojo
 * sobre 35 specs que nadie puede tocar, y un gate asi se apaga a la semana — es el
 * mismo motivo por el que el test de IDs consecutivos se borro de este archivo.
 *
 * El corte tambien es lo que hace que el gate mire **hacia adelante**: lo que verifica
 * no es el pasado sino que no entre uno nuevo.
 *
 * Y el numero es 39 y no 40 porque este spec es el que cambia la convencion: su propio
 * `tasks.md` es el primero que tiene que cumplirla.
 */
const SIN_MANUAL_DESDE = 39;

/**
 * Que el grupo de marcadores del regex siga capturando `[M]`.
 *
 * Corre SIEMPRE, hidratado o no, y esa es la unica forma de que sirva: es la red
 * anti-vacio del gate de abajo, que recorre archivos. Si el grupo 3 dejara de capturar
 * —un parentesis movido, un `?` de mas— el gate encontraria cero `[M]` y pasaria en
 * verde por no ver, no por no haber. Sobre el disco no se puede distinguir una cosa de
 * la otra; sobre dos strings literales, si.
 */
it('el regex reconoce un `[M]`, que es lo que el gate de abajo mira', () => {
  expect(TAREA.exec('- [ ] T012 [P] [M] lo que sea')?.[3]).toContain('[M]');
  expect(TAREA.exec('- [x] T012 [M] lo que sea')?.[3]).toContain('[M]');
  expect(TAREA.exec('- [ ] T012 [P] lo que sea')?.[3]).not.toContain('[M]');
});

/**
 * Los `[M]` de UN `tasks.md`, partidos por el corte: los de un spec anterior al 039 se
 * cuentan como `historicos` y los del 039 en adelante salen en `nuevos`, que es lo que
 * el gate rechaza.
 *
 * Vive afuera del `it` porque el gate sobre disco **solo puede verse en verde**: hoy no
 * hay ni un `[M]` en un spec `>= 039`, asi que la rama que reporta no se ejecuta nunca
 * y el corte por numero queda sin falsificar. El AC3 pide ver las dos direcciones —el
 * mismo `[M]` rojo en un spec nuevo y verde en uno viejo— y eso se ve sobre dos strings
 * literales; sobre el disco, no.
 */
function manualesDe(carpeta: string, md: string): { nuevos: string[]; historicos: number } {
  const nuevos: string[] = [];
  let historicos = 0;
  const numero = Number(carpeta.slice(0, 3));

  md.split(/\r?\n/).forEach((linea, i) => {
    const marcadores = TAREA.exec(linea)?.[3];
    if (marcadores === undefined || !marcadores.includes('[M]')) return;
    // Los de los specs viejos se cuentan y no se reportan: son historia, y la
    // Desviacion 2 los deja donde estan. Contarlos igual es lo que permite decir
    // cuantos se miraron en vez de callarlo.
    if (numero < SIN_MANUAL_DESDE) { historicos += 1; return; }
    nuevos.push(`${carpeta}/tasks.md:${i + 1}  ${linea.trim().slice(0, 80)}`);
  });

  return { nuevos, historicos };
}

it('el corte es por numero: el mismo `[M]` es historia en el 038 y hallazgo en el 039', () => {
  const md = '## Paso 1\n- [ ] T012 [P] [M] escuchar y confirmar que el timbre es aceptable\n';

  const viejo = manualesDe('038-el-estado-del-mapa-tiene-que-ser-verdad', md);
  expect(viejo.nuevos).toEqual([]);
  expect(viejo.historicos).toBe(1);

  const nuevo = manualesDe('039-una-tarea-la-cierra-un-agente', md);
  expect(nuevo.historicos).toBe(0);
  expect(nuevo.nuevos).toEqual([
    '039-una-tarea-la-cierra-un-agente/tasks.md:2  '
    + '- [ ] T012 [P] [M] escuchar y confirmar que el timbre es aceptable',
  ]);
});

describe.runIf(HIDRATADOS > 0)('los specs nuevos no anotan trabajo que nadie va a hacer', () => {
  it(`ningun spec \`NNN >= ${SIN_MANUAL_DESDE}\` escribe una tarea \`[M]\``, () => {
    const nuevos: string[] = [];
    let leidos = 0;
    let historicos = 0;

    for (const carpeta of CARPETAS) {
      const ruta = join(SPECS, carpeta, 'tasks.md');
      if (!existsSync(ruta)) continue;
      leidos += 1;

      const r = manualesDe(carpeta, readFileSync(ruta, 'utf8'));
      nuevos.push(...r.nuevos);
      historicos += r.historicos;
    }

    // Que se leyeron los `tasks.md` que hay, igual que el gate del formato: sin esto,
    // un `existsSync` que fallara para todos dejaria `nuevos` en `[]` y el test verde.
    expect(leidos, 'no se leyo un solo tasks.md').toBe(HIDRATADOS);

    expect(
      nuevos,
      'Un `[M]` en un spec del 039 para adelante. `[M]` dejo de ser parte del formato:\n' +
      'la salida es **volver la tarea verificable** —un test, una medicion, un invariante—\n' +
      'y entonces bloquea como cualquier otra, o **no anotarla en ningun lado**, ni\n' +
      'siquiera en `## Seguimiento`. Lo que no es una opcion es dejarla escrita sin que\n' +
      'nadie la pueda cerrar: eso ya se midio y da 137 casillas en 35 specs, de las que\n' +
      `se cerraron 6:\n${nuevos.join('\n')}`,
    ).toEqual([]);

    // El conteo historico va declarado y no aserto: cuantos specs viejos hay en disco
    // depende de que se hidrato, y un numero fijo aca daria rojo sobre un checkout con
    // un solo spec — que es la forma en la que este archivo ya vio apagarse un gate.
    console.info(`[specs] ${historicos} casillas \`[M]\` en specs anteriores al ${SIN_MANUAL_DESDE}: historia, no deuda`);
  });
});

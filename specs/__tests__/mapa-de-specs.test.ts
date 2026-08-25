import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import { ESTADOS, enVuelo } from '../../.claude/scripts/lib/specs.ts';
import { readSpecStatus } from '../../mcp-server/src/specs.ts';

/**
 * `specs/mapa.json`, el registro entero desde el spec 035.
 *
 * Lo que reemplaza es una tabla de Markdown de 54.531 bytes que **nadie verificaba**:
 * el PR #44 encontró que `log.md` mentía sobre **12 de 31 filas**, y los diez specs
 * afectados tenían una casilla abierta pidiendo exactamente esa actualización. No
 * falló la disciplina una vez — falló siempre, que es lo que distingue un descuido de
 * un mecanismo que no existe.
 *
 * Así que el mapa se queda con lo mínimo que hace falta y **cada campo tiene quien lo
 * mire**. Son dos gates y no uno, y la separación es el punto:
 *
 * - lo que se verifica **contra sí mismo** —forma, conjunto cerrado, unicidad— corre
 *   siempre, porque no necesita nada de afuera;
 * - lo que se verifica **contra el issue** —`estado` y `titulo`, los dos únicos campos
 *   duplicados— necesita red, así que se saltea **declarándolo**.
 *
 * `describe.runIf` y no un `if` adentro de cada test, por lo mismo que en
 * `specs-convencion.test.ts`: así el reporte dice que se salteó en vez de decir que
 * pasó, que es la diferencia entre un gate que no aplica y un gate que se apagó.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MAPA = JSON.parse(readFileSync(join(RAIZ, 'specs', 'mapa.json'), 'utf8')) as Record<string, {
  issue: number; carpeta: string; fecha: string; estado: string; titulo: string;
}>;
const IDS = Object.keys(MAPA);

/**
 * Qué estado del issue le corresponde a cada estado del spec.
 *
 * Sale de `enVuelo`, que es la misma partición que usa `hidratar-specs.mjs` para
 * elegir qué traer y `publicar-spec.mjs` para decidir si cierra: un spec en vuelo
 * tiene su issue abierto y uno cerrado no. Escribirla acá otra vez a mano es cómo
 * `publicar-spec.mjs` terminó mirando `'En curso'` después de que el estado dejara de
 * existir.
 */
const estadoDelIssue = (estado: string): 'OPEN' | 'CLOSED' => (enVuelo(estado) ? 'OPEN' : 'CLOSED');

/**
 * Los específicamente terminales: los que **no los mueve un merge**.
 *
 * Quedan fuera del cruce contra el PR y no del cruce contra el issue. Un `Superado`
 * puede tener su PR mergeado —el 004 lo tiene, es el #3— y eso no dice nada de su
 * estado: lo superó otro spec después. Y un `Descartado` puede no tener ninguno.
 */
const NO_LOS_MUEVE_UN_MERGE: ReadonlySet<string> = new Set(['Descartado', 'Superado']);

describe('specs/mapa.json es el registro, y se verifica solo', () => {
  it('tiene entradas que verificar', () => {
    // La red anti-vacío, primero y sin excusa: un mapa que no se pudo leer deja a
    // todos los gates de abajo corriendo sobre listas vacías, y `[]` pasa cualquier
    // aserción sobre lo que falta. Es el modo de falla que el 034 midió y que este
    // archivo no puede tener.
    expect(IDS.length).toBeGreaterThan(20);
  });

  it('cada clave es un `NNN` de tres dígitos', () => {
    const mal = IDS.filter((id) => !/^\d{3}$/.test(id));

    expect(mal, `claves fuera de formato:\n${mal.join('\n')}`).toEqual([]);
  });

  it('cada entrada trae los cinco campos, con su tipo', () => {
    // Lo mismo que valida `parseMapa` en el MCP server, y no es duplicación ociosa:
    // allá el que falla es quien consulta la tool, acá el que falla es el PR. Un
    // mapa roto tiene que ser rojo antes de mergear, no cuando alguien pregunta.
    const problemas = IDS.flatMap((id) => {
      const e = MAPA[id] as unknown as Record<string, unknown>;
      return (['issue', 'carpeta', 'fecha', 'estado', 'titulo'] as const)
        .filter((campo) => typeof e[campo] !== (campo === 'issue' ? 'number' : 'string'))
        .map((campo) => `${id}: falta \`${campo}\` o tiene el tipo equivocado`);
    });

    expect(problemas, problemas.join('\n')).toEqual([]);
  });

  it('cada estado es del conjunto cerrado', () => {
    // Es la forma en la que una tabla de estados se desarma: alguien escribe «En
    // progreso» y todo lo que la lee lo trata como no-terminal sin que nada avise.
    const mal = IDS.filter((id) => !ESTADOS.includes(MAPA[id].estado))
      .map((id) => `${id}: "${MAPA[id].estado}"`);

    expect(mal, `estados fuera del conjunto:\n${mal.join('\n')}`).toEqual([]);
  });

  it('cada fecha es ISO', () => {
    const mal = IDS.filter((id) => !/^\d{4}-\d{2}-\d{2}$/.test(MAPA[id].fecha))
      .map((id) => `${id}: "${MAPA[id].fecha}"`);

    expect(mal, `fechas que no son ISO:\n${mal.join('\n')}`).toEqual([]);
  });

  it('cada carpeta empieza con el `NNN` de su entrada', () => {
    // Es lo que hace que el emparejamiento por número funcione: `readSpecStatus`
    // busca la carpeta hidratada por su prefijo, y una entrada cuyo `carpeta` no
    // empiece con su propio `NNN` no la encontraría nunca.
    const mal = IDS.filter((id) => !MAPA[id].carpeta.startsWith(`${id}-`))
      .map((id) => `${id} → ${MAPA[id].carpeta}`);

    expect(mal, `carpetas que no corresponden a su spec:\n${mal.join('\n')}`).toEqual([]);
  });

  it('ningún issue está repetido', () => {
    // Dos specs apuntando al mismo issue es un mapa que perdió uno: el hidratador
    // escribiría el mismo contenido en dos carpetas y el publicador pisaría un spec
    // con el otro. Ninguna de las dos cosas da error por su cuenta.
    const porIssue = new Map<number, string[]>();
    for (const id of IDS) {
      const n = MAPA[id].issue;
      porIssue.set(n, [...(porIssue.get(n) ?? []), id]);
    }
    const repetidos = [...porIssue.entries()].filter(([, ids]) => ids.length > 1)
      .map(([n, ids]) => `#${n} ← ${ids.join(', ')}`);

    expect(repetidos, `issues repetidos:\n${repetidos.join('\n')}`).toEqual([]);
  });
});

/** Lo que `gh` devuelve de cada issue, sin aplanar: dos campos son dos campos. */
interface Issue { number: number; state: string; title: string }

/**
 * Cuántos issues se piden. **Una lista truncada es peor que ninguna**, y ese es el
 * motivo del número.
 *
 * `gh issue list` devuelve del más nuevo al más viejo, y los issues de spec son los
 * viejos: van del #63 al #99. Con `--limit 200`, el día que el repo pase los 200 issues
 * los 35 caen fuera de la página y el gate de abajo falla para **todos** con «issue que
 * no existe» — 35 rojos y ninguno cierto. `gh` pagina solo hasta el límite, así que
 * pedir de más no cuesta nada hoy: son ~100 issues, una página.
 */
const LIMITE = 1000;

/**
 * El estado del issue, leído con `gh`, o `null` si no se pudo.
 *
 * **Todo fallo cae en `null` a propósito**: sin `gh` en el PATH, sin sesión, sin red o
 * con la API lenta, la respuesta correcta es «no pude verificar», nunca «está bien».
 * El `timeout` está por la última: un gate que cuelga `pnpm verify` esperando a GitHub
 * se termina desactivando a mano, y un gate desactivado a mano no vuelve.
 *
 * Y una lista que llegó al límite cae en `null` por lo mismo: ahí una entrada ausente
 * puede ser un issue que no existe o uno que no entró, y las dos no se distinguen. «No
 * pude verificar» es la única respuesta cierta, y sale declarada en el reporte.
 */
const estadosRemotos = (): Map<number, Issue> | null => {
  try {
    const salida = execFileSync('gh', [
      'issue', 'list', '--repo', 'federicohermo/pentomino-games',
      '--state', 'all', '--limit', String(LIMITE), '--json', 'number,state,title',
    ], { encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'pipe'] });

    const issues = JSON.parse(salida) as Issue[];
    if (issues.length >= LIMITE) return null;
    return new Map(issues.map((i) => [i.number, i]));
  } catch {
    return null;
  }
};

const REMOTO = estadosRemotos();

it('dice si el gate remoto pudo correr, en vez de callarse', () => {
  // El test que hace que saltear sea una declaración y no un silencio. No falla
  // cuando no hay red —eso convertiría `pnpm verify` en algo que no corre en un
  // avión— pero deja la línea escrita en el reporte, al lado de los `skipped` de
  // abajo, que es lo que hace que alguien pregunte.
  const veredicto = REMOTO === null
    ? 'sin `gh` disponible: el estado del mapa NO se contrastó contra los issues'
    : `${REMOTO.size} issues leídos: el estado del mapa se contrasta abajo`;

  expect(veredicto).toBeTruthy();
  console.info(`[mapa.json] ${veredicto}`);
});

/**
 * El gate del AC4: los dos campos que el mapa **duplica** del issue tienen que decir
 * lo mismo que el issue.
 *
 * Es lo que `log.md` nunca tuvo. Duplicar no es el problema —`spec_status` corre sin
 * red y eso es una propiedad que se defiende—; el problema es duplicar sin que nada
 * mire. La diferencia de superficie también cuenta: `log.md` copiaba una fila con
 * prosa por spec, esto copia dos campos cortos.
 */
describe.runIf(REMOTO !== null)('el mapa dice lo mismo que el issue', () => {
  const remoto = REMOTO as Map<number, Issue>;

  it('cada spec tiene su issue en el repo', () => {
    const perdidos = IDS.filter((id) => !remoto.has(MAPA[id].issue))
      .map((id) => `${id} → #${MAPA[id].issue}`);

    expect(perdidos, `entradas que apuntan a un issue que no existe:\n${perdidos.join('\n')}`).toEqual([]);
  });

  it('el `estado` del mapa coincide con abierto/cerrado del issue', () => {
    const desincronizados = IDS.flatMap((id) => {
      const { issue, estado } = MAPA[id];
      const remotoDelSpec = remoto.get(issue);
      if (remotoDelSpec === undefined) return [];
      const esperado = estadoDelIssue(estado);
      return remotoDelSpec.state === esperado ? []
        : [`${id}: el mapa dice "${estado}" (issue ${esperado}) y #${issue} está ${remotoDelSpec.state}`];
    });

    expect(
      desincronizados,
      'El mapa y los issues no dicen lo mismo. Si el spec se mergeó, va `Implementado` y su\n' +
      'issue cerrado; si se reabrió, al revés. Esto es lo que `log.md` no tenía y por lo que\n' +
      `mintió sobre 12 de 31 filas:\n${desincronizados.join('\n')}`,
    ).toEqual([]);
  });

  it('el `titulo` del mapa es el del issue, verbatim', () => {
    // Verbatim es lo que hace que este gate sea una igualdad de strings. Cualquier
    // recorte en el medio —sacarle el `Spec NNN — `, normalizar un guion— sería una
    // regla más, y una regla más es un lugar más donde desincronizarse.
    const distintos = IDS.flatMap((id) => {
      const remotoDelSpec = remoto.get(MAPA[id].issue);
      if (remotoDelSpec === undefined) return [];
      return remotoDelSpec.title === MAPA[id].titulo ? []
        : [`${id}:\n    mapa:  ${MAPA[id].titulo}\n    issue: ${remotoDelSpec.title}`];
    });

    expect(distintos, `títulos que no coinciden:\n${distintos.join('\n')}`).toEqual([]);
  });
});

/** Lo que hace falta de un PR: cuál es y si sigue abierto. */
interface Pr { number: number; headRefName: string; state: string }

/**
 * Los PR de cada spec, agrupados por su `NNN`, o `null` si no se pudo preguntar.
 *
 * ## Por qué la RAMA y no `closedByPullRequestsReferences`
 *
 * El `tasks.md` de este spec pedía resolver el vínculo PR↔issue «con `gh`, no con un
 * regex sobre el título». Se hicieron las dos mediciones antes de elegir, y la que el
 * spec suponía no alcanza:
 *
 * | Vínculo | Resuelve |
 * |---|---|
 * | `closedByPullRequestsReferences` (la palabra clave `Closes #N` en el PR) | **2 de 42** |
 * | la rama del PR, `<prefijo>/NNN-…` | **37 de 42**, o sea todos menos los cinco en vuelo |
 *
 * Los dos que el primero encuentra son el 036 y el 037, que son los únicos PR escritos
 * después de que la convención existiera. Los otros 33 specs mergeados cerraron su
 * issue a mano, así que GitHub no tiene el vínculo — y un gate que da rojo sobre 33
 * specs mergeados que la Desviación 2 prohíbe reescribir es un gate que se apaga.
 *
 * La rama **no es el título**, que es lo que el spec pedía evitar: `feature/<NNN>-<kebab>`
 * lo declara la Desviación 3 del README, lo exige el hook del 037, y es de donde
 * `/pr-review-batch` ya saca de qué spec se trata. Es la misma clave que el mapa usa.
 *
 * ## `CLOSED` cuenta como aterrizado, y eso está medido
 *
 * Los PR **#35** y **#36** —specs 020 y 021— figuran `CLOSED` y no `MERGED`: se
 * mergearon a mano, y sus commits de merge (`6fffa34` y `ea4db2f`) están en `main`.
 * Contar sólo `MERGED` los daría por no aterrizados y serían dos rojos falsos sobre
 * specs correctos. Lo que distingue de verdad es que el PR **no siga abierto**.
 *
 * El precio es un PR abandonado que igual cuente: para que eso produzca una mentira,
 * alguien tendría además que poner el spec en `Implementado` a mano, y esa mitad la
 * agarra el cruce contra el issue. El error cae en la dirección barata.
 */
const LIMITE_PR = 1000;

const prsPorSpec = (): Map<string, Pr[]> | null => {
  try {
    const salida = execFileSync('gh', [
      'pr', 'list', '--repo', 'federicohermo/pentomino-games',
      '--state', 'all', '--limit', String(LIMITE_PR), '--json', 'number,headRefName,state',
    ], { encoding: 'utf8', timeout: 20_000, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] });

    const prs = JSON.parse(salida) as Pr[];
    // Igual que con los issues: una lista truncada no distingue «este spec no tiene PR»
    // de «su PR no entró en la página», y las dos respuestas son opuestas.
    if (prs.length >= LIMITE_PR) return null;

    const porSpec = new Map<string, Pr[]>();
    for (const pr of prs) {
      const id = /^[^/]+\/(\d{3})-/.exec(pr.headRefName)?.[1];
      if (id === undefined) continue;
      porSpec.set(id, [...(porSpec.get(id) ?? []), pr]);
    }
    return porSpec;
  } catch {
    return null;
  }
};

const PRS = prsPorSpec();

it('dice si el cruce contra los PR pudo correr, en vez de callarse', () => {
  // Mismo motivo que el de los issues: sin red el gate no falla —`pnpm verify` tiene
  // que correr en un avión— pero deja la línea escrita al lado de los `skipped`.
  const veredicto = PRS === null
    ? 'sin `gh` disponible: el estado del mapa NO se contrastó contra los PR'
    : `${PRS.size} specs con PR: el estado del mapa se contrasta abajo`;

  expect(veredicto).toBeTruthy();
  console.info(`[mapa.json] ${veredicto}`);
});

/**
 * El gate del AC1, y el que el del 035 no podía tener por construcción.
 *
 * El del 035 cruza el mapa contra el issue, o sea **dos copias de la misma
 * afirmación**: las dos las escribe una persona, y las dos se equivocaron juntas.
 * Veinticuatro horas después de mergear el 035 su estado decía `Propuesto`, su issue
 * estaba abierto, y el gate estaba en verde.
 *
 * El PR es otra cosa: **o está mergeado o no**, y eso no lo escribe nadie a mano.
 */
describe.runIf(PRS !== null)('el estado del mapa dice lo mismo que el PR', () => {
  const prs = PRS as Map<string, Pr[]>;

  /** Si el trabajo del spec llegó a `main`. Ver el docblock de `prsPorSpec`. */
  const aterrizo = (id: string): boolean => (prs.get(id) ?? []).some((pr) => pr.state !== 'OPEN');

  /** Los que un merge sí mueve: todos menos `Descartado` y `Superado`. */
  const cruzables = IDS.filter((id) => !NO_LOS_MUEVE_UN_MERGE.has(MAPA[id].estado));

  it('tiene specs que cruzar contra un PR', () => {
    // La red anti-vacío: si el emparejamiento por rama dejara de matchear, `mentiras`
    // sería `[]` y los dos tests de abajo pasarían sin haber mirado nada — que es el
    // «fallar en verde» que este archivo entero persigue.
    expect(cruzables.length).toBeGreaterThan(20);
    expect(cruzables.filter(aterrizo).length).toBeGreaterThan(20);
  });

  it('un spec con su PR aterrizado no puede seguir `Propuesto`', () => {
    // La mentira de este spec, exactamente. El trabajo está en `main` y el registro
    // dice que todavía se está pensando.
    const mentiras = cruzables.filter((id) => enVuelo(MAPA[id].estado) && aterrizo(id))
      .map((id) => `${id}: el mapa dice "${MAPA[id].estado}" y su PR ` +
        `${(prs.get(id) ?? []).map((p) => `#${p.number}`).join(', ')} ya no está abierto`);

    expect(
      mentiras,
      'El trabajo aterrizó y el registro no se enteró. Va `Implementado` y el issue\n' +
      `cerrado:\n${mentiras.join('\n')}`,
    ).toEqual([]);
  });

  it('un spec `Implementado` sin PR aterrizado es la mentira al revés', () => {
    const mentiras = cruzables.filter((id) => !enVuelo(MAPA[id].estado) && !aterrizo(id))
      .map((id) => `${id}: el mapa dice "${MAPA[id].estado}" y no hay PR suyo cerrado ni mergeado`);

    expect(
      mentiras,
      'El registro declara trabajo que ningún PR llevó a `main`. O el spec no se mergeó,\n' +
      `o su rama no se llamó \`<prefijo>/<NNN>-…\` y el vínculo se perdió:\n${mentiras.join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * El gate del AC9: **no alcanza con que el mapa, el issue y el PR coincidan si el
 * trabajo que declaran hecho no lo está.**
 *
 * `specs/README.md` ya define cuándo un spec «se lee cerrado» —`spec_status` reporta
 * `pendientes: 0`, o sea descontando `[M]` y, desde el 042, sin contar el `## Seguimiento`— y hasta acá **no lo
 * verificaba nadie**. Se vio al cerrar el 035: el chequeo se hizo a mano, dio 0, y el
 * cierre fue correcto. Pero habría funcionado igual sin correrlo, y un cierre correcto
 * por disciplina es el mismo mecanismo que el T044 del 035 ya demostró que falla.
 *
 * `pendientes` sale de `readSpecStatus` y **no se reimplementa acá**: si la definición
 * viviera en dos lados se desincronizaría, que es exactamente el bug de este spec un
 * nivel más abajo.
 */
const TAREAS = readSpecStatus(join(RAIZ, 'specs')).specs;
const HIDRATADOS = TAREAS.filter((s) => s.tareas !== null);

it('dice sobre cuántos specs hidratados se miraron las tareas, en vez de callarse', () => {
  // El chequeo necesita el `tasks.md` y `specs/` es una caché desde el 034: un clone
  // nuevo y la CI tienen cero. Saltearse es correcto; callarlo no.
  const veredicto = HIDRATADOS.length === 0
    ? 'sin specs hidratados: NO se verificó que los cerrados tengan `pendientes: 0`. '
      + '`node .claude/scripts/hidratar-specs.mjs --todos`'
    : `${HIDRATADOS.length} de ${IDS.length} specs hidratados: sus \`pendientes\` se contrastan abajo`;

  expect(veredicto).toBeTruthy();
  console.info(`[mapa.json] ${veredicto}`);
});

describe.runIf(HIDRATADOS.length > 0)('un spec cerrado no debe trabajo', () => {
  it('ningún spec cerrado tiene `pendientes > 0`', () => {
    const debiendo = HIDRATADOS.flatMap((s) => {
      const tareas = s.tareas;
      // `estado` y `issue` vienen del mapa, y `readSpecStatus` los da nulos sólo para
      // una carpeta sin entrada — que el gate de arriba ya prohíbe.
      if (tareas === null || s.estado === null) return [];
      // Las dos formas de estar cerrado, y las dos cuentan: el estado lo escribe el
      // mapa y el issue lo cierra `gh`, así que un spec puede llegar acá por
      // cualquiera de los dos lados sin pasar por el otro.
      const cerradoEnElMapa = !enVuelo(s.estado);
      const cerradoEnGitHub = s.issue !== null && REMOTO?.get(s.issue)?.state === 'CLOSED';
      if (!cerradoEnElMapa && !cerradoEnGitHub) return [];
      if (tareas.pendientes === 0) return [];
      return [`${s.id} (${s.estado}, issue #${s.issue}): ${tareas.pendientes} pendientes — ` +
        `la próxima es ${tareas.proximaId ?? '(sin ID)'}`];
    });

    expect(
      debiendo,
      'Specs cerrados con trabajo abierto. `pendientes` descuenta `[M]` y, desde el 042,\n' +
      'ni cuenta el `## Seguimiento`: lo que queda es trabajo que alguien dio por hecho. La\n' +
      'salida es cerrar la casilla, o marcarla como lo que es y volver a publicar el\n' +
      `spec con \`publicar-spec.mjs publicar\`:\n${debiendo.join('\n')}`,
    ).toEqual([]);
  });
});

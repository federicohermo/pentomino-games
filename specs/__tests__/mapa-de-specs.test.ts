import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import {
  ESTADOS, enVuelo, NO_LOS_MUEVE_UN_MERGE, agruparPrsPorSpec, aterrizo, RAMA_DE_SPEC,
  LIMITE_DE_LISTA, origenDe,
  type PrDeSpec, type IssueDeSpec,
} from '../../.claude/scripts/lib/specs.ts';
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
  issue: number; carpeta: string; fecha: string; estado: string; titulo: string; origen?: number[];
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

  it('ningún `origen` apunta al issue de otro spec', () => {
    // Un spec **no salda a otro spec**: para eso está `Superado`, y confundirlos haría
    // que cerrar uno cerrara al otro — el `Closes #N` del PR no distingue.
    //
    // **Va acá y no en el bloque de red**, aunque el `tasks.md` del 044 pedía los tres
    // `origen` juntos adentro del `runIf`: esto se verifica **contra el mapa mismo**, que
    // es la partición que el encabezado de este archivo declara. Metido allá se saltearía
    // sin `gh`, o sea justo donde corre la CI, y un gate que no necesita red no tiene por
    // qué heredar el motivo por el que otro se apaga.
    const deSpec = new Map(IDS.map((id) => [MAPA[id].issue, id]));
    const mal = IDS.flatMap((id) => (MAPA[id].origen ?? [])
      .filter((n) => deSpec.has(n))
      .map((n) => `${id}: declara saldar #${n}, que es el issue del spec ${deSpec.get(n)}`));

    expect(
      mal,
      '`origen` es deuda que el spec salda, no otro spec. Un spec que reemplaza a otro se\n' +
      `dice con el estado \`Superado\` del reemplazado:\n${mal.join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * El estado del issue, leído con `gh`, o `null` si no se pudo.
 *
 * **Cuántos se piden lo dice `LIMITE_DE_LISTA`, y una lista truncada es peor que
 * ninguna.** `gh issue list` devuelve del más nuevo al más viejo, y los issues de spec
 * son los viejos: van del #63 al #99. Con `--limit 200`, el día que el repo pase los 200
 * issues los 35 caen fuera de la página y el gate de abajo falla para **todos** con
 * «issue que no existe» — 35 rojos y ninguno cierto. `gh` pagina sólo hasta el límite,
 * así que pedir de más no cuesta nada hoy: son ~100 issues, una página.
 *
 * **El número sale de `lib/specs.ts` desde el 043**, que es de donde lo lee también el
 * derivador que escribe el mapa: subirlo sólo allá dejaría a este gate salteándose
 * mientras aquél escribe sin confirmación.
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
const estadosRemotos = (): Map<number, IssueDeSpec> | null => {
  try {
    const salida = execFileSync('gh', [
      'issue', 'list', '--repo', 'federicohermo/pentomino-games',
      '--state', 'all', '--limit', String(LIMITE_DE_LISTA), '--json', 'number,state,title',
    ], { encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'pipe'] });

    const issues = JSON.parse(salida) as IssueDeSpec[];
    if (issues.length >= LIMITE_DE_LISTA) return null;
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
  const remoto = REMOTO as Map<number, IssueDeSpec>;

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

  /*
   * El gate del `origen` (spec 044), y **no cuesta una llamada de red más**: lee del
   * mismo `Map` que los tres tests de arriba. Que siga siendo una sola llamada lo mira el
   * bloque del final de este archivo, porque la forma barata de escribir un gate nuevo es
   * pedir la lista otra vez y eso duplica el costo sin que nada avise.
   *
   * Lo que cierra es la mitad de salida que el 042 no tenía: la deuda entra a Issues sola
   * —los skills los abren— y no salía nunca. Medido: 4 de los 43 specs nombran un issue de
   * deuda **en prosa** y 3 de esos 4 siguen abiertos, porque nada podía exigir el
   * `Closes`. El dato lo pone `origen`; el rojo lo pone esto.
   *
   * **Este rojo no llega en el PR del spec ni al mergearlo, y hay que saberlo.** Mientras
   * el PR está abierto el mapa dice `Propuesto` —el gate del 038 prohíbe otra cosa— y
   * `enVuelo` lo excluye; en el push a `main`, `verify.yml` manda `GH_TOKEN: ''` y este
   * bloque entero se saltea. El primero que puede verlo es **el PR siguiente, que es de
   * otra persona**, con el `Closes` faltante ya mergeado y fuera de su alcance.
   *
   * Es la misma forma que los otros gates del mapa —viven en el PR y cazan la deriva
   * venga de donde venga—, pero con una diferencia que importa: allá el arreglo es editar
   * un archivo del repo y acá es cerrar un issue que quizá no esté hecho. Por eso
   * `spec-create` pide el `Closes` **antes** en vez de confiar en que el rojo avise.
   */
  it('el `origen` de un spec que ya no está en vuelo tiene que estar cerrado', () => {
    // **La partición sale de `enVuelo`, importado.** Un `Propuesto` con su origen abierto
    // es lo normal —es el estado de este mismo spec mientras se implementa—, así que el
    // gate sólo mira los que ya aterrizaron. Escribir el conjunto a mano acá es cómo
    // `publicar-spec.mjs` terminó mirando un `'En curso'` que ya no existía.
    const debiendo = IDS.filter((id) => !enVuelo(MAPA[id].estado))
      .flatMap((id) => (MAPA[id].origen ?? [])
        .filter((n) => remoto.get(n)?.state === 'OPEN')
        .map((n) => `${id} ("${MAPA[id].estado}"): salda #${n}, y #${n} sigue abierto`));

    expect(
      debiendo,
      'Un spec cerrado que declaró saldar un issue y lo dejó abierto. Al PR le faltó un\n' +
      '`Closes #N` por cada `origen` — el issue del propio spec no es el único que se\n' +
      `cierra:\n${debiendo.join('\n')}`,
    ).toEqual([]);
  });

  it('y cada `origen` es un issue que existe', () => {
    // El mismo modo de falla que el gate ya cubre para el `issue` del propio spec: un
    // número tipeado a mano que no apunta a nada se lee igual que uno correcto.
    const perdidos = IDS.flatMap((id) => (MAPA[id].origen ?? [])
      .filter((n) => !remoto.has(n))
      .map((n) => `${id} → #${n}`));

    expect(perdidos, `\`origen\` que apunta a un issue que no existe:\n${perdidos.join('\n')}`).toEqual([]);
  });
});

/**
 * Los PR de cada spec, agrupados por su `NNN`, o `null` si no se pudo preguntar.
 *
 * **El agrupamiento y el criterio de «aterrizó» ya no viven acá.** Desde el spec 043
 * salen de `lib/specs.ts`, porque los lee también el derivador que la Action corre en
 * el push a `main`: éste **confirma** el estado que aquél **escribe**, y dos copias de
 * la misma regla que se separen dan un gate que confirma un cálculo que ya no es el
 * suyo, en verde. Lo que queda acá es la consulta y la guarda de truncado.
 *
 * Lo de abajo es el porqué de la regla, y se queda porque es la medición que la eligió.
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
 * ## `MERGED`, más dos que aterrizaron a mano
 *
 * Los PR **#35** y **#36** —specs 020 y 021— figuran `CLOSED` y no `MERGED`: se
 * mergearon fuera de GitHub, y sus commits de merge (`6fffa34` y `ea4db2f`) están en
 * `main`. Contar sólo `MERGED` los daría por no aterrizados y serían dos rojos falsos
 * sobre specs correctos, así que van nombrados en `ATERRIZARON_A_MANO`.
 *
 * Nombrados, y no «cualquier PR que no siga abierto», que fue el primer criterio: un
 * `CLOSED` sin mergear es un PR **abandonado** —el #23 es una primera versión del 029 que
 * se descartó— y desde el 043 esta regla la lee un escritor que commitea a `main`. El
 * detalle, en el docblock de `aterrizo`.
 */
const prsPorSpec = (): Map<string, PrDeSpec[]> | null => {
  try {
    const salida = execFileSync('gh', [
      'pr', 'list', '--repo', 'federicohermo/pentomino-games',
      '--state', 'all', '--limit', String(LIMITE_DE_LISTA), '--json', 'number,headRefName,state',
    ], { encoding: 'utf8', timeout: 20_000, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] });

    const prs = JSON.parse(salida) as PrDeSpec[];
    // Igual que con los issues: una lista truncada no distingue «este spec no tiene PR»
    // de «su PR no entró en la página», y las dos respuestas son opuestas.
    if (prs.length >= LIMITE_DE_LISTA) return null;

    return agruparPrsPorSpec(prs);
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
  const prs = PRS as Map<string, PrDeSpec[]>;

  /** Si el trabajo del spec llegó a `main`. El criterio es el de `lib/specs.ts`. */
  const aterrizoElSpec = (id: string): boolean => aterrizo(prs.get(id));

  /** Los que un merge sí mueve: todos menos `Descartado` y `Superado`. */
  const cruzables = IDS.filter((id) => !NO_LOS_MUEVE_UN_MERGE.has(MAPA[id].estado));

  it('tiene specs que cruzar contra un PR', () => {
    // La red anti-vacío: si el emparejamiento por rama dejara de matchear, `mentiras`
    // sería `[]` y los dos tests de abajo pasarían sin haber mirado nada — que es el
    // «fallar en verde» que este archivo entero persigue.
    expect(cruzables.length).toBeGreaterThan(20);
    expect(cruzables.filter(aterrizoElSpec).length).toBeGreaterThan(20);
  });

  it('un spec con su PR aterrizado no puede seguir `Propuesto`', () => {
    // La mentira de este spec, exactamente. El trabajo está en `main` y el registro
    // dice que todavía se está pensando.
    const mentiras = cruzables.filter((id) => enVuelo(MAPA[id].estado) && aterrizoElSpec(id))
      .map((id) => `${id}: el mapa dice "${MAPA[id].estado}" y su PR ` +
        `${(prs.get(id) ?? []).map((p) => `#${p.number}`).join(', ')} ya no está abierto`);

    expect(
      mentiras,
      'El trabajo aterrizó y el registro no se enteró. Va `Implementado` y el issue\n' +
      `cerrado:\n${mentiras.join('\n')}`,
    ).toEqual([]);
  });

  it('un spec `Implementado` sin PR aterrizado es la mentira al revés', () => {
    const mentiras = cruzables.filter((id) => !enVuelo(MAPA[id].estado) && !aterrizoElSpec(id))
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

/**
 * El gate del `origen` contra su fuente: **la fila dice lo que dice el `spec.md`.**
 *
 * `specs/README.md` declara que la línea `**Origen:** #127` del encabezado ES la fuente única,
 * y hasta acá esa declaración era falsa apenas el spec quedaba publicado: `publicar-spec.mjs`
 * `crear` cortocircuita en `if (mapa[id]) … continue`, así que agregar o corregir el `**Origen:**`
 * después no llegaba nunca al mapa **y nada comparaba los dos**. La prueba es este mismo spec: su
 * `origen` hubo que escribirlo a mano en `mapa.json`.
 *
 * Son las dos mitades y hacen falta las dos: `crear` ahora reconcilia el campo en cada corrida, y
 * esto pone en rojo la deriva de quien no la corrió. No es lo mismo que el gate del `origen`
 * abierto —aquél mira GitHub y éste mira el disco—, y por eso no vive en el bloque de red.
 *
 * **Necesita la caché y se saltea declarándolo**, igual que el chequeo de `pendientes` de arriba:
 * `specs/[0-9]*` está ignorado desde el 034, así que la CI y un clone nuevo tienen cero carpetas.
 * Donde importa —la máquina de quien escribe el spec— están todas.
 */
const CON_SPEC_MD = IDS
  .map((id) => ({ id, ruta: join(RAIZ, 'specs', MAPA[id].carpeta, 'spec.md') }))
  .filter(({ ruta }) => existsSync(ruta));

const unOrigen = (o: number[] | null) => (o === null ? '(sin origen)' : o.map((n) => `#${n}`).join(', '));

it('dice sobre cuántos specs se contrastó el `origen` contra su `spec.md`, en vez de callarse', () => {
  const veredicto = CON_SPEC_MD.length === 0
    ? 'sin specs hidratados: NO se verificó que el `origen` del mapa salga del `spec.md`. '
      + '`node .claude/scripts/hidratar-specs.mjs --todos`'
    : `${CON_SPEC_MD.length} de ${IDS.length} specs hidratados: su ` + '`origen` se contrasta abajo';

  expect(veredicto).toBeTruthy();
  console.info(`[mapa.json] ${veredicto}`);
});

describe.runIf(CON_SPEC_MD.length > 0)('el `origen` de la fila sale del `spec.md`', () => {
  it('ninguna fila declara un `origen` distinto del que declara su spec', () => {
    const derivados = CON_SPEC_MD.flatMap(({ id, ruta }) => {
      // `origenDe` grita ante un `**Origen:**` que no nombra ningún `#N`, y acá eso es lo que
      // se quiere: es un error de quien escribe el spec, y el rojo lo nombra con su mensaje.
      const declarado = origenDe(readFileSync(ruta, 'utf8'));
      const enElMapa = MAPA[id].origen ?? null;
      if (JSON.stringify(declarado) === JSON.stringify(enElMapa)) return [];
      return [`${id}: el spec.md dice ${unOrigen(declarado)} y el mapa dice ${unOrigen(enElMapa)}`];
    });

    expect(
      derivados,
      'El `origen` de una fila dejó de decir lo que dice su `spec.md`. La fuente es\n' +
      'el spec, y la fila se pone al día sola con `publicar-spec.mjs crear`, que reconcilia\n' +
      `el campo en cada corrida:\n${derivados.join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * El gate del AC7 del spec 043: **la regla del cruce vive una sola vez.**
 *
 * Este archivo tuvo hasta el 043 su propia copia del patrón rama→spec y su propia
 * construcción del conjunto de estados que un merge no mueve. Mientras fue el único que
 * los usaba, copiarlos no costaba nada. Desde el 043 los usa también el derivador que la
 * Action corre en el push a `main`, y ahí el costo aparece entero: **éste confirma el
 * estado que aquél escribe**, así que dos copias que se separen dan un gate que confirma
 * un cálculo que ya no es el suyo — en verde, que es el modo de falla que este archivo
 * entero persigue.
 *
 * Un `import` no alcanza para impedirlo: alguien puede importar y además reescribir el
 * literal al lado. Lo que lo impide es mirar **el texto de este archivo**, que es la
 * misma técnica con la que `docs/__tests__/claude-md-acotado.test.ts` le cuenta las
 * líneas a `CLAUDE.md` — verificar sobre el fuente una propiedad que el compilador no
 * ve.
 *
 * Todo lo prohibido se **deriva de los valores importados** en vez de escribirse, y todo
 * se mira sobre el archivo **sin su bloque de `import`**. Las dos cosas son la misma
 * lección, y se aprendió con una mutación: la primera versión de este bloque cerraba con
 * `expect(FUENTE).toContain('agruparPrsPorSpec')`, y ese literal estaba en esa misma
 * línea. La aserción no podía fallar. Sacando el `import` y reimplementando el
 * agrupamiento al lado —con `feature/` como único prefijo, o sea perdiendo el 038 y el
 * 042— el gate entero quedaba **en verde**: era no-op contra la falla que existe para
 * prevenir.
 */
describe('la regla del cruce contra el PR vive una sola vez', () => {
  const FUENTE = readFileSync(fileURLToPath(import.meta.url), 'utf8');

  /** El `import` de `lib/specs.ts`, textual: es de donde salen los nombres a buscar. */
  const IMPORTADO = /import \{[\s\S]*?\} from '[^']*lib\/specs\.ts';/.exec(FUENTE)?.[0] ?? '';

  /**
   * El archivo **menos ese `import`**, que es sobre lo que se mira.
   *
   * Sacarlo es lo que hace que «se usa acá» signifique algo: un símbolo importado
   * aparece en el `import` sí o sí, así que buscarlo sobre el archivo entero da una
   * aserción que no puede fallar.
   */
  const CUERPO = FUENTE.replace(IMPORTADO, '');

  it('el patrón rama→spec no está escrito acá, y el de allá se invoca', () => {
    expect(
      CUERPO.includes(RAMA_DE_SPEC.source),
      'El patrón volvió a este archivo. Sale de `RAMA_DE_SPEC` en `lib/specs.ts`, que es\n' +
      'de donde también lo lee `derivar-mapa.mjs`.',
    ).toBe(false);

    // La contraparte, y busca la INVOCACIÓN y no el nombre: reimplementar el
    // agrupamiento al lado deja el `import` intacto, así que «el nombre aparece» pasa
    // igual. El nombre sale de la función y no de un literal, por lo mismo de siempre.
    for (const usada of [agruparPrsPorSpec, aterrizo]) {
      expect(
        CUERPO,
        `\`${usada.name}\` dejó de invocarse acá: la regla se volvió a escribir al lado.`,
      ).toContain(`${usada.name}(`);
    }
  });

  it('ni se vuelven a escribir los estados que un merge no mueve', () => {
    // Entrecomillados y no a secas: en prosa van entre backticks —«un `Superado` puede
    // tener su PR mergeado»— y eso es documentación, no una copia de la regla. Y las dos
    // comillas, en cualquier orden y fuera de cualquier `new Set`: la versión anterior
    // armaba UN string exacto —el `new Set` con los dos estados, en ese orden y con
    // comillas simples— así que darlo vuelta o usar comillas dobles pasaba en verde.
    const copias = [...NO_LOS_MUEVE_UN_MERGE]
      .flatMap((estado) => [`'${estado}'`, `"${estado}"`])
      .filter((literal) => CUERPO.includes(literal));

    expect(
      copias,
      'Los estados volvieron a escribirse acá. Salen de `NO_LOS_MUEVE_UN_MERGE`.',
    ).toEqual([]);
  });

  it('y todo lo que se importa de `lib/specs.ts` se usa: importar no es usar', () => {
    // Los nombres salen del propio `import` y no de una lista escrita acá —una lista
    // escrita se encontraría a sí misma en `CUERPO`—, así que agregar un símbolo a
    // `lib/specs.ts` no deja este gate mudo sobre él.
    const nombres = [...IMPORTADO.matchAll(/(?:^|[{,])\s*(?:type\s+)?(\w+)/g)]
      .map((m) => m[1])
      .filter((n) => n !== 'import');
    const sinUsar = nombres.filter((n) => !new RegExp(`\\b${n}\\b`).test(CUERPO));

    // Sin esto, un `import` que el regex dejara de reconocer daría cero nombres y cero
    // sin usar: el mismo verde vacío que este bloque acaba de dejar de tener.
    expect(nombres.length, 'no se reconoció el `import` de `lib/specs.ts`').toBeGreaterThan(4);
    expect(
      sinUsar,
      'se importa y no se usa: o sobra, o la regla se volvió a escribir al lado.',
    ).toEqual([]);
  });
});

/**
 * El gate del AC5 del spec 044: **el gate del `origen` no agregó una llamada a la red.**
 *
 * Es la misma forma que el AC7 del 043 —un test que falla si un literal reaparece— y
 * existe porque la forma barata de escribir el gate nuevo es pedir la lista de issues otra
 * vez. `estadosRemotos()` ya la pide entera —68 issues contra un límite de 1000— y el
 * `Map` está en memoria, así que la segunda llamada no compraría nada y duplicaría el
 * costo de red de `pnpm verify` sin que nada avise: las dos serían verdes.
 *
 * **La aguja se arma en vez de escribirse**, y ésa es la lección que el 043 pagó: su
 * primera versión cerraba con un `toContain` de un literal que estaba en esa misma línea,
 * o sea una aserción que no podía fallar. Escribir acá la invocación buscada la
 * convertiría en la segunda aparición, y este test no podría pasar nunca — la misma falla
 * dada vuelta.
 */
describe('el gate del `origen` no cuesta una llamada de red más', () => {
  it('la lista de issues se pide exactamente una vez en este archivo', () => {
    const fuente = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    const aguja = ["'issue'", "'list'"].join(', ');
    const veces = fuente.split(aguja).length - 1;

    expect(
      veces,
      'La lista de issues se pide más de una vez (o dejó de pedirse). El gate del `origen`\n' +
      'lee del `Map` que `estadosRemotos()` ya trajo: una segunda consulta duplica el costo\n' +
      'de red de `pnpm verify` y no compra nada.',
    ).toBe(1);
  });
});

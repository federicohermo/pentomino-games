import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';

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

/** Los cinco estados. Los mismos que `log.md` declaraba arriba de su tabla. */
const ESTADOS = ['Propuesto', 'En curso', 'Implementado', 'Descartado', 'Superado'];

/**
 * Qué estado del issue le corresponde a cada estado del spec.
 *
 * `Descartado` y `Superado` cierran igual que `Implementado`: de los tres no sale
 * trabajo. Es la misma partición que usa `ESTADOS_TERMINALES` en
 * `mcp-server/src/specs.ts`, más `Implementado`, que ahí no es terminal porque sí
 * puede tener seguimiento abierto — pero su issue está cerrado igual.
 */
const ESTADO_DEL_ISSUE: Record<string, 'OPEN' | 'CLOSED'> = {
  'Propuesto': 'OPEN',
  'En curso': 'OPEN',
  'Implementado': 'CLOSED',
  'Descartado': 'CLOSED',
  'Superado': 'CLOSED',
};

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
      const esperado = ESTADO_DEL_ISSUE[estado];
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

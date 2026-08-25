import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import {
  archivoDeComentario, carpetaExistente, ESTADOS, estadoDe, enVuelo, leerMapa, traducir, urlDeIssue,
  agruparPrsPorSpec, aterrizo, derivarMapa, escribirMapa, ATERRIZARON_A_MANO,
  origenDe, deudaDelCenso,
  type Mapa, type IssueDeSpec, type PrDeSpec,
} from '../lib/specs.ts';
import { derivarYGuardar, type EntornoDerivacion } from '../lib/derivacion.ts';

/**
 * Los scripts que mueven los specs entre el repo y GitHub Issues (spec 034).
 *
 * **Por que estan testeados y por que aca.** `publicar-spec.mjs` y
 * `hidratar-specs.mjs` nacieron como herramientas de un solo uso y no lo son: cada
 * spec nuevo se publica y cada worktree se hidrata. El commit que los estreno se
 * llama «tres bugs del publicador que lo estreno» y los tres eran de parseo —un
 * comentario duplicado, un `issue close` sobre uno ya cerrado, un estado nulo leido
 * como terminal—, encontrados usandolos y no por un test.
 *
 * **Vive en `.claude/scripts/__tests__/` y no en `specs/__tests__/`**, que es donde
 * empezo: el test es del SCRIPT, y `specs/` es lo que el script manipula. Al lado de lo
 * que verifica, como el resto del repo. En `specs/` se quedan los gates que miran el
 * registro y la convencion, que si son de ahi.
 *
 * El codigo que mira esta fuera del `include` de coverage —que es `src/**`—, asi que no
 * entra al umbral de 100: el criterio de suficiencia es otro, y esta escrito en cada
 * bloque. Cada caso de abajo es un modo de falla que ya paso o que un spec nombra.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const REPO = 'federicohermo/pentomino-games';
const ISSUE = (n: number) => `https://github.com/${REPO}/issues/${n}`;

/** Una entrada de mapa, con los cinco campos que el registro declara. */
const ENTRADA = (id: string, issue: number, estado = 'Propuesto') => ({
  issue, carpeta: `${id}-un-spec-cualquiera`, fecha: '2026-08-23', estado, titulo: `Spec ${id} — Una cosa`,
});
const MAPA_DE = (...pares: [string, number, string?][]) =>
  Object.fromEntries(pares.map(([id, n, e]) => [id, ENTRADA(id, n, e)]));

describe('leerMapa', () => {
  it('devuelve el mapa entero, indexado por `NNN`', () => {
    const mapa = leerMapa(JSON.stringify(MAPA_DE(['001', 63], ['034', 96])));

    expect(Object.keys(mapa)).toEqual(['001', '034']);
    expect(mapa['034'].issue).toBe(96);
  });

  /*
   * Las tres formas de que el registro no se pueda leer, y las tres tienen que GRITAR.
   *
   * Es la leccion del 034: su antecesora `filasDeLog` devolvia `[]` cuando el regex
   * dejaba de matchear, y `[]` no es un error sino un registro vacio. Cuando el 034
   * cambio el formato de la columna del enlace, eso salio como 34 specs sin estado, en
   * verde. Un mapa vacio entra en la lista a proposito: para el hidratador significa
   * «no hay nada que bajar», que es lo contrario de lo que pasa.
   */
  it.each([
    ['no es JSON', 'no es JSON valido'],
    ['[]', 'tiene que ser un objeto'],
    ['{}', 'no tiene una sola entrada'],
  ])('grita ante %s', (json, esperado) => {
    expect(() => leerMapa(json)).toThrow(esperado);
  });

  /*
   * Y grita tambien ante una entrada INCOMPLETA, que es lo que no hacia.
   *
   * El encabezado decia que la validacion campo por campo la hacian el gate del PR y
   * `parseMapa` del MCP server — y ninguno de los dos corre antes que el script. Un
   * `mapa.json` editado a mano sin `issue` pasaba entero: la guarda `faltan` de la fase
   * 2 de `publicar-spec.mjs` mira que este la CLAVE, no la entrada, asi que la corrida
   * terminaba en `gh issue edit undefined --repo …`.
   */
  it.each([
    ['una entrada que no es objeto', '{"001": 63}', 'la entrada 001 no es un objeto'],
    ['`issue` ausente', '{"001": {"carpeta":"001-x","fecha":"2026-08-02","estado":"Propuesto","titulo":"T"}}', '`issue` como number'],
    ['`issue` como string', '{"001": {"issue":"63","carpeta":"001-x","fecha":"2026-08-02","estado":"Propuesto","titulo":"T"}}', '`issue` como number'],
    ['`carpeta` ausente', '{"001": {"issue":63,"fecha":"2026-08-02","estado":"Propuesto","titulo":"T"}}', '`carpeta` como string'],
  ])('grita ante %s', (_caso, json, esperado) => {
    expect(() => leerMapa(json)).toThrow(esperado);
  });

  it('una entrada completa pasa', () => {
    expect(() => leerMapa(JSON.stringify(MAPA_DE(['001', 63])))).not.toThrow();
  });

  /*
   * Y grita ante un `origen` mal formado, que es el campo que el 044 agrega.
   *
   * Los tres casos se midieron ANTES de escribir la validacion, sobre el mapa real: los
   * tres **pasaban en silencio**. `CAMPOS` es una lista de requeridos con un tipo escalar
   * esperado, asi que un campo opcional que es un array queda afuera por construccion — o
   * se valida aparte o no se valida nunca. Es el mismo modo de falla que el 034 midio: el
   * registro acepta algo que nadie puede usar y el error sale tres pasos mas alla.
   *
   * El vacio esta en la lista a proposito. No es un dato roto: es una SEGUNDA forma de
   * decir «no tiene origen», y la primera es omitir el campo. Dos formas de decir lo
   * mismo es la puerta de la desincronizacion.
   */
  const CON_ORIGEN = (origen: unknown) =>
    JSON.stringify({ '044': { ...ENTRADA('044', 132), origen } });

  it.each<[string, unknown, string]>([
    ['un numero suelto', 127, 'no es una lista'],
    ['una lista de strings', ['127'], 'no es un numero'],
    ['una lista vacia', [], 'vacio'],
    // Los tres de abajo son numeros y ninguno es un numero de ISSUE. Van aparte de los
    // strings porque fallan mas tarde y peor: un `"127"` se ve raro leyendo el mapa,
    // pero un `0` se lee como un numero legitimo y sale por la puerta de «el issue no
    // existe» — culpando a GitHub de algo que se tipeo aca.
    ['una lista con un cero', [0], 'no es un numero de issue'],
    ['una lista con un negativo', [-3], 'no es un numero de issue'],
    ['una lista con un decimal', [1.5], 'no es un numero de issue'],
  ])('grita ante un `origen` que es %s', (_caso, origen, esperado) => {
    expect(() => leerMapa(CON_ORIGEN(origen))).toThrow(esperado);
  });

  it('y un `origen` bien formado pasa, con el campo entero', () => {
    const mapa = leerMapa(CON_ORIGEN([127, 124]));

    expect(mapa['044'].origen).toEqual([127, 124]);
  });

  it('la entrada SIN `origen` sigue pasando: el campo es opcional', () => {
    // Los 43 specs de hoy no lo llevan y no se reescriben (Desviacion 2). Si esto
    // fallara, agregar el campo seria una migracion en vez de un campo nuevo.
    expect(leerMapa(JSON.stringify(MAPA_DE(['001', 63])))['001'].origen).toBeUndefined();
  });
});

/**
 * `origenDe`: la linea `**Origen:** #127` del `spec.md` se vuelve el campo del mapa.
 *
 * Es el hermano de `tituloDe` y los cuatro casos de abajo son las tres decisiones que el
 * parser toma, mas la feliz. Las tres son sobre que **no** cuenta, porque el riesgo del
 * campo no es que se lea de menos sino de mas: `origen` significa «lo salda», y con la
 * lectura ancha —«lo menciona»— el gate del mapa daria rojo sobre specs correctos y se
 * apagaria en una semana. Medido: el 035 cita al #97 como contexto de una medicion que no
 * arregla, y con un grep suelto quedaria declarando un origen que no salda.
 */
describe('origenDe', () => {
  const ENCABEZADO = (extra: string) =>
    `# Spec 044 — Un titulo\n\n**Fecha:** 2026-08-25\n**Estado:** Propuesto\n${extra}\n\n## Problema\n\nSale del #999.\n`;

  it('lee la linea del encabezado, con uno o con varios', () => {
    expect(origenDe(ENCABEZADO('**Origen:** #127'))).toEqual([127]);
    expect(origenDe(ENCABEZADO('**Origen:** #127, #124'))).toEqual([127, 124]);
  });

  it('sin la linea devuelve `null`, que es lo que no escribe el campo', () => {
    // `null` y no `[]`: el llamador traduce `null` a «no escribas `origen`», y `[]` lo
    // rechaza `leerMapa`. Que las dos cosas no se confundan es el punto.
    expect(origenDe(ENCABEZADO('**Autor:** nadie'))).toBeNull();
  });

  it('un `#N` despues del primer `##` no es un origen', () => {
    // El `Sale del #999` del cuerpo, que los dos casos de arriba ya traen. Si contara, el
    // 035 —que cita al #97 en una medicion que no arregla— declararia un origen que no
    // salda, y el gate daria rojo sobre un spec correcto.
    expect(origenDe(ENCABEZADO('**Origen:** #127'))).toEqual([127]);
  });

  it('una linea `**Origen:**` que no nombra ningun issue GRITA', () => {
    // El `[]`-no-es-un-error del 034, otra vez: devolverlo convertiria un error de quien
    // escribe el spec en un spec sin vinculo, en silencio.
    expect(() => origenDe(ENCABEZADO('**Origen:** el issue de la cache')))
      .toThrow('no nombra ningun issue');
  });
});

/**
 * El `specs-por-estado.mjs` de cada skill: **una copia por skill, y las dos iguales**.
 *
 * Un skill se lleva adentro los scripts que usa, asi que el que resolvia `--propuestos`
 * dejo de vivir en `.claude/scripts/` y hay uno en cada batch. La duplicacion tiene un
 * solo riesgo real —que una se arregle y la otra no, que es como el SKILL.md termina
 * diciendo una cosa y el script haciendo otra— y eso es lo que este bloque cierra.
 *
 * El otro motivo de que no importen `lib/`: un `.mjs` que importa un `.ts` necesita node
 * **>= 22.18** y el repo declara `^20.19` en `engines`. Un script que se inyecta en cada
 * corrida del skill no puede pedir mas de lo que el repo promete.
 */
describe('specs-por-estado.mjs, el de cada skill', () => {
  const COPIAS = [
    join(RAIZ, '.claude/skills/spec-review-batch/scripts/specs-por-estado.mjs'),
    join(RAIZ, '.claude/skills/spec-implement-batch/scripts/specs-por-estado.mjs'),
  ];

  it('las dos copias son el mismo archivo, byte por byte', () => {
    const [a, b] = COPIAS.map((c) => readFileSync(c, 'utf8'));

    expect(b, 'las copias divergieron: arreglar una y no la otra es el unico riesgo de duplicar').toBe(a);
  });

  it('no importa nada, que es lo que lo devuelve al piso de `engines`', () => {
    // Un solo `import` de algo que no sea `node:` lo saca del piso: si es un `.ts`
    // pide node >= 22.18, y si es un `.mjs` de afuera del skill deja de ser
    // autocontenido. Las dos cosas se ven en la misma linea.
    const fuera = [...readFileSync(COPIAS[0], 'utf8').matchAll(/^import .* from '([^']+)';$/gm)]
      .map((m) => m[1])
      .filter((m) => !m.startsWith('node:'));

    expect(fuera, `importa de afuera: ${fuera.join(', ')}`).toEqual([]);
  });

  it('devuelve los `NNN` del estado pedido, ordenados y uno por linea', () => {
    // Contra el `specs/mapa.json` de verdad, que es contra lo que corre: es el unico
    // caso donde el registro real es el fixture correcto, porque lo que se verifica es
    // justamente que el script lo sepa leer.
    const salida = execFileSync('node', [COPIAS[0], 'Implementado'], { encoding: 'utf8' });
    const ids = salida.split(/\r?\n/).filter(Boolean);

    expect(ids.length).toBeGreaterThan(20);
    expect(ids).toEqual([...ids].sort());
    expect(ids.every((id) => /^\d{3}$/.test(id))).toBe(true);
  });

  it('un estado sin specs da la lista vacia, y eso SI es una respuesta', () => {
    // «Ninguno esta en ese estado» es distinto de «no pude leer el registro», y el
    // script grita para el segundo — por eso el vacio de aca se puede creer.
    expect(execFileSync('node', [COPIAS[0], 'Un estado que no existe'], { encoding: 'utf8' }).trim()).toBe('');
  });
});

/**
 * El contrato de linea de comandos del hidratador, en el unico caso que **no toca la
 * red**: un `NNN` que el mapa no conoce.
 *
 * Es el caso que importa igual, porque es el que el spec 038 vino a arreglar del otro
 * lado: hasta el 038 el default traia los 42 y el que no venia no existia. Con el
 * default nuevo un spec puede faltar por tres motivos distintos —no lo pediste, ya esta
 * cerrado, ya esta en disco— y **decir cual** es la mitad del cambio. Un default que
 * trae menos y se calla se lee como «ese spec no existe».
 */
describe('hidratar-specs.mjs declara lo que no trajo', () => {
  const SCRIPT = join(RAIZ, '.claude/scripts/hidratar-specs.mjs');

  it('un `NNN` que no esta en el mapa lo dice, y no corre en vacio', () => {
    // Sin `gh`: con cero specs elegidos el bucle no llega a la primera llamada, asi
    // que este test corre igual en la CI y en un avion.
    const salida = execFileSync('node', [SCRIPT, '999'], { encoding: 'utf8' });

    expect(salida).toContain('999 no tiene entrada en specs/mapa.json');
    expect(salida).toContain('hidratados: 0 de 0');
    // El motivo va escrito: «salteados» sin el por que manda a adivinar si el registro
    // esta vacio o si el filtro se los comio.
    expect(salida).toMatch(/salteados \(no los pediste\)/);
  });
});

describe('urlDeIssue', () => {
  it('arma la URL desde el repo y el numero', () => {
    // El repo se pasa y no se hardcodea: `lib/` no habla con git ni con la red, asi
    // que quien sabe contra que remoto corre es quien llama.
    expect(urlDeIssue(REPO, 63)).toBe(ISSUE(63));
  });
});

describe('estadoDe', () => {
  const MAPA = MAPA_DE(['033', 95, 'Implementado'], ['034', 96]);

  it('saca el estado de la entrada', () => {
    expect(estadoDe(MAPA, '033')).toBe('Implementado');
    expect(estadoDe(MAPA, '034')).toBe('Propuesto');
  });

  it('un spec sin entrada da `null`, y eso NO es un estado', () => {
    // El bug del 035: sin entrada todavia, caia en el `else` y el issue se cerraba
    // recien nacido — lo contrario de lo correcto, porque un spec recien escrito es
    // justamente el que tiene que quedar abierto.
    expect(estadoDe(MAPA, '035')).toBeNull();
  });
});

describe('ESTADOS y enVuelo', () => {
  it('son cuatro, y `En curso` no esta', () => {
    // El AC8 del 038, escrito como asercion: el estado se saco porque ningun paso del
    // flujo lo escribia. Nombrarlo aca es lo que hace que volver a agregarlo sea una
    // decision y no un descuido.
    expect(ESTADOS).toEqual(['Propuesto', 'Implementado', 'Descartado', 'Superado']);
  });

  it('solo `Propuesto` sigue en vuelo', () => {
    expect(ESTADOS.filter(enVuelo)).toEqual(['Propuesto']);
  });

  it('el mapa de verdad no usa ningún estado de fuera de la lista', () => {
    // El mismo cruce que hace `mapa-de-specs.test.ts`, y acá también porque este
    // archivo es el que puede correr un `NNN` que no existe: si el mapa trajera un
    // estado desconocido, `enVuelo` lo daría por en vuelo y el default del hidratador
    // se llevaría un spec cerrado sin que nada avise.
    const mapa = leerMapa(readFileSync(join(RAIZ, 'specs/mapa.json'), 'utf8'));
    const fuera = Object.entries(mapa).filter(([, e]) => !ESTADOS.includes(e.estado));

    expect(fuera.map(([id, e]) => `${id}: ${e.estado}`)).toEqual([]);
  });

  it('un estado que no existe cuenta como en vuelo, no como cerrado', () => {
    // Lo desconocido no cierra nada: si un dia alguien escribe «En progreso» a mano, la
    // respuesta segura es traerlo al hidratar y dejar su issue abierto. Que ademas sea
    // ilegal lo grita el gate del mapa, que es de quien es esa pregunta.
    expect(enVuelo('En progreso')).toBe(true);
  });
});

/*
 * Aca vivia `slugDe`, que derivaba el nombre de la carpeta del titulo del issue.
 *
 * Se borro en el spec 035 con una medicion: sobre los 35 specs reproducia **28**
 * nombres historicos y fallaba en **7**. El 001 se llama
 * `001-notas-por-celda-en-orden-angular` y su issue se titula «Asignar cada nota a una
 * celda de la pieza…»; ninguna heuristica los recupera. El nombre pasa a estar en
 * `specs/mapa.json`, o sea guardado en vez de calculado, y el gate del mapa verifica
 * que empiece con su propio `NNN`.
 */

describe('archivoDeComentario', () => {
  it('reconoce el encabezado y lo saca del contenido', () => {
    expect(archivoDeComentario('## `research.md`\n\n# Research\n\ncuerpo\n'))
      .toEqual({ nombre: 'research.md', contenido: '# Research\n\ncuerpo\n' });
  });

  it('el nombre acepta digitos y guiones, que es lo que el publicador sube', () => {
    // Los dos lados usan `NOMBRE_PUBLICABLE`. Mientras aca decia `[a-z]+\.md` y alla
    // tambien, un `reparto-de-lote.md` quedaba afuera SIN DECIR NADA — y como
    // `specs/[0-9]…/` esta ignorado, el archivo se perdia en la hidratacion siguiente.
    expect(archivoDeComentario('## `reparto-de-lote.md`\n\ncuerpo\n')?.nombre).toBe('reparto-de-lote.md');
    expect(archivoDeComentario('## `research-2.md`\n\ncuerpo\n')?.nombre).toBe('research-2.md');
  });

  it('y sigue siendo estrecho: mayusculas y espacios no son un archivo', () => {
    // Es lo unico que distingue un archivo de una DISCUSION del issue, asi que ampliar
    // el alfabeto tiene un limite: un comentario escrito a mano no puede colarse.
    expect(archivoDeComentario('## `Notas Fede.md`\n\ncuerpo\n')).toBeNull();
    expect(archivoDeComentario('## `README.md`\n\ncuerpo\n')).toBeNull();
  });

  it('un comentario SIN encabezado no es un archivo', () => {
    // Es la unica forma de distinguir un archivo de una discusion del issue. Sin
    // esto, el primer comentario que alguien escriba a mano se escribiria al disco
    // como si fuera parte del spec.
    expect(archivoDeComentario('Ojo con esto, lo hablamos ayer.')).toBeNull();
    expect(archivoDeComentario('## research.md\n\nsin backticks')).toBeNull();
  });

  it('no se come una linea de mas del contenido', () => {
    // El encabezado se lleva su propio salto y UNO en blanco; el resto es del
    // archivo. Comerse todos —que es lo que hacia el `\s*` codicioso— cambia el
    // archivo en el round-trip, que es lo que el 033 verifica byte por byte.
    expect(archivoDeComentario('## `tasks.md`\n\n\n# Tareas')?.contenido).toBe('\n# Tareas');
  });

  it('y lo mismo en CRLF, que es lo que devuelve la API', () => {
    // La trampa que `.claude/rules/mcp-server.md` ya tiene anotada: los saltos de
    // GitHub son `\r\n`, y un corte que solo cuente `\n` deja el retorno de carro
    // colgado adelante del archivo.
    expect(archivoDeComentario('## `plan.md`\r\n\r\n# Plan\r\n')?.contenido).toBe('# Plan\r\n');
  });
});

describe('traducir', () => {
  const MAPA = MAPA_DE(['005', 67], ['009', 71]);

  it('traduce las tres formas de citar un spec que hay en el repo', () => {
    expect(traducir('ver [el 005](./005-src-en-capas/spec.md)', MAPA, REPO)).toBe(`ver [el 005](${ISSUE(67)})`);
    expect(traducir('ver [el 005](specs/005-src-en-capas/research.md)', MAPA, REPO)).toBe(`ver [el 005](${ISSUE(67)})`);
    expect(traducir('ver [el 005](../005-src-en-capas/plan.md)', MAPA, REPO)).toBe(`ver [el 005](${ISSUE(67)})`);
  });

  it('traduce los cuatro archivos y el `baseline.md`, que solo tiene el 008', () => {
    for (const archivo of ['spec', 'research', 'plan', 'tasks', 'baseline']) {
      expect(traducir(`(./009-el-recorrido/${archivo}.md)`, MAPA, REPO)).toBe(`(${ISSUE(71)})`);
    }
  });

  it('y tambien un extra publicable, que la lista de cinco dejaba pasar verbatim', () => {
    // El bug: mientras el nombre se aceptaba con `spec|research|plan|tasks|baseline`, un
    // enlace a `./005-…/reparto.md` —un archivo que el publicador SI sube— se publicaba
    // tal cual, o sea una ruta relativa a un directorio ignorado. Enlace muerto, y el
    // gate de `enlaces-resueltos` no lo mira porque exime los enlaces spec → `specs/`.
    for (const archivo of ['reparto', 'reparto-de-lote', 'research-2', 'baseline2']) {
      expect(traducir(`(./005-src-en-capas/${archivo}.md)`, MAPA, REPO)).toBe(`(${ISSUE(67)})`);
    }
  });

  it('lo que no esta en el mapa se deja COMO ESTABA', () => {
    // Un spec sin issue todavia no se puede traducir, y romper o borrar el enlace
    // seria peor: dejarlo permite que el gate de enlaces lo reporte.
    expect(traducir('(./021-el-tablero/spec.md)', MAPA, REPO)).toBe('(./021-el-tablero/spec.md)');
  });

  it('no toca un enlace que no es a un archivo de spec', () => {
    expect(traducir('(./mapa.json) y (../../docs/guides/quickstart.md)', MAPA, REPO))
      .toBe('(./mapa.json) y (../../docs/guides/quickstart.md)');
  });
});

describe('carpetaExistente', () => {
  const CARPETAS = ['004-fase-por-pieza-la-columna-como-posicion-en', '021-el-tablero-es-la-pantalla'];

  it('empareja por `NNN` aunque el slug haya cambiado', () => {
    // El bug que cierra: el slug sale del titulo del issue, asi que un titulo
    // editado —o un cambio de `slugDe`— daba un nombre distinto y el hidratador
    // creaba una SEGUNDA carpeta para el mismo spec. Dos carpetas con el mismo NNN
    // hacen que `spec_status` cuente el spec dos veces, sin que nada avise.
    expect(carpetaExistente(CARPETAS, '004')).toBe('004-fase-por-pieza-la-columna-como-posicion-en');
  });

  it('un spec que no esta da `null` y no la primera que haya', () => {
    expect(carpetaExistente(CARPETAS, '009')).toBeNull();
    expect(carpetaExistente([], '004')).toBeNull();
  });

  it('el `-` del prefijo no es decorativo', () => {
    // Sin el, `00` matchearia `004-…` y `021` matchearia un hipotetico `0210-…`.
    expect(carpetaExistente(CARPETAS, '02')).toBeNull();
  });
});

/* ── Derivar el mapa desde los PR (spec 043) ──────────────────────────────── */

/**
 * La derivacion del spec 043, que es la que le saca al mapa la unica parte que era una
 * afirmacion humana.
 *
 * El criterio de suficiencia de este bloque son los AC del 043, uno por uno, y no un
 * porcentaje: los tres primeros son el punto fijo —sobre el mapa correcto no cambia
 * nada—, su contraparte —sobre el mapa de antes del PR #128 cambia exactamente lo que
 * faltaba— y los bordes que decidirian mal si se derivaran. **Las dos primeras hacen
 * falta juntas**: un derivador que nunca cambia nada tambien da «cero correcciones»
 * sobre el mapa correcto, y pasaria la primera sola.
 */

/** Un mapa chico con las cuatro situaciones que existen, para no depender del repo. */
const MAPA_DE_PRUEBA = (): Mapa => ({
  '001': { issue: 63, carpeta: '001-uno', fecha: '2026-08-02', estado: 'Descartado', titulo: 'Spec 001' },
  '004': { issue: 66, carpeta: '004-cuatro', fecha: '2026-08-02', estado: 'Superado', titulo: 'Spec 004' },
  '038': { issue: 105, carpeta: '038-treinta-y-ocho', fecha: '2026-08-24', estado: 'Propuesto', titulo: 'Spec 038' },
  '043': { issue: 131, carpeta: '043-cuarenta-y-tres', fecha: '2026-08-25', estado: 'Propuesto', titulo: 'Spec 043' },
});

const ISSUES_DE_PRUEBA = new Map<number, IssueDeSpec>([
  [63, { number: 63, state: 'CLOSED', title: 'Spec 001' }],
  [66, { number: 66, state: 'CLOSED', title: 'Spec 004' }],
  [105, { number: 105, state: 'CLOSED', title: 'Spec 038' }],
  [131, { number: 131, state: 'OPEN', title: 'Spec 043' }],
]);

/** El 004 con su PR mergeado —lo tiene de verdad, es el #3—, el 038 mergeado, el 043 abierto. */
const PRS_DE_PRUEBA = (): Map<string, PrDeSpec[]> => agruparPrsPorSpec([
  { number: 3, headRefName: 'feature/004-cuatro', state: 'MERGED' },
  { number: 117, headRefName: 'feature/038-treinta-y-ocho', state: 'MERGED' },
  { number: 132, headRefName: 'feature/043-cuarenta-y-tres', state: 'OPEN' },
]);

describe('`derivarMapa` deduce el estado en vez de recordarlo', () => {
  it('sobre el mapa REAL del repo no cambia nada: es un punto fijo', () => {
    // La condicion sin la cual la Action corromperia el registro en vez de arreglarlo.
    // Corre contra `specs/mapa.json` de verdad, con los issues y los PR que el propio
    // mapa implica: si el spec dice `Implementado`, su issue esta cerrado y su PR
    // aterrizo. No es circular — lo que se prueba es que la REGLA no invente cambios.
    const mapa = leerMapa(readFileSync(join(RAIZ, 'specs', 'mapa.json'), 'utf8'));
    const issues = new Map(Object.values(mapa).map((e) => [
      e.issue, { number: e.issue, state: enVuelo(e.estado) ? 'OPEN' : 'CLOSED', title: e.titulo },
    ]));
    const prs = agruparPrsPorSpec(Object.entries(mapa)
      .filter(([, e]) => !enVuelo(e.estado))
      .map(([id], i) => ({ number: 1000 + i, headRefName: `feature/${id}-x`, state: 'MERGED' })));

    expect(derivarMapa(mapa, issues, prs).correcciones).toEqual([]);
  });

  it('y sobre el mapa de antes del PR #128 corrige exactamente lo que faltaba', () => {
    // La contraparte, y el bug que el spec 043 existe para no volver a tener: el 038
    // aterrizo y el registro seguia diciendo que se estaba pensando.
    const mapa = MAPA_DE_PRUEBA();

    const { correcciones } = derivarMapa(mapa, ISSUES_DE_PRUEBA, PRS_DE_PRUEBA());

    expect(correcciones).toEqual([{ id: '038', campo: 'estado', de: 'Propuesto', a: 'Implementado' }]);
  });

  it('el `titulo` vuelve al del issue, verbatim', () => {
    const mapa = MAPA_DE_PRUEBA();
    mapa['043'].titulo = 'Un titulo que alguien edito y el mapa no se entero';

    const { correcciones, mapa: derivado } = derivarMapa(mapa, ISSUES_DE_PRUEBA, PRS_DE_PRUEBA());

    expect(correcciones).toContainEqual({
      id: '043', campo: 'titulo', de: 'Un titulo que alguien edito y el mapa no se entero', a: 'Spec 043',
    });
    expect(derivado['043'].titulo).toBe('Spec 043');
  });

  it('conserva el `origen`, que es lo que hace que el 044 no le cueste una lista', () => {
    // El cruce que los dos specs dejaron escrito en prosa: el AC5 del 043 enumera lo que
    // sale identico —`issue`, `carpeta`, `fecha`— y `origen` no esta en esa lista, asi
    // que al que aterrizara segundo le tocaba agregarlo. Aterrizo segundo el 044, y no
    // hubo nada que agregar: quien lo conserva es el `{ ...entrada }` de `derivarMapa`,
    // que copia todo lo que la derivacion no nombra.
    //
    // El test existe porque esa propiedad es un efecto del spread y no una decision
    // escrita: cambiar el spread por un literal de cinco campos —una simplificacion que
    // se ve razonable— borraria el vinculo spec↔issue de deuda en el push siguiente a
    // `main`, en verde y sin diff que lo delate mas que la linea que desaparece.
    const mapa = MAPA_DE_PRUEBA();
    mapa['043'].origen = [125];

    const { mapa: derivado } = derivarMapa(mapa, ISSUES_DE_PRUEBA, PRS_DE_PRUEBA());

    expect(derivado['043'].origen).toEqual([125]);
    expect(derivado['038'].origen).toBeUndefined();
  });

  it('a `Descartado` y `Superado` no los mueve un PR mergeado', () => {
    // El 004 es `Superado` y su PR #3 esta mergeado: lo supero otro spec despues, y eso
    // no lo dice el merge. El 001 es `Descartado` y no tiene PR ninguno.
    const { mapa: derivado } = derivarMapa(MAPA_DE_PRUEBA(), ISSUES_DE_PRUEBA, PRS_DE_PRUEBA());

    expect(derivado['004'].estado).toBe('Superado');
    expect(derivado['001'].estado).toBe('Descartado');
  });

  it('un `Implementado` cuyo PR ya no aterriza vuelve a `Propuesto`', () => {
    // La direccion contraria, que es la que hace que esto sea una derivacion y no un
    // «marcar como hecho»: si la unica fuente dice que no aterrizo, el mapa la sigue.
    const mapa = MAPA_DE_PRUEBA();
    mapa['043'].estado = 'Implementado';

    const { correcciones } = derivarMapa(mapa, ISSUES_DE_PRUEBA, PRS_DE_PRUEBA());

    expect(correcciones).toContainEqual({ id: '043', campo: 'estado', de: 'Implementado', a: 'Propuesto' });
  });

  it('no toca `issue`, `carpeta` ni `fecha`, y no inventa ni pierde entradas', () => {
    const mapa = MAPA_DE_PRUEBA();
    // Una rama que nombra un spec que el mapa no tiene: es una rama mal nombrada o un
    // spec sin publicar, y las dos veces inventarle una entrada es peor que la falta.
    const prs = agruparPrsPorSpec([
      ...[...PRS_DE_PRUEBA().values()].flat(),
      { number: 999, headRefName: 'feature/099-un-spec-que-no-existe', state: 'MERGED' },
    ]);

    const { mapa: derivado } = derivarMapa(mapa, ISSUES_DE_PRUEBA, prs);

    expect(Object.keys(derivado)).toEqual(['001', '004', '038', '043']);
    for (const id of Object.keys(derivado)) {
      expect([derivado[id].issue, derivado[id].carpeta, derivado[id].fecha])
        .toEqual([mapa[id].issue, mapa[id].carpeta, mapa[id].fecha]);
    }
  });

  it('un issue que no se pudo leer deja el titulo como estaba, no lo vacia', () => {
    // «No lo pude leer» y «se llama vacio» son respuestas opuestas. Quien grita por un
    // spec que apunta a un issue inexistente es el gate, que tiene el mensaje.
    const { mapa: derivado, correcciones } = derivarMapa(MAPA_DE_PRUEBA(), new Map(), PRS_DE_PRUEBA());

    expect(derivado['038'].titulo).toBe('Spec 038');
    expect(correcciones.filter((c) => c.campo === 'titulo')).toEqual([]);
  });

  it('una rama que no nombra un spec no agrupa, y `feature/` no es el unico prefijo', () => {
    // El 038 y el 042 aterrizaron por ramas `fix/` y `chore/`: un patron que solo
    // aceptara `feature/` los perderia sin decirlo.
    const agrupado = agruparPrsPorSpec([
      { number: 1, headRefName: 'chore/038-algo', state: 'MERGED' },
      { number: 2, headRefName: 'fix/041-otra-cosa', state: 'MERGED' },
      { number: 3, headRefName: 'renovate/lock-file-maintenance', state: 'OPEN' },
      { number: 4, headRefName: 'main', state: 'OPEN' },
    ]);

    expect([...agrupado.keys()].sort()).toEqual(['038', '041']);
  });

  it('aterriza un `MERGED`, y no un `OPEN`', () => {
    expect(aterrizo([{ number: 1, headRefName: 'feature/020-x', state: 'MERGED' }])).toBe(true);
    expect(aterrizo([{ number: 1, headRefName: 'feature/020-x', state: 'OPEN' }])).toBe(false);
    expect(aterrizo([])).toBe(false);
    expect(aterrizo(undefined)).toBe(false);
  });

  it('un `CLOSED` sin mergear NO aterriza, aunque este cerrado', () => {
    // El modo de falla que el escritor del 043 vuelve caro: un `feature/044-x` que se
    // abre y se cierra sin mergear pondria el 044 en `Implementado` y lo commitearia a
    // `main`; desde ahi el cruce contra el issue —abierto— deja en rojo TODOS los PR
    // siguientes, y arreglar el mapa a mano no sirve porque el push que viene lo
    // reescribe. Pasa de verdad: el #23 es una primera version del 029 que se abandono.
    expect(aterrizo([{ number: 23, headRefName: 'feature/029-x', state: 'CLOSED' }])).toBe(false);
  });

  it('salvo los dos que aterrizaron a mano, que son una lista medida', () => {
    // Los PR #35 y #36 —specs 020 y 021— figuran `CLOSED` y no `MERGED` porque se
    // mergearon fuera de GitHub, y sus commits (`6fffa34` y `ea4db2f`) estan en `main`.
    // La API no los distingue de un abandonado —los dos dicen `CLOSED`, `mergedAt: null`—
    // asi que lo unico honesto es nombrarlos.
    expect([...ATERRIZARON_A_MANO].sort()).toEqual([35, 36]);
    for (const number of ATERRIZARON_A_MANO) {
      expect(aterrizo([{ number, headRefName: 'feature/020-x', state: 'CLOSED' }])).toBe(true);
    }
  });
});

describe('`escribirMapa` es el unico formato del registro', () => {
  it('reproduce `specs/mapa.json` byte por byte', () => {
    // Es lo que hace que mudarlo desde `publicar-spec.mjs` no cambie nada, y lo que
    // permite que dos escritores no se peleen por el formato.
    const crudo = readFileSync(join(RAIZ, 'specs', 'mapa.json'), 'utf8');

    expect(escribirMapa(leerMapa(crudo))).toBe(crudo);
  });

  it('cambiar un estado da un diff de UNA linea', () => {
    // El motivo entero del formato: con `JSON.stringify(m, null, 2)` cada entrada ocupa
    // siete lineas, asi que el commit que la Action hace sola seria ilegible.
    const mapa = leerMapa(readFileSync(join(RAIZ, 'specs', 'mapa.json'), 'utf8'));
    const antes = escribirMapa(mapa).split('\n');
    mapa['001'] = { ...mapa['001'], estado: 'Implementado' };
    const despues = escribirMapa(mapa).split('\n');

    expect(antes.length).toBe(despues.length);
    expect(antes.filter((l, i) => l !== despues[i])).toHaveLength(1);
  });
});

/**
 * El tramo que habla con el mundo: que hace el derivador segun lo que le contestaron.
 *
 * El entorno se inyecta por lo mismo que en `gh.test.ts`: los modos de falla que
 * importan —una lista truncada, un mapa que ya esta bien— no se pueden fabricar contra
 * el repo real. `guardar` registra en vez de escribir, asi que «no escribio» es una
 * asercion y no una ausencia de efecto que nadie mire.
 */
describe('`derivarYGuardar` decide si escribir, y con que codigo sale', () => {
  const MAPA_TEXTO = () => escribirMapa(MAPA_DE_PRUEBA());

  const entornoFalso = (opciones: {
    issues?: IssueDeSpec[]; prs?: PrDeSpec[]; texto?: string; limite?: number; verificar?: boolean;
  }): EntornoDerivacion & { guardados: string[]; dicho: string[] } => {
    const guardados: string[] = [];
    const dicho: string[] = [];
    return {
      guardados,
      dicho,
      issues: () => opciones.issues ?? [...ISSUES_DE_PRUEBA.values()],
      prs: () => opciones.prs ?? [
        { number: 3, headRefName: 'feature/004-cuatro', state: 'MERGED' },
        { number: 117, headRefName: 'feature/038-treinta-y-ocho', state: 'MERGED' },
        { number: 132, headRefName: 'feature/043-cuarenta-y-tres', state: 'OPEN' },
      ],
      leerTexto: () => opciones.texto ?? MAPA_TEXTO(),
      guardar: (t: string) => { guardados.push(t); },
      informar: (l: string) => { dicho.push(l); },
      limite: opciones.limite ?? 1000,
      verificar: opciones.verificar ?? false,
    };
  };

  it('sin correcciones no escribe, y sale 0', () => {
    // AC9: es lo que hace que el workflow no genere un commit vacio por push.
    const mapa = MAPA_DE_PRUEBA();
    mapa['038'].estado = 'Implementado';
    const entorno = entornoFalso({ texto: escribirMapa(mapa) });

    expect(derivarYGuardar(entorno)).toBe(0);
    expect(entorno.guardados).toEqual([]);
    expect(entorno.dicho.join('\n')).toContain('sin cambios');
  });

  it('con correcciones escribe una vez, sale 0, y dice cual fue cada una', () => {
    const entorno = entornoFalso({});

    expect(derivarYGuardar(entorno)).toBe(0);
    expect(entorno.guardados).toHaveLength(1);
    expect(leerMapa(entorno.guardados[0])['038'].estado).toBe('Implementado');
    expect(entorno.dicho.join('\n')).toContain('038');
  });

  it('con `--verificar` no escribe nunca, y sale 1 si hubiera escrito', () => {
    const entorno = entornoFalso({ verificar: true });

    expect(derivarYGuardar(entorno)).toBe(1);
    expect(entorno.guardados).toEqual([]);
  });

  it('y con `--verificar` sobre un mapa correcto sale 0', () => {
    // La contraparte: si `--verificar` saliera 1 siempre, no distinguiria nada.
    const mapa = MAPA_DE_PRUEBA();
    mapa['038'].estado = 'Implementado';

    expect(derivarYGuardar(entornoFalso({ texto: escribirMapa(mapa), verificar: true }))).toBe(0);
  });

  it('una lista de PR truncada NO escribe y sale 1', () => {
    // AC6, y es el modo de falla que mas caro sale: en una lista cortada «este spec no
    // tiene PR» y «su PR no entro en la pagina» no se distinguen, asi que derivar sobre
    // eso pondria en `Propuesto` a todo spec cuyo PR quedo afuera. El derivador seria lo
    // unico capaz de romper el registro entero de una vez.
    const entorno = entornoFalso({
      limite: 2,
      prs: [
        { number: 1, headRefName: 'feature/038-x', state: 'MERGED' },
        { number: 2, headRefName: 'feature/043-x', state: 'OPEN' },
      ],
    });

    expect(derivarYGuardar(entorno)).toBe(1);
    expect(entorno.guardados).toEqual([]);
    expect(entorno.dicho.join('\n')).toContain('truncada');
  });

  it('y una lista de issues truncada tampoco, aunque los PR esten completos', () => {
    const entorno = entornoFalso({ limite: 4 });

    expect(derivarYGuardar(entorno)).toBe(1);
    expect(entorno.guardados).toEqual([]);
  });
});

/* ── El censo de deuda (spec 044) ─────────────────────────────────────────── */

/**
 * `deudaDelCenso`: los issues que ningun spec reclama, o sea lo que hay para promover.
 *
 * Es una resta de conjuntos y por eso alcanza con dos arrays escritos a mano: lo que hay
 * que ejercer no es el volumen sino las **dos** formas de reclamar un issue. La segunda
 * —el `origen`— es la que existe desde este spec, y sin ella el censo seguiria mostrando
 * exactamente lo que el spec acaba de tomar.
 */
describe('deudaDelCenso', () => {
  const ISSUES = [
    { number: 63, state: 'CLOSED', title: 'Spec 001' },
    { number: 45, state: 'OPEN', title: 'Una deuda vieja' },
    { number: 127, state: 'OPEN', title: 'La deuda que pario el 044' },
  ];

  it('saca los issues que SON de un spec', () => {
    const deuda = deudaDelCenso(ISSUES, MAPA_DE(['001', 63]));

    expect(deuda.map((i) => i.number)).toEqual([45, 127]);
  });

  it('y tambien los que un spec declaro SALDAR', () => {
    // La entrada de mas que saca un issue del listado, que es el AC6 puesto en dos
    // arrays: el 044 declara `origen: [127]`, asi que el #127 deja de ser deuda para
    // promover — ya tiene duenio. Sin esta mitad, el censo listaria para siempre lo que
    // este mismo spec vino a tomar.
    const mapa = { ...MAPA_DE(['001', 63]), '044': { ...ENTRADA('044', 132), origen: [127] } };

    const deuda = deudaDelCenso(ISSUES, mapa);

    expect(deuda.map((i) => i.number)).toEqual([45]);
  });

  it('no habla con la red ni con el disco: dos arrays alcanzan', () => {
    // La propiedad que hace que esto no sea una tool del MCP y si un script aparte:
    // `spec_status` responde sin `gh` y eso el 034 lo defiende. Lo puro se prueba entero
    // aca, y lo que habla con `gh` queda en `deuda.mjs`, que no tiene ninguna decision.
    expect(deudaDelCenso([], MAPA_DE(['001', 63]))).toEqual([]);
  });
});

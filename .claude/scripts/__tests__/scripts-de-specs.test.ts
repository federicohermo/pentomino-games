import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import {
  archivoDeComentario, carpetaExistente, ESTADOS, estadoDe, enVuelo, leerMapa, traducir, urlDeIssue,
} from '../lib/specs.ts';

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

import { describe, it, expect } from 'vitest';
import {
  archivoDeComentario, carpetaExistente, estadoDe, idsPorEstado, leerMapa, traducir, urlDeIssue,
} from '../../.claude/scripts/lib/specs.ts';

/**
 * Los dos scripts que mueven los specs entre el repo y GitHub Issues (spec 034).
 *
 * **Por que estan testeados y por que aca.** `publicar-spec.mjs` y
 * `hidratar-specs.mjs` nacieron como herramientas de un solo uso y no lo son: cada
 * spec nuevo se publica y cada worktree se hidrata. El commit que los estreno se
 * llama «tres bugs del publicador que lo estreno» y los tres eran de parseo —un
 * comentario duplicado, un `issue close` sobre uno ya cerrado, un estado nulo leido
 * como terminal—, encontrados usandolos y no por un test.
 *
 * Viven en `specs/__tests__/` —al lado de lo que verifican— desde el spec 035. El
 * codigo que miran esta en `.claude/scripts/lib/`, fuera del `include` de coverage
 * —que es `src/**`—, asi que no entra al umbral de 100: el criterio de suficiencia es
 * otro, y esta escrito en cada bloque. Cada caso de abajo es un modo de falla que ya
 * paso o que el propio spec lo nombra.
 */

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
});

describe('idsPorEstado', () => {
  const MAPA = MAPA_DE(['001', 63, 'Implementado'], ['034', 96], ['035', 99]);

  it('devuelve los `NNN` del estado pedido, ordenados', () => {
    expect(idsPorEstado(MAPA, 'Propuesto')).toEqual(['034', '035']);
    expect(idsPorEstado(MAPA, 'Implementado')).toEqual(['001']);
  });

  it('un estado que no tiene specs da la lista vacia', () => {
    // Y eso SI es una respuesta: «ninguno esta Descartado» es distinto de «no pude
    // leer el registro», que es lo que `leerMapa` ya rechazo mas arriba.
    expect(idsPorEstado(MAPA, 'Descartado')).toEqual([]);
  });

  it('vive aca y no en cada `.sh`, que es el punto', () => {
    // Lo piden `lote.sh` y `matriz.sh` para su `--propuestos`, y hasta el 035 cada uno
    // lo sacaba con su propio `sed` sobre la tabla de `log.md`. Dos copias del mismo
    // parseo es como el SKILL.md termina diciendo una cosa y el script haciendo otra,
    // que ya paso con los cruces.
    expect(idsPorEstado(MAPA, 'Propuesto')).toEqual(idsPorEstado({ ...MAPA }, 'Propuesto'));
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

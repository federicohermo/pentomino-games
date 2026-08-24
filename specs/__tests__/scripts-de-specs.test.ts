import { describe, it, expect } from 'vitest';
import {
  archivoDeComentario, carpetaExistente, estadoDe, filasDeLog, mapaDeLog, slugDe, traducir,
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
 * Viven en `src/__tests__/` porque es donde ya estan los gates del repo que no miran
 * la app: `specs-convencion`, `enlaces-resueltos`, `mapa-de-directorios`,
 * `claude-md-acotado`. El codigo que verifican esta en `.claude/scripts/lib/`, fuera
 * del `include` de coverage —que es `src/**`—, asi que no entra al umbral de 100: el
 * criterio de suficiencia es otro, y esta escrito en cada bloque. Cada caso de abajo
 * es un modo de falla que ya paso o que el propio spec 034 nombra.
 */

const FILA = (id: string, href: string) => `| [${id}](${href}) | 2026-08-23 | Propuesto | Una cosa |`;
const ISSUE = (n: number) => `https://github.com/federicohermo/pentomino-games/issues/${n}`;

describe('filasDeLog / mapaDeLog', () => {
  it('lee id, numero y URL de cada fila migrada', () => {
    const filas = filasDeLog([FILA('001', ISSUE(63)), FILA('034', ISSUE(96))].join('\n'));

    expect(filas).toEqual([
      { id: '001', url: ISSUE(63), numero: '63' },
      { id: '034', url: ISSUE(96), numero: '96' },
    ]);
  });

  it('NO cuenta las filas que todavia apuntan a una carpeta', () => {
    // Media tabla migrada es el estado que el 034 define como invalido, y el mapa
    // tiene que reflejarlo corto en vez de inventar un issue: de una ruta no sale un
    // numero de issue, y adivinarlo —`NNN` -> `#NNN`— es justo lo que el AC3 prohibe
    // porque issues y PRs comparten contador.
    const filas = filasDeLog([FILA('001', './001-notas-por-celda/spec.md'), FILA('002', ISSUE(64))].join('\n'));

    expect(filas.map((f) => f.id)).toEqual(['002']);
  });

  it('no confunde un issue de otro repo con una ruta, ni una linea suelta con una fila', () => {
    expect(filasDeLog('el spec [001](https://github.com/x/y/issues/1) se cita en un parrafo')).toEqual([]);
    expect(filasDeLog(FILA('001', 'https://example.com/algo'))).toEqual([]);
  });

  it('el mapa indexa por `NNN` y el numero viaja como numero', () => {
    expect(mapaDeLog(FILA('021', ISSUE(83)))).toEqual({ '021': { numero: 83, url: ISSUE(83) } });
  });
});

describe('estadoDe', () => {
  const LOG = [FILA('033', ISSUE(95)).replace('Propuesto', 'Implementado'), FILA('034', ISSUE(96))].join('\n');

  it('saca el estado de la fila, que es la TERCERA columna', () => {
    // La segunda es la fecha. Leer la columna corrida cerraria un spec por la fecha
    // que tenga, que es la clase de bug que no da error.
    expect(estadoDe(LOG, '033')).toBe('Implementado');
    expect(estadoDe(LOG, '034')).toBe('Propuesto');
  });

  it('un spec sin fila da `null`, y eso NO es un estado', () => {
    // El bug del 035: sin fila todavia, caia en el `else` y el issue se cerraba
    // recien nacido — lo contrario de lo correcto, porque un spec recien escrito es
    // justamente el que tiene que quedar abierto.
    expect(estadoDe(LOG, '035')).toBeNull();
  });
});

describe('slugDe', () => {
  it('saca el prefijo `Spec NNN —` y deja el titulo en kebab', () => {
    expect(slugDe('Spec 021 — El tablero es la pantalla', '021')).toBe('021-el-tablero-es-la-pantalla');
  });

  it('se lleva los acentos y la puntuacion', () => {
    expect(slugDe('Spec 017 — El régimen de rotación', '017')).toBe('017-el-regimen-de-rotacion');
    expect(slugDe('Spec 004 — Fase por pieza: la columna como posición en el compás', '004'))
      .toBe('004-fase-por-pieza-la-columna-como-posicion-en-el-compas');
  });

  it('corta en un guion y nunca a mitad de palabra', () => {
    // El corte viejo era a las 8 primeras palabras y partia la frase donde cayera:
    // el 001 quedaba `001-asignar-cada-nota-a-una-celda-de-la`. Lo que se afirma no
    // es el largo exacto —eso es un numero de la implementacion— sino que lo que
    // salga termine en una palabra entera del titulo.
    const largo = slugDe('Spec 001 — Asignar cada nota a una celda de la pieza, en orden angular alrededor del centroide', '001');

    expect(largo.startsWith('001-asignar-cada-nota-a-una-celda-de-la-pieza')).toBe(true);
    expect(largo.endsWith('-')).toBe(false);
    for (const palabra of largo.slice(4).split('-')) {
      expect('asignar cada nota a una celda de la pieza en orden angular alrededor del centroide'.split(' '))
        .toContain(palabra);
    }
  });

  it('un titulo sin el prefijo tambien sale entero', () => {
    // `tituloDe` lee el `# ` del spec tal cual, asi que un spec que no siga la
    // convencion del encabezado no puede romper la hidratacion.
    expect(slugDe('Los registros se van con los specs', '035')).toBe('035-los-registros-se-van-con-los-specs');
  });
});

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
  const MAPA = { '005': { numero: 67, url: ISSUE(67) }, '009': { numero: 71, url: ISSUE(71) } };

  it('traduce las tres formas de citar un spec que hay en el repo', () => {
    expect(traducir('ver [el 005](./005-src-en-capas/spec.md)', MAPA)).toBe(`ver [el 005](${ISSUE(67)})`);
    expect(traducir('ver [el 005](specs/005-src-en-capas/research.md)', MAPA)).toBe(`ver [el 005](${ISSUE(67)})`);
    expect(traducir('ver [el 005](../005-src-en-capas/plan.md)', MAPA)).toBe(`ver [el 005](${ISSUE(67)})`);
  });

  it('traduce los cuatro archivos y el `baseline.md`, que solo tiene el 008', () => {
    for (const archivo of ['spec', 'research', 'plan', 'tasks', 'baseline']) {
      expect(traducir(`(./009-el-recorrido/${archivo}.md)`, MAPA)).toBe(`(${ISSUE(71)})`);
    }
  });

  it('lo que no esta en el mapa se deja COMO ESTABA', () => {
    // Un spec sin issue todavia no se puede traducir, y romper o borrar el enlace
    // seria peor: dejarlo permite que el gate de enlaces lo reporte.
    expect(traducir('(./021-el-tablero/spec.md)', MAPA)).toBe('(./021-el-tablero/spec.md)');
  });

  it('no toca un enlace que no es a un archivo de spec', () => {
    expect(traducir('(./log.md) y (../../docs/guides/quickstart.md)', MAPA))
      .toBe('(./log.md) y (../../docs/guides/quickstart.md)');
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

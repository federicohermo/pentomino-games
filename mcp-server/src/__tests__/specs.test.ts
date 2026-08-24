import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  agregarSeguimiento, buscarSpec, marcarTarea, parseMapa, parseTasks, readSpecStatus,
  type SpecStatus,
} from '../specs.ts';

/**
 * Sobre strings fijos y NO sobre los archivos del repo: si estos tests leyeran
 * `specs/`, marcar una tarea rompería el build.
 */

const MAPA = JSON.stringify({
  '001': {
    issue: 63, carpeta: '001-notas-por-celda', fecha: '2026-08-02',
    estado: 'Propuesto', titulo: 'Spec 001 — Notas por celda',
  },
  '002': {
    issue: 64, carpeta: '002-motor-de-audio', fecha: '2026-08-02',
    estado: 'Implementado', titulo: 'Spec 002 — Motor propio',
  },
});

const TASKS = `# Tareas — Ejemplo

## Backlog
- [x] Commitear el spec
- [ ] **Crear rama** \`feature/002-motor\`

## Motor
- [x] Escribir el scheduler
  - [x] Con lookahead
  - [ ] Con una tarea anidada sin marcar
- [ ] Una tarea larga que sigue
      en la línea de abajo

## Seguimiento (no bloquea)
- [ ] Deuda anotada a propósito
- [ ] Más deuda
`;

/** El formato con ID y marcadores, que estrena el spec 011. */
const MARCADAS = `# Tareas — Con ID y marcadores

## Backlog
- [x] T001 Commitear el spec
- [ ] T002 Escribir el dominio
- [ ] T003 [P] [M] Escuchar el resultado a 160 bpm

## Seguimiento (no bloquea)
- [ ] T004 [M] Capturas del tablero
`;

describe('parseMapa', () => {
  test('saca los cinco campos de cada entrada', () => {
    const mapa = parseMapa(MAPA);
    assert.equal(Object.keys(mapa).length, 2);
    assert.deepEqual(mapa['001'], {
      issue: 63, carpeta: '001-notas-por-celda', fecha: '2026-08-02',
      estado: 'Propuesto', titulo: 'Spec 001 — Notas por celda',
    });
    assert.equal(mapa['002'].estado, 'Implementado');
  });

  test('un mapa vacío es un mapa vacío, no un error', () => {
    // `{}` es una respuesta legítima —un repo sin un solo spec—, y distinta de un
    // archivo roto. Confundirlas es lo que hace este parser al revés que su
    // antecesora: `parseLog` devolvía `[]` en los DOS casos.
    assert.deepEqual(parseMapa('{}'), {});
  });

  /*
   * Lo que sigue es el punto del archivo: **grita en vez de devolver poco**.
   *
   * `parseLog` devolvía `[]` cuando su regex dejaba de matchear, y cuando el spec 034
   * le cambió el formato a la columna del enlace eso salió como 34 specs con
   * `estado: null` — la tool contestando que no sabe nada, en verde. Cada uno de estos
   * casos es esa misma falla en la versión JSON.
   */
  const rotos: [string, string][] = [
    ['no es JSON', 'no es JSON valido'],
    ['[]', 'tiene que ser un objeto'],
    ['null', 'tiene que ser un objeto'],
    ['{"1": {}}', 'no es un NNN de tres digitos'],
    ['{"001": null}', 'no es un objeto'],
    ['{"001": {"issue": 63}}', '`carpeta` como string'],
    ['{"001": {"issue": "63", "carpeta": "a", "fecha": "b", "estado": "c", "titulo": "d"}}', '`issue` como number'],
  ];

  for (const [json, esperado] of rotos) {
    test(`falla fuerte ante ${json.slice(0, 40)}`, () => {
      assert.throws(() => parseMapa(json), (e: Error) => e.message.includes(esperado));
    });
  }

  test('el mensaje dice QUÉ entrada está mal, no sólo que algo lo está', () => {
    // Un mapa de 35 entradas con «falta un campo» y sin decir cuál obliga a leer el
    // archivo entero, que es justo lo que esta tool existe para no hacer.
    assert.throws(
      () => parseMapa('{"001": {"issue": 63, "carpeta": "a", "fecha": "b", "estado": "c"}, "002": {}}'),
      /entrada 001/);
  });
});

describe('parseTasks', () => {
  test('cuenta marcadas sobre el total, anidadas incluidas', () => {
    const t = parseTasks(TASKS);
    assert.equal(t.total, 8);
    assert.equal(t.hechas, 3);
  });

  test('las de Seguimiento se cuentan aparte y no son la próxima', () => {
    // Es lo que distingue "faltan seis cosas" de "hay seis cosas anotadas a
    // propósito". Un conteo plano leería lo mismo en los dos casos.
    const t = parseTasks(TASKS);
    assert.equal(t.seguimiento, 2);
    assert.equal(t.proxima, '**Crear rama** `feature/002-motor`');
  });

  test('la próxima es la primera sin marcar, no la primera de todas', () => {
    const t = parseTasks('## A\n- [x] hecha\n- [x] otra\n- [ ] esta\n- [ ] no esta\n');
    assert.equal(t.proxima, 'esta');
  });

  test('una tarea que ocupa dos líneas se lee entera', () => {
    const t = parseTasks('## A\n- [ ] Una tarea larga que sigue\n      en la línea de abajo\n');
    assert.equal(t.proxima, 'Una tarea larga que sigue en la línea de abajo');
  });

  test('con todo marcado no hay próxima', () => {
    const t = parseTasks('## A\n- [x] una\n- [x] otra\n');
    assert.deepEqual(t, {
      hechas: 2, total: 2, seguimiento: 0, manual: 0, pendientes: 0,
      proxima: null, proximaId: null, citas: [], cruces: [],
    });
  });

  test('solo las de seguimiento sin marcar tampoco dan próxima', () => {
    const t = parseTasks('## Hecho\n- [x] una\n\n## Seguimiento (no bloquea)\n- [ ] deuda\n');
    assert.equal(t.proxima, null);
    assert.equal(t.seguimiento, 1);
  });

  test('CRLF cuenta igual que LF', () => {
    // No es teórico: los archivos de este repo están en CRLF, y en JavaScript
    // `.` NO matchea `\r`, así que un patrón que termine en `(.*)$` deja de
    // matchear y los conteos dan CERO sin ningún error. Fue el bug real.
    const lf = parseTasks(TASKS);
    const crlf = parseTasks(TASKS.replace(/\n/g, '\r\n'));
    assert.deepEqual(crlf, lf);
    assert.ok(crlf.total > 0);
  });

  test('un tasks.md sin checkboxes devuelve ceros, no falla', () => {
    assert.deepEqual(parseTasks('# Tareas\n\nTodavía nada.\n'), {
      hechas: 0, total: 0, seguimiento: 0, manual: 0, pendientes: 0,
      proxima: null, proximaId: null, citas: [], cruces: [],
    });
  });

  test('`pendientes` vale 0 exactamente cuando no hay próxima', () => {
    // Es la invariante que hace legible la respuesta: sin ella hay que restar
    // hechas, seguimiento y manual a mano para saber si falta algo.
    for (const md of [TASKS, MARCADAS, '## A\n- [x] una\n', '# Nada\n']) {
      const t = parseTasks(md);
      assert.equal(t.pendientes === 0, t.proxima === null, md.slice(0, 20));
    }
  });
});

describe('parseTasks — ID y marcadores', () => {
  test('el ID sale del texto y viaja aparte', () => {
    // Si el ID se quedara en el texto, `proxima` empezaría con "T002 " y el
    // consumidor tendría que volver a parsearlo.
    const t = parseTasks(MARCADAS);
    assert.equal(t.proxima, 'Escribir el dominio');
    assert.equal(t.proximaId, 'T002');
  });

  test('`[M]` no bloquea: pide una persona, no trabajo pendiente', () => {
    // El caso real: nueve specs `Implementado` con una verificación a oído
    // abierta. Sin esto, `spec_status` los reporta como si algo faltara.
    const t = parseTasks(MARCADAS);
    assert.equal(t.manual, 2);
    assert.equal(t.pendientes, 1);
  });

  test('`[P]` se parsea pero no cambia el conteo', () => {
    const t = parseTasks('## A\n- [ ] T001 [P] una\n- [ ] T002 [P] otra\n');
    assert.deepEqual([t.pendientes, t.manual, t.proximaId], [2, 0, 'T001']);
  });

  test('los dos marcadores juntos, en cualquier orden', () => {
    const pm = parseTasks('## A\n- [ ] T001 [P] [M] una\n');
    const mp = parseTasks('## A\n- [ ] T001 [M] [P] una\n');
    assert.deepEqual(pm, mp);
    assert.equal(pm.manual, 1);
    assert.equal(pm.proxima, null);
  });

  test('una tarea de Seguimiento con `[M]` suma en los dos contadores', () => {
    // Son ejes distintos —dónde está anotada y quién la puede hacer— así que no
    // se excluyen, y contarla una sola vez escondería una de las dos cosas.
    const t = parseTasks('## Seguimiento (no bloquea)\n- [ ] [M] escuchar\n');
    assert.deepEqual([t.seguimiento, t.manual, t.pendientes], [1, 1, 0]);
  });

  test('un tasks.md sin IDs ni marcadores se lee igual que antes', () => {
    // Los diez specs anteriores a la convención no se reescriben, así que el
    // formato viejo tiene que seguir contando bien.
    const t = parseTasks(TASKS);
    assert.deepEqual([t.total, t.hechas, t.manual], [8, 3, 0]);
    assert.equal(t.proximaId, null);
    assert.equal(t.proxima, '**Crear rama** `feature/002-motor`');
  });

  test('un corchete que no es marcador se queda en el texto', () => {
    // `[AC3]`, un link `[docs](…)` o un `[NEEDS CLARIFICATION]` no son `[P]` ni
    // `[M]`: el patrón no los puede comer sin mutilar la descripción.
    const t = parseTasks('## A\n- [ ] T001 [AC3] revisar [docs](./d.md)\n');
    assert.equal(t.proxima, '[AC3] revisar [docs](./d.md)');
    assert.equal(t.proximaId, 'T001');
  });

  test('CRLF tampoco rompe los marcadores', () => {
    assert.deepEqual(parseTasks(MARCADAS.replace(/\n/g, '\r\n')), parseTasks(MARCADAS));
  });
});

/**
 * `readSpecStatus` es la parte que toca el disco, y la unica que cruza las dos
 * mitades: manda **el mapa**, y las carpetas se cruzan contra el.
 *
 * Esa direccion se dio vuelta en el 035 y no por gusto: mientras mandaban las
 * carpetas, un checkout sin hidratar hacia que la tool contestara «1 spec» sobre un
 * repo de 35, en verde. Las carpetas dejaron de ser el registro cuando el 034 las
 * convirtio en cache.
 *
 * Va sobre un `specs/` de mentira en un temporal y no sobre el del repo, por la
 * misma razon que el resto de este archivo: sus casos son un spec sin hidratar, una
 * carpeta sin entrada y un spec terminal con casillas abiertas, o sea estados que el
 * repo real no tiene —ni queremos que tenga— y que apareceria y desapareceria solos.
 */
describe('readSpecStatus', () => {
  /** Arma un `specs/` desechable. `null` en `mapa` es "este directorio no tiene mapa.json". */
  function fixture(mapa: string | null, dirs: Record<string, string | null>): string {
    const raiz = mkdtempSync(join(tmpdir(), 'spec-status-'));
    if (mapa !== null) writeFileSync(join(raiz, 'mapa.json'), mapa, 'utf8');
    for (const [dir, tasks] of Object.entries(dirs)) {
      mkdirSync(join(raiz, dir));
      if (tasks !== null) writeFileSync(join(raiz, dir, 'tasks.md'), tasks, 'utf8');
    }
    return raiz;
  }

  /** Una entrada de mapa para la carpeta `dir`, con el `NNN` sacado de su nombre. */
  const entrada = (dir: string, estado: string) => [dir.slice(0, 3), {
    issue: 60 + Number(dir.slice(0, 3)), carpeta: dir, fecha: '2026-08-20',
    estado, titulo: `Spec ${dir.slice(0, 3)} — Titulo de ${dir}`,
  }] as const;

  const mapaCon = (...entradas: (readonly [string, object])[]) =>
    JSON.stringify(Object.fromEntries(entradas));

  const UNA_ABIERTA = '## Tareas\n- [x] T001 Hecha\n- [ ] T002 Abierta\n';
  const TODAS_HECHAS = '## Tareas\n- [x] T001 Hecha\n- [x] T002 Tambien\n';

  test('un spec SIN hidratar contesta igual: estado, fecha y titulo salen del mapa', () => {
    // El caso que le da sentido al mapa, y esta medido: sobre `main` con el 034 recien
    // mergeado y `specs/` sin hidratar, la version que recorria carpetas devolvia
    // **1 spec de 35**, con `totales: {specs: 1}` y sin una sola nota.
    //
    // Sin red y sin carpetas, las tres columnas que el registro tenia siguen ahi. Lo
    // unico que falta es `tareas`, que vive en el `tasks.md` del issue, y la nota dice
    // como bajarlo.
    const raiz = fixture(mapaCon(entrada('001-un-spec', 'Implementado')), {});
    try {
      const { specs, totales } = readSpecStatus(raiz);

      assert.equal(specs.length, 1);
      assert.equal(specs[0].estado, 'Implementado');
      assert.equal(specs[0].fecha, '2026-08-20');
      assert.equal(specs[0].titulo, 'Spec 001 — Titulo de 001-un-spec');
      assert.equal(specs[0].issue, 61);
      // La carpeta se sabe aunque no este: es el nombre historico, el que citan los
      // specs viejos, y por eso viaja en el mapa en vez de derivarse del titulo.
      assert.equal(specs[0].dir, '001-un-spec');
      assert.equal(specs[0].tareas, null);
      assert.match(specs[0].notas[0], /^sin hidratar: el spec vive en el issue #61/);
      assert.equal(totales.sinHidratar, 1);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  test('`sinHidratar` no aparece cuando no falta ninguno', () => {
    // Un `sinHidratar: 0` se lee como un dato y es ruido: el campo existe para avisar,
    // no para estar. Es el mismo criterio que `citas` en la tool.
    const raiz = fixture(mapaCon(entrada('001-un-spec', 'Propuesto')), { '001-un-spec': UNA_ABIERTA });
    try {
      assert.equal(readSpecStatus(raiz).totales.sinHidratar, undefined);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  test('empareja por NÚMERO, así que una cache con el slug viejo igual sirve', () => {
    // El directorio es una **cache** que se reconstruye desde el issue, y las
    // hidratadas antes de que `carpeta` existiera traen el slug derivado del titulo:
    // `001-notas-por-celda-en-orden-angular` volvia como
    // `001-asignar-cada-nota-a-una-celda-de-la`. Negarles el `tasks.md` seria tratar
    // un nombre viejo como un spec que no esta.
    //
    // Se lee igual y se DICE, que es lo que distingue "anduvo" de "anduvo de casualidad".
    const raiz = fixture(mapaCon(entrada('001-el-nombre-historico', 'Implementado')),
      { '001-el-slug-del-titulo': TODAS_HECHAS });
    try {
      const { specs } = readSpecStatus(raiz);

      assert.equal(specs.length, 1);
      assert.equal(specs[0].tareas?.total, 2);
      assert.deepEqual(specs[0].notas,
        ['la carpeta en disco se llama 001-el-slug-del-titulo y el mapa dice 001-el-nombre-historico: cache vieja, volver a hidratar']);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  test('manda el mapa, y las carpetas se cruzan contra él', () => {
    const raiz = fixture(
      mapaCon(entrada('001-con-todo', 'Implementado'), entrada('003-sin-tasks', 'Propuesto')),
      {
        '001-con-todo': UNA_ABIERTA,
        '002-sin-entrada': UNA_ABIERTA,
        '003-sin-tasks': null,
        // No empieza con digitos: no es un spec y no tiene que aparecer.
        'borrador': null,
      },
    );
    try {
      const { specs, totales } = readSpecStatus(raiz);

      // Los del mapa primero y ordenados por `NNN`; los huerfanos al final.
      assert.deepEqual(specs.map(s => s.dir), ['001-con-todo', '003-sin-tasks', '002-sin-entrada']);

      const [conTodo, sinTasks, sinEntrada] = specs;
      assert.deepEqual(conTodo.notas, []);
      assert.equal(conTodo.estado, 'Implementado');
      assert.equal(conTodo.tareas?.pendientes, 1);

      assert.deepEqual(sinTasks.notas, ['sin tasks.md']);
      assert.equal(sinTasks.tareas, null);

      // Una carpeta sin entrada es el descuido que conviene VER, no esconder: sin
      // entrada no hay issue al que llegar, o sea que ese spec no se puede hidratar.
      assert.deepEqual(sinEntrada.notas, ['sin entrada en specs/mapa.json: el spec no tiene issue al que llegar']);
      assert.equal(sinEntrada.id, '002');
      assert.equal(sinEntrada.issue, null);
      assert.equal(sinEntrada.estado, null);
      assert.equal(sinEntrada.titulo, null);
      // Se le lee el `tasks.md` igual: esta en disco, y no responderlo castigaria al
      // que pregunta por un descuido del registro.
      assert.equal(sinEntrada.tareas?.total, 2);

      // Los totales se derivan de los estados que aparecen, sin lista propia.
      assert.equal(totales.specs, 3);
      assert.equal(totales.Implementado, 1);
      assert.equal(totales['sin estado'], 1);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  test('de un spec terminal no sale trabajo, y la nota dice por que', () => {
    const raiz = fixture(
      mapaCon(entrada('001-descartado', 'Descartado'), entrada('002-superado', 'Superado')),
      { '001-descartado': UNA_ABIERTA, '002-superado': TODAS_HECHAS },
    );
    try {
      const [descartado, superado] = readSpecStatus(raiz).specs;

      // Las casillas abiertas siguen contadas —el historico no se borra— pero
      // `pendientes` va a 0 y no hay proxima: nadie le debe eso a nadie.
      assert.equal(descartado.tareas?.total, 2);
      assert.equal(descartado.tareas?.hechas, 1);
      assert.equal(descartado.tareas?.pendientes, 0);
      assert.equal(descartado.tareas?.proxima, null);
      assert.equal(descartado.tareas?.proximaId, null);
      assert.deepEqual(descartado.notas, ['Descartado: las 1 casillas abiertas son historia, no deuda']);

      // Y un terminal SIN casillas abiertas no gana una nota que no tiene que dar.
      assert.equal(superado.tareas?.pendientes, 0);
      assert.deepEqual(superado.notas, []);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  test('sin `mapa.json` NO contesta: grita', () => {
    // La diferencia con el `log.md` que reemplaza, y es la unica razon de que el
    // formato sea JSON y la lectura sin `existsSync`. `readSpecStatus` contestaba
    // «sin fila en log.md» y seguia, o sea que un registro que no estaba y un registro
    // que no decia nada se leian igual. Uno es un repo sin specs; el otro es la tool
    // rota.
    const raiz = fixture(null, { '001-huerfano': UNA_ABIERTA });
    try {
      assert.throws(() => readSpecStatus(raiz), { code: 'ENOENT' });
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });
});

/**
 * Las dos lecturas que el spec 033 le agrega al parseo, y que son lo que hoy
 * cinco skills sacan abriendo el archivo por su cuenta.
 */
const CITAS = `# Tareas — Citas y cruces

## Paso 1
- [ ] T001 Tocar \`mcp-server/src/specs.ts\` y su test \`specs.test.ts\`
- [ ] T002 [P] La regla de \`calibracion.md:21\` sobre el falso positivo
- [x] T003 \`CELL_PX\` va de 63 a 71, y el ancho de 44 → **63**
- [ ] T004 Una tarea larga que cita abajo
      en \`docs/architecture/audio.md:154\`, que el spec anterior movió de 8 → 9 ms, y sigue
- [ ] Sin ID, pero cita \`App.tsx\` igual

## Seguimiento (no bloquea)
- [ ] T005 El presupuesto pasa de 4,0 → 11,8 ms
`;

describe('parseTasks — citas', () => {
  test('saca los archivos que cada tarea nombra, con su línea cuando la trae', () => {
    const { citas } = parseTasks(CITAS);
    assert.ok(citas !== undefined);

    assert.deepEqual(citas.slice(0, 3), [
      { tarea: 'T001', archivo: 'mcp-server/src/specs.ts', linea: null },
      { tarea: 'T001', archivo: 'specs.test.ts', linea: null },
      { tarea: 'T002', archivo: 'calibracion.md', linea: 21 },
    ]);
  });

  test('un backtick que no es un archivo no es una cita', () => {
    // `CELL_PX` es el caso medido: sin la lista de extensiones entraban 1.547
    // supuestas citas donde hay 1.388.
    const archivos = parseTasks(CITAS).citas?.map(c => c.archivo) ?? [];
    assert.ok(!archivos.includes('CELL_PX'));
  });

  test('la cita de una continuación es de la tarea de arriba, no de ninguna nueva', () => {
    const cita = parseTasks(CITAS).citas?.find(c => c.archivo === 'docs/architecture/audio.md');
    assert.deepEqual(cita, { tarea: 'T004', archivo: 'docs/architecture/audio.md', linea: 154 });
  });

  test('una tarea sin ID cita igual, y la cita lo dice', () => {
    // Los specs anteriores a la convención no llevan ID y no se reescriben
    // (desviación 2): devolver `null` es decirlo, no perderlo.
    const cita = parseTasks(CITAS).citas?.find(c => c.archivo === 'App.tsx');
    assert.deepEqual(cita, { tarea: null, archivo: 'App.tsx', linea: null });
  });

  test('el falso positivo de `calibracion.md:21` se devuelve, no se filtra', () => {
    // Una tarea nombra un archivo también cuando lo que hay que hacer es
    // actualizar el doc que lo enumera. La tool devuelve el dato; filtrar por el
    // verbo es de quien lee, y por eso ese archivo sigue siendo una cita.
    const archivos = parseTasks('## X\n- [ ] T001 Agregar la fila de `pieces.ts` a `directory-structure.md`\n')
      .citas?.map(c => c.archivo);
    assert.deepEqual(archivos, ['pieces.ts', 'directory-structure.md']);
  });
});

describe('parseTasks — cruces', () => {
  test('saca los pares `X → Y` con el énfasis de markdown puesto', () => {
    // Medido sobre el repo: sin tolerar los asteriscos salen 2 pares donde hay 7,
    // y los que faltan son justo los casos testigo de `cruces.md`.
    assert.deepEqual(parseTasks(CITAS).cruces, [
      { tarea: 'T003', de: '44', a: '63' },
      { tarea: 'T005', de: '4,0', a: '11,8' },
    ]);
  });

  test('un `X → Y` en una continuación no es un cruce', () => {
    // La asimetría con las citas, y está medida: correr el patrón también sobre
    // las continuaciones da 25 pares en el repo donde hay 7. Una continuación es
    // la prosa que justifica la tarea, y sus números con flecha son frecuencias
    // (`2 → 0.6461`) o números de spec (`002 → 43`), no constantes que el spec
    // mueva. Una cita falsa hace que la skill abra el archivo para desconfiar; un
    // cruce falso le inventa una dependencia dura entre dos specs.
    assert.deepEqual(parseTasks(CITAS).cruces.filter(c => c.tarea === 'T004'), []);
  });

  test('los valores viajan como string: la coma decimal es real', () => {
    // `Number('4,0')` es NaN, y un NaN acá se lee como "no hay cruce".
    const [cruce] = parseTasks('## X\n- [ ] T001 De 0,02 → 0,05\n').cruces;
    assert.deepEqual(cruce, { tarea: 'T001', de: '0,02', a: '0,05' });
  });

  test('un `tasks.md` sin ningún cruce devuelve la lista vacía, no undefined', () => {
    assert.deepEqual(parseTasks(TASKS).cruces, []);
    assert.deepEqual(parseTasks(MARCADAS).cruces, []);
  });
});

describe('buscarSpec', () => {
  const specs = [
    { id: '033', dir: '033-el-archivo', issue: null, fecha: null, estado: null, titulo: null, tareas: null, notas: [] },
    { id: '7', dir: '007-nota-por-celda', issue: null, fecha: null, estado: null, titulo: null, tareas: null, notas: [] },
  ] satisfies SpecStatus[];

  test('lo encuentra por carpeta, por id y por número sin ceros', () => {
    assert.equal(buscarSpec(specs, '033-el-archivo')?.dir, '033-el-archivo');
    assert.equal(buscarSpec(specs, '033')?.dir, '033-el-archivo');
    assert.equal(buscarSpec(specs, '33')?.dir, '033-el-archivo');
  });

  test('el prefijo de la carpeta manda cuando el log escribió el id sin ceros', () => {
    // Pasa de verdad: la fila del log puede decir `[7]` y la carpeta `007-`. Sin
    // esta rama, pedir "007" no encuentra el spec que tiene esa carpeta.
    assert.equal(buscarSpec(specs, '007')?.dir, '007-nota-por-celda');
    assert.equal(buscarSpec(specs, '7')?.dir, '007-nota-por-celda');
  });

  test('lo que no es un spec devuelve null, no el primero', () => {
    assert.equal(buscarSpec(specs, '999'), null);
    assert.equal(buscarSpec(specs, 'el-archivo'), null);
    assert.equal(buscarSpec([], '033'), null);
  });
});

/** Con CRLF a propósito: es como están los archivos de este repo en Windows. */
const PARA_ESCRIBIR = [
  '# Tareas — Ejemplo',
  '',
  '## Paso 1',
  '- [ ] T001 La primera',
  '- [x] T002 La segunda, ya hecha',
  '  - [ ] T003 Una anidada',
  '',
  '## Seguimiento (no bloquea)',
  '- [ ] T010 Deuda anotada',
  '',
  '## Notas',
  'Prosa que no es una tarea.',
  '',
].join('\r\n');

describe('marcarTarea', () => {
  test('marca la tarea y no toca ninguna otra línea', () => {
    const r = marcarTarea(PARA_ESCRIBIR, 'T001');
    assert.ok(r.ok);
    assert.equal(r.tarea, 'T001');
    assert.equal(r.linea, 4);
    assert.equal(r.texto, 'La primera');

    // El diff de marcar una casilla tiene que ser de UNA línea: cortar por
    // `\n` y pegar por `\n` reescribiría las trece.
    const antes = PARA_ESCRIBIR.split('\r\n');
    const despues = r.md.split('\r\n');
    assert.equal(despues.length, antes.length);
    assert.deepEqual(despues.filter((l, i) => l !== antes[i]), ['- [x] T001 La primera']);
    assert.equal(r.md.length, PARA_ESCRIBIR.length);
  });

  test('llega a las anidadas, que también son tareas', () => {
    const r = marcarTarea(PARA_ESCRIBIR, 'T003');
    assert.ok(r.ok);
    assert.ok(r.md.includes('  - [x] T003 Una anidada'));
  });

  test('una tarea ya marcada FALLA en vez de decir que escribió', () => {
    // Es el modo de falla que la tool entera viene a cerrar: marcar lo que no se
    // hizo es lo que este repo acaba de arreglar en `log.md`.
    const r = marcarTarea(PARA_ESCRIBIR, 'T002');
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.motivo.includes('ya estaba marcada'));
    assert.ok(!r.ok && r.motivo.includes('linea 5'));
  });

  test('una tarea que no existe FALLA, y dice cuál', () => {
    const r = marcarTarea(PARA_ESCRIBIR, 'T900');
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.motivo.includes('T900'));
  });
});

describe('agregarSeguimiento', () => {
  test('el ID sigue contando desde el mayor del archivo entero', () => {
    // No desde el mayor de la sección ni desde el primer hueco: un ID reusado
    // rompe la referencia que otra tarea le hacía (`specs/README.md`).
    const r = agregarSeguimiento(PARA_ESCRIBIR, 'Un hallazgo');
    assert.ok(r.ok);
    assert.equal(r.tarea, 'T011');
    assert.ok(r.md.includes('- [ ] T011 Un hallazgo'));
  });

  test('nunca reusa un ID libre', () => {
    // Con T001 y T010 puestos, los ocho del medio están libres y ninguno se usa.
    const r = agregarSeguimiento('## Paso\n- [x] T001 Una\n\n## Seguimiento\n- [ ] T010 Deuda\n', 'x');
    assert.ok(r.ok);
    assert.equal(r.tarea, 'T011');
  });

  test('cae al final de la sección, no debajo del encabezado', () => {
    const r = agregarSeguimiento(PARA_ESCRIBIR, 'Un hallazgo');
    assert.ok(r.ok);
    assert.equal(r.linea, 10);
    const lineas = r.md.split('\r\n');
    assert.deepEqual(lineas.slice(7, 11), [
      '## Seguimiento (no bloquea)',
      '- [ ] T010 Deuda anotada',
      '- [ ] T011 Un hallazgo',
      '',
    ]);
    // Y el `## Notas` de abajo sigue intacto: el recorrido corta en el
    // encabezado siguiente.
    assert.ok(r.md.includes('## Notas\r\nProsa que no es una tarea.'));
  });

  test('conserva el CRLF del archivo', () => {
    const r = agregarSeguimiento(PARA_ESCRIBIR, 'Un hallazgo');
    assert.ok(r.ok);
    assert.ok(!/[^\r]\n/.test(r.md), 'no quedó ningún LF suelto');
  });

  test('una sección vacía recibe la tarea, no un segundo encabezado', () => {
    const r = agregarSeguimiento('## Paso\n- [x] T001 Una\n\n## Seguimiento (no bloquea)\n', 'Un hallazgo');
    assert.ok(r.ok);
    assert.equal(r.md.match(/## Seguimiento/g)?.length, 1);
    assert.equal(r.md, '## Paso\n- [x] T001 Una\n\n## Seguimiento (no bloquea)\n- [ ] T002 Un hallazgo\n');
  });

  test('un spec sin la sección la estrena', () => {
    // Medido: uno de los 33 —el 018— no la tiene, así que fallar ahí sería
    // negarse a anotar deuda justo donde no hay ninguna anotada.
    const r = agregarSeguimiento('## Paso\n- [x] T001 Una\n', 'Un hallazgo');
    assert.ok(r.ok);
    assert.equal(r.tarea, 'T002');
    assert.equal(r.linea, 6);
    assert.equal(r.md, '## Paso\n- [x] T001 Una\n\n## Seguimiento (no bloquea)\n\n- [ ] T002 Un hallazgo\n');
  });

  test('un archivo de una sola línea y sin salto final también', () => {
    // `partir` no encuentra ningún terminador del que copiar el estilo.
    const r = agregarSeguimiento('- [ ] T001 Sola', 'Un hallazgo');
    assert.ok(r.ok);
    assert.equal(r.md, '- [ ] T001 Sola\n\n## Seguimiento (no bloquea)\n\n- [ ] T002 Un hallazgo\n');
  });

  test('sin ninguna tarea numerada arranca en T001', () => {
    const r = agregarSeguimiento('## Paso\n- [x] Sin ID\n', 'El primero');
    assert.ok(r.ok);
    assert.equal(r.tarea, 'T001');
  });

  test('pasado T999 FALLA en vez de escribir un ID que el parser no lee', () => {
    // `parseTasks` casa `T\d{3}`: un T1000 sería invisible para la tool que lo
    // acaba de escribir, que es la peor forma de perderlo.
    const r = agregarSeguimiento('## Seguimiento\n- [ ] T999 La última\n', 'Un hallazgo');
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.motivo.includes('T999'));
  });
});

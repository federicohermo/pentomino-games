import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseLog, parseTasks } from '../specs.ts';

/**
 * Sobre strings fijos y NO sobre los archivos del repo: si estos tests leyeran
 * `specs/`, marcar una tarea rompería el build.
 */

const LOG = `# Log de Specs

| Spec | Fecha | Estado | Descripción |
|------|-------|--------|-------------|
| [001](./001-notas-por-celda/spec.md) | 2026-08-02 | Propuesto | Notas por celda |
| [002](./002-motor-de-audio/spec.md) | 2026-08-02 | Implementado | Motor propio |

## Dependencias entre specs
- **001 y 002 son ortogonales.**
`;

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

describe('parseLog', () => {
  test('saca id, carpeta, fecha, estado y descripción de cada fila', () => {
    const rows = parseLog(LOG);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], {
      id: '001', dir: '001-notas-por-celda', fecha: '2026-08-02',
      estado: 'Propuesto', descripcion: 'Notas por celda',
    });
    assert.equal(rows[1].estado, 'Implementado');
  });

  test('ignora el separador de la tabla y las listas de abajo', () => {
    // El `|------|` y las viñetas de "Dependencias" son las dos cosas que un
    // parseo por `split('|')` confundiría con filas.
    assert.equal(parseLog(LOG).length, 2);
    assert.deepEqual(parseLog('| Spec | Fecha |\n|---|---|\n'), []);
  });

  test('la carpeta sale del link, que es también el nombre de la rama', () => {
    assert.equal(parseLog(LOG)[1].dir, '002-motor-de-audio');
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
      proxima: null, proximaId: null,
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

  test('CRLF tampoco rompe la tabla del log', () => {
    assert.deepEqual(parseLog(LOG.replace(/\n/g, '\r\n')), parseLog(LOG));
  });

  test('un tasks.md sin checkboxes devuelve ceros, no falla', () => {
    assert.deepEqual(parseTasks('# Tareas\n\nTodavía nada.\n'), {
      hechas: 0, total: 0, seguimiento: 0, manual: 0, pendientes: 0,
      proxima: null, proximaId: null,
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

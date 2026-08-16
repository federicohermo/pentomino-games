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
    assert.deepEqual(t, { hechas: 2, total: 2, seguimiento: 0, proxima: null });
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
    assert.deepEqual(parseTasks('# Tareas\n\nTodavía nada.\n'),
      { hechas: 0, total: 0, seguimiento: 0, proxima: null });
  });
});

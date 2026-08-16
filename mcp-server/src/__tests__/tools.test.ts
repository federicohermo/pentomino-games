import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { tools } from '../tools/index.ts';
import { describePiece } from '../tools/describePiece.ts';
import { checkInvariants, pieceOf } from '../tools/checkInvariants.ts';
import { simulateBoard } from '../tools/simulateBoard.ts';
import { PIECE_KEYS } from '../pieces.ts';
import { CELLS_PER_PIECE } from '../../../src/domain/constants/pieces.constants.ts';
import { NOTES_PER_PIECE } from '../../../src/domain/constants/music.constants.ts';
import type { ToolDef } from '../tools/types.ts';

/**
 * Estos tests miran el FORMATO de las respuestas, que es lo unico que el server
 * aporta: las reglas del dominio ya las cubren los tests de `src/domain/`, y
 * duplicarlas aca seria duplicar tambien el criterio.
 *
 * La excepcion son los numeros del AC4 y el AC7: no verifican el dominio sino
 * que el server lo este componiendo en el orden correcto.
 */

/** Corre una tool y devuelve su respuesta ya parseada. */
function call(tool: ToolDef, args: unknown): Record<string, unknown> {
  const r = tool.run(args);
  const first = r.content?.[0];
  assert.ok(first && first.type === 'text', 'la respuesta tiene que ser texto');
  return JSON.parse(first.text) as Record<string, unknown>;
}

describe('el registro', () => {
  test('los nombres son unicos y en snake_case', () => {
    const nombres = tools.map(t => t.name);
    assert.equal(new Set(nombres).size, nombres.length);
    for (const n of nombres) assert.match(n, /^[a-z][a-z_]*$/);
  });

  test('toda tool tiene descripcion y schema', () => {
    for (const t of tools) {
      assert.ok(t.description.length > 0, t.name);
      assert.ok(t.inputSchema, t.name);
    }
  });

  test('un argumento invalido no llega al handler', () => {
    // El SDK valida antes de llamar, y `defineTool` vuelve a parsear en el borde
    // generico: por las dos vias, una pieza inexistente falla en vez de responder
    // algo plausible.
    assert.throws(() => describePiece.run({ piece: 'Q' }));
    assert.throws(() => describePiece.run({ piece: 'F', rotation: 7 }));
    assert.throws(() => describePiece.run({}));
  });
});

describe('describe_piece', () => {
  test('AC4 — Z rotada 270° y reflejada', () => {
    const r = call(describePiece, { piece: 'Z', rotation: 3, mirror: true });
    assert.deepEqual((r.notes as { name: string }[]).map(n => n.name), ['D#6', 'C#6', 'A#5', 'G#5', 'F#5']);
    assert.equal(r.anchorIndex, 1);
    assert.deepEqual(r.anchor, [1, 1]);
    assert.equal(r.ascii, '.#\n#@\n#.\n#.');
    assert.equal(r.tonic, 'B');
    assert.equal(r.retrograde, true);
  });

  test('AC5 — las 96 combinaciones dan 5 celdas y 5 notas, y ninguna falla', () => {
    for (const piece of PIECE_KEYS) {
      for (let rotation = 0; rotation < 4; rotation++) {
        for (const mirror of [false, true]) {
          const r = call(describePiece, { piece, rotation, mirror });
          const donde = `${piece} rot${rotation}${mirror ? ' mirror' : ''}`;
          assert.equal((r.cells as unknown[]).length, CELLS_PER_PIECE, donde);
          assert.equal((r.notes as unknown[]).length, NOTES_PER_PIECE, donde);
          assert.ok(r.ascii, donde);
        }
      }
    }
  });

  test('la reflexion SIEMPRE invierte las notas, en las 48 combinaciones', () => {
    for (const piece of PIECE_KEYS) {
      for (let rotation = 0; rotation < 4; rotation++) {
        const derecho = call(describePiece, { piece, rotation });
        const espejo = call(describePiece, { piece, rotation, mirror: true });
        assert.deepEqual(
          (espejo.notes as { midi: number }[]).map(n => n.midi),
          (derecho.notes as { midi: number }[]).map(n => n.midi).reverse(),
          `${piece} rot${rotation}`,
        );
      }
    }
  });

  test('y a veces no se ve: donde el espejo deja la forma igual', () => {
    // Medido, y es la trampa que advierte la descripcion de la tool: el boton
    // "Reflexion" se oye y no se ve. La lista es exacta —I y X en las cuatro
    // rotaciones, T y U en 0 y 180°— y no las seis piezas que decia el research
    // del spec: en V y W el espejo SI cambia la forma, lo que no cambia es el
    // conjunto de formas alcanzables, porque cae sobre otra rotacion.
    const invisible: Record<string, number[]> = { I: [0, 1, 2, 3], X: [0, 1, 2, 3], T: [0, 2], U: [0, 2] };

    for (const piece of PIECE_KEYS) {
      for (let rotation = 0; rotation < 4; rotation++) {
        const derecho = call(describePiece, { piece, rotation });
        const espejo = call(describePiece, { piece, rotation, mirror: true });
        const esperadoIgual = (invisible[piece] ?? []).includes(rotation);
        assert.equal(
          espejo.ascii === derecho.ascii, esperadoIgual,
          `${piece} rot${rotation}: el espejo ${esperadoIgual ? 'no deberia' : 'deberia'} cambiar la forma`,
        );
      }
    }
  });

  test('la octava corre el arpegio entero doce semitonos', () => {
    const a = call(describePiece, { piece: 'F', octave: 4 });
    const b = call(describePiece, { piece: 'F', octave: 5 });
    assert.deepEqual(
      (b.notes as { midi: number }[]).map(n => n.midi),
      (a.notes as { midi: number }[]).map(n => n.midi + 12),
    );
  });
});

describe('check_invariants', () => {
  test('AC6 — los cinco chequeos, por separado y en verde', () => {
    const r = call(checkInvariants, {});
    assert.equal(r.ok, true);
    const checks = r.checks as { name: string; ok: boolean; failures: string[] }[];
    assert.equal(checks.length, 5);
    for (const c of checks) {
      assert.equal(c.ok, true, `${c.name}: ${c.failures.join(' · ')}`);
      assert.deepEqual(c.failures, []);
    }
    // El espacio del modelo, que no es lo que recorre cada chequeo: `formas` mira
    // las 12 canonicas y `BASE_MAP` el conjunto una vez.
    assert.deepEqual(r.modelSpace, { pieces: 12, orientationsPerPiece: 8, orientations: 96 });
  });

  test('el filtro por pieza reconoce el prefijo del mensaje y deja pasar lo global', () => {
    // Es la unica pieza del server acoplada al FORMATO de los mensajes de
    // invariants.ts, y esta escrita para degradar mostrando de mas.
    assert.equal(pieceOf('Z rot3 mirror: celda 2 es (1,1)'), 'Z');
    assert.equal(pieceOf('F: tiene 4 celdas y deberia tener 5'), 'F');
    assert.equal(pieceOf('dos piezas comparten tonica'), null);
    assert.equal(pieceOf('Q: pieza inexistente'), null);
  });
});

describe('simulate_board', () => {
  test('AC7 — dos piezas en la MISMA columna se apilan', () => {
    const r = call(simulateBoard, { pieces: [{ piece: 'F', at: [2, 1] }, { piece: 'Z', at: [2, 4] }] });
    assert.deepEqual(r.onsets, { total: 20, distinctInstants: 10 });
    assert.deepEqual(r.coincident, { instants: 10, maxPerInstant: 2 });
  });

  test('AC7 — en columnas distintas se desfasan: `maxPerInstant` baja a 1', () => {
    // Es el spec 004 hecho numero, y la unica forma de verificarlo sin escuchar.
    const r = call(simulateBoard, { pieces: [{ piece: 'F', at: [2, 1] }, { piece: 'Z', at: [6, 1] }] });
    assert.deepEqual(r.onsets, { total: 20, distinctInstants: 20 });
    assert.deepEqual(r.coincident, { instants: 0, maxPerInstant: 1 });
    const fases = (r.placements as { phase: number }[]).map(p => p.phase);
    assert.deepEqual(fases, [0.2, 0.6]);
  });

  test('AC8 — fuera del tablero: invalida, con motivo y sin onsets', () => {
    const r = call(simulateBoard, { pieces: [{ piece: 'I', at: [9, 0] }] });
    const p = (r.placements as { valid: boolean; reason: string; phase?: number }[])[0];
    assert.equal(p.valid, false);
    assert.equal(p.reason, 'fuera-del-tablero');
    assert.equal(p.phase, undefined, 'una pieza que no entra no tiene posicion en el compas');
    assert.deepEqual(r.onsets, { total: 0, distinctInstants: 0 });
  });

  test('AC8 — solapada: el motivo nombra contra que pieza se choco', () => {
    const r = call(simulateBoard, { pieces: [{ piece: 'F', at: [2, 1] }, { piece: 'F', at: [2, 1] }] });
    const ps = r.placements as { id: string; valid: boolean; reason?: string }[];
    assert.equal(ps[0].valid, true);
    assert.equal(ps[1].valid, false);
    assert.equal(ps[1].reason, 'choque-con-1');
    // Solo la valida suena: 5 notas por compas, 2 compases.
    assert.equal((r.onsets as { total: number }).total, 10);
  });

  test('una jugada rechazada no deja obstaculo en el tablero', () => {
    // La segunda choca con la primera y se descarta; la tercera cae donde estaba
    // la segunda y tiene que entrar.
    const r = call(simulateBoard, {
      pieces: [{ piece: 'F', at: [2, 1] }, { piece: 'F', at: [2, 1] }, { piece: 'F', at: [7, 1] }],
    });
    assert.deepEqual((r.placements as { valid: boolean }[]).map(p => p.valid), [true, false, true]);
  });

  test('la cantidad de onsets crece con los compases y no con el tempo', () => {
    const piezas = [{ piece: 'F', at: [2, 1] }];
    const dos = call(simulateBoard, { pieces: piezas });
    const cuatro = call(simulateBoard, { pieces: piezas, bars: 4 });
    const rapido = call(simulateBoard, { pieces: piezas, bpm: 200 });

    assert.equal((dos.onsets as { total: number }).total, 10);
    assert.equal((cuatro.onsets as { total: number }).total, 20);
    assert.equal((rapido.onsets as { total: number }).total, 10);
    // El tempo estira el patron en vez de reordenarlo: el compas dura menos.
    assert.ok((rapido.barSeconds as number) < (dos.barSeconds as number));
  });

  test('la fase NO cambia cuantos onsets suenan, ni en la ultima columna', () => {
    // La regresion que estos tests no veian: todos los casos de arriba usan fases
    // <= 0.6, donde el arpegio del ultimo compas termina antes del corte. Con la
    // pieza en la columna 9 la cola cae despues, y cortar por nota en vez de por
    // onset devolvia 7 onsets en vez de 10 — la misma pieza sonando distinto
    // segun donde este, que es exactamente lo que la tool tiene que no hacer.
    const izquierda = call(simulateBoard, { pieces: [{ piece: 'I', rotation: 1, at: [1, 2] }] });
    const derecha = call(simulateBoard, { pieces: [{ piece: 'I', rotation: 1, at: [9, 2] }] });

    assert.deepEqual((derecha.placements as { phase: number }[])[0].phase, 0.9);
    assert.equal((derecha.onsets as { total: number }).total, 10);
    assert.deepEqual(derecha.onsets, izquierda.onsets);
  });

  test('tampoco a tempo rapido, donde el compas dura menos que antes el arpegio', () => {
    // A 240 bpm el compas dura 1 s y el arpegio 0,6: desde la fase 0.4 la cola se
    // pasa del limite. Es el caso extremo del schema, y tiene que dar los mismos
    // 10 onsets que a 110 bpm.
    const r = call(simulateBoard, { pieces: [{ piece: 'I', rotation: 1, at: [9, 2] }], bpm: 240 });
    assert.equal((r.onsets as { total: number }).total, 10);
  });

  test('ningun onset se emite dos veces pese al solape de ventanas', () => {
    // Los ticks son de 25 ms y el horizonte de 100 ms: sin `scheduledUntil` cada
    // onset saldria cuatro veces. Es el bug que este bucle podria reintroducir.
    const r = call(simulateBoard, { pieces: [{ piece: 'X', at: [5, 2] }], bars: 3 });
    assert.equal((r.onsets as { total: number }).total, 15);
    assert.equal((r.onsets as { distinctInstants: number }).distinctInstants, 15);
  });
});

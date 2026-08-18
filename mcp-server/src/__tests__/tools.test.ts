import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { tools } from '../tools/index.ts';
import { describePiece } from '../tools/describePiece.ts';
import { checkInvariants, pieceOf } from '../tools/checkInvariants.ts';
import { simulateBoard } from '../tools/simulateBoard.ts';
import { PIECE_KEYS } from '../pieces.ts';
import { routeBetween } from '../../../src/domain/board.ts';
import { CELLS_PER_PIECE } from '../../../src/domain/constants/pieces.constants.ts';
import { NOTES_PER_PIECE } from '../../../src/domain/constants/music.constants.ts';
import type { Cell } from '../../../src/domain/types/transform.types.ts';
import type { PlacedPiece } from '../../../src/domain/types/board.types.ts';
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

  test('AC9 — `cellMap` le pone grado y nota a cada celda, sin tocar `cells`', () => {
    // Los dos casos del AC: en X la tonica cae en la celda central, y F es la
    // pieza donde el desempate por indice decide (G4 ↔ A4 contra la referencia).
    const x = call(describePiece, { piece: 'X' });
    assert.deepEqual(x.cellMap, [
      { cell: [1, 0], degree: 4, note: 'F#5' },
      { cell: [0, 1], degree: 3, note: 'E5' },
      { cell: [1, 1], degree: 0, note: 'A4' },
      { cell: [2, 1], degree: 1, note: 'B4' },
      { cell: [1, 2], degree: 2, note: 'C#5' },
    ]);

    const f = call(describePiece, { piece: 'F' });
    assert.deepEqual(f.cellMap, [
      { cell: [0, 1], degree: 2, note: 'E4' },
      { cell: [1, 0], degree: 3, note: 'G4' },
      { cell: [1, 1], degree: 4, note: 'A4' },
      { cell: [1, 2], degree: 1, note: 'D4' },
      { cell: [2, 2], degree: 0, note: 'C4' },
    ]);

    // `cells` sigue siendo la lista de coordenadas de siempre: el campo se agrego
    // AL LADO, no encima. Es lo que el chequeo de longitud del AC5 no ve.
    assert.deepEqual(f.cells, [[0, 1], [1, 0], [1, 1], [1, 2], [2, 2]]);
  });

  test('AC12 — la reflexion invierte `notes` y NO invierte `cellMap`', () => {
    // El retrogrado es del ORDEN DE REPRODUCCION. La nota de una celda sale del
    // arpegio ascendente, asi que reflejar mueve la celda de lugar en el tablero
    // pero le deja el mismo grado. Indexar `notes` en vez de `ascending` daria
    // vuelta el mapeo justo en las 48 combinaciones con espejo.
    for (const piece of PIECE_KEYS) {
      for (let rotation = 0; rotation < 4; rotation++) {
        const derecho = call(describePiece, { piece, rotation });
        const espejo = call(describePiece, { piece, rotation, mirror: true });
        const notaPorGrado = (r: Record<string, unknown>) =>
          (r.cellMap as { degree: number; note: string }[]).map(e => `${e.degree}:${e.note}`);
        assert.deepEqual(notaPorGrado(espejo), notaPorGrado(derecho), `${piece} rot${rotation}`);
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
  /** Lo que estos tests miran de la respuesta. No es el contrato completo. */
  interface Hop {
    from: string; to: string; exit: Cell; entry: Cell; distance: number; path: Cell[];
    crossed: { cell: Cell; note: string }[];
  }
  interface Evento { at: number; kind: string; note?: string }

  const ruta = (r: Record<string, unknown>) => r.route as { order: string[]; hops: Hop[] };
  const linea = (r: Record<string, unknown>) => r.timeline as Evento[];
  const cuentas = (r: Record<string, unknown>) =>
    r.onsets as { notes: number; clicks: number; crosses: number; total: number; distinctInstants: number };
  const ciclo = (r: Record<string, unknown>) => r.cycle as { intervals: number; seconds: number };

  /**
   * Tolerancia al comparar espaciados, en segundos. Los `at` de la respuesta vienen
   * redondeados a 4 decimales, asi que un delta puede errarle hasta 2e-4; un evento
   * de mas o de menos movería el delta un intervalo entero (0,1364 s a 110 bpm), o
   * sea tres ordenes de magnitud por encima de esto.
   */
  const EPS = 1e-3;

  /** El tablero de la linea base del spec: tres piezas, saltos de 6, 5 y 4 celdas. */
  const BASE = [
    { piece: 'F', at: [1, 1] },
    { piece: 'Z', at: [7, 4] },
    { piece: 'I', rotation: 1, at: [5, 2] },
  ];

  test('AC1 — el orden es el del circuito, no el de colocacion', () => {
    // Tres `I` verticales en las columnas 0, 9 y 5, colocadas en ESE orden: el
    // recorrido las visita de izquierda a derecha (1, 3, 2) y vuelve por la
    // costura. Es la propiedad entera del spec en un caso: mover una pieza
    // reordena la musica, y el orden de colocacion no se lee en ningun lado.
    const r = call(simulateBoard, {
      pieces: [
        { piece: 'I', rotation: 1, at: [0, 2] },
        { piece: 'I', rotation: 1, at: [9, 2] },
        { piece: 'I', rotation: 1, at: [5, 2] },
      ],
    });
    assert.deepEqual(ruta(r).order, ['1', '3', '2']);
    assert.equal(ciclo(r).intervals, 32);
    // 17 cruces por ciclo, por los dos ciclos, y `onsets` los parte en MUDOS y CON
    // ALTURA: 16 + 1. Antes del spec 011 esta cuenta decia 34 clicks a secas, y uno de
    // cada 17 era en realidad una nota de la pieza que el tramo pisa — la tool los
    // reportaba como golpes sordos y la app ya los sonaba.
    assert.equal(cuentas(r).clicks, 32);
    assert.equal(cuentas(r).crosses, 2);
    assert.equal(cuentas(r).clicks + cuentas(r).crosses, 34);
    // El tramo de vuelta cruza la costura: `(9,5)` y `(0,0)` son adyacentes, asi que de
    // la columna 9 a la 0 se pasa por ahi y no dando la vuelta entera.
    //
    // `crossed` es el subconjunto de `path` que pisa una pieza (T046), y aca queda UNA
    // sola celda: `(0,0)` es la punta de la costura Y a la vez la cola de la `I` de la
    // columna 0, asi que cruzarla es el peaje que el atajo cobra. Con `CROSS_COST = 5`
    // el recorrido paga los 4 pasos extra de bajar por la columna 8 —libre— antes que
    // rozar la columna 9, y solo cede en la celda que no tiene alternativa.
    assert.deepEqual(ruta(r).hops[2], {
      from: '2', to: '1', exit: [9, 3], entry: [0, 2], distance: 9,
      path: [[8, 3], [8, 4], [8, 5], [9, 5], [0, 0], [1, 0], [1, 1], [1, 2]],
      crossed: [
        { cell: [0, 0], note: 'F#4' },
      ],
    });
  });

  test('AC7 — un salto de d celdas da d-1 clicks equiespaciados, cada uno con su celda', () => {
    const r = call(simulateBoard, { pieces: BASE });
    const hops = ruta(r).hops;
    assert.deepEqual(hops.map(h => h.distance), [6, 5, 4]);
    for (const h of hops) {
      assert.equal(h.path.length, h.distance - 1, `${h.from}->${h.to}`);
    }

    // El primer salto en la linea de tiempo: las 5 notas de la pieza 1, despues
    // sus 5 clicks, despues la primera nota de la pieza 2. Los clicks son
    // consecutivos y estan separados por un intervalo exacto — el mismo que separa
    // a las notas del arpegio.
    const eventos = linea(r);
    const clicks = eventos.slice(CELLS_PER_PIECE, CELLS_PER_PIECE + hops[0].path.length);
    // El primero es un CRUCE y no un click: el tramo sale de la pieza 1 rozando su
    // propia celda vecina, que esta ocupada. Es la distincion que el spec 011 agrega —
    // con la etiqueta vieja los cinco se veian iguales y solo uno de ellos tiene altura.
    assert.deepEqual(clicks.map(e => e.kind), ['cross', 'click', 'click', 'click', 'click']);
    assert.ok(clicks[0].note, 'el cruce lleva su nota; el click mudo no');
    assert.equal(clicks[1].note, undefined);
    assert.equal(eventos[CELLS_PER_PIECE + hops[0].path.length].kind, 'note');
    for (let i = 1; i < clicks.length; i++) {
      assert.ok(
        Math.abs(clicks[i].at - clicks[i - 1].at - (r.intervalSeconds as number)) < EPS,
        `clicks ${i - 1} y ${i}: ${clicks[i - 1].at} → ${clicks[i].at}`,
      );
    }
  });

  test('AC4 — el empalme entre dos ciclos tiene el mismo espaciado que el interior', () => {
    // El ciclo no tiene marca de inicio: el salto de la ultima pieza a la primera
    // se calcula con la misma regla que los demas. Medido de la forma mas fuerte
    // posible: el recorrido ocupa TODOS sus intervalos sin huecos, asi que la linea
    // de tiempo entera es una grilla pareja y el empalme no se distingue de
    // cualquier otro par de eventos consecutivos.
    const r = call(simulateBoard, { pieces: BASE, cycles: 2 });
    const at = linea(r).map(e => e.at);
    assert.equal(at.length, 2 * ciclo(r).intervals);
    for (let i = 1; i < at.length; i++) {
      assert.ok(
        Math.abs(at[i] - at[i - 1] - (r.intervalSeconds as number)) < EPS,
        `eventos ${i - 1} y ${i}: ${at[i - 1]} → ${at[i]}`,
      );
    }
  });

  test('los saltos reportados son los del dominio, no una segunda cuenta', () => {
    // El `exit`/`entry` sale de `gates` —la MISMA del dominio, exportada, no una copia
    // de sus tres lineas— y el `distance`/`path` sale de contar los clicks de
    // `buildSequence`. Son dos lecturas distintas del mismo salto, y este test es lo
    // que las ata: si las puertas se corrieran, el camino entre ellas dejaria de ser
    // el que suena.
    //
    // Se recorre BASE y tambien un tablero de dos piezas: el bucle es vacuo si la
    // respuesta no trae saltos, asi que sin la guarda de abajo un `hops: []` pasaria
    // por verde.
    for (const pieces of [BASE, [{ piece: 'F', at: [1, 1] }, { piece: 'Z', at: [7, 4] }]]) {
      const r = call(simulateBoard, { pieces });
      assert.ok(ruta(r).hops.length > 0, 'el tablero tiene saltos que contrastar');
      // El tablero entero entra en el contraste: desde el spec 011 la ruta entre dos
      // puertas depende de que piezas haya en el medio, asi que preguntarle al dominio
      // por el tramo sin decirle donde esta el resto compararia contra otro recorrido.
      // Las que no entran quedan afuera porque tampoco ocupan celdas.
      const tablero = (r.placements as (PlacedPiece & { valid: boolean })[]).filter(p => p.valid);
      for (const h of ruta(r).hops) {
        const donde = `${h.from}->${h.to}`;
        const tramo = routeBetween(h.exit, h.entry, tablero);
        assert.equal(tramo.steps, h.distance, donde);
        assert.deepEqual(tramo.path, h.path, donde);
      }
    }
  });

  test('con una sola pieza no hay saltos: el recorrido existe ENTRE piezas', () => {
    // La guarda que falto la primera vez, y el bug que dejo: el `map` sobre los pasos
    // sintetizaba un tramo de la pieza a si misma con `distance` fijo en 1, porque sin
    // clicks `path.length + 1` da 1. Ese 1 contradecia a las celdas que la misma
    // respuesta imprimia al lado — con la `Z` sola la distancia real de salida a
    // entrada es 3, y con la `F` es 2—, o sea que el objeto era internamente
    // inconsistente. El dominio ya decide esto devolviendo `clicks: []`.
    for (const piece of ['X', 'Z', 'I', 'F'] as const) {
      const r = call(simulateBoard, { pieces: [{ piece, at: [5, 2] }] });
      assert.deepEqual(ruta(r).order, ['1'], piece);
      assert.deepEqual(ruta(r).hops, [], piece);
      assert.equal(cuentas(r).clicks, 0, piece);
      // El ciclo igual dura: son los 5 intervalos del arpegio, no un salto.
      assert.equal(ciclo(r).intervals, CELLS_PER_PIECE, piece);
    }
  });

  test('un click puede caer sobre una celda ocupada, y en la respuesta se ve', () => {
    // Desde el spec 011 el camino YA NO ignora lo que hay en el medio: rodea cuando
    // rodear sale mas barato (`CROSS_COST` solo se paga en celda ocupada) pero
    // cruzar sigue siendo el camino mas barato en algunos tramos, y ahi el click cae
    // sobre una pieza igual. Que esas celdas salgan en la respuesta —hoy con su nota,
    // en `hops[].crossed`— es lo que permite verlo sin escuchar.
    const r = call(simulateBoard, { pieces: BASE });
    const ocupadas = new Set(
      (r.placements as { cells: Cell[] }[]).flatMap(p => p.cells).map(([x, y]) => `${x},${y}`),
    );
    const pisados = ruta(r).hops.flatMap(h => h.path).filter(([x, y]) => ocupadas.has(`${x},${y}`));
    assert.ok(pisados.length > 0, 'este tablero tiene clicks sobre celdas ocupadas');
  });

  test('T046 — el cruce sobre una pieza trae la nota que suena al pisarla', () => {
    // El caso ESTRUCTURAL del spec 011, y no su caso testigo. La celda central de la `X`
    // esta rodeada por sus propios cuatro brazos y es siempre una de sus dos puertas
    // (`research.md` §4), asi que entrar a ella cruza una celda ocupada **por mucho que
    // suba `CROSS_COST`**: es el unico tablero donde este test no puede volverse vacio en
    // silencio. El testigo `P`/`Y` no sirve aca — con peso 5 rodea y no cruza nada, o sea
    // que un test apoyado en el dejaria de probar el caso real en cuanto alguien mueve la
    // constante, que es justo lo que AC11 invita a hacer.
    //
    // `crossed` tiene que leerse de la MISMA `noteAtCell` que pinta el tablero, no de una
    // nota recalculada aca.
    const r = call(simulateBoard, {
      pieces: [
        { piece: 'X', at: [4, 2] },
        { piece: 'F', at: [3, 4] },
        { piece: 'I', at: [5, 0] },
      ],
    });
    const hops = ruta(r).hops;
    // Los dos tramos que TOCAN la `X` cruzan uno de sus brazos cada uno —el de arriba al
    // salir del centro, el de abajo al volver a el— y el tramo que no la toca no cruza
    // nada. Las dos celdas son vecinas del centro (4,2), que es la puerta rodeada.
    assert.deepEqual(hops.map(h => h.crossed.length), [0, 1, 1]);
    assert.deepEqual(hops[1].crossed, [{ cell: [4, 1], note: 'F#5' }]);
    assert.deepEqual(hops[2].crossed, [{ cell: [4, 3], note: 'C#5' }]);
  });

  test('T046 — sin cruces la lista sale vacia, nunca ausente', () => {
    // `F` en (2,1) e `I` rot 1 en (6,3): el camino mas barato entre las dos no tiene
    // por que rozar ninguna, asi que `crossed` tiene que seguir presente y en [] en
    // vez de faltar del objeto — es la propiedad que distingue "no hay cruces" de
    // "no se reporto". Verificado en los dos sentidos del salto.
    const r = call(simulateBoard, {
      pieces: [
        { piece: 'F', at: [2, 1] },
        { piece: 'I', rotation: 1, at: [6, 3] },
      ],
    });
    const hops = ruta(r).hops;
    assert.ok(hops.length > 0, 'el tablero tiene saltos que contrastar');
    for (const h of hops) {
      assert.ok(Array.isArray(h.crossed), `${h.from}->${h.to} trae crossed`);
      assert.deepEqual(h.crossed, [], `${h.from}->${h.to}`);
    }
  });

  test('AC8 — fuera del tablero: invalida, con motivo, sin puertas y sin ciclo', () => {
    const r = call(simulateBoard, { pieces: [{ piece: 'I', at: [9, 0] }] });
    const p = (r.placements as { valid: boolean; reason: string; gates?: unknown }[])[0];
    assert.equal(p.valid, false);
    assert.equal(p.reason, 'fuera-del-tablero');
    assert.equal(p.gates, undefined, 'una pieza que no entra no esta en el recorrido');
    assert.deepEqual(cuentas(r), { notes: 0, clicks: 0, crosses: 0, total: 0, distinctInstants: 0 });
    // Sin piezas validas no hay circuito, y sin circuito no hay ciclo que durar.
    assert.deepEqual(ciclo(r), { intervals: 0, seconds: 0 });
    assert.deepEqual(ruta(r), { order: [], hops: [] });
  });

  test('AC8 — solapada: el motivo nombra contra que pieza se choco', () => {
    const r = call(simulateBoard, { pieces: [{ piece: 'F', at: [2, 1] }, { piece: 'F', at: [2, 1] }] });
    const ps = r.placements as { id: string; valid: boolean; reason?: string }[];
    assert.equal(ps[0].valid, true);
    assert.equal(ps[1].valid, false);
    assert.equal(ps[1].reason, 'choque-con-1');
    // Solo la valida entra al circuito: 5 notas por ciclo, 2 ciclos. Con una pieza
    // sola el ciclo es su arpegio y nada mas — no hay tramo, porque el recorrido
    // existe entre piezas.
    assert.equal(cuentas(r).notes, 10);
    assert.deepEqual(ruta(r).order, ['1']);
  });

  test('una jugada rechazada no deja obstaculo en el tablero', () => {
    // La segunda choca con la primera y se descarta; la tercera cae donde estaba
    // la segunda y tiene que entrar.
    const r = call(simulateBoard, {
      pieces: [{ piece: 'F', at: [2, 1] }, { piece: 'F', at: [2, 1] }, { piece: 'F', at: [7, 1] }],
    });
    assert.deepEqual((r.placements as { valid: boolean }[]).map(p => p.valid), [true, false, true]);
    // Y la rechazada tampoco entra al recorrido, que es donde se notaria de mas.
    assert.deepEqual(ruta(r).order, ['1', '3']);
  });

  test('la cantidad de onsets crece con los ciclos y no con el tempo', () => {
    const piezas = [{ piece: 'F', at: [2, 1] }];
    const dos = call(simulateBoard, { pieces: piezas });
    const cuatro = call(simulateBoard, { pieces: piezas, cycles: 4 });
    const rapido = call(simulateBoard, { pieces: piezas, bpm: 200 });

    // El ciclo de una `F` sola mide 5 intervalos y NO tiene clicks: el recorrido
    // existe entre piezas, y con una sola no hay entre. Son 5 y no 4 porque las
    // cinco notas abarcan 4 intervalos, asi que con 4 la ultima nota de la vuelta
    // y la primera de la siguiente caerian en el mismo instante.
    assert.equal(ciclo(dos).intervals, 5);
    assert.equal(cuentas(dos).clicks, 0);
    assert.equal(cuentas(dos).total, 10);
    assert.equal(cuentas(cuatro).total, 20);
    assert.equal(cuentas(rapido).total, 10);
    // El tempo estira el patron en vez de reordenarlo: el ciclo mide los mismos
    // intervalos y menos segundos.
    assert.equal(ciclo(rapido).intervals, ciclo(dos).intervals);
    assert.ok(ciclo(rapido).seconds < ciclo(dos).seconds);
    assert.ok((rapido.barSeconds as number) < (dos.barSeconds as number));
    // Y el intervalo se estira con el: es `compas / 16` a cualquier tempo, no una
    // constante en segundos. A 110 bpm el compas dura 2,1818 s y el intervalo
    // 0,1364; a 200, 1,2 y 0,075.
    assert.equal(dos.intervalSeconds, 0.1364);
    assert.equal(rapido.intervalSeconds, 0.075);
  });

  test('el ciclo lo fija el tablero y no el tempo: dos tableros, dos ciclos', () => {
    // Lo que el modelo viejo no podia decir: con compases todo entraba en los
    // mismos 2 x 2,18 s con 3 piezas o con 8. Ahora la duracion es del recorrido.
    const una = call(simulateBoard, { pieces: [{ piece: 'X', at: [5, 2] }] });
    const tres = call(simulateBoard, { pieces: BASE });
    assert.equal(ciclo(una).intervals, 5);
    assert.equal(ciclo(tres).intervals, 27);
    assert.equal(ciclo(tres).seconds, 3.6818);
  });

  test('ningun onset se emite dos veces pese al solape de ventanas', () => {
    // Los ticks son de 25 ms y el horizonte de 100 ms: sin `scheduledUntil` cada
    // onset saldria cuatro veces. Es el bug que este bucle podria reintroducir.
    //
    // `distinctInstants` es lo que quedo de `coincident`, que se fue porque su
    // `maxPerInstant` daba 1 siempre: en el recorrido dos onsets no pueden
    // coincidir por construccion. Reconvertido en asercion sigue atajando las dos
    // cosas — un onset duplicado y dos eventos colisionando.
    const r = call(simulateBoard, { pieces: [{ piece: 'X', at: [5, 2] }], cycles: 3 });
    assert.equal(cuentas(r).total, 15);
    assert.equal(cuentas(r).distinctInstants, 15);
    assert.equal(cuentas(r).total, 3 * ciclo(r).intervals);
  });
});

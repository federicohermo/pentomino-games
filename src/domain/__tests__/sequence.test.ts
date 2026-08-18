import { describe, it, expect } from 'vitest';
import { buildSequence, cellsByPlayOrder } from '../sequence.ts';
import { cellsAt, isValid, cellDistance, pathBetween } from '../board.ts';
import { degreeByCellIndex, notesForRotation } from '../music.ts';
import { rotateN, reflect } from '../transform.ts';
import { SHAPES, ANCHOR_INDEX, CELLS_PER_PIECE } from '../constants/pieces.constants.ts';
import { BASE_MAP, DEFAULT_OCTAVE } from '../constants/music.constants.ts';
import type { Cell } from '../types/transform.types.ts';
import type { PieceKey } from '../types/pieces.types.ts';
import type { PlacedPiece } from '../types/board.types.ts';

const PIECES = Object.keys(SHAPES) as PieceKey[];

/**
 * La cadena de colocacion COMPLETA, igual a la de la app: rotar, reflejar si toca,
 * y bajar la celda de agarre a `(x, y)`. Se replica en vez de simplificarse porque
 * las puertas se leen por indice sobre `p.cells`, y una forma armada de otra manera
 * verificaria un mapeo que la app nunca produce.
 *
 * `notes` sale del arpegio ASCENDENTE y se invierte si la pieza esta reflejada: eso
 * es lo que hace `App.tsx` al colocar, y `buildSequence` lo copia sin volver a tocarlo.
 */
const colocar = (piece: PieceKey, rot: number, mirror: boolean, x: number, y: number): PlacedPiece => {
  const base = rotateN(SHAPES[piece], rot);
  const shape = mirror ? reflect(base) : base;
  const asc = notesForRotation(BASE_MAP[piece], DEFAULT_OCTAVE, rot);
  return {
    id: piece,
    piece,
    rotation: rot,
    mirror,
    cells: cellsAt(shape, ANCHOR_INDEX[piece], x, y),
    notes: mirror ? [...asc].reverse() : asc,
  };
};

/** Las dos puertas, derivadas afuera de `sequence.ts` para poder contrastarlas. */
const puertas = (p: PlacedPiece): { entrada: Cell; salida: Cell } => {
  const g = degreeByCellIndex(SHAPES[p.piece]);
  return { entrada: p.cells[g.indexOf(0)], salida: p.cells[g.indexOf(CELLS_PER_PIECE - 1)] };
};

const saltoEntre = (a: PlacedPiece, b: PlacedPiece): number => cellDistance(puertas(a).salida, puertas(b).entrada);

/**
 * Un teselado del tablero entero con las 12 piezas, escrito a mano.
 *
 * No sale de colocar al azar: teselar 10x6 con las 12 piezas es un exact cover, y
 * 200 intentos aleatorios dieron 0 tableros completos (`research.md` del spec 009).
 * Sus PREFIJOS son tableros validos de 1 a 12 piezas, y con eso alcanza para las
 * propiedades que hay que medir sobre muchos tableros sin meter azar en un test.
 */
const TESELADO: [PieceKey, number, boolean, number, number][] = [
  ['F', 1, true, 1, 1], ['I', 0, false, 3, 0], ['L', 1, true, 5, 1], ['P', 0, false, 8, 0],
  ['N', 3, false, 8, 2], ['Y', 3, true, 0, 4], ['Z', 0, false, 2, 3], ['U', 0, false, 6, 2],
  ['W', 2, true, 2, 4], ['T', 2, false, 4, 4], ['X', 0, false, 6, 4], ['V', 1, true, 9, 5],
];
const DOCE = TESELADO.map(([p, r, m, x, y]) => colocar(p, r, m, x, y));

/** Los 12 tableros de 1 a 12 piezas que salen de cortar el teselado. */
const PREFIJOS = DOCE.map((_, i) => DOCE.slice(0, i + 1));

describe('el teselado que usan los tests', () => {
  it('las 12 piezas entran sin pisarse y cubren las 60 celdas', () => {
    // Si esto se cae, todo lo que se mide sobre PREFIJOS mide otra cosa.
    const acumulado: PlacedPiece[] = [];
    for (const p of DOCE) {
      expect(isValid(p.cells, acumulado), p.piece).toBe(true);
      acumulado.push(p);
    }
    expect(new Set(DOCE.flatMap((p) => p.cells.map((c) => c.join(',')))).size).toBe(60);
  });
});

describe('bordes', () => {
  it('un tablero vacio no suena y su ciclo mide cero', () => {
    expect(buildSequence([])).toEqual({ steps: [], clicks: [], length: 0 });
  });

  it('con una sola pieza no hay clicks: el recorrido existe ENTRE piezas', () => {
    // Salio de escuchar, no de planificar: el plan queria cerrar el ciclo con el
    // salto de la pieza a si misma —de su salida a su entrada— y eso mete clicks
    // que caen SOBRE la propia pieza, porque `pathBetween` ignora obstaculos. Con
    // la `Z` en (0,1)(1,1)(1,0)(2,0)(3,0) daba d=3 y camino [[2,0],[1,0]]: dos
    // golpes encima del arpegio que acababa de sonar, no un recorrido.
    for (const [pieza, rot] of [['F', 0], ['Z', 0], ['I', 1], ['X', 0]] as const) {
      const sola = colocar(pieza, rot, false, 4, 2);
      const seq = buildSequence([sola]);
      expect(seq.clicks).toEqual([]);
      expect(seq.steps).toEqual([{ pieceId: pieza, offset: 0, notes: sola.notes }]);
      expect(seq.length).toBe(CELLS_PER_PIECE);
    }
  });

  it('la pieza sola se repite CONTIGUA consigo misma, sin pisarse', () => {
    // El largo es 5 y no 4 aunque las cinco notas abarquen 4 intervalos: con 4, la
    // ultima nota de una vuelta y la primera de la siguiente caerian en el mismo
    // instante. Con 5 la repeticion cae un intervalo despues de la ultima nota, que
    // es exactamente la regla que AC3 le da a dos piezas adyacentes.
    const seq = buildSequence([colocar('F', 0, false, 1, 1)]);
    const ultimaNota = seq.steps[0].offset + CELLS_PER_PIECE - 1;
    expect(seq.length - ultimaNota).toBe(1);
  });
});

describe('las puertas de una pieza', () => {
  it('la entrada es la celda del grado 0 y la salida la del grado 4', () => {
    // `F` canonica da los grados [2,3,4,1,0]: el grado 0 esta en el indice 4 y el
    // grado 4 en el indice 2. Los numeros van escritos a mano contra el mapeo del
    // spec 007 — derivarlos aca dejaria el test sin oraculo.
    expect(degreeByCellIndex(SHAPES.F)).toEqual([2, 3, 4, 1, 0]);
    const f = colocar('F', 0, false, 1, 1);
    expect(f.cells).toEqual([[0, 1], [1, 0], [1, 1], [1, 2], [2, 2]]);
    expect(puertas(f).entrada).toEqual([2, 2]);
    expect(puertas(f).salida).toEqual([1, 1]);

    // Y es lo que el circuito usa: el tramo que sale de `F` arranca en SU SALIDA,
    // no en su entrada ni en su ancla. Con una pieza sola no hay tramo —el
    // recorrido existe entre piezas—, asi que hace falta una segunda.
    const otra = colocar('P', 0, false, 7, 1);
    const seq = buildSequence([f, otra]);
    const primero = seq.steps[0].pieceId === 'F' ? f : otra;
    const segundo = primero === f ? otra : f;
    expect(seq.clicks.map((c) => c.cell).slice(0, cellDistance(puertas(primero).salida, puertas(segundo).entrada) - 1))
      .toEqual(pathBetween(puertas(primero).salida, puertas(segundo).entrada));
  });

  it('salen de la forma CANONICA: recalcularlas sobre la transformada moveria 74 de las 96 orientaciones', () => {
    // Es la trampa mas cara de esta capa. Rotar corre el origen del angulo, asi que
    // `degreeByCellIndex(formaTransformada)` compila igual y devuelve otro mapeo. El
    // conteo va medido y no aproximado para que el dia que alguien "simplifique" la
    // derivacion el test diga exactamente cuanto cambio.
    let distintas = 0;
    for (const k of PIECES) {
      for (let rot = 0; rot < 4; rot++) {
        for (const mirror of [false, true]) {
          const base = rotateN(SHAPES[k], rot);
          const shape = mirror ? reflect(base) : base;
          const p = colocar(k, rot, mirror, 5, 3);
          const naive = degreeByCellIndex(shape);
          const canonico = puertas(p);
          const recalculado = [p.cells[naive.indexOf(0)], p.cells[naive.indexOf(CELLS_PER_PIECE - 1)]];
          if (JSON.stringify([canonico.entrada, canonico.salida]) !== JSON.stringify(recalculado)) distintas++;
        }
      }
    }
    expect(distintas).toBe(74);
  });

  it('entrada y salida nunca son la misma celda, en las 96 orientaciones', () => {
    // Quien protege hoy a `pathBetween` del caso degenerado son otras dos cosas: que
    // dos piezas no se solapen —el tramo va de la salida de una a la entrada de OTRA—
    // y que con una sola pieza no haya tramo (la guarda de `n === 1` en
    // `buildSequence`). Esta propiedad es la que dejaria seguro un tramo futuro que
    // saliera y entrara por la misma pieza.
    for (const k of PIECES) {
      for (let rot = 0; rot < 4; rot++) {
        for (const mirror of [false, true]) {
          const { entrada, salida } = puertas(colocar(k, rot, mirror, 5, 3));
          expect(entrada, `${k}/${rot}/${mirror}`).not.toEqual(salida);
        }
      }
    }
  });
});

/**
 * La nota que `Board.tsx` pinta en una celda de la pieza: grado POR INDICE sobre la
 * forma canonica y el arpegio ASCENDENTE, sin retrogrado.
 *
 * Es la cadena del spec 007 replicada a mano —`occupantCellIndex` -> `degreeByCellIndex`
 * -> `notesForRotation`— y no una llamada a la pura que se esta verificando: si el
 * oraculo saliera de `cellsByPlayOrder`, el test seria una tautologia.
 */
const notaPintadaEn = (p: PlacedPiece, c: Cell): number => {
  const grados = degreeByCellIndex(SHAPES[p.piece]);
  const asc = notesForRotation(BASE_MAP[p.piece], DEFAULT_OCTAVE, p.rotation);
  const k = p.cells.findIndex((q) => q[0] === c[0] && q[1] === c[1]);
  return asc[grados[k]];
};

describe('AC11 — `cellsByPlayOrder`: la celda de cada nota', () => {
  it('`[j]` es la celda que el tablero pinta con `notes[j]`, en las 96 orientaciones', () => {
    // La propiedad que ata las dos puntas del modelo. El tablero deriva la nota de
    // una celda por GRADO sobre el arpegio ascendente (spec 007) y la secuencia las
    // reproduce en el orden de `notes`, con el retrogrado ya aplicado: si las dos
    // derivaciones no coinciden, la cabeza lectora enciende una celda y suena otra.
    // Es el bug de D9 visto desde adentro de la pieza, y esto es lo que impide que
    // vuelva.
    for (const k of PIECES) {
      for (let rot = 0; rot < 4; rot++) {
        for (const mirror of [false, true]) {
          const p = colocar(k, rot, mirror, 5, 3);
          const orden = cellsByPlayOrder(p);
          expect(orden, `${k}/${rot}/${mirror}`).toHaveLength(CELLS_PER_PIECE);
          for (let j = 0; j < CELLS_PER_PIECE; j++) {
            expect(notaPintadaEn(p, orden[j]), `${k}/${rot}/${mirror} nota ${j}`).toBe(p.notes[j]);
          }
          // Y son las cinco celdas de la pieza, sin repetir ni inventar ninguna.
          expect(new Set(orden.map((c) => c.join(','))).size).toBe(CELLS_PER_PIECE);
          expect(new Set(orden.map((c) => c.join(',')))).toEqual(new Set(p.cells.map((c) => c.join(','))));
        }
      }
    }
  });

  it('la reflexion es lo unico que la separa del orden de grado', () => {
    // Escrito aparte porque es la mitad del modelo que el 009 no miro: sin `mirror`
    // el orden de reproduccion ES el orden de grado, y con `mirror` es su reverso
    // exacto. La mitad del espacio de colocacion cae del segundo lado.
    for (const k of PIECES) {
      for (let rot = 0; rot < 4; rot++) {
        const derecha = cellsByPlayOrder(colocar(k, rot, false, 5, 3));
        const reflejada = cellsByPlayOrder(colocar(k, rot, true, 5, 3));
        const g = degreeByCellIndex(SHAPES[k]);
        const porGrado = (p: PlacedPiece) => g.map((_, d) => p.cells[g.indexOf(d)]);
        expect(derecha, `${k}/${rot}`).toEqual(porGrado(colocar(k, rot, false, 5, 3)));
        expect(reflejada, `${k}/${rot} reflejada`).toEqual([...porGrado(colocar(k, rot, true, 5, 3))].reverse());
      }
    }
  });

  it('no toca el array de celdas de la pieza', () => {
    // `reverse()` muta, y el array que se invierte tiene que ser el intermedio y
    // nunca `p.cells`: la regla del repo es no mutar lo que ya se entrego a React.
    const l = colocar('L', 0, true, 1, 1);
    const antes = JSON.stringify(l.cells);
    cellsByPlayOrder(l).reverse();
    expect(JSON.stringify(l.cells)).toBe(antes);
  });
});

/** Todas las permutaciones de `a`. Solo para la fuerza bruta de los tests. */
const permutaciones = (a: number[]): number[][] => {
  if (a.length <= 1) return [a];
  const out: number[][] = [];
  for (let i = 0; i < a.length; i++) {
    const resto = [...a.slice(0, i), ...a.slice(i + 1)];
    for (const p of permutaciones(resto)) out.push([a[i], ...p]);
  }
  return out;
};

/** Los `(n-1)!` circuitos que arrancan en la pieza 0. Todo ciclo pasa por ella. */
const circuitos = (n: number): number[][] =>
  permutaciones([...Array(n - 1).keys()].map((i) => i + 1)).map((p) => [0, ...p]);

const costoDelCircuito = (orden: number[], board: PlacedPiece[]): number =>
  orden.reduce((s, _, t) => s + saltoEntre(board[orden[t]], board[orden[(t + 1) % orden.length]]), 0);

const ordenDe = (board: PlacedPiece[]): number[] =>
  buildSequence(board).steps.map((s) => board.findIndex((p) => p.id === s.pieceId));

/**
 * AC1 — cuatro piezas donde el circuito mas corto NO es el orden de colocacion.
 *
 * Colocadas W, P, F, X; el circuito visita W, F, X, P y cuesta 17 saltos contra los
 * 22 del orden de colocacion. Es el caso concreto que hace audible la diferencia:
 * mover una pieza reordena la musica.
 */
const CUATRO = [
  colocar('W', 0, false, 6, 4),
  colocar('P', 0, false, 4, 4),
  colocar('F', 0, false, 8, 2),
  colocar('X', 0, false, 2, 2),
];

describe('AC1 — el orden es el del circuito mas corto, no el de colocacion', () => {
  it('con cuatro piezas el circuito reordena la colocacion y sale mas barato', () => {
    expect(CUATRO.every((p, i) => isValid(p.cells, CUATRO.slice(0, i)))).toBe(true);
    expect(ordenDe(CUATRO)).toEqual([0, 2, 3, 1]);
    expect(costoDelCircuito([0, 2, 3, 1], CUATRO)).toBe(17);
    expect(costoDelCircuito([0, 1, 2, 3], CUATRO)).toBe(22);
    // El ciclo son los 4 intervalos de cada pieza mas los saltos: 4x4 + 17.
    expect(buildSequence(CUATRO).length).toBe(4 * (CELLS_PER_PIECE - 1) + 17);
  });

  it('ningun otro circuito es mas corto, verificado por fuerza bruta hasta 7 piezas', () => {
    // Held-Karp contra la enumeracion completa: es lo unico que distingue "exacto" de
    // "heuristica que casi siempre acierta". Se corta en 7 porque 7! ya son 720
    // circuitos por tablero y el valor del test no crece con el octavo.
    for (const board of [CUATRO, ...PREFIJOS.slice(1, 7)]) {
      const optimo = Math.min(...circuitos(board.length).map((o) => costoDelCircuito(o, board)));
      const elegido = costoDelCircuito(ordenDe(board), board);
      expect(elegido, `${board.length} piezas`).toBe(optimo);
      expect(buildSequence(board).length).toBe(board.length * (CELLS_PER_PIECE - 1) + optimo);
    }
  });
});

describe('AC3 — dos piezas adyacentes quedan contiguas', () => {
  it('con salto 1 no hay clicks y la nota siguiente cae un intervalo despues de la ultima', () => {
    // `F` sale por (1,1) y `P` entra por (2,1); `P` sale por (3,2) y `F` entra por
    // (2,2). Los dos tramos del circuito miden 1, asi que el patron queda contiguo en
    // los dos sentidos y no hay silencio en ninguna costura.
    const f = colocar('F', 0, false, 1, 1);
    const p = colocar('P', 3, false, 3, 1);
    expect(isValid(p.cells, [f])).toBe(true);
    expect(saltoEntre(f, p)).toBe(1);
    expect(saltoEntre(p, f)).toBe(1);

    const seq = buildSequence([f, p]);
    expect(seq.clicks).toEqual([]);
    expect(seq.steps.map((s) => s.offset)).toEqual([0, CELLS_PER_PIECE]);
    // La ultima nota de `F` suena en el intervalo 4 y la primera de `P` en el 5.
    expect(seq.steps[1].offset - (seq.steps[0].offset + CELLS_PER_PIECE - 1)).toBe(1);
    expect(seq.length).toBe(2 * (CELLS_PER_PIECE - 1) + 2);
  });
});

describe('los offsets y los clicks', () => {
  it('cada pieza abarca 4 intervalos y encima se suma el salto a la siguiente', () => {
    for (const board of PREFIJOS) {
      const seq = buildSequence(board);
      const orden = ordenDe(board);
      expect(seq.steps[0].offset).toBe(0);
      for (let t = 1; t < board.length; t++) {
        const salto = saltoEntre(board[orden[t - 1]], board[orden[t]]);
        expect(seq.steps[t].offset - seq.steps[t - 1].offset).toBe(CELLS_PER_PIECE - 1 + salto);
      }
    }
  });

  it('el ciclo cierra sumando tambien el salto de la ultima pieza a la primera', () => {
    // Sin ese tramo el loop se cerraria antes de tiempo y la vuelta al principio se
    // escucharia como un corte.
    //
    // Desde `PREFIJOS[1]`: con UNA pieza no hay tramo de vuelta, porque el recorrido
    // existe entre piezas. Ese caso lo cubren los dos tests de `bordes`.
    for (const board of PREFIJOS.slice(1)) {
      const seq = buildSequence(board);
      const orden = ordenDe(board);
      const vuelta = saltoEntre(board[orden[board.length - 1]], board[orden[0]]);
      expect(seq.length).toBe(seq.steps[board.length - 1].offset + CELLS_PER_PIECE - 1 + vuelta);
      expect(seq.length).toBe(board.length * (CELLS_PER_PIECE - 1) + costoDelCircuito(orden, board));
    }
  });

  it('un salto de d deja exactamente d-1 clicks, y son las celdas del camino', () => {
    // La cantidad NO se calcula aparte: es el largo del camino. Es lo que hace
    // imposible que la celda que se dibuja y la que suena discrepen (D8).
    //
    // Desde `PREFIJOS[1]` por lo mismo que el test de arriba: con una pieza sola no
    // hay saltos, y por lo tanto tampoco clicks.
    for (const board of PREFIJOS.slice(1)) {
      const seq = buildSequence(board);
      const orden = ordenDe(board);
      const esperados: Cell[] = [];
      for (let t = 0; t < board.length; t++) {
        const desde = puertas(board[orden[t]]).salida;
        const hasta = puertas(board[orden[(t + 1) % board.length]]).entrada;
        const camino = pathBetween(desde, hasta);
        expect(camino.length).toBe(cellDistance(desde, hasta) - 1);
        esperados.push(...camino);
      }
      expect(seq.clicks.map((c) => c.cell)).toEqual(esperados);
    }
  });

  it('los clicks van estrictamente crecientes y ninguno pisa el instante de una nota', () => {
    // Sin esta garantia dos clicks podrian caer en el mismo intervalo, y el motor
    // —que solo ve el offset— los agendaria a los dos: dos veces CLICK_VELOCITY es el
    // 62 % de una nota y rompe justamente lo que D4 pide. La celda no le hace falta al
    // motor para sonar, pero es lo que permite que la garantia se verifique ACA.
    for (const board of PREFIJOS) {
      const seq = buildSequence(board);
      const notas = new Set<number>();
      for (const s of seq.steps) for (let i = 0; i < CELLS_PER_PIECE; i++) notas.add(s.offset + i);

      const offsets = seq.clicks.map((c) => c.offset);
      for (let i = 1; i < offsets.length; i++) {
        expect(offsets[i], `${board.length} piezas, click ${i}`).toBeGreaterThan(offsets[i - 1]);
      }
      for (const o of offsets) expect(notas.has(o), `click en ${o}`).toBe(false);
      // Y todo cae dentro del ciclo: nada suena despues de que el loop volvio a empezar.
      for (const o of [...offsets, ...seq.steps.map((s) => s.offset + CELLS_PER_PIECE - 1)]) {
        expect(o).toBeLessThan(seq.length);
      }
    }
  });
});

describe('las notas de cada paso', () => {
  it('van tal cual las trae la pieza: el retrogrado ya viene aplicado', () => {
    // Reflejar invierte el ORDEN EN QUE SUENAN las notas, y eso ya esta en
    // `PlacedPiece.notes`. Volver a invertir aca desharia la reflexion.
    const v = colocar('V', 0, true, 2, 2);
    const ascendente = notesForRotation(BASE_MAP.V, DEFAULT_OCTAVE, 0);
    expect(buildSequence([v]).steps[0].notes).toEqual([...ascendente].reverse());
  });

  it('no aliasa el array de la pieza', () => {
    const f = colocar('F', 0, false, 1, 1);
    const seq = buildSequence([f]);
    seq.steps[0].notes[0] = -1;
    expect(f.notes[0]).not.toBe(-1);
  });
});

describe('determinismo', () => {
  it('el mismo tablero da siempre la misma secuencia', () => {
    // Sin esto dos tableros identicos podrian sonar distinto segun como el motor de
    // JS recorrio el `for`. No hay `Math.random`, ni fecha, ni flotantes: la cuenta
    // entera es lo que lo garantiza.
    for (const board of PREFIJOS) {
      expect(buildSequence(board)).toEqual(buildSequence(board));
      expect(buildSequence([...board])).toEqual(buildSequence(board));
    }
  });

  it('ante dos circuitos de igual costo gana el de indices menores', () => {
    // Tablero medido: P, W, F dejan DOS circuitos optimos de 16 saltos, 0→1→2 y
    // 0→2→1. El desempate no es teorico aca — se ejerce, y por eso el test existe.
    const board = [
      colocar('P', 0, false, 6, 0),
      colocar('W', 0, false, 8, 4),
      colocar('F', 0, false, 4, 4),
    ];
    const costos = circuitos(3).map((o) => costoDelCircuito(o, board));
    expect(costos).toEqual([16, 16]);
    expect(ordenDe(board)).toEqual([0, 1, 2]);
  });

  it('el circuito elegido es el lexicograficamente menor entre todos los optimos', () => {
    for (const board of [CUATRO, ...PREFIJOS.slice(1, 7)]) {
      const todos = circuitos(board.length);
      const optimo = Math.min(...todos.map((o) => costoDelCircuito(o, board)));
      const lexmin = todos
        .filter((o) => costoDelCircuito(o, board) === optimo)
        .map((o) => o.join(','))
        .sort()[0];
      expect(ordenDe(board).join(','), `${board.length} piezas`).toBe(lexmin);
    }
  });
});

describe('AC10 — el tablero lleno', () => {
  it('AC10 — 12 piezas se resuelven en menos de 5 ms (mediana de 21 corridas)', () => {
    // Mediana y no una sola corrida: el margen contra los 5 ms es de pocos multiplos
    // y una pausa de GC en una maquina cargada se lo come entero. La mediana de 21
    // deja 10 corridas para que se la coman sin que el test parpadee.
    //
    // 12 es el peor caso POSIBLE, no el tipico: hay 12 pentominos libres y no se
    // repiten, asi que `O(n^2 * 2^n)` esta acotado por las reglas del juego.
    const seq = buildSequence(DOCE);
    expect(seq.steps).toHaveLength(12);

    const corridas: number[] = [];
    for (let i = 0; i < 21; i++) {
      const t0 = performance.now();
      buildSequence(DOCE);
      corridas.push(performance.now() - t0);
    }
    corridas.sort((a, b) => a - b);
    const mediana = corridas[10];
    // Se imprime a proposito: un AC de tiempo que solo dice "paso" no deja ver que el
    // margen se este comiendo. Medido en esta maquina: 0,620 ms, 8x por debajo del tope.
    console.log(`AC10 — mediana de 21 corridas con 12 piezas: ${mediana.toFixed(3)} ms`);
    expect(mediana).toBeLessThan(5);
  });
});

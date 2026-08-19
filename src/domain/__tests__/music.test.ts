import { describe, it, expect } from 'vitest';
import { angularRank, arpeggioFor, degreeByCellIndex, midiFor, midiName, notesForRotation, playOrderByCellIndex } from '../music.ts';
import { centroid, normalize, pathThroughCells, reflect, rotateN } from '../transform.ts';
import { cellsAt } from '../board.ts';
import {
  BASE_MAP, CHROMATIC, DEFAULT_OCTAVE, DEGREE_EPSILON, PENT_MAJOR, PENT_MINOR, PENT_BLUES5,
} from '../constants/music.constants.ts';
import { ANCHOR_INDEX, SHAPES } from '../constants/pieces.constants.ts';
import type { Cell } from '../types/transform.types.ts';
import type { PieceKey } from '../types/pieces.types.ts';

const PIECES = Object.keys(BASE_MAP) as PieceKey[];

describe('midiFor', () => {
  it('ancla C4 en 60', () => {
    expect(midiFor(0, 4)).toBe(60);
    expect(midiFor(9, 4)).toBe(69);   // A4
  });

  it('una octava son 12 semitonos', () => {
    expect(midiFor(0, 5) - midiFor(0, 4)).toBe(12);
  });
});

describe('midiName', () => {
  it('es la inversa de midiFor sobre las 12 clases y varias octavas', () => {
    for (let o = 0; o <= 8; o++) {
      for (let pc = 0; pc < 12; pc++) {
        expect(midiName(midiFor(pc, o))).toBe(`${CHROMATIC[pc]}${o}`);
      }
    }
  });
});

describe('notesForRotation', () => {
  it('cada rotacion usa su formula, sobre C', () => {
    const base = midiFor(0, DEFAULT_OCTAVE);
    expect(notesForRotation(0, DEFAULT_OCTAVE, 0)).toEqual(PENT_MAJOR.map(iv => base + iv));
    expect(notesForRotation(0, DEFAULT_OCTAVE, 1)).toEqual(PENT_MINOR.map(iv => base + iv));
    expect(notesForRotation(0, DEFAULT_OCTAVE, 2)).toEqual(PENT_BLUES5.map(iv => base + iv));
    expect(notesForRotation(0, DEFAULT_OCTAVE, 3)).toEqual(PENT_MAJOR.map(iv => base + iv + 7));
  });

  it('una rotacion fuera de 0..3 cae en la formula mayor', () => {
    expect(notesForRotation(0, DEFAULT_OCTAVE, 4)).toEqual(notesForRotation(0, DEFAULT_OCTAVE, 0));
  });

  it('devuelve 5 notas distintas y ascendentes para las 96 combinaciones', () => {
    for (const p of PIECES) {
      for (let rot = 0; rot < 4; rot++) {
        const ns = notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, rot);
        expect(ns).toHaveLength(5);
        expect(new Set(ns).size).toBe(5);
        for (let i = 1; i < ns.length; i++) expect(ns[i]).toBeGreaterThan(ns[i - 1]);
      }
    }
  });

  it('la nota mas grave de una pieza es su tonica', () => {
    for (const p of PIECES) {
      for (let rot = 0; rot < 4; rot++) {
        const ns = notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, rot);
        // La rotacion 3 transpone +7, asi que su grave es la quinta, no la tonica.
        const esperada = rot === 3 ? (BASE_MAP[p] + 7) % 12 : BASE_MAP[p];
        expect(ns[0] % 12).toBe(esperada);
      }
    }
  });

  it('el corrimiento de octava sube la nota en vez de envolverla', () => {
    // Z (tonica B = 11) + la sexta mayor (9) pasa de B: la nota sube de octava en
    // vez de volver al grave. Es decision de diseno, no un bug.
    const ns = notesForRotation(BASE_MAP.Z, DEFAULT_OCTAVE, 0);
    expect(ns[4] - ns[0]).toBe(9);
    expect(midiName(ns[0])).toBe('B4');
    expect(midiName(ns[4])).toBe('G#5');
  });

  it('el ambito nunca supera una decima', () => {
    for (const p of PIECES) {
      for (let rot = 0; rot < 4; rot++) {
        const ns = notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, rot);
        const ambito = ns[4] - ns[0];
        expect(ambito).toBeGreaterThanOrEqual(7);
        expect(ambito).toBeLessThanOrEqual(10);
      }
    }
  });
});

/**
 * La derivacion celda→nota completa, tal como la arma quien dibuja el tablero: el
 * grado sale de la forma CANONICA indexado por `k`, y la nota sale del arpegio
 * ASCENDENTE indexada por ese grado.
 */
const notaDeCelda = (p: PieceKey, rot: number, k: number): number =>
  notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, rot)[degreeByCellIndex(SHAPES[p])[k]];

/** Lo que mide el spec 012: cuanto se mueve el arpegio de una nota a la siguiente. */
const distanciasDelArpegio = (p: PieceKey): number[] => {
  const grados = degreeByCellIndex(SHAPES[p]);
  const orden = grados.map((_, g) => SHAPES[p][grados.indexOf(g)]);
  return orden.slice(1).map((c, i) => Math.abs(c[0] - orden[i][0]) + Math.abs(c[1] - orden[i][1]));
};

const distanciaAlCentro = (p: PieceKey, k: number) => {
  const cent = centroid(SHAPES[p]);
  return Math.hypot(SHAPES[p][k][0] - cent[0], SHAPES[p][k][1] - cent[1]);
};

/**
 * Tests de CARACTERIZACION del regimen `escala`, escritos ANTES de que existiera la
 * segunda rama (spec 017, paso 1). No describen una regla nueva: congelan la que ya
 * habia, para que romperla falle aca y no en una escucha tres pasos despues.
 *
 * Lo que congelan no son las notas —eso ya lo hace la referencia congelada del 012—
 * sino la propiedad de que rotar CONSERVA parte del material. Es justo lo que el
 * regimen `orden` no hace, asi que sin dejarla escrita la comparacion de los dos
 * regimenes no tendria contra que medirse.
 */
describe('regimen `escala` — que sobrevive a rotar (caracterizacion, spec 017)', () => {
  // 12 piezas x 3 rotaciones != 0 x 5 celdas = 180. La rotacion 0 queda afuera porque
  // es la referencia contra la que se compara, no un caso mas.
  const ROTACIONES = [1, 2, 3];

  it('AC6 — 36 de 180 celdas conservan su nota, con la descomposicion 24 / 12 / 0', () => {
    const porRotacion = ROTACIONES.map(rot =>
      PIECES.reduce((n, p) =>
        n + SHAPES[p].reduce((m, _c, k) => m + (notaDeCelda(p, rot, k) === notaDeCelda(p, 0, k) ? 1 : 0), 0), 0));

    // Las tres cifras estan EXPLICADAS y no medidas de casualidad: las formulas
    // comparten grados. `PENT_MAJOR` y `PENT_MINOR` coinciden en los grados 0 y 3
    // —2 grados x 12 piezas = 24—, `PENT_MAJOR` y `PENT_BLUES5` solo en el 0 —12—, y
    // la rotacion 3 transpone TODO +7, asi que no conserva ninguna.
    expect(porRotacion).toEqual([24, 12, 0]);
    expect(porRotacion.reduce((a, b) => a + b, 0)).toBe(36);
  });

  it('el grado 0 conserva la tonica en las rotaciones 1 y 2, y NO en la 3', () => {
    // Es la propiedad que hace que `BASE_MAP` se escuche como identidad: rotar una
    // pieza cambia su escala pero la deja anclada a su nota. La rotacion 3 es la
    // unica excepcion, y la produce la transposicion +7.
    for (const p of PIECES) {
      const tonica = notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, 0)[0];
      expect(notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, 1)[0], `${p} rot1`).toBe(tonica);
      expect(notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, 2)[0], `${p} rot2`).toBe(tonica);
      expect(notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, 3)[0], `${p} rot3`).not.toBe(tonica);
    }
  });
});

describe('degreeByCellIndex', () => {
  it('AC1 — las 12 piezas dan una permutacion de [0,1,2,3,4]', () => {
    // Permutacion y no "cinco numeros del 0 al 4": ningun grado se repite ni falta,
    // que es lo que garantiza que la pieza suene sus cinco notas y no cuatro.
    for (const p of PIECES) {
      const grados = degreeByCellIndex(SHAPES[p]);
      expect(grados).toHaveLength(5);
      expect([...grados].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it('AC1 — el arpegio recorre las 12 piezas enteras, sin pasar por encima de ninguna celda', () => {
    // El pedido del spec 012: de una nota a la siguiente se llega a una celda que se
    // TOCA con la anterior. Ortogonal donde la forma da; en diagonal en las cuatro que
    // no pueden —`F`, `T`, `Y` y `X`, cuyo grafo de celdas es un arbol con un nodo de
    // 3 o 4 vecinos—. Que la diagonal sea la excepcion y no la regla lo prueba
    // `transform.test.ts` contra fuerza bruta; aca se verifica lo que se compra.
    const diagonales: Record<string, number> = {
      F: 1, I: 0, L: 0, N: 0, P: 0, T: 1, U: 0, V: 0, W: 0, X: 2, Y: 1, Z: 0,
    };
    for (const p of PIECES) {
      const d = distanciasDelArpegio(p);
      // Manhattan 2 con celdas que se tocan es exactamente un paso en diagonal; 3 o mas
      // seria pasar por encima de algo, que es lo que ya no puede pasar.
      expect(d.filter(x => x > 1), p).toHaveLength(diagonales[p]);
      expect(d.filter(x => x > 2), p).toHaveLength(0);
    }
  });

  it('AC1 — el caso testigo: la U colocada en (7,4) se recorre sin saltar', () => {
    // La colocacion de las capturas del pedido: `U` rotada 90°, ancla en (7,4). Antes
    // del 012 la segunda nota caia en (8,5) —dos celdas mas abajo, cruzando el hueco
    // de la U— y las tres siguientes desandaban el camino.
    const cells = cellsAt(rotateN(SHAPES.U, 1), ANCHOR_INDEX.U, 7, 4);
    const grados = degreeByCellIndex(SHAPES.U);
    const orden = grados.map((_, g) => cells[grados.indexOf(g)]);
    expect(orden).toEqual([[8, 3], [7, 3], [7, 4], [7, 5], [8, 5]]);
  });

  it('D3 — en I y X el grado 0 ya NO es la celda del centroide', () => {
    // Lo revierte el spec 012 y es deliberado: en la `I` arrancar por el centro de una
    // linea de cinco obliga a un salto de 4 celdas que la forma no necesita. El grado 0
    // pasa a ser por donde el recorrido ENTRA a la pieza, no el centro de la figura.
    for (const p of ['I', 'X'] as PieceKey[]) {
      expect(distanciaAlCentro(p, 2)).toBeLessThan(DEGREE_EPSILON);
      expect(degreeByCellIndex(SHAPES[p])[2]).not.toBe(0);
    }
    // La `I` se recorre de punta a punta, que es lo que la regla vieja impedia.
    expect(degreeByCellIndex(SHAPES.I)).toEqual([4, 3, 2, 1, 0]);
  });
});

describe('D1 — que decide hoy el orden angular', () => {
  it('elige la DIRECCION del camino, y se ejerce en las 12 piezas', () => {
    // Un camino y su inverso encadenan los mismos pasos, asi que los tres primeros
    // criterios los dejan empatados SIEMPRE. Lo que rompe el empate es el rango
    // angular: gana el recorrido que arranca por la celda de rango mas chico. Con el
    // rango invertido, las 12 se recorren al reves.
    // Se mide sobre las once piezas cuyo recorrido optimo es unico salvo por la
    // direccion. La `T` queda afuera y no por comodidad: tiene DOS recorridos optimos
    // distintos —no uno y su inverso—, asi que dar vuelta el rango no la espeja, le
    // cambia el camino. Es la unica, y es la misma pieza que el criterio de la diagonal
    // movio.
    for (const p of PIECES.filter(k => k !== 'T')) {
      const derecho = degreeByCellIndex(SHAPES[p]);
      const alReves = pathThroughCells(SHAPES[p], angularRank(SHAPES[p]).map(r => 4 - r));
      expect(alReves[0], p).not.toBe(derecho.indexOf(0));
    }
  });

  it('la celda parada sobre el centroide sigue saliendo del anillo, aunque ya no gane el grado 0', () => {
    // `Math.atan2(0, 0)` devuelve `0` en silencio: sin la excepcion, la celda central
    // de `I` y `X` entraria al anillo como si estuviera al este y correria el rango de
    // todas las demas — o sea, cambiaria la direccion del recorrido.
    for (const p of ['I', 'X'] as PieceKey[]) {
      expect(angularRank(SHAPES[p])[2]).toBe(0);
    }
  });

  it('a igual angulo gana el indice menor: el desempate se ejerce en F, I y T', () => {
    // Las tres piezas con celdas colineales al centroide. El criterio esta ESCRITO en
    // el comparador y no delegado a que el `sort` sea estable — con la estabilidad
    // garantizada desde ES2019 el resultado seria el mismo, pero la regla no estaria
    // dicha en ningun lado.
    expect(angularRank(SHAPES.F)[1]).toBeLessThan(angularRank(SHAPES.F)[2]);
    expect(angularRank(SHAPES.I)[3]).toBeLessThan(angularRank(SHAPES.I)[4]);
    expect(angularRank(SHAPES.T)[3]).toBeLessThan(angularRank(SHAPES.T)[4]);
  });
});

describe('playOrderByCellIndex — el paso de cada celda', () => {
  it('sin reflexion es el grado, y con reflexion su inverso exacto', () => {
    // Es la definicion entera de la funcion, y es tambien la unica diferencia entre
    // los dos numeros por celda del modelo: el grado dice QUE nota, el paso dice
    // CUANDO. La reflexion mueve el segundo y no el primero.
    for (const p of PIECES) {
      const grados = degreeByCellIndex(SHAPES[p]);
      expect(playOrderByCellIndex(SHAPES[p], false), p).toEqual(grados);
      expect(playOrderByCellIndex(SHAPES[p], true), p).toEqual(grados.map(g => 4 - g));
    }
  });

  it('el paso 0 existe una sola vez y es una permutacion de 0..4, reflejada o no', () => {
    for (const p of PIECES) {
      for (const mirror of [false, true]) {
        const pasos = playOrderByCellIndex(SHAPES[p], mirror);
        expect([...pasos].sort(), `${p}/${mirror}`).toEqual([0, 1, 2, 3, 4]);
      }
    }
  });

  it('`arpeggioFor` indexado por PASO da la misma nota que el ascendente por GRADO', () => {
    // Las dos parejas correctas, y la razon de que no se puedan cruzar: en una pieza
    // reflejada `ascendente[paso]` daria la nota espejada. `Board.tsx` usa la segunda
    // pareja para la nota y el paso solo para el numero de la esquina; esto es lo que
    // dice que la primera habria servido igual, y que la mezcla no.
    for (const p of PIECES) {
      for (const mirror of [false, true]) {
        const grados = degreeByCellIndex(SHAPES[p]);
        const pasos = playOrderByCellIndex(SHAPES[p], mirror);
        const asc = notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, 0);
        const enOrden = arpeggioFor(p, 0, mirror);
        for (let k = 0; k < 5; k++) {
          expect(enOrden[pasos[k]], `${p}/${mirror} celda ${k}`).toBe(asc[grados[k]]);
        }
      }
    }
  });

  it('acepta formas arbitrarias, igual que `degreeByCellIndex`', () => {
    // Recibe celdas y no una `PieceKey`, y el largo sale del array: el inverso es
    // `n-1-grado` y no `4-grado`, asi que una forma de dos celdas tambien se espeja.
    // Cual de las dos es el grado 0 lo decide el anillo angular y no se hardcodea:
    // lo que esta funcion agrega es la INVERSION, y eso es lo que se mide.
    const dos: Cell[] = [[0, 0], [1, 0]];
    const g = degreeByCellIndex(dos);
    expect(playOrderByCellIndex(dos, false)).toEqual(g);
    expect(playOrderByCellIndex(dos, true)).toEqual(g.map(d => 1 - d));
    expect(playOrderByCellIndex([], false)).toEqual([]);
    expect(playOrderByCellIndex([], true)).toEqual([]);
  });
});

describe('AC3 — el mapeo se arrastra por indice sobre las 96 orientaciones', () => {
  it('la celda k de la forma transformada sigue siendo la celda k de la canonica', () => {
    // Lo que sostiene el arrastre es que `rotateN` y `reflect` son `map`, y se
    // verifica DESANDANDO la transformacion en vez de recalculando el grado: si la
    // celda k vuelve a su lugar canonico, entonces el grado calculado sobre la forma
    // canonica describe la misma celda en las 96 orientaciones.
    for (const p of PIECES) {
      const canonica = normalize(SHAPES[p]);
      for (let rot = 0; rot < 4; rot++) {
        for (const mirror of [false, true]) {
          const girada = rotateN(SHAPES[p], rot);
          const shape = mirror ? reflect(girada) : girada;
          const vuelta = rotateN(mirror ? reflect(shape) : shape, (4 - rot) % 4);
          expect(vuelta).toEqual(canonica);
        }
      }
    }
  });

  it('recalcular el grado sobre la forma ya transformada NO es equivalente: difiere en 53 de las 96', () => {
    // Rotar corre el origen del angulo, y el angulo sigue eligiendo la DIRECCION del
    // camino: por eso el recalculo sigue dando otra permutacion en mas de la mitad de
    // las orientaciones, y escribir el AC3 como
    // `degreeByCellIndex(formaTransformada) == mapeo canonico` daria un test rojo y no
    // una verificacion. Eran 75 con el orden angular del spec 007 y son 53 con el
    // camino del 012: baja porque el camino en si es invariante —rotar y reflejar
    // preservan la adyacencia— y lo unico que se mueve es por que punta se entra.
    let distintas = 0;
    for (const p of PIECES) {
      const canonico = degreeByCellIndex(SHAPES[p]).join('');
      for (let rot = 0; rot < 4; rot++) {
        for (const mirror of [false, true]) {
          const girada = rotateN(SHAPES[p], rot);
          const shape = mirror ? reflect(girada) : girada;
          if (degreeByCellIndex(shape).join('') !== canonico) distintas++;
        }
      }
    }
    expect(distintas).toBe(53);
  });
});

describe('AC5/D4 — el camino sobrevive a las 8 orientaciones', () => {
  it('las distancias del arpegio no cambian al rotar, reflejar ni trasladar', () => {
    // Es lo que hace que el mapeo pueda seguir calculandose sobre la forma canonica y
    // arrastrandose por indice: rotar, reflejar y normalizar son isometrias de la
    // grilla, asi que preservan la distancia Manhattan y con ella la adyacencia. Un
    // camino en la canonica es un camino en las 96. Si esto fallara, una pieza podria
    // recorrerse entera en una rotacion y a los saltos en otra.
    for (const p of PIECES) {
      const grados = degreeByCellIndex(SHAPES[p]);
      const canonicas = distanciasDelArpegio(p);
      for (let rot = 0; rot < 4; rot++) {
        for (const mirror of [false, true]) {
          const girada = rotateN(SHAPES[p], rot);
          const shape = mirror ? reflect(girada) : girada;
          const orden = grados.map((_, g) => shape[grados.indexOf(g)]);
          const medidas = orden.slice(1)
            .map((c, i) => Math.abs(c[0] - orden[i][0]) + Math.abs(c[1] - orden[i][1]));
          expect(medidas).toEqual(canonicas);
        }
      }
    }
  });
});

describe('AC12 — la reflexion no cambia la nota de una celda', () => {
  it('la celda de grado g muestra la nota g del arpegio ASCENDENTE, no del retrogrado', () => {
    // Reflejar invierte el ORDEN EN QUE SUENAN las notas, no cual nota le toca a cada
    // celda: por eso `notesForRotation` no recibe la reflexion y la lectura visual
    // sale siempre del arpegio ascendente. Si saliera del ya invertido, las cuatro
    // celdas de grado distinto de 2 quedarian espejadas.
    for (const p of PIECES) {
      const grados = degreeByCellIndex(SHAPES[p]);
      for (let rot = 0; rot < 4; rot++) {
        const ascendente = notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, rot);
        const retrogrado = [...ascendente].reverse();
        for (let k = 0; k < grados.length; k++) {
          expect(notaDeCelda(p, rot, k)).toBe(ascendente[grados[k]]);
          // El grado 2 es el centro del arpegio: el unico que el retrogrado deja quieto.
          if (grados[k] !== 2) expect(notaDeCelda(p, rot, k)).not.toBe(retrogrado[grados[k]]);
        }
      }
    }
  });

  it('la celda de grado 0 se queda con la nota mas grave, no con la mas aguda', () => {
    for (const p of PIECES) {
      const k = degreeByCellIndex(SHAPES[p]).indexOf(0);
      const ascendente = notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, 0);
      expect(notaDeCelda(p, 0, k)).toBe(ascendente[0]);
      expect(notaDeCelda(p, 0, k)).not.toBe(ascendente[4]);   // lo que daria el retrogrado
    }
  });
});

/**
 * AC8 — el mapeo celda→nota, congelado: rotacion 0, octava 4, sin reflejar.
 *
 * **La fuente es la tabla medida del spec 012** (`research.md` §5), no la lamina de
 * referencia del 007: el 012 cambia que celda es dueña de cada grado en 9 de las 12
 * piezas, asi que la lamina dejo de describir esto. Lo que la lamina sigue fijando —y
 * este spec no toca— es que CINCO notas tiene cada pieza; lo que cambio es cual de sus
 * celdas muestra cual.
 *
 * Los nombres siguen escritos A MANO y no derivados de correr el modelo: lo unico que
 * hace que esto sea una referencia es que no se re-derive. Lo que atrapa es lo mismo
 * de antes: que nadie mueva el mapeo sin querer.
 *
 * Las celdas van en el orden del array de `SHAPES`, que es el orden por el que se
 * indexa el mapeo — el segundo test lo verifica para atrapar una transcripcion
 * corrida.
 */
const REFERENCIA: Record<PieceKey, [Cell, string][]> = {
  F: [[[0, 1], 'C4'],  [[1, 0], 'D4'],  [[1, 1], 'E4'],  [[1, 2], 'G4'],  [[2, 2], 'A4']],
  I: [[[0, 0], 'A#4'], [[1, 0], 'G#4'], [[2, 0], 'F4'],  [[3, 0], 'D#4'], [[4, 0], 'C#4']],
  L: [[[0, 0], 'A4'],  [[0, 1], 'F#4'], [[0, 2], 'E4'],  [[0, 3], 'D4'],  [[1, 0], 'B4']],
  N: [[[0, 0], 'C5'],  [[1, 0], 'A#4'], [[1, 1], 'G4'],  [[2, 1], 'F4'],  [[3, 1], 'D#4']],
  P: [[[0, 0], 'G#4'], [[0, 1], 'F#4'], [[1, 0], 'B4'],  [[1, 1], 'E4'],  [[2, 0], 'C#5']],
  T: [[[0, 0], 'A4'],  [[1, 0], 'C5'],  [[2, 0], 'D5'],  [[1, 1], 'G4'],  [[1, 2], 'F4']],
  U: [[[0, 0], 'C#5'], [[0, 1], 'D#5'], [[1, 0], 'A#4'], [[2, 0], 'G#4'], [[2, 1], 'F#4']],
  V: [[[0, 0], 'B4'],  [[0, 1], 'A4'],  [[0, 2], 'G4'],  [[1, 0], 'D5'],  [[2, 0], 'E5']],
  W: [[[0, 0], 'F5'],  [[1, 0], 'D#5'], [[1, 1], 'C5'],  [[2, 1], 'A#4'], [[2, 2], 'G#4']],
  X: [[[1, 0], 'F#5'], [[0, 1], 'C#5'], [[1, 1], 'E5'],  [[2, 1], 'A4'],  [[1, 2], 'B4']],
  Y: [[[0, 0], 'G5'],  [[1, 0], 'F5'],  [[2, 0], 'D5'],  [[3, 0], 'C5'],  [[2, 1], 'A#4']],
  Z: [[[0, 1], 'B4'],  [[1, 1], 'C#5'], [[1, 0], 'D#5'], [[2, 0], 'F#5'], [[3, 0], 'G#5']],
};

/** La celda que lleva la tonica: la del grado 0, o sea por donde entra el recorrido. */
const TONICA_EN: Record<PieceKey, number> = {
  F: 0, I: 4, L: 3, N: 4, P: 3, T: 4, U: 4, V: 2, W: 4, X: 3, Y: 4, Z: 0,
};

describe('AC8 — la referencia congelada', () => {
  it('las 12 piezas suenan celda por celda como la tabla del spec 012', () => {
    for (const p of PIECES) {
      const leida = SHAPES[p].map((_, k) => midiName(notaDeCelda(p, 0, k)));
      expect(leida).toEqual(REFERENCIA[p].map(([, nombre]) => nombre));
    }
  });

  it('la tabla nombra las celdas en el orden del array de SHAPES', () => {
    for (const p of PIECES) {
      expect(REFERENCIA[p].map(([celda]) => celda)).toEqual(SHAPES[p]);
    }
  });

  it('la celda del grado 0 suena la tonica de la pieza', () => {
    for (const p of PIECES) {
      const k = TONICA_EN[p];
      expect(degreeByCellIndex(SHAPES[p])[k]).toBe(0);
      expect(notaDeCelda(p, 0, k) % 12).toBe(BASE_MAP[p]);
    }
  });
});

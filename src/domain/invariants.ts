import type { Cell } from './types/transform.types.ts';
import type { PieceKey } from './types/pieces.types.ts';
import { rotate90, normalize, rotateN, reflect } from './transform.ts';
import { notesForRotation } from './music.ts';
import { SHAPES, ANCHOR_INDEX } from './constants/pieces.constants.ts';
import { BASE_MAP, CHROMATIC, DEFAULT_OCTAVE } from './constants/music.constants.ts';

/**
 * Los cinco chequeos del modelo, sobre las 96 combinaciones de pieza x rotacion x
 * reflexion.
 *
 * DEVUELVEN el resultado en vez de lanzar o asertar: asi los usa igual el test de
 * este modulo y la tool `check_invariants` del spec 006, que necesita responder
 * con el detalle y no morirse.
 *
 * Lo que cubren no es cosmetico. El primero —el orden del array— es el invariante
 * que CLAUDE.md marca como el mas peligroso del repo: romperlo descoloca las
 * piezas y desfasa los loops **sin producir ningun error visible**.
 */

export interface CheckResult {
  name: string;
  ok: boolean;
  failures: string[];
}

const PIECES = Object.keys(SHAPES) as PieceKey[];
const ROTATIONS = [0, 1, 2, 3];

/**
 * Comparacion de celdas que no distingue `-0` de `0`.
 *
 * `rotate90` cruda niega la coordenada, asi que produce `-0` cuando vale 0, y
 * tanto `toEqual` como `deepStrictEqual` distinguen `-0` de `0`. Sumar 0 los
 * colapsa: `-0 + 0` es `+0`.
 */
const sameCell = (a: Cell, b: Cell): boolean => a[0] + 0 === b[0] + 0 && a[1] + 0 === b[1] + 0;

const result = (name: string, failures: string[]): CheckResult =>
  ({ name, ok: failures.length === 0, failures });

/** Aplica a una forma la misma cadena que la UI: `rotateN`, y despues el espejo. */
function transformShape(cells: Cell[], rotation: number, mirror: boolean): Cell[] {
  const r = rotateN(cells, rotation);
  return mirror ? reflect(r) : r;
}

/**
 * 1. Orden del array — la celda del indice `k` despues de transformar es la imagen
 *    de la celda `k` original.
 *
 * Se verifica reconstruyendo la transformacion **celda por celda** con la misma
 * traslacion que aplico la funcion completa: si `rotateN` filtrara, ordenara o
 * reagrupara, la celda `k` dejaria de coincidir con su imagen y el chequeo daria
 * rojo. Es la unica forma de afirmar la propiedad, porque el conjunto de celdas
 * sigue siendo el mismo aunque el orden cambie.
 */
export function checkArrayOrder(): CheckResult {
  const failures: string[] = [];
  for (const p of PIECES) {
    for (const rot of ROTATIONS) {
      for (const mirror of [false, true]) {
        const got = transformShape(SHAPES[p], rot, mirror);

        // La imagen de cada celda, sin normalizar: rotar k veces y espejar.
        let raw: Cell[] = SHAPES[p].map(([x, y]): Cell => [x, y]);
        for (let i = 0; i < rot; i++) raw = rotate90(raw);
        if (mirror) raw = raw.map(([x, y]): Cell => [-x, y]);
        const expected = normalize(raw);

        for (let k = 0; k < got.length; k++) {
          if (!sameCell(got[k], expected[k])) {
            failures.push(
              `${p} rot${rot}${mirror ? ' mirror' : ''}: celda ${k} es ` +
              `(${got[k]}) y deberia ser (${expected[k]})`,
            );
          }
        }
      }
    }
  }
  return result('orden del array', failures);
}

/**
 * 2. Ancla — `ANCHOR_INDEX[p]` esta en rango y su celda transformada es la imagen
 *    del ancla original.
 *
 * Es corolario del chequeo 1, y se verifica aparte a proposito: es la propiedad de
 * la que depende que el click caiga donde el usuario apunto, y la que el spec 004
 * reusa para leer la columna del ancla sobre `PlacedPiece.cells`.
 */
export function checkAnchors(): CheckResult {
  const failures: string[] = [];
  for (const p of PIECES) {
    const idx = ANCHOR_INDEX[p];
    if (!Number.isInteger(idx) || idx < 0 || idx >= SHAPES[p].length) {
      failures.push(`${p}: ANCHOR_INDEX ${idx} fuera de [0, ${SHAPES[p].length})`);
      continue;
    }
    for (const rot of ROTATIONS) {
      for (const mirror of [false, true]) {
        const got = transformShape(SHAPES[p], rot, mirror)[idx];

        let raw: Cell[] = SHAPES[p].map(([x, y]): Cell => [x, y]);
        for (let i = 0; i < rot; i++) raw = rotate90(raw);
        if (mirror) raw = raw.map(([x, y]): Cell => [-x, y]);
        const expected = normalize(raw)[idx];

        if (!sameCell(got, expected)) {
          failures.push(
            `${p} rot${rot}${mirror ? ' mirror' : ''}: el ancla quedo en ` +
            `(${got}) y deberia estar en (${expected})`,
          );
        }
      }
    }
  }
  return result('ancla', failures);
}

/** 3. Formas — 5 celdas, sin repetidas, conexas por lados. */
export function checkShapes(): CheckResult {
  const failures: string[] = [];
  for (const p of PIECES) {
    const cells = SHAPES[p];
    if (cells.length !== 5) failures.push(`${p}: tiene ${cells.length} celdas y deberia tener 5`);

    const keys = cells.map(([x, y]) => `${x},${y}`);
    if (new Set(keys).size !== keys.length) failures.push(`${p}: tiene celdas repetidas`);

    if (!isConnected(cells)) failures.push(`${p}: no es conexa por lados`);
  }
  return result('formas', failures);
}

/** Recorrido en anchura por vecindad de 4: las diagonales no conectan un pentomino. */
function isConnected(cells: Cell[]): boolean {
  if (cells.length === 0) return true;
  const keys = new Set(cells.map(([x, y]) => `${x},${y}`));
  const seen = new Set<string>([`${cells[0][0]},${cells[0][1]}`]);
  const queue: Cell[] = [cells[0]];

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (keys.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push([x + dx, y + dy]);
      }
    }
  }
  return seen.size === keys.size;
}

/** 4. `BASE_MAP` — biyectiva sobre las 12 clases de altura. */
export function checkBaseMap(): CheckResult {
  const failures: string[] = [];
  const pcs = PIECES.map(p => BASE_MAP[p]);

  if (pcs.length !== CHROMATIC.length) {
    failures.push(`hay ${pcs.length} piezas para ${CHROMATIC.length} clases de altura`);
  }
  if (new Set(pcs).size !== pcs.length) failures.push('dos piezas comparten tonica');
  for (const p of PIECES) {
    const pc = BASE_MAP[p];
    if (!Number.isInteger(pc) || pc < 0 || pc >= CHROMATIC.length) {
      failures.push(`${p}: tonica ${pc} fuera de [0, ${CHROMATIC.length})`);
    }
  }
  return result('BASE_MAP', failures);
}

/** 5. Notas — 5 distintas y estrictamente ascendentes ANTES del retrogrado. */
export function checkNotes(): CheckResult {
  const failures: string[] = [];
  for (const p of PIECES) {
    for (const rot of ROTATIONS) {
      const ns = notesForRotation(BASE_MAP[p], DEFAULT_OCTAVE, rot);
      if (ns.length !== 5) failures.push(`${p} rot${rot}: ${ns.length} notas y deberian ser 5`);
      if (new Set(ns).size !== ns.length) failures.push(`${p} rot${rot}: tiene notas repetidas`);
      for (let i = 1; i < ns.length; i++) {
        if (ns[i] <= ns[i - 1]) {
          failures.push(`${p} rot${rot}: la nota ${i} (${ns[i]}) no supera a la anterior (${ns[i - 1]})`);
        }
      }
    }
  }
  return result('notas', failures);
}

/** Los cinco de una. Es lo que consume la tool del spec 006. */
export function checkAll(): CheckResult[] {
  return [checkArrayOrder(), checkAnchors(), checkShapes(), checkBaseMap(), checkNotes()];
}

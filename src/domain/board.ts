import type { Cell } from './types/transform.types.ts';
import type { PlacedPiece } from './types/board.types.ts';
import type { RouteKind } from './types/sequence.types.ts';
import { GRID_W, GRID_H, SEAM } from './constants/board.constants.ts';
import { ROUTE } from './constants/route.constants.ts';

/**
 * Las reglas del tablero: donde cae una pieza, si la jugada es legal, y cuanto
 * hay —y por donde— entre dos celdas.
 *
 * Todas reciben todo por parametro en vez de cerrar sobre estado: es lo que las
 * hace testeables y lo que evita que el spec 006 tenga que reimplementar la regla
 * de colocacion en su propio modulo.
 */

/**
 * Celdas que ocuparia `shape` si su celda de agarre cae en `(x, y)`.
 *
 * Recibe `shape` ya transformada y `anchorIndex` en vez de calcularlos: quien
 * llama tiene la forma memoizada, asi que no hay que volver a rotar en cada hover.
 * El ancla sale por indice y no por busqueda gracias al invariante del orden del
 * array (ver `transform.ts`).
 *
 * `shape` entra `readonly` justamente porque viene memoizada: mutarla seria mutar
 * un valor que React ya entrego.
 */
export function cellsAt(shape: readonly Cell[], anchorIndex: number, x: number, y: number): Cell[] {
  const [ax, ay] = shape[anchorIndex];
  const ox = x - ax;
  const oy = y - ay;
  return shape.map(([cx, cy]): Cell => [cx + ox, cy + oy]);
}

/** Dentro del tablero y sin solaparse con lo ya colocado. */
export function isValid(cells: Cell[], placed: readonly PlacedPiece[]): boolean {
  if (cells.some(([x, y]) => x < 0 || y < 0 || x >= GRID_W || y >= GRID_H)) return false;
  for (const p of placed) {
    const set = new Set(p.cells.map(([x, y]) => `${x},${y}`));
    if (cells.some(([x, y]) => set.has(`${x},${y}`))) return false;
  }
  return true;
}

/**
 * La pieza que ocupa `(x, y)`, o null.
 *
 * Recorre todas las piezas y todas sus celdas, y eso esta MEDIDO desde el cierre de
 * los seguimientos del 009 y el 010, que pedian saber si aguantaba que el tablero se
 * dibujara al ritmo del intervalo: con las 12 piezas colocadas —el maximo, y el peor
 * caso porque no queda ninguna celda vacia que corte antes— un render entero del
 * tablero son 60 llamadas y **4,1 us** en total (p95 7,4 us), o sea 0,07 us por celda
 * y el 0,02 % de un cuadro de 16,7 ms. A 160 bpm el intervalo mide 93,75 ms: aunque se
 * la llamara una vez por celda y por intervalo, sobraria por cuatro ordenes de
 * magnitud.
 *
 * O sea que el indice por celda que la tarea preveia no hace falta, y el que dibuja a
 * ritmo de intervalo —la cabeza lectora del 010— igual no la usa: lee la tabla por
 * offset de `components/route-source.ts`, y no por costo sino porque tiene que dibujar
 * la ruta que suena y no la del tablero de ahora.
 */
export function occupantAt(placed: readonly PlacedPiece[], x: number, y: number): PlacedPiece | null {
  for (const p of placed) {
    if (p.cells.some(([cx, cy]) => cx === x && cy === y)) return p;
  }
  return null;
}

/**
 * Indice de `(x, y)` dentro de `p.cells`, o `-1` si `p` no ocupa esa celda.
 *
 * Hermana de `occupantAt` y no un cambio de su firma: `occupantAt` responde QUE
 * pieza, esta responde QUE celda de esa pieza, y separarlas deja intactos a los
 * que solo necesitan lo primero.
 *
 * Existe para que la derivacion celda→nota no viva adentro de `Board.tsx`. El
 * argumento no es de costo —cinco comparaciones sobre 60 celdas es irrelevante—
 * sino de cobertura: `components/` no tiene tests, asi que un `findIndex` ahi
 * adentro dejaria verificado solo por captura el unico paso del que depende lo
 * que se ve, y una captura no distingue un mapeo correcto de uno corrido en uno.
 *
 * El indice que devuelve sirve directamente contra la forma CANONICA gracias al
 * invariante del orden del array: `cells` se construye con `cellsAt`, que es un
 * `map`, asi que la celda `k` del tablero sigue siendo la celda `k` de `SHAPES`.
 */
export function occupantCellIndex(p: PlacedPiece, x: number, y: number): number {
  return p.cells.findIndex(([cx, cy]) => cx === x && cy === y);
}

/** Distancia Manhattan cruda, sin costura: el largo del tramo `direct`. */
function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

/**
 * Cual de las tres rutas conviene entre `a` y `b`, y cuanto mide.
 *
 * **Esta es la UNICA decision de ruta del modulo** (spec 009, D8): `cellDistance`
 * devuelve su `length` y `pathBetween` materializa sus celdas. No son dos
 * implementaciones que haya que atar con un test de consistencia — son dos
 * lecturas de la misma respuesta, y por eso no pueden discrepar.
 *
 * El tablero se repliega sobre si mismo: `(0,0)` y `(9,5)` son adyacentes, y eso
 * es UNA arista extra, no un toroide. Con una sola arista de mas la distancia
 * sigue teniendo forma cerrada y no hace falta BFS: o el camino no usa la costura
 * —y entonces es Manhattan— o la usa exactamente una vez, entrando por una de sus
 * dos puntas. Usarla dos veces vuelve al mismo lado pagando 2 de mas, asi que
 * nunca gana.
 *
 * Los empates se resuelven en el orden `direct`, `viaEnd`, `viaStart`, y no es
 * arbitrario de cara a `pathBetween`: quedarse con `direct` cuando empata garantiza
 * que una ruta por la costura solo se elige si es ESTRICTAMENTE mas corta, y de eso
 * depende que sus dos tramos no compartan celdas. Si compartieran una celda `c`, el
 * camino por `c` derecho ya seria mas corto que la ruta por la costura, que
 * entonces no habria ganado.
 *
 * Medido: en 10x6 ese desempate no se ejerce NUNCA — sobre los 3.600 pares no hay
 * ni uno donde `direct` empate con una ruta por la costura. Queda escrito igual
 * porque es la garantia, no la casualidad: en otra grilla los empates aparecen y la
 * propiedad de la que depende `pathBetween` tiene que seguir valiendo.
 */
function bestRoute(a: Cell, b: Cell): { length: number; via: RouteKind } {
  const [start, end] = SEAM;
  const direct = manhattan(a, b);
  const viaEnd = manhattan(a, end) + 1 + manhattan(start, b);
  const viaStart = manhattan(a, start) + 1 + manhattan(end, b);

  const length = Math.min(direct, viaEnd, viaStart);
  const via = length === direct ? ROUTE.direct
    : length === viaEnd ? ROUTE.viaEnd
    : ROUTE.viaStart;
  return { length, via };
}

/**
 * Cuantos pasos hay entre dos celdas, contando la costura.
 *
 * Con la costura la distancia maxima del tablero es 12 y no 14, y 496 de los 3.600
 * pares se acortan (13,8 %): la esquina de abajo a la derecha dejo de ser el punto
 * mas lejano de la de arriba a la izquierda y paso a ser su vecina.
 */
export function cellDistance(a: Cell, b: Cell): number {
  return bestRoute(a, b).length;
}

/**
 * El tramo recto de `from` a `to` **con las dos puntas adentro**: primero X,
 * despues Y.
 *
 * Inclusivo a proposito, y con `from === to` devuelve `[to]` y no el array vacio.
 * Ahi esta el bug que el spec midio en su implementacion de prueba: excluyendo los
 * extremos tramo por tramo, el invariante del largo se cae en 114 de los 3.600
 * pares, todos en los bordes de la costura. Devolviendo `[]` en el caso degenerado
 * la esquina —que en el camino completo es una celda intermedia legitima—
 * desaparece, y `pathBetween` queda una celda corto.
 */
function traceInclusive(from: Cell, to: Cell): Cell[] {
  const [fx, fy] = from;
  const [tx, ty] = to;
  const cells: Cell[] = [];
  const dx = Math.sign(tx - fx);
  for (let x = fx; x !== tx; x += dx) cells.push([x, fy]);
  const dy = Math.sign(ty - fy);
  for (let y = fy; y !== ty; y += dy) cells.push([tx, y]);
  cells.push([tx, ty]);
  return cells;
}

/**
 * Las celdas INTERMEDIAS del camino minimo entre `a` y `b`: no incluye ni `a` ni
 * `b`. De ahi que su largo sea siempre `cellDistance(a, b) - 1`.
 *
 * El trazo es **primero en X, despues en Y**, y cuando gana una ruta por la
 * costura: de `a` hasta la esquina que le toca, cruzar, y de la otra esquina hasta
 * `b`. La eleccion no pretende ser la correcta —entre el par mas lejano del tablero
 * hay 792 caminos minimos, y en un salto tipico de 7 celdas hay 35, todos igual de
 * validos—, sino la que se explica en una linea.
 *
 * Se arma con tramos INCLUSIVOS y se recorta por las dos puntas al final, en vez de
 * excluir extremos tramo por tramo. No es un rodeo: es lo unico que sostiene los
 * bordes de la costura, donde un tramo puede quedarse sin celdas propias porque el
 * origen YA es la esquina, o el destino ya lo es. Verificado a mano: forzar el caso
 * degenerado de `traceInclusive` a `[]` pone en rojo los cuatro tests de AC7b.
 *
 * `a === b` queda excluido: con distancia 0 no existe un camino de largo -1. No
 * ocurre en el circuito porque la salida de una pieza y la entrada de la siguiente
 * no pueden ser la misma celda si las piezas no se solapan, y la entrada y la
 * salida de una misma pieza son sus grados 0 y 4, que son celdas distintas.
 */
export function pathBetween(a: Cell, b: Cell): Cell[] {
  const [start, end] = SEAM;
  const { via } = bestRoute(a, b);
  const full = via === ROUTE.direct ? traceInclusive(a, b)
    : via === ROUTE.viaEnd ? [...traceInclusive(a, end), ...traceInclusive(start, b)]
    : [...traceInclusive(a, start), ...traceInclusive(end, b)];
  return full.slice(1, -1);
}

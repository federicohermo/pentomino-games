import type { Cell } from './types/transform.types.ts';
import type { PlacedPiece } from './types/board.types.ts';
import { GRID_W, GRID_H, SEAM, CROSS_COST } from './constants/board.constants.ts';

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

/**
 * El nodo del grafo que le toca a `(x, y)`, y su vuelta.
 *
 * `x * GRID_H + y` y no `y * GRID_W + x` a proposito: asi el id crece en el mismo
 * orden en que ordenan los pares `(x, y)`, y el desempate lexicografico de
 * `routeBetween` es una comparacion de enteros en vez de una de tuplas.
 */
function nodeOf(x: number, y: number): number {
  return x * GRID_H + y;
}

function cellOf(n: number): Cell {
  return [Math.floor(n / GRID_H), n % GRID_H];
}

/**
 * Las vecinas de `n`: las pegadas en la grilla, mas la otra punta de la costura si
 * `n` es una de las dos.
 *
 * Escribe sobre `out` y devuelve cuantas puso, en vez de armar un array. No es
 * microoptimizacion gratuita: una matriz de costos de 12 piezas son 144 llamadas a
 * `routeBetween`, y cada una la llama una vez por celda del tablero.
 *
 * El orden en que las escribe NO importa: quien desempata lo hace por id (ver
 * `routeBetween`), no por orden de aparicion.
 */
function neighborsOf(n: number, out: number[]): number {
  const x = Math.floor(n / GRID_H);
  const y = n % GRID_H;
  let k = 0;
  if (x > 0) out[k++] = n - GRID_H;
  if (x < GRID_W - 1) out[k++] = n + GRID_H;
  if (y > 0) out[k++] = n - 1;
  if (y < GRID_H - 1) out[k++] = n + 1;
  const inicio = nodeOf(SEAM[0][0], SEAM[0][1]);
  const fin = nodeOf(SEAM[1][0], SEAM[1][1]);
  if (n === inicio) out[k++] = fin;
  else if (n === fin) out[k++] = inicio;
  return k;
}

/**
 * El camino de costo minimo entre `a` y `b`, con lo que pisa en el medio.
 *
 * Reemplaza a `cellDistance` y `pathBetween` del spec 009, que eran dos lecturas de
 * la misma decision de ruta pero no miraban el tablero: el camino ignoraba las piezas
 * colocadas, asi que los clicks del recorrido caian encima de la que acababa de
 * sonar. Ahora el grafo tiene PESOS —una celda vacia cuesta 1 y una ocupada
 * `CROSS_COST` (spec 011, D1)— y las tres respuestas salen de UNA sola llamada (D3):
 * la cantidad de clicks, el instante de la nota siguiente y las celdas que se pisan
 * no pueden discrepar porque son el mismo dato leido tres veces.
 *
 * ## El costo ordena, los pasos miden el tiempo
 *
 * `steps` es `path.length + 1` y NO el costo. Un cruce cuesta `CROSS_COST` pero dura
 * UN intervalo: el costo existe para elegir entre caminos, no para contar tiempo. Si
 * se filtrara a los offsets, el ciclo se estiraria justo donde no hay nada que
 * esperar.
 *
 * ## El peso lo pagan las celdas INTERMEDIAS
 *
 * El peso se cobra al ENTRAR a una celda, y entrar a `a` o a `b` es gratis. Las dos
 * puntas son puertas de una pieza —estan ocupadas por definicion—, asi que cobrarlas
 * le sumaria el mismo `2 * (CROSS_COST - 1)` a las 144 entradas de la matriz de
 * costos sin mover ningun minimo, y de paso romperia la simetria de la distancia:
 * contando solo las intermedias, `a -> b` y `b -> a` suman sobre el MISMO conjunto de
 * celdas. De ahi tambien que `crossed` sea exactamente el subconjunto ocupado de
 * `path`, y no una lista que haya que mantener aparte.
 *
 * ## Como se elige entre los caminos que empatan (D7)
 *
 * Dijkstra por costo desde `b` para tener `dist[]`, y despues el camino se reconstruye
 * HACIA ADELANTE desde `a` tomando en cada paso la vecina que minimiza
 * `peso(v) + dist[v]`, y entre las que empatan la de id mas chico —que por como esta
 * armado el id es la lexicograficamente menor en `(x, y)`.
 *
 * Eso compara el PREFIJO ENTERO sin tener que escribirlo: al desempate solo llegan las
 * vecinas desde las que todavia queda un camino de costo minimo, asi que elegir la
 * menor en cada paso da la secuencia menor de todas. Fijar el orden de exploracion del
 * Dijkstra no alcanzaba —la primera vecina que relaja no tiene por que ser la del
 * camino que gana— y guardar el camino entero en cada nodo para compararlos, que es lo
 * que hace la implementacion de referencia contra la que se contrasta en
 * `__tests__/board.test.ts`, es cuadratico.
 *
 * ## `a === b`
 *
 * Devuelve `path: []` y `steps: 1`. Cumple el invariante del largo pero no es una
 * distancia, y queda fuera del dominio por la misma razon que en el 009: el tramo va
 * de la salida de una pieza a la entrada de OTRA, y con una sola pieza no hay tramo.
 */
export function routeBetween(a: Cell, b: Cell, placed: readonly PlacedPiece[]): { path: Cell[]; steps: number; cost: number; crossed: Cell[] } {
  const N = GRID_W * GRID_H;
  const origen = nodeOf(a[0], a[1]);
  const destino = nodeOf(b[0], b[1]);

  const ocupada = new Uint8Array(N);
  for (const p of placed) for (const [x, y] of p.cells) ocupada[nodeOf(x, y)] = 1;

  const peso = (n: number): number => n === destino ? 0 : ocupada[n] ? CROSS_COST : 1;

  // Centinela de "todavia sin alcanzar": mas caro que el camino mas caro posible —60
  // celdas ocupadas a `CROSS_COST` son 300 con el 5 de hoy, y 3.660 con el 61 que la
  // constante discute y descarta— y lejos del borde de Int32 para que sumarle un peso
  // no desborde. O sea que aguanta cualquier valor razonable sin tocarlo.
  const INF = 0x3fffffff;
  const dist = new Int32Array(N).fill(INF);
  const listo = new Uint8Array(N);
  const vecinas = [0, 0, 0, 0, 0];

  dist[destino] = 0;
  for (;;) {
    let u = -1;
    let mejor = INF;
    for (let v = 0; v < N; v++) if (!listo[v] && dist[v] < mejor) { mejor = dist[v]; u = v; }
    // El tablero es conexo, asi que `u === -1` no puede pasar; el corte que si se usa
    // es el otro: con `origen` ya cerrado, todo lo que el camino va a pisar tiene
    // `dist` menor y por lo tanto ya quedo cerrado antes.
    if (u === -1 || u === origen) break;
    listo[u] = 1;
    const k = neighborsOf(u, vecinas);
    const entrar = mejor + peso(u);
    for (let i = 0; i < k; i++) if (entrar < dist[vecinas[i]]) dist[vecinas[i]] = entrar;
  }

  const path: Cell[] = [];
  const crossed: Cell[] = [];
  let cur = origen;
  while (cur !== destino) {
    const k = neighborsOf(cur, vecinas);
    let siguiente = vecinas[0];
    let costo = peso(vecinas[0]) + dist[vecinas[0]];
    for (let i = 1; i < k; i++) {
      const v = vecinas[i];
      const c = peso(v) + dist[v];
      if (c < costo || (c === costo && v < siguiente)) { costo = c; siguiente = v; }
    }
    // Sin centinela ni guarda de "no encontre": el minimo sobre las vecinas ES
    // `dist[cur]` —es la ecuacion de Dijkstra—, y como entrar a cualquier celda que no
    // sea `destino` cuesta al menos 1, `dist` baja ESTRICTAMENTE en cada paso. El
    // recorrido termina y no puede volver sobre una celda que ya piso.
    cur = siguiente;
    if (cur !== destino) {
      const celda = cellOf(cur);
      path.push(celda);
      if (ocupada[cur]) crossed.push(celda);
    }
  }

  // `cost` sale de `dist[origen]` y no de recontar `path` y `crossed`: es EL numero que
  // el Dijkstra minimizo, no una formula que lo reproduce. Recalcularlo afuera —aunque
  // hoy `path.length + crossed.length * (CROSS_COST - 1)` de lo mismo, porque `crossed`
  // es el subconjunto ocupado de `path`— seria escribir la regla de pesos en un segundo
  // lugar, y es exactamente lo que D3 existe para evitar: sin formula cerrada, dos
  // lugares que calculan el costo no tienen nada que los obligue a coincidir.
  return { path, steps: path.length + 1, cost: dist[origen], crossed };
}

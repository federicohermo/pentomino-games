import type { Cell } from './types/transform.types.ts';
import type { PlacedPiece } from './types/board.types.ts';
import type { Step, Click, Sequence } from './types/sequence.types.ts';
import { cellDistance, pathBetween } from './board.ts';
import { degreeByCellIndex, arpeggioFor } from './music.ts';
import { SHAPES, CELLS_PER_PIECE } from './constants/pieces.constants.ts';

/**
 * El tablero como recorrido: de un conjunto de piezas colocadas a una secuencia.
 *
 * El eje X dejo de ser tiempo (spec 004). Ahora un circuito cerrado visita las
 * piezas una por una, y el tiempo lo da el ORDEN de la visita mas lo que cuesta
 * llegar de una a la siguiente. Todo es aritmetica sobre enteros —la unidad es el
 * intervalo del spec 008, una celda recorrida— porque convertir a segundos es del
 * motor: asi el mismo tablero suena siempre igual y mover el tempo estira el patron
 * en vez de reordenarlo.
 */

/**
 * Las celdas de la pieza en ORDEN DE REPRODUCCION: `[j]` es la celda donde suena la
 * nota `j` de `arpeggioFor(p.piece, p.rotation, p.mirror)`.
 *
 * El grado sale de la forma CANONICA y se lee POR INDICE:
 * `degreeByCellIndex(SHAPES[p.piece])[k]` es el grado de `p.cells[k]`, porque rotar,
 * reflejar y trasladar son `map` y la celda `k` sigue siendo la celda `k`. Correrla
 * sobre `p.cells` compila igual y devuelve otro mapeo en 74 de las 96 orientaciones,
 * porque rotar corre el origen del angulo — es la trampa mas cara de esta capa.
 *
 * El retrogrado YA VIENE APLICADO, con el mismo criterio que `arpeggioFor`: la
 * reflexion invierte el orden EN EL TIEMPO sin mover que nota le toca a que celda,
 * asi que con `mirror` la primera nota que suena es la del grado 4. Que la inversion
 * viva aca y no en el consumidor es lo que hace que `[j]` case con `notes[j]` sin que
 * nadie vuelva a invertir — es la regla que `sequence.types.ts` ya declara para
 * `Step.notes`, ahora sostenida por las dos puntas.
 *
 * Existe porque `Step` no lleva celdas: ir de la nota `j` a la celda donde se ve era
 * una derivacion que solo estaba adentro de `gates`, y para los grados 0 y 4 nada
 * mas. Es lo unico que el spec 010 le agrega al dominio, y no reabre D5 del 009: un
 * mapeo grado->celda no es un camino ni una distancia.
 */
export function cellsByPlayOrder(p: PlacedPiece): Cell[] {
  const grados = degreeByCellIndex(SHAPES[p.piece]);
  // Por GRADO y no por indice del array: `grados[k]` es el grado de `p.cells[k]`,
  // asi que el inverso —la celda del grado g— es `p.cells[grados.indexOf(g)]`.
  const porGrado = grados.map((_, g) => p.cells[grados.indexOf(g)]);
  return p.mirror ? porGrado.reverse() : porGrado;
}

/**
 * Las dos puertas de una pieza: por donde entra el recorrido y por donde sale.
 *
 * Se leen del ORDEN DE REPRODUCCION, no de los grados 0 y 4 (spec 010, D8). El 009
 * los derivaba por su cuenta y nunca miro la reflexion: con `mirror` la primera nota
 * que suena es la del grado 4, asi que entrada y salida quedaban EXACTAMENTE
 * invertidas respecto de la melodia en la mitad del espacio de colocacion. Medido
 * sobre `L`/0/reflejada en (1,1): el circuito entraba por [1,3] —el grado 0, que es
 * la ULTIMA nota— y salia por [0,0], que es la PRIMERA. El hop anterior caminaba
 * hasta pegarse a la entrada para que lo primero que sonara estuviera en la punta
 * opuesta de la pieza.
 *
 * Con UNA sola derivacion las dos no pueden discrepar, que es el mismo argumento con
 * el que el 009 hizo que la cantidad de clicks se lea del largo del camino en vez de
 * calcularse. **Cambia las distancias y por lo tanto el circuito**: todo tablero con
 * piezas reflejadas suena distinto desde este commit. Es un arreglo del 009 y no una
 * decision del 010.
 *
 * Las dos nunca son la misma celda: son dos grados distintos de la misma pieza. Hoy
 * no es lo que protege a `pathBetween` de recibir `a === b` —de eso se encargan que
 * dos piezas no se solapen, asi que la salida de una y la entrada de la siguiente
 * son celdas distintas, y la guarda de `n === 1`, porque con una sola pieza no hay
 * tramo que trazar—, pero es la propiedad que dejaria seguro cualquier tramo futuro
 * que saliera y entrara por la misma pieza.
 *
 * Exportada aunque `buildSequence` sea el unico consumidor de `src/`: `simulate_board`
 * necesita reportar las puertas de cada pieza —son lo que reemplaza a la fase en la
 * respuesta de la tool— y las tools son una fachada sobre el dominio, no una copia.
 * Sin este export, esas tres lineas quedaban escritas dos veces y podian discrepar.
 */
export function gates(p: PlacedPiece): { entrada: Cell; salida: Cell } {
  const orden = cellsByPlayOrder(p);
  // `orden[orden.length - 1]` y no `orden.at(-1)`: `at` devuelve `Cell | undefined` y
  // el tipo de retorno no admite el undefined que nunca puede pasar.
  return { entrada: orden[0], salida: orden[orden.length - 1] };
}

/**
 * El circuito dirigido mas corto que visita las `n` piezas, por Held-Karp exacto.
 *
 * Devuelve el orden de visita empezando siempre por el indice 0. El ciclo es cerrado
 * y no tiene principio, asi que fijar el arranque no pierde soluciones —todo ciclo
 * hamiltoniano pasa por el nodo 0— y ademas elimina las `n` rotaciones equivalentes
 * de un mismo recorrido, que si no habria que desempatar tambien.
 *
 * ## Por que exacto y no vecino mas cercano
 *
 * Porque el tope de `n` lo fijan las reglas del juego: hay 12 pentominos libres y no
 * se repiten, asi que `O(n^2 * 2^n)` son 12^2 x 4.096 = 590 mil operaciones en el
 * PEOR caso posible, no en el caso tipico. Medido: 1,87 ms con 12 piezas. El greedy
 * cuesta menos y da recorridos +20,1 % en promedio y +79 % en el peor caso — el
 * argumento habitual contra el TSP exacto no aplica cuando `n` esta acotado por el
 * dominio.
 *
 * ## La programacion dinamica va hacia ATRAS, y eso no es un detalle
 *
 * `g[j][mask]` = costo minimo de arrancar en `j`, visitar todo `mask` y volver al 0.
 * La formulacion habitual va hacia adelante (`dp[mask][j]` = costo de llegar a `j`
 * habiendo visitado `mask`), y con ella el desempate solo se puede resolver mirando
 * el ULTIMO tramo. Yendo hacia atras el circuito se reconstruye hacia adelante desde
 * el 0 eligiendo en cada paso el indice MAS CHICO que todavia alcanza el optimo, y
 * eso da el recorrido lexicograficamente menor entre todos los optimos. Es el
 * desempate que el spec pide —"gana el primero en orden de indice"— y sin el dos
 * tableros identicos podrian sonar distinto segun como el motor de JS recorrio el
 * `for`.
 *
 * Todo entero y sin `Math.random` ni fechas: la igualdad `costo + resto === optimo`
 * del desempate es exacta, no aproximada.
 */
function shortestCircuit(cost: readonly (readonly number[])[]): number[] {
  const n = cost.length;
  const size = 1 << n;

  // Centinela de "no alcanzable": cualquier valor mayor que el circuito mas caro
  // posible (12 piezas x distancia maxima 12 = 144) sirve, y se toma uno lejos del
  // borde de Int32 para que sumarle un tramo no desborde.
  const INF = 0x3fffffff;
  const g = new Int32Array(n * size).fill(INF);

  // `mask` recorre subconjuntos de {1..n-1}: el 0 nunca esta pendiente porque es el
  // arranque. Con `mask` vacio ya no queda nada por visitar y solo falta volver.
  for (let j = 0; j < n; j++) g[j * size] = cost[j][0];

  for (let mask = 2; mask < size; mask++) {
    if (mask & 1) continue;
    for (let j = 0; j < n; j++) {
      if ((mask >> j) & 1) continue;
      let best = INF;
      for (let k = 1; k < n; k++) {
        const bit = 1 << k;
        if (!(mask & bit)) continue;
        const c = cost[j][k] + g[k * size + (mask ^ bit)];
        if (c < best) best = c;
      }
      g[j * size + mask] = best;
    }
  }

  const order = [0];
  let cur = 0;
  // Todos los bits menos el 0: las piezas que quedan por visitar al empezar.
  let mask = size - 2;
  while (mask !== 0) {
    const objetivo = g[cur * size + mask];
    for (let k = 1; k < n; k++) {
      const bit = 1 << k;
      if (!(mask & bit)) continue;
      if (cost[cur][k] + g[k * size + (mask ^ bit)] !== objetivo) continue;
      order.push(k);
      cur = k;
      mask ^= bit;
      break;
    }
  }
  return order;
}

/**
 * La secuencia que suena un tablero: que pieza arranca en que intervalo, que celdas
 * vacias se cruzan en el camino, y cuanto dura el ciclo.
 *
 * El orden NO es el de colocacion: es el del circuito mas corto entre las puertas de
 * las piezas (AC1). Mover una pieza reordena la musica.
 *
 * ## La aritmetica de los offsets
 *
 * Cada pieza abarca `CELLS_PER_PIECE - 1` intervalos: cinco notas dejan cuatro
 * saltos entre la primera y la ultima. Si arranca en `o`, su ultima nota cae en
 * `o + 4`, sus clicks en `o + 5 ... o + 4 + (d - 1)` y la primera nota de la
 * siguiente en `o + 4 + d`, con `d` el salto entre las dos. Con `d = 1` no hay
 * clicks y la nota siguiente cae exactamente un intervalo despues de la ultima: dos
 * piezas adyacentes quedan contiguas, sin costura audible (AC3).
 *
 * El `length` cierra sumando tambien el salto de la ultima pieza a la primera, asi
 * que es `4n + suma de los saltos`. Sin ese ultimo tramo el loop se cerraria antes
 * de tiempo y el circuito dejaria de ser cerrado.
 *
 * ## Por que el salto se lee del camino y no de la distancia
 *
 * `camino.length + 1` y `cellDistance` son el mismo numero —lo garantiza `bestRoute`,
 * que es la unica decision de ruta de `board.ts`—, pero leerlo del camino es lo que
 * hace IMPOSIBLE que la cantidad de clicks y el instante de la nota siguiente
 * discrepen (D8). La cantidad de clicks no se calcula: es el largo del camino.
 */
export function buildSequence(placed: readonly PlacedPiece[]): Sequence {
  const n = placed.length;
  if (n === 0) return { steps: [], clicks: [], length: 0 };

  // Con UNA pieza no hay salto: el ciclo es su arpegio y vuelve a empezar contiguo.
  //
  // El plan de este spec decia que el ciclo era "el salto de la pieza a si misma",
  // de la salida (grado 4) a la entrada (grado 0). Se cambio DESPUES DE ESCUCHARLO:
  // con la `Z` en (0,1)(1,1)(1,0)(2,0)(3,0) ese salto mide 3 y su camino es
  // [[2,0],[1,0]], o sea que los dos clicks caen SOBRE la propia pieza que acaba de
  // sonar. No se oye un recorrido —no hay a donde ir— sino dos golpes encima del
  // arpegio. El recorrido existe ENTRE piezas; con una sola no hay entre.
  //
  // El ciclo mide `CELLS_PER_PIECE` y no `CELLS_PER_PIECE - 1`: las cinco notas
  // abarcan 4 intervalos, asi que con largo 4 la ultima nota de una vuelta y la
  // primera de la siguiente caerian en el MISMO instante. Con 5 la repeticion es
  // contigua —la nota siguiente cae un intervalo despues de la ultima—, que es la
  // misma regla que AC3 le da a dos piezas adyacentes.
  if (n === 1) {
    return {
      steps: [{ pieceId: placed[0].id, offset: 0, notes: arpeggioFor(placed[0].piece, placed[0].rotation, placed[0].mirror) }],
      clicks: [],
      length: CELLS_PER_PIECE,
    };
  }

  const puertas = placed.map(gates);
  const cost = puertas.map((desde) => puertas.map((hasta) => cellDistance(desde.salida, hasta.entrada)));
  const order = shortestCircuit(cost);

  const steps: Step[] = [];
  const clicks: Click[] = [];
  let offset = 0;

  for (let t = 0; t < n; t++) {
    const p = placed[order[t]];
    // `arpeggioFor` devuelve un array nuevo en cada llamada, asi que no hay copia
    // defensiva que hacer: `Step.notes` es mutable por contrato y no aliasa nada. La
    // copia que habia aca protegia de mutar `PlacedPiece.notes`, que ya no existe.
    steps.push({ pieceId: p.id, offset, notes: arpeggioFor(p.piece, p.rotation, p.mirror) });

    const ultima = offset + (CELLS_PER_PIECE - 1);
    const camino = pathBetween(puertas[order[t]].salida, puertas[order[(t + 1) % n]].entrada);
    for (let m = 0; m < camino.length; m++) clicks.push({ offset: ultima + 1 + m, cell: camino[m] });

    offset = ultima + camino.length + 1;
  }

  return { steps, clicks, length: offset };
}

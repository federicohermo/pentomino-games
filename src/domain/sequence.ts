import type { Cell } from './types/transform.types.ts';
import type { PlacedPiece } from './types/board.types.ts';
import type { Step, Click, Sequence } from './types/sequence.types.ts';
import type { RegimenDeRotacion } from './types/music.types.ts';
import { routeBetween, occupantAt, occupantCellIndex } from './board.ts';
import { degreeByCellIndex, playOrderByCellIndex, arpeggioFor, notesForRotation } from './music.ts';
import { SHAPES, CELLS_PER_PIECE } from './constants/pieces.constants.ts';
import { BASE_MAP, DEFAULT_OCTAVE } from './constants/music.constants.ts';

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
 * nota `j` de `arpeggioFor(p.piece, p.rotation, p.mirror, regimen)`.
 *
 * El paso sale de la forma CANONICA y se lee POR INDICE:
 * `playOrderByCellIndex(SHAPES[p.piece], p.mirror)[k]` es el paso de `p.cells[k]`,
 * porque rotar, reflejar y trasladar son `map` y la celda `k` sigue siendo la celda
 * `k`. Correrla sobre `p.cells` compila igual y devuelve otro mapeo en 74 de las 96
 * orientaciones, porque rotar corre el origen del angulo — es la trampa mas cara de
 * esta capa.
 *
 * El retrogrado YA VIENE APLICADO, con el mismo criterio que `arpeggioFor`: la
 * reflexion invierte el orden EN EL TIEMPO sin mover que nota le toca a que celda,
 * asi que con `mirror` la primera nota que suena es la del grado 4. La inversion no se
 * hace aca: la hace `playOrderByCellIndex`, que es la unica derivacion del retrogrado
 * sobre celdas del dominio y la misma que alimenta el numero que se ve en el tablero.
 * Esta funcion tenia su propio `reverse` y era la segunda copia — dos copias de una
 * regla que ademas se PINTA en pantalla es exactamente la forma de que la celda que se
 * ilumina y la que se lee digan cosas distintas.
 *
 * Que la inversion viva en el dominio y no en el consumidor es lo que hace que `[j]`
 * case con `notes[j]` sin que nadie vuelva a invertir — es la regla que
 * `sequence.types.ts` ya declara para `Step.notes`, sostenida por las dos puntas.
 *
 * Existe porque `Step` no lleva celdas: ir de la nota `j` a la celda donde se ve era
 * una derivacion que solo estaba adentro de `gates`, y para los grados 0 y 4 nada
 * mas. Es lo unico que el spec 010 le agrega al dominio, y no reabre D5 del 009: un
 * mapeo grado->celda no es un camino ni una distancia.
 */
export function cellsByPlayOrder(p: PlacedPiece): Cell[] {
  const pasos = playOrderByCellIndex(SHAPES[p.piece], p.mirror);
  // La tabla inversa: `pasos[k]` es el paso de la celda `k`, y esto es la celda de
  // cada paso. Las dos son permutaciones de `0..n-1` y confundirlas compila.
  const porPaso = new Array<Cell>(pasos.length);
  pasos.forEach((paso, k) => { porPaso[paso] = p.cells[k]; });
  return porPaso;
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
 * no es lo que protege a `routeBetween` de recibir `a === b` —de eso se encargan que
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
 * El MIDI de la celda `cell` de la pieza `p`, o `null` si `p` no la ocupa.
 *
 * Es la derivacion celda-a-nota del spec 007 convertida en pura del dominio, y no tres
 * lineas adentro de `buildSequence`: por la misma razon por la que `cellsByPlayOrder`
 * salio de adentro de `gates` en el 010 —una derivacion escondida en su unico
 * consumidor no se puede contrastar contra nada— y porque `components/Board.tsx` hace
 * exactamente esta cadena para PINTAR la nota de una celda. Si las dos se corrieran, la
 * celda diria una altura y pisarla sonaria otra.
 *
 * Las dos trampas de la cadena, que compilan igual y suenan mal:
 *
 * - El grado sale de `degreeByCellIndex(SHAPES[p.piece])` —la forma CANONICA— y viaja
 *   por INDICE. Correrla sobre `p.cells`, que ya esta rotada, reflejada y trasladada,
 *   devuelve otro mapeo en 74 de las 96 orientaciones.
 * - El arpegio es el ASCENDENTE de `notesForRotation`, y NUNCA `arpeggioFor`, que ya
 *   trae el retrogrado aplicado. El grado lee la forma al derecho: indexar con el un
 *   arpegio invertido da la nota espejada. `arpeggioFor` responde en que ORDEN suenan
 *   las notas; esta responde que nota hay en una celda, que es otra pregunta.
 *
 * Y una tercera desde el spec 017: el REGIMEN se PROPAGA, no se fija aca. De esta
 * funcion sale el `Click.note` de `clickEn`, o sea la altura que suena al CRUZAR una
 * celda ocupada, y tambien el `crossed` que reporta `simulate_board`. Si se quedara en
 * `escala` mientras la pieza toca `orden`, la celda diria una altura y pisarla sonaria
 * otra en 36 de 48 combinaciones — que es exactamente el bug que este docblock existe
 * para prevenir. `tsc` obliga a tocar la linea pero no dice cual es la respuesta.
 */
export function noteAtCell(p: PlacedPiece, cell: Cell, regimen: RegimenDeRotacion): number | null {
  const k = occupantCellIndex(p, cell[0], cell[1]);
  if (k < 0) return null;
  const ascendente = notesForRotation(BASE_MAP[p.piece], DEFAULT_OCTAVE, p.rotation, regimen);
  return ascendente[degreeByCellIndex(SHAPES[p.piece])[k]];
}

/**
 * El click de una celda del camino: con altura si hay una pieza abajo, sin ella si la
 * celda esta vacia.
 *
 * Que `note` FALTE es lo que dice "vacia", asi que no hay un `note: null` intermedio
 * que alguien pueda leer como un tercer estado (ver `Click`).
 */
function clickEn(offset: number, celda: Cell, placed: readonly PlacedPiece[], regimen: RegimenDeRotacion): Click {
  const ocupante = occupantAt(placed, celda[0], celda[1]);
  const nota = ocupante === null ? null : noteAtCell(ocupante, celda, regimen);
  return nota === null ? { offset, cell: celda } : { offset, cell: celda, note: nota };
}

/**
 * La base con la que `claveDeTramo` empaqueta costo y pasos en un entero.
 *
 * **Tiene que ser mayor que la SUMA de los pasos del circuito entero, no que los de un
 * tramo.** Held-Karp suma claves y compara sumas, asi que lo que no puede acarrear al
 * campo del costo es el total: 12 tramos de a lo sumo 60 pasos —el tablero tiene 60
 * celdas y un camino no repite ninguna— dan 720. De ahi 1024, la potencia de dos que lo
 * pasa con margen.
 *
 * Achicarlo a 60 "porque ningun tramo mide mas" es el error que este docblock existe
 * para evitar: el acarreo no falla ruidosamente, ordena mal el circuito y el tablero
 * suena distinto sin que nada se ponga en rojo.
 */
const PASOS_MAX = 1024;

/**
 * La clave con la que Held-Karp compara dos tramos: **primero el costo, y a igual
 * costo los PASOS**.
 *
 * ## Por que hacen falta dos criterios y no alcanza con el costo
 *
 * Hasta el spec 011 el costo de un tramo ERA su cantidad de pasos, asi que empatar en
 * costo era empatar en duracion y desempatar por indice no cambiaba nada de lo que se
 * oia. El peso rompio esa identidad: un cruce cuesta `CROSS_COST` pero sigue durando UN
 * intervalo, asi que dos circuitos pueden costar lo mismo y durar distinto.
 *
 * Medido sobre el tablero `U`(2,0) `T`(4,2) `I`(7,2) `W`(7,4) `F`(3,4): los circuitos
 * `U>T>F>I>W` y `U>W>I>T>F` cuestan **los dos 24**, pero miden **17 y 21 pasos**. Sin
 * este criterio gana el de indice menor, y el indice es el ORDEN DE COLOCACION — o sea
 * que el mismo tablero sonaba con un ciclo de 37 o de 41 intervalos segun en que orden
 * se hubieran puesto las piezas. Sobre 120 tableros de 5 piezas pasaba en el 8,3 %.
 *
 * Eso contradecia lo que el 009 promete y el 011 no queria tocar: **el recorrido lo
 * decide la geometria**. Con los pasos como segundo criterio la eleccion vuelve a ser
 * geometrica, y ademas es la correcta musicalmente: a igual costo, el ciclo mas corto.
 *
 * El indice sigue siendo el TERCER criterio, y ahi si es inofensivo: dos circuitos que
 * empatan en costo Y en pasos duran lo mismo, asi que cual gane no cambia el ritmo.
 *
 * Se empaquetan en un entero en vez de comparar pares porque Held-Karp suma tramos y
 * compara sumas: con `costo * PASOS_MAX + pasos` la suma de claves ordena igual que
 * comparar (suma de costos, suma de pasos) en ese orden, **siempre que la suma de pasos
 * no llegue a `PASOS_MAX`**. Con 12 tramos de a lo sumo 60 pasos el maximo es 720, asi
 * que no puede acarrear. Todo entero, asi que la igualdad exacta del desempate de la
 * reconstruccion sigue siendo exacta y no aproximada.
 */
function claveDeTramo(r: { cost: number; steps: number }): number {
  return r.cost * PASOS_MAX + r.steps;
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
  // posible sirve. Con la clave de `claveDeTramo` el techo es 12 tramos x (costo
  // maximo 300 x PASOS_MAX + 60) = 3,7 millones, asi que 0x3fffffff sigue estando
  // tres ordenes de magnitud arriba y lejos del borde de Int32: sumarle un tramo no
  // desborda.
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
 * siguiente en `o + 4 + d`, con `d` los PASOS del tramo. Con `d = 1` no hay clicks y
 * la nota siguiente cae exactamente un intervalo despues de la ultima: dos piezas
 * adyacentes quedan contiguas, sin costura audible (AC3).
 *
 * El `length` cierra sumando tambien el salto de la ultima pieza a la primera, asi
 * que es `4n + suma de los saltos`. Sin ese ultimo tramo el loop se cerraria antes
 * de tiempo y el circuito dejaria de ser cerrado.
 *
 * ## El costo ordena, los pasos miden el tiempo
 *
 * Desde el spec 011 son DOS numeros y no dos lecturas del mismo: un tramo que pisa una
 * pieza cuesta `CROSS_COST` de mas por celda pisada, pero sigue durando un intervalo
 * por paso. El costo entra en la matriz que ordena el circuito —es lo que hace que el
 * recorrido prefiera rodear— y los pasos, y solo ellos, entran en los offsets.
 * Mezclarlos estiraria el ciclo con silencios donde no hay nada que esperar.
 *
 * Los dos salen de la MISMA llamada a `routeBetween`, guardada en `rutas` (D3): el
 * camino que se agenda es el que el circuito eligio, y la cantidad de clicks no se
 * calcula sino que es el largo de ese camino (D8).
 *
 * El `regimen` (spec 017) atraviesa la funcion sin decidir nada: gobierna que notas
 * dispara cada pieza y que altura suena un cruce, y no toca el circuito ni las puertas
 * ni los offsets. Es a proposito — el 017 corre el arpegio y no la entrada, justamente
 * para no reordenar el tablero al cambiar de regimen (D1).
 */
export function buildSequence(placed: readonly PlacedPiece[], regimen: RegimenDeRotacion): Sequence {
  const n = placed.length;
  if (n === 0) return { steps: [], clicks: [], length: 0 };

  // Con UNA pieza no hay salto: el ciclo es su arpegio y vuelve a empezar contiguo.
  //
  // El plan del spec 009 decia que el ciclo era "el salto de la pieza a si misma",
  // de la salida (grado 4) a la entrada (grado 0). Se cambio DESPUES DE ESCUCHARLO:
  // con la `Z` en (0,1)(1,1)(1,0)(2,0)(3,0) ese salto mide 3 y su camino era
  // [[2,0],[1,0]], o sea que los dos clicks caian SOBRE la propia pieza que acababa de
  // sonar. No se oia un recorrido —no hay a donde ir— sino dos golpes encima del
  // arpegio. El recorrido existe ENTRE piezas; con una sola no hay entre.
  //
  // El spec 011 le saco el sintoma y no el motivo: `routeBetween` rodea la pieza en vez
  // de pisarla, asi que hoy esos clicks caerian en celdas vacias. Siguen sobrando.
  //
  // El ciclo mide `CELLS_PER_PIECE` y no `CELLS_PER_PIECE - 1`: las cinco notas
  // abarcan 4 intervalos, asi que con largo 4 la ultima nota de una vuelta y la
  // primera de la siguiente caerian en el MISMO instante. Con 5 la repeticion es
  // contigua —la nota siguiente cae un intervalo despues de la ultima—, que es la
  // misma regla que AC3 le da a dos piezas adyacentes.
  if (n === 1) {
    return {
      steps: [{ pieceId: placed[0].id, offset: 0, notes: arpeggioFor(placed[0].piece, placed[0].rotation, placed[0].mirror, regimen) }],
      clicks: [],
      length: CELLS_PER_PIECE,
    };
  }

  const puertas = placed.map(gates);
  // Las n x n rutas de una vez —144 con el tablero lleno—, y no una tanda para la matriz
  // y otra para los clicks: asi no existe la posibilidad de ordenar el circuito con un
  // camino y agendar otro.
  // `placed` entero y no "las demas piezas": un tramo puede pisar tambien a las dos que
  // une, y esquivarlas es igual de deseable.
  const rutas = puertas.map((desde) => puertas.map((hasta) => routeBetween(desde.salida, hasta.entrada, placed)));
  const order = shortestCircuit(rutas.map((fila) => fila.map(claveDeTramo)));

  const steps: Step[] = [];
  const clicks: Click[] = [];
  let offset = 0;

  for (let t = 0; t < n; t++) {
    const p = placed[order[t]];
    // `arpeggioFor` devuelve un array nuevo en cada llamada, asi que no hay copia
    // defensiva que hacer: `Step.notes` es mutable por contrato y no aliasa nada. La
    // copia que habia aca protegia de mutar `PlacedPiece.notes`, que ya no existe.
    steps.push({ pieceId: p.id, offset, notes: arpeggioFor(p.piece, p.rotation, p.mirror, regimen) });

    const ultima = offset + (CELLS_PER_PIECE - 1);
    const ruta = rutas[order[t]][order[(t + 1) % n]];
    for (let m = 0; m < ruta.path.length; m++) clicks.push(clickEn(ultima + 1 + m, ruta.path[m], placed, regimen));

    offset = ultima + ruta.steps;
  }

  return { steps, clicks, length: offset };
}

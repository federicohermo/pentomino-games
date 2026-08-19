import type { Cell } from './types/transform.types.ts';
import type { PieceKey } from './types/pieces.types.ts';
import { centroid, angleFromCentroid, pathThroughCells } from './transform.ts';
import {
  CHROMATIC, PENT_MAJOR, PENT_MINOR, PENT_BLUES5, DEGREE_EPSILON,
  BASE_MAP, DEFAULT_OCTAVE,
} from './constants/music.constants.ts';

/**
 * El modelo musical: de una clase de altura y una rotacion, a cinco notas MIDI.
 *
 * Que la rotacion elija la formula es la decision de diseno del instrumento, no un
 * dato: por eso el mapeo vive aca y las formulas en `constants/music.constants.ts`.
 */

/** Nota MIDI de la clase de altura `pc` en la octava `octave`. C4 = 60. */
export function midiFor(pc: number, octave: number): number { return 12*(octave+1) + pc; }

/** Nombre legible de una nota MIDI, p. ej. `C4`. */
export function midiName(m: number): string { const pc = m%12; const o = Math.floor(m/12)-1; return `${CHROMATIC[pc]}${o}`; }

/**
 * Las cinco notas de una pieza segun su rotacion.
 *
 * 0° → pentatonica mayor · 90° → menor · 180° → menor con blue note ·
 * 270° → mayor transpuesta +7.
 *
 * El corrimiento de octava (`octShift`) es deliberado: cuando la suma pasa de B la
 * nota SUBE de octava en vez de envolverse, y por eso las piezas de tonica alta
 * abren mas registro. Es decision documentada, no un bug a corregir de paso.
 */
export function notesForRotation(basePc: number, octave: number, rot: number): number[]{
  let formula = PENT_MAJOR, transpose=0;
  if (rot===1) formula = PENT_MINOR;
  else if (rot===2) formula = PENT_BLUES5;
  else if (rot===3) { formula = PENT_MAJOR; transpose = 7; }
  return formula.map(iv => {
    const total = basePc + iv + transpose;
    const pc = ((total%12)+12)%12;
    const octShift = Math.floor((basePc + iv + transpose)/12);
    return midiFor(pc, octave + octShift);
  });
}

/**
 * El arpegio de una pieza colocada, EN ORDEN DE REPRODUCCION: las cinco notas MIDI
 * que dispara, con el retrogrado ya aplicado si esta reflejada.
 *
 * Es la derivacion completa `(pieza, rotacion, reflexion) -> notas`, y existe porque
 * hasta el cierre de los seguimientos del 007/009/010 estaba escrita CUATRO veces —en
 * `App.tsx`, en `PlacedList.tsx`, en `resolve()` del `simulate_board` y en los helpers
 * de dos tests—, cada una componiendo a mano `BASE_MAP` + `notesForRotation` + el
 * `reverse`. `PlacedPiece.notes` existia para no repetirla, pero guardarla en el estado
 * la volvia un dato que podia contradecir a la pieza: nada impedia construir una
 * `PlacedPiece` con `rotation: 1` y las notas de la rotacion 0, y el tablero —que ya
 * derivaba— y el motor —que leia el campo— habrian dicho cosas distintas.
 *
 * La reflexion invierte el ORDEN EN EL TIEMPO y no que nota le toca a que celda: por eso
 * el `reverse` va sobre el resultado y `notesForRotation` no recibe `mirror`. Quien
 * necesita la nota de UNA celda tiene que indexar el arpegio ASCENDENTE con el grado
 * —`notesForRotation(...)[degreeByCellIndex(...)[k]]`, que es lo que hace `Board.tsx`—
 * y no esta funcion.
 *
 * La octava es `DEFAULT_OCTAVE` y no un parametro: la app entera toca en una sola
 * octava. Quien necesite otra —hoy solo `describe_piece`, que la expone como argumento—
 * usa `notesForRotation` directo.
 */
export function arpeggioFor(piece: PieceKey, rotation: number, mirror: boolean): number[] {
  const asc = notesForRotation(BASE_MAP[piece], DEFAULT_OCTAVE, rotation);
  return mirror ? asc.reverse() : asc;
}

/**
 * Que grado del arpegio le toca a cada celda de una forma. DEVUELVE POR INDICE:
 * el elemento `k` es el grado (`0..n-1`) de `cells[k]`, no al reves.
 *
 * **El grado `g` va a la celda que el camino de `pathThroughCells` visita en el paso
 * `g`** (spec 012): el arpegio RECORRE la pieza, sin pasar nunca por encima de una
 * celda propia. El paso preferido es en cruz; en las cuatro piezas que no admiten
 * recorrido ortogonal —`F`, `T`, `Y` y `X`, cuyo grafo de celdas es un arbol con un
 * nodo de 3 o 4 vecinos— se tolera uno en diagonal, que al menos llega a una celda que
 * se toca con la anterior.
 *
 * Hasta el spec 012 el orden lo daba el anillo angular del 007 alrededor del centroide,
 * que no sabe nada de adyacencia: de los 48 pasos de las 12 piezas, **cuatro pasaban por
 * encima** de una celda que todavia no habia sonado —en `I`, `T`, `U` e `Y`— y nueve
 * iban en diagonal. Hoy son 0 y 5.
 *
 * La diagonal se tolera SOLO adentro de la pieza: el recorrido entre piezas
 * (`routeBetween`) se sigue moviendo en cruz. Es asimetrico a proposito y esta
 * justificado en D10 del spec — adentro de la pieza la alternativa es pasar por encima
 * de una celda, afuera no existe ese problema porque el recorrido pisa y suena todas
 * las celdas por las que pasa.
 *
 * Recibe la forma y no la `PieceKey` a proposito: es lo que la hace testeable
 * sobre formas arbitrarias y lo que evita que `music.ts` conozca `SHAPES`.
 *
 * Se le pasa la forma CANONICA, no la transformada. El mapeo se arrastra por
 * indice —rotar es un `map`, asi que la celda `k` sigue siendo la celda `k`—, y
 * es la trampa mas cara de esta capa: correrla sobre `p.cells`, que ya esta rotada
 * y trasladada, compila igual y devuelve otro mapeo. Con el camino esto ya no es una
 * necesidad geometrica —rotar y reflejar preservan la adyacencia, asi que un camino
 * sigue siendo un camino en las 8 orientaciones— pero sigue siendo la regla: el
 * desempate angular SI depende de la orientacion, y el arrastre por indice es lo que
 * sostiene a `ANCHOR_INDEX` y a las puertas del circuito.
 *
 * ## El grado 0 es la punta del camino, no el centro de la figura
 *
 * El spec 007 sacaba del anillo a la celda parada sobre el centroide y le daba la
 * tonica, con el argumento de que el centro de la figura es su raiz. Eso alcanzaba a
 * `I` y `X`, y en la `I` es incompatible con recorrer la pieza: arrancar por el centro
 * de una linea de cinco obliga a un salto de 4 celdas que la forma no necesita. Desde
 * el 012 el grado 0 es **la punta por la que se empieza a caminar la forma**.
 *
 * El 012 dijo ademas que el grado 0 es la celda por donde el recorrido ENTRA a la
 * pieza (`gates`). Eso es cierto solo sin reflexion: con `mirror` el retrogrado
 * invierte el orden en el tiempo, asi que la primera nota que suena —y por lo tanto la
 * puerta de entrada— es la del grado `n-1`. Quien quiera la posicion de una celda en
 * el ORDEN EN QUE SUENA tiene que pedir `playOrderByCellIndex`, que es lo unico que
 * conoce la reflexion; el grado se queda contestando que NOTA le toca a la celda, que
 * es una pregunta que la reflexion no mueve.
 *
 * ## Que hace el orden angular hoy
 *
 * DESEMPATA, y nada mas — pero se ejerce en las 12 piezas, asi que no es decorativo:
 * un camino y su inverso son igual de buenos, y el rango angular es lo que elige la
 * direccion. `angularRank` es el algoritmo que hasta el 012 decidia el orden entero.
 *
 * Que la direccion la decida la FORMA y no el tablero es una regla del instrumento y no
 * una comodidad de implementacion (D11 del spec 012). Se midio la alternativa —entrar
 * por la punta mas cercana a la pieza anterior del circuito—: acortaria el ciclo en el
 * 79 % de los tableros, un 10,4 % en promedio. Se descarta igual, porque haria que mover
 * una pieza cambiara el arpegio de sus vecinas: **una pieza tiene que sonar igual este
 * donde este.**
 */
export function degreeByCellIndex(cells: readonly Cell[]): number[] {
  const orden = pathThroughCells(cells, angularRank(cells));
  const grados = new Array<number>(cells.length);
  // `pathThroughCells` devuelve la celda de cada paso; esto es la tabla inversa, el
  // grado de cada celda. Las dos son permutaciones de `0..n-1` y confundirlas compila.
  orden.forEach((k, degree) => { grados[k] = degree; });
  return grados;
}

/**
 * En que PASO DEL ORDEN DE REPRODUCCION suena cada celda de una forma. DEVUELVE POR
 * INDICE, igual que `degreeByCellIndex`: el elemento `k` es el paso (`0..n-1`) de
 * `cells[k]`.
 *
 * Es el grado con el retrogrado ya aplicado, y por lo tanto **lo unico del mapeo
 * celda-a-nota que la reflexion mueve**: sin `mirror` el paso ES el grado; con
 * `mirror` es `n-1-grado`, porque la reflexion invierte el orden EN EL TIEMPO sin
 * mover que nota le toca a que celda (la misma regla que `arpeggioFor` aplica sobre
 * las notas, aca aplicada sobre las celdas).
 *
 * De aca salen las dos cosas que el instrumento muestra y usa en orden de sonido:
 *
 * - `cellsByPlayOrder` —y con ella las PUERTAS del circuito (`gates`)—, que antes
 *   hacia su propio `reverse` y era la segunda copia de esta regla.
 * - El numero que `Board.tsx` pinta en la esquina de cada celda. **El paso 0 es
 *   siempre la celda por donde el recorrido entra**, y de ahi la numeracion sube
 *   hasta `n-1`, que es siempre la salida — en las 12 piezas y en las dos
 *   reflexiones. Con el grado eso valia solo sin reflejar: la mitad reflejada del
 *   espacio de colocacion se entraba por el `#4` y se contaba hacia atras.
 *
 * La nota de una celda NO se pide con esto: se pide con el grado contra el arpegio
 * ASCENDENTE (`notesForRotation`). Las dos parejas son correctas y cruzarlas compila:
 * `ascendente[grado]` y `arpeggioFor(...)[paso]` dan la MISMA nota, pero
 * `ascendente[paso]` da la nota espejada en toda pieza reflejada.
 */
export function playOrderByCellIndex(cells: readonly Cell[], mirror: boolean): number[] {
  const grados = degreeByCellIndex(cells);
  const ultimo = cells.length - 1;
  return mirror ? grados.map(g => ultimo - g) : grados;
}

/**
 * El rango angular de cada celda alrededor del centroide, POR INDICE: el elemento `k`
 * es la posicion (`0..n-1`) de `cells[k]` en el anillo.
 *
 * Es el orden que el spec 007 usaba como mapeo de grados y que desde el 012 solo
 * DESEMPATA caminos de igual calidad (ver arriba). Se conserva entero —la excepcion
 * del centroide, el sentido horario y el desempate por indice— porque cambiarlo
 * cambiaria la direccion en la que se recorre cada pieza, que es audible.
 *
 * Se exporta aunque `degreeByCellIndex` sea su unico consumidor de `src/`: sin export
 * los tests tendrian que reimplementar esas tres decisiones para poder ejercerlas, que
 * es exactamente el patron que el spec 005 denuncio.
 *
 * Tres reglas, en este orden:
 *
 * 1. Las celdas que caen SOBRE el centroide salen del anillo y toman los
 *    primeros lugares. Solo `I` y `X` tienen una. La excepcion no es estetica:
 *    `Math.atan2(0, 0)` devuelve `0` EN SILENCIO y las meteria en el anillo como si
 *    estuvieran al este.
 * 2. El resto se ordena por angulo ascendente alrededor del centroide, que con
 *    el eje `y` hacia abajo es sentido horario en pantalla.
 * 3. A igual angulo gana el INDICE ORIGINAL MENOR. El desempate se ejerce en `F`, `I`
 *    y `T`, que tienen celdas colineales con el centroide.
 *
 * El tercer criterio va ESCRITO en el comparador en vez de delegado a que el
 * `sort` sea estable: la estabilidad esta garantizada desde ES2019, pero
 * apoyarse en ella dejaria la regla sin decir en ningun lado.
 *
 * Los angulos se precomputan y no se piden adentro del comparador: `sort` lo
 * llama O(n log n) veces, y ademas comparar siempre el MISMO numero es lo que
 * hace que el epsilon del empate se comporte.
 *
 * ## Por que el empate se compara por cubeta y no con `Math.abs(a - b) < eps`
 *
 * Porque "estan a menos de epsilon" NO es transitivo: con tres angulos escalonados
 * a media tolerancia, `a` empata con `b` y `b` con `c` pero `a` no con `c`, y un
 * comparador asi le da a `sort` un orden que depende del pivote. Con las 12 formas
 * de `SHAPES` no pasa —los empates son exactos, porque salen de restas identicas—
 * pero esta funcion recibe formas arbitrarias a proposito. Redondear el angulo a
 * un entero de cubetas lo vuelve un orden total por construccion: dos angulos o
 * caen en la misma cubeta o no, y eso si es transitivo.
 */
export function angularRank(cells: readonly Cell[]): number[] {
  const cent = centroid(cells);

  const center: number[] = [];
  const ring: number[] = [];
  const bucket = new Array<number>(cells.length);

  for (let k = 0; k < cells.length; k++) {
    const dx = cells[k][0] - cent[0];
    const dy = cells[k][1] - cent[1];
    if (Math.hypot(dx, dy) < DEGREE_EPSILON) {
      center.push(k);
    } else {
      bucket[k] = Math.round(angleFromCentroid(cells[k], cent) / DEGREE_EPSILON);
      ring.push(k);
    }
  }

  ring.sort((a, b) => bucket[a] === bucket[b] ? a - b : bucket[a] - bucket[b]);

  const rank = new Array<number>(cells.length);
  [...center, ...ring].forEach((k, posicion) => { rank[k] = posicion; });
  return rank;
}

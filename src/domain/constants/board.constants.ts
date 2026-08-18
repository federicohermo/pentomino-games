import type { Cell } from '../types/transform.types.ts';

/**
 * Dimensiones del tablero.
 *
 * `GRID_W` ya NO es la cantidad de posiciones dentro del compas: eso valia
 * mientras el eje X era tiempo y la fase de una pieza salia de su columna (spec
 * 004). El spec 009 reemplaza esa lectura por el recorrido — el tiempo lo da el
 * orden en que se visitan las piezas, no la abscisa—, asi que `GRID_W` volvio a
 * ser ancho a secas.
 *
 * Lo que si sigue dependiendo de las dos: las 60 celdas del circuito y los dos
 * extremos de la costura, que se derivan de aca y no se escriben a mano.
 */
export const GRID_W = 10;
export const GRID_H = 6;

/**
 * Los dos extremos de la costura: el tablero se repliega sobre si mismo y `(0,0)`
 * queda adyacente a `(9,5)` (spec 009, D2).
 *
 * Es UNA arista extra, no un toroide ni envoltura de todo el borde: ningun otro
 * par de celdas del borde se toca de mas. Medido sobre los 3.600 pares: acorta
 * 496 (13,8 %) y baja la distancia maxima del tablero de 14 a 12.
 *
 * El orden ya NO lo lee nadie. Mientras la ruta se elegia con formula cerrada, los
 * dos extremos eran dos rutas distintas —`viaStart` y `viaEnd`— y habia que saber
 * cual era cual. Con `routeBetween` (spec 011) la costura es una arista mas del
 * grafo y se recorre en los dos sentidos sin nombre propio, asi que `SEAM[0]` y
 * `SEAM[1]` son intercambiables: lo unico que importa es que sean estas dos celdas.
 */
export const SEAM: readonly [Cell, Cell] = [[0, 0], [GRID_W - 1, GRID_H - 1]];

/**
 * Lo que cuesta ENTRAR a una celda ocupada al trazar el camino entre dos piezas,
 * contra 1 de una celda vacia (spec 011, D1).
 *
 * Vive al lado de `SEAM` y no en un archivo de rutas porque es lo mismo que la
 * costura: una propiedad del GRAFO del tablero. La costura dice que celdas son
 * vecinas; esto dice cuanto cuesta pisar cada una.
 *
 * El 5 sale de barrer el peso sobre dos mediciones distintas, y la que decide **no**
 * es el caso testigo sino la segunda.
 *
 * Sobre el caso testigo del spec —la `P` rotada 1 en (3,2) y la `Y` rotada 1 en (7,2),
 * las dos piezas entre las que el 009 dejaba el recorrido pisando la que acababa de
 * sonar— alcanzaba con 2:
 *
 * | peso | celdas pisadas por ciclo | largo del ciclo |
 * |---|---|---|
 * | 1 (el 009, sin peso) | 3 | 18 |
 * | 2 | 1 | 18 |
 * | **5** | **0** | 20 |
 *
 * Pero el testigo es UN tramo, y sobre 200 tableros aleatorios por tamano —con las
 * puertas reales— la pregunta que importa es otra: **cada cuanto el recorrido pisa una
 * pieza TENIENDO un rodeo libre disponible.** O sea las veces que cruza pudiendo no
 * hacerlo, que es lo unico que se lee como error y no como necesidad:
 *
 * | peso | cruces/ciclo (3 pz) | (5 pz) | ciclo vs peso 2 | cruza teniendo rodeo libre |
 * |---|---|---|---|---|
 * | 2 | 2,12 | 5,24 | — | **20,4 %** |
 * | 3 | 1,57 | 4,45 | +2,8 % | 16,0 % |
 * | **5** | **1,10** | **3,69** | **+7,1 %** | **9,9 %** |
 * | 61 (prohibir de hecho) | 0,51 | 2,83 | +19,3 % | **0 %** |
 *
 * Con 2, **uno de cada cinco tramos cruza una pieza pudiendo rodearla** — y eso se ve:
 * la cabeza lectora del 010 lo hace evidente, que es como se encontro. Con 5 baja a uno
 * de cada diez y el ciclo crece 7 %.
 *
 * **No se eligio 61 —que es el unico valor que cumple "solo cruzar si no hay
 * alternativa"— por lo que cuesta el otro extremo:** casi 20 % de ciclo, y sobre todo
 * rodeos de hasta +20 intervalos en un solo salto (2,7 s a 110 bpm, `research.md` §3).
 * Ese rodeo no se escucha como rodeo sino como que el instrumento se colgo, que es
 * exactamente el sintoma que tener un peso —y no una prohibicion— existe para evitar.
 * 5 acota el rodeo a 4 pasos extra por celda evitada, que es un compas y no una pausa.
 *
 * Sigue siendo un PESO y no una regla: cuando no hay camino libre —la celda central de
 * la `X` esta rodeada por sus propios brazos y es siempre una de sus puertas— el
 * recorrido cruza igual y la celda suena su nota. Por eso no hay caso especial que
 * escribir, ni tope al rodeo, ni trato aparte para la `X`.
 *
 * Moverlo es cambiar este numero: la tabla de arriba dice que se gana y que se paga.
 */
export const CROSS_COST = 5;

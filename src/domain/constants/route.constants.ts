/**
 * Las tres rutas posibles entre dos celdas del tablero (spec 009, D2).
 *
 * `direct` va derecho por la grilla y no toca la costura. Las otras dos la cruzan,
 * y se distinguen por el extremo POR EL QUE ENTRAN: `viaEnd` llega hasta `SEAM[1]`
 * —la esquina `(9,5)`, el final del circuito— y sale por `SEAM[0]`; `viaStart` es
 * el camino inverso. Son dos y no una porque la costura se cruza en los dos
 * sentidos y el largo no es el mismo: depende de que tan cerca este cada punta de
 * su esquina.
 *
 * Const-object y no `enum`: `erasableSyntaxOnly` los rechaza, y es la misma opcion
 * que deja que node cargue `src/domain/` sin compilar.
 */
export const ROUTE = { direct: 'direct', viaEnd: 'viaEnd', viaStart: 'viaStart' } as const;

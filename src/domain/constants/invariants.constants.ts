/**
 * Las cuatro rotaciones que recorre `checkNotes` y `checkArrayOrder`.
 *
 * Se escriben y no se derivan de un `ROTATION_COUNT`: no hay tal constante en el repo, y
 * el numero 4 no es un parametro sino la aritmetica del cuarto de vuelta —`rotate90`
 * aplicada cuatro veces es la identidad—. Lo que si es un parametro son los REGIMENES, y
 * por eso esos salen de `Object.values(REGIMEN)` en el modulo: agregar un tercero tiene
 * que meterlo solo en el invariante, y agregar una quinta rotacion no existe.
 *
 * Los indices, y no los grados: es lo que reciben `rotateN` y `notesForRotation`.
 */
export const ROTATIONS = [0, 1, 2, 3];

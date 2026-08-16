import type { PieceKey } from '../../domain/types/pieces.types.ts';

/**
 * El color de cada pieza: fondo y texto que va encima.
 *
 * Los 12 fondos salen de la lamina de referencia del spec 007 y estan MEDIDOS, no
 * derivados: reproducirlos con una formula (rueda de matiz, HSL equiespaciado) da
 * otros colores y rompe la correspondencia con la lamina.
 *
 * Es UN solo record `Record<PieceKey, ...>` y no dos tablas paralelas, por el mismo
 * motivo por el que `BASE_MAP` esta tipado y no es `as const`: agregar una pieza sin
 * darle color pasa a ser error de compilacion, y `bg` y `fg` no pueden desalinearse
 * por indice porque viajan juntos.
 *
 * `fg` es siempre negro o blanco —el mejor de los dos contra `bg`— y esta guardado
 * en vez de calculado en el render: el calculo de luminancia WCAG no tiene por que
 * correr 60 veces por frame para devolver siempre lo mismo. Lo que impide que se
 * desincronice de `bg` es el test de `__tests__/palette.test.ts`, que recalcula el
 * contraste desde `bg` en vez de confiar en esta tabla.
 *
 * ## El umbral es AA, no AAA
 *
 * Las 12 pasan AA (4.5:1) con el `fg` elegido. NINGUNA alcanza AAA (7:1) ni con
 * negro ni con blanco, asi que exigir AAA obligaria a cambiar los colores de la
 * lamina — o sea, a perder la identidad visual que este record existe para traer.
 * Tres pasan con poco margen (`I` 5,06 · `U` 5,20 · `T` 5,25), y por eso el chequeo
 * es un test y no una inspeccion a ojo.
 *
 * `W` es la unica pieza con texto blanco: su azul puro da 2,44 contra negro.
 */
export const PIECE_COLOR: Record<PieceKey, { bg: string; fg: string }> = {
  F: { bg: '#D9E021', fg: '#000000' },   // contraste 14,63 vs negro
  I: { bg: '#ED1E79', fg: '#000000' },   //  5,06
  L: { bg: '#29ABE2', fg: '#000000' },   //  8,02
  N: { bg: '#8CC63F', fg: '#000000' },   // 10,26
  P: { bg: '#F15A24', fg: '#000000' },   //  6,23
  T: { bg: '#FF0000', fg: '#000000' },   //  5,25
  U: { bg: '#009245', fg: '#000000' },   //  5,20
  V: { bg: '#FFFF00', fg: '#000000' },   // 19,56
  W: { bg: '#0000FF', fg: '#FFFFFF' },   //  8,59 vs blanco (contra negro da 2,44)
  X: { bg: '#00A99D', fg: '#000000' },   //  7,16
  Y: { bg: '#FF7BAC', fg: '#000000' },   //  8,68
  Z: { bg: '#FBB03B', fg: '#000000' },   // 11,38
};

/** Piso de contraste del repo para texto sobre el color de pieza: WCAG 2.1 AA. */
export const CONTRAST_AA = 4.5;

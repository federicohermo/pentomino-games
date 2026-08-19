/**
 * Las tres acciones que un gesto de entrada puede pedirle al shell: rotar la pieza
 * por colocar, alternar su reflexión, o alternar el transporte.
 *
 * Const-object y no `enum` — el `erasableSyntaxOnly` del tsconfig los rechaza, y es la
 * misma opción que permite que node cargue `src/` sin compilar. El precedente exacto
 * es `MARCA` en `route.constants.ts`, y vive acá y no en `input.ts` porque los módulos
 * de este repo no declaran constantes.
 *
 * No hay una cuarta acción `no-hacer-nada`: la ausencia de acción es `null`, y eso deja
 * que el llamador use el mismo valor para decidir si hace `preventDefault` — si el
 * handler se saltea el evento, el navegador tiene que quedárselo entero (D4, spec 013).
 */
export const ACCION = { rotar: 'rotar', reflejar: 'reflejar', transporte: 'transporte' } as const;

/**
 * Lo que un click sobre una celda le puede pedir al tablero (spec 014).
 *
 * Cuatro y no dos: colocar y colocar-muteada son la misma edición del tablero pero
 * distinto gesto de escucha —la muteada **no** dispara el arpegio de cortesía, porque se
 * está poniendo justamente para que no suene— y separarlas acá es lo que evita que esa
 * condición viva como un `if` suelto en el shell.
 *
 * La ausencia de acción sigue siendo `null`, igual que en `ACCION`: es el click sobre una
 * pieza que **no** es la que está en la mano, que no hace nada — como antes de este spec.
 */
export const EDICION = {
  quitar: 'quitar',
  mutear: 'mutear',
  colocar: 'colocar',
  colocarMuteada: 'colocar-muteada',
} as const;

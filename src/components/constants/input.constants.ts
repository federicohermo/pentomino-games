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

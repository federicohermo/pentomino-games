import type { ResourceDef } from './types.ts';
import { constantes } from './constantes.ts';

/**
 * El registro de resources, con la misma forma que `tools/index.ts`: agregar uno es un
 * archivo mas una linea aca, y el entrypoint no se toca.
 *
 * **Es un array desde el primero y no un `registerResource` suelto en `index.ts`**, y eso
 * no es simetria: el segundo ya esta previsto. Los templates —`spec://{n}` y
 * `piece://{letra}`— son resources con URI parametrica, o sea que llegan con
 * `ResourceTemplate` y una firma distinta. Escribir hoy la version de un solo elemento
 * significa que ese dia hay que abrir el entrypoint, mover el registro y revisar el
 * capabilities; escribirlo asi significa que hay que agregar una linea.
 */
export const resources: readonly ResourceDef[] = [
  constantes,
];

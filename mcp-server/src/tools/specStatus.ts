import { z } from 'zod';
import { join } from 'node:path';
import { defineTool, json } from './types.ts';
import { readSpecStatus } from '../specs.ts';

/**
 * En que estado esta el trabajo planificado.
 *
 * La ruta se resuelve desde este archivo y no desde `process.cwd()`: el server lo
 * arranca un cliente MCP, que no promete nada sobre el directorio de trabajo.
 */
const SPECS_DIR = join(import.meta.dirname, '..', '..', '..', 'specs');

export const specStatus = defineTool({
  name: 'spec_status',
  description:
    'Estado del trabajo planificado: por spec, su estado en specs/log.md, cuántas tareas están ' +
    'marcadas sobre el total y cuál es la próxima que de verdad falta. Usar en lugar de leer log.md ' +
    'y los tasks.md, que son decenas de KB y crecen con cada spec. Una casilla abierta no siempre ' +
    'es deuda, así que se descuentan tres clases y queda "pendientes", que vale 0 exactamente ' +
    'cuando no hay "proxima": las que están bajo un encabezado "Seguimiento" (deuda anotada a ' +
    'propósito), las marcadas "[M]" (piden una persona: navegador, oído, captura) y todas las de un ' +
    'spec Descartado o Superado (de ahí no sale trabajo, y la nota lo dice). Por eso un spec puede ' +
    'estar Implementado con seis casillas abiertas y no deberle nada a nadie.',
  inputSchema: z.object({}),
  run: () => json(readSpecStatus(SPECS_DIR)),
});

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
    'marcadas sobre el total y cuál es la próxima sin marcar. Usar en lugar de leer log.md y los ' +
    'tasks.md, que son 24 KB. Las tareas bajo un encabezado "Seguimiento" se cuentan aparte y no ' +
    'entran en "proxima": son deuda anotada a propósito, así que un spec puede estar Implementado ' +
    'con seis sin marcar y no deberle nada a nadie.',
  inputSchema: z.object({}),
  run: () => json(readSpecStatus(SPECS_DIR)),
});

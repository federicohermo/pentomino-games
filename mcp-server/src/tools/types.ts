import type { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/server';

/**
 * El contrato de una tool: nombre, descripcion, schema y handler COLOCADOS en un
 * solo archivo. Agregar una tool es un archivo nuevo mas una linea en
 * `tools/index.ts`; el entrypoint no se toca y no hay ningun `switch`.
 *
 * Lo que NO hay aca es una capa de validacion de argumentos: la hace el SDK
 * contra el schema de zod antes de llamar al handler. Es la diferencia con el
 * server low-level, donde un argumento faltante degrada a `""` y la tool responde
 * algo plausible en vez de fallar.
 */

/** Lo que escribe un archivo de tool: el handler ya recibe los argumentos tipados. */
export interface ToolSpec<S extends z.ZodType> {
  name: string;
  description: string;
  inputSchema: S;
  run: (args: z.output<S>) => CallToolResult;
}

/** Lo que consume el registro: el schema ya no aparece en el tipo del handler. */
export interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  run: (args: unknown) => CallToolResult;
}

/**
 * Borra el parametro de tipo del schema para que las cuatro tools entren en un
 * mismo array.
 *
 * El `parse` de adentro no es una segunda capa de validacion: el SDK ya valido
 * contra ESTE mismo schema, y volver a parsearlo es como se cruza el borde
 * generico **sin un cast que pueda mentir**. Cuesta un parse de un objeto de
 * cuatro campos, una vez por llamada.
 */
export function defineTool<S extends z.ZodType>(spec: ToolSpec<S>): ToolDef {
  return {
    name: spec.name,
    description: spec.description,
    inputSchema: spec.inputSchema,
    run: (args: unknown) => spec.run(spec.inputSchema.parse(args)),
  };
}

/**
 * Respuesta normal: JSON serializado como texto. Sin sello de frescura — no hay
 * indice que pueda envejecer.
 *
 * **Compacto y no indentado a proposito.** El consumidor es un agente y lo que se
 * mide es cuantos tokens cuesta la respuesta (AC11): indentar a dos espacios pone
 * cada coordenada de `cells` en su propia linea y triplica el costo de la parte
 * mas repetitiva de la salida.
 */
export const json = (value: unknown): CallToolResult =>
  ({ content: [{ type: 'text', text: JSON.stringify(value) }] });

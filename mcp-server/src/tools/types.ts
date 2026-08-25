import type { z } from 'zod';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/server';

/**
 * El contrato de una tool: nombre, titulo, anotaciones, descripcion, schema y
 * handler COLOCADOS en un solo archivo. Agregar una tool es un archivo nuevo mas
 * una linea en `tools/index.ts`; el entrypoint no se toca y no hay ningun `switch`.
 *
 * Lo que NO hay aca es una capa de validacion de argumentos: la hace el SDK
 * contra el schema de zod antes de llamar al handler. Es la diferencia con el
 * server low-level, donde un argumento faltante degrada a `""` y la tool responde
 * algo plausible en vez de fallar.
 */

/**
 * `title` y `annotations` van OPCIONALES a proposito. Con un campo requerido, el
 * commit que amplia el contrato no compila hasta que las seis tools esten hechas,
 * y tres commits chicos se vuelven uno grande. Quien exige que ninguna se lo
 * saltee es el test de `__tests__/tools.test.ts`, no el tipo — y ese test cubre
 * ademas la tool numero siete, que es el modo de falla real.
 *
 * `ToolAnnotations` se IMPORTA del SDK en vez de redeclararse: una copia local no
 * ve el hint que el protocolo agregue manana.
 *
 * **`openWorldHint: false` en las seis, y el porque se dice ACA una sola vez**: el
 * dominio de entidades de este server es CERRADO —doce piezas, un `src/`, un
 * `specs/`—, que es exactamente la propiedad que lo hace confiable y que hasta
 * ahora solo estaba dicha en prosa. Repetir el motivo tool por tool seria escribir
 * seis veces lo que el campo ya dice.
 */

/** Lo que escribe un archivo de tool: el handler ya recibe los argumentos tipados. */
export interface ToolSpec<S extends z.ZodType> {
  name: string;
  description: string;
  title?: string;
  annotations?: ToolAnnotations;
  inputSchema: S;
  run: (args: z.output<S>) => CallToolResult;
}

/** Lo que consume el registro: el schema ya no aparece en el tipo del handler. */
export interface ToolDef {
  name: string;
  description: string;
  title?: string;
  annotations?: ToolAnnotations;
  inputSchema: z.ZodType;
  run: (args: unknown) => CallToolResult;
}

/**
 * Borra el parametro de tipo del schema para que las seis tools entren en un
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
    title: spec.title,
    annotations: spec.annotations,
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

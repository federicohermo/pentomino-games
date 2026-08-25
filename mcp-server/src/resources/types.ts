import type { ReadResourceResult, ResourceMetadata } from '@modelcontextprotocol/server';

/**
 * El contrato de un resource: nombre, URI, metadata y handler COLOCADOS en un solo
 * archivo, igual que `tools/types.ts`. Agregar un resource es un archivo nuevo mas una
 * linea en `resources/index.ts`; el entrypoint no se toca y no hay ningun `switch`.
 *
 * La diferencia con una tool es de INTENCION y no de mecanica: una tool es una pregunta
 * con argumentos y un resource es contenido que el cliente puede traerse entero y adjuntar
 * al contexto. Por eso `read` no recibe argumentos: la URI es fija.
 */

/**
 * `config` se tipa `ResourceMetadata` PELADO y no `ResourceMetadata & { cacheHint }`, que
 * es lo que acepta `registerResource`. **No es una omision: es lo que hace que el chequeo
 * de propiedades de mas rechace un `cacheHint` escrito en un resource.**
 *
 * El motivo es la propiedad entera de este server: lo que lo vuelve confiable es que nada
 * pueda quedar viejo —no hay build, no hay indice persistido, la respuesta sale del codigo
 * de HEAD en el momento de la consulta—. Una respuesta cacheada es exactamente lo
 * contrario, y ademas fallaria en silencio: el numero contestado seguiria siendo plausible.
 * Si algun dia hiciera falta, el cambio se ve en ESTE tipo y hay que explicarlo.
 *
 * `read` se declara con un solo parametro y devolviendo `ReadResourceResult` a secas, en vez
 * de reusar el `ReadResourceCallback` del SDK —que ademas recibe un `ServerContext` y admite
 * promesas y `InputRequiredResult`—. Es la misma eleccion que `ToolDef.run`, por el mismo
 * motivo: aca adentro no hay nada asincronico ni nada que preguntarle al cliente, y una
 * firma mas angosta es asignable a la ancha, asi que el registro compila igual.
 */
export interface ResourceDef {
  name: string;
  uri: string;
  config: ResourceMetadata;
  read: (uri: URL) => ReadResourceResult;
}

/**
 * Respuesta normal de un resource: JSON serializado como texto. Es el `json` de las tools
 * con el sobre que pide el otro lado del protocolo —un resource contesta `contents` y no
 * `content`, y cada entrada repite la URI que se pidio—.
 *
 * La URI se toma del parametro y no de la constante del resource: es la que el cliente
 * pidio, y devolver otra es contestar sobre algo que nadie pregunto.
 *
 * Compacto y no indentado por lo mismo que en las tools: el consumidor es un agente y lo
 * que se mide es cuantos tokens cuesta la respuesta.
 */
export const jsonResource = (uri: URL, value: unknown): ReadResourceResult =>
  ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }] });

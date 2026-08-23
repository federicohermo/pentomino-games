import { join } from 'node:path';

/**
 * Donde vive `specs/`, para las dos tools que lo tocan.
 *
 * **Se resuelve desde este archivo y no desde `process.cwd()`**: al server lo
 * arranca un cliente MCP, que no promete nada sobre el directorio de trabajo.
 *
 * Y eso, que empezo siendo una precaucion, es hoy el mecanismo que hace cierta la
 * D1 del spec 033: **la escritura cae en el registro central y no en el
 * worktree**. Los agentes de `/pr-review-batch` y `/spec-implement-batch` corren
 * cada uno en su worktree, pero el server MCP es uno solo —el de la sesion, que
 * arranco desde el checkout central—, asi que `import.meta.dirname` apunta al
 * central sin importar desde donde se pregunte. Un `process.cwd()` aca lo
 * romperia en silencio, que es la peor forma de romperlo.
 *
 * Vive en su propio archivo porque lo necesitan `spec_status` y `spec_write`, y
 * dos copias de esta ruta se desincronizan la primera vez que alguien mueva algo.
 */
export const SPECS_DIR = join(import.meta.dirname, '..', '..', '..', 'specs');

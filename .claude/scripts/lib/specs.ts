/**
 * Lo puro de `publicar-spec.mjs`, `hidratar-specs.mjs` y `specs-por-estado.mjs`
 * (specs 034 y 035).
 *
 * **Existe para que tenga tests.** Los scripts empezaron como herramientas de un solo
 * uso y no lo son —cada spec nuevo se publica, y cada worktree se hidrata—: el commit
 * que los estreno se llama «tres bugs del publicador que lo estreno», y los tres eran
 * de parseo. Mientras esto vivio adentro de un script ejecutable no habia forma de
 * cubrirlo, porque importarlo corria el script.
 *
 * Lo verifica `specs/__tests__/scripts-de-specs.test.ts`, que vive al lado de lo que
 * verifica.
 *
 * **Es `.ts` y no `.mjs`** aunque lo importen tres `.mjs`: node lo carga igual —corre
 * TypeScript sin compilar, como `mcp-server/`, y la sintaxis de aca es la que
 * `erasableSyntaxOnly` permite—, y en cambio un `.mjs` no se puede importar desde un
 * test sin `allowJs` o un `.d.mts` escrito a mano, que es la duplicacion que este repo
 * evita en todos lados.
 *
 * Nada de aca toca el disco ni la red: son strings a strings.
 */

/**
 * Una entrada de `specs/mapa.json`: un spec, su issue, y lo que de el se sabe sin red.
 *
 * Reemplaza a la fila de `log.md` (spec 035). La fila traia los mismos datos ahogados
 * en una descripcion larga que **nadie verificaba**, y por eso mintio sobre 12 de 31
 * filas; de aca lo unico duplicado del issue son `estado` y `titulo`, y los dos los
 * mira el gate de `specs/__tests__/mapa-de-specs.test.ts`.
 */
export interface EntradaDeMapa {
  /** El issue donde vive el spec. Es lo que hace que el mapa sea un mapa. */
  issue: number;
  /**
   * El nombre historico de la carpeta, que **no se deriva del titulo**.
   *
   * Aca vivia `slugDe`, que lo derivaba, y se borro con una medicion: reproducia 28 de
   * los 35 y fallaba en 7. El 001 se llama `001-notas-por-celda-en-orden-angular` y su
   * issue se titula «Asignar cada nota a una celda de la pieza…». Ninguna heuristica
   * los recupera, asi que el nombre se guarda en vez de calcularse.
   */
  carpeta: string;
  fecha: string;
  /** `Propuesto` · `En curso` · `Implementado` · `Descartado` · `Superado`. */
  estado: string;
  /** El titulo del issue, **verbatim**, para que el gate sea una igualdad de strings. */
  titulo: string;
}

/** El registro entero: `NNN` → su entrada. */
export type Mapa = Record<string, EntradaDeMapa>;

/**
 * `specs/mapa.json` parseado, y **grita** ante un mapa vacio o que no es un objeto.
 *
 * El grito es el punto, y la leccion es del 034: su antecesora `filasDeLog` devolvia
 * `[]` cuando el regex dejaba de matchear, y `[]` no es un error sino un registro
 * vacio. Cuando cambio el formato de la columna, eso salio como 34 specs sin estado,
 * en verde.
 *
 * La validacion campo por campo NO esta aca: la hacen los dos que leen el archivo de
 * verdad —el gate antes de mergear, y `parseMapa` del MCP server al responder—. Aca
 * alcanza con distinguir «el registro no se pudo leer» de «el registro esta vacio»,
 * que es la unica confusion que costo algo.
 */
export const leerMapa = (json: string): Mapa => {
  let crudo: unknown;
  try {
    crudo = JSON.parse(json);
  } catch (e) {
    throw new Error(`specs/mapa.json no es JSON valido: ${(e as Error).message}`);
  }
  if (crudo === null || typeof crudo !== 'object' || Array.isArray(crudo)) {
    throw new Error('specs/mapa.json tiene que ser un objeto `{ "NNN": {…} }`.');
  }
  const mapa = crudo as Mapa;
  if (Object.keys(mapa).length === 0) {
    throw new Error('specs/mapa.json no tiene una sola entrada: o se trunco, o este no es el archivo.');
  }
  return mapa;
};

/**
 * Los `NNN` de los specs en un estado, ordenados.
 *
 * Vive aca y no en cada `.sh` porque lo piden dos —`lote.sh` y `matriz.sh`, para su
 * `--propuestos`— y hasta el spec 035 cada uno lo sacaba con su propio `sed` sobre la
 * tabla de `log.md`. Dos copias del mismo parseo es como el `SKILL.md` termina
 * diciendo una cosa y el script haciendo otra, que ya paso con los cruces.
 */
export const idsPorEstado = (mapa: Mapa, estado: string): string[] =>
  Object.keys(mapa).filter((id) => mapa[id].estado === estado).sort();

/**
 * El estado que el registro declara para un spec, o `null` si no tiene entrada.
 *
 * Ese `null` no es un detalle: un spec recien escrito **todavia no** esta en el mapa, y
 * confundirlo con un estado terminal fue lo que cerro el issue del 035 apenas nacio.
 */
export const estadoDe = (mapa: Mapa, id: string): string | null => mapa[id]?.estado ?? null;

/** La URL de un issue. El repo se pasa: este archivo no habla con git ni con la red. */
export const urlDeIssue = (repo: string, numero: number): string =>
  `https://github.com/${repo}/issues/${numero}`;

/** Un archivo reconstruido desde el comentario que lo llevaba. */
export interface ArchivoDeComentario {
  nombre: string;
  contenido: string;
}

/**
 * Un comentario del issue vuelve a ser su archivo. El encabezado que el publicador le
 * puso adelante —`## \`research.md\``— es lo que dice cual es, asi que se lee y se
 * saca: no forma parte del archivo original.
 *
 * Devuelve `null` cuando no lo tiene, y eso es lo que distingue un archivo de una
 * **discusion** del issue: sin esto, el primer comentario que alguien escriba a mano
 * se escribiria al disco como si fuera parte del spec. Desde el 035 eso incluye las 41
 * notas de revision, que van con un blockquote justamente para no matchear aca.
 */
export const archivoDeComentario = (cuerpo: string): ArchivoDeComentario | null => {
  // El separador se escribe entero en vez de `\s*\n\n?`, y las dos partes tienen
  // motivo. `\s*` es codicioso y se come **todas** las lineas en blanco que sigan, asi
  // que un archivo que arrancara con una linea vacia volvia del issue sin ella: el
  // round-trip byte por byte del 033 dejaba de valer, y no por un archivo del repo de
  // hoy sino por el primero que se escriba asi. Y el `\r` va explicito porque la API
  // devuelve CRLF: sin eso el corte deja un retorno de carro colgado adelante, que es
  // la misma trampa que `.claude/rules/mcp-server.md` ya tiene anotada.
  const m = /^##\s+`([a-z]+\.md)`[^\S\r\n]*\r?\n(?:\r?\n)?/.exec(cuerpo);
  if (!m) return null;
  return { nombre: m[1], contenido: cuerpo.slice(m[0].length) };
};

/**
 * Traduce las referencias a otro spec por la URL de su issue.
 *
 * **Es lo que permite no tocar un solo archivo de `specs/[0-9]…/`**: la Desviacion 2
 * dice que un spec mergeado no se reescribe, asi que la traduccion pasa a la
 * publicacion. Cubre las dos formas que existen en el repo: la relativa desde adentro
 * de `specs/` (`./005-…/spec.md`) y la que llega desde afuera (`specs/005-…/spec.md`,
 * con o sin `../` adelante). Lo que no esta en el mapa se deja como estaba.
 */
export const traducir = (texto: string, mapa: Mapa, repo: string): string => texto.replace(
  /(?:\.{1,2}\/)*(?:specs\/)?(\d{3})-[a-z0-9-]+\/(?:spec|research|plan|tasks|baseline)\.md/g,
  (original, id: string) => (mapa[id] ? urlDeIssue(repo, mapa[id].issue) : original),
);

/**
 * La carpeta de un spec entre las que ya estan, emparejando por `NNN`.
 *
 * **Por el numero y no por el nombre completo.** El mapa dice como se llama, pero una
 * cache hidratada antes de que `carpeta` existiera puede tener otro nombre —eran 7 de
 * 35—, y tratar ese nombre viejo como «el spec no esta» crearia una SEGUNDA carpeta
 * para el mismo spec. Dos carpetas con el mismo `NNN` hacen que `spec_status` cuente
 * el spec dos veces, sin que nada avise.
 */
export const carpetaExistente = (carpetas: string[], id: string): string | null =>
  carpetas.find((c) => c.startsWith(`${id}-`)) ?? null;

/**
 * Lo puro de `publicar-spec.mjs` y `hidratar-specs.mjs` (spec 034).
 *
 * **Existe para que tenga tests.** Los dos scripts empezaron como herramientas de un
 * solo uso y no lo son —cada spec nuevo se publica, y cada worktree se hidrata—: el
 * commit que los estreno se llama «tres bugs del publicador que lo estreno», y los
 * tres eran de parseo. Mientras esto vivio adentro de un script ejecutable no habia
 * forma de cubrirlo, porque importarlo corria el script.
 *
 * Lo verifica `src/__tests__/scripts-de-specs.test.ts`, que es donde ya viven los
 * gates del repo —`specs-convencion`, `enlaces-resueltos`, `mapa-de-directorios`—.
 *
 * **Es `.ts` y no `.mjs`** aunque lo importen dos `.mjs`: node lo carga igual —corre
 * TypeScript sin compilar, como `mcp-server/`, y la sintaxis de aca es la que
 * `erasableSyntaxOnly` permite—, y en cambio un `.mjs` no se puede importar desde un
 * test de `src/` sin `allowJs` o un `.d.mts` escrito a mano, que es la duplicacion que
 * este repo evita en todos lados.
 *
 * Nada de aca toca el disco ni la red: son strings a strings.
 */

/** Cuanto puede medir el slug de una carpeta, sin contar el `NNN-`. */
const LARGO_MAXIMO = 56;

/** Una fila de `log.md` que ya apunta a su issue. */
export interface FilaDeLog {
  id: string;
  url: string;
  numero: string;
}

/** Lo que el publicador necesita saber de cada spec para traducir un enlace. */
export interface EntradaDeMapa {
  numero: number;
  url: string;
}

/**
 * Las filas de `log.md` que enlazan a un issue: el mapa spec<->issue del AC3.
 *
 * Se filtra por forma y no se acepta cualquier `href` porque una fila que todavia
 * apunta a `./NNN-slug/spec.md` no tiene issue del que bajar nada. Media tabla
 * migrada da una lista corta, y quien llama decide si eso es un error.
 */
export const filasDeLog = (md: string): FilaDeLog[] =>
  [...md.matchAll(/^\|\s*\[(\d{3})\]\((https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/(\d+))\)/gm)]
    .map((m) => ({ id: m[1], url: m[2], numero: m[3] }));

/** El mapa como objeto, que es lo que consume el publicador. */
export const mapaDeLog = (md: string): Record<string, EntradaDeMapa> =>
  Object.fromEntries(filasDeLog(md).map((f) => [f.id, { numero: Number(f.numero), url: f.url }]));

/**
 * El estado que `log.md` declara para un spec, o `null` si no tiene fila.
 *
 * Ese `null` no es un detalle: un spec recien escrito **todavia no** tiene fila, y
 * confundirlo con un estado terminal fue lo que cerro el issue del 035 apenas nacio.
 */
export const estadoDe = (md: string, id: string): string | null => {
  const m = new RegExp(`^\\|\\s*\\[${id}\\]\\([^)]*\\)\\s*\\|[^|]*\\|([^|]*)\\|`, 'm').exec(md);
  return m ? m[1].trim() : null;
};

/**
 * `# Spec 021 — El tablero es la pantalla` → `021-el-tablero-es-la-pantalla`.
 *
 * **Corta por largo y en un separador, no por cantidad de palabras.** El corte a las
 * 8 primeras palabras partia la frase donde cayera: el 004 quedaba
 * `004-fase-por-pieza-la-columna-como-posicion-en` y el 001
 * `001-asignar-cada-nota-a-una-celda-de-la`. Con un tope de caracteres la mayoria de
 * los titulos entra entera —el 004 vuelve a su nombre historico— y la que no entra se
 * corta en el guion anterior al tope, nunca a mitad de palabra.
 *
 * Cambiarlo no rompe un checkout ya hidratado porque el hidratador **reutiliza la
 * carpeta que este** emparejando por `NNN` y no por nombre. Ver `carpetaExistente`.
 */
export const slugDe = (titulo: string, id: string): string => {
  const sinPrefijo = titulo.replace(/^Spec\s+\d{3}\s*[—–-]\s*/, '');
  const kebab = sinPrefijo
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // se van los acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (kebab.length <= LARGO_MAXIMO) return `${id}-${kebab}`;
  // Un caracter de mas a proposito: si el tope cae justo sobre un guion, ese guion es
  // un corte limpio y no hay que retroceder una palabra entera.
  const cortado = kebab.slice(0, LARGO_MAXIMO + 1);
  return `${id}-${cortado.slice(0, cortado.lastIndexOf('-'))}`;
};

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
 * se escribiria al disco como si fuera parte del spec.
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
export const traducir = (texto: string, mapa: Record<string, EntradaDeMapa>): string => texto.replace(
  /(?:\.{1,2}\/)*(?:specs\/)?(\d{3})-[a-z0-9-]+\/(?:spec|research|plan|tasks|baseline)\.md/g,
  (original, id: string) => (mapa[id] ? mapa[id].url : original),
);

/**
 * La carpeta de un spec entre las que ya estan, emparejando por `NNN`.
 *
 * **Por el numero y no por el nombre completo**, y ahi hay un bug real: el slug se
 * deriva del titulo del issue, asi que cualquier cambio de titulo —o de `slugDe`—
 * daba un nombre distinto, `existsSync` decia que no estaba y el hidratador creaba una
 * SEGUNDA carpeta para el mismo spec. Dos carpetas con el mismo `NNN` hacen que
 * `spec_status` cuente el spec dos veces, sin que nada avise.
 */
export const carpetaExistente = (carpetas: string[], id: string): string | null =>
  carpetas.find((c) => c.startsWith(`${id}-`)) ?? null;

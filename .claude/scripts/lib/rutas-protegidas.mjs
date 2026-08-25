/**
 * Lo puro del gate del spec 037: decidir si una ruta cae adentro de una carpeta protegida.
 *
 * **Existe para que tenga tests**, por el mismo motivo que `lib/specs.ts`: mientras vivio
 * adentro de `gate-de-spec.mjs` la unica forma de ejercerla era correr el script entero como
 * subproceso, y el modo de falla que la rompio no se puede fabricar asi.
 *
 * ## El bug que la saco de ahi
 *
 * `relative()` entre dos discos de Windows devuelve la ruta ABSOLUTA del destino, porque no
 * hay ningun camino con `..` que lleve de uno al otro:
 *
 * ```text
 * relative('D:\repo\src', 'C:\Users\...\nota.txt')  ->  'C:\Users\...\nota.txt'
 * ```
 *
 * La version anterior decidia solo por el prefijo `..`, asi que esa respuesta le resultaba
 * indistinguible de una que cae adentro: daba por protegido cualquier archivo del otro disco
 * y, desde `main` o desde una rama sin spec, bloqueaba TODA escritura ahi. Con el repo en
 * `D:` y el temporal del sistema en `C:`, eso es el scratchpad entero. Mordio dos veces.
 *
 * ## Por que el modulo de rutas se inyecta
 *
 * En POSIX el bug no existe: con una sola raiz, `relative` nunca devuelve una ruta absoluta.
 * Reproducirlo de verdad pide dos discos, que dependen de la maquina y no existen en el
 * `ubuntu-latest` donde corre la CI. Recibiendo el modulo por parametro, el caso se prueba
 * con `path.win32` y da lo mismo en las tres plataformas.
 *
 * ## Por que este archivo es `.mjs` y `lib/specs.ts` es `.ts`
 *
 * Porque el gate lo importa en CADA llamada a una herramienta, y ese es justo el caso que el
 * encabezado de `specs.ts` deja afuera. Medido sobre 25 corridas: el gate tarda 64,6 ms, con
 * este `.mjs` tarda 64,5, y con el mismo modulo escrito en `.ts` tarda 102 — node no compila
 * TypeScript gratis, y +38 ms por herramienta los paga la sesion entera. El precio de que sea
 * `.mjs` lo paga el test, que no puede importarlo —`allowJs` esta apagado a proposito— y lo
 * ejerce lanzando un subproceso, que es como ejerce todo lo demas de este gate igual.
 */

/**
 * Si `ruta` cae dentro de alguna de las `protegidas`, las dos relativas a `raiz`.
 *
 * Compara por RUTA RESUELTA y no por el string: `relative` normaliza los `..`, las barras
 * invertidas de Windows y las rutas relativas, asi que `src/../mcp-server/src/x.ts` cae donde
 * tiene que caer. Comparar el string dejaria pasar cualquiera de esas tres formas.
 *
 * @param {import('node:path').PlatformPath} path El modulo de rutas. Ver el encabezado.
 * @param {string} raiz La raiz del repo, absoluta.
 * @param {readonly string[]} protegidas Las carpetas protegidas, relativas a `raiz`.
 * @param {string} ruta La ruta a decidir, absoluta o relativa a `raiz`.
 * @returns {boolean}
 */
export function estaProtegida(path, raiz, protegidas, ruta) {
  const abs = path.resolve(raiz, ruta);
  return protegidas.some((carpeta) => {
    const rel = path.relative(path.resolve(raiz, carpeta), abs);
    // `isAbsolute` es el caso cross-drive: si no hubo camino relativo posible, la respuesta
    // es que NO esta adentro. Sin el, «no empieza con `..`» se cumple por vacio.
    //
    // Y `rel === ''` —la ruta ES la carpeta protegida— cuenta como ADENTRO. Estuvo excluido
    // desde el gate original y ahi era inalcanzable: el gate corria solo sobre
    // `Edit|Write|MultiEdit`, y ninguna de las tres puede tener un directorio como
    // `file_path`. Al sumar `Bash` al matcher entro `rm`, y con el la unica ruta que la
    // exclusion dejaba pasar resulto ser `rm -rf src`: el borrado que mas importa por la
    // unica puerta que quedaba abierta. La condicion no cambio de sentido, cambio lo que le
    // llega.
    return !path.isAbsolute(rel) && !rel.startsWith('..') && !rel.startsWith(`..${path.sep}`);
  });
}

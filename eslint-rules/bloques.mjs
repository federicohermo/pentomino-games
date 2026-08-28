/*
 * # Que cuenta como UN comentario
 *
 * Lo comparten `local/comment-shape` y `local/comment-anchor`, y vive afuera de las dos
 * por un motivo medido y no por prolijidad: **los numeros del spec 051 solo son
 * comparables entre si mientras las dos reglas agrupen igual**. Nacio duplicado —una copia
 * en cada regla, escritas en paralelo— y duplicado se desincroniza sin que nada avise: el
 * dia que alguien afine el agrupador de una, la otra sigue contando distinto y las dos
 * siguen en verde. Es el mismo motivo por el que este repo saca los valores fijos de los
 * modulos.
 */

/**
 * Un comentario que le habla a una herramienta y no a un lector.
 *
 * Sin este filtro un `eslint-disable` seria un hallazgo de `vacio` o de `historia`, y en
 * este repo `noInlineConfig` ya los prohibe por otra via.
 */
const DIRECTIVAS = /^\s*(eslint|ts-|@ts-|prettier-|global|exported|istanbul|c8|v8|webpack|turbo)/

/**
 * Los comentarios de un archivo agrupados en bloques, sin las directivas.
 *
 * **Una corrida de `//` consecutivos es UN bloque, no cinco.** Un parrafo partido en cinco
 * lineas no son cinco hallazgos del mismo problema, y contarlo asi es lo que hace que
 * «97 docblocks» y «77 bloques de historia» signifiquen lo mismo en las dos reglas.
 *
 * Devuelve arrays de comentarios y no su texto ya unido: `comment-shape` necesita el nodo
 * del primero para reportar y el tipo de cada uno para saber si es un docblock.
 *
 * @param {import('eslint').SourceCode} source
 * @returns {import('estree').Comment[][]}
 */
export function bloquesDeComentario(source) {
  const bloques = []
  for (const c of source.getAllComments()) {
    if (DIRECTIVAS.test(c.value)) continue
    const anterior = bloques.at(-1)
    const sigue =
      anterior !== undefined &&
      c.type === 'Line' &&
      anterior.at(-1).type === 'Line' &&
      c.loc.start.line === anterior.at(-1).loc.end.line + 1
    if (sigue) anterior.push(c)
    else bloques.push([c])
  }
  return bloques
}

/**
 * Si un comentario JSX es una directiva.
 *
 * `comment-shape` mira el texto de adentro de un contenedor JSX antes de que ese
 * comentario llegue a `getAllComments`, asi que necesita el mismo filtro suelto y no
 * solo el que aplica el agrupador.
 * `getAllComments`, asi que necesita el mismo filtro por afuera del agrupador.
 *
 * @param {string} texto
 */
export function esDirectiva(texto) {
  return DIRECTIVAS.test(texto)
}

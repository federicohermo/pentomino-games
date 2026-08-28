import { bloquesDeComentario, esDirectiva } from './bloques.mjs'

/**
 * `local/comment-shape` — la forma del comentario, y solo donde la forma delata un
 * problema de EXACTITUD.
 *
 * Portada de `bait-landing-frontend`, que ya la corre lintada, pero **no copiada**: esa
 * regla verbatim sobre este arbol da 1007 hallazgos en 92 de 93 archivos, y un gate que
 * enciende en rojo el arbol entero no se arregla, se apaga. De sus ocho chequeos quedan
 * cuatro (spec 051).
 *
 * El criterio del recorte es uno solo, y explica todo lo que sigue: **el consumidor
 * principal de los comentarios de este repo es un modelo leyendo el codigo para
 * cambiarlo**, y para el lo que importa no es cuanto dice un comentario sino que lo que
 * dice siga siendo cierto. Un comentario largo y verdadero es barato; uno corto y podrido
 * es caro. Asi que las reglas que quedan atacan la exactitud, no la longitud.
 */

// ## No hay chequeo de longitud, ni de densidad, ni de comentario al final de linea
//
// Es lo primero que un lector va a querer agregar, asi que va escrito aca al lado del
// codigo: los cuatro se midieron sobre este arbol y se rechazaron, uno por uno.
//
// - `largo` (302 hallazgos) y `densidad` (49) son presupuestos de PROSA. Chocan con «Sin
//   objetivo numerico» de `conventions.md` y tambien con la evidencia: desactivar los
//   conceptos de comentario en un modelo degrada la refinacion de codigo hasta un -90 %
//   (arXiv:2512.16790), y refinar codigo es exactamente lo que se hace aca. Recortar por
//   numero optimiza la variable equivocada. Este repo no acorta un comentario por largo.
// - `trailing` (49) es una decision explicita del dueno del repo: el comentario al final
//   de la linea SE PERMITE. Ancla la explicacion al token exacto sin gastar una linea, y
//   ningun benchmark dice que dane.
// - `anclaje` (25) son 25 falsos positivos: todos sobre JSX de `Board.tsx` que esta bien.
//
// Y la que un lector va a proponer por el otro lado: `no-inline-comments`, del core de
// ESLint, hace exactamente lo de `trailing`. Se evaluo y se rechazo por lo de arriba —este
// repo permite el comentario al final de linea— y ademas esta *frozen*, con la deprecacion
// aceptada (https://github.com/eslint/eslint/issues/19350) y su reemplazo en `@stylistic`
// todavia sin existir (https://github.com/eslint-stylistic/eslint-stylistic/issues/758).

// Codigo archivado en un comentario: abre como sentencia y cierra como sentencia. Lo que
// se comento «por las dudas» lo guarda git, que ademas dice cuando y por que se fue.
const CODE_LIKE = /^\s*(const|let|var|return|if|for|while|import|export|function|await)\b[\s\S]*[;{)]\s*$/

// Un comentario JSX corto que trae una de estas explica un porque, y eso no es una
// etiqueta por corto que sea: `{/* … porque … */}` se queda.
const CAUSAL = /\b(porque|para que|si no|evita|rompe|hace falta|necesita|no se puede)\b/i

const MAX_PALABRAS_ETIQUETA = 6

/**
 * El tope del resumen, en lineas, y una constante del modulo y no una opcion.
 *
 * `schema` va vacio a proposito: los cinco numeros que la regla de origen tomaba por
 * opciones eran justamente los presupuestos de prosa que este port rechaza, y no queda
 * ninguno que configurar.
 */
const MAX_LINEAS_RESUMEN = 2

/** @type {import('eslint').Rule.RuleModule} */
const commentShape = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Comentarios vacios, codigo archivado, etiquetas JSX y el resumen del docblock',
    },
    schema: [],
    messages: {
      vacio: 'Comentario vacio: borralo.',
      codigo: 'Codigo comentado: no se archiva en un comentario, lo guarda git.',
      etiqueta:
        'Comentario JSX que solo reetiqueta el marcado ({{txt}}): lo dice el JSX, y miente en cuanto cambie.',
      resumen:
        'El primer parrafo del docblock ocupa {{n}} lineas (maximo {{max}}): dejalo en {{max}} y baja el resto al cuerpo, que no tiene tope.',
    },
  },

  create(context) {
    const source = context.sourceCode

    return {
      JSXExpressionContainer(node) {
        const m = source.getText(node).match(/^\{\s*\/\*([\s\S]*?)\*\/\s*\}$/)
        if (!m) return

        const txt = m[1].trim()
        if (esDirectiva(txt)) return

        if (txt.split(/\s+/).length <= MAX_PALABRAS_ETIQUETA && !CAUSAL.test(txt)) {
          context.report({ node, messageId: 'etiqueta', data: { txt: txt.slice(0, 40) } })
        }
      },

      'Program:exit'() {
        for (const group of bloquesDeComentario(source)) {
          const c = group[0]
          const body = c.value.trim()

          if (!body || /^\*+$/.test(body)) {
            context.report({ node: c, messageId: 'vacio' })
            continue
          }

          // Despega los `*` de margen para que el texto que se juzga sea el que se lee, y
          // no el andamio del bloque.
          const clean = group
            .map((x) =>
              x.value
                .replace(/^\*+/, '')
                .split('\n')
                .map((l) => l.replace(/^\s*\*\s?/, ''))
                .join('\n'),
            )
            .join('\n')
            .trim()

          if (CODE_LIKE.test(clean)) {
            context.report({ node: c, messageId: 'codigo' })
            continue
          }

          /*
           * `resumen` mira UNICAMENTE docblocks. No se le pide resumen a las corridas de
           * `//`: serian 516 ediciones para inventar una convencion que el repo nunca tuvo
           * —solo el 2,6 % las tiene hoy— y ningun benchmark dice que estructurar un
           * comentario de linea ayude.
           */
          const esDocblock = c.type === 'Block' && c.value.startsWith('*')
          if (!esDocblock) continue

          /*
           * El resumen es el PRIMER PARRAFO —hasta la primera linea en blanco— y no lo que
           * hay antes del primer `@tag`, que es como cortaba la regla de origen. Ese corte
           * aca daria 308 hallazgos en vez de 99: de 617 docblocks del repo solo 2 tienen
           * algun tag y `@remarks` tiene cero, asi que cortar por tag hace que «el resumen»
           * sea el docblock entero. `@remarks` se acepta si alguien lo escribe, y no se
           * exige.
           *
           * El cuerpo que sigue al primer parrafo no tiene tope, y eso es el punto: lo que
           * sobra baja, no se borra.
           */
          const resumen = clean.split(/\n\s*\n/)[0]
          const lineas = resumen.split('\n').length
          if (lineas > MAX_LINEAS_RESUMEN) {
            context.report({
              node: c,
              messageId: 'resumen',
              data: { n: lineas, max: MAX_LINEAS_RESUMEN },
            })
          }
        }
      },
    }
  },
}

export default commentShape

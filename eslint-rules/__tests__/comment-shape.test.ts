import { describe, it } from 'vitest'
import { RuleTester } from 'eslint'
import rule from '../comment-shape.mjs'

/*
 * `RuleTester` no registra sus casos como tests por si solo: llama a los `describe`/`it`
 * GLOBALES, y este repo no corre vitest con `globals: true`. Sin estas dos lineas la
 * corrida falla con `No test suite found in file` — medido en este mismo repo.
 */
RuleTester.describe = describe
RuleTester.it = it

/*
 * JSX prendido para todos los casos y no solo para los de `etiqueta`, que son los unicos
 * que lo necesitan: espree parsea igual el codigo que no lo usa, y dos `RuleTester` para
 * una sola regla dan dos suites con el mismo nombre.
 */
const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

/** Un docblock de 48 lineas cuyo primer parrafo son 2: el caso de AC3, en verde. */
const DOCBLOCK_48 = [
  '/**',
  ' * Resumen que abre en dos lineas,',
  ' * y termina en la segunda.',
  ' *',
  ...Array.from({ length: 43 }, (_, i) => ` * Linea ${i} del cuerpo, que no tiene tope.`),
  ' */',
  'const a = 1;',
].join('\n')

/** Dos lineas de resumen y cuarenta de cuerpo: el caso de AC4, en verde. */
const DOS_MAS_CUARENTA = [
  '/**',
  ' * Resumen que abre en dos lineas,',
  ' * y termina en la segunda.',
  ' *',
  ...Array.from({ length: 40 }, (_, i) => ` * Linea ${i} del cuerpo.`),
  ' */',
  'const a = 1;',
].join('\n')

/**
 * Cuarenta comentarios en cien lineas exactas: el caso de densidad de AC3, en verde.
 *
 * Son 40 bloques de dos lineas —comentario y sentencia— mas 20 de relleno. De paso cubre
 * las dos formas de NO agrupar una corrida: comentarios de linea separados por codigo.
 */
const CUARENTA_EN_CIEN = [
  ...Array.from({ length: 40 }, (_, i) => `// nota numero ${i}\nconst a${i} = ${i};`),
  ...Array.from({ length: 20 }, (_, i) => `const b${i} = ${i};`),
].join('\n')

tester.run('comment-shape', rule, {
  valid: [
    // ## AC3 — nada se reporta por longitud, por densidad ni por estar al final de linea
    { name: 'un comentario al final de una linea de codigo', code: 'const a = 1; // nota' },
    { name: 'un docblock de 48 lineas', code: DOCBLOCK_48 },
    { name: 'cuarenta comentarios en cien lineas', code: CUARENTA_EN_CIEN },

    // ## AC4 — el tope es el primer parrafo, y `@remarks` no se exige
    { name: 'dos lineas de resumen y cuarenta de cuerpo', code: DOS_MAS_CUARENTA },
    {
      name: 'con `@remarks`, que se acepta',
      code: '/**\n * Resumen de una linea.\n *\n * @remarks El detalle, que no tiene tope.\n */\nconst a = 1;',
    },
    {
      name: 'sin `@remarks`, que no se exige',
      code: '/**\n * Resumen de una linea.\n *\n * El detalle, que tampoco necesita el tag.\n */\nconst a = 1;',
    },

    // ## Lo que se conserva del original
    {
      // Una corrida de `//` es UN comentario: el docblock es lo unico a lo que se le pide
      // resumen, asi que tres lineas seguidas de `//` pasan.
      name: 'una corrida de tres `//` consecutivos',
      code: '// Primera linea de la corrida,\n// segunda,\n// y tercera.\nconst a = 1;',
    },
    {
      // Un `//` pegado abajo de un bloque NO continua la corrida del bloque: son dos
      // comentarios distintos y cada uno se juzga solo.
      name: 'un bloque seguido de un `//`',
      code: '/* nota suelta */\n// otra nota\nconst a = 1;',
    },
    {
      // Las directivas de herramienta no son prosa y quedan afuera del filtro.
      name: 'directivas de herramienta',
      code: '/* global window */\n// @ts-expect-error el tipo se afloja a proposito\nconst a = 1;',
    },

    // ## `etiqueta` — lo que NO es una etiqueta
    {
      name: 'un contenedor JSX que no es un comentario',
      code: 'const valor = 1;\nconst App = () => <div>{valor}</div>;',
    },
    {
      name: 'un comentario JSX de mas de seis palabras',
      code: 'const App = () => <div>{/* El orden de estos dos nodos lo fija el recorrido */}</div>;',
    },
    {
      name: 'un comentario JSX corto que explica un porque',
      code: 'const App = () => <div>{/* Va aca porque el grid manda */}</div>;',
    },
    {
      name: 'un comentario JSX que es una directiva',
      code: 'const App = () => <div>{/* global window */}</div>;',
    },
  ],

  invalid: [
    // ## AC2 — un caso por `messageId`, y con el `messageId`: contar errores deja pasar
    // en verde a una regla que reporta el mensaje equivocado.
    {
      name: 'un comentario sin cuerpo',
      code: 'const a = 1;\n//',
      errors: [{ messageId: 'vacio' }],
    },
    {
      name: 'un comentario que solo tiene asteriscos',
      code: 'const a = 1;\n/***/',
      errors: [{ messageId: 'vacio' }],
    },
    {
      name: 'codigo archivado en un comentario',
      code: '// const viejo = calcular(1);',
      errors: [{ messageId: 'codigo' }],
    },
    {
      name: 'un comentario JSX que solo reetiqueta el marcado',
      code: 'const App = () => <div>{/* El tablero */}</div>;',
      errors: [{ messageId: 'etiqueta' }],
    },

    // ## AC4 — el primer parrafo pasa de dos lineas
    {
      name: 'un docblock cuyo primer parrafo tiene tres lineas',
      code: '/**\n * Primera linea del resumen,\n * segunda linea del resumen,\n * y una tercera que ya sobra.\n */\nconst a = 1;',
      errors: [{ messageId: 'resumen', data: { n: '3', max: '2' } }],
    },
  ],
})

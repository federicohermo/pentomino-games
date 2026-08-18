import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

/** Los specifiers con los que `src/` podria alcanzar el paquete de tooling. */
const MCP_SERVER = ['../mcp-server/*', '../../mcp-server/*', '../../../mcp-server/*']

/** Lo que `domain/` no puede ver, venga de donde venga: es la capa pura. */
const FUERA_DE_DOMAIN = [
  'react', 'react-dom', 'react-dom/*',
  '../audio/*', '../../audio/*',
  '../components/*', '../../components/*',
  '../App*', '../../App*',
  ...MCP_SERVER,
]

/**
 * La direccion de dependencia ADENTRO de `domain/`, modulo por modulo: para cada uno,
 * los hermanos que NO puede importar.
 *
 * Hasta el cierre de los seguimientos del 009 esto vivia solo en `CLAUDE.md` como un
 * dibujo, y era la unica direccion del repo que no verificaba nadie — las cuatro capas
 * ya tenian su override, pero adentro de la capa pura un `board.ts` importando
 * `sequence.ts` habria pasado el lint sin decir nada. Es el mismo argumento con el que
 * las aristas entre capas dejaron de ser convencion escrita.
 *
 * Los niveles, de abajo hacia arriba:
 *
 * - `transform.ts` es la base: geometria sin nada encima.
 * - `board.ts` y `music.ts` construyen sobre ella y no se conocen entre si — que las
 *   reglas del tablero y el modelo musical sean ortogonales es una propiedad del
 *   instrumento, no una casualidad de como quedaron los imports.
 * - `sequence.ts` e `invariants.ts` son las HOJAS: pueden usar todo lo de abajo y no
 *   se importan entre si, que es lo que garantiza que no haya ciclos. Si algun dia
 *   `invariants.ts` tuviera que verificar la secuencia, el arreglo es mover `sequence.ts`
 *   un nivel abajo y no borrar la regla.
 *
 * Los specifiers van exactos (`./sequence.ts`) y no como glob de nombre: asi no
 * enganchan a `./types/sequence.types.ts`, que es la carpeta de tipos y esta permitida
 * para todos.
 */
const DOMAIN_INTERNO = {
  'transform.ts': ['./board.ts', './music.ts', './sequence.ts', './invariants.ts'],
  'board.ts': ['./music.ts', './sequence.ts', './invariants.ts'],
  'music.ts': ['./board.ts', './sequence.ts', './invariants.ts'],
  'sequence.ts': ['./invariants.ts'],
  'invariants.ts': ['./sequence.ts'],
}

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },

  // La direccion de dependencia de src/, verificada por el linter y no por la
  // revision. domain/ y audio/ son hermanos sin aristas entre ellos: el motor
  // habla numeros MIDI y no sabe que es un pentomino.
  //
  // Se usa la variante de typescript-eslint y no la core porque tambien ve los
  // `import type`, que son justo los que un refactor descuidado usaria para
  // colarse.
  //
  // Los patrones llevan `../` Y `../../` porque types/, constants/ y __tests__/
  // estan un nivel mas abajo que los modulos. Si algun dia aparece un tercer
  // nivel (domain/sub/x.ts), hay que agregar el patron: esto es una red, no una
  // prueba formal.
  // `mcp-server/` (spec 006) es tooling y la direccion es una sola: importa de
  // `src/`, NUNCA al reves. Va con red y no con convencion escrita, igual que las
  // aristas de adentro de src/ — es la misma regla del repo.
  //
  // Este bloque cubre lo que no matchean los dos overrides de abajo (App.tsx,
  // main.tsx, components/). Los de domain/ y audio/ REEMPLAZAN la regla en vez de
  // sumarse a ella —asi funciona flat config—, asi que repiten el patron adentro.
  // Tres niveles de `../` porque `src/domain/constants/` es la profundidad de hoy.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [{
          group: MCP_SERVER,
          message: 'mcp-server/ es tooling: importa de src/, nunca al reves.',
        }],
      }],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [{
          group: FUERA_DE_DOMAIN,
          message: 'domain/ es puro: no conoce React, ni el audio, ni la UI, ni el tooling.',
        }],
      }],
    },
  },

  // Un override por modulo de domain/, con la direccion de adentro de la capa. Cada uno
  // REEMPLAZA al de arriba —asi funciona flat config—, asi que repite `FUERA_DE_DOMAIN`:
  // sin eso, agregarle a `board.ts` su regla interna lo dejaria libre de importar React.
  ...Object.entries(DOMAIN_INTERNO).map(([archivo, prohibidos]) => ({
    files: [`src/domain/${archivo}`],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [
          {
            group: FUERA_DE_DOMAIN,
            message: 'domain/ es puro: no conoce React, ni el audio, ni la UI, ni el tooling.',
          },
          {
            group: prohibidos,
            message: `La direccion adentro de domain/ es una sola: ${archivo} no puede importar ${prohibidos.join(', ')}.`,
          },
        ],
      }],
    },
  })),
  {
    files: ['src/audio/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [{
          group: [
            'react', 'react-dom', 'react-dom/*',
            '../domain/*', '../../domain/*',
            '../components/*', '../../components/*',
            '../App*', '../../App*',
            ...MCP_SERVER,
          ],
          message: 'audio/ habla MIDI y Web Audio; no conoce el dominio, ni la UI, ni el tooling.',
        }],
      }],
    },
  },
])

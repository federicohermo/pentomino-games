import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

/** Los specifiers con los que `src/` podria alcanzar el paquete de tooling. */
const MCP_SERVER = ['../mcp-server/*', '../../mcp-server/*', '../../../mcp-server/*']

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
          group: [
            'react', 'react-dom', 'react-dom/*',
            '../audio/*', '../../audio/*',
            '../components/*', '../../components/*',
            '../App*', '../../App*',
            ...MCP_SERVER,
          ],
          message: 'domain/ es puro: no conoce React, ni el audio, ni la UI, ni el tooling.',
        }],
      }],
    },
  },
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

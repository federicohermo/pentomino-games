import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

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
          ],
          message: 'domain/ es puro: no conoce React, ni el audio, ni la UI.',
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
          ],
          message: 'audio/ habla MIDI y Web Audio; no conoce el dominio ni la UI.',
        }],
      }],
    },
  },
])

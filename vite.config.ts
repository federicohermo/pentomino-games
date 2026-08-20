/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // 'node' y no 'jsdom': los tests de audio corren contra node-web-audio-api,
    // que es una implementacion nativa de Web Audio. jsdom no implementa Web
    // Audio en absoluto, asi que ahi OfflineAudioContext no existe.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],

    // Los workers no ven los flags con los que arranco vitest, y hay dos tests
    // —los presupuestos de performance del 009— que necesitan saber si estan
    // corriendo instrumentados: bajo v8 miden 11,3 ms contra un techo de 5, o
    // sea que medirian el instrumento y no el producto. Se pasa por `env` y no
    // por el script de npm porque un `COVERAGE=1 vitest` adelante del comando no
    // funciona en Windows, y `cross-env` seria una dependencia nueva para dos
    // lineas.
    env: { COVERAGE: process.argv.some(a => a.startsWith('--coverage')) ? '1' : '' },

    coverage: {
      provider: 'v8',

      // El denominador se declara ENTERO y se descuenta por nombre, y esa es la
      // decision: por defecto vitest mide solo los archivos que algun test
      // importo, con lo que los diez que estan en cero absoluto —los que mas
      // importan— no aparecerian en la tabla y el numero saldria mas lindo sin
      // significar nada. En vitest 4 alcanza con declarar `include`; el flag
      // `all` que hacia esto en la 3 ya no existe y el typecheck lo rechaza.
      include: ['src/**/*.{ts,tsx}'],

      exclude: [
        // Son los tests.
        'src/**/__tests__/**',
        // Declaraciones de tipo: no llegan al runtime.
        'src/vite-env.d.ts',
        // Bootstrap: `createRoot(...).render(<App />)`. Cubrirlo verifica que
        // React monta, no que este repo funcione.
        'src/main.tsx',
      ],

      // `text` y nada mas: el gate es binario, y para leerlo alcanza la tabla en
      // consola. `reportOnFailure` NO es opcional — sin el, un test en rojo hace
      // que vitest no imprima la tabla, y entonces la corrida que mas necesita
      // el reporte es justo la que no lo da.
      reporter: ['text'],
      reportOnFailure: true,
    },
  },
})

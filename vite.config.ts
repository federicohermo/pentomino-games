/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    /**
     * Dos proyectos y UN comando: `pnpm test` sigue corriendo todo, asi que el nodo
     * de convergencia sigue convergiendo. Partirlo en `test` y `test:browser` haria
     * que `verify` reporte verde habiendo corrido la mitad.
     *
     * El corte no es por capa sino por lo que el test NECESITA:
     *
     * - `node` — el dominio es puro y el audio corre contra `node-web-audio-api`,
     *   que es una implementacion nativa de Web Audio. Ahi viven los tests de
     *   siempre, sin un solo cambio.
     * - `browser` — Chromium de verdad, por Playwright. Entra porque jsdom no
     *   puede: `Spectrum.tsx` necesita canvas 2D, `createLinearGradient`,
     *   `ResizeObserver`, `matchMedia` y un `getBoundingClientRect` con numeros, y
     *   `engine.ts` necesita `new AudioContext()` y `window.setInterval`. Con jsdom,
     *   cubrirlos exigiria mockear exactamente el codigo que se quiere cubrir, que
     *   es cobertura sin verificacion.
     *
     * El discriminante es el SUFIJO y no una carpeta: un test de `Board.tsx` que
     * necesita navegador sigue siendo un test de `Board.tsx` y vive al lado. La
     * extension ademas separa sola —`node` toma `.ts` y el navegador `.tsx`—, asi
     * que un test con JSX no puede caer en node por accidente.
     *
     * `extends: true` en los dos, y es lo que evita duplicar config: medido, con el
     * los proyectos heredan `plugins` (sin eso el JSX del proyecto de navegador no
     * compila) y tambien el bloque `coverage`. Que `coverage` sea UNO SOLO y viva
     * arriba es lo que hace que los dos proyectos reporten en una tabla y contra un
     * unico umbral.
     *
     * El navegador no es libre mientras el coverage sea v8: vitest valida el nombre
     * y falla explicito con firefox o webkit, ofreciendo istanbul como alternativa.
     */
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/__tests__/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/__tests__/*.browser.test.tsx'],
          // La hoja de estilos se importa UNA vez y desde el setup, no desde cada
          // test. Medido: sin ella `z-10` esta en el `className` pero
          // `getComputedStyle(...).zIndex` devuelve `auto`, o sea que un test de
          // layout pasa o falla por el motivo equivocado y en silencio.
          setupFiles: ['./src/components/__tests__/browser-setup.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: {
                // Sin esto, la politica de autoplay de Chromium crea todo
                // `AudioContext` en `suspended` y `resume()` se queda esperando un
                // gesto que en un test no llega. `engine.ts` y `Spectrum.tsx`
                // dependen de `ctx.state === 'running'` para hacer algo, asi que sin
                // el flag no se puede cubrir ni una de sus ramas activas.
                args: ['--autoplay-policy=no-user-gesture-required'],
              },
            }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],

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

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
    // Sin `globals`: los tests importan describe/it/expect de 'vitest'. Evita
    // chocar con @types/jest, que sigue en el arbol y declara las mismas
    // globales con firmas distintas.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})

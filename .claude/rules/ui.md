---
paths:
  - "src/App.tsx"
  - "src/components/**/*.tsx"
---

# UI: el shell y los componentes

`App.tsx` es el shell: estado con `useState` local, derivados, handlers, los cuatro efectos y la
composición. **Ninguna función pura y ningún literal de dominio** — eso vive en `domain/`, que es lo
único que puede testearse.

Los componentes son presentacionales, uno por archivo: reciben datos y callbacks por props, sin estado
ni efectos propios. La excepción es `Spectrum.tsx`, que no recibe props y lee del motor por su cuenta
para que dibujar a 60 fps no re-renderice nada del tablero.

- **Todo lo que suena en el loop pasa por el efecto de reconciliación.** Un único `useEffect` sobre
  `[placed]` proyecta `buildSequence(placed)` y se la entrega al motor con `setSequence`; los handlers
  solo cambian estado. `playing` **no** está en las dependencias, y desde el spec 009 eso es
  deliberado: la secuencia es función del tablero y no del transporte, y quien arranca o corta el
  sonido es `togglePlay` con `startClock`/`stopClock`. El `clearJobs()` + `if (!playing) return` de
  antes era la forma vieja de lograr lo mismo desde acá. El patrón imperativo anterior —cada handler
  limpiando lo suyo— produjo loops huérfanos que sobrevivían a "Quitar" y "Reset". Si hace falta
  agendar algo nuevo, va adentro de ese efecto.
- **La proyección dominio→motor vive acá y en ningún otro lado de `src/`.** `App.tsx` es el único
  puente entre las dos capas: entrega la `Sequence` del dominio dejando caer `pieceId` y `cell`,
  porque `audio/` no puede ver `Cell` ni con `import type`. Ver `.claude/rules/audio.md`.
- **Nunca mutar objetos ya entregados a React.** Ese fue exactamente el bug de los loops que motivó el
  rediseño: `newPiece._sched = id` después del `setPlaced`. Si un dato tiene que cambiar después de
  crearse, o va en el estado con su propio setter, o va afuera de React (ref o singleton de módulo).
- **Efectos que reconcilian**, no que ejecutan comandos. Con flag de cancelación si hacen trabajo
  asincrónico; sincrónicos si la limpieza tiene que ganarle al re-montaje de StrictMode.
- **`key` por id, nunca por índice**, en listas de elementos removibles.
- **Un solo export por `.tsx`.** `react-refresh/only-export-components` lo exige, así que las `Props`
  quedan inline y sin exportar. Es la misma regla que mantuvo al dominio sin tests mientras vivía acá.
- **Lo que sale de una constante va por estilo inline, no por clase.** Tailwind escanea el fuente: una
  clase interpolada (`w-[${CELL_PX}px]`) no se generaría.

Detalle en [docs/guides/conventions.md](../../docs/guides/conventions.md).

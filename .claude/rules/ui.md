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
ni efectos propios. La excepción ya no es una sola: `Spectrum.tsx` y `Playhead.tsx` (spec 010) no reciben
props y leen del motor por su cuenta, dibujando imperativamente. La regla que las habilita es la misma en
las dos: un componente puede leer del motor por su cuenta y dibujar imperativamente cuando la frecuencia
de actualización haría que el estado de React re-renderizara el árbol para nada —60 fps en `Spectrum`,
4 a 10,6 veces por segundo en `Playhead`—. Lo que decide no es la importancia del dato sino su
**frecuencia**, y el spec 010 lo pagó: su plan dejaba el estado "pieza pendiente" en `useState` porque
cambiaba una vez por ciclo (7,5 s con 8 piezas a 110 bpm), y hubo que sacarlo cuando el estreno pasó a
ser celda por celda —cinco cambios al ritmo del intervalo—. Hoy `Playhead.tsx` también dibuja ese velo,
con nodos que crea y destruye él mismo.

- **El loop no toca nodos que renderiza React, y React no toca nodos del loop.** Es la otra mitad de la
  regla, y la más fácil de romper: la tentación es atenuar la celda de `Board` desde el bucle. Las celdas
  van con `key={i}` y **sin refs ni `data-*`** justamente para que no haya handle; lo que el loop
  necesita pintar, lo pinta con nodos propios superpuestos. Partir el estilo de un mismo nodo entre los
  dos es lo que el review del spec 007 pagó caro.

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

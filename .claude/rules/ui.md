---
paths:
  - "src/App.tsx"
  - "src/components/**/*.tsx"
---

# UI: el shell y los componentes

`App.tsx` es el shell: estado con `useState` local, derivados, handlers, los dos efectos y la
composición. **Ninguna función pura y ningún literal de dominio** — eso vive en `domain/`, que es lo
único que puede testearse.

Los componentes son presentacionales, uno por archivo: reciben datos y callbacks por props, sin estado
ni efectos propios. La excepción es `Spectrum.tsx`, que no recibe props y lee del motor por su cuenta
para que dibujar a 60 fps no re-renderice nada del tablero.

- **Toda la gestión de jobs del motor pasa por el efecto de reconciliación.** Un único `useEffect`
  sobre `[placed, loopPlaced]` lleva los jobs a donde deben estar; los handlers solo cambian estado. El
  patrón imperativo anterior —cada handler limpiando lo suyo— produjo loops huérfanos que sobrevivían a
  "Quitar" y "Reset". Si hace falta agendar algo nuevo, va adentro de ese efecto.
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

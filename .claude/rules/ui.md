---
paths:
  - "src/App.tsx"
  - "src/components/**/*.tsx"
---

# UI: el shell y los componentes

`App.tsx` es el shell: estado con `useState` local, derivados, handlers, los seis efectos y la
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
  `[secuencia, placed]` proyecta `buildSequence(placed, regimen)` y se la entrega al motor con
  `setSequence`; los handlers solo cambian estado. `playing` **no** está en las dependencias, y
  desde el spec 009 eso es deliberado: la secuencia es función del tablero y no del transporte, y
  quien arranca o corta el sonido es `togglePlay` con `startClock`/`stopClock`. El `clearJobs()` +
  `if (!playing) return` de antes era la forma vieja de lograr lo mismo desde acá. El patrón
  imperativo anterior —cada handler limpiando lo suyo— produjo loops huérfanos que sobrevivían a
  "Quitar" y "Reset". Si hace falta agendar algo nuevo, va adentro de ese efecto.
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

## El tablero se edita en el tablero

Desde el spec 014 **no hay panel derecho**: `PlacedList` murió y con él la única superficie que
duplicaba lo que el tablero ya dice. Una pieza colocada se quita clickeándola y se mutea con
`Alt`+click, y las dos operaciones piden **tener esa misma pieza en la paleta** — la llave se mide sobre
la celda clickeada con `occupantAt`, no con `isValid`, que también falla al chocar contra una pieza
distinta y ahí no tiene que pasar nada.

- **La condición «es la pieza que está en la mano» se escribe una sola vez.** La usan el handler del
  click y la derivación del hover, que decide el cursor y si se pinta el fantasma. Dos copias son dos
  formas de que el cursor prometa una cosa y el gesto haga otra.
- **El estado de una pieza no se comunica con su color.** El color es identidad y está medido en
  contraste; la opacidad la tiene tomada el velo de `Playhead`. El muteo usó el canal que quedaba —la
  ausencia de color— y el próximo estado tiene que buscarse el suyo. Ver [DESIGN.md](../../DESIGN.md).
- **Los `col-span` no viven en `App.tsx`**, sino en la tarjeta de cada componente. Y `CELL_PX` es un
  número **medido**, no elegido: sale de `min(interior / 10, interior / 6)` sobre la tarjeta real, así
  que mover un `col-span` obliga a remedirlo en el DOM.

## Los listeners de entrada

El spec 013 fue el primero que agregó uno —hasta ahí el único `addEventListener` de `src/` era un
`matchMedia` en `Spectrum.tsx`—, así que la regla la escribió él y la próxima se copia de esta.

- **El listener global vive en `App.tsx`, en un efecto propio**, y el componente sobre el que escucha
  no gana ni estado ni efectos. `App.tsx` es quien tiene los setters, así que es quien puede despachar.
- **Las dependencias del efecto son las reales.** Un `[]` con un ref del estado para suscribir una sola
  vez es la optimización que este repo no necesita —son dos `addEventListener` sobre `window`— y
  esconde de dónde sale cada valor. Si el handler no lee ningún valor (setter funcional), ahí sí `[]`.
- **La DECISIÓN del gesto se extrae como pura a `components/`**, recibiendo los campos del evento que
  importan y no el evento. El repo corre en `environment: 'node'` sin jsdom: una pura que reciba un
  `KeyboardEvent` no se puede testear, y en `App.tsx` ni siquiera se puede exportar. El precedente son
  `input.ts`, `cell-text.ts` y `route-source.ts`. Lo que queda en el `.tsx` es cableado, y es lo que
  las tareas `[M]` verifican en el navegador.
- **`wheel` no puede ir por prop de JSX si hace falta `preventDefault`.** React registra sus listeners
  en el contenedor raíz y a `touchstart`, `touchmove` y `wheel` los registra **pasivos** (react-dom
  19.1.1), donde `preventDefault()` es un no-op que el navegador solo avisa por consola. Va por
  `addEventListener(nodo, 'wheel', h, { passive: false })` con el nodo por un `ref` creado en
  `App.tsx`. Es la falla más cara posible: el handler corre, así que parece que anda.
- **El handler global se saltea `<button>` e `<input>`**: si se saltea el evento, el navegador tiene
  que quedárselo entero — es lo que evita el doble disparo con un control enfocado sin recurrir a un
  `blur()` a mano.
- **«¿Hay acción?» y «¿hay que frenar el default?» son dos preguntas y van en dos puras.** Parecen la
  misma hasta que aparece el auto-repeat: la barra mantenida **no** tiene que alternar el transporte a
  30 Hz, pero **sí** tiene que seguir frenando el scroll, porque cada `keydown` repetido trae su propio
  default. Atado a «hay acción», un tap largo arrancaba el transporte una vez y después scrolleaba la
  página.
- **Limpieza sincrónica en el retorno del efecto, para todos los listeners que registró.** StrictMode
  monta dos veces en dev: sin el `removeEventListener` quedan dos.

Detalle en [docs/guides/conventions.md](../../docs/guides/conventions.md).

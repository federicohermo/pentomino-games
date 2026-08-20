# Deuda conocida

Lo que está registrado y todavía no tiene spec. Cuando algo de acá se convierte en trabajo, sale de
esta lista y entra como fila en [log.md](./log.md).

> Vivía en `CLAUDE.md`, que declaraba a `log.md` como única fuente y sostenía un segundo registro en
> paralelo. Se mudó al log, y de ahí acá: el log había quedado con el registro, las dependencias, la
> deuda y las notas de revisión en un archivo de 422 líneas, y sólo la primera de esas cuatro cosas es
> un log.

- **`public/manifest.json` tiene los valores por defecto de CRA** (`"name": "Create React App
  Sample"`).
- **Las `@testing-library/*` siguen sin consumidor.** Ningún test renderiza un componente, y montarlos
  va a requerir `jsdom` en su propio bloque de config, sin tocar el `environment: 'node'` global que
  necesita el audio.
- **No hay tests de UI**, así que los cuatro componentes de `components/` se verifican a ojo. El spec 007
  la deja **abierta pero no más grande**: la derivación de la que depende lo que se ve —de `(x, y)` al
  nombre de nota— no vive en `Board.tsx` sino en `domain/board.ts` (`occupantCellIndex`, AC14), así que
  el componente sigue siendo un encadenado de puras testeadas en `environment: 'node'`. Su
  `components/__tests__/palette.test.ts` es el primer test de la carpeta, pero es de constantes: no
  renderiza nada y **no** desbloquea ni requiere jsdom.
  **El primer caso a cubrir cuando exista la infra es AC10 del spec 008**: que el botón de transporte
  refleje si el reloj *arrancó de verdad* (`setPlaying(clockRunning())`) y no si se lo apretó. El spec
  lo daba por falsable sin navegador y terminó verificado por lectura; testearlo pide extraer el
  handler de `App.tsx` o agregar testing-library. Vivía en el seguimiento del 008, que ya no es su
  dueño.
- **`L` (`#29ABE2`) e `Y` (`#FF7BAC`) no llegan al piso de contraste con ningún color de texto**: Lc
  55,8 y 56,9 contra un piso de 60. Les falta contraste al `bg`, no al `fg`, así que ninguna elección
  de texto las arregla y subirlas exige mover el color de la lámina — o sea, es una decisión de
  identidad visual y no un arreglo. Están en `LC_EXCEPCIONES` de `palette.constants.ts`, y
  `palette.test.ts` verifica que la excepción **siga haciendo falta**: si alguien retoca esos dos
  fondos, el test falla y obliga a sacarlas de la lista.
- **El tablero no se puede tocar con el teclado.** Cada celda es un `div` con `onClick`, sin `role`,
  sin `tabIndex` y sin nombre accesible, así que no recibe foco y ningún lector de pantalla la anuncia.
  El `title` que el 007 le agregó —`(x,y) · D#5 · grado 3`— es un tooltip de mouse y **no** cubre esto:
  sobre un elemento genérico que no recibe foco, `title` no se anuncia. Quedó anotado como si lo
  cubriera, que es peor que no anotarlo — hacía ver el hueco como resuelto. Arreglarlo es decidir el
  modelo de foco de una grilla de 60 celdas (¿una tab stop y flechas, o 60 tab stops?), y toca
  `Board.tsx` entero, así que necesita spec propio.
- **`postcss` y `autoprefixer`** están en `devDependencies` sin ningún config que los use — Tailwind 4
  va por el plugin de Vite. Candidatos a borrar.
- **`@types/jest`** sigue en el árbol y es lo que impide usar `globals: true` en Vitest.
- **La colocación no se repliega sobre la costura.** El *recorrido* sí —`(0,0)` y `(9,5)` son
  adyacentes desde el spec 009— pero una pieza no se puede colocar cruzando ese borde: `isValid`
  rechaza toda celda fuera de la grilla. O sea que el tablero es un cilindro para el circuito y un
  rectángulo para las piezas, y esa asimetría no está justificada por nada — es sólo lo que quedó.
  Necesita spec propio: cambia `cellsAt`, `isValid` y el fantasma, y hay que decidir qué muestra el
  tablero de una pieza partida en dos bordes. Venía del seguimiento del 009.
- **La rotación es un `number` sin acotar**, comparada contra `0|1|2|3` en cuatro lugares. El reemplazo
  ya está decidido —const-object en `constants/` + union type derivado en `types/`, **nunca un `enum`**,
  que el `erasableSyntaxOnly` del tsconfig rechaza— pero cambia firmas, así que quedó como seguimiento
  del spec 005.
  **El spec 017 le dio su argumento más fuerte hasta ahora**: el régimen `orden` usa la rotación como
  índice de corrimiento del arpegio, no sólo como discriminante de una cadena de `if`. Ahí un valor
  fuera de `0..3` no cae a ningún `else`: `base[j + rot]` daría `undefined`, y `midiName` de eso no
  explota — devuelve `undefinedNaN` y lo pinta en la celda. La implementación lo tapó con un módulo
  (`music.ts`, comentado ahí), que es una red y no el arreglo: el arreglo es que el tipo no admita el
  valor. **Y la red tardó dos intentos en cerrar**, que es la mejor medida de por qué el tipo tiene que
  acotarse: el primer `%` a secas dejaba pasar la rotación negativa —el `%` de JS conserva el signo del
  dividendo, así que `base[-1]` volvía a ser `undefined`— y hoy va con el `+ largo` que la normaliza.
  Ese módulo además le cambia el comportamiento al caso fuera de rango entre los dos regímenes
  —`escala` cae a la fórmula mayor, `orden` corre `rot` módulo 5—, que es exactamente la clase de
  divergencia que el tipo acotado haría imposible de escribir.

Ya resueltos: los archivos huérfanos de las plantillas de CRA y Vite (`src/App.css`, `src/logo.svg`,
`src/assets/react.svg`, `public/vite.svg`, `src/setupTests.ts`) y la dependencia `web-vitals`, que
quedó sin consumidor cuando `reportWebVitals.ts` no se migró. También el anclaje de la fase a la
columna (spec 004, AC8), que no tenía test automático porque las puras no se podían exportar desde
`App.tsx`: hoy vive en `domain/board.ts` y lo cubre `domain/__tests__/board.test.ts`.

Y la tarea de seguimiento que preveía que `occupantAt` devolviera **además** el índice de la celda
dentro de la pieza —anotada como «`cellOccupied` devuelve también el índice de celda dentro de la
pieza», con el nombre que la función tenía antes del 005, en
[`001/tasks.md:35`](./001-notas-por-celda-en-orden-angular/tasks.md)—: la cierra el 007 **sin cambiar la
firma**, con una pura hermana al lado (`occupantCellIndex`). Ensanchar el retorno le habría cambiado el
tipo a todos los llamadores que solo quieren saber qué pieza ocupa una celda, para servir a uno solo.

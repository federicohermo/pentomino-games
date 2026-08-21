# Tasks 026 — El tablero se toca con el teclado

Formato en [`specs/README.md`](../README.md). **No esta bloqueado por nada**: seis ACs se verifican en
navegador y AC5/AC6 no tienen forma de verificarse en `environment: 'node'`, pero el proyecto de
navegador ya esta en `main` desde el **029** —con `src/__tests__/App.browser.test.tsx` y
`components/__tests__/Board.browser.test.tsx` adentro— y el umbral de coverage esta en **100**.

## Paso 1 — Las puras, antes de tocar el componente

- [ ] T001 `components/cell-name.ts`: el nombre accesible de una celda, armado desde lo que ya devuelven
      `occupantAt`, `occupantCellIndex` y `cellTextFor` — la cadena entera, que es la que `Board.tsx:212`
      ya recorre. Cuatro casos: vacía, ocupada, ocupada y muteada, y el criterio de qué **no** entra (el
      fantasma, que es transitorio) — **AC8**
- [ ] T002 Docblock con por qué vive afuera del `.tsx`: adentro no se puede exportar y por lo tanto no se
      puede testear. Precedente exacto: `cell-text.ts`, que nació por esto mismo
- [ ] T003 [P] `components/__tests__/cell-name.test.ts`: los cuatro casos
- [ ] T004 `components/types/input.types.ts`: `EventoDeTecla` gana `targetEsCelda: boolean`, con el
      docblock que lo distinga de `targetEsControl` — uno dice «el navegador se queda **todo**», el otro
      «el tablero se queda **la barra, el Enter y las flechas**, y nada más»
- [ ] T049 Y los dos conteos que quedan mal: `input.types.ts:15` dice «las cinco guardas» y `input.ts:73`
      «Las cuatro guardas, en orden». Con el campo nuevo son seis y cinco
- [ ] T005 `input.ts::accionDeTecla`: con `targetEsCelda`, `' '` devuelve `null` — **AC5**
- [ ] T006 **`Shift` y `Control` siguen devolviendo su acción con `targetEsCelda: true`** — **AC6**. No
      es un caso de borde: es la decisión entera del spec. Un `if (e.targetEsCelda) return null` al
      principio de la pura pasa todos los demás tests y rompe los dos atajos del 013
- [ ] T007 `input.ts::frenaElDefault`: la barra sigue frenando el default con la celda enfocada — el
      scroll hay que pararlo igual, lo maneje quien lo maneje
- [ ] T050 **Las doce letras siguen pasando con `targetEsCelda: true`** — **AC15**. `targetEsCelda` apaga
      la barra, el `Enter` y las flechas y **nada más**: es lo que deja que el 018 entre después sin
      tocar esta guarda. Va al test aunque hoy ninguna letra haga nada, porque es la afirmación que el
      018 va a heredar
- [ ] T008 `__tests__/input.test.ts`: la tabla de la asimetría de T005/T006 como oráculo explícito, con
      un comentario que diga que las tres filas juntas son el AC. Por separado no dicen nada
- [ ] T009 `use-input.ts`: el predicado del DOM para la celda (`closest('[role="gridcell"]')`). Va en el
      hook y no en la pura, por la regla de siempre: `input.ts` tiene que poder cargarse en
      `environment: 'node'`

## Paso 2 — Las filas (commit propio, sin nada de teclado)

- [ ] T010 `Board.tsx`: de 60 hijos planos a seis `role="row"` de diez `role="gridcell"`, sin `gap`,
      mismas medidas — **AC9**
- [ ] T051 El `gridTemplateColumns` **se muda del contenedor a la fila** (`Board.tsx:197-198`): hoy las
      diez columnas están donde los hijos son las 60 celdas, y con filas los hijos pasan a ser seis. Sin
      esa mudanza quedan seis filas dentro de una grilla de diez columnas — el píxel que AC11 prohíbe
- [ ] T052 **Arreglar los cuatro selectores estructurales que el cambio rompe**, que hoy leen los hijos
      DIRECTOS del contenedor y con filas devuelven seis en vez de sesenta:
      `components/__tests__/Board.browser.test.tsx:57` (`div.grid > div`) y `:82` (`div.grid`), y
      `src/__tests__/App.browser.test.tsx:55` y `:202` (`div.grid.w-max`). Sin esto los tests del T013
      **no confirman: fallan**, y un rojo por selector viejo no se distingue de un rojo por píxel movido.
      **La lista de cuatro es la de `main` y hay que re-derivarla, no creerle**: el 026 va último en su
      carril, detrás del 027 y del 025, y el 027 (`T017`) y el 028 (`T035`) agregan tests nuevos a
      `src/__tests__/App.browser.test.tsx`. Correr
      `git grep -nE "div\.grid|> div|gridcell|querySelectorAll" -- src` sobre la base real antes de
      empezar el paso, y arreglar **todos** los que aparezcan
- [ ] T011 `role="grid"` en el contenedor de la grilla, con `aria-label` y `aria-rowcount`/`aria-colcount`
      leídos de `GRID_W`/`GRID_H` y no escritos a mano — **AC9**
- [ ] T012 Comentario con por qué son **filas reales** y no `display: contents`: esa técnica ha sacado el
      nodo del árbol de accesibilidad en varios navegadores, o sea justo lo que este spec viene a
      arreglar. Fallaría en silencio y sólo en algunos — D6
- [ ] T013 Confirmar **AC11** con los tests que ya existen **y con el T052 aplicado**: la grilla mide
      `10 × CELL_PX` y el `body` no gana scroll horizontal (`Board.browser.test.tsx:73-95`), y `Playhead`
      sigue en `z-index: 10` (`Playhead.browser.test.tsx:56-66`, que usa `:scope > div` sobre su propio
      contenedor y por eso **no** se ve afectado). Los trajo el **029**, no el 024, y ésta es la primera
      vez que el repo los usa para lo que existen
- [ ] T014 Commit aparte. Es el único cambio del spec que puede mover el layout, y mezclado con
      `tabIndex` nuevos el diff deja de ser legible

## Paso 3 — El foco

- [ ] T015 `App.tsx`: la celda enfocada **es** `hover`. Un solo estado, así que el fantasma, el cursor y
      `hoverEdita` funcionan con teclado sin una línea de dibujo nueva — **AC3**, D2
- [ ] T062 Y decirlo al lado, porque es una arista con el **027**: esto le da a `hover` un **segundo
      escritor** —las flechas— con la misma frecuencia por pulsación que el mouse por celda cruzada, o
      sea los mismos **337 elementos** que el 027 mide. El 027 llega antes y mide **sólo el mouse**, así
      que a partir de este merge su número describe **la mitad del sistema**. Queda escrito de los dos
      lados: el 027 es quien mide el costo del estado que este spec duplica, y su medición queda
      incompleta con esto puesto
- [ ] T063 Si el T015 toca el comentario de `src/App.tsx:253-257` —el que explica por qué los dos objetos
      se arman inline—, el número del **027 se escribe ahí primero** y esta nota va debajo: primero la
      medición, después el segundo escritor que la deja corta
- [ ] T016 Roving tabindex: `tabIndex={0}` en la celda del cursor y `-1` en las otras 59. Con el foco
      afuera, el `0` va a una celda de arranque para que el tablero siga siendo alcanzable — **AC1**
- [ ] T017 Flechas: mueven una celda sin salirse de la grilla, y llaman a `preventDefault`. Sin eso la
      flecha scrollea la página **y** el `overflow-x-auto` del tablero — mismo trato que la rueda, mismo
      motivo — **AC2**
- [ ] T018 [P] `Home` / `End`: primera y última celda de **su fila**, sin salirse de ella — **AC14**
- [ ] T019 `onBlur` del contenedor: si el foco se fue del tablero, `hover` vuelve a `null` — lo mismo que
      hace hoy `onMouseLeave`
- [ ] T053 **Y la regla de desempate al revés**: mientras el foco del DOM esté ADENTRO del tablero, el
      `onMouseLeave` de `App.tsx:286` **no** borra `hover`. Sin esto, sacar el mouse de la grilla apaga
      el fantasma de la celda enfocada y el roving tabindex se queda sin ancla — o sea que «la celda
      enfocada ES el hover» es una promesa que el mouse rompe — **AC16**
- [ ] T054 Mover el foco con una flecha llama a `.focus()` sobre la celda destino: cambiar el `tabIndex`
      no mueve el foco del DOM, y sin la llamada el `0` y el foco real se separan a la primera flecha.
      Es React pidiéndole foco a un nodo que React renderiza, no el loop tocándolo (`ui.md:42`)
- [ ] T020 [P] `layout.constants.ts`: los dos anchos del anillo de foco. Los módulos no declaran
      constantes
- [ ] T021 El anillo va en la **caja de afuera**, y el comentario dice las dos cosas: que es el único
      canal libre que le quedaba a la celda —los seis de la baldosa están tomados, con la tabla— y que
      lo prohibido es `transform: scale`, que **agranda la región scrolleable**. Eso está medido en
      `components/constants/playhead.constants.ts:40-48`, **no** en `Playhead.tsx` — D3
- [ ] T022 Dos tonos, claro adentro y oscuro afuera: abajo puede haber `#FFFF00` (`V`) o `#0000FF` (`W`)
      y un solo color no cubre los dos extremos
- [ ] T055 Y por eso son **dos propiedades**: un `outline` de CSS tiene un solo color. `outline` para el
      claro y `box-shadow` con spread para el oscuro, las dos sobre la caja de afuera. No choca con nada:
      el `box-shadow` de la cabeza lectora lo escribe el loop sobre un nodo propio
      (`playhead-loop.ts:141`) y la baldosa sólo lleva un `shadow-sm` — otro elemento
- [ ] T023 [M] Mirar el anillo sobre las **doce** piezas, sobre la celda vacía, sobre el fantasma y sobre
      una muteada. Y confirmar que no aparecen las barras de scroll del contenedor — **AC7**

## Paso 4 — Las acciones

- [ ] T024 `Enter` y `Espacio` llaman a **`accionDeClick`**, la misma pura que el click, con los mismos
      argumentos. **Sin una segunda copia de la regla** — **AC4**
- [ ] T025 `Alt`+`Enter` y `Alt`+`Espacio` pasan `altKey: true` a esa misma pura: mutear y colocar
      muteada salen solos — **AC4**
- [ ] T056 [M] **Medir si `Alt`+`Espacio` llega a la página en Windows**: ahí es el menú de ventana del
      sistema, y este repo se desarrolla en Windows (`input.ts:27-28`). Si no llega, la fila de D5 se
      recorta a `Alt`+`Enter` y se escribe por qué — mismo trato que el `Ctrl`+click de macOS del 013
- [ ] T026 Comentario: si mañana `Alt` cambia de significado, el teclado lo hereda sin que nadie se
      acuerde de tocarlo. Es lo que hace que la tabla del spec no sea una promesa
- [ ] T027 `App.tsx`: región `aria-live="polite"` con el resultado de las tres ediciones — colocar,
      quitar, mutear — **AC10**. Es el **primero** del repo: hoy `src/` no tiene ninguno, sólo dos
      `aria-label` (`OrientationPanel.tsx:83`, `TransportPanel.tsx:53`)
- [ ] T028 Y **nada más** en esa región: ni el recorrido, ni la cabeza lectora, ni el espectro. Anunciar
      a 10 Hz es hostil, y ya está anotado como seguimiento del 025
- [ ] T029 El texto del anuncio sale de `cell-name.ts` y del nombre de la pieza, no de una cadena escrita
      a mano en el shell

## Paso 5 — Tests, registro y cierre

Los seis de abajo van **sin `[P]`**: los seis caen en `src/__tests__/App.browser.test.tsx`, que es el
único que monta el shell entero — y AC1, AC5 y AC6 necesitan la paleta, el transporte y el listener
global de `window` en la misma página. Dos `[P]` del mismo bloque no pueden tocar el mismo archivo.

- [ ] T030 `src/__tests__/App.browser.test.tsx`: desde la paleta, **un** `Tab` llega al tablero y **otro**
      lo pasa de largo — **AC1**, **AC12**
- [ ] T031 Mismo archivo: las flechas mueven el foco y el `body` no scrollea — **AC2**
- [ ] T057 Mismo archivo: `Home` y `End` van a la primera y a la última celda de su fila — **AC14**
- [ ] T032 Mismo archivo: `Enter` coloca, `Enter` sobre la propia pieza quita, `Alt`+`Enter` mutea —
      **AC4**
- [ ] T033 Mismo archivo: con una celda enfocada, la barra **no** alterna el transporte; con un
      `<button>` enfocado tampoco; con el foco en el `body`, sí — **AC5**
- [ ] T034 Mismo archivo: con una celda enfocada, `Shift` **sí** rota y `Ctrl` **sí** refleja — **AC6**.
      Va separado del T033 a propósito: uno verifica que se apagó, el otro que no se apagó de más
- [ ] T058 Mismo archivo: con el foco en una celda, sacar el mouse de la grilla **no** apaga el fantasma
      — **AC16**
- [ ] T059 [P] `components/__tests__/Board.browser.test.tsx`: la grilla es `role="grid"` con seis
      `role="row"` de diez `role="gridcell"`, y una sola celda con `tabIndex={0}` — **AC9**
- [ ] T035 [M] Recorrer el tablero entero con teclado y un lector de pantalla: colocar, quitar y mutear
      sin tocar el mouse
- [ ] T036 `specs/deuda.md`: se borra el ítem «El tablero no se puede tocar con el teclado»
- [ ] T037 **«Tampoco hay deshacer» NO se va con él**: se separa en su propio ítem, y con el argumento de
      que este spec lo hace **más** necesario — ahora la operación destructiva también se alcanza sin
      querer, con una tecla
- [ ] T038 [P] `.claude/rules/ui.md`, **debajo de lo que ya escribió el 025**: el 025 va primero y deja
      ahí su regla de nombre accesible (las tres cláusulas), así que esto se agrega abajo y no la pisa.
      El modelo de foco del repo — una parada por región compuesta, flechas adentro, roving tabindex, y
      el estado del cursor viviendo en el shell. Al escribirla **se cierra por su nombre el `T025` de
      Seguimiento del 025**, que quedó esperando exactamente este modelo para su `radiogroup`.
      **«Cerrar por su nombre» es escribir la regla, no marcar la casilla**: el `[x]` del `T025` del
      025 no se toca desde acá. Cada rama marca sólo lo que hizo, y esa casilla está bajo
      `Seguimiento`, que `spec_status` ya descuenta — marcarla desde otro spec la sacaría del
      registro sin que nadie haya escrito el `radiogroup`
- [ ] T060 Y en el mismo archivo (sin `[P]`: es el mismo `ui.md` del T038), la guarda del handler global (`.claude/rules/ui.md:143-145`) gana
      su tercer caso. Se escribe **acá y no antes**: hoy esa línea describe el repo tal cual es, y
      adelantarla la haría describir un repo que todavía no existe. Texto:

      > - **El handler global se saltea `<button>` e `<input>`**: si se saltea el evento, el navegador
      >   tiene que quedárselo entero — es lo que evita el doble disparo con un control enfocado sin
      >   recurrir a un `blur()` a mano. **Una celda del tablero es el caso intermedio y va por su propia
      >   pregunta**: se lleva la barra, el `Enter` y las flechas, y deja pasar todo lo demás. Ensanchar
      >   la guarda vieja apagaría también `Shift` y `Ctrl` justo donde más se usan.
- [ ] T039 [P] `DESIGN.md`, **debajo de lo que ya escribió el 025**: ese párrafo lo toca el 025 primero
      con su mitad no visual, así que esta fila va abajo. La sección de canales de la celda —hoy prosa,
      con la frase del 014 «el canal disponible es el borde, la opacidad o la superposición»— gana la
      entrada del foco: la **caja de afuera**, y que con eso se acabaron. Si se convierte en tabla, va
      con las seis filas de D3
- [ ] T061 Y la frase (sin `[P]`: es el mismo `DESIGN.md` del T039) que hace que las dos convivan, que hoy no está dicha en ningún lado: **el
      anillo de foco y el canal del 025 son complementarios, no rivales**. El 025 reclama el canal **no
      visual** —el árbol de accesibilidad, `aria-pressed` y el nombre— y este spec reclama la **caja de
      afuera**. Son dos ejes distintos, y por eso agotar uno no agota el otro
- [ ] T040 [P] `Board.tsx`: reescribir el párrafo del `title` que hoy dice «NO es accesibilidad».
      **Ahora sí lo es**, y el `title` pasa a ser el eco del nombre en vez de la única fuente
- [ ] T041 `pnpm verify` verde, con el coverage al **100** en las cuatro métricas que dejó el 029:
      `cell-name.ts`, las ramas nuevas de `input.ts` y los handlers de `Board.tsx`/`App.tsx` vienen con
      su test — **AC13**
- [ ] T042 Actualizar la fila del 026 en `specs/log.md` a `Implementado` — **queda abierta a propósito**:
      el estado lo mueve el merge
- [ ] T043 PR contra `main`

## Seguimiento (no bloquea)

- [ ] T044 **Deshacer.** Sigue sin existir y este spec lo hace más necesario (T037). Es una decisión
      propia: qué se deshace, cuánta historia, y si el circuito que está sonando participa
- [ ] T045 **El 021 reescribe `Board.tsx`** y mueve `CELL_PX` a una custom property. Lo que agrega este
      spec —roles, filas, `tabIndex`, teclado— es ortogonal a la medida y sobrevive, pero el archivo se
      toca dos veces. Verificar al implementar el 021 que las seis filas siguen ahí
- [ ] T046 **El 018 es la otra mitad de tocar sin mouse**: elegir la pieza con su letra. Cero
      superposición en la tabla de teclas — este spec usa flechas, `Enter`, barra y `Alt`
- [ ] T047 **El `radiogroup` del 025** ya tiene con qué ser consistente: el modelo de foco del T038
- [ ] T048 **Los 22 botones tampoco tienen anillo de foco propio**: hoy usan el del navegador. Con el
      anillo de la celda definido, unificarlos es barato y es otra decisión — el 019 y el 020 están
      cambiando cuáles son esos botones

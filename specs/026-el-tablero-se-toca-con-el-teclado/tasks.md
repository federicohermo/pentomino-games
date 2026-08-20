# Tasks 026 — El tablero se toca con el teclado

Formato en [`specs/README.md`](../README.md). **Conviene con el 024 mergeado**: cinco ACs se verifican en
navegador, y AC5 y AC6 no tienen forma de verificarse en `environment: 'node'`.

## Paso 1 — Las puras, antes de tocar el componente

- [ ] T001 `components/cell-name.ts`: el nombre accesible de una celda, armado desde lo que ya devuelven
      `occupantAt` y `cellTextFor`. Cuatro casos: vacía, ocupada, ocupada y muteada, y el criterio de qué
      **no** entra (el fantasma, que es transitorio) — **AC8**
- [ ] T002 Docblock con por qué vive afuera del `.tsx`: adentro no se puede exportar y por lo tanto no se
      puede testear. Precedente exacto: `cell-text.ts`, que nació por esto mismo
- [ ] T003 [P] `components/__tests__/cell-name.test.ts`: los cuatro casos
- [ ] T004 `components/types/input.types.ts`: `EventoDeTecla` gana `targetEsCelda: boolean`, con el
      docblock que lo distinga de `targetEsControl` — uno dice «el navegador se queda **todo**», el otro
      «el tablero se queda **la barra, el Enter y las flechas**»
- [ ] T005 `input.ts::accionDeTecla`: con `targetEsCelda`, `' '` devuelve `null` — **AC5**
- [ ] T006 **`Shift` y `Control` siguen devolviendo su acción con `targetEsCelda: true`** — **AC6**. No
      es un caso de borde: es la decisión entera del spec. Un `if (e.targetEsCelda) return null` al
      principio de la pura pasa todos los demás tests y rompe los dos atajos del 013
- [ ] T007 `input.ts::frenaElDefault`: la barra sigue frenando el default con la celda enfocada — el
      scroll hay que pararlo igual, lo maneje quien lo maneje
- [ ] T008 `__tests__/input.test.ts`: la tabla de la asimetría de T005/T006 como oráculo explícito, con
      un comentario que diga que las tres filas juntas son el AC. Por separado no dicen nada
- [ ] T009 `use-input.ts`: el predicado del DOM para la celda (`closest('[role="gridcell"]')`). Va en el
      hook y no en la pura, por la regla de siempre: `input.ts` tiene que poder cargarse en
      `environment: 'node'`

## Paso 2 — Las filas (commit propio, sin nada de teclado)

- [ ] T010 `Board.tsx`: de 60 hijos planos a seis `role="row"` de diez `role="gridcell"`, sin `gap`,
      mismas medidas — **AC9**
- [ ] T011 `role="grid"` en el contenedor de la grilla, con `aria-label` y `aria-rowcount`/`aria-colcount`
      leídos de `GRID_W`/`GRID_H` y no escritos a mano — **AC9**
- [ ] T012 Comentario con por qué son **filas reales** y no `display: contents`: esa técnica ha sacado el
      nodo del árbol de accesibilidad en varios navegadores, o sea justo lo que este spec viene a
      arreglar. Fallaría en silencio y sólo en algunos — D6
- [ ] T013 Confirmar **AC11** con los dos tests del 024 que ya existen: la grilla mide `10 × CELL_PX`, el
      `body` no gana scroll horizontal, y `Playhead` sigue en `z-index: 10`. **Es la primera vez que el
      repo usa esos tests para lo que existen**
- [ ] T014 Commit aparte. Es el único cambio del spec que puede mover el layout, y mezclado con
      `tabIndex` nuevos el diff deja de ser legible

## Paso 3 — El foco

- [ ] T015 `App.tsx`: la celda enfocada **es** `hover`. Un solo estado, así que el fantasma, el cursor y
      `hoverEdita` funcionan con teclado sin una línea de dibujo nueva — **AC3**, D2
- [ ] T016 Roving tabindex: `tabIndex={0}` en la celda del cursor y `-1` en las otras 59. Con el foco
      afuera, el `0` va a una celda de arranque para que el tablero siga siendo alcanzable — **AC1**
- [ ] T017 Flechas: mueven una celda sin salirse de la grilla, y llaman a `preventDefault`. Sin eso la
      flecha scrollea la página **y** el `overflow-x-auto` del tablero — mismo trato que la rueda, mismo
      motivo — **AC2**
- [ ] T018 [P] `Home` / `End`: primera y última celda de la fila — D5
- [ ] T019 `onBlur` del contenedor: si el foco se fue del tablero, `hover` vuelve a `null` — lo mismo que
      hace hoy `onMouseLeave`
- [ ] T020 [P] `layout.constants.ts`: los dos anchos del anillo de foco. Los módulos no declaran
      constantes
- [ ] T021 El anillo va en la **caja de afuera** con `outline`, y el comentario dice las dos cosas: que
      es el único canal libre que le quedaba a la celda —los seis de la baldosa están tomados, con la
      tabla— y que es `outline` y no `box-shadow` porque es ink overflow y **no agranda la región
      scrolleable**, que es lo que `Playhead.tsx` midió para el `scale` — D3
- [ ] T022 Dos tonos, claro adentro y oscuro afuera: abajo puede haber `#FFFF00` (`V`) o `#0000FF` (`W`)
      y un solo color no cubre los dos extremos
- [ ] T023 [M] Mirar el anillo sobre las **doce** piezas, sobre la celda vacía, sobre el fantasma y sobre
      una muteada. Y confirmar que no aparecen las barras de scroll del contenedor — **AC7**

## Paso 4 — Las acciones

- [ ] T024 `Enter` y `Espacio` llaman a **`accionDeClick`**, la misma pura que el click, con los mismos
      argumentos. **Sin una segunda copia de la regla** — **AC4**
- [ ] T025 `Alt`+`Enter` y `Alt`+`Espacio` pasan `altKey: true` a esa misma pura: mutear y colocar
      muteada salen solos — **AC4**
- [ ] T026 Comentario: si mañana `Alt` cambia de significado, el teclado lo hereda sin que nadie se
      acuerde de tocarlo. Es lo que hace que la tabla del spec no sea una promesa
- [ ] T027 `App.tsx`: región `aria-live="polite"` con el resultado de las tres ediciones — colocar,
      quitar, mutear — **AC10**
- [ ] T028 Y **nada más** en esa región: ni el recorrido, ni la cabeza lectora, ni el espectro. Anunciar
      a 10 Hz es hostil, y ya está anotado como seguimiento del 025
- [ ] T029 El texto del anuncio sale de `cell-name.ts` y del nombre de la pieza, no de una cadena escrita
      a mano en el shell

## Paso 5 — Tests, registro y cierre

- [ ] T030 [P] Test de navegador: desde la paleta, **un** `Tab` llega al tablero y **otro** lo pasa de
      largo — **AC1**, **AC12**
- [ ] T031 [P] Test: las flechas mueven el foco y el `body` no scrollea — **AC2**
- [ ] T032 [P] Test: `Enter` coloca, `Enter` sobre la propia pieza quita, `Alt`+`Enter` mutea — **AC4**
- [ ] T033 [P] Test: con una celda enfocada, la barra **no** alterna el transporte; con un `<button>`
      enfocado tampoco; con el foco en el `body`, sí — **AC5**
- [ ] T034 [P] Test: con una celda enfocada, `Shift` **sí** rota y `Ctrl` **sí** refleja — **AC6**. Va
      separado del T033 a propósito: uno verifica que se apagó, el otro que no se apagó de más
- [ ] T035 [M] Recorrer el tablero entero con teclado y un lector de pantalla: colocar, quitar y mutear
      sin tocar el mouse
- [ ] T036 `specs/deuda.md`: se borra el ítem «El tablero no se puede tocar con el teclado»
- [ ] T037 **«Tampoco hay deshacer» NO se va con él**: se separa en su propio ítem, y con el argumento de
      que este spec lo hace **más** necesario — ahora la operación destructiva también se alcanza sin
      querer, con una tecla
- [ ] T038 [P] `.claude/rules/ui.md`: el modelo de foco del repo — una parada por región compuesta,
      flechas adentro, roving tabindex, y el estado del cursor viviendo en el shell. Es lo que el 025
      dejó esperando para su `radiogroup`
- [ ] T039 [P] `DESIGN.md`: la tabla de canales de la celda gana su última fila —la caja de afuera, el
      foco— y la frase de que se acabaron. Es la misma que el 014 dejó escrita para el muteo
- [ ] T040 [P] `Board.tsx`: reescribir el párrafo del `title` que hoy dice «NO es accesibilidad».
      **Ahora sí lo es**, y el `title` pasa a ser el eco del nombre en vez de la única fuente
- [ ] T041 `pnpm verify` verde — **AC13**
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

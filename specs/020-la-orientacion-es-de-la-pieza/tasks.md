# Tasks — Spec 020

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — El tipo y el valor inicial

- [ ] T001 [P] `src/components/types/orientacion.types.ts`: `Orientacion`
      (`{ rotation, mirror }`) y el tipo de la memoria (`Record<PieceKey, Orientacion>`). Docblock con
      por qué **no** va en `domain/types/`: la memoria es estado del shell, y el modelo ya tiene su
      representación en `PlacedPiece`
- [ ] T002 [P] `src/components/constants/orientacion.constants.ts`: la orientación inicial y la
      memoria inicial **derivada de `SHAPES`**, no escrita a mano con las doce letras. El estrechado
      es el que el repo ya usa —`Object.keys(SHAPES) as PieceKey[]`—, no uno nuevo. Los dos testigos
      se buscan **por símbolo, no por línea**: el `.map` de los doce botones, que con el spec 022 se
      mudó de `PiecePalette.tsx` a `src/components/PanelDeOrientacion.tsx` —justo el símbolo que esta
      tarea daba por estable en el archivo viejo, y la razón por la que ya no vale citarlo por línea
      tampoco cambió: es un archivo chico y cualquier spec que lo toque corre las líneas de abajo—, y
      `PIECES` en `src/domain/invariants.ts`, que ningún spec de por medio toca — **AC6**
- [ ] T003 `orientacion.constants.ts` + `orientacion.types.ts`: **acotar `rotation`**. Const-object
      `ROTACION` en `constants/` y union derivado `Rotacion` en `types/` —la forma que `specs/deuda.md`
      ya dejó decidida, **nunca un `enum`** (`erasableSyntaxOnly` lo rechaza)—, y `Orientacion.rotation`
      pasa de `number` a `Rotacion`. Escribe los archivos de T001 y T002, así que **no lleva `[P]`**.
      Se hace acá y no se diere por dos razones medidas. Una: **no cruza el borde de paquete** —
      `rotateN`, `arpeggioFor`, `miniCells` y `PlacedPiece.rotation` siguen tomando `number` y un
      `0|1|2|3` es asignable sin tocar una sola firma de `domain/`, así que `mcp-server/` ni se entera—.
      Dos: **este spec crea el hogar del tipo**, y meter ahí un `number` sin acotar sería estrenar el
      archivo replicando la deuda, que es peor que dejarla donde estaba — **AC16**
- [ ] T041 `components/input.ts`: `rotacionPorRueda(rotation: number, deltaY: number): number` pasa a
      `Rotacion` en los dos extremos. El `(rotation + 4 + delta) % 4` que ya tiene **es** la
      normalización, con el `+ 4` que evita el resto negativo —el `%` de JS conserva el signo del
      dividendo—, así que el cuerpo no cambia: lo que cambia es que ahora el tipo dice lo que el
      cuerpo garantiza. El `as` de la aserción va **una sola vez y ahí**, con el comentario de por qué
      es seguro — **AC16**
- [ ] T042 `components/__tests__/input.test.ts`: el test de `rotacionPorRueda` cubre el caso negativo
      (`deltaY < 0` desde `0`), que es el que el `+ 4` existe para atrapar y el que la red del 017
      tardó **dos intentos** en cerrar. Si ya está, verificarlo y no duplicarlo — **AC16**
- [ ] T043 Comentario **en `orientacion.types.ts`, junto a `Rotacion`**: qué queda y qué no. Esto
      **no cierra** la deuda de `specs/deuda.md`, la **achica**: `domain/` sigue tomando `number` y ese
      es el tramo que cruza el borde. Lo que sí cierra es el camino: la rotación entra al modelo
      **desde** `Orientacion`, así que con la fuente acotada `domain/` ya no puede recibir un valor
      fuera de `0..3` por esta vía — que es exactamente el escenario que el 017 documentó, donde
      `base[j + rot]` daba `undefined` y `midiName` no explotaba sino que pintaba `undefinedNaN` en la
      celda. Escribe el archivo de T001: **sin `[P]`**

## Paso 2 — La memoria entra al shell

- [ ] T004 `App.tsx`: **borrar** los dos `useState` de `rotation` y `mirror` y poner el `Record`. El
      typecheck en rojo es la lista de trabajo del resto del paso — misma técnica que el 017 usó al
      sacarle el default al parámetro del régimen
- [ ] T005 `App.tsx`: derivado local `const { rotation, mirror } = orientaciones[selected]`, para no
      reescribir cada uso
- [ ] T006 `App.tsx`: `transformedShape` y `noteSet` leen la orientación de la seleccionada y ajustan
      dependencias — **AC10**
- [ ] T007 `App.tsx`: `handleCellClick` arma el `PlacedPiece` con el par de la pieza en la mano —
      **AC11**
- [ ] T008 `App.tsx` + `src/components/types/panel.types.ts`: el campo `rotation`/`mirror` de
      `PropsDeOrientacion` —hoy el par de la seleccionada, que el spec 022 dejó ahí al partir
      `PiecePalette` en dos objetos— pasa a ser `orientaciones` **entera** (las doce miniaturas de
      `PanelDeOrientacion.tsx` necesitan las doce), y el literal inline que arma `orientacion` en
      `App.tsx` baja el `Record` en vez de `rotation`/`mirror` sueltos. Con `selected` +
      `orientaciones` los lectores que hoy toman su par de esas dos props sueltas —las miniaturas y
      el `aria-label` en `PanelDeOrientacion.tsx`, la fila de Rotación/Reflexión y la línea del 019
      en `PiecePalette.tsx`— pasan a derivarlo con `orientaciones[selected]` (o `orientaciones[key]`
      adentro del `.map` de las miniaturas), y dejarlos leyendo dos props sueltas sería una segunda
      fuente de la misma verdad. `Board` **sí** sigue recibiendo el par suelto de la seleccionada por
      su prop propia: es el único que no necesita las doce
- [ ] T009 `App.tsx`: desde el spec 022 no hay «el efecto de teclado» en este archivo —vive en
      `useAtajosDeTeclado`, `components/use-entrada.ts`, y ese hook no se toca—; lo que este spec
      reescribe son los dos `useCallback` que le arman `acciones`: `rotarConTecla` y
      `reflejarConTecla`. Cada uno escribe **una sola ranura** de `orientaciones` con setter
      funcional; objeto nuevo, nunca mutación — **AC1**, **AC2**
- [ ] T010 `App.tsx`: el `useCallback` de `alRotar` pasa a rotar la ranura de la pieza
      seleccionada y no un `rotation` global. **No puede resolverse agregando `selected` a sus
      dependencias**: `alRotar` tiene deps vacías a propósito desde el spec 022 —es lo que deja que
      `useRuedaRota` (`components/use-entrada.ts`) registre el listener de `wheel` una sola vez por
      montaje—, y agregarle una dependencia rompe esa cardinalidad (**AC16 del 022**). La salida es
      leer `selected` sin declararlo como dependencia: por ejemplo con un `ref` que lo siga
      (`selectedRef.current`), o resolviendo la ranura adentro del setter funcional sin cerrar sobre
      el `selected` del scope externo. `alRotar` se queda con deps vacías — **AC1**
- [ ] T011 `App.tsx`: **reescribir el comentario del `useCallback` de `alRotar`.** Hoy dice que su
      cuerpo «usa el setter funcional y no lee `rotation`», y con este spec sí necesita saber qué
      ranura del `Record` rotar. La salida que T010 documenta —leer `selected` por un `ref` y no por
      dependencia— es la que hay que anotar y por qué: la alternativa obvia, agregar `selected` a
      las dependencias de `alRotar` para que sea el propio hook el que se re-suscriba, rompe AC16
      del 022 (la suscripción única del listener de `wheel`), así que no es una opción disponible
      como lo era antes de que esa AC existiera. Un `selectedRef` no es "esconder de dónde sale
      `selected`": el `ref` queda nombrado y comentado, sólo que leerlo no dispara una re-suscripción
- [ ] T012 `App.tsx`: verificar que no aparece Context, Redux ni singleton — la memoria vive en el
      shell y baja por props — **AC14**
- [ ] T033 `App.tsx`: `handleContextMenu` —**por símbolo**: es `:374` sobre `main`, pero el 018 y el
      019 escriben `App.tsx` antes que este spec y el número no sobrevive— escribe **una sola ranura**
      con setter funcional.
      Es el **octavo** consumidor y la mitad «botón derecho» de AC2 — el único consumidor que no
      pasa por un efecto ni por un `useMemo`, así que es el que se escapa si se busca a mano en vez
      de borrar los `useState` primero — **AC2**
- [ ] T034 `App.tsx`: la decisión de cada gesto **no se muda al `.tsx`** — `accionDeTecla`,
      `frenaElDefault`, `rotacionPorRueda`, `abreTapLimpio` y `reflejaElContextMenu` siguen en
      `src/components/input.ts` con sus tests en `environment: 'node'`. Lo que cambia es el cableado,
      no la pura — **AC13**

- [ ] T038 `App.tsx` + `src/components/types/panel.types.ts`: el **handler del botón `0°`** —escribe
      una sola ranura con `ORIENTACION_INICIAL`, setter funcional y objeto nuevo— y el campo nuevo
      de `PropsDeOrientacion` que lo baja. Desde el spec 022 `PiecePalette` ya no recibe dieciséis
      props sueltas sino el objeto `orientacion` entero, así que esto no es agregar una prop a la
      firma de `PiecePalette`: es un campo más en `PropsDeOrientacion` y una línea más en el literal
      inline de `App.tsx`. Sin esta tarea **AC7 no tiene implementación**: `PiecePalette` es
      presentacional (`.claude/rules/ui.md`) y no puede escribir estado, y el 019 justamente le saca
      del mismo objeto las otras dos props de gesto (`onRotate`, `onMirror`), así que no queda
      ninguna que se le pueda reusar — **AC7**

- [ ] T040 `components/use-entrada.ts`: la cadena de `if`/`else` de `despachar`, adentro de
      `useAtajosDeTeclado`, tiene desde el **018** una rama `ACCION.seleccionar` que **no lee
      `rotation` ni `mirror`**. Con el spec 022 puesto, esa cadena ya no vive en `App.tsx` ni este
      spec la reescribe: los tres callbacks del shell (`rotar`, `reflejar`, `transporte`) son opacos
      para el hook, así que el typecheck en rojo de T004 —que es cómo este spec enumera sus
      consumidores— ni siquiera puede llegar hasta acá para no marcarla, porque este archivo no
      menciona `rotation` ni `mirror`. El riesgo que esta tarea cazaba a mano queda estructuralmente
      cerrado por el 022; lo que queda es confirmarlo: verificar que la rama sigue en `despachar` y
      sigue como `else if` **antes** del `else transporte()` que cierra la cadena, y que ningún
      callback nuevo del shell hace falta agregarle a la interfaz `Acciones` para sostenerla. Si se
      cae, la letra pasa a arrancar el transporte y **ninguna prueba de este spec ni del 018 lo
      detecta** —los tests del 018 son de la pura `input.ts`, que acá no se toca y sigue en verde—.
      Es el mismo mecanismo por el que `handleContextMenu` hubo que cazarlo a mano (T033). Si el 018
      todavía no está mergeado, la tarea se cierra con «no existía» — **018 AC1**

> T004–T012, T033, T034 y T038 escriben `src/App.tsx` (T008 y T038 además `src/components/types/panel.types.ts`), así que ninguna lleva `[P]`. T040 pasó a verificar `components/use-entrada.ts`, que este spec no escribe.

## Paso 3 — La paleta muestra doce orientaciones

- [ ] T013 `src/components/PanelDeOrientacion.tsx` —el `.map` de las doce se mudó ahí desde
      `PiecePalette.tsx` con el spec 022—: `miniCells` se llama con el par de **cada** pieza, leyendo
      `orientaciones[key].rotation`/`.mirror` adentro del mismo `.map` sobre `Object.keys(SHAPES)`, y
      no las `rotation`/`mirror` de la seleccionada que hoy usa para las doce —el bug que le da
      nombre al spec— **AC4**
- [ ] T014 `src/components/PanelDeOrientacion.tsx` —se mudó junto con el `.map` de T013—: el
      `aria-label` de cada botón dice **su** orientación, no la global. Sigue llamando a
      `textoDeOrientacion(rotation, mirror)` —la pura que crea el 019 (su T006), en su módulo propio
      de `components/`— sólo que con el par de cada pieza. **AC13 del 019 sigue valiendo**: la
      derivación se escribe una sola vez, y este spec sólo le cambia los argumentos
- [ ] T015 `PiecePalette.tsx` —se queda ahí: el spec 022 sólo le sacó a este archivo la grilla de
      miniaturas (`PanelDeOrientacion.tsx`) y el bloque `border-t` del transporte
      (`PanelDeTransporte.tsx`), y la línea de orientación no es ninguno de los dos—: la línea de
      orientación del 019 llama a la misma `textoDeOrientacion` con `orientaciones[selected]` —
      **AC9**
- [ ] T016 `PiecePalette.tsx`: el botón `0°` junto a esa línea, cableado al campo nuevo de
      `PropsDeOrientacion` (T038) —que le llega ya adentro del objeto `orientacion` que este
      componente recibe entero desde el spec 022, no como prop suelta—, con `aria-label` y `title`
      que digan las dos cosas que hace (la etiqueta sólo dice los grados) — **AC7**
- [ ] T017 Comentario **en `PiecePalette.tsx`, sobre el botón `0°`**: por qué `0°` y no un icono (al
      lado hay un `↺` y dos «volver atrás» tienen que distinguirse), y por qué resetea **también** la
      reflexión (los 29 de 96 del 019 §3). El `↺` que compara ya no es un control del mismo archivo:
      desde el spec 022 el botón de Reset vive en `PanelDeTransporte.tsx`, un componente hermano
      dentro de la misma tarjeta. El comentario tiene que decir eso —dos "volver atrás" en la misma
      tarjeta pero en dos archivos distintos— y no dar por sentado que están en el mismo `.tsx`
- [ ] T018 Comentario en el docblock de `MINI_BOX`
      (`src/components/constants/layout.constants.ts`): la caja fija del 016 pasa a ser **más**
      necesaria, porque ahora las doce formas cambian independientemente. El argumento está duplicado
      en `src/components/piece-mini.ts:19` (docblock, sección «Por qué la caja es fija») y en
      `DESIGN.md:149` (bullet «La caja es fija, de 5×5 celdas») — los tres tienen que quedar diciendo
      lo mismo

## Paso 4 — `↺` no toca las orientaciones

- [ ] T019 `App.tsx`: `resetBoard` **no cambia lo que hace**. Con el spec 022 puesto su cuerpo ya
      cambió —llama a `frenarTransporte()` (`components/use-motor.ts`) en vez de `stopClock()`, y se
      corrió de línea— pero eso es cableado y no comportamiento: sigue frenando el reloj, vaciando
      `placed` y sin tocar ninguna orientación, que es lo que a este spec le importa. Se le agrega el
      comentario de por qué no toca `ORIENTACIONES_INICIALES` pese a que existe justo al lado. Con el
      costo escrito: se renuncia al invariante «después de `↺` la app queda como recién abierta» —
      **AC8**

## Verificación

- [ ] T020 `pnpm verify` en verde
- [ ] T021 [M] Navegador: rotar con la rueda y confirmar que **las once miniaturas no seleccionadas no
      se mueven** — **AC3**. Es el criterio que da nombre al spec
- [ ] T022 [M] Navegador: `F` a 180°, ir a `T`, volver a `F` → sigue a 180° — **AC5**
- [ ] T023 [M] Navegador: poner las doce en orientaciones distintas y confirmar que la grilla de
      botones **no reflowea** — **AC12**
- [ ] T024 [M] Navegador: el botón `0°` deja la seleccionada a 0° sin reflejar y no toca las otras
      once — **AC7**
- [ ] T025 [M] Navegador: colocar una pieza, rotar la de la mano, y confirmar que la colocada no
      cambia ni de forma ni de sonido — **AC11**
- [ ] T026 [M] Navegador: `↺` vacía el tablero y **deja** las orientaciones como estaban — **AC8**
- [ ] T027 [M] Navegador: al cargar, las doce a 0° sin reflejar — **AC6**
- [ ] T035 [M] Navegador: los tres gestos que **no** son la rueda — `Shift`, `Ctrl` y **botón
      derecho** — cambian sólo la pieza en la mano. El botón derecho es el que tiene tarea propia
      (T033) y el único que no pasa por un efecto — **AC1**, **AC2**
- [ ] T039 [M] Navegador: medir `CELL_PX` en el DOM **con el botón `0°` puesto** y confirmar que
      sigue en **73** — **AC15**. Es la misma medición que la T022 del 019, repetida porque este spec
      le agrega un botón a la fila que aquél acababa de medir, y el colchón de alto quedó en ~30 px.
      Si da otra cosa, la salida es bajar el `0°` a una fila propia, no mover `CELL_PX`

## Documentación

Van acá y no en `## Seguimiento` porque los specs mergeados no se reescriben pero `docs/` sí se
mantiene al día (desviación 2 de `specs/README.md`): dejar estos dos afirmando en presente lo que
este spec falsifica es la deuda que `d936597` y `eb154a0` ya tuvieron que pagar en lote.

- [ ] T036 [P] `docs/architecture/overview.md`: el diagrama del shell (`:24`) y la tabla de estado
      (`:122`–`:123`) dejan de listar `rotation` `0..3` y `mirror` `boolean` como dos escalares
      sueltos y pasan a la memoria por pieza
- [ ] T037 [P] `DESIGN.md:142`: el botón de la paleta ya no se dibuja «en la orientación que está
      seleccionada ahora mismo» sino en **la suya**. Es el párrafo del 016, y el resto de esa sección
      —caja fija, borde, «la miniatura no dice notas»— **no cambia**

## PR

- [ ] T028 Rama `feature/020-la-orientacion-es-de-la-pieza`
- [ ] T029 Actualizar la fila del 020 en `specs/log.md` a `Implementado`
- [ ] T030 Anotar en `specs/revisiones.md` si el spec salió distinto de lo previsto

## Seguimiento (no bloquea)

- [ ] T031 `Orientacion` y `PlacedPiece` repiten los mismos dos campos. Unificarlos es un refactor de
      `domain/` que cruza el borde de paquete (`mcp-server/` importa 31 símbolos), con beneficio cero
      de comportamiento. Anotar en `specs/deuda.md`.
      Y en la **misma pasada**, poner al día la entrada de la rotación sin acotar, que dice «comparada
      contra `0|1|2|3` en **cuatro** lugares» desde el 005 y ya iba por seis —el 013 declaró el quinto
      (`T033`) y el 016 el sexto (`T039`)—. Este spec la **achica y no la cierra**: `Rotacion` acota la
      fuente en `components/` (T003, T041), así que lo que queda es el tramo de `domain/` —`rotateN`,
      `arpeggioFor`, `PlacedPiece.rotation`—, que es el que cruza el borde hacia `mcp-server/` y sigue
      necesitando spec propio. Escribir eso, con el alcance nuevo y no con la cuenta vieja
- [ ] T032 La memoria no persiste: cerrar la pestaña olvida las doce orientaciones. Fuera de alcance a
      propósito — el tablero tampoco persiste

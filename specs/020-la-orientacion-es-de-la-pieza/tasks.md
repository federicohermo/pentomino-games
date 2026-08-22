# Tasks — Spec 020

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — El tipo y el valor inicial

- [x] T001 [P] `src/components/types/orientation.types.ts`: `Orientacion`
      (`{ rotation, mirror }`) y el tipo de la memoria (`Record<PieceKey, Orientacion>`). Docblock con
      por qué **no** va en `domain/types/`: la memoria es estado del shell, y el modelo ya tiene su
      representación en `PlacedPiece`.
      **El nombre del archivo va en inglés y no en castellano**, y no es cosmética: los archivos de
      `src/` están **todos** en inglés y los siete que el 022 estrenó en castellano se revirtieron
      (`specs/revisiones.md`, 2026-08-20; sobre el commit base había 57 archivos y cero en
      castellano). La regla que quedó **no es simétrica**: nombre de archivo en inglés siempre,
      identificador en castellano permitido **sólo dentro de `components/`** —hay 21 exportados
      así—, así que el tipo `Orientacion` sí se llama en castellano y el archivo no. El caso peor
      medido fue `motor.ts`, donde la misma cosa quedó nombrada de dos formas en dos idiomas, que
      es peor que cualquiera de las dos por separado. El 021 crea `cell-px.ts` en el mismo lote y
      con el mismo criterio
- [x] T002 [P] `src/components/constants/orientation.constants.ts`: la orientación inicial y la
      memoria inicial **derivada de `SHAPES`**, no escrita a mano con las doce letras. El estrechado
      es el que el repo ya usa —`Object.keys(SHAPES) as PieceKey[]`—, no uno nuevo. Los dos testigos
      se buscan **por símbolo, no por línea**: el `.map` de los doce botones, que con el spec 022 se
      mudó de `PiecePalette.tsx` a `src/components/OrientationPanel.tsx` —justo el símbolo que esta
      tarea daba por estable en el archivo viejo, y la razón por la que ya no vale citarlo por línea
      tampoco cambió: es un archivo chico y cualquier spec que lo toque corre las líneas de abajo—, y
      `PIECES` en `src/domain/invariants.ts`, que ningún spec de por medio toca — **AC6**
- [x] T003 `orientation.constants.ts` + `orientation.types.ts`: **acotar `rotation`**. Const-object
      `ROTACION` en `constants/` y union derivado `Rotacion` en `types/` —la forma que `specs/deuda.md`
      ya dejó decidida, **nunca un `enum`** (`erasableSyntaxOnly` lo rechaza)—, y `Orientacion.rotation`
      pasa de `number` a `Rotacion`. Escribe los archivos de T001 y T002, así que **no lleva `[P]`**.
      Se hace acá y no se diere por dos razones medidas. Una: **no cruza el borde de paquete** —
      `rotateN`, `arpeggioFor`, `miniCells` y `PlacedPiece.rotation` siguen tomando `number` y un
      `0|1|2|3` es asignable sin tocar una sola firma de `domain/`, así que `mcp-server/` ni se entera—.
      Dos: **este spec crea el hogar del tipo**, y meter ahí un `number` sin acotar sería estrenar el
      archivo replicando la deuda, que es peor que dejarla donde estaba — **AC16**
- [x] T041 `components/input.ts`: `rotacionPorRueda(rotation: number, deltaY: number): number` pasa a
      `Rotacion` en los dos extremos. El `(rotation + 4 + delta) % 4` que ya tiene **es** la
      normalización, con el `+ 4` que evita el resto negativo —el `%` de JS conserva el signo del
      dividendo—, así que el cuerpo no cambia: lo que cambia es que ahora el tipo dice lo que el
      cuerpo garantiza. El `as` de la aserción va **una sola vez y ahí**, con el comentario de por qué
      es seguro — **AC16**
- [x] T042 `components/__tests__/input.test.ts`: el test de `rotacionPorRueda` cubre el caso negativo
      (`deltaY < 0` desde `0`), que es el que el `+ 4` existe para atrapar y el que la red del 017
      tardó **dos intentos** en cerrar. **Verificado hoy: ya está** —`components/__tests__/input.test.ts`,
      «da la vuelta en los dos bordes», con `expect(rotacionPorRueda(0, -120)).toBe(3)`—, así que
      esta tarea **no agrega un test**: verifica que sigue ahí y que sigue compilando después de
      T041, o sea que el test pasa a escribirse contra `Rotacion` y no contra `number` — **AC16**
- [x] T043 Comentario **en `orientation.types.ts`, junto a `Rotacion`**: qué queda y qué no. Esto
      **no cierra** la deuda de `specs/deuda.md`, la **achica**: `domain/` sigue tomando `number` y ese
      es el tramo que cruza el borde. Lo que sí cierra es el camino: la rotación entra al modelo
      **desde** `Orientacion`, así que con la fuente acotada `domain/` ya no puede recibir un valor
      fuera de `0..3` por esta vía — que es exactamente el escenario que el 017 documentó, donde
      `base[j + rot]` daba `undefined` y `midiName` no explotaba sino que pintaba `undefinedNaN` en la
      celda. Escribe el archivo de T001: **sin `[P]`**

## Paso 2 — La memoria entra al shell

- [x] T004 `App.tsx`: **borrar** los dos `useState` de `rotation` y `mirror` y poner el `Record`. El
      typecheck en rojo es la lista de trabajo del resto del paso — misma técnica que el 017 usó al
      sacarle el default al parámetro del régimen
- [x] T005 `App.tsx`: derivado local `const { rotation, mirror } = orientaciones[selected]`, para no
      reescribir cada uso
- [x] T006 `App.tsx`: `transformedShape` y `noteSet` leen la orientación de la seleccionada y ajustan
      dependencias — **AC10**
- [x] T007 `App.tsx`: `handleCellClick` arma el `PlacedPiece` con el par de la pieza en la mano —
      **AC11**
- [x] T008 `App.tsx` + `src/components/types/panel.types.ts`: el campo `rotation`/`mirror` de
      `PropsDeOrientacion` —hoy el par de la seleccionada, que el spec 022 dejó ahí al partir
      `PiecePalette` en dos objetos— pasa a ser `orientaciones` **entera** (las doce miniaturas de
      `OrientationPanel.tsx` necesitan las doce), y el **`useMemo`** que arma `orientacion` en
      `App.tsx` baja el `Record` en vez de `rotation`/`mirror` sueltos. **No es un literal inline:
      el spec 027 lo memoizó** —por símbolo `orientacion`, hoy `App.tsx:314`— y envolvió
      `OrientationPanel` en `memo` (`OrientationPanel.tsx:31`), y las dos mitades son una sola
      barrera medida (4,9 ms → 1,9 ms por escritura de `hover`). Dos consecuencias que esta tarea
      tiene que ejecutar: el array de dependencias pierde `rotation` y `mirror` y gana
      `orientaciones` —lo verifica `react-hooks/exhaustive-deps` en el lint, que es la red que el
      propio comentario de `App.tsx` declara para el campo nuevo—, y la barrera **no se degrada**,
      porque el `Record` cambia de identidad exactamente cuando cambia una orientación y no cuando
      se mueve el cursor. El test que la mide existe y tiene que seguir en verde:
      `src/__tests__/App.browser.test.tsx`, «cruzar diez celdas ya no ejecuta el panel de
      orientacion, y rotar si». Con `selected` +
      `orientaciones` los lectores que hoy toman su par de esas dos props sueltas —las miniaturas y
      el `aria-label` en `OrientationPanel.tsx`, la fila de Rotación/Reflexión y la línea del 019
      en `PiecePalette.tsx`— pasan a derivarlo con `orientaciones[selected]` (o `orientaciones[key]`
      adentro del `.map` de las miniaturas), y dejarlos leyendo dos props sueltas sería una segunda
      fuente de la misma verdad. `Board` **sí** sigue recibiendo el par suelto de la seleccionada por
      su prop propia: es el único que no necesita las doce
- [x] T009 `App.tsx`: desde el spec 022 no hay «el efecto de teclado» en este archivo —vive en
      `useAtajosDeTeclado`, `components/use-input.ts`, y ese hook no se toca—; lo que este spec
      reescribe son los dos `useCallback` que le arman `acciones`: `rotarConTecla` y
      `reflejarConTecla`. Cada uno escribe **una sola ranura** de `orientaciones` con setter
      funcional; objeto nuevo, nunca mutación — **AC1**, **AC2**
- [x] T010 `App.tsx`: el `useCallback` de `alRotar` pasa a rotar la ranura de la pieza
      seleccionada y no un `rotation` global. **No puede resolverse agregando `selected` a sus
      dependencias**: `alRotar` tiene deps vacías a propósito desde el spec 022 —es lo que deja que
      `useRuedaRota` (`components/use-input.ts`) registre el listener de `wheel` una sola vez por
      montaje—, y agregarle una dependencia rompe esa cardinalidad (**AC16 del 022**). La salida es
      leer `selected` sin declararlo como dependencia: por ejemplo con un `ref` que lo siga
      (`selectedRef.current`). **La segunda alternativa que esta tarea listaba —«resolver la ranura
      adentro del setter funcional»— no existe**: el setter funcional de `setOrientaciones` recibe
      el `Record` anterior y nada más, así que no hay forma de que sepa cuál es la pieza en la mano
      sin cerrar sobre `selected` o sin leerlo de un `ref`. Queda el `ref` —o mover `selected`
      adentro del mismo `useState` que la memoria, que es un rediseño de estado y no está en el
      alcance de este spec—. `alRotar` se queda con deps vacías — **AC1**
- [x] T011 `App.tsx`: **reescribir el comentario del `useCallback` de `alRotar`.** Hoy dice que su
      cuerpo «usa el setter funcional y no lee `rotation`», y con este spec sí necesita saber qué
      ranura del `Record` rotar. La salida que T010 documenta —leer `selected` por un `ref` y no por
      dependencia— es la que hay que anotar y por qué: la alternativa obvia, agregar `selected` a
      las dependencias de `alRotar` para que sea el propio hook el que se re-suscriba, rompe AC16
      del 022 (la suscripción única del listener de `wheel`), así que no es una opción disponible
      como lo era antes de que esa AC existiera. Un `selectedRef` no es "esconder de dónde sale
      `selected`": el `ref` queda nombrado y comentado, sólo que leerlo no dispara una re-suscripción
- [x] T012 `App.tsx`: verificar que no aparece Context, Redux ni singleton — la memoria vive en el
      shell y baja por props — **AC14**
- [x] T033 `App.tsx`: `handleContextMenu` —**por símbolo**: es `:374` sobre `main`, pero el 018 y el
      019 escriben `App.tsx` antes que este spec y el número no sobrevive— escribe **una sola ranura**
      con setter funcional.
      Es el **octavo** consumidor y la mitad «botón derecho» de AC2 — el único consumidor que no
      pasa por un efecto ni por un `useMemo`, así que es el que se escapa si se busca a mano en vez
      de borrar los `useState` primero — **AC2**
- [x] T034 `App.tsx`: la decisión de cada gesto **no se muda al `.tsx`** — `accionDeTecla`,
      `frenaElDefault`, `rotacionPorRueda`, `abreTapLimpio` y `reflejaElContextMenu` siguen en
      `src/components/input.ts` con sus tests en `environment: 'node'`. Lo que cambia es el cableado,
      no la pura — **AC13**

- [x] T038 `App.tsx` + `src/components/types/panel.types.ts`: el **handler del botón `0°`** —escribe
      una sola ranura con `ORIENTACION_INICIAL`, setter funcional y objeto nuevo— y el campo nuevo
      de `PropsDeOrientacion` que lo baja. Desde el spec 022 `PiecePalette` ya no recibe dieciséis
      props sueltas sino el objeto `orientacion` entero, así que esto no es agregar una prop a la
      firma de `PiecePalette`: es un campo más en `PropsDeOrientacion` y una línea más en el
      **`useMemo`** de `orientacion` de `App.tsx` —desde el 027 **no es un literal inline**, va
      memoizado, y el handler entra como los otros cuatro: la flecha se escribe adentro del
      `useMemo` (igual que el `onMirror: ()=> setMirror(m=>!m)` de hoy), así que no suma una
      dependencia nueva porque `selected` ya está en el array. Sin esta tarea **AC7 no tiene implementación**: `PiecePalette` es
      presentacional (`.claude/rules/ui.md`) y no puede escribir estado, y el 019 justamente le saca
      del mismo objeto las otras dos props de gesto (`onRotate`, `onMirror`), así que no queda
      ninguna que se le pueda reusar — **AC7**

- [x] T040 `components/use-input.ts`: la cadena de `if`/`else` de `despachar`, adentro de
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
      Es el mismo mecanismo por el que `handleContextMenu` hubo que cazarlo a mano (T033).
      **El 018 va antes que este spec en el lote, así que la rama existe y la tarea ya no tiene
      salida por «no existía»**: hay que abrir `use-input.ts`, ver la rama `ACCION.seleccionar`
      adentro de `despachar` —hoy, sin el 018, la cadena es `rotar` → `reflejar` → `else
      transporte()`, con el `else` en `use-input.ts:101` y la interfaz `Acciones` en `:36`–`:40`—,
      confirmar que sigue como `else if` **antes** de ese `else`, y confirmar que `Acciones` no
      necesita un callback nuevo del shell — **018 AC1**

> T004–T012, T033, T034 y T038 escriben `src/App.tsx` (T008 y T038 además
> `src/components/types/panel.types.ts`), así que ninguna lleva `[P]`. Y las dos que tocan
> `panel.types.ts` escriben además el **mismo `useMemo`** de `orientacion` en `App.tsx` —el que el
> 027 memoizó—, o sea que tampoco son paralelizables entre sí por ese lado. T040 pasó a verificar
> `components/use-input.ts`, que este spec no escribe.

## Paso 3 — La paleta muestra doce orientaciones

- [x] T013 `src/components/OrientationPanel.tsx` —el `.map` de las doce se mudó ahí desde
      `PiecePalette.tsx` con el spec 022—: `miniCells` se llama con el par de **cada** pieza, leyendo
      `orientaciones[key].rotation`/`.mirror` adentro del mismo `.map` sobre `Object.keys(SHAPES)`, y
      no las `rotation`/`mirror` de la seleccionada que hoy usa para las doce —el bug que le da
      nombre al spec— **AC4**
- [x] T014 `src/components/OrientationPanel.tsx` —se mudó junto con el `.map` de T013—: el
      `aria-label` de cada botón dice **su** orientación, no la global. Sigue llamando a
      `textoDeOrientacion(rotation, mirror)` —la pura que crea el 019 (su T006), en su módulo propio
      de `components/`— sólo que con el par de cada pieza. **AC13 del 019 sigue valiendo**: la
      derivación se escribe una sola vez, y este spec sólo le cambia los argumentos
- [x] T015 `PiecePalette.tsx` —se queda ahí: el spec 022 sólo le sacó a este archivo la grilla de
      miniaturas (`OrientationPanel.tsx`) y el bloque `border-t` del transporte
      (`TransportPanel.tsx`), y la línea de orientación no es ninguno de los dos—: la línea de
      orientación del 019 llama a la misma `textoDeOrientacion` con `orientaciones[selected]` —
      **AC9**
- [x] T016 `PiecePalette.tsx`: el botón `0°` junto a esa línea, cableado al campo nuevo de
      `PropsDeOrientacion` (T038) —que le llega ya adentro del objeto `orientacion` que este
      componente recibe entero desde el spec 022, no como prop suelta—, con `aria-label` y `title`
      que digan las dos cosas que hace (la etiqueta sólo dice los grados) — **AC7**
- [x] T017 Comentario **en `PiecePalette.tsx`, sobre el botón `0°`**: por qué `0°` y no un icono (al
      lado hay un `↺` y dos «volver atrás» tienen que distinguirse), y por qué resetea **también** la
      reflexión (los 29 de 96 del 019 §3). El `↺` que compara ya no es un control del mismo archivo:
      desde el spec 022 el botón de Reset vive en `TransportPanel.tsx`, un componente hermano
      dentro de la misma tarjeta. El comentario tiene que decir eso —dos "volver atrás" en la misma
      tarjeta pero en dos archivos distintos— y no dar por sentado que están en el mismo `.tsx`
- [x] T018 Comentario en el docblock de `MINI_BOX`
      (`src/components/constants/layout.constants.ts`): la caja fija del 016 pasa a ser **más**
      necesaria, porque ahora las doce formas cambian independientemente. El argumento está duplicado
      en `src/components/piece-mini.ts:19` (docblock, sección «Por qué la caja es fija» —verificado
      hoy: la frase de la `I` de 5×1 a 1×5 sigue en `:19`) y en **`DESIGN.md:165`** (bullet «La caja
      es fija, de 5×5 celdas»; la tarea decía `:149` y el archivo mide hoy 313 líneas) — los tres
      tienen que quedar diciendo lo mismo

## Paso 4 — `↺` no toca las orientaciones

- [x] T019 `App.tsx`: `resetBoard` **no cambia lo que hace**. Con el spec 022 puesto su cuerpo ya
      cambió —llama a `frenarTransporte()` **y a `reiniciarRecorrido()`** (los dos de
      `components/use-engine.ts`; el segundo lo agregó el **027**, por el velo huérfano) en vez de
      `stopClock()`, y se corrió de línea— pero eso es cableado y no comportamiento: sigue frenando el reloj,
      vaciando `placed` y sin tocar ninguna orientación, que es lo que a este spec le importa. Se le
      agrega el comentario de por qué no toca `ORIENTACIONES_INICIALES` pese a que existe justo al
      lado. Con el costo escrito: se renuncia al invariante «después de `↺` la app queda como recién
      abierta» — **AC8**

## Verificación

Las tres primeras son **nuevas** y no aflojan nada: este spec no tenía una sola tarea de test, y
desde el spec 029 `pnpm verify` corre `suite` con **coverage 100 en las cuatro métricas** y **cero
`/* v8 ignore */`**, así que sin ellas T020 no puede dar verde. Además hay tests que este spec
**rompe por construcción** —los fixtures de `PropsDeOrientacion` construyen `rotation`/`mirror`— y
que el typecheck de T004 sí enumera, pero que ninguna tarea estaba mandando a arreglar.

- [x] T044 `src/components/__tests__/OrientationPanel.browser.test.tsx` y
      `src/components/__tests__/PiecePalette.browser.test.tsx`: los dos tienen un helper
      `orientacion(over)` que arma un `PropsDeOrientacion` con `rotation: 0, mirror: false`
      (`OrientationPanel.browser.test.tsx:26`–`:29`, `PiecePalette.browser.test.tsx:20`–`:23`).
      Con T008 esos dos campos ya no existen y los **once** usos de `rotation`/`mirror` del primero
      y los **ocho** del segundo dejan de compilar. Pasan a armar `orientaciones` entera, derivada
      de `ORIENTACIONES_INICIALES` con la ranura que el test quiera pisar. Es la mitad del typecheck
      en rojo de T004 que cae en `__tests__/` y que la lista de consumidores del research no incluía
- [x] T045 `src/components/__tests__/OrientationPanel.browser.test.tsx`: **AC3, AC4 y AC12 dejan de
      ser sólo `[M]`.** Los tres tienen contraparte mecánica y dos de ellas ya existen a medias en
      este archivo: «el nombre accesible dice la orientacion ACTUAL, no la canonica» (`:49`) y
      «rotar NO mueve un pixel de la grilla, que es para lo que la caja es fija» (`:59`, que hoy
      barre `rotation × mirror` con **un** par para las doce). Se extienden a doce pares distintos:
      renderizar con las doce en orientaciones distintas y verificar que cada `aria-label` dice la
      **suya** (AC4), que cambiar una sola ranura deja las otras once con el mismo `aria-label` y
      las mismas celdas pintadas (AC3), y que los anchos y altos de los doce botones no se mueven
      (AC12). T021, T023 y T024 se quedan como están y pasan a ser confirmación a ojo, no la única
      prueba — **AC3**, **AC4**, **AC12**
- [x] T046 `src/components/__tests__/` (proyecto `node`, sin sufijo `.browser`): un test de
      `orientation.constants.ts` que verifique que `ORIENTACIONES_INICIALES` tiene **las doce
      ranuras de `SHAPES`** y todas en `{ rotation: 0, mirror: false }`. Es la contraparte mecánica
      de **AC6** —que hoy sólo tiene T027 `[M]`— y además es lo que atrapa que la derivación desde
      `SHAPES` de T002 se rompa: escrita a mano no la atraparía nada, derivada la atrapa esto. Va en
      el proyecto `node` porque el módulo es puro y no toca DOM — **AC6**
- [x] T020 `pnpm verify` en verde
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

- [x] T036 [P] `docs/architecture/overview.md`: el diagrama del shell (`:24`) y la tabla de estado
      (`:122`–`:123`) dejan de listar `rotation` `0..3` y `mirror` `boolean` como dos escalares
      sueltos y pasan a la memoria por pieza
- [x] T037 [P] **`DESIGN.md:158`–`:159`** (la tarea decía `:142`; el archivo mide hoy 313 líneas y
      la frase está partida en dos renglones): el botón de la paleta ya no se dibuja «en la
      orientación que está seleccionada ahora mismo» sino en **la suya**. Es el párrafo del 016, y el resto de esa sección
      —caja fija, borde, «la miniatura no dice notas»— **no cambia**

## PR

- [x] T028 Rama `feature/020-la-orientacion-es-de-la-pieza`
- [ ] T029 Actualizar la fila del 020 en `specs/log.md` a `Implementado`
- [x] T030 Anotar en `specs/revisiones.md` si el spec salió distinto de lo previsto

## Seguimiento (no bloquea)

- [x] T031 `Orientacion` y `PlacedPiece` repiten los mismos dos campos. Unificarlos es un refactor de
      `domain/` que cruza el borde de paquete (`mcp-server/` importa 31 símbolos), con beneficio cero
      de comportamiento. Anotar en `specs/deuda.md`.
      Y en la **misma pasada**, poner al día la entrada de la rotación sin acotar, que dice «comparada
      contra `0|1|2|3` en **cuatro** lugares» desde el 005 y ya iba por seis —el 013 declaró el quinto
      (`T033`) y el 016 el sexto (`T039`)—, **más un séptimo que estrena el 019 en este mismo lote**:
      su `T006` crea `textoDeOrientacion(rotation, mirror)` con `rotation: number`. La pasada hace
      entonces **dos** cosas y no una: contar el séptimo, y verificar que el 019 no haya dejado en esa
      pura un comentario diciendo que el union «todavía no existe» —era su texto original y se corrigió
      con este spec a la vista—, porque el hogar del tipo termina siendo
      `components/types/orientation.types.ts` (T003) y no ese módulo. Este spec la **achica y no la
      cierra**: `Rotacion` acota la
      fuente en `components/` (T003, T041), así que lo que queda es el tramo de `domain/` —`rotateN`,
      `arpeggioFor`, `PlacedPiece.rotation`—, que es el que cruza el borde hacia `mcp-server/` y sigue
      necesitando spec propio. Escribir eso, con el alcance nuevo y no con la cuenta vieja
- [ ] T032 La memoria no persiste: cerrar la pestaña olvida las doce orientaciones. Fuera de alcance a
      propósito — el tablero tampoco persiste

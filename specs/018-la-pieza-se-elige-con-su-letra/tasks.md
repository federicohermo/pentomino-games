# Tasks — Spec 018

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — La acción nueva

- [x] T001 `components/constants/input.constants.ts`: `ACCION` suma `seleccionar`. Const-object, sin
      `enum` (`erasableSyntaxOnly`), con el comentario de por qué sigue sin haber una cuarta acción
      `no-hacer-nada`. El docblock arranca con «Las **tres** acciones que un gesto de entrada puede
      pedirle al shell» (línea 2): pasa a cuatro y las nombra a las cuatro. Y el párrafo de la línea 10
      dice hoy «No hay una **cuarta** acción `no-hacer-nada`»: con `seleccionar` adentro esa cuarta ya
      existe, así que ahí dice **quinta**

## Paso 2 — El evento gana los tres modificadores

- [x] T002 `components/types/input.types.ts`: `EventoDeTecla` suma `ctrlKey`, `metaKey` y `altKey`,
      **obligatorios y sin `?`** — el mismo criterio que dejó al régimen del 017 sin default de
      parámetro. Comentario de por qué `shiftKey` **no** entra (AC3 no lo usa)
- [x] T026 `components/types/input.types.ts`: los tres comentarios que este spec falsifica en el mismo
      archivo — «Las **tres** acciones de entrada» (línea 3), el conteo de guardas de la línea 14 —que
      **hoy dice «las seis guardas»**, no «cinco»: el spec 026 agregó `targetEsCelda` después de que
      esta tarea se escribiera, así que el número a subir es de seis a siete— y el del campo `key`
      (línea 23), que hoy enumera `'Shift'`, `'Control'` o `' '` y desde acá también son las doce
      letras. **No** se toca el docblock de `targetEsCelda` (35-51): la letra no se veta con él (AC13)
- [x] T027 `components/__tests__/input.test.ts`: el factory `tecla` (docblock en la línea 19, cuerpo en
      la 20-22 — ya lleva el `targetEsCelda: false` que le puso el 026) suma los tres campos en
      `false`. Va **antes** que los tests del paso 3: sin esto el archivo entero no typechequea y
      ninguno de los siete se puede ver fallar. En el mismo paso, el docblock de la línea 12 —«Las
      decisiones de los **cinco** gestos del spec 013»— pasa a nombrar también al de este spec. Los
      `describe` nuevos van rotulados **`018 AC1`**, `018 AC2`…: el archivo ya tiene «AC1», «AC3» y
      «AC5» de tres specs distintos sin decir de cuál, y agregar un cuarto homónimo lo empeora

## Paso 3 — Las dos puras y sus tests

- [x] T003 `components/input.ts`: `piezaDeTecla(key)` — mayúscula + type predicate propio
      (`(k: string): k is PieceKey`) con el `in`-check contra `SHAPES` adentro, **sin `as`**. `SHAPES`
      se importa como **valor** de `../domain/constants/pieces.constants.ts` (con extensión, sin
      barrel): hasta hoy `input.ts` solo importaba tipos de `domain/`. El `in` a
      secas no estrecha y está medido (`research.md` §8). La dirección `components/ → domain/` sigue
      permitida y **el mecanismo cambió**: desde el 030 la verifica `import-x/no-restricted-paths` por
      ruta (`eslint.config.js:71-92`) y ninguna zona la prohíbe; `input.test.ts:7` ya importa `SHAPES`
      como valor. Docblock con por qué valida contra `SHAPES` y no contra una lista propia — **AC1**,
      **AC2**, **AC7**
- [x] T004 `components/input.ts`: `accionDeTecla` gana la rama de las letras, con la guarda de
      `ctrlKey || metaKey || altKey` **antes** de mirar la letra y **adentro de la rama** —nunca un
      `return` al tope de la función, que también alcanzaría a la barra— y con `tipo === 'keydown'`,
      porque `despachar` llama a la pura en los dos eventos. **Sin `targetEsCelda`**: es la quinta
      guarda que agregó el 026 y apaga la barra y sólo la barra; con una celda enfocada la letra sigue
      seleccionando, igual que `Shift` y `Ctrl` siguen rotando y reflejando — **AC4**, **AC11**,
      **AC13**
- [x] T005 Comentario en `accionDeTecla` sobre las dos decisiones de T004: los modificadores vetan
      primero porque `Ctrl`+`F` no es una selección vetada sino un evento ajeno, y la guarda no sube al
      tope porque ahí le cambiaría el comportamiento a la barra del 013

- [x] T006 Test: las doce letras seleccionan su pieza, en minúscula y en mayúscula — **AC1**, **AC2**
- [x] T007 Test: con `ctrlKey`, `metaKey` o `altKey` la letra devuelve `null` — **AC4**
- [x] T008 Test: con `targetEsControl` la letra devuelve `null` — **AC5**
- [x] T009 Test: con `repeat` la letra devuelve `null`
- [x] T010 Test: `A`, `1` y `Enter` devuelven `null` — **AC7**. Verificar de paso que el barrido que ya
      existe (`input.test.ts:246-256`, `['a','Enter','Alt','ArrowUp','Escape']`) **sigue en verde**:
      ninguna de esas cinco es pentominó, así que no hay regresión, pero desde este spec ese `'a'`
      pasa a ser load-bearing y merece decirlo al lado
- [x] T011 Test: `frenaElDefault` devuelve `false` para las doce letras — **AC6**
- [x] T012 Test: `abreTapLimpio` devuelve `false` para una letra, o sea que `Shift`+`f` ensucia el
      tap y al soltar `Shift` no rota — **AC3**. Es caracterización: hoy sale gratis y el test existe
      para que siga saliendo
- [x] T028 Test: el `keyup` de una letra, sin ningún modificador abajo, devuelve `null` — es el
      `Ctrl`+`V` que suelta el `Ctrl` primero — **AC4**
- [x] T029 Test de no-regresión: la barra con `ctrlKey`, `altKey` o `metaKey` abajo **sigue** devolviendo
      `ACCION.transporte`, y `Shift`/`Control` con el tap limpio siguen rotando y reflejando — **AC11**

> T003–T005 y T006–T012, T028 y T029 **ninguna lleva `[P]`**: las tres primeras escriben
> `src/components/input.ts` y las nueve restantes escriben `src/components/__tests__/input.test.ts`.
> Dos tareas `[P]` del mismo bloque no pueden tocar el mismo archivo, y acá no hay dos archivos: hay
> uno de código y uno de tests, o sea dos carriles como mucho. Las nueve de test dependen además de
> T027, que es lo que deja el archivo compilando. **Y la mitad de node de T034 escribe también
> `input.test.ts`**, así que entra en ese mismo carril aunque figure en el paso 4.

## Paso 4 — El cableado

- [x] T013 `src/components/use-input.ts`: en `despachar` (líneas 81-102), adentro de
      `useAtajosDeTeclado`, el objeto `evento` (82-87) suma `ctrlKey`, `metaKey` y `altKey` — es el
      cableado que el spec 022 sacó de `App.tsx` y que arma el objeto con el que después se llama a
      `accionDeTecla`. Los tres salen del `KeyboardEvent` que `onKeyDown`/`onKeyUp` ya reciben: no hay
      información nueva que sacar del DOM
- [x] T014 Dos archivos, por el mismo reparto que el spec 022 dejó entre el hook y el shell: en
      `src/components/use-input.ts`, la interfaz `Acciones` suma el campo
      `seleccionar: (pieza: PieceKey) => void` (con su import de
      `../domain/types/pieces.types.ts`) y `despachar` gana la rama `ACCION.seleccionar` —preguntando
      por `piezaDeTecla` y saliendo si es `null`, **sin `!`**, con el comentario de por qué la
      redundancia contra la pura es deliberada— que llama a `acciones.seleccionar(pieza)`. Va como
      `else if` **antes** del `else transporte()` que hoy cierra la cadena (`use-input.ts:96-101`):
      agregada como `if` suelto después de la cadena, la letra arranca además el transporte y eso pasa
      typecheck y lint — **AC11**. Y en `src/App.tsx`, un callback nuevo —mismo patrón que
      `rotarConTecla` y `reflejarConTecla`, líneas 249-250— envuelve a `setSelected` y se suma como
      `seleccionar` al objeto que hoy tiene `rotar`, `reflejar` y `transporte` en la llamada a
      `useAtajosDeTeclado` (258-261). **Callback y no el setter pelado**, aunque `setSelected` sea
      asignable a la firma: el docblock de `use-input.ts:18-21` decide que los dos hooks reciben
      callbacks para que un cambio de forma de la ranura de estado caiga en el shell y no adentro del
      hook — que es exactamente lo que el 020 va a hacer con `rotation` y `mirror`
- [x] T015 Verificar las dos identidades que T014 da por sentadas: el callback nuevo de `src/App.tsx`
      envuelve a `setSelected` —un setter de `useState`, identidad estable— así que puede ir con
      dependencias vacías, igual que `alRotar`; y que el array de dependencias del `useEffect` de
      `useAtajosDeTeclado` en `src/components/use-input.ts` (hoy `[rotar, reflejar, transporte,
      tapLimpio]`, línea 119) pasa a incluir `seleccionar`. Los campos van por separado y el objeto
      `acciones` **no** entra crudo: el porqué está en el docblock del hook, líneas 57-60
- [x] T016 Footer de `src/App.tsx`. **La cita se pudrió: `App.tsx` pasó de 312 a 442 líneas con los
      specs 025/026/027, así que el `<footer>` no está en 303-309 sino en las líneas 433-439**, y los
      tres `<span>` de gesto en 436-438 (`Rueda … Shift rota`; `botón derecho … Ctrl refleja`;
      `Espacio arranca y para`). Sumar el gesto en el idioma de esos tres — **AC9**
- [x] T030 `docs/guides/quickstart.md`: la tabla «Cómo se toca» (**encabezado del `##` en la línea 71,
      cabecera de tabla en 77-78, filas de la 79 a la 84** — el spec citaba 57 y 63-70, que es el
      archivo de antes del 026) suma la fila de las letras —`F I L N P T U V W X Y Z` · Selecciona esa pieza · Toda la
      ventana, al **apretar**—. Y el párrafo que la introduce (**línea 73**) dice «Los **tres** gestos
      que gobiernan la pieza por colocar»: con este spec son cuatro. El párrafo del 026 (97-103) dice
      qué se lleva el tablero enfocado —«la barra, el `Enter` y las flechas, y nada más»— y **sigue
      siendo cierto**: la letra no entra en esa lista (AC13), así que ese párrafo no se toca. Es la única doc del repo que enumera
      los gestos —verificado por grep sobre `docs/`, `.claude/rules/`, `DESIGN.md` y `CLAUDE.md`—; el
      footer es producto y no la reemplaza

> **Las tres tareas de abajo no estaban y son bloqueantes.** El spec se escribió el 2026-08-20, antes de
> que el 029 pusiera el gate de coverage **100 en las cuatro métricas** con `App.tsx` adentro del conteo
> (`vite.config.ts:126-134` y `:157`) y antes de que existieran `use-input.browser.test.tsx` y
> `App.browser.test.tsx`. Con el paso 4 escrito como estaba, `pnpm verify` da rojo por dos vías
> distintas: typecheck (el factory `acciones()` deja de compilar) y umbral (ramas y una función nuevas
> sin cubrir).

- [x] T032 `src/components/__tests__/use-input.browser.test.tsx`: el factory `acciones()` (línea 24)
      suma `seleccionar: vi.fn()` —sin esto el archivo entero no typechequea, igual que T027 con
      `tecla`— y entra un test que apriete una letra sobre `window` y verifique que llama a
      `seleccionar` con la pieza **y que NO llama a `transporte`**. Ese segundo `expect` es el que
      atrapa la rama puesta del lado equivocado del `else transporte()` (T014), que es el bug que
      T031 iba a buscar a mano. Verificar de paso que los dos literales de letra que el archivo ya usa
      —`'q'` (línea 121) y `'c'` (111)— **siguen sin ser pentominós**, o sea que los tests de hoy no
      cambian de resultado — **AC11**, **AC14**
- [x] T033 `src/__tests__/App.browser.test.tsx`: un test de punta a punta que apriete la letra y
      verifique la pieza en la mano. No es redundante con T032: cubre el **callback nuevo de
      `App.tsx`** (T014), que cuenta como una función más contra `functions: 100` y que ningún test de
      `use-input` ejerce. El vecino exacto ya existe —`it('elegir otra pieza cambia lo que hay en la
      mano')`, línea 445— y hace lo mismo por la paleta — **AC1**, **AC14**
- [x] T034 Test de AC13, en los dos niveles: en `input.test.ts`, que `accionDeTecla` con
      `targetEsCelda: true` **igual** devuelve `ACCION.seleccionar` para una letra —y que la barra en
      la misma condición **sigue** devolviendo `null`, que es la decisión del 026 que no se toca—; y en
      `App.browser.test.tsx`, con una celda enfocada de verdad, que la letra cambia la pieza en la mano.
      El `describe` del 026 ya monta el tablero con foco (`App.browser.test.tsx:552`, y el caso hermano
      `it('con una celda enfocada, \`Shift\` SI rota y \`Ctrl\` SI refleja')` en la 700) — **AC13**

## Verificación

- [x] T017 `pnpm verify` en verde — hoy es `lint ‖ typecheck ‖ **suite** ‖ mcp:test`, y `suite`
      son dos pasadas de vitest con umbral **100** en la segunda. Un clone nuevo necesita
      `pnpm exec playwright install chromium` antes del primer `verify`, porque el paso 4 ahora tiene
      tests de navegador (T032, T033) — **AC12**, **AC14**
- [ ] T018 [M] Navegador: las doce letras seleccionan, y la paleta y el fantasma lo reflejan — **AC1**
- [ ] T019 [M] Navegador: `Shift`+`f` selecciona `F` y al soltar `Shift` la pieza **no** rota — **AC3**
- [ ] T020 [M] Navegador: `Ctrl`+`F` abre la búsqueda del navegador y **no** selecciona — **AC4**
- [ ] T021 [M] Navegador: con el foco en el slider de tempo, las letras no seleccionan — **AC5**
- [ ] T022 [M] Navegador: apretar `F` dos veces no cambia nada — **AC10**
- [ ] T031 [M] Navegador: apretar una letra con el transporte parado **no lo arranca**, y con el
      transporte corriendo **no lo para**. La pura no lo puede atrapar, porque el bug vive en la cadena
      de `despachar`, en `src/components/use-input.ts`, y no en `accionDeTecla`. **Ya no es el único
      lugar donde se ve, y esa parte de la tarea caducó**: desde el spec 029 hay un proyecto de Vitest
      sobre Chromium y ese caso lo cubre T032, automatizado. Esta queda como confirmación a ojo, no
      como la red — **AC11**

## PR

- [x] T023 Rama `feature/018-la-pieza-se-elige-con-su-letra`
- [x] T024 Actualizar la fila del 018 en `specs/log.md` a `Implementado`
- [x] T025 Anotar en `specs/revisiones.md` si el spec salió distinto de lo previsto

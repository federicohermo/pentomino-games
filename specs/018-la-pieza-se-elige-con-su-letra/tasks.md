# Tasks — Spec 018

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — La acción nueva

- [ ] T001 `components/constants/input.constants.ts`: `ACCION` suma `seleccionar`. Const-object, sin
      `enum` (`erasableSyntaxOnly`), con el comentario de por qué sigue sin haber una cuarta acción
      `no-hacer-nada`. El docblock arranca con «Las **tres** acciones que un gesto de entrada puede
      pedirle al shell» (línea 2): pasa a cuatro y las nombra a las cuatro. Y el párrafo de la línea 10
      dice hoy «No hay una **cuarta** acción `no-hacer-nada`»: con `seleccionar` adentro esa cuarta ya
      existe, así que ahí dice **quinta**

## Paso 2 — El evento gana los tres modificadores

- [ ] T002 `components/types/input.types.ts`: `EventoDeTecla` suma `ctrlKey`, `metaKey` y `altKey`,
      **obligatorios y sin `?`** — el mismo criterio que dejó al régimen del 017 sin default de
      parámetro. Comentario de por qué `shiftKey` **no** entra (AC3 no lo usa)
- [ ] T026 `components/types/input.types.ts`: los tres comentarios que este spec falsifica en el mismo
      archivo — «Las **tres** acciones de entrada» (línea 3), «las **cinco** guardas quedan cubiertas»
      (línea 14) y el del campo `key` (línea 23), que hoy enumera `'Shift'`, `'Control'` o `' '` y desde
      acá también son las doce letras
- [ ] T027 `components/__tests__/input.test.ts`: el factory `tecla` (línea 19) suma los tres campos en
      `false`. Va **antes** que los tests del paso 3: sin esto el archivo entero no typechequea y
      ninguno de los siete se puede ver fallar. En el mismo paso, el docblock de la línea 12 —«Las
      decisiones de los **cinco** gestos del spec 013»— pasa a nombrar también al de este spec

## Paso 3 — Las dos puras y sus tests

- [ ] T003 `components/input.ts`: `piezaDeTecla(key)` — mayúscula + type predicate propio
      (`(k: string): k is PieceKey`) con el `in`-check contra `SHAPES` adentro, **sin `as`**. `SHAPES`
      se importa como **valor** de `../domain/constants/pieces.constants.ts` (con extensión, sin
      barrel): hasta hoy `input.ts` solo importaba tipos de `domain/`. El `in` a
      secas no estrecha y está medido (`research.md` §8). Docblock con por qué valida contra `SHAPES` y
      no contra una lista propia — **AC1**, **AC2**, **AC7**
- [ ] T004 `components/input.ts`: `accionDeTecla` gana la rama de las letras, con la guarda de
      `ctrlKey || metaKey || altKey` **antes** de mirar la letra y **adentro de la rama** —nunca un
      `return` al tope de la función, que también alcanzaría a la barra— y con `tipo === 'keydown'`,
      porque `despachar` llama a la pura en los dos eventos — **AC4**, **AC11**
- [ ] T005 Comentario en `accionDeTecla` sobre las dos decisiones de T004: los modificadores vetan
      primero porque `Ctrl`+`F` no es una selección vetada sino un evento ajeno, y la guarda no sube al
      tope porque ahí le cambiaría el comportamiento a la barra del 013

- [ ] T006 Test: las doce letras seleccionan su pieza, en minúscula y en mayúscula — **AC1**, **AC2**
- [ ] T007 Test: con `ctrlKey`, `metaKey` o `altKey` la letra devuelve `null` — **AC4**
- [ ] T008 Test: con `targetEsControl` la letra devuelve `null` — **AC5**
- [ ] T009 Test: con `repeat` la letra devuelve `null`
- [ ] T010 Test: `A`, `1` y `Enter` devuelven `null` — **AC7**
- [ ] T011 Test: `frenaElDefault` devuelve `false` para las doce letras — **AC6**
- [ ] T012 Test: `abreTapLimpio` devuelve `false` para una letra, o sea que `Shift`+`f` ensucia el
      tap y al soltar `Shift` no rota — **AC3**. Es caracterización: hoy sale gratis y el test existe
      para que siga saliendo
- [ ] T028 Test: el `keyup` de una letra, sin ningún modificador abajo, devuelve `null` — es el
      `Ctrl`+`V` que suelta el `Ctrl` primero — **AC4**
- [ ] T029 Test de no-regresión: la barra con `ctrlKey`, `altKey` o `metaKey` abajo **sigue** devolviendo
      `ACCION.transporte`, y `Shift`/`Control` con el tap limpio siguen rotando y reflejando — **AC11**

> T003–T005 y T006–T012, T028 y T029 **ninguna lleva `[P]`**: las tres primeras escriben
> `src/components/input.ts` y las nueve restantes escriben `src/components/__tests__/input.test.ts`.
> Dos tareas `[P]` del mismo bloque no pueden tocar el mismo archivo, y acá no hay dos archivos: hay
> uno de código y uno de tests, o sea dos carriles como mucho. Las nueve de test dependen además de
> T027, que es lo que deja el archivo compilando.

## Paso 4 — El cableado

- [ ] T013 `src/components/use-entrada.ts`: en `despachar`, adentro de `useAtajosDeTeclado`, el objeto
      `evento` suma `ctrlKey`, `metaKey` y `altKey` — es el cableado que el spec 022 sacó de `App.tsx`
      y que arma el objeto con el que después se llama a `accionDeTecla`
- [ ] T014 Dos archivos, por el mismo reparto que el spec 022 dejó entre el hook y el shell: en
      `src/components/use-entrada.ts`, la interfaz `Acciones` suma el campo
      `seleccionar: (pieza: PieceKey) => void` (con su import de
      `../domain/types/pieces.types.ts`) y `despachar` gana la rama `ACCION.seleccionar` —preguntando
      por `piezaDeTecla` y saliendo si es `null`, **sin `!`**, con el comentario de por qué la
      redundancia contra la pura es deliberada— que llama a `acciones.seleccionar(pieza)`. Va como
      `else if` **antes** del `else transporte()` que hoy cierra la cadena: agregada como `if` suelto
      después de la cadena, la letra arranca además el transporte y eso pasa typecheck y lint —
      **AC11**. Y en `src/App.tsx`, un callback nuevo —mismo patrón que `rotarConTecla` y
      `reflejarConTecla`— envuelve a `setSelected` y se suma como `seleccionar` al objeto que hoy tiene
      `rotar`, `reflejar` y `transporte` en la llamada a `useAtajosDeTeclado`
- [ ] T015 Verificar las dos identidades que T014 da por sentadas: el callback nuevo de `src/App.tsx`
      envuelve a `setSelected` —un setter de `useState`, identidad estable— así que puede ir con
      dependencias vacías, igual que `alRotar`; y que el array de dependencias del `useEffect` de
      `useAtajosDeTeclado` en `src/components/use-entrada.ts` pasa a incluir `seleccionar` junto a
      `rotar`, `reflejar`, `transporte` y `tapLimpio`
- [ ] T016 Footer de `src/App.tsx` (el bloque `<footer>`, hoy en las líneas 310-316; los tres
      `<span>` de gesto están en las líneas 313-315): sumar el gesto en el idioma de los tres del
      013 — **AC9**
- [ ] T030 `docs/guides/quickstart.md`: la tabla «Cómo se toca» (encabezado en la línea 57, filas de la
      63 a la 70) suma la fila de las letras —`F I L N P T U V W X Y Z` · Selecciona esa pieza · Toda la
      ventana, al **apretar**—. Y el párrafo que la introduce (línea 59) dice «Los **tres** gestos que
      gobiernan la pieza por colocar»: con este spec son cuatro. Es la única doc del repo que enumera
      los gestos —verificado por grep sobre `docs/`, `.claude/rules/`, `DESIGN.md` y `CLAUDE.md`—; el
      footer es producto y no la reemplaza

## Verificación

- [ ] T017 `pnpm verify` en verde
- [ ] T018 [M] Navegador: las doce letras seleccionan, y la paleta y el fantasma lo reflejan — **AC1**
- [ ] T019 [M] Navegador: `Shift`+`f` selecciona `F` y al soltar `Shift` la pieza **no** rota — **AC3**
- [ ] T020 [M] Navegador: `Ctrl`+`F` abre la búsqueda del navegador y **no** selecciona — **AC4**
- [ ] T021 [M] Navegador: con el foco en el slider de tempo, las letras no seleccionan — **AC5**
- [ ] T022 [M] Navegador: apretar `F` dos veces no cambia nada — **AC10**
- [ ] T031 [M] Navegador: apretar una letra con el transporte parado **no lo arranca**, y con el
      transporte corriendo **no lo para**. Es el único lugar donde se ve si la rama nueva quedó del
      lado equivocado del `else transporte()` (T014): la pura no lo puede atrapar, porque el bug vive
      en la cadena de `despachar`, en `src/components/use-entrada.ts`, y no en `accionDeTecla` —
      **AC11**

## PR

- [ ] T023 Rama `feature/018-la-pieza-se-elige-con-su-letra`
- [ ] T024 Actualizar la fila del 018 en `specs/log.md` a `Implementado`
- [ ] T025 Anotar en `specs/revisiones.md` si el spec salió distinto de lo previsto

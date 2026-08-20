# Tasks — Spec 018

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — La acción nueva

- [ ] T001 `components/constants/input.constants.ts`: `ACCION` suma `seleccionar`. Const-object, sin
      `enum` (`erasableSyntaxOnly`), con el comentario de por qué sigue sin haber una cuarta acción
      `no-hacer-nada`. El docblock arranca con «Las **tres** acciones que un gesto de entrada puede
      pedirle al shell» (línea 2): pasa a cuatro y las nombra a las cuatro

## Paso 2 — El evento gana los tres modificadores

- [ ] T002 `components/types/input.types.ts`: `EventoDeTecla` suma `ctrlKey`, `metaKey` y `altKey`,
      **obligatorios y sin `?`** — el mismo criterio que dejó al régimen del 017 sin default de
      parámetro. Comentario de por qué `shiftKey` **no** entra (AC3 no lo usa)
- [ ] T026 `components/types/input.types.ts`: los tres comentarios que este spec falsifica en el mismo
      archivo — «Las **tres** acciones de entrada» (línea 3), «las **cinco** guardas quedan cubiertas»
      (línea 15) y el del campo `key`, que hoy enumera `'Shift'`, `'Control'` o `' '` y desde acá
      también son las doce letras
- [ ] T027 `components/__tests__/input.test.ts`: el factory `tecla` (línea 19) suma los tres campos en
      `false`. Va **antes** que los tests del paso 3: sin esto el archivo entero no typechequea y
      ninguno de los siete se puede ver fallar

## Paso 3 — Las dos puras y sus tests

- [ ] T003 `components/input.ts`: `piezaDeTecla(key)` — mayúscula + type predicate propio
      (`(k: string): k is PieceKey`) con el `in`-check contra `SHAPES` adentro, **sin `as`**. El `in` a
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

- [ ] T013 `App.tsx`: el objeto `evento` del `despachar` suma `ctrlKey`, `metaKey` y `altKey`
- [ ] T014 `App.tsx`: la rama `ACCION.seleccionar`, preguntando por `piezaDeTecla` y saliendo si es
      `null` — **sin `!`**, con el comentario de por qué la redundancia contra la pura es deliberada
- [ ] T015 `App.tsx`: verificar que las dependencias del efecto de teclado **no** cambian (`setSelected`
      es un setter de `useState`, identidad estable)
- [ ] T016 Footer: sumar el gesto en el idioma de los tres del 013 — **AC9**
- [ ] T030 `docs/guides/quickstart.md`: la tabla «Cómo se toca» (línea 62) suma la fila de las letras
      —`F I L N P T U V W X Y Z` · Selecciona esa pieza · Toda la ventana, en `keydown`—. Es la única
      doc del repo que enumera los gestos; el footer es producto y no la reemplaza

## Verificación

- [ ] T017 `pnpm verify` en verde
- [ ] T018 [M] Navegador: las doce letras seleccionan, y la paleta y el fantasma lo reflejan — **AC1**
- [ ] T019 [M] Navegador: `Shift`+`f` selecciona `F` y al soltar `Shift` la pieza **no** rota — **AC3**
- [ ] T020 [M] Navegador: `Ctrl`+`F` abre la búsqueda del navegador y **no** selecciona — **AC4**
- [ ] T021 [M] Navegador: con el foco en el slider de tempo, las letras no seleccionan — **AC5**
- [ ] T022 [M] Navegador: apretar `F` dos veces no cambia nada — **AC10**

## PR

- [ ] T023 Rama `feature/018-la-pieza-se-elige-con-su-letra`
- [ ] T024 Actualizar la fila del 018 en `specs/log.md` a `Implementado`
- [ ] T025 Anotar en `specs/revisiones.md` si el spec salió distinto de lo previsto

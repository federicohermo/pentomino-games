# Tasks — Spec 018

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — La acción nueva

- [ ] T001 `components/constants/input.constants.ts`: `ACCION` suma `seleccionar`. Const-object, sin
      `enum` (`erasableSyntaxOnly`), con el comentario de por qué sigue sin haber una cuarta acción
      `no-hacer-nada`

## Paso 2 — El evento gana los tres modificadores

- [ ] T002 `components/types/input.types.ts`: `EventoDeTecla` suma `ctrlKey`, `metaKey` y `altKey`,
      **obligatorios y sin `?`** — el mismo criterio que dejó al régimen del 017 sin default de
      parámetro. Comentario de por qué `shiftKey` **no** entra (AC3 no lo usa)

## Paso 3 — Las dos puras y sus tests

- [ ] T003 `components/input.ts`: `piezaDeTecla(key)` — mayúscula + `in`-check contra `SHAPES`, sin
      `as`. Docblock con por qué valida contra `SHAPES` y no contra una lista propia — **AC1**, **AC2**,
      **AC7**
- [ ] T004 `components/input.ts`: `accionDeTecla` gana la rama de las letras, con la guarda de
      `ctrlKey || metaKey || altKey` **antes** de mirar la letra — **AC4**
- [ ] T005 Comentario en `accionDeTecla` sobre el orden de las guardas: los modificadores vetan primero
      porque `Ctrl`+`F` no es una selección vetada, es un evento ajeno

> Las tres escriben `src/components/input.ts` y por eso **ninguna lleva `[P]`**. Dos tareas `[P]` del
> mismo bloque no pueden tocar el mismo archivo.

- [ ] T006 [P] Test: las doce letras seleccionan su pieza, en minúscula y en mayúscula — **AC1**, **AC2**
- [ ] T007 [P] Test: con `ctrlKey`, `metaKey` o `altKey` la letra devuelve `null` — **AC4**
- [ ] T008 [P] Test: con `targetEsControl` la letra devuelve `null` — **AC5**
- [ ] T009 [P] Test: con `repeat` la letra devuelve `null`
- [ ] T010 [P] Test: `A`, `1` y `Enter` devuelven `null` — **AC7**
- [ ] T011 [P] Test: `frenaElDefault` devuelve `false` para las doce letras — **AC6**
- [ ] T012 [P] Test: `abreTapLimpio` devuelve `false` para una letra, o sea que `Shift`+`f` ensucia el
      tap y al soltar `Shift` no rota — **AC3**. Es caracterización: hoy sale gratis y el test existe
      para que siga saliendo

> T006–T012 sí son `[P]` entre sí: escriben `components/__tests__/input.test.ts` en bloques separados
> y no dependen unas de otras. Si `spec-implement` las abanica, van a un solo archivo — conviene
> correrlas en un carril y no en siete.

## Paso 4 — El cableado

- [ ] T013 `App.tsx`: el objeto `evento` del `despachar` suma `ctrlKey`, `metaKey` y `altKey`
- [ ] T014 `App.tsx`: la rama `ACCION.seleccionar`, preguntando por `piezaDeTecla` y saliendo si es
      `null` — **sin `!`**, con el comentario de por qué la redundancia contra la pura es deliberada
- [ ] T015 `App.tsx`: verificar que las dependencias del efecto de teclado **no** cambian (`setSelected`
      es un setter de `useState`, identidad estable)
- [ ] T016 Footer: sumar el gesto en el idioma de los tres del 013 — **AC9**

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

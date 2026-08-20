# Tasks — Spec 020

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — El tipo y el valor inicial

- [ ] T001 [P] `components/types/`: `Orientacion` (`{ rotation, mirror }`) y el tipo de la memoria
      (`Record<PieceKey, Orientacion>`). Docblock con por qué **no** va en `domain/types/`: la memoria
      es estado del shell, y el modelo ya tiene su representación en `PlacedPiece`
- [ ] T002 [P] `components/constants/`: la orientación inicial y la memoria inicial **derivada de
      `SHAPES`**, no escrita a mano con las doce letras — **AC6**
- [ ] T003 [P] Comentario: `rotation` sigue siendo `number` sin acotar a propósito. Está en
      `specs/deuda.md`, el 017 le dio su argumento más fuerte, y arreglarlo cruza el borde de paquete

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
- [ ] T008 `App.tsx`: `PiecePalette` recibe `orientaciones` **entera** (las doce miniaturas necesitan
      las doce); `Board` sigue recibiendo el par de la seleccionada
- [ ] T009 `App.tsx`: el efecto de teclado escribe **una sola ranura** con setter funcional; objeto
      nuevo, nunca mutación — **AC1**, **AC2**
- [ ] T010 `App.tsx`: el efecto de la rueda agrega `selected` a las dependencias — **AC1**
- [ ] T011 `App.tsx`: **reescribir el comentario del efecto de la rueda.** Hoy afirma que «acá no hay
      ningún valor que el handler tenga que leer», y con este spec lo hay. Anotar por qué se elige
      re-suscribir antes que un `selectedRef` que esconda de dónde sale `selected`
- [ ] T012 `App.tsx`: verificar que no aparece Context, Redux ni singleton — la memoria vive en el
      shell y baja por props — **AC14**

> T004–T012 escriben `src/App.tsx`, así que ninguna lleva `[P]`.

## Paso 3 — La paleta muestra doce orientaciones

- [ ] T013 `PiecePalette.tsx`: `miniCells` se llama con el par de **cada** pieza — **AC4**
- [ ] T014 `PiecePalette.tsx`: el `aria-label` de cada botón dice **su** orientación, no la global
- [ ] T015 `PiecePalette.tsx`: la línea de orientación del 019 lee la de la seleccionada — **AC9**
- [ ] T016 `PiecePalette.tsx`: el botón `0°` junto a esa línea, con `aria-label` y `title` que digan
      las dos cosas que hace (la etiqueta sólo dice los grados) — **AC7**
- [ ] T017 Comentario: por qué `0°` y no un icono (al lado hay un `↺` y dos «volver atrás» tienen que
      distinguirse), y por qué resetea **también** la reflexión (los 29 de 96 del 019 §3)
- [ ] T018 Comentario en `MINI_BOX` / la grilla de botones: la caja fija del 016 pasa a ser **más**
      necesaria, porque ahora las doce formas cambian independientemente

## Paso 4 — `↺` no toca las orientaciones

- [ ] T019 `App.tsx`: `resetBoard` **no cambia**, y se le agrega el comentario de por qué no toca
      `ORIENTACIONES_INICIALES` pese a que existe justo al lado. Con el costo escrito: se renuncia al
      invariante «después de `↺` la app queda como recién abierta» — **AC8**

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

## PR

- [ ] T028 Rama `feature/020-la-orientacion-es-de-la-pieza`
- [ ] T029 Actualizar la fila del 020 en `specs/log.md` a `Implementado`
- [ ] T030 Anotar en `specs/revisiones.md` si el spec salió distinto de lo previsto

## Seguimiento (no bloquea)

- [ ] T031 `Orientacion` y `PlacedPiece` repiten los mismos dos campos. Unificarlos es un refactor de
      `domain/` que cruza el borde de paquete (`mcp-server/` importa 31 símbolos), con beneficio cero
      de comportamiento. Anotar en `specs/deuda.md`
- [ ] T032 La memoria no persiste: cerrar la pestaña olvida las doce orientaciones. Fuera de alcance a
      propósito — el tablero tampoco persiste

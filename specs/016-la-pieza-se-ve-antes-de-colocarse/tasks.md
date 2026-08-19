# Tasks — Spec 016

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — `miniCells`

- [ ] T001 `src/components/piece-mini.ts`: `miniCells(piece, rotation, mirror)` — compone `rotateN` y
      `reflect` de `domain/transform.ts` y agrega el centrado en la caja de 5×5
- [ ] T002 El centrado corre por `floor((5 - ancho) / 2)` sobre la forma **ya normalizada**. Con
      `round`, o leyendo el ancho antes de normalizar, la pieza queda pegada a un borde en algunas
      orientaciones y **compila igual** (`research.md` §6)
- [ ] T003 Docblock: por qué la caja es 5×5 y no ajustada al contenido (D1 — la `I` pasa de 5×1 a 1×5 y
      la grilla reflowearía en cada rotación), y por qué no 4×4 (la `I` no entra)
- [ ] T004 Docblock: acá el **invariante de orden del array no aplica** — la miniatura no numera celdas
      ni las conecta con grados. Vale decirlo porque todo el resto del dominio afirma lo contrario, y
      con razón
- [ ] T005 [P] **AC4** — test sobre las **96 combinaciones**: las cinco celdas caen dentro de `0..4` en
      los dos ejes
- [ ] T006 [P] **AC4** — test de centrado: margen simétrico salvo por el píxel impar. Es el que atrapa
      el `round` de T002
- [ ] T007 [P] **AC5** — test de que compone y no reimplementa: el resultado sin centrar coincide con
      `rotateN`/`reflect` aplicadas a mano
- [ ] T008 [P] Test de determinismo: misma entrada, mismo resultado

## Paso 2 — El botón

- [ ] T009 `PiecePalette.tsx`: el botón pasa a columna — caja de 5×5 arriba, letra chica abajo
- [ ] T010 Las celdas ocupadas se pintan con `PIECE_COLOR[key].bg` **por estilo inline**: Tailwind
      escanea el fuente y una clase interpolada no se generaría
- [ ] T011 Cada celda de la miniatura lleva **borde**, heredado del que tenía el punto de color — sin él
      el amarillo de `V` y el lima de `F` casi no se ven contra el gris del botón. Es además el idioma
      del tablero desde el 007
- [ ] T012 **AC7** — sacar el `<span>` del punto de color, con el motivo escrito: con la forma pintada,
      decía lo mismo dos veces
- [ ] T013 **AC8** — el fondo del botón no se toca: sigue siendo el único canal de "seleccionada", en el
      mismo idioma que `Rotación` y `Reflexión` de la misma tarjeta
- [ ] T014 **AC6** — `aria-label` con el nombre y la orientación. La forma dibujada con `div`s no tiene
      nombre accesible, y el botón hoy lo tenía gratis por su texto
- [ ] T015 Reescribir el comentario largo que argumenta el esquema de columnas: su cuenta está hecha
      sobre la letra más el punto, y ninguno de los dos gobierna ya el ancho (`research.md` §1)

## Paso 3 — Remedir el layout y cerrar

- [ ] T016 Elegir mini-celda y columnas **midiendo con el punto ya sacado**, contra el objetivo de D6:
      paleta entre ~470 y 520 px de caja. Empezar por 6 columnas × 6–8 px (`research.md` §3) — **AC9**
- [ ] T017 **AC10** — remedir el rango debajo de `md`, donde la tarjeta es `col-span-12`. Los tres
      números de hoy (`grid-cols-6 md:grid-cols-3 lg:grid-cols-4`) salen de la medición vieja y ninguno
      se hereda
- [ ] T018 `layout.constants.ts`: `CELL_PX` 71 → **73**
- [ ] T019 Reescribir el docblock de `CELL_PX` diciendo **cuál es la restricción que manda hoy**. Cambió
      de lado dos veces en dos specs —ancho (63) → alto (71) → ancho (73)— y sin eso escrito el próximo
      mira la tarjeta equivocada (`research.md` §4)
- [ ] T020 Verificar que el **piso de 60 px** sigue valiendo: depende de la fuente de la nota, no del
      layout, así que ninguno de los tres pasos lo movió
- [ ] T021 Actualizar la lápida de `PREVIEW_CELL_PX`, para que no parezca que este spec deshace el
      retiro del 007: aquel panel se fue por repetir las **notas**, y esto no las repite
      (`research.md` §5)
- [ ] T022 `pnpm verify` en verde — **AC12**
- [ ] T023 **AC11** — el diff no toca `domain/`, `audio/` ni `mcp-server/`. Este spec no puede cambiar
      una nota
- [ ] T024 [P] `DESIGN.md`: qué muestra la paleta ahora — hoy su tabla de superficies describe el botón
      con la letra y el punto — **AC14**
- [ ] T025 [M] **AC2** — las 8 orientaciones de la `I`, que es el peor caso: la grilla de botones no se
      mueve ni un píxel
- [ ] T026 [M] **AC3** — rotar y reflejar redibuja las doce miniaturas
- [ ] T027 [M] **AC13** — elegir la pieza correcta **sin leer la letra**, y rotar con la rueda (spec
      013) viendo el resultado en la paleta sin bajar la vista al tablero
- [ ] T028 [M] Verificar a ojo que las doce formas se distinguen entre sí al tamaño elegido. Es el
      riesgo que ningún test contesta

## PR

- [ ] T029 Rama `feature/016-la-pieza-se-ve-antes-de-colocarse` desde `main`
- [ ] T030 [M] `/pr-review` antes de pedir revisión
- [ ] T031 `specs/log.md`: estado del 016

## Seguimiento (no bloquea)

- [ ] T032 **La celda de agarre no se ve en ningún lado.** `ANCHOR_INDEX` decide dónde cae la pieza
      respecto del cursor y es información invisible; la previsualización vieja la marcaba con un punto.
      No entra acá porque en el momento en que hace falta —apuntando al tablero— el fantasma ya muestra
      la pieza entera en su lugar real. Si igual se extraña, la miniatura es el lugar obvio
- [ ] T033 Si el aire muerto en la tarjeta del tablero (T016) queda feo, la salida no es achicar la
      paleta sino **alinear la grilla arriba y dejar el sobrante abajo**, que es lo que ya pasa hoy con
      51,6 px sin que nadie lo haya notado

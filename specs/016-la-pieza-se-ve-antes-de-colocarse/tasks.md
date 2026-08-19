# Tasks — Spec 016

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — `miniCells`

- [x] T001 `src/components/piece-mini.ts`: `miniCells(piece, rotation, mirror)` — compone `rotateN` y
      `reflect` de `domain/transform.ts` y agrega el centrado en la caja de 5×5
- [x] T002 El centrado corre por `floor((5 - ancho) / 2)` sobre la forma **ya normalizada**. Con
      `round`, o leyendo el ancho antes de normalizar, la pieza queda pegada a un borde en algunas
      orientaciones y **compila igual** (`research.md` §6)
- [x] T034 **AC16** — el lado de la caja (5) y el px de la mini-celda van a
      `src/components/constants/layout.constants.ts`, **no** a `piece-mini.ts` ni al `.tsx`: un `.ts`
      de capa tiene funciones y nada más. Es donde vivía `PREVIEW_CELL_PX` y donde está `CELL_PX`
- [x] T035 Docblock de la constante del lado: por qué **no** se toma `CELLS_PER_PIECE` de `domain/` —
      cinco celdas por pieza contra cinco casillas de caja, dos números que coinciden por casualidad
- [x] T003 Docblock: por qué la caja es 5×5 y no ajustada al contenido (D1 — la `I` pasa de 5×1 a 1×5 y
      la grilla reflowearía en cada rotación), y por qué no 4×4 (la `I` no entra)
- [x] T004 Docblock: acá el **invariante de orden del array no aplica** — la miniatura no numera celdas
      ni las conecta con grados. Vale decirlo porque todo el resto del dominio afirma lo contrario, y
      con razón
> T005–T008 **no llevan `[P]`**: los cuatro escriben
> `src/components/__tests__/piece-mini.test.ts`, y `[P]` significa que no comparten archivo
> (`specs/README.md:49`). Son cuatro casos de un mismo archivo, no cuatro tareas paralelizables.

- [x] T005 **AC4** — test sobre las **96 combinaciones**: las cinco celdas caen dentro de `0..4` en
      los dos ejes
- [x] T006 **AC4** — test de centrado: margen simétrico salvo por el píxel impar. Es el que atrapa
      el `round` de T002
- [x] T007 **AC5** — test de que compone y no reimplementa: `normalize(miniCells(p, r, m))` coincide
      con `rotateN` y después `reflect` aplicadas a mano. Va contra `normalize` del resultado y no
      contra «el resultado sin centrar», que la firma no expone y no hace falta exponer
- [x] T008 Test de determinismo: misma entrada, mismo resultado

## Paso 2 — El botón

- [x] T009 `PiecePalette.tsx`: el botón pasa a columna — caja de 5×5 arriba, letra chica abajo
- [x] T036 **AC2** — la caja se dibuja con **5 pistas fijas** de la constante, nunca con `min-content`
      ni `auto`: es lo que hace que su tamaño no dependa de qué celdas estén ocupadas. Sin esto AC2
      queda apoyado sólo en el `[M]` de T025
- [x] T010 Las celdas ocupadas se pintan con `PIECE_COLOR[key].bg` **por estilo inline**: Tailwind
      escanea el fuente y una clase interpolada no se generaría
- [x] T011 Cada celda de la miniatura lleva **borde**, heredado del que tenía el punto de color — sin él
      el amarillo de `V` y el lima de `F` casi no se ven contra el gris del botón. Es además el idioma
      del tablero desde el 007
- [x] T012 **AC7** — sacar el `<span>` del punto de color, con el motivo escrito: con la forma pintada,
      decía lo mismo dos veces
- [x] T013 **AC8** — el fondo del botón no se toca: sigue siendo el único canal de "seleccionada", en el
      mismo idioma que `Rotación` y `Reflexión` de la misma tarjeta
- [x] T014 **AC6** — `aria-label` con el nombre y la orientación. La forma dibujada con `div`s no tiene
      nombre accesible, y el botón hoy lo tenía gratis por su texto
- [x] T015 Reescribir el comentario largo que argumenta el esquema de columnas: su cuenta está hecha
      sobre la letra más el punto, y ninguno de los dos gobierna ya el ancho (`research.md` §1)

## Paso 3 — Remedir el layout y cerrar

- [x] T016 Elegir mini-celda y columnas **midiendo con el punto ya sacado**, contra el objetivo de D6:
      paleta entre ~470 y 520 px de caja. Empezar por 6 columnas × 6–8 px (`research.md` §3) — **AC9**
- [x] T017 **AC10** — remedir el rango debajo de `md`, donde la tarjeta es `col-span-12`. Los tres
      números de hoy (`grid-cols-6 md:grid-cols-3 lg:grid-cols-4`) salen de la medición vieja y ninguno
      se hereda. El criterio es el que el comentario de `PiecePalette.tsx:38-52` ya usa: de 375 px a
      `max-w-6xl` saturado, el padding efectivo del botón más ancho **nunca negativo** —con el esquema
      viejo llegó a −4,6 px a 768— y la tarjeta sin scroll horizontal
- [x] T018 `layout.constants.ts`: `CELL_PX` 71 → **73**
- [x] T019 Reescribir el docblock de `CELL_PX` diciendo **cuál es la restricción que manda hoy**. Cambió
      de lado dos veces en dos specs —ancho (63) → alto (71) → ancho (73)— y sin eso escrito el próximo
      mira la tarjeta equivocada (`research.md` §4)
- [x] T020 Verificar que el **piso de 60 px** sigue valiendo: depende de la fuente de la nota, no del
      layout, así que ninguno de los tres pasos lo movió
- [x] T021 Actualizar la lápida de `PREVIEW_CELL_PX`, para que no parezca que este spec deshace el
      retiro del 007: aquel panel se fue por repetir las **notas**, y esto no las repite
      (`research.md` §5)
- [x] T022 `pnpm verify` en verde — **AC12**
- [x] T023 **AC11** — el diff no toca `domain/`, `audio/` ni `mcp-server/`. Este spec no puede cambiar
      una nota
- [x] T024 [P] `DESIGN.md`: **dos** filas, no una — `DESIGN.md:128` (la fila `PiecePalette` de *El
      color comunica identidad*, que dice «el color entra al costado») y `DESIGN.md:79` (la fila
      `CELL_PX` de *Qué muestra una celda*, que queda mintiendo con el número nuevo) — **AC14**
- [x] T037 [P] `docs/architecture/directory-structure.md`: entran `piece-mini.ts` y
      `__tests__/piece-mini.test.ts`. Ese doc enumera `components/` archivo por archivo —`cell-text.ts`
      y su test están ahí desde el 012— así que agregarlos sin tocarlo lo deja incompleto. Mismo
      movimiento que el T035 del 014 — **AC15**
- [ ] T025 [M] **AC2** — las 8 orientaciones de la `I`, que es el peor caso: la grilla de botones no se
      mueve ni un píxel
- [ ] T026 [M] **AC3** — rotar y reflejar redibuja las doce miniaturas
- [ ] T027 [M] **AC13** — elegir la pieza correcta **sin leer la letra**, y rotar con la rueda (spec
      013) viendo el resultado en la paleta sin bajar la vista al tablero
- [ ] T028 [M] Verificar a ojo que las doce formas se distinguen entre sí al tamaño elegido. Es el
      riesgo que ningún test contesta

## PR

- [x] T038 **Verificar que el 014 está mergeado antes de arrancar**: `CELL_PX` en 71 y la paleta en
      `md:col-span-4`. Si están en 63 y `col-span-3`, el paso 3 mide contra otro layout y hay que
      remedirlo entero después
- [x] T029 Rama `feature/016-la-pieza-se-ve-antes-de-colocarse` desde `main`
- [ ] T030 [M] `/pr-review` antes de pedir revisión
- [x] T031 `specs/log.md`: estado del 016

## Seguimiento (no bloquea)

- [ ] T032 **La celda de agarre no se ve en ningún lado.** `ANCHOR_INDEX` decide dónde cae la pieza
      respecto del cursor y es información invisible; la previsualización vieja la marcaba con un punto.
      No entra acá porque en el momento en que hace falta —apuntando al tablero— el fantasma ya muestra
      la pieza entera en su lugar real. Si igual se extraña, la miniatura es el lugar obvio
- [ ] T039 **`miniCells` suma un consumidor a la deuda de la rotación sin acotar.** `specs/deuda.md`
      la registra como «un `number` sin acotar, comparada contra `0|1|2|3` en cuatro lugares», con el
      reemplazo ya decidido (const-object + union type, nunca `enum`). No se arregla acá porque cambia
      firmas de `domain/` y AC11 lo prohíbe, pero el spec que lo haga tiene que contar este consumidor
- [ ] T033 Si el aire muerto en la tarjeta del tablero (T016) queda feo, la salida no es achicar la
      paleta sino **alinear la grilla arriba y dejar el sobrante abajo**, que es lo que ya pasa hoy con
      51,6 px sin que nadie lo haya notado

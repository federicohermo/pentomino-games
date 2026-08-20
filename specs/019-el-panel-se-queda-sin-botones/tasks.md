# Tasks — Spec 019

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — Se van los seis botones

- [ ] T001 `PiecePalette.tsx`: borrar los cuatro botones de grados (`0° 90° 180° 270°`) — **AC1**
- [ ] T002 `PiecePalette.tsx`: borrar la fila de `Reflexión ON/OFF` — **AC1**
- [ ] T003 `PiecePalette.tsx`: el régimen sube a fila propia con la etiqueta `Rotación`, y desaparece
      el `<div>` que envolvía las dos líneas — **AC3**
- [ ] T004 Comentario en la fila de régimen: por qué asciende (la frase que completaba se quedó sin
      sujeto) y por qué **no** se borra (el precedente del `T070` del 011, agravado: el régimen no
      tiene ningún gesto directo)
- [ ] T005 `PiecePalette.tsx` + `App.tsx`: sacar las props `onRotate` y `onMirror`. **`rotation` y
      `mirror` se quedan** — las usan la miniatura del 016 y la línea nueva de T007 — **AC12**

- [ ] T035 `PiecePalette.tsx`: los comentarios que se quedan sin referente al borrar las dos filas.
      Son tres y están medidos: el docblock del componente (`:12`, «eleccion de pieza, rotacion,
      reflexion…»), el del botón de recorrido (`:205`, «con el mismo idioma que Reflexion») y el del
      transporte (`:283`, «lo activo en Rotacion y Reflexion» y «el "apagado" de esos dos»). El idioma
      visual sobrevive en el régimen; lo que se va son los nombres que citan

> T001–T005 escriben el mismo archivo, así que ninguna lleva `[P]`. **Los borrados van en su propio
> commit** (convención del repo), pero en el **mismo commit que el paso 2**: separarlos dejaría un
> commit donde la orientación no se lee en ninguna parte para 6 de 12 piezas.

## Paso 2 — La orientación se lee en texto

- [ ] T006 Pura nueva `textoDeOrientacion(rotation, mirror)` en un **módulo propio** de `components/`,
      hermano de `piece-mini.ts` (**no** inline en el `.tsx`:
      `react-refresh/only-export-components` la dejaría sin poder exportarse y por lo tanto sin poder
      testearse; y **no** en `cell-text.ts`, que contesta qué dice una celda del tablero y cuyo tipo
      cruza a `Board.tsx`). `rotation` sigue siendo `number` sin acotar, como en todo el repo — el
      union type es la deuda abierta de `deuda.md` y no se salda acá, pero esta pura es su próxima casa
- [ ] T007 `PiecePalette.tsx`: la línea, junto al `<b>{selected}</b> → tónica …` — **AC4**
- [ ] T031 `PiecePalette.tsx:115`: el `aria-label` de los doce botones consume la pura de T006 en vez
      de armar el texto inline. Son dos copias de la misma derivación en el mismo archivo, en dos
      formatos (`rotación 180°, reflejada` contra `180° · reflejada`) — **AC13**
- [ ] T008 Medir el peor caso de largo (`270° · reflejada`) y reservarle el alto, como ya hace
      `min-h-[2lh]` en `Notas actuales`. Sin esto la línea envuelve al cambiar de pieza y mueve todo
      lo de abajo, que es el bug que esa reserva existe para evitar
- [ ] T009 Test de `textoDeOrientacion` en `components/__tests__/`: las ocho combinaciones de
      rotación × reflexión
- [ ] T010 Test, **en el mismo archivo que T009**: para `I T U V W X`, dos orientaciones que dan la
      misma `miniCells` dan textos **distintos** — **AC5**. Es el criterio que justifica todo el paso
      2, y esta es su forma falsable: la pura no recibe la pieza, así que «correcta para seis piezas»
      sólo se verifica cruzándola con `miniCells`
- [ ] T032 [M] Navegador: la línea nueva **no envuelve** en el rango de anchos, y el alto reservado de
      T008 es el correcto. La reserva es código y no bloquea; medirla sí pide el DOM, como el
      `min-h-[2lh]` que la precede

> T009 y T010 **no** llevan `[P]`: escriben el mismo archivo de test. Con `[P]` los dos,
> `spec-implement` los abanica y el conflicto aparece recién al escribir.

## Paso 3 — La fila de transporte

- [ ] T011 `PiecePalette.tsx`: el botón de recorrido se muda a la fila de transporte y pierde el texto;
      estado por color (`bg-slate-900` encendido) — **AC6**
- [ ] T012 SVG del metrónomo **inline**, `1em` + `currentColor` + `aria-hidden="true"`; `aria-label` y
      `title` en el **botón**, con la etiqueta entera (más larga que la que cabía en la fila) —
      **AC7**
- [ ] T013 Comentario: por qué SVG y no glifo (Unicode no tiene metrónomo; ⏱ es cronómetro, 🎵 es lo
      que hace el ▶ de al lado) y por qué **sin archivo propio**
- [ ] T014 `Reset` pasa a `↺` con `aria-label` y `title`; sigue vaciando el tablero **y** frenando el
      transporte — **AC8**
- [ ] T015 Separar `↺` del par ▶/metrónomo: es el único destructivo de los tres y no tiene deshacer

## Paso 4 — Rehacer la medición de `CELL_PX`

> **Va después de T022, no antes.** Los números del research §2 son de la resta sola: la línea de AC4
> devuelve ~20 px y está en el mismo commit, así que la paleta real queda en ~490 y el que manda
> sigue siendo el ancho. Escribir el docblock desde §2 es escribirle una cifra que la app no tiene —y
> es el mismo docblock que ya se equivocó dos veces por esto exacto.

- [ ] T016 `layout.constants.ts`: agregar la fila del 019 a la tabla de «quién manda», con **lo que
      midió T022** — **AC9**
- [ ] T017 `layout.constants.ts`: reescribir el párrafo de los 26 px de colchón con el colchón real
      (~30 px si la medición confirma la cuenta). Anotar que el 020 agrega otra línea
- [ ] T033 `layout.constants.ts`: el párrafo de abajo de la tabla —«agrandar el tablero hoy pide más
      ANCHO … el alto ya sobra»— y el bullet del **techo útil**, que cita `730,7 × 464` y «por alto
      77,3» sobre una paleta de 496 px que deja de existir. Sin esto el docblock se contradice consigo
      mismo en el mismo comentario
- [ ] T034 `layout.constants.ts`: verificar que el docblock de `MINI_CELL_PX`, que cita el mismo
      umbral de «~470 px de caja», sigue siendo cierto. Si lo es, no se toca
- [ ] T018 Verificar que el **piso de 60** queda intacto: depende de la fuente y este spec no toca el
      `text-[19px]` de `Board.tsx`
- [ ] T019 `App.tsx`: **leer** el footer y confirmar que no hay nada que sacar — hoy no menciona ningún
      botón, nombra `Rotación` y `Reflexión` como transformaciones del modelo (`App.tsx:447-451`). La
      primera oración **no se toca** — **AC10**
- [ ] T020 Verificar que `PiecePalette` sigue sin estado y sin efectos — **AC11**

## Paso 5 — La documentación que este spec falsifica

Agregado por el review. No son specs viejos —esos no se reescriben— sino las tres páginas que el repo
sí mantiene al día, y las tres lo afirman **en presente**. **AC14**.

- [ ] T036 [P] `docs/guides/quickstart.md:58-59`: el mecanismo por el que «los atajos se descubren
      solos» era ver iluminarse `180°` en la paleta. Ese botón muere; el lector nuevo es la línea de
      AC4, y la frase tiene que decir eso. La tabla de gestos de `:65-70` sigue siendo correcta
- [ ] T037 [P] `docs/architecture/audio.md:247`: «el toggle «Recorrido en el vacío» de la paleta» pasa
      a ser el icono de metrónomo de la fila de transporte. La etiqueta sobrevive en `title` y
      `aria-label`, y eso es lo que hay que escribir
- [ ] T038 [P] `DESIGN.md:250-251`: «el panel lo enciende con «Recorrido en el vacío»», con la
      etiqueta a la vista. Mismo cambio que T037, y acá además importa que el nombre de cara al
      usuario **no** cambia: cambia dónde se lee

## Verificación

- [ ] T021 `pnpm verify` en verde
- [ ] T022 [M] Navegador: medir `CELL_PX` en el DOM y confirmar que sigue en **73** — **AC9**. Es la
      única forma de verificarlo de verdad
- [ ] T023 [M] Navegador: rotar una `X` cuatro veces y confirmar que la línea de texto es lo único que
      cambia — **AC4**, **AC5**
- [ ] T024 [M] Navegador: rueda, `Shift`, botón derecho y `Ctrl` siguen rotando y reflejando — **AC2**
- [ ] T025 [M] Navegador: el SVG del metrónomo está ópticamente alineado con ▶ y ↺
- [ ] T026 [M] Navegador: el metrónomo enciende y apaga el recorrido, y su color lo dice — **AC6**

## PR

- [ ] T027 Rama `feature/019-el-panel-se-queda-sin-botones`
- [ ] T028 Actualizar la fila del 019 en `specs/log.md` a `Implementado`
- [ ] T029 Anotar en `specs/revisiones.md` si el spec salió distinto de lo previsto

## Seguimiento (no bloquea)

- [ ] T030 `↺` no tiene deshacer y ahora tampoco tiene la palabra «Reset» que lo frenaba un segundo.
      La deuda de «no hay deshacer» ya está en `specs/deuda.md` desde el 014; anotar ahí que este spec
      la roza sin agrandarla

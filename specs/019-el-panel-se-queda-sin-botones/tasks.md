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

> T001–T005 escriben el mismo archivo, así que ninguna lleva `[P]`. **Los borrados van en su propio
> commit** (convención del repo), pero en el **mismo commit que el paso 2**: separarlos dejaría un
> commit donde la orientación no se lee en ninguna parte para 6 de 12 piezas.

## Paso 2 — La orientación se lee en texto

- [ ] T006 Pura nueva `textoDeOrientacion(rotation, mirror)` en un módulo de `components/` (**no**
      inline en el `.tsx`: `react-refresh/only-export-components` la dejaría sin poder exportarse y
      por lo tanto sin poder testearse)
- [ ] T007 `PiecePalette.tsx`: la línea, junto al `<b>{selected}</b> → tónica …` — **AC4**
- [ ] T008 Medir el peor caso de largo (`270° · reflejada`) y reservarle el alto, como ya hace
      `min-h-[2lh]` en `Notas actuales`. Sin esto la línea envuelve al cambiar de pieza y mueve todo
      lo de abajo, que es el bug que esa reserva existe para evitar
- [ ] T009 [P] Test de `textoDeOrientacion`: las ocho combinaciones de rotación × reflexión
- [ ] T010 [P] Test: la línea es correcta para las seis piezas donde la miniatura no puede decirlo
      (`I T U V W X`) — **AC5**. Es el criterio que justifica todo el paso 2

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

- [ ] T016 `layout.constants.ts`: agregar la fila del 019 a la tabla de «quién manda» con lo medido
      (73,1 por ancho contra 73,0 por alto) — **AC9**
- [ ] T017 `layout.constants.ts`: reescribir el párrafo de los 26 px de colchón. **El colchón se
      gastó**: el 73 sobrevive por 0,1 px y la próxima fila que salga del panel sí lo baja. Anotar que
      el 020 lo devuelve
- [ ] T018 Verificar que el **piso de 60** queda intacto: depende de la fuente y este spec no toca el
      `text-[19px]` de `Board.tsx`
- [ ] T019 `App.tsx`: el footer saca las menciones a los botones borrados y conserva los cuatro gestos
      del 013 — **AC10**
- [ ] T020 Verificar que `PiecePalette` sigue sin estado y sin efectos — **AC11**

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

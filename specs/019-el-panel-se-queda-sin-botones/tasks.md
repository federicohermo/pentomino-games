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
- [ ] T005 `PiecePalette.tsx` + `panel.types.ts` + `App.tsx`: sacar `onRotate` y `onMirror`. Desde el
      spec 022 dejaron de ser props sueltas de `PiecePalette`: hoy son dos campos de
      `PropsDeOrientacion` (`panel.types.ts`), así que esto es borrar los dos campos del tipo, la
      desestructuración en `PiecePalette.tsx` y las dos entradas del literal `orientacion={{…}}` que
      arma `App.tsx` — ya no es tocar la firma del componente. **`rotation` y `mirror` se quedan** —
      las usan la miniatura del 016 (hoy en `OrientationPanel.tsx`) y la línea nueva de T007 —
      **AC12**

- [ ] T035 Los comentarios que se quedan sin referente al borrar las dos filas. Son **cuatro** y están
      medidos, pero el spec 022 los repartió en **tres archivos** (antes los cuatro vivían en
      `PiecePalette.tsx`) y además reescribió uno de punta a punta, así que ninguno se toca por número
      de línea:
      - `PiecePalette.tsx`, el docblock del componente («## Por que este archivo se queda con cuatro
        filas»): la frase «bajo el `space-y-2` de abajo el orden real es Rotacion → Reflexion →
        *clicks* → linea de notas → Tempo» nombra una fila, Reflexión, que T002 borra entera —el
        docblock viejo que citaba «eleccion de pieza, rotacion, reflexion…» ya no existe, el 022 lo
        reescribió por otro motivo (la partición en tres componentes) y este es el texto que hay que
        corregir en su lugar
      - `panel.types.ts`, el docblock del campo `regimen` de `PropsDeOrientacion` («completa la frase
        de su propia fila»), que deja de ser cierto en cuanto T003 la asciende a fila propia —con el
        022 esta línea se mudó de `PiecePalette.tsx` a este archivo
      - `PiecePalette.tsx`, el del botón de recorrido («con el mismo idioma que Reflexion»): sigue en
        este archivo porque T011, que lo muda a `TransportPanel.tsx`, es del paso 3 y corre después
        de este
      - `TransportPanel.tsx`, el del botón de play («lo activo en Rotacion y Reflexion» y «el
        "apagado" de esos dos»): con el 022 este comentario ya no vive en `PiecePalette.tsx`

      El idioma visual sobrevive en el régimen; lo que se va son los nombres que citan

> T001–T005 comparten `PiecePalette.tsx` —T005 además toca `panel.types.ts` y `App.tsx`—, así que
> ninguna lleva `[P]`. **Los borrados van en su propio
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
- [ ] T031 `OrientationPanel.tsx`: el `aria-label` de los doce botones (el que arma
      `` `${key}, rotación ${rotation * 90}°…` ``) consume la pura de T006 en vez de armar el texto
      inline. Con el spec 022 esta línea se mudó de `PiecePalette.tsx` a `OrientationPanel.tsx`, así
      que las dos copias de la misma derivación —en dos formatos, `rotación 180°, reflejada` contra
      `180° · reflejada`— dejaron de compartir archivo con la de T007, que se queda en
      `PiecePalette.tsx`: la duplicación que T031 salda ahora cruza dos componentes — **AC13**
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

- [ ] T011 `PiecePalette.tsx` + `TransportPanel.tsx`: el botón de recorrido —hoy la fila «Recorrido
      en el vacío» de `PiecePalette.tsx`— se borra de ahí y se agrega a la fila de transporte de
      `TransportPanel.tsx`, perdiendo el texto; estado por color (`bg-slate-900` encendido). Desde
      el 022 `clicks`/`onToggleClicks` ya viajan en `PropsDeTransporte`, así que `panel.types.ts` no
      cambia — solo el JSX que los consume. **Además**: actualizar el docblock del componente de
      `PiecePalette.tsx` (el que dice «El 019 vuelve contigua parte de esta interpolación cuando muda
      el boton de los clicks… en un spec el problema se achica solo») y el comentario del propio
      row que citaba el reordenamiento de DOM (AC18 del 022) — con clicks afuera, el argumento de «no
      se puede mover sin reordenar el DOM» deja de aplicar a esa fila y la cuenta de filas del título
      («Por que este archivo se queda con cuatro filas») baja — **AC6**
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
>
> **Y lo que este paso escribe, el 021 lo borra**: su `T002` reescribe este docblock entero y se lleva
> la tabla de «quién manda» y el párrafo del colchón; su `T025` se lleva el de `MINI_CELL_PX`. Se
> escribe igual por dos razones, y conviene tenerlas a la vista para repartir el esfuerzo: el 019
> mergea antes y no puede dejar el comentario mintiendo, y **la medición de T022 es el insumo del piso
> del 021** (`021/tasks.md` T001, que toma el 73 de acá y no de `main`). O sea: **la prosa se escribe
> corta y el número se escribe exacto**, porque de los dos sólo el número sobrevive al 021.

- [ ] T016 `layout.constants.ts`: agregar la fila del 019 a la tabla de «quién manda», con **lo que
      midió T022** — **AC9**
- [ ] T017 `layout.constants.ts`: reescribir el párrafo de los 26 px de colchón con el colchón real
      (~30 px si la medición confirma la cuenta). Anotar que el 020 le mete el botón `0°` **inline a
      esa misma línea** —no una fila nueva—, o sea ~10 px más de los ~30, y que ahí el margen queda en
      décimas: la próxima fila que salga del panel sí achica el tablero
- [ ] T033 `layout.constants.ts`: el párrafo de abajo de la tabla —«agrandar el tablero hoy pide más
      ANCHO … el alto ya sobra»— y el bullet del **techo útil**, que cita `730,7 × 464` y «por alto
      77,3» sobre una paleta de 496 px que deja de existir. Sin esto el docblock se contradice consigo
      mismo en el mismo comentario
- [ ] T034 `layout.constants.ts`: verificar que el docblock de `MINI_CELL_PX`, que cita el mismo
      umbral de «~470 px de caja», sigue siendo cierto. Si lo es, no se toca
- [ ] T018 Verificar que el **piso de 60** queda intacto: depende de la fuente y este spec no toca el
      `text-[19px]` de `Board.tsx`
- [ ] T019 `App.tsx`: **leer** el footer y confirmar que no hay nada que sacar — hoy no menciona ningún
      botón, nombra `Rotación` y `Reflexión` como transformaciones del modelo (el `<footer>` con la
      frase «Rotación cambia la fórmula de escala o el arranque del arpegio…»; el spec 022 corrió de
      línea el archivo entero, así que no vale citarlo por número). La primera oración **no se toca**
      — **AC10**
- [ ] T020 Verificar que `PiecePalette` sigue sin estado y sin efectos. Desde el spec 022 dos de sus
      filas viven en componentes propios (`OrientationPanel.tsx`, `TransportPanel.tsx`);
      confirmar que tampoco ganaron estado ni efectos al recibir el botón que este paso les mueve
      (T011) — **AC11**

## Paso 5 — La documentación que este spec falsifica

Agregado por el review. No son specs viejos —esos no se reescriben— sino las tres páginas que el repo
sí mantiene al día, y las tres lo afirman **en presente**. **AC14**.

- [ ] T036 [P] `docs/guides/quickstart.md:58-59`: el mecanismo por el que «los atajos se descubren
      solos» era ver iluminarse `180°` en la paleta. Ese botón muere; el lector nuevo es la línea de
      AC4, y la frase tiene que decir eso. La cita del spec decía `:58-59` y es `:59-61`. La tabla de
      gestos de `:65-70` sigue siendo correcta. **Y en el mismo archivo, `:80-81`**: «con el foco sobre
      `Reset`, activa `Reset`» nombra al botón por su etiqueta visible, que pasa a ser `↺`. La frase
      sobre el foco no cambia; el nombre sí.
      **Si el 018 ya está mergeado, todos esos números se corrieron**: agrega una fila a la tabla (las
      doce letras) y la frase de arriba deja de poder decir «los **tres** gestos que gobiernan la pieza
      por colocar», porque la letra es una cuarta vía de entrada. Buscar por texto y no por número de
      línea. La tabla en sí sigue siendo correcta; lo que cambia es dónde empieza y cuántas filas tiene
      — **AC8**, **AC14**
- [ ] T037 [P] `docs/architecture/audio.md:247`: «el toggle «Recorrido en el vacío» de la paleta» pasa
      a ser el icono de metrónomo de la fila de transporte. La etiqueta sobrevive en `title` y
      `aria-label`, y eso es lo que hay que escribir
- [ ] T038 [P] `DESIGN.md:250-251`: «el panel lo enciende con «Recorrido en el vacío»», con la
      etiqueta a la vista. Mismo cambio que T037, y acá además importa que el nombre de cara al
      usuario **no** cambia: cambia dónde se lee

## Verificación

- [ ] T021 `pnpm verify` en verde — **AC15**
- [ ] T022 [M] Navegador: medir `CELL_PX` en el DOM y confirmar que sigue en **73** — **AC9**. Es la
      única forma de verificarlo de verdad
- [ ] T023 [M] Navegador: rotar una `X` cuatro veces y confirmar que la línea de texto es lo único que
      cambia — **AC4**, **AC5**
- [ ] T024 [M] Navegador: rueda, `Shift`, botón derecho y `Ctrl` siguen rotando y reflejando — **AC2**
- [ ] T025 [M] Navegador: el SVG del metrónomo está ópticamente alineado con ▶ y ↺
- [ ] T026 [M] Navegador: el metrónomo enciende y apaga el recorrido, y su color lo dice — **AC6**
- [ ] T039 [M] Navegador: el metrónomo **apagado** y `↺` se distinguen uno del otro. Son
      `bg-slate-100` contra `bg-slate-200` y ahora están en la misma fila, que es el par que el 008
      rechazó por indistinguible (el botón de Reset, con el spec 022 en `TransportPanel.tsx` y no
      en `PiecePalette.tsx`, ya en `bg-slate-200`) — **AC6**
- [ ] T040 [M] Navegador: `↺` sigue haciendo las **dos** cosas — vacía el tablero y frena el
      transporte —. Con el spec 022 `resetBoard` llama a `frenarTransporte()` (exportada de
      `use-engine.ts`) en vez de al `stopClock()` de antes, y se corrió de línea: ya no está en
      `App.tsx:176-180`. Es cableado y no comportamiento —esa migración es cuenta del 022, no de este
      spec—, así que el riesgo para esta verificación sigue siendo bajo; el AC no tenía contraparte
      igual — **AC8**

## PR

- [ ] T027 Rama `feature/019-el-panel-se-queda-sin-botones`
- [ ] T028 Actualizar la fila del 019 en `specs/log.md` a `Implementado`
- [ ] T029 Anotar en `specs/revisiones.md` si el spec salió distinto de lo previsto

## Seguimiento (no bloquea)

- [ ] T030 `↺` no tiene deshacer y ahora tampoco tiene la palabra «Reset» que lo frenaba un segundo.
      La deuda de «no hay deshacer» ya está en `specs/deuda.md` desde el 014; anotar ahí que este spec
      la roza sin agrandarla

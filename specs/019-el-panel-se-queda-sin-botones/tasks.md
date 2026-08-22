# Tasks — Spec 019

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — Se van los seis botones

- [x] T001 `PiecePalette.tsx`: borrar los cuatro botones de grados (`0° 90° 180° 270°`). Verificado
      contra el árbol de hoy: siguen ahí y no se los llevó el 022 — son el `.map` de
      `PiecePalette.tsx:82-84`, adentro del `<div role="group" aria-labelledby="rotacion-etiqueta">`
      que el 025 les puso. Se van los cuatro botones, el `role="group"` **y** el
      `<span id="rotacion-etiqueta">Rotación</span>` que lo nombra: dejar el span vivo deja una
      etiqueta sin control, y borrarlo sin mirar T003 deja el `id` que T003 necesita reutilizar —
      **AC1**
- [x] T002 `PiecePalette.tsx`: borrar la fila de `Reflexión ON/OFF` (hoy `:97-100`), entera: el
      `<span id="reflexion-etiqueta">` y el botón con su `aria-labelledby` y su `aria-pressed={mirror}`.
      El `aria-pressed` que el 025 le puso se va **con** el control que lo justificaba, no queda
      huérfano — y el estado de la reflexión sigue anunciándose: lo dice el `aria-label` de los doce
      botones (`OrientationPanel.tsx:103`) y, desde T007, la línea visible — **AC1**
- [x] T003 `PiecePalette.tsx`: el régimen sube a fila propia con la etiqueta `Rotación`, y desaparece
      el `<div>` que envolvía las dos líneas. **Tres cosas que el 025 agregó y hay que decidir a
      propósito**, porque la fila de hoy (`:87-95`) no es la de cuando se escribió este spec:
      - el `<span id="regimen-etiqueta" className="text-xs text-slate-600">cambia</span>` pasa a decir
        `Rotación` con el `font-medium` de las otras filas, o sea que el **nombre accesible del
        grupo** cambia de `cambia` a `Rotación`. El `role="group" aria-labelledby` se queda: es lo que
        hace que los dos botones se lean como un conjunto, y `.claude/rules/ui.md` lo exige
      - la palabra `cambia` desaparece de la pantalla, y era la que hacía que la fila se leyera como
        oración (AC10 del 017). Sin ella `Rotación | escala orden` se puede leer como si la rotación
        tuviera dos valores. Si el texto no alcanza, el lugar donde decirlo entero es el `title` del
        grupo — lo que **no** vale es dejar la fila diciendo menos de lo que decía
      - los dos `aria-pressed={regimen===r}` de los botones **se quedan**: la fila cambia de etiqueta,
        no de naturaleza — **AC3**
- [x] T004 Comentario en la fila de régimen: por qué asciende (la frase que completaba se quedó sin
      sujeto) y por qué **no** se borra (el precedente del `T070` del 011, agravado: el régimen no
      tiene ningún gesto directo). Se reescribe **en su lugar** el bloque de `PiecePalette.tsx:60-70`,
      cuya primera frase —«La fila de Rotación son DOS líneas y no dos filas»— T003 vuelve falsa de
      punta a punta. **Y el bloque de al lado, `:71-77`, también**: es del 025, no existía cuando se
      escribió este spec, y dice «los dos grupos de abajo» / «los cuatro de rotación y los dos de
      régimen» — con T001 queda **un** grupo de **dos** botones. Su argumento (por qué `role="group"` y
      no `radiogroup`) sigue valiendo y no se borra: se le corrige la cuenta
- [x] T005 `PiecePalette.tsx` + `panel.types.ts` + `App.tsx`: sacar `onRotate` y `onMirror`. Desde el
      spec 022 dejaron de ser props sueltas de `PiecePalette`: hoy son dos campos de
      `PropsDeOrientacion` (`panel.types.ts`), así que esto es borrar los dos campos del tipo, la
      desestructuración en `PiecePalette.tsx` y las dos entradas del **`useMemo` de
      `App.tsx:314-319`** — con el 027 el objeto ya no se arma inline en el JSX, así que se edita ahí;
      sus deps (`[selected, rotation, mirror, regimen, noteSet]`) **no cambian**. Y los dos setters
      sobreviven —`rotarConTecla` (`:249`), `alRotar` (`:256`), `reflejarConTecla` (`:250`) y el
      `onContextMenu` (`:270`)—, o sea que el borrado no deja una variable sin uso — ya no es tocar la
      firma del componente. **`rotation` y `mirror` se quedan** —
      las usan la miniatura del 016 (hoy en `OrientationPanel.tsx`) y la línea nueva de T007 —
      **AC12**

- [x] T035 Los comentarios que se quedan sin referente al borrar las dos filas. Son **cuatro** y están
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

      Y hay un **quinto**, que el spec no tenía porque nombra al botón que T014 renombra:
      - `PiecePalette.tsx:131`, en el docblock de la línea de notas: «movía todo lo que tiene debajo
        —Tempo, transporte, Reset— 20 px hacia abajo». `Reset` deja de ser el nombre visible

      El idioma visual sobrevive en el régimen; lo que se va son los nombres que citan

> T001–T005 comparten `PiecePalette.tsx` —T005 además toca `panel.types.ts` y `App.tsx`—, así que
> ninguna lleva `[P]`. **Los borrados van en su propio
> commit** (convención del repo), pero en el **mismo commit que el paso 2**: separarlos dejaría un
> commit donde la orientación no se lee en ninguna parte para 6 de 12 piezas.

## Paso 2 — La orientación se lee en texto

- [x] T006 Pura nueva `textoDeOrientacion(rotation, mirror)` en `src/components/orientation-text.ts`,
      hermana de `piece-mini.ts` (**no** inline en el `.tsx`:
      `react-refresh/only-export-components` la dejaría sin poder exportarse y por lo tanto sin poder
      testearse; y **no** en `cell-text.ts`, que contesta qué dice una celda del tablero y cuyo tipo
      cruza a `Board.tsx`). `rotation` sigue siendo `number` sin acotar acá, pero **el 020 le pone
      techo en el mismo lote**: su `T003` crea el union `Rotacion` en
      `components/types/orientation.types.ts`, así que **esta pura no es «la próxima casa» del tipo** y
      no hay que escribir que lo sea — un comentario que afirme que el union todavía no existe queda
      falsificado un spec después. La deuda de `deuda.md` la reconta y la achica el `T031` del 020.
      **Nombre de archivo en inglés**, y no es cosmética: los 57 archivos de `src/` están en inglés y
      los siete que el 022 estrenó en castellano **se revirtieron** (`specs/revisiones.md`, 2026-08-20)
      —`motor.ts` volvió a `engine-bridge.ts`, `use-entrada.ts` a `use-input.ts`—, con **este lote como
      destinatario explícito** de la decisión: se renombró ahora, midiendo, porque «renombrar antes de
      implementarlos cuesta un `sed` y después cuesta lo mismo más todo el código que se escriba
      encima». La regla que quedó **no es simétrica**: archivo en inglés siempre, identificador en
      castellano permitido **sólo dentro de `components/`** (hay 21 exportados así), así que la pura sí
      se llama `textoDeOrientacion` y el archivo no. En el mismo lote el 020 nombra
      `orientation.types.ts` y el 021 `cell-px.ts`. Va al proyecto
      **`node`** de Vitest —es un `.ts` puro— y el umbral de coverage es 100, así que nace con T009
- [x] T007 `PiecePalette.tsx`: la línea, junto al `<b>{selected}</b> → tónica …` — hoy el `<p>` de
      `:127`, adentro del bloque `pt-2 text-sm text-slate-600` de `:126`, arriba de `Notas actuales`
      (`:144`; el `PiecePalette.tsx:254` que el spec citaba es de antes del 022) — **AC4**
- [x] T031 `OrientationPanel.tsx`: el `aria-label` de los doce botones (el que arma
      `` `${key}, rotación ${rotation * 90}°…` ``) consume la pura de T006 en vez de armar el texto
      inline. Con el spec 022 esta línea se mudó de `PiecePalette.tsx` a `OrientationPanel.tsx`, así
      que las dos copias de la misma derivación —en dos formatos, `rotación 180°, reflejada` contra
      `180° · reflejada`— dejaron de compartir archivo con la de T007, que se queda en
      `PiecePalette.tsx`: la duplicación que T031 salda ahora cruza dos componentes — **AC13**
- [x] T008 Medir el peor caso de largo (`270° · reflejada`) y reservarle el alto, como ya hace
      `min-h-[2lh]` en `Notas actuales`. Sin esto la línea envuelve al cambiar de pieza y mueve todo
      lo de abajo, que es el bug que esa reserva existe para evitar
- [x] T009 Test de `textoDeOrientacion` en `components/__tests__/orientation-text.test.ts` —el nombre
      sale del módulo de T006, en inglés—: las ocho combinaciones de
      rotación × reflexión
- [x] T010 Test, **en el mismo archivo que T009**: para `I T U V W X`, dos orientaciones que dan la
      misma `miniCells` dan textos **distintos** — **AC5**. Es el criterio que justifica todo el paso
      2, y esta es su forma falsable: la pura no recibe la pieza, así que «correcta para seis piezas»
      sólo se verifica cruzándola con `miniCells`
- [ ] T032 [M] Navegador: la línea nueva **no envuelve** en el rango de anchos, y el alto reservado de
      T008 es el correcto. La reserva es código y no bloquea; medirla sí pide el DOM, como el
      `min-h-[2lh]` que la precede

> T009 y T010 **no** llevan `[P]`: escriben el mismo archivo de test. Con `[P]` los dos,
> `spec-implement` los abanica y el conflicto aparece recién al escribir.

## Paso 3 — La fila de transporte

- [x] T011 `PiecePalette.tsx` + `TransportPanel.tsx`: el botón de recorrido —hoy la fila «Recorrido
      en el vacío» de `PiecePalette.tsx`— se borra de ahí y se agrega a la fila de transporte de
      `TransportPanel.tsx`, perdiendo el texto; estado por color (`bg-slate-900` encendido). Desde
      el 022 `clicks`/`onToggleClicks` ya viajan en `PropsDeTransporte`, así que `panel.types.ts` no
      cambia — solo el JSX que los consume. **Además**: actualizar el docblock del componente de
      `PiecePalette.tsx` (el que dice «El 019 vuelve contigua parte de esta interpolación cuando muda
      el boton de los clicks… en un spec el problema se achica solo») y el comentario del propio
      row que citaba el reordenamiento de DOM (AC18 del 022) — con clicks afuera, el argumento de «no
      se puede mover sin reordenar el DOM» deja de aplicar a esa fila y la cuenta de filas del título
      («Por que este archivo se queda con cuatro filas») baja.
      **Y dos cosas más que el 025 y el 022 pusieron ahí después de que este spec se escribiera:**
      - el botón de hoy (`PiecePalette.tsx:124`) lleva `aria-pressed={clicks}` y
        `aria-labelledby="recorrido-etiqueta"`. El **`aria-pressed` viaja** —sin él el estado del
        metrónomo queda en el color y en nada más, y `.claude/rules/ui.md` lo declara regla nombrando a
        este spec por número—; el `aria-labelledby` **no puede**, porque el `<span
        id="recorrido-etiqueta">` muere con la fila, así que pasa a `aria-label` (T012)
      - el docblock de `TransportPanel.tsx:10-14` dice que es «el unico subarbol CONTIGUO de los dos
        paneles (el boton de los clicks cae entre dos bloques de orientacion)»: eso es exactamente lo
        que esta tarea deshace, así que ese párrafo se corrige en el mismo commit — **AC6**, **AC7**
- [x] T012 SVG del metrónomo **inline**, `1em` + `currentColor` + `aria-hidden="true"`; `aria-label`,
      `title` **y `aria-pressed`** en el **botón**, con la etiqueta entera (más larga que la que cabía
      en la fila). Los tres atributos del botón no son tres decisiones: `.claude/rules/ui.md` fija
      «todo control solo-icono lleva `aria-label`» y «todo control que alterna lleva `aria-pressed`, y
      su nombre es lo que alterna, no el valor» — o sea que el nombre dice **qué se apaga** y nunca
      `ON`/`OFF`. El `aria-pressed` llega desde T011, no se inventa acá — **AC7**
- [x] T013 Comentario: por qué SVG y no glifo (Unicode no tiene metrónomo; ⏱ es cronómetro, 🎵 es lo
      que hace el ▶ de al lado) y por qué **sin archivo propio**
- [x] T014 `Reset` pasa a `↺` con `aria-label` y `title`; sigue vaciando el tablero **y** frenando el
      transporte. El botón de hoy (`TransportPanel.tsx:74`) **no tiene ninguno de los dos**: su nombre
      accesible es el texto visible `Reset`, así que cambiarlo a un glifo sin agregarlos lo deja mudo.
      No lleva `aria-pressed`: no alterna nada. Y arrastra dos comentarios del mismo archivo: `:52-55`
      mide la fila «junto a Reset (62 px + 8 de gap)» con un Reset de 62 px que deja de existir, y
      `:60-65` explica el par de colores «al lado tiene a Reset en `bg-slate-200`», que con T011 pasa a
      ser un trío — es el mismo párrafo del que sale el argumento de AC6 — **AC8**
- [x] T015 Separar `↺` del par ▶/metrónomo: es el único destructivo de los tres y no tiene deshacer

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

- [x] T016 `layout.constants.ts`: agregar la fila del 019 a la tabla de «quién manda», con **lo que
      midió T022** — **AC9**
- [x] T017 `layout.constants.ts`: reescribir el párrafo de los 26 px de colchón con el colchón real
      (~30 px si la medición confirma la cuenta). Anotar que el 020 le mete el botón `0°` **inline a
      esa misma línea** —no una fila nueva—, o sea ~10 px más de los ~30, y que ahí el margen queda en
      décimas: la próxima fila que salga del panel sí achica el tablero
- [x] T033 `layout.constants.ts`: el párrafo de abajo de la tabla —«agrandar el tablero hoy pide más
      ANCHO … el alto ya sobra» (`:25-27`)— y el bullet del **techo útil** (`:44-53`), que cita
      `730,7 × 464` y «por alto 77,3» sobre una paleta de 496 px que deja de existir. Sin esto el
      docblock se contradice consigo mismo en el mismo comentario.
      **Y hay un quinto lugar, fuera de este archivo, que el spec no tenía**: `Board.tsx:262-266`
      repite la misma cadena en presente —«la paleta paso de 461,6 a 496 px de caja, el interior del
      tablero a 730,7 × 464»— y cierra con «pasado ese punto lo que la paleta crezca ya no agranda el
      tablero, le deja aire muerto», que es exactamente el aire que este spec se come. Se corrige con
      el número de T022, corto: el 021 también se lo lleva
- [x] T034 `layout.constants.ts`: verificar que el docblock de `MINI_CELL_PX`, que cita el mismo
      umbral de «~470 px de caja», sigue siendo cierto. Si lo es, no se toca
- [x] T018 Verificar que el **piso de 60** queda intacto: depende de la fuente y este spec no toca el
      `text-[19px]` de `Board.tsx`
- [x] T019 `App.tsx`: **leer** el footer y confirmar que no hay nada que sacar. Lo falsable es la
      **primera oración** —«Rotación cambia la fórmula de escala o el arranque del arpegio, según el
      régimen; Reflexión invierte el orden (retrógrado)»— y la pregunta es si nombra un **control** o
      una **transformación del modelo**. Nombra la transformación, así que no se toca. El resto del
      `<footer>` no es asunto de este spec: el 022 lo corrió de línea entero (hoy `:433-439`) y el
      **018 lo reescribe** sumándole un cuarto `<span>` de gesto, o sea que se busca por texto y la
      cuenta de gestos que confirma AC10 es la que el 018 deje, no «los cuatro del 013» — **AC10**
- [x] T020 Verificar que `PiecePalette` sigue sin estado y sin efectos. Desde el spec 022 dos de sus
      filas viven en componentes propios (`OrientationPanel.tsx`, `TransportPanel.tsx`);
      confirmar que tampoco ganaron estado ni efectos al recibir el botón que este paso les mueve
      (T011) — **AC11**

## Paso 5 — La documentación que este spec falsifica

Agregado por el review. No son specs viejos —esos no se reescriben— sino las tres páginas que el repo
sí mantiene al día, y las tres lo afirman **en presente**. **AC14**.

- [x] T036 [P] `docs/guides/quickstart.md:73-75` (hoy): el mecanismo por el que «los atajos se descubren
      solos» era ver iluminarse `180°` en la paleta. Ese botón muere; el lector nuevo es la línea de
      AC4, y la frase tiene que decir eso. La cita del spec decía `:58-59`, el review anterior la corrigió a `:59-61`, y contra el árbol de hoy es
      `:73-75`. La tabla de
      gestos —hoy `:77-84`— sigue siendo correcta. **Y en el mismo archivo, hoy `:94-95`**: «con el foco sobre
      `Reset`, activa `Reset`» nombra al botón por su etiqueta visible, que pasa a ser `↺`. La frase
      sobre el foco no cambia; el nombre sí.
      **Si el 018 ya está mergeado, todos esos números se corrieron**: agrega una fila a la tabla (las
      doce letras) y la frase de arriba deja de poder decir «los **tres** gestos que gobiernan la pieza
      por colocar», porque la letra es una cuarta vía de entrada. Buscar por texto y no por número de
      línea. La tabla en sí sigue siendo correcta; lo que cambia es dónde empieza y cuántas filas tiene
      — **AC8**, **AC14**
- [x] T037 [P] `docs/architecture/audio.md:247` (verificado contra el árbol de hoy): «el toggle «Recorrido en el vacío» de la paleta» pasa
      a ser el icono de metrónomo de la fila de transporte. La etiqueta sobrevive en `title` y
      `aria-label`, y eso es lo que hay que escribir
- [x] T038 [P] `DESIGN.md:297` (el `:250-251` del spec era del `main` de 2026-08-20): «el panel lo enciende con «Recorrido en el vacío»», con la
      etiqueta a la vista. Mismo cambio que T037, y acá además importa que el nombre de cara al
      usuario **no** cambia: cambia dónde se lee

## Paso 6 — Los tests de navegador que este spec rompe

Agregado por el review, y no es higiene: los tres `*.browser.test.tsx` de la tarjeta afirman hoy, por
**rol y nombre**, exactamente los botones que los pasos 1 y 3 borran o renombran. Sin estas tres tareas
T021 no puede dar verde, y el umbral de coverage es 100. **AC16**.

- [x] T041 `__tests__/PiecePalette.browser.test.tsx`: reescribirlo contra la tarjeta que queda. Hoy
      afirma lo que este spec borra —los cuatro grados (`:93-98`), «Reflexion y Recorrido son ON/OFF»
      (`:116-142`), el `aria-pressed` de Reflexión (`:144-177`) y el de Recorrido (`:179-203`), los dos
      `role="group"` llamados `Rotación` y `cambia` (`:205-231`) y el orden `Reflexión → Recorrido →
      Notas actuales` (`:243-244`)—. Lo borrado se verifica **al revés**, con un `queryByRole` anclado
      que da vacío: es la única forma falsable de AC1. El grupo que sobrevive pasa a llamarse
      `Rotación` (T003), y se suma la línea de T007 —por texto, nunca por `className` — **AC1**,
      **AC3**, **AC4**, **AC16**
- [x] T042 `__tests__/TransportPanel.browser.test.tsx`: `:85-92` busca el botón por el nombre visible
      `Reset`, que con T014 pasa a ser el `aria-label`. Y el archivo **gana** el metrónomo: nombre
      accesible anclado, `aria-pressed` en los dos estados y que el click llame a `onToggleClicks` — es
      la aserción de Recorrido que T041 saca de `PiecePalette`, llegando a su archivo nuevo en vez de
      desaparecer. Por rol y nombre, nunca por `className` (`.claude/rules/ui.md`) — **AC6**, **AC7**,
      **AC8**, **AC16**
- [x] T043 `__tests__/OrientationPanel.browser.test.tsx`: **no se toca, y eso es la verificación**.
      `:53`, `:56`, `:147`, `:166` y `:176` afirman los nombres `F, rotación 90°, reflejada` y
      `Z, rotación 180°`, que es justo lo que AC13 prohibe degradar al hacer que T031 consuma la pura.
      Si después de T031 hubo que editar este archivo, el `aria-label` perdió el sustantivo «rotación»
      o ganó el separador que el lector deletrea, o sea que AC13 se saldó agrandando la deuda de
      accesibilidad — **AC13**, **AC16**.
      **Salió distinto y quedó anotado**: hubo que tocar el factory —T005 borra `onRotate` y
      `onMirror` de `PropsDeOrientacion` y sin eso el archivo no typechequea—, pero **ninguna
      aserción** cambió, que es lo que la tarea protegía. La forma correcta era «ninguna aserción se
      toca», no «ningún byte»; el detalle está en `specs/revisiones.md`

## Verificación

- [x] T021 `pnpm verify` en verde — **AC15**
- [x] T022 [M] Navegador: medir `CELL_PX` en el DOM y confirmar que sigue en **73** — **AC9**. Es la
      única forma de verificarlo de verdad. **Se toma antes de mergear este spec, no al final del
      lote**, y es el único `[M]` de acá que **sí** bloquea su PR: el 020 le agrega el botón `0°` a la
      fila que esto acaba de medir —su `T039` repite la medición— y el 021 **borra la tarjeta de la
      que sale el número** (su `T012` y su `T016`). Como 018→019→020→021 es una sola cadena, es un
      solo carril de `/spec-implement-batch`: diferir este `[M]` al cierre deja el navegador sin
      tarjeta ni `max-w-6xl` que medir, y con eso AC9 se vuelve infalsificable — junto con la salida
      que el 020 se reserva en su AC15 («si da otra cosa, el `0°` baja a una fila propia»), que
      después del 021 no tiene fila adonde bajar.
      **Tomada**: `CELL_PX` sigue en **73** y la paleta cayó a **428** px contra los 470 del tablero,
      o sea que dejó de ser la tarjeta más alta. Es la medición de la que salen T016, T017 y T033, y
      la crónica de por qué eso cambia el modelo y no sólo el número está en `specs/revisiones.md`
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

- [x] T027 Rama `feature/019-el-panel-se-queda-sin-botones`
- [ ] T028 Actualizar la fila del 019 en `specs/log.md` a `Implementado`
- [x] T029 Anotar en `specs/revisiones.md` si el spec salió distinto de lo previsto

## Seguimiento (no bloquea)

- [x] T030 `↺` no tiene deshacer y ahora tampoco tiene la palabra «Reset» que lo frenaba un segundo.
      La deuda de «no hay deshacer» ya está en `specs/deuda.md` desde el 014; anotar ahí que este spec
      la roza sin agrandarla
- [ ] T044 El `title` del metrónomo quedó **igual** al `aria-label` («Recorrido en el vacío»), y el
      `research.md` §6 y §9 pedían lo contrario: que el `title` dijera la aclaración **entera** —que
      apaga una sola de las dos clases de cruce, porque el cruce sobre celda ocupada es modelo y no
      mezcla (D6)—, que es la mitigación declarada del riesgo «el metrónomo sin texto no dice qué
      apaga». La implementación eligió el texto único con un argumento propio, escrito al lado del
      botón: el puntero y el lector no pueden contar dos historias del mismo control. No se cambia
      acá porque tocarlo obliga a reescribir ese argumento y el riesgo es **medio**, no bloqueante:
      lo que falta es decidir entre las dos formas —`title` descriptivo distinto del nombre, o texto
      único— y dejarla escrita una sola vez

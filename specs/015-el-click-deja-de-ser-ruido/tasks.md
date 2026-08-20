# Tasks — Spec 015

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — La campana

- [x] T001 `voice.constants.ts`: `CLICK_MIDI = 96` (`C7`, 2 093 Hz)
- [x] T002 Docblock de `CLICK_MIDI` — es el que carga el hallazgo, y es **AC2**: el instrumento usa las
      **12 clases de altura** (medido), así que "fuera de la escala" es imposible; lo que se elige es
      estar fuera del **registro** (`C4` 261,6 Hz – `D#6` 1 244,5 Hz), nueve semitonos por encima del
      techo. Sin este párrafo, alguien vuelve a intentar elegir "una nota que no se use"
- [x] T003 El mismo docblock explica **por qué 2 kHz y no más agudo** (D3): es la banda de máxima
      sensibilidad del oído, así que la campana se oye a menor amplitud — que es justo lo que
      `CLICK_VELOCITY` busca
- [x] T004 `voice.constants.ts`: `CLICK_SECONDS` 0,02 → **0,05**
- [x] T005 Reemplazar la cuenta vieja de su docblock (15 % a 110 bpm, 21 % a 160) por la tabla medida:
      20 % / 37 % / 53 % del intervalo a 60 / 110 / 160, y la caída de 40 dB a los 29,5 ms, que es el
      número que decide si dos clicks se pisan — **AC4**
- [x] T006 El docblock conserva **por qué sigue en segundos y no en intervalos** (D4): la identidad del
      transitorio es la brevedad absoluta. A 60 bpm en intervalos duraría **92 ms** y tendría cuerpo —
      el número sale del mismo ancla que usa hoy el docblock para decir 37 ms, que es `DEFAULT_BPM`
      (110 bpm, intervalo de 136,4 ms). Anclado en 160 daría 133; dos anclas en un párrafo es lo que
      lo vuelve ilegible
- [x] T007 `voice.ts`: `scheduleClick` pasa a oscilador senoidal. Se van `createBuffer`, el bucle de
      muestras y el `sampleRate`
- [x] T008 La caída va **exponencial** a un epsilon y no lineal, al revés que `scheduleVoice`. Con
      comentario: allá la lineal es obligada porque la envolvente tiene que cerrar en 0; acá la caída
      **es** el timbre
- [x] T032 `voice.ts`: **agregar `osc.stop(at + CLICK_SECONDS)`**, que hoy no existe. Un oscilador no
      se termina solo: sin `stop()` no dispara `onended`, no corren los `disconnect()` y quedan ~12
      nodos vivos por ciclo; y el epsilon de la exponencial sigue sonando, que es lo que rompe los dos
      tests de silencio absoluto. El medio docblock que hoy argumenta "sin stop()" se reescribe al
      revés (`research.md` §1)
- [x] T009 Reescribir el docblock de `scheduleClick`, que hoy argumenta el ruido. El argumento no se
      borra: se **acota** (D1) — lo que dibuja una línea melódica es tener alturas *distintas*, no
      tener altura. Y se va la mitad que justificaba el buffer y el no-cacheo, con el código
- [x] T010 **AC5 y AC15** — `voice.test.ts`: **reescribir** el test que hoy dice *"NO tiene altura:
      cruza el cero a una tasa de ruido, no de nota"*. Afirma lo contrario de este spec y **falla** con
      la campana: exige `zeroCrossHz > 4000` y la senoidal da ~2 093, porque el helper devuelve Hz
      reales. Pasa a exigir la fundamental ± 2 %. No se agrega un test al lado: es el mismo test dado
      vuelta
- [x] T033 **AC15** — los otros dos tests del click **no se tocan y tienen que quedar verdes**: el que
      exige silencio absoluto en `at + CLICK_SECONDS + 0,03` (`voice.test.ts` e `integration.test.ts`)
      es el que verifica el `stop()` de T032. Sí se actualiza el comentario de `integration.test.ts`,
      que dice "50 ms despues ya es silencio" y con `CLICK_SECONDS` en 0,05 pasa a 80
- [x] T011 [P] **AC9** — `engine.ts`: verificar por lectura que no hay ninguna rama que distinga el
      primer click del ciclo, y dejar escrito **por qué no la va a haber** (D6) en el comentario de las
      tres clases que ya está sobre el `for` del despacho — que es donde cae quien se pregunte por qué
      no hay una cuarta. Va en `engine.ts` y no en el docblock de `scheduleClick` justamente para que
      el `[P]` no mienta: T007–T010 tienen tomado `voice.ts`. El circuito es cerrado y no tiene
      principio; acentuar le inventaría uno, y eso es una decisión del modelo
- [x] T012 [P] **AC10** — `GRACE_INTERVALS` y `GRACE_VELOCITY` sin tocar, con los tests del 011 en verde
- [x] T034 `voice.constants.ts`: los **dos docblocks vecinos que este spec deja falsos**. El de
      `GRACE_INTERVALS` dice que la excepción del click "está justificada en que NO tiene altura" — con
      la campana es falso, y lo que la sostiene pasa a ser la brevedad absoluta sola. El de
      `CLICK_VELOCITY` cita "el click dura `CLICK_SECONDS` (20 ms)" y cierra con una cuenta contra los
      ~136 ms de una nota

## Paso 2 — El default y la etiqueta

- [x] T013 `App.tsx`: `clicks` arranca en **`false`** — **AC6**
- [x] T035 `engine.ts`: `let clicksAudible = true` → **`false`** — es el **segundo** default y también
      es **AC6**. Hoy no se ve porque el efecto de montaje de `App.tsx` lo pisa, pero dejar el mismo
      valor declarado dos veces en desacuerdo es lo que el repo evita cuando `App.tsx` toma el tempo de
      `DEFAULT_BPM`
- [x] T014 Reescribir el comentario de arriba, que hoy argumenta lo contrario citando D4 del 009. El
      argumento no se borra: pasa a decir por qué el default se dio vuelta igual y por qué eso hace al
      botón **más** necesario (D5), con el 44 % medido
- [x] T015 `PiecePalette.tsx`: etiqueta nueva — **AC8**. Tres restricciones: dice qué se oye cuando está
      encendido, **no** promete apagar el cruce por celda ocupada, y entra en la tarjeta. El ancho se
      mide contra **el más chico de los dos**: 252 px hoy, 349,3 px con el 014 puesto. Medir contra el
      que va a haber deja la etiqueta rota mientras el 014 no esté
- [x] T016 Actualizar el comentario largo del botón, que explica el nombre viejo y el motivo por el que
      nació —tapar los golpes sordos que el 011 arregló—. Esa historia se conserva; lo que cambia es la
      conclusión
- [x] T017 **AC7** — `specs/011-el-recorrido-esquiva-las-piezas/tasks.md`: `T070` cerrado con un "no" y
      su motivo. Con el default apagado el botón es la única forma de **encender** el recorrido, así que
      borrarlo sería dejarlo inalcanzable

## Paso 3 — Verificación y documentación

- [x] T018 `pnpm verify` en verde y `check_invariants` en proceso fresco — **AC12**
- [ ] T019 [P] **AC11** — verificar **las dos mitades**: con el default de AC6 la pieza muteada del 014
      **no suena**, y con el botón encendido suena con esta campana **sin código propio**. Las dos
      salen de lo mismo —es el mismo `Click` sin `note` (`research.md` §6), y `engine.ts` lo despacha
      por la rama que mira `clicksAudible`—, así que verificar una sola deja la otra sin evidencia.
      **Sólo con el 014 mergeado**; si el 015 llega antes, la tarea se deja abierta y la cierra el 014
      — no se marca como cumplida
- [x] T037 [P] Docblock en la rama de `engine.ts` que despacha el click: **por qué el silencio total de
      la pieza muteada con los clicks apagados es la respuesta y no un caso sin cubrir**. Es la pregunta
      que se hace quien lea el 014 y el 015 juntos, y la respuesta —mutear es sacarla del sonido, y
      separar los dos significados costaría un cuarto `HIT` y un discriminante en `Click`— no está
      escrita en ninguno de los dos specs por separado
- [x] T020 [P] `docs/architecture/audio.md`: el timbre nuevo, con la tabla de los dos centroides. Son
      cuatro los lugares: las tres afirmaciones de que el click "no tiene altura" y el toggle, que ahí
      figura como «Clicks» y ya estaba viejo antes de este spec
- [x] T036 [P] `docs/architecture/modelo-musical.md`: dice en presente que sobre celda vacía "suena un
      click sin altura". Es la afirmación que este spec falsifica, y es exactamente el caso de los
      commits `d936597` y `eb154a0` — el spec viejo no se reescribe, `docs/` sí
- [x] T021 [P] `DESIGN.md`, si la etiqueta nueva toca el lenguaje del panel
- [ ] T022 [M] **AC13 — a oído, y decide dos cosas**: (1) si la campana es agradable a 60, 110 y 160
      bpm; (2) **si el default vuelve a encendido**. Con la campana puesta el argumento de D5 se
      debilita solo, y volverlo a `true` es un booleano — pero se decide escuchando y con el motivo
      escrito
- [ ] T023 [M] Escuchar un tablero de **3 piezas**, que es donde el click pesa el 44 % de los eventos:
      es el caso donde la campana se va a notar más y el que originó el pedido
- [ ] T024 [M] Escuchar si `CLICK_VELOCITY` (0,25) sigue estando bien. A igual pico, la campana tiene
      15 % menos de RMS que el ruido pero vive en la banda de máxima sensibilidad del oído: puede
      percibirse **más fuerte** aun midiendo menos

## PR

- [x] T025 Rama `feature/015-el-click-deja-de-ser-ruido` desde `main`
- [x] T026 El PR declara que **cambia lo que suena en todo tablero** y que da vuelta un default
- [x] T027 [M] `/pr-review` antes de pedir revisión. Cinco hallazgos, todos corregidos en la rama: dos
      tablas de markdown rotas (`audio.md` se comía un párrafo entero en la fila `Default`, `log.md`
      tenía la fila del 015 partida en dos líneas), el centroide citado con dos valores distintos
      —2 643 contra 2 645—, `audio.md` diciendo "ruido (hasta el 014)" tres párrafos debajo de "hasta
      el 015", y `CLICK_EPSILON` sin declarar que es el **piso** del `vel` de `scheduleClick` y no
      solo su destino. El código de audio pasó la revisión sin cambios: las mediciones del docblock se
      reprodujeron contra el dominio real (12/12 clases de altura, registro MIDI 60–87, 40 dB a los
      29,4 ms, centroide Hann 2 093,1 Hz)
- [x] T028 `specs/log.md`: estado del 015

## Seguimiento (no bloquea)

- [ ] T029 **Si T022 devuelve el default a encendido**, el comentario de `App.tsx` tiene que decir que
      pasó por los dos estados y por qué volvió — que es más útil que si no se hubiera movido nunca
- [ ] T030 **El acento del primero** (D6) queda descartado por una razón del **modelo** y no del
      timbre: el circuito no tiene principio. Si alguna vez se le da uno, este es el lugar donde vuelve
      a estar sobre la mesa
- [ ] T031 Un tablero de 12 piezas no se puede generar al azar (`research.md` §5) y el `T060` del 011
      —"el tablero lleno tiene que sonar mejor que hoy"— sigue pendiente a mano. Con la campana es un
      caso todavía más interesante: sin celdas libres no hay un solo click mudo, así que es el único
      tablero donde este spec no se escucha

# Tasks — Spec 015

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — La campana

- [ ] T001 `voice.constants.ts`: `CLICK_MIDI = 96` (`C7`, 2 093 Hz)
- [ ] T002 Docblock de `CLICK_MIDI` — es el que carga el hallazgo, y es **AC2**: el instrumento usa las
      **12 clases de altura** (medido), así que "fuera de la escala" es imposible; lo que se elige es
      estar fuera del **registro** (`C4` 261,6 Hz – `D#6` 1 244,5 Hz), nueve semitonos por encima del
      techo. Sin este párrafo, alguien vuelve a intentar elegir "una nota que no se use"
- [ ] T003 El mismo docblock explica **por qué 2 kHz y no más agudo** (D3): es la banda de máxima
      sensibilidad del oído, así que la campana se oye a menor amplitud — que es justo lo que
      `CLICK_VELOCITY` busca
- [ ] T004 `voice.constants.ts`: `CLICK_SECONDS` 0,02 → **0,05**
- [ ] T005 Reemplazar la cuenta vieja de su docblock (15 % a 110 bpm, 21 % a 160) por la tabla medida:
      20 % / 37 % / 53 % del intervalo a 60 / 110 / 160, y la caída de 40 dB a los 29,5 ms, que es el
      número que decide si dos clicks se pisan — **AC4**
- [ ] T006 El docblock conserva **por qué sigue en segundos y no en intervalos** (D4): la identidad del
      transitorio es la brevedad absoluta. A 60 bpm en intervalos duraría 133 ms y tendría cuerpo
- [ ] T007 `voice.ts`: `scheduleClick` pasa a oscilador senoidal. Se van `createBuffer`, el bucle de
      muestras y el `sampleRate`
- [ ] T008 La caída va **exponencial** a un epsilon y no lineal, al revés que `scheduleVoice`. Con
      comentario: allá la lineal es obligada porque la envolvente tiene que cerrar en 0; acá la caída
      **es** el timbre
- [ ] T009 Reescribir el docblock de `scheduleClick`, que hoy argumenta el ruido. El argumento no se
      borra: se **acota** (D1) — lo que dibuja una línea melódica es tener alturas *distintas*, no
      tener altura. Y se va la mitad que justificaba el buffer y el no-cacheo, con el código
- [ ] T010 **AC5** — test de render offline afirmando sobre el **contenido espectral**: energía
      concentrada alrededor de la fundamental y no repartida hasta Nyquist. Es lo que atrapa que alguien
      vuelva a poner ruido sin querer
- [ ] T011 [P] **AC9** — verificar por lectura que no hay ninguna rama que distinga el primer click del
      ciclo, y dejar escrito **por qué no la va a haber** (D6): el circuito es cerrado y no tiene
      principio; acentuar le inventaría uno, y eso es una decisión del modelo
- [ ] T012 [P] **AC10** — `GRACE_INTERVALS` y `GRACE_VELOCITY` sin tocar, con los tests del 011 en verde

## Paso 2 — El default y la etiqueta

- [ ] T013 `App.tsx`: `clicks` arranca en **`false`** — **AC6**
- [ ] T014 Reescribir el comentario de arriba, que hoy argumenta lo contrario citando D4 del 009. El
      argumento no se borra: pasa a decir por qué el default se dio vuelta igual y por qué eso hace al
      botón **más** necesario (D5), con el 44 % medido
- [ ] T015 `PiecePalette.tsx`: etiqueta nueva — **AC8**. Tres restricciones: dice qué se oye cuando está
      encendido, **no** promete apagar el cruce por celda ocupada, y entra en la tarjeta (349,3 px de
      interior con el 014 puesto)
- [ ] T016 Actualizar el comentario largo del botón, que explica el nombre viejo y el motivo por el que
      nació —tapar los golpes sordos que el 011 arregló—. Esa historia se conserva; lo que cambia es la
      conclusión
- [ ] T017 **AC7** — `specs/011-el-recorrido-esquiva-las-piezas/tasks.md`: `T070` cerrado con un "no" y
      su motivo. Con el default apagado el botón es la única forma de **encender** el recorrido, así que
      borrarlo sería dejarlo inalcanzable

## Paso 3 — Verificación y documentación

- [ ] T018 `pnpm verify` en verde y `check_invariants` en proceso fresco — **AC12**
- [ ] T019 [P] **AC11** — verificar que la pieza muteada del 014 suena con esta campana **sin código
      propio**: es el mismo `Click` sin `note` (`research.md` §6)
- [ ] T020 [P] `docs/architecture/audio.md`: el timbre nuevo, con la tabla de los dos centroides
- [ ] T021 [P] `DESIGN.md`, si la etiqueta nueva toca el lenguaje del panel
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

- [ ] T025 Rama `feature/015-el-click-deja-de-ser-ruido` desde `main`
- [ ] T026 El PR declara que **cambia lo que suena en todo tablero** y que da vuelta un default
- [ ] T027 [M] `/pr-review` antes de pedir revisión
- [ ] T028 `specs/log.md`: estado del 015

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

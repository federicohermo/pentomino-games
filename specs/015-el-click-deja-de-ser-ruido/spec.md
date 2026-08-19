# Spec 015 — El click deja de ser ruido

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **Revisa el timbre que el [009](../009-el-tablero-como-recorrido/spec.md) eligió a conciencia** —el
> ruido blanco, argumentado en `voice.ts`— y **da vuelta su default** (D4: nacen encendidos). Y cierra
> con un "no" el `T070` del [011](../011-el-recorrido-esquiva-las-piezas/tasks.md), que proponía borrar
> el botón.
>
> **Cambia lo que suena en todo tablero.**

## Problema

El click del recorrido es **ruido blanco**, y el ruido blanco es lo que menos se parece a música que
puede salir de un parlante. Medido renderizando el click actual offline: su **centroide espectral está
en 11 260 Hz**. O sea que la energía del evento vive casi dos octavas por encima del techo del
instrumento —el registro de las piezas termina en `D#6`, 1 244,5 Hz— y suena como un siseo, no como un
pulso.

Y no es un evento marginal. Medido sobre 200 tableros aleatorios por tamaño:

| Piezas | Notas por ciclo | Clicks mudos | Cruces | **Clicks como % de los eventos** |
|---|---|---|---|---|
| 3 | 15,0 | 11,9 | 0,4 | **44 %** |
| 5 | 25,0 | 14,0 | 1,5 | **35 %** |
| 8 | 40,0 | 11,1 | 4,8 | **20 %** |

En un tablero de 3 piezas —el que uno tiene mientras está probando cosas— **casi la mitad de lo que
suena es ese siseo**.

La elección estaba argumentada, y el argumento sigue en pie: `voice.ts` explica que un oscilador
**siempre** tiene altura, y que 20 ms de una onda de 1 kHz son 20 ciclos completos, suficientes para
que el oído les ponga nota y para que el recorrido empiece a sonar como una línea melódica que compite
con las piezas. El ruido no tiene fundamental que perseguir, así que el cruce se lee como percusión.

Lo que el argumento no vio es que hay una tercera opción entre "sin altura" y "una altura que se mueve".

## Solución Propuesta

**El click pasa a ser una campana de altura fija.** Un metrónomo tiene altura y no dibuja ninguna línea
melódica, porque **nunca cambia**: no es una nota, es una marca. La respuesta al argumento del ruido no
es negarlo — es que lo que produce una línea melódica no es tener altura, es tener alturas *distintas*.

Y **arranca apagado**. Los clicks nacían encendidos (D4 del 009) porque sin ellos un salto largo por
celdas vacías es un silencio mudo y el recorrido se vuelve inaudible; ese argumento vale, pero el
default lo decide quien escucha el instrumento y hoy molesta.

| | hoy | con este spec |
|---|---|---|
| Fuente | `AudioBufferSourceNode` con muestras aleatorias | oscilador senoidal |
| Altura | ninguna (centroide medido: **11 260 Hz**) | **fija, 2 093 Hz** (`C7`, MIDI 96) |
| Duración | 20 ms | **50 ms** |
| Centroide medido | 11 260 Hz | **2 645 Hz** |
| Cae 40 dB en | 19,6 ms | 29,5 ms |
| Default | encendido | **apagado** |

### Decisiones de diseño

**D1 — Altura fija, y por eso no compite: no es que no tenga altura, es que no tiene alturas.**
Es la respuesta directa al docblock de `scheduleClick`. Una línea melódica necesita al menos dos
alturas distintas; una sola repetida es un pulso. El riesgo real que quedaba —que el click se lea como
una nota más del arpegio— se elimina por otro lado: la altura elegida está **fuera del registro** (D2).

**D2 — 2 093 Hz, y sale del REGISTRO porque de la escala no puede salir.**
Medido: el instrumento usa **las 12 clases de altura**. Son 12 tónicas por `BASE_MAP` y cuatro fórmulas
pentatónicas encima, así que no queda ni una nota del temperamento libre. **"Fuera de la escala" es
imposible**, y decirlo sin medirlo habría sido escribir una decisión falsa.

Lo que sí se puede es estar fuera del **registro**: el instrumento va de `C4` (261,6 Hz) a `D#6`
(1 244,5 Hz), techo que ya incluye el corrimiento de octava de `notesForRotation`. `C7` = MIDI 96 =
2 093 Hz está **nueve semitonos por encima del techo**, o sea que ninguna pieza puede llegar a esa
altura ni enmascararla.

**D3 — Y 2 kHz y no más agudo, porque es donde el oído es más sensible.**
La banda de 2 a 4 kHz es donde la audición humana tiene su máximo de sensibilidad. Una campana ahí se
oye **a menor amplitud** que la misma campana dos octavas más arriba, que es exactamente lo que
`CLICK_VELOCITY` busca: que el recorrido acompañe sin competir. Subirla a `E7` o más la haría más
"fuera del camino" en el papel y más estridente en la práctica.

Medido, además, que no cuesta energía: a igual pico (0,245), la campana de 50 ms tiene **RMS 0,0141
contra 0,0167 del ruido**, o sea un 15 % menos. Se oye mejor con menos señal.

**D4 — Dura 50 ms, y se sigue midiendo en SEGUNDOS y no en intervalos.**
La excepción que `CLICK_SECONDS` ya declara se conserva con el mismo argumento: el click es un
transitorio y su identidad perceptual es la brevedad **absoluta**, no la proporción con el pulso. Si se
estirara con el tempo, a 60 bpm duraría 133 ms y empezaría a tener cuerpo.

50 y no 20: con 20 ms de senoidal a 2 093 Hz son 42 ciclos, que alcanzan para que se oiga la altura,
pero la caída queda tan abrupta que el evento vuelve a leerse como un golpe. Con 50 ms la campana
**decae** —medido, cae 40 dB a los 29,5 ms— y ahí es donde suena a metrónomo.

Y entra en el intervalo a cualquier tempo, que es la garantía que el número viejo tenía y no se puede
perder. Medido: el intervalo mide 250 ms a 60 bpm, 136,4 a 110 y **93,8 a 160**, que es `TEMPO_MAX`. La
campana está 40 dB abajo a los 29,5 ms, o sea que en el peor caso quedan 64 ms de aire antes del evento
siguiente.

**D5 — Arranca apagada, y eso cierra el `T070` del 011 con un "no".**
El `T070` proponía **borrar** el botón `Clicks mudos`, con el argumento de que nació para tapar los
golpes sordos que el 011 arregló. Con el default dado vuelta, el botón es **más** necesario y no
menos: pasa a ser la única forma de encender el recorrido, en vez de la única forma de apagarlo.

El argumento de D4 del spec 009 —sin clicks, un salto largo es un silencio mudo— no se niega: se le
cambia el default a quien lo quiera. Y sigue habiendo por qué encenderlos, medido en la tabla del
problema: con 3 piezas, el 44 % de los eventos del ciclo son clicks, así que apagarlos es literalmente
apagar casi la mitad de lo que el tablero dice.

**D6 — Sin acento en el primero.**
Un metrónomo acentúa el tiempo fuerte. Acá **no hay tiempo fuerte**: el circuito es cerrado y el
modelo lo dice explícitamente —`buildSequence` fija el arranque en el índice 0 solo para eliminar las
rotaciones equivalentes del mismo recorrido, así que el "1" es un punto de partida convencional y no el
comienzo de nada—. Acentuarlo le **inventaría** un principio al circuito, que es una decisión del
modelo y no del timbre.

**D7 — El botón cambia de etiqueta, porque con el default dado vuelta la que tiene miente doble.**
Hoy dice `Clicks mudos` con `ON`/`OFF`, y `ON` significa "los clicks mudos se oyen". Ya era retorcido
—un click *mudo* que está *encendido*— y con el default apagado queda peor: lo primero que se ve del
control es un `OFF` que no se sabe si apaga el click o apaga el mute.

El nombre nuevo tiene que decir qué se oye cuando está encendido, en el idioma que el instrumento ya
usa: el recorrido. Se decide en el plan, con el ancho de la tarjeta medido; lo que este spec fija es
que **la etiqueta se lee sin nota al pie**.

**D8 — El cruce con altura no se toca.**
`GRACE_INTERVALS` y `GRACE_VELOCITY` —el sonido de pisar una celda ocupada, con la nota de esa celda
(D5 del 011)— quedan exactamente como están. Son **modelo y no mezcla**, y el botón nunca los gobernó.
Este spec cambia la tercera clase de evento y sólo esa.

## Criterios de Aceptación

- **AC1** — El click es un oscilador senoidal a **MIDI 96 (2 093 Hz)**, con la altura escrita en
  `constants/` y su motivo (D2): fuera del **registro**, porque de la escala no se puede salir.
- **AC2** — La constante que fija la altura declara que el instrumento **usa las 12 clases de altura**,
  con el número medido, para que nadie vuelva a intentar "elegir una nota que no se use".
- **AC3** — Dura **50 ms** y se sigue midiendo en segundos, con el argumento de la brevedad absoluta
  intacto (D4).
- **AC4** — **No se pisa con el evento siguiente a ningún tempo**: verificado contra el intervalo a
  `TEMPO_MAX` (93,8 ms), con el número en el docblock.
- **AC5** — **Renderizado offline con test**, no afirmado: el click sale con energía concentrada
  alrededor de 2 kHz y no en 11 kHz. Es la misma técnica con la que el 011 midió su envolvente, y es lo
  que permite verificar un timbre sin escucharlo.
- **AC6** — El default de `clicks` en `App.tsx` pasa a **`false`**, con el comentario reescrito: hoy
  argumenta lo contrario, citando D4 del 009 (D5).
- **AC7** — **El botón se queda**, y el `T070` del spec 011 queda cerrado con su motivo escrito ahí
  (D5).
- **AC8** — La etiqueta del botón se lee sin explicación (D7), y entra en el ancho de la tarjeta —que
  el 014 dejó en 349,3 px de interior.
- **AC9** — **Sin acento en el primero** (D6): todos los clicks del ciclo son idénticos, y el motivo
  queda escrito donde alguien lo vaya a buscar.
- **AC10** — `GRACE_*` sin tocar y el cruce con altura sonando igual (D8), verificado por el test del
  011 que ya existe.
- **AC11** — La pieza muteada del spec 014 suena con **esta** campana, sin código propio: es el mismo
  `Click` sin `note`.
- **AC12** — `pnpm verify` en verde. `check_invariants` no cubre el timbre, pero se corre igual porque
  el spec toca `audio/`.
- **AC13** — `[M]` A oído, y es el AC que decide dos cosas que ningún render offline contesta: si la
  campana es agradable a los tres tempos, y **si con la campana puesta el default debería volver a
  encendido**. Si vuelve, es un booleano.
- **AC14** — Documentación: `docs/architecture/audio.md` (el timbre y por qué), `DESIGN.md` si el
  cambio de etiqueta toca el lenguaje del panel, y el docblock de `scheduleClick`, que hoy argumenta
  el ruido.

## Fuera de Alcance

- **El cruce por celda ocupada** (D8).
- **El timbre de las piezas.** `DEFAULT_VOICE` no se toca.
- **Que el click siga o no al tempo.** Sigue en segundos (D4).
- **Un acento, un compás o un principio del ciclo** (D6). Si alguna vez el circuito tiene un tiempo
  fuerte, será una decisión del modelo y no de este spec.
- **Que el usuario elija la altura o el timbre.** Son constantes.
- **Borrar el botón** (D5, y cierra `T070`).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Una altura fija repetida ~12 veces por ciclo puede volverse más molesta que el ruido**, no menos: un siseo se ignora, un pitido se clava. | AC13 lo pone a oído a los tres tempos, que es lo único que lo contesta. Y el default apagado (D5) hace que el riesgo se corra solo hasta que alguien decida encenderlo. |
| El argumento de `voice.ts` contra el oscilador era bueno y esto lo revierte. | No lo revierte: lo acota. Lo que produce una línea melódica es tener alturas **distintas** (D1), y la altura elegida además no se alcanza desde ninguna pieza (D2). El docblock viejo se reescribe con las dos mitades. |
| A igual `CLICK_VELOCITY`, 2 kHz se percibe **más fuerte** que ruido de banda ancha, aunque tenga 15 % menos de RMS (D3). | Es la parte que el render offline no contesta y AC13 sí. Si hay que bajar la amplitud, es una constante con docblock, como las otras cuatro. |
| Con el default apagado, alguien abre el instrumento y **no escucha el recorrido nunca**, que es la mitad de lo que el spec 009 construyó. | Está medido y declarado: 44 % de los eventos de un tablero de 3 piezas. El botón se queda justamente por eso (D5), y AC13 puede devolver el default. |
| 50 ms de senoidal a 2 kHz son 105 ciclos: mucho más que los 42 que `voice.ts` consideraba suficientes para que el oído le ponga nota. | Es a propósito y es lo que la hace campana en vez de golpe (D4). Lo que evita que se lea como nota **del instrumento** no es la brevedad sino el registro (D2). |
| Cambiar `CLICK_SECONDS` de 20 a 50 ms invalida la cuenta de "el click ocupa el 15 % del intervalo" que su docblock trae. | Se reescribe con los tres tempos medidos (D4, AC4): 20 %, 37 % y 53 % del intervalo a 60, 110 y 160 bpm, con la caída de 40 dB a los 29,5 ms como el número que importa. |

# Spec 008 — El intervalo como unidad musical, y un solo transporte

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.

## Problema

Son dos problemas que se arreglan juntos porque tienen la misma causa: **el instrumento tiene dos
nociones de tiempo que no se hablan, y un transporte partido en dos controles de los que solo una
combinación hace algo.**

**1. El espaciado del arpegio es un número de segundos, no una duración musical.**
`ARPEGGIO_SPREAD = 0.15` está en segundos y **no depende del tempo**. Consecuencias medidas:

- Mover el slider de tempo **no cambia** cómo suena una pieza al colocarla: a 60 bpm y a 160 bpm el
  arpegio dura exactamente lo mismo.
- Dentro del loop, el arpegio de una pieza tampoco se estira ni se comprime con el tempo: lo único que
  el tempo mueve es *cada cuánto* se repite y *cuánto* se desfasan las piezas entre sí.
- Y el número no es neutral: **0,15 s es exactamente una semicorchea a 100 bpm**. O sea que el
  instrumento venía tocando sus arpegios a un tempo implícito de 100 mientras el slider decía otra cosa.

El `log.md` ya lo tenía anotado desde la implementación del spec 004: *"confirma que `ARPEGGIO_SPREAD`
en unidades musicales dejó de ser una inconsistencia teórica"*.

**2. El transporte son dos controles y tres de sus cuatro estados son mudos.**
Hay un botón **Loop** (arranca y frena el reloj) y un checkbox **Loop de piezas colocadas**. Ninguno de
los dos hace nada audible solo: el reloj sin jobs corre en vacío, y los jobs sin reloj no se agendan.
De las cuatro combinaciones, **una sola suena**. Peor: el botón **no muestra su estado** —dice "Loop" y
está verde tanto si el reloj corre como si no, porque `clockRunning()` solo se consulta adentro del
handler y nunca llega al render—, así que la única forma de saber si el instrumento está andando es
escucharlo. Y las dos etiquetas dicen "Loop", que es la palabra que este rediseño saca del vocabulario.

## Solución Propuesta

1. **Una sola unidad de tiempo, derivada del bpm: el intervalo.** Es la semicorchea —el compás dividido
   en 4 pulsos y cada pulso en 4—, y gobierna por igual las notas dentro de una pieza y el arpegio de
   confirmación al colocar. `ARPEGGIO_SPREAD` desaparece del repo.
2. **El intervalo no se guarda, se calcula.** El campo `spread` sale de `Job`: `collectHits` ya recibe
   el `bpm`, así que puede derivarlo. Guardarlo por job significa que un cambio de tempo deja stale a
   todos los jobs vivos.
3. **La duración de la nota también se vuelve musical**, para que la textura no cambie con el tempo.
4. **Un solo control de transporte: play/pausa**, con su estado a la vista. El checkbox y el botón
   Loop desaparecen, y la palabra "loop" sale de la UI.
5. **Con el transporte andando, colocar una pieza no dispara el arpegio de confirmación**: la pieza va
   a sonar en su lugar dentro del patrón, y duplicarla sería ensuciar el patrón con el gesto.

### Decisiones de diseño

**D1 — El intervalo es la semicorchea, y hay una sola definición.**
`intervalDuration(bpm) = barDuration(bpm) / (BEATS_PER_BAR × SUBDIVISIONS_PER_BEAT)`, en
`audio/scheduler.ts` al lado de `barDuration` y por el mismo motivo que aquella está exportada: es una
regla, no un detalle, y volver a escribirla es tener dos definiciones de la semicorchea.

Se eligió la semicorchea y no la corchea porque es la que **conserva el carácter actual**: a 110 bpm da
0,136 s contra los 0,15 s de hoy — una diferencia del 9 %, inaudible como cambio de identidad. La
corchea (0,273 s) duplicaría la duración de cada arpegio y volvería lento un instrumento que hoy es
percusivo.

**D2 — `Job` pierde el campo `spread`.**
Hoy el espaciado se copia dentro de cada job al crearlo. Como el tempo se puede mover con el reloj
andando, eso significa que **cambiar el tempo no afecta a los jobs ya creados** hasta que el efecto de
reconciliación los vuelva a crear. Derivarlo del `bpm` que `collectHits` ya recibe elimina la copia y
el problema de una vez. Es el mismo criterio que hizo que `phase` sea una fracción y no segundos.

**D3 — La duración de la nota también deriva del intervalo: 2 intervalos.**
Si el espaciado se vuelve musical y `NOTE_DUR` se queda en 0,35 s fijos, la **textura cambia con el
tempo**: la cantidad de notas que suenan superpuestas pasa de 1,4 a 60 bpm a 3,7 a 160 bpm, cuando hoy
es 2,33 a cualquier tempo. Con `NOTE_DUR = 2 × intervalo` la relación vuelve a ser constante. El precio,
medido: a 100 bpm la nota pasa de 0,35 s a 0,30 s, un 14 % más corta. Es poco y lo compensa el
`release` de 0,12 s, que **sigue en segundos** junto con `RELEASE_TAIL`, `attack` y `decay`: la
envolvente es timbre, no ritmo, y no debe estirarse con el tempo.

**D4 — El transporte es un solo botón, y su estado vive en React.**
`playing` pasa a ser estado de `App.tsx`, no una consulta imperativa a `clockRunning()` **en el
render** — que es lo que hoy deja al botón sin cara. El efecto de reconciliación pasa a depender de
`[placed, playing]` — sigue siendo el único lugar del repo que le habla a los jobs del motor, que es la
regla que `.claude/rules/ui.md` marca como no negociable.

`clockRunning()` **se queda** en el motor, y `togglePlay` lo consulta **una vez**, después de arrancar
o frenar, para saber qué pasó de verdad: `startClock()` es un no-op silencioso si `audio()` devuelve
`null`, y setear `playing` a ciegas haría al botón mentir justo en el estado que este spec existe para
hacer visible (AC10). Un renderizado que consulte al motor y un handler que le pregunte el resultado de
lo que acaba de pedirle son cosas distintas: lo primero es lo que se saca, lo segundo es lo que hace
que el estado de React no se desincronice del motor en el único punto donde puede.

**D5 — Colocar con el transporte andando no dispara el arpegio de confirmación.**
Y con el transporte en pausa sí lo dispara, como hoy. El criterio es que no haya ningún estado en el
que colocar una pieza no produzca **ningún** sonido: eso, en un instrumento, se lee como que se rompió.

## Criterios de Aceptación

- **AC1** — `ARPEGGIO_SPREAD` no existe en el repo. Una sola función define el intervalo, y los dos
  caminos a sonido la usan.
- **AC2** — `Job` no tiene campo `spread` (D2), y cambiar el tempo con el reloj andando cambia el
  espaciado de los jobs **ya creados**, sin recrearlos.
- **AC3 — A 100 bpm los onsets caen en los mismos instantes que hoy.** La semicorchea a 100 bpm vale
  exactamente 0,15 s, que es el `ARPEGGIO_SPREAD` que se retira. Verificable con `simulate_board` a
  `bpm: 100`, comparando contra la salida guardada antes de la rama.
  **No es "suena idéntico"**: D3 acorta la nota de 0,35 s a 0,30 s a ese mismo tempo, así que lo que
  el AC fija es el ritmo, no la textura. La duración la fija AC5.
- **AC4** — Mover el tempo cambia la velocidad del arpegio, cosa que hoy no pasa. Medible: la distancia
  entre el primer y el último onset a 60 bpm es 1,0 s y a 160 bpm es 0,375 s.
  Ojo con qué prueba cada cosa: `simulate_board` corre `collectHits`, o sea **el camino del loop**, y
  no toca `playNotes`. Que el arpegio **al colocar** también se estire hay que verificarlo aparte —
  ver `plan.md` §5. Es la trampa que `.claude/rules/audio.md` ya tiene registrada: los dos caminos no
  están unificados por construcción, así que verificar uno no verifica el otro.
- **AC5** — La duración de la nota son 2 intervalos (D3), y `attack`, `decay`, `sustain`, `release` y
  `RELEASE_TAIL` siguen en segundos.
- **AC6** *(solo lo firma un humano: no hay tests de UI en el repo)* — Hay **un solo** control de
  transporte, dice play o pausa según el estado, y la palabra "loop" no aparece en la UI.
- **AC7** *(solo lo firma un humano, ídem)* — Con el transporte andando, colocar una pieza **no**
  dispara el arpegio de confirmación; en pausa, sí (D5).
- **AC8** — `simulate_board` sigue simulando el mismo scheduler que la app: arma sus jobs sin `spread`
  y su respuesta reporta el intervalo derivado del bpm recibido. Con una aserción en
  `mcp-server/src/__tests__/tools.test.ts`, al lado de la que ya compara `barSeconds` (`:244`):
  `pnpm verify` sin ella solo typechequea el campo nuevo, no lo mide.
- **AC9** — `pnpm verify` en verde.
- **AC10 — El botón no puede mentir cuando el motor no arrancó.** `startClock()` es un no-op silencioso
  si `audio()` devuelve `null` (Web Audio no disponible), y D4 saca a `clockRunning()` de la UI: sin
  esto, el control queda diciendo "Pausa" con el reloj parado. Es el estado degradado que
  `.claude/rules/audio.md` exige chequear en **todo** llamador, y hoy no existe porque `clockRunning()`
  era la fuente de verdad. Falsable sin navegador: forzar `audio()` a `null` y ver que `playing` queda
  en `false`.

## Fuera de Alcance

- **El recorrido.** Que el orden y los silencios salgan de la geometría es el spec 009. Acá el loop
  sigue siendo "cada pieza una vez por compás, en la fase que le da su columna", tal cual lo dejó el
  spec 004.
- **La cabeza lectora**, que es el 010.
- **El rango del slider de tempo.** Sigue en 60–160. Con la semicorchea derivada, 160 bpm da 0,094 s
  entre notas, que es rápido; si al escucharlo el extremo alto resulta inusable, acotar el rango es
  otro cambio (ver Riesgos).
- **El timbre.** `DEFAULT_VOICE` no se toca.
- **Cambiar la subdivisión desde la UI.** El intervalo es la semicorchea y punto; exponerlo como
  control es una feature, no parte de esto.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| A 160 bpm la semicorchea son 0,094 s y las cinco notas entran en 0,375 s: puede volverse un borrón. | Es el extremo del slider, no el valor por defecto. Se escucha al implementar; si no sirve, la salida es bajar `TEMPO_MAX`, que es una constante y un commit aparte. No se resuelve volviendo a un espaciado fijo: eso es el problema que este spec arregla. |
| Acortar la nota un 14 % (D3) se nota como pérdida de cuerpo. | Medido contra la envolvente completa: al `NOTE_DUR` se le suma un `release` de 0,12 s que no se toca, así que la cola audible baja de 0,47 s a 0,42 s, un 11 %. Si al escucharlo falta cuerpo, el ajuste es el multiplicador de D3 (2 → 3 intervalos), un solo número. |
| Sacar `spread` de `Job` toca `simulate_board`, que está en el otro paquete. | `pnpm verify` typechequea cruzando el borde de paquete, así que romper la firma **falla ruidosamente** señalando el archivo. Está anotado como tarea, no como sorpresa. |
| D5 deja un hueco audible al colocar con el transporte andando: la pieza entra recién en su fase, y si la columna acaba de pasar la espera es de casi un compás — 2,18 s a 110 bpm y **4,0 s a 60 bpm**. El criterio de D5 es "ningún estado sin sonido", y esto no es silencio total, pero sí un click sin respuesta inmediata. | Se escucha al implementar, junto con el extremo de 160 bpm. Si molesta, la salida **no** es volver a disparar el arpegio —eso es lo que D5 saca a propósito— sino la cabeza lectora del 010, que da respuesta *visual* a esa espera. Anotado para que no se resuelva de la forma equivocada. |
| Un revisor lee "un solo botón" como cambio cosmético y no mira lo demás. | El PR lo aclara: la unificación es la mitad chica. La grande es que el tiempo dejó de tener dos unidades. |

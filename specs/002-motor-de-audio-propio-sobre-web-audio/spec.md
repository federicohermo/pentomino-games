# Spec 002 — Reemplazar Tone.js por un motor de audio propio sobre Web Audio

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.

## Problema

Este proyecto es un instrumento musical, y **toda su capa de audio está delegada**. Tone.js resuelve las
tres competencias que constituyen la ingeniería de audio del proyecto, y las resuelve de forma opaca:

| Competencia | Quién la resuelve hoy |
|---|---|
| Síntesis y envolventes | `PolySynth(Synth)` |
| Scheduling con precisión de sample | `Transport.scheduleRepeat` |
| Ciclo de vida de voces | `PolySynth` |

El código que queda del lado del proyecto es una línea por camino:

```ts
synth.triggerAttackRelease(hz, "8n", t + i*0.15, 0.8);
```

Eso tiene tres consecuencias concretas, y ninguna es estética:

**1. El audio no es testeable como está escrito.** No hay forma de afirmar que una nota suena a la
frecuencia correcta, en el instante correcto, con la envolvente correcta. La única verificación posible
hoy es escuchar. Los loops se pudieron verificar contando eventos del Transport, pero eso comprueba
*que se agendó algo*, no *qué se oye*.

**2. Pesa 340 kB para usar cinco símbolos.** Medido: `tone@15.1.22` no declara `sideEffects: false`, así
que importar 6 símbolos arrastra 962 módulos, y los imports profundos solo recortan un 9%. Es el 62% del
JS servido. Un prototipo propio equivalente pesa **1.57 kB** — un factor de ~217×.

**3. La lógica está duplicada.** Hay dos caminos de reproducción (arpegio al colocar y loop por compás)
con el mismo espaciado y la misma duración escritos dos veces, porque Tone no impone un punto único.

> **Nota sobre el propósito del cambio.** Este repo es también un artefacto de portfolio: su capa de
> audio debería *demostrar* la ingeniería, no delegarla. Ese motivo no reemplaza a los tres argumentos
> técnicos de arriba —cada uno se sostiene solo— pero es la razón por la que este spec se prioriza
> ahora en vez de quedar como deuda indefinida.

## Solución Propuesta

Un módulo `src/audio/engine.ts` que reemplaza a Tone con las tres piezas, escritas y testeadas:

1. **Síntesis**: `OscillatorNode` + `GainNode` con envolvente ADSR explícita, ruteados a un gain
   maestro. Una voz por nota, fire-and-forget.
2. **Scheduler con lookahead**: temporizador grueso (~25 ms) que agenda con anticipación (~100 ms)
   contra `AudioContext.currentTime`. El patrón de *A Tale of Two Clocks*, que es lo que
   `Transport.scheduleRepeat` hace por dentro.
3. **Ciclo de vida de voces**: `onended` desconecta los nodos terminados; sin acumulación.

Más **tests reales con `OfflineAudioContext`**, que renderiza a un `AudioBuffer` de forma determinística
y más rápido que tiempo real. Se verificó en Chrome que la envolvente del prototipo es asertable con
precisión del 1–2% (ver `research.md`).

Y como consecuencia estructural: **los dos caminos de reproducción se unifican**, porque ambos pasan a
llamar a la misma función del motor.

### Decisiones de diseño

**D1 — Scheduler con lookahead, no un `setTimeout` por nota.**
`setTimeout` tiene jitter de decenas de milisegundos; el reloj de audio es preciso a nivel de sample
pero no se puede esperar sobre él. El temporizador grueso no dispara notas: solo decide *cuándo mirar*.
Todo lo que caiga en la ventana de anticipación se agenda con tiempos absolutos del reloj de audio, así
que el jitter del temporizador no se oye.

**D2 — Voces fire-and-forget, sin pool ni voice stealing.**
Máximo 5 notas por pieza y unas pocas piezas en loop: crear un `OscillatorNode` por nota y descartarlo
es lo que la API está diseñada para hacer (los osciladores son de un solo uso). Un pool sería
complejidad sin problema que resolver. **Si en algún momento el conteo de voces simultáneas crece, esto
se revisa** — pero hoy sería optimización prematura.

**D3 — El contexto se inyecta, no se importa.**
Las funciones del motor reciben el `AudioContext` (o `BaseAudioContext`) como parámetro en vez de
tomarlo de un singleton. Es lo que hace posible pasarles un `OfflineAudioContext` en los tests. El
singleton sigue existiendo para la app, pero como *un* llamador, no como dependencia oculta.

Es la diferencia entre "testeable" y "no testeable", y es la razón por la que hoy no se puede testear
aunque Tone ofrezca `Tone.Offline()`.

**D4 — El `AudioContext` se sigue creando en el primer gesto.**
`ctx.resume()` tiene la misma restricción de autoplay que `Tone.start()`. Este spec no cambia esa
política ni intenta esquivarla.

**D5 — El modelo musical no se toca.**
Escalas, tónicas, retrógrado y el espaciado de `0.15 s` quedan idénticos. Este spec cambia **cómo suena
el motor**, no **qué se toca**. El sonido va a cambiar (`Tone.Synth` y una ADSR propia no son
idénticos): es un cambio audible esperado, y en un instrumento, una oportunidad de diseño sonoro.

## Criterios de Aceptación

- **AC1** — `src/audio/engine.ts` no importa `tone`. `tone` no aparece en `package.json` ni en
  `package-lock.json`.
- **AC2** — **Frecuencia**: renderizando una nota MIDI conocida con `OfflineAudioContext`, la frecuencia
  medida por cruces por cero coincide con `440 * 2**((m-69)/12)` dentro de ±1 Hz. Verificado alcanzable:
  el prototipo dio 440 Hz exactos.
- **AC3** — **Envolvente**: en el mismo render, el pico del ataque y el nivel de sostenido coinciden con
  los valores teóricos dentro del 5%, y la amplitud es exactamente `0` antes del ataque y después del
  release. Verificado alcanzable: desviaciones medidas de 1.0% y 1.8%.
- **AC4** — **Posición temporal**: una nota agendada en `t` produce su primera muestra no nula en
  `t ± 1 ms`.
- **AC5** — **Scheduler**: renderizando N compases a un BPM dado se cuentan exactamente N disparos,
  cada uno dentro de **±6 ms** del instante agendado. La detección de onsets debe usar un **seguidor de
  envolvente** (ventanas de 5 ms) con histéresis de dos umbrales: un detector ingenuo de
  "silencio → señal" cuenta cada cruce por cero de la onda como un onset nuevo — medido, dio **21
  falsos onsets para 3 notas**. La tolerancia de ±6 ms es consecuencia del ancho de ventana del
  detector, **no** de la precisión del scheduler, que es la de AC4 (±1 ms). El test no depende de
  tiempo real.
- **AC6** — **Un solo camino de reproducción**: el arpegio al colocar y el loop por compás llaman a la
  misma función del motor. No queda espaciado ni duración duplicados.
- **AC7** — Los seis comportamientos de loops verificados en el spec anterior siguen valiendo: colocar
  agenda, quitar cancela, resetear cancela todo, y el checkbox agenda/cancela lo ya colocado.
- **AC8** — El chunk de Tone desaparece del build. El `dist` baja de ~550 kB a ~210 kB (JS+CSS crudos).
- **AC9** — `npx tsc -b --noEmit` en 0, `npm run build` en verde, `npm test` en verde.
- **AC10** — `docs/architecture/audio.md` reescrito, y `CLAUDE.md` sin referencias a Tone.

## Fuera de Alcance

- **Efectos** (filtro, reverb, delay). El grafo propio los habilita, pero son otro spec.
- **Visualización con `AnalyserNode`.** Es el
  [spec 003](../003-visualizacion-de-la-senal-con-analysernode/spec.md), que depende de este. Se
  separó en vez de absorberse acá para que 002 siga siendo mergeable solo — pero **no es opcional ni de
  baja prioridad**: ver la justificación de alineación en su `research.md`.
- **Cambiar el modelo musical.** Escalas, tónicas y retrógrado quedan igual (D5).
- **El mapeo celda↔nota del spec 001.** Ortogonal: uno decide *qué nota va en qué celda*, este decide
  *cómo se produce el sonido*. Se pueden hacer en cualquier orden.
- **Diseño sonoro fino.** Este spec entrega una ADSR razonable y correcta, no un patch trabajado.
  Iterar el timbre es trabajo posterior, y ahora barato.
- **Polifonía avanzada** (pool de voces, voice stealing, límite de voces). Ver D2.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **jsdom no implementa Web Audio**, así que los tests de AC2–AC5 no corren en el entorno por defecto de Vitest. Verificado: el render se comprobó en Chrome, no en Node. | Primer paso del plan, antes de escribir el motor: elegir entre `node-web-audio-api` o el browser mode de Vitest, y dejar un test mínimo verde. Si ninguna funciona, el spec se replantea en vez de seguir a ciegas. |
| Reescribir el scheduler puede reintroducir el bug de loops huérfanos que costó arreglar. | AC7 exige que los seis comportamientos verificados sigan valiendo. El efecto de reconciliación **no se rediseña**: solo cambia contra qué agenda. |
| El sonido va a cambiar y puede gustar menos. | Es esperado (D5) y no es una regresión. Con el grafo propio, ajustar el timbre pasa a ser trivial — hoy requiere pelearse con los presets de Tone. |
| El scheduler propio puede quedar peor que el de Tone en casos borde (pestaña en segundo plano, donde los temporizadores se estrangulan). | Documentar el comportamiento conocido. El lookahead de 100 ms cubre el estrangulamiento típico a 1 Hz de las pestañas ocultas solo parcialmente; si hace falta, `AudioWorklet` o un `Worker` para el temporizador — pero eso es otro spec, no se anticipa acá. |
| Alcance mayor que el spec 001, tocando la capa que ya está estabilizada. | Los pasos 1–2 del plan (motor + tests) no tocan `App.tsx` y son mergeables solos. La integración es un paso separado y reversible. |

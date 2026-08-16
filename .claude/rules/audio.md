---
paths:
  - "src/audio/**/*.ts"
  - "src/components/Spectrum.tsx"
---

# Capa de audio

Motor propio sobre Web Audio, sin librerías: `voice.ts` (síntesis), `scheduler.ts` (lookahead),
`engine.ts` (singletons y la API que consume la UI) y `spectrum.ts` (mapeo bins→barras). Habla números
MIDI y **no conoce el dominio**.

El porqué de cada decisión, con las mediciones que la respaldan, está en
[docs/architecture/audio.md](../../docs/architecture/audio.md). Lo que no hay que romper:

- **`voice.ts` y `scheduler.ts` reciben el `AudioContext` por parámetro y no pueden tocar el
  singleton**, porque vive en `engine.ts` y ellos no lo importan. Es lo que permite renderizarlos con
  `OfflineAudioContext`, y desde el spec 005 lo sostiene el grafo de imports en vez de un comentario:
  es la diferencia entre audio testeable y audio que solo se puede escuchar.
- **`ctx.resume()` necesita un gesto.** Nada suena antes del primer click. Cualquier feature que quiera
  sonar sin click previo va a quedar muda.
- **Falla suave:** `audio()` devuelve `null` si Web Audio no está disponible; la app queda usable pero
  muda, y todo llamador tiene que chequearlo.
- **Hay dos caminos a sonido, no uno:** `playNotes()` (arpegio al colocar) y `tick()` (loop), que llama
  a `scheduleVoice()` directo porque `collectHits` ya expandió los instantes. Lo unificado es
  `scheduleVoice`, `DEFAULT_VOICE` y las constantes: cambiar el timbre alcanza para los dos, cambiar
  cómo se expande el arpegio no.
- **El scheduler usa lookahead:** temporizador grueso de 25 ms que agenda 100 ms de futuro contra el
  reloj de audio. El temporizador no dispara notas, decide cuándo mirar.
- **El reloj es un origen, no un cursor.** `ClockState` son dos escalares —`origin` y `scheduledUntil`—
  y los onsets salen en forma cerrada (`origin + (k + phase) * bar`). `scheduledUntil` es lo único que
  evita re-emitir cada onset cuatro veces; los compases perdidos por la pestaña oculta **se saltean, no
  se recuperan**; y nunca hay más de `LOOKAHEAD` de audio comprometido, con cualquier fase — es lo que
  hace que quitar una pieza la calle en 100 ms. `firstOnsetAfter` usa `floor(x) + 1` y no `ceil(x)`:
  con `ceil`, un onset en el borde de la ventana sale dos veces. Y `startClock` tiene que dejar
  `scheduledUntil` **estrictamente antes** de `origin`, o se pierde el downbeat del compás 0.
- **El `AnalyserNode` va en serie** entre el master y el destino, y es transparente al audio.
  `readSpectrum()` devuelve `null` en reposo —eso es información, no falla— y reusa el buffer entre
  llamadas: quien lo guarde va a verlo cambiar por debajo. El mapeo bins→barras vive aparte, en
  `spectrum.ts`, porque **`AnalyserNode` no rinde nada útil en `OfflineAudioContext`**: es lo testeable,
  y por eso está separado del nodo.

**Verificar audio sin oírlo:** en tests con `OfflineAudioContext`; en el navegador con `jobCount()` y
contando osciladores. Recetas en
[docs/architecture/audio.md](../../docs/architecture/audio.md#cómo-verificar-el-audio).

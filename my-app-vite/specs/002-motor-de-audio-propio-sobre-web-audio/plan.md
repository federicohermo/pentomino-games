# Plan de Implementación — Motor de audio propio sobre Web Audio

## Orden

1. **Gate**: conseguir que `OfflineAudioContext` corra en los tests
2. Motor: síntesis y envolvente, con tests
3. Motor: scheduler con lookahead, con tests
4. Integración en `App.tsx` y retiro de Tone
5. Verificación
6. Documentación

Los pasos 1–3 no tocan `App.tsx`: son mergeables solos si la integración se demora.

## 1. Gate — `OfflineAudioContext` en el runner

**Este paso decide si el spec sigue.** El render se verificó en Chrome real; **jsdom no implementa Web
Audio**, así que el entorno por defecto de Vitest no sirve.

Vitest todavía no está instalado (es prerrequisito compartido con el
[spec 001](../001-notas-por-celda-en-orden-angular/plan.md) §1; si ese spec ya se implementó, este paso
arranca desde ahí).

```bash
npm i -D vitest
```

Dos opciones, en orden de preferencia:

**A. `node-web-audio-api`** — implementación nativa de Web Audio para Node.

```bash
npm i -D node-web-audio-api
```

```ts
// src/audio/test-context.ts
import { OfflineAudioContext } from 'node-web-audio-api';
export const offline = (secs: number, sr = 44100) =>
  new OfflineAudioContext(1, Math.floor(secs * sr), sr);
```

**B. Browser mode de Vitest** (`@vitest/browser` + Playwright) — usa el `OfflineAudioContext` real de
Chromium. Más fiel, más pesado de instalar y más lento en CI.

**Verificación del gate** — un único test que replica el render ya validado en Chrome:

```ts
it('renderiza un seno de 440 Hz', async () => {
  const ctx = offline(1);
  const osc = ctx.createOscillator();
  osc.frequency.value = 440;
  osc.connect(ctx.destination);
  osc.start(0); osc.stop(1);
  const buf = await ctx.startRendering();
  expect(buf.length).toBe(44100);
});
```

**Si ninguna de las dos opciones funciona, parar y replantear el spec.** Sin tests de audio, este
cambio pierde su principal justificación técnica y se convierte en una reescritura a ciegas de una
capa que hoy funciona.

## 2. Motor — síntesis

`src/audio/engine.ts`. El contexto se **recibe por parámetro** (D3): eso es lo que permite pasar un
`OfflineAudioContext` en los tests.

```ts
export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export interface VoiceOpts {
  attack?: number; decay?: number; sustain?: number; release?: number;
  type?: OscillatorType;
}

// Agenda UNA nota en `at` (tiempo absoluto del reloj del contexto).
export function scheduleVoice(
  ctx: BaseAudioContext, dest: AudioNode,
  freq: number, at: number, dur: number, vel = 0.8, o: VoiceOpts = {},
) {
  const { attack = 0.005, decay = 0.06, sustain = 0.5, release = 0.12, type = 'triangle' } = o;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);

  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(vel, at + attack);
  env.gain.linearRampToValueAtTime(vel * sustain, at + attack + decay);
  env.gain.setValueAtTime(vel * sustain, at + dur);
  env.gain.linearRampToValueAtTime(0, at + dur + release);

  osc.connect(env); env.connect(dest);
  osc.start(at);
  osc.stop(at + dur + release + 0.01);
  osc.onended = () => { osc.disconnect(); env.disconnect(); };   // ciclo de vida (D2)
}
```

**Por qué `setValueAtTime(0, at)` antes de la rampa**: las rampas de Web Audio interpolan desde el
*último evento agendado*. Sin ese ancla, la rampa arranca desde el valor que hubiera quedado de una nota
anterior y se oye un click.

**Por qué `linearRampToValueAtTime` y no `exponentialRampToValueAtTime`**: la exponencial no admite
llegar a `0` (lanza si el target es 0). Para el release habría que rampar a un épsilon y cortar. La
lineal es correcta y suficiente.

### Tests (AC2, AC3, AC4)

Los umbrales salen de mediciones reales, no de intuición (ver `research.md`):

```ts
const peakNear = (d: Float32Array, sr: number, t: number, win = 220) => { … };
const zeroCrossHz = (d: Float32Array, sr: number, from: number, to: number) => { … };
```

- **AC2** — `zeroCrossHz` en la zona de sostenido ≈ `midiToHz(69)` ±1 Hz. Medido: exacto.
- **AC3** — pico en `at+attack` ≈ `vel*masterGain` ±5%; sostenido ≈ `vel*sustain*masterGain` ±5%;
  amplitud `0` antes de `at` y después de `at+dur+release`. Medido: −1.8% y −1.0%.
- **AC4** — primera muestra no nula dentro de `at ± 1 ms`.

Tabla de valores esperados para `vel=0.8`, master `0.3`, `sustain=0.5`: pico `0.24`, sostenido `0.12`.

## 3. Motor — scheduler con lookahead

```ts
const LOOKAHEAD = 0.1;   // s: cuánto futuro se agenda por vuelta
const TICK = 25;         // ms: cada cuánto despierta el temporizador

interface Job { id: string; notes: number[]; spread: number; }
```

El temporizador **no dispara notas**: solo pregunta "¿qué cae en los próximos 100 ms?" y lo agenda con
tiempos absolutos del reloj de audio (D1).

```ts
function tick(ctx: AudioContext, dest: AudioNode) {
  const barDur = (60 / bpm) * 4;
  if (nextBar < ctx.currentTime) nextBar = ctx.currentTime + 0.05;   // recuperación tras throttling
  while (nextBar < ctx.currentTime + LOOKAHEAD) {
    for (const j of jobs.values())
      j.notes.forEach((m, i) => scheduleVoice(ctx, dest, midiToHz(m), nextBar + i * j.spread, 0.35));
    nextBar += barDur;
  }
}
```

La guarda `nextBar < ctx.currentTime` es la que evita que, si la pestaña estuvo en segundo plano y el
temporizador se estranguló, el `while` intente recuperar cientos de compases atrasados de golpe.

**API pública del scheduler** — se elige para que el efecto de reconciliación de `App.tsx` no cambie de
forma, solo de destinatario:

```ts
addJob(job) · removeJob(id) · clearJobs() · setBpm(v) · startClock() · stopClock() · clockRunning()
```

### Test del scheduler (AC5)

Con `OfflineAudioContext` no hay temporizador: se llama a la función de agendado directamente con
tiempos crecientes y se cuentan los disparos en el buffer renderizado. Es lo que hace al test
determinístico y no dependiente de tiempo real — la razón de separar `tick()` (decide *cuándo*) de
`scheduleVoice()` (produce *sonido*).

## 4. Integración y retiro de Tone

En `src/App.tsx`:

| Se retira | Se reemplaza por |
|---|---|
| `ensureTone()`, `toneModule`, `synth`, `type ToneModule` | `audio()` — singleton del `AudioContext`, creado en el primer gesto (D4) |
| `playNotesNow()` | `playNotes()` del motor, mismo espaciado `0.15 s` |
| `useTransport(tempo)` | `setBpm(tempo)` en un efecto |
| `toggleTransport()` | `startClock()` / `stopClock()` |
| El `scheduleRepeat` dentro del efecto de reconciliación | `addJob` / `removeJob` |

**El efecto de reconciliación no se rediseña** (riesgo declarado): conserva su forma —`Map` en un ref,
reconciliar contra `[placed, loopPlaced]`, limpieza sincrónica al desmontar— y solo cambia a quién le
habla. Con el motor propio se simplifica además, porque `addJob`/`removeJob` son sincrónicos y
desaparece el `ensureTone().then(...)` con su flag de cancelación.

**AC6 (un solo camino)**: `playNotes()` es la única función que convierte una lista de notas en sonido.
El arpegio al colocar la llama directo; el scheduler la llama desde `tick()`.

Por último: `npm uninstall tone`.

## 5. Verificación

```bash
npx tsc -b --noEmit     # AC9
npm test                # AC2–AC5
npm run build           # AC8, AC9 — confirmar que desaparece el chunk de 340 kB
```

Y en el navegador, para AC7 (los seis comportamientos de loops): repetir la verificación del spec
anterior. Como ya no hay Transport de Tone que inspeccionar, el motor debe exponer el conteo de jobs
para poder contarlos desde la consola:

```ts
export const jobCount = () => jobs.size;
```

| Acción | Jobs esperados |
|---|---|
| 1 pieza, checkbox ON | 1 |
| Apagar el checkbox | 0 |
| Volver a encenderlo | 1 |
| "Quitar" | 0 |
| 2 piezas | 2 |
| "Reset" | 0 |

## 6. Documentación

- **`docs/architecture/audio.md`** — reescritura completa. Deja de describir Tone y pasa a describir el
  grafo propio, la ADSR, el scheduler con lookahead y cómo testear con `OfflineAudioContext`. La
  sección "cómo verificar el audio sin oírlo" se vuelve mucho más fuerte: pasa de contar eventos a
  medir muestras.
- **`CLAUDE.md`** — stack sin Tone; el invariante del efecto de reconciliación se mantiene, reescrito
  en términos del motor.
- **`docs/README.md`**, **`docs/guides/quickstart.md`**, **`docs/guides/troubleshooting.md`** — sacar
  Tone del stack, actualizar la receta de verificación de audio y las causas de "no suena nada".
- **`specs/README.md`** — fila 002 en el índice.

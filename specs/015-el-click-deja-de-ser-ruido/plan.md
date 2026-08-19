# Plan — Spec 015

Tres pasos. El 1 es el timbre y es el único que toca `audio/`; el 2 es el default y la etiqueta; el 3
cierra. El spec es chico y las mediciones ya están hechas: lo que queda es escribirlas donde alguien
las vaya a buscar.

## Paso 1 — La campana

`scheduleClick` pasa de `AudioBufferSourceNode` a oscilador senoidal. El código se **achica**: se van el
`createBuffer`, el bucle que llena las muestras y el `sampleRate`, y con ellos la mitad del docblock
que los justificaba (`research.md` §1).

```
osc.type = 'sine'
osc.frequency.setValueAtTime(midiToHz(CLICK_MIDI), at)
env.gain.setValueAtTime(vel, at)                       ← sin rampa de ataque, como hoy
env.gain.exponentialRampToValueAtTime(ε, at + CLICK_SECONDS)
osc.start(at); osc.stop(at + CLICK_SECONDS)            ← NUEVO: hoy no hay stop()
```

**Exponencial y no lineal**, al revés que en `scheduleVoice`: allá la lineal es obligada porque la
exponencial no admite llegar a 0 y la envolvente de una nota tiene que cerrar en silencio; acá la
caída **es** el timbre —es lo que hace campana en vez de golpe— y una exponencial a un epsilon es lo
que suena a resonancia que se apaga.

**El `stop()` es nuevo y no opcional** (`research.md` §1). Hoy `scheduleClick` no tiene ninguno y el
docblock explica por qué: el buffer se termina solo, y un `stop()` sería un segundo lugar donde vive la
duración. Con un oscilador ese argumento se da vuelta —no se termina nunca— y encima hace falta para
dos cosas: cortar el epsilon en el que muere la exponencial, y disparar el `onended` del que cuelgan
los `disconnect()`. Sin él quedan ~12 osciladores vivos por ciclo y fallan los dos tests que exigen
silencio absoluto después del click. Ese medio docblock no se borra: se reescribe al revés.

Dos constantes en `voice.constants.ts`:

- **`CLICK_MIDI = 96`**, con el docblock cargando el hallazgo de §3: el instrumento usa **las 12 clases
  de altura**, así que "fuera de la escala" es imposible y lo que se elige es estar fuera del
  **registro** (`C4`–`D#6`). Ese párrafo es AC2 y es lo que evita que alguien vuelva a intentarlo.
- **`CLICK_SECONDS` 0,02 → 0,05**, con la tabla de §4 reemplazando la cuenta vieja del 15 %/21 %.

El docblock de `scheduleClick` se reescribe entero: hoy argumenta el ruido, y el argumento no se borra
—se acota (D1). Lo que produce una línea melódica es tener alturas **distintas**.

**El test (AC5) no se escribe de cero: se da vuelta el que ya existe.** `voice.test.ts` tiene hoy
*"NO tiene altura: cruza el cero a una tasa de ruido, no de nota"*, que exige `zeroCrossHz > 4000` — o
sea, afirma exactamente lo que este spec revierte, y con la campana **falla**: `zeroCrossHz` devuelve
Hz reales (divide por dos, ver su docblock en `test-context.ts`) y la senoidal da ~2 093. Se reescribe
en su lugar: la tasa de cruces tiene que dar la fundamental ± 2 %.

Y se mide así, y no por **centroide**, aunque el centroide sea el número del problema: `spectrum.ts`
documenta que un `AnalyserNode` no rinde nada offline —`getByteFrequencyData` devuelve el último bloque
procesado— y el repo no tiene DFT, así que un test de centroide empieza por escribir uno. La tasa de
cruces separa senoidal de ruido por un factor de cinco con un helper que ya está, y atrapa igual que
alguien vuelva a poner ruido sin querer. El centroide se queda en el `research.md`, que es donde vive
la medición que justificó la decisión.

## Paso 2 — El default y la etiqueta

Son **dos** los defaults, no uno: además del `useState` de `App.tsx` está el `let clicksAudible = true`
de `engine.ts`. Hoy no se ve porque el efecto de montaje lo pisa, pero dejarlos discrepando es tener el
mismo valor declarado dos veces en desacuerdo — que es lo que `App.tsx` evita con el tempo tomando
`DEFAULT_BPM` del motor. Los dos pasan a `false`.

`App.tsx`: `useState<boolean>(true)` → `false`, y el comentario de arriba **reescrito** — hoy dice que
los clicks arrancan encendidos porque sin ellos el recorrido se vuelve inaudible, citando D4 del 009.
El argumento no se borra: pasa a decir por qué el default se dio vuelta igual, y por qué eso hace que el
botón sea **más** necesario (D5).

`PiecePalette.tsx`: la etiqueta (D7, §7). Las restricciones son tres y están escritas: tiene que decir
qué se oye cuando está encendido, **no** puede prometer que apaga el cruce por celda ocupada —que es el
motivo por el que hoy dice "mudos"— y tiene que entrar en la tarjeta.

Y `specs/011-el-recorrido-esquiva-las-piezas/tasks.md`: **`T070` se cierra con un "no"**, con su motivo
escrito ahí mismo (AC7). Es la única vez que este lote toca el `tasks.md` de un spec viejo, y se hace
porque una tarea de seguimiento abierta que ya fue decidida es peor que no tenerla.

## Paso 3 — Verificación y documentación

`pnpm verify` (AC12). Después, a oído (AC13), que es el paso que **decide dos cosas que ningún render
contesta**:

1. Si la campana es agradable a 60, 110 y 160 bpm.
2. **Si el default debería volver a encendido.** Con la campana puesta el argumento de D5 se debilita
   solo, y volverlo a `true` es un booleano. Si se decide ahí, se decide con el motivo escrito.

Documentación: `docs/architecture/audio.md`, el docblock de `scheduleClick`, y `DESIGN.md` si la
etiqueta nueva toca el lenguaje del panel.

## Verificación

| Qué | Cómo |
|---|---|
| AC1, AC2, AC3 | Por lectura de las constantes y sus docblocks |
| AC15 | Los tests del click que ya existen: uno reescrito, los otros dos en verde sin tocar |
| AC4 | La tabla de §4 en el docblock, contrastada contra `TEMPO_MAX` |
| AC5 | Test de render offline: `zeroCrossHz` sobre la campana da la fundamental ± 2 % |
| AC6, AC7, AC8 | Por lectura de los tres archivos |
| AC9 | Por lectura: no hay rama que distinga el primer click de los demás |
| AC10 | Los tests del 011 sobre el cruce, sin tocar |
| AC11 | Sale gratis: la pieza muteada del 014 es un `Click` sin `note` (§6). Se verifica que no haya código propio — **con el 014 mergeado**; si no lo está, queda diferido y lo cierra el 014 |
| AC12 | `pnpm verify` + `check_invariants` |
| AC13, AC14 | `[M]` y lectura |

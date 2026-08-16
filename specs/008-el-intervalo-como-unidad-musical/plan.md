# Plan — El intervalo como unidad musical, y un solo transporte

Cuatro pasos. El 1 y el 2 son el cambio de fondo y van juntos (ver `research.md` §6); el 3 es la UI; el
4 documenta. **Antes de todo**, guardar la línea base de AC3.

## 0. La línea base

Con el repo como está, guardar la salida de `simulate_board` con **`bpm: 100`** y un tablero fijo de
tres piezas en columnas distintas. Ese archivo es contra lo que se compara al final: a 100 bpm la
semicorchea vale 0,15 s, así que **los onsets tienen que caer en los mismos instantes** después del
cambio. Es el AC que convierte "no debería sonar distinto" en algo falsable.

Guardar también la de `bpm: 160`, que **sí** va a cambiar, para poder mostrar en el PR qué se ganó.

## 1. El intervalo, en el scheduler

```ts
// audio/constants/scheduler.constants.ts
export const SUBDIVISIONS_PER_BEAT = 4;   // semicorcheas

// audio/scheduler.ts, al lado de barDuration y por el mismo motivo
export const intervalDuration = (bpm: number): number =>
  barDuration(bpm) / (BEATS_PER_BAR * SUBDIVISIONS_PER_BEAT);
```

Se exporta por la misma razón que `barDuration`: es una regla y no un detalle. Definida **sobre**
`barDuration` en vez de con su propia fórmula, para que exista un solo lugar donde el compás se
convierte en segundos.

`collectHits` deja de leer `job.spread` y usa `intervalDuration(bpm)`, calculado **una vez** antes del
bucle de jobs y no por nota:

```ts
const interval = intervalDuration(bpm);
…
job.notes.forEach((m, i) => out.push({ hz: midiToHz(m), at: at + i * interval }));
```

Y `Job` pierde el campo. Ojo con el comentario que hay hoy en `scheduler.types.ts` sobre por qué
`phase` es obligatoria y sin default: **ese comentario se queda**, es sobre `phase` y sigue valiendo.

## 2. La duración de la nota, y los dos caminos

- `voice.constants.ts`: sale `NOTE_DUR = 0.35`, entra `NOTE_INTERVALS = 2` con el dato de D3 en el
  comentario (a 100 bpm: 0,350 → 0,300 s).
- `scheduleVoice` **pierde su default** de `dur`. Hoy es `dur = NOTE_DUR`; un default que ya no puede
  ser constante es un default que miente, y el spec 005 ya había registrado ese `0.35` como uno de los
  cuatro pares de números que tenían que coincidir sin que nada los sincronizara. Pasa a ser
  obligatorio, igual que `phase` en `Job` y por el mismo motivo.
- Los dos llamadores calculan `NOTE_INTERVALS * intervalDuration(bpm)`: `tick()` en `engine.ts:127` y
  `playNotes` en `engine.ts:97`. `playNotes` además reemplaza `ARPEGGIO_SPREAD` por el mismo intervalo,
  y el `bpm` del módulo ya está a mano.

Con eso, **cambiar el timbre o el intervalo sigue alcanzando para los dos caminos**, que es la
propiedad que `.claude/rules/audio.md` protege. Lo que cambia es que ahora también el *ritmo* está
unificado, no solo las constantes.

## 3. Un transporte

En `App.tsx`:

- `loopPlaced: boolean` → `playing: boolean`.
- `toggleClock()` → `togglePlay()`, y el estado **no se setea a ciegas** (AC10):

  ```ts
  function togglePlay(){
    if (playing) stopClock(); else startClock();
    // El motor es quien sabe si arrancó: startClock() es un no-op silencioso
    // cuando audio() devuelve null, y sin este chequeo el boton diria "Pausa"
    // con el reloj parado. Es la falla suave que .claude/rules/audio.md obliga
    // a chequear en todo llamador, y era lo unico que la consulta imperativa
    // hacia bien antes de este spec.
    setPlaying(clockRunning());
  }
  ```

  Es **una** consulta, en el handler, y no una consulta en el render: `playing` sigue siendo estado de
  React y sigue siendo lo que dibuja el botón y lo que dispara el efecto (D4).
- El efecto de reconciliación pasa a `[placed, playing]`. **Nada más se mueve de él**: sigue siendo el
  único lugar que le habla a los jobs, que es la regla de `.claude/rules/ui.md`.
- `handleCellClick`: `if (!playing) playNow(noteSet);` (D5). Con `playing` derivado del motor esto
  además queda bien en el caso degradado: sin Web Audio nunca vale `true`, así que el camino de
  colocación no se apaga por un reloj que no arrancó.

En `PiecePalette.tsx`:

- Fuera el checkbox y el botón "Loop". Entra un botón que dice **▶ Reproducir** o **⏸ Pausa** según
  `playing`, con el color siguiendo al estado.
- La prop `loopPlaced` pasa a `playing`, `onToggleLoopPlaced` desaparece y `onToggleClock` pasa a
  `onTogglePlay`.

`clockRunning()` **se queda en el motor**, y con dos usos que conviene no confundir: la verificación
manual desde la consola que documenta `docs/architecture/audio.md` —igual que `jobCount()`— y la
confirmación de `togglePlay`. Lo que sale es que la UI lo consulte **en el render**, que es lo que hoy
deja al botón sin estado.

## 4. `simulate_board` y la documentación

- `simulateBoard.ts:184`: los jobs se arman sin `spread`. La respuesta gana `intervalSeconds` al lado
  de `barSeconds`, que ya está: es el número que hace falta para leer la `timeline` sin recalcularla.
- **`simulateBoard.ts:143` es el segundo uso de `spread` y es el que puede fallar callado.**
  `jobTimeline` calcula `lastNote = lastOnset + (notes.length - 1) * job.spread`, que es el corte por
  onset del spec 006. Sin `spread` eso da `NaN`, y `hit.at <= NaN` es siempre falso: la `timeline`
  volvería **vacía**, sin error. Pasa a `(notes.length - 1) * intervalDuration(bpm)`.
  Su comentario (`:123-134`) también cambia y **mejora**: el argumento de que los arpegios no se
  solapan hoy compara 0,6 s fijos contra el compás más corto que admite el schema (240 bpm → 1 s);
  con el intervalo derivado el arpegio mide siempre `bar / 4`, así que la propiedad deja de depender
  del bpm y vale por construcción. Vale reescribirlo, no borrarlo.
- Aserción en `mcp-server/src/__tests__/tools.test.ts` sobre `intervalSeconds` (AC8), al lado de la de
  `barSeconds` en `:244`.
- `docs/architecture/audio.md`: la tabla de los dos caminos, y el párrafo que dice que cambiar cómo se
  expande el arpegio **no** afecta al loop — con esto pasa a afectarlo, que es el punto.
- `docs/architecture/modelo-musical.md`: "arpegio de tiempo fijo" deja de ser cierto.
- `.claude/rules/audio.md`: "lo unificado son `scheduleVoice`, `DEFAULT_VOICE` y las constantes" pasa a
  incluir el intervalo.
- `specs/log.md`: estado del 008.

## 5. Verificación

| Qué | Cómo |
|---|---|
| **AC3** | `simulate_board` a `bpm: 100` contra la línea base del paso 0: `timeline` idéntica |
| **AC4**, camino del loop | `simulate_board` a 60 y a 160: el arpegio mide 1,000 s y 0,375 s respectivamente |
| **AC4**, camino de `playNotes` | **No lo cubre `simulate_board`**, que corre `collectHits` y nunca entra a `playNotes`. Y `playNotes` toca el singleton, así que tampoco se renderiza con `OfflineAudioContext`. Queda: leer el diff confirmando que las dos expansiones salen de `intervalDuration(bpm)` (AC1), y escuchar la diferencia al colocar a 60 contra 160 |
| AC2 | Test: agendar con un bpm, cambiarlo, volver a agendar **sin recrear el job**, y ver que el espaciado cambió |
| AC5 | Test de `scheduleVoice` con `OfflineAudioContext`: la nota dura 2 intervalos, y el `release` no se movió |
| AC1, AC9 | `pnpm verify` — que `ARPEGGIO_SPREAD` no exista lo verifica el compilador en los dos paquetes |
| AC8 | Aserción sobre `intervalSeconds` en `mcp-server/src/__tests__/tools.test.ts` — `pnpm verify` sola solo typechequea el campo, no lo mide |
| AC6, AC7, AC10 | A mano: el botón cambia de cara; colocar en pausa suena, colocar andando no. AC10 además con `audio()` forzada a `null` |
| Riesgo de 160 bpm | Escuchar el extremo del slider antes de cerrar el PR |

## Lo que un revisor va a esperar y no va a encontrar

Que el patrón cambie. **A 100 bpm no cambia nada** —esa es la gracia de AC3—, y a otros tempos lo que
cambia es que el arpegio por fin se estira y se comprime con el tempo. La unificación del transporte se
ve mucho más en el diff de lo que pesa en el diseño: la mitad importante es que el tiempo dejó de tener
dos unidades.

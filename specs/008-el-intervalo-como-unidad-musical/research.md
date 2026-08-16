# Research — El intervalo como unidad musical, y un solo transporte

## 1. El estado del tiempo, hoy

| Cantidad | Valor | ¿Depende del bpm? | Dónde |
|---|---|---|---|
| Espaciado del arpegio | `ARPEGGIO_SPREAD = 0.15` s | **no** | `audio/constants/engine.constants.ts:5` |
| Duración de la nota | `NOTE_DUR = 0.35` s | no | `audio/constants/voice.constants.ts:16` |
| Envolvente (`attack`/`decay`/`release`) | 0,005 / 0,06 / 0,12 s | no | ídem `:7-13` |
| Cola tras el release | `RELEASE_TAIL = 0.01` s | no | ídem `:27` |
| Compás | `barDuration(bpm) = 60/bpm × 4` | **sí** | `audio/scheduler.ts:23` |
| Fase de la pieza | fracción de compás | **sí**, por ser fracción | `domain/board.ts:55` |
| Rango de tempo | 60 a 160 bpm | — | `components/constants/layout.constants.ts:49-50` |

Los dos caminos a sonido aplican el espaciado por separado: `playNotes` con
`start + i * ARPEGGIO_SPREAD` (`engine.ts:97`) y `collectHits` con `at + i * job.spread`
(`scheduler.ts:90`), donde `job.spread` es una **copia** del mismo número hecha en `App.tsx:103`.

## 2. El 0,15 no era un número cualquiera: es una semicorchea a 100 bpm

```
semicorchea(bpm) = (60/bpm × 4) / 16 = 15/bpm
15/0.15 = 100
```

Es decir: **el instrumento venía tocando sus arpegios a un tempo implícito de 100** mientras el slider
decía 110 por defecto y podía decir cualquier cosa entre 60 y 160. Eso convierte a la migración en algo
verificable en vez de aproximado, y es lo que permite el AC3: a 100 bpm, los onsets tienen que caer en
los mismos instantes que hoy.

## 3. Qué cambia a cada tempo (medido)

| bpm | Compás | Semicorchea | Arpegio (1º→5º onset) | Arpegio **hoy** | Notas superpuestas con `NOTE_DUR` fijo |
|---|---|---|---|---|---|
| 60 | 4,000 s | 0,2500 s | 1,000 s | 0,600 s | 1,40 |
| 80 | 3,000 s | 0,1875 s | 0,750 s | 0,600 s | 1,87 |
| **100** | 2,400 s | **0,1500 s** | **0,600 s** | 0,600 s | 2,33 |
| 110 *(default)* | 2,182 s | 0,1364 s | 0,545 s | 0,600 s | 2,57 |
| 130 | 1,846 s | 0,1154 s | 0,462 s | 0,600 s | 3,03 |
| 160 | 1,500 s | 0,0938 s | 0,375 s | 0,600 s | 3,73 |

Dos lecturas:

- **La columna "hoy" es constante**, que es exactamente el problema: el tempo no toca el arpegio.
- **La última columna es la que obliga a la decisión D3.** Con el espaciado musical y `NOTE_DUR` fijo,
  la cantidad de notas sonando a la vez pasa de 1,4 a 3,7 según el tempo, cuando hoy es 2,33 siempre.
  El instrumento se volvería más denso al acelerar, que no es lo que uno espera al mover un tempo.
  Con `NOTE_DUR = 2 × intervalo` vuelve a ser constante (2,00) a cualquier bpm.

Precio de D3, medido a 100 bpm: la nota pasa de 0,350 s a 0,300 s (−14 %); sumado el `release` de
0,12 s que no se toca, la cola audible pasa de 0,470 s a 0,420 s (−11 %).

## 4. El transporte: tres de cuatro estados no hacen nada

| Reloj | Checkbox | Qué suena |
|---|---|---|
| parado | apagado | nada |
| parado | encendido | nada — hay jobs, no hay quien los agende |
| andando | apagado | nada — el reloj corre en vacío, `jobs.size === 0` |
| **andando** | **encendido** | el patrón |

Y el botón **no comunica su estado**: `PiecePalette.tsx:111` lo dibuja siempre igual ("Loop",
`bg-emerald-600`) porque `clockRunning()` se consulta dentro del handler de `App.tsx:113` y nunca llega
al render. No hay forma de saber si el instrumento está andando salvo escucharlo — y si el checkbox
está apagado, tampoco escuchándolo.

Las dos etiquetas dicen "Loop": el botón y el checkbox *"Loop de piezas colocadas (cada 1 compás)"*.

## 5. Archivos afectados

| Archivo | Acción |
|---|---|
| `src/audio/constants/scheduler.constants.ts` | `SUBDIVISIONS_PER_BEAT = 4` |
| `src/audio/scheduler.ts` | `intervalDuration(bpm)` junto a `barDuration`; `collectHits` deriva el espaciado en vez de leerlo del job |
| `src/audio/types/scheduler.types.ts` | sale `Job.spread` |
| `src/audio/constants/engine.constants.ts` | sale `ARPEGGIO_SPREAD` |
| `src/audio/constants/voice.constants.ts` | `NOTE_DUR` deja de ser un valor fijo: pasa a `NOTE_INTERVALS = 2` |
| `src/audio/voice.ts` | `scheduleVoice` ya recibe `dur` por parámetro; lo que se va es su **default** `NOTE_DUR` |
| `src/audio/engine.ts` | `playNotes` usa `intervalDuration(bpm)`; el `bpm` del módulo ya está ahí |
| `src/audio/__tests__/` | los tests que construyen jobs con `spread` |
| `src/App.tsx` | `loopPlaced` → `playing`; el efecto pasa a `[placed, playing]`; `handleCellClick` no dispara con `playing` |
| `src/components/PiecePalette.tsx` | un solo botón play/pausa con estado; fuera el checkbox y la palabra "loop" |
| `mcp-server/src/tools/simulateBoard.ts` | **dos** usos de `spread`, no uno: arma jobs sin él (`:184`) y `jobTimeline` calcula `lastNote` con `job.spread` (`:143`). Reporta el intervalo |
| `docs/architecture/audio.md` | la tabla de los dos caminos y el espaciado (`:215`, `:218`), y el bloque de reconciliación (`:154-165`), que tiene `spread: ARPEGGIO_SPREAD` y `[placed, loopPlaced]` |
| `docs/architecture/modelo-musical.md` | "arpegio de tiempo fijo" deja de ser cierto (`:160-167`) |
| `.claude/rules/audio.md` | ídem: "lo unificado son las constantes" pasa a ser "lo unificado es el intervalo" |
| `.claude/rules/ui.md` | `:18` nombra el efecto sobre `[placed, loopPlaced]` y "prender/apagar el checkbox" |
| `docs/guides/conventions.md` | `:176` afirma en presente que el efecto observa `[placed, loopPlaced]` |
| `docs/guides/troubleshooting.md` | `:110-112` tiene **tres** afirmaciones que el spec falsifica: el botón "Loop", el checkbox, y *"el arpegio de colocación no depende del reloj y suena siempre"* — que es exactamente lo que D5 deja de ser cierto |
| `docs/guides/quickstart.md` | `:76-78` — "el espaciado son dos lugares" pasa a ser una definición usada en dos lugares |
| `specs/004-…/tasks.md` | `:135` es la tarea de seguimiento que este spec **salda**: `ARPEGGIO_SPREAD` en unidades musicales |

**No se toca `src/domain/`.** Ni un archivo: el intervalo es del motor, no del modelo.

## 6. Por qué no se puede hacer solo la mitad

Sacar `Job.spread` sin derivar el intervalo del bpm no tiene sentido —no habría de dónde derivarlo— y
derivar el intervalo sin sacar `spread` deja la copia stale que D2 describe. La unificación del
transporte sí es separable en el papel, pero comparte los mismos archivos (`App.tsx`, `PiecePalette`) y
el mismo PR: partirla generaría dos revisiones del mismo diff.

## 7. Deuda adyacente detectada (fuera de alcance)

- **`TEMPO_MAX = 160` puede quedar inusable** con la semicorchea derivada (0,094 s). Se escucha al
  implementar; bajarlo es una constante y un commit aparte.
- **`CLOCK_START_DELAY` y `PLAY_DELAY` siguen en segundos** (0,05 y 0,02). Son latencias de agenda, no
  duraciones musicales: no deben derivar del tempo. Anotado para que nadie los "unifique" de paso.
- **El slider de tempo no tiene unidad visible**: dice `110` a secas. Cosmético, va con el 010.

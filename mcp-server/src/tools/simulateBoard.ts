import { z } from 'zod';
import { defineTool, json } from './types.ts';
import { PIECE_KEYS } from '../pieces.ts';
import { rotateN, reflect } from '../../../src/domain/transform.ts';
import { cellsAt, isValid, occupantAt, phaseFor } from '../../../src/domain/board.ts';
import { notesForRotation, midiName } from '../../../src/domain/music.ts';
import { SHAPES, ANCHOR_INDEX, CELLS_PER_PIECE } from '../../../src/domain/constants/pieces.constants.ts';
import { GRID_W, GRID_H } from '../../../src/domain/constants/board.constants.ts';
import { BASE_MAP, DEFAULT_OCTAVE } from '../../../src/domain/constants/music.constants.ts';
import type { Cell } from '../../../src/domain/types/transform.types.ts';
import type { PlacedPiece } from '../../../src/domain/types/board.types.ts';
import { collectHits, barDuration, intervalDuration } from '../../../src/audio/scheduler.ts';
import { midiToHz } from '../../../src/audio/voice.ts';
import { LOOKAHEAD, TICK_MS } from '../../../src/audio/constants/scheduler.constants.ts';
import { DEFAULT_BPM, CLOCK_START_DELAY } from '../../../src/audio/constants/engine.constants.ts';
import type { Job, ClockState } from '../../../src/audio/types/scheduler.types.ts';

/**
 * Que suena un tablero, sin escucharlo.
 *
 * Recorre las mismas tres etapas que la app y **con las mismas funciones**:
 * colocar (`cellsAt`/`isValid`), armar los jobs que crearia el efecto de
 * reconciliacion, y correr el scheduler real. Nada de eso esta reescrito aca.
 *
 * El bucle de ventanas es deliberado (D7 del plan): una formula idealizada
 * responderia lo que el scheduler *deberia* hacer, y este bucle responde lo que
 * **hace**, incluidos el corte de `scheduledUntil` y los compases que se saltean.
 */

/** Redondeo para agrupar y para reportar: los onsets salen de aritmetica de punto flotante. */
const round4 = (t: number): number => Math.round(t * 1e4) / 1e4;

/**
 * Tolerancia al comparar instantes, en segundos. Muy por debajo de cualquier
 * diferencia audible y muy por encima del error de punto flotante acumulado.
 */
const TIME_EPSILON = 1e-9;

const placementSchema = z.object({
  piece: z.enum(PIECE_KEYS),
  rotation: z.number().int().min(0).max(3).default(0),
  mirror: z.boolean().default(false),
  at: z.tuple([z.number().int(), z.number().int()])
    .describe(`Celda [x, y] donde cae la CELDA DE AGARRE, no la esquina. Tablero de ${GRID_W}x${GRID_H}, y crece hacia abajo.`),
});

const inputSchema = z.object({
  pieces: z.array(placementSchema).min(1).max(Math.floor(GRID_W * GRID_H / CELLS_PER_PIECE))
    .describe('Las piezas, en el orden en que se colocarían: cada una choca con las anteriores válidas.'),
  bpm: z.number().min(40).max(240).default(DEFAULT_BPM),
  bars: z.number().int().min(1).max(8).default(2)
    .describe('Cuántos compases simular desde el downbeat 0.'),
});

/** Una colocacion ya resuelta: lo que la respuesta reporta y lo que alimenta al scheduler. */
interface Resolved {
  id: string;
  anchorIndex: number;
  cells: Cell[];
  notes: number[];
  valid: boolean;
  reason: string | null;
}

/**
 * Etapa 1 — colocacion, con las reglas del tablero de `domain/board.ts`.
 *
 * El motivo del rechazo sale de las mismas funciones y no de una copia de sus
 * condiciones: `isValid(cells, [])` responde solo por los bordes —el tablero
 * vacio no puede chocar con nada— y `occupantAt` dice contra QUE pieza se choco.
 */
function resolve(entries: z.output<typeof inputSchema>['pieces']): Resolved[] {
  const placed: PlacedPiece[] = [];
  const out: Resolved[] = [];

  entries.forEach((e, i) => {
    const rotated = rotateN(SHAPES[e.piece], e.rotation);
    const shape = e.mirror ? reflect(rotated) : rotated;
    const cells = cellsAt(shape, ANCHOR_INDEX[e.piece], e.at[0], e.at[1]);

    const ascending = notesForRotation(BASE_MAP[e.piece], DEFAULT_OCTAVE, e.rotation);
    const notes = e.mirror ? [...ascending].reverse() : ascending;

    const id = String(i + 1);
    const valid = isValid(cells, placed);
    let reason: string | null = null;
    if (!valid) {
      if (!isValid(cells, [])) {
        reason = 'fuera-del-tablero';
      } else {
        const choque = cells.map(([x, y]) => occupantAt(placed, x, y)).find(p => p !== null);
        reason = `choque-con-${choque?.id}`;
      }
    }

    // Solo lo valido pasa a ser obstaculo, igual que en la app: una jugada
    // rechazada no deja nada en el tablero.
    if (valid) placed.push({ id, piece: e.piece, rotation: e.rotation, mirror: e.mirror, cells, notes });
    out.push({ id, anchorIndex: ANCHOR_INDEX[e.piece], cells, notes, valid, reason });
  });

  return out;
}

/**
 * Etapa 3 — la linea de tiempo, corriendo el scheduler en ventanas de `TICK_MS`.
 *
 * Arranca el reloj como `startClock`: el origen queda `CLOCK_START_DELAY`
 * adelante y `scheduledUntil` estrictamente antes, que es lo que evita perder el
 * downbeat del compas 0. Los tiempos se reportan en la misma escala, con el
 * instante 0 en el arranque del reloj.
 *
 * Va **job por job** para conocer la fase de cada uno, que es lo que permite
 * cortar por ONSET y no por nota (ver `jobTimeline`).
 */
function timeline(jobs: Job[], bpm: number, bars: number): { at: number; hz: number }[] {
  return jobs.flatMap(job => jobTimeline(job, bpm, bars));
}

/**
 * Los onsets de UN job en la ventana de `bars` compases.
 *
 * **El corte va por onset y no por nota.** Un arpegio empieza en el onset del
 * compas y se extiende `(notas - 1) * spread` despues; filtrar cada nota por
 * `at < end` recortaba la cola del ultimo compas cuando `(1 - phase) * bar` era
 * menor que esa duracion —o sea desde la columna 8 a 110 bpm, y antes todavia a
 * tempos rapidos—, asi que `onsets.total` dependia de la fase: la misma pieza
 * daba 10 onsets en la columna 1 y 7 en la columna 9. En la app esas notas
 * suenan igual, porque el loop sigue; era la simulacion la que mentia.
 *
 * El limite se compara contra la ultima nota del ultimo compas de la ventana. No
 * hay ambiguedad al asignar una nota a su onset porque los arpegios no se
 * solapan, y desde el spec 008 eso vale **por construccion** y no por aritmetica:
 * el intervalo es `bar / 16`, asi que el arpegio mide `(notas - 1) * bar / 16 =
 * bar / 4` y los onsets de un mismo job estan separados por `bar`. O sea que el
 * arpegio ocupa un cuarto del espacio entre onsets consecutivos **a cualquier
 * tempo**. Antes habia que comparar dos numeros que dependian de cosas distintas
 * —0,6 s de arpegio contra el compas de 1 s del extremo del schema, 240 bpm— y
 * revisar la cuenta cada vez que el schema se tocaba.
 */
function jobTimeline(job: Job, bpm: number, bars: number): { at: number; hz: number }[] {
  const bar = barDuration(bpm);
  const origin = CLOCK_START_DELAY;
  // Los compases de la ventana son [0, bars): el downbeat del compas `bars` ya es
  // el compas siguiente y queda afuera, que es lo que este corte siempre quiso
  // decir.
  const lastOnset = origin + (bars - 1 + job.phase) * bar;
  const lastNote = lastOnset + (job.notes.length - 1) * intervalDuration(bpm);
  // El bucle de ventanas tiene que llegar hasta el ultimo onset; lo que se emita
  // despues lo descarta el corte.
  const end = origin + bars * bar;

  const state: ClockState = { origin, scheduledUntil: 0 };
  const hits: { at: number; hz: number }[] = [];

  for (let t = 0; t < end; t += TICK_MS / 1000) {
    for (const hit of collectHits(t, LOOKAHEAD, bpm, [job], state)) {
      // `lastNote` se calcula con las mismas operaciones y en el mismo orden que
      // el scheduler, asi que la igualdad de floats es exacta; la tolerancia esta
      // por si alguna de las dos formulas se reescribe.
      if (hit.at <= lastNote + TIME_EPSILON) hits.push({ at: hit.at, hz: hit.hz });
    }
  }
  return hits;
}

export const simulateBoard = defineTool({
  name: 'simulate_board',
  description:
    'Qué suena un tablero dado, sin escucharlo. Usar en lugar de leer el scheduler y recorrer el ' +
    'lookahead a mano: valida cada colocación con las mismas funciones que la app, arma los jobs ' +
    'que crearía el efecto de reconciliación y corre el scheduler real en ventanas de 25 ms, ' +
    'devolviendo la línea de tiempo de onsets agrupada por instante.\n' +
    'Sirve sobre todo para lo que solo se oye: `coincident.maxPerInstant` dice cuántas notas caen ' +
    'juntas, que es la diferencia entre textura y volumen. La columna de la celda de agarre es la ' +
    'posición dentro del compás, así que dos piezas en columnas distintas se desfasan y en la ' +
    'misma columna se apilan.',
  inputSchema,
  run: ({ pieces, bpm, bars }) => {
    const resolved = resolve(pieces);

    // Etapa 2 — los jobs, tal como los crearia el efecto de reconciliacion de
    // App.tsx. Una pieza invalida no aporta job y por lo tanto no aporta onsets.
    const jobs: Job[] = resolved
      .filter(r => r.valid)
      .map(r => ({
        id: r.id,
        notes: r.notes,
        phase: phaseFor(r.cells, r.anchorIndex),
      }));

    // Nombre de nota por frecuencia, construido con la MISMA `midiToHz` que uso
    // el scheduler: la igualdad exacta de floats vale porque es la misma funcion
    // sobre la misma entrada. Es lo que evita invertir la formula a mano.
    const nameByHz = new Map<number, string>();
    for (const j of jobs) for (const m of j.notes) nameByHz.set(midiToHz(m), midiName(m));

    const hits = timeline(jobs, bpm, bars);

    const porInstante = new Map<number, string[]>();
    for (const h of hits) {
      const key = round4(h.at);
      const notas = porInstante.get(key) ?? [];
      notas.push(nameByHz.get(h.hz) ?? `${Math.round(h.hz)}Hz`);
      porInstante.set(key, notas);
    }
    const instantes = [...porInstante.entries()].sort((a, b) => a[0] - b[0]);

    return json({
      bpm,
      barSeconds: round4(barDuration(bpm)),
      // La separacion entre notas de un mismo arpegio, que desde el spec 008 sale
      // del compas: sin este numero la `timeline` no se puede leer sin recalcular
      // `bar / 16` a mano.
      intervalSeconds: round4(intervalDuration(bpm)),
      bars,
      placements: resolved.map((r, i) => ({
        id: r.id,
        piece: pieces[i].piece,
        rotation: pieces[i].rotation,
        mirror: pieces[i].mirror,
        at: pieces[i].at,
        cells: r.cells,
        valid: r.valid,
        ...(r.valid
          // La fase es lo que el spec 004 hizo audible: la columna del ancla
          // dividida por el ancho del tablero.
          ? { phase: phaseFor(r.cells, r.anchorIndex) }
          : { reason: r.reason }),
      })),
      onsets: { total: hits.length, distinctInstants: instantes.length },
      timeline: instantes.map(([at, notes]) => ({ at, count: notes.length, notes })),
      coincident: {
        // Instantes con MAS de un onset: es el numero que distingue textura de
        // volumen, y el que tiene que bajar cuando las piezas estan desfasadas.
        instants: instantes.filter(([, n]) => n.length > 1).length,
        maxPerInstant: instantes.reduce((max, [, n]) => Math.max(max, n.length), 0),
      },
    });
  },
});

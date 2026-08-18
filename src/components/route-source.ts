import type { Sequence } from '../domain/types/sequence.types.ts';
import type { PlacedPiece } from '../domain/types/board.types.ts';
import type { Cell } from '../domain/types/transform.types.ts';
import type { Marca, CeldaPorEstrenar } from './types/route.types.ts';
import { cellsByPlayOrder } from '../domain/sequence.ts';
import { cycleGeneration } from '../audio/engine.ts';

/**
 * El par activa/pendiente del recorrido CON celdas, para que la cabeza dibuje lo que
 * suena y no lo que va a sonar.
 *
 * El motor ya tiene su propio par, pero su `Sequence` no lleva `pieceId` ni `cell`: el
 * click no tiene altura y para sonar alcanza con contarlo, y ademas el override de
 * eslint le prohibe a `audio/` ver `Cell`, tambien como `import type`. La unica
 * secuencia con celdas es la del dominio, y la UI la deriva de `placed`, que es el
 * tablero DE AHORA — o sea la pendiente. Sin este modulo la cabeza recorreria el
 * circuito encolado mientras suena el viejo, justo durante los hasta 7,5 s de espera
 * que este spec existe para hacer visibles.
 *
 * Vive en `components/` y no en `audio/` por esa misma frontera: habla `Cell`. Es el
 * mismo cruce que `App.tsx` ya hace al proyectar la secuencia para `setSequence`.
 *
 * Singleton de modulo y NO estado de React a proposito: lo lee un loop de
 * requestAnimationFrame, igual que `readSpectrum()`. Meterlo en estado seria un render
 * por cuadro para un dato que el loop consume y descarta.
 *
 * Lo que se guarda no es la `Sequence` cruda sino su TABLA POR OFFSET, armada una vez
 * al encolar. Dos motivos, y ninguno es de estilo:
 *
 * - `Step` no lleva las celdas de sus cinco notas, asi que ir de un offset a una celda
 *   exige cruzar la secuencia con `placed` via `cellsByPlayOrder`. Hacerlo en el loop
 *   seria repetir 60 veces por segundo un join que no cambia entre cuadro y cuadro.
 * - El cruce tiene que quedar CONGELADO junto con la ruta. `placed` es el tablero de
 *   ahora: si el loop lo mirara en vivo, una pieza quitada durante el ciclo se apagaria
 *   antes de dejar de sonar, que es el mismo desfasaje que AC9 existe para evitar.
 */

/** Una celda de pieza dentro del ciclo: donde esta y en que intervalo suena. */
interface CeldaDePieza {
  cell: Cell;
  offset: number;
}

/** Una ruta ya lista para dibujar: que celda pisa cada offset, y quienes suenan en ella. */
interface Ruta {
  marcas: (Marca | null)[];
  ids: string[];
  /** Las cinco celdas de cada pieza con el intervalo en que suena cada una. */
  porPieza: Map<string, CeldaDePieza[]>;
}

const RUTA_VACIA: Ruta = { marcas: [], ids: [], porPieza: new Map() };

let activa: Ruta = RUTA_VACIA;
let pendiente: Ruta | null = null;

/**
 * La ultima generacion de ciclo observada. Se compara contra `cycleGeneration()` porque
 * el motor es el unico que sabe el instante exacto del swap: lo decide `collectWindow`
 * medio intervalo antes del borde, y ninguna cuenta sobre `placed` lo ve venir.
 */
let generacion = 0;

/**
 * Las piezas que entraron al ciclo en el ultimo swap y todavia no se estrenaron celda
 * por celda. Se reemplaza entero en cada swap; recordar cuales YA se estrenaron es del
 * loop de dibujo, que es quien lo observa cuadro a cuadro.
 */
let estrenando: string[] = [];

let veloActual: CeldaPorEstrenar[] = [];

/**
 * Encola el recorrido nuevo. La llama el mismo efecto de `App` que ya hace
 * `setSequence`: las dos colas se encolan juntas, o la cabeza y el sonido quedarian
 * mirando ciclos distintos.
 *
 * Solo se guarda el ultimo, igual que en el motor: lo que se encola es el recorrido
 * COMPLETO, asi que dos cambios antes del cierre valen por uno.
 */
export function encolar(s: Sequence, placed: readonly PlacedPiece[]): void {
  pendiente = construir(s, placed);
  recomputarVelo();
}

/**
 * El recorrido que esta sonando ahora mismo, como tabla indexada por offset. La llama
 * el loop de dibujo, y el swap ocurre ACA: en el mismo cuadro en que el motor lo
 * reporta, no cuando React se entere.
 *
 * Que el loop corra tambien en pausa —igual que el de `Spectrum`— no es un problema
 * sino lo que hace que el swap se observe en el cuadro exacto.
 */
export function rutaActiva(): readonly (Marca | null)[] {
  const g = cycleGeneration();
  if (g === generacion) return activa.marcas;

  // La generacion se sincroniza SIEMPRE, haya pendiente o no: si el motor conto un swap
  // que aca no tenia contraparte, quedarse atras haria que el proximo encolar entre en
  // vigencia al cuadro siguiente en vez de esperar su borde.
  generacion = g;
  if (pendiente === null) return activa.marcas;

  // Las que no estaban sonando estrenan en este ciclo, y estrenan CELDA POR CELDA: es
  // lo unico que hace visible en que momento exacto a la pieza le toca su turno.
  const sonaban = new Set(activa.ids);
  estrenando = pendiente.ids.filter((id) => !sonaban.has(id));

  activa = pendiente;
  pendiente = null;
  recomputarVelo();
  return activa.marcas;
}

/**
 * Las celdas colocadas que todavia no sonaron nunca, para dibujarlas atenuadas (AC5).
 *
 * Son dos poblaciones distintas y por eso `offset` puede ser `null`:
 *
 * - Las de una pieza que YA entro al ciclo y todavia no llego su turno: tienen offset,
 *   y se estrenan cuando la cabeza las pisa. Esto es lo que hace legible que el orden
 *   de reproduccion no es el de colocacion — la pieza no se enciende cuando arranca el
 *   ciclo sino cuando le toca.
 * - Las de una pieza encolada, que ni siquiera entro: no hay instante que esperar
 *   todavia, solo el cierre del ciclo. Offset `null`.
 *
 * La IDENTIDAD del array es la senal de cambio: mientras sea el mismo array, el loop no
 * tiene nada que rearmar. Cambia al encolar y al hacer swap, o sea rarisimo comparado
 * con los 60 cuadros por segundo que lo leen.
 */
export function velo(): readonly CeldaPorEstrenar[] {
  return veloActual;
}

function recomputarVelo(): void {
  const out: CeldaPorEstrenar[] = [];

  for (const id of estrenando) {
    for (const c of activa.porPieza.get(id) ?? []) out.push({ id, cell: c.cell, offset: c.offset });
  }

  if (pendiente !== null) {
    const sonando = new Set(activa.ids);
    for (const id of pendiente.ids) {
      if (sonando.has(id)) continue;
      for (const c of pendiente.porPieza.get(id) ?? []) out.push({ id, cell: c.cell, offset: null });
    }
  }

  veloActual = out;
}

/**
 * Cruza la secuencia con el tablero y devuelve la tabla indexada por offset.
 *
 * Las celdas de las notas salen de `cellsByPlayOrder` —la pura del dominio, que ya trae
 * el retrogrado aplicado— y las de los clicks de `Click.cell`, que el 009 materializo
 * junto con la distancia. NINGUNA se calcula aca: entre las dos celdas mas lejanas del
 * tablero hay 792 caminos minimos, o sea 792 formas de dibujar un recorrido que no es el
 * que suena, y por eso D5 le prohibe a la vista elegir el suyo.
 *
 * `occupantAt` queda deliberadamente afuera aunque parezca el camino corto: recorre
 * todas las piezas por celda, y el loop de dibujo la llamaria 60 veces por segundo para
 * un dato que ya esta en la secuencia.
 */
function construir(s: Sequence, placed: readonly PlacedPiece[]): Ruta {
  const marcas: (Marca | null)[] = new Array<Marca | null>(Math.max(0, s.length)).fill(null);
  const porPieza = new Map<string, CeldaDePieza[]>();
  const porId = new Map(placed.map((p) => [p.id, p]));

  for (const step of s.steps) {
    const pieza = porId.get(step.pieceId);
    // No puede pasar: `App` deriva la secuencia y el tablero del MISMO `placed` en el
    // mismo efecto. Si igual pasara, ese paso queda sin marcas y la cabeza lo cruza a
    // oscuras en vez de dibujar una celda inventada — el silencio es preferible a la
    // mentira, porque una celda equivocada se lee como que el modelo esta mal.
    if (!pieza) continue;
    const celdas = cellsByPlayOrder(pieza);
    const deLaPieza: CeldaDePieza[] = [];
    for (let j = 0; j < celdas.length; j++) {
      marcas[step.offset + j] = { cell: celdas[j], nota: true };
      deLaPieza.push({ cell: celdas[j], offset: step.offset + j });
    }
    porPieza.set(step.pieceId, deLaPieza);
  }

  // Los clicks despues de las notas y no antes: sus offsets no se pisan —lo garantiza el
  // test del 009— asi que el orden no cambia nada hoy, pero si alguna vez se pisaran, que
  // gane la nota es lo correcto: es lo que se escucha con altura.
  for (const c of s.clicks) marcas[c.offset] = { cell: c.cell, nota: false };

  return { marcas, ids: s.steps.map((st) => st.pieceId), porPieza };
}

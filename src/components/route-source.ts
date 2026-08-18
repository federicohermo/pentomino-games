import type { Sequence } from '../domain/types/sequence.types.ts';
import type { PlacedPiece } from '../domain/types/board.types.ts';
import type { Marca } from './types/route.types.ts';
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

/** Una ruta ya lista para dibujar: que celda pisa cada offset, y quienes suenan en ella. */
interface Ruta {
  marcas: (Marca | null)[];
  ids: string[];
}

let activa: Ruta = { marcas: [], ids: [] };
let pendiente: Ruta | null = null;

/**
 * La ultima generacion de ciclo observada. Se compara contra `cycleGeneration()` porque
 * el motor es el unico que sabe el instante exacto del swap: lo decide `collectWindow`
 * medio intervalo antes del borde, y ninguna cuenta sobre `placed` lo ve venir.
 */
let generacion = 0;

const oyentes = new Set<(ids: string[]) => void>();

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
  notificar();
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
  const porId = new Map(placed.map((p) => [p.id, p]));

  for (const step of s.steps) {
    const pieza = porId.get(step.pieceId);
    // No puede pasar: `App` deriva la secuencia y el tablero del MISMO `placed` en el
    // mismo efecto. Si igual pasara, ese paso queda sin marcas y la cabeza lo cruza a
    // oscuras en vez de dibujar una celda inventada — el silencio es preferible a la
    // mentira, porque una celda equivocada se lee como que el modelo esta mal.
    if (!pieza) continue;
    const celdas = cellsByPlayOrder(pieza);
    for (let j = 0; j < celdas.length; j++) marcas[step.offset + j] = { cell: celdas[j], nota: true };
  }

  // Los clicks despues de las notas y no antes: sus offsets no se pisan —lo garantiza el
  // test del 009— asi que el orden no cambia nada hoy, pero si alguna vez se pisaran, que
  // gane la nota es lo correcto: es lo que se escucha con altura.
  for (const c of s.clicks) marcas[c.offset] = { cell: c.cell, nota: false };

  return { marcas, ids: s.steps.map((st) => st.pieceId) };
}

/**
 * El recorrido que esta sonando ahora mismo. La llama el loop de dibujo, y el swap
 * ocurre ACA: en el mismo cuadro en que el motor lo reporta, no cuando React se entere.
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

  activa = pendiente;
  pendiente = null;
  notificar();
  return activa.marcas;
}

/**
 * Los ids de las piezas que estan encoladas y todavia no suenan (AC5).
 *
 * Esto si pasa por estado de React —es la excepcion declarada a D1—: la atenuacion de
 * la pieza pendiente cambia una vez cada 7,5 s, no 60 veces por segundo, asi que un
 * render por cambio es mas barato que leerlo desde el loop.
 *
 * Se notifica en los DOS momentos en que la lista cambia: al encolar y al hacer el swap.
 * Tambien al suscribirse, para que un componente que monta despues de un `encolar` no
 * quede mostrando una lista vieja hasta el proximo cambio — que puede tardar el ciclo
 * entero.
 *
 * Devuelve la baja. Suscribir y dar de baja son idempotentes porque StrictMode monta y
 * desmonta dos veces.
 */
export function suscribirPendientes(cb: (ids: string[]) => void): () => void {
  oyentes.add(cb);
  cb(idsPendientes());
  return () => { oyentes.delete(cb); };
}

/**
 * Que piezas hay en la pendiente que no esten ya sonando en la activa.
 *
 * Por `pieceId` y no por identidad del `Step`: `buildSequence` reconstruye la secuencia
 * entera en cada cambio, asi que hasta las piezas que no se movieron traen `Step` nuevos.
 */
function idsPendientes(): string[] {
  if (pendiente === null) return [];
  const sonando = new Set(activa.ids);
  return pendiente.ids.filter((id) => !sonando.has(id));
}

/**
 * Un array nuevo por notificacion y no el mismo reusado: React compara por identidad y
 * un array conservado entre avisos no dispararia el render. Es la trampa opuesta a la de
 * `readSpectrum()`, que reusa su buffer justamente porque su consumidor NO es React.
 */
function notificar(): void {
  const ids = idsPendientes();
  for (const cb of oyentes) cb(ids);
}

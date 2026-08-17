import type { HIT } from '../constants/scheduler.constants.ts';

/**
 * Un ciclo listo para sonar: lo unico que el motor necesita saber, y nada mas.
 *
 * El modelo del spec 009 es un RECORRIDO: un circuito cerrado visita las piezas, y
 * las celdas vacias que cruza entre una y otra suenan como clicks. En el dominio un
 * click lleva su celda ademas de su instante, porque alli el recorrido ES el modelo.
 * Aca no: el click no tiene altura y suena igual en cualquier lado (D4), asi que la
 * celda no es informacion que el motor pueda usar — para sonar solo hace falta
 * CONTAR clicks.
 *
 * Y aunque pudiera usarla, no podria verla: `Cell` vive en el dominio y el override
 * de eslint sobre esta capa prohibe importarlo, tambien como `import type` (usa la
 * variante de typescript-eslint, que si ve los imports de tipo). Importarlo no
 * romperia el navegador —los tipos se borran—: rompe `pnpm lint`, que es donde la
 * separacion de capas se verifica de verdad.
 *
 * Las dos salidas faciles quedaron descartadas, y conviene que quede escrito por si
 * alguien las vuelve a proponer:
 *
 * - DUPLICAR `Cell` en esta capa deja dos definiciones que alguien tiene que
 *   mantener iguales a mano, que es exactamente lo que la regla de constantes del
 *   repo existe para evitar.
 * - AFLOJAR el override del linter compra comodidad tirando abajo la separacion que
 *   sostiene el grafo de imports desde el spec 005.
 *
 * Por eso esta forma es la del dominio MENOS `pieceId` y MENOS `cell`: `App.tsx` es
 * el unico puente entre las dos capas y entrega la secuencia dejando caer esos
 * campos. Es una PROYECCION, no una traduccion —los `offset` y los `notes` viajan
 * tal cual, sin recalcularse—, y eso solo se sostiene mientras las dos formas sigan
 * siendo estructuralmente compatibles.
 */
export interface Sequence {
  /**
   * Cada parada del recorrido: en que intervalo entra y que notas dispara.
   *
   * Sin `pieceId`: el motor no tiene a quien devolverselo. Quien necesita saber que
   * pieza sono es la UI, y la UI mira la secuencia del dominio, no esta.
   */
  steps: { offset: number; notes: number[] }[];
  /** Los cruces por celda vacia. Sin `cell`: para sonar solo hace falta contar. */
  clicks: { offset: number }[];
  /**
   * Cuanto mide el ciclo completo, en INTERVALOS — la misma unidad que los `offset`.
   *
   * En intervalos y no en segundos porque el intervalo es la unidad ritmica del
   * instrumento desde el spec 008 (`intervalDuration(bpm) = barDuration(bpm) / 16`):
   * asi el recorrido mantiene su forma a cualquier tempo en vez de quedar atado al
   * bpm con el que se armo. Medido: con 8 piezas el ciclo mide ~55 intervalos, que a
   * 110 bpm son 7,5 s.
   */
  length: number;
}

export interface ClockState {
  /** instante del compas 0 en el reloj del contexto */
  origin: number;
  /**
   * Hasta donde ya se emitieron onsets. Sin esto cada onset se emitiria cuatro
   * veces: los ticks son de 25 ms y el horizonte de 100 ms, asi que las ventanas
   * consecutivas se solapan.
   */
  scheduledUntil: number;
}

/**
 * Que clase de evento es un `Hit`.
 *
 * Derivado de `HIT` y no un `enum`: `erasableSyntaxOnly` rechaza los enums, y es la
 * misma opcion que permite cargar estos modulos con node sin compilar. Al derivarlo,
 * agregar una clase de evento es tocar un solo lugar.
 */
export type HitKind = (typeof HIT)[keyof typeof HIT];

/**
 * Un evento a sonar: que suena y en que instante del reloj del contexto.
 *
 * Union discriminada y NO un solo objeto con `hz?: number`. El campo opcional dejaria
 * pasar en silencio un click con altura —y una nota sin ella—, convirtiendo un error
 * de construccion en un `undefined` que nadie mira. Es el mismo argumento por el que
 * `phase` era obligatoria y sin default en el `Job` que este spec borro: el bug no es
 * de tipos, es que el tipo no obliga a decidir.
 *
 * Con la union, `kind` obliga a elegir y el compilador reclama el `hz` en la rama que
 * lo lleva.
 */
export type Hit =
  | { kind: typeof HIT.note; hz: number; at: number }
  | { kind: typeof HIT.click; at: number };

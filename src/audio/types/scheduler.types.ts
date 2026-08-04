/** Una pieza colocada que re-dispara su secuencia cada compas. */
export interface Job {
  id: string;
  notes: number[];
  /** segundos entre notas consecutivas del arpegio */
  spread: number;
  /**
   * Posicion del job dentro del compas, `0 <= phase < 1`.
   *
   * Fraccion y no segundos: asi el patron se mantiene proporcional al cambiar el
   * tempo, en vez de quedar atado al bpm con el que se creo el job.
   *
   * Obligatorio y sin default a proposito: un `phase?: number` dejaria pasar en
   * silencio el caso de agregar un job y olvidarse la fase, que es exactamente el
   * bug que este campo corrige.
   */
  phase: number;
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

/** Una nota a sonar: que frecuencia y en que instante del reloj del contexto. */
export interface Hit {
  hz: number;
  at: number;
}

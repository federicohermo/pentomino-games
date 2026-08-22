import type { PieceKey } from '../../domain/types/pieces.types.ts';
import type { RegimenDeRotacion } from '../../domain/types/music.types.ts';

/**
 * Los dos objetos de props de la tarjeta de piezas, que hasta el spec 022 eran
 * dieciséis props planas sobre `PiecePalette`.
 *
 * Adentro hay dos paneles distintos —la orientación de la pieza en la mano y el
 * transporte del instrumento— y con las props sueltas la firma no decía qué agrupaba con
 * qué: enumeraba en vez de documentar.
 *
 * Los tres criterios de reparto, que no son obvios y por eso van escritos:
 *
 * - `regimen` va con la ORIENTACIÓN aunque sea global como el tempo, porque gobierna QUÉ
 *   HACE la rotación (spec 017): con `escala` cambia la fórmula de escala y con `orden`
 *   cambia por dónde arranca el arpegio, así que sin él la orientación no dice qué suena.
 * - `noteSet` va del mismo lado por lo mismo: es el arpegio de la pieza en la mano EN ESA
 *   orientación, y su `useMemo` en el shell ya depende de los cuatro campos de acá.
 * - `onReset` va con el TRANSPORTE y no con la orientación porque `resetBoard` frena el
 *   reloj además de vaciar el tablero, que es la mitad que su propio comentario declara
 *   «no cosmética».
 */

/** La pieza en la mano: cuál es, cómo está puesta, y qué hace girarla. */
export interface PropsDeOrientacion {
  selected: PieceKey;
  rotation: number;
  mirror: boolean;
  /**
   * Que hace la rotacion (spec 017). Hasta el 019 completaba la frase de su propia fila
   * —«Rotacion … cambia escala / orden»—; al borrarse los cuatro botones de grados la
   * frase se quedo sin sujeto y el regimen paso a ser la fila.
   */
  regimen: RegimenDeRotacion;
  noteSet: readonly number[];
  onSelect: (piece: PieceKey) => void;
  onRegimen: (regimen: RegimenDeRotacion) => void;
}

/** El transporte del instrumento: tempo, play/pausa, los clicks del recorrido y el reset. */
export interface PropsDeTransporte {
  tempo: number;
  playing: boolean;
  clicks: boolean;
  onTempo: (bpm: number) => void;
  onTogglePlay: () => void;
  onToggleClicks: () => void;
  onReset: () => void;
}

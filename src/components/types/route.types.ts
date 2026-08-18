import type { Cell } from '../../domain/types/transform.types.ts';

/**
 * Que pisa la cabeza lectora en un intervalo del ciclo: una celda, y si lo que suena
 * ahi es una nota o un click.
 *
 * Es la traduccion de `Sequence` que el dibujo necesita y que el dominio no tiene por
 * que dar: `Step` lleva `pieceId`, `offset` y `notes` pero NO las celdas de sus cinco
 * notas, y `Click` lleva su celda pero por separado. Unir las dos cosas indexadas por
 * offset es trabajo de la UI, no del modelo.
 *
 * `nota` y no un `kind` de tres valores: son exactamente dos casos y el tercero —"no
 * hay nada en este intervalo"— se expresa con la ausencia de la marca. Un booleano
 * que solo puede tomar dos valores no necesita un const-object.
 */
export interface Marca {
  cell: Cell;
  /** Nota fuerte, click tenue (D7): si se vieran igual, el recorrido parece tener piezas donde no hay. */
  nota: boolean;
}

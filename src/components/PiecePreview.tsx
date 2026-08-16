import { midiName } from '../domain/music.ts';
import type { Cell } from '../domain/types/transform.types.ts';
import type { PieceKey } from '../domain/types/pieces.types.ts';
import { PREVIEW_CELL_PX } from './constants/layout.constants.ts';
import { PIECE_COLOR } from './constants/palette.constants.ts';

/**
 * Previsualizacion de la pieza seleccionada, con el punto que marca la celda de
 * agarre.
 *
 * Presentacional: sin estado, sin efectos. Recibe la forma YA transformada, asi
 * que no rota ni refleja nada.
 *
 * `piece` entra aparte de `shape` porque la forma no alcanza para saber que pieza
 * es —el color es identidad y la identidad no se infiere de la geometria—, y
 * derivarla de la forma seria reimplementar el reconocimiento de piezas en la
 * vista.
 */

interface Props {
  piece: PieceKey;
  shape: readonly Cell[];
  anchor: Cell;
  noteSet: readonly number[];
}

export default function PiecePreview({ piece, shape, anchor, noteSet }: Props) {
  const color = PIECE_COLOR[piece];
  const cols = Math.max(...shape.map(c=>c[0])) + 1;
  const rows = Math.max(...shape.map(c=>c[1])) + 1;

  return (
    <div className="mt-3">
      <span className="text-sm text-slate-600">Previsualización (el punto marca dónde agarra el cursor):</span>
      <div className="grid mt-1" style={{gridTemplateColumns:`repeat(${cols}, ${PREVIEW_CELL_PX}px)`}}>
        {Array.from({length: cols * rows}, (_,i)=>{
          const x = i % cols;
          const y = Math.floor(i / cols);
          const on = shape.some(([cx,cy])=> cx===x && cy===y);
          const isAnchor = anchor[0]===x && anchor[1]===y;
          // Mismo tamano que antes (PREVIEW_CELL_PX sigue en 20): lo unico que cambia
          // es que la celda llena deja de ser gris y toma el color de la pieza, que
          // es el mismo que va a tener en el tablero.
          return <div key={i}
                      style={{width: PREVIEW_CELL_PX, height: PREVIEW_CELL_PX, background: on? color.bg : undefined}}
                      className={`border border-slate-200 -m-px flex items-center justify-center ${on? '':'bg-white'}`}>
            {/* El punto del ancla marca ESTADO (donde agarra el cursor), asi que no
                toma el color de pieza. Lo que si sale de la paleta es su anillo: el
                `fg` de la pieza es, por construccion, el mejor de negro/blanco
                contra ese fondo, y sin el el emerald se pierde sobre los amarillos. */}
            {isAnchor && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                               style={{boxShadow: on? `0 0 0 1px ${color.fg}` : undefined}}></span>}
          </div>
        })}
      </div>
      <div className="text-xs text-slate-600 mt-1">Notas: {noteSet.map(m=>midiName(m)).join(' · ')}</div>
    </div>
  );
}

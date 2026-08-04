import { midiName } from '../domain/music.ts';
import type { Cell } from '../domain/types/transform.types.ts';
import { PREVIEW_CELL_PX } from './constants/layout.constants.ts';

/**
 * Previsualizacion de la pieza seleccionada, con el punto que marca la celda de
 * agarre.
 *
 * Presentacional: sin estado, sin efectos. Recibe la forma YA transformada, asi
 * que no rota ni refleja nada.
 */

interface Props {
  shape: Cell[];
  anchor: Cell;
  noteSet: number[];
}

export default function PiecePreview({ shape, anchor, noteSet }: Props) {
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
          return <div key={i}
                      style={{width: PREVIEW_CELL_PX, height: PREVIEW_CELL_PX}}
                      className={`border border-slate-200 -m-px flex items-center justify-center ${on? 'bg-slate-800':'bg-white'}`}>
            {isAnchor && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
          </div>
        })}
      </div>
      <div className="text-xs text-slate-600 mt-1">Notas: {noteSet.map(m=>midiName(m)).join(' · ')}</div>
    </div>
  );
}

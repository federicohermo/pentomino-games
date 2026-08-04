import type { ReactNode } from 'react';
import { occupantAt } from '../domain/board.ts';
import { GRID_W, GRID_H } from '../domain/constants/board.constants.ts';
import type { Cell } from '../domain/types/transform.types.ts';
import type { PieceKey } from '../domain/types/pieces.types.ts';
import type { PlacedPiece } from '../domain/types/board.types.ts';
import { CELL_PX } from './constants/layout.constants.ts';

/**
 * Panel central: la grilla del tablero con el fantasma de previsualizacion.
 *
 * Presentacional: sin estado, sin efectos. El fantasma llega calculado —`previewSet`
 * y `previewValid`— porque quien sabe si la jugada es valida es el dominio, no la
 * vista.
 *
 * `children` es la ranura donde va la previsualizacion de la pieza, que en el DOM
 * cuelga del mismo contenedor `relative` que la grilla.
 */

interface Props {
  placed: PlacedPiece[];
  previewSet: Set<string>;
  previewValid: boolean;
  hover: Cell | null;
  selected: PieceKey;
  onCellClick: (x: number, y: number) => void;
  onCellEnter: (cell: Cell) => void;
  onMouseLeave: () => void;
  children?: ReactNode;
}

export default function Board({
  placed, previewSet, previewValid, hover, selected,
  onCellClick, onCellEnter, onMouseLeave, children,
}: Props) {
  return (
    <div className="col-span-12 md:col-span-6 bg-white rounded-2xl shadow p-4">
      <h2 className="text-lg font-semibold mb-3">Tablero {GRID_W}×{GRID_H}</h2>
      <div className="relative">
        <div
          className="grid"
          style={{gridTemplateColumns:`repeat(${GRID_W}, ${CELL_PX}px)`}}
          onMouseLeave={onMouseLeave}
        >
          {Array.from({length: GRID_W*GRID_H}, (_,i)=>{
            const x = i % GRID_W; const y = Math.floor(i/GRID_W);
            const occ = occupantAt(placed, x, y);
            const ghost = previewSet.has(`${x},${y}`);
            let tone: string;
            if (occ && ghost) tone = 'bg-rose-500 text-white';   // choque contra pieza colocada
            else if (occ) tone = 'bg-slate-900 text-white';
            else if (ghost) tone = previewValid? 'bg-emerald-300' : 'bg-rose-200';
            else tone = 'bg-white hover:bg-slate-100';
            return (
              <div key={i}
                   onClick={()=> onCellClick(x,y)}
                   onMouseEnter={()=> onCellEnter([x,y])}
                   style={{width: CELL_PX, height: CELL_PX}}
                   className={`border border-slate-300 -m-px flex items-center justify-center text-[10px] ${previewValid || !hover? 'cursor-pointer':'cursor-not-allowed'} ${tone}`}
                   title={`(${x},${y})`}
              >{occ? occ.piece: (ghost? selected : '')}</div>
            );
          })}
        </div>

        {children}
      </div>
    </div>
  );
}

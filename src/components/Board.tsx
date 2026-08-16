import type { CSSProperties, ReactNode } from 'react';
import { occupantAt, occupantCellIndex } from '../domain/board.ts';
import { degreeByCellIndex, notesForRotation, midiName } from '../domain/music.ts';
import { GRID_W, GRID_H } from '../domain/constants/board.constants.ts';
import { SHAPES } from '../domain/constants/pieces.constants.ts';
import { BASE_MAP, DEFAULT_OCTAVE } from '../domain/constants/music.constants.ts';
import type { Cell } from '../domain/types/transform.types.ts';
import type { PieceKey } from '../domain/types/pieces.types.ts';
import type { PlacedPiece } from '../domain/types/board.types.ts';
import { CELL_PX } from './constants/layout.constants.ts';
import { PIECE_COLOR } from './constants/palette.constants.ts';

/**
 * Panel central: la grilla del tablero con el fantasma de previsualizacion.
 *
 * Presentacional: sin estado, sin efectos. El fantasma llega calculado —`previewSet`
 * y `previewValid`— porque quien sabe si la jugada es valida es el dominio, no la
 * vista.
 *
 * `children` es la ranura donde va la previsualizacion de la pieza, que en el DOM
 * cuelga del mismo contenedor `relative` que la grilla.
 *
 * ## Que dice cada celda ocupada
 *
 * La identidad de la pieza pasa al COLOR de fondo, y el texto de la celda pasa a ser
 * SU nota —la que le toca por su lugar en la forma—, con el grado en chico en la
 * esquina. La letra de la pieza, que era lo unico que se veia, deja de repetirse 5
 * veces.
 *
 * La nota sale de encadenar cuatro puras del dominio, y ninguno de los cuatro pasos
 * esta reimplementado aca:
 *
 * ```
 * occupantCellIndex → degreeByCellIndex → notesForRotation → midiName
 * ```
 *
 * Dos cosas de esa cadena no son de estilo:
 *
 * - `degreeByCellIndex` recibe `SHAPES[occ.piece]`, la forma CANONICA, y no las
 *   celdas ya colocadas: el grado se arrastra por indice —rotar y reflejar son
 *   `map`— y recalcularlo sobre la forma transformada daria otro mapeo, porque
 *   rotar corre el origen del angulo.
 * - El arpegio sale de `notesForRotation` y NO de `occ.notes`. `occ.notes` ya trae
 *   el retrogrado aplicado cuando la pieza se coloco reflejada, asi que indexarlo
 *   con el grado leeria la forma al derecho contra un arpegio al reves. La
 *   reflexion invierte el ORDEN EN EL TIEMPO, no que nota le toca a que celda.
 */

interface Props {
  // readonly a la entrada, igual que en domain/board.ts: nunca mutar lo que ya se
  // entrego a React.
  placed: readonly PlacedPiece[];
  previewSet: ReadonlySet<string>;
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

            // De (x,y) a la nota, encadenando puras. Solo para celdas ocupadas:
            // `occupantAt` ya garantizo que la pieza cubre esta celda, asi que el
            // indice nunca es -1.
            let degree: number | null = null;
            let note: string | null = null;
            if (occ) {
              degree = degreeByCellIndex(SHAPES[occ.piece])[occupantCellIndex(occ, x, y)];
              note = midiName(notesForRotation(BASE_MAP[occ.piece], DEFAULT_OCTAVE, occ.rotation)[degree]);
            }

            // El color de pieza es IDENTIDAD y pierde contra cualquier ESTADO: el
            // choque, el fantasma y el hover se pintan igual que antes. Por eso el
            // estilo inline —que le gana a cualquier clase— solo se arma en la celda
            // ocupada y libre de fantasma; en las demas el fondo sigue viniendo de
            // una clase de Tailwind.
            let tone: string;
            const style: CSSProperties = {width: CELL_PX, height: CELL_PX};
            if (occ && ghost) tone = 'bg-rose-500 text-white';   // choque contra pieza colocada
            else if (occ) {
              tone = '';
              // Inline y no `bg-[...]`: Tailwind escanea el fuente y una clase
              // interpolada desde PIECE_COLOR no se generaria.
              style.background = PIECE_COLOR[occ.piece].bg;
              style.color = PIECE_COLOR[occ.piece].fg;
            }
            else if (ghost) tone = previewValid? 'bg-emerald-300' : 'bg-rose-200';
            else tone = 'bg-white hover:bg-slate-100';

            return (
              <div key={i}
                   onClick={()=> onCellClick(x,y)}
                   onMouseEnter={()=> onCellEnter([x,y])}
                   style={style}
                   className={`relative border border-slate-300 -m-px flex items-center justify-center text-[11px] ${previewValid || !hover? 'cursor-pointer':'cursor-not-allowed'} ${tone}`}
                   title={`(${x},${y})`}
              >
                {/* El grado va como el indice que devuelve el dominio (0..4) y sin
                    renumerar: lo que se lee en la celda es exactamente lo que
                    responden los tests y el MCP server. */}
                {degree !== null && <span className="absolute top-0 left-1 text-[9px] leading-tight opacity-60 tabular-nums">{degree}</span>}
                {note ?? (ghost? selected : '')}
              </div>
            );
          })}
        </div>

        {children}
      </div>
    </div>
  );
}

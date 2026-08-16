import { midiName } from '../domain/music.ts';
import type { PlacedPiece } from '../domain/types/board.types.ts';
import { PIECE_COLOR } from './constants/palette.constants.ts';

/**
 * Panel derecho: las piezas ya colocadas, con su boton de quitar.
 *
 * Presentacional: sin estado, sin efectos. La `key` va por `id` y nunca por
 * indice, porque los elementos se pueden quitar.
 *
 * Ocupa DOS columnas y no tres: la tercera se la lleva el tablero, que es 10 × 6 y
 * necesita la proporcion para llenar su tarjeta. Acá el contenido es texto que
 * reflowea, asi que el precio es que la lista de notas de una pieza puede partirse
 * en dos renglones.
 */

interface Props {
  placed: readonly PlacedPiece[];
  onRemove: (id: string) => void;
}

export default function PlacedList({ placed, onRemove }: Props) {
  return (
    <div className="col-span-12 md:col-span-2 bg-white rounded-2xl shadow p-3">
      <h2 className="text-lg font-semibold mb-2">Piezas colocadas</h2>
      <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
        {placed.length===0 && <div className="text-slate-500 text-sm">(Vacío — hacé click en el tablero para colocar la pieza seleccionada)</div>}
        {placed.map(p=> (
          <div key={p.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              {/* La letra va sobre el color de pieza y no PINTADA del color de
                  pieza: como texto sobre el blanco de la tarjeta, el amarillo de `V`
                  es ilegible. Sobre su propio fondo vale el par medido de
                  `PIECE_COLOR`, que es el que el test de la paleta mantiene en Lc. */}
              <div className="font-medium">
                <span className="px-1.5 rounded"
                      style={{background: PIECE_COLOR[p.piece].bg, color: PIECE_COLOR[p.piece].fg}}>{p.piece}</span>
                {' '}{p.rotation*90}° {p.mirror? '⥯':''}
              </div>
              <button onClick={()=> onRemove(p.id)}
                      className="text-xs px-2 py-0.5 rounded bg-rose-600 text-white">Quitar</button>
            </div>
            <div className="text-xs text-slate-600">Notas: {p.notes.map(m=>midiName(m)).join(' · ')}</div>
            <div className="text-[10px] text-slate-500 mt-1">Celdas: {p.cells.map(([x,y])=>`(${x},${y})`).join(' ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

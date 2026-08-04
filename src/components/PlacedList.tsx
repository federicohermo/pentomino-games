import { midiName } from '../domain/music.ts';
import type { PlacedPiece } from '../domain/types/board.types.ts';

/**
 * Panel derecho: las piezas ya colocadas, con su boton de quitar.
 *
 * Presentacional: sin estado, sin efectos. La `key` va por `id` y nunca por
 * indice, porque los elementos se pueden quitar.
 */

interface Props {
  placed: readonly PlacedPiece[];
  onRemove: (id: string) => void;
}

export default function PlacedList({ placed, onRemove }: Props) {
  return (
    <div className="col-span-12 md:col-span-3 bg-white rounded-2xl shadow p-3">
      <h2 className="text-lg font-semibold mb-2">Piezas colocadas</h2>
      <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
        {placed.length===0 && <div className="text-slate-500 text-sm">(Vacío — hacé click en el tablero para colocar la pieza seleccionada)</div>}
        {placed.map(p=> (
          <div key={p.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="font-medium">{p.piece} {p.rotation*90}° {p.mirror? '⥯':''}</div>
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

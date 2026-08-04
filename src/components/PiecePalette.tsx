import { midiName } from '../domain/music.ts';
import { SHAPES } from '../domain/constants/pieces.constants.ts';
import { CHROMATIC, BASE_MAP } from '../domain/constants/music.constants.ts';
import type { PieceKey } from '../domain/types/pieces.types.ts';
import { TEMPO_MIN, TEMPO_MAX } from './constants/layout.constants.ts';

/**
 * Panel izquierdo: eleccion de pieza, rotacion, reflexion, tempo y transporte.
 *
 * Presentacional: sin estado, sin efectos. Todo entra por props.
 */

interface Props {
  selected: PieceKey;
  rotation: number;
  mirror: boolean;
  tempo: number;
  loopPlaced: boolean;
  noteSet: readonly number[];
  onSelect: (piece: PieceKey) => void;
  onRotate: (rotation: number) => void;
  onMirror: () => void;
  onTempo: (bpm: number) => void;
  onToggleLoopPlaced: (on: boolean) => void;
  onToggleClock: () => void;
  onReset: () => void;
}

export default function PiecePalette({
  selected, rotation, mirror, tempo, loopPlaced, noteSet,
  onSelect, onRotate, onMirror, onTempo, onToggleLoopPlaced, onToggleClock, onReset,
}: Props) {
  return (
    <div className="col-span-12 md:col-span-3 bg-white rounded-2xl shadow p-3">
      <h2 className="text-lg font-semibold mb-2">Piezas</h2>
      <div className="grid grid-cols-6 gap-2">
        {(Object.keys(SHAPES) as PieceKey[]).map(key=> (
          <button
            key={key}
            onClick={()=> onSelect(key)}
            className={`px-2 py-1 rounded-lg border text-sm ${selected===key? 'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}
          >{key}</button>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium">Rotación</span>
          <div className="flex gap-1">
            {[0,1,2,3].map(r=> (
              <button key={r} onClick={()=> onRotate(r)} className={`px-2 py-1 rounded ${rotation===r?'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}>{r*90}°</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Reflexión</span>
          <button onClick={onMirror} className={`px-3 py-1 rounded ${mirror?'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}>{mirror? 'ON':'OFF'}</button>
        </div>
        <div className="pt-2 text-sm text-slate-600">
          <p><b>{selected}</b> → tónica {CHROMATIC[BASE_MAP[selected]]}</p>
          <p>Notas actuales: {noteSet.map(m => midiName(m)).join(" · ")}</p>
        </div>
        <div className="mt-4 border-t pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">Tempo</span>
            <input type="range" min={TEMPO_MIN} max={TEMPO_MAX} value={tempo} onChange={e=>onTempo(parseInt(e.target.value))} />
            <span className="tabular-nums w-10 text-right">{tempo}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onToggleClock} className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">Loop</button>
            <button onClick={onReset} className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300">Reset</button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={loopPlaced} onChange={e=>onToggleLoopPlaced(e.target.checked)} />
            Loop de piezas colocadas (cada 1 compás)
          </label>
        </div>
      </div>
    </div>
  );
}

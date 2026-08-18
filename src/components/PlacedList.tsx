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
 *
 * Las tarjetas se muestran en el orden del CIRCUITO (`orden`, la misma
 * `buildSequence` que ya alimenta al motor en App.tsx) y no en el orden de
 * colocacion: desde el spec 009 el tablero es un recorrido, y colocar una pieza en
 * el medio puede reordenar la musica entera sin tocar ninguna pieza existente. El
 * numero que muestra cada tarjeta es su posicion 1-based en ese recorrido, pero el
 * circuito es CERRADO y no tiene principio: `buildSequence` fija el arranque en el
 * indice 0 solo para eliminar las rotaciones equivalentes del mismo recorrido, asi
 * que "1" es un punto de partida convencional, no el comienzo de nada.
 *
 * ## Muestra el circuito PENDIENTE, no el que suena — y es a propósito
 *
 * `orden` sale de la `buildSequence` de `App`, o sea del tablero de AHORA: durante los
 * hasta 7,5 s que el spec 009 hace esperar, la lista ya numera con el circuito nuevo
 * mientras la cabeza lectora todavía recorre el viejo (AC9 del 010). Las dos superficies
 * dicen cosas distintas al mismo tiempo, así que la elección tiene que ser explícita.
 *
 * Esta lista es el inventario de `placed`, no una vista de reproducción: la pieza recién
 * colocada aparece en ella desde el click, y numerarla con un circuito que todavía no la
 * contiene la dejaría sin número o con uno prestado. La regla "dibujá lo que suena" es de
 * la cabeza, que dibuja SOBRE el tablero y ahí una celda encendida afirma "esto es lo que
 * estás oyendo". Un número en una tarjeta no afirma eso.
 */

interface Props {
  placed: readonly PlacedPiece[];
  /** Los `pieceId` en el orden en que el circuito los visita, tal cual sale de `buildSequence`. */
  orden: readonly string[];
  onRemove: (id: string) => void;
}

export default function PlacedList({ placed, orden, onRemove }: Props) {
  // `buildSequence` emite un Step por cada pieza colocada, asi que en los hechos
  // `orden` siempre cubre a `placed` entero. Aun asi no se descarta en silencio
  // ninguna pieza ausente de `orden` -eso seria un fallo mudo y el repo lo trata
  // como bug-: la que falte queda al final, conservando el orden de colocacion.
  const posicion = new Map(orden.map((id, i) => [id, i]));
  const ordenadas = [...placed].sort((a, b) => {
    const posA = posicion.get(a.id) ?? Number.POSITIVE_INFINITY;
    const posB = posicion.get(b.id) ?? Number.POSITIVE_INFINITY;
    return posA - posB;
  });

  return (
    <div className="col-span-12 md:col-span-2 bg-white rounded-2xl shadow p-3">
      <h2 className="text-lg font-semibold mb-2">Piezas colocadas</h2>
      <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
        {placed.length===0 && <div className="text-slate-500 text-sm">(Vacío — hacé click en el tablero para colocar la pieza seleccionada)</div>}
        {ordenadas.map(p=> {
          const pos = posicion.get(p.id);
          return (
          <div key={p.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              {/* La letra va sobre el color de pieza y no PINTADA del color de
                  pieza: como texto sobre el blanco de la tarjeta, el amarillo de `V`
                  es ilegible. Sobre su propio fondo vale el par medido de
                  `PIECE_COLOR`, que es el que el test de la paleta mantiene en Lc. */}
              <div className="font-medium">
                <span className="text-slate-400 mr-1">{pos===undefined ? '?' : pos+1}.</span>
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
          );
        })}
      </div>
    </div>
  );
}

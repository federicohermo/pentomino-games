import type { CSSProperties } from 'react';
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
import Playhead from './Playhead.tsx';

/**
 * Panel central: la grilla del tablero con el fantasma de previsualizacion.
 *
 * Presentacional: sin estado, sin efectos. El fantasma llega calculado
 * —`previewCells` y `previewValid`— porque quien sabe si la jugada es valida es el
 * dominio, no la vista.
 *
 * `previewCells` llega como ARRAY y no como `Set`: el indice de cada celda dentro
 * del array es lo que la conecta con su grado, y un `Set` de claves `"x,y"` lo
 * pierde. Es el mismo invariante de orden del que vive el resto del modelo.
 *
 * No tiene ranura de `children` ni titulo propio: la previsualizacion aparte se
 * retiro cuando el fantasma paso a mostrar la nota de cada celda —decia lo mismo
 * dos veces— y el `<h2>Tablero 10×6</h2>` se fue con ella. Los dos gastaban alto
 * para repetir lo que la grilla ya dice sola.
 *
 * ## Que dice cada celda ocupada — y cada celda del fantasma
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
 * - El arpegio sale de `notesForRotation` y NO de `arpeggioFor`. `arpeggioFor` es la
 *   derivacion completa y devuelve las notas EN ORDEN DE REPRODUCCION, con el
 *   retrogrado ya aplicado si la pieza se coloco reflejada, asi que indexarlo con el
 *   grado leeria la forma al derecho contra un arpegio al reves. La reflexion invierte
 *   el ORDEN EN EL TIEMPO, no que nota le toca a que celda. Quien pinta UNA celda
 *   quiere el arpegio ASCENDENTE, que es lo que `notesForRotation` da y lo que la
 *   propia firma de `arpeggioFor` remite aca.
 *
 * El fantasma dice EXACTAMENTE lo mismo que va a decir la celda una vez colocada:
 * misma nota, mismo grado, misma cadena de puras — la unica diferencia es de donde
 * salen la pieza y la rotacion (`selected`/`rotation` en vez de `occ`). Mostrar ahi
 * la letra repetida cinco veces, que es lo que hacia antes, dejaba al fantasma
 * hablando el idioma que este tablero dejo de hablar.
 *
 * Su fondo es GRIS y no el color de la pieza: el fantasma es ESTADO —donde caeria
 * la pieza que todavia no colocaste— y el color es identidad. El rosa del caso
 * invalido se queda, porque es el unico canal que distingue una jugada imposible
 * ademas del cursor.
 *
 * ## La celda que todavia no se estreno la tapa `Playhead`, no este archivo
 *
 * Desde el spec 009 una pieza recien colocada no entra al recorrido hasta que el ciclo
 * cierra, y despues todavia tiene que llegarle su turno. Esa espera se dibuja atenuando
 * la celda, pero NO desde aca: el velo son nodos propios que `Playhead.tsx` crea encima
 * de la grilla, porque el estreno es celda por celda —cinco cambios al ritmo del
 * intervalo— y eso es exactamente lo que D1 prohibe llevar a `useState`.
 *
 * Las celdas de la pieza las renderiza este archivo con `key={i}` y sin refs ni
 * `data-*`, y asi tiene que seguir: darle un handle al loop significaria partir el
 * estilo de una celda entre React y el bucle, que es lo que el review del 007 pago caro.
 *
 * ## La celda es una baldosa, no un casillero
 *
 * Cada celda de 63 px contiene una BALDOSA redondeada con 2 px de aire alrededor,
 * en vez de ser un rectangulo con borde compartido (`-m-px`, que es lo que habia).
 * Es el lenguaje de la lamina de referencia: las piezas se leen como fichas
 * apoyadas sobre la grilla y no como celdas de una tabla. La separacion la hace el
 * padding del contenedor y no un `gap`, asi que el ancho del tablero sigue siendo
 * exactamente 10 × `CELL_PX` y no hay un segundo numero que mantener.
 */

interface Props {
  // readonly a la entrada, igual que en domain/board.ts: nunca mutar lo que ya se
  // entrego a React.
  placed: readonly PlacedPiece[];
  previewCells: readonly Cell[];
  previewValid: boolean;
  hover: Cell | null;
  selected: PieceKey;
  rotation: number;
  onCellClick: (x: number, y: number) => void;
  onCellEnter: (cell: Cell) => void;
  onMouseLeave: () => void;
}

export default function Board({
  placed, previewCells, previewValid, hover, selected, rotation,
  onCellClick, onCellEnter, onMouseLeave,
}: Props) {
  // Que celda del fantasma cae en (x,y), POR INDICE: es lo que permite pedirle su
  // grado al mapeo canonico. Se arma una vez por render y no una vez por celda.
  const ghostIndexAt = new Map(previewCells.map(([x,y], k)=> [`${x},${y}`, k]));

  // El texto de las celdas de una (pieza, rotacion), calculado UNA vez y no una por
  // celda: `degreeByCellIndex` ordena, hay hasta 60 celdas por render y hay un
  // render por movimiento del cursor. Es el mismo argumento con el que
  // `palette.constants.ts` guarda `fg` en vez de recalcular la luminancia.
  const textCache = new Map<string, { degree: number; note: string }[]>();
  function cellText(piece: PieceKey, rot: number){
    const key = `${piece}${rot}`;
    const hit = textCache.get(key);
    if (hit) return hit;
    const arp = notesForRotation(BASE_MAP[piece], DEFAULT_OCTAVE, rot);
    const fresh = degreeByCellIndex(SHAPES[piece])
      .map(degree => ({ degree, note: midiName(arp[degree]) }));
    textCache.set(key, fresh);
    return fresh;
  }

  // `md:col-span-7` y no 6: con seis columnas la tarjeta mide 536 × 380 de interior
  // y la grilla 520 × 312, o sea llena a lo ancho y le sobran 68 px de alto — el
  // tablero es 10 × 6 y la tarjeta no tenia esa proporcion. Con siete columnas el
  // interior pasa a 633 × 380, y 10 × 6 celdas de 63 px dan 630 × 378: entra con
  // ~2 px por lado y el padding queda parejo en los cuatro. La columna sale de
  // `PlacedList`, que es texto que reflowea y tenia aire de sobra.
  return (
    <div className="col-span-12 md:col-span-7 bg-white rounded-2xl shadow p-4">
      {/* `overflow-x-auto` y no un `CELL_PX` mas chico: la grilla mide 10 × 63 =
          630 px FIJOS y no se encoge, y abajo del breakpoint `md` el panel util
          queda en ~311 px. Sin esto la grilla se sale del borde derecho y —toda la
          cadena de ancestros es `overflow-x: visible`— empuja scroll horizontal a
          la PAGINA entera. Scrollea el tablero, que es lo que sobra, en vez de
          achicar la celda: la nota es lo que hay que poder leer. */}
      {/* La cabeza lectora se monta ACA, dentro del contenedor que scrollea: un
          absoluto se posiciona contra la caja de padding de su contenedor posicionado,
          asi que scrollea con la grilla y sigue alineada debajo de `md`. Se importa
          directo y no llega por una ranura de `children`: `Playhead` no recibe props, o
          sea que no le pide nada a `App`, y una ranura generica reabriria la puerta que
          el review del 007 cerro midiendo. */}
      <div className="relative overflow-x-auto">
        <Playhead />
        <div
          className="grid w-max"
          style={{gridTemplateColumns:`repeat(${GRID_W}, ${CELL_PX}px)`}}
          onMouseLeave={onMouseLeave}
        >
          {Array.from({length: GRID_W*GRID_H}, (_,i)=>{
            const x = i % GRID_W; const y = Math.floor(i/GRID_W);
            const occ = occupantAt(placed, x, y);
            const ghostIndex = ghostIndexAt.get(`${x},${y}`);
            const ghost = ghostIndex !== undefined;

            // De (x,y) a la nota, encadenando puras. La celda ocupada la pide por
            // `occupantCellIndex` —`occupantAt` ya garantizo que la pieza la cubre,
            // asi que el indice nunca es -1— y la del fantasma la trae puesta, que
            // es para lo que `previewCells` llega ordenado.
            let cell: { degree: number; note: string } | null = null;
            if (occ) cell = cellText(occ.piece, occ.rotation)[occupantCellIndex(occ, x, y)];
            else if (ghostIndex !== undefined) cell = cellText(selected, rotation)[ghostIndex];

            // El color de pieza es IDENTIDAD y pierde contra cualquier ESTADO: el
            // choque, el fantasma y el hover se pintan igual que antes. Por eso el
            // estilo inline —que le gana a cualquier clase— solo se arma en la celda
            // ocupada y libre de fantasma; en las demas el fondo sigue viniendo de
            // una clase de Tailwind.
            let tone: string;
            const style: CSSProperties = {};
            if (occ && ghost) tone = 'bg-rose-500 text-white';   // choque contra pieza colocada
            else if (occ) {
              tone = 'shadow-sm';
              // Inline y no `bg-[...]`: Tailwind escanea el fuente y una clase
              // interpolada desde PIECE_COLOR no se generaria.
              style.background = PIECE_COLOR[occ.piece].bg;
              style.color = PIECE_COLOR[occ.piece].fg;
            }
            // Gris y no verde: el fantasma es estado, y el color ya esta ocupado
            // diciendo que pieza es. El rosa del invalido se queda — es el unico
            // canal que dice "aca no entra" ademas del cursor.
            else if (ghost) tone = previewValid? 'bg-slate-300' : 'bg-rose-300';
            else tone = 'bg-white hover:bg-slate-100';

            return (
              <div key={i}
                   onClick={()=> onCellClick(x,y)}
                   onMouseEnter={()=> onCellEnter([x,y])}
                   style={{width: CELL_PX, height: CELL_PX}}
                   className={`p-[2px] ${previewValid || !hover? 'cursor-pointer':'cursor-not-allowed'}`}
                   /* El title dice las tres cosas de la celda, no solo su coordenada: la
                      nota entra en la baldosa pero el grado va abreviado a `#3`, y sobre
                      el fantasma las dos son lo que decide la jugada. Sale del MISMO
                      `cell` que se pinta, asi que no puede decir una nota y mostrar otra.
                      NO es accesibilidad: la celda es un `div` con `onClick` y sin
                      `role`, sin `tabIndex` y sin nombre accesible, y un `title` sobre un
                      elemento generico que no recibe foco no lo anuncia ningun lector de
                      pantalla — es un tooltip de mouse y nada mas. El hueco real (la
                      celda no se alcanza con el teclado) esta en Deuda conocida de
                      `specs/log.md`; darlo por cubierto con esto lo dejaba invisible. */
                   title={cell? `(${x},${y}) · ${cell.note} · grado ${cell.degree}` : `(${x},${y})`}
              >
                {/* La baldosa: el padding del contenedor hace la separacion y el
                    redondeo la forma. La celda ocupada se lee como una ficha y no
                    como un casillero, que es como se leen en la lamina.
                    El borde va NEGRO y en TODAS las baldosas, ocupadas o no: sobre
                    el panel blanco, un borde `slate-200` desaparecia y el tablero
                    no se veia. Es la celda la que se refuerza y no el fondo — el
                    tablero no se rellena, porque el fondo pintado le sacaba el
                    protagonismo a los 12 colores, que son los que tienen que
                    hablar. */}
                {/* `pb-2` y `leading-none` no son estetica: son lo que deja crecer la
                    nota. Lo que la limita NO es el ancho —a 19 px el nombre mas largo
                    de los 48 (`D#5`) mide 35,4 en 57 de baldosa, o sea 10,8 de aire
                    por lado— sino el `#N`, que esta anclado abajo mientras la nota se
                    centra en todo el alto: compiten por el mismo espacio y a 18 px
                    centrada ya se tocaban. Con la nota centrada en el alto que el `#N`
                    no usa, los 19 px entran con 2,3 px de separacion medidos.

                    El `pb` no mueve el `#N`: un absolute se posiciona contra la caja
                    de PADDING del contenedor, asi que el padding no lo empuja. */}
                <div style={style}
                     className={`relative w-full h-full rounded-lg border border-slate-900 flex items-center justify-center pb-2 text-[19px] leading-none font-semibold tabular-nums ${tone}`}>
                  {/* El grado va como el indice que devuelve el dominio (0..4) y sin
                      renumerar: lo que se lee en la celda es exactamente lo que
                      responden los tests y el MCP server. El `#` y la esquina
                      inferior derecha son de la lamina. */}
                  {cell && <span className="absolute bottom-0.5 right-1.5 text-[13px] font-normal leading-tight opacity-70">#{cell.degree}</span>}
                  {cell?.note ?? ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import type { CSSProperties, MouseEvent, RefObject } from 'react';
import { occupantAt, occupantCellIndex } from '../domain/board.ts';
import { GRID_W, GRID_H } from '../domain/constants/board.constants.ts';
import type { Cell } from '../domain/types/transform.types.ts';
import type { PieceKey } from '../domain/types/pieces.types.ts';
import type { PlacedPiece } from '../domain/types/board.types.ts';
import { cellTextFor } from './cell-text.ts';
import type { CellText } from './types/cell-text.types.ts';
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
 * SU nota —la que le toca por su lugar en la forma—, con el PASO en chico en la
 * esquina (ver mas abajo: es el orden en que suena, no el grado). La letra de la
 * pieza, que era lo unico que se veia, deja de repetirse 5 veces.
 *
 * Las dos cosas que dice —la nota y el `#N`— las deriva `cell-text.ts`. Este archivo
 * no reimplementa ni un paso de esa cadena: la indexa.
 *
 * ```
 * occupantCellIndex → cellTextFor → { note, step }
 * ```
 *
 * La derivacion vive AFUERA y no en una funcion de este archivo porque es donde vivio
 * el bug del `#N`, y adentro de un `.tsx` no se podia testear:
 * `react-refresh/only-export-components` prohibe exportar algo que no sea el
 * componente. Sus dos reglas —el paso decide el NUMERO y el grado decide la NOTA, y
 * las dos se leen sobre la forma CANONICA por indice— estan escritas ahi, con sus
 * tests al lado. Repetirlas aca seria la segunda copia, que es el error que este
 * mismo arreglo saco de `cellsByPlayOrder`.
 *
 * ## El numero de la esquina es el PASO, no el grado
 *
 * Lo que se pinta abajo a la derecha es la posicion de la celda en el ORDEN DE
 * REPRODUCCION (`playOrderByCellIndex`), asi que **el `#0` es siempre la celda por
 * donde el recorrido entra a la pieza y la numeracion sube hasta el `#4`, que es
 * siempre por donde sale** — en las 12 piezas y en las dos reflexiones.
 *
 * Antes se pintaba el GRADO, que es el mismo numero solo mientras no haya reflexion:
 * con `mirror` la primera nota que suena es la del grado 4, asi que la cabeza lectora
 * entraba por el `#4` y contaba hacia atras. Medido sobre `L`/0/reflejada en (1,1):
 * entraba por [0,0], que decia `#4`. El numero no mentia —era el grado— pero la
 * pregunta que la celda contesta de hecho, desde que el 010 puso una cabeza lectora
 * encima, es "cuando suena esta", no "que lugar ocupa en la escala".
 *
 * El fantasma dice EXACTAMENTE lo mismo que va a decir la celda una vez colocada:
 * misma nota, mismo paso, misma llamada a `cellTextFor` — la unica diferencia es de
 * donde salen la pieza, la rotacion y la reflexion (`selected`/`rotation`/`mirror` en vez
 * de `occ`). La reflexion tiene que llegar hasta aca justamente por el paso: sin ella
 * el fantasma prometeria una numeracion y la pieza colocada mostraria la inversa.
 * Mostrar ahi la letra repetida cinco veces, que es lo que hacia antes, dejaba al
 * fantasma hablando el idioma que este tablero dejo de hablar.
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
 * Cada celda de `CELL_PX` contiene una BALDOSA redondeada con 2 px de aire alrededor,
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
  /** La reflexion del fantasma. Solo mueve el `#N`: la nota de una celda no la
      cambia la reflexion, el orden en que suenan si. */
  mirror: boolean;
  /** El `altKey` cruza porque `Alt`+click MUTEA en vez de colocar o quitar (spec 014):
      el gesto no se puede decidir sin el, y el `onClick` de la celda no pasaba el evento. */
  onCellClick: (x: number, y: number, altKey: boolean) => void;
  onCellEnter: (cell: Cell) => void;
  onMouseLeave: () => void;
  /** La celda bajo el cursor esta ocupada por la pieza que esta en la mano, o sea que el
      click va a EDITARLA. Llega calculado por la misma pura que decide el click
      (`esLaPiezaEnLaMano`), y no derivado aca: dos copias de esa condicion serian dos
      formas de que el cursor prometa una cosa y el click haga otra. */
  hoverEdita: boolean;
  /** El boton derecho sobre el tablero alterna la reflexion (spec 013). Handler y no
      logica: quien decide si el evento cuenta es `App.tsx` con `reflejaElContextMenu`. */
  onContextMenu: (e: MouseEvent<HTMLDivElement>) => void;
  /** El nodo al que `App.tsx` le engancha la rueda. Este componente lo CUELGA y no lo
      lee: el `ref` se crea alla, asi que aca no hay ni estado ni efecto. */
  boardRef: RefObject<HTMLDivElement | null>;
}

export default function Board({
  placed, previewCells, previewValid, hover, selected, rotation, mirror,
  onCellClick, onCellEnter, onMouseLeave, hoverEdita, onContextMenu, boardRef,
}: Props) {
  // Que celda del fantasma cae en (x,y), POR INDICE: es lo que permite pedirle su
  // texto al mapeo canonico. Se arma una vez por render y no una vez por celda.
  const ghostIndexAt = new Map(previewCells.map(([x, y], k) => [`${x},${y}`, k]));

  // `md:col-span-8` desde el spec 014, cuando murio `PlacedList` y quedaron dos columnas
  // libres. El reparto —una para el tablero y otra para la paleta— esta MEDIDO en el DOM
  // y no elegido, y lo que lo decide es que a partir de ocho columnas cambia quien limita.
  // La tabla es la medicion que DECIDIO el reparto, tomada con la paleta de ENTONCES
  // (429,6 px de alto): su ultima columna no es el `CELL_PX` de hoy, que es 73 y sale
  // del parrafo de abajo.
  //
  //   reparto   interior del tablero   por ancho   por alto   CELL_PX
  //   3 / 7        633,3 × 429,6          63,3       71,6       63  (lo limita el ancho)
  //   4 / 8        730,7 × 429,6          73,1       71,6       71  (lo limita el ALTO)
  //   3 / 9        828,0 × 429,6          82,8       71,6       71  (lo limita el ALTO)
  //
  // O sea que la novena columna no le compra al tablero un solo pixel: los dos repartos
  // que la incluyen dan 71. Por eso la segunda columna va a la paleta, que la necesita
  // para el spec 016 — su interior pasa de 252 a 349,3 px.
  //
  // El alto de la tarjeta lo fija la PALETA, que es la mas alta de la fila; el tablero se
  // estira con ella — y el spec 016 lo EJERCIO. Con las doce miniaturas la paleta paso de
  // 461,6 a 496 px de caja, el interior del tablero a 730,7 × 464 y `CELL_PX` a **73**,
  // que es el techo por ancho de este reparto (730,7 / 10). Ahi se detiene: pasado ese
  // punto lo que la paleta crezca ya no agranda el tablero, le deja aire muerto. El
  // detalle de la cadena entera esta en el docblock de `CELL_PX`.
  return (
    <div className="col-span-12 md:col-span-8 bg-white rounded-2xl shadow p-4">
      {/* `overflow-x-auto` y no un `CELL_PX` mas chico: la grilla mide 10 × 73 =
          730 px FIJOS y no se encoge, y abajo del breakpoint `md` el panel util
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
      {/* Los dos gestos del spec 013 enganchan ACA y no en el `.grid` de adentro ni en
          la tarjeta: este div cubre exactamente el area del tablero —incluida la franja
          que queda a la derecha cuando la grilla scrollea debajo de `md`— mientras que
          el `.grid` dejaria un borde muerto y la tarjeta se comeria el `p-4`.

          Entran distinto y la asimetria esta medida, no elegida: React registra sus
          listeners en el contenedor raiz y a `touchstart`, `touchmove` y `wheel` los
          registra PASIVOS (react-dom 19.1.1), y adentro de un listener pasivo
          `preventDefault()` es un no-op que el navegador avisa por consola. O sea que un
          `onWheel` de JSX rotaria sin frenar el scroll, que es la falla mas cara: parece
          que anda. Por eso la rueda va por `addEventListener(..., { passive: false })`
          desde `App.tsx`, y lo unico que llega aca es el `ref` del nodo. `contextmenu`
          no esta entre esos tres nombres, asi que el boton derecho si puede ir por prop. */}
      <div ref={boardRef} className="relative overflow-x-auto" onContextMenu={onContextMenu}>
        <Playhead />
        <div
          className="grid w-max"
          style={{ gridTemplateColumns: `repeat(${GRID_W}, ${CELL_PX}px)` }}
          onMouseLeave={onMouseLeave}
        >
          {Array.from({ length: GRID_W * GRID_H }, (_, i) => {
            const x = i % GRID_W; const y = Math.floor(i / GRID_W);
            const occ = occupantAt(placed, x, y);
            const ghostIndex = ghostIndexAt.get(`${x},${y}`);
            const ghost = ghostIndex !== undefined;

            // De (x,y) a la nota, encadenando puras. La celda ocupada la pide por
            // `occupantCellIndex` —`occupantAt` ya garantizo que la pieza la cubre,
            // asi que el indice nunca es -1— y la del fantasma la trae puesta, que
            // es para lo que `previewCells` llega ordenado.
            let cell: CellText | null = null;
            if (occ) cell = cellTextFor(occ.piece, occ.rotation, occ.mirror)[occupantCellIndex(occ, x, y)];
            else if (ghostIndex !== undefined) cell = cellTextFor(selected, rotation, mirror)[ghostIndex];

            // El color de pieza es IDENTIDAD y pierde contra cualquier ESTADO: el
            // choque, el fantasma y el hover se pintan igual que antes. Por eso el
            // estilo inline —que le gana a cualquier clase— solo se arma en la celda
            // ocupada y libre de fantasma; en las demas el fondo sigue viniendo de
            // una clase de Tailwind.
            let tone: string;
            const style: CSSProperties = {};
            if (occ && ghost) tone = 'bg-rose-500 text-white';   // choque contra pieza colocada
            // La pieza MUTEADA cae al blanco de una celda libre y conserva su nota y su
            // `#N` (spec 014). El canal es la AUSENCIA de color y no uno de los dos
            // obvios, porque los dos estaban tomados: el color es IDENTIDAD de pieza y
            // esta medido en contraste contra su propio `fg`, y la opacidad la usa
            // `Playhead` para el velo de "esta celda no se estreno" — si muteado tambien
            // atenuara, una pieza muteada recien colocada seria indistinguible de una
            // esperando su turno.
            //
            // Sin `style.color`: el texto hereda el gris del tablero. `PIECE_COLOR[p].fg`
            // esta elegido contra el `bg` de SU pieza, asi que sobre blanco varios son
            // ilegibles y algunos directamente blancos.
            //
            // No se confunde con una celda libre porque una celda libre no tiene texto:
            // es la misma distincion que ya separa a una libre de una del fantasma.
            else if (occ && occ.muted) tone = 'bg-white shadow-sm';
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
            else if (ghost) tone = previewValid ? 'bg-slate-300' : 'bg-rose-300';
            else tone = 'bg-white hover:bg-slate-100';

            return (
              <div key={i}
                onClick={(e) => onCellClick(x, y, e.altKey)}
                onMouseEnter={() => onCellEnter([x, y])}
                style={{ width: CELL_PX, height: CELL_PX }}
                /* `hoverEdita` entra al cursor: sobre una celda propia la jugada de
                   COLOCAR es invalida —la pieza se choca consigo misma— pero el click no
                   coloca, borra. Sin esto el cursor diria "aca no entra" justo donde el
                   gesto es destructivo, que es lo contrario de lo que pasa. */
                className={`p-0.5 ${previewValid || !hover || hoverEdita ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                /* El title dice las tres cosas de la celda, no solo su coordenada: la
                   nota entra en la baldosa pero el paso va abreviado a `#3`, y sobre
                   el fantasma las dos son lo que decide la jugada. Sale del MISMO
                   `cell` que se pinta, asi que no puede decir una nota y mostrar otra.
                   NO es accesibilidad: la celda es un `div` con `onClick` y sin
                   `role`, sin `tabIndex` y sin nombre accesible, y un `title` sobre un
                   elemento generico que no recibe foco no lo anuncia ningun lector de
                   pantalla — es un tooltip de mouse y nada mas. El hueco real (la
                   celda no se alcanza con el teclado) esta en Deuda conocida de
                   `specs/log.md`; darlo por cubierto con esto lo dejaba invisible. */
                title={cell ? `(${x},${y}) · ${cell.note} · paso ${cell.step}` : `(${x},${y})`}
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
                  {/* El paso va como el indice que devuelve el dominio (0..4) y sin
                      renumerar: lo que se lee en la celda es exactamente lo que
                      responden los tests y el `playOrder` del MCP server. El `#` y la
                      esquina inferior derecha son de la lamina. */}
                  {cell && <span className="absolute bottom-0.5 right-1.5 text-[13px] font-normal leading-tight opacity-70">#{cell.step}</span>}
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

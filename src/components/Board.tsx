import type { CSSProperties, FocusEvent, KeyboardEvent, MouseEvent, RefObject } from 'react';
import { occupantAt, occupantCellIndex } from '../domain/board.ts';
import { GRID_W, GRID_H } from '../domain/constants/board.constants.ts';
import type { Cell } from '../domain/types/transform.types.ts';
import type { PieceKey } from '../domain/types/pieces.types.ts';
import type { PlacedPiece } from '../domain/types/board.types.ts';
import type { RegimenDeRotacion } from '../domain/types/music.types.ts';
import { cellTextFor } from './cell-text.ts';
import { cellNameFor } from './cell-name.ts';
import type { CeldaOcupada } from './cell-name.ts';
import type { CellText } from './types/cell-text.types.ts';
import { CELL_PX, ANILLO_FOCO_CLARO, ANILLO_FOCO_OSCURO } from './constants/layout.constants.ts';
import { PIECE_COLOR } from './constants/palette.constants.ts';
import Playhead from './Playhead.tsx';

/**
 * Panel central: la grilla del tablero con el fantasma de previsualizacion.
 *
 * Presentacional: sin estado, sin efectos — y desde el spec 026 con una sola linea
 * imperativa, el `.focus()` con el que las flechas mueven el cursor. No la contradice:
 * cambiar el `tabIndex` no mueve el foco del DOM, asi que sin esa llamada el `0` y el foco
 * real se separan a la primera flecha. Es React pidiendole foco a un nodo que React
 * renderiza, no estado escondido — quien decide DONDE esta el cursor sigue siendo el shell,
 * y llega por `hover` como llegaba con el mouse.
 *
 * El fantasma llega calculado
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
  /** Que hace la rotacion (spec 017). Baja como prop porque `cellTextFor` se llama
      ACA y no en `App.tsx`, y sin el las celdas mostrarian las notas del otro regimen:
      la mitad visible de AC7. Vale para las dos llamadas —la pieza colocada y el
      fantasma—, que es lo que hace que el fantasma prometa lo que la pieza va a decir. */
  regimen: RegimenDeRotacion;
  /** El `altKey` cruza porque `Alt`+click MUTEA en vez de colocar o quitar (spec 014):
      el gesto no se puede decidir sin el, y el `onClick` de la celda no pasaba el evento. */
  onCellClick: (x: number, y: number, altKey: boolean) => void;
  onCellEnter: (cell: Cell) => void;
  onMouseLeave: () => void;
  /** El foco del DOM esta adentro del tablero. Es lo unico que `hover` no puede contestar
      solo —el mouse tambien lo escribe— y es lo que decide si se pinta el anillo: sin el,
      el anillo de foco aparecia bajo el cursor del mouse, que no tiene foco ninguno. */
  focoEnTablero: boolean;
  /** El foco entro a una celda, o se fue del tablero (`null`). Una sola prop para las dos
      mitades porque son el mismo hecho contado dos veces, y del lado del shell las dos
      lineas que la atienden son las mismas: `hover` pasa a valer lo que llegue —la celda
      enfocada ES el cursor, y al salir se apaga— y `focoEnTablero`, si llego algo. */
  onFoco: (celda: Cell | null) => void;
  /** La celda bajo el cursor esta ocupada por la pieza que esta en la mano, o sea que el
      click va a EDITARLA. Llega calculado por la misma pura que decide el click
      (`esLaPiezaEnLaMano`), y no derivado aca: dos copias de esa condicion serian dos
      formas de que el cursor prometa una cosa y el click haga otra. */
  hoverEdita: boolean;
  /** El boton derecho sobre el tablero alterna la reflexion (spec 013). Handler y no
      logica: quien decide si el evento cuenta es `App.tsx` con `reflejaElContextMenu`. */
  onContextMenu: (e: MouseEvent<HTMLDivElement>) => void;
  /** El nodo al que `useRuedaRota` (`components/use-input.ts`) le engancha la rueda.
      Este componente lo CUELGA y no lo lee: el `ref` se crea en `App.tsx`, que es quien
      compone los dos hooks de entrada, asi que aca no hay ni estado ni efecto. */
  boardRef: RefObject<HTMLDivElement | null>;
}

export default function Board({
  placed, previewCells, previewValid, hover, selected, rotation, mirror, regimen,
  onCellClick, onCellEnter, onMouseLeave, focoEnTablero, onFoco, hoverEdita, onContextMenu,
  boardRef,
}: Props) {
  // Que celda del fantasma cae en (x,y), POR INDICE: es lo que permite pedirle su
  // texto al mapeo canonico. Se arma una vez por render y no una vez por celda.
  const ghostIndexAt = new Map(previewCells.map(([x, y], k) => [`${x},${y}`, k]));

  // El ancla del roving tabindex: el tablero es UNA parada de tabulacion, asi que una sola
  // celda lleva `tabIndex={0}` y las otras 59 `-1`. Es la celda del cursor, que es `hover`
  // —el mismo estado que escriben el mouse y el foco—, y con el cursor apagado la (0,0),
  // para que `Tab` siga teniendo por donde entrar. Sin esa segunda mitad el tablero
  // quedaria fuera del orden de tabulacion hasta que alguien lo tocara con el mouse.
  const [cursorX, cursorY] = hover ?? [0, 0];

  // Las teclas de la celda enfocada. Van en el `onKeyDown` de la propia celda y no en el
  // listener global de `use-input.ts` porque necesitan saber CUAL celda tiene el foco, que
  // es exactamente lo que un listener de `window` no sabe. Lo unico que el hook global
  // pone de su lado es no contestar la barra cuando el foco esta sobre una celda
  // (`targetEsCelda`), asi que un solo golpe no edita Y alterna el transporte.
  const alTeclear = (e: KeyboardEvent<HTMLDivElement>, x: number, y: number) => {
    // `Enter` y `Espacio` llaman al MISMO `onCellClick` que el `onClick`, con los mismos
    // tres argumentos: la regla de que hace cada gesto vive en `accionDeClick` y desde
    // aca no se escribe una segunda vez. Por eso `Alt` sale gratis —mutear y colocar
    // muteada son lo que esa pura ya contesta con `altKey`— y por eso el dia que `Alt`
    // cambie de significado el teclado lo hereda sin que nadie se acuerde de tocarlo: es
    // lo que hace que la tabla del spec no sea una promesa.
    //
    // `Alt`+`Espacio` en Windows lo intercepta el menu de ventana del SISTEMA y puede no
    // llegar nunca a la pagina; `Alt`+`Enter` es la via garantizada y es la que hay que
    // documentar. Las dos combinaciones quedan escritas —el navegador que si las entregue
    // las va a ejecutar— y la comprobacion en una ventana real queda [M]. Mismo trato que
    // el `Ctrl`+click de macOS que el spec 013 documento en vez de fingir que no existe.
    //
    // Sin `preventDefault` para la barra: su default —scrollear la pagina— ya lo frena
    // `frenaElDefault` desde el listener global, que a proposito NO se veta con
    // `targetEsCelda` justamente para cubrir este caso. Repetirlo aca seria la segunda
    // copia de esa decision.
    if (e.key === 'Enter' || e.key === ' ') { onCellClick(x, y, e.altKey); return; }

    let destinoX = x; let destinoY = y;
    switch (e.key) {
      case 'ArrowLeft': destinoX = x - 1; break;
      case 'ArrowRight': destinoX = x + 1; break;
      case 'ArrowUp': destinoY = y - 1; break;
      case 'ArrowDown': destinoY = y + 1; break;
      // `Home` y `End` no tocan `destinoY`: van a la primera y a la ultima celda de SU
      // fila, que es lo que el patron `grid` de ARIA reserva para el par sin modificador.
      case 'Home': destinoX = 0; break;
      case 'End': destinoX = GRID_W - 1; break;
      default: return;
    }
    // Frena el default SIEMPRE, tambien en el borde donde el destino termina siendo la
    // misma celda: sin esto la flecha scrollea la pagina Y el `overflow-x-auto` del
    // tablero. Mismo trato que la rueda y por el mismo motivo.
    e.preventDefault();
    // Se ACOTA en vez de salir por un `if`: en el borde la flecha deja el foco donde
    // estaba, que es lo que pide "sin salirse de la grilla", y de paso no agrega cuatro
    // ramas que solo se pueden ejercer desde los cuatro bordes.
    const dx = Math.min(GRID_W - 1, Math.max(0, destinoX));
    const dy = Math.min(GRID_H - 1, Math.max(0, destinoY));
    // Cambiar el `tabIndex` NO mueve el foco del DOM: sin este `.focus()` el `0` y el foco
    // real se separan a la primera flecha. Es React pidiendole foco a un nodo que React
    // renderiza —no el loop tocando lo ajeno—, y el nodo se alcanza desde el evento y no
    // por un `ref` porque las celdas van con `key={i}` y SIN refs ni `data-*`, para que el
    // bucle de `Playhead` no tenga handle. El rol es el selector porque es lo que la celda
    // le promete al lector de pantalla: nadie lo saca en un refactor de estilos.
    //
    // El `!` porque el ancestro existe por construccion —este handler cuelga de un nodo
    // que este mismo archivo renderiza adentro del `role="grid"`— y la alternativa, un
    // `if` que devuelva temprano, seria una rama inalcanzable, o sea cobertura imposible.
    //
    // El `.focus()` es sincronico y el destino todavia tiene `tabIndex={-1}`, porque React
    // re-renderiza despues del handler. No importa: `-1` es enfocable por script, solo no
    // por `Tab`. El `onFocus` de la celda destino es el que corre el cursor, y con el
    // cursor corrido el `0` lo sigue en el render siguiente.
    const grilla = e.currentTarget.closest('[role="grid"]')!;
    grilla.querySelectorAll<HTMLElement>('[role="gridcell"]')[dy * GRID_W + dx].focus();
  };

  // El foco se fue del tablero, o solo salto de una celda a otra. `relatedTarget` es quien
  // lo recibe, y `contains` distingue los dos casos: sin esa pregunta cada flecha apagaria
  // el cursor a mitad de camino, porque mover el foco es siempre un `blur` seguido de un
  // `focus`. React registra este handler como `focusout`, que burbujea, asi que uno solo en
  // el contenedor cubre las 60 celdas.
  const alSalirElFoco = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) onFoco(null);
  };

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
          desde `use-input.ts`, y lo unico que llega aca es el `ref` del nodo. `contextmenu`
          no esta entre esos tres nombres, asi que el boton derecho si puede ir por prop. */}
      <div ref={boardRef} className="relative overflow-x-auto" onContextMenu={onContextMenu}>
        <Playhead />
        {/* FILAS DE VERDAD y no `display: contents` sobre filas ficticias. `role="grid"`
            exige `role="row"`, y hasta el spec 026 esto eran 60 hijos planos dentro de un
            solo CSS grid. La tecnica de mantener el DOM plano y poner `display: contents`
            en el envoltorio tiene historial de SACAR el nodo del arbol de accesibilidad en
            varios navegadores — o sea que fallaria en silencio, solo en algunos, y
            justamente en lo que este spec viene a arreglar. Seis filas reales de diez
            celdas, sin `gap`, layout identico al pixel.

            Por eso el `gridTemplateColumns` se MUDO del contenedor a la fila: las diez
            columnas estaban donde los hijos eran las 60 celdas, y ahora los hijos son
            seis. Dejarlo arriba pondria seis filas dentro de una grilla de diez columnas,
            que es el pixel que AC11 prohibe. El contenedor sigue siendo grid con su
            columna implicita —una fila por renglon, ancho de contenido— y conserva el
            `w-max` del que depende el `overflow-x-auto`.

            `Playhead` no se entera: se posiciona con `transform` en pixeles contra el
            contenedor posicionado, no con colocacion de grid. */}
        <div
          className="grid w-max"
          role="grid"
          aria-label={`Tablero de ${GRID_W} por ${GRID_H}`}
          aria-rowcount={GRID_H}
          aria-colcount={GRID_W}
          onMouseLeave={onMouseLeave}
          onBlur={alSalirElFoco}
        >
          {Array.from({ length: GRID_H }, (_, fila) => (
          <div
            key={fila}
            role="row"
            className="grid"
            style={{ gridTemplateColumns: `repeat(${GRID_W}, ${CELL_PX}px)` }}
          >
          {Array.from({ length: GRID_W }, (_, columna) => {
            const i = fila * GRID_W + columna;
            const x = columna; const y = fila;
            const occ = occupantAt(placed, x, y);
            const ghostIndex = ghostIndexAt.get(`${x},${y}`);
            const ghost = ghostIndex !== undefined;

            // De (x,y) a la nota, encadenando puras. La celda ocupada la pide por
            // `occupantCellIndex` —`occupantAt` ya garantizo que la pieza la cubre,
            // asi que el indice nunca es -1— y la del fantasma la trae puesta, que
            // es para lo que `previewCells` llega ordenado.
            //
            // `ocupada` se arma en la MISMA rama y no despues, y eso es lo que deja al
            // fantasma afuera del nombre accesible sin un `if` que alguien tenga que
            // acordarse de escribir: `piece` y `muted` solo existen si hay `occ`, asi que
            // la celda con fantasma llega a `cellNameFor` como `null`, igual que una
            // libre. El argumento largo esta en el docblock de `CeldaOcupada`. De paso,
            // armarlo aca adentro es lo que evita un `!` sobre `cell`: TypeScript ya sabe
            // que en esta rama no es null.
            let cell: CellText | null = null;
            let ocupada: CeldaOcupada | null = null;
            if (occ) {
              cell = cellTextFor(occ.piece, occ.rotation, occ.mirror, regimen)[occupantCellIndex(occ, x, y)];
              ocupada = { piece: occ.piece, muted: occ.muted, cell };
            } else if (ghostIndex !== undefined) {
              cell = cellTextFor(selected, rotation, mirror, regimen)[ghostIndex];
            }

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

            // El anillo de foco va en la caja de AFUERA —esta, la de `CELL_PX`— y no en la
            // baldosa redondeada de adentro, porque a la baldosa no le queda un solo canal
            // libre: el color de fondo es identidad de pieza, el blanco es muteada, el
            // rosa es jugada invalida, el `slate-300` es el fantasma, el grosor de borde es
            // la cabeza lectora y la opacidad mas el borde punteado son el velo de "no se
            // estreno". La caja de afuera no pinta nada, asi que ahi entra el foco — y con
            // eso se acabaron: el proximo estado va a tener que sacarle el canal a otro.
            //
            // Y lo PROHIBIDO es `transform: scale`, que es lo obvio para agrandar la celda
            // enfocada: `scale` cuenta para el overflow SCROLLEABLE del contenedor, asi que
            // le haria aparecer las dos barras de desplazamiento al `overflow-x-auto` de
            // arriba. Esta medido en el repo, y no aca sino en el docblock de
            // `components/constants/playhead.constants.ts`, que lo pago para la cabeza
            // lectora: con la cabeza en (9,5) y `scale(1.10)` el `scrollHeight` pasaba de
            // 378 a 381. `outline` y `box-shadow` son ink overflow — pintan sin agrandar.
            //
            // Va por estilo inline y no por clase porque los dos anchos salen de una
            // constante, y Tailwind escanea el fuente: un `outline-[${N}px]` interpolado no
            // se generaria. El reparto de las dos bandas esta en `layout.constants.ts`.
            const caja: CSSProperties = { width: CELL_PX, height: CELL_PX };
            if (focoEnTablero && x === cursorX && y === cursorY) {
              caja.boxShadow = `inset 0 0 0 ${ANILLO_FOCO_OSCURO}px #0f172a`;
              caja.outline = `${ANILLO_FOCO_CLARO}px solid #fff`;
              caja.outlineOffset = `-${ANILLO_FOCO_OSCURO + ANILLO_FOCO_CLARO}px`;
            }

            return (
              <div key={i}
                role="gridcell"
                /* Roving tabindex: el `0` viaja con el cursor y las otras 59 celdas quedan
                   en `-1`, asi que el tablero es UNA parada de tabulacion y no sesenta.
                   Sesenta convertirian la tarjeta en una trampa de salida: todo lo que
                   venga detras del tablero quedaria a sesenta pulsaciones, y el
                   `Shift`+`Tab` de vuelta costaria lo mismo. */
                tabIndex={x === cursorX && y === cursorY ? 0 : -1}
                onClick={(e) => onCellClick(x, y, e.altKey)}
                onKeyDown={(e) => alTeclear(e, x, y)}
                /* El foco escribe el MISMO cursor que el mouse, y por eso el fantasma, la
                   validez y `hoverEdita` funcionan con teclado sin una linea de dibujo
                   nueva. Va en la celda y no en el contenedor porque el nombre del hecho es
                   "el foco esta en ESTA celda". */
                onFocus={() => onFoco([x, y])}
                /* Con el tablero enfocado el mouse NO escribe el cursor: manda el foco
                   (AC16). Es la misma regla que hace que sacar el mouse de la grilla no
                   apague el fantasma, dicha del otro lado — un solo cursor, y mientras el
                   teclado lo tiene el mouse queda inerte hasta que se sale con `Tab` o se
                   clickea (el click enfoca la celda, asi que el cursor lo sigue igual).

                   La alternativa era que el mouse ARRASTRARA el foco —`focus()` sobre la
                   celda que entra— para que el anillo y el fantasma no se separaran nunca.
                   Se escribio asi primero y se cayo MEDIDO: `mouseenter` no lo dispara solo
                   mover el mouse, tambien lo dispara cualquier SCROLL, porque el navegador
                   recalcula que hay debajo del puntero quieto. Con el foco adentro, cada
                   `.focus()` de una flecha que scrollea el tablero un pixel devolvia el foco
                   a la celda que quedaba bajo el mouse: en el test de las flechas el cursor
                   saltaba de (5,2) a (4,0) sin que nadie tocara el mouse. Un salto de foco
                   silencioso es exactamente lo que este repo persigue, y el anillo separado
                   del fantasma no puede pasar por este camino porque el mouse ya no mueve
                   ninguno de los dos. */
                onMouseEnter={() => { if (!focoEnTablero) onCellEnter([x, y]); }}
                style={caja}
                aria-label={cellNameFor(x, y, ocupada)}
                /* `hoverEdita` entra al cursor: sobre una celda propia la jugada de
                   COLOCAR es invalida —la pieza se choca consigo misma— pero el click no
                   coloca, borra. Sin esto el cursor diria "aca no entra" justo donde el
                   gesto es destructivo, que es lo contrario de lo que pasa. */
                /* El `rounded-lg` no pinta nada —esta caja no tiene fondo ni borde— y esta
                   solo para el anillo: `outline` y `box-shadow` siguen el radio del
                   elemento, asi que sin el, el anillo saldria cuadrado alrededor de una
                   baldosa redondeada. Repite el `rounded-lg` de la baldosa a proposito: es
                   la misma forma dicha dos veces sobre el mismo objeto. Con el foco afuera
                   no cambia un pixel. */
                className={`p-0.5 rounded-lg ${previewValid || !hover || hoverEdita ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                /* El title dice las tres cosas de la celda, no solo su coordenada: la
                   nota entra en la baldosa pero el paso va abreviado a `#3`, y sobre
                   el fantasma las dos son lo que decide la jugada. Sale del MISMO
                   `cell` que se pinta, asi que no puede decir una nota y mostrar otra.
                   Desde el spec 026 ES accesibilidad, y por eso dejo de ser lo unico: la
                   celda es un `role="gridcell"` con `tabIndex` y con `aria-label`, o sea
                   que recibe foco y tiene nombre. El `title` pasa a ser el ECO de ese
                   nombre —el canal del mouse, mas corto porque el ojo ya ve el color y la
                   forma— y el nombre completo, con la coordenada en prosa y el `de 4` del
                   paso, es el que anuncia el lector de pantalla al entrar el foco.
                   Los dos numeros del paso son el MISMO indice del dominio, sin renumerar,
                   justamente para que el tooltip no diga `paso 1` sobre una celda que
                   pinta `#0`. Hasta este spec este parrafo decia lo contrario y remitia a
                   una deuda que ya no existe: el hueco del teclado estaba anotado en
                   `specs/deuda.md` —no en `specs/log.md`, como decia— y lo cerro este
                   mismo spec. */
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
          ))}
        </div>
      </div>
    </div>
  );
}

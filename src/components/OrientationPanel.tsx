import { SHAPES } from '../domain/constants/pieces.constants.ts';
import type { PieceKey } from '../domain/types/pieces.types.ts';
import { MINI_BOX, MINI_CELL_PX } from './constants/layout.constants.ts';
import { PIECE_COLOR } from './constants/palette.constants.ts';
import { miniCells } from './piece-mini.ts';
import type { PropsDeOrientacion } from './types/panel.types.ts';

/**
 * Las doce miniaturas, cada una en la orientacion actual: elegir la pieza que va a la
 * mano (spec 016).
 *
 * Presentacional: sin estado, sin efectos. Recibe UN objeto —el de la orientacion— y
 * nada mas.
 *
 * Devuelve el mismo `div` de la grilla que tenia `PiecePalette` y no lo envuelve en
 * nada: es un hijo directo de la tarjeta, y agregarle un nodo cambiaria el ritmo
 * vertical con las clases intactas.
 */
export default function OrientationPanel({ orientacion }: { orientacion: PropsDeOrientacion }) {
  const { selected, rotation, mirror, onSelect } = orientacion;
  return (
    /* El ancho lo gobierna la caja de la miniatura, que mide 5 × `MINI_CELL_PX` = 40 px
       y **no depende ni de la pieza ni de la orientacion**: el peor caso es el mismo
       para las doce.

       La METRICA a mirar es el **padding efectivo**, `(pista - 42) / 2` con los 40 de la
       caja mas 2 de borde, y no el scroll: el `1fr` no produce scroll —el contenido se
       sale del PADDING del boton, que tiene `overflow: visible`— asi que un desborde no
       se ve como desborde sino como aire que desaparece. Es la metrica que atrapo el bug
       del esquema anterior; la cronica esta en `specs/revisiones.md`, pase de
       comentarios del 022.

       La premisa de la tabla es el INTERIOR de la tarjeta, que lo fija su
       `md:col-span-4` — el reparto de columnas esta argumentado en `PiecePalette.tsx`,
       y sin ese dato las cuatro filas de abajo no se pueden re-derivar. Medido en el DOM
       sobre todo el rango:

         viewport   tarjeta   interior   columnas   pista    padding
         375        12/12      319,0        6        46,5      2,3
         768         4/12      210,7        3        64,9     11,4
         1024        4/12      296,0        4        68,0     13,0
         1280+       4/12      349,3        6        51,5      4,8

       **Seis columnas NO andan a `md`**: ahi la tarjeta cae a 210,7 px de interior
       —el punto mas apretado de todo el rango— y la pista queda en 28,4, o sea
       **-6,8 px de padding efectivo**. Por eso el esquema es escalonado, con el
       ultimo escalon en `xl` y no en `lg`: a 1024 la tarjeta todavia mide 296 y seis
       columnas dejarian 0,35 px, que es positivo por casualidad y no por margen.

       Y seis arriba de todo tambien por el ALTO, que es lo que decide el layout de
       la fila entera: seis columnas son dos filas de botones en vez de tres, y la
       paleta es la tarjeta mas alta — lo que crezca de mas no agranda el tablero,
       le deja aire muerto. Ver el docblock de `MINI_CELL_PX`. */
    <div className="grid grid-cols-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
      {/* El fondo del boton NO toma el color de pieza: ese fondo es el canal de
          "seleccionada" y pintarlo dejaria a la paleta sin decir cual esta activa. La
          identidad entra por la FORMA, pintada del color de la pieza.

          Las celdas de la miniatura llevan borde: varios de los 12 colores (el amarillo
          de `V`, el lima de `F`) casi no se ven contra el gris claro del boton sin
          apoyarse, y ademas es el idioma del tablero desde el 007, donde todas las
          baldosas tienen borde por el mismo motivo. El color del borde se INVIERTE con el
          estado, y los numeros estan abajo, en la celda. Como se llego a esta forma —el
          punto de color que habia antes del 016— esta en `specs/revisiones.md`, pase de
          comentarios del 022.

          La letra se queda abajo y en chico. No es decoracion: es el vocabulario con
          el que se habla de las piezas en `describe_piece`, en el `title` del tablero
          y en `DESIGN.md`, y ademas es el unico nombre accesible que el boton tenia
          —una forma dibujada con `div`s no tiene ninguno—. El `aria-label` dice
          tambien la orientacion, para que el lector de pantalla diga lo que el ojo
          ve: la miniatura muestra la orientacion ACTUAL, no la canonica. */}
      {(Object.keys(SHAPES) as PieceKey[]).map(key=> {
        const celdas = miniCells(key, rotation, mirror);
        const ocupada = new Set(celdas.map(([x, y]) => `${x},${y}`));
        // Una sola copia de "es la que esta en la mano": la leen el fondo del boton,
        // el borde de la miniatura y el `aria-pressed`, y tienen que invertirse en el
        // mismo momento.
        const activo = selected === key;
        return (
          <button
            key={key}
            onClick={()=> onSelect(key)}
            aria-label={`${key}, rotación ${rotation * 90}°${mirror ? ', reflejada' : ''}`}
            aria-pressed={activo}
            className={`px-2 py-1 rounded-lg border text-sm flex flex-col items-center justify-center gap-1 ${activo? 'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}
          >
            {/* CINCO pistas fijas y no `min-content` ni `auto`: es lo que hace que el
                tamano de la caja no dependa de que celdas esten ocupadas, y por lo
                tanto que rotar no mueva un pixel de la grilla de botones. Con pistas
                automaticas la `I` sola haria saltar la fila entera entre 5 y 1
                celdas de ancho, que es el reflow que la caja fija existe para evitar.
                Va por estilo inline y no por clase porque el numero sale de una
                constante, y Tailwind escanea el fuente: `grid-cols-[repeat(5,8px)]`
                interpolado no se generaria. */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${MINI_BOX}, ${MINI_CELL_PX}px)`,
                gridTemplateRows: `repeat(${MINI_BOX}, ${MINI_CELL_PX}px)`,
              }}
            >
              {Array.from({ length: MINI_BOX * MINI_BOX }, (_, i) => {
                const x = i % MINI_BOX; const y = Math.floor(i / MINI_BOX);
                const llena = ocupada.has(`${x},${y}`);
                // Inline y no `bg-[...]`: una clase interpolada desde `PIECE_COLOR`
                // no la generaria Tailwind. La celda vacia queda transparente para
                // que se vea el fondo del boton, que es quien dice "seleccionada".
                //
                // El BORDE se INVIERTE con el estado del boton, y no es cosmetica:
                // en cada estado falla un conjunto distinto de piezas, y los dos
                // conjuntos son DISJUNTOS. Razon WCAG 2.1 medida contra los dos
                // fondos — aca aplica 1.4.11, objeto grafico con piso 3:1, y no el
                // APCA con el que `palette.constants.ts` elige el color de TEXTO:
                //
                //   contra `slate-100` (sin seleccionar): 7 de 12 bajo el piso, peor
                //     `V` con 1,02 — el amarillo sobre el gris claro no se ve
                //   contra `slate-900` (seleccionado): 1 de 12, `W` con 2,08 — el
                //     azul puro sobre el casi negro
                //
                // `slate-900` da 16,30 sobre el boton claro y rescata a las siete,
                // pero sobre el seleccionado da 1,00: es el MISMO color del fondo, o
                // sea que ahi el borde no existe y `W` se queda sola. Invertido a
                // `slate-400` da 6,96 sobre el oscuro. Un solo color no cubre los dos
                // estados: fijo en `slate-400` serian 2,34 sobre el claro, o sea las
                // siete apoyadas en un borde que tampoco llega al piso.
                return (
                  <div key={i}
                    className={llena ? (activo ? 'border border-slate-400' : 'border border-slate-900') : ''}
                    style={llena ? { background: PIECE_COLOR[key].bg } : undefined}
                  />
                );
              })}
            </div>
            <span className="text-xs leading-none">{key}</span>
          </button>
        );
      })}
    </div>
  );
}

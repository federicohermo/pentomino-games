import { midiName } from '../domain/music.ts';
import { SHAPES } from '../domain/constants/pieces.constants.ts';
import { CHROMATIC, BASE_MAP } from '../domain/constants/music.constants.ts';
import type { PieceKey } from '../domain/types/pieces.types.ts';
import { TEMPO_MIN, TEMPO_MAX, MINI_BOX, MINI_CELL_PX } from './constants/layout.constants.ts';
import { PIECE_COLOR } from './constants/palette.constants.ts';
import { miniCells } from './piece-mini.ts';

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
  playing: boolean;
  clicks: boolean;
  noteSet: readonly number[];
  onSelect: (piece: PieceKey) => void;
  onRotate: (rotation: number) => void;
  onMirror: () => void;
  onTempo: (bpm: number) => void;
  onTogglePlay: () => void;
  onToggleClicks: () => void;
  onReset: () => void;
}

export default function PiecePalette({
  selected, rotation, mirror, tempo, playing, clicks, noteSet,
  onSelect, onRotate, onMirror, onTempo, onTogglePlay, onToggleClicks, onReset,
}: Props) {
  // `md:col-span-4` desde el spec 014: al morir `PlacedList` quedaron dos columnas libres
  // y esta es una de las dos. La otra va al tablero, y el reparto sale MEDIDO y no
  // elegido: a partir de `md:col-span-8` el tablero deja de estar limitado por el ancho y
  // pasa a estarlo por el alto, asi que la novena columna no le compraria un solo pixel
  // (la tabla esta en `Board.tsx`). El interior de esta tarjeta pasa de 252 a 349,3 px,
  // que es donde el spec 016 va a meter las doce miniaturas.
  return (
    <div className="col-span-12 md:col-span-4 bg-white rounded-2xl shadow p-3">
      <h2 className="text-lg font-semibold mb-2">Piezas</h2>
      {/* El esquema de columnas se REMIDIO entero para el spec 016 y no se hereda: la
          cuenta anterior estaba hecha sobre la letra mas el punto de color, y ninguno
          de los dos gobierna ya el ancho. Hoy el que manda es la caja de la miniatura,
          que mide 5 × `MINI_CELL_PX` = 40 px y **no depende ni de la pieza ni de la
          orientacion** — asi que el peor caso dejo de ser el `W` y pasa a ser el mismo
          para las doce.

          Lo que si se hereda es la METRICA, que es la que atrapo el bug la vez pasada:
          el `1fr` no produce scroll —el contenido se sale del PADDING del boton, que
          tiene `overflow: visible`— asi que lo que hay que mirar es el **padding
          efectivo**, `(pista - 42) / 2` con los 40 de la caja mas 2 de borde. Con el
          esquema viejo llegaba a **-4,6 px a 768**, o sea la letra cruzando su propio
          borde, y eso no se ve como desborde sino como aire que desaparece.

          Medido en el DOM sobre todo el rango, con este commit puesto:

            viewport   tarjeta   interior   columnas   pista    padding
            375        12/12      319,0        6        46,5      2,3
            768         4/12      210,7        3        64,9     11,4
            1024        4/12      296,0        4        68,0     13,0
            1280+       4/12      349,3        6        51,5      4,8

          **Seis columnas NO andan a `md`**: ahi la tarjeta cae a 210,7 px de interior
          —es el punto mas apretado de todo el rango, igual que la vez pasada— y la
          pista queda en 28,4, o sea **-6,8 px de padding efectivo**. Por eso el
          esquema vuelve a ser escalonado, con el ultimo escalon en `xl` y no en `lg`:
          a 1024 la tarjeta todavia mide 296 y seis columnas dejarian 0,35 px, que es
          positivo por casualidad y no por margen.

          Y seis arriba de todo tambien por el ALTO, que es lo que decide el layout de
          la fila entera: seis columnas son dos filas de botones en vez de tres, y la
          paleta es la tarjeta mas alta — lo que crezca de mas no agranda el tablero,
          le deja aire muerto. Ver el docblock de `MINI_CELL_PX`. */}
      <div className="grid grid-cols-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        {/* El fondo del boton NO toma el color de pieza: ese fondo es el canal de
            "seleccionada" y pintarlo dejaria a la paleta sin decir cual esta activa.
            Eso no cambia — lo que cambia es donde entra la identidad.

            Hasta el spec 016 entraba como un punto de 8 px al costado de la letra.
            Con la forma pintada del color de la pieza, el punto decia lo mismo dos
            veces y se fue. Lo que SI se hereda es su borde: varios de los 12 colores
            (el amarillo de `V`, el lima de `F`) casi no se ven contra el gris claro
            del boton sin apoyarse, asi que las celdas de la miniatura lo llevan — que
            ademas es el idioma del tablero desde el 007, donde todas las baldosas
            tienen borde por el mismo motivo. Lo que NO se hereda es su color fijo:
            el punto vivia con `slate-400` porque tenia que verse sobre los dos fondos
            del boton, y la miniatura resuelve eso invirtiendo el borde con el estado.
            Los numeros estan abajo, en la celda.

            La letra se queda abajo y en chico. No es decoracion: es el vocabulario con
            el que se habla de las piezas en `describe_piece`, en el `title` del tablero
            y en `DESIGN.md`, y ademas es el unico nombre accesible que el boton tenia
            —una forma dibujada con `div`s no tiene ninguno—. El `aria-label` dice
            tambien la orientacion, para que el lector de pantalla diga lo que el ojo
            ve: la miniatura muestra la orientacion ACTUAL, no la canonica. */}
        {(Object.keys(SHAPES) as PieceKey[]).map(key=> {
          const celdas = miniCells(key, rotation, mirror);
          const ocupada = new Set(celdas.map(([x, y]) => `${x},${y}`));
          // Una sola copia de "es la que esta en la mano": la leen el fondo del boton
          // y el borde de la miniatura, y tienen que invertirse en el mismo momento.
          const activo = selected === key;
          return (
            <button
              key={key}
              onClick={()=> onSelect(key)}
              aria-label={`${key}, rotación ${rotation * 90}°${mirror ? ', reflejada' : ''}`}
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
        {/* El click MUDO del recorrido, con el mismo idioma que Reflexion: activo en
            oscuro. Es un interruptor de MEZCLA y no del modelo — el recorrido
            sigue siendo el mismo con los clicks apagados, solo que no se oye. El
            spec 009 lo previo asi en su tabla de riesgos ("es un parametro suelto:
            si molesta, se baja o se apaga sin tocar el modelo").

            Dijo "Clicks mudos" desde el spec 011 y hasta el 015, y el motivo de la
            palabra "mudos" SIGUE VALIENDO aunque la palabra se haya ido: el recorrido
            tiene DOS clases de cruce y este boton apaga solo una. El cruce sobre una
            celda ocupada suena su nota y no se apaga, porque es modelo y no mezcla
            (D6) — apagarlo seria silenciar parte de lo que el tablero dice. La
            etiqueta nueva tampoco puede prometer eso.

            Cambia por el default (D7 del 015). "Clicks mudos" con ON/OFF ya era
            retorcido —un click *mudo* que esta *encendido*— y con el default en OFF lo
            primero que se ve del control es un apagado que no se sabe si apaga el click
            o apaga el mute. La etiqueta nueva dice QUE SE OYE cuando esta encendido, en
            el idioma que el instrumento ya usa desde el 009: el recorrido, y la parte
            de el que pasa por celdas vacias. Y ademas ya no dice "click", que desde el
            015 tampoco es cierto: es una campana de altura fija.

            Y ojo con el motivo por el que nacio: existia para tapar los golpes sordos
            que produce cruzar una pieza, o sea el problema que el 011 arregla. Su
            `T070` propuso borrarlo por eso y quedo cerrado con un "no" en el 015: con
            el default apagado este boton es la unica forma de ENCENDER el recorrido,
            asi que borrarlo lo dejaria inalcanzable. La historia se conserva; lo que
            cambio es la conclusion. */}
        <div className="flex items-center justify-between">
          <span className="font-medium">Recorrido en el vacío</span>
          <button onClick={onToggleClicks} className={`px-3 py-1 rounded ${clicks?'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200'}`}>{clicks? 'ON':'OFF'}</button>
        </div>
        <div className="pt-2 text-sm text-slate-600">
          <p><b>{selected}</b> → tónica {CHROMATIC[BASE_MAP[selected]]}</p>
          {/* Las dos lineas van RESERVADAS, no dejadas al contenido: el largo de esta
              linea depende de cuantos sostenidos tenga la escala, que va de 0 a 5
              sobre las 48 combinaciones de pieza x rotacion, y al envolver movia
              todo lo que tiene debajo —Tempo, transporte, Reset— 20 px hacia abajo al
              cambiar de pieza O de rotacion. Un panel de control que se acomoda solo
              cuando lo tocas es el bug: el boton se corre justo cuando vas a apretarlo.

              Dos y no tres, medido sobre el peor string de los 48 (`F#4 · G#4 · A#4 ·
              C#5 · D#5`, 5 sostenidos: sale en `N` rot1, `U` rot0 y `Z` rot3): ocupa
              2 lineas desde 148 px de tarjeta —el interior a 768— hasta los 252 de
              `max-w-6xl` saturado. El salto existia solo en la banda mas ancha, que
              es la unica donde el mejor caso entra en una.

              `2lh` y no `min-h-10`: son los mismos 40 px hoy porque `text-sm` da 20
              de interlineado, pero atado a la fuente en vez de a un numero que habria
              que recordar actualizar. */}
          <p className="min-h-[2lh]">Notas actuales: {noteSet.map(m => midiName(m)).join(" · ")}</p>
        </div>
        <div className="mt-4 border-t pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">Tempo</span>
            <input type="range" min={TEMPO_MIN} max={TEMPO_MAX} value={tempo} onChange={e=>onTempo(parseInt(e.target.value))} />
            {/* Con la unidad: "110" a secas no dice si son bpm o intervalos, y desde el
                spec 008 el instrumento maneja las dos unidades. `w-16` y no `w-10`
                porque " bpm" agrega ~24 px; lo absorbe el `range`, que es el unico
                elemento elastico de la fila. `tabular-nums` mantiene el numero quieto
                al arrastrar, que es para lo que estaba el ancho fijo. */}
            <span className="tabular-nums w-16 text-right whitespace-nowrap">{tempo} <span className="text-slate-500">bpm</span></span>
          </div>
          {/* Un solo boton para el transporte: antes el checkbox decidia si sonaba y
              este boton arrancaba el reloj, y ninguno de los dos mostraba si el reloj
              corria. El icono es el estado —lo que se ve es lo que pasa al apretar— y
              el color lo repite para que se lea de un vistazo.

              Solo el icono, sin la palabra: ▶ y ⏸ son el vocabulario universal del
              transporte y no necesitan glosa. Medido, la etiqueta ademas no entraba:
              con "▶ Reproducir" el boton pedia 119 px de min-content contra los 148
              del interior de la tarjeta a 768 —el ancho mas apretado, el mismo que
              gobierna la grilla de piezas de arriba—, asi que junto a Reset (62 px +
              8 de gap) la fila desbordaba 23 px y el texto envolvia a dos lineas.
              Con el icono solo el boton mide 37,8 px, asi que en esos 148 sobran 40.

              `aria-label` porque al sacar el texto el boton se queda sin nombre
              accesible: el glifo no lo es. `title` para que el puntero tambien lo diga.

              Corriendo usa el `bg-slate-900 text-white` con el que la tarjeta marca lo
              activo en Rotacion y Reflexion: es el mismo idioma, aplicado al mismo
              concepto. En pausa NO cae a `bg-slate-100`, que es el "apagado" de esos
              dos, porque al lado tiene a Reset en `bg-slate-200`: el boton principal
              del instrumento quedaria indistinguible del secundario. Se queda con el
              verde que ya tenia, que ademas es lo que un transporte pide leer como
              "apreta esto para que suene". */}
          <div className="flex gap-2">
            <button
              onClick={onTogglePlay}
              aria-label={playing? 'Pausa':'Reproducir'}
              title={playing? 'Pausa':'Reproducir'}
              className={`px-3 py-1 rounded text-white ${playing? 'bg-slate-900 hover:bg-slate-800':'bg-emerald-600 hover:bg-emerald-700'}`}
            >{playing? '⏸':'▶'}</button>
            <button onClick={onReset} className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300">Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}

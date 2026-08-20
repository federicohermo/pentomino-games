import { useMemo, useState, useRef, useCallback } from "react";
import { playNow } from "./audio/engine.ts";
import { DEFAULT_BPM } from "./audio/constants/engine.constants.ts";
import { rotateN, reflect } from "./domain/transform.ts";
import { arpeggioFor } from "./domain/music.ts";
import { cellsAt, isValid, occupantAt } from "./domain/board.ts";
import { buildSequence } from "./domain/sequence.ts";
import { SHAPES, ANCHOR_INDEX } from "./domain/constants/pieces.constants.ts";
import { DEFAULT_REGIMEN } from "./domain/constants/music.constants.ts";
import type { Cell } from "./domain/types/transform.types.ts";
import type { PieceKey } from "./domain/types/pieces.types.ts";
import type { PlacedPiece } from "./domain/types/board.types.ts";
import type { RegimenDeRotacion } from "./domain/types/music.types.ts";
import PiecePalette from "./components/PiecePalette.tsx";
import Board from "./components/Board.tsx";
import Spectrum from "./components/Spectrum.tsx";
import { alternarTransporte } from "./components/motor.ts";
import { MOTOR, frenarTransporte, useMotorSincronizado } from "./components/use-motor.ts";
import { useAtajosDeTeclado, useRuedaRota } from "./components/use-entrada.ts";
import {
  rotacionPorRueda, reflejaElContextMenu, accionDeClick, esLaPiezaEnLaMano,
} from "./components/input.ts";
import { EDICION } from "./components/constants/input.constants.ts";

/**
 * Pentomino Music — prototipo de instrumento, no un juego con reglas de resolucion.
 *
 * El usuario coloca pentominos en un tablero de 10x6 y cada pieza dispara un
 * arpegio de cinco notas. Que pieza determina la tonica; la rotacion, una de dos cosas
 * segun el REGIMEN elegido (spec 017) —la formula de escala con `escala`, o por donde
 * arranca el arpegio con `orden`—; la reflexion el orden de las notas; y la posicion en
 * el tablero el orden de reproduccion: un circuito cerrado visita las piezas colocadas
 * por el camino mas corto entre ellas (spec 009, `domain/sequence.ts`), no por el orden
 * en que se fueron colocando.
 *
 * Este archivo es el shell: estado, derivados, handlers y la composicion — y desde el
 * spec 022, CERO efectos. La geometria, la musica y las reglas del tablero viven en
 * `src/domain/`; el sonido en `src/audio/`; el JSX, en los componentes de
 * `src/components/`; y el puente con el motor, en `components/use-motor.ts` (los cuatro
 * de reconciliacion) y `components/use-entrada.ts` (los dos de entrada del spec 013).
 *
 * Que los seis salieran de aca no fue prolijidad: en un `.tsx`
 * `react-refresh/only-export-components` prohibe exportar cualquier cosa que no sea el
 * componente, asi que nada de lo que viviera en este archivo podia testearse. Es el
 * mismo mecanismo por el que nacio `domain/`.
 *
 * Ver docs/architecture/modelo-musical.md y docs/architecture/audio.md.
 */

export default function App(){
  const [selected, setSelected] = useState<PieceKey>('F');
  const [rotation, setRotation] = useState<number>(0); // 0..3
  const [mirror, setMirror] = useState<boolean>(false);
  // Arranca del mismo numero que el motor: DEFAULT_BPM es una sola declaracion.
  const [tempo, setTempo] = useState<number>(DEFAULT_BPM);
  const [playing, setPlaying] = useState<boolean>(false);
  // Los clicks del recorrido arrancan APAGADOS, y con el default en `false` el botón de
  // la paleta es la única forma de ENCENDER el recorrido: por eso no se puede borrar.
  //
  // El default vive acá y en `clicksAudible` de `engine.ts`, que el efecto de
  // `use-motor.ts` pisa al montar. Los dos dicen `false`: el mismo valor declarado dos
  // veces no puede discrepar.
  //
  // Apaga solo esos: el cruce por celda ocupada suena su nota y no lo gobierna este
  // flag, porque es modelo y no mezcla (D6 del spec 011).
  //
  // El valor pasó por los dos estados y el argumento del que venía sigue siendo bueno:
  // la crónica está en `specs/revisiones.md`, entrada del pase de comentarios del 022.
  const [clicks, setClicks] = useState<boolean>(false);
  // Que hace la rotacion (spec 017). Arranca en `escala`, que es el de siempre: abrir
  // la app suena como sonaba (AC11). Es GLOBAL y no por pieza —D3—: por pieza, dos
  // piezas a 90° sonarian con reglas distintas y no habria forma de saber, mirando el
  // tablero, que hace girar una. Es una propiedad del instrumento, como el tempo.
  //
  // Vive aca y baja por props, sin Context ni singleton: el repo no tiene estado
  // global, y ademas es lo que hace que retirar uno de los dos regimenes cuando se
  // decida cual se queda sea borrar una rama en vez de desenredarla.
  const [regimen, setRegimen] = useState<RegimenDeRotacion>(DEFAULT_REGIMEN);

  // placed pieces
  const [placed, setPlaced] = useState<PlacedPiece[]>([]);

  // celda del tablero bajo el cursor, para el fantasma de previsualización
  const [hover, setHover] = useState<Cell | null>(null);

  const idRef = useRef(0);

  // El nodo del tablero, para colgarle la rueda. Se crea ACA y viaja a `Board` como una
  // prop mas: asi el componente no gana ni estado ni efectos (AC11 del spec 013).
  const boardRef = useRef<HTMLDivElement | null>(null);

  // Si el tap del modificador que esta abajo sigue siendo limpio. Va en un ref y no en
  // `useState` porque cambia varias veces por gesto y no lo dibuja nadie: meterlo al
  // estado re-renderizaria el arbol entero por una tecla apretada.
  const tapLimpio = useRef<boolean>(false);

  const transformedShape = useMemo(()=>{
    let c = SHAPES[selected];
    c = rotateN(c, rotation);
    if (mirror) c = reflect(c);
    return c; // normalized
  }, [selected, rotation, mirror]);

  // El recorrido, calculado UNA vez por tablero y consumido por dos: el motor (por la
  // proyeccion sin celdas) y la cabeza lectora (por `encolar`). Eran tres hasta que el
  // spec 014 borro la lista lateral, que lo leia por el orden del circuito.
  // Recalcularlo en cada consumidor abriria la puerta a que dos de ellos miren circuitos
  // distintos, que es la clase de discrepancia que D5 del 009 existe para cerrar.
  //
  // El `regimen` va en las dependencias y no es opcional: es la primera de las tres
  // cachas de derivacion que AC15 obliga a llevarlo. Sin el, cambiar el regimen no
  // re-derivaria el tablero y AC7 quedaria falso — que es justo la consecuencia
  // buscada de que las notas no se guarden en `PlacedPiece`.
  const secuencia = useMemo(()=> buildSequence(placed, regimen), [placed, regimen]);

  // El arpegio de la pieza SELECCIONADA, para el panel y para el click de colocacion.
  // La derivacion vive en `domain/music.ts` y no aca: las piezas ya colocadas la piden
  // por su cuenta —`buildSequence`, para el motor— y tener dos copias de la regla era
  // justo lo que hacia falta cuando `PlacedPiece` guardaba sus notas.
  const noteSet = useMemo(()=> arpeggioFor(selected, rotation, mirror, regimen), [selected, rotation, mirror, regimen]);

  // Los cuatro efectos de reconciliación que mantienen al motor mirando este mismo
  // tablero viven en `components/use-motor.ts` (spec 022), y la llamada va ACÁ y no
  // arriba con el resto del cableado: `secuencia` es un `const`, así que llamarlo antes
  // de su `useMemo` la leería en su zona muerta temporal y tiraría un `ReferenceError`
  // en el primer render. Sigue estando ANTES de los dos hooks de entrada, que es donde
  // estaban los cuatro efectos, así que el orden de registro no cambia.
  useMotorSincronizado({ secuencia, placed, tempo, clicks });

  // El tablero se edita EN el tablero (spec 014): sobre una pieza ya colocada, y solo con
  // esa misma pieza en la mano, el click la quita y `Alt`+click alterna su muteo. Qué
  // gesto es lo decide `accionDeClick`, que es una pura y se testea; acá queda el
  // cableado y las dos consultas al dominio que la pura no puede hacer.
  function handleCellClick(x: number, y: number, altKey: boolean){
    const ocupante = occupantAt(placed, x, y);
    const accion = accionDeClick(ocupante, selected, altKey);
    if (accion === null) return;   // celda ocupada por OTRA pieza: nada, como antes

    // Las dos ramas de edición van anidadas adentro del `ocupante !== null` y no colgadas
    // del `accion`: la pura ya garantiza que `quitar` y `mutear` solo salen con ocupante,
    // y así TypeScript lo sabe sin que haga falta un `!` que afirme lo mismo sin prueba.
    if (ocupante !== null) {
      if (accion === EDICION.quitar) setPlaced(arr => arr.filter(p => p.id !== ocupante.id));
      // Objeto nuevo y no `p.muted = !p.muted`: nunca mutar lo que ya se entregó a React.
      else setPlaced(arr => arr.map(p => p.id === ocupante.id ? { ...p, muted: !p.muted } : p));
      return;
    }

    const cells = cellsAt(transformedShape, ANCHOR_INDEX[selected], x, y);
    if (!isValid(cells, placed)) return;
    // `Alt` significa "muteado" en los dos lados del gesto: colocar así mete una pieza al
    // circuito por su ESPACIO y su TIEMPO —mueve el orden de visita y agrega distancia—
    // sin agregar cinco notas. Es la única forma de componer con silencio.
    const muted = accion === EDICION.colocarMuteada;
    const newPiece: PlacedPiece = {
      id: String(++idRef.current),
      piece: selected, rotation, mirror, cells, muted,
    };
    setPlaced(prev => [...prev, newPiece]);
    // Con el transporte corriendo, disparar acá duplicaría el arpegio: con D5
    // (spec 009) la pieza nueva ni siquiera entra al recorrido que está sonando
    // —`setSequence` no interrumpe el ciclo en curso, así que hasta que cierre la
    // pieza es muda dentro del loop— y el click sigue siendo la única forma
    // inmediata de escucharla. Con el transporte en pausa pasa lo mismo por otra
    // razón: no hay reloj corriendo que la vaya a tocar. Sin Web Audio `playing`
    // nunca llega a true, de modo que el caso degradado cae solo del lado que suena.
    //
    // Colocar MUTEADA no lo dispara: la pieza se está poniendo justamente para que no
    // suene, y un arpegio de cortesía contradiría el gesto en el momento de hacerlo.
    if (!playing && !muted) playNow(noteSet);
  }

  // Reset frena el transporte ADEMÁS de vaciar el tablero, y esa segunda mitad no es
  // cosmética. Vaciar solo `placed` deja al motor terminando su ciclo activo —D5 del
  // spec 009: la secuencia nueva, vacía, entra recién al cerrar—, o sea hasta 7,5 s
  // sonando sobre un tablero que ya está vacío. Reset es una orden explícita de volver
  // a cero, no una edición del tablero, así que es el único lugar donde saltearse D5 es
  // lo correcto. Lo que queda es la latencia de pausar, que el motor ya documenta: los
  // 100 ms del lookahead más la cola del arpegio ya agendado.
  function resetBoard(){
    frenarTransporte();
    setPlaying(false);
    setPlaced([]); // el efecto de reconciliación se encarga de vaciar la secuencia
  }

  // `useCallback` y no una función suelta desde que el atajo de la barra espaciadora
  // también la llama (spec 013): el efecto del teclado la tiene en sus dependencias, y
  // sin memo cambiaría de identidad en cada render y re-suscribiría los dos listeners
  // por cada tecla. Con `[playing]`, la identidad cambia exactamente cuando cambia el
  // transporte, que es la dependencia real que el efecto declara.
  const togglePlay = useCallback(()=>{
    // La decisión —pedir lo contrario de lo que pasa y creerle al motor y no a lo que se
    // pidió— vive en `alternarTransporte`, donde tiene test. Acá queda el cableado: el
    // motor real y el `setState` con lo que el motor contestó.
    setPlaying(alternarTransporte(playing, MOTOR));
  }, [playing]);

  // ── Entrada directa (spec 013) ──────────────────────────────────────────────────
  // Los dos efectos viven en `components/use-entrada.ts` desde el spec 022, y reciben
  // CALLBACKS y no setters: así el día en que la orientación deje de ser dos `useState`
  // y pase a ser una ranura por pieza, lo que cambia es este bloque y no el hook.
  //
  // `tapLimpio` se queda ACÁ y viaja a los dos: lo lee el teclado y lo escriben los dos,
  // así que el ref es de quien los compone. Está argumentado en `use-entrada.ts`.

  // Los dos del teclado se memoizan con sus dependencias REALES y no con `[]`: el efecto
  // tiene que re-suscribirse cuando cambia la orientación, que es exactamente lo que hace
  // hoy. Con arrows inline el hook se re-suscribiría por render — peor, y en silencio.
  const rotarConTecla = useCallback(()=> setRotation((rotation + 1) % 4), [rotation]);
  const reflejarConTecla = useCallback(()=> setMirror(!mirror), [mirror]);

  // `useCallback` de dependencias VACÍAS, y no es cosmética: es lo que deja que el
  // listener de `wheel` se registre una sola vez por montaje. Es posible porque el cuerpo
  // usa el setter funcional y no lee `rotation`. Si alguna vez gana una dependencia, el
  // listener pasa a re-suscribirse con ella.
  const alRotar = useCallback((deltaY: number)=> setRotation(r => rotacionPorRueda(r, deltaY)), []);

  useAtajosDeTeclado(
    { rotar: rotarConTecla, reflejar: reflejarConTecla, transporte: togglePlay },
    tapLimpio,
  );
  useRuedaRota(boardRef, alRotar, tapLimpio);

  // El menú contextual no se abre NUNCA sobre el tablero —`preventDefault` siempre—,
  // pero alternar es otra cosa: en macOS `Ctrl`+click llega como `contextmenu` con
  // `ctrlKey: true` y ahí el que alterna es el `keyup` de `Ctrl`. Contar los dos daría
  // neto cero y la reflexión no respondería nunca en una laptop de Apple sin mouse.
  function handleContextMenu(e: { preventDefault: () => void; ctrlKey: boolean }){
    e.preventDefault();
    if (reflejaElContextMenu(e)) setMirror(m=>!m);
  }

  // Si la celda bajo el cursor está ocupada por la pieza que está en la mano, el click
  // no coloca: edita. La condición sale de la MISMA pura que decide el click, así que el
  // cursor no puede prometer una cosa y el gesto hacer otra.
  const hoverEdita = esLaPiezaEnLaMano(hover ? occupantAt(placed, hover[0], hover[1]) : null, selected);

  // Fantasma: dónde caería la pieza desde la celda bajo el cursor. Las celdas
  // fuera del tablero no se pintan, pero sí cuentan para marcar la jugada
  // como inválida.
  //
  // Sobre una celda propia el fantasma NO se pinta, y esa es la decisión que AC20 pide
  // escrita: ahí la jugada de colocar es inválida —la pieza se choca consigo misma— así
  // que el fantasma saldría rosa entero, diciendo "acá no entra" sobre la única celda
  // donde el click sí hace algo. Lo que se ve es la pieza colocada, que es sobre lo que
  // el gesto va a actuar.
  const previewCells = hover && !hoverEdita ? cellsAt(transformedShape, ANCHOR_INDEX[selected], hover[0], hover[1]) : [];
  const previewValid = hover && !hoverEdita ? isValid(previewCells, placed) : false;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-4">
        {/* Los dos objetos se arman INLINE y no en un `useMemo`: tienen identidad nueva
            por render, y eso no cuesta nada porque `PiecePalette` no esta memoizado —
            re-renderiza igual cuando el shell re-renderiza. Va escrito porque es lo
            primero que alguien va a querer "arreglar" con un `useMemo` que no compra
            nada y agrega dos arrays de dependencias que mantener. */}
        <PiecePalette
          orientacion={{
            selected, rotation, mirror, regimen, noteSet,
            onSelect: setSelected,
            onRotate: setRotation,
            onMirror: ()=> setMirror(m=>!m),
            onRegimen: setRegimen,
          }}
          transporte={{
            tempo, playing, clicks,
            onTempo: setTempo,
            onTogglePlay: togglePlay,
            onToggleClicks: ()=> setClicks(c=>!c),
            onReset: resetBoard,
          }}
        />

        <Board
          placed={placed}
          previewCells={previewCells}
          previewValid={previewValid}
          hover={hover}
          selected={selected}
          rotation={rotation}
          mirror={mirror}
          regimen={regimen}
          onCellClick={handleCellClick}
          onCellEnter={setHover}
          onMouseLeave={()=> setHover(null)}
          hoverEdita={hoverEdita}
          onContextMenu={handleContextMenu}
          boardRef={boardRef}
        />

        {/* Bottom: señal que sale por el master. No recibe props: lee del motor
            por su cuenta, para que dibujar a 60 fps no re-renderice nada de acá. */}
        <div className="col-span-12 bg-white rounded-2xl shadow p-3">
          <h2 className="text-lg font-semibold mb-2">Señal</h2>
          <Spectrum />
        </div>
      </div>

      {/* El footer explicaba el modelo y no mencionaba un solo gesto, que es lo que hacía
          invisibles a los atajos del spec 013. Ahora dice las dos cosas: qué cambia cada
          transformación, y con qué mano se llega a ella sin soltar el tablero. */}
      <footer className="text-center text-xs text-slate-500 pt-4">
        Pentomino Music — prototipo. Rotación cambia la fórmula de escala o el arranque del arpegio, según el régimen; Reflexión invierte el orden (retrógrado).
        {' '}Click en tablero para colocar y escuchar.
        {' '}<span className="whitespace-nowrap">Rueda sobre el tablero o <kbd>Shift</kbd> rota</span>;
        {' '}<span className="whitespace-nowrap">botón derecho o <kbd>Ctrl</kbd> refleja</span>;
        {' '}<span className="whitespace-nowrap"><kbd>Espacio</kbd> arranca y para</span>.
      </footer>
    </div>
  );
}

import { useMemo, useState, useEffect, useRef } from "react";
import {
  playNow, setSequence, setBpm, setClicksAudible,
  startClock, stopClock, clockRunning,
} from "./audio/engine.ts";
import { DEFAULT_BPM } from "./audio/constants/engine.constants.ts";
import { rotateN, reflect } from "./domain/transform.ts";
import { arpeggioFor } from "./domain/music.ts";
import { cellsAt, isValid } from "./domain/board.ts";
import { buildSequence } from "./domain/sequence.ts";
import { SHAPES, ANCHOR_INDEX } from "./domain/constants/pieces.constants.ts";
import { DEFAULT_REGIMEN } from "./domain/constants/music.constants.ts";
import type { Cell } from "./domain/types/transform.types.ts";
import type { PieceKey } from "./domain/types/pieces.types.ts";
import type { PlacedPiece } from "./domain/types/board.types.ts";
import type { RegimenDeRotacion } from "./domain/types/music.types.ts";
import PiecePalette from "./components/PiecePalette.tsx";
import Board from "./components/Board.tsx";
import PlacedList from "./components/PlacedList.tsx";
import Spectrum from "./components/Spectrum.tsx";
import { encolar } from "./components/route-source.ts";

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
 * Este archivo es el shell: estado, derivados, handlers y efectos. La geometria, la
 * musica y las reglas del tablero viven en `src/domain/`; el sonido en
 * `src/audio/`; y el JSX, en los cuatro componentes de `src/components/`.
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
  // Los clicks del recorrido arrancan encendidos: son D4, sin ellos un salto largo
  // por celdas vacías es un silencio mudo y el recorrido se vuelve inaudible. Apaga
  // solo esos: el cruce por celda ocupada suena su nota y no lo gobierna este flag,
  // porque es modelo y no mezcla (D6 del spec 011).
  const [clicks, setClicks] = useState<boolean>(true);
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

  useEffect(()=>{ setBpm(tempo); }, [tempo]);
  useEffect(()=>{ setClicksAudible(clicks); }, [clicks]);

  const transformedShape = useMemo(()=>{
    let c = SHAPES[selected];
    c = rotateN(c, rotation);
    if (mirror) c = reflect(c);
    return c; // normalized
  }, [selected, rotation, mirror]);

  // El recorrido, calculado UNA vez por tablero y consumido por tres: el motor (por la
  // proyeccion sin celdas), la cabeza lectora (por `encolar`) y la lista lateral (por el
  // orden del circuito). Recalcularlo en cada consumidor abriria la puerta a que dos de
  // ellos miren circuitos distintos, que es la clase de discrepancia que D5 del 009
  // existe para cerrar.
  //
  // El `regimen` va en las dependencias y no es opcional: es la primera de las tres
  // cachas de derivacion que AC15 obliga a llevarlo. Sin el, cambiar el regimen no
  // re-derivaria el tablero y AC7 quedaria falso — que es justo la consecuencia
  // buscada de que las notas no se guarden en `PlacedPiece`.
  const secuencia = useMemo(()=> buildSequence(placed, regimen), [placed, regimen]);

  // El arpegio de la pieza SELECCIONADA, para el panel y para el click de colocacion.
  // La derivacion vive en `domain/music.ts` y no aca: las piezas ya colocadas la piden
  // por su cuenta —`buildSequence` para el motor, `PlacedList` para el panel— y tener
  // dos copias de la regla era justo lo que hacia falta cuando `PlacedPiece` guardaba
  // sus notas.
  const noteSet = useMemo(()=> arpeggioFor(selected, rotation, mirror, regimen), [selected, rotation, mirror, regimen]);

  function handleCellClick(x: number, y: number){
    const cells = cellsAt(transformedShape, ANCHOR_INDEX[selected], x, y);
    if (!isValid(cells, placed)) return;
    const newPiece: PlacedPiece = {
      id: String(++idRef.current),
      piece: selected, rotation, mirror, cells,
    };
    setPlaced(prev => [...prev, newPiece]);
    // Con el transporte corriendo, disparar acá duplicaría el arpegio: con D5
    // (spec 009) la pieza nueva ni siquiera entra al recorrido que está sonando
    // —`setSequence` no interrumpe el ciclo en curso, así que hasta que cierre la
    // pieza es muda dentro del loop— y el click sigue siendo la única forma
    // inmediata de escucharla. Con el transporte en pausa pasa lo mismo por otra
    // razón: no hay reloj corriendo que la vaya a tocar. Sin Web Audio `playing`
    // nunca llega a true, de modo que el caso degradado cae solo del lado que suena.
    if (!playing) playNow(noteSet);
  }

  // Reset frena el transporte ADEMÁS de vaciar el tablero, y esa segunda mitad no es
  // cosmética. Vaciar solo `placed` deja al motor terminando su ciclo activo —D5 del
  // spec 009: la secuencia nueva, vacía, entra recién al cerrar—, o sea hasta 7,5 s
  // sonando sobre un tablero que ya está vacío. Reset es una orden explícita de volver
  // a cero, no una edición del tablero, así que es el único lugar donde saltearse D5 es
  // lo correcto. Lo que queda es la latencia de pausar, que el motor ya documenta: los
  // 100 ms del lookahead más la cola del arpegio ya agendado.
  function resetBoard(){
    stopClock();
    setPlaying(false);
    setPlaced([]); // el efecto de reconciliación se encarga de vaciar la secuencia
  }

  // Reconcilia la secuencia del motor contra el tablero. `playing` salió de las
  // dependencias a propósito: la secuencia es función del tablero, no del
  // transporte, y quien corta o arranca el sonido es `togglePlay` llamando a
  // `stopClock`/`startClock`. El `clearJobs()` + `if (!playing) return` de antes
  // era la forma vieja de lograr lo mismo desde acá; con una sola llamada a
  // `setSequence` deja de hacer falta — colocar o quitar con el transporte
  // parado igual deja la secuencia lista para cuando arranque.
  //
  // `setSequence` no interrumpe el ciclo en curso (D5, spec 009): la secuencia
  // nueva entra recién al cerrar el circuito activo, así que reordenar el
  // tablero puede tardar hasta un ciclo completo en escucharse — 7,5 s con 8
  // piezas a 110 bpm. Es el precio de que el circuito se pueda reordenar entero
  // sin que el patrón salte a mitad de frase.
  //
  // La `Sequence` de `buildSequence` no es la que espera el motor: acá se
  // proyecta, no se traduce (D7, D8, AC12). `offset`, `notes` y la `note` MIDI del
  // cruce viajan tal cual; lo que se cae es `pieceId` —el motor no tiene a quién
  // devolvérselo— y `cell` en los clicks: el motor no puede ver `Cell`, que vive en
  // `domain/` y el override de eslint sobre `audio/**` lo prohíbe importar incluso
  // como `import type`. La `note` sí cruza, porque es un número MIDI y el motor habla
  // MIDI: desde el spec 011 el recorrido puede pisar una celda ocupada y ese cruce
  // suena su altura (D5), así que ya no alcanza con contar los clicks. Convertirla a
  // Hz es del motor —lo hace `collectHits`, igual que con `steps.notes`—: acá se
  // proyecta, y traducir sería justo lo que estas dos líneas no hacen.
  // Las celdas no se pierden: siguen en la secuencia del dominio, y por eso este efecto
  // encola en DOS colas con la misma `secuencia`. Leerlas de `placed` —que es lo que
  // decía este comentario antes del spec 010— no alcanza, y ese es justo el punto de
  // AC9: `placed` es el tablero de AHORA, o sea la ruta PENDIENTE, mientras que la
  // cabeza tiene que dibujar la que está sonando. Quien guarda el par es
  // `components/route-source.ts`, y hace su swap cuando el motor reporta el suyo.
  //
  // Las dos colas se encolan desde acá y con la MISMA instancia a propósito: si cada una
  // llamara a su propio `buildSequence`, el dibujo y el sonido podrían quedar mirando
  // circuitos distintos sin que nada falle.
  useEffect(()=>{
    encolar(secuencia, placed);
    setSequence({
      steps: secuencia.steps.map(({ offset, notes }) => ({ offset, notes })),
      // El ternario y no `({ offset, note })`: con la forma corta el click mudo sale con
      // la clave `note` PRESENTE y en `undefined`, y la ausencia del campo es justo lo
      // que dice "celda vacía" (ver el docblock de `Click`). Hoy nadie lo notaría
      // —`collectHits` compara `=== undefined`— pero es el tercer estado que el tipo
      // existe para no tener.
      clicks: secuencia.clicks.map((c) => c.note === undefined ? { offset: c.offset } : { offset: c.offset, note: c.note }),
      length: secuencia.length,
    });
    // `placed` esta en las dependencias aunque `secuencia` ya se derive de el: no agrega
    // ni una corrida —`secuencia` es un `useMemo` sobre `[placed]`, asi que cambian
    // juntos— y evita callar la regla de exhaustividad con un disable, que taparia el
    // dia en que alguien desacople las dos.
  }, [secuencia, placed]);

  // Al desmontar, frenar el reloj y vaciar la secuencia del motor. La limpieza
  // sigue siendo sincrónica: si fuera asincrónica, en StrictMode podría
  // ejecutarse después de que el efecto de arriba ya volvió a agendar, y
  // pisaría la secuencia nueva con una vacía. Se proyecta `buildSequence([])`
  // en vez de escribir el literal vacío a mano, para no meter la forma de un
  // dato de dominio en el shell.
  //
  // Va `DEFAULT_REGIMEN` y no el `regimen` del estado, y es la unica llamada del
  // archivo donde fijar uno es correcto: con el tablero vacio `buildSequence` corta en
  // `n === 0` y devuelve la secuencia vacia sin mirar el regimen, asi que la eleccion
  // es inerte. Usar el del estado lo metería en las dependencias de un efecto que existe
  // SOLO para el desmontaje, y entonces la limpieza correria en cada cambio de regimen:
  // frenaria el reloj y vaciaria la secuencia, que es exactamente lo que AC7 prohibe.
  useEffect(()=> ()=>{
    stopClock();
    const s = buildSequence([], DEFAULT_REGIMEN);
    setSequence({
      steps: s.steps.map(({ offset, notes }) => ({ offset, notes })),
      // Misma proyección que el efecto de arriba, y por el mismo motivo: la ausencia de
      // `note` es lo que dice "celda vacía". Acá el tablero está vacío y no hay clicks,
      // pero escribirla distinto invitaría a divergir la próxima vez que se toque una.
      clicks: s.clicks.map((c) => c.note === undefined ? { offset: c.offset } : { offset: c.offset, note: c.note }),
      length: s.length,
    });
  }, []);

  function togglePlay(){
    if (playing) stopClock(); else startClock();
    // El motor es quien sabe si arrancó: startClock() es un no-op silencioso
    // cuando audio() devuelve null, y sin este chequeo el botón diría "Pausa"
    // con el reloj parado. Es la falla suave que .claude/rules/audio.md obliga
    // a chequear en todo llamador, y era lo único que la consulta imperativa
    // hacía bien antes de este spec.
    setPlaying(clockRunning());
  }

  // Fantasma: dónde caería la pieza desde la celda bajo el cursor. Las celdas
  // fuera del tablero no se pintan, pero sí cuentan para marcar la jugada
  // como inválida.
  const previewCells = hover? cellsAt(transformedShape, ANCHOR_INDEX[selected], hover[0], hover[1]) : [];
  const previewValid = hover? isValid(previewCells, placed) : false;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-4">
        <PiecePalette
          selected={selected}
          rotation={rotation}
          mirror={mirror}
          tempo={tempo}
          playing={playing}
          clicks={clicks}
          regimen={regimen}
          noteSet={noteSet}
          onSelect={setSelected}
          onRotate={setRotation}
          onMirror={()=> setMirror(m=>!m)}
          onTempo={setTempo}
          onTogglePlay={togglePlay}
          onToggleClicks={()=> setClicks(c=>!c)}
          onRegimen={setRegimen}
          onReset={resetBoard}
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
        />

        {/* El orden sale de la misma `secuencia` que alimenta al motor y no de un
            `buildSequence` propio: la lista dice el orden que se escucha, no otro. */}
        <PlacedList
          placed={placed}
          orden={secuencia.steps.map(s=> s.pieceId)}
          regimen={regimen}
          onRemove={id=> setPlaced(arr=> arr.filter(q=> q.id!==id))}
        />

        {/* Bottom: señal que sale por el master. No recibe props: lee del motor
            por su cuenta, para que dibujar a 60 fps no re-renderice nada de acá. */}
        <div className="col-span-12 bg-white rounded-2xl shadow p-3">
          <h2 className="text-lg font-semibold mb-2">Señal</h2>
          <Spectrum />
        </div>
      </div>

      <footer className="text-center text-xs text-slate-500 pt-4">Pentomino Music — prototipo. Rotación cambia la fórmula de escala o el arranque del arpegio, según el régimen; Reflexión invierte el orden (retrogrado). Click en tablero para colocar y escuchar.</footer>
    </div>
  );
}

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  playNow, setSequence, setBpm, setClicksAudible,
  startClock, stopClock, clockRunning,
} from "./audio/engine.ts";
import { DEFAULT_BPM } from "./audio/constants/engine.constants.ts";
import { rotateN, reflect } from "./domain/transform.ts";
import { arpeggioFor } from "./domain/music.ts";
import { cellsAt, isValid, occupantAt } from "./domain/board.ts";
import { buildSequence } from "./domain/sequence.ts";
import { SHAPES, ANCHOR_INDEX } from "./domain/constants/pieces.constants.ts";
import type { Cell } from "./domain/types/transform.types.ts";
import type { PieceKey } from "./domain/types/pieces.types.ts";
import type { PlacedPiece } from "./domain/types/board.types.ts";
import PiecePalette from "./components/PiecePalette.tsx";
import Board from "./components/Board.tsx";
import Spectrum from "./components/Spectrum.tsx";
import { encolar } from "./components/route-source.ts";
import {
  rotacionPorRueda, accionDeTecla, abreTapLimpio, reflejaElContextMenu,
  accionDeClick, esLaPiezaEnLaMano,
} from "./components/input.ts";
import { ACCION, EDICION } from "./components/constants/input.constants.ts";

/**
 * Pentomino Music — prototipo de instrumento, no un juego con reglas de resolucion.
 *
 * El usuario coloca pentominos en un tablero de 10x6 y cada pieza dispara un
 * arpegio de cinco notas. Que pieza determina la tonica, la rotacion la formula de
 * escala, la reflexion el orden de las notas, y la posicion en el tablero el orden
 * de reproduccion: un circuito cerrado visita las piezas colocadas por el camino
 * mas corto entre ellas (spec 009, `domain/sequence.ts`), no por el orden en que se
 * fueron colocando.
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

  useEffect(()=>{ setBpm(tempo); }, [tempo]);
  useEffect(()=>{ setClicksAudible(clicks); }, [clicks]);

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
  const secuencia = useMemo(()=> buildSequence(placed), [placed]);

  // El arpegio de la pieza SELECCIONADA, para el panel y para el click de colocacion.
  // La derivacion vive en `domain/music.ts` y no aca: las piezas ya colocadas la piden
  // por su cuenta —`buildSequence`, para el motor— y tener dos copias de la regla era
  // justo lo que hacia falta cuando `PlacedPiece` guardaba sus notas.
  const noteSet = useMemo(()=> arpeggioFor(selected, rotation, mirror), [selected, rotation, mirror]);

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
  useEffect(()=> ()=>{
    stopClock();
    const s = buildSequence([]);
    setSequence({
      steps: s.steps.map(({ offset, notes }) => ({ offset, notes })),
      // Misma proyección que el efecto de arriba, y por el mismo motivo: la ausencia de
      // `note` es lo que dice "celda vacía". Acá el tablero está vacío y no hay clicks,
      // pero escribirla distinto invitaría a divergir la próxima vez que se toque una.
      clicks: s.clicks.map((c) => c.note === undefined ? { offset: c.offset } : { offset: c.offset, note: c.note }),
      length: s.length,
    });
  }, []);

  // `useCallback` y no una función suelta desde que el atajo de la barra espaciadora
  // también la llama (spec 013): el efecto del teclado la tiene en sus dependencias, y
  // sin memo cambiaría de identidad en cada render y re-suscribiría los dos listeners
  // por cada tecla. Con `[playing]`, la identidad cambia exactamente cuando cambia el
  // transporte, que es la dependencia real que el efecto declara.
  const togglePlay = useCallback(()=>{
    if (playing) stopClock(); else startClock();
    // El motor es quien sabe si arrancó: startClock() es un no-op silencioso
    // cuando audio() devuelve null, y sin este chequeo el botón diría "Pausa"
    // con el reloj parado. Es la falla suave que .claude/rules/audio.md obliga
    // a chequear en todo llamador, y era lo único que la consulta imperativa
    // hacía bien antes de este spec.
    setPlaying(clockRunning());
  }, [playing]);

  // ── Entrada directa (spec 013) ──────────────────────────────────────────────────
  // Los tres gestos que gobiernan la pieza POR COLOCAR se atan a la mano que ya está
  // sobre el tablero, para no pagar un viaje al panel por cada cambio de orientación.
  // La DECISIÓN de cada uno vive en `components/input.ts` —donde se puede testear sin
  // jsdom— y acá queda solo el cableado.

  // Las dependencias son las REALES —`rotation`, `mirror` y el `togglePlay` que lleva
  // `playing` adentro— y el efecto se re-suscribe cuando cambian. La alternativa es un
  // ref con el estado para suscribir una sola vez, que es la optimización que este repo
  // no necesita: son dos `addEventListener` sobre `window`, no un costo, y el ref
  // escondería de dónde sale cada valor.
  useEffect(()=>{
    // El `target` interactivo se mira acá y no en la pura: `HTMLButtonElement` es un
    // tipo del DOM, y `input.ts` tiene que poder cargarse en `environment: 'node'`.
    const esControl = (t: EventTarget | null) =>
      t instanceof HTMLButtonElement || t instanceof HTMLInputElement;

    const despachar = (e: KeyboardEvent, tipo: 'keydown' | 'keyup') => {
      const accion = accionDeTecla({
        key: e.key, tipo, repeat: e.repeat,
        targetEsControl: esControl(e.target),
        tapLimpio: tapLimpio.current,
      });
      // `preventDefault` SOLO cuando la acción no es null: si el handler se saltea el
      // evento, el navegador tiene que quedárselo entero — es lo que deja que la barra
      // active el botón que tiene el foco en vez de alternar el transporte dos veces.
      if (accion === null) return;
      e.preventDefault();
      if (accion === ACCION.rotar) setRotation((rotation + 1) % 4);
      else if (accion === ACCION.reflejar) setMirror(!mirror);
      // El transporte pasa por `togglePlay` y no por `startClock`/`stopClock` sueltos:
      // ahí vive la consulta a `clockRunning()` que `.claude/rules/audio.md` obliga a
      // hacer en todo llamador, y abrir una segunda puerta la saltearía.
      else togglePlay();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Un modificador ABRE un tap limpio; cualquier otra tecla ENSUCIA el que hubiera.
      // Con esto `Ctrl`+C no da vuelta la reflexión, que es el uso normal de un
      // navegador y no el caso raro de apretar la tecla sin querer.
      tapLimpio.current = abreTapLimpio(e);
      despachar(e, 'keydown');
    };
    const onKeyUp = (e: KeyboardEvent) => despachar(e, 'keyup');

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return ()=>{
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [rotation, mirror, togglePlay]);

  // La rueda va por `addEventListener` no pasivo y no por una prop `onWheel`: React
  // registra `wheel` PASIVO en su contenedor raíz (react-dom 19.1.1), y adentro de un
  // listener pasivo `preventDefault()` es un no-op que el navegador solo avisa por
  // consola. Con la prop, la rueda rotaría y la página scrollearía igual — o sea que
  // parecería andar. Ver el comentario del contenedor en `Board.tsx`.
  //
  // Con el setter funcional este efecto no depende de `rotation` y se suscribe una sola
  // vez, que es lo contrario del efecto del teclado y por un motivo concreto: acá no hay
  // ningún valor que el handler tenga que leer.
  useEffect(()=>{
    const nodo = boardRef.current;
    if (!nodo) return;
    const onWheel = (e: WheelEvent) => {
      // `Ctrl`+rueda es el zoom del navegador, que es una afordancia de accesibilidad y
      // no un atajo de conveniencia: el evento se saltea ENTERO, `preventDefault`
      // incluido, y el navegador hace lo suyo. Un gesto del sistema le gana a uno nuestro.
      if (e.ctrlKey) return;
      e.preventDefault();
      // La rueda ensucia el tap: `Ctrl`+rueda no puede reflejar al soltar el `Ctrl`.
      tapLimpio.current = false;
      setRotation(r => rotacionPorRueda(r, e.deltaY));
    };
    // `{ passive: false }` explícito: Chrome asume `passive: true` para `wheel` sobre
    // window y document, y aunque sobre un elemento el default sigue siendo false,
    // escribirlo es lo que deja el trato a la vista.
    nodo.addEventListener('wheel', onWheel, { passive: false });
    return ()=> nodo.removeEventListener('wheel', onWheel);
  }, []);

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
        <PiecePalette
          selected={selected}
          rotation={rotation}
          mirror={mirror}
          tempo={tempo}
          playing={playing}
          clicks={clicks}
          noteSet={noteSet}
          onSelect={setSelected}
          onRotate={setRotation}
          onMirror={()=> setMirror(m=>!m)}
          onTempo={setTempo}
          onTogglePlay={togglePlay}
          onToggleClicks={()=> setClicks(c=>!c)}
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
        Pentomino Music — prototipo. Rotación cambia la fórmula de escala; Reflexión invierte el orden (retrógrado).
        {' '}Click en tablero para colocar y escuchar.
        {' '}<span className="whitespace-nowrap">Rueda sobre el tablero o <kbd>Shift</kbd> rota</span>;
        {' '}<span className="whitespace-nowrap">botón derecho o <kbd>Ctrl</kbd> refleja</span>;
        {' '}<span className="whitespace-nowrap"><kbd>Espacio</kbd> arranca y para</span>.
      </footer>
    </div>
  );
}

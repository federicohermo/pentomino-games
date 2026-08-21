import { readSpectrum } from '../audio/engine.ts';
import { binsToBars } from '../audio/spectrum.ts';
import { BAR_COUNT, GAP, MIN_BAR, IDLE_TEXT } from './constants/spectrum.constants.ts';

/**
 * El dibujo del espectro: todo lo que `Spectrum.tsx` hacia adentro de su `useEffect`.
 *
 * Vive en un `.ts` por la misma regla que `playhead-loop.ts`:
 * `react-refresh/only-export-components` prohibe que un `.tsx` exporte algo ademas del
 * componente, asi que mientras esto estuviera adentro del componente no se podia
 * exportar y, por lo tanto, no se podia testear. Es el movimiento del spec 005 aplicado
 * al ultimo componente que todavia guardaba logica.
 *
 * El dibujo sigue siendo imperativo y NO pasa por estado: 60 renders por segundo de
 * React para pintar barras competirian con el re-render del tablero sin darle nada a
 * nadie. Lo unico que cruza la frontera es la lectura del motor, que el loop hace por
 * su cuenta.
 */

export function drawBars(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  bars: Float32Array,
  fill: string | CanvasGradient,
): void {
  g.clearRect(0, 0, w, h);
  const slot = w / bars.length;
  const bw = Math.max(1, slot - GAP);
  g.fillStyle = fill;
  for (let i = 0; i < bars.length; i++) {
    if (bars[i] <= 0) continue;
    const bh = Math.max(MIN_BAR, bars[i] * h);
    g.fillRect(i * slot, h - bh, bw, bh);
  }
}

/**
 * Reposo: las ranuras de las barras vacias y un texto que lo dice.
 *
 * Una linea plana al ras del canvas es ambigua —se lee igual que "el audio esta
 * roto"—, asi que el estado sin contexto se dibuja distinto a proposito.
 */
export function drawIdle(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.clearRect(0, 0, w, h);
  const slot = w / BAR_COUNT;
  const bw = Math.max(1, slot - GAP);
  g.fillStyle = 'rgba(148,163,184,0.12)';
  for (let i = 0; i < BAR_COUNT; i++) g.fillRect(i * slot, 0, bw, h);

  g.fillStyle = 'rgba(148,163,184,0.9)';
  g.font = '12px ui-sans-serif, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(IDLE_TEXT, w / 2, h / 2);
}

/** Lo que devuelve `iniciarEspectro` cuando no hay canvas ni contexto 2d. */
const SIN_ESPECTRO = (): void => {};

/**
 * Arranca el loop de dibujo sobre el canvas y devuelve su limpieza.
 *
 * El canvas entra por parametro y puede ser `null` —es lo que tiene un `ref.current`
 * recien montado— y su contexto 2d tambien: `getContext('2d')` devuelve null si el
 * navegador no puede darlo. Con el loop adentro del componente ninguna de las dos
 * guardas la podia ejercer nadie; aca son una llamada.
 */
export function iniciarEspectro(canvas: HTMLCanvasElement | null): () => void {
  if (!canvas) return SIN_ESPECTRO;
  const g = canvas.getContext('2d');
  if (!g) return SIN_ESPECTRO;

  // Tamano en px CSS: el canvas se dibuja en estas unidades y el backing store
  // va aparte, escalado por dpr.
  let w = 0;
  let h = 0;
  let fill: string | CanvasGradient = '#34d399';

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    // Sin esta transformacion el canvas dibuja en px fisicos y en pantallas
    // HiDPI todo sale a escala 1/dpr, o borroso si se estira por CSS.
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // El gradiente depende de la altura, asi que se rearma cuando cambia y no
    // en cada cuadro.
    const grad = g.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, '#059669');
    grad.addColorStop(1, '#5eead4');
    fill = grad;
  };

  // Observa el contenedor y no el canvas: cambiarle width/height al canvas
  // dentro del propio callback puede realimentar al observer.
  const box = canvas.parentElement ?? canvas;
  const ro = new ResizeObserver(resize);
  ro.observe(box);

  // El ResizeObserver NO alcanza para cubrir el dpr: arrastrar la ventana a un
  // monitor con otra densidad cambia devicePixelRatio sin cambiar un solo pixel
  // CSS, asi que el observer no dispara y el canvas se queda con el backing
  // store de la pantalla anterior —o sea, borroso— hasta el proximo resize.
  // La media query se dispara justo cuando el dpr deja de valer lo que valia, y
  // por eso hay que re-armarla con el valor nuevo cada vez.
  let dprQuery: MediaQueryList | null = null;
  const onDprChange = () => { resize(); watchDpr(); };
  const watchDpr = () => {
    dprQuery?.removeEventListener('change', onDprChange);
    dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprQuery.addEventListener('change', onDprChange);
  };

  resize();
  watchDpr();

  let raf = 0;
  const draw = () => {
    const bins = readSpectrum();
    if (bins) drawBars(g, w, h, binsToBars(bins, BAR_COUNT), fill);
    else drawIdle(g, w, h);
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    dprQuery?.removeEventListener('change', onDprChange);
  };
}

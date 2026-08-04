import { useEffect, useRef } from 'react';
import { readSpectrum } from '../audio/engine.ts';
import { binsToBars } from '../audio/spectrum.ts';

/**
 * Espectro de la senal que sale por el master, dibujado en un canvas.
 *
 * React monta el <canvas> y arranca/frena el loop; el dibujo es imperativo y NO
 * pasa por estado: 60 renders por segundo de React para pintar barras competirian
 * con el re-render del tablero sin darle nada a nadie. Lo unico que cruza la
 * frontera es la lectura del motor, que el loop hace por su cuenta.
 */

/** Barras dibujadas. Menos que los 128 bins: agrupadas se leen sin ruido visual. */
const BAR_COUNT = 48;
/** Separacion entre barras, en px CSS. */
const GAP = 2;
/** Altura minima de una barra con senal: por debajo de esto no se ve que hay algo. */
const MIN_BAR = 2;

const IDLE_TEXT = 'En reposo — el audio arranca con el primer click';

function drawBars(
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
function drawIdle(g: CanvasRenderingContext2D, w: number, h: number): void {
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

export default function Spectrum() {
  const ref = useRef<HTMLCanvasElement>(null);

  // El array de dependencias vacio es intencional: el loop se monta una vez y lee
  // del motor directamente, asi que no hay nada que re-suscribir cuando la app
  // re-renderiza.
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;

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
  }, []);

  return (
    <div className="h-24 w-full">
      <canvas ref={ref} className="block h-full w-full rounded-xl bg-slate-900" />
    </div>
  );
}

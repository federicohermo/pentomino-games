# Plan de Implementación — Visualización de la señal con AnalyserNode

> **Bloqueado por el [spec 002](../002-motor-de-audio-propio-sobre-web-audio/plan.md).** No empezar
> antes de que el motor propio esté mergeado: con Tone no hay dónde insertar el nodo.

## Orden

1. Mapeo puro `binsToBars` + tests (no toca ni audio ni UI)
2. `AnalyserNode` en el grafo del motor
3. Componente de canvas
4. Verificación

El paso 1 es independiente de todo lo demás y mergeable solo.

## 1. Mapeo puro — `src/audio/spectrum.ts`

La única parte testeable, y por eso la primera (D1).

```ts
/**
 * Agrupa los bins de la FFT en `barCount` barras con espaciado logarítmico y
 * devuelve alturas normalizadas 0–1.
 *
 * Logarítmico y no lineal porque los bins están espaciados linealmente en
 * frecuencia pero la percepción no: con reparto lineal las primeras barras se
 * comen toda la información musical y el resto del canvas queda vacío.
 */
export function binsToBars(bins: Uint8Array, barCount: number): Float32Array {
  const out = new Float32Array(barCount);
  if (barCount <= 0 || bins.length === 0) return out;

  for (let b = 0; b < barCount; b++) {
    // bordes logarítmicos sobre el índice de bin
    const lo = Math.floor(bins.length ** (b / barCount)) - 1;
    const hi = Math.floor(bins.length ** ((b + 1) / barCount)) - 1;
    const from = Math.max(0, Math.min(lo, bins.length - 1));
    const to   = Math.max(from + 1, Math.min(hi, bins.length));

    let peak = 0;
    for (let i = from; i < to; i++) peak = Math.max(peak, bins[i]);
    out[b] = peak / 255;
  }
  return out;
}
```

**Por qué pico y no promedio**: el promedio de una banda ancha aplana los transitorios, que es
justamente lo que hay que ver en un instrumento percusivo. El pico conserva el ataque.

**La guarda `Math.max(from + 1, …)`** garantiza que ninguna banda quede vacía cuando `barCount` supera
la cantidad de bins — sin ella, las barras graves salen todas en 0 (AC4).

### Tests (AC2, AC3, AC4)

```ts
it('AC2 — determinista y normalizado', () => {
  const bins = new Uint8Array(128).fill(255);
  expect(Array.from(binsToBars(bins, 8))).toEqual(new Array(8).fill(1));
});

it('AC3 — la banda grave abarca menos bins que la aguda', () => {
  // con un solo bin encendido en la zona grave se enciende una sola barra;
  // con uno en la aguda, esa barra cubre un rango mayor
});

it('AC4 — bordes', () => {
  expect(binsToBars(new Uint8Array(128), 8).every(v => v === 0)).toBe(true);
  expect(binsToBars(new Uint8Array(4).fill(255), 32).length).toBe(32);
  expect(binsToBars(new Uint8Array(128).fill(255), 1)[0]).toBe(1);
});
```

Ningún test toca `AudioContext`. Es el objetivo de D1.

## 2. `AnalyserNode` en el motor

En `src/audio/engine.ts`, al construir el grafo:

```ts
analyser = ctx.createAnalyser();
analyser.fftSize = 256;                  // 128 bins
analyser.smoothingTimeConstant = 0.8;
master.connect(analyser);
analyser.connect(ctx.destination);       // el nodo es transparente al audio (AC1)
```

Los valores vienen de `@elevenlabs/ui` (ver `research.md`), no de la intuición.

Se expone un lector que reusa el buffer para no asignar 60 veces por segundo:

```ts
let freqBuf: Uint8Array | null = null;
export function readSpectrum(): Uint8Array | null {
  if (!analyser) return null;
  if (!freqBuf || freqBuf.length !== analyser.frequencyBinCount)
    freqBuf = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(freqBuf);
  return freqBuf;
}
```

**Devolver el buffer reusado es una trampa conocida**: quien lo guarde va a ver cómo le cambia por
debajo. Documentarlo en el JSDoc — el consumidor es el loop de dibujo, que lo usa y lo descarta.

## 3. Componente — `src/components/Spectrum.tsx`

```tsx
useEffect(() => {
  const canvas = ref.current; if (!canvas) return;
  const ctx2d = canvas.getContext('2d'); if (!ctx2d) return;
  let raf = 0;

  const ro = new ResizeObserver(() => resize(canvas, ctx2d));   // AC5
  ro.observe(canvas.parentElement!);
  resize(canvas, ctx2d);

  const draw = () => {
    const bins = readSpectrum();
    if (!bins) drawIdle(ctx2d, canvas);                          // AC8
    else drawBars(ctx2d, canvas, binsToBars(bins, BAR_COUNT));
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  return () => { cancelAnimationFrame(raf); ro.disconnect(); };  // AC6
}, []);
```

**El array de dependencias vacío es intencional** (D3): el loop se monta una vez y lee del motor
directamente. Nada de este camino pasa por estado de React, así que no hay nada que re-suscribir.

HiDPI (AC5):

```ts
function resize(canvas: HTMLCanvasElement, ctx2d: CanvasRenderingContext2D) {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}
```

## 4. Verificación

```bash
npx tsc -b --noEmit
npm test                # AC2, AC3, AC4
npm run build
```

En el navegador:

- **AC1** — el audio suena igual que antes de insertar el nodo.
- **AC5** — captura en un display HiDPI; las barras no se ven borrosas. Redimensionar la ventana y
  confirmar que el canvas acompaña.
- **AC6** — montar y desmontar el componente; confirmar con el profiler que no queda un `rAF` vivo.
- **AC7** — con el React Profiler, colocar una pieza y confirmar que el conteo de renders del tablero
  no sube a 60/s.
- **AC8** — cargar la página sin hacer click: el canvas muestra reposo, no una línea plana.

## 5. Documentación

- `docs/architecture/audio.md` — el analizador en el diagrama del grafo, y por qué el mapeo vive
  aparte del nodo.
- `specs/log.md` — estado de 003 a `Implementado`.

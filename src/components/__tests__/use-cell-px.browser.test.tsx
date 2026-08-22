import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { useCellPx } from '../use-cell-px.ts';
import { cellPxPara } from '../cell-px.ts';
import { CELL_PX_MIN } from '../constants/layout.constants.ts';
import type { RefObject } from 'react';

/**
 * El CABLEADO del hook que escribe `--cell`, con un nodo de verdad y un `resize` de verdad.
 *
 * `cell-px.test.ts` cubre la fórmula y no toca el DOM; acá está lo otro, que es donde
 * estarían los bugs y ninguno de los cuatro se ve en la pura:
 *
 * 1. que `--cell` quede escrita **con unidad** — sin el `px`, todos los
 *    `calc(var(--cell) * n)` son declaraciones inválidas y la grilla colapsa a una columna
 *    sin un solo error en consola;
 * 2. que se escriba **antes del primer paint** (`useLayoutEffect`), o ese colapso se ve
 *    durante un cuadro;
 * 3. que un `resize` la **reescriba**; y
 * 4. que la limpieza saque el listener — StrictMode monta dos veces.
 */
const basura: HTMLElement[] = [];
const nodo = (w: number, h: number): RefObject<HTMLElement | null> => {
  const el = document.createElement('div');
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  document.body.appendChild(el);
  basura.push(el);
  return { current: el };
};

afterEach(() => { basura.splice(0).forEach(el => el.remove()); });

describe('useCellPx', () => {
  it('escribe `--cell` con la unidad puesta, y con el valor de la caja', async () => {
    const ref = nodo(1000, 600);
    await renderHook(() => useCellPx(ref));
    // Con la unidad: un `--cell` que valga `100` a secas deja inválido a cada `calc()` que
    // lo consume, y el navegador no dice nada.
    expect(ref.current!.style.getPropertyValue('--cell')).toBe(`${cellPxPara(1000, 600)}px`);
    expect(ref.current!.style.getPropertyValue('--cell')).toBe('100px');
  });

  it('mide la CAJA y no `innerWidth`, que es lo que los hace ser el mismo número', async () => {
    // Dos nodos de tamaños distintos en el mismo viewport: si el hook leyera la ventana,
    // los dos escribirían lo mismo. La caja del raíz mide `100dvh`, y en iOS `innerHeight`
    // incluye la barra del navegador — con la fórmula recibiendo uno y la caja teniendo el
    // otro, la grilla desborda unos píxeles sin que nada falle.
    const chico = nodo(800, 600);
    const grande = nodo(2000, 1200);
    await renderHook(() => useCellPx(chico));
    await renderHook(() => useCellPx(grande));
    expect(chico.current!.style.getPropertyValue('--cell')).toBe('80px');
    expect(grande.current!.style.getPropertyValue('--cell')).toBe('200px');
  });

  it('el piso también llega escrito: nunca por debajo de `CELL_PX_MIN`', async () => {
    const ref = nodo(300, 300);
    await renderHook(() => useCellPx(ref));
    expect(ref.current!.style.getPropertyValue('--cell')).toBe(`${CELL_PX_MIN}px`);
  });

  it('un `resize` la reescribe, y al desmontar el listener se va', async () => {
    const ref = nodo(1000, 600);
    const { unmount } = await renderHook(() => useCellPx(ref));
    expect(ref.current!.style.getPropertyValue('--cell')).toBe('100px');

    // La caja cambia y llega el evento: es el gesto completo de arrastrar el borde.
    // Los DOS ejes, porque manda el más apretado: con la ventana el doble de ancha y el
    // alto quieto, la celda no se mueve — que es lo que dice `cellPxPara` y lo que este
    // test verificaría al revés si sólo tocara uno.
    ref.current!.style.width = '2000px';
    ref.current!.style.height = '1200px';
    window.dispatchEvent(new Event('resize'));
    expect(ref.current!.style.getPropertyValue('--cell')).toBe('200px');

    await unmount();
    // Y después del desmontaje nadie escribe: sin el `removeEventListener`, StrictMode
    // —que monta dos veces— deja dos handlers vivos sobre un nodo que ya no está en el
    // árbol de React.
    ref.current!.style.width = '3000px';
    ref.current!.style.height = '1800px';
    window.dispatchEvent(new Event('resize'));
    expect(ref.current!.style.getPropertyValue('--cell')).toBe('200px');
  });

  it('sin nodo no escribe nada y no explota', async () => {
    // El ref arranca en `null` durante el primer render de cualquier componente que lo cree,
    // así que la guarda no es defensiva: es el caso normal de un montaje abortado.
    const vacio: RefObject<HTMLElement | null> = { current: null };
    await renderHook(() => useCellPx(vacio));
    expect(vacio.current).toBeNull();
  });
});

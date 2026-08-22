import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { useCellPx } from '../use-cell-px.ts';
import { cellPxPara } from '../cell-px.ts';
import { CELL_PX_MIN, CELL_PX_MAX } from '../constants/layout.constants.ts';
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
 *
 * ## Lo que el techo le cambió a este archivo, y por qué se dice acá
 *
 * Con `CELL_PX_MAX === CELL_PX_MIN` el valor escrito es el mismo para cualquier caja, así
 * que los puntos 3 y 4 **dejaron de ser observables por el valor**: un `resize` reescribe
 * 73 sobre 73 y un listener que sobrevive al desmontaje escribe lo mismo que uno que no.
 * La suscripción sigue siendo verificable —y sigue importando, porque es la que se duplica
 * con StrictMode—, así que esos dos se miden sobre `addEventListener` y su limpieza, con
 * el precio dicho: mientras el techo esté donde está, este archivo verifica que el hook se
 * suscriba, no que el número cambie. Aflojar `CELL_PX_MAX` devuelve la otra mitad.
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

afterEach(() => { basura.splice(0).forEach(el => el.remove()); vi.restoreAllMocks(); });

describe('useCellPx', () => {
  it('escribe `--cell` con la unidad puesta, y con el valor de la fórmula', async () => {
    const ref = nodo(1000, 600);
    await renderHook(() => useCellPx(ref));
    // Con la unidad: un `--cell` que valga `73` a secas deja inválido a cada `calc()` que
    // lo consume, y el navegador no dice nada.
    expect(ref.current!.style.getPropertyValue('--cell')).toBe(`${cellPxPara(1000, 600)}px`);
    expect(ref.current!.style.getPropertyValue('--cell')).toBe(`${CELL_PX_MAX}px`);
  });

  it('el mismo número en cajas distintas, que es lo que el techo promete', async () => {
    // Dos nodos de tamaños bien distintos: el de 800x600 daba 80 px antes del techo y el
    // de 2000x1200 daba 200. Hoy los dos dan 73, que es el tamaño de celda de siempre —lo
    // que se pidió— y por eso este test dice lo contrario de lo que decía: la promesa ya
    // no es que la celda crezca con la caja sino que NO crezca.
    const chico = nodo(800, 600);
    const grande = nodo(2000, 1200);
    await renderHook(() => useCellPx(chico));
    await renderHook(() => useCellPx(grande));
    expect(chico.current!.style.getPropertyValue('--cell')).toBe(`${CELL_PX_MAX}px`);
    expect(grande.current!.style.getPropertyValue('--cell')).toBe(`${CELL_PX_MAX}px`);
  });

  it('el piso también llega escrito: nunca por debajo de `CELL_PX_MIN`', async () => {
    const ref = nodo(300, 300);
    await renderHook(() => useCellPx(ref));
    expect(ref.current!.style.getPropertyValue('--cell')).toBe(`${CELL_PX_MIN}px`);
  });

  it('se suscribe al `resize`, y al desmontar el listener se va', async () => {
    const alta = vi.spyOn(window, 'addEventListener');
    const baja = vi.spyOn(window, 'removeEventListener');
    const ref = nodo(1000, 600);
    const { unmount } = await renderHook(() => useCellPx(ref));
    expect(alta.mock.calls.filter(([tipo]) => tipo === 'resize')).toHaveLength(1);

    // El evento llega y el hook no explota: el handler corre sobre un nodo vivo y reescribe
    // la propiedad. Lo que no se puede afirmar acá es que el número cambie — ver el
    // docblock de arriba.
    ref.current!.style.width = '2000px';
    ref.current!.style.height = '1200px';
    window.dispatchEvent(new Event('resize'));
    expect(ref.current!.style.getPropertyValue('--cell')).toBe(`${CELL_PX_MAX}px`);

    await unmount();
    // Sin el `removeEventListener`, StrictMode —que monta dos veces— deja dos handlers
    // vivos sobre un nodo que ya no está en el árbol de React.
    expect(baja.mock.calls.filter(([tipo]) => tipo === 'resize')).toHaveLength(1);
  });

  it('sin nodo no escribe nada y no explota', async () => {
    // El ref arranca en `null` durante el primer render de cualquier componente que lo cree,
    // así que la guarda no es defensiva: es el caso normal de un montaje abortado.
    const vacio: RefObject<HTMLElement | null> = { current: null };
    await renderHook(() => useCellPx(vacio));
    expect(vacio.current).toBeNull();
  });
});

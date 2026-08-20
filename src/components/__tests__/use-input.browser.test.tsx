import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { useAtajosDeTeclado, useRuedaRota } from '../use-input.ts';
import type { RefObject } from 'react';

/**
 * Los dos efectos de entrada del spec 013, con eventos de VERDAD.
 *
 * Es el archivo que mas necesitaba un navegador y el que peor lo tenia: sus decisiones
 * viven en `components/input.ts` —puras, testeadas en node— pero el CABLEADO no, y el
 * cableado es donde estan los dos bugs que sus docblocks describen y que «ningun test
 * atrapa»:
 *
 * 1. **El listener pasivo.** React registra `wheel` pasivo en su contenedor raiz, asi
 *    que con una prop `onWheel` el `preventDefault()` seria un no-op que el navegador
 *    solo avisa por consola: la rueda rotaria y la pagina scrollearia igual, o sea que
 *    **pareceria andar**. Solo un navegador de verdad distingue las dos cosas — jsdom
 *    no modela `passive` en absoluto.
 * 2. **`Ctrl`+rueda reflejando al soltar.** El tap limpio lo escriben los dos hooks, y
 *    si la rueda no lo ensucia ANTES de su propia guarda por `ctrlKey`, el `keyup` del
 *    `Ctrl` lo encuentra limpio y da vuelta la reflexion. Es el gesto que D10 nombra
 *    por su nombre.
 */
const acciones = () => ({ rotar: vi.fn(), reflejar: vi.fn(), transporte: vi.fn() });

/** El ref del tap limpio, que los dos hooks comparten y escriben en las dos direcciones. */
const tap = (v = false): RefObject<boolean> => ({ current: v });

/** Nodos sueltos que hay que sacar del documento al terminar. */
const basura: HTMLElement[] = [];
const enElDocumento = <T extends HTMLElement>(el: T): T => {
  document.body.appendChild(el);
  basura.push(el);
  return el;
};

beforeEach(() => { basura.splice(0).forEach(el => el.remove()); });
afterEach(() => { basura.splice(0).forEach(el => el.remove()); });

/** Un `keydown` + `keyup` del mismo modificador: el gesto completo, que es el que actua. */
async function tap_(target: EventTarget, key: string, init: KeyboardEventInit = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true, ...init }));
}

describe('useAtajosDeTeclado', () => {
  it('Shift rota y Ctrl refleja, al SOLTAR y con el tap limpio', async () => {
    const a = acciones();
    await renderHook(() => useAtajosDeTeclado(a, tap()));

    await tap_(window, 'Shift');
    expect(a.rotar).toHaveBeenCalledTimes(1);
    expect(a.reflejar).not.toHaveBeenCalled();

    await tap_(window, 'Control');
    expect(a.reflejar).toHaveBeenCalledTimes(1);
    expect(a.transporte).not.toHaveBeenCalled();
  });

  it('la barra alterna el transporte y le frena el default (que es scrollear)', async () => {
    const a = acciones();
    await renderHook(() => useAtajosDeTeclado(a, tap()));

    const e = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    window.dispatchEvent(e);
    expect(a.transporte).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
  });

  it('la barra con auto-repeat frena el default pero NO alterna dos veces', async () => {
    // Las dos preguntas son distintas a proposito: no hay accion, pero cada `keydown`
    // repetido trae su propio default de scrollear.
    const a = acciones();
    await renderHook(() => useAtajosDeTeclado(a, tap()));

    const e = new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true, cancelable: true });
    window.dispatchEvent(e);
    expect(a.transporte).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
  });

  it('sobre un boton o un input, el evento es del navegador y no nuestro', async () => {
    // Es lo que deja que la barra active el boton que tiene el foco en vez de alternar
    // el transporte dos veces. Las dos ramas de `esControl`, por separado.
    const a = acciones();
    await renderHook(() => useAtajosDeTeclado(a, tap()));

    for (const el of [document.createElement('button'), document.createElement('input')]) {
      enElDocumento(el);
      const e = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      expect(e.defaultPrevented, el.tagName).toBe(false);
    }
    expect(a.transporte).not.toHaveBeenCalled();
  });

  it('una tecla cualquiera ensucia el tap: Ctrl+C no da vuelta la reflexion', async () => {
    const a = acciones();
    const t = tap(true);
    await renderHook(() => useAtajosDeTeclado(a, t));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true, bubbles: true }));
    expect(t.current).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));
    expect(t.current).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', bubbles: true }));
    expect(a.reflejar).not.toHaveBeenCalled();
  });

  it('una tecla sin accion no llama a nadie', async () => {
    const a = acciones();
    await renderHook(() => useAtajosDeTeclado(a, tap()));
    await tap_(window, 'q');
    expect(a.rotar).not.toHaveBeenCalled();
    expect(a.reflejar).not.toHaveBeenCalled();
    expect(a.transporte).not.toHaveBeenCalled();
  });

  it('al desmontar suelta window: nada queda escuchando', async () => {
    const a = acciones();
    const { unmount } = await renderHook(() => useAtajosDeTeclado(a, tap()));
    await unmount();

    await tap_(window, 'Shift');
    expect(a.rotar).not.toHaveBeenCalled();
  });
});

describe('useRuedaRota', () => {
  const tablero = () => enElDocumento(document.createElement('div'));

  const rueda = (el: HTMLElement, init: WheelEventInit) => {
    const e = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
    el.dispatchEvent(e);
    return e;
  };

  it('la rueda rota Y FRENA EL SCROLL — el listener no es pasivo', async () => {
    const el = tablero();
    const alRotar = vi.fn();
    await renderHook(() => useRuedaRota({ current: el }, alRotar, tap()));

    const e = rueda(el, { deltaY: 120 });
    expect(alRotar).toHaveBeenCalledWith(120);
    // La linea que separa "anda" de "parece que anda": con `wheel` registrado por una
    // prop de JSX el listener seria PASIVO y esto seria `false`, con la pagina
    // scrolleando debajo de la pieza que rota.
    expect(e.defaultPrevented).toBe(true);
  });

  it('Ctrl+rueda es el zoom del navegador: no rota, no frena el default', async () => {
    const el = tablero();
    const alRotar = vi.fn();
    const t = tap(true);
    await renderHook(() => useRuedaRota({ current: el }, alRotar, t));

    const e = rueda(el, { deltaY: 120, ctrlKey: true });
    expect(alRotar).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
    // Y AUN ASI ensucia el tap, que es todo el punto: si no lo hiciera, el `keyup` del
    // `Ctrl` encontraria el tap limpio y reflejaria la pieza al soltar.
    expect(t.current).toBe(false);
  });

  it('un scroll horizontal puro no rota ni le saca el scroll al tablero', async () => {
    // Este nodo es el `overflow-x-auto` con el que se recorre la grilla debajo de `md`:
    // frenarle el default seria dejar sin scroll horizontal al unico que lo tiene.
    const el = tablero();
    const alRotar = vi.fn();
    await renderHook(() => useRuedaRota({ current: el }, alRotar, tap()));

    const e = rueda(el, { deltaX: 80, deltaY: 0 });
    expect(alRotar).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it('sin nodo todavia, no se suscribe a nada y no falla', async () => {
    const alRotar = vi.fn();
    const ref: RefObject<HTMLDivElement | null> = { current: null };
    await renderHook(() => useRuedaRota(ref, alRotar, tap()));
    // El ref se llena despues del primer render en un montaje real; lo que se afirma es
    // que ese primer paso no explota ni deja un listener colgado de `null`.
    expect(alRotar).not.toHaveBeenCalled();
  });

  it('al desmontar suelta el nodo', async () => {
    const el = tablero();
    const alRotar = vi.fn();
    const { unmount } = await renderHook(() => useRuedaRota({ current: el }, alRotar, tap()));
    await unmount();

    const e = rueda(el, { deltaY: 120 });
    expect(alRotar).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });
});

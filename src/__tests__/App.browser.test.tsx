import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { GRID_W } from '../domain/constants/board.constants.ts';
import { SHAPES, ANCHOR_INDEX } from '../domain/constants/pieces.constants.ts';
import { REGIMEN } from '../domain/constants/music.constants.ts';
import { DEFAULT_BPM } from '../audio/constants/engine.constants.ts';
import { arpeggioFor } from '../domain/music.ts';
import { cellsAt } from '../domain/board.ts';
import { rotateN, reflect } from '../domain/transform.ts';
import type { PieceKey } from '../domain/types/pieces.types.ts';

/**
 * El shell, entero y en un navegador.
 *
 * Desde el spec 022 `App.tsx` no tiene un solo `useEffect` —los seis viven en
 * `use-engine.ts` y `use-input.ts`— pero sigue siendo dueño de TODO el estado y de los
 * handlers que lo mueven, y eso es lo que no verificaba nada: el gesto de colocar, las
 * tres formas de editar en el tablero (spec 014), cuándo se dispara el arpegio de
 * cortesía y cuándo no, y las tres derivaciones que AC15 del 017 obliga a llevar el
 * régimen.
 *
 * El motor va mockeado con un doble que RECUERDA si arrancó: es lo que hace verificable
 * que el botón de transporte refleje si el reloj arrancó de verdad y no si se lo apretó
 * —el ítem AC10 del spec 008, que esperó catorce specs—. Todo lo demás es real: el
 * dominio, los tres componentes y el DOM.
 */
const motor = vi.hoisted(() => {
  const estado = { corriendo: false };
  return {
    estado,
    setSequence: vi.fn(),
    setBpm: vi.fn(),
    setClicksAudible: vi.fn(),
    startClock: vi.fn(() => { estado.corriendo = true; }),
    stopClock: vi.fn(() => { estado.corriendo = false; }),
    clockRunning: vi.fn(() => estado.corriendo),
    playNow: vi.fn(),
    playNotes: vi.fn(),
    playheadOffset: () => null,
    readSpectrum: () => null,
    cycleGeneration: () => 0,
  };
});
vi.mock('../audio/engine.ts', () => motor);

const App = (await import('../App.tsx')).default;

beforeEach(() => {
  motor.estado.corriendo = false;
  for (const v of Object.values(motor)) if (typeof v === 'function' && 'mockClear' in v) v.mockClear();
});

/** Las 60 celdas del tablero, en orden de indice. */
const celdas = (c: HTMLElement) => [...c.querySelectorAll('div.grid.w-max > div')] as HTMLElement[];
const celda = (c: HTMLElement, x: number, y: number) => celdas(c)[y * GRID_W + x];
const baldosa = (el: HTMLElement) => el.firstElementChild as HTMLElement;

/** Donde caen las celdas de una pieza colocada con el ancla en (x, y). */
const donde = (piece: PieceKey, x: number, y: number, rot = 0, mirror = false) => {
  const base = rotateN(SHAPES[piece], rot);
  return cellsAt(mirror ? reflect(base) : base, ANCHOR_INDEX[piece], x, y);
};

/** Cuantas celdas del tablero tienen texto: una por celda de pieza colocada. */
const conNota = (c: HTMLElement) => celdas(c).filter(e => baldosa(e).textContent !== '').length;

const hover = (el: HTMLElement) => el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
const click = (el: HTMLElement, init: MouseEventInit = {}) =>
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }));

describe('App — la composicion', () => {
  it('monta las tres tarjetas y el pie con los gestos', async () => {
    const { container } = await render(<App />);
    expect(container.textContent).toContain('Piezas');
    expect(container.textContent).toContain('Señal');
    // El pie decia el modelo y no mencionaba un solo gesto, que es lo que hacia
    // invisibles a los atajos del 013.
    expect(container.textContent).toContain('Rueda sobre el tablero');
    expect(container.textContent).toContain('arranca y para');
    expect(celdas(container).length).toBe(60);
  });

  it('arranca con el tempo del motor y el regimen de siempre', async () => {
    // `DEFAULT_BPM` es una sola declaracion: el estado del shell y el del motor no
    // pueden discrepar porque salen del mismo numero.
    const { container } = await render(<App />);
    expect(container.textContent).toContain(String(DEFAULT_BPM));
    // Abrir la app suena como sonaba (AC11 del 017).
    await expect.element(page.getByRole('button', { name: REGIMEN.escala })).toHaveClass(/bg-slate-900/);
  });
});

describe('App — colocar', () => {
  it('el click coloca la pieza en la mano y dispara su arpegio', async () => {
    const { container } = await render(<App />);
    click(celda(container, 3, 2));

    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.F.length));
    // El click es la unica forma inmediata de escuchar la pieza: con D5 del 009 la
    // pieza nueva ni siquiera entra al recorrido que esta sonando.
    expect(motor.playNow).toHaveBeenCalledWith(arpeggioFor('F', 0, false, REGIMEN.escala));
  });

  it('con el transporte corriendo NO lo dispara: seria el arpegio dos veces', async () => {
    const { container } = await render(<App />);
    await page.getByRole('button', { name: 'Reproducir' }).click();
    motor.playNow.mockClear();

    click(celda(container, 3, 2));
    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.F.length));
    expect(motor.playNow).not.toHaveBeenCalled();
  });

  it('`Alt`+click coloca MUTEADA, y tampoco suena', async () => {
    // La pieza se pone justamente para que no suene: un arpegio de cortesia
    // contradiria el gesto en el momento de hacerlo.
    const { container } = await render(<App />);
    click(celda(container, 3, 2), { altKey: true });

    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.F.length));
    expect(motor.playNow).not.toHaveBeenCalled();
    // Y se ve: la baldosa muteada cae al blanco conservando su nota.
    const [x, y] = donde('F', 3, 2)[0];
    expect(baldosa(celda(container, x, y)).className).toContain('bg-white');
  });

  it('una jugada invalida no coloca nada', async () => {
    const { container } = await render(<App />);
    // Contra el borde: parte de la `F` cae fuera del tablero.
    click(celda(container, 0, 0));
    await new Promise(r => setTimeout(r, 30));
    expect(conNota(container)).toBe(0);
    expect(motor.playNow).not.toHaveBeenCalled();
  });
});

describe('App — editar en el tablero (spec 014)', () => {
  const conUnaF = async () => {
    const vista = await render(<App />);
    click(celda(vista.container, 3, 2));
    await vi.waitFor(() => expect(conNota(vista.container)).toBe(SHAPES.F.length));
    motor.playNow.mockClear();
    return vista;
  };

  it('el click sobre la pieza propia la QUITA', async () => {
    const { container } = await conUnaF();
    const [x, y] = donde('F', 3, 2)[0];
    click(celda(container, x, y));
    await vi.waitFor(() => expect(conNota(container)).toBe(0));
  });

  it('`Alt`+click sobre la pieza propia alterna su muteo, ida y vuelta', async () => {
    const { container } = await conUnaF();
    const [x, y] = donde('F', 3, 2)[0];

    click(celda(container, x, y), { altKey: true });
    await vi.waitFor(() => expect(baldosa(celda(container, x, y)).className).toContain('bg-white'));
    // Objeto nuevo y no mutacion: la pieza sigue en el tablero con sus cinco celdas.
    expect(conNota(container)).toBe(SHAPES.F.length);

    click(celda(container, x, y), { altKey: true });
    await vi.waitFor(() => expect(baldosa(celda(container, x, y)).style.background).not.toBe(''));
  });

  it('mutear una pieza no toca a las demas', async () => {
    // El `map` devuelve la MISMA referencia para las que no cambian, y objetos nuevos
    // solo para la que se muteo: nunca mutar lo que ya se entrego a React.
    const { container } = await conUnaF();
    click(celda(container, 8, 3));   // una segunda `F`, lejos de la primera
    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.F.length * 2));

    const [x1, y1] = donde('F', 3, 2)[0];
    const [x2, y2] = donde('F', 8, 3)[0];
    click(celda(container, x1, y1), { altKey: true });

    await vi.waitFor(() => expect(baldosa(celda(container, x1, y1)).className).toContain('bg-white'));
    // La otra sigue con su color: el muteo es de una pieza, no del tablero.
    expect(baldosa(celda(container, x2, y2)).style.background).not.toBe('');
    expect(conNota(container)).toBe(SHAPES.F.length * 2);
  });

  it('sobre una pieza que NO esta en la mano no pasa nada', async () => {
    const { container } = await conUnaF();
    // Se cambia la pieza en la mano y se vuelve a apretar la `F` colocada.
    await page.getByRole('button', { name: 'W, rotación 0°' }).click();
    const [x, y] = donde('F', 3, 2)[0];
    click(celda(container, x, y));

    await new Promise(r => setTimeout(r, 30));
    expect(conNota(container)).toBe(SHAPES.F.length);
  });
});

describe('App — el fantasma', () => {
  it('aparece bajo el cursor y desaparece al salir del tablero', async () => {
    const { container } = await render(<App />);
    hover(celda(container, 4, 3));
    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.F.length));

    container.querySelector('div.grid.w-max')!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    await vi.waitFor(() => expect(conNota(container)).toBe(0));
  });

  it('sobre la pieza propia NO se pinta: ahi el click edita, no coloca', async () => {
    // Saldria rosa entero, diciendo "aca no entra" sobre la unica celda donde el click
    // si hace algo (AC20 del 014).
    const { container } = await render(<App />);
    click(celda(container, 3, 2));
    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.F.length));

    const [x, y] = donde('F', 3, 2)[0];
    hover(celda(container, x, y));
    await new Promise(r => setTimeout(r, 30));
    // Sigue habiendo cinco celdas con nota —las de la pieza— y ninguna rosa de choque.
    expect(conNota(container)).toBe(SHAPES.F.length);
    expect(container.querySelectorAll('.bg-rose-500').length).toBe(0);
    // Y el cursor dice que ahi se puede apretar.
    expect(celda(container, x, y).className).toContain('cursor-pointer');
  });
});

describe('App — el transporte', () => {
  it('el boton refleja si el reloj ARRANCO, no si se lo apreto', async () => {
    // AC10 del spec 008, que espero catorce specs: la decision vive en
    // `alternarTransporte` y aca se verifica el cableado contra un motor que contesta.
    const { container } = await render(<App />);
    await page.getByRole('button', { name: 'Reproducir' }).click();
    expect(motor.startClock).toHaveBeenCalled();
    await expect.element(page.getByRole('button', { name: 'Pausa' })).toBeVisible();

    await page.getByRole('button', { name: 'Pausa' }).click();
    expect(motor.stopClock).toHaveBeenCalled();
    await expect.element(page.getByRole('button', { name: 'Reproducir' })).toBeVisible();
    expect(container).toBeTruthy();
  });

  it('si el motor NO arranca, el boton se queda en Reproducir', async () => {
    // Sin Web Audio `startClock` no arranca nada. Creerle a lo que se pidio dejaria el
    // boton diciendo que suena algo que no suena.
    motor.startClock.mockImplementationOnce(() => {});
    await render(<App />);
    await page.getByRole('button', { name: 'Reproducir' }).click();
    await expect.element(page.getByRole('button', { name: 'Reproducir' })).toBeVisible();
  });

  it('Reset frena el transporte ADEMAS de vaciar el tablero', async () => {
    // Vaciar solo `placed` deja al motor terminando su ciclo activo: hasta 7,5 s sonando
    // sobre un tablero que ya esta vacio.
    const { container } = await render(<App />);
    click(celda(container, 3, 2));
    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.F.length));
    await page.getByRole('button', { name: 'Reproducir' }).click();
    motor.stopClock.mockClear();

    await page.getByRole('button', { name: 'Reset' }).click();
    expect(motor.stopClock).toHaveBeenCalled();
    await vi.waitFor(() => expect(conNota(container)).toBe(0));
    await expect.element(page.getByRole('button', { name: 'Reproducir' })).toBeVisible();
  });

  it('el tempo y los clicks bajan al motor', async () => {
    await render(<App />);
    await page.getByRole('slider').fill('128');
    await vi.waitFor(() => expect(motor.setBpm).toHaveBeenLastCalledWith(128));

    const { container } = await render(<App />);
    const recorrido = [...container.querySelectorAll('div.flex.items-center.justify-between')]
      .find(d => d.textContent!.startsWith('Recorrido en el vacío'))!
      .querySelector('button')!;
    recorrido.click();
    await vi.waitFor(() => expect(motor.setClicksAudible).toHaveBeenLastCalledWith(true));
  });
});

describe('App — la orientacion, por panel y por gesto', () => {
  /** La nota que muestra la primera celda del fantasma: cambia con la orientacion. */
  const notaDelFantasma = (c: HTMLElement) => {
    const conTexto = celdas(c).filter(e => baldosa(e).textContent !== '');
    return conTexto.map(e => e.getAttribute('title')).join('|');
  };

  it('el panel rota y refleja, y el tablero lo muestra', async () => {
    const { container } = await render(<App />);
    hover(celda(container, 4, 3));
    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.F.length));
    const antes = notaDelFantasma(container);

    await page.getByRole('button', { name: /^90°$/ }).click();
    hover(celda(container, 4, 3));
    await vi.waitFor(() => expect(notaDelFantasma(container)).not.toBe(antes));

    // La reflexion no cambia la NOTA de una celda, cambia el orden en que suenan: lo
    // que se mueve es el `#N`.
    const conRotacion = notaDelFantasma(container);
    const reflexion = [...container.querySelectorAll('div.flex.items-center.justify-between')]
      .find(d => d.textContent!.startsWith('Reflexión'))!.querySelector('button')!;
    reflexion.click();
    hover(celda(container, 4, 3));
    await vi.waitFor(() => expect(notaDelFantasma(container)).not.toBe(conRotacion));
  });

  it('el regimen cambia lo que la rotacion HACE, y se ve en el fantasma', async () => {
    // AC7 del 017: sin llevar el regimen a las tres derivaciones, cambiarlo no
    // re-derivaria el tablero.
    const { container } = await render(<App />);
    await page.getByRole('button', { name: /^90°$/ }).click();
    hover(celda(container, 4, 3));
    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.F.length));
    const enEscala = notaDelFantasma(container);

    await page.getByRole('button', { name: REGIMEN.orden }).click();
    hover(celda(container, 4, 3));
    await vi.waitFor(() => expect(notaDelFantasma(container)).not.toBe(enEscala));
  });

  it('`Shift` rota, `Ctrl` refleja y la barra alterna el transporte', async () => {
    const { container } = await render(<App />);
    hover(celda(container, 4, 3));
    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.F.length));
    const antes = notaDelFantasma(container);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));
    hover(celda(container, 4, 3));
    await vi.waitFor(() => expect(notaDelFantasma(container)).not.toBe(antes));

    const conRotacion = notaDelFantasma(container);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', bubbles: true }));
    hover(celda(container, 4, 3));
    await vi.waitFor(() => expect(notaDelFantasma(container)).not.toBe(conRotacion));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(motor.startClock).toHaveBeenCalled());
  });

  it('la rueda sobre el tablero rota, y `Ctrl`+rueda no', async () => {
    const { container } = await render(<App />);
    const tablero = container.querySelector('div.relative.overflow-x-auto')! as HTMLElement;
    hover(celda(container, 4, 3));
    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.F.length));
    const antes = notaDelFantasma(container);

    tablero.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
    hover(celda(container, 4, 3));
    await vi.waitFor(() => expect(notaDelFantasma(container)).not.toBe(antes));

    // El zoom del navegador es una afordancia de accesibilidad: un gesto del sistema le
    // gana a uno nuestro.
    const conRueda = notaDelFantasma(container);
    tablero.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, ctrlKey: true, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 30));
    hover(celda(container, 4, 3));
    await new Promise(r => setTimeout(r, 30));
    expect(notaDelFantasma(container)).toBe(conRueda);
  });

  it('el boton derecho refleja, salvo el `Ctrl`+click de macOS', async () => {
    const { container } = await render(<App />);
    const tablero = container.querySelector('div.relative.overflow-x-auto')! as HTMLElement;
    hover(celda(container, 4, 3));
    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.F.length));
    const antes = notaDelFantasma(container);

    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    tablero.dispatchEvent(menu);
    // El menu contextual no se abre NUNCA sobre el tablero.
    expect(menu.defaultPrevented).toBe(true);
    hover(celda(container, 4, 3));
    await vi.waitFor(() => expect(notaDelFantasma(container)).not.toBe(antes));

    // En macOS `Ctrl`+click llega como `contextmenu` con `ctrlKey`, y ahi el que alterna
    // es el `keyup` del `Ctrl`: contar los dos daria neto cero y la reflexion no
    // respondería nunca en una laptop de Apple sin mouse.
    const conReflexion = notaDelFantasma(container);
    tablero.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, ctrlKey: true }));
    await new Promise(r => setTimeout(r, 30));
    hover(celda(container, 4, 3));
    await new Promise(r => setTimeout(r, 30));
    expect(notaDelFantasma(container)).toBe(conReflexion);
  });

  it('elegir otra pieza cambia lo que hay en la mano', async () => {
    const { container } = await render(<App />);
    await page.getByRole('button', { name: 'I, rotación 0°' }).click();
    hover(celda(container, 4, 3));
    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.I.length));
    expect(container.textContent).toContain('tónica');
  });
});

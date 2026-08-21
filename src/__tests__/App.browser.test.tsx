import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import { GRID_W } from '../domain/constants/board.constants.ts';
import { SHAPES, ANCHOR_INDEX } from '../domain/constants/pieces.constants.ts';
import { REGIMEN } from '../domain/constants/music.constants.ts';
import { DEFAULT_BPM } from '../audio/constants/engine.constants.ts';
import { arpeggioFor } from '../domain/music.ts';
import { cellsAt } from '../domain/board.ts';
import { rotateN, reflect } from '../domain/transform.ts';
import type { PieceKey } from '../domain/types/pieces.types.ts';
import type { ReactNode } from 'react';
import type { PropsDeOrientacion } from '../components/types/panel.types.ts';

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

/**
 * Cuantas veces se EJECUTA el panel de las doce miniaturas (AC6 y AC7 del spec 027).
 *
 * `hover` vive en `App.tsx`, asi que cada celda que el cursor cruza re-renderiza el arbol
 * entero — y `OrientationPanel` son 337 elementos (1 grilla + 12 x (boton + grilla + 25
 * celdas + span), con `MINI_BOX = 5`) de los que ninguno depende del hover. Antes del memo
 * de este spec eran DIEZ ejecuciones al cruzar diez celdas, una por celda.
 *
 * Se instrumenta DESDE ACA y no metiendo un contador en el componente: un contador adentro
 * seria codigo de produccion que existe para el test.
 *
 * ## Por que el contador va ADENTRO del `memo` y no envolviendolo
 *
 * `real.default` es un `memo` y `.type` es la funcion que tiene adentro; el mock cuenta ahi
 * y vuelve a envolver en `memo`, o sea que reproduce la misma barrera que el componente
 * real y mide lo que pasa detras de ella.
 *
 * La forma obvia —una funcion sin memoizar que renderiza `<Real {...props} />`— esta
 * medida y MIENTE: da diez con el panel memoizado y diez sin memoizar, porque lo que cuenta
 * es el envoltorio, que nunca esta detras de la barrera. Es exactamente el modo de falla
 * que este repo persigue, un oraculo verde midiendo otra cosa.
 *
 * React expone `.type` en runtime pero sus tipos no —`memo(fn)` resuelve a
 * `NamedExoticComponent`, que no lo declara—, asi que se estrecha con un chequeo de verdad
 * y no con un `as`: el dia que alguien saque el `memo`, el mock no adivina, tira con el
 * motivo puesto.
 *
 * El mock es de archivo y el contador sube tambien durante los otros tests: el que mide lo
 * pone en cero antes de montar.
 */
const panel = vi.hoisted(() => ({ ejecuciones: 0 }));
vi.mock('../components/OrientationPanel.tsx', async (importActual) => {
  const real = await importActual<typeof import('../components/OrientationPanel.tsx')>();
  const { memo } = await import('react');
  const memoizado = (c: unknown): c is { type: (props: { orientacion: PropsDeOrientacion }) => ReactNode } =>
    typeof c === 'object' && c !== null && 'type' in c && typeof c.type === 'function';
  if (!memoizado(real.default)) {
    throw new Error('OrientationPanel dejo de estar memoizado: la medicion del spec 027 pasaria a medir el envoltorio.');
  }
  const interior = real.default.type;
  return {
    default: memo((props: { orientacion: PropsDeOrientacion }) => {
      panel.ejecuciones++;
      return interior(props);
    }),
  };
});

const App = (await import('../App.tsx')).default;

beforeEach(() => {
  motor.estado.corriendo = false;
  for (const v of Object.values(motor)) if (typeof v === 'function' && 'mockClear' in v) v.mockClear();
});

/**
 * Las 60 celdas del tablero, en orden de indice.
 *
 * Por ROL y no por estructura desde el spec 026: la grilla dejo de ser 60 hijos planos y
 * paso a ser seis `role="row"` de diez, asi que `div.grid.w-max > div` devuelve seis.
 */
const celdas = (c: HTMLElement) => [...c.querySelectorAll('[role="gridcell"]')] as HTMLElement[];
const celda = (c: HTMLElement, x: number, y: number) => celdas(c)[y * GRID_W + x];
const baldosa = (el: HTMLElement) => el.firstElementChild as HTMLElement;

/** Donde caen las celdas de una pieza colocada con el ancla en (x, y). */
const donde = (piece: PieceKey, x: number, y: number, rot = 0, mirror = false) => {
  const base = rotateN(SHAPES[piece], rot);
  return cellsAt(mirror ? reflect(base) : base, ANCHOR_INDEX[piece], x, y);
};

/** Cuantas celdas del tablero tienen texto: una por celda de pieza colocada. */
const conNota = (c: HTMLElement) => celdas(c).filter(e => baldosa(e).textContent !== '').length;

/**
 * Lo que dice el fantasma, celda por celda: cambia con la rotacion (otra nota) y con la
 * reflexion (otro `#N`). Vive a nivel de modulo y no adentro de un `describe` porque lo
 * leen los dos escritores del cursor —el mouse y el foco del teclado—, que estan en
 * bloques distintos; dos copias serian dos formas de medir el mismo fantasma distinto.
 */
const notaDelFantasma = (c: HTMLElement) => {
  const conTexto = celdas(c).filter(e => baldosa(e).textContent !== '');
  return conTexto.map(e => e.getAttribute('title')).join('|');
};

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
    const tablero = container.querySelector('div.relative.overflow-x-auto')!;
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
    const tablero = container.querySelector('div.relative.overflow-x-auto')!;
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

describe('App — lo que llega al arbol de accesibilidad', () => {
  it('ningun boton de la app puede enviar un formulario', async () => {
    // Hoy no hay un solo `<form>` en el arbol, asi que no hay bug — y por eso mismo
    // esta es la unica linea del spec 025 que nada mas falsea: existe para una
    // regresion futura. El default de un `<button>` dentro de un formulario es
    // `submit`, y en esta app eso significa recargar la pagina perdiendo el tablero
    // entero, sin deshacer (`specs/deuda.md`).
    //
    // Se afirma sobre la app COMPLETA y no componente por componente porque los 22
    // botones salen de tres archivos —doce miniaturas, ocho de la tarjeta, dos de
    // transporte— y ninguno de los tres los tiene todos.
    const { container } = await render(<App />);
    const botones = [...container.querySelectorAll('button')];
    expect(botones.length).toBe(22);
    for (const boton of botones) {
      expect(boton.getAttribute('type'), boton.textContent ?? '').toBe('button');
    }
  });
});

describe('App — lo que cuesta mover el cursor (spec 027)', () => {
  /** Diez celdas interiores: dos filas de cinco, con el fantasma entero adentro del tablero. */
  const RECORRIDO = [2, 3].flatMap(y => [1, 2, 3, 4, 5].map(x => [x, y] as const));

  /** La huella del fantasma: que celdas del tablero tienen nota, como un mapa de bits. */
  const huella = (c: HTMLElement) => celdas(c).map(e => (baldosa(e).textContent === '' ? '0' : '1')).join('');

  it('cruzar diez celdas ya no ejecuta el panel de orientacion, y rotar si', async () => {
    panel.ejecuciones = 0;
    const { container } = await render(<App />);
    // El render inicial se cuenta APARTE, y es lo que vuelve falsificable el cero de abajo:
    // un panel que no se ejecutara nunca —o un mock roto— tambien daria cero.
    expect(panel.ejecuciones).toBe(1);
    panel.ejecuciones = 0;

    // Se espera a que el fantasma se REPINTE antes de mover el cursor otra vez, y no es
    // ceremonia: `mouseover` es un evento CONTINUO, asi que React 19 agenda su re-render en
    // prioridad default y dos despachos seguidos se cobran como uno solo. Medido con un
    // `setTimeout(0)` entre medio: daban 8 de 10, o sea el test contando menos trabajo del
    // que paga un cursor de verdad, que cruza una celda por cuadro dibujado.
    const huellas = new Set<string>();
    let antes = huella(container);
    for (const [x, y] of RECORRIDO) {
      hover(celda(container, x, y));
      await vi.waitFor(() => expect(huella(container)).not.toBe(antes));
      antes = huella(container);
      huellas.add(antes);
    }

    // Diez posiciones distintas del fantasma, o sea DIEZ re-renders del arbol: el shell
    // trabajo las diez veces, que es la mitad del sistema que este numero mide.
    expect(huellas.size).toBe(RECORRIDO.length);
    expect(conNota(container)).toBe(SHAPES.F.length);
    // Y el panel no se ejecuto una sola vez. Antes del `memo` eran diez, una por celda:
    // 3.370 elementos reconciliados para llegar al mismo DOM.
    expect(panel.ejecuciones).toBe(0);

    // La memo no lo congelo: cuando la orientacion cambia DE VERDAD, se ejecuta. Sin esta
    // mitad, el cero de arriba lo cumpliria igual un panel roto.
    await page.getByRole('button', { name: /^90°$/ }).click();
    await vi.waitFor(() => expect(panel.ejecuciones).toBe(1));
  });
});

/**
 * El teclado sobre el SHELL entero (spec 026).
 *
 * `Board.browser.test.tsx` ya verifica el roving tabindex, las flechas, `Home`/`End` y las
 * cuatro acciones contra un `Board` suelto y con props fijas. Lo que solo existe ACA es lo
 * que necesita la pagina completa: el `Tab` que entra desde la paleta y sale en uno solo,
 * el listener global de `window` —que es de quien el tablero le saca la barra sin apagarle
 * `Shift` ni `Ctrl`—, el desempate entre el foco y el mouse por el mismo `hover`, y la
 * region `aria-live`, que es del shell porque es el shell el que sabe que edicion ocurrio.
 *
 * Los eventos van despachados SOBRE EL NODO de la celda y con `bubbles`, no sobre `window`:
 * el listener global mira `e.target.closest('[role="gridcell"]')`, y un
 * `window.dispatchEvent(...)` llega con `target === window`, que no es ninguna celda. O sea
 * que despachar en `window` verificaria el caso contrario al que dice verificar.
 */
const tecla = (el: Element, key: string, init: KeyboardEventInit = {}) => {
  const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(evento);
  return evento;
};

/**
 * El gesto COMPLETO de un modificador: son dos eventos y no uno. El `keydown` abre el tap
 * limpio y el `keyup` es el que alterna, para que `Ctrl`+C no de vuelta la reflexion.
 */
const tapDeModificador = (el: Element, key: string) => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
};

/** El tablero, entero a la vista: lo que scrollea despues es la tecla y no el `.focus()`. */
const aLaVista = (c: HTMLElement) =>
  c.querySelector('div.relative.overflow-x-auto')!.scrollIntoView({ block: 'center' });

describe('App — el tablero se toca con el teclado (spec 026)', () => {
  it('desde la paleta, UN `Tab` entra al tablero y otro lo pasa de largo', async () => {
    // `Tab` de VERDAD, por Playwright, y no el conteo de cuantas celdas tienen `tabIndex`
    // distinto de -1: las dos cosas no son la misma. El conteo mide el DOM y seria cierto
    // igual con el `0` sobre una celda que el navegador se saltea; lo que AC1 y AC12
    // afirman es lo que hace el navegador con el ORDEN DE TABULACION, que es lo unico que
    // convierte —o no— a la tarjeta del tablero en una trampa de salida.
    const { container } = await render(<App />);
    const ancla = celdas(container).find(c => c.tabIndex === 0)!;

    // El control de la paleta que esta JUSTO antes del tablero, tomado del orden del DOM y
    // no por su nombre: asi agregarle un boton a la paleta no rompe este test.
    const paradas = [...container.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]')];
    paradas[paradas.indexOf(ancla) - 1].focus();

    await userEvent.tab();
    expect(document.activeElement).toBe(ancla);

    // Y una sola pulsacion mas lo deja atras. Con sesenta paradas esta linea aterrizaria en
    // la celda (1,0) y todo lo que viene detras del tablero quedaria a sesenta `Tab`.
    await userEvent.tab();
    expect(celdas(container)).not.toContain(document.activeElement);
  });

  it('las flechas mueven el foco del DOM, y la pagina NO scrollea', async () => {
    // Teclas de VERDAD, por Playwright, y esa es toda la razon de ser de este test: un
    // `dispatchEvent` fabrica un evento NO confiable, y un evento no confiable **nunca
    // ejecuta la accion por default** — con lo que "la pagina no scrolleo" seria cierto
    // aunque `preventDefault` no existiera. Es exactamente el modo de falla que este repo
    // persigue, una afirmacion verde que no puede ponerse en rojo. `Board.browser.test.tsx`
    // ya verifica el `preventDefault` con eventos sinteticos, que ahi si es el oraculo
    // correcto porque lo que afirma es lo que hace el HANDLER; lo que se afirma aca es lo
    // que hace el NAVEGADOR, y para eso la tecla tiene que ser real.
    const { container } = await render(<App />);
    aLaVista(container);
    const origen = celda(container, 4, 2);
    origen.focus();

    // Y la pagina tiene de donde scrollear: sin esto, el par del final seria trivialmente
    // cierto tambien con una tecla real, por no haber margen que perder.
    expect(document.documentElement.scrollHeight)
      .toBeGreaterThan(document.documentElement.clientHeight);
    const antes = [document.documentElement.scrollTop, document.documentElement.scrollLeft];

    await new Promise(r => setTimeout(r, 60));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(celda(container, 5, 2));
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(celda(container, 5, 3));
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(celda(container, 4, 3));
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(origen);

    // El default de las cuatro es scrollear, y el tablero mide seis filas: cuatro flechas
    // sin frenar se lo llevan de la pantalla mientras el foco sigue adentro.
    expect([document.documentElement.scrollTop, document.documentElement.scrollLeft])
      .toEqual(antes);
  });

  it('`Home` y `End` van a los extremos de SU fila, sin salirse de ella', async () => {
    const { container } = await render(<App />);
    aLaVista(container);
    const media = celda(container, 5, 3);
    media.focus();

    expect(tecla(media, 'End').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(celda(container, GRID_W - 1, 3));
    tecla(celda(container, GRID_W - 1, 3), 'Home');
    expect(document.activeElement).toBe(celda(container, 0, 3));
    // Y en el extremo se queda: `Home` no salta a la fila de arriba, que es lo que haria
    // si el par mirara el tablero entero en vez de la fila.
    tecla(celda(container, 0, 3), 'Home');
    expect(document.activeElement).toBe(celda(container, 0, 3));
  });

  it('`Enter` coloca, `Enter` sobre la pieza propia la quita, `Alt`+`Enter` mutea — y la region lo dice', async () => {
    // Las cuatro entran por el MISMO `onCellClick` que el click, o sea por `accionDeClick`:
    // lo que se verifica aca es que el shell las reciba iguales y que la region `aria-live`
    // cuente la edicion que el tablero acaba de aplicar y no la que se pidio.
    //
    // El oraculo del tablero es el NOMBRE ACCESIBLE de la celda y no cuantas tienen texto:
    // con el foco puesto, la celda enfocada ES `hover`, asi que el fantasma pinta cinco
    // celdas con texto tambien sobre el tablero vacio. `cellNameFor` no las confunde —una
    // celda con fantasma se llama "libre", igual que una sin nada.
    const { container } = await render(<App />);
    const conPieza = () => celdas(container).filter(e => e.getAttribute('aria-label')!.includes('pieza')).length;
    const dicho = () => container.querySelector('[aria-live="polite"]')!.textContent;
    const c = celda(container, 3, 2);
    c.focus();

    tecla(c, 'Enter');
    await vi.waitFor(() => expect(conPieza()).toBe(SHAPES.F.length));
    expect(dicho()).toBe('pieza F colocada en fila 3, columna 4');

    tecla(c, 'Enter');
    await vi.waitFor(() => expect(conPieza()).toBe(0));
    expect(dicho()).toBe('pieza F quitada de fila 3, columna 4');

    // `Alt` significa "muteado" en los dos lados del gesto, tambien con el teclado.
    const [mx, my] = donde('F', 3, 2)[0];
    tecla(c, 'Enter', { altKey: true });
    await vi.waitFor(() => expect(baldosa(celda(container, mx, my)).className).toContain('bg-white'));
    expect(conPieza()).toBe(SHAPES.F.length);
    expect(dicho()).toBe('pieza F colocada muteada en fila 3, columna 4');

    // Y sobre una pieza YA muteada la devuelve al sonido: el anuncio dice el estado en el
    // que la pieza QUEDA, no que tecla se apreto.
    tecla(c, 'Enter', { altKey: true });
    await vi.waitFor(() => expect(dicho()).toBe('pieza F con sonido en fila 3, columna 4'));
    expect(baldosa(celda(container, mx, my)).style.background).not.toBe('');

    tecla(c, 'Enter', { altKey: true });
    await vi.waitFor(() => expect(dicho()).toBe('pieza F muteada en fila 3, columna 4'));
  });

  it('con una celda enfocada la barra NO alterna el transporte; con el foco en el `body`, si', async () => {
    // El oraculo es el TRANSPORTE —el motor y el nombre del boton— y no "se llamo
    // `preventDefault`": la barra frena el default tambien con la celda enfocada, porque su
    // default es scrollear y eso hay que frenarlo lo maneje quien lo maneje. Usar el
    // `preventDefault` de oraculo daria verde con el bug puesto.
    const { container } = await render(<App />);
    const c = celda(container, 3, 2);
    c.focus();

    tecla(c, ' ');
    // El mismo golpe SI edito: sin la guarda, un solo `Espacio` colocaria la pieza Y
    // arrancaria el transporte.
    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.F.length));
    expect(motor.startClock).not.toHaveBeenCalled();
    await expect.element(page.getByRole('button', { name: 'Reproducir' })).toBeVisible();

    // Con un `<button>` enfocado tampoco, y por la otra guarda: ahi el navegador tiene que
    // quedarse el evento ENTERO para activar el control, sin un `blur()` a mano.
    const play = [...container.querySelectorAll('button')]
      .find(b => (b.getAttribute('aria-label') ?? b.textContent) === 'Reproducir')!;
    play.focus();
    tecla(play, ' ');
    expect(motor.startClock).not.toHaveBeenCalled();

    // Y con el foco en ningun lado, la barra sigue siendo del transporte: el spec 026 le
    // saco UNA tecla en UN lugar, no la apago.
    play.blur();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(motor.startClock).toHaveBeenCalled());
    await expect.element(page.getByRole('button', { name: 'Pausa' })).toBeVisible();
  });

  it('con una celda enfocada, `Shift` SI rota y `Ctrl` SI refleja', async () => {
    // Va separado del test de la barra a proposito: uno verifica que se apago, este que NO
    // se apago de mas. Ensanchar la guarda del listener global para que matchee la celda es
    // lo tentador —es una linea— y apagaria los tres atajos del spec 013 para arreglar uno.
    const { container } = await render(<App />);
    const c = celda(container, 4, 3);
    c.focus();
    // La celda enfocada ES el cursor: el fantasma aparece sin que el mouse toque nada.
    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.F.length));
    const antes = notaDelFantasma(container);

    tapDeModificador(c, 'Shift');
    await vi.waitFor(() => expect(notaDelFantasma(container)).not.toBe(antes));

    // La reflexion no cambia la NOTA de una celda, cambia el orden: lo que se mueve es el
    // `#N`, y por eso el oraculo es el `title` entero y no la nota sola.
    const conRotacion = notaDelFantasma(container);
    tapDeModificador(c, 'Control');
    await vi.waitFor(() => expect(notaDelFantasma(container)).not.toBe(conRotacion));
  });

  it('con el foco en una celda, sacar el mouse de la grilla no apaga el fantasma', async () => {
    // LA regla de desempate: mientras el foco del DOM este adentro del tablero, el foco
    // manda sobre el mouse. Sin ella el mouse apagaria el fantasma de la celda enfocada y
    // el roving tabindex se quedaria sin ancla — o sea que "la celda enfocada es el hover"
    // seria una promesa que el mouse rompe.
    const { container } = await render(<App />);
    celda(container, 4, 3).focus();
    await vi.waitFor(() => expect(conNota(container)).toBe(SHAPES.F.length));
    const conFoco = notaDelFantasma(container);

    container.querySelector('div.grid.w-max')!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    // Se espera de verdad: el mismo gesto con el foco AFUERA lo apaga en el mismo tick, asi
    // que sin la espera esta afirmacion pasaria por llegar antes que el re-render.
    await new Promise(r => setTimeout(r, 30));
    expect(conNota(container)).toBe(SHAPES.F.length);
    expect(notaDelFantasma(container)).toBe(conFoco);
  });
});

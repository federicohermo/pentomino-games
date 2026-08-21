import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import Board from '../Board.tsx';
import { CELL_PX } from '../constants/layout.constants.ts';
import { GRID_W, GRID_H } from '../../domain/constants/board.constants.ts';
import { SHAPES, ANCHOR_INDEX } from '../../domain/constants/pieces.constants.ts';
import { REGIMEN } from '../../domain/constants/music.constants.ts';
import { cellsAt } from '../../domain/board.ts';
import { rotateN } from '../../domain/transform.ts';
import type { PieceKey } from '../../domain/types/pieces.types.ts';
import type { PlacedPiece } from '../../domain/types/board.types.ts';
import type { Cell } from '../../domain/types/transform.types.ts';

/**
 * El tablero: 60 celdas, cinco tonos y un `title` por celda.
 *
 * Lo que se verifica es la jerarquia de canales que el archivo argumenta —**el color de
 * pieza es IDENTIDAD y pierde contra cualquier ESTADO**— y las dos mediciones de layout
 * que sostiene un comentario: que la grilla mida `10 × CELL_PX` fijos y que el
 * `overflow-x-auto` impida que eso empuje scroll horizontal a la PAGINA debajo de `md`.
 *
 * Las dos ultimas necesitan un navegador con viewport: en jsdom no hay ni layout ni
 * scroll, asi que la afirmacion «no empuja scroll a la pagina» seria trivialmente cierta
 * y no verificaria nada.
 */
const colocar = (piece: PieceKey, x: number, y: number, muted = false): PlacedPiece => ({
  id: piece,
  piece,
  rotation: 0,
  mirror: false,
  cells: cellsAt(rotateN(SHAPES[piece], 0), ANCHOR_INDEX[piece], x, y),
  muted,
});

type Props = Parameters<typeof Board>[0];

const props = (over: Partial<Props> = {}): Props => ({
  placed: [],
  previewCells: [],
  previewValid: true,
  hover: null,
  selected: 'F',
  rotation: 0,
  mirror: false,
  regimen: REGIMEN.escala,
  onCellClick: vi.fn(),
  onCellEnter: vi.fn(),
  onMouseLeave: vi.fn(),
  hoverEdita: false,
  onContextMenu: vi.fn(),
  boardRef: { current: null },
  ...over,
});

/** Las 60 celdas exteriores, en orden de indice: `i = y * GRID_W + x`. */
const celdas = (container: HTMLElement) =>
  [...container.querySelectorAll('div.grid > div')] as HTMLElement[];

const enIndice = (container: HTMLElement, x: number, y: number) => celdas(container)[y * GRID_W + x];
/** La baldosa de adentro, que es la que lleva el tono y el color. */
const baldosa = (celda: HTMLElement) => celda.firstElementChild as HTMLElement;

describe('Board', () => {
  it('son GRID_W × GRID_H celdas, y cada una mide CELL_PX', async () => {
    const { container } = await render(<Board {...props()} />);
    expect(celdas(container).length).toBe(GRID_W * GRID_H);

    const c = enIndice(container, 0, 0).getBoundingClientRect();
    expect(Math.round(c.width)).toBe(CELL_PX);
    expect(Math.round(c.height)).toBe(CELL_PX);
  });

  it('la grilla mide 10 × CELL_PX y NO le empuja scroll horizontal a la pagina', async () => {
    // La medicion que decide el `overflow-x-auto`: abajo de `md` el panel util queda en
    // ~311 px y la grilla no se encoge, asi que sin el contenedor que scrollea —toda la
    // cadena de ancestros es `overflow-x: visible`— el desborde llega hasta el `body`.
    await page.viewport(375, 800);
    try {
      const { container } = await render(<Board {...props()} />);
      const grilla = container.querySelector('div.grid')!;
      expect(Math.round(grilla.getBoundingClientRect().width)).toBe(GRID_W * CELL_PX);

      // El que scrollea es el tablero, que es lo que sobra.
      const scroller = container.querySelector('div.relative.overflow-x-auto')! as HTMLElement;
      expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
      // Y la pagina no: la nota es lo que hay que poder leer, y para eso la celda no se
      // achica — se scrollea el tablero.
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
        document.documentElement.clientWidth + 1,
      );
    } finally {
      await page.viewport(800, 600);
    }
  });

  it('la celda ocupada lleva el color de SU pieza, inline', async () => {
    const { container } = await render(<Board {...props({ placed: [colocar('F', 2, 2)] })} />);
    const ocupada = colocar('F', 2, 2).cells[0];
    const b = baldosa(enIndice(container, ocupada[0], ocupada[1]));

    // Inline y no una clase: Tailwind escanea el fuente, asi que un `bg-[...]`
    // interpolado desde `PIECE_COLOR` no se generaria.
    expect(b.style.background).not.toBe('');
    expect(b.style.color).not.toBe('');
    expect(b.className).toContain('shadow-sm');
  });

  it('la pieza MUTEADA cae al blanco y conserva su nota y su #N', async () => {
    // El canal es la AUSENCIA de color, y no uno de los dos obvios: el color es
    // identidad de pieza y la opacidad la usa `Playhead` para el velo del estreno.
    const [x, y] = colocar('F', 2, 2).cells[0];
    const { container } = await render(<Board {...props({ placed: [colocar('F', 2, 2, true)] })} />);
    const celda = enIndice(container, x, y);
    const b = baldosa(celda);

    expect(b.className).toContain('bg-white');
    expect(b.style.background).toBe('');
    // No se confunde con una celda libre porque una libre no tiene texto.
    expect(b.textContent).not.toBe('');
    expect(b.querySelector('span')!.textContent).toMatch(/^#\d$/);
    // La coordenada sale del propio `cells[0]`, que NO es el ancla: el ancla es la
    // celda de agarre y `cells[0]` es la primera del array, dos cosas distintas.
    expect(celda.getAttribute('title')).toMatch(new RegExp(`^\\(${x},${y}\\) · .+ · paso \\d$`));
  });

  it('el choque contra una pieza colocada gana sobre el color', async () => {
    // El color de pieza es IDENTIDAD y pierde contra cualquier ESTADO.
    const pieza = colocar('F', 2, 2);
    const [x, y] = pieza.cells[0];
    const { container } = await render(
      <Board {...props({ placed: [pieza], previewCells: [[x, y] as Cell], previewValid: false })} />,
    );
    const b = baldosa(enIndice(container, x, y));
    expect(b.className).toContain('bg-rose-500');
    expect(b.style.background).toBe('');
  });

  it('el fantasma es gris cuando entra y rosa cuando no', async () => {
    const gris = await render(<Board {...props({ previewCells: [[5, 5] as Cell], previewValid: true })} />);
    expect(baldosa(enIndice(gris.container, 5, 5)).className).toContain('bg-slate-300');
    await gris.unmount();

    const rosa = await render(<Board {...props({ previewCells: [[5, 5] as Cell], previewValid: false })} />);
    // El rosa es el unico canal que dice "aca no entra" ademas del cursor.
    expect(baldosa(enIndice(rosa.container, 5, 5)).className).toContain('bg-rose-300');
  });

  it('una celda libre no tiene texto, y su title dice solo la coordenada', async () => {
    const { container } = await render(<Board {...props()} />);
    const celda = enIndice(container, 7, 4);
    expect(baldosa(celda).textContent).toBe('');
    expect(celda.getAttribute('title')).toBe('(7,4)');
  });

  it('el fantasma promete la nota que la pieza va a decir, con el regimen que baja', async () => {
    // Es la mitad visible de AC7 del 017: el mismo `regimen` gobierna las dos llamadas a
    // `cellTextFor`, la de la pieza colocada y la del fantasma.
    const celdasF = colocar('F', 2, 2).cells;
    const escala = await render(
      <Board {...props({ previewCells: celdasF, regimen: REGIMEN.escala })} />,
    );
    const notaEscala = enIndice(escala.container, celdasF[0][0], celdasF[0][1]).getAttribute('title');
    await escala.unmount();

    const orden = await render(
      <Board {...props({ previewCells: celdasF, regimen: REGIMEN.orden, rotation: 1 })} />,
    );
    const notaOrden = enIndice(orden.container, celdasF[0][0], celdasF[0][1]).getAttribute('title');

    expect(notaEscala).toMatch(/paso \d$/);
    expect(notaOrden).not.toBe(notaEscala);
  });

  it('el click entrega la celda y el altKey, que es lo que distingue mutear de colocar', async () => {
    const onCellClick = vi.fn();
    const { container } = await render(<Board {...props({ onCellClick })} />);

    enIndice(container, 3, 1).click();
    expect(onCellClick).toHaveBeenLastCalledWith(3, 1, false);

    enIndice(container, 3, 1).dispatchEvent(
      new MouseEvent('click', { bubbles: true, altKey: true }),
    );
    expect(onCellClick).toHaveBeenLastCalledWith(3, 1, true);
  });

  it('el hover entra y sale, y el boton derecho llega al handler', async () => {
    const onCellEnter = vi.fn();
    const onMouseLeave = vi.fn();
    const onContextMenu = vi.fn();
    const { container } = await render(
      <Board {...props({ onCellEnter, onMouseLeave, onContextMenu })} />,
    );

    enIndice(container, 4, 2).dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await vi.waitFor(() => expect(onCellEnter).toHaveBeenCalledWith([4, 2]));

    container.querySelector('div.grid')!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    await vi.waitFor(() => expect(onMouseLeave).toHaveBeenCalled());

    // `contextmenu` NO esta entre los tres eventos que React registra pasivos, asi que
    // el boton derecho si puede ir por prop.
    container.querySelector('div.relative.overflow-x-auto')!
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    expect(onContextMenu).toHaveBeenCalled();
  });

  it('el cursor dice "aca no entra" salvo donde el click EDITA', async () => {
    // Sobre una celda propia la jugada de colocar es invalida —la pieza se choca consigo
    // misma— pero el click no coloca, borra. Sin `hoverEdita` el cursor diria lo
    // contrario de lo que pasa justo donde el gesto es destructivo.
    const base = { previewValid: false, hover: [2, 2] as Cell };

    const prohibido = await render(<Board {...props({ ...base, hoverEdita: false })} />);
    expect(enIndice(prohibido.container, 0, 0).className).toContain('cursor-not-allowed');
    await prohibido.unmount();

    const edita = await render(<Board {...props({ ...base, hoverEdita: true })} />);
    expect(enIndice(edita.container, 0, 0).className).toContain('cursor-pointer');
    await edita.unmount();

    // Y sin hover no hay jugada que prohibir.
    const sinHover = await render(<Board {...props({ previewValid: false, hover: null })} />);
    expect(enIndice(sinHover.container, 0, 0).className).toContain('cursor-pointer');
  });

  it('el ref del tablero queda colgado del nodo que scrollea, que es donde engancha la rueda', async () => {
    const boardRef: { current: HTMLDivElement | null } = { current: null };
    const { container } = await render(<Board {...props({ boardRef })} />);
    expect(boardRef.current).toBe(container.querySelector('div.relative.overflow-x-auto'));
  });
});

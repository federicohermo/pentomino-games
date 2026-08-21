import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import OrientationPanel from '../OrientationPanel.tsx';
import { MINI_BOX, MINI_CELL_PX } from '../constants/layout.constants.ts';
import { PIECE_COLOR } from '../constants/palette.constants.ts';
import { SHAPES } from '../../domain/constants/pieces.constants.ts';
import { REGIMEN } from '../../domain/constants/music.constants.ts';
import type { PieceKey } from '../../domain/types/pieces.types.ts';
import type { PropsDeOrientacion } from '../types/panel.types.ts';

/**
 * Las doce miniaturas del spec 016.
 *
 * Lo que se verifica es lo que el archivo ARGUMENTA con mediciones y hasta hoy sostenia
 * solo un comentario: que la caja de 5×5 sea FIJA —o sea que rotar no mueva un pixel de
 * la grilla— y que el borde de las celdas se INVIERTA con el estado del boton, que es
 * una decision de contraste medida contra los dos fondos y no una eleccion estetica.
 *
 * Las dos necesitan layout de verdad: la primera se mide con `getBoundingClientRect` y
 * la segunda con `getComputedStyle`, y en jsdom las dos devuelven ceros y valores
 * iniciales.
 */
const PIEZAS = Object.keys(SHAPES) as PieceKey[];

const orientacion = (over: Partial<PropsDeOrientacion> = {}): PropsDeOrientacion => ({
  selected: 'F',
  rotation: 0,
  mirror: false,
  regimen: REGIMEN.escala,
  noteSet: [60, 62, 64, 67, 69],
  onSelect: vi.fn(),
  onRotate: vi.fn(),
  onMirror: vi.fn(),
  onRegimen: vi.fn(),
  ...over,
});

describe('OrientationPanel', () => {
  it('son las doce, cada una con su letra', async () => {
    const { container } = await render(<OrientationPanel orientacion={orientacion()} />);
    const botones = container.querySelectorAll('button');
    expect(botones.length).toBe(PIEZAS.length);
    for (const key of PIEZAS) {
      expect(container.textContent).toContain(key);
    }
  });

  it('el nombre accesible dice la orientacion ACTUAL, no la canonica', async () => {
    // La miniatura muestra como esta puesta la pieza, asi que el lector de pantalla
    // tiene que decir lo mismo que el ojo ve.
    await render(<OrientationPanel orientacion={orientacion({ rotation: 1, mirror: true })} />);
    await expect.element(page.getByRole('button', { name: 'F, rotación 90°, reflejada' })).toBeVisible();

    await render(<OrientationPanel orientacion={orientacion({ rotation: 2, mirror: false })} />);
    await expect.element(page.getByRole('button', { name: 'Z, rotación 180°' })).toBeVisible();
  });

  it('rotar NO mueve un pixel de la grilla, que es para lo que la caja es fija', async () => {
    // El bug que la caja fija existe para evitar: con pistas automaticas la `I` sola
    // pasa de 5 celdas de ancho a 1 al rotar y hace saltar la fila entera. Se mide el
    // ancho de CADA boton en las cuatro rotaciones y los dos espejos.
    const medir = async (rotation: number, mirror: boolean) => {
      const { container, unmount } = await render(
        <OrientationPanel orientacion={orientacion({ rotation, mirror })} />,
      );
      const anchos = [...container.querySelectorAll('button')]
        .map(b => Math.round(b.getBoundingClientRect().width));
      const altos = [...container.querySelectorAll('button')]
        .map(b => Math.round(b.getBoundingClientRect().height));
      await unmount();
      return { anchos, altos };
    };

    const base = await medir(0, false);
    // Que el layout exista de verdad: en jsdom esto seria 0 y el test pasaria vacio.
    expect(base.anchos[0]).toBeGreaterThan(0);

    for (const rotation of [1, 2, 3]) {
      for (const mirror of [false, true]) {
        const { anchos, altos } = await medir(rotation, mirror);
        expect(anchos, `rot${rotation}${mirror ? ' mirror' : ''}`).toEqual(base.anchos);
        expect(altos, `rot${rotation}${mirror ? ' mirror' : ''}`).toEqual(base.altos);
      }
    }
  });

  it('la caja mide 5 × MINI_CELL_PX, y no lo que ocupe la pieza', async () => {
    // Se afirma el TAMANO y no solo la cantidad de pistas: con `min-content` las cinco
    // pistas siguen existiendo pero colapsan a cero, y el test de "rotar no mueve nada"
    // sigue pasando porque colapsan todas igual. Lo verifico un pase de mutacion — ese
    // cambio sobrevivia sin esta linea.
    const { container } = await render(<OrientationPanel orientacion={orientacion()} />);
    for (const boton of container.querySelectorAll('button')) {
      const caja = boton.querySelector('div.grid')!;
      // 25 celdas dibujadas, llenas o no: es lo que hace que el tamano no dependa de
      // que celdas esten ocupadas.
      expect(caja.children.length).toBe(MINI_BOX * MINI_BOX);

      const pistas = getComputedStyle(caja).gridTemplateColumns.split(' ');
      expect(pistas.length).toBe(MINI_BOX);
      for (const p of pistas) expect(Math.round(parseFloat(p))).toBe(MINI_CELL_PX);
      expect(Math.round(caja.getBoundingClientRect().width)).toBe(MINI_BOX * MINI_CELL_PX);
    }
  });

  it('la forma se pinta del color de la pieza, y el fondo del boton NO', async () => {
    // El fondo del boton es el canal de "seleccionada": pintarlo del color de pieza
    // dejaria a la paleta sin decir cual esta activa.
    const { container } = await render(<OrientationPanel orientacion={orientacion({ selected: 'F' })} />);
    const boton = container.querySelector('button')!;
    const llenas = [...boton.querySelectorAll('div.grid > div')]
      .filter(d => (d as HTMLElement).style.background !== '');

    expect(llenas.length).toBe(SHAPES.F.length);
    expect(getComputedStyle(boton).backgroundColor).not.toBe(PIECE_COLOR.F.bg);
  });

  it('el borde se INVIERTE con el estado, y los dos colores son distintos', async () => {
    // No es cosmetica: en cada estado falla un conjunto DISJUNTO de piezas contra el
    // piso 3:1 de WCAG 1.4.11, y un solo color no cubre los dos fondos.
    const bordeDe = async (selected: PieceKey, mira: PieceKey) => {
      const { container, unmount } = await render(
        <OrientationPanel orientacion={orientacion({ selected })} />,
      );
      const boton = [...container.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label')!.startsWith(`${mira},`))!;
      const llena = [...boton.querySelectorAll('div.grid > div')]
        .find(d => (d as HTMLElement).style.background !== '')!;
      const color = getComputedStyle(llena).borderTopColor;
      await unmount();
      return color;
    };

    const seleccionada = await bordeDe('F', 'F');
    const suelta = await bordeDe('Z', 'F');
    expect(seleccionada).not.toBe(suelta);
    // Y las dos son un borde de verdad, no `none`: sin la hoja de estilos cargada las
    // dos darian el mismo valor inicial y el test pasaria sin verificar nada.
    expect(seleccionada).not.toBe('');
    expect(suelta).not.toBe('');
  });

  it('el click entrega la pieza que se apreto', async () => {
    const onSelect = vi.fn();
    await render(<OrientationPanel orientacion={orientacion({ onSelect })} />);
    await page.getByRole('button', { name: 'W, rotación 0°' }).click();
    expect(onSelect).toHaveBeenCalledWith('W');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import TransportPanel from '../TransportPanel.tsx';
import { TEMPO_MIN, TEMPO_MAX } from '../constants/layout.constants.ts';
import type { PropsDeTransporte } from '../types/panel.types.ts';

/**
 * El transporte es presentacional y de tres controles, asi que lo que hay para
 * verificar no es que renderice sino las dos cosas que su docblock ARGUMENTA:
 *
 * 1. **el icono ES el estado** — lo que se ve es lo que pasa al apretar, y el color
 *    lo repite; y
 * 2. el boton se queda sin nombre accesible al sacarle el texto, asi que el
 *    `aria-label` no es decoracion: es el unico nombre que tiene.
 *
 * Las dos son afirmaciones sobre el DOM que se produce, y ninguna la mira nadie hoy.
 */
const transporte = (over: Partial<PropsDeTransporte> = {}): PropsDeTransporte => ({
  tempo: 110,
  playing: false,
  // `clicks` y `onToggleClicks` estan en el tipo y `TransportPanel` no los lee: el
  // interruptor de clicks vive en otro panel. Se completan igual porque el tipo los
  // exige, y quedan anotados: son dos campos que el componente recibe y descarta.
  clicks: false,
  onToggleClicks: vi.fn(),
  onTempo: vi.fn(),
  onTogglePlay: vi.fn(),
  onReset: vi.fn(),
  ...over,
});

describe('TransportPanel', () => {
  it('en pausa: el boton ofrece reproducir, y lo dice con el glifo y con el nombre', async () => {
    const onTogglePlay = vi.fn();
    await render(<TransportPanel transporte={transporte({ onTogglePlay })} />);

    const boton = page.getByRole('button', { name: 'Reproducir' });
    await expect.element(boton).toHaveTextContent('▶');
    // El verde es lo que un transporte pide leer como "apreta esto para que suene", y
    // NO el `bg-slate-100` de lo apagado: al lado tiene a Reset y quedarian
    // indistinguibles.
    await expect.element(boton).toHaveClass(/bg-emerald-600/);

    await boton.click();
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('corriendo: el mismo boton ofrece pausar, con el idioma de lo activo', async () => {
    await render(<TransportPanel transporte={transporte({ playing: true })} />);

    const boton = page.getByRole('button', { name: 'Pausa' });
    await expect.element(boton).toHaveTextContent('⏸');
    // `bg-slate-900 text-white` es el mismo idioma con el que la tarjeta marca lo
    // activo en Rotacion y Reflexion, aplicado al mismo concepto.
    await expect.element(boton).toHaveClass(/bg-slate-900/);

    // Y el `title` dice lo mismo que el nombre accesible: el puntero y el lector no
    // pueden contar dos historias distintas del mismo boton.
    expect(boton.element().getAttribute('title')).toBe('Pausa');
  });

  it('el tempo viaja como numero, no como el string del input', async () => {
    const onTempo = vi.fn();
    await render(<TransportPanel transporte={transporte({ onTempo })} />);

    const slider = page.getByRole('slider');
    expect(slider.element().getAttribute('min')).toBe(String(TEMPO_MIN));
    expect(slider.element().getAttribute('max')).toBe(String(TEMPO_MAX));

    await slider.fill('128');
    expect(onTempo).toHaveBeenCalledWith(128);
    // Lo que importa del `parseInt`: un `'128'` que llegue como string se propaga a
    // `setBpm` y de ahi a la aritmetica del scheduler.
    expect(typeof onTempo.mock.calls[0][0]).toBe('number');
  });

  it('el numero lleva su unidad, que desde el 008 no es redundante', async () => {
    // El instrumento maneja bpm e intervalos: "110" a secas es ambiguo.
    const { container } = await render(<TransportPanel transporte={transporte({ tempo: 96 })} />);
    expect(container.textContent).toContain('96');
    expect(container.textContent).toContain('bpm');
  });

  it('Reset es su propio boton y no dispara el transporte', async () => {
    const onReset = vi.fn();
    const onTogglePlay = vi.fn();
    await render(<TransportPanel transporte={transporte({ onReset, onTogglePlay })} />);

    await page.getByRole('button', { name: 'Reset' }).click();
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onTogglePlay).not.toHaveBeenCalled();
  });
});

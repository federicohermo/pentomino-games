import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import PiecePalette from '../PiecePalette.tsx';
import { REGIMEN } from '../../domain/constants/music.constants.ts';
import type { PropsDeOrientacion, PropsDeTransporte } from '../types/panel.types.ts';

/**
 * La tarjeta de piezas despues del spec 019: las doce miniaturas, la fila del regimen, la
 * orientacion en texto y el transporte.
 *
 * Este archivo se reescribio con el 019 y la mitad de lo que verifica es un BORRADO. Eso
 * cambia la forma de la asercion: «los cuatro botones de grados no existen mas» solo es
 * falsable con un `queryByRole` anclado que da vacio — leer el diff no lo verifica, y un
 * test que renderiza y no pregunta nada tampoco.
 *
 * Lo que sobrevive de la version anterior es la medicion que el archivo declara y que hasta
 * el 025 no revalidaba nada: que la linea «Notas actuales» ocupe DOS renglones reservados y
 * no cambie de alto entre el mejor y el peor de los 48 casos. Es la que el docblock explica
 * con el bug entero — al envolver movia 20 px hacia abajo todo lo que tiene debajo, «justo
 * cuando vas a apretarlo».
 *
 * Necesita layout: se mide con `getBoundingClientRect`, que en jsdom da cero.
 */
const orientacion = (over: Partial<PropsDeOrientacion> = {}): PropsDeOrientacion => ({
  selected: 'F',
  rotation: 0,
  mirror: false,
  regimen: REGIMEN.escala,
  noteSet: [60, 62, 64, 67, 69],
  onSelect: vi.fn(),
  onRegimen: vi.fn(),
  ...over,
});

const transporte = (over: Partial<PropsDeTransporte> = {}): PropsDeTransporte => ({
  tempo: 110,
  playing: false,
  clicks: false,
  onTempo: vi.fn(),
  onTogglePlay: vi.fn(),
  onToggleClicks: vi.fn(),
  onReset: vi.fn(),
  ...over,
});

/** Sin un solo sostenido: el mejor caso de los 48. */
const SIN_SOSTENIDOS = [60, 62, 64, 67, 69];
/** `F#4 · G#4 · A#4 · C#5 · D#5`, cinco sostenidos: el peor, y sale en N rot1, U rot0 y Z rot3. */
const CINCO_SOSTENIDOS = [66, 68, 70, 73, 75];

describe('PiecePalette', () => {
  it('la linea de notas reserva dos renglones y no salta entre el mejor y el peor caso', async () => {
    const alto = async (noteSet: number[]) => {
      const { container, unmount } = await render(
        <PiecePalette orientacion={orientacion({ noteSet })} transporte={transporte()} />,
      );
      const linea = [...container.querySelectorAll('p')]
        .find(p => p.textContent!.startsWith('Notas actuales'))!;
      const h = Math.round(linea.getBoundingClientRect().height);
      await unmount();
      return h;
    };

    const mejor = await alto(SIN_SOSTENIDOS);
    const peor = await alto(CINCO_SOSTENIDOS);

    // Que haya layout de verdad: en jsdom los dos serian 0 y el test pasaria vacio.
    expect(mejor).toBeGreaterThan(0);
    expect(peor).toBe(mejor);
    // Y que sean DOS renglones y no uno estirado: el `2lh` esta atado a la fuente, asi
    // que se compara contra el interlineado real en vez de contra 40 px de memoria.
    const { container } = await render(
      <PiecePalette orientacion={orientacion()} transporte={transporte()} />,
    );
    const linea = [...container.querySelectorAll('p')]
      .find(p => p.textContent!.startsWith('Notas actuales'))!;
    const interlineado = parseFloat(getComputedStyle(linea).lineHeight);
    expect(mejor).toBe(Math.round(interlineado * 2));
  });

  it('la tonica de la pieza en la mano se dice con su nombre', async () => {
    const { container } = await render(
      <PiecePalette orientacion={orientacion({ selected: 'F' })} transporte={transporte()} />,
    );
    // La `F` suena en C: la letra es la FORMA y no el sonido, que es la trampa que la
    // tool `describe_piece` tambien advierte.
    expect(container.textContent).toContain('tónica C');
  });

  it('los seis botones que el 019 borra NO estan en el DOM', async () => {
    // La contraparte falsable de AC1. Los nombres van ANCLADOS: `getByRole` empareja por
    // subcadena, y el `aria-label` de las doce miniaturas dice «rotación 180°», asi que un
    // `/180°/` suelto encontraria la miniatura y este test no fallaria nunca.
    const { container } = await render(
      <PiecePalette orientacion={orientacion({ rotation: 2, mirror: true })} transporte={transporte()} />,
    );
    for (const grados of ['0°', '90°', '180°', '270°']) {
      expect(page.getByRole('button', { name: new RegExp(`^${grados}$`) }).elements(), grados)
        .toHaveLength(0);
    }
    expect(page.getByRole('button', { name: /^Reflexión$/ }).elements()).toHaveLength(0);
    // El del recorrido NO se borro: se MUDO, y sigue estando dentro de esta tarjeta porque
    // `TransportPanel` es hijo suyo. Lo que se verifica es que ya no sea una fila con
    // etiqueta visible sino un boton de la fila de transporte, abajo del `border-t`.
    const recorrido = page.getByRole('button', { name: /^Recorrido en el vacío$/ }).element();
    expect(recorrido.textContent).toBe('');
    expect(recorrido.closest('div.border-t')).not.toBeNull();
    // Y las dos etiquetas se fueron con sus controles: un `<span>` que nombra un grupo que
    // ya no existe deja un `aria-labelledby` colgando o, peor, un texto en pantalla que no
    // corresponde a nada.
    expect(container.querySelector('#reflexion-etiqueta')).toBeNull();
    expect(container.querySelector('#recorrido-etiqueta')).toBeNull();
    // Ningun boton de la tarjeta dice ON ni OFF: los dos que lo hacian eran los borrados.
    expect([...container.querySelectorAll('button')].map(b => b.textContent))
      .not.toContain('OFF');
  });

  it('el regimen es la fila `Rotación`, con sus DOS botones simetricos', async () => {
    // Asciende de segunda linea a fila propia: la frase que completaba —«Rotación … cambia
    // escala / orden»— se quedo sin sujeto al borrarse los cuatro grados. Sigue siendo un
    // `role="group"` con nombre, y sigue sin ser un ON/OFF: ninguno de los dos valores es
    // la ausencia del otro, que es la lectura que D4 del 017 rechaza.
    const onRegimen = vi.fn();
    const { container } = await render(
      <PiecePalette
        orientacion={orientacion({ regimen: REGIMEN.escala, onRegimen })}
        transporte={transporte()}
      />,
    );
    await expect.element(page.getByRole('group', { name: /^Rotación$/ })).toBeInTheDocument();
    // Y el grupo que se llamaba `cambia` no quedo ademas: es el MISMO grupo renombrado.
    expect(page.getByRole('group', { name: /^cambia$/ }).elements()).toHaveLength(0);
    expect(container.querySelectorAll('[role="group"]')).toHaveLength(1);

    const botones = [...container.querySelectorAll('[role="group"] button')];
    expect(botones).toHaveLength(2);
    // Los dos declaran `aria-pressed` —ninguno queda en `null`— y exactamente uno esta en
    // `true`: el estado que la fila pinta en oscuro es el mismo que anuncia el arbol.
    expect(botones.map(b => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    await expect.element(page.getByRole('button', { name: REGIMEN.escala })).toHaveClass(/bg-slate-900/);

    await page.getByRole('button', { name: REGIMEN.orden }).click();
    expect(onRegimen).toHaveBeenCalledWith(REGIMEN.orden);
  });

  it('la palabra que unia la frase no se pierde: la dice el `title` del grupo', async () => {
    // `cambia` desaparecio de la pantalla con la fila de arriba, y sin ella
    // `Rotación | escala orden` se puede leer como si la rotacion tuviera dos valores.
    const { container } = await render(
      <PiecePalette orientacion={orientacion()} transporte={transporte()} />,
    );
    const grupo = container.querySelector('[role="group"]')!;
    expect(grupo.getAttribute('title')).toContain('rotación cambia');
  });

  it('la orientacion se lee en texto, que es lo que la miniatura no puede decir', async () => {
    // Las seis piezas ciegas —`I T U V W X`— suenan distinto sin verse distinto en 29 de
    // las 96 combinaciones. Se verifica por TEXTO y nunca por `className`.
    const sinReflejar = await render(
      <PiecePalette orientacion={orientacion({ rotation: 3 })} transporte={transporte()} />,
    );
    expect(sinReflejar.container.textContent).toContain('270°');
    expect(sinReflejar.container.textContent).not.toContain('reflejada');
    await sinReflejar.unmount();

    const { container } = await render(
      <PiecePalette orientacion={orientacion({ rotation: 2, mirror: true })} transporte={transporte()} />,
    );
    expect(container.textContent).toContain('180° · reflejada');
  });

  it('la linea de orientacion reserva su renglon y no salta con el peor caso', async () => {
    // Mismo bug que la linea de notas: si envuelve, mueve todo lo que tiene debajo justo
    // cuando lo estas tocando. El peor caso de largo es `270° · reflejada`.
    const alto = async (over: Partial<PropsDeOrientacion>) => {
      const { container, unmount } = await render(
        <PiecePalette orientacion={orientacion(over)} transporte={transporte()} />,
      );
      const linea = [...container.querySelectorAll('p')]
        .find(p => /^\d+°/.test(p.textContent!))!;
      const h = Math.round(linea.getBoundingClientRect().height);
      const interlineado = parseFloat(getComputedStyle(linea).lineHeight);
      await unmount();
      return { h, interlineado };
    };

    const corto = await alto({ rotation: 0, mirror: false });
    const largo = await alto({ rotation: 3, mirror: true });
    expect(corto.h).toBeGreaterThan(0);
    expect(largo.h).toBe(corto.h);
    // Y UN renglon, no dos: el peor caso entra sin envolver.
    expect(corto.h).toBe(Math.round(corto.interlineado));
  });

  it('el orden de la tarjeta, de arriba abajo', async () => {
    // Con el recorrido mudado al transporte, lo que queda entre las miniaturas y el
    // `border-t` son dos filas y ninguna es de otro panel.
    const { container } = await render(
      <PiecePalette orientacion={orientacion()} transporte={transporte()} />,
    );
    const texto = container.textContent!;
    expect(texto.indexOf('Rotación')).toBeLessThan(texto.indexOf('tónica'));
    expect(texto.indexOf('tónica')).toBeLessThan(texto.indexOf('Notas actuales'));
    expect(texto.indexOf('Notas actuales')).toBeLessThan(texto.indexOf('Tempo'));
  });
});

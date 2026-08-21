import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import PiecePalette from '../PiecePalette.tsx';
import { REGIMEN } from '../../domain/constants/music.constants.ts';
import type { PropsDeOrientacion, PropsDeTransporte } from '../types/panel.types.ts';

/**
 * La tarjeta de piezas: las doce miniaturas, los dos bloques de orientacion, el
 * interruptor del recorrido y el transporte.
 *
 * Lo que se verifica es la medicion que el archivo declara y que hasta hoy no revalidaba
 * nada: que la linea «Notas actuales» ocupe DOS renglones reservados y **no cambie de
 * alto** entre el mejor y el peor de los 48 casos. Es la que el docblock explica con el
 * bug entero — al envolver, movia 20 px hacia abajo todo lo que tiene debajo, o sea
 * Tempo, el transporte y Reset, «justo cuando vas a apretarlo».
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
  onRotate: vi.fn(),
  onMirror: vi.fn(),
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

  it('las cuatro rotaciones son botones, y el activo se marca en oscuro', async () => {
    const onRotate = vi.fn();
    await render(
      <PiecePalette orientacion={orientacion({ rotation: 2, onRotate })} transporte={transporte()} />,
    );
    // Los nombres van anclados: `getByRole` empareja por SUBCADENA, y el
    // `aria-label` de las doce miniaturas tambien dice «rotacion 180°».
    await expect.element(page.getByRole('button', { name: /^180°$/ })).toHaveClass(/bg-slate-900/);
    await expect.element(page.getByRole('button', { name: /^90°$/ })).not.toHaveClass(/bg-slate-900/);

    await page.getByRole('button', { name: /^270°$/ }).click();
    expect(onRotate).toHaveBeenCalledWith(3);
  });

  it('el regimen son DOS botones simetricos, no un ON/OFF', async () => {
    // Ninguno de los dos es la ausencia del otro: un ON/OFF diria que hay un regimen y
    // una desviacion, que es la lectura que D4 del 017 rechaza.
    const onRegimen = vi.fn();
    await render(
      <PiecePalette orientacion={orientacion({ regimen: REGIMEN.escala, onRegimen })} transporte={transporte()} />,
    );
    await expect.element(page.getByRole('button', { name: REGIMEN.escala })).toHaveClass(/bg-slate-900/);
    await expect.element(page.getByRole('button', { name: REGIMEN.orden })).not.toHaveClass(/bg-slate-900/);

    await page.getByRole('button', { name: REGIMEN.orden }).click();
    expect(onRegimen).toHaveBeenCalledWith(REGIMEN.orden);
  });

  it('Reflexion y Recorrido son ON/OFF, y cada uno llama al suyo', async () => {
    const onMirror = vi.fn();
    const onToggleClicks = vi.fn();
    const { container } = await render(
      <PiecePalette
        orientacion={orientacion({ mirror: true, onMirror })}
        transporte={transporte({ clicks: false, onToggleClicks })}
      />,
    );

    const filaDe = (etiqueta: string) =>
      [...container.querySelectorAll('div.flex.items-center.justify-between')]
        .find(d => d.textContent!.startsWith(etiqueta))!;

    const reflexion = filaDe('Reflexión').querySelector('button')!;
    const recorrido = filaDe('Recorrido en el vacío').querySelector('button')!;

    expect(reflexion.textContent).toBe('ON');
    expect(recorrido.textContent).toBe('OFF');

    reflexion.click();
    expect(onMirror).toHaveBeenCalledTimes(1);
    recorrido.click();
    expect(onToggleClicks).toHaveBeenCalledTimes(1);
    // Y no se cruzan: son dos interruptores distintos en filas contiguas.
    expect(onMirror).toHaveBeenCalledTimes(1);
  });

  it('Reflexión se nombra por su fila y anuncia su estado con aria-pressed', async () => {
    // El nombre accesible sale del `<span>Reflexión</span>` por `aria-labelledby` y NO de
    // un `aria-label` que repita la misma cadena (D3): un `aria-label` duplicaria un texto
    // que ya esta en pantalla y las dos copias se despegarian sin que nada falle. Por eso
    // se afirma tambien que el boton NO declara `aria-label`.
    //
    // El componente es presentacional —no tiene estado propio—, asi que `aria-pressed`
    // sigue a la prop. Se verifica renderizando con `mirror: false` y con `mirror: true`,
    // no clickeando y esperando que se actualice solo: eso ultimo pasaria siempre.
    const apagado = await render(
      <PiecePalette orientacion={orientacion({ mirror: false })} transporte={transporte()} />,
    );
    // Anclado, por lo mismo que las rotaciones: `getByRole` empareja por SUBCADENA.
    await expect
      .element(page.getByRole('button', { name: /^Reflexión$/, pressed: false }))
      .toBeInTheDocument();
    const boton = apagado.container.querySelector('button[aria-labelledby="reflexion-etiqueta"]')!;
    expect(boton.hasAttribute('aria-label')).toBe(false);
    // Explicito, y no solo por `pressed: false`: un boton SIN `aria-pressed` tambien
    // empareja con `pressed: false`, asi que esa consulta sola pasaria con el atributo
    // borrado. Lo que verifica que el atributo existe es esta linea y el render de abajo.
    expect(boton.getAttribute('aria-pressed')).toBe('false');
    // Y el texto visible sigue siendo el ON/OFF de siempre: el nombre accesible lo tapa
    // para el lector de pantalla, no para el ojo.
    expect(boton.textContent).toBe('OFF');
    await apagado.unmount();

    await render(
      <PiecePalette orientacion={orientacion({ mirror: true })} transporte={transporte()} />,
    );
    await expect
      .element(page.getByRole('button', { name: /^Reflexión$/, pressed: true }))
      .toBeInTheDocument();
  });

  it('Recorrido en el vacío se nombra por su fila y anuncia su estado con aria-pressed', async () => {
    // Mismo razonamiento que Reflexión: el estado viene por la prop `clicks`, asi que los
    // dos valores se comparan entre dos renders y no despues de un click.
    const apagado = await render(
      <PiecePalette orientacion={orientacion()} transporte={transporte({ clicks: false })} />,
    );
    await expect
      .element(page.getByRole('button', { name: /^Recorrido en el vacío$/, pressed: false }))
      .toBeInTheDocument();
    const boton = apagado.container.querySelector('button[aria-labelledby="recorrido-etiqueta"]')!;
    expect(boton.hasAttribute('aria-label')).toBe(false);
    // Explicito, y no solo por `pressed: false`: un boton SIN `aria-pressed` tambien
    // empareja con `pressed: false`, asi que esa consulta sola pasaria con el atributo
    // borrado. Lo que verifica que el atributo existe es esta linea y el render de abajo.
    expect(boton.getAttribute('aria-pressed')).toBe('false');
    expect(boton.textContent).toBe('OFF');
    await apagado.unmount();

    await render(
      <PiecePalette orientacion={orientacion()} transporte={transporte({ clicks: true })} />,
    );
    await expect
      .element(page.getByRole('button', { name: /^Recorrido en el vacío$/, pressed: true }))
      .toBeInTheDocument();
  });

  it('los dos grupos son un role="group" con nombre, y sus seis botones declaran aria-pressed', async () => {
    // El grupo se nombra con el `<span>` que ya estaba en la fila, sin agregar un nodo:
    // un envoltorio nuevo se comeria un margen del `space-y-2`, que es un selector de
    // hijo directo. El nombre del segundo grupo es «cambia» —un verbo suelto— a proposito:
    // ese texto es la segunda linea de una oracion que empieza arriba.
    const { container } = await render(
      <PiecePalette
        orientacion={orientacion({ rotation: 2, regimen: REGIMEN.orden })}
        transporte={transporte()}
      />,
    );
    await expect.element(page.getByRole('group', { name: /^Rotación$/ })).toBeInTheDocument();
    await expect.element(page.getByRole('group', { name: /^cambia$/ })).toBeInTheDocument();

    const botonesDe = (etiqueta: string) => [
      ...container.querySelectorAll(`[role="group"][aria-labelledby="${etiqueta}"] button`),
    ];
    const rotaciones = botonesDe('rotacion-etiqueta');
    const regimenes = botonesDe('regimen-etiqueta');
    expect(rotaciones).toHaveLength(4);
    expect(regimenes).toHaveLength(2);

    // Los seis lo declaran —ninguno queda en `null`— y exactamente UNO de los cuatro de
    // rotacion esta en `true`: el estado que la tarjeta pinta en oscuro es el mismo que
    // anuncia el arbol de accesibilidad.
    const pressed = (b: Element) => b.getAttribute('aria-pressed');
    expect(rotaciones.map(pressed)).toEqual(['false', 'false', 'true', 'false']);
    expect(regimenes.map(pressed)).toEqual(['false', 'true']);
    expect(rotaciones.filter(b => pressed(b) === 'true')).toHaveLength(1);
  });

  it('el interruptor del recorrido es del transporte pero lo renderiza esta tarjeta', async () => {
    // Cae ENTRE dos bloques de orientacion, asi que llevarselo a `TransportPanel`
    // reordenaria el DOM. Se afirma la posicion, que es la razon de que este aca.
    const { container } = await render(
      <PiecePalette orientacion={orientacion()} transporte={transporte()} />,
    );
    const texto = container.textContent!;
    expect(texto.indexOf('Reflexión')).toBeLessThan(texto.indexOf('Recorrido en el vacío'));
    expect(texto.indexOf('Recorrido en el vacío')).toBeLessThan(texto.indexOf('Notas actuales'));
    expect(texto.indexOf('Notas actuales')).toBeLessThan(texto.indexOf('Tempo'));
  });
});

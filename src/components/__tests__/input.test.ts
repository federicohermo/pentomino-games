import { describe, it, expect } from 'vitest';
import { rotacionPorRueda, accionDeTecla, abreTapLimpio, reflejaElContextMenu } from '../input.ts';
import { ACCION } from '../constants/input.constants.ts';
import type { EventoDeTecla } from '../types/input.types.ts';

/**
 * Las decisiones de los cinco gestos del spec 013. Lo que NO está acá es el cableado
 * —que `App.tsx` mire bien el `e.target`, que el `preventDefault` frene el scroll de
 * verdad—: eso queda en las tareas `[M]` del navegador, porque el repo no monta
 * componentes y no tiene jsdom.
 */

/** Un evento de tecla con todo apagado: cada test enciende solo lo que mide. */
const tecla = (p: Partial<EventoDeTecla> & Pick<EventoDeTecla, 'key' | 'tipo'>): EventoDeTecla => ({
  repeat: false, targetEsControl: false, tapLimpio: true, ...p,
});

describe('AC1 — la rueda rota en los dos sentidos, con vuelta cíclica', () => {
  it('abajo suma 90° y arriba resta 90°', () => {
    expect(rotacionPorRueda(0, 120)).toBe(1);
    expect(rotacionPorRueda(1, -120)).toBe(0);
  });

  it('da la vuelta en los dos bordes', () => {
    expect(rotacionPorRueda(3, 120)).toBe(0);
    // El caso que el `+ 4` existe para atajar: en JS `-1 % 4` es `-1`, y `rotateN`
    // no tiene una rotación -1.
    expect(rotacionPorRueda(0, -120)).toBe(3);
  });

  it('un deltaY de 0 no rota', () => {
    // Llega de verdad: un scroll horizontal puro deja `deltaY` en 0, y girar ahí
    // sería rotar sin que nadie lo pida.
    expect(rotacionPorRueda(2, 0)).toBe(2);
  });

  it('recorre el ciclo de cuatro y vuelve al punto de partida', () => {
    let r = 0;
    for (let i = 0; i < 4; i++) r = rotacionPorRueda(r, 120);
    expect(r).toBe(0);
  });
});

describe('AC3 y AC5 — el auto-repeat no acumula', () => {
  it('con `repeat: true` ninguna tecla produce acción', () => {
    // Sin esta guarda, apoyar el meñique en Shift —que es lo que uno hace para
    // escribir— giraría la pieza a la cadencia de repetición del sistema.
    for (const key of ['Shift', 'Control', ' ']) {
      expect(accionDeTecla(tecla({ key, tipo: 'keydown', repeat: true }))).toBeNull();
      expect(accionDeTecla(tecla({ key, tipo: 'keyup', repeat: true }))).toBeNull();
    }
  });
});

describe('AC3 y AC5 — los modificadores actúan al soltar, y solo con el tap limpio', () => {
  it('el `keydown` del modificador no produce acción', () => {
    // Es la mitad de la guarda que evita que `Ctrl`+C dé vuelta la reflexión: todos
    // los atajos del navegador empiezan con el `keydown` del modificador.
    expect(accionDeTecla(tecla({ key: 'Shift', tipo: 'keydown' }))).toBeNull();
    expect(accionDeTecla(tecla({ key: 'Control', tipo: 'keydown' }))).toBeNull();
  });

  it('el `keyup` con el tap limpio sí', () => {
    expect(accionDeTecla(tecla({ key: 'Shift', tipo: 'keyup' }))).toBe(ACCION.rotar);
    expect(accionDeTecla(tecla({ key: 'Control', tipo: 'keyup' }))).toBe(ACCION.reflejar);
  });

  it('el `keyup` con el tap sucio no', () => {
    // El tap lo ensucian otra tecla (`Ctrl`+C) y la rueda (`Ctrl`+rueda, que es el
    // zoom). La suciedad la pone el cableado, así que este test es lo único que fija
    // la regla de qué hacer con ella.
    expect(accionDeTecla(tecla({ key: 'Shift', tipo: 'keyup', tapLimpio: false }))).toBeNull();
    expect(accionDeTecla(tecla({ key: 'Control', tipo: 'keyup', tapLimpio: false }))).toBeNull();
  });
});

describe('AC7 y AC8 — la barra espaciadora', () => {
  it('alterna el transporte en el `keydown` y no en el `keyup`', () => {
    // En `keydown` y no en `keyup` porque es donde el navegador scrollea: es el único
    // momento en que el `preventDefault` sirve de algo.
    expect(accionDeTecla(tecla({ key: ' ', tipo: 'keydown' }))).toBe(ACCION.transporte);
    expect(accionDeTecla(tecla({ key: ' ', tipo: 'keyup' }))).toBeNull();
  });

  it('con el foco sobre un control no produce acción', () => {
    // AC8: con Play enfocado, la barra lo activa por la vía nativa. Si además el
    // handler global contestara, el transporte alternaría dos veces en el mismo gesto
    // y el instrumento no arrancaría.
    expect(accionDeTecla(tecla({ key: ' ', tipo: 'keydown', targetEsControl: true }))).toBeNull();
  });

  it('la guarda del control también apaga a los modificadores', () => {
    // Escribir en el slider de tempo con Shift no tiene por qué rotar la pieza.
    expect(accionDeTecla(tecla({ key: 'Shift', tipo: 'keyup', targetEsControl: true }))).toBeNull();
    expect(accionDeTecla(tecla({ key: 'Control', tipo: 'keyup', targetEsControl: true }))).toBeNull();
  });
});

describe('qué keydown abre un tap limpio', () => {
  /** Un `keydown` sin modificadores encendidos salvo los que el test pide. */
  const bajar = (key: string, mods: Partial<Record<'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey', boolean>> = {}) =>
    abreTapLimpio({
      key,
      shiftKey: key === 'Shift', ctrlKey: key === 'Control',
      altKey: false, metaKey: false,
      ...mods,
    });

  it('un modificador solo lo abre', () => {
    expect(bajar('Shift')).toBe(true);
    expect(bajar('Control')).toBe(true);
  });

  it('cualquier otra tecla lo ensucia', () => {
    for (const key of ['a', ' ', 'Alt', 'Enter']) expect(bajar(key), key).toBe(false);
  });

  it('un modificador con OTRO ya abajo no lo abre', () => {
    // El agujero que la regla del spec —"arranca en true con el keydown del
    // modificador"— deja abierto: `Ctrl`+`Shift` son dos keydown de modificador
    // seguidos y ninguna tercera tecla que ensucie el tap. Es el atajo con el que
    // Windows cambia de distribución de teclado, así que sin esto la pieza rotaría y
    // se reflejaría sola al soltarlo.
    expect(bajar('Shift', { ctrlKey: true })).toBe(false);
    expect(bajar('Control', { shiftKey: true })).toBe(false);
  });

  it('`Alt` y `Meta` abajo también lo ensucian', () => {
    // `Alt` lo reserva el spec 014 para mutear y `Meta` es el modificador de los
    // atajos de macOS: los dos son gestos de otro dueño.
    expect(bajar('Control', { altKey: true })).toBe(false);
    expect(bajar('Shift', { metaKey: true })).toBe(false);
  });
});

describe('las teclas que no son nuestras', () => {
  it('no producen acción', () => {
    for (const key of ['a', 'Enter', 'Alt', 'ArrowUp', 'Escape']) {
      expect(accionDeTecla(tecla({ key, tipo: 'keydown' })), key).toBeNull();
      expect(accionDeTecla(tecla({ key, tipo: 'keyup' })), key).toBeNull();
    }
    // `Alt` está en la lista a propósito: el spec 013 lo declara RESERVADO para el 014
    // y no lo usa. Si algún día empieza a hacer algo, este test lo dice.
  });
});

describe('AC6 — `Ctrl`+click en macOS es el click derecho', () => {
  /*
   * Este es el único criterio del spec 013 que NO se puede ver a ojo desde Windows, que
   * es donde se desarrolla el repo: acá `Ctrl`+click es un click común y las dos filas
   * de la tabla no se cruzan nunca. En macOS el sistema lo traduce a `contextmenu` con
   * `ctrlKey: true`, y sin la guarda el `keyup` de `Ctrl` alterna la reflexión y este
   * handler la deshace — neto cero, o sea que la reflexión no respondería nunca ahí.
   *
   * Si alguien borra este test por "redundante", el bug vuelve y vuelve mudo.
   */
  it('un `contextmenu` con `ctrlKey: true` no refleja', () => {
    expect(reflejaElContextMenu({ ctrlKey: true })).toBe(false);
  });

  it('un click derecho de verdad sí', () => {
    expect(reflejaElContextMenu({ ctrlKey: false })).toBe(true);
  });
});

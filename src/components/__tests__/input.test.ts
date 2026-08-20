import { describe, it, expect } from 'vitest';
import {
  rotacionPorRueda, accionDeTecla, frenaElDefault, abreTapLimpio, reflejaElContextMenu,
  accionDeClick, esLaPiezaEnLaMano,
} from '../input.ts';
import { ACCION, EDICION } from '../constants/input.constants.ts';
import type { EventoDeTecla } from '../types/input.types.ts';
import type { PieceKey } from '../../domain/types/pieces.types.ts';
import type { PlacedPiece } from '../../domain/types/board.types.ts';

/**
 * Las decisiones de los cinco gestos del spec 013. Lo que NO está acá es el cableado
 * —que `components/use-input.ts` mire bien el `e.target`, que el `preventDefault` frene el scroll de
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

describe('AC7 — frenar el default es otra pregunta que producir una acción', () => {
  it('la barra repetida NO alterna el transporte pero SÍ frena el scroll', () => {
    // Es el caso que separa a las dos funciones, y el que las tenía fundidas dejaba
    // roto: con `preventDefault` atado a «hay acción», un tap un poco largo de la barra
    // arrancaba el transporte una vez y después scrolleaba la página a la cadencia de
    // repetición del sistema, porque cada `keydown` repetido trae su propio default.
    const repetida = tecla({ key: ' ', tipo: 'keydown', repeat: true });
    expect(accionDeTecla(repetida)).toBeNull();
    expect(frenaElDefault(repetida)).toBe(true);
  });

  it('la barra del primer `keydown` frena el default', () => {
    expect(frenaElDefault(tecla({ key: ' ', tipo: 'keydown' }))).toBe(true);
  });

  it('con el foco sobre un control no frena nada', () => {
    // D4: el evento es del navegador ENTERO y no a medias, o la barra dejaría de
    // activar el botón que tiene el foco.
    expect(frenaElDefault(tecla({ key: ' ', tipo: 'keydown', targetEsControl: true }))).toBe(false);
  });

  it('el `keyup` de la barra y los modificadores no frenan nada', () => {
    // Ninguno de los tres tiene un default que valga la pena frenar: la barra scrollea
    // en `keydown`, y `Shift` y `Control` sueltos no hacen nada en el navegador.
    expect(frenaElDefault(tecla({ key: ' ', tipo: 'keyup' }))).toBe(false);
    for (const key of ['Shift', 'Control']) {
      expect(frenaElDefault(tecla({ key, tipo: 'keydown' })), key).toBe(false);
      expect(frenaElDefault(tecla({ key, tipo: 'keyup' })), key).toBe(false);
    }
  });

  it('una tecla que no es nuestra tampoco', () => {
    for (const key of ['a', 'Enter', 'Alt', 'ArrowDown', 'PageDown']) {
      expect(frenaElDefault(tecla({ key, tipo: 'keydown' })), key).toBe(false);
    }
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
    // `Alt` está en la lista a propósito: el 013 lo declaró reservado y el 014 lo usa
    // como modificador del CLICK, no como tecla suelta. Si algún día empieza a hacer
    // algo por su cuenta, este test lo dice.
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

/**
 * El click sobre una celda (spec 014). La llave de toda la edición es que la pieza que
 * está en la mano sea la misma que la del tablero: sin esa condición, cualquier click mal
 * apuntado borraría.
 */
const pieza = (id: string, piece: PieceKey, muted = false): PlacedPiece =>
  ({ id, piece, rotation: 0, mirror: false, cells: [], muted });

describe('AC1 — el click sobre la pieza que está en la mano la quita', () => {
  it('con la misma pieza seleccionada, quitar', () => {
    expect(accionDeClick(pieza('1', 'N'), 'N', false)).toBe(EDICION.quitar);
  });

  it('la decisión se toma sobre la celda CLICKEADA, así que con dos `N` se edita la tocada', () => {
    // `occupantAt` devuelve la pieza que cubre esa celda, y esta pura recibe esa. Que la
    // regla no sea "hay alguna N en el tablero" es lo que hace que con dos colocadas se
    // edite la que se tocó — el id viaja en el ocupante y el llamador filtra por él.
    const primera = pieza('1', 'N');
    const segunda = pieza('2', 'N');
    expect(accionDeClick(primera, 'N', false)).toBe(EDICION.quitar);
    expect(accionDeClick(segunda, 'N', false)).toBe(EDICION.quitar);
    expect(primera.id).not.toBe(segunda.id);
  });
});

describe('AC2 — el click sobre OTRA pieza no hace nada', () => {
  it('sin Alt y con Alt, ninguna de las dos edita', () => {
    // Es el comportamiento de antes del spec: `isValid` rechazaba el solape y el handler
    // volvía. La regla NO puede ser "la jugada es inválida", porque eso también es cierto
    // acá y acá no tiene que pasar nada.
    expect(accionDeClick(pieza('1', 'L'), 'N', false)).toBeNull();
    expect(accionDeClick(pieza('1', 'L'), 'N', true)).toBeNull();
  });
});

describe('AC3 — `Alt`+click sobre la pieza en la mano alterna el muteo', () => {
  it('mutea la que suena y desmutea la muteada: es un toggle, no un set', () => {
    // La pura devuelve la misma acción en los dos casos porque el toggle es del llamador:
    // la decisión es "alterná esta", y cuál es el valor nuevo lo sabe la pieza.
    expect(accionDeClick(pieza('1', 'N'), 'N', true)).toBe(EDICION.mutear);
    expect(accionDeClick(pieza('1', 'N', true), 'N', true)).toBe(EDICION.mutear);
  });
});

describe('AC4 — `Alt`+click sobre una celda vacía coloca ya muteada', () => {
  it('sin Alt coloca normal, con Alt coloca muteada', () => {
    expect(accionDeClick(null, 'N', false)).toBe(EDICION.colocar);
    expect(accionDeClick(null, 'N', true)).toBe(EDICION.colocarMuteada);
  });

  it('las dos son acciones distintas, y esa es la única razón por la que se separan', () => {
    // Editan el tablero igual; lo que cambia es el arpegio de cortesía, que la muteada no
    // dispara. Si fueran la misma acción, esa condición tendría que vivir como un `if`
    // suelto en el shell mirando el `altKey` una segunda vez.
    expect(EDICION.colocar).not.toBe(EDICION.colocarMuteada);
  });
});

describe('la llave de la edición, sola', () => {
  it('`esLaPiezaEnLaMano` es falsa sin ocupante y con ocupante de otro tipo', () => {
    expect(esLaPiezaEnLaMano(null, 'N')).toBe(false);
    expect(esLaPiezaEnLaMano(pieza('1', 'L'), 'N')).toBe(false);
    expect(esLaPiezaEnLaMano(pieza('1', 'N'), 'N')).toBe(true);
  });

  it('no mira el muteo: una pieza muteada se puede quitar igual', () => {
    expect(esLaPiezaEnLaMano(pieza('1', 'N', true), 'N')).toBe(true);
    expect(accionDeClick(pieza('1', 'N', true), 'N', false)).toBe(EDICION.quitar);
  });
});

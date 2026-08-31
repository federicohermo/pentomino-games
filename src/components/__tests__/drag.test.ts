import { describe, it, expect } from 'vitest';
import { moverPanel, pasoDeTecla } from '../drag.ts';
import { MARGEN_VISIBLE_PX, PASO_TECLADO_PX } from '../constants/layout.constants.ts';
import type { Caja, Posicion } from '../types/panel.types.ts';

/**
 * Las dos decisiones del arrastre, sin navegador. El cableado —la captura del puntero, los
 * dos listeners sobre `window`, el `transform` sobre el nodo— vive en
 * `FloatingPanel.browser.test.tsx`.
 *
 * Lo que este archivo fija es AC5 por sus cuatro bordes y AC4 por sus cuatro flechas, que
 * son justo las ramas que desde el navegador costarían un evento sintético cada una.
 */

/** El viewport de la medición del research: 1536 x 695. */
const VIEWPORT: Caja = { ancho: 1536, alto: 695 };
/** El dock de 4 x 3 con casilla de 48, medido en el prototipo: 220 x 268. */
const DOCK: Caja = { ancho: 220, alto: 268 };

describe('052 AC5 — el panel no se puede perder fuera de la pantalla', () => {
  it('los cuatro bordes dejan al menos el margen visible adentro', () => {
    const centro: Posicion = { x: 600, y: 300 };
    // Un desplazamiento absurdo por cada borde: lo que AC5 declara falsable es soltar en
    // (-9999, -9999) y que el panel siga alcanzable.
    const izquierda = moverPanel(centro, { dx: -9999, dy: 0 }, VIEWPORT, DOCK);
    const derecha = moverPanel(centro, { dx: 9999, dy: 0 }, VIEWPORT, DOCK);
    const arriba = moverPanel(centro, { dx: 0, dy: -9999 }, VIEWPORT, DOCK);
    const abajo = moverPanel(centro, { dx: 0, dy: 9999 }, VIEWPORT, DOCK);

    // Por izquierda el panel sale casi entero y queda la franja de margen.
    expect(izquierda.x).toBe(MARGEN_VISIBLE_PX - DOCK.ancho);
    expect(izquierda.x + DOCK.ancho).toBe(MARGEN_VISIBLE_PX);
    // Por derecha, la franja entra desde el borde opuesto.
    expect(derecha.x).toBe(VIEWPORT.ancho - MARGEN_VISIBLE_PX);
    // Y arriba el tope es CERO y no el margen negativo: el asa vive en el borde superior,
    // así que dejarla salir sería dejar el panel visible e inmóvil.
    expect(arriba.y).toBe(0);
    expect(abajo.y).toBe(VIEWPORT.alto - MARGEN_VISIBLE_PX);
  });

  it('la esquina imposible del AC5 sigue siendo alcanzable', () => {
    const perdido = moverPanel({ x: 0, y: 0 }, { dx: -9999, dy: -9999 }, VIEWPORT, DOCK);
    // «Alcanzable» = su rect intersecta el viewport. Con el asa arriba, eso es su borde
    // superior dentro y una franja horizontal adentro.
    expect(perdido.y).toBe(0);
    expect(perdido.x + DOCK.ancho).toBeGreaterThanOrEqual(MARGEN_VISIBLE_PX);
  });

  it('un desplazamiento que no toca ningún borde pasa entero', () => {
    // La rama de adentro del acotado: sin este caso los dos `Math` quedarían verificados
    // sólo por sus extremos, que es donde cualquier fórmula acierta de casualidad.
    expect(moverPanel({ x: 600, y: 300 }, { dx: -37, dy: 41 }, VIEWPORT, DOCK))
      .toEqual({ x: 563, y: 341 });
  });

  it('una ventana más chica que la caja no rompe: el panel se pega al borde', () => {
    // El caso degenerado que `acotar` contesta sin una rama: `min > max`. Pasa de verdad
    // —una ventana de cero píxeles mientras el navegador restaura una pestaña— y lo que
    // corresponde ahí es pegar el panel al borde, no tirar un `NaN` al `transform`.
    const sinVentana = moverPanel({ x: 10, y: 10 }, { dx: 0, dy: 0 }, { ancho: 0, alto: 0 }, DOCK);
    expect(sinVentana).toEqual({ x: -MARGEN_VISIBLE_PX, y: -MARGEN_VISIBLE_PX });
    expect(Number.isFinite(sinVentana.x) && Number.isFinite(sinVentana.y)).toBe(true);
  });
});

describe('052 AC4 — el arrastre existe para el teclado', () => {
  it('las cuatro flechas dan su desplazamiento', () => {
    expect(pasoDeTecla('ArrowLeft')).toEqual({ dx: -PASO_TECLADO_PX, dy: 0 });
    expect(pasoDeTecla('ArrowRight')).toEqual({ dx: PASO_TECLADO_PX, dy: 0 });
    expect(pasoDeTecla('ArrowUp')).toEqual({ dx: 0, dy: -PASO_TECLADO_PX });
    expect(pasoDeTecla('ArrowDown')).toEqual({ dx: 0, dy: PASO_TECLADO_PX });
  });

  it('una tecla ajena devuelve null y no un cero', () => {
    // `null` y no `{dx:0,dy:0}` porque el llamador tiene que poder dejarle el default al
    // navegador: con un cero no sabría si la tecla era suya. Es la misma forma que
    // `piezaDeTecla` en `input.ts`.
    for (const key of ['f', 'Enter', ' ', 'Tab', 'PageUp', 'Home']) {
      expect(pasoDeTecla(key), key).toBeNull();
    }
  });

  it('una flecha mueve el panel un paso medible', () => {
    // Las dos puras compuestas como las compone el hook: es lo que AC4 pide de verdad —«las
    // cuatro flechas mueven el panel un paso medible»— y no que cada una devuelva un objeto.
    const paso = pasoDeTecla('ArrowRight');
    expect(paso).not.toBeNull();
    const destino = moverPanel({ x: 100, y: 100 }, paso ?? { dx: 0, dy: 0 }, VIEWPORT, DOCK);
    expect(destino.x - 100).toBe(PASO_TECLADO_PX);
    expect(destino.y).toBe(100);
  });
});

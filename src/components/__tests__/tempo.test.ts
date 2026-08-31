import { describe, it, expect } from 'vitest';
import { pasoDeRueda, pasoDeTempoDeTecla, tempoAcotado, tempoDeArrastre } from '../tempo.ts';
import { ARRASTRE_PX_POR_BPM, TEMPO_MAX, TEMPO_MIN } from '../constants/layout.constants.ts';

/**
 * La conversión gesto → bpm, sin navegador. Que la rueda y las flechas lleguen al reloj
 * —y que con el reloj enfocado la `f` no elija una pieza, que es AC8— vive en
 * `TransportPanel.browser.test.tsx`.
 *
 * Lo que este archivo agota es la mitad que el `input[type=range]` hacía adentro del
 * navegador y que al sacarlo se volvió código nuestro: el acotado.
 */
describe('052 AC7 — el tempo se ajusta sin slider', () => {
  it('todo lo que sale del módulo cae dentro del rango', () => {
    // La promesa entera del módulo, ejercida por sus tres puertas. El acotado no queda del
    // lado del llamador a propósito: son tres gestos, o sea tres oportunidades de olvidarlo.
    expect(tempoAcotado(-9999)).toBe(TEMPO_MIN);
    expect(tempoAcotado(9999)).toBe(TEMPO_MAX);
    expect(tempoDeArrastre(TEMPO_MAX, -9999)).toBe(TEMPO_MAX);
    expect(tempoDeArrastre(TEMPO_MIN, 9999)).toBe(TEMPO_MIN);
  });

  it('los dos extremos se alcanzan y no se pasan', () => {
    expect(tempoAcotado(TEMPO_MIN)).toBe(TEMPO_MIN);
    expect(tempoAcotado(TEMPO_MAX)).toBe(TEMPO_MAX);
    expect(tempoAcotado(TEMPO_MIN - 1)).toBe(TEMPO_MIN);
    expect(tempoAcotado(TEMPO_MAX + 1)).toBe(TEMPO_MAX);
  });

  it('un valor de adentro pasa entero, redondeado', () => {
    expect(tempoAcotado(110)).toBe(110);
    // Redondea porque el arrastre divide píxeles por bpm: un tempo con decimales llega
    // igual al motor, pero un reloj digital con coma no es un reloj digital.
    expect(tempoAcotado(110.4)).toBe(110);
    expect(tempoAcotado(110.6)).toBe(111);
  });

  it('la rueda mira el signo y no la magnitud', () => {
    // `deltaY` vale ~100 por muesca en un mouse y 1 o 2 por cuadro en un trackpad. Con una
    // cuenta proporcional el mismo gesto valdría dos tempos distintos según el dispositivo.
    expect(pasoDeRueda(-100)).toBe(1);
    expect(pasoDeRueda(-1)).toBe(1);
    expect(pasoDeRueda(100)).toBe(-1);
    expect(pasoDeRueda(1)).toBe(-1);
    // Arriba sube, que es la dirección con la que la rueda rota una pieza sobre el tablero.
    expect(pasoDeRueda(-1)).toBeGreaterThan(pasoDeRueda(1));
  });

  it('una rueda horizontal pura no mueve el tempo', () => {
    // No es defensivo: un `wheel` con `deltaX` y `deltaY` en cero llega de verdad.
    expect(pasoDeRueda(0)).toBe(0);
  });

  it('las cuatro flechas suben y bajan, y el resto no es nuestro', () => {
    // El modelo de un `spinbutton` de ARIA, y el mismo que tenía el `range` que se va: quien
    // lo manejaba con el teclado no tiene que aprender nada nuevo.
    expect(pasoDeTempoDeTecla('ArrowUp')).toBe(1);
    expect(pasoDeTempoDeTecla('ArrowRight')).toBe(1);
    expect(pasoDeTempoDeTecla('ArrowDown')).toBe(-1);
    expect(pasoDeTempoDeTecla('ArrowLeft')).toBe(-1);
    for (const key of ['f', 'Enter', ' ', 'Tab', 'Home']) {
      expect(pasoDeTempoDeTecla(key), key).toBeNull();
    }
  });

  it('el arrastre hacia arriba sube el tempo, a un bpm cada dos píxeles', () => {
    expect(tempoDeArrastre(110, -2 * ARRASTRE_PX_POR_BPM)).toBe(112);
    expect(tempoDeArrastre(110, 2 * ARRASTRE_PX_POR_BPM)).toBe(108);
    // El rango entero —100 bpm— en 200 px de arrastre.
    expect(tempoDeArrastre(TEMPO_MIN, -(TEMPO_MAX - TEMPO_MIN) * ARRASTRE_PX_POR_BPM)).toBe(TEMPO_MAX);
  });

  it('el arrastre es reversible: se ancla en el tempo del comienzo', () => {
    // Lo que rompe acumular paso a paso: un gesto que sale del rango y vuelve quedaría
    // clavado en el extremo, porque el acotado se habría comido los píxeles de ida.
    const inicial = 150;
    const salido = tempoDeArrastre(inicial, -9999);
    expect(salido).toBe(TEMPO_MAX);
    expect(tempoDeArrastre(inicial, 0)).toBe(inicial);
    expect(tempoDeArrastre(inicial, 20)).toBe(140);
  });
});

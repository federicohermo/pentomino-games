import { ARRASTRE_PX_POR_BPM, TEMPO_MAX, TEMPO_MIN } from './constants/layout.constants.ts';

/**
 * La conversión **gesto → bpm** del reloj de tempo, sin DOM.
 *
 * El slider se fue con el spec 052 y con él la única pieza que traducía un gesto a un
 * número: un `input[type=range]` hace esa cuenta adentro del navegador. Lo que lo reemplaza
 * son tres gestos de reloj digital —rueda sobre el número, flechas con el foco puesto y
 * arrastre vertical— y los tres terminan en la misma pregunta: qué bpm queda.
 *
 * Las cuatro puras de acá son esa pregunta partida en sus pedazos, y viven fuera del `.tsx`
 * por lo de siempre: un componente no puede exportar nada además de sí mismo
 * (`react-refresh/only-export-components`), así que lo que se escriba adentro no se puede
 * testear. Acá corren en el proyecto `node`.
 *
 * **Todo lo que sale de este módulo ya está acotado a `[TEMPO_MIN, TEMPO_MAX]`** (AC7). Es
 * deliberado que el acotado no quede del lado del llamador: son tres gestos y tres
 * llamadores, o sea tres oportunidades de olvidarse de uno.
 */

/**
 * Un tempo cualquiera llevado al rango que el motor acepta, y redondeado.
 *
 * Redondea porque el arrastre divide píxeles por bpm y el resultado no tiene por qué ser
 * entero: un tempo fraccionario llega igual al motor —`setBpm` no se queja— pero el número
 * en pantalla tendría decimales, que es lo contrario de un reloj digital.
 */
export function tempoAcotado(bpm: number): number {
  return Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, Math.round(bpm)));
}

/**
 * El paso que pide un evento de rueda: `+1`, `-1` o `0`.
 *
 * Se mira el **signo** y no la magnitud. `deltaY` vale muy distinto según el dispositivo
 * —una rueda de mouse manda ~100 por muesca y un trackpad manda 1 o 2 por cuadro— así que
 * cualquier cuenta proporcional haría que el mismo gesto valiera dos tempos distintos
 * según con qué se lo haga. Con el signo, una muesca es un bpm en los dos.
 *
 * **Arriba sube**, o sea `deltaY < 0`: es la dirección con la que el navegador scrollea
 * hacia arriba, y la misma con la que la rueda rota una pieza sobre el tablero.
 *
 * El `0` no es defensivo: un `wheel` horizontal puro llega con `deltaY` en cero, y lo que
 * corresponde ahí es no mover el tempo.
 */
export function pasoDeRueda(deltaY: number): number {
  if (deltaY < 0) return 1;
  if (deltaY > 0) return -1;
  return 0;
}

/**
 * El paso que pide una tecla, o `null` si la tecla no es nuestra.
 *
 * Las cuatro flechas y no dos: arriba y derecha suben, abajo e izquierda bajan. Es el
 * modelo de un `spinbutton` de ARIA, y el que ya tenía el `input[type=range]` que se va —un
 * `range` responde a las cuatro—, así que quien lo manejaba con el teclado no tiene que
 * aprender nada nuevo.
 *
 * `null` y no cero por lo mismo que en `drag.ts`: el llamador necesita distinguir una tecla
 * ajena para dejarle su default al navegador.
 */
export function pasoDeTempoDeTecla(key: string): number | null {
  if (key === 'ArrowUp' || key === 'ArrowRight') return 1;
  if (key === 'ArrowDown' || key === 'ArrowLeft') return -1;
  return null;
}

/**
 * El tempo que deja un arrastre vertical de `dy` px desde `inicial`.
 *
 * **Hacia arriba sube**, y por eso el signo va restado: en pantalla `dy` crece hacia abajo,
 * y un gesto que baja el puntero tiene que bajar el número.
 *
 * Se calcula contra el tempo del **comienzo** del gesto y no contra el actual. Acumular
 * paso a paso arrastraría el error de redondeo de cada cuadro, así que soltar y volver a
 * agarrar en el mismo punto daría tempos distintos; peor, un arrastre que sale del rango y
 * vuelve quedaría clavado en el extremo, porque el acotado se habría comido los píxeles de
 * ida. Con el ancla en el inicio, el gesto es reversible: volver el puntero a donde empezó
 * devuelve el tempo donde estaba.
 */
export function tempoDeArrastre(inicial: number, dy: number): number {
  return tempoAcotado(inicial - dy / ARRASTRE_PX_POR_BPM);
}

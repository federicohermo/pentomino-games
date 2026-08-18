import { useEffect, useRef } from 'react';
import { playheadOffset } from '../audio/engine.ts';
import { rutaActiva } from './route-source.ts';
import { CELL_PX } from './constants/layout.constants.ts';

/**
 * La cabeza lectora: que celda esta sonando ahora mismo, dibujada sobre la grilla.
 *
 * Sin props y sin estado, igual que `Spectrum.tsx` y por el mismo motivo medido: el
 * intervalo dura entre 0,25 s (60 bpm) y 0,094 s (160 bpm), o sea entre 4 y 10,6
 * cambios por segundo. Llevar eso a `useState` re-renderizaria el tablero entero —60
 * celdas— mas la paleta y la lista, diez veces por segundo, para mover un resaltado.
 * React monta el elemento y arranca el loop; el resto es imperativo.
 *
 * ## Se mueve UN elemento, no cambian sesenta (D2)
 *
 * La alternativa era recalcular la clase de las 60 celdas en cada cuadro: tocar 60
 * nodos para cambiar uno. Aca el costo por cuadro es una lectura aritmetica y, cuando
 * la celda cambio, una escritura de `transform`.
 *
 * El absoluto se posiciona contra el contenedor que SCROLLEA (`Board.tsx`), y eso es
 * deliberado aunque parezca contraintuitivo: asi la cabeza scrollea con la grilla y
 * sigue alineada debajo de `md`, donde el tablero no entra y `overflow-x-auto` lo
 * contiene.
 *
 * ## Que dibuja y que NO calcula (D5, AC4)
 *
 * Nada de aritmetica de caminos ni de distancias: la celda de cada offset ya viene
 * resuelta en la tabla que devuelve `rutaActiva()`. Este archivo traduce un numero a
 * una posicion en pixeles y nada mas.
 *
 * La cabeza SALTA y no se desliza (D6): el instrumento esta cuantizado a la grilla de
 * intervalos, y un movimiento continuo sugeriria una continuidad que no existe.
 */

/**
 * Grosor de los dos anillos, en px. El doble anillo —claro adentro, oscuro afuera— no
 * es decoracion: la cabeza tiene que leerse sobre los 12 colores de pieza Y sobre el
 * blanco de una celda vacia, y ningun color solo lo consigue en los dos casos. Es la
 * misma razon por la que la cabeza no usa HUE: en este repo el color es IDENTIDAD (que
 * pieza es) y el estado nunca se comunica con color.
 */
const ANILLO_NOTA = 3;
const ANILLO_CLICK = 2;

/** Nota fuerte, click tenue (D7): si se vieran igual, el recorrido parece tener piezas donde no hay. */
const OPACIDAD_NOTA = 1;
const OPACIDAD_CLICK = 0.5;

const CLARO = 'rgba(255,255,255,0.95)';
const OSCURO = 'rgba(15,23,42,0.9)';

/** Los dos anillos como un solo `box-shadow` hacia adentro, para no agrandar la caja. */
const anillos = (grosor: number): string =>
  `inset 0 0 0 ${grosor}px ${CLARO}, inset 0 0 0 ${grosor * 2}px ${OSCURO}`;

export default function Playhead() {
  const ref = useRef<HTMLDivElement>(null);
  // Dos refs y no una: el `transform` va en la caja de 63 px —que es la que se mueve
  // sobre la grilla— y el anillo en la baldosa de adentro, 2 px mas chica. Un `inset`
  // sobre la caja externa se dibujaria contra SU borde y quedaria 2 px corrido en los
  // cuatro lados, justo encima de la separacion entre celdas.
  const anilloRef = useRef<HTMLDivElement>(null);

  // Dependencias vacias a proposito: el loop se monta una vez y lee del motor y del
  // par de rutas por su cuenta, asi que no hay nada que re-suscribir cuando la app
  // re-renderiza. Es la misma forma que `Spectrum.tsx`.
  useEffect(() => {
    const el = ref.current;
    const anillo = anilloRef.current;
    if (!el || !anillo) return;

    // Clave de lo ULTIMO escrito, no la marca en si: comparar strings evita comparar
    // tuplas y deja el caso "oculto" expresado como cadena vacia. Es lo que baja de 60
    // escrituras por segundo a entre 4 y 11, y lo que hace que en pausa el loop no
    // toque el DOM ni una vez (AC7).
    let dibujado = '';
    let raf = 0;

    const draw = () => {
      // `rutaActiva()` PRIMERO y `playheadOffset()` despues, en ese orden. `rutaActiva`
      // es quien hace el swap al detectar que el motor cerro el ciclo; leyendo el
      // offset antes habria un cuadro en que un offset del ciclo NUEVO se dibuja sobre
      // la tabla del VIEJO, y si el ciclo nuevo es mas corto eso ilumina una celda que
      // no es. Asi la ventana queda en cero.
      const marcas = rutaActiva();
      const offset = playheadOffset();
      const marca = offset === null ? null : marcas[offset] ?? null;

      const clave = marca ? `${marca.cell[0]},${marca.cell[1]},${marca.nota}` : '';
      if (clave !== dibujado) {
        dibujado = clave;
        if (!marca) {
          el.style.display = 'none';
        } else {
          // Inline y no clases de Tailwind: las coordenadas salen de `CELL_PX`, que es
          // una constante, y Tailwind escanea el fuente — una clase interpolada no se
          // generaria. Es la misma regla que ya rige en `Board.tsx`.
          el.style.display = 'block';
          el.style.transform = `translate(${marca.cell[0] * CELL_PX}px, ${marca.cell[1] * CELL_PX}px)`;
          el.style.opacity = String(marca.nota ? OPACIDAD_NOTA : OPACIDAD_CLICK);
          anillo.style.boxShadow = anillos(marca.nota ? ANILLO_NOTA : ANILLO_CLICK);
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(raf);
  }, []);

  // `display: none` de arranque: sin reloj no hay cabeza, y montarla visible en (0,0)
  // marcaria una celda que no suena hasta el primer cuadro. `pointer-events-none`
  // porque va ENCIMA de las celdas y no puede robarles el click de colocar.
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="absolute top-0 left-0 p-[2px] pointer-events-none"
      style={{ width: CELL_PX, height: CELL_PX, display: 'none' }}
    >
      {/* Misma caja que la baldosa de `Board.tsx` —2 px de aire y `rounded-lg`— para que
          el anillo caiga exactamente sobre el borde de la celda y no medio pixel afuera. */}
      <div ref={anilloRef} className="w-full h-full rounded-lg" style={{ boxShadow: anillos(ANILLO_NOTA) }} />
    </div>
  );
}

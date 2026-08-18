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
 * ## Va ARRIBA de las celdas, y eso necesita `z-10`
 *
 * Las baldosas de `Board.tsx` son `relative`, asi que son elementos POSICIONADOS y se
 * pintan en orden de documento entre ellos. Como la grilla viene despues de este
 * componente en el DOM, sin `z-index` la cabeza queda DEBAJO de todas las celdas — y
 * como hasta la celda vacia tiene fondo opaco (`bg-white`), queda directamente
 * invisible. No lo atrapa ningun test ni se ve en el atributo `style`: hay que mirar
 * los pixeles, o preguntarle a `elementFromPoint` quien esta arriba.
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
 * El resaltado: la celda que suena ENGROSA su borde, hacia adentro y hacia afuera.
 * Nada mas — sin relleno, sin cambio de color y sin `scale`.
 *
 * ## Por que el borde y no un relleno
 *
 * En un secuenciador de fondo oscuro el estandar es ENCENDER el step activo, porque la
 * metafora es un LED. Este tablero es tema claro —panel blanco, celdas vacias blancas—
 * y ahi subir luminancia hace desaparecer la celda: el amarillo de `V` se va a blanco.
 * Un relleno oscuro funciona (medido: al 30 % el peor caso de las 12 piezas, la `W`,
 * da ΔL* 8,8) pero tapa la nota que la celda muestra desde el spec 007, que es lo que
 * hay que poder leer. El borde marca el limite sin pisar el contenido.
 *
 * ## Por que engorda para los DOS lados
 *
 * Hacia adentro solo no alcanza: las 60 celdas ya tienen `border-slate-900`, ocupadas o
 * no, asi que engrosarlo es un cambio de grado contra un campo lleno de bordes negros.
 * El anillo exterior es lo que agrega el salto de tamano — la celda se lee mas grande
 * sin que crezca su caja.
 *
 * ## Y por que NO se usa `transform: scale`, que es lo obvio
 *
 * Porque `scale` cuenta para el overflow SCROLLEABLE del contenedor: en la ultima
 * columna y la ultima fila la celda crecida se sale del `overflow-x-auto` de `Board` y
 * aparecen las barras de desplazamiento —y como Tailwind fija solo `overflow-x`, el eje
 * Y computa a `auto` y tambien saca la suya. Medido en el DOM, mas abajo en este spec.
 * `box-shadow` es ink overflow: pinta afuera de la caja sin agrandar la region
 * scrolleable, asi que consigue el mismo efecto y no puede generar una barra.
 *
 * Gris pizarra y no un color: el color es IDENTIDAD —que pieza es— y el estado nunca se
 * comunica con hue. Es la misma regla por la que el fantasma es gris y no verde.
 */
const BORDE_COLOR = '#0f172a';

/** Grosor hacia adentro y hacia afuera, en px. */
const NOTA = { dentro: 3, fuera: 2 };

/**
 * Nota fuerte, click tenue (D7): si se vieran igual, el recorrido pareceria tener piezas
 * donde no hay. El click engorda solo hacia adentro y la mitad — se lee como un roce.
 */
const CLICK = { dentro: 2, fuera: 0 };

const borde = ({ dentro, fuera }: { dentro: number; fuera: number }): string =>
  `inset 0 0 0 ${dentro}px ${BORDE_COLOR}` + (fuera > 0 ? `, 0 0 0 ${fuera}px ${BORDE_COLOR}` : '');

export default function Playhead() {
  const ref = useRef<HTMLDivElement>(null);
  // Dos refs y no una: el `transform` va en la caja de 63 px —que es la que se mueve
  // sobre la grilla— y el borde en la baldosa de adentro, 2 px mas chica, que es la que
  // tiene la forma y el redondeo de la celda. Dibujarlo en la caja externa daria un
  // rectangulo que pisa la separacion entre celdas.
  const resalteRef = useRef<HTMLDivElement>(null);

  // Dependencias vacias a proposito: el loop se monta una vez y lee del motor y del
  // par de rutas por su cuenta, asi que no hay nada que re-suscribir cuando la app
  // re-renderiza. Es la misma forma que `Spectrum.tsx`.
  useEffect(() => {
    const el = ref.current;
    const resalte = resalteRef.current;
    if (!el || !resalte) return;

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
          resalte.style.boxShadow = borde(marca.nota ? NOTA : CLICK);
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
      className="absolute top-0 left-0 z-10 p-[2px] pointer-events-none"
      style={{ width: CELL_PX, height: CELL_PX, display: 'none' }}
    >
      {/* Misma caja que la baldosa de `Board.tsx` —2 px de aire y `rounded-lg`— para que
          el gris cubra la celda exacta y no medio pixel afuera. */}
      <div ref={resalteRef} className="w-full h-full rounded-lg" style={{ boxShadow: borde(NOTA) }} />
    </div>
  );
}

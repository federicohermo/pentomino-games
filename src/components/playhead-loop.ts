import { playheadOffset } from '../audio/engine.ts';
import { rutaActiva, velo } from './route-source.ts';
import { CELL_PX } from './constants/layout.constants.ts';
import { MARCA } from './constants/route.constants.ts';
import type { CeldaPorEstrenar } from './types/route.types.ts';

/**
 * El bucle de dibujo de la cabeza lectora y del velo: todo lo que `Playhead.tsx` hacia
 * adentro de su `useEffect`.
 *
 * **Vive en un `.ts` y no en el `.tsx` por una regla del repo, no por gusto.**
 * `react-refresh/only-export-components` prohibe que un `.tsx` exporte algo ademas del
 * componente, asi que mientras esto estuviera adentro de `Playhead.tsx` no se podia
 * exportar y, por lo tanto, no se podia testear — que es exactamente el argumento con el
 * que el spec 005 saco el dominio de `App.tsx` y el 022 saco la proyeccion al motor a
 * `engine-bridge.ts`. Es el mismo movimiento, aplicado al ultimo lugar donde quedaba
 * logica encerrada en un componente.
 *
 * El componente queda con lo unico que le corresponde: montar los dos contenedores y
 * pasar sus nodos. No hay cambio de comportamiento — el codigo es el mismo, y lo que se
 * mueve son 100 lineas de las que el 60 % son comentario.
 */

/** Lo que devuelve `iniciarCabeza` cuando no hay nodos: una limpieza que no limpia nada. */
const SIN_CABEZA = (): void => {};

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
 * da un delta de L* de 8,8 sobre un umbral de ~3) pero tapa la nota que la celda
 * muestra desde el spec 007, que es lo que hay que poder leer. El borde marca el limite
 * sin pisar el contenido.
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
 * Porque `scale` cuenta para el overflow SCROLLEABLE del contenedor: medido en el DOM
 * con `CELL_PX` en 63 —grilla de 630 x 378— con la cabeza en (9,5) y `scale(1.10)`, el
 * `scrollHeight` del `overflow-x-auto` de `Board` pasaba de 378 a 381 y aparecian las
 * barras de desplazamiento —las dos, porque Tailwind fija solo `overflow-x` y entonces
 * el eje Y computa a `auto`—. El spec 014 movio la celda a 71 y esos dos numeros no se
 * remidieron; lo que no depende del tamano es el MECANISMO, que es lo que decide:
 * `scale` agranda la region scrolleable y `box-shadow` es ink overflow, o sea que pinta
 * afuera de la caja sin agrandarla.
 *
 * Gris pizarra y no un color: el color es IDENTIDAD —que pieza es— y el estado nunca se
 * comunica con hue. Es la misma regla por la que el fantasma es gris y no verde.
 */
export const BORDE_COLOR = '#0f172a';

/** Grosor hacia adentro y hacia afuera, en px. */
export const NOTA = { dentro: 3, fuera: 2 };

/**
 * El cruce (spec 011, D8): la cabeza pasa sobre una celda OCUPADA que no es su turno
 * pero que igual suena una floritura (`Click.note`) — ni la nota propia de una pieza
 * ni el click mudo de siempre, asi que su borde va en el escalon intermedio entre los
 * otros dos. Los tres numeros —3/2, 2/1, 2/0— estan fijados en DESIGN.md.
 */
const CRUCE = { dentro: 2, fuera: 1 };

/**
 * Nota fuerte, cruce intermedio, click tenue (D7 del spec 010 mas D8 del 011): si dos
 * de los tres se vieran igual, el recorrido mentiria sobre cual de las tres cosas paso.
 * El click engorda solo hacia adentro y la mitad — se lee como un roce.
 */
const CLICK = { dentro: 2, fuera: 0 };

export const borde = ({ dentro, fuera }: { dentro: number; fuera: number }): string =>
  `inset 0 0 0 ${dentro}px ${BORDE_COLOR}` + (fuera > 0 ? `, 0 0 0 ${fuera}px ${BORDE_COLOR}` : '');

/** Que escalon de borde le toca a cada `MarcaKind` — la tabla de D8 hecha funcion. */
const BORDE_POR_KIND = { [MARCA.nota]: NOTA, [MARCA.cruce]: CRUCE, [MARCA.click]: CLICK } as const;

/**
 * Las clases del velo van como literales enteros y no armadas por concatenacion:
 * Tailwind escanea el fuente, asi que solo genera lo que aparece escrito completo.
 * Repiten el `p-[2px]` y el `rounded-lg` de la baldosa de `Board.tsx` a proposito — es
 * la misma caja, y poner los numeros a mano seria un segundo lugar donde mantenerlos.
 */
const VELO_CAJA = 'absolute p-[2px]';
const VELO_TAPA = 'w-full h-full rounded-lg border-2 border-dashed border-slate-900/50 bg-white/60';

/** Que celda de que pieza. Por pieza y no solo por celda: ver `CeldaPorEstrenar`. */
const claveDe = (e: CeldaPorEstrenar): string => `${e.id}:${e.cell[0]},${e.cell[1]}`;

/**
 * Arranca el bucle y devuelve su limpieza.
 *
 * Los tres nodos entran por parametro y pueden ser `null`: es la firma que tiene un
 * `ref.current` recien montado, y el guardia que sigue es la traduccion de eso. Con el
 * bucle adentro del componente ese guardia no lo podia ejercer nadie —React asigna los
 * refs antes de correr los efectos, asi que los tres estan siempre—; aca es una llamada.
 */
export function iniciarCabeza(
  capa: HTMLElement | null,
  el: HTMLElement | null,
  resalte: HTMLElement | null,
): () => void {
if (!capa || !el || !resalte) return SIN_CABEZA;

  // Clave de lo ULTIMO escrito, no la marca en si: comparar strings evita comparar
  // tuplas y deja el caso "oculto" expresado como cadena vacia. Es lo que baja de 60
  // escrituras por segundo a entre 4 y 11, y lo que hace que en pausa el loop no
  // toque el DOM ni una vez (AC7).
  let dibujado = '';
  let raf = 0;

  let veloVisto: readonly CeldaPorEstrenar[] | null = null;
  let tapas: { entrada: CeldaPorEstrenar; nodo: HTMLElement }[] = [];
  // El estreno se recuerda ACA y no en `route-source`: es el loop el que ve pasar la
  // cabeza. Sin esto, colocar una segunda pieza rearmaria el velo y volveria a tapar
  // celdas que ya se habian estrenado.
  const estrenadas = new Set<string>();

  const rearmar = (v: readonly CeldaPorEstrenar[]) => {
    capa.replaceChildren();
    tapas = v.map((entrada) => {
      const nodo = document.createElement('div');
      nodo.className = VELO_CAJA;
      nodo.style.left = `${entrada.cell[0] * CELL_PX}px`;
      nodo.style.top = `${entrada.cell[1] * CELL_PX}px`;
      nodo.style.width = `${CELL_PX}px`;
      nodo.style.height = `${CELL_PX}px`;
      if (estrenadas.has(claveDe(entrada))) nodo.style.display = 'none';
      const tapa = document.createElement('div');
      tapa.className = VELO_TAPA;
      nodo.appendChild(tapa);
      capa.appendChild(nodo);
      return { entrada, nodo };
    });
  };

  const draw = () => {
    // `rutaActiva()` PRIMERO y `playheadOffset()` despues, en ese orden. `rutaActiva`
    // es quien hace el swap al detectar que el motor cerro el ciclo; leyendo el
    // offset antes habria un cuadro en que un offset del ciclo NUEVO se dibuja sobre
    // la tabla del VIEJO, y si el ciclo nuevo es mas corto eso ilumina una celda que
    // no es. Asi la ventana queda en cero. `velo()` va en el medio por lo mismo: el
    // swap es lo que lo cambia.
    const marcas = rutaActiva();
    const v = velo();
    if (v !== veloVisto) {
      veloVisto = v;
      rearmar(v);
    }
    const offset = playheadOffset();

    // Una celda se estrena cuando la cabeza la PISA, no cuando arranca el ciclo: es lo
    // unico que hace visible que el orden de reproduccion no es el de colocacion, y que
    // a la pieza le toca su turno en un instante concreto. Las de offset `null` son de
    // una pieza que todavia no entro al ciclo, asi que no hay instante que esperar — se
    // destapan enteras en el swap, cuando `velo()` cambia.
    //
    // `>=` y no `===`: si un cuadro se pierde —la pestana oculta suspende el rAF— el
    // offset ya avanzo, y con igualdad la celda quedaria tapada hasta la vuelta
    // siguiente.
    //
    // Que sea `>=` es tambien lo que ata este bucle a la guarda `now < origin` de
    // `playheadOffset`: el swap se decide DENTRO del lookahead, y si en ese cuadro la
    // cabeza contestara la cola del ciclo nuevo —el offset MAXIMO— este `for`
    // destaparia las cinco celdas de un saque, en el mismo cuadro en que se crearon.
    // Es el bug que el review encontro. Si alguna vez `playheadOffset` deja de
    // devolver `null` antes del origin, esto vuelve callado.
    if (offset !== null) {
      for (const { entrada, nodo } of tapas) {
        if (entrada.offset === null || nodo.style.display === 'none') continue;
        if (offset < entrada.offset) continue;
        nodo.style.display = 'none';
        estrenadas.add(claveDe(entrada));
      }
    }

    const marca = offset === null ? null : marcas[offset] ?? null;
    // `marca.kind` y no un booleano en la clave: con tres casos, dos marcas en la
    // misma celda pero de kind distinto (nota vs. cruce, por ejemplo si la ruta
    // volviera a pasar por ahi en otro offset del mismo cuadro dibujado) no pueden
    // deduplicarse como si fueran la misma.
    const clave = marca ? `${marca.cell[0]},${marca.cell[1]},${marca.kind}` : '';
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
        resalte.style.boxShadow = borde(BORDE_POR_KIND[marca.kind]);
      }
    }

    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(raf);
    capa.replaceChildren();
  };
}

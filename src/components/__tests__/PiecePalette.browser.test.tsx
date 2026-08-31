import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-react';
import { eventoDePuntero, stubearCaptura } from './gesto-de-puntero.ts';
import { page } from 'vitest/browser';
import Dock from '../PiecePalette.tsx';
import { REGIMEN } from '../../domain/constants/music.constants.ts';
import { ORIENTACIONES_INICIALES } from '../constants/orientation.constants.ts';
import type { PropsDeOrientacion, PropsDeTransporte } from '../types/panel.types.ts';
import type { MemoriaDeOrientacion } from '../types/orientation.types.ts';

/**
 * El dock entero: el chasis que se arrastra, las doce miniaturas, el régimen, la
 * orientación en texto y el transporte.
 *
 * Este archivo verifica lo que es del PANEL COMPLETO y no de un panel de adentro —la forma
 * de cada uno la verifican `OrientationPanel.browser.test.tsx` y
 * `TransportPanel.browser.test.tsx`—, y la mitad de lo que verifica es un BORRADO. Eso
 * cambia la forma de la aserción: «la leyenda de gestos no existe más» sólo es falsable con
 * una medición del DOM que dé cero, o con un `queryByRole` anclado que dé vacío. Leer el
 * diff no lo verifica, y un test que renderiza y no pregunta nada tampoco.
 *
 * ## Todo se consulta por el NOMBRE ACCESIBLE, y es lo que sobrevive al minimalismo
 *
 * El dock habla en color, forma y posición: de sus 21 botones, ocho no tienen una sola
 * letra en pantalla. Un test escrito contra el texto visible verificaría el canal que este
 * panel deliberadamente vacía, así que lo que se consulta es el nombre que el navegador
 * CALCULA —`toHaveAccessibleName`, `getByRole({ name })`— y nunca el atributo `aria-label`:
 * la tercera cláusula de `.claude/rules/ui.md` §«El árbol de accesibilidad dice lo que el
 * color pinta» **prefiere** `aria-labelledby` sobre el texto visible, así que exigir el
 * atributo prohibiría la forma preferida.
 *
 * Y los nombres van **anclados con regex**, porque `getByRole` empareja por subcadena y acá
 * eso muerde de verdad: el asa se llama `Piezas — arrastrar…` y el *disclosure*
 * `Plegar Piezas`, así que un `name: 'Piezas'` sin anclar caza los dos.
 *
 * Necesita layout: se mide con `getBoundingClientRect`, `scrollHeight` y
 * `getComputedStyle`, que en jsdom dan cero.
 */

/** Las doce en cero con las ranuras que el test quiera pisar. */
const memoria = (pisadas: Partial<MemoriaDeOrientacion> = {}): MemoriaDeOrientacion =>
  ({ ...ORIENTACIONES_INICIALES, ...pisadas });

const orientacion = (over: Partial<PropsDeOrientacion> = {}): PropsDeOrientacion => ({
  selected: 'F',
  // Las DOCE: la linea de orientacion deriva la de `selected` en vez de
  // recibirla suelta, que es lo que impide que la linea diga una cosa y la miniatura
  // dibuje otra.
  orientaciones: ORIENTACIONES_INICIALES,
  regimen: REGIMEN.escala,
  onSelect: vi.fn(),
  onRegimen: vi.fn(),
  onResetOrientacion: vi.fn(),
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

/**
 * Dónde arranca el flotante en estos tests, lejos de los cuatro bordes.
 *
 * El acotado de `moverPanel` es una decisión propia con sus propios tests en `drag.test.ts`;
 * acá interesa que el gesto llegue al callback, así que el punto de partida se elige para
 * que ningún arrastre de este archivo toque un límite y el número esperado sea la suma.
 */
const POSICION = { x: 24, y: 24 };

/**
 * El dock con el plegado y la posición ya resueltos, para que los casos de abajo sigan
 * hablando de lo que les importa.
 *
 * El chasis le suma cuatro props que son estado del shell —`abierto`, `onToggle`,
 * `posicion` y `onMover`—, y los dos casos que sí tratan de eso usan `Dock` directo.
 */
const PiecePalette = (props: { orientacion: PropsDeOrientacion; transporte: PropsDeTransporte }) =>
  <Dock {...props} abierto onToggle={vi.fn()} posicion={POSICION} onMover={vi.fn()} />;

/**
 * Los nombres accesibles de los controles que este archivo consulta, anclados.
 *
 * Escritos una sola vez porque son la única llave: sin texto visible que buscar, un nombre
 * mal copiado no da un test que falla sino un `getByRole` que no encuentra nada, y el
 * mensaje habla del elemento ausente y no de la etiqueta.
 */
const ASA = /^Piezas — arrastrar el panel, o moverlo con las flechas$/;
const PLEGAR = /^Plegar Piezas$/;
const DESPLEGAR = /^Desplegar Piezas$/;
const GRUPO = /^Qué cambia la rotación$/;
const ESCALA = /^La rotación cambia la fórmula de escala$/;
const ORDEN = /^La rotación cambia el arranque del arpegio$/;
const CERO = /^Volver esta pieza a 0° sin reflejar$/;
const RELOJ = /^Tempo: 110 bpm$/;
const MINIATURA = /^F, rotación 0°$/;

/**
 * Un nombre hecho sólo de símbolos, y por qué la aserción de existencia no alcanza sola.
 *
 * `toHaveAccessibleName()` a secas no cierra «el glifo no es un nombre»: el algoritmo del
 * navegador toma el contenido del botón, así que un `<button>▾</button>` TIENE nombre
 * accesible y es «▾». La línea que sí se puede decidir por máquina es que el nombre tenga al
 * menos una letra o un dígito, que es la definición de Unicode y no una lista escrita a
 * mano. Es el mismo criterio que `arbol-accesible.browser.test.tsx` aplica a la app entera.
 */
const SOLO_SIMBOLOS = /^[^\p{L}\p{N}]+$/u;

/**
 * Qué botón «se quedó sin texto visible» a los efectos del `title` de AC9: el que no tiene
 * una sola LETRA en pantalla.
 *
 * Es la regla que reparte bien los 21 sin nombrarlos uno por uno. Deja adentro a los ocho
 * que muestran un glifo, un número o nada —el `0°` y el reloj incluidos, que muestran
 * dígitos y perdieron su palabra— y deja afuera exactamente a los dos que no piden tooltip:
 * el asa, que dice `Piezas`, y las doce miniaturas, cuya letra es el símbolo y no prosa.
 */
const SIN_LETRAS = /^[^\p{L}]*$/u;

/** Cómo se nombra un botón en un mensaje de falla, cuando justamente puede no tener nombre. */
const señas = (el: Element) => `<button> "${el.textContent ?? ''}"`;

/**
 * Un viewport de escritorio, por lo mismo que `arbol-accesible.browser.test.tsx`: sin
 * fijarlo Playwright arranca en 414 x 896.
 *
 * Acá cambia dos mediciones y no el veredicto: el `scrollHeight` de AC2 y el acotado del
 * arrastre de AC12, que con esta ventana no llega a morder.
 */
const VIEWPORT: [number, number] = [1024, 768];

beforeEach(async () => {
  await page.viewport(...VIEWPORT);
});

describe('PiecePalette', () => {
  it('AC10 — el texto visible del dock abierto baja de los 210 caracteres, y la prosa no esta', async () => {
    const { container } = await render(
      <PiecePalette orientacion={orientacion()} transporte={transporte()} />,
    );
    const texto = container.querySelector('aside')!.textContent!;

    // Los 210 caracteres en 27 nodos que el spec mide en el DOM real. Se compara contra el
    // numero medido y no contra una estimacion, que es lo que AC10 pide.
    expect(texto.length).toBeLessThan(210);
    // Y el piso, que es lo que impide que esto pase en verde con un dock vacio: las doce
    // letras son el simbolo de la tabla periodica y se quedan, o sea doce caracteres antes
    // de contar `Piezas`.
    expect(texto.length).toBeGreaterThan(12);

    // La leyenda de gestos —227 px, mas que el scroller entero— y las cuatro etiquetas de
    // prosa. Su contenido no se pierde: vive en el issue #170 para volver en su lugar
    // propio, que es lo que D6 exige para no dejar deuda invisible.
    const prosa = [
      'Rueda sobre el tablero', 'arranca y para', 'pieza la elige',
      'Rotación', 'Notas actuales', 'tónica', 'Tempo', 'bpm',
    ];
    for (const frase of prosa) expect(texto, frase).not.toContain(frase);
  });

  it('AC2 — el dock abierto no scrollea, ni con la celda en 69,5 px ni en 73', async () => {
    // El desborde de 1192 px y la columna unica son el mismo bug por los dos ejes: una caja
    // fijada en celdas para un contenido que no entra en ella. La caja de este panel se mide
    // por su contenido, asi que lo que cierran los dos tamanos de celda del spec 031 es que
    // no vuelva a depender de `--cell` sin que nadie lo note.
    const { container } = await render(
      <PiecePalette orientacion={orientacion()} transporte={transporte()} />,
    );
    const dock = container.querySelector('aside')!;
    const region = container.querySelector('#dock-piezas')!;

    for (const celda of ['69.5px', '73px']) {
      container.style.setProperty('--cell', celda);
      // Que haya layout de verdad: en jsdom los tres numeros serian 0 y la resta daria 0
      // sin haber verificado nada.
      expect(region.clientHeight, celda).toBeGreaterThan(0);
      expect(region.scrollHeight - region.clientHeight, celda).toBe(0);
      expect(dock.scrollHeight - dock.clientHeight, celda).toBe(0);
    }
  });

  it('AC9 — los 21 botones del dock tienen nombre accesible, y ninguno se llama con un glifo', async () => {
    const { container } = await render(
      <PiecePalette orientacion={orientacion()} transporte={transporte()} />,
    );
    const botones = [...container.querySelectorAll('aside button')];

    // El conteo exacto y no un piso: un recorrido que encuentra menos botones pasa en verde
    // sin haber mirado los que faltan, que es la forma de fallar en verde que este repo ya
    // se comio dos veces. Son las 12 miniaturas, el asa, el que pliega, los 2 del regimen,
    // el `0°`, el reloj y los 3 del transporte.
    expect(botones).toHaveLength(21);

    for (const boton of botones) {
      expect(boton, señas(boton)).toHaveAccessibleName();
      expect(boton, `${señas(boton)} se llama con un glifo`).not.toHaveAccessibleName(SOLO_SIMBOLOS);
    }
  });

  it('AC9 — el control sin texto visible suma `title` con su mismo nombre, y el asa no lleva ninguno', async () => {
    const { container } = await render(
      <PiecePalette orientacion={orientacion()} transporte={transporte()} />,
    );
    const botones = [...container.querySelectorAll('aside button')];
    const mudos = botones.filter(b => SIN_LETRAS.test(b.textContent!.trim()));

    // Los ocho: el que pliega, los dos del regimen, el `0°`, el reloj y los tres del
    // transporte. El numero va exacto por lo mismo que el de arriba.
    expect(mudos).toHaveLength(8);

    for (const boton of mudos) {
      const titulo = boton.getAttribute('title');
      expect(titulo, señas(boton)).not.toBeNull();
      // El `title` y el nombre accesible dicen lo MISMO: el puntero y el lector no pueden
      // contar dos historias distintas del mismo boton. Se compara contra el nombre
      // calculado, asi que la comparacion vale igual si manana el nombre viene de un
      // `aria-labelledby`.
      expect(boton, señas(boton)).toHaveAccessibleName(titulo!);
    }

    // El asa es la excepcion y es deliberada: dice `Piezas` en pantalla, asi que un tooltip
    // repetiria lo que se ve. Su nombre accesible CONTIENE el texto visible, que es lo que
    // pide WCAG 2.5.3 para que quien dicta «Piezas» active este boton.
    const asa = page.getByRole('button', { name: ASA }).element();
    expect(asa.hasAttribute('title')).toBe(false);
    expect(asa.textContent).toBe('Piezas');
  });

  it('AC9b — ningun `aria-labelledby` del dock apunta a un `id` que no existe', async () => {
    const { container } = await render(
      <PiecePalette orientacion={orientacion()} transporte={transporte()} />,
    );
    const dock = container.querySelector('aside')!;

    // Se recolecta y se compara contra la lista vacia en vez de asertar adentro de un
    // `for`: hoy el dock no tiene un solo `aria-labelledby`, y un bucle sobre cero
    // elementos pasa sin haber preguntado nada.
    const colgados = [...dock.querySelectorAll('[aria-labelledby]')]
      .flatMap(el => el.getAttribute('aria-labelledby')!.split(/\s+/))
      .filter(id => document.getElementById(id) === null);
    expect(colgados).toEqual([]);

    // La otra mitad, que es la que tiene contenido: las dos anclas de texto que el 052 saca
    // no estan, y los dos controles que nombraban conservan su nombre por atributo. Sin
    // esto, borrar los dos `<span>` deja dos controles sin nombre accesible.
    expect(dock.querySelector('#rotacion-etiqueta')).toBeNull();
    expect(dock.querySelector('#tempo-etiqueta')).toBeNull();
    await expect.element(page.getByRole('group', { name: GRUPO })).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: RELOJ })).toBeInTheDocument();
  });

  it('AC12 — un arrastre que empieza y termina en el asa no pliega el panel', async () => {
    // El asa y el *disclosure* son DOS botones, y este es el caso que lo obliga: el
    // navegador sintetiza un `click` sobre el mismo nodo despues del `pointerup`, asi que
    // con un solo boton el arrastre lo cerraria al soltarlo.
    const onToggle = vi.fn();
    const onMover = vi.fn();
    const { container } = await render(
      <Dock
        orientacion={orientacion()}
        transporte={transporte()}
        abierto
        onToggle={onToggle}
        posicion={POSICION}
        onMover={onMover}
      />,
    );
    const asa = page.getByRole('button', { name: ASA }).element();

    // El porque del stub —y de despachar sobre `window`— esta escrito una sola vez, en
    // `gesto-de-puntero.ts`. Aca el gesto va desarmado y no con el helper `arrastrar`
    // porque lo que este caso necesita es el `click` sintetico del final, que es su sujeto.
    stubearCaptura(asa);
    asa.dispatchEvent(eventoDePuntero('pointerdown', 200, 200));
    window.dispatchEvent(eventoDePuntero('pointermove', 260, 240));
    window.dispatchEvent(eventoDePuntero('pointerup', 260, 240));
    // El `click` sintetico con el que termina cualquier arrastre. Es la mitad del caso que
    // no se puede omitir: sin el, la implementacion ingenua tambien pasa.
    asa.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Que el arrastre haya pasado de verdad, o lo de abajo no verificaria nada.
    expect(onMover).toHaveBeenCalledWith({ x: POSICION.x + 60, y: POSICION.y + 40 });
    expect(onToggle).not.toHaveBeenCalled();
    expect(page.getByRole('button', { name: PLEGAR }).element().getAttribute('aria-expanded'))
      .toBe('true');
    expect(container.querySelector('#dock-piezas')!.hasAttribute('hidden')).toBe(false);
  });

  it('021 — el encabezado son DOS botones: el asa que arrastra y el que pliega', async () => {
    const onToggle = vi.fn();
    const abierto = await render(
      <Dock
        orientacion={orientacion()}
        transporte={transporte()}
        abierto
        onToggle={onToggle}
        posicion={POSICION}
        onMover={vi.fn()}
      />,
    );
    // Dos y no uno, y es la razon por la que todo nombre de este archivo va anclado: los
    // dos contienen la palabra `Piezas`.
    expect(page.getByRole('button', { name: /Piezas/ }).elements()).toHaveLength(2);

    // El asa no controla ninguna region: arrastra. `aria-expanded` sobre ella diria que el
    // gesto de agarrar el panel lo abre.
    const asa = page.getByRole('button', { name: ASA }).element();
    expect(asa.hasAttribute('aria-expanded')).toBe(false);
    expect(asa.hasAttribute('aria-controls')).toBe(false);

    // El *disclosure* lleva las dos cosas, y `aria-expanded` y no `aria-pressed`:
    // `.claude/rules/ui.md` lo fija —`aria-pressed` dice que un control esta hundido y
    // `aria-expanded` que la region que controla esta abierta—.
    const plegar = page.getByRole('button', { name: PLEGAR, expanded: true });
    await expect.element(plegar).toBeInTheDocument();
    expect(plegar.element().getAttribute('aria-controls')).toBe('dock-piezas');
    const region = abierto.container.querySelector('#dock-piezas')!;
    expect(region.getAttribute('aria-controls')).toBeNull();
    expect(region.hasAttribute('hidden')).toBe(false);

    await plegar.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
    await abierto.unmount();

    // Plegado: el nombre dice QUE hace y no en que estado esta, y el contenido se OCULTA sin
    // desmontarse — de eso dependen el `ResizeObserver` del espectro y la barrera del `memo`
    // de `OrientationPanel`.
    const plegado = await render(
      <Dock
        orientacion={orientacion()}
        transporte={transporte()}
        abierto={false}
        onToggle={onToggle}
        posicion={POSICION}
        onMover={vi.fn()}
      />,
    );
    await expect.element(page.getByRole('button', { name: DESPLEGAR, expanded: false }))
      .toBeInTheDocument();
    const oculta = plegado.container.querySelector('#dock-piezas')!;
    expect(oculta.hasAttribute('hidden')).toBe(true);
    // El arbol sigue vivo: las doce miniaturas estan en el DOM aunque no se vean.
    expect(oculta.querySelectorAll('button').length).toBeGreaterThan(12);
  });

  it('el regimen son DOS botones simetricos, y su grupo se nombra sin ancla de texto', async () => {
    // Sigue sin ser un ON/OFF: ninguno de los dos valores es la ausencia del otro, que es la
    // lectura que D4 del 017 rechaza. Y sigue siendo `role="group"` y no `radiogroup`,
    // porque eso obliga a un modelo de foco que el spec 026 fija para el tablero.
    const onRegimen = vi.fn();
    const { container } = await render(
      <PiecePalette
        orientacion={orientacion({ regimen: REGIMEN.escala, onRegimen })}
        transporte={transporte()}
      />,
    );
    await expect.element(page.getByRole('group', { name: GRUPO })).toBeInTheDocument();
    // El nombre sale del `aria-label` y no de un `<span>` que haya que mantener vivo. Con el
    // ancla de texto borrada y sin este atributo, el grupo se queda sin nombre accesible.
    expect(page.getByRole('group', { name: /^Rotación$/ }).elements()).toHaveLength(0);
    expect(container.querySelectorAll('[role="group"]')).toHaveLength(1);

    const botones = [...container.querySelectorAll('[role="group"] button')];
    expect(botones).toHaveLength(2);
    // Los dos declaran `aria-pressed` —ninguno queda en `null`— y exactamente uno esta en
    // `true`: el estado que la fila pinta en oscuro es el mismo que anuncia el arbol.
    expect(botones.map(b => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    // Y los dos glifos son el texto visible, en su orden: `⇗` para la formula que se mueve
    // de altura y `⇄` para el arpegio que se reordena.
    expect(botones.map(b => b.textContent)).toEqual(['⇗', '⇄']);

    await page.getByRole('button', { name: ORDEN }).click();
    expect(onRegimen).toHaveBeenCalledWith(REGIMEN.orden);
    // El que ya esta puesto tambien pide su valor: es un grupo de seleccion unica y no un
    // interruptor, asi que apretarlo no alterna nada.
    await page.getByRole('button', { name: ESCALA }).click();
    expect(onRegimen).toHaveBeenLastCalledWith(REGIMEN.escala);
  });

  it('los seis botones que el 019 borra y el slider del 052 NO estan en el DOM', async () => {
    // La contraparte falsable de dos borrados. Los nombres van ANCLADOS: `getByRole`
    // empareja por subcadena, y el nombre de las doce miniaturas dice «rotación 180°», asi
    // que un `/180°/` suelto encontraria la miniatura y este test no fallaria nunca.
    const { container } = await render(
      <PiecePalette
        orientacion={orientacion({ orientaciones: memoria({ F: { rotation: 2, mirror: true } }) })}
        transporte={transporte()}
      />,
    );
    for (const grados of ['90°', '180°', '270°']) {
      expect(page.getByRole('button', { name: new RegExp(`^${grados}$`) }).elements(), grados)
        .toHaveLength(0);
    }
    expect(page.getByRole('button', { name: /^Reflexión$/ }).elements()).toHaveLength(0);

    // AC7 por el lado del dock: el tempo se lee y se ajusta sin slider. Dos controles y una
    // palabra para un numero de tres digitos era la fila mas cara del panel.
    expect(container.querySelectorAll('aside input[type="range"]')).toHaveLength(0);

    // Y las etiquetas se fueron con sus controles: un `<span>` que nombra un grupo
    // inexistente deja un `aria-labelledby` colgando o, peor, un texto en pantalla que no
    // corresponde a nada.
    expect(container.querySelector('#reflexion-etiqueta')).toBeNull();
    expect(container.querySelector('#recorrido-etiqueta')).toBeNull();
  });

  it('la orientacion se lee en texto, que es lo que la miniatura no puede decir', async () => {
    // Las seis piezas ciegas —`I T U V W X`— suenan distinto sin verse distinto en 29 de
    // las 96 combinaciones. **No es prosa y por eso se queda**: es un LECTOR de dos
    // caracteres, la misma clase de nodo que el numero del reloj.
    const sinReflejar = await render(
      <PiecePalette
        orientacion={orientacion({ orientaciones: memoria({ F: { rotation: 3, mirror: false } }) })}
        transporte={transporte()}
      />,
    );
    // La linea se localiza por el boton `0°` que la comparte, o sea por nombre accesible y
    // no por `className` ni por el texto que se esta verificando.
    const linea = () => page.getByRole('button', { name: CERO }).element().closest('p')!;
    expect(linea().textContent).toContain('270°');
    expect(linea().textContent).not.toContain('reflejada');
    await sinReflejar.unmount();

    const conReflexion = await render(
      <PiecePalette
        orientacion={orientacion({ orientaciones: memoria({ F: { rotation: 2, mirror: true } }) })}
        transporte={transporte()}
      />,
    );
    expect(linea().textContent).toContain('180° · reflejada');
    await conReflexion.unmount();

    // Dice la de la PIEZA EN LA MANO, no una global. Con la misma memoria y otro `selected`
    // la linea cambia — que es lo que hace visible la memoria por pieza.
    const otra = memoria({ F: { rotation: 2, mirror: true }, T: { rotation: 1, mirror: false } });
    await render(
      <PiecePalette
        orientacion={orientacion({ selected: 'T', orientaciones: otra })}
        transporte={transporte()}
      />,
    );
    expect(linea().textContent).toContain('90°');
    expect(linea().textContent).not.toContain('reflejada');
  });

  it('la linea de orientacion reserva su renglon y no salta con el peor caso', async () => {
    // Si envuelve, mueve todo lo que tiene debajo justo cuando lo estas tocando. El peor
    // caso de largo es `270° · reflejada`.
    const alto = async (o: { rotation: 0 | 1 | 2 | 3; mirror: boolean }) => {
      const { unmount } = await render(
        <PiecePalette
          orientacion={orientacion({ orientaciones: memoria({ F: o }) })}
          transporte={transporte()}
        />,
      );
      const linea = page.getByRole('button', { name: CERO }).element().closest('p')!;
      const h = Math.round(linea.getBoundingClientRect().height);
      const interlineado = parseFloat(getComputedStyle(linea).lineHeight);
      await unmount();
      return { h, interlineado };
    };

    const corto = await alto({ rotation: 0, mirror: false });
    const largo = await alto({ rotation: 3, mirror: true });
    // Que haya layout de verdad: en jsdom los dos serian 0 y el test pasaria vacio.
    expect(corto.h).toBeGreaterThan(0);
    expect(largo.h).toBe(corto.h);
    // Y UN renglon, no dos: el peor caso entra sin envolver. Se compara contra el
    // interlineado real porque el `1lh` esta atado a la fuente.
    expect(corto.h).toBe(Math.round(corto.interlineado));
  });

  it('020 — el boton `0°` pide volver la pieza en la mano al arranque', async () => {
    // El panel es presentacional: lo unico verificable aca es que el gesto llegue al
    // callback del shell, y que el nombre diga las DOS mitades — la etiqueta visible dice
    // solo los grados, pero el boton resetea tambien la reflexion.
    const onResetOrientacion = vi.fn();
    await render(
      <PiecePalette
        orientacion={orientacion({
          orientaciones: memoria({ F: { rotation: 2, mirror: true } }),
          onResetOrientacion,
        })}
        transporte={transporte()}
      />,
    );
    const boton = page.getByRole('button', { name: CERO });
    await expect.element(boton).toHaveTextContent('0°');
    await boton.click();
    expect(onResetOrientacion).toHaveBeenCalledTimes(1);
  });

  it('el orden de la tarjeta, de arriba abajo', async () => {
    // Se lee en el orden del DOM y por nombre accesible, que es el unico que sobrevive a un
    // panel donde ocho de los 21 botones no tienen una letra en pantalla.
    const { container } = await render(
      <PiecePalette orientacion={orientacion()} transporte={transporte()} />,
    );
    const botones = [...container.querySelectorAll('aside button')];
    const donde = (name: RegExp) => botones.indexOf(page.getByRole('button', { name }).element());

    expect(donde(ASA)).toBeLessThan(donde(MINIATURA));
    expect(donde(MINIATURA)).toBeLessThan(donde(ESCALA));
    expect(donde(ESCALA)).toBeLessThan(donde(CERO));
    expect(donde(CERO)).toBeLessThan(donde(RELOJ));
  });
});

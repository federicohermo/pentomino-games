# Spec 021 — El tablero es la pantalla

> Sin ticket: este repo no tiene tablero de Jira. Ver `specs/README.md`.
>
> **No cambia una nota.** Cambia el layout entero: muere el `max-w-6xl grid-cols-12`, `CELL_PX` deja de
> ser una constante, y las dos tarjetas que quedan pasan a flotar sobre el tablero.
>
> **Va último del lote 018–021** porque rebasa sobre los otros tres y es el único que toca los cuatro
> componentes a la vez.

## Problema

El tablero ocupa el **15 % de la pantalla**. Medido: la grilla mide 730 × 438 px fijos dentro de un
`max-w-6xl`, o sea 319 740 px² sobre los 2 073 600 de un viewport de 1920 × 1080.

El otro 85 % es tarjeta blanca, margen y aire. Y el número no mejora con una pantalla más grande: `CELL_PX`
es la constante `73`, así que el tablero mide lo mismo en un monitor de 27 pulgadas que en una laptop
—en la laptop llena más porque la pantalla es más chica—.

Eso está bien argumentado para el layout que hay: el 73 sale de dividir el interior de una tarjeta de
`md:col-span-8` por diez, y el docblock de `CELL_PX` tiene sesenta líneas explicando cada eslabón. Lo
que ya no está bien argumentado es la **tarjeta**: existe para convivir en una fila con el panel de
piezas, y el panel de piezas no necesita una columna propia — necesita estar a mano.

Y lo que se pierde es lo que el instrumento tiene para decir. Cada celda muestra su nota y su paso
(`#3`) en 19 px; la cabeza lectora del spec 010 recorre el circuito celda por celda; el 012 hizo que el
arpegio *camine* la pieza. Todo eso pasa en 730 × 438.

## Solución Propuesta

**El tablero llena el viewport. Los dos paneles flotan encima y se pueden plegar.**

### El tamaño de la celda

```
CELL_PX = max(73, min(vw / 10, vh / 6))
```

Medido sobre los viewports reales:

```
viewport      por ancho   por alto   CELL_PX   nota      scroll-x
1920 × 1080     192,0      180,0      180,0    46,8 px
1512 ×  982     151,2      163,7      151,2    39,4 px
1440 ×  900     144,0      150,0      144,0    37,5 px
1366 ×  768     136,6      128,0      128,0    33,3 px
1280 ×  720     128,0      120,0      120,0    31,2 px
 834 × 1112      83,4      185,3       83,4    21,7 px
 430 ×  932      43,0      155,3       73,0    19,0 px    sí
 375 ×  667      37,5      111,2       73,0    19,0 px    sí
```

En una pantalla de escritorio la celda pasa de 73 a entre 120 y 180 px: **el tablero crece entre 2,7 y
6 veces en área.**

### El piso es 73 y no 60 — la medición corrigió el plan

La intuición decía 60, que es el piso que el docblock de `CELL_PX` tiene medido con un `Range` sobre el
nodo de texto: abajo de 60 px de celda, `D#4` no entra a 19 px de fuente.

Pero ese 60 vale **con la fuente clavada en 19 px**. Este spec hace que la tipografía escale con la
celda —si no, una nota de 19 px en una baldosa de 180 se ve como una mosca— y con eso el 60 deja de
significar lo que significaba: a 60 de celda la nota renderiza a **15,6 px**, o sea *por debajo* del
tamaño que el repo midió como necesario.

El piso coherente con la fuente proporcional es **73**: es la celda donde la nota vale exactamente los
19 px medidos. Y tiene una segunda virtud, que es la promesa que deja: **el tablero nunca es más chico
que hoy, sólo más grande.** Abajo de 730 px de viewport el tablero scrollea horizontalmente, que es
exactamente lo que hace hoy debajo de `md`.

### La tipografía escala con la celda

Las dos proporciones salen de lo que ya está medido y en producción:

```
nota:  19 / 73 = 0,2603 × CELL_PX
#N:    13 / 73 = 0,1781 × CELL_PX
```

A 73 dan 19 y 13 exactos, o sea que en el piso el tablero se ve **idéntico** a hoy. Eso no es una
coincidencia feliz: es lo que hace que este spec no tenga que re-medir el aire alrededor del texto, que
es la trampa que el docblock de `CELL_PX` dice haberse comido dos veces.

### Los dos flotantes

| Panel | Dónde | Qué tapa |
|---|---|---|
| **Piezas** | dock pegado al borde **derecho**, centrado en vertical | `(8,1)` … `(9,4)` — 8 celdas |
| **Señal** | franja **abajo a la izquierda** | `(0,5)` `(1,5)` `(2,5)` — 3 celdas |

**Las dos cajas se miden en celdas, no en px** — dock `2 × 4` celdas, franja `3 × 1`, o sea
`calc(var(--cell) * n)` como todo lo demás. Con medidas fijas la tabla vale solo a 1920 × 1080: a
1366 × 768 un dock de 640 px de alto centrado entra en la fila 5 y **tapa `(9,5)`**, que es la celda
que este spec declaró intocable. La cuenta está en el §4 del research. Consecuencia que hay que
absorber: a `CELL_PX = 73` el dock queda en 146 × 292 px y el panel de piezas necesita **scroll
interno propio**, porque hoy mide 349 × 496.

**11 de 60 celdas** tapadas con los dos abiertos, y **ninguna de las dos de la costura**: `(0,0)` y
`(9,5)` quedan libres. Eso es lo que decidió la posición y no la estética — ahí es donde el circuito
cierra (spec 009) y donde arranca la cabeza lectora (spec 010), así que son las dos celdas que no se
pueden tapar.

Los dos **colapsables** con un click en su encabezado, y los dos **abiertos al cargar**: un instrumento
que arranca con los controles escondidos no se descubre. Plegado, cada panel deja sólo su encabezado, y
cualquier celda tapada está a un click de distancia.

Arriba se descartó por medición: una barra superior tapa el borde de arriba entero, `(0,0)` incluida.

## Criterios de Aceptación

- **AC1** — El tablero ocupa el viewport. No hay `max-w-6xl`, ni tarjeta blanca alrededor de la grilla,
  ni scroll vertical de página: `document.documentElement.scrollHeight === innerHeight` en los cinco
  viewports de escritorio de la tabla.
- **AC2** — `CELL_PX = max(73, min(vw/10, vh/6))`, recalculado al redimensionar la ventana.
- **AC3** — La nota y el `#N` escalan con la celda, con las proporciones `0,2603` y `0,1781`.
- **AC4** — A `CELL_PX = 73` el tablero se ve **igual que hoy**: nota a 19 px, `#N` a 13 px.
- **AC5** — Abajo de 730 px de viewport el tablero scrollea horizontalmente y la celda se queda en 73.
  Y abajo de **438 px de alto** el desborde vertical lo absorbe el **contenedor del tablero**, no la
  página: es el mismo `overflow-x-auto` cuyo eje Y computa a `auto`.
- **AC6** — La cabeza lectora sigue alineada con la grilla en cualquier tamaño de celda, **también
  mientras se redimensiona la ventana con el transporte corriendo**.
- **AC7** — La cabeza lectora sigue dibujándose fuera del estado de React, a 60 fps, sin re-render por
  frame (spec 010).
- **AC8** — Los dos paneles flotan sobre el tablero, en una capa superior, y no empujan la grilla.
- **AC9** — Ninguno de los dos tapa `(0,0)` ni `(9,5)` en ningún viewport de escritorio, **verificado
  en 1920×1080 y 1366×768**, que son los dos donde la geometría cambia de manos. Se cumple por
  construcción —las cajas se miden en celdas— y no por una medición hecha en un solo viewport.
- **AC10** — Los dos se pliegan y se despliegan con un click, y arrancan desplegados.
- **AC11** — El espectro se sigue redibujando al cambiar de tamaño su contenedor, incluido al plegar y
  desplegar.
- **AC12** — Colocar, quitar y mutear siguen funcionando en cualquier celda no tapada, con cualquier
  tamaño de celda: el hit-testing usa el mismo número que el dibujo.
- **AC13** — Los cuatro gestos del 013 (rueda, `Shift`, botón derecho, `Ctrl`) y el `Alt` del 014
  siguen funcionando sobre el tablero nuevo.
- **AC14** — La rueda sobre el tablero sigue sin scrollear la página, y `Ctrl`+rueda sigue haciendo el
  zoom del navegador.
- **AC16** — La leyenda de gestos del `<footer>` **no desaparece**: se muda adentro de un flotante. Es
  hoy el único lugar donde los cuatro gestos del 013 están escritos, y borrarla los vuelve invisibles
  otra vez — el problema que su propio comentario dice haber resuelto.
- **AC17** — La cabeza lectora y su velo se dibujan sobre la baldosa exacta a cualquier `CELL_PX`: los
  **seis** sitios de `CELL_PX` de `Playhead.tsx` derivan de `--cell`, y los **cuatro** lugares de
  geometría de baldosa del mismo archivo —`VELO_CAJA`/`VELO_TAPA` del velo, y el `p-0.5` de la caja de
  la cabeza con el `rounded-lg` de su resalte— siguen coincidiendo con los de `Board.tsx`. Diez
  conversiones en total, no seis: los cuatro últimos no nombran a `CELL_PX` y por eso se pasan por alto.
- **AC15** — El docblock de `CELL_PX` se reescribe: se va la tabla de repartos de columnas, se queda la
  medición del piso, y entra la fórmula con la tabla de viewports.
- **AC18** — Los cuatro números fijos de la baldosa escalan con la celda y **no sólo las dos fuentes**:
  el aire entre baldosas (`2/73`), el redondeo (`8/73`), la posición del `#N` (`bottom-0.5 right-1.5`)
  y la reserva `pb-2` (`8/73`). Falsable en el DOM: a `CELL_PX = 180`, `padding`, `border-radius` y
  `padding-bottom` computados divididos por `CELL_PX` dan las mismas razones que a 73, con ±0,5 px de
  tolerancia de redondeo del navegador. Es lo que sostiene que la baldosa «se lea como una ficha y no
  como un casillero».
- **AC19** — El dock de piezas muestra **las doce miniaturas y todos sus controles** dentro de sus
  2 × 4 celdas, con scroll interno propio y sin desbordar la caja ni empujar la grilla. Se verifica en
  el peor caso, que es el piso: `CELL_PX = 73`, o sea 146 × 292 px.
- **AC20** — El borde de 1 px de la baldosa **no escala**, y el archivo dice por qué. Es el quinto
  número fijo y el único que sobrevive a AC18: un filete es un delimitador y no un elemento
  tipográfico, y un borde en `calc()` da fracciones que el navegador redondea distinto por arista
  —sobre 60 celdas adyacentes, un enrejado irregular—. Falsable en las dos mitades: el comentario
  está junto al `border` de `Board.tsx`, y **al techo** (celda 180) el filete sigue separando las
  baldosas en vez de desaparecer. La segunda mitad es la que puede dar que no, y si da que no la
  decisión se revierte a `calc()` con piso de 1 px.

## Límites de Alcance

- **No cambia el audio.** Ni una nota, ni un tiempo, ni el timbre.
- **No toca `domain/` ni `audio/`.** `GRID_W` y `GRID_H` siguen siendo 10 y 6. **No cruza el borde de
  paquete.**
- **No arregla la accesibilidad del tablero.** Las celdas siguen sin recibir foco: es deuda conocida y
  necesita su propio spec. Este spec **la agranda**, y hay que decir **en qué** —el toggle en sí no,
  porque T022 lo hace un `<button>` con `aria-expanded`—:
  1. **Once celdas dejan de ser alcanzables sin plegar un panel.** Hoy las 60 se ven todas; con los
     flotantes abiertos, llegar a `(8,1)`…`(9,4)` y `(0,5)`…`(2,5)` exige un gesto previo. Para el
     mouse es un click; para un teclado que todavía no alcanza ninguna celda, es una celda tapada más.
  2. **El orden de tabulación deja de seguir al orden visual.** Dos paneles `position: fixed` se
     pintan donde el `fixed` los pone y se tabulan donde el DOM los tiene, y eso no lo arregla el
     `aria-controls`.
  3. **La operación destructiva sigue siendo sólo de mouse.** El click que quita una pieza no tiene
     equivalente de teclado ni deshacer, y ahora además puede quedar debajo de un panel.
- **No agrega pantalla completa del navegador** (`requestFullscreen`). El tablero llena el viewport, que
  es otra cosa.
- **No cambia qué muestra una celda.** La nota, el `#N` y los colores son los del 007 y el 012.
- **No persiste el estado plegado.** Recargar los abre, como recargar vacía el tablero.

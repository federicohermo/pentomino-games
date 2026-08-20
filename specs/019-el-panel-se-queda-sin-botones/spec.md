# Spec 019 — El panel se queda sin botones

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **No cambia una nota.** Borra los seis botones que duplican gestos que ya existen desde el 013, y
> reordena lo que queda alrededor del transporte.
>
> **Medido: borrar esas filas gasta exactamente el colchón de alto que el spec 016 dejó.** La paleta
> baja de 520 a 470 px y `CELL_PX` re-derivado sigue dando **73** —73,0 por alto contra 73,1 por
> ancho—, o sea que sobrevive por 0,1 px. Los 50 px que se van eran **aire muerto** en la tarjeta del
> tablero, no tablero.

## Problema

El panel tiene **seis botones que no hacen falta y uno que está en el lugar equivocado**.

Desde el spec 013 la rotación tiene dos gestos —la rueda sobre el tablero y `Shift`— y la reflexión
otros dos —el botón derecho y `Ctrl`—. Los cuatro botones de grados (`0° 90° 180° 270°`) y el ON/OFF
de Reflexión quedaron como el camino lento al mismo lugar: obligan a soltar el tablero para hacer algo
que se hace con la mano puesta. Son la última capa de un panel que el instrumento ya no necesita
mirar.

`Recorrido en el vacío` es otro caso. Es un interruptor de **mezcla** —el recorrido es el mismo con los
clicks apagados, sólo que no se oye— y vive entre controles de modelo, con una etiqueta de cuatro
palabras y un ON/OFF de texto. Su lugar natural es al lado del transporte: es lo que decide qué se
escucha mientras el transporte corre.

Y `Reset` es el único botón del panel que dice su nombre con una palabra, al lado de un `▶` que desde
el spec 008 se dibuja con un glifo justamente porque el vocabulario del transporte no necesita glosa.

## Solución Propuesta

### Lo que se va

| Control | Adónde va |
|---|---|
| `0° 90° 180° 270°` | **Se borra.** Rueda y `Shift` |
| `Reflexión ON/OFF` | **Se borra.** Botón derecho y `Ctrl` |
| `Recorrido en el vacío ON/OFF` | **Se muda** a la fila de transporte, como icono de metrónomo |
| `Reset` (texto) | **Se vuelve `↺`** |

### Lo que queda, y por qué

**El régimen se queda.** Hoy la línea `cambia [escala|orden]` está escrita como segunda línea de la
fila de Rotación, a propósito: sin rotar, el régimen no hace nada, así que el 017 la puso a completar
una frase en vez de a abrir una fila. Al borrar la fila de arriba, la frase pierde el sujeto. Pasa a
ser una fila normal, con `Rotación` a la izquierda y los dos botones a la derecha — o sea, ocupa
exactamente el hueco que dejan los cuatro botones de grados.

No se borra, y el precedente es el `T070` del spec 011: propuso borrar el botón de clicks y el 015 lo
cerró con un «no» porque era la única forma de encender el recorrido. El régimen está peor todavía —
**no tiene ningún gesto directo**, así que borrarlo lo dejaría inalcanzable. Es una propiedad del
instrumento, como el tempo.

**La orientación pasa a leerse en texto.** Esto es lo que la medición obligó a agregar, y es la parte
del spec que no es una resta:

```
rotación que la miniatura NO puede mostrar:   I (2 formas para 4 rotaciones) · X (1 para 4)
reflexión que la miniatura NO puede mostrar:  I, T, U, V, W, X — no agregan ni una forma

29 de 96 orientaciones SUENAN distinto sin VERSE distinto   (30 %, en 6 de 12 piezas)
```

La `X` es el testigo: rotarla cuatro veces da cuatro arpegios distintos (`A4 B4 C#5 E5 F#5` a 0°,
`E5 F#5 G#5 B5 C#6` a 270°) y **cero** cambio visible. Hoy eso lo tapaban los botones de grados. Sin
ellos, la miniatura del 016 quedaría como único lector y mentiría en 6 de las 12 piezas.

Entonces: una línea de texto, `180° · reflejada`, junto al `F → tónica C` que ya está ahí. No devuelve
ningún botón —no se puede apretar— y cierra el 30 % que la forma no puede decir.

### La fila de transporte

```
▶/⏸     [metrónomo]     ↺
```

Los tres solo-icono, con `aria-label` y `title`, que es lo que el 008 ya hace con el transporte. El
metrónomo dice su estado **con color** —el `bg-slate-900` con el que la tarjeta marca lo activo— y no
con la palabra ON/OFF: al perder el texto pierde el lugar donde escribirlo.

El metrónomo va en **SVG inline**, porque Unicode no tiene metrónomo: hay 🎼, 🎹, ⏱, y ninguno dice
lo que este botón hace. Es el primer SVG del repo y va sin archivo propio, dimensionado a `1em` para
que quede al mismo tamaño óptico que los tres glifos vecinos.

`↺` y no `🗑`: el botón vacía el tablero **y** frena el transporte, o sea vuelve al estado inicial. Un
tacho promete *borrar* algo elegido, que es una operación con alcance y no la que hace.

## Criterios de Aceptación

- **AC1** — Los cuatro botones de grados y el ON/OFF de Reflexión no existen más en el DOM.
- **AC2** — Rotar y reflejar siguen funcionando por rueda, `Shift`, botón derecho y `Ctrl`, sin cambios.
- **AC3** — El régimen sigue alcanzable, ahora como fila propia con la etiqueta `Rotación`.
- **AC4** — Una línea del panel dice la orientación actual en texto: `0°`, `90°`, `180°`, `270°`, y
  `· reflejada` cuando corresponde.
- **AC5** — Esa línea es correcta para las seis piezas donde la miniatura no puede decirlo (`I T U V W X`).
- **AC6** — El botón de recorrido está en la fila de transporte, es solo-icono, y su estado se lee por
  color.
- **AC7** — El metrónomo tiene `aria-label` y `title`; el SVG lleva `aria-hidden`, porque el nombre
  accesible lo da el botón.
- **AC8** — Reset dice `↺`, con `aria-label` y `title`, y sigue haciendo las dos cosas que hacía:
  vaciar el tablero y frenar el transporte.
- **AC9** — `CELL_PX` sigue siendo **73**. La medición se rehace y se escribe en el docblock: lo que
  cambia es **quién manda**, que vuelve a ser el alto por 0,1 px de diferencia.
- **AC10** — El footer sigue diciendo los cuatro gestos del 013, y ya no menciona ningún botón borrado.
- **AC11** — `PiecePalette` sigue siendo presentacional: sin estado y sin efectos.
- **AC12** — Las props `onRotate` y `onMirror` desaparecen de `PiecePalette` si no las usa nadie más.

## Límites de Alcance

- **No cambia el audio.** Ni una nota, ni un tiempo, ni el timbre. El botón de recorrido cambia de
  forma y de lugar, no de efecto.
- **No toca `domain/` ni `audio/`.** No cruza el borde de paquete: `mcp-server/` no se entera.
- **No agrega una carpeta de iconos.** El SVG va inline. Si algún día hay un segundo, ahí se extrae.
- **No cambia la rotación a por-pieza.** Eso es el 020, y es lo que agrega el botón `0°`. Este spec
  saca botones; el que sigue devuelve uno, y esa asimetría está escrita en las dependencias del log.
- **No toca el layout de la página.** Las tres tarjetas siguen donde están; eso es el 021.
- **No arregla que `↺` no tenga deshacer.** Es deuda conocida y este spec no la agranda: el botón hacía
  lo mismo cuando decía «Reset».

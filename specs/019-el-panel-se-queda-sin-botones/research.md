# Research — Spec 019

Medido en el DOM sobre `main` con los specs 013–017 mergeados, en Chrome, viewport **1536 × 639** CSS
(`max-w-6xl` saturado, o sea el reparto `md:col-span-4` / `md:col-span-8`).

## 1. Las cinco filas del panel, medidas

```
fila                                   ancho    alto
Rotación 0°/90°/180°/270° + régimen    349,3     56      ← se va la primera línea
Reflexión ON/OFF                       349,3     32      ← se va entera
Recorrido en el vacío ON/OFF           349,3     32      ← se muda al transporte
F → tónica C / Notas actuales          349,3     68      ← gana una línea (AC4)
Tempo / ▶ / Reset                      349,3     76,8    ← gana el metrónomo, Reset pasa a ↺
```

La fila de Rotación mide 56 y no 32 porque son **dos** líneas: los grados arriba y `cambia
escala|orden` abajo. Se va la de arriba; la de abajo queda y sube a fila propia.

## 2. Borrar esas filas NO achica el tablero — medido, y es lo que más sorprende

Se ocultaron las tres cosas en el DOM y se volvió a medir:

```
                    paleta    tarjeta del tablero
antes                520 px          520 px
después              470 px          470 px
delta                -50 px

interior del tablero después:   730,7 × 438
CELL_PX por ancho:  73,1
CELL_PX por alto:   73,0
CELL_PX resultante: 73          ← el mismo de hoy
```

La explicación es que las dos tarjetas están en la misma fila del grid y se estiran a la más alta, que
es la paleta. El contenido real del tablero mide `6 × 73 + 32 = 470`, así que antes de este spec la
tarjeta tenía **50 px de aire muerto** abajo de la grilla. Este spec se los come exactos.

El docblock de `CELL_PX` decía que con el 016 manda el **ancho**, y que a 496 px de paleta sobran 26 px
de alto. Este spec **gasta ese colchón entero**: quien manda vuelve a ser el alto, y gana por 0,1 px.
O sea que `CELL_PX = 73` sobrevive, pero deja de tener margen — y el docblock tiene que decirlo, porque
la próxima fila que alguien saque del panel sí achica el tablero. El 020, que agrega una línea, lo
devuelve.

## 3. La miniatura no puede reemplazar a los botones de grados — medido contra el dominio

Ejecutado sobre `domain/transform.ts` y `domain/music.ts` reales:

```
pieza | rotaciones distintas (de 4) | orientaciones distintas (de 8)
  F   |  4  |  8          T   |  4  |  4
  I   |  2  |  2          U   |  4  |  4
  L   |  4  |  8          V   |  4  |  4
  N   |  4  |  8          W   |  4  |  4
  P   |  4  |  8          X   |  1  |  1
  Y   |  4  |  8          Z   |  4  |  8

rotación parcialmente invisible:  I (2/4) · X (1/4)
reflexión invisible:              I, T, U, V, W, X

29 de 96 orientaciones suenan distinto sin verse distinto — idéntico en los dos regímenes
```

Los 29 no dependen del régimen, y tiene sentido: la simetría es de la **forma**, y las dos ramas de
`arpeggioFor` leen la rotación igual de cerca. El testigo:

```
X rot   0°:  A4 · B4 · C#5 · E5  · F#5
X rot  90°:  A4 · C5 · D5  · E5  · G5
X rot 180°:  A4 · C5 · D5  · D#5 · E5
X rot 270°:  E5 · F#5 · G#5 · B5 · C#6
X 0° reflejada:  F#5 · E5 · C#5 · B4 · A4
```

Cinco sonidos distintos, **una sola forma**. Sin los botones de grados y sin la línea de texto, no
habría ningún lugar de la app donde leer en cuál de los cinco está.

Esto es lo que convierte a AC4 en obligatorio y no en un lujo: sin esa línea el spec **es una regresión
funcional** para la mitad de las piezas.

## 4. Por qué la línea de texto y no devolver los botones

Los botones de grados resolvían la lectura *y* la escritura. La escritura ya la cubren dos gestos, así
que devolverlos sería devolver los dos. Una línea de texto no se puede apretar, no compite por el
espacio de un control, y dice **más** que los cuatro botones: los grados **y** la reflexión, que el
ON/OFF de Reflexión decía en otra fila.

Va junto a `F → tónica C`, que es la línea que ya describe la pieza en la mano. Ahí la orientación
completa la oración: qué pieza, qué tónica, qué orientación, qué notas.

## 5. El metrónomo: Unicode no tiene uno

Verificado sobre el bloque de emoji musicales: hay 🎼 (partitura), 🎹, 🥁, 🎵, ⏱ (cronómetro), 🕐.
**No hay metrónomo.** Los tres candidatos por aproximación dicen otra cosa:

- ⏱ es un cronómetro: mide tiempo transcurrido, no pulso.
- 🎵 es «hay música», que es lo que hace el ▶ de al lado.
- 🎼 es «hay una partitura», que el instrumento no tiene.

Entonces SVG inline. Es el primer SVG de `src/` — verificado, no hay ninguno hoy. Va sin archivo
propio: un `MetronomeIcon.tsx` para doce líneas abriría `components/icons/`, y la regla de «un
componente por archivo» no obliga a promover a componente lo que es marcado.

Dimensionado a `1em` y `currentColor` para que herede el tamaño y el color de los tres glifos vecinos,
que sí son texto. Sin eso, un SVG en px fijos queda ópticamente desalineado con ▶ en cuanto alguien
toque el `text-` del botón.

## 6. `Recorrido en el vacío` mudándose: qué se pierde

La etiqueta actual fue elegida con cuidado en el 015 (D7) y su docblock tiene 25 líneas explicando por
qué no dice «Clicks mudos». Al pasar a icono, **la etiqueta sobrevive en el `title` y el `aria-label`**;
lo que se pierde es que esté siempre a la vista.

El costo es real y está acotado: el botón apaga **una sola** de las dos clases de cruce —el cruce sobre
una celda ocupada suena su nota y no lo gobierna este flag (D6 del 011)—, y esa distinción sólo se
puede explicar en texto. Hoy tampoco la explicaba: la etiqueta decía «Recorrido en el vacío», y «en el
vacío» era todo lo que quedaba de esa aclaración. El `title` la puede decir entera y más largo.

## 7. Archivos afectados

| Archivo | Qué cambia |
|---|---|
| `src/components/PiecePalette.tsx` | Todo el cuerpo del cambio |
| `src/components/constants/layout.constants.ts` | El docblock de `CELL_PX`: la medición del §2 |
| `src/App.tsx` | Las props que dejan de pasarse; el footer |

`domain/` y `audio/` no se tocan. **No cruza el borde de paquete.**

## 8. Las props que pueden morir

`PiecePalette` recibe hoy `rotation`, `mirror`, `onRotate` y `onMirror`.

- `onRotate` y `onMirror` **mueren**: sólo los usaban los botones borrados.
- `rotation` y `mirror` **se quedan**, y con dos consumidores cada una: la miniatura de cada pieza
  (`miniCells(key, rotation, mirror)`, spec 016) y la línea de texto nueva de AC4.

`App.tsx` conserva los `useState` de las dos: los usan `transformedShape`, `noteSet`, el fantasma, el
`Board` y el efecto de teclado.

## 9. Riesgos

| Riesgo | Cuánto | Mitigación |
|---|---|---|
| Quien usaba los botones no descubre los gestos | **Alto, y es el riesgo central** | El footer los nombra desde el 013 y AC10 lo mantiene. Es el costo aceptado del spec |
| `↺` es destructivo, sin confirmación y sin deshacer, pegado a ▶ | Medio | Separarlo del par ▶/metrónomo con un gap mayor o un divisor. **No** se agrega confirmación: el botón hacía exactamente lo mismo cuando decía «Reset», y agregarla es otro spec |
| El metrónomo sin texto no dice qué apaga | Medio | `title` largo, que es más de lo que la etiqueta decía |
| Gastar el colchón de alto deja al tablero sin margen | **Real y medido** | AC9 obliga a rehacer la medición y escribirla. El 020 devuelve el margen al agregar una línea |
| El SVG desalineado contra ▶ | Bajo | `1em` + `currentColor`, y una tarea `[M]` que lo mira |

## 10. Lo que este spec le deja al 020 y al 021

- Al **020**: la línea de texto de AC4 es donde va a ir el botón `0°` al lado, y es la que hace legible
  la orientación **por pieza** sin agregar controles.
- Al **021**: un panel con tres filas menos, o sea un dock flotante más chico y más fácil de ubicar sin
  tapar celdas.

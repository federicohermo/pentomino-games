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

### Contra qué base vale este −50, y hasta cuándo

Los 50 px de aire muerto no son una propiedad del panel sino **del layout declarado en el encabezado**:
dos tarjetas en la misma fila de un `max-w-6xl grid-cols-12`, estirándose a la más alta. Ese layout es
el que **el 021 borra**, y con él `CELL_PX` deja de ser un número fijo para pasar a ser función del
viewport. En el orden del lote —019 → 020 → 021— la medición vale; **al revés no existe**, y entonces
esta sección se remide, no se traduce.

**Y el «antes» de 520 no es el 496 que dice el docblock.** La paleta medía 496 con el 016 y hoy mide
520 porque el **017 le agregó la segunda línea de la fila de Rotación**: son los 24 px que separan el 32
de una fila normal de los 56 que el §1 le mide a la de Rotación. O sea que el docblock de `CELL_PX` ya
está desactualizado en `main` por 24 px **antes** de que este spec toque nada: su interior de
`730,7 × 464` es hoy `730,7 × 488`, y su «por alto 77,3» es 81,3. T033 no arregla sólo lo que este spec
mueve.

### La medición de arriba es de la RESTA sola, y este spec también suma

**Ojo con leerla como el estado final.** Se tomó ocultando las tres filas en el DOM, o sea con el paso
1 y el paso 3 puestos y **sin la línea de AC4**, que es del paso 2 y del mismo commit. Esa línea es una
línea de `text-sm` con su alto reservado, o sea **+20 px** —y el §1 ya la anota: la fila `F → tónica`
pasa de 68 a 88—. Con ella:

```
                    paleta    interior del tablero    por ancho   por alto   CELL_PX
solo la resta        470            730,7 × 438          73,1       73,0       73
con la línea de AC4  ~490           730,7 × ~458         73,1       ~76,3      73
```

O sea que el colchón **no se gasta entero**: baja de 50 a ~30 px, y el que manda **sigue siendo el
ancho**, como con el 016. `CELL_PX = 73` sobrevive de las dos formas —esa parte no está en duda— pero
la frase «vuelve a mandar el alto por 0,1 px» sale de la primera fila y no de la que este spec deja.

El número que va al docblock es el de **T022**, medido en el navegador con el paso 2 puesto. Hasta
tenerlo, el docblock no afirma un ganador: es el mismo docblock que ya se equivocó dos veces, y
escribirle una tercera cifra derivada de una medición parcial es exactamente cómo pasó las dos
anteriores.

El docblock de `CELL_PX` decía que con el 016 manda el **ancho**, y que a 496 px de paleta sobran 26 px
de alto. Los dos números cambian igual —la paleta ya no mide 496— así que el párrafo se reescribe de
todas formas; lo que no se puede escribir todavía es la conclusión.

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

Cinco sonidos distintos, **una sola forma**. Verificado con `describe_piece` sobre el dominio de hoy:
`X` rot 0 da `A4 B4 C#5 E5 F#5`, rot 3 da `E5 F#5 G#5 B5 C#6`, y la reflejada de rot 0 sale invertida.

**Lo que no es cierto es que no quede ningún lector**, y conviene decirlo con precisión porque de acá
salen AC4 y AC5:

- `Notas actuales` (`PiecePalette.tsx:254`) **se queda**, y de hecho distingue las ocho orientaciones:
  pinta el arpegio en orden de reproducción, así que la reflexión también se ve —invierte la lista—.
- El `aria-label` de los doce botones (`PiecePalette.tsx:115`) ya dice `rotación 180°, reflejada`.
  Para un lector de pantalla la orientación **nunca** estuvo sólo en los botones de grados.

Entonces la resta no es una regresión funcional: es una regresión de **directez**. Lo que se pierde es
poder leer la orientación sin derivarla de cinco nombres de nota, y eso alcanza y sobra para justificar
AC4 —un panel existe para ahorrar exactamente esa derivación—. La forma exagerada del argumento («no
habría ningún lugar donde leerlo») era falsa y además tapaba el dato útil: como el `aria-label` ya
arma ese texto inline, la pura de AC4 **tiene un segundo consumidor** y no hay que escribirlo dos
veces (AC13).

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
| `src/components/<módulo nuevo>.ts` | La pura de AC4, hermana de `piece-mini.ts` |
| `src/components/__tests__/…` | Sus tests (T009, T010) |
| `src/components/constants/layout.constants.ts` | El docblock de `CELL_PX`: la medición del §2 |
| `src/App.tsx` | Las props que dejan de pasarse |

`domain/` y `audio/` no se tocan. **No cruza el borde de paquete.**

**Y hay tres archivos de documentación que este spec falsifica**, en **cuatro** lugares, agregados por
el review. No son specs viejos —esos no se reescriben— sino las páginas que el repo sí mantiene al día,
y las cuatro afirman **en presente**:

| Archivo | Qué afirma hoy |
|---|---|
| `docs/guides/quickstart.md:59-61` | Que los atajos «se descubren solos —se rota con la rueda y se ve iluminarse `180°` en la paleta—». Es justo el botón que muere, y el reemplazo es la línea de AC4 |
| `docs/guides/quickstart.md:80-81` | Que «con el foco sobre `Reset`, activa `Reset`». Nombra al botón por su **etiqueta visible**, que pasa a ser `↺`. La frase sobre el foco sigue siendo correcta; el nombre no |
| `docs/architecture/audio.md:247` | «el toggle «Recorrido en el vacío» de la paleta», que pasa a ser un icono en el transporte |
| `DESIGN.md:250-251` | «el panel lo enciende con «Recorrido en el vacío»», con la etiqueta a la vista |

`App.tsx:447-451` —el footer— **no** entra por AC10: hoy no menciona ningún botón. Y
`docs/architecture/overview.md:155` tampoco, aunque nombre a «Reset»: lo hace **en pasado**, contando un
bug viejo, y al lado de «Quitar», que ya no existe desde el 014.

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
| Gastar el colchón de alto deja al tablero sin margen | **Real y medido** | AC9 obliga a rehacer la medición y escribirla. **El 020 no devuelve el margen**: su botón `0°` va *junto a* la línea de AC4 y no en una fila nueva, así que gasta ~10 px más (lo mide su AC15). El margen que devuelve la línea de AC4 es de este spec y ya está contado arriba |
| El SVG desalineado contra ▶ | Bajo | `1em` + `currentColor`, y una tarea `[M]` que lo mira |

## 10. Lo que este spec le deja al 020 y al 021

- Al **020**: la línea de texto de AC4 es donde va a ir el botón `0°` al lado, y es la que hace legible
  la orientación **por pieza** sin agregar controles.
- Al **021**: un panel con tres filas menos, o sea un dock flotante más chico y más fácil de ubicar sin
  tapar celdas.

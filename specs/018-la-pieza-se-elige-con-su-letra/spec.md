# Spec 018 — La pieza se elige con su letra

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **No cambia una nota.** Agrega una cuarta entrada a la tabla de teclas que fijó el spec 013, y es la
> primera que no es un modificador.

## Problema

Elegir una pieza cuesta **un viaje al panel**. Los doce botones de la paleta son el único camino, y
desde el spec 013 son el último control que obliga a soltar el tablero: rotar, reflejar y arrancar el
transporte ya se hacen con la mano puesta donde se toca.

El costo no es el click, es lo que el click interrumpe. Colocar una pieza es apuntar a una celda; ir
al panel a cambiar de pieza y volver es perder la celda que se estaba mirando. Con doce piezas y un
tablero de 60 celdas, esa ida y vuelta es el gesto más repetido del instrumento.

Y las doce piezas **ya se llaman por su letra** en todos lados: `PieceKey` **es** la letra
(`domain/types/pieces.types.ts`), `describe_piece` las nombra así, `DESIGN.md` mapea `F → tónica C`, y
desde el spec 016 cada botón de la paleta lleva su letra escrita abajo. El único lugar donde la letra
**no** aparece es el `title` de la celda —`(x,y) · D#5 · paso 3`, `Board.tsx:500`—, que dice la nota y
el paso. El nombre existe y está a la vista; lo que no existe es la tecla.

## Solución Propuesta

**Apretar la letra de una pieza la selecciona.**

```
F I L N P T U V W X Y Z
```

Las doce, insensibles a mayúsculas. Nada más: la tecla **selecciona y no hace nada además**.

### Lo que la tecla NO hace

Repetir la letra es un **no-op**. La tentación es cargarle una segunda función a la tecla que ya
elige —`F` otra vez rota, por ejemplo—, y eso convierte un atajo memorizable en un modo: el resultado
de apretar `F` pasaría a depender de qué pieza estaba seleccionada antes, que es información que no
está en la tecla ni en la mano. Rotar ya tiene dos gestos (rueda y `Shift`) y no necesita un tercero.

### Las tres guardas

Son las mismas que el spec 013 ya paga, y ninguna es opcional:

| Guarda | Qué pasa sin ella |
|---|---|
| El foco está sobre un `<button>` o un `<input>` | Arrastrar el slider de tempo con las flechas y tipear cualquier letra cambiaría la pieza |
| `Ctrl`, `Meta` o `Alt` están abajo | `Ctrl`+`F` (buscar), `Ctrl`+`P` (imprimir) y `Ctrl`+`V` seleccionarían pieza además de hacer lo suyo |
| El evento se procesa en `keydown` y **sin `preventDefault`** | Una letra suelta no tiene default que frenar; frenarlo sería quitarle al navegador un evento que no es nuestro |

Y hay una cuarta pregunta que en 2026-08-20 no existía: desde el spec 026 el tablero es una parada de
tabulación y `EventoDeTecla` lleva un quinto campo, `targetEsCelda`. La letra **no** se veta con él —ver
AC13—, y ese es el punto: `targetEsCelda` apaga la barra y sólo la barra.

La tercera es la que más se parece a un detalle y no lo es: `frenaElDefault` existe justamente porque
«hay acción» y «hay que frenar el default» son dos preguntas distintas (D4 del 013), y esta tecla es el
primer caso donde la respuesta a la primera es sí y a la segunda es no.

## Criterios de Aceptación

- **AC1** — Apretar cualquiera de las doce letras selecciona esa pieza. La paleta lo refleja y el
  fantasma del tablero pasa a mostrar la forma nueva.
- **AC2** — Funciona en minúscula y en mayúscula. `f` y `F` (con `Shift` abajo) hacen lo mismo.
- **AC3** — Con `Shift` abajo la letra **igual selecciona**, y al soltar `Shift` la pieza **no rota**:
  la letra ensució el tap, que es lo que `abreTapLimpio` ya hace con cualquier tecla que no sea
  modificador.
- **AC4** — Con `Ctrl`, `Meta` o `Alt` abajo la letra **no** selecciona, y el navegador se queda el
  atajo entero. Tampoco selecciona al **soltarla**: la decisión es del `keydown`, así que un `Ctrl`+`V`
  que suelte el `Ctrl` primero y la `V` después no deja la pieza `V` en la mano — el `keyup` de la `V`
  llega con `ctrlKey: false` y pasaría la guarda.
- **AC5** — Con el foco sobre un control del panel (el slider de tempo, cualquier botón) la letra
  **no** selecciona.
- **AC6** — Ninguna letra hace `preventDefault`.
- **AC7** — Una tecla que no es de las doce (`A`, `1`, `Enter`) no hace nada y no rompe nada.
- **AC8** — La decisión vive en una pura de `components/input.ts` y está testeada en
  `environment: 'node'`, sin jsdom.
- **AC9** — El footer nombra el gesto. Los atajos del 013 se documentaron ahí justamente porque un
  atajo que no está escrito no existe.
- **AC10** — Repetir la misma letra no cambia nada.
- **AC11** — Los tres gestos del 013 **no cambian**. En particular la barra sigue alternando el
  transporte con `Ctrl`, `Alt` o `Meta` abajo: la guarda de modificadores es **de la rama de las
  letras** y no un `return` al tope de `accionDeTecla`, que se la aplicaría también a la barra y a los
  dos modificadores sin que ningún AC lo pida.
- **AC12** — `pnpm verify` en verde (lint ‖ typecheck ‖ **suite** ‖ mcp:test, que es la forma que tiene
  hoy desde el spec 029: `suite` son las dos pasadas de vitest y la segunda trae el umbral **100** en
  las cuatro métricas). Es el gate mecánico que el 013 (AC12) y el 017 (AC12) ya fijaron como criterio
  propio y no solo como tarea.
- **AC13** — Con una **celda del tablero enfocada** (spec 026) la letra **igual selecciona**. El campo
  `targetEsCelda` no entra en la rama de las letras, y no es una omisión: `Board.tsx:194-206` maneja
  `Enter`, la barra, las flechas y `Home`/`End`, y su `switch` cierra con `default: return`, así que una
  letra no la maneja nadie más y no hay doble disparo que evitar. Es la misma decisión que el 026 tomó
  para `Shift` y `Ctrl` —que con una celda enfocada siguen rotando y reflejando—, y vetar la letra ahí
  apagaría el atajo justo donde más sirve: con la mano puesta en el tablero.
- **AC14** — No-regresión del cableado: los tests de navegador que ya cubren esta superficie
  —`src/components/__tests__/use-input.browser.test.tsx` y `src/__tests__/App.browser.test.tsx`— siguen
  en verde, y las ramas nuevas de `use-input.ts` y de `App.tsx` llegan **con su test**. No es opcional:
  el umbral es 100 en las cuatro métricas, así que una rama nueva sin test no mergea. En particular, el
  callback nuevo de `App.tsx` es una función más en el conteo de `functions`.

## Límites de Alcance

- **No cambia el audio.** Ni una nota, ni un tiempo, ni el timbre.
- **No toca `domain/`.** Las doce letras ya son `PieceKey`; la tecla se valida contra `SHAPES`.
- **No agrega teclas para rotar a un ángulo concreto** (`1`/`2`/`3`/`4` → 0°/90°/180°/270°). Es
  tentador y es otro spec: hoy la rotación es global y el 020 la vuelve por pieza, así que decidir esa
  tabla antes del 020 sería decidirla dos veces.
- **No arregla la accesibilidad del tablero, porque ya la arregló el 026.** Cuando este spec se escribió
  las celdas no recibían foco y acá decía que seguían sin recibirlo; hoy el tablero es una parada de
  tabulación con `role="grid"`, cursor de teclado y su propio `onKeyDown`. Lo que sigue valiendo es el
  límite: este spec agrega una entrada de teclado al **panel** y no le toca una línea al tablero. Su
  único punto de contacto es `targetEsCelda`, y es para **no** usarlo (AC13).
- **No cambia el aspecto de la paleta.** Que la letra ya esté escrita en cada botón desde el 016 es
  lo que hace que este atajo no necesite cartel; aprovecharlo es todo lo que se hace.

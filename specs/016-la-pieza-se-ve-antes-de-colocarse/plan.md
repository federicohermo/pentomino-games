# Plan — Spec 016

Tres pasos. El 1 es puro y no toca ningún `.tsx`; el 2 dibuja; el 3 remide el layout, que es
**consecuencia** y no objetivo.

## Paso 1 — `miniCells`, con sus tests

`src/components/piece-mini.ts`, al lado de `cell-text.ts`. Compone las primitivas que ya existen y
agrega **sólo el centrado**:

```
SHAPES[piece] → rotateN(·, rotation) → reflect si mirror → correr por floor((5 - w)/2), floor((5 - h)/2)
```

El docblock tiene que decir tres cosas:

1. Por qué la caja es **5×5 y no ajustada al contenido** (D1): la `I` pasa de 5×1 a 1×5 y la grilla
   entera reflowearía en cada rotación.
2. Por qué 5×5 y no 4×4: es la caja más chica donde entra la `I`.
3. Que acá el **invariante de orden del array no aplica** — la miniatura no numera celdas ni las conecta
   con grados, así que es la primera derivación del repo que podría reordenarlas sin romper nada. Vale
   la pena decirlo, porque todo el resto del dominio afirma lo contrario y con razón.

Tests (AC4, AC5) sobre **las 96 combinaciones**: las cinco celdas caen siempre dentro de `0..4` en los
dos ejes, el resultado es determinista, y el centrado deja la forma con margen simétrico salvo por el
píxel impar. El error que este test existe para atrapar es el `round` en lugar de `floor` y el ancho
leído sin normalizar — los dos compilan y dejan piezas pegadas al borde en algunas orientaciones
(`research.md` §6).

## Paso 2 — El botón

`PiecePalette.tsx`. Cada botón pasa a ser una columna: la caja de 5×5 arriba, la letra chica abajo.

- Las celdas ocupadas van pintadas con `PIECE_COLOR[key].bg` **por estilo inline** — Tailwind escanea el
  fuente y una clase interpolada no se generaría; es la regla que el repo ya tiene escrita.
- Cada celda lleva **borde**, heredado del que tenía el punto de color: sin él, el amarillo de `V` y el
  lima de `F` casi no se ven contra el gris claro del botón. Es además el idioma del tablero desde el
  007.
- **Sale el `<span>` del punto** (D3).
- El fondo del botón no se toca: sigue siendo el canal de "seleccionada" (D4).
- `aria-label` con el nombre y la orientación (D5), porque la forma dibujada con `div`s no tiene nombre
  accesible y el botón hoy lo tenía gratis por su texto.

El comentario largo que hoy argumenta el esquema de columnas se **reescribe**: su cuenta está hecha
sobre la letra más el punto, y ninguno de los dos gobierna ya el ancho (`research.md` §1).

## Paso 3 — Remedir el layout y cerrar

El tamaño de la mini-celda y la cantidad de columnas se eligen **midiendo con el punto ya sacado**,
contra el objetivo de D6: paleta entre ~470 y 520 px de caja. La tabla de `research.md` §3 dice dónde
empezar —6 columnas, 6 a 8 px— pero sus altos están sobreestimados justamente por el punto.

Y hay que remedir el rango debajo de `md`, donde la tarjeta es `col-span-12` y la aritmética es otra
(AC10). Hoy el esquema es `grid-cols-6 md:grid-cols-3 lg:grid-cols-4`; los tres números salen de la
medición vieja y ninguno se hereda.

`CELL_PX` 71 → **73**, con el docblock reescrito. Lo importante no es el número sino **cuál es la
restricción que manda**, porque cambió de lado dos veces en dos specs (`research.md` §4): ancho → alto →
ancho. Sin eso escrito, el próximo que quiera un tablero más grande mira la tarjeta equivocada.

Y la lápida de `PREVIEW_CELL_PX` se actualiza para que no parezca que este spec deshace el retiro del
007 (§5): aquel panel se fue por repetir las **notas**, y esto no las repite.

## Verificación

| Qué | Cómo |
|---|---|
| AC4, AC5 | `piece-mini.test.ts` sobre las 96 combinaciones |
| AC1, AC2, AC3 | `[M]` navegador; AC2 sobre las 8 orientaciones de la `I`, que es el peor caso |
| AC6, AC7, AC8 | Por lectura |
| AC9, AC10 | Remedido en el navegador, con los números en el docblock |
| AC11 | El diff no toca `domain/`, `audio/` ni `mcp-server/` |
| AC12 | `pnpm verify` |
| AC13 | `[M]` elegir la pieza sin leer la letra, y rotar con la rueda mirando sólo la paleta |
| AC14 | Por lectura de `DESIGN.md` |

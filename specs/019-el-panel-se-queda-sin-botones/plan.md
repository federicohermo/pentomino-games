# Plan — Spec 019

Cuatro pasos. El 1 es la resta, el 2 la compensación que la medición obligó a agregar, el 3 la fila de
transporte y el 4 la medición que hay que rehacer.

**El orden importa entre el 1 y el 2**: si el paso 2 mergeara después que el 1 en commits separados,
habría un commit donde la orientación no se puede leer en ninguna parte para 6 de las 12 piezas. Van
en el mismo commit.

## Paso 1 — Se van los seis botones

`PiecePalette.tsx`:

- La fila de Rotación pierde su **primera línea** (los cuatro botones de grados).
- La fila de Reflexión se borra entera.
- El `<div>` que envolvía las dos líneas de Rotación desaparece: la que queda —el régimen— sube a fila
  hermana de las demás, con `Rotación` como etiqueta a la izquierda.

Las props `onRotate` y `onMirror` salen de la interfaz `Props` y de la llamada en `App.tsx`. `rotation`
y `mirror` **se quedan** (§8 del research).

Los comentarios de la fila de régimen del 017 se conservan y se les agrega el motivo del ascenso: la
frase que completaban ya no tiene sujeto arriba.

**Este paso solo es un borrado**, así que va en su propio commit dentro del mismo PR, como pide la
convención del repo.

## Paso 2 — La orientación se lee en texto

En el bloque `pt-2 text-sm text-slate-600`, junto al `<b>{selected}</b> → tónica …`, una línea que
dice la orientación:

```
180° · reflejada
```

La derivación es trivial (`${rotation * 90}°` más el sufijo condicional) pero **no va inline en el
JSX**: va como pura en `components/cell-text.ts` o en un módulo hermano, por el motivo de siempre —
`react-refresh/only-export-components` prohíbe que un `.tsx` exporte algo además del componente, así
que escrita adentro no se puede testear. AC5 pide exactamente eso: verificar que la línea es correcta
para las seis piezas donde la miniatura no puede decirlo.

Ojo con el **alto reservado**: la línea `Notas actuales` ya lleva `min-h-[2lh]` porque envolvía y movía
todo lo de abajo al cambiar de pieza. La línea nueva tiene largo variable (`0°` contra `270° ·
reflejada`) y el mismo problema; se le mide el peor caso y se le reserva.

## Paso 3 — La fila de transporte

```
▶/⏸     [metrónomo]     ↺
```

- El botón de `Recorrido en el vacío` se muda acá y pierde el texto. Su estado se lee por color:
  `bg-slate-900 text-white` encendido, `bg-slate-100` apagado — el idioma que la tarjeta ya usa.
  `aria-label` y `title` se llevan la etiqueta entera, más larga que la que cabía en la fila.
- El SVG del metrónomo va inline, `width="1em" height="1em"`, `fill="currentColor"`,
  `aria-hidden="true"` — el nombre accesible lo da el botón, y sin `aria-hidden` un lector de pantalla
  lo anunciaría dos veces.
- `Reset` pasa a `↺`, con `aria-label="Vaciar el tablero y frenar"` y el mismo texto en `title`. Sigue
  siendo `bg-slate-200`, que es el «secundario» que el 008 eligió a propósito para no competir con el
  transporte.
- `↺` se separa del par `▶`/metrónomo: es el único destructivo de los tres y no tiene deshacer.

## Paso 4 — Rehacer la medición de `CELL_PX`

`layout.constants.ts`: el docblock de `CELL_PX` tiene hoy una tabla de tres filas («qué manda en cada
spec») y un párrafo que dice que hoy manda el ancho y que sobran 26 px de alto. Las dos cosas dejan de
ser ciertas.

Se agrega la fila del 019 con lo medido —73,1 por ancho contra 73,0 por alto— y el párrafo pasa a
decir que **el colchón se gastó**: el número sigue siendo 73 pero por 0,1 px, y la próxima fila que
salga del panel sí lo baja. Es exactamente la trampa que este docblock ya pisó dos veces y por eso se
escribe antes de que la pise una tercera.

El **piso de 60** no se toca: depende de la fuente, no del layout, y este spec no toca el `text-[19px]`
de `Board.tsx`.

`App.tsx`: el footer saca cualquier mención a los botones borrados y conserva los cuatro gestos.

## Verificación

`pnpm verify`, y en el navegador las tareas `[M]`: que `CELL_PX` siga midiendo 73 en el DOM (que es la
única forma de verificar AC9 de verdad), que el SVG esté ópticamente alineado con ▶, y que la línea de
orientación diga lo correcto rotando una `X` cuatro veces — el único caso donde nada más se mueve.

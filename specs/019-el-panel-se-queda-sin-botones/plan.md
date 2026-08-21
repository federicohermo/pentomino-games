# Plan — Spec 019

Cuatro pasos. El 1 es la resta, el 2 la compensación que la medición obligó a agregar, el 3 la fila de
transporte y el 4 la medición que hay que rehacer.

**El paso 4 no se puede escribir antes que los otros tres**: sus números salen del layout final, y el
paso 2 suma alto. Medir primero, escribir el docblock después.

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
JSX**: va como pura en un **módulo propio de `components/`**, hermano de `piece-mini.ts` y por el mismo
motivo. **No** en `cell-text.ts`: ese módulo contesta qué dice una celda **del tablero** —nota y paso—
y su tipo `CellText` existe para cruzar hacia `Board.tsx`; meterle un texto de la paleta le rompe la
frase con la que se define. El motivo de sacarlo del `.tsx` es el de siempre —
`react-refresh/only-export-components` prohíbe que un `.tsx` exporte algo además del componente, así
que escrita adentro no se puede testear. AC5 pide exactamente eso: verificar que la línea es correcta
para las seis piezas donde la miniatura no puede decirlo.

Ojo con el **alto reservado**: la línea `Notas actuales` ya lleva `min-h-[2lh]` porque envolvía y movía
todo lo de abajo al cambiar de pieza. La línea nueva tiene largo variable (`0°` contra `270° ·
reflejada`) y el mismo problema; se le mide el peor caso y se le reserva.

Y la pura tiene **dos** consumidores, no uno: el `aria-label` de los doce botones ya arma ese mismo
texto inline (hoy `OrientationPanel.tsx:103`, mudado ahí por el 022, `rotación ${rotation * 90}°${mirror ? ', reflejada' : ''}`). Si
no lo consume, el archivo queda con dos copias de la misma derivación en dos formatos, que es la clase
de par que el repo mandó a `constants/` justamente porque nada los sincroniza. AC13.

Los dos formatos **no se unifican bajando el `aria-label` al de la línea visible**. `X, 180° · reflejada`
le saca el sustantivo «rotación» y le mete un separador que el lector de pantalla deletrea: sería saldar
AC13 agrandando la deuda de accesibilidad, que es la que este spec ya roza al pasar dos botones a
solo-icono. La pura sirve a los dos con un parámetro de forma —o devolviendo las partes— y el `.tsx`
compone; lo que AC13 prohíbe es que `rotation * 90` y el sufijo de reflexión estén escritos dos veces.

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
- `Reset` pasa a `↺`, con `aria-label="Vaciar el tablero y frenar"` y el mismo texto en `title`. Hoy
  **no tiene ninguno de los dos** (`TransportPanel.tsx:74`): su nombre accesible es el texto visible
  `Reset`, así que cambiarlo a un glifo sin agregarlos lo deja **mudo** — el caso exacto que
  `.claude/rules/ui.md` cierra con «todo control solo-icono lleva `aria-label`: el glifo no es un
  nombre». Sigue siendo `bg-slate-200`, que es el «secundario» que el 008 eligió a propósito para no
  competir con el transporte.
- **Los atributos del 025 viajan con el botón que se muda.** El de recorrido tiene hoy
  `aria-pressed={clicks}` y `aria-labelledby="recorrido-etiqueta"` (`PiecePalette.tsx:124`): el primero
  **tiene que llegar** al metrónomo —sin él el estado queda en el color y en nada más, que es el
  defecto que `revisiones.md` ya cazó en el 016—, el segundo no puede, porque el `<span>` que
  referencia muere con la fila, y se convierte en `aria-label`.
- **El docblock de `TransportPanel.tsx` deja de ser cierto en dos lugares**: `:10-14` dice que es «el
  unico subarbol CONTIGUO de los dos paneles (el boton de los clicks cae entre dos bloques de
  orientacion)», que es justo lo que este paso deshace; y `:52-55` mide la fila «junto a Reset (62 px +
  8 de gap)», con un Reset que pasa a ser un glifo y una fila que gana un tercer botón.
- `↺` se separa del par `▶`/metrónomo: es el único destructivo de los tres y no tiene deshacer.

## Paso 4 — Rehacer la medición de `CELL_PX`

**Este paso va último y depende de T022**, que es la única medición tomada sobre el layout final. Lo
que el research §2 midió es la resta sola; la línea de AC4 devuelve ~20 px y el paso 2 está en el mismo
commit, así que escribir el docblock desde §2 es escribirle un número que la app no va a tener.

`layout.constants.ts`: el docblock de `CELL_PX` afirma la cuenta vieja en **cuatro** lugares, no en
dos, y hay que tocarlos todos o queda contradiciéndose consigo mismo:

1. La **tabla** de tres filas («qué manda en cada spec») — gana la fila del 019.
2. El párrafo de abajo de la tabla: «agrandar el tablero hoy pide más ANCHO de tarjeta … el alto ya
   sobra». Sobra menos, y hay que decir cuánto.
3. El bullet del **techo útil**: cita `730,7 × 464 px` de interior y «por alto 77,3», los dos derivados
   de una paleta de 496 px que deja de existir.
4. El párrafo de «inflar la paleta ya no compra nada», con los **26 px** de colchón a 496 px de paleta.

El `MINI_CELL_PX` de abajo cita el mismo umbral («en cuanto la paleta pasa de ~470 px»): se verifica
que siga siendo cierto, y si lo es no se toca.

El **piso de 60** no se toca: depende de la fuente, no del layout, y este spec no toca el
`text-[19px]` de `Board.tsx`.

`App.tsx`: el footer **se lee y probablemente no se toca**. Hoy (`App.tsx:433-439`, y con el 018 puesto
un `<span>` de gesto más y todo corrido de línea) no menciona ningún botón: nombra `Rotación` y `Reflexión` como transformaciones del modelo, y después los cuatro gestos.
Lo único que hay que hacer es confirmarlo; borrar esa primera oración sería sacar la explicación del
modelo por confundirla con la etiqueta de un control (AC10).

Y hay **tres páginas de documentación** que sí quedan falsas y entran al alcance: `quickstart.md`
—donde el mecanismo de descubrimiento de los atajos es «ver iluminarse `180°` en la paleta», que es
justo el botón que muere—, `audio.md` y `DESIGN.md` —los dos llaman al botón de recorrido «el toggle
de la paleta»—. Ver `research.md` §7.

## Paso 5 — Los tests de navegador que este spec rompe

No es higiene: los tres `*.browser.test.tsx` de la tarjeta afirman hoy, **por rol y por nombre**,
exactamente los seis botones que el paso 1 y el paso 3 borran o renombran, así que `pnpm verify` (AC15)
no puede dar verde sin tocarlos. Y la dirección importa: lo que se **borra** se verifica al revés —un
`queryByRole` anclado que da vacío, que es la única forma falsable de AC1— y lo que se **muda**
reaparece como aserción en el archivo de destino, no desaparece.

`OrientationPanel.browser.test.tsx` es el caso inverso, y por eso vale: T031 le cambia el **insumo** al
`aria-label` sin cambiar el texto, así que ese archivo tiene que seguir verde **sin editarlo**. Si hubo
que editarlo, el `aria-label` se degradó y AC13 se saldó agrandando la deuda de accesibilidad, que es
justo lo que el paso 2 prohibe.

## Verificación

`pnpm verify`, y en el navegador las tareas `[M]`: que `CELL_PX` siga midiendo 73 en el DOM (que es la
única forma de verificar AC9 de verdad), que el SVG esté ópticamente alineado con ▶, y que la línea de
orientación diga lo correcto rotando una `X` cuatro veces — el único caso donde nada más se mueve.

# Spec 026 — El tablero se toca con el teclado

> Sin ticket: este repo no tiene tablero de Jira. Ver `specs/README.md`.
>
> **Cierra el ítem de `deuda.md` que pide spec propio**, y contesta la pregunta que ese ítem deja
> abierta: **una sola parada de tabulación y flechas**, no sesenta.
>
> Hoy el tablero es inalcanzable sin mouse. Medido: **cero** `tabIndex`, **cero** `role` y **cero**
> estilos de foco en todo `src/`. Y desde el 014 eso dejó de ser un hueco de lectura: quitar una pieza y
> mutearla **sólo existen ahí**, así que hay una operación **destructiva** sin ninguna otra vía y sin
> deshacer.
>
> El hallazgo de diseño es que **no hace falta inventar nada visual**: el cursor de teclado escribe el
> mismo `hover` que escribe el mouse, así que el fantasma, la nota y el cursor ya funcionan. Lo único
> nuevo es el anillo de foco, y usa el **único canal libre** que le queda a la celda — la caja de
> afuera, que hoy no pinta nada.

## Problema

`deuda.md`, textual:

> **El tablero no se puede tocar con el teclado.** Cada celda es un `div` con `onClick`, sin `role`,
> sin `tabIndex` y sin nombre accesible, así que no recibe foco y ningún lector de pantalla la anuncia.
> […] Arreglarlo es decidir el modelo de foco de una grilla de 60 celdas (¿una tab stop y flechas, o 60
> tab stops?), y toca `Board.tsx` entero, así que necesita spec propio.
> **El spec 014 lo subió de prioridad y no lo cerró**: hasta ahí era un hueco de *lectura*, y desde el
> 014 la grilla tiene dos operaciones que solo existen ahí […] o sea que hay una operación
> **destructiva** que no se puede ejecutar de ninguna otra forma. Tampoco hay deshacer.

Verificado sobre `main`: la búsqueda de `tabIndex`, `role=`, `focus` y `outline` en `src/**/*.tsx`
devuelve **una sola línea, y es un comentario** — el de `Board.tsx` que documenta este mismo hueco.

Hay además un choque que el registro no nombra y que este spec tiene que resolver antes de escribir una
línea: **la barra espaciadora ya está tomada**. El 013 la usó para el transporte, y su guarda contra el
doble disparo mira `e.target instanceof HTMLButtonElement || HTMLInputElement`. Una celda enfocada es un
`div`: no matchea, así que con el tablero enfocado la barra **arrancaría el transporte y además
colocaría una pieza**, de un solo golpe.

## Solución propuesta

### D1 — Una parada de tabulación y flechas (roving tabindex)

La pregunta que `deuda.md` deja abierta se contesta así, y no es preferencia:

| | 60 paradas | **1 parada + flechas** |
|---|---|---|
| `Tab` para cruzar el tablero | 60 pulsaciones | 1 |
| `Tab` para llegar al transporte desde la paleta | 60 en el medio | 1 |
| Patrón ARIA | Ninguno lo recomienda | Es el patrón `grid` |
| Coherente con el gesto que ya existe | No | Sí — el mouse también se mueve *dentro* del tablero |

Sesenta paradas convierten la tarjeta del tablero en una trampa: cualquiera que quiera llegar al botón
de Play desde la paleta pasa por sesenta.

### D2 — El cursor de teclado ES el `hover`

`App.tsx` ya tiene `hover: Cell | null`, y de ahí salen tres cosas: el fantasma de previsualización, el
cursor (`pointer` o `not-allowed`) y la decisión de si el click edita o coloca.

Mover el foco con una flecha escribe **ese mismo estado**. Consecuencia: el fantasma, la nota de cada
celda y la validez de la jugada funcionan con teclado **sin una línea nueva de dibujo**. Es la mitad
barata del spec, y sale de que el 007 y el 014 ya habían puesto la derivación en el lugar correcto.

### D3 — El anillo de foco va en la caja de afuera, que es el único canal libre

La celda tiene dos cajas: la de `CELL_PX` y la baldosa redondeada de adentro, con 2 px de aire. Los
canales de la baldosa están **todos tomados**, y cada uno con su medición:

| Canal | Quién lo usa |
|---|---|
| Color de fondo | Identidad de pieza (12 colores medidos con APCA) |
| Blanco | Pieza muteada (014) |
| Rosa | Jugada inválida |
| Gris `slate-300` | Fantasma |
| Grosor de borde (`box-shadow` interior y exterior) | Cabeza lectora: nota / cruce / click (010, 011) |
| Opacidad + borde punteado | Velo de «no se estrenó» (010) |

La caja de afuera **no pinta nada**. Ahí va el foco, con un `outline` de dos tonos —claro por dentro,
oscuro por fuera— que es la forma estándar de un anillo que tiene que verse sobre cualquier fondo, y acá
hacen falta los dos porque abajo puede haber blanco o `#0000FF`.

Es el mismo movimiento con el que el 014 eligió la ausencia de color para el muteo: **se toma el canal
que quedaba libre, y se escribe que se acabaron**.

`outline` y no `box-shadow` por una razón medida que el repo ya conoce: `Playhead.tsx` documenta que
`transform: scale` agranda la región scrolleable del contenedor y hace aparecer barras. `outline` es ink
overflow igual que `box-shadow` —pinta afuera sin agrandar la caja— y además no compite con el
`box-shadow` que la baldosa de adentro ya usa.

### D4 — La barra espaciadora se resuelve con una pregunta nueva, no ensanchando la vieja

`EventoDeTecla` gana un campo: `targetEsCelda`.

Lo tentador es ensanchar `targetEsControl` para que también matchee la celda. Sería un bug: esa guarda
apaga **todas** las teclas, y con el tablero enfocado uno quiere seguir rotando con `Shift` y reflejando
con `Ctrl` — que es justamente el gesto del 013, «tocar sin ir al panel». Ensanchando la guarda vieja,
enfocar una celda apagaría los tres atajos para arreglar uno.

Entonces son dos preguntas distintas:

- `targetEsControl` — el foco está en un `<button>`/`<input>`: el navegador se queda **todo**.
- `targetEsCelda` — el foco está en una celda: el tablero se queda **la barra, el Enter y las flechas**,
  y `Shift`/`Ctrl` siguen siendo del shell.

Es exactamente la lección que el 013 ya pagó y escribió: «"¿hay acción?" y "¿hay que frenar el default?"
son dos preguntas y van en dos puras». Acá aparece la tercera.

### D5 — El teclado hace lo mismo que el mouse, con el mismo modificador

| Tecla | Gesto equivalente | Qué hace |
|---|---|---|
| `↑ ↓ ← →` | Mover el mouse | Mueve el cursor, y con él el fantasma |
| `Home` / `End` | — | Primera / última celda de la fila |
| `Enter` o `Espacio` | Click | Coloca, o quita si es la pieza en la mano |
| `Alt`+`Enter` / `Alt`+`Espacio` | `Alt`+click | Mutea, o coloca muteada |

**No se inventa ni un gesto.** La decisión de qué hace cada uno ya vive en `accionDeClick`, que es pura
y está testeada: el teclado la llama con los mismos argumentos. Si algún día cambia qué hace `Alt`, el
teclado lo hereda sin tocarse.

### D6 — El tablero pasa a tener filas de verdad

`role="grid"` exige `role="row"`. Hoy `Board.tsx` renderiza **60 hijos planos** dentro de un solo CSS
grid.

La alternativa era mantener el DOM plano y poner `display: contents` en filas ficticias — una técnica
con historial de sacar el nodo del árbol de accesibilidad en algunos navegadores, o sea justo lo que
este spec viene a arreglar. Se descarta: **seis filas reales de diez celdas**, sin `gap`, layout
idéntico al píxel.

`Playhead.tsx` **no se entera**: se posiciona con `transform` en píxeles contra el contenedor
posicionado, no con colocación de grid.

### D7 — El resultado de una acción se anuncia

Quitar una pieza con `Enter` cambia la celda pero el foco se queda donde estaba, así que un lector de
pantalla puede no decir nada. Y es la operación **destructiva sin deshacer** que `deuda.md` nombra.

Una región `aria-live="polite"` con lo que acaba de pasar («F quitada», «F muteada», «F colocada»). Es
lo mínimo para que una operación irreversible no sea silenciosa.

## Criterios de aceptación

- **AC1** — El tablero es **una** parada de tabulación. Desde la paleta, un `Tab` llega al tablero y
  otro lo pasa de largo.
- **AC2** — Las flechas mueven el cursor una celda, sin salirse de la grilla y **sin scrollear la
  página**.
- **AC3** — El cursor de teclado escribe el mismo estado que el mouse: el fantasma se dibuja en la celda
  enfocada, con la misma validez y el mismo color.
- **AC4** — `Enter` y `Espacio` hacen exactamente lo que hace un click, y `Alt`+ellos lo que hace
  `Alt`+click. Las cuatro salen de `accionDeClick`, sin una segunda copia de la regla.
- **AC5** — Con una celda enfocada, la barra **no** alterna el transporte. Con el foco fuera del
  tablero, sí — incluido el caso de un `<button>` enfocado, que ya funcionaba.
- **AC6** — Con una celda enfocada, `Shift` sigue rotando y `Ctrl` sigue reflejando. **Es lo que
  distingue este spec de ensanchar la guarda vieja.**
- **AC7** — La celda enfocada se ve, sobre cualquiera de los 12 colores y sobre el blanco, y el anillo
  **no** agranda la región scrolleable del contenedor.
- **AC8** — Cada celda tiene nombre accesible con su coordenada, su nota, su paso y su ocupación. El
  `title` deja de ser el único texto y pasa a ser el eco del nombre.
- **AC9** — El tablero es un `role="grid"` con seis `role="row"` de diez `role="gridcell"`, y
  `aria-rowcount`/`aria-colcount` declarados.
- **AC10** — Colocar, quitar y mutear anuncian el resultado por una región `aria-live="polite"`.
- **AC11** — **Cero cambio visual con el foco afuera**: mismas medidas, mismo `CELL_PX`, misma grilla de
  10 × 6. Las filas nuevas no mueven un píxel.
- **AC12** — Tests de navegador (024) para AC1, AC2, AC4, AC5 y AC6. AC7 es `[M]`.
- **AC13** — `pnpm verify` verde.

## Fuera de alcance

- **Deshacer.** `deuda.md` lo nombra junto a esto y es otra decisión —qué se deshace, cuánta historia—
  que no cabe acá. Se anota en Seguimiento con el argumento de que este spec lo hace **más** necesario:
  ahora la operación destructiva también se alcanza sin querer.
- **Elegir la pieza con el teclado.** Es el spec **018**, y se necesitan los dos para tocar sin mouse de
  verdad. Están escritos para no chocar: el 018 agrega `ACCION.seleccionar` sobre letras; este spec no
  toca ninguna letra.
- **Los controles del panel.** Son el 025.
- **`radiogroup` en rotación y régimen.** El 025 lo dejó esperando este spec, y ahora tiene con qué ser
  consistente: queda en su Seguimiento, no acá.
- **Arrastrar piezas.** No existe hoy con mouse tampoco.

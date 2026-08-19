# Spec 013 — Control directo

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **No cambia una nota.** El modelo, el circuito y el motor quedan intactos: lo único que cambia es
> **con qué gesto** se llega a `setRotation`, `setMirror` y `togglePlay`, que son handlers que ya
> existen. Es el primero de los cinco specs del lote 013–017 y va primero porque **fija la tabla de
> modificadores** que el [014](../014-el-tablero-se-edita-en-el-tablero/spec.md) necesita para su
> `Alt`.

## Problema

Para tocar el instrumento hay que ir al panel. Rotar una pieza es apuntar a uno de cuatro botones de
`Rotación`, reflejarla es apuntar a `ON/OFF`, y arrancar el transporte es apuntar al triángulo verde —
todo con el cursor, que es el mismo cursor con el que se apunta al tablero. O sea que **cada cambio de
orientación cuesta un viaje de ida y vuelta** entre el tablero y el panel izquierdo: medido en el DOM a
`max-w-6xl` saturado, la tarjeta del tablero sola mide **665 px de ancho** (`research.md` §4) y la
paleta está a su izquierda, así que desde la mitad derecha de la grilla el viaje son cientos de píxeles
de ida y otros tantos de vuelta.

Es la clase de fricción que en un instrumento se paga en cada nota: probar la misma pieza en sus 8
orientaciones sobre la misma casilla son 8 viajes, y el fantasma —que es donde se ve el resultado—
está justo del otro lado del viaje. Se mira el tablero, se decide, se va al panel, se vuelve, se
perdió el lugar.

Y hoy **no hay ningún atajo**: `src/` no tiene un solo listener de teclado, de rueda ni de menú
contextual (`research.md` §1). El único `addEventListener` del repo es un `matchMedia` en
`Spectrum.tsx` para el `devicePixelRatio`.

## Solución Propuesta

**Los tres gestos que gobiernan lo que se está por colocar se atan a la mano que ya está sobre el
tablero.** Nada se saca del panel: los botones se quedan y siguen siendo la superficie que *muestra* el
estado. Lo que se agrega es una segunda vía de entrada, más corta.

| Gesto | Qué hace | Dónde escucha |
|---|---|---|
| Rueda abajo / arriba | Rotación `+90°` / `−90°` | **Solo sobre el tablero**, con `preventDefault` en un listener **no pasivo** (D9) |
| `Shift` (tap) | Rotación `+90°` | Ventana, en `keyup` y solo si el tap fue limpio (D10) |
| Botón derecho | Alterna la reflexión | **Solo sobre el tablero**, con `preventDefault` |
| `Ctrl` (tap) | Alterna la reflexión | Ventana, en `keyup` y solo si el tap fue limpio (D10) |
| Barra espaciadora | Play / pausa | Ventana, en `keydown` |

La columna de la derecha no es un detalle de implementación: es la mitad de las decisiones de este
spec, porque los tres choques que tiene esta tabla salen de ahí.

### Decisiones de diseño

**D1 — La rueda escucha sobre el tablero, y eso cuesta el scroll de la página. Se paga.**
Un `wheel` sin `preventDefault` rota **y** scrollea, que es peor que no rotar. Con `preventDefault`, con
el mouse sobre el tablero la página deja de scrollear — y el tablero ocupa 630 × 378 px, o sea la mitad
de la ventana. Medido: el documento mide **698 px** de alto hoy, así que en un viewport de 600 px —una
pantalla de 768 con la barra del navegador— son ~100 px de scroll que se pierden mientras el cursor
está encima. Y va a crecer: el 014 sube `CELL_PX` de 63 a 71.

Se paga igual, y la alternativa es peor: escuchar la rueda en toda la ventana rompería el scroll
**entero** en vez de sobre un elemento. Es el trato que hace cualquier mapa embebido, y quedan la
paleta, el panel de señal y todo el margen para scrollear.

**Lo que no se paga es el zoom.** `Ctrl`+rueda es el zoom del navegador y es una afordancia de
accesibilidad, no un atajo de conveniencia: el handler de la rueda **se saltea el evento cuando
`ctrlKey` es true** —sin `preventDefault` y sin rotar— y el navegador hace lo suyo. Es la misma forma
de la guarda de D2, y por el mismo motivo: un gesto del sistema le gana a uno nuestro.

**D2 — En Mac, `Ctrl`+click ES el click derecho, y sin esto la reflexión no responde nunca ahí.**
El sistema traduce `Ctrl`+click a `contextmenu`. Con las dos filas de la tabla activas, la secuencia es:
baja `Ctrl` → `keydown` alterna (1) → llega el click → `contextmenu` alterna (2) → **neto cero**. No es
un caso raro: es *el* gesto de click derecho en las laptops de Apple sin mouse.

Se resuelve con que el handler de `contextmenu` **ignore el evento cuando `ctrlKey` es true**. Quien
quiera reflejar con el teclado usa `Ctrl` y funciona; quien quiera reflejar con el trackpad usa el
click secundario de dos dedos, que llega sin `ctrlKey`.

**D3 — El auto-repeat del teclado haría girar la rotación sola.**
`Shift` y `Ctrl` mantenidos disparan `keydown` repetido a la cadencia de repetición del sistema (~30/s).
Sin guarda, apoyar el meñique en `Shift` —que es lo que uno hace para escribir— gira la pieza a 30
rotaciones por segundo. Va guarda por `e.repeat`, que es exactamente el campo que el DOM tiene para
esto.

Desde D10 los dos modificadores actúan en `keyup`, que **no** se auto-repite, así que ahí la guarda
sobra: el que la necesita es el **espacio**, que sigue en `keydown` y sí se repite. La guarda se escribe
igual para las tres teclas —cuesta una línea y es la misma pura— pero la que la ejerce es una sola.

**D4 — El handler global se saltea `<button>` e `<input>`, y eso arregla el doble disparo del espacio.**
Después de apretar Play con el mouse, el botón **queda enfocado**. Ahí la barra espaciadora activa el
botón por la vía nativa; si además el handler global la escucha, el transporte se alterna **dos veces**
y no pasa nada visible salvo que el instrumento no arranca.

La regla es una sola línea y arregla todo el eje: si el `target` del evento es un `<button>` o un
`<input>`, el handler global no hace nada y deja que el navegador haga lo suyo. En cualquier otro lado
hace `preventDefault` —que es lo que además evita que la barra scrollee la página— y alterna. Nunca dos
veces, y sin `blur()` a mano, que es la solución que se ve por ahí y deja el foco en ningún lado.

Consecuencia deliberada: con el foco sobre el botón `Reset` o sobre un botón de pieza, la barra activa
**ese** botón y no el transporte. Es el comportamiento nativo y es el correcto — el foco dice qué
control está armado.

**D5 — No hay gesto para rotar al revés desde el teclado, y la rueda sí lo tiene gratis.**
La rueda tiene dos sentidos, así que `−90°` sale sin inventar nada. El teclado no: haría falta un
`Shift`+algo, o una segunda tecla, para ahorrar como máximo **dos pulsaciones** — la rotación es un
ciclo de cuatro, así que dar la vuelta cuesta 3 en el peor caso contra 1. Un binding nuevo que hay que
recordar no se paga con eso.

**D6 — Los botones del panel no se tocan, y siguen siendo quienes muestran el estado.**
Es lo que hace que los atajos sean descubribles por accidente: se rota con la rueda, se ve iluminarse
`180°` en el panel, y ahí se aprende que las dos cosas son lo mismo. Sacar los botones convertiría al
instrumento en algo que hay que saber usar de antes.

**D7 — Los listeners de ventana viven en `App.tsx`, en un efecto propio.**
`App.tsx` es el shell y es quien tiene los tres setters. Un efecto con `[]` de dependencias no sirve
—los handlers leen `rotation`, `mirror` y `playing`— así que va con sus dependencias reales y se
re-suscribe; son tres `addEventListener` sobre `window`, no un costo. La alternativa (un ref con el
estado para poder suscribir una sola vez) es la optimización que este repo no necesita y que esconde de
dónde sale cada valor.

De los dos gestos **sobre el tablero**, el botón derecho entra a `Board.tsx` como prop
(`onContextMenu`), igual que `onCellClick` y `onCellEnter`. La rueda **no puede** entrar así (D9): entra
como `boardRef`, una prop más que `Board` cuelga de su contenedor sin mirarla. En los dos casos el
componente sigue siendo presentacional y no decide nada — el que escucha y el que decide es `App.tsx`.

**D8 — La rotación sigue siendo un `number` sin acotar, y este spec no lo arregla.**
`rotation` es un `number` comparado contra `0|1|2|3` en cuatro lugares, y está anotado en
`specs/deuda.md` desde el 005 con su reemplazo ya decidido (const-object + union type, **nunca**
`enum`, que el `erasableSyntaxOnly` rechaza). Este spec agrega **un quinto** lugar, que hace
`(r + 1) % 4` y `(r + 3) % 4`: o sea que engorda la deuda en vez de saldarla. Se declara y no se toca —
cambiar el tipo mueve firmas en `domain/`, `components/` y el MCP server, y mezclarlo acá haría que un
spec de entrada terminara tocando el dominio.

**D9 — React monta `wheel` como listener PASIVO, así que un `onWheel` de JSX no puede frenar el
scroll.**
No es una precaución: está en el fuente de la versión que el repo tiene instalada. React registra sus
listeners en el contenedor raíz y a tres nombres —`touchstart`, `touchmove` y **`wheel`**— los registra
con `{ passive: true }`
(`node_modules/react-dom/cjs/react-dom-client.development.js:16503`, React 19.1.1). Adentro de un
listener pasivo `preventDefault()` **es un no-op** y el navegador avisa por consola; o sea que la versión
"la prop alcanza" de este spec habría implementado AC1 y fallado AC2, con el síntoma más caro posible:
la rotación funciona, así que parece que anda, y la página scrollea igual.

La salida es la que el DOM obliga: `addEventListener('wheel', h, { passive: false })` sobre el nodo. El
nodo llega por un `ref` que **se crea en `App.tsx`** y se le pasa a `Board` como prop, y el
`addEventListener` vive en un efecto de `App.tsx` al lado del de las teclas. Es lo que mantiene AC11 —
`Board` no gana ni estado ni efectos, gana una prop que cuelga y no lee.

`contextmenu` **no** está en esa lista de tres, así que el botón derecho sí puede ir por prop de JSX.
No es simetría: es que uno de los dos gestos es de scroll y el otro no.

**D10 — `Ctrl` en `keydown` se dispara con cada atajo del navegador, así que los modificadores actúan al
soltar.**
`Ctrl`+C, `Ctrl`+V, `Ctrl`+R, `Ctrl`+Shift+I: **todos** empiezan con un `keydown` de `Control`. Con la
tabla atada al `keydown`, copiar un texto da vuelta la reflexión sin que nadie lo pida y sin que se vea,
porque lo que cambia es el `#N` del fantasma. Lo mismo con `Shift` y cualquier mayúscula fuera de un
`<input>`. No es el caso raro que cubre la fila de Riesgos —apretar la tecla sin querer— es el uso
normal de un navegador.

Los dos modificadores pasan entonces a actuar en **`keyup`**, y solo si el tap fue **limpio**: se
ensucia si mientras la tecla estaba abajo llegó **otra tecla o la rueda**. Con eso `Ctrl`+C no refleja,
`Ctrl`+rueda hace zoom y no refleja, y un `Ctrl` solo sigue reflejando.

El mouse **no** ensucia el tap, y es a propósito: en Mac `Ctrl`+click es el click derecho (D2), y si el
`mousedown` ensuciara el tap el `keyup` no haría nada, el `contextmenu` estaría vetado por su guarda de
`ctrlKey` y volveríamos al neto cero que D2 existe para evitar. Con esta regla, el `Ctrl`+click de Mac
alterna **exactamente una vez**, y la que la alterna es el `keyup`.

## Criterios de Aceptación

- **AC1** — La rueda sobre el tablero rota: abajo `+90°`, arriba `−90°`, con vuelta cíclica en los dos
  sentidos (`3 → 0` y `0 → 3`). El panel refleja el cambio, porque es el mismo estado.
- **AC2** — La rueda sobre el tablero **no scrollea la página** (D1), y la rueda **fuera** del tablero
  scrollea normalmente. Es el AC que el `onWheel` de JSX no puede cumplir (D9): se verifica en el
  navegador y con la consola limpia, porque un `preventDefault` sobre un listener pasivo **avisa por
  consola en vez de fallar**.
- **AC3** — `Shift` rota `+90°` **una vez por tap**: mantenerla apretada no acumula rotaciones, y la
  rotación llega al soltar (D10). Con test sobre las dos guardas: `keydown` no produce acción, y un
  `keyup` con el tap sucio tampoco.
- **AC4** — El botón derecho sobre el tablero alterna la reflexión y **no abre el menú contextual**.
- **AC5** — `Ctrl` alterna la reflexión con la misma regla de tap que AC3, y **`Ctrl`+C, `Ctrl`+R y
  `Ctrl`+rueda no la alteran** (D10), con test sobre el tap sucio.
- **AC6** — **`Ctrl`+click sobre el tablero alterna la reflexión exactamente una vez** (D2), y no cero.
  Es el AC que no se puede verificar a ojo desde Windows, que es donde se desarrolla: va con test sobre
  el handler, disparando un `contextmenu` con `ctrlKey: true` y comprobando que no lo cuenta. Con D10 el
  uno lo pone el `keyup`, así que la otra mitad del AC es que **el mouse no ensucie el tap**: sin eso el
  gesto vuelve a valer cero en Mac, que es el bug que D2 existe para matar.
- **AC7** — La barra espaciadora alterna el transporte desde cualquier lugar de la página, **sin
  scrollear**, y **una sola vez** con el botón de Play enfocado (D4).
- **AC8** — Con el foco sobre `Reset` o sobre un botón de pieza, la barra activa **ese** botón y no el
  transporte (D4, consecuencia declarada).
- **AC9** — El estado del transporte lo sigue diciendo el motor y no el gesto: el atajo pasa por el
  mismo `togglePlay` que ya hace `setPlaying(clockRunning())`, así que con Web Audio caído la barra no
  miente. Es la regla de `.claude/rules/audio.md`, y este spec no abre una segunda puerta.
- **AC10** — `[M]` Los listeners **se desuscriben al desmontar**. No hay forma de testearlo —el repo no
  monta componentes y no tiene jsdom (`research.md` §7)—, así que se verifica en el navegador y con un
  método concreto: con `pnpm dev`, que corre bajo StrictMode y monta dos veces,
  `getEventListeners(window).keydown.length` en la consola de Chrome tiene que dar **1**, y lo mismo
  `keyup`. Sin el `removeEventListener` del retorno del efecto da 2, que es exactamente el bug.
- **AC11** — `Board.tsx` sigue **sin estado y sin efectos**: el botón derecho llega como handler por
  prop y la rueda como `boardRef`, que el componente cuelga de su contenedor sin leer (D7, D9).
- **AC12** — `pnpm verify` en verde.
- **AC13** — `[M]` A mano en el navegador: rotar con la rueda mientras el transporte corre no corta el
  sonido ni reordena nada — la orientación es de la pieza **por colocar**, no de las colocadas.
- **AC14** — La documentación dice cómo se toca: `docs/guides/quickstart.md` y el `<footer>` de
  `App.tsx`, que hoy explica el modelo y no menciona ningún gesto. Y la que este spec **falsifica**
  también se actualiza: `App.tsx` pasa de cuatro efectos a **seis** —el del teclado y el de la rueda— y
  hay tres archivos que dicen "los cuatro efectos" en presente: `CLAUDE.md:73`, `.claude/rules/ui.md:9`
  y `docs/architecture/overview.md:22` y `:67` (`research.md` §11).
- **AC15** — `Ctrl`+rueda sobre el tablero **hace el zoom del navegador** y no rota (D1): el handler se
  saltea el evento entero, `preventDefault` incluido.

## Fuera de Alcance

- **El teclado sobre el tablero.** Que las 60 celdas se puedan alcanzar con `Tab` y flechas es un hueco
  real —está en `specs/deuda.md`, y `Board.tsx` lo declara en su comentario del `title`— pero es
  decidir el modelo de foco de una grilla de 60 celdas y toca `Board.tsx` entero. Este spec **no lo
  cierra ni lo empeora**: agrega atajos globales, que funcionan sin foco.
- **`Alt`.** Lo reserva el 014 para mutear. Acá se declara reservado y no se usa, que es justo el motivo
  por el que este spec va primero.
- **Arrastrar la pieza.** Colocar sigue siendo un click.
- **El tipo de `rotation`** (D8).
- **Configurar los atajos.** Son fijos.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `preventDefault` sobre la rueda deja media pantalla sin scroll (D1). | Es explícito y medido: ~100 px de scroll perdidos en un viewport de 600. El tablero es 630 px de ancho, no toda la página. |
| `Ctrl`+click en Mac cancela la reflexión (D2) y **no se puede ver desde Windows**. | AC6 lo cubre con test sobre el handler y no a ojo, que es la única forma de verificarlo sin la máquina. |
| El auto-repeat hace girar la pieza sola (D3). | Guarda por `e.repeat` y AC3. |
| La barra espaciadora dispara dos veces con el botón enfocado (D4). | La regla del `target` interactivo, con AC7 y AC8. |
| `Shift` y `Ctrl` como teclas sueltas son atajos poco convencionales, y alguien que navegue con el teclado los aprieta sin querer. | Son los que pidió el pedido, y las dos acciones son **reversibles y baratas**: rotar de más se arregla rotando, reflejar de más se arregla reflejando. Ninguna de las dos toca el tablero ni lo que suena. |
| Cinco listeners nuevos y ningún test de UI en el repo. | Los handlers se extraen como puras que reciben el evento y devuelven la acción, así se testean en `environment: 'node'` sin jsdom. Es el mismo movimiento con el que `cell-text.ts` salió de `Board.tsx` en el 012. |
| El `onWheel` de JSX no frena el scroll, porque React monta `wheel` pasivo (D9). | Está medido sobre el fuente instalado (`research.md` §10), no supuesto: la rueda va por `addEventListener` no pasivo desde el efecto de `App.tsx`, con el nodo por `ref`. |
| El cableado de los listeners es la mitad del spec y **ninguna pura lo cubre**: las puras deciden bien y `App.tsx` puede pasarles mal el `targetEsControl`, el tipo de evento o el tap. | Es lo que dejan `[M]` AC2, AC4, AC7/AC8, AC10 y AC13. La deuda de fondo —no hay tests de componentes— es de `specs/deuda.md` y este spec no la salda; sí la hace más visible, porque es el primer spec cuyo riesgo vive entero en el cableado. |

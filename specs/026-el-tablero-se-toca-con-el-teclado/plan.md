# Plan 026 — El tablero se toca con el teclado

Cinco pasos. El orden no es negociable en los tres primeros: cada uno deja verificable al siguiente.

**No está bloqueado por nada.** Seis ACs se verifican en navegador y dos de ellos —AC5 y AC6— son sobre
teclado con foco, que no existe en `environment: 'node'`; el proyecto de navegador que eso necesita ya
está en `main` desde el **029**, que lo construyó siguiendo el diseño del 024. Con él vinieron
`src/__tests__/App.browser.test.tsx` y `components/__tests__/Board.browser.test.tsx`, y el umbral de
coverage en **100**: lo que este spec agregue viene con su test o no mergea.

## Paso 1 — Las puras primero, sin tocar el componente

Dos cosas, las dos testeables en `environment: 'node'` y las dos antes de escribir una línea de JSX. Es
la forma que este repo ya tiene: la decisión se extrae como pura y el componente queda con cableado.

**`components/cell-name.ts`** — el nombre accesible de una celda, a partir de lo que ya devuelven
`occupantAt` y `cellTextFor`. Cuatro casos y su test. Nace afuera del `.tsx` por el motivo de siempre:
adentro no se puede exportar y por lo tanto no se puede testear.

**`accionDeTecla` y `frenaElDefault` con `targetEsCelda`.** El campo nuevo en `EventoDeTecla`, y las dos
puras mirándolo. Lo que hay que dejar clavado en los tests es la **asimetría**, que es la decisión
entera del spec:

| Con `targetEsCelda: true` | |
|---|---|
| `' '` | `null` — la celda se la queda |
| `'Shift'` (keyup, tap limpio) | `ACCION.rotar` — **sigue funcionando** |
| `'Control'` (keyup, tap limpio) | `ACCION.reflejar` — **sigue funcionando** |

Ese segundo y tercer caso son AC6, y son la diferencia entre este spec y ensanchar `targetEsControl`.
Sin ellos en el test, el error se cuela: un `if (e.targetEsCelda) return null` al principio de la pura
pasa todos los demás casos y rompe los dos atajos del 013.

## Paso 2 — Las filas, y confirmar que no se movió un píxel

`Board.tsx` pasa de 60 hijos planos a seis `role="row"` de diez. Sin `gap`, con las mismas medidas.

Y eso obliga a dos cosas que el cambio de JSX no trae solo:

- **El `gridTemplateColumns` se muda del contenedor a la fila.** Hoy vive en el contenedor
  (`Board.tsx:197-198`) porque sus hijos son las 60 celdas; con filas, los hijos pasan a ser seis y las
  diez columnas tienen que vivir adentro de cada una.
- **Cuatro selectores estructurales de los tests dejan de matchear** —`Board.browser.test.tsx:57` y
  `:82`, `App.browser.test.tsx:55` y `:202`, todos sobre `div.grid > div`—, así que hay que
  actualizarlos en este mismo paso. Es lo que hace que la verificación de abajo signifique algo: leerlos
  verdes **después** de arreglar el selector es el oráculo; leerlos rojos antes no distingue un píxel
  movido de un `querySelector` viejo.

Va **solo, en su propio commit y sin nada de teclado**, porque es el único cambio del spec que puede
mover el layout — y hay un test del 029 que lo verifica. Mezclarlo con el resto deja un commit donde un
píxel movido y un `tabIndex` nuevo se leen igual.

**Verificación:** el test de ancho (`10 × CELL_PX`, `body` sin scroll horizontal,
`Board.browser.test.tsx:73-95`) sigue verde con el selector actualizado, y `Playhead` sigue con su
`z-index: 10` (`Playhead.browser.test.tsx:56-66`, que usa `:scope > div` sobre su propio contenedor y
**no** se ve afectado). Los dos los trajo el **029**, no el 024.

## Paso 3 — El foco: roving tabindex y el anillo

El estado «qué celda tiene el `tabIndex={0}`» es **uno solo** y vive en el shell, junto a `hover`. De
hecho puede *ser* `hover`: la celda enfocada es la celda bajo el cursor (D2), así que no hay dos
estados que puedan discrepar. Cuando no hay ninguno —el foco está afuera—, el `0` va a una celda de
arranque para que el tablero siga siendo alcanzable con `Tab`.

**Un solo estado no quiere decir un solo escritor**, y ahí hay una regla que hay que escribir: hoy
`onMouseLeave` pone `hover` en `null` (`App.tsx:286`), y con una celda enfocada eso apagaría el fantasma
contra AC3. Mientras el foco del DOM esté adentro del tablero **manda el foco**: `onMouseLeave` no borra
nada y el mouse sólo mueve el cursor si vuelve a entrar. Es AC16, y es la única forma de que «la celda
enfocada ES el hover» no sea una promesa que el mouse rompe.

Las flechas mueven ese estado y llaman a `preventDefault`: sin eso, la flecha scrollea la página y el
`overflow-x-auto` del tablero. Es el mismo trato que la rueda ya tiene, y por el mismo motivo.

El anillo va en la **caja de afuera** (D3), con dos tonos porque abajo puede haber `#FFFF00` o
`#0000FF`, y **con dos propiedades**: `outline` para el tono claro —un `outline` tiene un solo color— y
`box-shadow` con spread para el oscuro. Lo prohibido es `transform: scale`, que agranda la región
scrolleable y saca las dos barras del `overflow-x-auto`; está medido en
`components/constants/playhead.constants.ts:40-48`, no en `Playhead.tsx`.

Los dos anchos van a `layout.constants.ts`, porque los módulos de este repo no declaran constantes.

**Verificación:** AC1 y AC2 con test; AC7 es `[M]` — hay que mirarlo sobre las doce piezas.

## Paso 4 — Las acciones, sin una segunda copia de la regla

`Enter`, `Espacio` y sus versiones con `Alt` llaman a **`accionDeClick`**, la misma pura que ya usa el
click, con los mismos argumentos. `Alt`+`Espacio` va condicionado a que el `keydown` llegue: en Windows
es el menú de ventana del sistema y hay que medirlo antes de prometerlo. Lo que el handler de teclado aporta es el `altKey` y la celda; nada
más.

Esto es lo que hace que la tabla de D5 no sea una promesa: no hay dónde escribir una regla distinta. Si
mañana `Alt` cambia de significado, el teclado lo hereda sin que nadie se acuerde de tocarlo.

Y el `aria-live` (D7), que es el **primero** del repo: hoy `src/` no tiene ninguno. Región `polite` con
lo que acaba de pasar, sólo en las tres ediciones —colocar, quitar, mutear— y en nada más. Ni el recorrido, ni la cabeza, ni el espectro: anunciar a 10 Hz es
hostil, y eso ya está anotado como seguimiento del 025.

## Paso 5 — El registro

`deuda.md` **pierde el ítem entero**, que es lo que este spec vino a hacer. Con una excepción que se
queda escrita: «tampoco hay deshacer» sigue siendo cierto, y este spec lo empeora —ahora la operación
destructiva también se alcanza sin querer, con una tecla—. Se separa en su propio ítem en vez de irse
con el que se cierra.

`.claude/rules/ui.md` gana el modelo de foco del repo, **debajo** de lo que el 025 ya escribió ahí: el
025 va primero. Es lo que su `radiogroup` dejó esperando, así que al escribirlo se cierra por su nombre
el `T025` de su Seguimiento. Y en el mismo paso la guarda del handler global gana su tercer caso —la
celda—, que se escribe recién acá porque hasta este merge esa línea describe el repo tal cual es.

`DESIGN.md` gana la línea de los canales, también **debajo** de la mitad no visual que el 025 escribe
antes en ese mismo párrafo: la baldosa los tiene todos tomados y el foco usó el último que quedaba, la
caja de afuera. Los dos canales son complementarios y no rivales —el 025 reclama el árbol de
accesibilidad, este spec la caja—, que es lo que hace que las dos reglas convivan. El próximo estado tiene que buscarse el suyo — que es la frase que el 014 ya
dejó escrita y que ahora tiene una entrada más.

## Orden

```
paso 1 (puras, con test)
  ↓
paso 2 (filas, commit propio)     ← verificado por dos tests del 029 que ya existian
  ↓
paso 3 (foco)
  ↓
paso 4 (acciones + aria-live)
  ↓
paso 5 (registro)
```

## Qué NO se toca

- `domain/` y `audio/`. Ni una nota.
- `CELL_PX` y las medidas. AC11.
- Las letras del teclado — son del 018.
- Los controles del panel — son del 025.
- Deshacer.

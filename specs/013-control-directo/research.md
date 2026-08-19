# Research — Spec 013

Estado del código medido el 2026-08-19, sobre `main` en `c958dde`.

## 1. Hoy no hay ni un listener de entrada en todo `src/`

```
$ grep -rn "onContextMenu\|onWheel\|keydown\|addEventListener" src/ --include=*.tsx --include=*.ts | grep -v __tests__
src/components/Spectrum.tsx:114:      dprQuery.addEventListener('change', onDprChange);
```

Uno solo, y es un `matchMedia` para el `devicePixelRatio` del canvas. O sea que este spec **no se
inserta en una capa de entrada existente: la crea**. No hay convención previa que respetar ni un
handler global al que sumarse, y tampoco hay nada que pueda romper.

Consecuencia para el plan: la decisión de *dónde vive el listener* (D7) no tiene precedente en el repo
y hay que escribirla, porque el próximo atajo se va a copiar de este.

## 2. Los tres handlers ya existen y no cambian de firma

| Estado | Setter | Quién lo llama hoy |
|---|---|---|
| `rotation: number` | `setRotation` | `PiecePalette` → `onRotate(r)`, con `r` literal `0..3` |
| `mirror: boolean` | `setMirror(m => !m)` | `PiecePalette` → `onMirror()`, sin argumento |
| `playing: boolean` | `togglePlay()` | `PiecePalette` → `onTogglePlay()` |

`onRotate` recibe el valor **absoluto**, no un delta. La rueda necesita `(r + 1) % 4` y `(r + 3) % 4`,
o sea que el cálculo va del lado de `App.tsx` y `onRotate` no se toca. Es lo que mantiene a
`PiecePalette` presentacional.

`togglePlay` ya hace lo correcto y no hay que replicarlo:

```ts
function togglePlay(){
  if (playing) stopClock(); else startClock();
  setPlaying(clockRunning());   // el motor es quien sabe si arrancó
}
```

El atajo del espacio tiene que llamar **a esta función** y no a `startClock`/`stopClock` sueltos, o se
pierde la consulta al motor que `.claude/rules/audio.md` obliga a hacer en todo llamador (AC9).

## 3. El contenedor del tablero, y dónde enganchan la rueda y el botón derecho

`Board.tsx` tiene dos niveles anidados y **no son intercambiables**:

```jsx
<div className="relative overflow-x-auto">     ← acá: cubre la grilla entera, y scrollea con ella
  <Playhead />
  <div className="grid w-max" onMouseLeave={onMouseLeave}>   ← la grilla
```

El de afuera es el que ya usa `Playhead` como contenedor posicionado. Es el correcto para `onWheel` y
`onContextMenu`: cubre exactamente el área del tablero, incluida la franja que queda a la derecha
cuando la grilla scrollea debajo de `md`.

Enganchar en el `.grid` de adentro dejaría un borde muerto; enganchar en la tarjeta (`md:col-span-7`)
se comería el `p-4` y —peor— el título, si algún día vuelve.

## 4. Medición del scroll que cuesta el `preventDefault` (D1)

Medido en el navegador con el dev server, viewport 1536 × 695:

```
document.documentElement.scrollHeight = 698 px      innerHeight = 695 px
grilla del tablero                    = 630 × 378 px
tarjeta del tablero                   = 665.3 × 461.6 px
```

O sea que **en esta pantalla la página casi no scrollea** (3 px) y el costo es nulo. El costo aparece
en pantallas más bajas: con un viewport de 600 px —768 de alto menos la barra del navegador y la del
sistema— son ~98 px de scroll, y el tablero tapa el 66 % del ancho útil.

Y va a crecer en las dos direcciones dentro de este lote: el 014 sube `CELL_PX` de 63 a 71 (+48 px de
alto de tablero) y el 016 hace más alta la paleta. Con los cinco specs puestos el documento pasa de
698 a ~770 px medidos sobre el prototipo del 016.

**El número no cambia la decisión**, pero sí obliga a escribirla como trato y no como detalle.

## 5. El choque de `Ctrl`+click en Mac (D2)

No es una hipótesis: en macOS el `Ctrl`+click es la forma de emitir el click secundario sin mouse, y el
evento que llega es `contextmenu` con `ctrlKey: true`. La secuencia con las dos filas de la tabla
activas:

```
keydown Control   → alterna mirror        (1)
mousedown + ctrl  → el sistema lo traduce
contextmenu       → alterna mirror        (2)
                  → neto: 0
```

Este repo se desarrolla en Windows, así que **no se puede ver a ojo**: en Windows `Ctrl`+click es un
click común y las dos filas no se cruzan nunca. Por eso AC6 pide test y no verificación manual — es
literalmente la única forma de atraparlo desde acá.

La guarda es `if (e.ctrlKey) return;` en el handler de `contextmenu`. No rompe Windows: ahí un click
derecho de verdad llega con `ctrlKey: false`.

## 6. El doble disparo del espacio (D4)

Reproducción: apretar Play con el mouse deja el `<button>` con foco (comportamiento estándar en
Chrome/Firefox en Windows y Linux; en Safari los botones no reciben foco al clickear, así que ahí el
problema no existe — otro caso que no se ve desde acá).

Con foco, la barra dispara:

1. `keydown` sobre el botón → burbujea a `window` → handler global → `togglePlay()` (1)
2. el navegador activa el botón → `onClick` → `togglePlay()` (2)

Neto: el reloj arranca y para en el mismo gesto. `stopClock()` seguido de `startClock()` no es
inofensivo, además: el motor documenta que pausar cuesta el lookahead más la cola del arpegio ya
agendado.

La guarda del `target` interactivo (D4) lo corta en el paso 1 y deja pasar el 2, que es el que el
usuario pidió al enfocar el botón.

## 7. Qué se puede testear sin jsdom, y qué no

El repo corre `environment: 'node'` y **ningún test renderiza un componente** (`specs/deuda.md`). Las
`@testing-library/*` están instaladas y sin consumidor desde siempre.

Esto **no bloquea** al spec, pero decide la forma del código: la lógica de cada gesto se extrae a
funciones puras en `src/components/` —al lado de `cell-text.ts` y `route-source.ts`, que es el
precedente— con la forma «evento (o los campos que importan de él) → acción», y los `.tsx` quedan
siendo el cableado.

Lo que queda cubierto por test puro:

- la aritmética cíclica de la rotación en los dos sentidos (AC1)
- la guarda de `e.repeat` (AC3, AC5)
- **la guarda de `ctrlKey` sobre `contextmenu` (AC6)** ← el único imposible de ver desde Windows
- la guarda del `target` interactivo (AC7, AC8)

Lo que queda `[M]`: que el `preventDefault` efectivamente frene el scroll (AC2), que el menú contextual
no aparezca (AC4) y que rotar con el transporte corriendo no corte nada (AC13).

## 8. `rotation` sigue sin tipo, y este spec lo empeora

```
$ grep -rn "rotation" src/ mcp-server/src --include=*.ts --include=*.tsx | grep -c ""
```

`rotation: number` aparece en `PlacedPiece`, en el estado de `App.tsx`, en las props de tres
componentes y en las firmas de `notesForRotation`, `arpeggioFor`, `cellTextFor` y `describePiece`. La
comparación contra `0|1|2|3` está en cuatro lugares.

`specs/deuda.md` ya lo registra desde el 005, con el reemplazo decidido. Este spec suma el quinto
lugar —la aritmética modular de la rueda— y **lo declara en D8 en vez de arreglarlo**: el cambio de
tipo cruza el borde de paquete hacia `mcp-server/`, que importa 31 símbolos del dominio, y eso no es
trabajo de un spec de entrada.

## 9. Archivos que toca

| Archivo | Qué |
|---|---|
| `src/App.tsx` | Los efectos de entrada (teclado sobre `window`, rueda sobre el nodo del tablero), los handlers y el `ref` |
| `src/components/Board.tsx` | Dos props nuevas: `onContextMenu` y `boardRef`, las dos sobre el `div.relative.overflow-x-auto` |
| `src/components/input.ts` *(nuevo)* | Las puras de cada gesto (§7) |
| `src/components/__tests__/input.test.ts` *(nuevo)* | AC1, AC3, AC5, AC6, AC7, AC8 |
| `src/components/constants/input.constants.ts` *(nuevo)* | El const-object `ACCION` — los módulos no declaran constantes, y el precedente es `MARCA` en `route.constants.ts` |
| `src/components/types/input.types.ts` *(nuevo)* | La union derivada de `ACCION`, igual que `MarcaKind` en `route.types.ts` |
| `docs/guides/quickstart.md` | La tabla de gestos |
| `.claude/rules/ui.md` | Dónde vive un listener global y por qué (§1: no hay precedente) — y el conteo de efectos (§11) |
| `CLAUDE.md`, `docs/architecture/overview.md` | El conteo de efectos de `App.tsx` (§11) |

**No se toca** `domain/`, `audio/`, `mcp-server/` ni ninguna constante de audio: este spec no puede
cambiar una nota, y que la lista de archivos lo muestre es parte de la verificación.

## 10. React monta `wheel` PASIVO, y eso decide el paso 3

El plan escrito antes de este review decía «React monta `onWheel` como no pasivo sobre el elemento, así
que la prop alcanza». Es falso, y no hace falta el navegador para verlo: está en el fuente de la versión
instalada (`react-dom` 19.1.1). React registra sus listeners en el **contenedor raíz**, no en el
elemento, y a tres nombres los registra pasivos:

```js
// node_modules/react-dom/cjs/react-dom-client.development.js:16503
!passiveBrowserEventsSupported ||
  ("touchstart" !== domEventName &&
    "touchmove"  !== domEventName &&
    "wheel"      !== domEventName) ||
  (listenerWrapper = !0);          // → addEventListener(..., { passive: true })
```

Adentro de un listener pasivo `preventDefault()` no hace nada y el navegador lo avisa por consola. O
sea que un `onWheel` de JSX **rota pero no frena el scroll**: AC1 en verde y AC2 en rojo, con la
apariencia de que anda.

`contextmenu` no está en los tres, así que el botón derecho sí puede ir por prop de JSX.

Consecuencia para el plan: la rueda va por `addEventListener('wheel', h, { passive: false })` desde un
efecto de `App.tsx`, con el nodo por `ref`. El `ref` **se crea en `App.tsx`** y viaja a `Board` como una
prop más: así el componente no gana ni estado ni efectos (AC11), que era el motivo por el que la rueda
iba a ir por prop.

## 11. Tres archivos dicen "los cuatro efectos" en presente

`App.tsx` tiene hoy cuatro `useEffect` (líneas 59, 60, 148 y 172) y este spec agrega **dos**: el del
teclado sobre `window` y el de la rueda sobre el nodo del tablero, que van separados porque no comparten
ni el target ni las dependencias. Son seis. Lo afirman en presente:

```
CLAUDE.md:73                    "el shell: estado, derivados, handlers, los cuatro efectos"
.claude/rules/ui.md:9           idem
docs/architecture/overview.md:22 y :67   idem, una de las dos adentro del diagrama ASCII
```

Acá los specs son ADR y no se reescriben, pero `docs/`, `CLAUDE.md` y `.claude/rules/` sí se mantienen
al día — hay precedente en los commits `d936597` y `eb154a0`. Entra al alcance como tarea de
documentación (AC14).

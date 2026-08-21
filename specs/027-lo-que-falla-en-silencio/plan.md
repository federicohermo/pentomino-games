# Plan 027 — Lo que falla en silencio

Cinco pasos, uno por hallazgo. Los cinco son independientes entre sí salvo por el orden en que conviene
leerlos: el primero es el único que arregla algo que un usuario ve.

## Paso 1 — El velo huérfano

**Primero el test, después el arreglo.** El test ya está escrito y ya se corrió fallando
(`research.md` §1), así que entra a `route-source.test.ts` tal cual y en rojo. Es la única forma de que
el arreglo se pueda creer.

`reiniciar()` exportada desde `route-source.ts`, que devuelve `activa`, `pendiente`, `estrenando` y
`veloActual` a su valor inicial. **`generacion` no**: se sincroniza con `cycleGeneration()`, porque el
contador del motor no se resetea nunca —su docblock lo dice, `audio/engine.ts:230`: «resetear haría
creer a la UI que hubo un swap que no hubo»— y ponerla en cero haría que el próximo cuadro hiciera un
swap fuera del borde del ciclo, con la pendiente vacía que `encolar` deja justo después.

La llama `resetBoard()` al lado de `frenarTransporte()`, **por el mismo módulo**: `use-engine.ts` la
re-exporta como ya re-exporta `stopClock()`. `App.tsx` no importa `route-source.ts` hoy y no tiene por
qué empezar: al motor le pide por `frenarTransporte()` y a la cola de dibujo no le pide nada porque la
encola el efecto de reconciliación. Que las dos colas se reinicien por el mismo camino es la simetría
cuya ausencia es este bug.

El docblock de `reiniciar()` tiene que llevar la asimetría, porque es la parte que se pierde:

> Es la contraparte de `stopClock()` para la segunda cola. `App.tsx` ya argumenta por qué `Reset` frena
> el transporte además de vaciar el tablero —«es el único lugar donde saltearse D5 es lo correcto»—; ese
> párrafo valía para el motor y no para acá, y ésa era la asimetría que dejaba el velo dibujado sobre un
> tablero vacío.

Y el segundo test, que es el que evita que el arreglo se pase de largo (**AC2**): quitar la última pieza
con el transporte **corriendo** no reinicia nada — el ciclo activo tiene que terminar, que es D5 del 009.

## Paso 2 — `audio()` deja el módulo como lo encontró

Dos cosas en el `catch`:

1. `ctx = null`, `master = null`, `analyser = null`. Es lo que impide que `startClock` arranque un reloj
   sobre un contexto a medio construir y que el botón diga «Pausa» sin sonido.
2. Una marca de «ya falló», para que `audio()` no reintente el constructor en cada click. La marca apaga
   el warning **repetido**, no el warning.

El comentario nombra el modo de falla completo, porque es lo que hace entendible una línea que si no
parece defensiva: `ctx` seteado + `master` nulo → `startClock` no sale por su guarda → `clockRunning()`
en `true` → `alternarTransporte` le cree → «Pausa» sin sonido.

**Verificación:** un test que fuerce el fallo a mitad, en `audio/__tests__/engine.browser.test.tsx`.
El andamio **no** es `test-context.ts` —ése fabrica un `OfflineAudioContext` de `node-web-audio-api`
para el proyecto `node`, y este módulo necesita `new AudioContext()` y `window.setInterval`, o sea el
proyecto de navegador—: es el helper `motor()` de ese mismo archivo, que reimporta el módulo con
`?fresh=N` porque **`vi.resetModules()` no aisla un singleton en browser mode** (el 029 lo pagó con
dos tests, y lo dejó escrito).

Y el caso ya existe: «con el grafo a medio construir, tick se planta en su guarda» (`:503`) fabrica
este mismo fallo y hoy **afirma lo contrario** de lo que este paso quiere. Se reescribe ahí mismo, con
la clase `SinGain` intacta y el oráculo dado vuelta. Reescribirlo es parte del paso, no una sorpresa
de `verify`.

## Paso 3 — La guarda del reposo

Una **clave de lo último dibujado** en `spectrum-loop.ts` —la misma forma que `dibujado` en
`playhead-loop.ts`, y no un booleano—, invalidada también por `resize`, que borra el canvas.

La forma importa porque las transiciones son **tres**: reposo→reposo (no redibujar), reposo→señal
(barras) y **señal→reposo** (volver a pintar el reposo). La tercera es alcanzable —`readSpectrum()`
devuelve `null` también con el contexto suspendido— y un booleano de «ya dibujé el reposo» la deja
afuera: el último cuadro de barras quedaría congelado. Sería cambiar una falla muda por otra.

El comentario **no** argumenta desde cero: cita el de `Playhead`, que ya midió esto del otro lado
(«baja de 60 escrituras por segundo a entre 4 y 11, y en pausa el loop no toca el DOM ni una vez»). Lo
que hay que dejar escrito es que la regla era del repo y este archivo no la aplicaba, no que se
descubrió algo nuevo.

**Verificación:** las dos mitades, o el test no dice nada. Que en reposo no vuelva a dibujar **y** que
tras un `resize` sí.

## Paso 4 — Medir la paleta, y recién después decidir

El paso donde lo importante es no adelantarse.

**4a. Medir.** Un test de navegador en `src/__tests__/App.browser.test.tsx` que cuente ejecuciones de
`OrientationPanel` mientras el cursor cruza diez celdas. Se instrumenta desde el test —`vi.mock` del
módulo con un contador que delega en el real vía `importActual`, que es el patrón que ya usan cinco
archivos `*.browser.test.tsx`—, **no** metiendo un contador en el componente. Hoy tiene que dar diez
**además del render inicial**, y decirlo es parte del oráculo: sin eso «diez» y «once» son los dos
números defendibles y el test no falsifica nada.

Se cuentan **ejecuciones y no milisegundos**: un presupuesto de tiempo tendría que repetir el `skipIf`
bajo coverage con el que el 029 salvó los dos del 009 —instrumentados miden 11,3 ms contra un techo de
5— y un contador de renders es determinista bajo instrumentación.

**4b. Decidir con el número.** Si diez re-renders de 337 elementos no se notan, lo que se escribe es el
número al lado del comentario de `App.tsx` que hoy afirma que no cuesta nada, y **no se toca una línea
de código**. Si se notan, `memo()` sobre `OrientationPanel` + `useMemo` del objeto `orientacion`, y el
test pasa a afirmar el número nuevo.

Las dos salidas son un resultado válido del spec. La que no lo es —y es la tentación— es memoizar
primero: `App.tsx` tiene una decisión **escrita** en contra y pisarla sin evidencia es exactamente lo
que este repo no hace. El AC está redactado a propósito para que se cumpla en las dos ramas.

## Paso 5 — Las dos aserciones

`const bus = master;` después de la guarda en `playNotes`, y el `!` se va.

En `main.tsx`, un comentario de una línea diciendo por qué **se queda**: es el idiom de la plantilla de
Vite sobre un `#root` que el propio `index.html` de este repo garantiza. Sin eso, la próxima lectura del
código lo va a contar como deuda otra vez — que es literalmente lo que pasó para llegar a este spec.

Y la regla al registro: `CLAUDE.md` dice «cero `any` y cero `@ts-ignore`» y no nombra el `!`. Pasa a
nombrarlo, con la excepción de `main.tsx` escrita.

## Orden

Los cinco pasos son independientes **en criterio, no en archivos**: el 2 y el 5 tocan los dos
`audio/engine.ts`, y el 1 y el 4 tocan los dos `App.tsx`. O sea que no son cuatro carriles paralelos:
2 y 5 van en el mismo, 1 y 4 en el mismo. Sugerido por valor:

```
paso 1 (bug visible)  →  paso 2 (falla suave)  →  paso 3  →  paso 5  →  paso 4
```

El paso 4 va último porque es el único cuyo resultado puede ser «no hacer nada». **Ya no tiene
precondición externa**: pedía el 024 para poder contar renders provocados por el mouse, y esa arista la
satisface `main` desde que el 029 construyó el proyecto de navegador siguiendo el diseño del 024.

## Qué NO se toca

- `domain/`. Ni una nota, ni un tiempo.
- El estado de módulo de `route-source.ts` y `audio/engine.ts`: está bien ubicado, y lo único que le
  faltaba era la puerta del paso 1.
- `useSyncExternalStore` en los dos loops: ese hook existe para re-renderizar, que es lo contrario de lo
  que esos dos componentes miden y buscan.
- Los arrastres de CRA — son el 028.
- La **rotación sin acotar** de `deuda.md`, que es la sexta falla muda y la única ya registrada.
  Arreglarla es acotar el tipo, o sea cambiar firmas y tocar `domain/`. Se nombra para que la lista de
  cinco no se lea como la lista completa.

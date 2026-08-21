# Plan 027 — Lo que falla en silencio

Cinco pasos, uno por hallazgo. Los cinco son independientes entre sí salvo por el orden en que conviene
leerlos: el primero es el único que arregla algo que un usuario ve.

## Paso 1 — El velo huérfano

**Primero el test, después el arreglo.** El test ya está escrito y ya se corrió fallando
(`research.md` §1), así que entra a `route-source.test.ts` tal cual y en rojo. Es la única forma de que
el arreglo se pueda creer.

`reiniciar()` exportada desde `route-source.ts`, que devuelve las cinco variables de módulo a su valor
inicial. La llama `resetBoard()` en `App.tsx`, al lado de `frenarTransporte()`.

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

**Verificación:** un test que fuerce el fallo a mitad. `audio/__tests__/` ya tiene `test-context.ts`
para fabricar contextos, así que el andamio existe.

## Paso 3 — La guarda del reposo

Un booleano en el efecto de `Spectrum`, invalidado por `resize` —redimensionar borra el canvas—.

El comentario **no** argumenta desde cero: cita el de `Playhead`, que ya midió esto del otro lado
(«baja de 60 escrituras por segundo a entre 4 y 11, y en pausa el loop no toca el DOM ni una vez»). Lo
que hay que dejar escrito es que la regla era del repo y este archivo no la aplicaba, no que se
descubrió algo nuevo.

**Verificación:** las dos mitades, o el test no dice nada. Que en reposo no vuelva a dibujar **y** que
tras un `resize` sí.

## Paso 4 — Medir la paleta, y recién después decidir

El paso donde lo importante es no adelantarse.

**4a. Medir.** Un test de navegador que cuente ejecuciones de `OrientationPanel` mientras el cursor
cruza diez celdas. Se instrumenta desde el test —mockeando el módulo con un contador que delega en el
real—, **no** metiendo un contador en el componente. Hoy tiene que dar diez.

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

Los cinco pasos son independientes. Sugerido por valor:

```
paso 1 (bug visible)  →  paso 2 (falla suave)  →  paso 3  →  paso 5  →  paso 4 (necesita el 024)
```

El paso 4 va último porque es el único con precondición externa y el único cuyo resultado puede ser
«no hacer nada».

## Qué NO se toca

- `domain/`. Ni una nota, ni un tiempo.
- El estado de módulo de `route-source.ts` y `audio/engine.ts`: está bien ubicado, y lo único que le
  faltaba era la puerta del paso 1.
- `useSyncExternalStore` en los dos loops: ese hook existe para re-renderizar, que es lo contrario de lo
  que esos dos componentes miden y buscan.
- Los arrastres de CRA — son el 028.

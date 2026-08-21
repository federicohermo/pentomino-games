# Spec 027 — Lo que falla en silencio

> Sin ticket: este repo no tiene tablero de Jira. Ver `specs/README.md`.
>
> **Un bug reproducido y cuatro cosas que andan mal sin que nada falle.** El denominador común es que
> ninguna de las cinco rompe un test, ni un tipo, ni el lint: todas viven en el borde entre React y lo
> imperativo, que es exactamente donde este repo puso su frontera a propósito.
>
> El bug: **tras `Reset` con el transporte parado, el velo de una pieza que ya no está en el tablero
> sigue dibujado**. Está reproducido con un test que se escribió, se corrió y falló como se esperaba.
>
> **No cambia una nota.** Toca `components/route-source.ts`, `components/use-engine.ts`,
> `audio/engine.ts`, `components/spectrum-loop.ts` —donde el 029 mudó el loop que vivía en
> `Spectrum.tsx`— y una línea de `App.tsx`. Más los tests: uno nuevo por cada rama que se agrega —el
> umbral de coverage es **100** en las cuatro métricas y no hay `/* v8 ignore */`— y **uno viejo que
> se reescribe**, el que el 029 le puso al estado degradado del motor.

## Problema

### 1. `Reset` deja el velo de una pieza que ya no existe — **bug, reproducido**

`components/route-source.ts` mantiene el par activa/pendiente del recorrido y avanza **sólo** cuando
`cycleGeneration()` sube. Ese contador lo sube `tick()`, y `tick()` corre sólo con el reloj andando.

Entonces, con el reloj parado, `activa` y `estrenando` quedan congelados — pero `encolar()` igual llama
a `recomputarVelo()`, que los vuelve a leer y **re-emite las celdas de piezas que ya no están**.
`Playhead` ve un array nuevo, hace `rearmar()` y crea los nodos del velo encima de un tablero vacío.

Reproducido con un test temporal, contra el módulo real y el motor mockeado como ya hace
`route-source.test.ts`:

```
encolarTablero([pieza]);   // colocar
motor.generacion++;        // el motor cierra el ciclo
rs.rutaActiva();           // swap: estrenando = ['F']
rs.velo().length           → 5   ✓

encolarTablero([]);        // Reset: tablero vacío, reloj parado
rs.rutaActiva();           // g === generacion: no hay swap
rs.velo().length           → 5   ✗ esperado 0
```

Se autocura al volver a apretar Play, así que el síntoma dura desde el `Reset` hasta el próximo
arranque. El mismo camino se activa al **quitar** una pieza con el transporte en pausa.

Lo que lo hace un bug y no una decisión es que `App.tsx` **ya tiene escrita la regla correcta** para el
otro lado del par:

> Reset frena el transporte ADEMÁS de vaciar el tablero, y esa segunda mitad no es cosmética. […] Reset
> es una orden explícita de volver a cero, no una edición del tablero, así que es el único lugar donde
> saltearse D5 es lo correcto.

Ese párrafo vale para `audio/engine.ts` y **no** para `route-source.ts`, que es la segunda cola. La
asimetría no está argumentada en ningún lado: es lo que quedó.

### 2. Si Web Audio falla a mitad, el transporte miente

`audio()` asigna `ctx` **antes** de crear el gain y el analyser:

```ts
ctx = new AudioContext();
master = ctx.createGain();
…
analyser = ctx.createAnalyser();
```

Si algo posterior a la primera línea tira, se sale por el `catch` devolviendo `null` — pero `ctx` quedó
seteado. La llamada siguiente entra por `if (ctx) return ctx` y devuelve un contexto con
`master === null`. A partir de ahí:

- `startClock()` no sale por su guarda —`audio()` devolvió algo— y arranca el `setInterval`;
- `clockRunning()` pasa a `true`;
- `alternarTransporte` le cree, y el botón dice **«Pausa»**;
- `tick()` sale por `if (!c || !master) return` en cada vuelta, así que no suena nada.

Es exactamente la falla suave que `.claude/rules/audio.md` obliga a chequear en todo llamador,
entrando por una puerta que `alternarTransporte` no puede ver: la pura pregunta si el motor arrancó, y
el motor contesta que sí.

**Y el 029 le puso test.** `audio/__tests__/engine.browser.test.tsx:503` fabrica este mismo fallo
—`class SinGain extends AudioContext`— y **afirma que el reloj arranca igual**
(`expect(e.clockRunning()).toBe(true)`), con un comentario que llama al estado degradado «alcanzable
de verdad». Es la evidencia más fuerte de que el hallazgo existe, porque alguien lo reprodujo; y es
también trabajo, porque arreglarlo es reescribir ese test.

Y una segunda consecuencia del mismo `catch`: cuando el fallo es **total** tampoco queda marcado, así
que cada llamada a `audio()` reintenta construir el `AudioContext` y vuelve a hacer `console.warn`. Un
click, un warning.

### 3. `Spectrum` redibuja el reposo 60 veces por segundo, para siempre

Su loop —hoy en `components/spectrum-loop.ts`, que el 029 sacó del `.tsx` sin cambiarle una línea de
comportamiento— llama a `drawIdle()` en cada cuadro mientras no hay `AudioContext`. Son, por cuadro:
un `clearRect`, 48 `fillRect`, **cinco** asignaciones de estilo y un `fillText` — **55 operaciones de
canvas para pintar exactamente la misma imagen**, desde que carga la página hasta el primer click. A
60 fps, **3.300 por segundo**.

`playhead-loop.ts`, en el mismo repo y con el mismo patrón, **sí** tiene la guarda, y su docblock la
argumenta (`playhead-loop.ts:52-56`):

> Clave de lo ÚLTIMO escrito […]. Es lo que baja de 60 escrituras por segundo a entre 4 y 11, y lo que
> hace que en pausa el loop no toque el DOM ni una vez (AC7).

O sea: el repo ya tiene la regla, medida y escrita, y el otro loop no la aplica.

### 4. Mover el mouse por el tablero re-renderiza las doce miniaturas

`hover` vive en `App.tsx`, así que cada celda que el cursor cruza re-renderiza el árbol entero. Contado
sobre el JSX y las constantes reales (`MINI_BOX = 5`, doce piezas):

| Subárbol | Elementos por render | ¿Depende de `hover`? |
|---|---|---|
| `Board` | ~180 | **Sí** |
| `OrientationPanel` | **337** (1 grilla + 12 × (botón + grilla + 25 celdas + span)) | **No** |
| Resto de `PiecePalette` | ~25 | No |

**337 elementos que no pueden haber cambiado, recreados por cada celda que el cursor cruza.** React no
va a tocar el DOM —el resultado es idéntico— pero sí corre la función y reconcilia.

`App.tsx` además documenta explícitamente **no** memoizar los objetos de props:

> Los dos objetos se arman INLINE y no en un `useMemo`: tienen identidad nueva por render, y eso no
> cuesta nada porque `PiecePalette` no está memoizado — re-renderiza igual cuando el shell re-renderiza.

El argumento es cierto y circular: no memoizamos las props porque el componente no está memoizado.

Y es el **único** caso de frecuencia del repo que no está medido, en un proyecto donde D1 y D2 existen
porque alguien midió 4 a 10,6 cambios por segundo y 60 fps.

### 5. Dos aserciones no nulas que el repo prohibiría si las hubiera nombrado

`CLAUDE.md` dice «Cero `any` y cero `@ts-ignore`. Los tres que hubo estaban tapando problemas de
diseño». La aserción no nula es la misma familia y quedó sin nombrar. Hay dos en `src/`:

```ts
// audio/engine.ts:129 — master ya fue chequeado tres líneas arriba
notes.forEach((m, i) => scheduleVoice(c, master!, …));

// main.tsx:12
createRoot(document.getElementById('root')!).render(…)
```

La primera es gratis de sacar y es la que importa: el `!` está ahí sólo porque TypeScript pierde el
estrechamiento adentro del closure.

## Solución propuesta

### D1 — `route-source` gana una puerta de reinicio, y la usa `Reset`

`reiniciar()` exportada desde `route-source.ts`, que devuelve `activa`, `pendiente`, `estrenando` y
`veloActual` a su valor inicial. Dos precisiones que si no se escriben se re-descubren mal:

- **`generacion` se sincroniza, no se pone en cero.** `cycleGen` del motor **no se resetea nunca** —lo
  dice su propio docblock (`audio/engine.ts:230`): «resetear haría creer a la UI que hubo un swap que
  no hubo»—, así que dejar `generacion = 0` de este lado reintroduce exactamente esa mentira, y peor:
  con la pendiente vacía que `encolar` deja inmediatamente después, el próximo cuadro haría un swap
  fuera del borde del ciclo. `reiniciar()` la deja en `cycleGeneration()`.
- **La llamada entra por `components/use-engine.ts`, no importando `route-source.ts` desde el shell.**
  Hoy `App.tsx` no conoce ninguna de las dos colas: al motor le pide por `frenarTransporte()` —que es
  `stopClock()` re-exportado exactamente por esto— y a la cola de dibujo no le pide nada porque la
  encola el efecto de reconciliación. Que el reinicio entre por el mismo módulo es lo que sostiene la
  simetría cuya ausencia **es** este bug.

**No** se arregla haciendo que `encolar` con una secuencia vacía limpie sola: eso convertiría «el
tablero quedó vacío» en «volvé a cero», y son cosas distintas —quitar la última pieza con el transporte
**corriendo** tiene que seguir respetando D5 del 009 y dejar que el ciclo cierre—. El reinicio es una
orden explícita, igual que del lado del motor.

### D2 — El `catch` de `audio()` deja el módulo como lo encontró

`ctx = null` (y `master`, y `analyser`) dentro del `catch`, más una marca de que ya falló para no
reintentar en cada click. La marca es lo que apaga el warning repetido **sin** apagar el warning.

Tres cosas van escritas al lado, porque si no se re-discuten al implementar:

- **La marca latchea, y es el precio.** Desde el primer fallo la app queda muda hasta recargar, aunque
  la causa fuera transitoria. Se acepta porque el reintento tampoco la desmutea —lo único que agrega
  hoy es un warning por click— y porque un estado que se recupera solo es un estado que nadie puede
  reproducir.
- **El contexto a medio construir no se cierra.** `close()` devuelve una promesa y obligaría a un
  `.catch(() => {})` que no corre nunca: con el umbral 100 y cero `/* v8 ignore */`, eso es una
  función sin cubrir. Queda vivo y sin referencias, igual que hoy.
- **Las guardas `if (!c || !master)` se quedan.** Con `ctx` y `master` cayendo juntos su segunda mitad
  deja de ser alcanzable desde afuera, y aun así no se borra: es lo que impide que un fallo futuro
  llegue a `scheduleVoice` con destino nulo. Va con el comentario que lo diga, porque «rama
  inalcanzable» es lo que el repo pide borrar y ésta es la excepción argumentada. Si el coverage la
  marcara descubierta, se resuelve con un test que la alcance, **nunca** con un ignore.

### D3 — La guarda del reposo se copia de `playhead-loop.ts`, no se inventa

Se copia la **forma exacta** del otro loop, que es una **clave de lo último dibujado** y no un
booleano. La diferencia decide si el arreglo es correcto, porque hay **tres** transiciones y no dos:

| Transición | Qué tiene que pasar | Con un booleano de «ya dibujé el reposo» |
|---|---|---|
| reposo → reposo | no redibujar | ✔ |
| reposo → señal | dibujar barras | ✔ |
| **señal → reposo** | **volver a dibujar el reposo** | ✘ deja el último cuadro de barras congelado |

La tercera es alcanzable: `readSpectrum()` devuelve `null` también con el contexto **suspendido**, no
sólo antes del primer click. Con un booleano crudo el arreglo cambiaría una falla muda por otra, en
el spec que se llama como se llama. El `resize` la invalida igual —redimensionar borra el canvas—.

El comentario **no** argumenta desde cero: cita el de `playhead-loop.ts`, que ya midió esto del otro
lado. El argumento ya estaba medido, sólo faltaba aplicarlo de este.

### D4 — La paleta se mide **antes** de memoizarla

Este es el punto donde el spec se resiste a la tentación. Lo fácil es poner `memo()` y un `useMemo`, y
quedaría probablemente mejor. Pero `App.tsx` tiene una decisión **escrita** en contra, y pisarla sin un
número sería exactamente lo que este repo no hace.

Entonces se hace en dos tiempos, y el segundo es condicional:

1. **Medir**, con el oráculo que el 024 hizo posible: un test de navegador que cuente cuántas veces se
   ejecuta `OrientationPanel` mientras el cursor cruza diez celdas. Hoy tiene que dar **diez**.
2. **Si y sólo si** el número molesta, `memo()` + memoizar el objeto `orientacion`, y el test pasa a
   afirmar **cero**.

El AC no es «poner memo»: es **que exista el número**. Si la medición dice que no cuesta nada, lo que se
escribe es el número al lado del comentario que hoy afirma que no cuesta nada — y el comentario deja de
ser una suposición.

### D5 — El `!` de `engine.ts` sale con una `const`, y el de `main.tsx` se queda

```ts
const bus = master;   // TS ya lo estrechó con el guard de arriba
notes.forEach((m, i) => scheduleVoice(c, bus, …));
```

El de `main.tsx` es el idiom estándar de Vite sobre un `#root` que el propio `index.html` garantiza. Se
deja, y se escribe por qué — para que la próxima lectura no lo cuente como deuda.

## Criterios de aceptación

- **AC1** — Tras `Reset`, `velo()` devuelve vacío aunque el transporte esté parado. Cubierto por un test
  en `route-source.test.ts`, que es el que hoy falla.
- **AC2** — Quitar la última pieza con el transporte **corriendo** sigue respetando D5 del 009: el ciclo
  activo termina. El reinicio es sólo de `Reset`.
- **AC3** — Si `audio()` falla a mitad, `clockRunning()` **no** puede quedar en `true`. El botón no dice
  «Pausa» sin sonido. Y el test del 029 que hoy afirma lo contrario —«con el grafo a medio construir,
  tick se planta en su guarda», `audio/__tests__/engine.browser.test.tsx:503`— queda **reescrito**
  contra el oráculo nuevo y no borrado: sigue fabricando el mismo fallo.
- **AC4** — Un fallo total de Web Audio produce **un** `console.warn`, no uno por click.
- **AC5** — El loop de `spectrum-loop.ts` cubre las **tres** transiciones: en reposo no vuelve a
  dibujar el canvas después del primer cuadro; vuelve a dibujarlo tras un `resize`; y vuelve a
  dibujarlo cuando la señal desaparece —`readSpectrum()` en `null` con el canvas lleno de barras—. Las
  tres, o el arreglo cambia una falla muda por otra.
- **AC6** — Existe un número medido de cuántas veces se ejecuta `OrientationPanel` al recorrer diez
  celdas con el cursor —contadas **además** del render inicial, que es lo que vuelve falsificable el
  «diez»— y está escrito en `App.tsx` al lado de la decisión que hoy lo afirma sin medir
  (`App.tsx:253-257`). Se cuentan **ejecuciones y no milisegundos**: por eso no necesita el `skipIf`
  bajo coverage con el que el 029 salvó los dos presupuestos de tiempo del 009.
- **AC7** — Si ese número se considera caro, `OrientationPanel` está memoizado y el test afirma el
  número nuevo. Si no, el comentario queda con la medición y **no se memoiza nada**.
- **AC8** — `src/` no tiene la aserción de `engine.ts:129`, y la de `main.tsx` está argumentada en un
  comentario.
- **AC9** — `pnpm verify` verde con sus cuatro nodos, incluida la segunda pasada de `suite` con el
  umbral de **coverage en 100**. Los 562 tests de `src/` y los del MCP server siguen pasando, más los
  nuevos y menos ninguno: el único que cambia es el del estado degradado, que se reescribe. (Los «322
  + 85» que este spec decía antes son de antes del 029.)
- **AC10** — Cero cambio visual y cero cambio de audio.
- **AC11** — Ninguna rama nueva queda sin test y **ningún `/* v8 ignore */` entra al árbol**. Si al
  caer el estado degradado alguna mitad de `if (!c || !master)` quedara marcada como descubierta, se
  resuelve con un test que la alcance.
- **AC12** — `App.tsx` **no** importa `components/route-source.ts`: el reinicio de la segunda cola se
  expone desde `components/use-engine.ts`, que es de donde ya sale `frenarTransporte()`. Las dos colas
  se reinician por el mismo camino, o vuelve la asimetría que este hallazgo es.
- **AC13** — `src/components/Playhead.tsx` ya no afirma que el `z-10` «no lo atrapa ningún test»:
  `components/__tests__/Playhead.browser.test.tsx:65` lo atrapa desde el 029, sobre las dos capas.
  Es la sexta cosa que falla en silencio y la única que no está en el código sino **sobre** el código
  — un comentario que sobrevivió a su propio arreglo manda a hacer trabajo ya hecho, y se lee con la
  misma cara con la que antes decía la verdad.

## Fuera de alcance

- **Deshacer.** Sigue en `deuda.md` y lo empeora el 026, no éste.
- **Sacar el estado de módulo de `route-source.ts` y `audio/engine.ts`.** Está bien ubicado: la regla
  «sin estado global» del repo habla de estado de **React**, y la alternativa (Context) empeoraría justo
  lo que estos módulos optimizan. Lo único que le faltaba era la puerta de D1.
- **`useSyncExternalStore` en `Playhead` y `Spectrum`.** Ese hook existe para que un store externo
  **re-renderice**, y acá el objetivo medido es el contrario.
- **Los arrastres de Create React App**, que son el 028.
- **La rotación sin acotar** (`deuda.md`), que es la sexta falla muda y la única ya **registrada**: en
  el régimen `orden` una rotación fuera de `0..3` no cae a ningún `else` —`base[j + rot]` da
  `undefined`, y `midiName` de eso no explota: devuelve `undefinedNaN` y lo pinta en la celda—, y la
  implementación lo tapó con un módulo que tardó dos intentos en cerrar. Queda afuera por alcance y no
  por criterio: el arreglo es acotar el tipo, o sea cambiar firmas en cuatro lugares y tocar
  `domain/`, y este spec **no toca `domain/`**. Se nombra acá para que la lista de cinco no se lea
  como la lista completa.

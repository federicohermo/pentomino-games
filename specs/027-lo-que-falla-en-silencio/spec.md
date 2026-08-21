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
> **No cambia una nota.** Toca `route-source.ts`, `audio/engine.ts`, `Spectrum.tsx` y una línea de
> `App.tsx`.

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

Y una segunda consecuencia del mismo `catch`: cuando el fallo es **total** tampoco queda marcado, así
que cada llamada a `audio()` reintenta construir el `AudioContext` y vuelve a hacer `console.warn`. Un
click, un warning.

### 3. `Spectrum` redibuja el reposo 60 veces por segundo, para siempre

Su loop llama a `drawIdle()` en cada cuadro mientras no hay `AudioContext`. Son, por cuadro: un
`clearRect`, 48 `fillRect` y un `fillText` — **50 operaciones de canvas para pintar exactamente la misma
imagen**, desde que carga la página hasta el primer click. A 60 fps, 3.000 por segundo.

`Playhead`, en el mismo repo y con el mismo patrón, **sí** tiene la guarda, y su docblock la argumenta:

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

`reiniciar()` exportada, que devuelve `activa`, `pendiente` y `estrenando` a cero. La llama
`resetBoard()` junto a `frenarTransporte()`.

**No** se arregla haciendo que `encolar` con una secuencia vacía limpie sola: eso convertiría «el
tablero quedó vacío» en «volvé a cero», y son cosas distintas —quitar la última pieza con el transporte
**corriendo** tiene que seguir respetando D5 del 009 y dejar que el ciclo cierre—. El reinicio es una
orden explícita, igual que del lado del motor.

### D2 — El `catch` de `audio()` deja el módulo como lo encontró

`ctx = null` (y `master`, y `analyser`) dentro del `catch`, más una marca de que ya falló para no
reintentar en cada click. La marca es lo que apaga el warning repetido **sin** apagar el warning.

### D3 — La guarda del reposo se copia de `Playhead`, no se inventa

Un booleano de «ya dibujé el reposo», que el `resize` invalida —redimensionar borra el canvas—. Es la
misma forma que la variable `dibujado` del otro loop, y el comentario lo dice: el argumento ya estaba
medido, sólo faltaba aplicarlo del otro lado.

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
  «Pausa» sin sonido.
- **AC4** — Un fallo total de Web Audio produce **un** `console.warn`, no uno por click.
- **AC5** — En reposo, el loop de `Spectrum` no vuelve a dibujar el canvas después del primer cuadro, y
  vuelve a dibujarlo tras un `resize`.
- **AC6** — Existe un número medido de cuántas veces se ejecuta `OrientationPanel` al recorrer diez
  celdas con el cursor, y está escrito en `App.tsx` al lado de la decisión que hoy lo afirma sin medir.
- **AC7** — Si ese número se considera caro, `OrientationPanel` está memoizado y el test afirma el
  número nuevo. Si no, el comentario queda con la medición y **no se memoiza nada**.
- **AC8** — `src/` no tiene la aserción de `engine.ts:129`, y la de `main.tsx` está argumentada en un
  comentario.
- **AC9** — `pnpm verify` verde. Los 322 + 85 siguen pasando, más los tests nuevos.
- **AC10** — Cero cambio visual y cero cambio de audio.

## Fuera de alcance

- **Deshacer.** Sigue en `deuda.md` y lo empeora el 026, no éste.
- **Sacar el estado de módulo de `route-source.ts` y `audio/engine.ts`.** Está bien ubicado: la regla
  «sin estado global» del repo habla de estado de **React**, y la alternativa (Context) empeoraría justo
  lo que estos módulos optimizan. Lo único que le faltaba era la puerta de D1.
- **`useSyncExternalStore` en `Playhead` y `Spectrum`.** Ese hook existe para que un store externo
  **re-renderice**, y acá el objetivo medido es el contrario.
- **Los arrastres de Create React App**, que son el 028.

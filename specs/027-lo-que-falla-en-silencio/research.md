# Research 027 — Lo que falla en silencio

Medido sobre `main` en `052aedf`, y **re-anclado sobre `37abf53`** —el `main` de hoy, con el 029 y el
030 ya mergeados—. El hallazgo 1 está **reproducido con un test que se corrió de verdad**; los otros
cuatro salen de leer el código y contar.

**Lo que el 029 movió debajo de este research, y hay que leer con eso puesto:** los dos bucles de
dibujo salieron de sus `.tsx` sin cambiar una línea de comportamiento —`Spectrum.tsx` →
`components/spectrum-loop.ts`, `Playhead.tsx` → `components/playhead-loop.ts`—, así que los hallazgos
3 y 1 apuntan hoy a esos dos archivos. Y `audio/engine.ts` pasó de 0 % a 100 % de cobertura: **el
hallazgo 2 ya tiene un test que fija el comportamiento de hoy**, así que arreglarlo es también
reescribirlo (§2). El umbral de coverage es **100 en las cuatro métricas** y no hay
`/* v8 ignore */`: toda rama que este spec agregue viene con su test, y toda rama que deje
inalcanzable hay que resolverla, no taparla.

## 1. El velo huérfano — la reproducción

### La máquina de estados, como está

`components/route-source.ts` tiene cinco variables de módulo:

```ts
let activa: Ruta = RUTA_VACIA;
let pendiente: Ruta | null = null;
let generacion = 0;
let estrenando: string[] = [];
let veloActual: CeldaPorEstrenar[] = [];
```

y dos puertas de entrada:

- `encolar(s, placed)` — escribe `pendiente` y llama a `recomputarVelo()`;
- `rutaActiva()` — la llama el loop de dibujo; hace el swap **sólo si** `cycleGeneration() !== generacion`.

`cycleGeneration()` lo sube `audio/engine.ts::tick()`, y `tick()` corre desde el `setInterval` de
`startClock()`. **Con el reloj parado, el contador no se mueve.**

`recomputarVelo()` lee `estrenando` y `activa.porPieza`:

```ts
for (const id of estrenando) {
  for (const c of activa.porPieza.get(id) ?? []) out.push({ id, cell: c.cell, offset: c.offset });
}
```

Nada, en ninguna de las dos puertas, pone `estrenando` en `[]` ni `activa` en `RUTA_VACIA` fuera del
swap.

### El test

Escrito con el mismo mock que usa `route-source.test.ts` —el motor es un número—, corrido, y borrado:

```
✗ deja el velo con las celdas de una pieza que ya no esta en el tablero
  AssertionError: expected 5 to be +0
  - Expected  0
  + Received  5
```

Los cinco elementos son las cinco celdas de la pieza que `Reset` acaba de borrar del tablero.

### El camino completo, del click al píxel

1. `resetBoard()` llama a `frenarTransporte()` → `stopClock()` → `timer = null`.
2. `setPlaced([])`.
3. El efecto de `use-engine.ts` corre: `encolar(secuenciaVacía, [])` y `setSequence(vacía)`.
4. `encolar` → `pendiente = ruta vacía`, `recomputarVelo()` → **re-emite las celdas viejas** desde
   `estrenando` y `activa`.
5. El `rAF` de `Playhead` lee `velo()`, ve un array **nuevo** (`v !== veloVisto`) y llama a `rearmar()`.
6. `rearmar()` crea un nodo por entrada, encima de un tablero vacío.

El paso 6 tiene un atenuante medido: `rearmar` pone `display: none` a las celdas que ya están en el
`Set` local `estrenadas` del loop. O sea que **sólo se ven las celdas que nunca llegó a pisar la
cabeza** — que es justo el caso de apretar `Reset` poco después de colocar.

### Por qué se autocura

Al volver a apretar Play, `tick()` sube el contador, `rutaActiva()` hace el swap con
`pendiente = ruta vacía`, `estrenando = []` y `activa = vacía`, y `recomputarVelo()` da `[]`. El síntoma
dura entre el `Reset` y el próximo arranque.

### El mismo camino, sin `Reset`

Quitar una pieza clickeándola con el transporte **en pausa** ejecuta los pasos 2 a 6 idénticos. Es el
gesto que el 014 creó, así que es más frecuente que `Reset`.

## 2. `audio()` a medio construir

```ts
export function audio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();          // ← se asigna acá
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    analyser = ctx.createAnalyser();   // ← si tira acá…
    …
  } catch (e) {
    console.warn('Web Audio no disponible', e);
    return null;                       // ← …ctx queda seteado
  }
  return ctx;
}
```

Estado del módulo tras un fallo posterior a la primera línea: `ctx` no nulo, `master` nulo.

Consecuencias, siguiendo los llamadores:

| Función | Guarda | Con `ctx` sí y `master` no |
|---|---|---|
| `playNotes` | `if (!c || !master) return` | Sale bien |
| `readSpectrum` | `if (!analyser \|\| !ctx \|\| …)` | Sale bien |
| `tick` | `if (!c \|\| !master) return` | Sale bien, en cada vuelta |
| **`startClock`** | `const c = audio(); if (!c) return;` | **No sale**: arranca el `setInterval` |
| **`clockRunning`** | `timer !== null` | **`true`** |

Y `alternarTransporte` —la pura que el 022 escribió justamente para creerle al motor y no a lo que se
pidió— pregunta `motor.corriendo()` y recibe `true`. El botón dice «Pausa» y no suena nada.

Probabilidad: baja. `createGain` y `createAnalyser` fallando después de que el constructor haya andado
es raro. Lo que lo hace digno de arreglar es que el modo de falla es **exactamente** el que
`.claude/rules/audio.md` declara como el peligro del motor, y que el arreglo es una línea.

Segundo efecto, éste sí frecuente si el navegador no soporta Web Audio: como el fallo total tampoco
deja marca, `if (ctx) return ctx` nunca corta y **cada** llamada reintenta el constructor y vuelve a
loguear. `playNow` se llama en cada click de colocación.

### El 029 le puso un test al estado degradado, y ese test se opone al arreglo

`audio/__tests__/engine.browser.test.tsx:503` —«con el grafo a medio construir, tick se planta en su
guarda»— fabrica exactamente este fallo (`class SinGain extends AudioContext` con un `createGain()`
que tira) y **afirma el comportamiento de hoy**:

```ts
expect(e.audio()).toBeNull();      // primera llamada: explota adentro del try
expect(e.audio()).not.toBeNull();  // segunda: el `ctx` quedo, el `master` no
e.setSequence(CICLO);
e.startClock();
expect(e.clockRunning()).toBe(true);
```

O sea que el arreglo lo pone en rojo, y su comentario —«el estado degradado que la guarda existe para
atajar, **y que es alcanzable de verdad**»— pasa a ser falso. No es un obstáculo: es la mejor
evidencia de que el hallazgo existe, porque alguien lo reprodujo y lo dejó escrito como alcanzable en
vez de leerlo como un bug. Lo que cambia es el alcance: **reescribir ese test es trabajo del paso 2**,
no algo que se descubre al correr `verify`.

Y arrastra tres decisiones que van escritas, porque si no se re-descubren al implementar:

- **La marca latchea.** Desde el primer fallo la app queda muda hasta recargar, aunque la causa fuera
  transitoria. Se acepta porque el reintento tampoco la desmutea —lo único que agrega hoy es un
  warning por click— y porque un estado que se recupera solo es un estado que nadie puede reproducir.
- **El contexto a medio construir NO se cierra.** `close()` devuelve una promesa y obligaría a un
  `.catch(() => {})` que no corre nunca; con el umbral 100 y cero `/* v8 ignore */`, eso es una
  función sin cubrir. Queda vivo y sin referencias, que es lo que ya pasa hoy.
- **Las guardas `if (!c || !master)` de `playNotes` y `tick()` se quedan.** Con `ctx` y `master`
  cayendo juntos, su segunda mitad deja de ser alcanzable desde afuera del módulo, y aun así no se
  borra: es lo que impide que un fallo futuro llegue a `scheduleVoice` con destino nulo. Va con el
  comentario que lo diga. Si el coverage llegara a marcarla como rama descubierta, se resuelve con un
  test que la alcance —fabricar el fallo y llamar a `tick` sigue siendo posible— y **nunca** con un
  ignore.

## 3. El reposo de `Spectrum`, contado

El código es hoy `components/spectrum-loop.ts:122-127`: el 029 lo sacó del `.tsx` **sin cambiar una
línea de comportamiento**, así que la cuenta vale igual y lo que cambia es el archivo que se edita.

```ts
const draw = () => {
  const bins = readSpectrum();
  if (bins) drawBars(g, w, h, binsToBars(bins, BAR_COUNT), fill);
  else drawIdle(g, w, h);          // ← sin guarda
  raf = requestAnimationFrame(draw);
};
```

`drawIdle`, con `BAR_COUNT = 48`:

| Operación | Cantidad por cuadro |
|---|---|
| `clearRect` | 1 |
| `fillRect` | 48 |
| `fillStyle` | **2** — una antes de las ranuras y otra antes del texto |
| `font` / `textAlign` / `textBaseline` | 3 |
| `fillText` | 1 |
| **Total** | **55** |

**Eran 54 y son 55**, re-contado sobre el archivo: la cuenta anterior veía un solo `fillStyle` y hay
dos (`spectrum-loop.ts:48` y `:51`). El número que el `log.md` cita afuera —3.240— sale de ese 54; el
bueno es **3.300**.

A 60 fps: **3.300 operaciones por segundo**, todas para pintar la misma imagen, desde que carga la
página hasta el primer click. El `requestAnimationFrame` se suspende con la pestaña oculta, así que el
costo es sólo con la pestaña visible — que es todo el tiempo que la app está en reposo esperando que
alguien la use.

Comparación con el otro loop del repo, que es lo que lo vuelve una inconsistencia y no una opinión:

| | `playhead-loop.ts` | `spectrum-loop.ts` |
|---|---|---|
| Guarda de «no cambió nada» | `let dibujado = ''` — una **clave de lo último dibujado**, no un booleano | **Ninguna** |
| Escrituras en pausa | **0** (es su AC7) | 55 por cuadro |
| Argumento escrito | Sí, en su docblock (`playhead-loop.ts:52-56`) | — |

Que la guarda del otro loop sea una **clave** y no un booleano no es estilo, y es lo que D3 tiene que
copiar: la clave cubre las transiciones en las dos direcciones sin que nadie las enumere. Un booleano
de «ya dibujé el reposo» sólo cubre reposo→reposo y deja afuera **señal→reposo**, que es alcanzable:
`readSpectrum()` devuelve `null` también con el contexto **suspendido**, no sólo antes del primer
click. Con el booleano crudo, el último cuadro de barras se quedaría congelado en pantalla — o sea,
el arreglo cambiaría una falla muda por otra.

## 4. El re-render de la paleta, contado

`hover: Cell | null` vive en `App.tsx:84` y lo escribe `onCellEnter`, que `Board` cuelga de cada celda
con `onMouseEnter`. Cambiarlo re-renderiza `App` y con él **todo** el árbol.

Elementos por render de `OrientationPanel`, con `MINI_BOX = 5` y doce piezas:

```
1  contenedor .grid
+ 12 × ( 1 button
       + 1 div.grid
       + 25 celdas
       + 1 span )
= 1 + 12 × 28
= 337
```

Ninguno depende de `hover`: `OrientationPanel` recibe `{ selected, rotation, mirror, onSelect }`, y los
tres primeros no cambian al mover el mouse.

Y `App.tsx:253-257` documenta la decisión de no memoizar:

> Los dos objetos se arman INLINE y no en un `useMemo`: tienen identidad nueva por render, y eso no
> cuesta nada porque `PiecePalette` no está memoizado — re-renderiza igual cuando el shell
> re-renderiza. Va escrito porque es lo primero que alguien va a querer "arreglar" con un `useMemo` que
> no compra nada.

Es correcto **dado** que no está memoizado, y es la premisa la que nadie midió.

**Lo que falta es el número, no la opinión.** El repo tiene dos decisiones de frecuencia medidas —D1 del
010 (4 a 10,6 cambios por segundo) y D2 (60 fps contra 60 celdas)— y ésta es la tercera frecuencia del
sistema, la del mouse, sin medir. Con el spec 024 puesto, medirla es un test:

```tsx
// contar ejecuciones de OrientationPanel mientras el cursor cruza diez celdas
```

Hoy tiene que dar **diez ejecuciones además de la del render inicial**, y decirlo es parte del
oráculo: sin eso «diez» y «once» son los dos números defendibles y el test no falsifica nada.

Y lo que se cuenta son **ejecuciones, no milisegundos**. Importa por el 029: los dos presupuestos de
tiempo del 009 quedaron salteados bajo coverage con `skipIf` —instrumentados miden 11,3 ms contra un
techo de 5— así que un presupuesto nuevo en ms tendría que repetir ese patrón o rompería `verify`. Un
contador de renders es determinista bajo instrumentación y no lo necesita.

Si diez re-renders de 337 elementos no se notan, eso se escribe y el comentario deja de ser una
suposición. Si se notan, `memo()` y el test pasa a afirmar cero.

## 5. Las dos aserciones

```
src/main.tsx:12       createRoot(document.getElementById('root')!).render(
src/audio/engine.ts:129  notes.forEach((m, i) => scheduleVoice(c, master!, …));
```

Son las **únicas** dos de `src/`. La de `engine.ts` está tres líneas después de
`if (!c || !master) return;`: TypeScript estrecha `master` ahí, pero pierde el estrechamiento al entrar
al closure del `forEach`, porque `master` es un `let` de módulo que el closure podría ver cambiado. Una
`const` local después de la guarda lo resuelve sin `!` y sin cambiar el comportamiento.

La de `main.tsx` es el idiom de la plantilla de Vite y el `#root` lo garantiza el `index.html` del mismo
repo. No es deuda; lo que falta es que esté escrito, para que la próxima lectura no lo cuente otra vez.

## 6. Archivos que toca

| Archivo | Hallazgo |
|---|---|
| `components/route-source.ts` | 1 — `reiniciar()` |
| `components/__tests__/route-source.test.ts` | 1 — el test que hoy falla |
| `App.tsx` | 1 (una línea en `resetBoard`) y 4 (la medición, y quizá el `useMemo`) |
| `audio/engine.ts` | 2 y 5 |
| `components/spectrum-loop.ts` | 3 — el loop, que desde el 029 no vive en el `.tsx` |
| `components/__tests__/Spectrum.browser.test.tsx` | 3 — las **tres** transiciones de AC5 |
| `components/OrientationPanel.tsx` | 4, sólo si la medición lo pide |
| `src/__tests__/App.browser.test.tsx` | 4 — el contador de ejecuciones |
| `audio/__tests__/engine.browser.test.tsx` | 2 — el test del 029 que hoy fija el estado degradado |
| `components/use-engine.ts` | 1 — por donde entra la llamada a `reiniciar()` |
| `main.tsx` | 5 — un comentario |

**Cero cambios en `domain/`.** Ni una nota, ni un tiempo.

## 7. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `reiniciar()` se llama de más y rompe D5 del 009 | Media | AC2 es un test propio: quitar la última pieza **con el transporte corriendo** no reinicia nada |
| La guarda del reposo deja el canvas en blanco tras un `resize` | Media | El `resize` la invalida; AC5 lo verifica en sus dos mitades |
| Memoizar la paleta pisa una decisión escrita sin evidencia | **Alta si se hace sin medir** | D4 lo invierte: el AC es que exista el número, no que se memoice |
| Sacar el `!` cambia el comportamiento | Muy baja | Es un estrechamiento, no un cambio de valor. Los tests de `audio/` lo cubren |
| El arreglo de D2 pone en rojo un test que **ya existe** | **Certeza** | Es una tarea del paso 2 y no un accidente: `engine.browser.test.tsx:503` se reescribe con el oráculo dado vuelta, sin borrar el caso |
| La marca de «ya falló» latchea también un fallo transitorio | Media | Es el precio, y va escrito en el comentario: desde la marca la app queda muda hasta recargar. El contexto a medio construir no se cierra, porque `close()` costaría un `.catch` que nunca corre y el umbral es 100 |
| La guarda del reposo congela el último cuadro de barras | Media | Sólo si es un booleano. Por eso D3 copia la **clave** de `playhead-loop.ts`, y AC5 tiene **tres** mitades |
| `reiniciar()` pone `generacion` en 0 y le inventa un swap a la UI | Media | `cycleGen` del motor **no** se resetea nunca —lo dice su docblock, `engine.ts:230`— así que el reinicio **sincroniza** `generacion` con `cycleGeneration()` en vez de ponerla en cero |

## 8. Dependencias

- **Ninguna.** El hallazgo 4 pedía el 024 —sin navegador no hay forma de contar renders provocados por
  el mouse— y esa arista **ya está satisfecha por `main`**: el 029 construyó el proyecto de navegador
  siguiendo el diseño del 024, y hoy hay ocho `*.browser.test.tsx` corriendo en Chromium por
  Playwright. Los otros cuatro hallazgos se verifican en `environment: 'node'`.
- **Lo que el 029 sí cambia es el trabajo, no el orden:** su test del estado degradado se reescribe
  (§2), y `audio/engine.ts` está al 100 %, así que cada rama nueva llega con su test.
- **Ortogonal al lote 018–021** salvo el hallazgo 4: el 019 y el 020 cambian `PiecePalette` y
  `OrientationPanel`, así que si la medición pidiera memoizar, ese cambio se re-decide ahí. El número
  medido sobrevive igual — es lo que hace falta y lo que hoy no existe.
- **Choques de archivo dentro del lote 023–028**, que son merges y no orden: `App.tsx` lo comparten el
  024, el 026 y el 028; `CLAUDE.md`, el 023, el 024 y el 028. `docs/architecture/audio.md` es sólo de
  este spec.

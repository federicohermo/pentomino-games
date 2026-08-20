# Research 027 — Lo que falla en silencio

Medido sobre `main` en `052aedf`. El hallazgo 1 está **reproducido con un test que se corrió de
verdad**; los otros cuatro salen de leer el código y contar.

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

## 3. El reposo de `Spectrum`, contado

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
| `fillStyle` / `font` / `textAlign` / `textBaseline` | 4 |
| `fillText` | 1 |
| **Total** | **54** |

A 60 fps: **3.240 operaciones por segundo**, todas para pintar la misma imagen, desde que carga la
página hasta el primer click. El `requestAnimationFrame` se suspende con la pestaña oculta, así que el
costo es sólo con la pestaña visible — que es todo el tiempo que la app está en reposo esperando que
alguien la use.

Comparación con el otro loop del repo, que es lo que lo vuelve una inconsistencia y no una opinión:

| | `Playhead` | `Spectrum` |
|---|---|---|
| Guarda de «no cambió nada» | `let dibujado = ''` | **Ninguna** |
| Escrituras en pausa | **0** (es su AC7) | 54 por cuadro |
| Argumento escrito | Sí, en su docblock | — |

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

Hoy tiene que dar **diez**. Si diez re-renders de 337 elementos no se notan, eso se escribe y el
comentario deja de ser una suposición. Si se notan, `memo()` y el test pasa a afirmar cero.

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
| `components/Spectrum.tsx` | 3 |
| `components/OrientationPanel.tsx` | 4, sólo si la medición lo pide |
| `main.tsx` | 5 — un comentario |

**Cero cambios en `domain/`.** Ni una nota, ni un tiempo.

## 7. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `reiniciar()` se llama de más y rompe D5 del 009 | Media | AC2 es un test propio: quitar la última pieza **con el transporte corriendo** no reinicia nada |
| La guarda del reposo deja el canvas en blanco tras un `resize` | Media | El `resize` la invalida; AC5 lo verifica en sus dos mitades |
| Memoizar la paleta pisa una decisión escrita sin evidencia | **Alta si se hace sin medir** | D4 lo invierte: el AC es que exista el número, no que se memoice |
| Sacar el `!` cambia el comportamiento | Muy baja | Es un estrechamiento, no un cambio de valor. Los tests de `audio/` lo cubren |

## 8. Dependencias

- **024 conviene mergeado** para el hallazgo 4: sin navegador no hay forma de contar renders provocados
  por el mouse. Los otros cuatro se verifican en `environment: 'node'` y no lo necesitan.
- **Ortogonal al lote 018–021** salvo el hallazgo 4: el 019 y el 020 cambian `PiecePalette` y
  `OrientationPanel`, así que si la medición pidiera memoizar, ese cambio se re-decide ahí. El número
  medido sobrevive igual — es lo que hace falta y lo que hoy no existe.

# Spec 010 — Cabeza lectora por celda

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **Depende del [009](../009-el-tablero-como-recorrido/spec.md)**: sin recorrido no hay nada que seguir.

## Problema

El repo tiene una limitación anotada desde el spec 004: *"no hay retroalimentación visual de la fase.
Una cabeza lectora recorriendo el tablero es lo que volvería legible a esta regla; hoy se oye pero no
se lee"*. Con el spec 009 esa limitación deja de ser incómoda y pasa a ser **el problema principal**,
por dos razones medidas:

1. **Hay mucho más que leer.** Un ciclo de 8 piezas tiene 40 notas y ~15 clicks, en un recorrido cuyo
   orden no es el de colocación sino el del circuito más corto. Sin verlo, la única forma de saber por
   dónde va el instrumento es reconocer las tónicas de oído.
2. **El 009 hace esperar hasta un ciclo entero** para escuchar una pieza recién colocada —7,5 s con 8
   piezas a 110 bpm— y durante esa espera **no pasa nada**: ni un cambio visual, ni un sonido. Es
   indistinguible de "el click no registró". Es el riesgo principal del 009 y este spec es su
   contrapartida.

## Solución Propuesta

1. **Una cabeza lectora** recorre el tablero celda por celda, en sincronía con lo que se escucha:
   enciende la celda de la nota que suena y, en los saltos, las celdas vacías que el recorrido cruza.
2. **La pieza pendiente se ve pendiente**: una pieza colocada que todavía no entró al ciclo se dibuja
   distinta hasta que el ciclo se cierra y empieza a sonar.
3. **La lista de piezas colocadas muestra el orden del circuito**, no el de colocación: es el mismo
   orden que se escucha, y hace legible que colocar en el medio cambia el lugar.

### Decisiones de diseño

**D1 — El dibujo no pasa por el estado de React.**
El intervalo dura entre 0,25 s (60 bpm) y 0,094 s (160 bpm): son **4 a 10,6 actualizaciones por
segundo**. Llevar eso a `useState` re-renderizaría el tablero entero —60 celdas— más la paleta y la
lista, diez veces por segundo, para mover un resaltado. Es exactamente lo que `Spectrum.tsx` ya evita a
propósito, y se resuelve igual: un efecto con `requestAnimationFrame` que lee del motor y pinta de
forma imperativa, con `[]` como array de dependencias.

**D2 — Se mueve un elemento, no cambian sesenta.**
La cabeza es un elemento superpuesto y posicionado en absoluto, que se traslada sobre la grilla. La
alternativa —recalcular la clase de las 60 celdas en cada cuadro— toca 60 nodos para cambiar uno. El
costo por cuadro queda en una escritura de `transform`.

**D3 — La posición es una función pura del tiempo, no un contador.**
`offset(t) = ((t − origin) / intervalo) mod ciclo`. Es la misma propiedad que sostiene al scheduler
desde el spec 002 —el reloj es un origen, no un cursor— y trae el mismo beneficio: si la pestaña se
estrangula, la cabeza **reaparece donde corresponde** en vez de acumular deriva, sin ninguna lógica de
recuperación. Y la hace testeable sin tiempo real.

**D4 — Se compensa la latencia de salida.**
Lo que el scheduler agenda en `currentTime` se **escucha** más tarde: `AudioContext` lo expone en
`outputLatency` (y `baseLatency`). Sin restarlo, la cabeza va sistemáticamente adelantada respecto de
lo que suena, y en un instrumento eso se percibe como que la imagen miente. `outputLatency` no está en
todos los navegadores: el fallback es `baseLatency`, y si tampoco está, cero.

**D5 — El camino viene dado; este spec no calcula ninguno.**
El recorrido concreto —qué celdas cruza cada salto— lo materializa el 009 en su D8, junto con la
distancia y desde la misma decisión. Acá se **lee** `sequence.clicks[].cell` y se dibuja.

Es deliberado y es lo que separa dibujar el modelo de tener una segunda opinión sobre él: si la UI
eligiera su propio camino, podría mostrar un recorrido distinto del que suena, y nadie se enteraría
hasta escuchar y mirar a la vez. Entre el par más lejano del tablero hay **792 caminos mínimos**, así
que dos implementaciones independientes tienen 792 formas de discrepar.

Por lo tanto **este spec no agrega nada al dominio**. La versión original de este documento le
asignaba `pathBetween`; se movió al 009 cuando la medición mostró que materializar los 144 caminos de
una matriz de 12×12 cuesta 0,0138 ms contra los 1,87 ms que el 009 ya paga por resolver el circuito.

**D6 — La cabeza salta, no se desliza.**
Nada de interpolar entre celdas. El instrumento está cuantizado a la grilla de intervalos, y un
movimiento continuo sugeriría una continuidad que no existe. Salta, como salta el sonido.

**D7 — Nota y click se ven distinto.** Una nota es la celda de una pieza y se ve fuerte; un click es
una celda vacía y se ve tenue. Si se vieran igual, el recorrido parecería tener piezas donde no hay.

## Criterios de Aceptación

- **AC1** — La cabeza se mueve en sincronía con lo que suena, y **no dispara ningún re-render de
  React**: el componente no tiene estado ni props que cambien durante la reproducción.
- **AC2** — `playheadOffset(t)` es una función pura, con test: dado un `origin`, un `intervalo` y un
  ciclo, devuelve el offset correcto, incluido el caso de `t` varios ciclos adelante (pestaña oculta).
- **AC3** — La posición está compensada por la latencia de salida (D4), con fallback verificado cuando
  el navegador no expone `outputLatency`.
- **AC4** — La cabeza dibuja **exactamente** las celdas que la secuencia trae: la capa de UI no
  contiene ningún cálculo de camino ni de distancia (D5).
- **AC5** — Una pieza colocada durante un ciclo se ve **pendiente** hasta que el ciclo se cierra, y en
  ese momento pasa a estado normal — sin re-render manual, en el mismo instante en que empieza a sonar.
- **AC6** — La lista de colocadas muestra el orden del circuito, y ese orden cambia cuando una pieza
  nueva reordena el recorrido.
- **AC7** — En pausa no se dibuja cabeza, y el loop no queda haciendo trabajo visible.
- **AC8** — `pnpm verify` en verde.

## Fuera de Alcance

- **Cambiar el modelo temporal.** Este spec no toca `collectHits`, ni la secuencia, ni el audio, y
  **no agrega nada al dominio**: el camino ya viene del 009 (D5).
- **Animar las notas de la pieza.** El resaltado es de celda, no una animación de envolvente.
- **Mostrar el nombre de la nota en la cabeza**, ni tooltips: la celda ya muestra su nota desde el 007.
- **Rediseñar el espectro.** `Spectrum.tsx` se toma como precedente, no como material.
- **Métricas o instrumentación de performance** más allá de confirmar AC1 a mano.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `outputLatency` no está en todos los navegadores, y si vale 0 la cabeza va adelantada. | Cadena de fallback declarada en D4, y se verifica a oído: con el tablero andando, la celda encendida tiene que coincidir con la nota que se escucha. Si no coincide, el offset es constante y se ve enseguida. |
| El camino "primero en X" puede verse arbitrario cuando la pieza siguiente está en diagonal. | Es una de 35 opciones igual de cortas y ninguna es más "correcta". Si al **verlo** molesta —que es cuando recién se puede juzgar—, el cambio es de una función pura del 009 con su test, y el dibujo lo sigue solo. |
| `requestAnimationFrame` a 60 Hz para algo que cambia 10 veces por segundo es trabajo de más. | Se compara la celda calculada con la anterior y solo se escribe el estilo cuando cambió: 60 lecturas por segundo, ~10 escrituras. La lectura es aritmética sobre tres números. |
| El estado "pendiente" (AC5) tiene que cambiar en el borde del ciclo, que lo conoce el motor y no React. | Lo dibuja el mismo loop imperativo que la cabeza, por el mismo camino: el motor ya sabe cuándo hizo el swap, y alcanza con exponerlo. |
| Dos piezas del circuito pueden quedar tan cerca que la cabeza "no se mueve" entre ellas. | Con salto 1 el recorrido es contiguo y no hay celda intermedia: es correcto que no se dibuje ningún click. Verificar a ojo que no se lea como un cuelgue. |

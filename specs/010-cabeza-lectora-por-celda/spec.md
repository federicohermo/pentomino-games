# Spec 010 — Cabeza lectora por celda

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **Depende del [009](../009-el-tablero-como-recorrido/spec.md)**: sin recorrido no hay nada que seguir.

## Problema

El repo tiene una limitación anotada desde el spec 004 y reescrita por el 009
(`docs/architecture/modelo-musical.md:73`, y otra vez en `.claude/rules/domain.md:49`): *"no hay
retroalimentación visual del recorrido. Una cabeza lectora recorriendo el tablero es lo que volvería
legible a este modelo; hoy se oye pero no se lee"*. Con el spec 009 esa limitación deja de ser incómoda
y pasa a ser **el problema principal**, por dos razones medidas:

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

Por lo tanto **este spec no calcula ningún camino**. La versión original de este documento le asignaba
`pathBetween`; se movió al 009 cuando la medición mostró que materializar los 144 caminos de una matriz
de 12×12 cuesta 0,0138 ms contra los 1,87 ms que el 009 ya paga por resolver el circuito.

Lo que **sí** le falta al dominio, y este documento afirmaba de más al decir que no le agrega nada: la
celda de cada **nota**. El 009 dejó la celda de cada *click* en `Click.cell`, pero `Step` solo lleva
`pieceId`, `offset` y `notes`, así que ir de la nota *j* a su celda es una derivación por grado que hoy
solo existe adentro de `gates()` para los grados 0 y 4. Va al dominio, no a la vista
(`.claude/rules/ui.md`), y no reabre D5: un mapeo grado→celda no es un camino ni una distancia.

**D6 — La cabeza salta, no se desliza.**
Nada de interpolar entre celdas. El instrumento está cuantizado a la grilla de intervalos, y un
movimiento continuo sugeriría una continuidad que no existe. Salta, como salta el sonido.

**D7 — Nota y click se ven distinto.** Una nota es la celda de una pieza y se ve fuerte; un click es
una celda vacía y se ve tenue. Si se vieran igual, el recorrido parecería tener piezas donde no hay.

**D8 — `cellsByPlayOrder` es la pura que falta, y `gates` pasa a leer de ella.**

```ts
/** Las celdas de la pieza en ORDEN DE REPRODUCCION: la celda donde suena la nota j. */
export function cellsByPlayOrder(p: PlacedPiece): Cell[]
```

Con el mismo criterio que `PlacedPiece.notes`: el retrógrado **ya viene aplicado**, así que
`cellsByPlayOrder(p)[j]` es la celda de `p.notes[j]` y el consumidor no vuelve a invertir nada. Es la
regla que `sequence.types.ts` ya declara para `Step.notes`, ahora sostenida por las dos puntas.

`gates` pasa a ser `{ entrada: orden[0], salida: orden.at(-1) }` en vez de buscar los grados 0 y 4 por
su cuenta. No es cosmética: hoy son **dos derivaciones del mismo hecho** y una de las dos está mal
(D9). Con una sola, no pueden discrepar — es el mismo argumento con el que el 009 hizo que la cantidad
de clicks se lea del largo del camino en vez de calcularse.

**D9 — Y al derivarla se cae un bug del 009: con la pieza reflejada, el circuito recorre la pieza al
revés que la melodía.**

El 009 eligió grado 0 = entrada y grado 4 = salida, y **nunca menciona la reflexión** —ni su `spec.md`
ni su `research.md`—; su test solo verifica que las dos puertas sean distintas
(`domain/__tests__/sequence.test.ts:160`). Pero el retrógrado invierte el orden de reproducción sin
mover qué nota le toca a qué celda, así que con `mirror` la primera nota que suena es la del grado
**4**. Medido con `describe_piece` y `simulate_board` sobre `L`/0/reflejada en `(1,1)`:

| | celda | grado | nota |
|---|---|---|---|
| `gates.entry` — por donde entra el circuito | `[1,3]` | 0 | D4 |
| Primera nota del timeline (`at: 0.05`) | `[0,0]` | 4 | **B4** |
| Última nota del timeline | `[1,3]` | 0 | D4 |
| `gates.exit` — por donde sale el circuito | `[0,0]` | 4 | B4 |

O sea que el hop anterior camina hasta `[1,2]` —pegado a la entrada— y lo primero que suena está en la
punta opuesta de la pieza. Entrada y salida están **exactamente invertidas** respecto de la melodía, en
toda pieza colocada con reflexión: la mitad del espacio de colocación. Es la misma incoherencia que el
009 sacó del caso de una pieza sola —«no se oye un recorrido sino dos golpes encima del arpegio»—,
sobrevivida en el caso que no miró.

Se arregla solo al hacer D8, porque las puertas pasan a leerse del orden de reproducción. **Va en su
propio commit y atribuido al 009**, no mezclado con el dibujo: cambia las distancias, y por lo tanto el
circuito y lo que suena. Es el mismo procedimiento con el que el 006 bajó `phaseFor` al dominio en un
commit aparte atribuido al 005 (`specs/log.md:54-59`).

Que este spec lo destape no es casualidad y conviene dejarlo escrito: **una cabeza lectora es un test
de coherencia entre lo que suena y lo que se ve**, y por eso encuentra cosas que ningún test de audio
podía encontrar. Es la lección del review del 007 —«un spec que cambia lo que una celda dice tiene que
revisar TODAS las celdas que dicen algo»— del lado del tiempo.

## Criterios de Aceptación

- **AC1** — La cabeza se mueve en sincronía con lo que suena, y **no dispara ningún re-render de
  React**: el componente no tiene estado ni props que cambien durante la reproducción.
- **AC2** — `playheadOffset(t)` es una función pura, con test: dado un `origin`, un `intervalo` y un
  ciclo, devuelve el offset correcto, incluido el caso de `t` varios ciclos adelante (pestaña oculta).
  Los tres estados degradados entran al test y ninguno puede devolver `NaN`: **ciclo 0** (tablero
  vacío — `x mod 0` es `NaN`, y es el caso que se alcanza con solo apretar play), **`t` anterior al
  `origin`** (la ventana de `CLOCK_START_DELAY` entre `startClock` y el primer onset, donde el módulo
  de un negativo en JS es negativo) y **una sola pieza** (`clicks: []`, `length: CELLS_PER_PIECE`, sin
  ningún salto que dibujar).
- **AC3** — La posición está compensada por la latencia de salida (D4), con fallback verificado cuando
  el navegador no expone `outputLatency`. **Sin `any` ni `@ts-ignore`**: `lib.dom.d.ts` declara
  `outputLatency` como `readonly outputLatency: number` —no opcional— aunque Firefox no lo implemente,
  así que la cadena de fallback tiene que expresarse sin mentirle al tipo ni desactivar la regla.
- **AC4** — La cabeza dibuja **exactamente** las celdas que la secuencia trae: la capa de UI no
  contiene ningún cálculo de camino ni de distancia (D5).
- **AC5** — Una pieza colocada durante un ciclo se ve **pendiente** hasta que el ciclo se cierra, y en
  ese momento pasa a estado normal, en el mismo instante en que empieza a sonar. **Este estado sí pasa
  por React** y es la excepción declarada a D1: cambia una vez por ciclo —7,5 s con 8 piezas a 110
  bpm—, no entre 4 y 11 veces por segundo, así que la medición que sostiene a D1 no lo cubre. `Board`
  lo recibe por props y lo pinta por el mismo camino declarativo que ya usa para el fantasma y el
  choque; el loop solo llama al setter **cuando `cycleGeneration()` cambió**. Falsable: un render del
  árbol por cierre de ciclo, cero durante el ciclo.
- **AC6** — La lista de colocadas muestra el orden del circuito, y ese orden cambia cuando una pieza
  nueva reordena el recorrido.
- **AC7** — En pausa no se dibuja cabeza: `playheadOffset()` devuelve `null` y el loop **no escribe
  ningún estilo** —sigue corriendo el `requestAnimationFrame`, igual que el de `Spectrum`, pero sin
  tocar el DOM. Falsable: contador de escrituras en la consola, que queda quieto con el transporte
  parado.
- **AC8** — `pnpm verify` en verde.
- **AC9** — La cabeza dibuja la secuencia que el motor está **sonando**, no la que está encolada.
  Verificable: con el ciclo andando, colocar una pieza y comprobar que durante la espera la cabeza
  sigue recorriendo el circuito viejo —el que se escucha— y salta al nuevo en el mismo instante que el
  sonido. Es la misma discrepancia dibujo/sonido que D5 previene, por el otro camino: el motor tiene
  `active` y `pending` (`audio/engine.ts:125-126`) pero la única secuencia **con celdas** es la del
  dominio, que la UI deriva de `placed` — o sea, siempre la pendiente.
- **AC10** — No-regresión sobre lo que este spec toca de paso: el fantasma de previsualización sigue
  mostrando nota y grado por celda (spec 007), "Quitar" y "Reset" siguen vaciando el tablero y la
  secuencia, y el `overflow-x-auto` del tablero sigue conteniendo el scroll horizontal debajo de `md`
  con la cabeza montada encima.
- **AC11** — `cellsByPlayOrder` tiene test sobre las **96 combinaciones** de pieza × rotación ×
  reflexión (el mismo barrido que ya usa `sequence.test.ts:136-160`): para toda pieza colocada,
  `cellsByPlayOrder(p)[j]` es la celda que muestra la nota `p.notes[j]` en el tablero — o sea que
  coincide con lo que `Board.tsx` pinta hoy por su cadena de cuatro puras. Es la propiedad que ata las
  dos puntas y la que hace que D9 no pueda volver.
- **AC12** — **El bug de D9 queda cerrado, con test:** con `mirror`, `gates(p).entrada` es la celda de
  la **primera** nota que suena y `salida` la de la última. Sobre las 96 combinaciones, y con el caso
  testigo medido escrito explícitamente (`L`/0/reflejada: entrada `[0,0]`, salida `[1,3]` — hoy da al
  revés). El test de hoy (`sequence.test.ts:160`) solo pide `entrada !== salida` y pasa con las dos
  invertidas: por eso hace falta uno nuevo, no basta con el que hay.
- **AC13** — El cambio de D9 va en **su propio commit**, atribuido al 009 y sin nada del dibujo. Es
  reversible solo: revertirlo devuelve el circuito viejo sin tocar la cabeza lectora.

## Fuera de Alcance

- **Cambiar el modelo temporal.** Este spec no toca `collectHits`, ni la forma de la secuencia, ni el
  audio, y **no calcula ningún recorrido**: el camino ya viene del 009 (D5).

  Con una excepción declarada y acotada: **D9 sí cambia lo que suena** en los tableros con piezas
  reflejadas, porque corrige de qué lado entra y sale el circuito y eso mueve las distancias. No es una
  regla nueva —es la regla del 009 aplicada al caso que no miró— y va en su propio commit (AC13). Todo
  tablero sin reflexión suena exactamente igual que hoy, y es lo que AC10 verifica.
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
| **D9 cambia lo que suena** en todo tablero con piezas reflejadas: las distancias cambian y con ellas el circuito. Alguien puede tener un tablero que "sonaba bien" y deja de sonar igual. | Es un arreglo, no un cambio de gusto: hoy la melodía recorre la pieza al revés que el circuito y eso no lo eligió nadie —el 009 no menciona la reflexión. Va en su propio commit (AC13), así que si al escucharlo el resultado no convence, revertirlo es una línea y no arrastra la cabeza lectora. Los tableros sin reflexión no se mueven. |
| El fix de D9 se hace en la rama del 010 y queda escondido adentro de un PR que dice "cabeza lectora". | AC13 lo aísla en su commit, el PR lo declara en el cuerpo, y la nota de revisión de `specs/log.md` lo registra atribuido al 009 — el mismo procedimiento con el que el 006 bajó `phaseFor` al dominio. Si el PR crece, es candidato a salir como PR propio y primero. |

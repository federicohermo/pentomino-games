# Spec 017 — El régimen de rotación

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.
>
> **Revisa el corazón del modelo musical**: la regla «la rotación elige la fórmula de escala», que está
> desde el principio y que `music.ts` declara como *la decisión de diseño del instrumento*. No la
> reemplaza — la vuelve **una de dos**.
>
> **Cambia lo que suena en 36 de las 48 combinaciones** de pieza × rotación, cuando el modo nuevo está
> activo. Va último del lote 013–017 porque es el único que toca `domain/` y cruza el borde de paquete.

## Problema

No es un problema, es una **pregunta sin forma de contestarla**: ¿el instrumento es mejor si la
rotación cambia las notas, o si cambia el orden?

Hoy la rotación hace **una sola cosa musical**: elige entre cuatro fórmulas —pentatónica mayor, menor,
menor con blue note, y mayor transpuesta `+7`—. O sea que rotar una pieza **cambia qué notas suena** y
no toca el orden; el orden lo mueve la reflexión, con el retrógrado.

Medido, eso produce **43 conjuntos de alturas distintos** sobre las 48 combinaciones, y **28 alturas
distintas** en todo el instrumento. Es mucha variedad, y la variedad tiene un costo: dos piezas
cualesquiera del tablero pueden no compartir ni una nota, así que lo que se escucha depende menos de
cómo se armó el circuito que de qué fórmulas cayeron.

La hipótesis contraria —que la rotación mueva el **orden** y deje el material quieto— no se puede
evaluar escuchando, porque no existe. Y no es una pregunta que se conteste en el papel.

## Solución Propuesta

**La rotación pasa a tener dos regímenes, y se elige cuál.**

| Régimen | Qué hace la rotación | Fórmula |
|---|---|---|
| **`escala`** (el de hoy) | Elige entre cuatro fórmulas | pentatónica mayor · menor · blues · mayor `+7` |
| **`orden`** | **Corre cíclicamente el arpegio** | pentatónica mayor, siempre |

En `orden`, la rotación `r` hace que el arpegio arranque por el grado `r`:

```
F, pentatónica mayor sobre C

rotación 0   C4 D4 E4 G4 A4        ← idéntico en los dos regímenes
rotación 1   D4 E4 G4 A4 C4
rotación 2   E4 G4 A4 C4 D4
rotación 3   G4 A4 C4 D4 E4
```

Y un interruptor de dos valores en la fila que modifica, para que se lea como una oración:

```
Rotación   [0°] [90°] [180°] [270°]
           cambia:  ( escala | orden )
```

### Decisiones de diseño

**D1 — Se corre el arpegio, no la puerta de entrada.**
Había dos formas de hacer que la rotación moviera el orden sin mover las notas: correr el **arpegio**
—que la nota `j` sea la `j+r`— o correr la **entrada** —que el camino que recorre la pieza arranque por
otra punta—. Al oído **son idénticas**: las dos producen la misma secuencia de alturas rotada. Lo que
las separa es qué celda se ilumina en cada momento, que es visual y no audible.

Gana correr el arpegio, porque la otra choca de frente con el spec 012: el camino lo elige Held-Karp y
la punta la decide el desempate angular, así que forzar el arranque cambiaría el camino entero y con él
las puertas del circuito — o sea que "cambiar el orden dentro de la pieza" terminaría reordenando el
tablero. Esta versión **no toca `transform.ts` ni el circuito**.

**D2 — La fórmula fija es la pentatónica mayor, y eso hace la comparación auditable.**
Es la fórmula de la rotación 0 en el régimen de hoy, así que **a 0° los dos regímenes suenan
idénticos**: medido, 12 de las 48 combinaciones no cambian, y son exactamente esas doce. Los dos modos
tienen un origen común y divergen a medida que se rota.

Con cualquier otra fórmula fija, los dos sistemas no se tocarían en ningún punto y comparar sería
comparar dos instrumentos.

**D3 — El régimen es global, no por pieza.**
Por pieza, dos piezas a 90° sonarían con reglas distintas y la rotación dejaría de significar algo: no
habría forma de saber, mirando el tablero, qué hace girar una pieza. Es una propiedad del instrumento,
como el tempo.

Consecuencia buscada: **cambiar el régimen re-deriva el tablero entero**. Las notas nunca se guardan
—`PlacedPiece` sacó su campo `notes` justamente por eso— así que las 12 piezas cambian de arpegio con
el interruptor. Entra en el ciclo siguiente, por D5 del spec 009.

**D4 — No es una dificultad, y el vocabulario importa.**
El pedido los llamó "dos dificultades". `CLAUDE.md` dice lo contrario en su primera sección: *«al
evaluar una feature, la pregunta es si vuelve al instrumento más expresivo, no más difícil»*. No hay
puntaje ni condición de victoria, así que no hay nada respecto de lo cual algo sea más difícil.

Son dos **regímenes**, y el control dice qué cambia la rotación. Además es lo que hace que el
interruptor se entienda sin leer nada: está en la fila de `Rotación` y completa su frase.

**D5 — Medido: en `orden` NINGUNA celda conserva su nota al rotar, y en `escala` 36 de 180 sí.**
Es el hallazgo que da vuelta la intuición. El régimen "más simple" —una sola fórmula, 12 conjuntos en
vez de 43— es el que **mueve más cosas** cuando se rota:

| | celdas que conservan su nota al rotar (sobre 180) |
|---|---|
| `escala` | **36** |
| `orden` | **0** |

Y las dos cifras están explicadas, no son casualidad:

- En `escala`, las fórmulas comparten grados. `MAJOR` y `MINOR` coinciden en los grados 0 y 3 (24
  celdas), `MAJOR` y `BLUES5` sólo en el 0 (12), y la rotación 3 transpone todo `+7` y no conserva
  ninguna. **24 + 12 + 0 = 36.** En particular, **el grado 0 conserva la tónica en las rotaciones 1 y
  2**: la pieza sigue anclada a su nota.
- En `orden` el cero está **garantizado**, no medido de casualidad: un corrimiento cíclico de `k ≠ 0`
  sobre 5 elementos no tiene ningún punto fijo, porque **5 es primo**. Con una escala de 6 notas esto
  no valdría.

O sea que el régimen `orden` le saca a la pieza su ancla: la tónica sigue estando en el conjunto, pero
deja de ser la primera nota. Es una consecuencia real del pedido y no un efecto secundario a corregir —
pero tiene que estar escrita, porque es justo lo que se va a escuchar.

**D6 — Medido y no previsto: en `orden` el arpegio deja de ser monótono ascendente, y el registro se
angosta siete semitonos.**
Los cuatro arpegios de `escala` suben siempre, con pasos de **1, 2 o 3** semitonos —el 1 lo aporta
`PENT_BLUES5`, que es `[0,3,5,6,7]` y tiene dos—. Correr el arpegio cíclicamente mete **exactamente un
salto grande, y siempre el mismo**: la nota de arriba vuelve abajo, **9 semitonos exactos** en las 36
combinaciones que se mueven. No es «hasta 9»: el techo de `PENT_MAJOR` está a 9 de la tónica, así que
el descenso es siempre esa distancia.

| | salto máximo dentro del arpegio (promedio / máx) | registro del instrumento |
|---|---|---|
| `escala` | 3,0 / **3** semitonos | `C4` – `D#6` |
| `orden` | 7,5 / **9** semitonos | `C4` – **`G#5`** |

Las dos mitades son consecuencias directas: el salto sale del corrimiento, y el registro se angosta
porque la fórmula fija no tiene la transposición `+7` que en `escala` empuja a las piezas de tónica alta
casi una octava más arriba.

Hay una variante que las evita —reajustar la octava de las notas que dan la vuelta, para que el arpegio
siga subiendo: `D4 E4 G4 A4 C5` en vez de `D4 E4 G4 A4 C4`— y **se descarta en esta versión** porque
cambia las notas: son las mismas clases de altura pero no los mismos MIDI, y el pedido dice *sin cambio
de las notas*. Queda anotada como la primera cosa a probar si el salto molesta: es un `+12` condicional
en una línea.

**D7 — El régimen viaja como parámetro, no como global.**
`notesForRotation` y `arpeggioFor` reciben el régimen; `buildSequence` también, y lo pasa. El repo no
tiene estado global —ni Context, ni Redux, ni un singleton de módulo para esto— y el régimen es estado
de `App.tsx` como el tempo.

Cuesta firmas: `arpeggioFor` y `notesForRotation` las consume el MCP server, así que `describe_piece` y
`simulate_board` pasan a aceptar el régimen. Es el borde de paquete que `pnpm verify` typechequea, y es
la razón por la que este spec va último.

**D8 — El régimen es un const-object con union type derivado, nunca un `enum`.**
Conjunto cerrado de dos valores. `erasableSyntaxOnly` rechaza `enum`, y es la misma opción que permite
que node cargue `src/domain/` sin compilar — que es de lo que viven el MCP server y las mediciones de
este research.

## Criterios de Aceptación

- **AC1** — Existe el tipo `RegimenDeRotacion` con dos valores, como const-object + union type derivado
  en `domain/`, **sin `enum`** (D8).
- **AC2** — En `escala` **nada cambia**: las 48 combinaciones dan exactamente lo que dan hoy. Con test
  de no-regresión sobre la referencia congelada que ya existe.
- **AC3** — En `orden`, la rotación `r` produce el arpegio corrido `r` posiciones sobre la pentatónica
  mayor de la tónica de la pieza. Con test sobre las 48.
- **AC4** — **A rotación 0 los dos regímenes son idénticos** (D2), con test sobre las 12 piezas — es la
  propiedad que hace auditable la comparación.
- **AC5** — **Medido y con test: en `orden`, ninguna celda conserva su nota al rotar** (D5). El test
  afirma el 0 sobre las 180 combinaciones y lleva escrito **por qué** está garantizado (5 es primo), no
  sólo que se cumple.
- **AC6** — En `escala`, las 36 celdas que conservan su nota siguen siendo 36, con la descomposición
  24 / 12 / 0 por rotación (D5). Es un test de caracterización del régimen viejo, que hoy no existe.
- **AC7** — Cambiar el régimen **re-deriva el tablero entero** (D3) y entra en el ciclo siguiente, sin
  cortar el que está sonando — D5 del spec 009.
- **AC8** — El régimen viaja como parámetro (D7). **Ninguna función del dominio lee un global**, y el
  linter de dirección de dependencia sigue en verde.
- **AC9** — El MCP server acepta el régimen en `describe_piece` y `simulate_board`, y lo **reporta** en
  la respuesta: una tool que contesta un arpegio sin decir bajo qué régimen es una tool que miente la
  mitad de las veces. Incluye **`SCALE_LABEL`** (`mcp-server/src/tools/describePiece.ts:31-36`), un
  array hardcodeado indexado por rotación que bajo `orden` es falso en sus cuatro entradas: la fórmula
  es siempre la pentatónica mayor y lo que la rotación mueve es el arranque. Su propio docblock lo
  declara «uno de los DOS supuestos del server sobre el dominio que pueden quedar desincronizados
  **sin que `tsc` diga nada**», así que ningún gate lo atrapa. Reportar el régimen y seguir diciendo
  «pentatónica menor (rotación 90°)» es peor que no reportarlo.
- **AC10** — El control está en la fila de `Rotación` y se lee como una oración (D4), con la etiqueta
  midiendo contra el ancho de la tarjeta que dejó el 016.
- **AC11** — El default es **`escala`**: abrir la app suena como hoy.
- **AC12** — `pnpm verify` en verde y `check_invariants` en proceso fresco. `checkNotes` recorre 48
  combinaciones y pasa a recorrer 96 —las 48 de cada régimen—, **con el chequeo de orden partido por
  régimen**: hoy exige que cada nota supere a la anterior (`invariants.ts:220-224`), y eso es una
  propiedad de `escala`, no del modelo. Medido: en `orden` **36 de 48** combinaciones no son
  ascendentes estrictas, así que extenderlo tal cual pone la tool en rojo — y esta misma AC la pide en
  verde. En `orden` el chequeo equivalente, y más fuerte, es **«es una permutación cíclica del arpegio
  de rotación 0»**: cubre lo mismo que cubría el ascendente —ninguna celda sin nota, ninguna repetida—
  y además ata el corrimiento. Lo que vale en los dos regímenes —`length === NOTES_PER_PIECE` y sin
  repetidas— se queda compartido.
- **AC13** — `[M]` **A oído, y es el punto del spec**: el mismo tablero en los dos regímenes,
  alternando en vivo. La pregunta no es cuál suena mejor sino **si los dos merecen quedarse**.
- **AC14** — La documentación deja de afirmar una sola regla. Son **seis** lugares, verificados uno
  por uno:
  - `docs/architecture/modelo-musical.md:14` — la fila «Rotación | La fórmula de escala».
  - `docs/architecture/modelo-musical.md:169` — «rotar elige *qué* notas, reflejar elige *en qué
    orden*», que en `orden` es al revés.
  - `docs/architecture/modelo-musical.md:252` — «la rotación cambia qué notas, la forma cambia dónde».
  - `docs/README.md:11` — «rotación → escala», en el índice.
  - `CLAUDE.md:152` — la fila del modelo musical en la tabla de documentación.
  - `.claude/rules/domain.md:36` — «Rotación | La fórmula de escala (mayor → menor → blues → mayor +7)».

  Y en `src/domain/music.ts`, **los dos docblocks**: la frase «que la rotación elija la fórmula es la
  decisión de diseño del instrumento» está en el docblock **de módulo** (`music.ts:9-14`), no en el de
  `notesForRotation` (`music.ts:22-31`, que es el que lista «0° → pentatónica mayor · 90° → menor …» y
  la nota del `octShift`). Tocar uno solo deja el otro afirmándolo. Hay precedente de barridas así:
  `d936597`, once archivos, y `eb154a0`, cinco.

- **AC15** — **Las tres cachés de derivación llevan el régimen**, o AC7 queda verde en el audio y
  falso en la pantalla. Son el `Map` de módulo de `cell-text.ts` (`cell-text.ts:9`, clave hoy
  `${piece}${rotation}${mirror}`) y los dos `useMemo` de `App.tsx` (`:74` `buildSequence`, `:81`
  `arpeggioFor`). El `Map` **no lo mira ningún linter** y sobrevive al render: sin el régimen en la
  clave, cambiarlo deja las celdas mostrando las notas del régimen anterior para siempre. Las dep
  arrays sí las ve `react-hooks/exhaustive-deps`, pero `recommended-latest` la reporta como
  **warning** y `pnpm lint` corre sin `--max-warnings 0`, así que tampoco frena el gate. Es la misma
  razón por la que la reflexión ya está en esa clave, escrita en el docblock de `cellTextFor`.
- **AC16** — **La nota de una celda cruzada sale del mismo régimen que la pieza que la ocupa.**
  `noteAtCell` (`domain/sequence.ts:115`) es la **tercera** firma pública del dominio que cambia —no
  dos—, y de ella salen el `Click.note` de `clickEn` (`sequence.ts:131`) y el `crossed` que reporta
  `simulate_board`. Su docblock existe justamente para prevenir esto: «si las dos se corrieran, la
  celda diría una altura y pisarla sonaría otra».

## Fuera de Alcance

- **La reflexión.** Sigue siendo el retrógrado en los dos regímenes.
- **El camino dentro de la pieza y las puertas del circuito.** Intactos (D1): este spec no toca
  `transform.ts` ni `sequence.ts` más allá de pasar un parámetro.
- **Qué tónica tiene cada pieza.** `BASE_MAP` no se toca.
- **Un tercer régimen.** Dos, para poder comparar.
- **Elegir la fórmula fija del régimen `orden`.** Es la pentatónica mayor por D2 y no es configurable.
- **El reajuste de octava** que evitaría el salto de D6. Anotado, no implementado.
- **Decidir cuál de los dos se queda.** El spec existe para poder contestarlo escuchando; sacar uno es
  trabajo posterior y de una línea.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Dos regímenes es una bifurcación en el corazón del modelo**, y todo lo que derive de un arpegio pasa a tener dos respuestas. | Es explícitamente temporal: existe para contestar una pregunta y el Fuera de Alcance dice que sacar uno es trabajo posterior. El parámetro (D7) hace que retirarlo sea borrar una rama, no desenredarla. |
| **El régimen `orden` mete un salto de hasta 9 semitonos donde antes había 3** (D6). No estaba previsto: salió midiendo. | Está escrito con su número y con la variante que lo evita, a una línea de distancia. Y es justo lo que AC13 va a escuchar. |
| El registro se angosta 7 semitonos en `orden` (D6). | Consecuencia directa de sacar la transposición `+7`. Declarada; si molesta, la fórmula fija es lo único que habría que revisar — pero eso rompe D2. |
| Cambiar firmas del dominio rompe el MCP server. | Es deseable y está previsto: `pnpm verify` typechequea cruzando el borde. AC9 obliga además a que las tools **reporten** el régimen, no sólo que compilen. |
| `checkNotes` de `invariants.ts` recorre 48 combinaciones y quedaría cubriendo la mitad del espacio. **Y su chequeo de ascendente estricto es propio de `escala`**: extenderlo tal cual pone en rojo 36 de las 48 de `orden`. | AC12, que parte el chequeo por régimen en vez de extenderlo entero. Un invariante que mira medio modelo es peor que no tenerlo; uno que falla por diseño es peor todavía, porque se termina apagando. |
| El interruptor es un control más en una tarjeta que el 016 ya llenó de miniaturas. | AC10 lo mide contra el ancho que el 016 dejó, y va en la fila de `Rotación` — no agrega una fila, completa una. |
| Alguien lee «dificultad» en algún lado y el instrumento empieza a tener niveles. | D4, y la palabra no aparece en ningún archivo de este spec salvo para descartarla. |

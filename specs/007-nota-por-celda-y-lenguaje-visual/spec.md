# Spec 007 — Nota por celda y lenguaje visual

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.

> **Absorbe al [spec 001](../001-notas-por-celda-en-orden-angular/spec.md)**, que está `Propuesto` desde
> el 2026-08-02 y nunca se implementó. Lo que el 001 decidió sobre el mapeo se conserva casi entero; lo
> que cambia está marcado como **D2′**. El 001 pasa a `Descartado` en `log.md`, con este spec como motivo.

## Problema

Hoy la forma de una pieza **no influye en cómo suena ni en qué se ve**. `PlacedPiece` guarda `cells` y
`notes` como dos arrays paralelos que nunca se cruzan, y el tablero pinta las cinco celdas de una pieza
colocada con la **letra de la pieza repetida cinco veces** sobre el mismo `bg-slate-900`. Un `I` y un
`X` con la misma tónica son indistinguibles al oído y casi indistinguibles a la vista.

Eso ya era el problema del spec 001. Lo que lo vuelve urgente ahora es que **los tres specs que siguen
lo necesitan como cimiento**:

- El **008** (intervalo derivado del BPM) es independiente, pero comparte el mismo tablero.
- El **009** (el tablero como recorrido) necesita que cada pieza tenga una **celda de entrada** y una
  **celda de salida** identificables, porque el silencio entre dos piezas es la distancia entre la
  salida de una y la entrada de la siguiente. Sin mapeo celda→grado no hay de dónde sacar esas dos
  celdas.
- El **010** (cabeza lectora) resalta **qué celda** está sonando. Sin nota por celda no hay nada que
  resaltar.

Existe además una **referencia visual ya validada** —las 12 piezas coloreadas, con la nota impresa en
cada celda y el grado en chico— que hasta ahora no está en ningún lado del repo. Este spec la convierte
en código y en documento.

## Solución Propuesta

1. **Cada celda de una pieza es dueña de un grado de la escala.** El orden angular alrededor del
   centroide lo define: la celda con menor ángulo recibe el grado 0, y así hasta el 4. La celda que cae
   exactamente en el centroide sale del anillo y recibe el grado 0 (la tónica).
2. **El desempate de ángulo se fija de forma explícita, por índice del array** (D2′). Medido: es lo que
   reproduce la referencia visual en las 12 piezas; el desempate por radio del spec 001 difiere en dos.
3. **El tablero pasa a hablar el lenguaje de la referencia:** cada pieza tiene su color, y cada celda
   ocupada muestra **su** nota en vez de la letra repetida.
4. **La celda crece de 28 px a 44 px**, que es lo que hace falta para que entre `D#5` legible.
5. **`DESIGN.md` en la raíz** recoge las claves visuales: los 12 colores, la regla de contraste, qué se
   ve en una celda y qué no.
6. **`describe_piece` reporta el mapeo**, para que el grado de una celda se pueda consultar sin leer el
   código ni abrir la app.

**El audio no cambia en este spec.** Ni qué notas suenan, ni en qué orden, ni cuándo. Cambia de dónde
sale el orden —de una decisión explícita en vez del orden en que alguien tipeó las coordenadas— y qué
se ve. Es deliberado: si el 009 después no suena bien, este spec no se arrastra al revertirlo.

### Decisiones de diseño

**D1 — La celda en el centroide no tiene ángulo; se le da la tónica.** *(heredada del spec 001, y
verificada)*
`I` y `X` tienen una celda exactamente en el centroide, donde `Math.atan2(0, 0)` devuelve `0` **en
silencio** y la mete en el anillo como si estuviera al este. Se la excluye del ordenamiento y se le
asigna el grado 0. Las otras cuatro se reparten los grados 1–4 por ángulo. Musicalmente es lo natural
—el centro de la figura es su raíz— y coincide con la referencia visual, donde el centro de `I` es C#4
y el de `X` es A4, o sea la tónica de cada una.

**D2′ — Los empates de ángulo se desempatan por índice del array, escrito a mano.** *(revisa el D2 del
spec 001)*
El spec 001 iba a desempatar por **radio ascendente**, para no depender de que `Array.prototype.sort`
sea estable. La medición dice que ese cambio **no es neutral**: con desempate por radio, `F` e `I`
salen distintas de la referencia (ver `research.md` §2). Se conserva el orden por índice —que es el que
produce la referencia— pero **escrito como tercer criterio del comparador**, no delegado a la
estabilidad del `sort`. El argumento del 001 era contra el accidente, no contra el resultado; fijarlo
explícitamente lo deja de ser accidente sin cambiar lo que ya se validó.

**D3 — El mapeo se calcula sobre la forma canónica y viaja por índice.** *(heredada del spec 001)*
La rotación **no** reordena qué celda recibe qué grado: el mapeo se calcula una vez sobre
`SHAPES[pieza]` sin transformar y se arrastra por índice, apoyado en el invariante de orden del array
que `checkArrayOrder()` ya verifica sobre las 96 orientaciones. El motivo es de legibilidad: la
rotación **ya** cambia la escala. Si además reordenara el mapeo espacial, dos cosas ortogonales
cambiarían a la vez. Queda: **la rotación cambia qué notas, la forma cambia dónde.**

**D4 — El orden de reproducción no cambia.** Las cinco notas siguen sonando en el orden de grado
(0→4), y la reflexión lo sigue invirtiendo (retrógrado). El mapeo decide **qué celda tiene qué nota**,
no cuándo suena cada una. Que la posición de la pieza en el tablero influya en el tiempo es el spec 009.

**D5 — Los 12 colores salen medidos de la referencia, no elegidos de nuevo.** Se muestrearon del PNG
(ver `research.md` §1). El color de texto de cada pieza no se elige a ojo: es el que da mejor contraste
entre negro y blanco, y un test lo verifica contra el umbral AA de WCAG (4.5:1). Las 12 pasan; solo `W`
(`#0000FF`) necesita texto blanco.

**D6 — Los colores viven en `components/constants/`, no en el dominio.** Un color no cambia lo que
suena: es lenguaje visual. El dominio no debe saber que `V` es amarilla, igual que no sabe que el
tablero se dibuja con `div`s.

**D7 — El color de pieza va donde ya se comunicaba identidad, y nunca sobre el canal de estado.**
La primera redacción de esta regla decía «donde ya mostraban la letra», y medida contra el código no
decide nada en dos de los tres componentes: `PiecePreview` **no muestra la letra en ningún lado** —sus
celdas son `bg-slate-800` con el punto del ancla (`PiecePreview.tsx:33`)— y en `PiecePalette` la letra
vive en un botón cuyo estado seleccionado ya es `bg-slate-900 text-white` (`PiecePalette.tsx:41`), o
sea que pintarle el fondo le roba el canal a la señal de estado. Enunciada por identidad-vs-estado, la
regla decide sola los cuatro casos, y es la misma que ya gobierna el tablero (el fantasma, el choque y
el hover ganan sobre el color de pieza):

| Dónde | Qué pasa | Por qué |
|---|---|---|
| `Board` | celda ocupada = color de pieza; fantasma, choque y hover siguen ganando | identidad debajo, estado encima |
| `PiecePreview` | las celdas pasan de `bg-slate-800` al color de pieza; el punto del ancla queda | es el mismo objeto que el tablero, más chico: que hable el mismo idioma es el spec, aunque nunca haya habido letra |
| `PiecePalette` | **el fondo del botón no se toca**; el color va como punto o barra al costado | el fondo del botón ya es el canal de "seleccionado" |
| `PlacedList` | la letra (`PlacedList.tsx:25`) toma el color de pieza | texto plano sobre `bg-slate-50`: no hay estado que pisar |

## Criterios de Aceptación

- **AC1** — `degreeByCellIndex(shape)` devuelve, para cada una de las 12 piezas, una permutación de
  `[0,1,2,3,4]`: cada celda tiene exactamente un grado y cada grado una celda.
- **AC2** — Para `I` y `X`, la celda que coincide con el centroide recibe el grado `0` (D1).
- **AC3** — El mapeo **se arrastra por índice y no se recalcula**: para las 12 piezas × 4 rotaciones ×
  2 reflexiones, la celda del índice `k` de la forma transformada es la misma celda lógica que la del
  índice `k` de la canónica, así que el grado canónico le sigue correspondiendo (D3). Lo que el AC
  **no** dice —y que leído al revés manda a escribir un test que falla— es que `degreeByCellIndex`
  sobre la forma **transformada** devuelva el mapeo canónico: **no lo devuelve**, y difiere en **75 de
  las 96** orientaciones, porque rotar corre el origen del ángulo. El test verifica lo primero: que el
  consumidor llame a `degreeByCellIndex(SHAPES[pieza])` y nunca sobre una forma ya transformada.
- **AC4** — **El desempate por índice se ejerce y se ve.** En las 3 piezas donde hay empate de ángulo
  —`F` (1 empate), `I` (2), `T` (1); las otras 9 tienen 0, medido— las celdas empatadas reciben grados
  consecutivos en **orden de índice creciente**. El test las nombra por índice, así que cambiar el
  desempate a radio lo pone en rojo.
  Es la formulación observable de «el comparador produce un orden total estricto» (D2′): el comparador
  vive adentro de `degreeByCellIndex` y no se exporta, así que un AC escrito sobre él no sería
  testeable sin agregar superficie pública solo para el test. El desempate por índice es inyectivo por
  construcción —dos celdas distintas nunca comparten índice—, de modo que lo que hay que verificar no
  es que exista un orden total sino que **el tercer criterio se aplique**, que es lo que un refactor
  puede romper.
- **AC5 — La referencia visual queda fijada como test.** Las 12 piezas producen exactamente el mapeo
  nota↔celda de la referencia, con las notas escritas a mano en el test. Es el AC que impide que un
  refactor del comparador cambie el instrumento sin que nadie lo note.
- **AC6 — *(firma humana: se verifica con captura, no es material de loop)*** Cada celda ocupada del
  tablero muestra el nombre de **su** nota (`C4`, `D#5`, …) y el fondo del color de su pieza, en vez de
  la letra de la pieza sobre `bg-slate-900`.
- **AC7** — Los 12 colores alcanzan contraste **≥ 4.5:1** con su color de texto declarado, verificado
  en un test que recalcula el contraste desde el color de fondo (D5).
- **AC8 — El audio no cambia.** `simulate_board` sobre un tablero cualquiera devuelve **la misma
  línea de tiempo** antes y después de este spec: mismos onsets, mismos instantes, mismo
  `maxPerInstant`.
- **AC9** — `describe_piece` incluye, por celda, su grado y su nota.
- **AC10** — `DESIGN.md` existe en la raíz y `CLAUDE.md` lo enlaza.
- **AC11** — `pnpm verify` en verde.
- **AC12 — La reflexión no cambia qué nota muestra una celda.** Por D4 el retrógrado es del **orden de
  reproducción**, no del mapeo: la celda de grado `g` muestra siempre la nota `g` del arpegio
  **ascendente** (`notesForRotation(...)[g]`), con reflexión o sin ella. Hace falta como AC porque las
  dos lecturas posibles **suenan igual** —AC8 no las distingue— y pintan tableros distintos, y porque
  es la que decide en qué sentido recorre la cabeza lectora del spec 010. Ojo con la fuente de datos:
  `PlacedPiece.notes` (`App.tsx:64`) y el campo `notes` de `describe_piece` (`describePiece.ts:69`)
  vienen **ya invertidos**, así que indexar cualquiera de los dos con el grado implementa la lectura
  contraria sin que nada falle.
- **AC13 — No-regresión de los tres componentes que solo heredan color.** `PiecePalette`,
  `PiecePreview` y `PlacedList` no cambian de layout, de tamaño ni de contenido: `PREVIEW_CELL_PX`
  sigue en 20, y las listas de notas de los tres siguen mostrando las mismas cinco notas en el mismo
  orden que antes del spec.
- **AC14 — La derivación celda→nota es pura y está testeada; `Board` no la calcula.** El camino
  completo —de `(x, y)` al nombre de nota— se compone de funciones de `domain/`
  (`occupantCellIndex` · `degreeByCellIndex` · `notesForRotation` · `midiName`), cada una con test en
  `environment: 'node'`. `Board.tsx` las encadena y no implementa ningún paso.
  Existe porque AC6 es de firma humana: sin este AC, la única lógica de la que depende lo que se ve
  queda dentro de un componente que el repo verifica a ojo (`log.md:84`, deuda «no hay tests de UI»),
  y una captura no distingue un mapeo correcto de uno corrido en uno.

## Fuera de Alcance

- **Todo lo temporal.** Cuándo suena cada pieza, el recorrido entre piezas, la costura del tablero, el
  intervalo derivado del BPM y el click de las celdas recorridas son los specs 008 y 009.
- **La cabeza lectora.** Resaltar la celda que suena es el spec 010; este spec solo hace que haya algo
  que resaltar.
- **Retirar `PlacedPiece.notes`.** Queda redundante cuando las notas vivan por celda, pero sacarlo toca
  el panel lateral y el efecto de reconciliación de jobs. Va en su propio commit, después del 009.
- **Colocación envolvente.** Que una pieza pueda cruzar el borde del tablero es un spec propio; hoy
  `isValid` la rechaza y sigue igual.
- **Rediseño del resto de la UI.** Cambia la celda del tablero y su tamaño. El panel lateral, la
  paleta, la lista de colocadas y el espectro solo heredan el color de pieza **donde ya comunicaban
  identidad de pieza, y nunca sobre el canal de estado** (D7).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `D#5` (3 caracteres + octava) no entra legible ni en 44 px. | Medido para 44 px con `text-[11px]`; si al implementarlo no entra, el fallback es el nombre **sin octava** (`D#`) — la octava es la misma para las cinco celdas salvo salto de rango, así que no es lo que distingue una celda de otra. Decisión al implementar, con captura. |
| El tablero de 440 px rompe el layout en pantallas chicas. | El tablero vive en un `md:col-span-6` dentro de un `max-w-6xl`: 440 px entran con margen. Abajo del breakpoint `md` ya ocupa las 12 columnas. Verificar con captura a 375 px. |
| Duplicar el color de texto junto al de fondo crea dos valores que tienen que coincidir. | Es exactamente el patrón que el spec 005 denunció ("cuatro pares de números que tienen que coincidir y nada sincroniza"). Acá lo sincroniza AC7: el test recalcula el contraste desde el fondo y falla si el texto declarado no es el mejor de los dos. |
| El mapeo por índice queda como decisión arbitraria y alguien lo "arregla" a radio más adelante. | D2′ lo documenta con la medición que lo respalda, y AC5 lo congela: cambiar el desempate pone dos piezas en rojo con el nombre de nota esperado en el mensaje. |

# Tareas — Cabeza lectora por celda

## Backlog
- [x] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [x] Fila del 010 en `specs/log.md` (`Propuesto`)
- [x] Verificar que el **009 esté mergeado**: sin recorrido no hay nada que seguir. Ya lo está
      (`afef917`, PR #8), pero **`specs/log.md:20` sigue diciendo `Propuesto`** — corregirlo a
      `Implementado`, es el paso 5 del flujo de `specs/README.md` que quedó sin hacer
- [x] **Crear rama** `feature/010-cabeza-lectora-por-celda`

## Lo que viene del 009 (verificar, no escribir)
- [x] `sequence.clicks[i].cell` existe y trae la celda que cruza el recorrido — `sequence.types.ts:45`
- [x] `sequence.steps[i]` trae pieza, offset en intervalos y notas en orden de grado —
      `sequence.types.ts:29`
- [x] `sequence.length` es el largo del ciclo en intervalos — `sequence.types.ts:62`
- [x] **NO viene del 009: la celda de cada NOTA.** `Step` no lleva celdas, y el mapeo grado→celda solo
      existe adentro de `gates()` para los grados 0 y 4 (`domain/sequence.ts:45-51`) → resuelto por el
      paso 0 del plan (`cellsByPlayOrder`, D8)
- [x] Al derivarla se cayó un bug del 009: con `mirror`, entrada y salida están invertidas respecto de
      la melodía (D9, `research.md` §4bis, medido sobre `L`/0/reflejada)

## Paso 0 — El dominio, antes de tocar el dibujo
- [x] `cellsByPlayOrder(p)` en `domain/sequence.ts`, con el retrógrado ya aplicado (D8)
- [x] Test AC11: sobre las 96 combinaciones, `cellsByPlayOrder(p)[j]` es la celda de `p.notes[j]`
- [x] **Commit propio.** Solo la pura y su test: todavía no cambia nada de lo que suena
- [x] `gates` pasa a leer de `cellsByPlayOrder` — `{ entrada: orden[0], salida: orden.at(-1) }` (D9)
- [x] Test AC12: con `mirror`, `entrada` es la celda de la primera nota. Caso testigo `L`/0/reflejada:
      entrada `[0,0]`, salida `[1,3]` (hoy da al revés)
- [x] `check_invariants` antes y después (lo obliga `.claude/rules/domain.md` al tocar esta capa)
- [x] `simulate_board` sobre el caso testigo: ver el circuito darse vuelta
- [x] **Commit propio y atribuido al 009** (AC13). Es el único que cambia lo que suena
- [x] Verificar los dos consumidores de `gates`: `buildSequence` (matriz de costos) y `simulate_board`
      (lo reporta por pieza). Ninguno cambia, pero sus salidas sí

## El motor
- [x] La aritmética del offset como **pura testeable** en `audio/playhead.ts`, separada de la lectura
      del singleton (precedente: `spectrum.ts`)
- [x] Test AC2 en `src/audio/__tests__/playhead.test.ts` — offset dentro del primer ciclo, en el borde,
      y varios ciclos adelante
- [x] Test AC2, degradados: **ciclo 0** (`x mod 0` es `NaN`), **`t` anterior al `origin`** (el módulo de
      un negativo en JS es negativo) y **una sola pieza**. Ninguno puede devolver `NaN`
- [x] `playheadOffset()` en `engine.ts`, con `null` en pausa / sin contexto / secuencia vacía
- [x] Cadena de latencia: `outputLatency` → `baseLatency` → 0 (D4). Sin `any` ni `@ts-ignore`:
      `lib.dom.d.ts` declara `outputLatency` como `number` no opcional y Firefox no lo implementa
- [x] `cycleGeneration()`: contador de swaps de ciclo
- [x] **AC9** — `components/route-source.ts`: el par activa/pendiente del dominio, fuera de React, con
      el swap atado a `cycleGeneration()`. Sin esto la cabeza dibuja el circuito encolado mientras
      suena el viejo
- [x] `App.tsx`: el efecto de reconciliación encola en las **dos** colas —`setSequence` y `encolar`—,
      desde el mismo lugar y con la misma `buildSequence`
- [x] Verificar el primer arranque: `cycleGeneration()` tiene que subir también en el swap inicial, o
      la cabeza no aparece en el primer ciclo y sí en los siguientes

## El dibujo
- [x] `components/Playhead.tsx`: sin props, efecto con `[]`, `requestAnimationFrame`, limpieza
- [x] `Board` importa `Playhead` y lo monta en su `relative overflow-x-auto` (`Board.tsx:127`). **No**
      se devuelve la ranura de `children` que el review del 007 retiró
- [x] Traducir offset → celda desde `rutaActiva()`, sin llamar a `occupantAt`: `Click.cell` para el
      click, `cellsByPlayOrder` para la nota, con `offset − step.offset` como índice dentro del paso
- [x] Escribir el estilo **solo cuando la celda cambió**
- [x] Posición con estilo inline desde `CELL_PX` (una clase interpolada de Tailwind no se generaría)
- [x] Nota fuerte, click tenue (D7)
- [x] ~~La pieza pendiente se ve atenuada hasta el swap de ciclo (AC5), **por React**: el loop llama a
      `setPendingIds` solo cuando `cycleGeneration()` cambió, y `Board` los recibe por props~~ — **no se
      hizo así, y el plan estaba mal.** La excepción declarada a D1 valía mientras el destape fuera en
      bloque al cerrar el ciclo (una vez cada 7,5 s); dejó de valer cuando el estreno pasó a ser **celda
      por celda**, que son cinco cambios al ritmo del intervalo, o sea exactamente la frecuencia que D1
      mide y prohíbe. El velo son nodos que `Playhead.tsx` crea y destruye a mano, y no queda nada del
      010 en el árbol de React
- [x] El estreno celda por celda: una celda se destapa cuando la cabeza la **pisa**, no cuando arranca
      el ciclo. Necesita que `playheadOffset()` devuelva `null` mientras `now < origin` — el swap se
      decide dentro del lookahead y ahí la cola del ciclo nuevo destapaba las cinco de un saque
      (`scheduler.test.ts`, «el swap deja `origin` en el FUTURO»)

## La lista
- [x] `PlacedList` muestra el orden del circuito, tomado de la misma `buildSequence` que ya calcula `App`
- [x] Decidir **cuál** circuito muestra la lista: el **pendiente**, que es el que incluye a la pieza
      recién colocada. La cabeza muestra el que suena (AC9) y la lista el encolado, así que durante la
      espera dicen cosas distintas — a propósito: la lista es el inventario de `placed`, no una vista de
      reproducción, y numerar sin la pieza que el usuario acaba de poner sería peor. Queda escrito en el
      docblock de `PlacedList.tsx` para que sea una decisión y no un accidente

## Fuera del spec, en este PR
- [x] **Reset frena el transporte** además de vaciar el tablero (`App.tsx`). No lo pide ningún AC y no
      es del 010: vaciar solo `placed` deja al motor terminando su ciclo activo —D5 del 009— o sea
      hasta 7,5 s sonando sobre un tablero vacío. Reset es una orden de volver a cero, no una edición
      del tablero. Va declarado acá y en el cuerpo del PR porque es un cambio de comportamiento del
      producto adentro de un PR que dice "cabeza lectora"

## Documentación
- [x] `docs/architecture/modelo-musical.md`: la tabla dice "Reflexión → el orden de las notas
      (retrógrado)". Con D9 la reflexión también decide **por dónde entra y sale el recorrido** — hoy
      la doc describe medio efecto
- [x] `specs/log.md`, nota de revisión: el bug de las puertas con reflexión, cómo se encontró (medir de
      dónde sale la celda de cada nota) y la lección — una cabeza lectora es un test de coherencia
      entre lo que suena y lo que se ve
- [x] `docs/architecture/modelo-musical.md:73`: retirar la "Limitación conocida" — este spec la cierra
- [x] `.claude/rules/domain.md:49`: la misma frase, escrita una segunda vez ("hoy se oye pero no se lee
      — no hay cabeza lectora"). Si se cierra en un solo lado queda contradiciendo al otro
- [x] `docs/architecture/audio.md`: la cabeza lectora como segundo consumidor del motor por fuera de React
- [x] `.claude/rules/ui.md:15-16`: `Spectrum` deja de ser la única excepción; la regla es la misma
- [x] `.claude/rules/audio.md`: el `paths:` del frontmatter lista `src/components/Spectrum.tsx` uno por
      uno — agregar `Playhead.tsx` o la regla no se carga al tocarlo
- [x] `docs/architecture/directory-structure.md`: `audio/playhead.ts` y `components/Playhead.tsx`
- [x] `App.tsx:117`: el comentario dice que el 010 va a leer las celdas de `placed`. Con AC9 eso es
      exactamente lo que no alcanza — corregirlo o queda como pista falsa
- [x] `specs/log.md`: estado del 010 (y el del 009, ver Backlog)

## Verificación
- [x] `pnpm verify` en verde (AC8)
- [ ] AC1 — profiler de React: cero renders del árbol durante la reproducción
- [x] AC4 — revisar el diff: no hay aritmética de caminos ni de distancias en `components/`
- [ ] AC3 — **en el navegador y a oído**: la celda encendida coincide con lo que suena. Chrome y Firefox
- [x] AC5 — colocar con el ciclo andando: atenuada, y cambia justo cuando suena
- [x] AC6 — colocar en el medio del recorrido reordena la lista
- [x] AC7 — en pausa no se dibuja cabeza y el loop no escribe ningún estilo
- [ ] **AC9** — con el ciclo andando, colocar una pieza: la cabeza sigue el circuito **viejo** durante
      la espera y salta al nuevo en el mismo instante que el sonido
- [x] **AC10** (no-regresión) — el fantasma sigue mostrando nota y grado por celda; "Quitar" y "Reset"
      siguen vaciando tablero y secuencia; el `overflow-x-auto` sigue conteniendo el scroll debajo de
      `md` con la cabeza montada encima; y **un tablero sin reflexión suena exactamente igual que hoy**
- [x] **AC11 / AC12 / AC13** — los tests del paso 0 en verde y el arreglo de D9 en su propio commit
- [ ] A oído, después del paso 0: un tablero con piezas reflejadas suena distinto (es el arreglo), y la
      cabeza entra y sale de cada pieza por donde la melodía empieza y termina
- [x] Degradados a mano: tablero vacío con play apretado, y una sola pieza (sin clicks, sin saltos)
- [ ] A ojo: un salto por la costura (esquina a esquina, sin celda intermedia)
- [ ] A ojo: dos piezas adyacentes (sin click, la cabeza pasa sin escala)
- [ ] A ojo: 160 bpm, que es 10,7 celdas por segundo

## PR
- [ ] Un GIF: es un spec que no se puede revisar leyendo el diff
- [x] Aclarar por qué no hay estado de React, con el número (4 a 11 cambios por segundo × 60 celdas)
- [x] Aclarar que el recorrido **no se calcula acá**: viene del 009 y este spec solo lo lee
- [x] **Declarar el cambio de audio arriba de todo**: el paso 0b arregla las puertas con reflexión y
      eso cambia el circuito de los tableros reflejados. Es un arreglo del 009, va en su commit, y sin
      decirlo el PR parece que la cabeza lectora cambió cómo suena el instrumento
- [ ] Si el PR queda grande, sacar el paso 0 como PR propio y primero — es independiente y mergeable
      solo. **No se hizo**: el PR #9 fue uno solo. Registro, no pendiente
- [ ] `/pr-review` antes de pedir revisión — **quedó sin correr y el PR ya está mergeado.** Registro,
      no pendiente

## Seguimiento (no bloquea)

> **Cierre del seguimiento — 2026-08-18.** Todo lo de esta sección se resolvió o se movió a su
> lugar definitivo en la rama `chore/cierre-seguimientos-007-010`. Lo que quedó abierto dice dónde vive.

- [x] Retirar `PlacedPiece.notes` — el panel lateral se toca en este spec, es el momento. **Hecho**
      después del merge: `PlacedList` deriva el arpegio con `arpeggioFor` igual que el motor, así que
      la lista no puede decir un arpegio distinto del que suena
- [x] Si aparece un tercer consumidor del estado del motor por fuera de React, unificar la lectura.
      **No apareció**: siguen siendo dos (`Spectrum` por `readSpectrum`, `Playhead` por
      `playheadOffset` + `cycleGeneration`). Era una tarea condicional y la condición no se cumplió;
      cuando se cumpla, el disparador es el tercero y no esta lista
- [x] `occupantAt` recorre todas las piezas por celda: medir si el tablero crece. **Medido** junto con
      el mismo seguimiento del 009: 4,1 µs un render entero con 12 piezas. No hace falta ningún índice

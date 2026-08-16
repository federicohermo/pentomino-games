# Tareas — Nota por celda y lenguaje visual

## Backlog
- [ ] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [x] Fila del 007 en `specs/log.md` (`Propuesto`) y el 001 a `Descartado`, con este spec como motivo
      — ya está: `log.md:18` y `log.md:12`, más la nota de dependencias `log.md:61-68`
- [ ] **Guardar la salida de `simulate_board`** para un tablero fijo de 3 piezas — es la línea base de AC8
- [ ] **Crear rama** `feature/007-nota-por-celda-y-lenguaje-visual`

## Dominio
- [ ] `centroid` en `domain/transform.ts`
- [ ] `angleFromCentroid` en `domain/transform.ts`, normalizado a `[0, 2π)`, con el comentario del eje Y
- [ ] `degreeByCellIndex` en `domain/music.ts`: D1 (epsilon contra el centroide) + ángulo + D2′ (índice)
- [ ] Comentario que explique **por qué** el desempate es por índice y no por radio, con el dato:
      por radio, `F` e `I` dejan de coincidir con la referencia (`research.md` §2)
- [ ] `occupantCellIndex` en `domain/board.ts`, al lado de `occupantAt` — es lo que saca del componente
      la derivación de la que depende AC6 (AC14)

## Tests del dominio
- [ ] `transform.test.ts` — centroide de las 12 piezas
- [ ] `transform.test.ts` — el ángulo de la celda al sur del centroide es `π/2` (eje Y hacia abajo)
- [ ] AC1 — las 12 piezas dan una permutación de `[0,1,2,3,4]`
- [ ] AC2 — `I` y `X`: la celda del centroide recibe el grado `0`
- [ ] AC4 — en `F`, `I` y `T` (las 3 con empate) las celdas empatadas reciben grados consecutivos en
      orden de índice creciente, nombradas por índice en el test. **No** escribirlo sobre el
      comparador: es interno a `degreeByCellIndex` y exportarlo solo para el test agrega superficie
- [ ] `board.test.ts` — AC14: `occupantCellIndex` sobre celda ocupada, celda vacía y dos piezas
      adyacentes (que el índice salga de la pieza correcta)
- [ ] AC3 — el mapeo se arrastra por índice sobre 12 piezas × 4 rotaciones × 2 reflexiones. **No**
      escribirlo como «`degreeByCellIndex(formaTransformada)` == mapeo canónico»: eso falla en 75 de
      las 96 (medido en la revisión del spec), porque rotar corre el origen del ángulo
- [ ] AC12 — la reflexión no cambia la nota de una celda: la celda de grado `g` muestra la nota `g` del
      arpegio **ascendente**, no del ya invertido
- [ ] **AC5 — la referencia congelada**: las 12 piezas, con los nombres de nota escritos a mano

## Lenguaje visual
- [ ] `components/constants/palette.constants.ts` con los 12 `{ bg, fg }` medidos
- [ ] `components/__tests__/palette.test.ts` — AC7, recalculando el contraste desde `bg`
- [ ] `CELL_PX` 28 → 44
- [ ] `Board.tsx`: el tamaño de fuente de la celda es hoy `text-[10px]` (`Board.tsx:61`) y la medición
      del riesgo de legibilidad es sobre **`text-[11px]`** — cambiarlo, o anotar por qué no
- [ ] `Board.tsx`: fondo por pieza, nota por celda, grado en chico (AC6). El contenido se compone
      encadenando puras —`occupantCellIndex` → `degreeByCellIndex` → `notesForRotation` → `midiName`—
      y el componente no implementa ningún paso (AC14)
- [ ] `Board.tsx`: el arpegio sale de `notesForRotation`, **no** de `occ.notes`, que ya trae el
      retrógrado (AC12). Es también lo que deja a `Board` sin consumir el campo que se retira post-009
- [ ] Verificar que el fantasma, el choque y el hover siguen ganando sobre el color de pieza
- [ ] `PiecePreview`: las celdas pasan de `bg-slate-800` (`:33`) al color de pieza; el punto del ancla
      queda y sigue sin nombres de nota (D7)
- [ ] `PiecePalette`: el fondo del botón **no se toca** —es el canal de "seleccionado" (`:41`)—; el
      color de pieza va como punto o barra al costado (D7)
- [ ] `PlacedList`: la letra de `:25` toma el color de pieza (D7)
- [ ] AC13 — no-regresión de los tres: sin cambio de layout ni de tamaño, `PREVIEW_CELL_PX` sigue en 20
      y las listas de notas siguen mostrando las mismas cinco en el mismo orden

## MCP server
- [ ] `describe_piece` devuelve grado y nota por celda (AC9), **importando** el mapeo, sin recalcularlo
- [ ] La nota por celda sale del arpegio **ascendente**, no de `notes` (`describePiece.ts:69`), que ya
      trae el retrógrado aplicado (AC12)
- [ ] El campo va como `cellMap` **al lado** de `cells`, que no se toca: pisarlo rompe el contrato de
      la tool y `pnpm mcp:test` no lo ataja (`tools.test.ts:70` solo chequea `.length`)
- [ ] Una frase en la **descripción de la tool** (`describePiece.ts:50-59`) que nombre `cellMap`: es la
      doc que leen los agentes, y un campo que la descripción no menciona no lo consulta nadie
- [ ] `pnpm mcp:test` en verde

## Documentación
- [ ] `DESIGN.md` en la raíz (AC10)
- [ ] Fila nueva en la tabla de documentación de `CLAUDE.md`
- [ ] `.claude/rules/domain.md:36`: la **fila** «La forma → Nada, hoy» pasa a «qué celda tiene qué nota»
- [ ] `docs/architecture/modelo-musical.md`: ahí no hay fila — es prosa (`:16-18`) y la tabla «Las
      cuatro reglas» (`:9-14`), que pasa a cinco
- [ ] `docs/architecture/directory-structure.md:85-92`: sumar `constants/palette.constants.ts` y el
      directorio `components/__tests__/` al árbol de `components/`
- [ ] `specs/log.md` — la deuda «no hay tests de UI» (`log.md:84`) queda **abierta pero no más
      grande**: anotar que la derivación de la que depende AC6 no vive en `Board.tsx` sino en
      `domain/board.ts` (`occupantCellIndex`, AC14), así que el componente sigue siendo un encadenado
      de puras. También cerrar la tarea de seguimiento del 005 que preveía `occupantAt` devolviendo el
      índice: se resolvió con una pura hermana en vez de cambiar la firma

## Verificación
- [ ] `pnpm verify` en verde (AC11)
- [ ] **AC8** — `simulate_board` sobre el tablero de la línea base devuelve una `timeline` idéntica
- [ ] Captura del tablero con `X`, `I` y `F` colocadas: centro de `X` = A4, centro de `I` = C#4
- [ ] Confirmar que `D#5` entra legible en 44 px; si no, aplicar el fallback y anotarlo en `DESIGN.md`
- [ ] Captura a 375 px de ancho: el tablero de 440 px no rompe el layout

## PR
- [ ] **Aclarar que el audio no cambia**: un revisor va a esperar lo contrario (ver `plan.md` §final)
- [ ] Capturas antes/después del tablero
- [ ] `/pr-review` antes de pedir revisión

## Seguimiento (no bloquea)
- [ ] Retirar `PlacedPiece.notes`, redundante una vez que el grado vive por celda — después del 009.
      Este spec le resta un consumidor: `Board` deriva de `notesForRotation` y no del campo
- [ ] `renderAscii` del MCP server sigue dibujando la letra de la pieza; el grado por celda solo está
      en el JSON
- [ ] El `title` de la celda podría decir `(x,y) · D#5 · grado 3` — es diseño del 010

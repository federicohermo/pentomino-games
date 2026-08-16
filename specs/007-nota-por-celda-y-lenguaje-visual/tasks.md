# Tareas — Nota por celda y lenguaje visual

## Backlog
- [x] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [x] Fila del 007 en `specs/log.md` (`Propuesto`) y el 001 a `Descartado`, con este spec como motivo
      — ya está: `log.md:18` y `log.md:12`, más la nota de dependencias `log.md:61-68`
- [x] **Guardar la salida de `simulate_board`** para un tablero fijo de 3 piezas — es la línea base de AC8
- [x] **Crear rama** `feature/007-nota-por-celda-y-lenguaje-visual`

## Dominio
- [x] `centroid` en `domain/transform.ts`
- [x] `angleFromCentroid` en `domain/transform.ts`, normalizado a `[0, 2π)`, con el comentario del eje Y
- [x] `degreeByCellIndex` en `domain/music.ts`: D1 (epsilon contra el centroide) + ángulo + D2′ (índice)
- [x] Comentario que explique **por qué** el desempate es por índice y no por radio, con el dato:
      por radio, `F` e `I` dejan de coincidir con la referencia (`research.md` §2)
- [x] `occupantCellIndex` en `domain/board.ts`, al lado de `occupantAt` — es lo que saca del componente
      la derivación de la que depende AC6 (AC14)

## Tests del dominio
- [x] `transform.test.ts` — centroide de las 12 piezas
- [x] `transform.test.ts` — el ángulo de la celda al sur del centroide es `π/2` (eje Y hacia abajo)
- [x] AC1 — las 12 piezas dan una permutación de `[0,1,2,3,4]`
- [x] AC2 — `I` y `X`: la celda del centroide recibe el grado `0`
- [x] AC4 — en `F`, `I` y `T` (las 3 con empate) las celdas empatadas reciben grados consecutivos en
      orden de índice creciente, nombradas por índice en el test. **No** escribirlo sobre el
      comparador: es interno a `degreeByCellIndex` y exportarlo solo para el test agrega superficie
- [x] `board.test.ts` — AC14: `occupantCellIndex` sobre celda ocupada, celda vacía y dos piezas
      adyacentes (que el índice salga de la pieza correcta)
- [x] AC3 — el mapeo se arrastra por índice sobre 12 piezas × 4 rotaciones × 2 reflexiones. **No**
      escribirlo como «`degreeByCellIndex(formaTransformada)` == mapeo canónico»: eso falla en 75 de
      las 96 (medido en la revisión del spec), porque rotar corre el origen del ángulo
- [x] AC12 — la reflexión no cambia la nota de una celda: la celda de grado `g` muestra la nota `g` del
      arpegio **ascendente**, no del ya invertido
- [x] **AC5 — la referencia congelada**: las 12 piezas, con los nombres de nota escritos a mano

## Lenguaje visual
- [x] `components/constants/palette.constants.ts` con los 12 `{ bg, fg }` medidos
- [x] `components/__tests__/palette.test.ts` — AC7, recalculando el contraste desde `bg`
- [x] `CELL_PX` 28 → 44
- [x] `Board.tsx`: el tamaño de fuente de la celda es hoy `text-[10px]` (`Board.tsx:61`) y la medición
      del riesgo de legibilidad es sobre **`text-[11px]`** — cambiarlo, o anotar por qué no
- [x] `Board.tsx`: fondo por pieza, nota por celda, grado en chico (AC6). El contenido se compone
      encadenando puras —`occupantCellIndex` → `degreeByCellIndex` → `notesForRotation` → `midiName`—
      y el componente no implementa ningún paso (AC14)
- [x] `Board.tsx`: el arpegio sale de `notesForRotation`, **no** de `occ.notes`, que ya trae el
      retrógrado (AC12). Es también lo que deja a `Board` sin consumir el campo que se retira post-009
- [x] Verificar que el fantasma, el choque y el hover siguen ganando sobre el color de pieza
- [x] `PiecePreview`: las celdas pasan de `bg-slate-800` (`:33`) al color de pieza; el punto del ancla
      queda y sigue sin nombres de nota (D7)
- [x] `PiecePalette`: el fondo del botón **no se toca** —es el canal de "seleccionado" (`:41`)—; el
      color de pieza va como punto o barra al costado (D7)
- [x] `PlacedList`: la letra de `:25` toma el color de pieza (D7)
- [x] AC13 — no-regresión de los tres: sin cambio de layout ni de tamaño, `PREVIEW_CELL_PX` sigue en 20
      y las listas de notas siguen mostrando las mismas cinco en el mismo orden

## MCP server
- [x] `describe_piece` devuelve grado y nota por celda (AC9), **importando** el mapeo, sin recalcularlo
- [x] La nota por celda sale del arpegio **ascendente**, no de `notes` (`describePiece.ts:69`), que ya
      trae el retrógrado aplicado (AC12)
- [x] El campo va como `cellMap` **al lado** de `cells`, que no se toca: pisarlo rompe el contrato de
      la tool y `pnpm mcp:test` no lo ataja (`tools.test.ts:70` solo chequea `.length`)
- [x] Una frase en la **descripción de la tool** (`describePiece.ts:50-59`) que nombre `cellMap`: es la
      doc que leen los agentes, y un campo que la descripción no menciona no lo consulta nadie
- [x] `pnpm mcp:test` en verde

## Documentación
- [x] `DESIGN.md` en la raíz (AC10)
- [x] Fila nueva en la tabla de documentación de `CLAUDE.md`
- [x] `.claude/rules/domain.md:36`: la **fila** «La forma → Nada, hoy» pasa a «qué celda tiene qué nota»
- [x] `docs/architecture/modelo-musical.md`: ahí no hay fila — es prosa (`:16-18`) y la tabla «Las
      cuatro reglas» (`:9-14`), que pasa a cinco
- [x] `docs/architecture/directory-structure.md:85-92`: sumar `constants/palette.constants.ts` y el
      directorio `components/__tests__/` al árbol de `components/`
- [x] `specs/log.md` — la deuda «no hay tests de UI» (`log.md:84`) queda **abierta pero no más
      grande**: anotar que la derivación de la que depende AC6 no vive en `Board.tsx` sino en
      `domain/board.ts` (`occupantCellIndex`, AC14), así que el componente sigue siendo un encadenado
      de puras. También cerrar la tarea de seguimiento del 005 que preveía `occupantAt` devolviendo el
      índice: se resolvió con una pura hermana en vez de cambiar la firma
      — la tarea era del **001** (`001-*/tasks.md:35`, con el nombre viejo `cellOccupied`), no del 005
- [x] `docs/architecture/overview.md` — el árbol y la tabla de símbolos de `domain/` no listaban las
      cuatro funciones nuevas (no estaba en el plan; salió del checker de la convergencia)

## Verificación
- [x] `pnpm verify` en verde (AC11) — lint + typecheck + 118 tests Vitest + 61 del MCP server
- [x] **AC8** — `simulate_board` sobre el tablero de la línea base devuelve una `timeline` idéntica
      — medido en un proceso **fresco**: el server MCP de la sesión cachea los módulos y habría
      respondido con el código viejo, haciendo pasar el AC por construcción
- [x] Captura del tablero con `X`, `I` y `F` colocadas: centro de `X` = A4, centro de `I` = C#4
      — verificado en vivo: `(1,1) → 0 A4` y `(5,1) → 0 C#4`, y los `bg` renderizados son los tres
      hex de `palette.constants.ts`. Se sumó `W` a la captura: es la única con texto blanco
- [x] Confirmar que `D#5` entra legible en 44 px; si no, aplicar el fallback y anotarlo en `DESIGN.md`
      — **no hace falta el fallback**: `D#5` mide 20,2 px en la celda de 44 (23,8 px de holgura) y es
      el nombre más ancho de los 20 en pantalla, empatado con `D#4`. Medido con un `Range` sobre el
      nodo de texto, no a ojo
- [ ] Captura a 375 px de ancho: el tablero de 440 px no rompe el layout
      — **FALLA, y es regresión de este spec.** Medido: a 375 px el panel del tablero queda en 343 px
      (el wrapper tiene `px-4`) y su interior útil en **311 px** (`p-4`), contra los **440 px** que
      necesitan las 10 pistas fijas de `repeat(10, 44px)`. Desborda **129 px**, las celdas se salen
      del borde derecho del panel y toda la cadena de ancestros es `overflow-x: visible`, así que
      empuja scroll horizontal de página. Con `CELL_PX` en 28 entraba: 280 < 311.
      `research.md` §4 dio por resuelto el caso móvil con «debajo de `md` el tablero ya toma las 12
      columnas», pero 12 columnas de 375 px siguen siendo 311 px útiles.
      **Sin captura**: la ventana de Chrome está maximizada y rechaza achicarse, así que el desborde
      se midió forzando el contenedor al ancho que tendría a 375 px, no emulando el viewport.
      El spec no declaró fallback para este riesgo (sí para el de legibilidad), así que la decisión
      queda abierta: `overflow-x-auto` en el panel, un `CELL_PX` menor debajo de `md`, o aceptarlo

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

# Tareas — Nota por celda y lenguaje visual

## Backlog
- [ ] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [ ] Fila del 007 en `specs/log.md` (`Propuesto`) y el 001 a `Descartado`, con este spec como motivo
- [ ] **Guardar la salida de `simulate_board`** para un tablero fijo de 3 piezas — es la línea base de AC8
- [ ] **Crear rama** `feature/007-nota-por-celda-y-lenguaje-visual`

## Dominio
- [ ] `centroid` en `domain/transform.ts`
- [ ] `angleFromCentroid` en `domain/transform.ts`, normalizado a `[0, 2π)`, con el comentario del eje Y
- [ ] `degreeByCellIndex` en `domain/music.ts`: D1 (epsilon contra el centroide) + ángulo + D2′ (índice)
- [ ] Comentario que explique **por qué** el desempate es por índice y no por radio, con el dato:
      por radio, `F` e `I` dejan de coincidir con la referencia (`research.md` §2)

## Tests del dominio
- [ ] `transform.test.ts` — centroide de las 12 piezas
- [ ] `transform.test.ts` — el ángulo de la celda al sur del centroide es `π/2` (eje Y hacia abajo)
- [ ] AC1 — las 12 piezas dan una permutación de `[0,1,2,3,4]`
- [ ] AC2 — `I` y `X`: la celda del centroide recibe el grado `0`
- [ ] AC4 — el comparador nunca devuelve `0` para dos celdas distintas
- [ ] AC3 — estabilidad sobre 12 piezas × 4 rotaciones × 2 reflexiones
- [ ] **AC5 — la referencia congelada**: las 12 piezas, con los nombres de nota escritos a mano

## Lenguaje visual
- [ ] `components/constants/palette.constants.ts` con los 12 `{ bg, fg }` medidos
- [ ] `components/__tests__/palette.test.ts` — AC7, recalculando el contraste desde `bg`
- [ ] `CELL_PX` 28 → 44
- [ ] `Board.tsx`: fondo por pieza, nota por celda, grado en chico (AC6)
- [ ] Verificar que el fantasma, el choque y el hover siguen ganando sobre el color de pieza
- [ ] `PiecePalette` / `PiecePreview` / `PlacedList`: color de pieza donde ya mostraban la letra

## MCP server
- [ ] `describe_piece` devuelve grado y nota por celda (AC9), **importando** el mapeo, sin recalcularlo
- [ ] `pnpm mcp:test` en verde

## Documentación
- [ ] `DESIGN.md` en la raíz (AC10)
- [ ] Fila nueva en la tabla de documentación de `CLAUDE.md`
- [ ] `docs/architecture/modelo-musical.md`: la forma deja de determinar «nada»
- [ ] `.claude/rules/domain.md`: misma tabla, misma fila

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
- [ ] Retirar `PlacedPiece.notes`, redundante una vez que el grado vive por celda — después del 009
- [ ] `occupantAt` podría devolver el índice de celda además de la pieza, si el `findIndex` del render
      llega a molestar (hoy: 5 comparaciones por celda ocupada, máximo 60 celdas)
- [ ] `renderAscii` del MCP server sigue dibujando la letra de la pieza; el grado por celda solo está
      en el JSON
- [ ] El `title` de la celda podría decir `(x,y) · D#5 · grado 3` — es diseño del 010

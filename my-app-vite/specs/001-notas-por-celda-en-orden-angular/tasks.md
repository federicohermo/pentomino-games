# Tareas — Notas por celda en orden angular

## Backlog
- [x] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [ ] **Crear rama** `feature/001-notas-por-celda-en-orden-angular`

## Runner de tests (prerrequisito)
- [ ] `npm i -D vitest jsdom @vitest/coverage-v8`
- [ ] Bloque `test` en `vite.config.ts` (jsdom, `setupTests.ts`, `globals: true`)
- [ ] Scripts `test` / `test:watch` en `package.json`
- [ ] Sacar `@types/jest` — con `globals: true` los tipos los da Vitest y tener ambos duplica las firmas
- [ ] El `App.test.tsx` heredado de CRA pasa (o se reescribe si busca texto que ya no existe)
- [ ] `npm test` en verde (AC8)

## Dominio
- [ ] Portar `centroid` y `angleFromCentroid`, con comentario sobre el eje Y invertido
- [ ] `radiusFromCentroid` (nueva, para el desempate D2)
- [ ] `degreeByCellIndex` con la regla del centro (D1) y el comparador de tres criterios (D2)
- [ ] Constante `DEGREES` precomputada por pieza
- [ ] Evaluar extraer las funciones puras a `src/notes.ts` — `App.tsx` ya tiene ~400 líneas

## Tests del dominio
- [ ] AC1 — las 12 piezas dan una permutación de `[0,1,2,3,4]`
- [ ] AC2 — `I` y `X`: la celda del centroide recibe el grado `0`
- [ ] AC3 — estabilidad bajo 12 piezas × 4 rotaciones × 2 reflexiones
- [ ] AC4 — el comparador nunca devuelve `0` para celdas distintas
- [ ] AC5 — el arpegio se dispara en orden de grado

## Integración
- [ ] `PlacedPiece.noteByCell` + poblarlo en `handleCellClick`
- [ ] `playNotesNow` recibe las notas en orden angular derivado del mapeo
- [ ] `cellOccupied` devuelve también el índice de celda dentro de la pieza
- [ ] La celda ocupada muestra su nota en vez de la letra de la pieza (AC6)

## Verificación
- [ ] `npx tsc -b --noEmit` en 0 (AC7)
- [ ] `npm test` en verde (AC1–AC5)
- [ ] `npm run build` en verde (AC7)
- [ ] Captura con `X` e `I` colocadas: celda central = tónica, resto en orden horario (AC2, AC6)
- [ ] Confirmar que `D#` entra legible en 28px; si no, aplicar el fallback del riesgo declarado

## PR
- [ ] **Aclarar que el audio no cambia en este spec**: cambia de dónde sale el orden, no el orden.
      Un revisor va a esperar lo contrario (ver `plan.md` §4)
- [ ] Capturas antes/después del tablero
- [ ] `/pr-review` antes de pedir revisión

## Seguimiento (no bloquea)
- [ ] Retirar `PlacedPiece.notes`, redundante una vez que las notas viven por celda
- [ ] Unificar los dos caminos de reproducción: el `scheduleRepeat` de los loops sigue iterando
      `p.notes` y no pasa por el orden angular
- [ ] Timing dependiente de la geometría (radio → duración, distancia angular → separación temporal)
- [ ] `web-vitals` es dependencia huérfana; se retira junto con el borrado de `my-app`

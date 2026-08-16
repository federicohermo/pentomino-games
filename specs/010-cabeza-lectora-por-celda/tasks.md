# Tareas — Cabeza lectora por celda

## Backlog
- [ ] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [ ] Fila del 010 en `specs/log.md` (`Propuesto`)
- [ ] Verificar que el **009 esté mergeado**: sin recorrido no hay nada que seguir
- [ ] **Crear rama** `feature/010-cabeza-lectora-por-celda`

## El camino (dominio puro)
- [ ] `pathBetween(a, b)` en `domain/board.ts`: primero en X, después en Y; por la costura si conviene
- [ ] Reusar la comparación de `cellDistance` en vez de repetirla
- [ ] **Test AC4** — `pathBetween(a,b).length === cellDistance(a,b) - 1` sobre las 3.600 combinaciones
- [ ] Test — el camino no repite celdas y todas sus celdas son adyacentes de a pares
- [ ] `domain/sequence.ts`: cada click lleva su celda. **Los offsets no se recalculan**

## El motor
- [ ] La aritmética del offset como **pura testeable**, separada de la lectura del singleton
- [ ] Test AC2 — offset dentro del primer ciclo, en el borde, y varios ciclos adelante
- [ ] `playheadOffset()` en `engine.ts`, con `null` en pausa / sin contexto / secuencia vacía
- [ ] Cadena de latencia: `outputLatency` → `baseLatency` → 0 (D4)
- [ ] `cycleGeneration()`: contador de swaps de ciclo

## El dibujo
- [ ] `components/Playhead.tsx`: sin props, efecto con `[]`, `requestAnimationFrame`, limpieza
- [ ] Montarlo en el contenedor `relative` que `Board.tsx` ya tiene
- [ ] Traducir offset → celda **desde la secuencia**, sin llamar a `occupantAt`
- [ ] Escribir el estilo **solo cuando la celda cambió**
- [ ] Posición con estilo inline desde `CELL_PX` (una clase interpolada de Tailwind no se generaría)
- [ ] Nota fuerte, click tenue (D7)
- [ ] La pieza pendiente se ve atenuada hasta el swap de ciclo (AC5)

## La lista
- [ ] `PlacedList` muestra el orden del circuito, tomado de la misma `buildSequence` que ya calcula `App`

## Documentación
- [ ] `docs/architecture/modelo-musical.md`: retirar la "Limitación conocida" del spec 004 — este spec la cierra
- [ ] `docs/architecture/audio.md`: la cabeza lectora como segundo consumidor del motor por fuera de React
- [ ] `.claude/rules/ui.md`: `Spectrum` deja de ser la única excepción; la regla es la misma
- [ ] `specs/log.md`: estado del 010

## Verificación
- [ ] `pnpm verify` en verde (AC8)
- [ ] AC1 — profiler de React: cero renders del árbol durante la reproducción
- [ ] AC3 — **en el navegador y a oído**: la celda encendida coincide con lo que suena. Chrome y Firefox
- [ ] AC5 — colocar con el ciclo andando: atenuada, y cambia justo cuando suena
- [ ] AC6 — colocar en el medio del recorrido reordena la lista
- [ ] AC7 — en pausa no se dibuja cabeza
- [ ] A ojo: un salto por la costura (esquina a esquina, sin celda intermedia)
- [ ] A ojo: dos piezas adyacentes (sin click, la cabeza pasa sin escala)
- [ ] A ojo: 160 bpm, que es 10,7 celdas por segundo

## PR
- [ ] Un GIF: es un spec que no se puede revisar leyendo el diff
- [ ] Aclarar por qué no hay estado de React, con el número (4 a 11 cambios por segundo × 60 celdas)
- [ ] Aclarar que el camino va en el dominio y **no cambia ningún instante** de lo que suena
- [ ] `/pr-review` antes de pedir revisión

## Seguimiento (no bloquea)
- [ ] Retirar `PlacedPiece.notes` — el panel lateral se toca en este spec, es el momento
- [ ] Si aparece un tercer consumidor del estado del motor por fuera de React, unificar la lectura
- [ ] `occupantAt` recorre todas las piezas por celda: medir si el tablero crece

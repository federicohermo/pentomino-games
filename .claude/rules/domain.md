---
paths:
  - "src/domain/**/*.ts"
---

# Capa de dominio

Puro: sin React, sin Web Audio, sin DOM. `transform.ts` (geometría), `board.ts` (las reglas del
tablero), `music.ts` (el modelo musical), `sequence.ts` (el circuito y los offsets del ciclo) e
`invariants.ts` (los chequeos). Los datos viven en `domain/constants/` y los tipos en `domain/types/`.

## El orden del array de celdas

`rotate90`, `normalize` y `reflect` son `map`: **la celda del índice `k` sigue siendo la misma celda
lógica después de transformar.**

De eso depende `ANCHOR_INDEX` —guarda la celda de agarre como índice, no como coordenada—, y de eso
depende el mapeo celda↔nota que `degreeByCellIndex` calcula sobre la forma canónica y arrastra por
índice (spec 007): las puertas de entrada y salida que usa `sequence.ts` para armar el circuito (grado
0 y grado 4, spec 009) también se leen por índice, así que romper el orden del array rompe a las tres a
la vez. Filtrar, ordenar o reagrupar celdas dentro de esas funciones rompe la colocación de piezas
**sin ningún error visible**. `checkArrayOrder()` de `invariants.ts` es la red; si hace falta
transformar celdas de otra forma, va una función nueva en vez de modificar estas.

## `y` crece hacia abajo

Coordenadas de grilla, no cartesianas. Cualquier cálculo angular recorre el círculo en sentido horario
en pantalla. No está mal — es la clase de cosa que alguien "arregla" por error.

## Modelo musical

| Entrada | Determina |
|---|---|
| Qué pieza | La tónica (`BASE_MAP`: F→C, I→C#, … Z→B) |
| Rotación | La fórmula de escala (mayor → menor → blues → mayor +7) |
| Reflexión | El orden de las notas (retrógrado) |
| La posición en el tablero | El orden de reproducción y el silencio entre piezas (`buildSequence`, spec 009) |
| **La forma** | **Qué celda tiene qué nota** (`degreeByCellIndex`, spec 007) |

`degreeByCellIndex` se llama **sobre `SHAPES[pieza]` sin transformar** y el grado viaja por índice.
Correrla sobre una forma ya rotada compila igual y devuelve otro mapeo en **75 de las 96**
orientaciones, porque rotar corre el origen del ángulo. La rotación elige *qué* notas; la forma,
*dónde* está cada una.

**El tablero se repliega sobre sí mismo**: `(0,0)` y `(9,5)` son adyacentes (una costura extra sobre la
grilla, spec 009), y el orden de reproducción sale de un circuito exacto (Held-Karp) sobre esas
distancias, no de la columna ni del orden de colocación. Es geometría y no reloj de pared: el mismo
tablero suena siempre igual, porque `buildSequence` es aritmética pura sobre enteros. Hoy se oye pero
no se lee — no hay cabeza lectora; es la limitación consciente que cierra el spec 010.

Cuidado con la colisión de nombres: la **pieza `F`** suena con tónica **C**; la nota F le corresponde a
la pieza `T`. La letra describe la forma, no el sonido.

Detalle en [docs/architecture/modelo-musical.md](../../docs/architecture/modelo-musical.md).

## Después de tocar esta capa

`check_invariants` del MCP server ejecuta los chequeos sobre las 96 orientaciones y devuelve
contraejemplos — antes y después de tocar geometría, `SHAPES` o el modelo musical.

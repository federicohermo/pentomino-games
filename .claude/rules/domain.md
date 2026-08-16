---
paths:
  - "src/domain/**/*.ts"
---

# Capa de dominio

Puro: sin React, sin Web Audio, sin DOM. `transform.ts` (geometría), `board.ts` (las reglas del
tablero), `music.ts` (el modelo musical) e `invariants.ts` (los chequeos). Los datos viven en
`domain/constants/` y los tipos en `domain/types/`.

## El orden del array de celdas

`rotate90`, `normalize` y `reflect` son `map`: **la celda del índice `k` sigue siendo la misma celda
lógica después de transformar.**

De eso depende `ANCHOR_INDEX` —guarda la celda de agarre como índice, no como coordenada—, de eso
depende `phaseFor`, que lee la columna del ancla por índice, y de eso va a depender el mapeo celda↔nota
del spec 001. Filtrar, ordenar o reagrupar celdas dentro de esas funciones rompe la colocación de
piezas **sin ningún error visible**. `checkArrayOrder()` de `invariants.ts` es la red; si hace falta
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
| La columna de la celda de agarre | La posición dentro del compás (`phaseFor`) |
| **La forma** | **Nada, hoy** — es lo que ataca el spec 001 |

**El eje X del tablero es tiempo**, y la fase se deriva de la geometría, no del reloj de pared: el
mismo tablero suena siempre igual. Es fracción y no segundos, así que mover el tempo estira el patrón
en vez de reordenarlo. Hoy se oye pero no se lee — no hay cabeza lectora; es la limitación consciente
del spec 004.

Cuidado con la colisión de nombres: la **pieza `F`** suena con tónica **C**; la nota F le corresponde a
la pieza `T`. La letra describe la forma, no el sonido.

Detalle en [docs/architecture/modelo-musical.md](../../docs/architecture/modelo-musical.md).

## Después de tocar esta capa

`check_invariants` del MCP server ejecuta los chequeos sobre las 96 orientaciones y devuelve
contraejemplos — antes y después de tocar geometría, `SHAPES` o el modelo musical.

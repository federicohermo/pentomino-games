# Plan — Spec 031

Cuatro bloques, en este orden. El primero es el único que puede correr solo: el resto depende de que
`Dims` exista.

## Bloque 1 — El dominio deja de saber cuánto mide el tablero

1. `domain/types/board.types.ts` gana `Dims` — `{ readonly w: number; readonly h: number }`.
2. `domain/constants/board.constants.ts`:
   - `GRID_W`/`GRID_H` se van y quedan `GRID_MIN` (5 × 5) y `GRID_DEFAULT` (10 × 6, el tablero de
     siempre: lo usan el MCP server y los tests que no tienen por qué inventar dimensiones).
   - `SEAM` se va: la costura depende de las dimensiones, así que pasa a ser una función.
   - Entra `MAX_PIEZAS = 12`.
3. `domain/board.ts`: `costuraDe(dims)`, `cabeEn(p, dims)` —«¿entra esta pieza entera?», implementada
   sobre `isValid` con el tablero vacío para no escribir los cuatro límites dos veces— y `Dims` como
   parámetro de `isValid`, `routeBetween` y de los tres helpers de id (`nodeOf`, `cellOf`,
   `neighborsOf`).
4. `domain/sequence.ts`: `buildSequence(placed, regimen, dims)`, y la **caché de distancias por
   destino** adentro — un `Map<number, Int32Array>` que vive lo que dura la llamada. `routeBetween`
   queda como la puerta pública de una llamada suelta y se implementa sobre las dos mitades nuevas.

**Verificación del bloque:** los tests de dominio pasan con `GRID_DEFAULT` y aparece el test de AC7
(caché contra referencia, PRNG determinista).

## Bloque 2 — La grilla sale del viewport

5. `components/constants/layout.constants.ts`: `CELL_PX_MIN`/`CELL_PX_MAX` se van y entra
   `CELL_PX_OBJETIVO = 73`. Las siete razones tipográficas pasan a dividir por él.
6. `components/cell-px.ts` → `components/grid-fit.ts`: `grillaPara(vw, vh)` devuelve
   `{ dims, cell }` con los tres pasos del spec.
7. `components/use-cell-px.ts` → `components/use-grid.ts`: `useGrilla(raizRef): Dims`. Sigue
   escribiendo `--cell` con `setProperty` —sin re-render— y **además** guarda las dimensiones en
   estado, que sí re-renderiza pero sólo cuando cambian de valor: arrastrar el borde de la ventana
   cambia `--cell` sesenta veces por segundo y las dimensiones una o dos.

**Verificación:** la tabla de nueve viewports del spec, entera, en el proyecto `node`.

## Bloque 3 — El tablero y el shell

8. `components/Board.tsx` recibe `dims` por prop: la grilla, el `aria-*` y los topes del teclado salen
   de ahí. **Se van `overflow-x-auto`, `max-h-full` y `w-max`** (AC1).
9. `App.tsx`:
   - `const dims = useGrilla(raizRef)`,
   - `const visibles = useMemo(() => placed.filter(p => cabeEn(p, dims)), [placed, dims])` — lo que se
     dibuja, lo que suena **y lo que se toca**,
   - `buildSequence(visibles, regimen, dims)`,
   - el tope de `MAX_PIEZAS` en el handler de colocación, con su anuncio.

   **El corte entre las dos listas es una sola regla, y se aplica consulta por consulta:** `visibles`
   es lo que se ve, se toca y suena; `placed` es lo que existe. Van con `visibles` el dibujo, la
   secuencia, el `occupantAt` del click y el `hoverEdita` del cursor —una pieza que no se dibuja no
   puede recibir un click sobre una celda que se ve vacía—, y van con `placed` las dos que no miran la
   pantalla: `isValid`, para que no se pueda pisar lo guardado, y el tope de `MAX_PIEZAS`, porque una
   pieza guardada vuelve al circuito en cuanto la ventana crezca.

## Bloque 4 — Lo que cruza el borde del paquete y la prosa

10. `mcp-server/src/tools/simulateBoard.ts`: parámetro `dims` opcional con default `GRID_DEFAULT`.
11. `docs/`, `DESIGN.md`, `.claude/rules/ui.md` y `CLAUDE.md` — lo que quedó afirmando en presente que
    el tablero mide 10 × 6 o que la celda sale del viewport.
12. `deuda.md`: el Dijkstra en 4K y el ancho del dock de piezas.

## Verificación

- `pnpm verify` en verde, con coverage al 100 en las cuatro métricas.
- El presupuesto del AC6 se mide sobre 26 × 15 (390 celdas), con el mismo `skipIf` que los dos del 009:
  no corre bajo coverage ni en la CI, por el motivo ya escrito.
- A ojo y a oído `[M]`: los nueve viewports sin scroll, y un tablero de 12 piezas repartidas en una
  pantalla grande — que es donde la música cambia de carácter sin que cambie el modelo.

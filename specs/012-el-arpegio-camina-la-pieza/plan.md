# Plan — Spec 012

Cinco pasos. El **paso 2 es el que cambia lo que suena** y va en su propio commit (AC10); el 1 no cambia
comportamiento y es mergeable solo.

Rama: `feature/012-el-arpegio-camina-la-pieza`.

## Paso 1 — El camino, en `transform.ts`, sin cablearlo

Función nueva, pura, sin consumidores todavía:

```ts
pathThroughCells(cells: readonly Cell[], tiebreak: readonly number[]): number[]
```

Devuelve **el orden de visita por índice de celda**: el elemento `g` es el índice de la celda que el
camino visita en el paso `g`. Es el inverso de lo que devuelve `degreeByCellIndex`, y esa asimetría es
deliberada — un camino es una secuencia de celdas, un mapeo de grados es una tabla por celda. La vuelta
la da `music.ts` en el paso 2, en una línea.

`tiebreak[k]` es el rango de la celda `k` para desempatar: menor gana. `transform.ts` no sabe de dónde
sale y no puede saberlo, porque `music.ts` está aguas abajo (D5).

El algoritmo, en el orden en que se ejecuta:

1. **Matriz de costos.** `w[i][j] = (distancia === 1 ? 0 : BASE) + distancia`, con la distancia Manhattan
   y `BASE = 1 + n · maxDistancia`, que es mayor que cualquier suma de un camino y por lo tanto no puede
   acarrear. Minimizar la suma de `w` es exactamente «máximo de pasos vecinos, y a igualdad mínima suma
   de distancias».
2. **Held-Karp de camino abierto.** `g[j][mask]` = costo mínimo de arrancar en `j` y visitar todo `mask`,
   con `mask` los índices que faltan. Hacia atrás, igual que `shortestCircuit` en `sequence.ts` y por el
   mismo motivo: permite reconstruir hacia adelante y desempatar en el orden en que se decide.
3. **Recorrido de las ramas óptimas.** Se expanden solo los pasos que cumplen
   `w[cur][k] + g[k][mask sin k] === g[cur][mask]`, o sea los que todavía alcanzan el óptimo. Entre los
   caminos completos que salen de ahí gana el de **distancias lexicográficamente mayores** (los saltos
   primero, D2) y a igualdad el de **`tiebreak` lexicográficamente menor** (D1).

**Tests** (`domain/__tests__/transform.test.ts`), con la fuerza bruta sobre las permutaciones **escrita
en el test** como referencia independiente (AC2):

- las 12 piezas y 400 formas aleatorias con semilla fija coinciden con la fuerza bruta;
- el resultado es una permutación de `0..n-1`;
- las 12 piezas tienen distancias no crecientes (AC3);
- las 8 continuas dan 0 saltos y `F`/`T`/`Y`/`X` dan 1/1/1/2 (AC4);
- el desempate se ejerce y es determinista sobre `Y` y `X` (AC6);
- casos borde: 0 celdas, 1 celda, 2 celdas.

## Paso 2 — Cablearlo: `degreeByCellIndex` pasa a ser el camino

En `music.ts`, la función angular de hoy se vuelve interna —`angularRank`, mismo cuerpo, mismo
epsilon— y `degreeByCellIndex` queda:

```ts
const orden = pathThroughCells(cells, angularRank(cells));
const grados = new Array<number>(cells.length);
orden.forEach((k, g) => { grados[k] = g; });
return grados;
```

Firma y contrato intactos (AC7). El docblock se reescribe entero: hoy son 40 líneas que argumentan el
anillo angular, el desempate por índice y la lámina, y todo eso cambia de rol. Lo que **sí** hay que
conservar del docblock viejo, porque sigue siendo cierto y sigue siendo la trampa más cara de la capa:
que recibe la forma **canónica** y que el mapeo viaja **por índice**.

Migrar en el mismo commit los tests de `music.test.ts` que afirman el modelo viejo (`research.md` §7),
incluida la recongelación de la lámina (AC8) con la tabla de `research.md` §5.

**Este commit cambia lo que suena.** Va solo, con el mensaje diciéndolo (AC10).

## Paso 3 — Los valores que cambian aguas abajo

`sequence.test.ts` y `mcp-server/src/__tests__/render.test.ts` tienen grados y puertas escritos a mano.
No hay que buscarlos: `pnpm verify` los señala. Cada uno se mira antes de tocarlo —lo que cambia es el
valor esperado, no la intención del test— y si alguno afirma algo que este spec vuelve falso, se declara
superado con su motivo escrito y no se borra en silencio (AC9).

## Paso 4 — Documentación

`docs/architecture/modelo-musical.md` (la tabla de derivaciones y la sección del mapeo entera),
`CLAUDE.md` (la fila del modelo musical) y `.claude/rules/domain.md`. `DESIGN.md` no cambia: sigue
diciendo lo mismo con otros valores.

## Paso 5 — Verificación

1. `pnpm verify` en verde (AC11).
2. `check_invariants` en **proceso fresco**, antes y después — el MCP server importa el dominio y lo
   cachea por proceso, así que una sesión vieja responde con el código viejo.
3. `describe_piece` sobre `U`, `I`, `Y` y `X`: las cuatro que mejor muestran el cambio.
4. `simulate_board` sobre el tablero de las capturas del pedido, para ver las puertas nuevas.
5. **A ojo, con el transporte corriendo** (AC12): la cabeza lectora recorre cada pieza celda por celda.
   Es la única verificación que no se puede automatizar y es la que originó el spec.

## Orden y paralelismo

El paso 1 es independiente y se puede escribir y testear entero antes de tocar nada más. El 2 depende
del 1. El 3 depende del 2 (los valores nuevos salen de correrlo). El 4 es independiente de los tres y se
puede escribir en paralelo con el 3. El 5 es al final por definición.

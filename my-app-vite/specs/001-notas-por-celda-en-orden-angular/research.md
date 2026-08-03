# Research — Notas por celda en orden angular

## De dónde sale esto

`my-app/` (el proyecto Create React App original, que este repo migró a Vite) contiene tres funciones
que **nunca llegaron a `my-app-vite/`** y que **nunca se llamaron desde ningún lado**, ni siquiera en
`my-app`:

```ts
// my-app/src/App.tsx:80-114
function centroid(cells: Cell[]): [number, number]{
  const sx = cells.reduce((a,[x])=>a+x,0);
  const sy = cells.reduce((a,[,y])=>a+y,0);
  return [sx/cells.length, sy/cells.length];
}
function angleFromCentroid(cell: Cell, cent: [number, number]): number {
  const dx = cell[0]-cent[0];
  const dy = cell[1]-cent[1];
  let ang = Math.atan2(dy, dx); if (ang<0) ang += Math.PI*2; return ang;
}
function assignNotesToCells(transformedCells: Cell[], notes: number[]){
  const c = centroid(transformedCells);
  const idxs = Array.from({length: transformedCells.length}, (_,i)=>i)
    .sort((a,b)=> angleFromCentroid(transformedCells[a], c) - angleFromCentroid(transformedCells[b], c));
  const map = new Map<number, number>();
  idxs.forEach((cellIdx, degIdx)=>{ if (degIdx<notes.length) map.set(cellIdx, notes[degIdx]); });
  return { order: idxs, byIndex: map };
}
```

Verificación de que está muerto:

```
$ grep -n "assignNotesToCells" my-app/src/App.tsx
107:function assignNotesToCells(transformedCells: Cell[], notes: number[]){
```

Una sola aparición: su propia definición. Ídem `useRef` y el `import React`, importados en ese archivo
y nunca usados — residuo del mismo intento inconcluso.

`my-app/` se elimina en el mismo commit que crea este spec. El código citado arriba queda en el
historial de git y es recuperable con `git show 7986d9d:my-app/src/App.tsx`.

## Estado actual del audio en `my-app-vite`

Las notas son hoy una **secuencia plana sin relación con la geometría**:

| Aspecto | Implementación actual | Archivo |
|---|---|---|
| Qué notas suenan | `notesForRotation(basePc, 4, rotation)` — 5 grados de una escala pentatónica elegida por la rotación | `src/App.tsx` |
| En qué orden | El del array; el mirror lo invierte con `ns.reverse()` | `src/App.tsx` |
| Cuándo suenan | Arpegio fijo: `t + i*0.15` segundos, `i` = índice en el array | `playNotesNow()` |
| Relación con las celdas | **Ninguna.** `PlacedPiece.cells` y `PlacedPiece.notes` son dos arrays paralelos que nadie cruza | `interface PlacedPiece` |

Es decir: dos piezas distintas con la misma tónica y rotación suenan idéntico, sin importar su forma.
La forma solo decide **dónde** entra en el tablero, no **cómo** suena.

## Comportamiento real del algoritmo (medido, no supuesto)

Se corrió el algoritmo sobre las 12 piezas × 4 rotaciones. Tres hallazgos, todos con consecuencias de
diseño:

### 1. `I` y `X` tienen una celda exactamente en el centroide

| Pieza | Centroide | Celda que coincide |
|---|---|---|
| `I` (todas las rotaciones) | `(2,0)` / `(0,2)` | sí |
| `X` (todas las rotaciones) | `(1,1)` | sí |

Para esa celda `dx = dy = 0`, y `Math.atan2(0, 0)` devuelve `0`. El ángulo no es indefinido ni `NaN`:
es **silenciosamente `0`**, indistinguible del ángulo de una celda real al este del centroide. La
celda central se cuela en el anillo como si estuviera en el borde.

### 2. Cuatro piezas tienen empates de ángulo

`F`, `I`, `T` y `X` producen dos o más celdas con el mismo ángulo, en **todas** sus rotaciones. Ejemplo
medido, `I` en rotación 0:

```
angulos = [3.141593, 3.141593, 0.000000, 0.000000, 0.000000]
```

Tres celdas con ángulo `0` y dos con `π`. El desempate queda librado a la estabilidad de
`Array.prototype.sort`, que en V8 es estable desde ES2019 y por lo tanto conserva el orden del array
original. **Funciona, pero por accidente**: el orden musical de esas cuatro piezas lo termina fijando
el orden en que alguien tipeó las coordenadas en `SHAPES`, no una decisión.

### 3. La rotación no preserva el orden cíclico en `I` ni en `X`

Orden angular resultante por rotación (índices dentro del array de celdas):

| Pieza | rot 0 | rot 90 | rot 180 | rot 270 | ¿Rotación cíclica? |
|---|---|---|---|---|---|
| `F` | `43012` | `30124` | `01243` | `12430` | sí |
| `L` | `32104` | `32104` | `10432` | `43210` | sí |
| `N` | `43201` | `20143` | `01432` | `43201` | sí |
| `P` | `31024` | `10243` | `02431` | `24310` | sí |
| `T` | `34012` | `34012` | `01234` | `12340` | sí |
| `U` | `41023` | `10234` | `02341` | `23410` | sí |
| `V` | `21034` | `21034` | `03421` | `34210` | sí |
| `W` | `34201` | `20134` | `01342` | `34201` | sí |
| `Y` | `40123` | `01234` | `01234` | `23401` | sí |
| `Z` | `10234` | `10234` | `23410` | `34102` | sí |
| **`I`** | `23401` | `20134` | `01234` | `23401` | **no** |
| **`X`** | `23410` | `24103` | `12034` | `02341` | **no** |

En 10 de 12 piezas la rotación solo **corre el punto de arranque** del anillo: la secuencia es la misma
leída desde otro lugar. En `I` y `X` —las dos con celda en el centroide— ni siquiera eso se cumple: el
orden se reordena de forma arbitraria.

Las dos anomalías tienen la misma causa raíz. Resolver la celda central resuelve los tres hallazgos.

### Consecuencia sobre la que hay que decidir

Aun en las 10 piezas "sanas", que la rotación corra el punto de arranque significa que **rotar una
pieza cambia qué celda recibe la primera nota**. Eso no es un bug: es una decisión de diseño que el
código muerto nunca tomó explícitamente. Ver `spec.md` §Decisiones de diseño.

## Nota sobre el eje Y

En el tablero, `y` crece **hacia abajo** (es el índice de fila). `Math.atan2(dy, dx)` con ese eje
recorre el anillo en sentido **horario** en pantalla, no antihorario como sugiere la intuición
matemática. No es un problema —el recorrido es igual de válido— pero conviene que la documentación y
los tests lo digan, porque es la clase de detalle que alguien "arregla" por error más adelante.

## Archivos afectados

| Archivo | Acción |
|---|---|
| `src/App.tsx` | portar `centroid` / `angleFromCentroid`, reescribir `assignNotesToCells`, cablearla a `handleCellClick`, `playNotesNow` y el render del tablero |
| `src/App.test.tsx` | **primer test real del repo**: hoy solo tiene el smoke test heredado de CRA |
| `specs/001-…/` | este spec |

**No se tocan** `vite.config.ts`, `netlify.toml` ni la capa de Tone: el cambio es de mapeo
nota↔celda, no de motor de audio ni de build.

## Deuda adyacente detectada (fuera de alcance)

- **`web-vitals` es dependencia huérfana** en `package.json`. `reportWebVitals.ts` existía en `my-app`
  y no se migró; nadie lo importa. Se saca junto con el borrado de `my-app`, no acá.
- **`App.test.tsx` es el smoke test de CRA** y no hay runner de tests configurado en el proyecto Vite
  (no hay Vitest ni Jest en `package.json`, ni script `test`). Montar el runner es prerrequisito de
  los AC de este spec y está en el `plan.md` §1.
- **`PlacedPiece.notes` quedará redundante** una vez que las notas vivan por celda. Se deja como está
  para no ampliar el alcance; ver `spec.md` §Fuera de Alcance.

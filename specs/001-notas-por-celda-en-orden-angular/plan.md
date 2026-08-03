# Plan de Implementación — Notas por celda en orden angular

## Orden

1. Runner de tests (prerrequisito de AC1–AC5)
2. `assignNotesToCells` y sus helpers, con tests
3. Cablearla al estado de las piezas colocadas
4. Reproducción en orden angular
5. Render del tablero
6. Verificación

Los pasos 1–2 son puro dominio y no tocan la UI: se pueden mergear solos si el resto se demora.

## 1. Runner de tests

No hay ninguno hoy: `package.json` no tiene script `test` ni Vitest ni Jest, aunque sí arrastra
`@testing-library/*` y `@types/jest` de la época CRA.

```bash
npm i -D vitest jsdom @vitest/coverage-v8
```

En `vite.config.ts`, agregar el bloque `test` (Vitest reusa la config de Vite, así que hereda el plugin
de React y el de Tailwind sin configuración extra):

```ts
test: {
  environment: 'jsdom',
  setupFiles: './src/setupTests.ts',
  globals: true,
}
```

`src/setupTests.ts` ya existe y hace `import '@testing-library/jest-dom'`.

En `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`.

**Verificación del paso**: `npm test` corre el `App.test.tsx` heredado de CRA y pasa. Si ese smoke test
falla (busca un texto que la app ya no renderiza), se reescribe acá — es el único test existente.

`@types/jest` se saca en este mismo paso: con `globals: true` los tipos los provee Vitest, y tener los
dos declara `expect` dos veces con firmas distintas.

## 2. `assignNotesToCells` y helpers

En `src/App.tsx`, junto a las otras funciones puras de geometría (después de `reflect`).

`centroid` se porta tal cual del original. `angleFromCentroid` también, con un comentario sobre el eje
Y invertido (ver `research.md` §Nota sobre el eje Y). Lo que se reescribe es la asignación:

```ts
// Grado de la escala que le toca a cada celda, por índice dentro de SHAPES[pieza].
// Se calcula sobre la forma canónica: rotar y reflejar preservan el orden del
// array, así que el índice sigue siendo válido después de transformar (misma
// propiedad de la que depende ANCHOR_INDEX).
function degreeByCellIndex(cells: Cell[]): number[] {
  const c = centroid(cells);
  const center = cells.findIndex(([x,y]) => x===c[0] && y===c[1]);

  const ring = cells.map((_,i)=>i).filter(i => i!==center);
  ring.sort((a,b)=>{
    const da = angleFromCentroid(cells[a], c) - angleFromCentroid(cells[b], c);
    if (Math.abs(da) > 1e-9) return da;                 // 1. ángulo
    const ra = radiusFromCentroid(cells[a], c) - radiusFromCentroid(cells[b], c);
    if (Math.abs(ra) > 1e-9) return ra;                 // 2. radio
    return a - b;                                       // 3. índice (determinismo)
  });

  const degree = new Array<number>(cells.length);
  if (center >= 0) degree[center] = 0;                  // D1: el centro es la tónica
  ring.forEach((cellIdx, k) => { degree[cellIdx] = center>=0 ? k+1 : k; });
  return degree;
}
```

Se precomputa una vez por pieza, igual que `ANCHOR_INDEX`:

```ts
const DEGREES: Record<PieceKey, number[]> = Object.fromEntries(
  (Object.keys(SHAPES) as PieceKey[]).map(k => [k, degreeByCellIndex(SHAPES[k])])
) as Record<PieceKey, number[]>;
```

**Comparación de floats**: el epsilon de `1e-9` no es decorativo. Las celdas colineales con el
centroide dan ángulos que deberían ser idénticos pero difieren en el último bit tras la división del
centroide; sin epsilon el desempate por radio nunca se activaría y volveríamos a depender de la
estabilidad del sort.

### Tests (AC1–AC4)

`src/App.test.tsx`, o mejor `src/notes.test.ts` si en el paso 2 se extraen las funciones puras a su
propio módulo — decisión al implementar; extraerlas es lo preferible, `App.tsx` ya tiene ~400 líneas.

- **AC1** — para las 12 piezas, `[...degree].sort()` es `[0,1,2,3,4]`.
- **AC2** — `I` y `X`: la celda que iguala al centroide tiene grado `0`.
- **AC3** — para 12 piezas × 4 rotaciones × 2 reflexiones: `DEGREES[k]` sigue siendo válido, es decir
  la celda `k` del array transformado corresponde a la celda `k` de la canónica. Se verifica que
  transformar y después indexar da lo mismo que indexar y después transformar.
- **AC4** — el comparador nunca devuelve `0` para dos celdas distintas de la misma pieza.

## 3. Cablear al estado

`PlacedPiece` gana el mapeo ya resuelto en el momento de colocar:

```ts
interface PlacedPiece {
  id: string;
  piece: PieceKey;
  rotation: number;
  mirror: boolean;
  cells: Cell[];
  notes: number[];            // se mantiene: fuera de alcance retirarlo
  noteByCell: number[];       // nuevo: paralelo a cells, nota MIDI de cada celda
}
```

En `handleCellClick`, `noteByCell[i] = noteSet[DEGREES[selected][i]]`. `noteSet` ya viene con el
`reverse()` del mirror aplicado, así que la reflexión sale gratis: el mapeo es el mismo y el array de
notas es el retrógrado.

## 4. Reproducción en orden angular

`playNotesNow` recibe hoy `number[]` y usa el índice del array como posición del arpegio. Pasa a
recibir las notas **ya ordenadas por grado**, que es lo mismo que el orden angular:

```ts
const inAngularOrder = DEGREES[selected]
  .map((deg, i) => [deg, noteByCell[i]] as const)
  .sort((a,b) => a[0]-b[0])
  .map(([,note]) => note);
```

Con `noteByCell[i] = noteSet[DEGREES[...][i]]`, esto reconstruye exactamente `noteSet`. **Es
intencional**: hoy el arpegio ya suena en orden de grado. El cambio real de este paso no es el sonido
sino que el orden pase a estar *derivado* del mapeo espacial en vez de ser una coincidencia — lo que
hace que el paso 5 (mostrar la nota en cada celda) sea consistente con lo que se escucha.

**Esto merece decirse en el PR**, porque un revisor va a esperar que el audio cambie y no cambia: lo
que cambia es de dónde sale el orden.

## 5. Render del tablero

En la celda ocupada, hoy:

```tsx
>{occ? occ.piece: (ghost? selected : '')}</div>
```

Pasa a mostrar la nota de **esa** celda: buscar el índice de `(x,y)` dentro de `occ.cells` y sacar
`occ.noteByCell[idx]`, formateado con `midiName()` sin la octava.

`cellOccupied()` devuelve hoy la pieza pero no cuál de sus celdas es. Se le agrega el índice al valor
de retorno, o se resuelve en el render con un `findIndex` — lo primero evita recorrer dos veces.

Sacar captura antes/después y verificar que `D#` entra en 28px (riesgo declarado en `spec.md`).

## 6. Verificación

```bash
npx tsc -b --noEmit          # AC7
npm test                     # AC1–AC5, AC8
npm run build                # AC7
```

Y en el navegador, con el dev server: colocar `X` e `I` (las dos piezas con celda central) y confirmar
por captura que la celda del medio muestra la tónica y las otras cuatro los grados en orden horario
(AC2, AC6).

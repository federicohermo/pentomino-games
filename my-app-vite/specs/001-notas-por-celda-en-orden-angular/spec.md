# Spec 001 — Asignar cada nota a una celda de la pieza, en orden angular alrededor del centroide

> Sin ticket: este repo no tiene tablero. Ver `specs/README.md`.

## Problema

Hoy la forma de una pieza **no influye en cómo suena**. `PlacedPiece` guarda `cells` y `notes` como dos
arrays paralelos que nunca se cruzan: las notas salen de `notesForRotation()` (que solo mira la tónica
de la pieza y la rotación) y se disparan como un arpegio de tiempo fijo, `t + i*0.15`, donde `i` es la
posición en el array.

La consecuencia es que **dos piezas distintas con la misma tónica y rotación suenan exactamente igual**.
Un pentominó `I` (cinco celdas en línea) y un `X` (una cruz) son indistinguibles al oído. La geometría
—que es el material del juego— solo decide dónde entra la pieza en el tablero, no qué se escucha.

En `my-app/src/App.tsx` existe un intento inconcluso de resolver esto: `centroid()`,
`angleFromCentroid()` y `assignNotesToCells()`, que ordenan las celdas por su ángulo alrededor del
centroide y le dan a cada una un grado de la escala. **Nunca se llamó desde ningún lado.** Este spec
recupera la idea y la termina; el código original se elimina junto con `my-app` y queda en el historial
de git.

Ese boceto, tal como está, no se puede portar tal cual: tiene tres defectos medidos (ver
`research.md` §Comportamiento real del algoritmo) que hay que resolver antes de cablearlo.

## Solución Propuesta

1. **Cada celda de una pieza colocada es dueña de una nota.** El recorrido angular alrededor del
   centroide define el orden: la celda con menor ángulo recibe el primer grado de la escala, y así.
2. **La celda del centro, si existe, sale del anillo y recibe la tónica.** Es la que hoy rompe todo
   (§Decisiones, D1).
3. **La reproducción sigue ese orden**: el arpegio deja de ser "el orden en que están tipeadas las
   coordenadas" y pasa a ser el recorrido del anillo. El `i` de `t + i*0.15` es la posición angular.
4. **El tablero muestra la nota de cada celda** en lugar de la letra de la pieza repetida cinco veces,
   que hoy no aporta nada una vez colocada.

### Decisiones de diseño

Las tres las esquivaba el código muerto. Se fijan acá porque cambian el resultado audible.

**D1 — La celda en el centroide no tiene ángulo; se le da la tónica.**
`I` y `X` tienen una celda exactamente en el centroide, donde `Math.atan2(0,0)` devuelve `0` en
silencio y la mete en el anillo como si estuviera al este. Se la excluye del ordenamiento angular y se
le asigna el **grado 0** (la tónica). Las 4 celdas restantes se reparten los grados 1–4 por ángulo.
Musicalmente es lo natural: el centro de la figura es su raíz. Resuelve de una las tres anomalías
medidas, porque las tres tienen esta misma causa raíz.

**D2 — Los empates de ángulo se desempatan por radio y después por índice.**
`F`, `I`, `T` y `X` tienen celdas colineales con el centroide (mismo ángulo, distinto radio). Hoy el
orden lo decide que `Array.prototype.sort` sea estable en V8 — es decir, el orden en que alguien tipeó
las coordenadas en `SHAPES`. Se reemplaza por un desempate explícito: **ángulo, luego radio ascendente,
luego índice original**. El tercer criterio es solo para garantizar determinismo total; con los dos
primeros ya no quedan empates reales.

**D3 — El mapeo celda↔grado se calcula sobre la forma canónica y viaja por índice.**
La rotación **no** reordena qué celda recibe qué grado. Se calcula el orden angular una vez sobre
`SHAPES[pieza]` sin transformar, y se lo arrastra por índice —el mismo mecanismo que ya usa
`ANCHOR_INDEX`, que se apoya en que `rotate90` / `reflect` / `normalize` mapean celdas preservando el
orden del array.

El motivo es de legibilidad del sistema, no de implementación: la rotación **ya** cambia la escala
(mayor → menor → blues → mayor transpuesta). Si además reordenara el mapeo espacial, dos cosas
ortogonales cambiarían a la vez y el juego se volvería imposible de "leer" de oído. Con esta decisión
queda: **la rotación cambia qué notas, la forma cambia dónde**. La reflexión sigue invirtiendo el array
de notas (`ns.reverse()`, ya implementado), que compuesto con un mapeo fijo da exactamente el
retrógrado — el comportamiento que el footer de la UI ya promete.

## Criterios de Aceptación

- **AC1** — `assignNotesToCells(shape)` devuelve, para cada una de las 12 piezas, una permutación de
  `[0,1,2,3,4]`: cada celda tiene exactamente un grado y cada grado una celda. Sin duplicados ni
  huecos.
- **AC2** — Para `I` y `X`, la celda que coincide con el centroide recibe el grado `0`, y las otras
  cuatro los grados `1..4` en orden angular (D1).
- **AC3** — El mapeo es **estable bajo rotación y reflexión**: para las 12 piezas × 4 rotaciones × 2
  reflexiones, la celda en el índice `k` del array transformado recibe siempre el mismo grado que en la
  forma canónica (D3).
- **AC4** — No hay empates de ángulo sin resolver: el comparador de D2 produce un orden total estricto
  para las 12 piezas. Test que verifica que dos celdas cualesquiera nunca comparan `0`.
- **AC5** — Al colocar una pieza, el arpegio suena en orden angular. Verificable sin oído: los eventos
  agendados en el Transport llevan los offsets `i*0.15` con `i` = posición angular, comprobado en test.
- **AC6** — Cada celda ocupada del tablero muestra el nombre de **su** nota (`C4`, `D#4`, …) en vez de
  la letra de la pieza.
- **AC7** — `npx tsc -b --noEmit` en 0 y `npm run build` en verde.
- **AC8** — Existe un runner de tests configurado y `npm test` corre en verde. Hoy no hay ninguno (ver
  `research.md` §Deuda adyacente); montarlo es parte de este spec porque AC1–AC5 no son verificables
  sin él.

## Fuera de Alcance

- **Cambiar las escalas o el mapeo pieza→tónica.** `notesForRotation()` y `BASE_MAP` quedan intactos.
  Este spec decide **qué celda toca qué grado**, no qué grados existen.
- **Retirar `PlacedPiece.notes`.** Queda redundante cuando las notas vivan por celda, pero sacarlo
  toca el panel lateral y el efecto de loops. Se deja para su propio spec.
- **Que los loops usen el orden angular.** El `scheduleRepeat` del efecto de sincronización seguirá
  iterando `p.notes` como hoy. Unificar ambos caminos de reproducción es trabajo aparte, y este spec
  ya toca el suficiente.
- **Timing dependiente de la geometría.** Que el radio module la duración, o que la distancia angular
  module el tiempo entre notas, es la extensión natural de esto y es deliberadamente otro spec.
- **Rediseño visual del tablero.** AC6 cambia el texto de la celda, nada más: mismos tamaños, mismos
  colores, mismo layout.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Las celdas de 28px no entran nombres de nota de 3 caracteres (`D#4`) legibles. | AC6 se cumple con el nombre sin octava (`D#`), que es lo que distingue una celda de otra dentro de una pieza — la octava es la misma para las cinco salvo salto de rango. Si aun así no entra, el nombre va al `title` y en la celda queda el grado (`1`–`5`); decisión al implementar, con captura. |
| Montar un runner de tests es un prerrequisito que puede desbordar el spec. | Vitest sobre la config de Vite que ya existe: sin webpack, sin babel, reusa `vite.config.ts`. Las `@testing-library/*` ya están en `package.json`. Acotado en `plan.md` §1. |
| D3 se apoya en que las transformaciones preservan el orden del array. | Es la misma propiedad de la que ya depende `ANCHOR_INDEX` en producción; AC3 la convierte en test explícito en vez de supuesto tácito. |
| El resultado audible puede no gustar. | El riesgo real es de producto, no técnico: quizá el orden angular no "suene" a nada. AC5 verifica que el orden es el especificado, no que sea agradable. Si al escucharlo no aporta, el mapeo se cambia en un solo lugar (`assignNotesToCells`) sin tocar el resto. |

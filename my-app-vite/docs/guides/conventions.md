# Convenciones de Código

## TypeScript

### Nada de `any`

**Cero `any` y cero `@ts-ignore` en el repo.** No es aspiracional: es el estado actual.

Los tres que hubo desaparecieron sin que nadie los atacara de frente. Dos estaban alrededor de la
gestión de loops y se fueron cuando esa lógica se volvió declarativa; el tercero era el `synth` de
Tone, con su `@ts-ignore` por los tipos de constructor genérico, y se fue con Tone.

Los tres estaban tapando un problema de diseño, no de tipos. **Si aparece la tentación de uno nuevo,
sospechar del diseño antes que de TypeScript.**

### Tipos de dominio

```ts
type Cell = [number, number];              // [x, y], y crece hacia abajo
type PieceKey = keyof typeof BASE_MAP;     // derivado, no listado a mano
```

`PieceKey` se deriva de `BASE_MAP` a propósito: agregar una pieza ahí y olvidarse de `SHAPES` o de
`ANCHOR_INDEX` es un error de compilación, no un bug en runtime.

## Geometría

### El orden del array es un invariante

`rotate90`, `normalize` y `reflect` son `map` sobre las celdas: **la celda del índice `k` sigue siendo
la misma celda lógica después de transformar.**

De eso depende `ANCHOR_INDEX`, que guarda la celda de agarre como índice en vez de coordenada, y de eso
dependerá el mapeo celda↔nota del spec 001. Cualquier cambio que filtre, ordene o reagrupe celdas dentro
de esas funciones rompe la colocación de piezas **en silencio**.

Si hace falta transformar celdas de otra forma, escribir una función nueva en vez de modificar estas.

### `y` crece hacia abajo

Las coordenadas son de grilla, no cartesianas: `y` es el índice de fila. Consecuencia práctica: cualquier
cálculo angular (`Math.atan2(dy, dx)`) recorre el círculo en sentido **horario** en pantalla. No está
mal, pero es la clase de cosa que alguien "arregla" por error.

## Estado

- **Sin estado global.** No hay Context, Redux ni Zustand. Todo es `useState` local en `App`.
- **Lo que no es estado de UI, no va en estado.** El contador de ids vive en un `useRef` porque
  cambiarlo no debe re-renderizar. El `AudioContext` y los jobs del motor viven en singletons de módulo
  porque hay uno por pestaña, no uno por componente.
- **Nunca mutar objetos ya entregados a React.** Es literalmente el bug que tuvieron los loops:
  `newPiece._sched = id` después de `setPlaced(prev => [...prev, newPiece])`. Si un dato tiene que
  cambiar después, o va en el estado con su propio `set`, o va afuera de React.
- **Identidad estable para elementos removibles.** `PlacedPiece.id` existe para eso; las `key` de listas
  usan el id, nunca el índice.

## Efectos

Los efectos **reconcilian**, no ejecutan comandos. El efecto de audio observa `[placed, loopPlaced]` y
lleva los jobs del motor a donde deben estar: limpia todo y re-agrega. Los handlers solo cambian estado.

Que limpiar y re-agregar sea aceptable no es casualidad, es una propiedad del diseño: los jobs son
**datos puros** y la fase de los loops vive en el cursor del reloj, que el efecto no toca. Con Tone,
donde cada job era un evento con identidad, el mismo patrón habría reiniciado la fase de todos.

Hoy **ningún efecto del repo hace trabajo asincrónico**, así que no hay flag de cancelación en ningún
lado. Si vuelve a hacer falta, el patrón es el de siempre (`let cancelled = false` capturado en el
closure, chequeado después del `await`, seteado en la limpieza).

Y ojo con las limpiezas asincrónicas: en StrictMode pueden correr **después** del siguiente efecto. Si
la limpieza tiene que ganarle al re-montaje, tiene que ser sincrónica — es el caso del efecto de
desmontaje que llama a `stopClock()` y `clearJobs()`. Ver
[audio.md](../architecture/audio.md#reconciliación-de-loops).

## Comentarios

**Los comentarios explican el porqué, no el qué.** El código dice qué hace; el comentario existe para lo
que no se puede leer del código: una decisión, una restricción, un bug evitado.

Bien:

```ts
// Se guarda como índice dentro de SHAPES[pieza] en vez de como coordenada porque
// rotar, reflejar y normalizar mapean cada celda preservando el orden del array.
const ANCHOR_INDEX: Record<PieceKey, number> = { … };
```

Mal:

```ts
// Mapea cada pieza a un índice
const ANCHOR_INDEX: Record<PieceKey, number> = { … };
```

Los comentarios de este repo están **en español**, igual que los mensajes de commit y los specs.

## Estilos

Tailwind 4, sin archivo de config. Las utilidades se escriben inline en el JSX. Para lógica condicional
de clases, template literals:

```tsx
className={`w-7 h-7 border ${occ ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-100'}`}
```

Cuando las ramas pasan de dos, calcular la clase en una variable antes del JSX (como hace el `tone` de
las celdas del tablero) en vez de anidar ternarios.

## Commits

- En español, imperativo, sin scope de Conventional Commits.
- El cuerpo explica **el porqué y la causa raíz**, no el listado de archivos tocados — eso ya está en el
  diff.
- Los cambios de borrado van en su propio commit, para que revertirlos sea trivial.

# Convenciones de Código

## Organización de `src/`

### La dirección de dependencia

`src/` son cuatro capas con **una sola dirección**:

```
types/ ← constants/ ← módulos              types/ no importa nada de afuera de types/
transform.ts ← board.ts                    domain/ no importa nada de fuera de domain/
             ← music.ts ← invariants.ts    audio/  no importa nada de fuera de audio/
                                           components/ y App.tsx importan de las dos
```

`domain/` y `audio/` son **hermanos sin aristas entre ellos**: el motor habla números MIDI y no sabe
qué es un pentominó.

**La verifica el linter, no la revisión.** `eslint.config.js` tiene un override por capa con
`@typescript-eslint/no-restricted-imports` — la variante de `typescript-eslint` y no la core, porque
también ve los `import type`, que son justo los que un refactor descuidado usaría para colarse. Agregar
a mano un import prohibido falla `pnpm lint` con el mensaje de la capa; está probado desde un módulo y
desde un test.

**Los patrones cubren la profundidad actual.** Llevan `../` y `../../` porque `types/`, `constants/` y
`__tests__/` están un nivel más abajo que los módulos. Si algún día aparece `domain/sub/x.ts`, **hay que
agregar el patrón**: esto es una red, no una prueba formal.

El efecto más importante es indirecto: `voice.ts` y `scheduler.ts` reciben el `AudioContext` por
parámetro y **no pueden** tocar el singleton, porque vive en `engine.ts` y ellos no lo importan. El
invariante que antes sostenía un comentario ahora lo sostiene el grafo de imports — y es lo que hace
testeable al audio.

### Cada rol tiene su carpeta

**Los módulos contienen comportamiento; los datos, los tipos y los valores fijos viven en la carpeta de
su rol.** Un `.ts` de capa tiene funciones y nada más. El archivo repite el nombre del módulo con el
sufijo del rol: `Cell` no es `types/index.ts`, es `domain/types/transform.types.ts`, el contrato del
módulo `transform.ts`.

| Rol | Carpeta | Archivo |
|---|---|---|
| lógica de un concern | la capa | `<módulo>.ts` |
| tipo que cruza un límite | `<capa>/types/` | `<módulo>.types.ts` |
| dato o valor fijo | `<capa>/constants/` | `<módulo>.constants.ts` |
| test de un módulo | `<capa>/__tests__/` | `<módulo>.test.ts` |
| helper de test | `<capa>/__tests__/` | nombre descriptivo |
| componente | `components/` | `PascalCase.tsx`, único export |
| hook | `<capa>/hooks/` | `useCamelCase.ts` |
| validación de datos externos | `<capa>/schemas/` | `<módulo>.schema.ts` |
| helper interno de un módulo | `<capa>/utils/` | `<módulo>.utils.ts` |
| helper genérico sin dominio | `src/lib/` | `<tema>.ts` |

**Los módulos no declaran constantes.** Si aparece un literal con significado, va a `constants/`. Los
únicos números que quedan en un módulo son los que no tienen nombre posible: un `+ 1` de índice, un
`% 12` que es la aritmética de las clases de altura, el `440`/`69` que *define* el anclaje MIDI.

El motivo es medible, no estético: antes de la separación había cuatro pares de números que tenían que
coincidir y nada sincronizaba — el `0.35` de `NOTE_DUR` estaba también como default de `scheduleVoice`,
el `110` del tempo estaba en la UI y en el motor, y el tamaño de celda convivía con un `w-7 h-7` que
tenía que valer lo mismo.

De ese ejemplo ya no queda ninguno de los dos símbolos: el spec 008 reemplazó `NOTE_DUR` por
`NOTE_INTERVALS` —que se mide en intervalos y no en segundos— y le sacó el default a `scheduleVoice`,
porque una duración que depende del tempo no puede tener un valor por defecto que no lo mire.

Las `Props` de cada componente son la excepción: se quedan **inline y sin exportar**, porque
`react-refresh/only-export-components` obliga a que el componente sea el único export del `.tsx`.

**Las carpetas de rol se crean cuando tienen su primer archivo.** Hoy no hay `hooks/`, `utils/`,
`schemas/` ni `lib/`: estarían vacías.

<a id="tabla-de-crecimiento"></a>

| Cuando aparezca… | Va a |
|---|---|
| un segundo concern de CSS (tokens `@theme`, capa base) | `styles/theme.css` + `styles/base.css`, importados por `styles/index.css` |
| tests que no mapean 1:1 a un módulo (e2e, smoke, visual) | `tests/` en la raíz, fuera de `src/` |
| un helper de test compartido **entre capas** | `src/testing/` |
| validación de datos externos (persistir, compartir por URL) | `<capa>/schemas/` + zod — **decisión con spec propio** |
| un asset importado desde código | `src/assets/` |
| un provider o un router | `src/app/`, con `App.tsx` adentro |
| una segunda pantalla o modo | recién ahí `src/features/` tiene sentido |
| estado que necesitan dos ramas del árbol | subir el estado, o un hook con propósito específico en `<capa>/hooks/` — **no** un store global |

### Sin barrels, con extensión, sin alias

- **Ningún `index.ts` de re-exportación.** `export * from './x'` hace cargar archivos de más y vuelve al
  módulo responsable de propagar esas re-exportaciones por HMR. Cada import apunta al módulo concreto.
- **Extensión explícita en todo import local**: `./domain/transform.ts`, no `./domain/transform`.
  Reduce operaciones de resolución, y sobre todo **node crudo la exige** (`ERR_MODULE_NOT_FOUND`), que
  es lo que permite cargar `domain/` sin compilar. Ojo: omitirla **no rompe la app** —Vite resuelve
  igual—, así que el error sería invisible del lado del navegador. De ahí que sea regla escrita, y
  desde el spec 006 hay quien la ejerce: el MCP server carga `src/` con node crudo, así que
  `pnpm mcp:test` falla al primer import sin extensión.
- **Sin alias de paths** (`@/domain/…`). La profundidad máxima es uno, así que el beneficio es
  cosmético, y node no conoce los alias de Vite.
- **Un componente por archivo**, y ningún export que no sea el componente en un `.tsx`. No es
  preferencia estilística: es lo que el lint ya exige, y la granularidad de Fast Refresh es el módulo.

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
// domain/types/transform.types.ts
export type Cell = [number, number];       // [x, y], y crece hacia abajo
// domain/types/pieces.types.ts
export type PieceKey = 'F' | 'I' | … ;     // declarado explícito, no derivado
```

`PieceKey` se declara a mano y `BASE_MAP` se tipa `Record<PieceKey, number>`, no al revés: el tipo de
las piezas sale de la geometría y no de la tabla musical, y **agregar una pieza sin darle tónica es un
error de compilación**. Antes se derivaba de `keyof typeof BASE_MAP` y ese caso pasaba en silencio.

### Nada de `enum`

**No hay ninguno en el repo, y no puede haberlo**: `tsconfig.app.json` tiene `erasableSyntaxOnly: true`,
que los rechaza con `TS1294`. No es una restricción a levantar — es la misma opción que garantiza que
el código sea *type-strippable*, o sea lo que permite que node cargue `src/domain/` sin compilar. Un
`enum` emite código en runtime, por eso queda afuera.

El reemplazo para cualquier conjunto cerrado reparte sus dos mitades en las carpetas de rol:

```ts
// constants/rotation.constants.ts  — el valor
export const ROTATION = { DEG_0: 0, DEG_90: 1, DEG_180: 2, DEG_270: 3 } as const;
// types/rotation.types.ts          — el tipo
export type Rotation = (typeof ROTATION)[keyof typeof ROTATION];
```

## Geometría

### El orden del array es un invariante

`rotate90`, `normalize` y `reflect` (en `domain/transform.ts`) son `map` sobre las celdas: **la celda
del índice `k` sigue siendo la misma celda lógica después de transformar.**

De eso depende `ANCHOR_INDEX`, que guarda la celda de agarre como índice en vez de coordenada; de eso
depende la fase por pieza, que lee la columna del ancla por índice sobre `PlacedPiece.cells`; y de eso
dependerá el mapeo celda↔nota del spec 001. Cualquier cambio que filtre, ordene o reagrupe celdas dentro
de esas funciones rompe la colocación de piezas **en silencio**.

Hoy hay una red: `checkArrayOrder()` de `domain/invariants.ts` lo verifica sobre las 96 combinaciones, y
su propio test comprueba que el chequeo **da rojo** cuando una transformación reordena.

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

Los efectos **reconcilian**, no ejecutan comandos. El efecto de audio observa `[placed, playing]` y
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
className={`border ${occ ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-100'}`}
```

Cuando las ramas pasan de dos, calcular la clase en una variable antes del JSX (como hace el `tone` de
las celdas del tablero) en vez de anidar ternarios.

**Lo que sale de una constante va por estilo inline, no por clase.** Tailwind escanea el fuente, así que
una clase interpolada (`w-[${CELL_PX}px]`) no se generaría. Por eso las celdas del tablero y de la
previsualización se dimensionan con `style={{ width: CELL_PX, … }}`: es lo que hace que `CELL_PX` sea de
verdad una sola declaración. Es la excepción, no el modo por defecto — todo lo demás sigue siendo
utilidades inline.

## Commits

- En español, imperativo, sin scope de Conventional Commits.
- El cuerpo explica **el porqué y la causa raíz**, no el listado de archivos tocados — eso ya está en el
  diff.
- Los cambios de borrado van en su propio commit, para que revertirlos sea trivial.

# Research 005 — Modularización de `src/` en capas

Todo lo de acá está **medido** o **citado de la documentación oficial**. Los principios de diseño se
investigaron con context7 sobre Vite, React y bulletproof-react; no hay nada supuesto.

> **Los `$ npx …` y `npm test` de este archivo quedan como se corrieron**, antes de que el repo migrara
> a pnpm. Son transcripciones de una sesión real y reescribirlas sería inventar una medición que no se
> hizo. Siguen siendo reproducibles —`npx` resuelve desde `node_modules/.bin`, que pnpm también
> puebla—; el equivalente de hoy es `pnpm exec …` y `pnpm test`. Los comandos **a ejecutar** —los del
> `spec.md`, el `plan.md` y el `tasks.md`— sí están en pnpm.

## 1. Estado actual, medido

```
$ find src -type f | wc -l              →  8
$ wc -l src/**/*.ts*                    →  855
```

| Archivo | Líneas | Qué contiene | Problema |
|---|---|---|---|
| `App.tsx` | **327** | dominio puro (23–99) + componente (101–327) | tres responsabilidades en un archivo; el dominio no puede exportarse (§2) |
| `audio/engine.ts` | **244** | tres bloques documentados: síntesis, scheduler, singletons | la separación es prosa, no estructura (§7) |
| `audio/engine.test.ts` | 180 | los 17 tests del repo | ya está partido en los tres bloques (§7) |
| `audio/test-context.ts` | 85 | helpers de `OfflineAudioContext` | ok |
| `index.tsx` | 13 | `createRoot` + `StrictMode` | nombre heredado de CRA (§9) |
| `index.css`, `vite-env.d.ts` | 6 | — | ok |
| `setupTests.ts` | 5 | `import '@testing-library/jest-dom'` | **muerto**: `vite.config.ts` no declara `setupFiles` |

Desglose del `App.tsx` de hoy:

| Rango | Líneas | Qué es |
|---|---|---|
| 23–99 | **77** (3.114 bytes) | dominio puro: tipos, `SHAPES`, `ANCHOR_INDEX`, las 4 transformaciones, `BASE_MAP`, `notesForRotation`, `midiName` |
| 101–134 | 34 | estado (`useState` × 6), `useRef`, dos `useMemo` derivados, `anchor` |
| 136–205 | 70 | `cellsAt`, `isValid`, `handleCellClick`, `resetBoard`, los dos efectos, `toggleClock`, `cellOccupied`, el fantasma |
| 207–327 | **121** | JSX en tres paneles: paleta 210–255 · tablero 257–303 (con la previsualización anidada en 286–301) · colocadas 305–322 |

## 2. La medición que decide el spec: el lint ya prohíbe la alternativa

Se creó un `.tsx` que exporta una constante además del componente y se corrió el lint del repo, sin
tocar la config:

```
$ npx eslint src/_probe.tsx
error  Fast refresh only works when a file only exports components.
       Use a new file to share constants or functions between components
       react-refresh/only-export-components
```

`eslint.config.js` extiende `reactRefresh.configs.vite`, así que la regla está activa como **error**.
Consecuencias directas:

- **`export const SHAPES` en `App.tsx` no compila el lint.** Las puras están sin exportar porque es lo
  único permitido, no por descuido.
- Sin export no hay test, no hay reuso y no hay tooling. La cobertura del dominio es **cero** — los 17
  tests son todos de `audio/engine.test.ts`, verificado leyendo el archivo.
- Entre lo no cubierto está el invariante que CLAUDE.md marca como el más peligroso: el del orden del
  array de celdas, cuya rotura *"no produce ningún error visible"*.

No es un argumento de estilo. **La organización actual prohíbe activamente verificar el dominio.**

### La misma regla decide la separación entre el entry y el componente raíz

Segundo probe, con el mismo método: un `.tsx` que declara el componente **y** lo monta en el nivel de
módulo, o sea los dos archivos fusionados en uno.

```
$ npx eslint src/_probeA.tsx     # function Shell() {...} + createRoot(...).render(<Shell/>)
error  Fast refresh only works when a file has exports.
       Move your component(s) to a separate file      react-refresh/only-export-components

$ npx eslint src/index.tsx       # el entry actual: solo monta, no declara componentes
(sin errores)
```

Los dos mensajes de la misma regla delimitan la estructura: **el componente no puede vivir en el
archivo que arranca la app, y las constantes no pueden vivir en el archivo del componente.** La
consecuencia práctica de fusionarlos sería recarga completa en cada edición de UI —perdiendo el
tablero armado— porque la granularidad de Fast Refresh es el módulo y un módulo con efecto de arranque
y sin export de componente no es frontera de refresh.

## 3. Lo que está atrapado dentro del componente

`cellsAt` (136–140), `isValid` (142–149) y `cellOccupied` (193–198) son puras en todo salvo en dónde
están declaradas: cierran sobre `anchor`, `transformedShape` y `placed` en vez de recibirlos.

Costo concreto ya detectado: el plan original del spec 006 iba a escribir su propio
`mcp-server/src/board.ts` con la misma regla de colocación para poder validar tableros. **Dos copias
de la regla del juego**, divergiendo desde el primer cambio. Con `domain/board.ts` el server importa
la única implementación — la corrección ya está aplicada en el plan del 006.

## 3b. Constantes: cuatro pares de números que deben coincidir y nada sincroniza

Inventario de literales con significado, con `grep`:

| Constante | Dónde está hoy | Problema |
|---|---|---|
| **`0.35`** | `engine.ts:180` (`const NOTE_DUR`) **y** `engine.ts:52` (default `dur` de `scheduleVoice`) | **duplicado**: cambiar uno deja el otro |
| **`110`** | `App.tsx:105` (`useState(110)`) **y** `engine.ts:213` (`let bpm = 110`) | **duplicado**: el tempo inicial de la UI y el del motor son el mismo número escrito dos veces |
| **`28px`** | `App.tsx:263` (`gridTemplateColumns`) **y** `App.tsx:279` (`w-7 h-7`) | **acoplado**: `w-7` es 1.75rem = 28px; si uno cambia, la grilla se desalinea |
| **`20px`** | `App.tsx:289` **y** `App.tsx:295` (`w-5 h-5`) | idem, en la previsualización |
| `0.8` | `engine.ts:53` | velocity por defecto, sin nombre |
| `0.3` | `engine.ts:169` | ganancia del master, sin nombre |
| `0.02` / `0.05` | `engine.ts:196` / `engine.ts:236` | dos delays distintos que se leen como lo mismo |
| `4` | `App.tsx:127` | la octava base, sin nombre |
| `60` / `160` | `App.tsx:242` | rango del slider de tempo |

Las cuatro primeras filas son el argumento fuerte: **no es una preferencia de orden, es que hoy hay
cuatro pares de valores que tienen que ser iguales y ningún mecanismo lo garantiza.** Extraerlos a
`constants/` deja una sola declaración de cada uno.

`0.35` y `110` se resuelven del todo. `28px`/`20px` tienen una vuelta: `w-7 h-7` es una **clase estática
de Tailwind**, y Tailwind escanea el fuente, así que `w-[${CELL_PX}px]` no se generaría. Para que
`CELL_PX` sea una sola fuente, las celdas se dimensionan con estilo inline y pierden esas clases — es el
único punto del spec que toca el markup, y está anotado como riesgo.

## 3c. `enum`: no hay, y el repo no los permite

```
$ grep -rn "enum " src/     →  (ninguno)

$ npx tsc     # export enum Rotation { Deg0 = 0, Deg90 = 1 }
error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.

$ npx tsc     # const-object + union type
exit 0
```

`tsconfig.app.json` tiene `erasableSyntaxOnly: true`, que **rechaza los `enum`** (y las parameter
properties). No es una restricción a levantar: es exactamente la opción que garantiza que el código sea
type-strippable, o sea lo que permite que node cargue `src/domain/` sin compilar — el cimiento del
[spec 006](../006-mcp-server-de-dominio-ejecutable/spec.md). Un `enum` emite un objeto en runtime; por
eso queda afuera.

El reemplazo idiomático reparte sus dos mitades justo en las carpetas de rol que este spec define: el
valor en `constants/`, el tipo derivado en `types/`. El candidato real es la rotación, hoy un `number`
sin acotar comparado contra `0|1|2|3` en cuatro lugares — queda en seguimiento porque cambia firmas.

## 4. Vite: qué dice su documentación (context7)

**Barrel files — problema de performance documentado.** La guía de performance de Vite muestra
exactamente este patrón como causa de *"slower initial page loads due to unnecessary file fetching"*:

```js
export * from './color.js'
export * from './dom.js'
export * from './slash.js'
```

**Rutas explícitas — recomendación directa.** La misma guía, sección *Reduce Resolve Operations*:
*"it is advisable to use explicit import paths, for example `import './Component.jsx'`"*, y reducir la
lista de `resolve.extensions`. Es el respaldo de D4: `./domain/transform.ts`, con extensión.

**HMR y re-exportaciones.** La doc de `hot.accept` advierte que si un módulo frontera de HMR
re-exporta imports de una dependencia, **queda responsable de actualizar esas re-exportaciones** (y
tienen que ser `let`), y que los importadores de más arriba no se notifican. Segundo argumento
independiente contra los barrels.

**`resolve.alias` existe** y acepta forma de objeto o de array, con el orden de entradas importando.
Se descarta igual (D5): la profundidad máxima acá es 1, y **node no conoce los alias de Vite**, así
que un alias rompería el spec 006. Nota relacionada de la doc de troubleshooting: el casing incorrecto
en un import rompe el HMR — un motivo más para escribir rutas exactas.

## 5. React: qué dice su documentación (context7)

**Pureza como regla, no como consejo.** *Components and Hooks must be pure*: idempotentes, sin efectos
en el render, sin mutar valores no locales. Es la definición que el dominio cumple trivialmente
**cuando está afuera** del componente, y que hoy nadie puede verificar.

**Componentes de un solo uso son legítimos.** *"Los componentes son una forma cómoda de organizar el
código de UI y el markup, incluso si algunos se usan una sola vez"*. Responde la objeción obvia a
`PiecePalette`, `Board`, `PiecePreview` y `PlacedList`: ninguno se reusa, y aun así corresponde.

**Hooks: cuándo sí y cuándo no.** *"Los custom hooks solo comparten lógica con estado, no el estado"*,
*"su código debe ser puro, como el del componente"*, y sobre todo: **"no crees hooks como `useMount`;
mantené su propósito específico"**. Es el fundamento de D8 — un `usePentominoBoard` que envuelva todo
el estado de la app es exactamente el hook sin propósito específico que la doc desaconseja. También:
*"depende de vos dónde elegir los límites de tu código"* — la doc no manda una estructura, así que la
justificación tiene que salir del repo, y sale (§2, §3).

## 6. bulletproof-react: qué se toma y qué se descarta (context7)

Estructura que propone: `app/ · assets/ · components/ · config/ · features/ · hooks/ · lib/ ·
stores/ · testing/ · types/ · utils/`, con **flujo unidireccional** entre carpetas, y —lo más
valioso— **hecho cumplir por el linter** con `import/no-restricted-paths` y zonas:

```js
{ target: './src/features', from: './src/app' }                    // app puede importar features, no al revés
{ target: ['./src/components', './src/hooks', './src/lib', './src/types', './src/utils'],
  from: ['./src/features', './src/app'] }                          // lo compartido no importa de arriba
```

**Se toma:** la dirección única entre capas y la idea de que la arquitectura se verifica con el
linter, no con la revisión.

**Se descarta el árbol.** Esa estructura resuelve una app de producción con router, data fetching,
estado global y muchas features. Acá: una sola pantalla (`features/` sería una carpeta con todo
adentro), CLAUDE.md prohíbe estado global (`stores/` vacía), no hay servidor (`api/`, `config/`
vacías), y `hooks/` y `utils/` son justamente los cajones donde termina lo que no se supo nombrar.
Copiarlo sería la misma clase de cargo-culting que se descartó en el spec 006 con el índice de
`ts-morph`: importar la solución de un problema que este repo no tiene.

**Adaptación:** la variante core de la regla, `@typescript-eslint/no-restricted-imports` con
`patterns`, que no agrega dependencia (`typescript-eslint` ya está) y además **ve los `import type`**,
que con `verbatimModuleSyntax: true` son los que un refactor descuidado usaría para colarse.

**Lo que sí se toma de su forma de nombrar:** bulletproof-react organiza cada feature en
**subcarpetas por rol** (`api/`, `components/`, `hooks/`, `stores/`, `types/`, `utils/`) en vez de
archivos sueltos con sufijos. Es la estructura que se adopta acá, aplicada por capa en vez de por
feature: `<capa>/types/`, `<capa>/__tests__/`, y las que aparezcan (`schemas/`, `utils/`, `hooks/`).
Dos consecuencias que conviene tener escritas:

- **El rol se lee dos veces:** en la carpeta (`types/`) y en el nombre (`board.types.ts`). Redundante a
  propósito — el nombre del archivo sobrevive a que alguien lo abra desde un buscador, donde la carpeta
  no se ve.
- **`<capa>/types/` sin imports es el contrato consumible.** El spec 006 puede tipar sus respuestas
  importando de ahí sin arrastrar una línea de lógica, y con `verbatimModuleSyntax` esos imports
  desaparecen del bundle.

El costo real de la carpeta por rol es la cohesión: `Cell` deja de estar al lado de `rotate90`. Se
acota con una regla de contenido, no de ubicación — **los comentarios de invariante se quedan con el
código que los sostiene**, no viajan al archivo de tipos. Es lo que evita que `transform.ts` quede
como un cascarón.

## 7. El corte de `audio/` ya existe

`engine.ts` lo documenta en su encabezado —síntesis · scheduler · capa de aplicación— con el
invariante duro: *"las dos primeras reciben el contexto por parámetro y no tocan el singleton: es lo
que permite renderizarlas con un `OfflineAudioContext`"*.

Y el test lo confirma: `engine.test.ts` ya está partido en los mismos cuatro grupos.

| `describe` actual | Tests | Va a |
|---|---|---|
| `midiToHz` | 1 | `voice.test.ts` |
| `sintesis` | 6 | `voice.test.ts` |
| `scheduler` | 8 | `scheduler.test.ts` |
| `scheduler + sintesis integrados` | 2 | `integration.test.ts` |
| | **17** | |

Conteo verificado corriendo la suite (`npm test` → `Tests 17 passed (17)`, 405 ms) y contando los
`it` por `describe`. El reparto es 7 + 8 + 2, y AC9 exige que la suma después del corte siga siendo
17: si baja, algo se perdió al mover.

Detalle a corregir al partir: los tests del bloque `scheduler` importan `ARPEGGIO_SPREAD`, que es una
constante de la **capa 3**. Después del corte, `scheduler.test.ts` usa su propio literal — el test de
la capa 2 no debe alcanzar a la capa 3 (AC10).

Beneficio para el spec 006: importar `scheduler.ts` en un proceso de node **sin** arrastrar el módulo
de singletons (`let ctx`, el `Map` de jobs, `window.setInterval`). Hoy funciona por casualidad —
medido: `node` carga `engine.ts` entero sin fallar porque el código de nivel de módulo son solo
declaraciones— pero es una casualidad que no conviene depender de.

## 8. El grafo resultante, y por qué no tiene ciclos

```
nivel 0   domain/types/{transform,pieces}.types.ts      (0 imports)
          audio/types/{voice,scheduler}.types.ts        (0 imports)
              ↑
nivel 1   domain/types/board.types.ts                   (2 tipos hermanos)
          domain/constants/{pieces,board,music}.constants.ts    (solo tipos)
          audio/constants/{voice,scheduler,engine}.constants.ts (solo tipos)
              ↑
nivel 2   domain/transform.ts ← domain/board.ts
                              ← domain/music.ts ← domain/invariants.ts
          audio/voice.ts ← audio/scheduler.ts ← audio/engine.ts
              ↑
nivel 3   components/*.tsx  →  domain/*, audio/engine.ts, components/constants/
          App.tsx           →  domain/*, audio/engine.ts, components/*
          main.tsx          →  App.tsx, styles/index.css
```

Las hojas son las carpetas `types/`, que no importan nada — salvo `board.types.ts`, que importa dos tipos
de sus hermanos y sigue sin salir de `types/`. Encima de ellas, `constants/`, que **solo importa tipos**:
el spec 006 puede leer `SHAPES` sin arrastrar una función. Ningún módulo de `domain/` importa de `audio/`
ni al revés: son hermanos. Hoy ya se cumple —el motor habla números MIDI y no conoce pentominós— y el
override del linter lo fija.

**`domain/pieces.ts` no aparece en el nivel 2 y es a propósito:** sus únicos habitantes eran `SHAPES` y
`ANCHOR_INDEX`, dos tablas de datos sin una sola función. Al sacar las constantes queda vacío, así que se
disuelve en `constants/pieces.constants.ts`. Es la única consecuencia estructural de la regla, y deja el
árbol más honesto: el archivo pasa a llamarse por lo que es.

**Un cambio de tipado que aparece solo al mover.** Hoy `PieceKey` se deriva de `keyof typeof BASE_MAP`,
o sea que el tipo de las piezas sale de la tabla **musical**: la geometría depende de la escala. Al
declararlo explícito en `types/pieces.types.ts`, `BASE_MAP` pasa a ser `Record<PieceKey, number>` y
**agregar una pieza sin tónica se vuelve error de compilación**, que hoy no lo es. Es la única firma que
el spec cambia, y no cambia comportamiento.

Ningún módulo de `domain/` importa de `audio/` ni al revés: son hermanos. Hoy ya se cumple —el motor
habla números MIDI y no conoce pentominós— y el override del linter lo fija.

## 9. Detalles medidos del entry y de la limpieza

```
$ grep -rn "index.tsx" --include="*.md" --include="*.html" .
docs/architecture/directory-structure.md:24
docs/architecture/overview.md:17
docs/guides/troubleshooting.md:50
index.html:19
```

Cuatro menciones: renombrar a `main.tsx` es el archivo, la línea de `index.html` y tres líneas de doc.

`index.tsx` además hace `import React from 'react'` solo para `React.StrictMode`; con
`jsx: "react-jsx"` (que el tsconfig ya usa) alcanza `import { StrictMode } from 'react'`.

`setupTests.ts`: 5 líneas, y `vite.config.ts` **no** declara `setupFiles`, así que nada lo carga.
Cuando lleguen tests de componentes van a necesitar ese bloque de config de todos modos, así que
mantener el archivo no adelanta nada. Se borra en commit propio (convención de CLAUDE.md).

### `index.css` y por qué `styles/` es la excepción de una carpeta para un archivo

Medido: **15 líneas, 531 bytes.** Contenido real: `@import "tailwindcss"` más un `body` (margen, stack
de fuentes del sistema, antialiasing, `background-color: #f8fafc`) y un `code` (stack monoespaciado).

El motivo de anticipar la carpeta acá y no en otro lado: con **Tailwind 4 el CSS es donde se configura
el diseño**. Verificado en el repo — no hay `tailwind.config.*` ni `postcss.config.*`; la configuración
es el plugin `@tailwindcss/vite` en `vite.config.ts` más el `@import "tailwindcss"` de esta hoja. Es
decir que **todo lo que se personalice (tokens `@theme`, capa base, utilidades propias) entra acá
adentro**, y en el momento en que se toquen colores o tipografías este archivo se parte en dos o tres.
Con `styles/` ya creada, ese crecimiento no vuelve a mover el import del entry.

Es la única carpeta del spec que se crea con un solo archivo adentro, y la razón es esa: **es el archivo
del que se sabe que va a crecer.**

## 10. Decisiones que entran al `plan.md`

1. Cuatro capas con dirección única: `domain/` y `audio/` sin aristas entre sí, `components/` y
   `App.tsx` arriba (§8).
2. Dirección verificada por `@typescript-eslint/no-restricted-imports` en overrides por carpeta, sin
   dependencia nueva (§6). Los patrones necesitan `../` **y** `../../`, porque `types/` y `__tests__/`
   están un nivel más abajo que los módulos.
3. **Una carpeta por rol dentro de cada capa** (`types/`, `constants/`, `__tests__/`, y las que
   aparezcan), con el archivo nombrado `<módulo>.<rol>.ts` (§6). Se crean solo cuando tienen contenido:
   nada de carpetas vacías.
4. **`<capa>/types/` sin imports y `<capa>/constants/` importando solo tipos**, como contrato
   consumible. **Los módulos `.ts` de la capa no declaran constantes** (§3b); los comentarios viajan con
   el dato o la función que explican, nunca quedan huérfanos (§6).
5. **Nada de `enum`**: el `erasableSyntaxOnly` del repo los rechaza y es lo que sostiene el spec 006.
   Conjunto cerrado = const-object en `constants/` + union type en `types/` (§3c).
6. Sin barrels y con extensión explícita en todo import local (§4).
7. Sin alias de paths (§4, y el spec 006).
8. `domain/` en **cuatro** módulos —`transform`, `board`, `music`, `invariants`— más tres archivos de
   tipos y tres de constantes (§1, §3, §8). **`pieces.ts` se disuelve**: era solo `SHAPES` y
   `ANCHOR_INDEX`, o sea datos, así que pasa entero a `constants/pieces.constants.ts`. `PieceKey` se
   declara explícito en vez de derivarse de `BASE_MAP` (§8).
9. `audio/` en tres módulos siguiendo los `describe` existentes, más dos archivos de tipos y tres de
   constantes; `scheduler.test.ts` sin importar de la capa 3 (§7).
10. Cuatro componentes presentacionales, uno por archivo, con sus `Props` inline; sin hooks propios (§5).
    Sus constantes de layout en `components/constants/layout.constants.ts` (§3b).
11. `index.tsx` → `main.tsx`; `index.css` → `styles/index.css`; `setupTests.ts` se borra (§9).
12. Fases en este orden: tipos+constantes+dominio → tablero+invariantes → audio → componentes →
    entry/estilos/limpieza → linter+docs. Las dos primeras traen los tests **antes** de tocar la UI.

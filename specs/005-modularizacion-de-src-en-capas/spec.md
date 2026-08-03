# Spec 005 — `src/` en capas: dominio, audio y UI con dirección de dependencia

> Sin ticket: este repo no tiene tablero. Ver [`specs/README.md`](../README.md).
>
> **No cambia comportamiento.** Ni una nota distinta, ni un pixel distinto. Es reorganización más los
> primeros tests del dominio, que hoy son cero.
>
> Habilita al [spec 006](../006-mcp-server-de-dominio-ejecutable/spec.md) y le mejora el terreno a
> los specs [001](../001-notas-por-celda-en-orden-angular/spec.md),
> [003](../003-visualizacion-de-la-senal-con-analysernode/spec.md) y
> [004](../004-fase-por-pieza-la-columna-como-posicion-en-el-compas/spec.md).

## Problema

`src/` son 8 archivos y 855 líneas, y **dos archivos concentran 571**: `App.tsx` (327) y
`audio/engine.ts` (244). No es un problema de tamaño —a esta escala el archivo único fue una decisión
deliberada y correcta— sino de **qué impide la organización actual**.

### 1. El lint del repo prohíbe testear el dominio

Las 77 líneas de funciones puras de `App.tsx` (líneas 23–99: `SHAPES`, `ANCHOR_INDEX`, `rotateN`,
`reflect`, `BASE_MAP`, `notesForRotation`, `midiName`…) **no están exportadas**. No es un olvido: es
lo único que el lint permite. Medido, con la config del repo tal como está:

```
$ npx eslint src/_probe.tsx        # un .tsx que exporta una constante además del componente
error  Fast refresh only works when a file only exports components.
       Use a new file to share constants or functions between components
       react-refresh/only-export-components
```

`eslint.config.js` extiende `reactRefresh.configs.vite`, así que **exportar el dominio desde
`App.tsx` es un error de lint**. Y sin export no hay test, no hay reuso y no hay tooling posible. La
organización actual no es neutral: **condena al dominio a no ser verificable.** El resultado se mide
solo — los 27 tests del repo son todos de `src/audio/`; la geometría y la música tienen
**cero cobertura**, incluido el invariante que CLAUDE.md marca como el más peligroso del repo, el del
orden del array de celdas, cuya rotura *no produce ningún error visible*.

### 2. Hay lógica de dominio atrapada dentro del componente

`cellsAt`, `isValid` y `cellOccupied` son funciones puras de tablero declaradas **dentro** de `App()`,
cerrando sobre `anchor`, `transformedShape` y `placed`:

```ts
function isValid(cells: Cell[]): boolean{
  if (cells.some(([x,y])=> x<0 || y<0 || x>=GRID_W || y>=GRID_H)) return false;
  for (const p of placed){ /* … */ }
}
```

No tienen nada de React: son reglas del juego. Atrapadas ahí no se pueden testear ni reusar, y el
[spec 006](../006-mcp-server-de-dominio-ejecutable/plan.md) las iba a **reimplementar** en su
`mcp-server/src/board.ts` — dos copias de la regla de colocación, divergiendo desde el día uno. Ese
plan ya se corrigió apoyándose en este spec.

### 3. La separación en capas de `audio/` existe solo como prosa

`engine.ts` documenta tres bloques —síntesis, scheduler, capa de aplicación— y un invariante fuerte:
*"las dos primeras reciben el contexto por parámetro y no tocan el singleton: es lo que permite
renderizarlas con un `OfflineAudioContext`"*. Ese invariante lo sostiene un comentario y la buena
memoria de quien edite. Nada estructural impide que mañana `scheduleVoice` llame a `audio()` y el
audio deje de ser testeable.

Que el corte es real y no inventado se ve en el propio test: `engine.test.ts` ya está partido en
`describe('midiToHz')`, `describe('sintesis')`, `describe('scheduler')` y
`describe('scheduler + sintesis integrados')`. **Los módulos existen; les falta el archivo.**

### 4. Cuatro specs abiertos empujan en la misma dirección

| Spec | Qué necesita de acá |
|---|---|
| 001 — notas por celda | tiene anotado *"evaluar extraer las puras a `src/notes.ts`"* y su plan dice que es *"lo preferible"*; sus tests de `degreeByCellIndex` necesitan el módulo |
| 003 — visualización | agrega un canvas y un mapeo puro bins→barras: sin lugar donde ponerlo, cae en `App.tsx` |
| 004 — fase por pieza | reescribe `collectHits`: mejor hacerlo en un `scheduler.ts` de 50 líneas que en un `engine.ts` de 244 |
| 006 — MCP server | **no puede existir sin esto**: node no carga `.tsx` y las puras no están exportadas |

## Solución propuesta

Cuatro capas en carpetas, con **una sola dirección de dependencia**, sin barrel files, con extensiones
explícitas en los imports, y con el lint verificando la dirección en vez de confiar en la revisión.

```
src/
├── main.tsx                  entry — createRoot + StrictMode
├── vite-env.d.ts
├── App.tsx                   estado y composición. Ninguna función pura, ningún literal de dominio
├── styles/
│   └── index.css             @import "tailwindcss" + estilos globales
├── domain/                   puro: sin React, sin Web Audio, sin DOM
│   ├── transform.ts          rotate90 · normalize · rotateN · reflect
│   ├── board.ts              cellsAt · isValid · occupantAt
│   ├── music.ts              midiFor · midiName · notesForRotation
│   ├── invariants.ts         los cinco chequeos del modelo
│   ├── types/                el contrato de la capa. Cero imports
│   │   ├── transform.types.ts    Cell
│   │   ├── pieces.types.ts       PieceKey
│   │   └── board.types.ts        PlacedPiece
│   ├── constants/            los datos del modelo. Solo importan tipos
│   │   ├── pieces.constants.ts   SHAPES · ANCHOR_INDEX
│   │   ├── board.constants.ts    GRID_W · GRID_H
│   │   └── music.constants.ts    CHROMATIC · PENT_* · BASE_MAP · DEFAULT_OCTAVE
│   └── __tests__/            uno por módulo, con el nombre del módulo
│       ├── transform.test.ts
│       ├── board.test.ts
│       ├── music.test.ts
│       └── invariants.test.ts
├── audio/                    Web Audio; habla MIDI, no conoce el dominio ni la UI
│   ├── voice.ts              midiToHz · scheduleVoice
│   ├── scheduler.ts          collectHits
│   ├── engine.ts             singletons y la API que consume la UI
│   ├── types/
│   │   ├── voice.types.ts        VoiceOpts
│   │   └── scheduler.types.ts    Job · ClockState · Hit
│   ├── constants/
│   │   ├── voice.constants.ts      DEFAULT_VOICE · NOTE_DUR · DEFAULT_VELOCITY
│   │   ├── scheduler.constants.ts  LOOKAHEAD · TICK_MS
│   │   └── engine.constants.ts     MASTER_GAIN · ARPEGGIO_SPREAD · DEFAULT_BPM ·
│   │                               PLAY_DELAY · CLOCK_START_DELAY
│   └── __tests__/
│       ├── voice.test.ts
│       ├── scheduler.test.ts
│       ├── integration.test.ts
│       └── test-context.ts   helpers de OfflineAudioContext (no matchea el include)
└── components/               un componente por archivo, presentacionales
    ├── PiecePalette.tsx      paleta, rotación, reflexión, tempo, transporte
    ├── Board.tsx             grilla 10×6 con el fantasma
    ├── PiecePreview.tsx      previsualización con el ancla marcada
    ├── PlacedList.tsx        lista de piezas colocadas
    └── constants/
        └── layout.constants.ts   CELL_PX · PREVIEW_CELL_PX · TEMPO_MIN · TEMPO_MAX
```

**`pieces.ts` desaparece como módulo.** Su contenido eran exactamente `SHAPES` y `ANCHOR_INDEX`: dos
tablas de datos y ni una función. Sacar las constantes lo deja vacío, así que se disuelve en
`constants/pieces.constants.ts`. Es la única consecuencia estructural del cambio, y es una
simplificación: el archivo pasa a llamarse por lo que realmente es.

**La dirección, y es la regla que ordena todo lo demás:**

```
types/ ← constants/ ← módulos              types/ no importa nada; constants/ solo tipos
transform.ts ← board.ts                    domain/ no importa nada de fuera de domain/
             ← music.ts ← invariants.ts    audio/  no importa nada de fuera de audio/
                                           components/ y App.tsx importan de las dos
```

`domain/` y `audio/` son **hermanos sin aristas entre ellos**: hoy ya es así —el motor habla números
MIDI y no sabe qué es un pentominó— y el spec lo fija. Las hojas del grafo (`transform.ts`,
`voice.ts`) no importan nada del repo.

### Decisiones de diseño

**D1 — Capas por dependencia, no por tipo de archivo.**

La referencia investigada es [bulletproof-react](https://github.com/alan2207/bulletproof-react), que
propone `app/ · components/ · features/ · hooks/ · lib/ · stores/ · types/ · utils/` con **flujo
unidireccional** entre carpetas. De ahí se toman **dos ideas** —la dirección única y hacerla cumplir
con el linter— y se **descartan las carpetas**: `features/` (hay una sola pantalla), `stores/`
(CLAUDE.md prohíbe estado global), `api/` y `config/` (no hay servidor ni configuración),
`hooks/` y `utils/` (serían el cajón donde termina lo que no se supo nombrar). Es la misma disciplina
que se aplicó con el server de bait en el spec 006: se hereda el principio medido, no el árbol de
carpetas de otro proyecto.

Las carpetas se llaman por su **rol en la dependencia** (`domain` no depende de nada; `components`
depende de todo), no por el tipo de archivo que contienen.

**D2 — La dirección la verifica el linter, no la revisión.**

Un override por carpeta con `@typescript-eslint/no-restricted-imports` (la variante que también ve
`import type`), usando `typescript-eslint`, que ya es dependencia:

```js
{ files: ['src/domain/**/*.ts'], rules: { '@typescript-eslint/no-restricted-imports': ['error', {
    patterns: [{ group: ['react', 'react-dom', '../audio/*', '../components/*', '../App*'],
                 message: 'domain/ es puro: no conoce React, ni el audio, ni la UI.' }] }] } },
{ files: ['src/audio/**/*.ts'], rules: { '@typescript-eslint/no-restricted-imports': ['error', {
    patterns: [{ group: ['react', 'react-dom', '../domain/*', '../components/*', '../App*'],
                 message: 'audio/ habla MIDI y Web Audio; no conoce el dominio ni la UI.' }] }] } },
```

bulletproof-react usa `import/no-restricted-paths` de `eslint-plugin-import`, que expresa zonas más
ricas; se descarta para no agregar una dependencia por dos reglas. La arquitectura pasa de ser un
párrafo de documentación a ser **ejecutable**: romperla falla el `pnpm lint`, igual que hoy falla
exportar una constante desde un `.tsx`.

**D3 — Sin barrel files.**

Ningún `index.ts` que re-exporte. La documentación de performance de Vite marca el patrón
`export * from './x'` como causa de carga innecesaria de archivos, y su API de HMR advierte que un
módulo que re-exporta se vuelve responsable de propagar esas re-exportaciones. Cada import apunta al
módulo concreto: `import { rotateN } from "./domain/transform.ts"`. Cuesta imports más largos y paga
en HMR granular y en un grafo legible.

**D4 — Extensión explícita en todo import local.**

`./domain/transform.ts`, no `./domain/transform`. Dos razones independientes que apuntan al mismo
lado:

1. La guía de performance de Vite lo recomienda para reducir operaciones de resolución.
2. El [spec 006](../006-mcp-server-de-dominio-ejecutable/spec.md) carga `domain/` con **node crudo**,
   que exige el specifier completo (`ERR_MODULE_NOT_FOUND` sin la extensión).

`tsconfig.app.json` ya tiene `allowImportingTsExtensions: true`, así que es legal hoy. El detalle
importante: **omitirla no rompe la app** —Vite resuelve igual— así que el error sería invisible del
lado del navegador y solo aparecería al correr el server. De ahí que sea regla escrita y no
costumbre.

**D5 — Sin alias de paths (`@/domain/...`).**

Vite los soporta vía `resolve.alias`, y son cómodos cuando las rutas son profundas. Acá la
profundidad máxima es uno, así que el beneficio es cosmético — y el costo es real: **node no conoce
los alias de Vite**, así que un alias rompería el spec 006. Rutas relativas.

**D6 — Un componente por archivo, y ningún export que no sea componente en un `.tsx`.**

No es preferencia estilística: es lo que el lint ya exige (medido arriba). La granularidad de Fast
Refresh es el módulo, así que un archivo por componente también significa recargas más chicas.
Los cuatro componentes se usan una sola vez cada uno, y eso está bien: la documentación de React dice
explícitamente que *"los componentes son una forma cómoda de organizar el código de UI, incluso si
algunos se usan una sola vez"*.

Los componentes quedan **presentacionales**: reciben datos y callbacks por props, no tienen estado
propio ni efectos.

**D7 — `audio/` se parte en los tres bloques que ya documenta.**

`voice.ts` y `scheduler.ts` reciben el `AudioContext` por parámetro y **no pueden** tocar el
singleton, porque el singleton vive en `engine.ts` y ellos no lo importan. El invariante que hoy
sostiene un comentario pasa a sostenerlo el grafo de imports. El corte es el que ya usan los
`describe` del test, así que la partición de `engine.test.ts` es mecánica.

Efecto lateral bienvenido: el spec 006 puede importar `scheduler.ts` **sin** arrastrar el módulo de
los singletons a un proceso de node.

**D8 — El estado se queda en `App.tsx`. No se extraen hooks.**

Tentación evaluada y rechazada. Después de sacar el dominio, lo que queda en `App` es estado
(`useState`), dos `useMemo` derivados, tres handlers y dos efectos. Envolver eso en un
`usePentominoBoard` no reduce complejidad: la mueve, y crea el hook-monolito que la documentación de
React desaconseja explícitamente (*"no crees hooks como `useMount`; mantené su propósito
específico"*). Si algún día el estado crece, el candidato con propósito específico es el efecto de
reconciliación de loops, no un hook que envuelva todo.

**D9 — Tests colocados junto a su módulo.**

`domain/transform.test.ts` al lado de `domain/transform.ts`, como ya está `audio/engine.test.ts`. El
`include` de Vitest (`src/**/*.test.{ts,tsx}`) los toma sin cambios de configuración.

**D10 — Los tests van en un `__tests__/` dentro de la carpeta de su capa, no sueltos al lado del
módulo.**

Un archivo de test por módulo, con el nombre del módulo (`domain/__tests__/board.test.ts` prueba
`domain/board.ts`). La capa queda con sus módulos a la vista y el ruido de los tests en un solo lugar,
que es lo que se busca cuando `domain/` pasa de un archivo a cinco.

Lo que se pierde y cómo se compensa: con los tests al lado, un módulo sin cobertura **salta a la
vista** en el listado de la carpeta, y hoy hay cinco sin cubrir. Con `__tests__/` hay que comparar dos
listados. La compensación es la regla de nombres —un test por módulo, mismo nombre— que hace que la
comparación sea inmediata, más el AC6, que fija qué tiene que estar cubierto.

No hace falta tocar la configuración: el `include` de Vitest (`src/**/*.test.{ts,tsx}`) matchea igual
dentro de `__tests__/`. Y nada importa un archivo de test (verificado con `grep`), así que nunca entran
al bundle; el único que los mira es `tsc`, y que los typechequee es deseable.

Dos consecuencias a no olvidar:

- **Los imports de los tests suben dos niveles** (`../board.ts` desde `__tests__/`), así que los
  patrones del linter de D2 necesitan la variante `../../` además de `../` — con los tests sueltos
  alcanzaba una sola. Está en el plan.
- `test-context.ts` **no** es un test sino un helper de render, y no matchea el `include` (necesita
  `.test.` antes de la extensión). Va igual **dentro** de `audio/__tests__/`, porque su rol es
  infraestructura de test: así la carpeta de audio queda con tres módulos y nada más. Si algún día lo
  necesita otra capa, sube a `src/testing/` (tabla de crecimiento en D12).

**D11 — `index.css` pasa a `src/styles/index.css`.**

Es la única carpeta que se crea para un solo archivo, y la excepción es deliberada: con Tailwind 4 el
CSS es **el lugar donde se configura el diseño** (`@theme` para tokens, `@layer base`, utilidades
propias), así que es el archivo con más probabilidad real de crecer. Hoy son 15 líneas
(`@import "tailwindcss"` + `body` + `code`); cuando aparezca el segundo concern, la carpeta ya está y
el crecimiento es aditivo (`styles/theme.css`, `styles/base.css`, importados desde `styles/index.css`)
sin volver a tocar el import del entry.

**D12 — Cada rol tiene su carpeta dentro de la capa, y el archivo repite el nombre del módulo con el
sufijo del rol.**

Las dos cosas juntas: **carpeta** para el rol, **sufijo** para saber de qué módulo es. `Cell` no se
llama `types/index.ts` ni vive suelta: es `domain/types/transform.types.ts`, el contrato del módulo
`transform.ts`.

| Rol | Carpeta | Archivo | Hoy |
|---|---|---|---|
| lógica de un concern | la capa | `<módulo>.ts` | 7 módulos |
| tipos que cruzan un límite | `<capa>/types/` | `<módulo>.types.ts` | 5 archivos |
| datos y valores fijos | `<capa>/constants/` | `<módulo>.constants.ts` | 7 archivos |
| test de un módulo | `<capa>/__tests__/` | `<módulo>.test.ts` | 8 archivos |
| helper de test | `<capa>/__tests__/` | nombre descriptivo | `test-context.ts` |
| componente | `components/` | `PascalCase.tsx`, único export | 4 archivos |
| hook | `<capa>/hooks/` | `useCamelCase.ts` | ninguno (D8) |
| validación de datos externos | `<capa>/schemas/` | `<módulo>.schema.ts` | ninguno — no hay input externo |
| helper interno de un módulo | `<capa>/utils/` | `<módulo>.utils.ts` | ninguno |
| helper genérico sin dominio | `src/lib/` | `<tema>.ts` | ninguno |

**La regla es que los módulos contienen comportamiento; los datos, los tipos y los valores fijos viven
en su carpeta.** Un `.ts` de la capa tiene funciones y nada más. Eso deja tres beneficios medibles, no
estéticos:

1. **Elimina duplicaciones que hoy existen y nadie sincroniza.** Medidas (§ del `research.md`): el
   `0.35` de `NOTE_DUR` está también como default de `scheduleVoice`; el `110` del tempo inicial de la
   UI está también como `bpm` inicial del motor; el `28px` de la grilla convive con un `w-7 h-7` que
   tiene que valer lo mismo, y el `20px` con un `w-5 h-5`. **Cuatro pares de números que deben coincidir
   y hoy no lo garantiza nada.** Con `constants/`, cada uno tiene una sola declaración.
2. **Hace visible el inventario de lo que el modelo asume.** Abrir `domain/constants/` es ver, en tres
   archivos, todo lo que el instrumento da por dado: las formas, la grilla, las escalas y la octava.
3. **`constants/` solo importa tipos**, así que es tan consumible como `types/`: el spec 006 puede leer
   `SHAPES` sin arrastrar una función.

Las `Props` de cada componente son la excepción: **se quedan inline y sin exportar**, porque
`react-refresh/only-export-components` obliga a que el componente sea el único export del `.tsx`.

El costo, dicho claro: entender un concepto puede requerir tres archivos (`Cell` en `types/`, `SHAPES`
en `constants/`, `rotateN` en el módulo). Se compensa con la regla de nombres —los tres se llaman igual
que su módulo— y con una disciplina de contenido: **los comentarios que explican una decisión viajan
con el dato o la función que la encarna**, nunca quedan huérfanos. El porqué de `ANCHOR_INDEX` se muda
con `ANCHOR_INDEX` a `constants/`; el del orden del array se queda con las transformaciones.

**D12b — No hay `enum`, y no puede haberlos.**

Verificado, no supuesto: hoy no existe ninguno en `src/`, y el `tsconfig.app.json` los **prohíbe**
porque tiene `erasableSyntaxOnly: true`:

```
$ npx tsc     # export enum Rotation { Deg0 = 0, Deg90 = 1 }
error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
```

No es una restricción a levantar: es la misma opción que garantiza que el código sea **type-strippable**,
o sea lo que permite que node cargue `src/domain/` sin compilar — el cimiento del
[spec 006](../006-mcp-server-de-dominio-ejecutable/spec.md). Un `enum` emite código en runtime, por eso
queda afuera.

El reemplazo idiomático, que sí compila (probado, exit 0), reparte sus dos mitades justo en las carpetas
que este spec define:

```ts
// constants/rotation.constants.ts  — el valor
export const ROTATION = { DEG_0: 0, DEG_90: 1, DEG_180: 2, DEG_270: 3 } as const;
// types/rotation.types.ts          — el tipo
export type Rotation = (typeof ROTATION)[keyof typeof ROTATION];
```

**Este spec no lo introduce**, porque cambiaría firmas (`rotation: number` → `rotation: Rotation`) y eso
es comportamiento tipado, no reorganización. Queda anotado en Seguimiento como el candidato obvio: la
rotación es hoy un `number` sin acotar que se compara contra `0|1|2|3` en cuatro lugares. Lo mismo vale
para cualquier futuro conjunto cerrado — **la regla del repo es const-object + union type, nunca `enum`**,
y va escrita en `conventions.md` con el motivo.

**Las carpetas de rol se crean cuando tienen contenido.** No hay `schemas/`, `utils/`, `hooks/` ni
`lib/` hoy: estarían vacías, y una carpeta vacía es la ceremonia que este spec ya descartó al no
copiar el árbol de bulletproof-react. La tabla de arriba es el compromiso de dónde va cada cosa cuando
aparezca, para que no se improvise.

Tabla de crecimiento del resto:

| Cuando aparezca… | Va a | Hoy |
|---|---|---|
| un segundo concern de CSS (tokens `@theme`, capa base, utilidades) | `styles/theme.css` + `styles/base.css` importados por `styles/index.css` | 1 archivo, 15 líneas |
| tests que no mapean 1:1 a un módulo (e2e, smoke, visual) | `tests/` en la raíz, fuera de `src/` — los `__tests__/` de cada capa son para tests de módulo | no hay |
| un helper de test compartido **entre capas** | `src/testing/` | 1, y es solo de audio |
| validación de datos externos (persistir, compartir por URL, importar un tablero) | `<capa>/schemas/<módulo>.schema.ts` + zod como dependencia de la app — **decisión con spec propio** | no hay input externo |
| un asset importado desde código | `src/assets/` | no hay |
| un provider o un router | `src/app/` con `App.tsx` adentro (ver D14) | no hay |
| una segunda pantalla o modo | recién ahí `src/features/` tiene sentido | una pantalla |
| estado que necesitan dos ramas del árbol | subir el estado o un hook con propósito específico en `<capa>/hooks/` — **no** un store global (CLAUDE.md) | todo en `App` |

**D13 — El entry pasa a llamarse `main.tsx`.**

Es la convención de Vite y lo que espera cualquiera que abra el repo; hoy es `index.tsx`, herencia de
Create React App, y hay que ir a `index.html` para descubrirlo. Cambio de dos líneas (el archivo y el
`<script src>`), en su propio commit, junto con reemplazar `import React from 'react'` por
`import { StrictMode }` — con `jsx: react-jsx` el import default de React no hace falta.

**D14 — `main.tsx` y `App.tsx` siguen siendo dos archivos, y no por costumbre.**

La pregunta es legítima: si hay un entry, ¿para qué un `App.tsx`? Son dos responsabilidades con
dependencias distintas: `main.tsx` es el **arranque** —toca el DOM, conoce `#root`, `createRoot`,
`StrictMode` y el CSS global— y `App.tsx` es el **componente raíz**, que no sabe nada del DOM y podría
renderizarse con cualquier renderer.

Y otra vez el lint del repo lo decide antes que la opinión. Un `.tsx` que declara el componente y
además renderiza al nivel de módulo —o sea, los dos archivos fusionados— falla hoy:

```
$ npx eslint src/_probeA.tsx     # componente + createRoot(...).render(...) en el mismo archivo
error  Fast refresh only works when a file has exports.
       Move your component(s) to a separate file      react-refresh/only-export-components
```

Mientras que el entry actual, que solo arranca y no declara componentes, pasa limpio. Fusionarlos
costaría **recarga completa de la página en cada edición de la UI**, perdiendo el estado del tablero:
la granularidad de Fast Refresh es el módulo, y un módulo con efecto de arranque y sin export de
componente no es frontera de refresh.

Dos alternativas evaluadas y descartadas:

- **Mover `App.tsx` a `src/app/`** (como bulletproof-react, con `provider.tsx` y `router.tsx` al
  lado): carpeta de un solo archivo para anticipar dos que no existen. El trigger está en la tabla de
  D12 — si aparece un provider o un router, ahí sí.
- **Renombrarlo a algo con dominio** (`PentominoInstrument.tsx`) y moverlo a `components/`: el nombre
  sería mejor, pero `App.tsx` es el archivo que cualquiera busca primero, y `App` **no es
  presentacional** —es el shell con todo el estado—, así que en `components/` desdibujaría justo la
  distinción que este spec construye.

## Criterios de Aceptación

- **AC1 — Cero cambio de comportamiento.** `pnpm exec tsc -b --noEmit`, `pnpm lint`, `pnpm test` y
  `pnpm build` en verde, y en la app: la misma paleta, el mismo fantasma, la misma celda de agarre
  y **las mismas notas** para las 96 combinaciones de pieza × rotación × reflexión.
- **AC2** — `App.tsx` no contiene ninguna función pura ni ningún literal de dominio, y no exporta
  nada que no sea el componente.
- **AC3** — `domain/` no importa React, ni `audio/`, ni `components/`. `audio/` no importa React, ni
  `domain/`, ni `components/`. **Verificado por el linter**: agregar a mano un import prohibido tiene
  que fallar `pnpm lint` con el mensaje del override (la misma prueba que se hizo con
  `react-refresh/only-export-components`).
- **AC4** — No hay ningún archivo `index.ts` de re-exportación en `src/`, y **todos** los imports
  locales llevan extensión explícita.
- **AC4b — La convención de carpetas y nombres se cumple y está documentada.** Cada tipo que cruza un
  límite vive en `<capa>/types/<módulo>.types.ts`, cada dato o valor fijo en
  `<capa>/constants/<módulo>.constants.ts`, cada test en `<capa>/__tests__/<módulo>.test.ts`;
  `<capa>/types/` no importa nada y `<capa>/constants/` **solo importa tipos**; no existe ninguna
  carpeta de rol vacía. Las tablas de roles y de crecimiento de D12 quedan en
  `docs/guides/conventions.md`.
- **AC4c — Ningún módulo `.ts` de `domain/` o `audio/` declara una constante ni un literal repetido**,
  y las cuatro duplicaciones medidas quedan con una sola declaración: `NOTE_DUR` (hoy también default de
  `scheduleVoice`), el tempo inicial (hoy `110` en la UI y en el motor), `CELL_PX` (hoy `28px` y
  `w-7 h-7`) y `PREVIEW_CELL_PX` (hoy `20px` y `w-5 h-5`). No hay ningún `enum` (D12b).
- **AC5** — `cellsAt`, `isValid` y `occupantAt` viven en `domain/board.ts` como funciones puras con
  todas sus dependencias en la firma, y `App.tsx` las llama. Ninguna quedó declarada dentro del
  componente.
- **AC6 — Los primeros tests del dominio.** `domain/invariants.ts` expone los cinco chequeos y tiene
  test propio. Sobre las 96 combinaciones, los cinco pasan (valor medido de referencia):
  1. **orden del array** — la celda del índice `k` después de rotar, reflejar y normalizar es la
     imagen de la celda `k` original;
  2. **ancla** — `ANCHOR_INDEX[p] ∈ [0,5)` y su celda transformada es la imagen del ancla original;
  3. **formas** — 5 celdas, sin repetidas, conexas por lados;
  4. **`BASE_MAP`** — biyectiva sobre las 12 clases de altura;
  5. **notas** — 5 distintas y estrictamente ascendentes antes del retrógrado.
- **AC7** — La comparación de celdas no se engaña con `-0`: `rotate90` y `reflect` producen `-0`
  cuando `x = 0`, y `deepStrictEqual`/`toEqual` distinguen `-0` de `0`. Hay un test que lo fija.
- **AC8** — Los tests de tablero cubren lo que hoy no tiene cobertura: colocación fuera del tablero,
  choque contra una pieza existente, y que la celda de agarre caiga donde se clickeó.
- **AC9** — `audio/` queda en tres módulos y los tests siguen en verde, repartidos en
  `audio/__tests__/` según los `describe` actuales: `voice.test.ts` (`midiToHz` + `sintesis`, 7),
  `scheduler.test.ts` (`scheduler`, 8) e `integration.test.ts` (`scheduler + sintesis integrados` más
  el `analizador` que trajo el spec 003, 3).
  **El conteo total no baja de 27** — el valor de hoy, verificado con `pnpm test`: 18 de
  `engine.test.ts` más los 9 de `spectrum.test.ts`, que ya vive en su propio archivo y no se parte.
- **AC10** — `scheduler.test.ts` no importa nada de `engine.ts` (usa su propio spread literal en vez
  de `ARPEGGIO_SPREAD`): el test de la capa 2 no alcanza a la capa 3.
- **AC11** — `components/` tiene cuatro componentes presentacionales, uno por archivo, sin estado ni
  efectos propios, y `App.tsx` los compone.
- **AC12** — El entry es `src/main.tsx`, importa `./styles/index.css` y `./App.tsx`, usa
  `import { StrictMode }`, `index.html` lo referencia, y no queda ninguna mención a `src/index.tsx` en
  el repo ni en `docs/` (hay cuatro hoy, medidas).
- **AC13** — La documentación queda al día: `docs/architecture/directory-structure.md` con el árbol
  nuevo y la tabla de "dónde crear cada cosa", `docs/guides/conventions.md` con la dirección de
  dependencia, las dos tablas de D12, la prohibición de barrels y la regla de la extensión, y
  `CLAUDE.md` con la sección de organización reescrita.
- **AC14** — `src/setupTests.ts` ya no existe (borrado en commit propio) y `src/styles/index.css` es
  la única hoja de estilos, referenciada solo desde `main.tsx`.

## Fuera de Alcance

- **Cualquier cambio de comportamiento.** Ni una nota, ni un pixel, ni una constante distinta. Si
  aparece la tentación de mejorar algo mientras se mueve, va a otro commit y probablemente a otro
  spec. AC1 es la línea.
- **Los cambios de producto de los specs 001, 003 y 004.** Este spec les deja el terreno; no
  implementa nada de ellos. En particular **no** agrega `degreeByCellIndex` ni toca el modelo musical.
- **`features/`, `stores/`, `hooks/`, `utils/`, `schemas/`, `api/`, `config/`.** Descartadas por vacías
  (D1 y D12). Se crean cuando tengan su primer archivo.
- **Convertir la rotación en un tipo cerrado.** El const-object + union que reemplaza al `enum`
  prohibido (D12b) cambiaría `rotation: number` por `rotation: Rotation` en varias firmas: es tipado
  nuevo, no reorganización. Queda como seguimiento, con el patrón ya decidido.
- **Renombrar constantes o cambiar sus valores.** `ARPEGGIO_SPREAD` sigue siendo 0.15 s, `GRID_W` sigue
  siendo 10. Se mueven, no se discuten.
- **Estado global, router, data fetching.** Nada de eso existe ni se agrega.
- **Tests de componentes.** Seguirían necesitando `jsdom` en su propio bloque de config. Este spec
  agrega tests de dominio y reparte los de audio; los de UI son otro trabajo.
- **Tocar las dependencias.** `@testing-library/*` y `@types/jest` siguen donde están.
  `setupTests.ts` es la única excepción: está muerto (nada lo referencia, `vite.config.ts` no declara
  `setupFiles`) y se borra en su propio commit, por la convención de CLAUDE.md.
- **`src/assets/`.** No hay assets importados desde código. La carpeta se crea cuando haga falta.
- **Optimizaciones de performance.** Ni `React.memo`, ni code splitting, ni lazy loading. Es una app
  de una pantalla.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Es un refactor grande sobre el único archivo de la app.** Un error de copiado en `SHAPES` o en `ANCHOR_INDEX` no produce error de compilación: produce una pieza que se coloca mal, y hay que notarlo a ojo. | Fase por fase, cada una con su commit y su verificación. Y el orden no es casual: **las fases 1 y 2 traen los tests del dominio antes de tocar la UI**, así que cuando se mueve el JSX ya hay una red abajo. AC1 se corre al final de cada fase, no solo al final. |
| **La partición de `audio/` toca los 18 tests de `engine.test.ts`, la mitad de la cobertura del repo.** | El corte sigue los `describe` que ya existen: es mover bloques enteros de archivo, sin editar aserciones. AC9 exige que el conteo no baje — si baja, algo se perdió en el camino. |
| **Cuatro componentes nuevos es la fase con más superficie visual**, y no hay tests de UI que la cubran. | Es la última fase, es puramente mecánica (cortar JSX y pasar props), y se verifica a ojo contra la app corriendo. Si se decide postergarla, las fases 1–3 ya entregan todo el valor estructural: **la fase 4 es la única realmente opcional.** |
| **Sobre-modularización, y el número es incómodo:** `src/` pasa de **8 archivos a 35** — `domain/` 14 (4 módulos + 3 tipos + 3 constantes + 4 tests), `audio/` 12 (3 módulos + 2 tipos + 3 constantes + 4 tests), `components/` 5, más `main.tsx`, `App.tsx`, `vite-env.d.ts` y `styles/index.css`. Y el dominio son 77 líneas de lógica. Leído mal, es ceremonia. | Cuatro respuestas, en orden de peso. **(1)** De los 35, **9 son archivos de test contra 2 de hoy**: no es estructura, es la cobertura que el spec viene a traer. **(2)** Otros **7 son `constants/`, y su justificación es medible, no estética**: eliminan cuatro pares de números que hoy tienen que coincidir y nada sincroniza (AC4c). **(3)** Quedan 19 archivos de lógica y tipos para lo que hoy son 8, y cada módulo tiene un motivo distinto para cambiar —agregar una pieza · cambiar la semántica de rotación · cambiar las reglas del tablero · cambiar la escala—, ninguno pasa de ~60 líneas. **(4)** La alternativa —un `geometry.ts` con todo— se descarta porque `transform.ts` es genérico sobre `Cell[]` y no necesita conocer las piezas; juntarlos crea una dependencia que no existe. Lo que **sí** hay que vigilar: que no se cree una carpeta de rol para un solo archivo trivial. Por eso `utils/`, `schemas/`, `hooks/` y `lib/` no se crean hoy, y `pieces.ts` se disuelve en vez de quedar como módulo vacío. |
| **La única constante que no puede unificarse del todo es el tamaño de celda.** `CELL_PX = 28` gobierna el `gridTemplateColumns` (estilo inline, ya usa el número) **y** el `w-7 h-7` de cada celda, que es una clase estática de Tailwind: no se puede interpolar una clase desde una variable, porque Tailwind escanea el fuente y no vería `w-[${CELL_PX}px]`. | Las celdas pasan a dimensionarse con estilo inline (`style={{ width: CELL_PX, height: CELL_PX }}`) y se les saca `w-7 h-7`. `w-7` es exactamente 1.75rem = 28px, así que el resultado es idéntico — **es el único punto del spec donde mover una constante toca el markup**, y por eso la verificación visual del tablero y de la previsualización es obligatoria en la fase 4. Si se prefiere no tocar el markup, la alternativa es dejar las clases y documentar el acoplamiento en `layout.constants.ts`; se elige unificar porque un tamaño de celda que cambie a medias es un bug silencioso. |
| **Los overrides del linter cubren la profundidad actual** (`../audio/*` matchea `../audio/engine.ts`). Si mañana aparece `domain/sub/x.ts`, el patrón no lo alcanza. | Anotado en `conventions.md`: al crear un subdirectorio, agregar el patrón. La regla es una red, no una prueba formal — y hoy la profundidad es 1. |
| **Conflicto con las ramas de 001, 003 y 004** si alguna se abre en paralelo: los tres tocan `App.tsx` o `engine.ts`. | Este spec es corto y conviene mergearlo primero, justamente para que los otros tres salgan más chicos. Está anotado en `specs/log.md`. |
| **`main.tsx` rompe un link o un doc** que apunte a `src/index.tsx`. | AC12 lo cubre con una búsqueda en el repo; son dos o tres menciones en `docs/`. |

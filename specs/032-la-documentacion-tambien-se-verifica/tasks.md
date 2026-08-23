# Tasks — Spec 032

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — Los cinco arreglos (commit propio)

- [ ] T001 [P] Escapar las barras de `specs/027-lo-que-falla-en-silencio/research.md:112`: la fila
      declara 3 columnas y GFM le cuenta 5, así que **descarta** `Sale bien` al renderizar — **AC10**
- [ ] T002 [P] Reescribir la frase de `vite.config.ts:155` para que **no deletree** el término que
      T022 prohíbe: hoy el docblock del umbral 100 escribe la cadena para explicar por qué no usarla, y
      `no-warning-comments` no distingue el uso de la mención. Medido: 1 error, ése.
      **`docs/guides/mcp-domain.md` NO se toca** — su ancla resuelve; ver el supuesto caído nº 5 del
      `research.md` — **AC10, AC6**
- [ ] T003 [P] Agregar al árbol de `docs/architecture/directory-structure.md` los **5** archivos que no
      nombra (los 5 los exige el gate de AC3): `src/audio/constants/{engine,scheduler,voice}.constants.ts`,
      `src/domain/types/music.types.ts` y `mcp-server/src/symbols.ts` — **AC10**
- [ ] T004 [P] `CLAUDE.md`: «Quedan **dos**» → «**tres**», nombrando `components/Board.tsx` y su motivo
      (el ancestro existe por construcción; el `if` alternativo sería rama inalcanzable), y «66» → «100»
      —medido con la regla y partido por paquete, no a ojo: el 66 salió de un conteo a mano— — **AC10**
- [ ] T005 Los 23 fences sin lenguaje del carril A (13 en `docs/`, 8 en `.claude/`, 1 en la raíz,
      1 en `mcp-server/`). Sólo se agrega el lenguaje: no se toca el contenido. **Sin `[P]`: el de la
      raíz es `CLAUDE.md:127` y el de `mcp-server/` es `README.md:25`, así que comparte archivo con
      T004** — **AC1**

## Paso 2 — Markdown en `pnpm lint`

- [ ] T006 `pnpm add -Dw @eslint/markdown` (8.0.3). Va a la raíz y no a `mcp-server`: el linter es uno
      solo para todo el repo
- [ ] T007 Bloque `**/*.md` en `eslint.config.js` con `language: 'markdown/gfm'` y
      `languageOptions: { frontmatter: 'yaml' }`, extendiendo **`[markdown.configs.recommended]`, el objeto y no el string**: `tseslint.config()`
      tira ante un string en `extends` («not supported by typescript-eslint») y se cae la carga de la
      config entera, no un `.md`. El docblock del
      `frontmatter` lleva el número: sin él, 22 falsos positivos que son **comentarios YAML** leídos
      como H1 — **AC1**
- [ ] T008 `no-missing-label-refs: 'off'` en ese bloque, con el desglose de las 341 en el comentario
      (`[P]` 191, `[M]` 131, el resto prosa). No es que moleste: es que en este repo **no puede
      acertar**, porque lo que dispara la regla es el formato de tarea que `specs/README.md` documenta — **AC1**
- [ ] T009 Bloque `specs/[0-9]*/**/*.md` que apaga el preset y **reenciende por nombre** las reglas de
      renderizado. Por nombre y no por exclusión, por el mismo motivo que `REGLAS_DEL_REPO`: en flat
      config el override reemplaza, y una lista por exclusión deja entrar sola cualquier regla nueva
      del preset — **AC1**
- [ ] T010 Verificar que `pnpm lint` **sin globs** levanta **todos** los `.md` —hoy 159, y ESLint 9 sí
      entra a los dot-directories: `.claude/` incluido, verificado enumerándolos—: sin un bloque que matchee
      `**/*.md`, ESLint ignora Markdown aunque el plugin esté cargado. Se comprueba rompiendo un
      archivo a propósito y viendo el rojo — **AC1**

## Paso 3 — Los cuatro tests (paralelo con el 2 y el 4)

Sólo llevan `[P]` las cuatro que **estrenan** un archivo. T013 comparte
`mapa-de-directorios.test.ts` con T012, y T016–T018 comparten `specs-convencion.test.ts` con T015:
abanicarlas es el conflicto que aparece recién al escribir.

- [ ] T011 [P] `src/__tests__/enlaces-resueltos.test.ts`: todo enlace relativo de los 155 `.md` resuelve
      —archivo y ancla, propia y ajena—. El slug se calcula **sin colapsar espacios** (`/\s/g`, no
      `/\s+/g`): con el `+` daba 4 falsos positivos sobre encabezados con `→`, que generan dos guiones — **AC2**
- [ ] T012 [P] `src/__tests__/mapa-de-directorios.test.ts`: todo archivo de producción de `src/**` y de
      `mcp-server/src/*.ts` está nombrado en `docs/architecture/directory-structure.md`. Excluye
      `__tests__/`, `__screenshots__/` y `mcp-server/src/tools/*` — el doc los documenta a nivel de
      carpeta a propósito — **AC3**
- [ ] T013 El mismo test **no** verifica la dirección inversa, y el comentario dice por qué: el doc
      tiene una sección «qué está muerto» que nombra `App.css`, `setupTests.ts` y `App.test.tsx`
      justamente porque ya no existen — **AC4**
- [ ] T014 [P] `src/__tests__/claude-md-acotado.test.ts`: `CLAUDE.md` bajo 200 líneas, con la cita de
      `code.claude.com/docs/en/memory` en el mensaje de falla. **Este test falla hasta el paso 6** — **AC7**
- [ ] T015 [P] `src/__tests__/specs-convencion.test.ts`, los cuatro archivos por carpeta y el nombre
      `NNN-kebab` — **AC8.1, AC8.2**
- [ ] T016 Mismo archivo: biyección `log.md` ↔ carpetas, `href` que apunta a su propia carpeta,
      fecha ISO, estado en el conjunto cerrado que `log.md` declara arriba de su tabla — **AC8.3, AC8.4**
- [ ] T017 Mismo archivo: **toda** línea que empieza como checkbox en un `tasks.md` parsea con el
      formato documentado. Es lo que cierra el descarte silencioso de `parseTasks`
      (`mcp-server/src/specs.ts:113`): hoy una tarea mal escrita baja el total de `spec_status` sin
      avisar. Medido: 0 malformadas sobre 1 601 — **AC8.5**
- [ ] T018 Mismo archivo: IDs `T###` únicos dentro de su spec, y **sin** exigir consecutividad ni
      ruta de archivo, con los números en el comentario: 17 de 22 specs tienen IDs no consecutivos y
      585 de 1 601 tareas no tienen ID, que es correcto porque `specs/README.md` los pide «en specs
      nuevos» — **AC9**

## Paso 4 — Las dos reglas de TypeScript (paralelo con el 2 y el 3)

- [ ] T019 `@typescript-eslint/no-non-null-assertion: 'error'` en el bloque `**/*.{ts,tsx}` — **AC5**
- [ ] T020 Override que la apaga en `src/**/__tests__/**` y `mcp-server/**/__tests__/**`: ahí el `!`
      sobre un `find` o un `querySelector` que el propio test acaba de fijar es la forma de que el test
      **falle** si el nodo no está. Son 95 y son deliberadas — **AC5**
- [ ] T021 Override por archivo para las **tres** de producción —`src/main.tsx`,
      `src/domain/invariants.ts`, `src/components/Board.tsx`— con el docblock que dice el motivo de cada
      una. La lista pasa a ser la única fuente del número: `CLAUDE.md` decía «dos» y eran tres — **AC5**
- [ ] T022 `no-warning-comments` con `terms: ['v8 ignore', 'c8 ignore', 'istanbul ignore']` y
      `location: 'anywhere'`. **No entra gratis: hoy da 1** (`vite.config.ts:155`, que T002 arregla), y
      **su propio docblock no puede escribir ninguno de los tres términos** — el bloque `**/*.js`
      lintea `eslint.config.js`, así que explicar la regla ahí la violaría. Sin `[P]`: comparte
      archivo con T019–T021 — **AC6**

## Paso 5 — Verificar y documentar

- [ ] T023 `pnpm verify` verde. **Cuatro** nodos, ni uno más — **AC11**
- [ ] T024 Medir `lint` y `suite` con caché caliente, antes y después, y escribir los cuatro números en
      `research.md`. Si `lint` desbancara a `suite` como nodo más lento, anotarlo; si lo desbancara por
      mucho, reabrir la decisión de meter Markdown ahí
- [ ] T025 Las nueve falsificaciones deliberadas del `plan.md`: romper una cosa por gate, ver el rojo,
      revertir. Un gate que nunca se vio fallar es un gate que no se sabe si anda
- [ ] T026 [P] `specs/README.md`: la **Desviación 4** — el carril B existe porque la Desviación 2
      congela los specs, y las dos se leen juntas — **AC12**
- [ ] T027 [P] `CLAUDE.md`: el régimen nuevo, corto, en la sección de reglas y en la de comandos
- [ ] T028 [P] `docs/guides/conventions.md`: las dos reglas de TypeScript nuevas, con su motivo
- [ ] T029 [P] `specs/deuda.md`: la leniencia de `parseTasks`, anotada con el motivo por el que hoy no
      se arregla (el gate de T017 la deja sin consecuencia)
- [ ] T030 [P] `specs/log.md`: la fila del 032 **ya existe** (la commiteó `d0541e6`), así que la tarea
      es **corregirla**, no agregarla — repite los datos que este review corrigió: `Board.tsx:246` (es
      `:252`), «de **284**» (son 286), «24 de **311**» (es de 314), «**66**→**95**» (es 100), «cinco
      hallazgos» (son cuatro) y el ancla de `mcp-domain.md`, que no está rota

## Paso 6 — `CLAUDE.md` bajo 200 líneas (commit propio)

- [ ] T031 `docs/guides/verificacion.md` nuevo: el detalle de `verify`, `suite`, los dos proyectos de
      Vitest, el umbral 100 y el linting con tipos, entero y sin recortar. Hoy no hay ningún doc que
      explique `verify` — **AC7**
- [ ] T032 `## Comandos` de `CLAUDE.md` de 100 a ~25 líneas: se queda la afirmación y el número medido,
      se va el razonamiento. El criterio es el que el propio archivo escribió en su línea 3 — **AC7**
- [ ] T033 `## Reglas que valen en todo el repo` de 76 a ~50: el razonamiento largo de cada bullet ya
      está en `docs/guides/conventions.md`, así que se enlaza en vez de repetirse — **AC7**
- [ ] T034 El test de T014 en verde, y `pnpm verify` otra vez entero — **AC7, AC11**

## Seguimiento

- [ ] T035 [M] Abrir `specs/027-lo-que-falla-en-silencio/research.md` en GitHub y confirmar que la fila
      del `playNotes` muestra sus tres celdas
- [ ] T036 [M] Verificar en una sesión nueva que el `CLAUDE.md` recortado sigue alcanzando: lo que se
      fue a `docs/` tiene que ser lo que no se necesita para arrancar

## PR

- [ ] T037 Rama `feature/032-la-documentacion-tambien-se-verifica`, PR contra `main`, `pnpm verify` en
      verde también en Actions

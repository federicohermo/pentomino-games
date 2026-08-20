# Tasks — Spec 029

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — Las dependencias

- [x] T001 `pnpm add -D -w` de los cinco: `eslint-plugin-react-hooks@7`, `eslint-plugin-react-refresh@0.5`,
      `typescript-eslint@8.67`, `@vitest/eslint-plugin` y `eslint-plugin-import-x`
- [x] T002 **No** desbloquear el postinstall de `unrs-resolver` en `pnpm-workspace.yaml`: la config usa
      `createNodeResolver`, que es JS puro. El `allowBuilds` se queda como está — el `false` es la
      decisión, no la ausencia de decisión

## Paso 2 — `eslint.config.js`

- [x] T003 `linterOptions` sin `files`: `reportUnusedDisableDirectives: 'error'` + `noInlineConfig: true`,
      con el docblock que dice por qué se puede poner **hoy** (cero `eslint-disable` medidos) y cuál es
      el escape legítimo (un override por archivo, que se ve en el diff) — **AC5**
- [x] T004 Bloque `**/*.js` con `js.configs.recommended` y globals de node. Es el archivo que decide
      qué se verifica y era el único sin verificar — **AC8**
- [x] T005 Bloque `**/*.{ts,tsx}` con `recommendedTypeChecked` + `projectService: true` y
      `tsconfigRootDir` — **AC6**
- [x] T006 `restrict-template-expressions` con `allowArray: true`, y el comentario con el número: sin la
      opción son 35 hallazgos, 25 en un solo archivo, porque `Cell` es `[number, number]` y el repo lo
      interpola a propósito
- [x] T007 `no-floating-promises` con `allowForKnownSafeCalls` apuntando a `node:test`. Son 97 de los
      100 hallazgos del preset, y el `from: 'package'` es lo que hace que un `test()` de otra
      procedencia siga prohibido
- [x] T008 `consistent-type-imports` con `disallowTypeAnnotations: false` + `no-import-type-side-effects`,
      con el porqué de los dos `typeof import(...)` que se dejan
- [x] T009 [P] `ZONAS`: las tres de capa (`domain`, `audio`, `src ↚ mcp-server`) más las cinco que salen
      de `DOMAIN_INTERNO`, en **una sola** `import-x/no-restricted-paths` — **AC2**
- [x] T010 [P] Borrar `MCP_SERVER`, `FUERA_DE_DOMAIN`, `especificadores()` y los siete overrides de
      `no-restricted-imports` que verificaban la dirección por string — **AC7**
- [x] T011 [P] `REGLAS_DEL_REPO`: los tres selectores genéricos (extensión, `enum`, `createContext`).
      La regex del primero va **sin barras**: esquery corta el literal en la primera `/` — **AC3**
- [x] T012 [P] `REGLA_CONSTANTES` con `kind='const'`, sólo en `src/domain/*.ts` y `src/audio/*.ts`. El
      docblock tiene que decir **por qué `components/` queda afuera** y por qué el ancla de `const` no
      es decorativa (21 hallazgos sin ella, 2 con ella) — **AC3**
- [x] T013 [P] Los dos bloques de `no-restricted-imports` con `GRUPO_ESTADO` y `GRUPO_REACT`. El segundo
      **repite** el primero: en flat config el override reemplaza, y por eso los grupos son constantes
      con nombre y no listas escritas dos veces
- [x] T014 [P] Bloque de `@vitest/eslint-plugin` con `maxArgs: 2` en `valid-expect` —Vitest acepta el
      mensaje como segundo argumento y el repo lo usa en 24 aserciones— y `fixable: false` en
      `no-focused-tests` — **AC4**
- [x] T015 [P] Alcance: `src/**` con globals de browser, `mcp-server/**` y `*.config.ts` con globals de
      node, `ecmaVersion: 'latest'`, React acotado a `.tsx` + `use-*.ts` — **AC8**
- [x] T016 `reactHooks.configs.flat['recommended-latest']` y no `configs[...]`: en 7.x el export de
      arriba volvió a ser el de eslintrc y flat config lo rechaza con un error de arranque — **AC9**
- [x] T017 **No** poner `import-x/no-cycle`, y dejar la ausencia documentada con el número: 15 s de los
      25 y cero ciclos, redundante con las zonas

## Paso 3 — El script

- [x] T018 `"lint": "eslint . --max-warnings 0"` en `package.json` — **AC1**

## Paso 4 — Los controles positivos

- [x] T019 Cuatro archivos sonda con las violaciones a mano, corridos y borrados. Disparan: extensión,
      `enum`, constantes (×2), `createContext`, `zustand`, `.only`, `.skip`, test sin aserción, promesa
      suelta, y el aviso de `noInlineConfig` — **AC3**, **AC4**, **AC5**, **AC6**
- [x] T020 Control positivo de las zonas: `board.ts` importando `./music.ts` y `../audio/engine.ts`
      falla con el mensaje de cada zona — **AC2**
- [x] T021 Control positivo desde una carpeta que **no existe hoy** (`src/domain/sub/`): es lo que la
      versión por string no cubría y el motivo entero del cambio — **AC2**

## Paso 5 — Los cinco hallazgos

- [x] T022 [P] `src/domain/constants/sequence.constants.ts`: `PASOS_MAX`, docblock **mudado**
- [x] T023 [P] `src/domain/constants/invariants.constants.ts`: `ROTATIONS`, docblock nuevo — no tenía, y
      lo que hay que explicar es por qué el 4 se escribe y los regímenes se derivan
- [x] T024 `domain/invariants.ts`: los dos literales `5` se leen por una variable `number`. El chequeo
      no sobra —existe para el día en que alguien cambie uno de los dos— pero interpolar un `never` es
      lo único que `restrict-template-expressions` no perdona, y con razón
- [x] T025 [P] `audio/__tests__/voice.test.ts:213`: se le saca el `async` al `it` que no espera nada
- [x] T026 [P] `eslint --fix` de los dos `consistent-type-imports` de `components/types/`, diff revisado

## Paso 6 — La doc

- [x] T027 [P] `CLAUDE.md`: los números de `verify` (4,0 → 11,8 s) con el porqué; la regla de dirección
      reescrita a «por ruta»; los bullets de extensión, constantes, `enum` y estado global anotando que
      ahora los verifica el linter; el `noInlineConfig` como contraparte del «cero `any`»; y el bullet
      nuevo de `.only` — **AC10**, **AC11**
- [x] T028 [P] `docs/guides/conventions.md`: la sección del linter, el párrafo de «la profundidad
      actual» —que deja de existir— y el carve-out de `components/` en la regla de constantes — **AC11**
- [x] T029 [P] `docs/architecture/directory-structure.md`: los dos `*.constants.ts` nuevos en el árbol y
      la línea de `eslint.config.js` — **AC11**
- [x] T030 [P] `docs/guides/troubleshooting.md`: el error de arranque de react-hooks 7.x y el aviso de
      `noInlineConfig`. Los dos se pisaron de verdad en este spec — **AC11**

## Verificación

- [x] T031 `pnpm verify` en verde con `--max-warnings 0` — **AC1**
- [x] T032 Remedir los tiempos con caché caliente y anotarlos — **AC10**
- [ ] T033 [M] Navegador: el spec no toca comportamiento, pero mueve dos constantes de `domain/` y
      autofixea dos imports. Abrir, colocar, rotar, mutear y arrancar el transporte para confirmar que
      suena igual. Es barato y cierra el único riesgo que los tests no cubren por su cuenta

## PR

- [x] T034 Rama `feature/029-el-linter-verifica-lo-que-claude-md-declara`
- [ ] T035 Actualizar la fila del 029 en `specs/log.md` a `Implementado`
      — **queda abierta a propósito**: en este repo el estado del spec en `log.md` lo mueve el
      **merge**, no la rama, así que la fila se toca al mergear y no acá
- [x] T036 Anotar en `specs/revisiones.md` qué se aprendió

## Seguimiento (no bloquea)

- [ ] T037 El linting con tipos dejó a `lint` como el nodo más lento de `verify` (10,2 s de 11,8). La
      mitad cara es `mcp-server/`: 13,9 s él solo contra 8,4 s de `src/`. Si el tiempo molesta, lo
      próximo a soltar es el linting con tipos ahí, no en `src/`
- [ ] T038 `import-x/no-cycle` queda disponible y sin usar. El día que aparezca un subdirectorio con
      varios módulos hermanos sin zona propia, está a una línea — y ahí sí compra algo que las zonas no
- [ ] T039 `strictTypeChecked` da 237 hallazgos y no entró. Las dos reglas sueltas que valdrían son
      `no-unnecessary-condition` (1 hallazgo) y `no-non-null-assertion` (12)
- [ ] T040 ESLint 10.8.1 ya salió y este spec no lo miró. El repo está en `^9.33.0`
- [ ] T041 Las siete constantes de `Spectrum.tsx` y `Playhead.tsx` quedan fuera de la regla **por
      decisión**, no por deuda: son privadas de su archivo y sus docblocks explican el mecanismo de
      dibujo. Si algún día una de ellas tiene que valer lo mismo que algo de `constants/`, ahí sí se
      muda — y ahí la regla ya no sería un carve-out sino el diagnóstico correcto

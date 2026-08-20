import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import vitest from '@vitest/eslint-plugin'
import importX from 'eslint-plugin-import-x'
import { globalIgnores } from 'eslint/config'

/**
 * Los paquetes de estado global que `CLAUDE.md` prohibe. Estaba escrito y no lo verificaba
 * nadie, y es de las reglas mas faciles de romper sin querer: la tentacion no aparece al
 * escribir el import sino tres niveles de props mas abajo.
 */
const ESTADO_GLOBAL = ['zustand', 'redux', '@reduxjs/toolkit', 'jotai', 'valtio', 'recoil', 'mobx', 'mobx-react-lite']

/** React, para las dos capas que no pueden verlo. `react-dom/*` cubre `react-dom/client`. */
const REACT = ['react', 'react-dom', 'react-dom/*']

const GRUPO_ESTADO = {
  group: ESTADO_GLOBAL,
  message: 'Sin estado global: el estado vive en App.tsx y baja por props.',
}
const GRUPO_REACT = {
  group: REACT,
  message: 'domain/ y audio/ no conocen React: son puras y hablan MIDI, respectivamente.',
}

/**
 * La direccion de dependencia ADENTRO de `domain/`, modulo por modulo: para cada uno, los
 * hermanos que NO puede importar.
 *
 * Los niveles, de abajo hacia arriba:
 *
 * - `transform.ts` es la base: geometria sin nada encima.
 * - `board.ts` y `music.ts` construyen sobre ella y no se conocen entre si — que las reglas
 *   del tablero y el modelo musical sean ortogonales es una propiedad del instrumento, no
 *   una casualidad de como quedaron los imports.
 * - `sequence.ts` e `invariants.ts` son las HOJAS: pueden usar todo lo de abajo y no se
 *   importan entre si, que es lo que garantiza que no haya ciclos. Si algun dia
 *   `invariants.ts` tuviera que verificar la secuencia, el arreglo es mover `sequence.ts`
 *   un nivel abajo y no borrar la regla.
 *
 * Hasta el spec 029 esto se prohibia por el STRING del import y no por la RUTA, y el precio
 * eran dos parches que ahora se pueden borrar: las tres formas de escribir el mismo
 * specifier (`./music.ts`, `./music`, `./music.js`, que resuelven igual) y el conteo de
 * `../` por profundidad de carpeta. Con zonas de `import-x` los dos desaparecen: la ruta se
 * resuelve contra el filesystem, asi que un `src/domain/sub/x.ts` nuevo queda cubierto sin
 * tocar este archivo. Deja de ser una red y pasa a ser la regla.
 */
const DOMAIN_INTERNO = {
  'transform.ts': ['board', 'music', 'sequence', 'invariants'],
  'board.ts': ['music', 'sequence', 'invariants'],
  'music.ts': ['board', 'sequence', 'invariants'],
  'sequence.ts': ['invariants'],
  'invariants.ts': ['sequence'],
}

/**
 * Las zonas prohibidas, por ruta. Una sola regla para todo el repo, sin un override por
 * capa: es lo que reemplaza a los cuatro bloques de `no-restricted-imports` que se pisaban
 * entre si —en flat config un override REEMPLAZA la regla en vez de sumarse, asi que cada
 * bloque tenia que repetir el anterior o abria un agujero—.
 *
 * `domain/` y `audio/` son hermanos sin aristas entre ellos: el motor habla numeros MIDI y
 * no sabe que es un pentomino.
 *
 * `mcp-server/` (spec 006) es tooling y la direccion es una sola: importa de `src/`, NUNCA
 * al reves.
 */
const ZONAS = [
  {
    target: './src/domain',
    from: ['./src/audio', './src/components', './src/App.tsx', './src/main.tsx'],
    message: 'domain/ es puro: no conoce el audio ni la UI.',
  },
  {
    target: './src/audio',
    from: ['./src/domain', './src/components', './src/App.tsx', './src/main.tsx'],
    message: 'audio/ habla MIDI y Web Audio; no conoce el dominio ni la UI.',
  },
  {
    target: './src',
    from: './mcp-server',
    message: 'mcp-server/ es tooling: importa de src/, nunca al reves.',
  },
  ...Object.entries(DOMAIN_INTERNO).map(([archivo, prohibidos]) => ({
    target: `./src/domain/${archivo}`,
    from: prohibidos.map((m) => `./src/domain/${m}.ts`),
    message: `La direccion adentro de domain/ es una sola: ${archivo} no puede importar ${prohibidos.map((m) => `./${m}.ts`).join(', ')}.`,
  })),
]

/**
 * Las reglas que `CLAUDE.md` declara y que hasta el spec 029 no verificaba nadie. Las cuatro
 * entran con selectores de esquery y sin agregar un plugin.
 *
 * Van juntas en un array compartido porque `no-restricted-syntax` tambien se REEMPLAZA entre
 * overrides: el bloque de abajo que agrega la quinta regla tiene que repetir estas tres o
 * las apaga para los archivos que matchea.
 */
const REGLAS_DEL_REPO = [
  {
    // "Sin barrels, con extension explicita, sin alias." Omitir la extension no rompe la
    // app —Vite y el `moduleResolution: bundler` del tsconfig resuelven igual— asi que el
    // error seria invisible del lado del navegador y solo aparece al cargar `domain/` con
    // node crudo, que es justo lo que hace el MCP server del 006.
    selector: 'ImportDeclaration[source.value=/^[.].*(?<![.]ts|[.]tsx|[.]css|[.]json)$/]',
    message: 'Todo import local lleva extension explicita: ./music.ts, no ./music.',
  },
  {
    // Hoy lo caza `erasableSyntaxOnly` en el typecheck, pero con el mensaje de TypeScript.
    // Aca falla con el motivo del repo y en el editor, mientras se escribe.
    selector: 'TSEnumDeclaration',
    message: 'Cero enum: conjunto cerrado = const-object + union type derivado.',
  },
  {
    // La otra mitad de "sin estado global": el import de `react` es legitimo en
    // components/, asi que lo que hay que prohibir es la llamada, no el paquete.
    selector: "CallExpression[callee.name='createContext'], CallExpression[callee.property.name='createContext']",
    message: 'Sin estado global: ni Context, ni Redux, ni Zustand. El estado vive en App.tsx.',
  },
]

/**
 * "Los modulos no declaran constantes": un `.ts` de capa tiene funciones y nada mas, y los
 * valores fijos van a `<capa>/constants/`. El motivo esta medido y es viejo: antes habia
 * cuatro pares de numeros que tenian que coincidir y nada los sincronizaba.
 *
 * **Se aplica a `domain/` y `audio/`, no a `components/`, y la linea es la del motivo.** Lo
 * que el problema medido describe es un valor que existe DOS VECES; una constante privada de
 * un solo componente no puede desincronizarse con nada. Verificado antes de acotarla: en
 * `components/` hay siete —`BAR_COUNT`, `GAP`, `MIN_BAR` e `IDLE_TEXT` en `Spectrum.tsx`,
 * `BORDE_COLOR`, `VELO_CAJA` y `VELO_TAPA` en `Playhead.tsx`— y las siete estan documentadas
 * donde estan, con docblocks que explican el MECANISMO de dibujo (por que `box-shadow` y no
 * `transform: scale`, por que las clases de Tailwind van enteras). Mudarlas a `constants/`
 * mudaria esa explicacion lejos del codigo que explica, que es un peor lugar. En `domain/` y
 * `audio/`, en cambio, una constante es parte del modelo y `constants/` es su casa
 * documentada: las dos que quedaban fuera —`ROTATIONS` y `PASOS_MAX`— las mudo este spec.
 *
 * El selector mira `Literal`, `ArrayExpression` y `TemplateLiteral`, y NO `ObjectExpression`
 * ni `NewExpression`. Tampoco es una concesion: el spec 022 dejo escrito por que `MOTOR`
 * (`components/use-engine.ts`) y `RUTA_VACIA` (`components/route-source.ts`) viven en su
 * modulo y no en `constants/` — no son valores fijos sino cableado de funciones, y mandarlos
 * a `constants/` obligaria a esa carpeta —que hoy solo tiene datos— a importar el singleton
 * del `AudioContext`. La regla escrita apunta al numero magico; ensancharla a todo objeto
 * declararia deuda donde el repo ya decidio lo contrario, con el porque al lado.
 *
 * Y `kind='const'` no es decorativo: sin el, el selector engancha el estado mutable de modulo
 * —`let ctx: AudioContext | null = null` en `audio/engine.ts`— que no es una constante ni por
 * asomo. Medido: 21 hallazgos sin el ancla, 2 con el.
 */
const REGLA_CONSTANTES = {
  selector: "Program > VariableDeclaration[kind='const'] > VariableDeclarator[init.type='Literal'], Program > VariableDeclaration[kind='const'] > VariableDeclarator[init.type='ArrayExpression'], Program > VariableDeclaration[kind='const'] > VariableDeclarator[init.type='TemplateLiteral']",
  message: 'Los modulos no declaran constantes: el valor fijo va a <capa>/constants/.',
}

export default tseslint.config([
  globalIgnores(['dist']),

  {
    // Sin `files`, o sea que valen para todo el repo.
    //
    // `reportUnusedDisableDirectives` viene en `warn` por default en ESLint 9, y un warn no
    // rompe nada: el script pasa a correr con `--max-warnings 0` justamente para que si.
    //
    // `noInlineConfig` es la contraparte lint del "cero `any`, cero `@ts-ignore`" que el
    // repo ya cumple de hecho: medido antes de ponerlo, habia CERO `eslint-disable` en
    // `src/` y en `mcp-server/src/`. Se pone ahora porque ponerlo ahora es gratis. Si
    // manana hace falta una excepcion legitima, va como override por archivo en este
    // archivo —que se ve en el diff y se explica— y no como un comentario suelto que no.
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      noInlineConfig: true,
    },
  },

  {
    // Los `.js` del repo —hoy solo este archivo— no los lintaba NADIE: el unico bloque que
    // extendia `js.configs.recommended` estaba atado a `**/*.{ts,tsx}`, asi que el archivo
    // que decide que se verifica era el unico que no se verificaba. Medido con
    // `--print-config eslint.config.js`: 0 reglas.
    //
    // No necesita `disableTypeChecked` —que es lo que documenta typescript-eslint para este
    // caso— porque el bloque con tipos de abajo matchea `**/*.{ts,tsx}` y no lo alcanza.
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },

  {
    // TypeScript en todo el repo, CON informacion de tipos. `projectService: true` es la
    // forma que documenta typescript-eslint: cada archivo se typechequea con el tsconfig
    // que le corresponde —`tsconfig.app.json` para `src/`, `tsconfig.node.json` para
    // `vite.config.ts`, `mcp-server/tsconfig.json` para el server— sin listarlos aca.
    //
    // El costo esta medido y es lo que hace que entre: `recommendedTypeChecked` sobre el
    // repo entero da 100 hallazgos, y 97 son un solo patron de `node:test` que se apaga con
    // una opcion (ver `no-floating-promises` abajo). Lo que compra es prospectivo y es el
    // punto: `no-floating-promises` sobre `audio/` —donde `resume()` y `close()` devuelven
    // promesas— es el error que ningun test de este repo puede ver, porque el audio no se
    // testea por su sonido.
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 'latest',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'import-x': importX },
    settings: {
      // El resolver por defecto de import-x no conoce `.ts`. Se usa `createNodeResolver` y
      // no el resolver de TypeScript porque este repo no tiene alias ni `paths`: lo unico
      // que hay que resolver son rutas relativas con extension explicita, y para eso el
      // resolver de node alcanza y no arrastra el binario nativo (`unrs-resolver`), cuyo
      // script de instalacion queda bloqueado por el `allowBuilds` de `pnpm-workspace.yaml`.
      'import-x/resolver-next': [importX.createNodeResolver({ extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'] })],
    },
    rules: {
      // La direccion de dependencia, por ruta. Reemplaza a los cuatro overrides de
      // `no-restricted-imports` que verificaban lo mismo contando `../`.
      'import-x/no-restricted-paths': ['error', { zones: ZONAS }],

      // `import-x/no-cycle` NO esta, y la ausencia es la decision. Se probó y se midió:
      // encuentra CERO ciclos y cuesta 15 de los 25 segundos del lint —el 60 %— porque
      // recorre el grafo entero por archivo, y `mcp-server/` importa 31 simbolos de `src/`.
      // Lo que compraria ya lo compran las zonas de arriba: adentro de `domain/` la
      // direccion es un DAG de tres niveles y cada arista que podria cerrar un ciclo esta
      // prohibida por nombre, asi que un ciclo ahi no es improbable sino imposible. Fuera de
      // `domain/` las capas tampoco se pueden ver entre si. Si algun dia aparece un
      // subdirectorio con varios modulos hermanos sin zona propia, esta a una linea.

      // Los tres tsconfig tienen `verbatimModuleSyntax: true`, o sea que importar un tipo
      // sin `type` ROMPE EL BUILD en vez de avisar. La regla es autofixable: el error deja
      // de poder llegar al build.
      //
      // `disallowTypeAnnotations: false` deja pasar `typeof import('./x.ts')`, que es otra
      // cosa y no la que la regla existe para atrapar. Son dos usos y los dos estan en
      // tests que reimportan el modulo con `vi.resetModules()` / `vi.doMock`
      // (`components/__tests__/route-source.test.ts:28` y
      // `domain/__tests__/invariants.test.ts:114`): ahi `typeof import(...)` es la forma
      // idiomatica de nombrar el tipo de un modulo que el archivo justamente NO quiere
      // tener importado. Con `verbatimModuleSyntax` las dos formas se borran igual, asi que
      // reescribirlas cambiaria la intencion sin cambiar el runtime.
      '@typescript-eslint/consistent-type-imports': ['error', { disallowTypeAnnotations: false }],
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // `Cell` es `[number, number]` y el repo lo interpola a proposito en mensajes de
      // falla (`${TODAS[i]} / ${TODAS[j]}`). `allowArray` permite exactamente eso —arrays
      // cuyos elementos ya son interpolables— y deja parada la parte de la regla que
      // importa: objetos, `any` y nullish siguen prohibidos. Sin la opcion son 35
      // hallazgos, 25 de ellos en un solo archivo de tests.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowArray: true }],

      // `node:test` devuelve una promesa que NO hay que esperar: es la forma documentada de
      // escribir un test con `node --test`, que es lo que corre `mcp-server`. Son los 97
      // hallazgos de los 100 que da el preset. `allowForKnownSafeCalls` existe para esto y
      // apunta al paquete, no al nombre: un `test()` de otra procedencia sigue prohibido.
      '@typescript-eslint/no-floating-promises': ['error', {
        allowForKnownSafeCalls: [
          { from: 'package', name: 'test', package: 'node:test' },
          { from: 'package', name: 'describe', package: 'node:test' },
          { from: 'package', name: 'it', package: 'node:test' },
        ],
      }],

      'no-restricted-syntax': ['error', ...REGLAS_DEL_REPO],
    },
  },

  {
    // Los globals por entorno. Antes `globals.browser` se aplicaba a `**/*.{ts,tsx}`, o sea
    // tambien a `mcp-server/` y a `vite.config.ts`: verificado con `--print-config`,
    // `mcp-server/src/index.ts` recibia `window`, `document` y `AudioContext` definidos y
    // `process` NO. No rompia porque `no-undef` esta apagado para TypeScript —lo apaga el
    // preset de tseslint, y con razon: eso lo verifica el compilador—, pero era sorpresa
    // guardada y contradecia la regla que este mismo archivo escribe tres veces.
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['mcp-server/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },

  {
    // React solo donde hay React. `domain/` y `audio/` tienen prohibido importarlo, asi que
    // aplicarles las reglas de hooks era ruido.
    //
    // La clave es `configs.flat[...]` y no `configs[...]`: en el plugin 7.x el export de
    // arriba volvio a ser el de eslintrc —`plugins` como array de strings— y flat config lo
    // rechaza con un error de arranque. El preset pasa de 2 reglas a 17: ademas de
    // `rules-of-hooks` y `exhaustive-deps` entran las del React Compiler, que segun react.dev
    // salen por este plugin y no por uno separado, y sirven aunque el compilador no se
    // adopte. `set-state-in-effect` es literalmente el patron que el spec 022 concentro en
    // `use-engine.ts`; `immutability` y `purity` son la version React de "domain/ es puro".
    files: ['src/**/*.tsx', 'src/**/use-*.ts'],
    extends: [reactHooks.configs.flat['recommended-latest']],
  },
  {
    // `only-export-components` solo tiene sentido donde puede haber un componente.
    files: ['src/**/*.tsx'],
    extends: [reactRefresh.configs.vite],
  },

  {
    // Los paquetes prohibidos. Es lo unico que quedo en `no-restricted-imports`: un paquete
    // de npm no tiene ruta en el repo, asi que las zonas de `import-x` no lo pueden ver.
    //
    // Se usa la variante de typescript-eslint y no la core porque tambien ve los
    // `import type`, que son justo los que un refactor descuidado usaria para colarse.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: [GRUPO_ESTADO] }],
    },
  },
  {
    // Repite `GRUPO_ESTADO` porque el override lo REEMPLAZA: sin eso, agregarle a `domain/`
    // su prohibicion de React lo dejaria libre de importar zustand. Es el mismo trap de
    // siempre, y por eso los grupos son constantes con nombre y no listas escritas dos veces.
    files: ['src/domain/**/*.ts', 'src/audio/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: [GRUPO_ESTADO, GRUPO_REACT] }],
    },
  },

  {
    // La cuarta regla del repo, solo para los modulos de las dos capas puras: el glob
    // `src/domain/*.ts` matchea `domain/board.ts` y no `domain/constants/board.constants.ts`
    // (un nivel mas abajo) ni `domain/__tests__/board.test.ts`, que declaran constantes por
    // definicion. El por que de que `components/` quede afuera esta arriba, con la regla.
    files: ['src/domain/*.ts', 'src/audio/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...REGLAS_DEL_REPO, REGLA_CONSTANTES],
    },
  },

  {
    // Fallar en verde es el bug que este repo ya se comio dos veces —el `--filter "{.}"` que
    // reportaba exito sin correr nada, y el `$` del regex que arrancaba un segundo vitest— y
    // un `.only` olvidado es el mismo bug con otra cara: deja pasar la suite entera sin que
    // nada avise. Medido antes de ponerlo: cero `.only` y cero `.skip` en los 16 archivos.
    //
    // `fixable: false` es deliberado: no se quiere que `--fix` borre el `.only` en silencio,
    // se quiere que falle.
    files: ['src/**/__tests__/**/*.{ts,tsx}'],
    plugins: { vitest },
    rules: {
      'vitest/no-focused-tests': ['error', { fixable: false }],
      'vitest/no-disabled-tests': 'error',
      'vitest/expect-expect': 'error',
      // `maxArgs: 2` porque Vitest —a diferencia de Jest— acepta un mensaje como segundo
      // argumento (`expect(x, 'por que')`), y este repo lo usa en 24 aserciones. Con el
      // default de la regla las 24 fallaban por una diferencia de API, no por un problema.
      'vitest/valid-expect': ['error', { maxArgs: 2 }],
      'vitest/no-identical-title': 'error',
    },
  },
])

# Research — Spec 029

Todo lo de acá se midió sobre el repo, con configs sonda temporales que no quedaron. Las fuentes de
documentación —`typescript-eslint`, `eslint-plugin-import-x`, `@vitest/eslint-plugin` y `react.dev`—
se consultaron con context7.

---

## 1. El estado de partida, medido

| Hecho | Cómo se midió |
|---|---|
| `pnpm lint` sale **0 warnings, 0 errores** | `npx eslint .` |
| La única regla en `warn` es `react-hooks/exhaustive-deps` | `--print-config src/App.tsx`, filtrando severidad 1 |
| `eslint .` **sí** lintea `mcp-server/` con el config de la app | `--print-config mcp-server/src/index.ts` → 91 reglas, `react-refresh` en error, `window` definido, `process` no |
| `eslint.config.js` se lintea con **0 reglas** | `--print-config eslint.config.js` |
| **0** `eslint-disable` en `src/` y `mcp-server/src/` | grep |
| **0** `.only` / `.skip` en los 16 archivos de test | grep |
| **0** imports locales sin extensión, sobre **283** | grep |
| `recommended-latest` de react-hooks 5.2.0 activa **2** reglas | `--print-config`, contando `react-hooks/*` |

**Los cinco ceros son el argumento del spec, no un detalle.** Cada regla nueva entra sin un solo
hallazgo que arreglar, así que el costo de adoptarlas hoy es cero y todo lo que hacen es proteger el
futuro. Es el momento barato.

---

## 2. `eslint-plugin-react-hooks`: el export se invirtió

`pnpm add -D eslint-plugin-react-hooks@latest` trajo **7.1.1**. Con la línea que el repo ya tenía
—`reactHooks.configs['recommended-latest']`— ESLint **no arranca**:

```
A config object has a "plugins" key defined as an array of strings.
```

Inspeccionando el plugin instalado: en 7.x `configs['recommended-latest']` volvió a ser el preset de
**eslintrc** y el flat se mudó a `configs.flat['recommended-latest']`. Es lo contrario de 5.x. Va a
`troubleshooting.md`, porque el mensaje de error apunta a migrar una config que ya está migrada.

Con la clave correcta:

| | reglas |
|---|---|
| 5.2.0, `configs['recommended-latest']` | **2** — `rules-of-hooks`, `exhaustive-deps` |
| 7.1.1, `configs.flat['recommended-latest']` | **17** |

Las 15 nuevas son las del React Compiler. Verificado en react.dev vía context7: **no existe un
`eslint-plugin-react-compiler` separado**, los diagnósticos salen por este plugin y sirven aunque el
compilador no se adopte.

**Hallazgos sobre el repo con las 17 activas: cero.** El código ya las cumple. Es el frente más barato
del spec y el de mayor valor por línea de diff: `set-state-in-effect` es literalmente el patrón que el
spec 022 concentró en `use-engine.ts`, e `immutability` y `purity` son la versión React de «`domain/`
es puro».

Tres de las 17 vienen en `warn` —`exhaustive-deps`, `incompatible-library`, `unsupported-syntax`—, que
es la mitad del argumento de `--max-warnings 0`.

---

## 3. Linting con tipos: 100 hallazgos, y 97 son uno solo

`recommendedTypeChecked` + `projectService: true` sobre **todo** el repo:

| Regla | Hits | Dónde |
|---|---|---|
| `no-floating-promises` | 97 | los cuatro `mcp-server/src/__tests__/*.test.ts` |
| `restrict-template-expressions` | 2 | `domain/invariants.ts:232` |
| `require-await` | 1 | `audio/__tests__/voice.test.ts:213` |

**Cero** `no-misused-promises`, cero `no-unsafe-*`.

Los 97 son un solo patrón: `node:test` devuelve una promesa que no hay que esperar, y así se escribe un
test con `node --test`. `allowForKnownSafeCalls` existe para esto y apunta al **paquete**, no al nombre:
un `test()` de otra procedencia sigue prohibido. Con la opción puesta, quedan 3.

Una medición previa, sólo sobre `src/`, había dado **36** hallazgos: 35 de `restrict-template-expressions`
—25 en `domain/__tests__/board.test.ts`, que interpola un `Cell`— y 1 de `require-await`. `Cell` es
`[number, number]` y el repo interpola la tupla a propósito en mensajes de falla; `allowArray: true`
permite exactamente eso y deja parada la parte de la regla que importa. Bajan de 35 a **2**.

Los 2 que quedan son interesantes y **no** son ruido: `NOTES_PER_PIECE !== CELLS_PER_PIECE` compara dos
literales `5`, así que TypeScript estrecha los dos a `never` adentro del `if` y la regla avisa que ese
mensaje no se puede producir nunca. El chequeo igual no sobra —existe para el día en que alguien cambie
uno de los dos— así que la salida es leerlos por una variable `number`.

`strictTypeChecked` + `stylisticTypeChecked` da **237** y no entra: los dos que valdrían sueltos son
`no-unnecessary-condition` (1) y `no-non-null-assertion` (12).

---

## 4. `import-x`: las zonas funcionan, y `no-cycle` no vale lo que cuesta

**Control positivo** —lo importante, porque cero hallazgos también es lo que devuelve un resolver roto—:
se le agregaron a `src/domain/board.ts` dos imports prohibidos y los dos fallaron.

```
1:29  error  Unexpected path "./music.ts" imported in restricted zone         import-x/no-restricted-paths
2:30  error  Unexpected path "../audio/engine.ts" imported in restricted zone import-x/no-restricted-paths
```

Resuelve `.ts` con `createNodeResolver({ extensions: [...] })`, **sin** el resolver de TypeScript: este
repo no tiene alias ni `paths`, y el de node no arrastra el binario nativo (`unrs-resolver`), cuyo
script de instalación queda bloqueado por el `allowBuilds` de `pnpm-workspace.yaml`.

### El costo, atribuido

| Corrida | ms |
|---|---|
| lint completo, con `no-cycle` | 24 985 |
| sin `no-cycle` | 9 774 |
| sin `import-x` entero | 10 218 |
| sólo `src/` | 8 387 |
| sólo `mcp-server/` | 13 891 |

**`no-cycle` es el 60 % del lint y encuentra cero ciclos.** Recorre el grafo entero por archivo y
`mcp-server/` importa 31 símbolos de `src/`, así que ahí paga doble. Y lo que compraría ya lo compran
las zonas: adentro de `domain/` la dirección es un DAG de tres niveles con cada arista de vuelta
prohibida por nombre, o sea que un ciclo no es improbable sino **imposible**. Queda fuera, anotado.

---

## 5. `no-restricted-syntax`: los cuatro selectores, probados

Sobre un archivo sintético con las cuatro violaciones, los cuatro dispararon y ninguno tocó ni una
arrow function ni un `const` local dentro de una función.

Dos detalles que salieron de medir y no de suponer:

- **La regex de esquery se corta en la primera `/`.** El selector tuvo que escribirse sin barras:
  `^[.].*(?<![.]ts|[.]tsx|[.]css|[.]json)$` en vez de anclar a `./`. Con la barra, ESLint aborta con
  `Invalid regular expression: Unterminated character class`.
- **`kind='const'` no es decorativo.** Sin el ancla, la regla de constantes enganchaba el estado mutable
  de módulo —`let ctx: AudioContext | null = null` en `audio/engine.ts`— que no es una constante ni por
  asomo. **21 hallazgos sin el ancla, 2 con él.**

### La regla de constantes no se puede aplicar como está escrita

Con `kind='const'` puesto quedaban **9** hallazgos, y mirarlos uno por uno cambió el diseño de la regla:

| Dónde | Qué |
|---|---|
| `Spectrum.tsx` | `BAR_COUNT`, `GAP`, `MIN_BAR`, `IDLE_TEXT` |
| `Playhead.tsx` | `BORDE_COLOR`, `VELO_CAJA`, `VELO_TAPA` |
| `domain/invariants.ts` | `ROTATIONS` |
| `domain/sequence.ts` | `PASOS_MAX` |

Las siete de `components/` **no son deuda**. Son privadas de su archivo, están documentadas donde
están, y sus docblocks explican el **mecanismo** de dibujo —por qué `box-shadow` y no `transform:
scale`, medido en el DOM; por qué las clases de Tailwind van escritas enteras—. Mudarlas a `constants/`
mudaría esa explicación lejos del código que explica.

Y el motivo escrito de la regla lo confirma: lo que hizo daño fueron **cuatro pares de números que
tenían que coincidir**. Un valor privado de un solo archivo no puede desincronizarse con nada. Así que
la regla se aplica a `domain/` y `audio/` —donde una constante es parte del modelo y `constants/` es su
casa documentada— y las dos que quedaban fuera ahí, `ROTATIONS` y `PASOS_MAX`, se mudan.

Es una desviación de lo que `CLAUDE.md` dice hoy en presente, y por eso la doc se corrige.

---

## 6. `@vitest/eslint-plugin`: una diferencia de API, no un problema

Con el preset puesto, 24 hallazgos de `vitest/valid-expect`: *«Expect takes at most 1 argument»*. No es
un error del repo — **Vitest, a diferencia de Jest, acepta un mensaje como segundo argumento**
(`expect(x, 'por qué')`) y el repo lo usa en 24 aserciones. `maxArgs: 2` y quedan 0.

Los tres controles positivos —`.only`, `.skip`, test sin aserción— fallan como se espera.
`fixable: false` en `no-focused-tests` es deliberado: que `--fix` borre el `.only` en silencio es peor
que fallar.

---

## 7. `consistent-type-imports`: 4 hallazgos, 2 autofixeables y 2 que no se tocan

Los dos de `components/types/*.types.ts` los arregla `--fix`. Los otros dos son
`typeof import('../x.ts')` en tests que reimportan el módulo con `vi.resetModules()` / `vi.doMock`
—`route-source.test.ts:28` y `invariants.test.ts:114`—, que es la forma idiomática de nombrar el tipo
de un módulo que el archivo justamente **no** quiere tener importado. Con `verbatimModuleSyntax` las dos
formas se borran igual, así que reescribirlas cambiaría la intención sin cambiar el runtime:
`disallowTypeAnnotations: false`.

---

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| `pnpm verify` pasa de 4,0 s a 11,8 s | Medido y anotado en `CLAUDE.md`. Ya se recortaron los 15 s de `no-cycle`. Si molesta, lo próximo a soltar es el linting con tipos en `mcp-server/`, que es la mitad cara |
| `noInlineConfig` deja sin escape a un caso legítimo futuro | El escape existe y es mejor: un override por archivo en `eslint.config.js`, que se ve en el diff |
| Un plugin más (`import-x`) es superficie nueva | Se usa **una** regla, sin el resolver nativo. `no-cycle` —la parte cara y frágil— no entró |
| El salto de dos majors de react-hooks | Medido: cero hallazgos sobre el repo. El único cambio fue la clave del preset |
| Los patrones de `files` nuevos podrían dejar un archivo sin lintear | Verificado con `--print-config` sobre `mcp-server/src/index.ts`, `eslint.config.js`, `vite.config.ts` y `src/App.tsx` |

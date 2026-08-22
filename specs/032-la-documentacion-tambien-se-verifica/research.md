# Research — Spec 032

Todo lo de acá está **medido** sobre el `main` del 2026-08-22 (`e6fae9e`, con el 031 ya mergeado), con
`@eslint/markdown@8.0.3` y scripts de un solo uso. **Cuatro** supuestos se cayeron midiendo y están
anotados donde se cayeron.

> Los conteos incluyen los cuatro `.md` de este mismo spec, que ya existen cuando se mide. Donde el
> número cambia por eso, se dice cuál es el otro.

## 0. La superficie

| | Archivos |
|---|---|
| `.md` en el repo (sin `node_modules`, `dist`) | **159** (155 sin los de este spec) |
| raíz (`CLAUDE.md`, `README.md`, `DESIGN.md`, más el del server) | 4 |
| `docs/` | 10 |
| `specs/` | 133 (129) |
| `.claude/` | 12 |

`CLAUDE.md`: **286 líneas / 20 599 bytes**.

## 1. `@eslint/markdown` sobre el repo entero

`markdown/recommended`, lenguaje `markdown/gfm`, sin ninguna regla apagada.

### Primera corrida: 528 hallazgos

| Regla | Hallazgos |
|---|---|
| `no-missing-label-refs` | 341 |
| `fenced-code-language` | 168 |
| `no-multiple-h1` | 17 |
| `table-column-count` | 1 |
| `heading-increment` | 1 |

### Supuesto caído nº 1 — `no-multiple-h1` no encontraba encabezados, encontraba YAML

Los 17 `no-multiple-h1` no eran encabezados. Ejemplo: `.claude/rules/ui.md:6`, que es

```yaml
---
paths:
  - "src/App.tsx"
  # Los `.ts` de la capa entran desde el spec 022: los efectos que el shell tenía
```

El parser no reconocía el bloque `---` como frontmatter, así que leía los **comentarios YAML** como H1.
Con `languageOptions: { frontmatter: 'yaml' }` desaparecen **22 hallazgos** de golpe: los 15
`no-multiple-h1` de `.claude/` y **7** `no-missing-label-refs` que eran flags entre corchetes dentro
del frontmatter de los skills. Es una línea de config y no una excepción.

### Segunda corrida, con `frontmatter: 'yaml'`: 506 hallazgos

| Zona | Regla | Hallazgos |
|---|---|---|
| `specs/` | `no-missing-label-refs` | 334 |
| `specs/` | `fenced-code-language` | 145 |
| `docs/` | `fenced-code-language` | 13 |
| `.claude/` | `fenced-code-language` | 8 |
| `specs/` | `no-multiple-h1` | 2 |
| raíz | `fenced-code-language` | 1 |
| `mcp-server/` | `fenced-code-language` | 1 |
| `specs/` | `table-column-count` | 1 |
| `specs/` | `heading-increment` | 1 |

O sea **483 en el carril B** (los specs congelados) y **23 en el carril A** (todo lo demás), los 23 de
`fenced-code-language`.

### Supuesto caído nº 2 — `no-missing-label-refs` no tiene un solo acierto acá

Se esperaba que cazara referencias de enlace rotas. Lo que caza es el **formato de tarea del propio
repo**. Desglose de las 341 por etiqueta:

| Etiqueta | Veces | Qué es |
|---|---|---|
| `[P]` | 191 | marcador de paralelizable de `specs/README.md` |
| `[M]` | 131 | marcador de «pide una persona» de `specs/README.md` |
| `[…]` | 14 | elisión en prosa |
| `[--dry]` | 3 | flag de un skill |
| `[--cleanup]` | 1 | ídem |
| `[--comentar]` | 1 | ídem |

**341 de 341 son falsos positivos.** La regla se apaga en los dos carriles, y el motivo no es que
moleste sino que en este repo no puede acertar: el formato que dispara la regla es un formato
**documentado**.

### El hallazgo real: la tabla del 027

`specs/027-lo-que-falla-en-silencio/research.md:112`

```
| `playNotes` | `if (!c || !master) return` | Sale bien |
```

La tabla declara tres columnas. Ésta tiene cinco, porque las dos barras del `||` **no están escapadas**
y GFM parte la celda aunque esté dentro de un code span. Las otras cuatro filas de la misma tabla
escriben `\|\|` y renderizan bien. Consecuencia visible en GitHub: el code span se parte en tres
celdas y, como la tabla declara tres columnas, **la fila pierde `Sale bien`** — que es justamente lo
que la fila venía a decir. Es un bug de contenido, no de estilo, y es la
justificación entera del carril B: si la única regla que se aplica sobre un spec congelado hubiera
sido de estilo, este hallazgo no aparecía.

## 2. Enlaces relativos

Barrido propio sobre los 159 `.md`: todo enlace en línea con destino no absoluto, resolviendo el
archivo contra el filesystem y el `#ancla` contra los encabezados del destino.

### Supuesto caído nº 3 — el slug de GitHub no colapsa espacios

Primera corrida: **5 rotos**. Cuatro eran del instrumento. `docs/architecture/modelo-musical.md` tiene

```markdown
## Forma → qué celda tiene qué nota
```

que en GitHub genera `forma--qué-celda-tiene-qué-nota`, con **dos** guiones: la flecha se borra y los
dos espacios que quedan pasan a dos guiones, uno por espacio. El slugger de prueba hacía
`.replace(/\s+/g, '-')` y colapsaba, así que declaraba roto un enlace que funciona. Corregido a
`.replace(/\s/g, '-')` —sin el `+`— los cuatro desaparecen.

Con el slugger correcto queda **1 roto, y es real**:

```
docs/guides/mcp-domain.md → ./troubleshooting.md#el-mcp-server-no-arranca-err_module_not_found
```

`docs/guides/troubleshooting.md` no tiene ningún encabezado que genere ese slug. El enlace lleva a la
cabecera del archivo, en silencio.

### Supuesto caído nº 4 — el barrido tiene que saltear los code spans

Corriendo el mismo barrido **después** de escribir este spec apareció un segundo roto, y era del
instrumento otra vez: un borrador de la sección de arriba escribía la forma de un enlace entre
backticks para explicar qué se busca, y el barrido —una regex sobre el texto crudo— la leyó como un
enlace a un archivo con el nombre del placeholder. La frase se reescribió, así que el hallazgo ya no
está; la lección sí.

El test de AC2 **no puede ser una regex sobre el archivo entero**: tiene que sacar los bloques con
fence y los code spans antes de buscar. Es barato —dos `replace` antes del `matchAll`— y es
exactamente el tipo de cosa que se descubre midiendo sobre el repo real y no sobre un ejemplo,
porque los docs de este repo hablan **de** Markdown todo el tiempo y van a seguir haciéndolo. Sin
eso, el primer doc que documente la sintaxis de un enlace rompe el gate.

**Falsos positivos con el slugger corregido y los code spans salteados: 0 sobre 159 archivos.** Es lo
que hace que esta verificación entre como gate y la de la sección 4 no.

## 3. `directory-structure.md` contra el filesystem

Se pregunta si el **basename** de cada archivo de producción aparece en el doc.

| | Archivos | No nombrados |
|---|---|---|
| `src/` producción | 61 | **4** |
| `src/` tests | 56 | 38 (el doc los documenta a nivel de carpeta) |
| `mcp-server/src/` producción | 12 | 6 |
| `mcp-server/src/` tests | 4 | 4 |

Los 4 de `src/`, que son rot real:

```
src/audio/constants/engine.constants.ts
src/audio/constants/scheduler.constants.ts
src/audio/constants/voice.constants.ts
src/domain/types/music.types.ts
```

De los 6 de `mcp-server/`, **cinco son de `tools/`** y el doc los resume a propósito —la línea dice
`tools/  una tool por archivo + el array de index.ts`—; el sexto, `symbols.ts`, sí falta y es rot: es
un módulo de primer nivel como `render.ts` y `specs.ts`, que sí están. De ahí el corte de AC3: se
exige `mcp-server/src/*.ts` de primer nivel y no lo de adentro de `tools/`.

Los tests quedan afuera por lo mismo, y con más razón: 38 de los 56 no aparecen y 12 de esos 38 son
**PNG de `__screenshots__/`**, que ni siquiera son código.

## 4. Lo que se midió y **no** entra: rutas en prosa

Se probó el gate «toda ruta que la prosa nombra existe» sobre los docs vivos, resolviendo contra la
raíz, `src/`, `mcp-server/src/` y el directorio del propio doc.

| Forma del token | Tokens | No resuelven |
|---|---|---|
| con carpeta (`domain/board.ts`) | 100 | 9 |
| basename suelto (`use-engine.ts`) | 214 | 15 |

**24 de 314, y las 24 son correctas como están.** Clasificadas:

| Motivo | Ejemplos |
|---|---|
| patrón, no archivo | `PascalCase.tsx` (×3), `useCamelCase.ts`, `-loop.ts` |
| hipotético para explicar una regla | `domain/sub/x.ts` (×2, en `CLAUDE.md` y `conventions.md`) |
| no es del repo | `lib.dom.d.ts` (×2) |
| se nombra **porque no está** | `package-lock.json` (×2), `postcss.config.js` (×2), `tailwind.config.js`, `App.css`, `setupTests.ts`, `App.test.tsx` |
| convención todavía no aplicada | `styles/theme.css`, `styles/base.css`, `types/index.ts` |
| shorthand de una ruta que sí existe | `__tests__/transform.test.ts`, `__tests__/integration.test.ts` |

Se probó acotar por heurística —«sólo si el directorio padre existe»— y baja los falsos positivos de
24 a 2, pero no a 0, y deja una regla que nadie puede predecir leyéndola. La conclusión es la del
umbral de coverage al 100: **una lista de excepciones sin dueño es peor que no tener el gate**. Queda
afuera, y la superficie verificada es el enlace Markdown de la sección 2.

## 5. Convención de `specs/`

Barrido sobre las 32 carpetas y los 1 601 checkboxes.

| Propiedad | Resultado |
|---|---|
| carpetas con los cuatro archivos | **32/32** |
| nombres fuera de `NNN-kebab` | **0** |
| filas de `log.md` ↔ carpetas | **32 ↔ 32**, biyectivo |
| filas con `href` que no existe | **0** |
| filas con `href` que apunta a otra carpeta | **0** |
| fechas fuera de ISO | **0** |
| estados fuera del conjunto declarado | **0** (`Descartado` · `Implementado` · `Superado` · `Propuesto`) |
| orden de las filas | ascendente |
| líneas de checkbox que **no** parsean | **0** de 1 601 |
| IDs `T###` duplicados dentro de un spec | **0** |

Todo el gate de AC8 entra con **cero** arreglos. Las dos cosas que Spec Kit pide y acá no se cumplen
están medidas y por eso AC9 las deja afuera:

- **IDs consecutivos desde `T001`**: no se cumple en **17 de los 22** specs que tienen IDs.
- **una ruta de archivo por tarea**: 585 de 1 601 tareas no tienen ni ID.

Los 10 specs sin IDs son los primeros, anteriores a que `specs/README.md` marcara el ID como
obligatorio «en specs nuevos». O sea que la convención del repo ya previó esto y el gate sólo tiene
que respetarla.

## 6. Las afirmaciones de `CLAUDE.md` que resultaron falsas

`@typescript-eslint/no-non-null-assertion` corrido sobre `src/` y `mcp-server/`:

| Dónde | Aserciones `!` | `CLAUDE.md` dice |
|---|---|---|
| producción | **3** | «Quedan **dos**» |
| tests | **95**, en 13 archivos | «hay **66**» |

La tercera de producción es `src/components/Board.tsx:246`:

```ts
const grilla = e.currentTarget.closest('[role="grid"]')!;
```

y **está anotada** con nueve líneas que explican por qué el compilador no puede verlo (el ancestro
existe por construcción, y el `if` alternativo sería una rama inalcanzable, o sea cobertura
imposible). O sea que la regla de `CLAUDE.md` —«cada una viene con el comentario que dice por qué»— se
cumple; lo que está mal es **el conteo**, que es justamente lo que un número escrito a mano hace. Por
eso el arreglo no es tocar `Board.tsx` sino poner la regla con sus tres overrides: a partir de ahí el
número no puede desincronizarse porque no hay número, hay una lista en el config.

`no-warning-comments` con `v8 ignore` / `c8 ignore` / `istanbul ignore`: **0 hallazgos**. La
afirmación «cero `/* v8 ignore */`» de `CLAUDE.md` es cierta hoy, y por eso la regla entra gratis.

## 7. El presupuesto de `CLAUDE.md`

La convención de Anthropic aparece en dos páginas distintas de la documentación de Claude Code y dice
lo mismo:

> CLAUDE.md files are loaded into the context window at the start of every session, meaning their size
> directly impacts token usage. To maintain reliability, **keep files under 200 lines** and use clear
> markdown structure. For larger projects, utilize path-scoped rules […]
> — `code.claude.com/docs/en/memory`

> CLAUDE.md files are loaded at session start and persist in every request. To optimize performance,
> it is recommended to **keep these files under 200 lines** and move reference material to skills,
> which load on-demand.
> — `code.claude.com/docs/en/features-overview`

Hoy son **286**. El reparto por sección:

| Sección | Líneas |
|---|---|
| encabezado | 7 |
| `## Qué es` | 15 |
| **`## Comandos`** | **100** |
| `## Arquitectura` | 32 |
| **`## Reglas que valen en todo el repo`** | **76** |
| `## Preguntarle al dominio en vez de simularlo` | 27 |
| `## Documentación` | 22 |
| `## Antes de un cambio grande` | 7 |

Las dos secciones gordas son 176 de las 286. Y las dos son **detalle**, no cheat sheet: `## Comandos`
son cuatro páginas de por qué `verify` tiene la forma que tiene, y `## Reglas` repite el razonamiento
que `docs/guides/conventions.md` ya tiene. El propio archivo dice en su línea 3 que eso vive en
`docs/`, así que el recorte no importa una regla de afuera: **hace cumplir la que el archivo ya se
puso**.

Destino del detalle que sale: un `docs/guides/verificacion.md` nuevo —hoy no hay ningún doc que
explique `verify`, y `quickstart.md` sólo lista comandos— más lo que ya está en
`docs/guides/conventions.md`.

## 8. Por qué `@eslint/markdown` y no otra cosa

| Candidato | Por qué no |
|---|---|
| `markdownlint-cli2` | Reglas más ricas, pero es un **segundo linter**: segundo config, segundo `--max-warnings`, segundo lugar donde vive el régimen de dos carriles. Es el argumento con el que `verify.yml` corre el script y no la lista de nodos |
| `remark-lint` | Lo mismo, más una cadena de plugins unified que nadie más en el repo usa |
| una regla ESLint propia sobre el AST de mdast | Es lo que haría falta para el chequeo de enlaces (§2), porque el plugin oficial sólo valida anclas **dentro del mismo archivo** (`no-missing-link-fragments`) y no cross-file. Se descartó: la regla tendría que abrir archivos que ESLint no le pasó, y el mismo chequeo como test son 40 líneas y un mensaje de falla mucho mejor |

`@eslint/markdown` es el plugin **oficial** de ESLint, entra con `extends: ['markdown/recommended']` en
la flat config que ya existe, y hereda gratis el `--max-warnings 0` y el `noInlineConfig` que el 030
puso.

# Spec 032 — La documentación también se verifica

> Sin ticket: este repo no tiene tablero de Jira. Ver [`specs/README.md`](../README.md).
>
> **No cambia una nota, ni un tiempo, ni un timbre, ni un píxel.** Es el hermano del
> [030](../030-el-linter-verifica-lo-que-claude-md-declara/spec.md) para el otro lado del repo: el 030
> hizo que el linter verificara lo que `CLAUDE.md` declara **sobre el código**; este hace que
> `pnpm verify` verifique la documentación misma — que sus enlaces resuelvan, que su mapa del
> filesystem no mienta, que sus afirmaciones contables sean ciertas, que los specs cumplan la
> convención que `specs/README.md` documenta, y que `CLAUDE.md` entre en el presupuesto que Anthropic
> publica para él.
>
> **Cinco hallazgos reales, medidos antes de escribir una línea de config**, y ninguno es hipotético:
>
> | Hallazgo | Dónde |
> |---|---|
> | Una tabla que **GitHub renderiza mal** y descarta dos celdas | `specs/027-.../research.md:112` |
> | Un comentario que la regla nueva de AC6 rechaza | `vite.config.ts:155` |
> | **5 archivos** que el mapa del filesystem no nombra | `docs/architecture/directory-structure.md` |
> | `CLAUDE.md` dice que quedan **dos** aserciones no nulas en producción: son **tres** | `src/components/Board.tsx:252` |
> | `CLAUDE.md` dice que hay **66** en tests: son **100** | `src/**/__tests__/` |
>
> **El sexto candidato se cayó midiendo y la lección quedó dentro de AC2.** El «ancla muerta» de
> `docs/guides/mcp-domain.md` **no está muerta**: el slugger del barrido borraba el `_`, y el ancla
> real —`#el-mcp-server-no-arranca-err_module_not_found`, que
> `docs/guides/troubleshooting.md:170` sí genera— lo lleva. Es el mismo modo de falla que el
> supuesto caído nº 3 del [`research.md`](./research.md) con otro carácter, y por eso AC2 fija el
> slug carácter por carácter en vez de describirlo.
>
> **El precio se mide al implementar y se anota en [`research.md`](./research.md)**, no acá: los dos
> nodos que toca son `lint` (159 archivos `.md` más) y `suite` (cuatro tests más), y el spec sólo se
> cierra si `verify` sigue mandado por `suite` — si el Markdown lo diera vuelta habría que reabrir la
> decisión de meterlo en `lint`.

## Problema

`pnpm verify` tiene cuatro nodos y ninguno mira un `.md`. El repo tiene **159** archivos Markdown
—20 599 bytes sólo en `CLAUDE.md`— y toda la documentación que gobierna cómo se trabaja acá vive en
ellos. Hoy la única verificación que los toca es indirecta y de tres valores puntuales:
`nombre-sincronizado.test.ts` compara el nombre de la app entre `manifest.json`, `index.html` y
`README.md`, y `fondo-sincronizado.test.ts` hace lo mismo con el color de fondo.

Es el mismo argumento que el 030 hizo para el código, con el sujeto cambiado: **una regla escrita que
no verifica nadie se cumple por disciplina, y la disciplina es lo que el primer bullet de
«Reglas que valen en todo el repo» declara insuficiente.** La diferencia es que la documentación se
pudre más rápido que el código, porque el código al menos rompe el build cuando miente.

La lista de lo que hoy no verifica nadie, con lo que ya se rompió:

| Lo que la documentación afirma | Qué lo verifica hoy | Ya está roto |
|---|---|---|
| Sus enlaces relativos apuntan a algo | nadie | no (0 de 159 archivos) |
| Sus tablas tienen las columnas que dicen | nadie | **sí** (1) |
| `directory-structure.md` es el mapa de `src/` y de `mcp-server/src/` | nadie | **sí** (5 archivos) |
| «Quedan **dos** aserciones no nulas, las dos anotadas» | nadie | **sí** (son 3) |
| «Hay **66** en `src/**/__tests__/`» | nadie | **sí** (son 100) |
| «Cero `/* v8 ignore */`» | nadie | **sí** (1: `vite.config.ts:155`) |
| Los specs tienen sus cuatro archivos y su fila en `log.md` | nadie | no |
| El formato de tarea de `specs/README.md` | `parseTasks`, **que descarta en silencio** | no |
| `CLAUDE.md` bajo 200 líneas (convención de Anthropic) | nadie | **sí** (286) |

Los dos últimos merecen su párrafo.

**`parseTasks` no valida: cuenta lo que matchea.** `mcp-server/src/specs.ts:113` tiene el regex del
formato de tarea, y una línea que empieza con `- [ ]` y no matchea **no se cuenta y no avisa**. O sea
que una tarea mal escrita baja el total de `spec_status` sin que nada diga nada: es exactamente la
familia «fallar en verde» que este repo ya se comió dos veces con el `--filter "{.}"` y con el `$` del
regex de `verify`. Hoy hay **cero** líneas malformadas en los 32 specs —1 601 tareas parseadas—, así
que el gate entra gratis y a partir de ahí la tool es correcta **por construcción** y no por suerte.

**Y `CLAUDE.md` viola la única convención que Anthropic publica para él y que es mecanizable.** La
documentación de Claude Code lo dice en dos lugares distintos —`docs/en/memory` y
`docs/en/features-overview`—: el archivo se carga entero en el contexto **al arranque de cada sesión y
persiste en cada request**, así que la recomendación es mantenerlo **bajo 200 líneas** y mover el
material de referencia a reglas con `paths` (que este repo ya tiene: `.claude/rules/`) o a `docs/`.
Hoy son **286**, un 43 % por encima. Y no es una regla ajena que llega de afuera: el propio
`CLAUDE.md` la escribe en su segunda línea —«Es un *cheat sheet*: lo que no se puede averiguar mirando
un archivo. El detalle vive en `docs/`»— y después no la cumple. Las 100 líneas de `## Comandos` son
el detalle, no el cheat sheet.

## Solución propuesta

Dos mecanismos, elegidos por lo que cada cosa **es**, no por comodidad:

- **Lo que es una propiedad del texto va al linter** (`pnpm lint`), con el plugin oficial
  `@eslint/markdown`. Un enlace vacío, una tabla con columnas de más y un fence sin lenguaje son
  errores del Markdown y ESLint es quien ya lintea este repo.
- **Lo que es una relación entre dos archivos va a un test** del proyecto `node` (`pnpm suite`). Que
  un enlace resuelva contra el filesystem, que el mapa de directorios coincida con `src/`, que
  `log.md` sea biyectivo con `specs/` — nada de eso es una propiedad de un archivo mirado solo, y
  quererlo como regla de ESLint sería pedirle al linter que abra archivos que no le tocaron.

**No hay nodo nuevo en `verify`.** El nodo de convergencia sigue teniendo cuatro, por el mismo motivo
que el 029 encadenó `test` y `coverage` en vez de sumar un quinto proceso: cinco procesos pesados
compitiendo por CPU es lo que vuelve espurio el presupuesto de performance del 009.

### El régimen de dos carriles para el Markdown

Ésta es la única decisión de diseño con filo, y sale de una **contradicción medida** entre dos reglas
que el repo ya tiene escritas.

`specs/README.md` **Desviación 2** dice: *«Un spec mergeado no se reescribe. Acá son ADR: registro de
qué se decidió y con qué evidencia, con fecha.»* Y el preset `markdown/recommended` sobre los 133
archivos de `specs/` da **483 hallazgos**. Aplicarlo entero obligaría a reescribir 29 specs cerrados
para satisfacer una regla de estilo, que es exactamente lo que la Desviación 2 prohíbe.

La salida no es apagar el linter en `specs/` ni relajar la Desviación: es cortar por **qué caza cada
regla**.

- **Carril A — documentación viva** (`CLAUDE.md`, `README.md`, `DESIGN.md`, `docs/**`, `.claude/**`,
  `mcp-server/**`, y los tres registros `specs/{README,log,deuda,revisiones}.md`):
  `markdown/recommended` completo. Es documentación que se mantiene al día por definición —lo dice la
  propia Desviación 2— así que puede cumplir una regla de estilo. **Costo medido: 23 hallazgos**, los
  23 de `fenced-code-language`.
- **Carril B — specs congelados** (`specs/[0-9]*/**`): sólo las reglas que cazan un **error de
  renderizado**, o sea las que hacen que GitHub muestre algo distinto de lo que el autor escribió.
  Ninguna regla de estilo. **Costo medido: 1 hallazgo**, y es un bug real —
  `specs/027-.../research.md:112` tiene `` `if (!c || !master) return` `` con las barras **sin
  escapar** dentro de un code span, así que GFM parte la fila en cinco celdas, la tabla declara tres y
  **las dos últimas se descartan al renderizar**. Las otras cuatro filas de esa misma tabla escriben
  `\|\|`. Arreglar eso no es reescribir un spec: es arreglar un typo que hoy oculta contenido.

Dos reglas del preset se apagan **en los dos carriles**, con la medición al lado:

- **`no-missing-label-refs`: 341 hallazgos, 341 falsos positivos.** El formato de tarea que
  `specs/README.md` documenta —`- [ ] T012 [P] [M] …`— hace que `[P]` y `[M]` parezcan referencias de
  enlace abreviadas. Son **322 de los 341**; los otros 19 son prosa deliberada (`[…]`, `[--dry]`,
  `[--cleanup]`). La regla no tiene un solo acierto en este repo.
- **`no-multiple-h1` y compañía necesitan `frontmatter: 'yaml'`**, que no es una regla sino una opción
  de lenguaje. Sin ella el parser no reconoce el bloque `---` de `.claude/rules/*.md` y lee los
  **comentarios YAML** (`# …`) como encabezados H1: **22 falsos positivos** que desaparecen con una
  línea de config.

## Criterios de aceptación

**AC1.** `pnpm lint` lintea **todos** los `.md` del repo con `@eslint/markdown`, con
`frontmatter: 'yaml'` y el régimen de dos carriles descrito arriba. El carril B lista sus reglas **por
nombre**, no por exclusión: agregar una regla nueva al preset no puede colarse sola en los specs
congelados. El AC no fija el número de archivos —hoy son **159**, y este spec agrega el suyo— porque
un conteo escrito a mano es exactamente lo que el AC10 viene a borrar; lo que se verifica es que el
bloque `**/*.md` exista y que `eslint .` los levante sin pasarle un glob.

**AC2.** Un test falla si un enlace relativo de cualquier `.md` del repo no resuelve: archivo
inexistente, o ancla —propia o ajena— que ningún encabezado genera. El slug se calcula como el de
GitHub, y **las dos reglas que un slugger casero pierde están medidas contra este repo**, cada una
con el falso positivo que produce:

- **No se colapsan los espacios consecutivos.** `## Forma → qué celda` genera `forma--qué-celda` con
  dos guiones —la flecha se borra y cada uno de los dos espacios que quedan pasa a un guión—, así que
  `\s+` da 4 falsos positivos en `docs/architecture/modelo-musical.md` sobre enlaces que funcionan.
- **El `_` se conserva.** No está en el conjunto que GitHub descarta —es `0x5F`, justo afuera del
  rango que sí borra—, así que el encabezado de `docs/guides/troubleshooting.md:170` genera
  `el-mcp-server-no-arranca-err_module_not_found`. Un slugger que se lo lleva —el de la primera
  corrida del research— declara roto el único enlace de `docs/guides/mcp-domain.md:164` que apunta
  ahí, y «arreglarlo» lo rompería de verdad.

**Con las dos reglas puestas: 0 rotos sobre los 159 `.md`.** Es lo que hace que esta verificación
entre como gate — y también lo que la deja sin hallazgo propio: entra como no-regresión, no como
arreglo.

**AC3.** Un test falla si un archivo de producción de `src/**` o de `mcp-server/src/*.ts` no está
nombrado en `docs/architecture/directory-structure.md`. Se excluyen los `__tests__/` y los
`__screenshots__/`, y `mcp-server/src/tools/` por debajo del primer nivel: el doc los documenta a
propósito **a nivel de carpeta** («una tool por archivo»), y exigirlos uno por uno sería obligar al
doc a decir algo que decidió no decir.

**AC4.** La verificación es en **una sola dirección**: del filesystem al doc, no al revés. El doc
tiene una sección «qué está muerto» que nombra archivos borrados a propósito —`App.css`,
`setupTests.ts`, `App.test.tsx`— y el gate inverso los volvería obligatorios.

**AC5.** `@typescript-eslint/no-non-null-assertion` en `error` para el código de producción, con
**override por archivo** para las tres aserciones anotadas —`src/main.tsx`, `src/domain/invariants.ts`
y `src/components/Board.tsx`— y apagada en `src/**/__tests__/**` y `mcp-server/**/__tests__/**`. La
regla escrita en `CLAUDE.md` ya predice este mecanismo palabra por palabra: *«va como override por
archivo en `eslint.config.js` —que se ve en el diff y se explica— y no como un comentario suelto»*.

**AC6.** `no-warning-comments` en `error` con los términos `v8 ignore`, `c8 ignore` e
`istanbul ignore`, en cualquier posición del comentario. Convierte en gate el corolario del umbral 100
que hasta hoy era prosa.

**No entra gratis: hoy da 1, y el hallazgo es del propio repo.** `vite.config.ts:155` es el docblock
del umbral 100 y **escribe el término que la regla prohíbe** para explicar por qué no hay que usarlo:
*«nunca un `/* v8 ignore */`»*. Medido con la regla puesta sobre el repo entero: 1 error, ése. El
arreglo es reescribir esa frase para que nombre el mecanismo sin deletrear el término —el motivo
sobrevive, la cadena literal no—, y la misma trampa aplica al docblock que la regla se lleve en
`eslint.config.js`: **explicar la regla no puede violarla**. Es el precio de una regla que mira texto
y no sintaxis, y se paga una vez.

**AC7.** `CLAUDE.md` queda **bajo 200 líneas** (hoy 286) y un test lo verifica, con la cita de la convención en
el mensaje de falla. El detalle que sale **no se borra**: se muda a `docs/`, que es donde el propio
`CLAUDE.md` dice que vive, y queda enlazado desde el cheat sheet.

**AC8.** Un test verifica la convención de `specs/`, en los seis puntos que `specs/README.md`
documenta y que hoy no verifica nadie:

1. cada `specs/NNN-*/` tiene los cuatro archivos (`spec` · `research` · `plan` · `tasks`);
2. el nombre de la carpeta es `NNN-kebab-minúsculas`;
3. `log.md` y las carpetas son **biyectivos** —una fila por carpeta y una carpeta por fila—, con el
   `href` de la fila apuntando a **su propia** carpeta;
4. la fecha de cada fila es ISO y el estado está en el conjunto cerrado que `log.md` declara arriba de
   su tabla;
5. **toda** línea de `tasks.md` que empieza como checkbox parsea con el formato documentado — esto es
   lo que cierra el descarte silencioso de `parseTasks`;
6. los IDs `T###` son únicos dentro de su spec.

**AC9.** El test de AC8 **no** exige IDs consecutivos ni una ruta de archivo por tarea, aunque Spec
Kit pida las dos cosas. Medido: **17 de los 22** specs con IDs los tienen no consecutivos, y 585 de
las 1 601 tareas no tienen ID —lo cual es correcto, porque `specs/README.md` marca el ID como
obligatorio *«en specs nuevos»* y los diez primeros son anteriores a la convención—. Un gate que
falla sobre 17 specs cerrados es un gate que se apaga a la semana.

**AC10.** Los cinco hallazgos reales de la tabla de arriba quedan **arreglados**, no anotados como
deuda: la tabla del 027, el comentario de `vite.config.ts:155`, los **5** archivos que faltan en
`directory-structure.md` —los 4 de `src/` más `mcp-server/src/symbols.ts`, que el gate de AC3 también
exige—, y los dos números de `CLAUDE.md` (`dos` → `tres`, `66` → `100`).

El segundo número queda escrito a mano **una última vez y con fecha**: el mecanismo que AC5 monta es
una lista de **archivos**, no de aserciones, así que un `!` nuevo dentro de `Board.tsx` sigue sin
mover el 100. Si el número se vuelve a caer, la salida es borrarlo de `CLAUDE.md` y remitir a la
lista del config, no medirlo otra vez.

**AC11.** `pnpm verify` sigue teniendo **cuatro** nodos. El Markdown entra por `lint` y los tests por
`suite`.

**AC12.** `specs/README.md` documenta el régimen de dos carriles como la **Desviación 4** que es: el
carril B existe porque la Desviación 2 congela los specs, y las dos tienen que leerse juntas.

## Límites de alcance

**No entra: «toda ruta que la prosa menciona existe».** Se midió y no es viable, y el número es el
argumento. De los 314 tokens con forma de ruta en los docs vivos, **24 no existen a propósito**:
patrones (`PascalCase.tsx`, `useCamelCase.ts`, `-loop.ts`), hipotéticos que la prosa usa para explicar
una regla (`domain/sub/x.ts`, dos veces, en `CLAUDE.md` y en `conventions.md`), archivos de TypeScript
que no son del repo (`lib.dom.d.ts`), archivos que se nombran **justamente porque no están**
(`package-lock.json`, `postcss.config.js`, `App.css`) y convenciones que todavía no se aplicaron
(`styles/theme.css`). Un gate así sólo pasa con una lista de excepciones de 24 entradas, y una lista
de excepciones que nadie relee es el mismo «presupuesto de deuda sin dueño» con el que este repo
rechazó el umbral de coverage al 95. La superficie que **sí** se verifica es el enlace Markdown
(AC2): cero falsos positivos medidos y un hallazgo real.

**No entra: cambiar `parseTasks`.** La tool sigue descartando en silencio la línea que no matchea. Con
el gate de AC8.5 arriba, en el repo no puede haber una: la leniencia deja de tener consecuencia y
tocar el server sería mover el arreglo lejos del problema. Queda anotado en `deuda.md` por si algún
día `specs/` deja de ser la única fuente.

**No entra: verificar que el español de los comentarios sea español**, ni que un párrafo de `docs/`
describa el comportamiento que el código tiene hoy. Lo primero no es automatizable y `CLAUDE.md` ya lo
dice; lo segundo es lectura, y para eso están `/spec-review-batch` y `/pr-review-batch`.

**No entra: `markdownlint` ni `remark-lint`.** Se evaluó `@eslint/markdown` contra los dos y gana por
una razón sola y suficiente: **ya hay un linter en `verify`**. Un segundo linter sería un segundo
lugar donde vive la configuración, un segundo `--max-warnings`, y un segundo archivo que actualizar
cuando cambie el régimen — el mismo argumento con el que `verify.yml` corre el *script* y no la lista
de sus nodos.

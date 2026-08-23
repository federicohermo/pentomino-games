# Plan — Spec 032

## Orden y por qué

El spec toca dos nodos de `verify` que no se conocen entre sí, así que los dos frentes son
independientes salvo en un punto: **los arreglos van antes que los gates**. Poner un gate sobre un
repo que lo viola deja el `main` en rojo durante el resto de la rama y entrena a leer el rojo como
ruido, que es el argumento que el 029 ya escribió al aflojar el timeout bajo coverage.

```
Paso 1  arreglos ────┬──> Paso 2  markdown en lint  ──┐
(los 5 hallazgos)    │                                ├──> Paso 5  verify + docs
                     ├──> Paso 3  los cuatro tests  ──┤
                     └──> Paso 4  las dos reglas TS ──┘
```

Los pasos 2, 3 y 4 son paralelizables entre sí: tocan `eslint.config.js`, `src/__tests__/` y otra vez
`eslint.config.js` respectivamente — el 2 y el 4 comparten archivo pero no bloque, y el conflicto es
de merge, no de diseño.

El **paso 6 (`CLAUDE.md` bajo 200 líneas)** va último y solo, por una razón práctica: es el único paso
que mueve prosa en volumen, y mezclarlo con los otros haría el diff ilegible. Su test se escribe en el
paso 3 y **falla** hasta que el paso 6 lo satisface — es la única ventana de rojo aceptada, y dura una
rama.

## Paso 1 — Los cinco arreglos

Van primero y en **su propio commit**, para que el diff que arregla se lea aparte del diff que
verifica.

1. `specs/027-.../research.md:112` — escapar las dos barras: `` `if (!c \|\| !master) return` ``. Es
   la única línea que se toca de un spec congelado y no contradice la Desviación 2: no reescribe una
   decisión, destapa contenido que hoy GitHub descarta.
2. `vite.config.ts:155` — la frase del docblock del umbral 100 que **deletrea** el término que AC6
   pasa a prohibir. Se reescribe para que nombre el mecanismo sin escribir la cadena; el motivo no se
   toca. **`docs/guides/mcp-domain.md` no se toca**: su ancla anda, y por qué está en el supuesto
   caído nº 5 del [`research.md`](./research.md).
3. `docs/architecture/directory-structure.md` — agregar los 4 de `src/` (`audio/constants/`
   ×3, `domain/types/music.types.ts`) y `mcp-server/src/symbols.ts`, cada uno con su comentario de una
   línea como los que ya tiene el árbol. Son **5**, y los cinco los exige el gate de AC3.
4. `CLAUDE.md` — «Quedan **dos**» → «Quedan **tres**», nombrando `Board.tsx` y su motivo en una
   cláusula, y «66» → «100» (medido con la regla, no a ojo: ver research §6).
5. Los 23 `fenced-code-language` del carril A: agregar el lenguaje al fence. La mayoría son `text` o
   `bash`; ninguno cambia el contenido.

## Paso 2 — Markdown en `pnpm lint`

`pnpm add -Dw @eslint/markdown` y dos bloques nuevos en `eslint.config.js`, con las constantes con
nombre que ese archivo ya usa para todo lo que se repite.

- Un bloque `files: ['**/*.md']` con `plugins: { markdown }`, `language: 'markdown/gfm'`,
  `languageOptions: { frontmatter: 'yaml' }` y `extends: [markdown.configs.recommended]`, más
  `no-missing-label-refs: 'off'` con el docblock de las 341.

  **El `extends` va con el objeto y NO con el string `'markdown/recommended'`**, y no es estilo: este
  archivo se arma con `tseslint.config()`, que **tira** ante un string ahí. El mensaje lo dice con
  todas las letras —*«This is a feature of eslint's `defineConfig()` helper and is not supported by
  typescript-eslint»*— y se verificó en
  `node_modules/typescript-eslint/dist/config-helper.js`. O sea que la forma de la documentación de
  `@eslint/markdown`, que asume `defineConfig`, **no compila acá**: no falla al lintear un `.md`,
  falla al **cargar la config**, y con eso se cae `pnpm lint` entero. La otra salida —migrar el
  archivo a `defineConfig`— es un cambio de alcance propio y queda afuera de este spec.
- Un bloque `files: ['specs/[0-9]*/**/*.md']` que **apaga todo el preset y reenciende por nombre** las
  reglas de renderizado. Reenciende y no excluye: es la misma forma que `REGLAS_DEL_REPO` en ese
  archivo, y por el mismo motivo —en flat config un override **reemplaza** la regla en vez de sumarse,
  y una lista por exclusión deja entrar sola cualquier regla nueva del preset—.
- Verificar que `eslint .` los levanta sin pasarle un glob: sin un bloque que matchee `**/*.md`, ESLint
  no lintea Markdown aunque el plugin esté cargado. El chequeo es que `pnpm lint` los cuente.

## Paso 3 — Los cuatro tests

Todos en `src/__tests__/`, proyecto `node`, junto a `nombre-sincronizado.test.ts` y
`fondo-sincronizado.test.ts` — que son el precedente exacto: tests del **repo** que leen archivos del
disco, no tests de `src/`. Quedan fuera de coverage por el `exclude: ['src/**/__tests__/**']` que ya
está.

| Archivo | AC |
|---|---|
| `enlaces-resueltos.test.ts` | AC2 |
| `mapa-de-directorios.test.ts` | AC3, AC4 |
| `claude-md-acotado.test.ts` | AC7 |
| `specs-convencion.test.ts` | AC8, AC9 |

Dos decisiones de forma para los cuatro:

- **El caminante del filesystem es uno solo**, y vive en el test que lo necesita primero; los otros lo
  reimplementan en tres líneas antes que compartir un helper entre tests, porque un helper compartido
  entre tests es código sin tests.
- **Cada aserción falla nombrando el archivo y la línea.** Un gate de documentación que dice «falló»
  sin decir dónde es un gate que se apaga: son 155 archivos.

## Paso 4 — Las dos reglas de TypeScript

En el bloque `**/*.{ts,tsx}` que ya existe:

- `@typescript-eslint/no-non-null-assertion: 'error'`, más un override que la apaga en
  `src/**/__tests__/**` y `mcp-server/**/__tests__/**` —donde el `!` sobre un `find` que el test acaba
  de fijar es la forma de que el test **falle** si el nodo no está, y `CLAUDE.md` ya lo dice—, más un
  override por los **tres** archivos anotados.
- `no-warning-comments` con los tres términos y `location: 'anywhere'`. **Su docblock no puede
  escribir ninguno de los tres**: el bloque `**/*.js` lintea este archivo, así que explicar la regla
  ahí la viola. Es la misma trampa que el paso 1 arregla en `vite.config.ts`.

El override de los tres archivos lleva el docblock que dice **por qué cada uno**, porque la lista es
ahora la única fuente del número que `CLAUDE.md` tenía a mano.

## Paso 5 — Verificar y documentar

- `pnpm verify` verde, y **medir los dos nodos** con caché caliente para llenar el hueco que el spec
  dejó a propósito: `lint` antes y después, `suite` antes y después. Si `lint` pasara a `suite` como
  nodo más lento, se anota; si lo pasara por mucho, se reabre la decisión de meter Markdown ahí.
- `specs/README.md`: la **Desviación 4**, que explica el carril B y lo ata a la Desviación 2.
- `CLAUDE.md`: el régimen nuevo, en el cheat sheet y corto.
- `docs/guides/conventions.md`: las dos reglas de TypeScript nuevas.
- `specs/deuda.md`: la leniencia de `parseTasks`, con el motivo por el que no se arregla hoy.
- `specs/log.md`: la fila del 032.

## Paso 6 — `CLAUDE.md` bajo 200 líneas

Último, solo, y en su propio commit.

**Nada se borra.** El detalle sale a `docs/guides/verificacion.md` —doc nuevo, porque hoy no hay
ninguno que explique `verify`— y en `CLAUDE.md` queda la afirmación de una línea más el enlace. El
criterio de qué se queda es el que el propio archivo escribió: *lo que no se puede averiguar mirando un
archivo*. El número de una medición se queda (no está en ningún archivo); las cuatro páginas que
explican cómo se llegó a ese número se van.

Presupuesto de recorte, contra las mediciones de `research.md` §7:

| Sección | Hoy | Objetivo | A dónde va |
|---|---|---|---|
| `## Comandos` | 100 | ~25 | `docs/guides/verificacion.md` |
| `## Reglas que valen en todo el repo` | 76 | ~50 | `docs/guides/conventions.md` |
| resto | 108 | 108 | se queda |

Da ~183, con margen. El test de AC7 es el que cierra el paso.

## Verificación

- `pnpm verify` en verde, cuatro nodos.
- Los cinco hallazgos de la tabla del spec, cada uno con su test o su regla que lo habría atrapado.
- **Falsificación deliberada, una por gate** — se rompe a mano y se comprueba que el gate cae:
  un enlace a un archivo que no está; un ancla inventada; un archivo nuevo en `src/` sin documentar;
  una línea `- [ ] tarea sin nada` en un `tasks.md`; un `T001` repetido; una fila de `log.md` sin
  carpeta; un `!` nuevo en un archivo de producción no listado; un `/* v8 ignore */`; una línea de más
  en `CLAUDE.md`. Nueve roturas, nueve rojos, y se revierten.
- [M] Abrir en GitHub el `research.md` del 027 y confirmar que la fila ahora muestra sus tres celdas.

# Spec 023 — La verificación la corre la máquina

> Sin ticket: este repo no tiene tablero de Jira. Ver `specs/README.md`.
>
> **No toca `src/` ni `eslint.config.js`.** `pnpm verify` deja de depender de que alguien se acuerde de
> correrlo: entra a GitHub Actions sobre cada PR. Medido: hoy el único gate automático es Netlify, que
> corre `tsc -b` dentro de `build` — o sea que **los 407 tests del repo, y el lint entero, no corren
> nunca solos**.
>
> Y el paquete raíz declara con qué Node corre, que hoy sólo declara el paquete de tooling.
>
> **Es la mitad de tooling que no reclama el spec del linter** (`el-linter-verifica-lo-que-claude-md-declara`,
> escrito en paralelo por otra rama): ese spec se lleva `eslint.config.js`, el preset de react-hooks de
> 2 a 17 reglas y el `--max-warnings 0`; éste se lleva **quién corre todo eso**. Verificado leyendo sus
> cuatro archivos: no menciona GitHub Actions, ni `.github`, ni `engines`, ni Netlify.
>
> Ortogonal al lote 018–021: no abre un solo archivo de `src/`.

## Problema

`CLAUDE.md` fija la tesis del repo en una línea: «**La dirección de dependencia la verifica el linter**,
no la revisión». El resto del documento la aplica una y otra vez — el `$` del regex de `verify`, el
filtro `{.}`, los tres specifiers por módulo en `DOMAIN_INTERNO`, el `allowBuilds` en `false`. Todas son
decisiones de *no confiar en que alguien se acuerde*.

Hay dos lugares donde esa tesis todavía no se aplicó a sí misma. El linter tiene su spec; esto es el
otro.

### 1. `pnpm verify` existe, es rápido, y no lo corre nadie

No existe `.github/`. Verificado: el directorio no está en el árbol.

El único gate automático del repo es Netlify, y `netlify.toml` declara `command = "pnpm run build"`,
que es `tsc -b && vite build`. Eso **typechequea la app** y nada más:

| Nodo de `verify` | ¿Lo corre Netlify? |
|---|---|
| `typecheck` (`tsc -b --noEmit`) | Sí, por el `tsc -b` que hay dentro de `build` |
| `lint` (`eslint .`) | **No** |
| `test` (322 tests de `src/`) | **No** |
| `mcp:test` (85 tests + typecheck del server) | **No** |

O sea que **los 407 tests del repo no corren nunca solos**, y un PR puede mergear con el dominio roto
mientras el deploy sale verde. `CLAUDE.md` ya dice que `verify` «es lo que hay que correr antes de un
PR»: lo que falta es que eso deje de ser una frase.

El costo de construirlo ya está pagado. El nodo de convergencia se midió —8,8 s en serie contra 4,0 s
en paralelo—, se le ancló el regex y se le puso el filtro por ruta después de descubrirlo *fallando en
verde*. Ese trabajo hoy cuelga de la memoria de quien commitea.

Y hay un agravante que llega justo ahora: dos specs escritos en paralelo **le agregan nodos y costo** a
`verify` —el del linter lo lleva de 4,0 s a 11,8 s, y el del coverage le suma un quinto nodo—. Sin CI,
todo ese trabajo sigue dependiendo de que alguien lo corra a mano antes de abrir un PR.

### 2. El paquete raíz no declara con qué Node corre

`mcp-server/package.json` declara `"engines": { "node": ">=22.18" }`. El raíz no declara nada, aunque:

- Vite 7 exige `^20.19.0 || >=22.12.0` — y `CLAUDE.md` lo dice atribuyéndolo a «`engines`», que es el
  de Vite y no el nuestro;
- `netlify.toml` fija `NODE_VERSION = "22"` con ese requisito escrito en un comentario.

El requisito está en tres lugares y en ninguno es una declaración ejecutable del paquete. Con Node 18,
hoy, lo que se recibe es un error de Vite y no un mensaje del gestor.

De la misma lectura: `mcp-server` tiene `typescript` en **`dependencies`**. Sólo lo usa `tsc` en su
script de `typecheck` —Node ≥22.18 corre los `.ts` por type-stripping nativo, que es justamente por qué
ese piso existe—, así que es una `devDependency` declarada en el lugar equivocado.

## Solución propuesta

Tres cambios, ninguno en `src/` y ninguno en `eslint.config.js`.

1. **`.github/workflows/verify.yml`** — un job sobre `pull_request` y `push` a `main` que instala con
   el lockfile congelado y corre `pnpm verify`.
2. **`engines` en el `package.json` raíz**, y `typescript` a `devDependencies` en `mcp-server`.
3. **Las subidas de versión que no son major**, y sólo esas.

### D1 — El workflow corre `verify` entero y no sus nodos por separado

Podría ser un job por nodo, y se vería mejor en la UI de Actions. No: `verify` es **el** nodo de
convergencia del repo y su forma exacta está argumentada en `CLAUDE.md` con dos trampas ya pisadas.
Partirlo en cuatro pasos crea un segundo lugar donde esa forma vive, y el día que alguien toque el regex
la CI seguiría corriendo la vieja.

Es además lo que hace que este spec **no se pelee** con los dos que le están agregando nodos: si el
workflow corre `verify` y no una lista, el quinto nodo del coverage entra solo.

### D2 — Node 22 y no una matriz

`mcp-server` pide ≥22.18 y Netlify usa 22. Una matriz `20 × 22` haría fallar `mcp:test` en 20 por un
piso de tooling que ya está declarado y decidido. El requisito de Vite (`^20.19 || >=22.12`) queda
declarado en `engines` —punto 2— que es donde se verifica solo.

### D3 — Las subidas de este spec son las que **no** son del linter

`eslint-plugin-react-hooks` **no entra acá**: es del spec del linter, que es quien tiene que migrar el
preset a su forma flat en el mismo commit —sin eso `eslint` no arranca— y quien mide las 17 reglas.

Lo que sube este spec: `react` y `react-dom` a 19.2.x con sus `@types`, `typescript-eslint`,
`node-web-audio-api`, y **`vitest` a 4.1.11**. El último con su motivo escrito: es la precondición del
[024](../024-los-componentes-se-verifican-en-un-navegador/spec.md), porque
`@vitest/browser-playwright` se publica pinneado a la versión **exacta** de `vitest` y con 4.1.10
quedarían dos runners en el árbol.

### D4 — Los majors no entran

`vite` 7→8, `eslint` 9→10, `@vitejs/plugin-react` 5→6, `@types/node` 24→26 y `typescript` 5.8→7 son
majors, y el último está **pinneado a propósito**: el docblock de `freqBuf` en `audio/engine.ts`
documenta que con TypeScript 7.0.2 esa línea ya falla, con la medición al lado.

## Criterios de aceptación

- **AC1** — Un PR contra `main` dispara un workflow que corre `pnpm verify` y falla si cualquiera de
  sus nodos falla.
- **AC2** — El workflow instala con `--frozen-lockfile`, así que una deriva entre `package.json` y
  `pnpm-lock.yaml` rompe la CI en vez de resolverse sola.
- **AC3** — El workflow **no enumera los nodos de `verify`**: corre el script, así que un nodo nuevo
  —el `coverage` del spec de cobertura— entra sin tocar el YAML.
- **AC4** — El `package.json` raíz declara `engines.node` con el requisito de Vite 7, y `mcp-server`
  tiene `typescript` en `devDependencies`.
- **AC5** — `pnpm verify` sigue verde: 322 + 85 tests.
- **AC6** — Ninguna subida es un major, `typescript` sigue en `~5.8.3`, y `eslint-plugin-react-hooks`
  **no se toca acá**.
- **AC7** — El workflow se vio **en rojo** antes de creerle el verde.

## Fuera de alcance

- **`eslint.config.js` entero** — el preset de react-hooks, el `--max-warnings 0`, el `ecmaVersion`, el
  bloque para los `.js` y las reglas por ruta. Todo eso es del spec del linter.
- **Cualquier archivo de `src/`.**
- **Coverage**, que tiene su propio spec y que este workflow hereda sin cambios (AC3).
- **Un job de deploy.** Netlify ya despliega.
- **Los cinco majors** (D4).
- **Los tests de UI en navegador**, que son el 024 y le agregan un paso a este workflow.

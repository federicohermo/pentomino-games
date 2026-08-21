# Spec 023 — La verificación la corre la máquina

> Sin ticket: este repo no tiene tablero de Jira. Ver `specs/README.md`.
>
> **No toca `src/` ni `eslint.config.js`.** `pnpm verify` deja de depender de que alguien se acuerde de
> correrlo: entra a GitHub Actions sobre cada PR. Medido: hoy el único gate automático es Netlify, que
> corre `tsc -b` dentro de `build` — o sea que **los 562 tests del repo, el lint entero y el gate de
> coverage no corren nunca solos**.
>
> Y el paquete raíz declara con qué Node corre, que hoy sólo declara el paquete de tooling.
>
> **Este spec se escribió antes de que mergearan el [029](../029-lo-que-no-se-cubre-no-se-mergea/spec.md)
> y el [030](../030-el-linter-verifica-lo-que-claude-md-declara/spec.md), y se reescribió después.**
> Cuando se escribió, los dos eran ramas en paralelo y este spec razonaba sobre lo que le *iban* a hacer
> a `verify`; hoy los dos están en `main` y lo que le hicieron está medido. Los dos se llevaron parte de
> lo que este spec listaba —el 030 subió `typescript-eslint`, `eslint-plugin-react-hooks` y
> `eslint-plugin-react-refresh`; el 029 subió `vitest` a 4.1.11 y lo dejó **pinneado exacto**— y los dos
> le dejaron trabajo nuevo: el 029 le difiere su **AC13** y le mete Chromium adentro de `verify`.
>
> Ortogonal al lote 018–021: no abre un solo archivo de `src/`.

## Problema

`CLAUDE.md` fija la tesis del repo en una línea: «**La dirección de dependencia la verifica el linter**,
no la revisión». El resto del documento la aplica una y otra vez — el `$` del regex de `verify`, el
filtro `{.}`, el umbral 100 sin `/* v8 ignore */`, el `allowBuilds` en `false`. Todas son decisiones de
*no confiar en que alguien se acuerde*.

Hay un lugar donde esa tesis todavía no se aplicó a sí misma, y es el más caro: **nada la corre**.

### 1. `pnpm verify` existe, vale más que nunca, y no lo corre nadie

No existe `.github/`. Verificado: el directorio no está en el árbol.

El único gate automático del repo es Netlify, y `netlify.toml` declara `command = "pnpm run build"`,
que es `tsc -b && vite build`. Eso **typechequea la app** y nada más:

| Nodo de `verify` | Qué corre | ¿Lo corre Netlify? |
|---|---|---|
| `typecheck` | `tsc -b --noEmit` | Sí, por el `tsc -b` que hay dentro de `build` |
| `lint` | `eslint . --max-warnings 0`, con tipos desde el 030 | **No** |
| `suite` | `test && coverage`: 457 tests de `src/` y el umbral **100** en las cuatro métricas | **No** |
| `mcp:test` | 105 tests del server + su typecheck + sus `--test-coverage-*=100` | **No** |

O sea que **los 562 tests del repo no corren nunca solos**, y un PR puede mergear con el dominio roto
—o con la cobertura por debajo del 100— mientras el deploy sale verde. `CLAUDE.md` ya dice que `verify`
«es lo que hay que correr antes de un PR»: lo que falta es que eso deje de ser una frase.

El costo de construirlo ya está pagado, y se pagó tres veces. El nodo de convergencia se midió, se le
ancló el regex y se le puso el filtro por ruta después de descubrirlo *fallando en verde*; el 030 le
puso linting con tipos y seis reglas nuevas (`lint`: 2,5 s → **11,0 s**); el 029 le puso el gate de
coverage encadenado adentro de `suite`, que hoy es **el nodo que manda el reloj (19,4 s)**. Medido por
el 030 sobre el árbol de hoy: **23,7 s en paralelo contra 41,2 s en serie.** Todo ese trabajo cuelga de
la memoria de quien commitea.

Y hay dos deudas concretas que este spec es el único que puede pagar:

- **AC13 del 029** — «La CI del 023 corre `coverage` y falla el PR si baja del 100». Hoy el gate
  muerde localmente (`pnpm verify` devuelve exit 1 nombrando la métrica) pero **nada lo obliga en un
  PR**. `specs/log.md` lo tiene anotado como diferido a este spec.
- **Chromium.** Desde el 029 hay ocho `*.browser.test.tsx` que corren en un Chromium de verdad, y el
  navegador **no está en el lockfile**: `docs/guides/quickstart.md:26` dice, en presente, que sin
  `pnpm exec playwright install chromium` «`pnpm verify` falla». Un runner de CI es un clone nuevo en
  cada corrida, así que sin ese paso el workflow no llega a correr un solo test. `log.md` lo anota junto
  al AC13, en la misma frase.

### 2. El paquete raíz no declara con qué Node corre

`mcp-server/package.json:7-9` declara `"engines": { "node": ">=22.18" }`. El raíz no declara nada, aunque:

- Vite 7 exige `^20.19.0 || >=22.12.0` — y `CLAUDE.md:93` lo dice atribuyéndolo a «`engines`», que es el
  de Vite y no el nuestro;
- `netlify.toml:12-13` fija `NODE_VERSION = "22"` con ese requisito escrito en un comentario.

El requisito está en tres lugares y en ninguno es una declaración ejecutable del paquete. Con Node 18,
hoy, lo que se recibe es un error de Vite y no un mensaje del gestor.

De la misma lectura: `mcp-server` tiene `typescript` en **`dependencies`** (`mcp-server/package.json:18`).
Sólo lo usa `tsc` en su script de `typecheck` —Node ≥22.18 corre los `.ts` por type-stripping nativo, que
es justamente por qué ese piso existe—, así que es una `devDependency` declarada en el lugar equivocado.

## Solución propuesta

Tres cambios, ninguno en `src/` y ninguno en `eslint.config.js`.

1. **`.github/workflows/verify.yml`** — un job sobre `pull_request` y `push` a `main` que instala con
   el lockfile congelado, instala Chromium, y corre `pnpm verify`.
2. **`engines` en el `package.json` raíz**, y `typescript` a `devDependencies` en `mcp-server`.
3. **Las subidas de versión que quedan y que no son major**, y sólo esas.

### D1 — El workflow corre `verify` entero y no sus nodos por separado

Podría ser un job por nodo, y se vería mejor en la UI de Actions. No: `verify` es **el** nodo de
convergencia del repo y su forma exacta está argumentada en `CLAUDE.md` con dos trampas ya pisadas.
Partirlo en cuatro pasos crea un segundo lugar donde esa forma vive, y el día que alguien toque el regex
la CI seguiría corriendo la vieja.

**Esta decisión ya se validó con evidencia, y no en abstracto:** entre que este spec se escribió y hoy,
el 029 le cambió la forma a `verify` —el nodo `test` pasó a ser `suite`, que es `test && coverage`— y el
030 le cambió el costo. Un workflow que enumerara nodos habría quedado corriendo `test` a secas, o sea
**verde sin el gate de coverage**, que es exactamente el modo de falla que este spec existe para cerrar.
Corriendo el script, el YAML no se entera.

Nota sobre la previsión original: este spec decía que el coverage le iba a sumar un **quinto** nodo. No
pasó — el 029 midió que un quinto proceso pesado rompía los presupuestos de performance del 009 por
contención de CPU, y lo encadenó adentro de `suite`. Quedan **cuatro** nodos. La decisión de D1 sale
reforzada, no tocada.

### D2 — Node 22 y no una matriz

`mcp-server` pide ≥22.18 y Netlify usa 22. Una matriz `20 × 22` haría fallar `mcp:test` en 20 por un
piso de tooling que ya está declarado y decidido. El requisito de Vite (`^20.19 || >=22.12`) queda
declarado en `engines` —punto 2— que es donde se verifica solo.

### D3 — Chromium se instala acá y no en el 024

El paso de `playwright install` estaba escrito como AC10 del 024, de cuando el 024 era quien traía el
proyecto de navegador. El 029 adelantó esa infra —lo dice `log.md`— y los ocho `*.browser.test.tsx`
están en `main` hoy, así que **el propio 024 ya se lo pasó a este spec**: su `T022` dice, textual, «**Que
la haga el 023**, que es el que crea el archivo — hacerla desde acá obliga a crear el workflow entero».
No hay negociación pendiente, hay una tarea que cambió de dueño.

Y cambia de categoría además de dueño: un workflow sin ese paso no es un workflow al que le falta una
feature del 024, es un workflow que **no arranca**, y que además haría imposible verificar AC7 — el rojo
tiene que venir del error que se plantó, no de un binario que falta.

Va con `--with-deps`: el runner de Ubuntu no trae las librerías de sistema que Chromium necesita, y
`playwright install` sin ese flag baja el binario y falla igual al lanzarlo. Cachear
`~/.cache/ms-playwright` queda como seguimiento: son ~130 MB por corrida y hoy el job no tiene presión
de tiempo.

### D4 — Las subidas de este spec son las que sobrevivieron al 029 y al 030

Cuando este spec se escribió eran seis. Hoy quedan **cuatro paquetes**, porque las otras ya entraron por
otras ramas y **está verificado contra el árbol**:

- `typescript-eslint` ya está en `^8.67.0` (`package.json:45`) — lo subió el 030;
- `eslint-plugin-react-hooks` ya está en `^7.1.1` (`package.json:38`) — lo subió el 030 junto con la
  migración del preset a su forma flat, que era la condición para que `eslint` arrancara;
- `eslint-plugin-react-refresh` ya está en `^0.5.4` (`package.json:39`), que este spec había descartado
  por ser el minor de un `0.x` — el 030 lo subió igual;
- **`vitest` ya está en `4.1.11`, y sin caret** (`package.json:47`), igual que las tres `@vitest/*`
  (`package.json:32-34`). Lo subió el 029 y **el pin exacto es la decisión, no un descuido**:
  `@vitest/browser-playwright` se publica pinneado a la versión exacta del runner, así que un caret
  dejaría entrar un 4.1.12 que partiría el árbol en dos runners. **Este spec no lo toca.**

Lo que queda: `react` y `react-dom` a 19.2.8 con sus `@types`, y `node-web-audio-api` a 2.2.0.

### D5 — Los majors no entran

`vite` 7→8, `eslint` 9→10, `@eslint/js` 9→10, `@vitejs/plugin-react` 5→6, `@types/node` 24→26,
`globals` 16→17 y `typescript` 5.8→7 son majors, y el último está **pinneado a propósito**: el docblock
de `freqBuf` en `src/audio/engine.ts:68-70` documenta que con TypeScript 7.0.2 esa línea ya falla, con
la medición al lado.

## Criterios de aceptación

- **AC1** — Un PR contra `main` dispara un workflow que corre `pnpm verify` y falla si cualquiera de
  sus nodos falla.
- **AC2** — El workflow instala con `--frozen-lockfile`, así que una deriva entre `package.json` y
  `pnpm-lock.yaml` rompe la CI en vez de resolverse sola.
- **AC3** — El workflow **no enumera los nodos de `verify`**: corre el script. Falsable: fuera de los
  comentarios, `.github/workflows/verify.yml` no nombra `lint`, `typecheck`, `suite` ni `mcp:test`.
- **AC4** — El `package.json` raíz declara `engines.node` con el requisito de Vite 7
  (`^20.19.0 || >=22.12.0`), y `mcp-server/package.json` tiene `typescript` en `devDependencies` y no en
  `dependencies`.
- **AC5** — `pnpm verify` sigue verde, con los mismos números que hoy: **457 tests de `src/`** en 26
  archivos, **105 del server**, y el coverage en 100 en las cuatro métricas.
- **AC6** — Ninguna subida es un major, `typescript` sigue en `~5.8.3`, y **`vitest` sigue en `4.1.11`
  sin caret**, igual que las tres `@vitest/*`.
- **AC7** — El workflow se vio **en rojo** antes de creerle el verde, y el rojo vino del nodo que se
  rompió a propósito (`lint`) y no de otra cosa.
- **AC8** — El workflow instala Chromium (`pnpm exec playwright install --with-deps chromium`) antes de
  `pnpm verify`. Falsable de la peor manera posible si falta: sin él la corrida no llega a AC7.
- **AC9** — **AC13 del 029 queda cumplido**: la corrida de CI de un PR imprime la tabla de coverage, y
  un PR que baje del 100 en cualquiera de las cuatro métricas queda en rojo. Se verifica junto con AC7,
  borrando un test a propósito en la misma rama.
- **AC10 (no regresión)** — El cambio no toca `eslint.config.js` ni el bloque `test` de
  `vite.config.ts`, y de `src/` toca **un solo archivo y dos líneas**:
  `src/domain/__tests__/sequence.test.ts`, los techos de los dos presupuestos de performance del 009.
  Falsable con `git diff --name-only main`.

  **Este AC decía «ni un archivo de `src/`» y se enmendó al implementarlo, con la medición en la
  mano.** El workflow puso `pnpm verify` en un runner limpio por primera vez y los dos presupuestos de
  performance del 009 se cayeron ahí y sólo ahí. **Los techos no se tocan** —siguen en 5 ms y 4 ms— y
  lo que se agrega es una guarda: los dos tests se saltean en CI, con el mismo mecanismo que ya los
  saltea bajo coverage y por el mismo motivo, que es que el entorno no mide el producto.

  El número que lo decide, y que **falsificó el primer intento** de arreglarlo subiendo los techos a 10
  y 8:

  | | máquina de desarrollo | runner #1 | runner #2 |
  |---|---|---|---|
  | AC10 | 2,00 ms | 8,426 ms | **15,687 ms** |
  | AC8 | 1,31 ms | 6,324 ms | 3,803 ms |

  Mismo código y mismo workflow entre las dos corridas del runner, y cada celda es la mediana de 21
  corridas que el test ya calcula: **1,86× de variación** en AC10. `ubuntu-latest` no es una máquina
  lenta con un número propio, es una VM compartida sin número. Por eso no hay techo que sirva: cubrir el
  pico de 15,7 ms pide ~30, y contra los 2,0 ms locales eso deja el presupuesto **15× por encima de lo
  medido** — un test que no puede fallar.

  El precio, dicho sin adornos porque es un AC que se ablandó: **la CI no verifica estos dos
  presupuestos.** Los verifica `pnpm verify` local, que es donde 5 y 4 significan algo, y un rojo ahí
  sigue siendo una regresión de verdad.

## Fuera de alcance

- **`eslint.config.js` entero** — es del 030, que ya mergeó.
- **Cualquier archivo de `src/`** — con la excepción medida de AC10: los dos techos de
  `src/domain/__tests__/sequence.test.ts`, que la CI falsificó en su primera corrida.
- **El bloque `test` de `vite.config.ts` y el umbral de coverage** — los puso el 029; este workflow los
  hereda sin tocarlos (AC3).
- **Un job de deploy.** Netlify ya despliega.
- **Los siete majors** (D5).
- **Cachear `~/.cache/ms-playwright`.** El paso de instalación sí entra (D3, AC8); el caché queda como
  seguimiento.
- **Los seis invariantes de layout del 024**, que es lo único que a ese spec le queda por hacer.

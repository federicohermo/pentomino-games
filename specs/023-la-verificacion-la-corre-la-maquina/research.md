# Research 023 — La verificación la corre la máquina

Todo lo de acá está **medido sobre `main`**, no supuesto. Donde hay un número, hay un comando que lo
produjo.

> **Segunda pasada.** La primera se midió sobre el `main` del 2026-08-20, cuando el 029 y el 030 eran
> ramas en paralelo. Los dos mergearon (PRs #24 y #25) y **cambiaron seis de los números de este
> archivo**: la forma de `verify`, el conteo de tests, los tiempos, la tabla de `outdated` y el
> `environment` de los tests. Los números de abajo son los de `37abf53`.

## 1. Qué corre hoy, y qué no

`.github/` **no existe**. El repo no tiene ni un workflow. Verificado: `ls -d .github` no devuelve nada.

`netlify.toml`:

```toml
[build]
  command = "pnpm run build"
  publish = "dist"
```

y `package.json:9`: `"build": "tsc -b && vite build"`.

`package.json:19`:

```
"verify": "pnpm --filter \"{.}\" run --parallel \"/^(lint|typecheck|suite|mcp:test)$/\""
```

De los cuatro nodos que `verify` corre en paralelo, el deploy toca **uno**:

| Nodo | Comando | ¿Corre en el deploy? |
|---|---|---|
| `lint` | `eslint . --max-warnings 0` | No |
| `typecheck` | `tsc -b --noEmit` | Sí, vía el `tsc -b` de `build` |
| `suite` | `pnpm run test && pnpm run coverage` | No |
| `mcp:test` | `pnpm --filter mcp-server test` | No |

Corrida de referencia en esta máquina, con caché caliente:

```
pnpm run test
  Test Files  26 passed (26)
       Tests  457 passed (457)

pnpm run mcp:test
  # tests 105 / # suites 16 / # pass 105 / # fail 0
```

**562 tests, y ningún disparador automático.** Y desde el 029, además, un gate de coverage con umbral
100 en las cuatro métricas que tampoco corre solo.

## 2. Por qué llega justo ahora

Dos specs que estaban escritos en paralelo cuando se escribió éste ya mergearon, y los dos le agregaron
trabajo a `verify`:

| Spec | Qué le hizo a `verify` | Estado |
|---|---|---|
| [030](../030-el-linter-verifica-lo-que-claude-md-declara/spec.md) | El nodo `lint` pasa de ~2,5 s a **11,0 s** por el linting con tipos y seis reglas nuevas | Mergeado (PR #25) |
| [029](../029-lo-que-no-se-cubre-no-se-mergea/spec.md) | El nodo `test` **pasa a ser `suite`** (`test && coverage`), con umbral 100 | Mergeado (PR #24) |

Medición del 030 sobre el árbol resultante: `verify` en **23,7 s en paralelo contra 41,2 s en serie**, y
**el nodo que manda el reloj es `suite` (19,4 s)**, no el lint.

Los dos hicieron `verify` más valioso y más caro. Sin CI, ese valor sigue dependiendo de que alguien lo
corra a mano antes de abrir un PR — y cuanto más tarda, menos probable es que lo hagan.

Es también lo que **ya confirmó** la forma del workflow (D1, AC3): si corre `verify` y no una lista de
nodos, el `test → suite` del 029 no le habría hecho falta tocar el YAML. Un workflow escrito con la
lista habría seguido corriendo `test` a secas, o sea **verde sin el gate de coverage**.

## 3. El límite con el 030, y lo que ese spec se llevó

El corte se verificó leyendo sus cuatro archivos antes del merge, y se re-verificó contra el árbol
después: `.github`, `workflow`, `github actions`, `engines` y `netlify` no aparecen en el 030 ni en el
diff que mergeó. **Ese spec decidió qué se verifica; éste decide quién lo corre.**

Lo que sí se llevó, y por eso ya no es trabajo de acá:

- `eslint-plugin-react-hooks` de 5.2.0 a **^7.1.1** (`package.json:38`), junto con la migración del
  preset a su forma flat — que era la razón por la que este spec lo excluía: la subida y la migración
  tenían que ir en el mismo commit o `eslint` no arranca;
- `typescript-eslint` a **^8.67.0** (`package.json:45`);
- `eslint-plugin-react-refresh` a **^0.5.4** (`package.json:39`), que este spec había descartado por ser
  el minor de un `0.x`;
- el `--max-warnings 0` en el script `lint` (`package.json:10`).

## 4. `engines` y el `typescript` mal ubicado — **sin cambios, sigue vigente**

`mcp-server/package.json`, verificado en el árbol de hoy:

```json
"engines": { "node": ">=22.18" },
"dependencies": {
  "@modelcontextprotocol/server": "^2.0.0",
  "zod": "^4.2.0",
  "typescript": "~5.8.3"
}
```

El raíz no tiene `engines`. Los tres lugares donde hoy vive el requisito de Node:

1. `CLAUDE.md:93`: «Node ≥ 20.19 o ≥ 22.12 — Vite 7 lo exige en `engines`» (el de Vite);
2. `netlify.toml:12-13`: `NODE_VERSION = "22"` con el requisito en un comentario;
3. el `engines` de `node_modules/vite/package.json`, que es de la dependencia y no del proyecto.

`typescript` en `dependencies` de `mcp-server` lo usa sólo `"typecheck": "tsc"`. `"start": "node
src/index.ts"` no lo necesita: Node ≥22.18 hace type-stripping nativo, que es exactamente el motivo por
el que ese piso de `engines` existe (`CLAUDE.md` lo dice).

## 5. La tabla de `outdated`, y qué entra

Salida de `pnpm outdated` sobre `37abf53`. Cuatro paquetes menos que en la primera pasada: los que
faltan ya no aparecen porque **el 029 y el 030 los subieron**.

| Paquete | Actual | Última | ¿Entra? | Por qué |
|---|---|---|---|---|
| `react` / `react-dom` | 19.1.1 | 19.2.8 | **Sí** | Patch dentro del major |
| `@types/react` | 19.1.12 | 19.2.18 | **Sí** | Acompaña a `react` |
| `@types/react-dom` | 19.1.9 | 19.2.4 | **Sí** | Ídem |
| `node-web-audio-api` | 2.1.0 | 2.2.0 | **Sí** | Minor; lo usa el proyecto `node` de vitest |
| `typescript-eslint` | — | — | **Ya está** | `^8.67.0`, lo subió el 030 |
| `eslint-plugin-react-hooks` | — | — | **Ya está** | `^7.1.1`, lo subió el 030 con el preset flat |
| `eslint-plugin-react-refresh` | — | — | **Ya está** | `^0.5.4`, lo subió el 030 |
| `vitest` | — | — | **Ya está, y NO se toca** | `4.1.11` **exacta** — ver abajo |
| `@types/node` | 24.3.1 | 26.2.0 | No | Major |
| `globals` | 16.4.0 | 17.11.0 | No | Major |
| `@eslint/js` | 9.35.0 | 10.0.1 | No | Major; y va con `eslint` |
| `@vitejs/plugin-react` | 5.0.2 | 6.1.0 | No | Major |
| `vite` | 7.1.5 | 8.2.2 | No | Major |
| `eslint` | 9.35.0 | 10.8.1 | No | Major |
| `typescript` | 5.8.3 | 7.0.2 | **No, y está argumentado** | El docblock de `freqBuf` (`src/audio/engine.ts:68-70`) mide que con 7.0.2 esa línea es un TS2345 |

**El detalle de `vitest`, que se dio vuelta:** este spec lo tenía como una de sus subidas, porque
`@vitest/browser-playwright` se publica pinneado a la versión **exacta** del runner y con 4.1.10
quedarían dos runners en el árbol. El 029 lo hizo primero, y lo hizo **mejor**: dejó las cuatro sin
caret —`"vitest": "4.1.11"`, `"@vitest/browser": "4.1.11"`, `"@vitest/browser-playwright": "4.1.11"`,
`"@vitest/coverage-v8": "4.1.11"` (`package.json:32-34,47`)—. Escribir `^4.1.11` acá sería una
**regresión**: el caret deja entrar un 4.1.12 y vuelve a partir el árbol. La tarea correcta es
**verificar el pin**, no subirlo.

## 6. Chromium: el paso que dejó de ser opcional

`vite.config.ts:53-88` declara dos proyectos de Vitest, y el segundo corre en Chromium por Playwright
(`instances: [{ browser: 'chromium' }]`). En `src/components/__tests__/` hay ocho archivos
`*.browser.test.tsx`.

Playwright baja el navegador a un caché fuera de `node_modules` (`%LOCALAPPDATA%\ms-playwright` en
Windows, `~/.cache/ms-playwright` en Linux) y **no está en el lockfile**. `docs/guides/quickstart.md:26`
lo dice en presente: sin `pnpm exec playwright install chromium`, «`pnpm verify` falla».

Un runner de GitHub Actions es un clone limpio en cada corrida. Por lo tanto el paso entra **en este
spec** y no en el 024:

```yaml
- run: pnpm exec playwright install --with-deps chromium
```

`--with-deps` porque el runner de Ubuntu no trae las librerías de sistema de Chromium; sin el flag el
binario baja y falla igual al lanzarse.

`specs/log.md` ya lo tenía anotado, en la misma frase que difiere AC13 del 029 a este spec: «Lo mismo
vale para tener Chromium instalado antes de correrlo».

Y el 024 ya se lo pasó explícitamente: su `T022` —una de sus dos tareas pendientes según `spec_status`—
dice «**Que la haga el 023**, que es el que crea el archivo — hacerla desde acá obliga a crear el
workflow entero». O sea que la tarea no está en disputa: está esperando este spec.

## 7. Archivos que toca

| Archivo | Qué cambia |
|---|---|
| `.github/workflows/verify.yml` | **Nuevo** |
| `package.json` | `engines`, y las cuatro subidas de §5 |
| `pnpm-lock.yaml` | Consecuencia |
| `mcp-server/package.json` | `typescript` de `dependencies` a `devDependencies` |
| `CLAUDE.md` | La línea de Node pasa a nombrar el `engines` propio; se agrega que la CI corre `verify` |
| `docs/guides/quickstart.md` | Ídem, donde ya nombra los comandos |
| `specs/revisiones.md` | La nota de por qué el paso de Chromium se mudó del 024 al 023 |

**Cero archivos de `src/`. Cero de `eslint.config.js`. Cero de `vite.config.ts`.**

`.gitignore` **no** se toca: ya tiene `.vitest-attachments/` y `**/__screenshots__/`, que los agregó el
029.

## 8. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| La CI se pelea con un spec que le cambie la forma a `verify` | **Baja, y ya verificada** | D1: el workflow corre el script. El 029 le cambió `test` por `suite` y no habría tocado el YAML |
| `--frozen-lockfile` rompe un PR legítimo | Media | Es el punto: obliga a commitear el lock. Está en AC2 a propósito |
| La CI tarda y molesta | Media | `verify` mide 23,7 s en paralelo. El costo real son el `pnpm install` —que se cachea— y los ~130 MB de Chromium, que hoy no se cachean (seguimiento) |
| **Chromium falta o no arranca en el runner** | **Alta si no se hace nada** | AC8: el paso con `--with-deps`. Sin él la corrida no llega a correr un test, y AC7 no se puede verificar |
| Windows vs. Linux en el runner | Baja | El proyecto `node` no depende del SO. El proyecto `browser` sí depende de las libs de Chromium, y eso lo cubre `--with-deps` |
| El workflow reporta verde sin haber corrido nada | Media | AC7: hay que **verlo en rojo** rompiendo algo a propósito antes de creerle. AC9 hace lo mismo con el gate de coverage |

## 9. Lo que este spec deja mejor para el que sigue

Al 024 le quedan **cero pasos de workflow**: su AC10 y su T022 los absorbe este spec (D3), porque el 029
adelantó la infra que los justificaba. Lo que al 024 le queda por hacer son sus seis invariantes de
layout.

Y este spec es el único que puede cerrar **AC13 del 029**, que `log.md` le difiere explícitamente: el
gate de coverage existe y muerde localmente, pero nada lo obliga en un PR hasta que exista el workflow.

# Research 023 — La verificación la corre la máquina

Todo lo de acá está **medido sobre `main`**, no supuesto. Donde hay un número, hay un comando que lo
produjo.

## 1. Qué corre hoy, y qué no

`.github/` **no existe**. El repo no tiene ni un workflow.

`netlify.toml`:

```toml
[build]
  command = "pnpm run build"
  publish = "dist"
```

y `package.json`: `"build": "tsc -b && vite build"`.

De los cuatro nodos que `verify` corre en paralelo, el deploy toca **uno**:

| Nodo | Comando | ¿Corre en el deploy? |
|---|---|---|
| `lint` | `eslint .` | No |
| `typecheck` | `tsc -b --noEmit` | Sí, vía el `tsc -b` de `build` |
| `test` | `vitest run` | No |
| `mcp:test` | `pnpm --filter mcp-server test` | No |

Corrida de referencia en esta máquina, con caché caliente:

```
pnpm verify
  Test Files  16 passed (16)
       Tests  322 passed (322)
  mcp-server  # pass 85 / # fail 0
  exit 0
```

**407 tests, y ningún disparador automático.**

## 2. Por qué llega justo ahora

Dos specs escritos en paralelo le agregan trabajo a `verify`:

| Spec | Qué le hace a `verify` |
|---|---|
| El del linter (`el-linter-verifica-lo-que-claude-md-declara`) | El nodo `lint` pasa de ~2,5 s a 10,2 s por el linting con tipos; el total, de 4,0 s a **11,8 s** |
| [029](../029-lo-que-no-se-cubre-no-se-mergea/spec.md) | Le suma un **quinto nodo**, `coverage`, con umbral 100 |

Los dos hacen `verify` más valioso y más caro. Sin CI, ese valor sigue dependiendo de que alguien lo
corra a mano antes de abrir un PR — y cuanto más tarda, menos probable es que lo hagan.

Es también lo que decide la forma del workflow: **si corre `verify` y no una lista de nodos, el quinto
entra solo** (D1, AC3).

## 3. El límite con el spec del linter

Verificado leyendo sus cuatro archivos en el worktree hermano. Sus ACs cubren `--max-warnings 0`, las
reglas por ruta, `no-restricted-syntax`, los `eslint-disable`, las promesas sin esperar en `audio/`, el
borrado de `especificadores()`, el `--print-config` del `mcp-server` y —AC9— **el preset de react-hooks
pasando de 2 reglas a 17**.

Búsqueda sobre esos mismos cuatro archivos de `github actions`, `workflow`, `.github`, `engines` y
`netlify`: **cero coincidencias**.

O sea que el corte es limpio y no hay que negociarlo: **ese spec decide qué se verifica; éste, quién lo
corre.** Y el bump de `eslint-plugin-react-hooks` va allá y no acá, porque la subida de versión y la
migración del preset a su forma flat tienen que ir en el mismo commit — sin eso `eslint` no arranca.

## 4. `engines` y el `typescript` mal ubicado

`mcp-server/package.json`:

```json
"engines": { "node": ">=22.18" },
"dependencies": {
  "@modelcontextprotocol/server": "^2.0.0",
  "zod": "^4.2.0",
  "typescript": "~5.8.3"
}
```

El raíz no tiene `engines`. Los tres lugares donde hoy vive el requisito de Node:

1. `CLAUDE.md`: «Node ≥ 20.19 o ≥ 22.12 — Vite 7 lo exige en `engines`» (el de Vite);
2. `netlify.toml`: `NODE_VERSION = "22"` con el requisito en un comentario;
3. el `engines` de `node_modules/vite/package.json`, que es de la dependencia y no del proyecto.

`typescript` en `dependencies` de `mcp-server` lo usa sólo `"typecheck": "tsc"`. `"start": "node
src/index.ts"` no lo necesita: Node ≥22.18 hace type-stripping nativo, que es exactamente el motivo por
el que ese piso de `engines` existe (`CLAUDE.md` lo dice).

## 5. La tabla de `outdated`, y qué entra

| Paquete | Actual | Última | ¿Entra? | Por qué |
|---|---|---|---|---|
| `react` / `react-dom` | 19.1.1 | 19.2.8 | Sí | Patch dentro del major |
| `@types/react` | 19.1.12 | 19.2.18 | Sí | Acompaña a `react` |
| `@types/react-dom` | 19.1.9 | 19.2.4 | Sí | Ídem |
| `typescript-eslint` | 8.43.0 | 8.67.0 | Sí | Minor |
| `node-web-audio-api` | 2.1.0 | 2.2.0 | Sí | Minor; lo usan los tests de `audio/` |
| `vitest` | 4.1.10 | 4.1.11 | Sí | Patch, **y es precondición del 024** — ver abajo |
| `eslint-plugin-react-hooks` | 5.2.0 | 7.1.1 | **No acá** | Es del spec del linter (§3) |
| `@types/node` | 24.3.1 | 26.2.0 | No | Major |
| `globals` | 16.4.0 | 17.11.0 | No | Major |
| `eslint-plugin-react-refresh` | 0.4.20 | 0.5.4 | No | Minor de un `0.x`, o sea major por semver |
| `@vitejs/plugin-react` | 5.0.2 | 6.1.0 | No | Major |
| `vite` | 7.1.5 | 8.2.2 | No | Major |
| `eslint` | 9.35.0 | 10.8.1 | No | Major |
| `typescript` | 5.8.3 | 7.0.2 | **No, y está argumentado** | El docblock de `freqBuf` mide que con 7.0.2 esa línea es un TS2345 |

El detalle de `vitest`: `@vitest/browser-playwright` se resuelve a **`4.1.11` exacta**, no a un rango —
se publica pinneado a la versión del runner. Con `vitest` en 4.1.10 quedarían dos versiones del runner
en el árbol. Por eso el patch entra acá y no en el 024: es una precondición, no una mejora.

## 6. Archivos que toca

| Archivo | Qué cambia |
|---|---|
| `.github/workflows/verify.yml` | **Nuevo** |
| `package.json` | `engines`, y las seis subidas de §5 |
| `pnpm-lock.yaml` | Consecuencia |
| `mcp-server/package.json` | `typescript` de `dependencies` a `devDependencies` |
| `CLAUDE.md` | La línea de Node pasa a nombrar el `engines` propio; se agrega que la CI corre `verify` |
| `docs/guides/quickstart.md` | Ídem, donde ya nombra los comandos |

**Cero archivos de `src/`. Cero de `eslint.config.js`.**

## 7. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| La CI se pelea con los dos specs que le agregan nodos a `verify` | **Baja por diseño** | D1: el workflow corre el script, no una lista. AC3 lo fija |
| `--frozen-lockfile` rompe un PR legítimo | Media | Es el punto: obliga a commitear el lock. Está en AC2 a propósito |
| La CI tarda y molesta | Media | Con el linter y el coverage puestos, `verify` va a estar cerca de 15 s. El costo real es el `pnpm install`, que se cachea |
| Windows vs. Linux en el runner | Baja | Nada del repo depende del SO; los tests corren en `environment: 'node'` |
| El workflow reporta verde sin haber corrido nada | Media | AC7: hay que **verlo en rojo** rompiendo algo a propósito antes de creerle |

## 8. Lo que este spec deja mejor para el que sigue

El 024 agrega **un paso** al workflow (`playwright install chromium`). El 029 no agrega ninguno: su
nodo entra por el propio `verify`. Sin el 023, los dos tendrían que crear además el workflow entero, y
la decisión de D1 se estaría tomando junto con la de cómo se testea la UI o cuánto coverage hace falta
— que son otras discusiones.

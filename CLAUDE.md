# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio. Es un *cheat sheet*: lo que no
se puede averiguar mirando un archivo. El detalle vive en `docs/`, las reglas por capa en
`.claude/rules/` —se cargan solas al tocar sus archivos— y el trabajo planificado en `specs/log.md`.

## Qué es

Un prototipo de **instrumento musical**, no un juego con reglas de resolución. El usuario coloca
pentominós en un tablero de 10×6 y cada pieza dispara un arpegio de cinco notas. No hay puntaje ni
condición de victoria — al evaluar una feature, la pregunta es si vuelve al instrumento más expresivo,
no más difícil.

**Stack:** Vite 7 · React 19 · TypeScript 5.8 · Tailwind CSS 4 · Web Audio (sin librería de audio)

---

## Comandos

La lista está en `package.json`. Lo que ese archivo no dice:

**`pnpm verify` es el nodo de convergencia** — corre `lint ‖ typecheck ‖ test ‖ mcp:test` en paralelo y
es lo que hay que correr antes de un PR. Medido con caché caliente: 8,8 s en serie contra 4,0 s en
paralelo, y un nodo rojo devuelve exit 1.

Su forma exacta —`pnpm --filter "{.}" run --parallel "/^(…)$/"`— tiene dos cosas que **no** son
cosméticas, y las dos se descubrieron fallando en verde:

- **`--filter "{.}"` es obligatorio.** `--parallel` es un flag recursivo de workspace y **excluye el
  paquete raíz**: sin el filtro corre solo los scripts de `mcp-server` y reporta éxito sin haber tocado
  `lint`, `typecheck` ni `test` de la app. El filtro va **por ruta** (`{.}`) y no por nombre, para que
  renombrar el paquete no lo deje mudo otra vez.
- **El `$` del regex tampoco es decorativo:** sin él el patrón también engancha `test:watch` y arranca
  un segundo vitest. Medido: en shell no interactiva no cuelga —vitest sin TTY no entra en modo watch y
  termina igual—, así que el costo visible es trabajo duplicado. En una terminal interactiva sí queda
  esperando. El ancla borra la pregunta.

**El gestor es pnpm**, fijado en `packageManager` y versionado en `pnpm-lock.yaml`. No usar npm:
instalaría un `node_modules` plano y dejaría un `package-lock.json` que Netlify puede llegar a
preferir. La config de pnpm vive en `pnpm-workspace.yaml`, no en el `package.json`.

`node_modules` es **estricto**: solo se puede importar lo declarado en `package.json`. Un import de una
dependencia transitiva que con npm andaba, acá falla — es a propósito, y es la red que atrapa los
imports fantasma antes de que lleguen a producción.

Los tests de `src/` corren con Vitest en `environment: 'node'` contra `node-web-audio-api`, **no en
jsdom**: jsdom no implementa Web Audio, y el dominio es puro así que corre ahí sin adaptación. Los del
MCP server son de `node --test`, en su propio paquete.

Node ≥ 20.19 o ≥ 22.12 — Vite 7 lo exige en `engines`. El MCP server pide **≥ 22.18** porque corre
TypeScript sin compilar; es un piso de tooling y con Node 20 solo se pierde el server.

---

## Arquitectura

`src/` son cuatro capas en carpetas, con **una sola dirección de dependencia**:

```
types/ ← constants/ ← módulos              types/ no importa nada de afuera de types/
transform.ts ← board.ts                    domain/ no importa nada de fuera de domain/
             ← music.ts ← invariants.ts    audio/  no importa nada de fuera de audio/
                                           components/ y App.tsx importan de las dos
```

1. **`domain/`** — puro: sin React, sin Web Audio, sin DOM. Geometría, reglas del tablero, modelo
   musical e invariantes.
2. **`audio/`** — habla MIDI y no conoce el dominio. Síntesis, scheduler con lookahead, singletons y el
   mapeo del espectro.
3. **`components/`** — un componente por archivo, presentacionales.
4. **`App.tsx`** — el shell: estado, derivados, handlers, los dos efectos y la composición.

`domain/` y `audio/` son **hermanos sin aristas entre ellos**: el motor habla números MIDI y no sabe
qué es un pentominó.

Que el dominio viviera dentro de `App.tsx` no era neutral: `react-refresh/only-export-components`
prohíbe que un `.tsx` exporte algo además del componente, así que las puras **no podían exportarse y
por lo tanto no podían testearse**. Hoy `domain/` tiene tests donde antes había cero.

Detalle en [docs/architecture/overview.md](./docs/architecture/overview.md).

---

## Reglas que valen en todo el repo

Las de cada capa se cargan solas al tocar sus archivos (`.claude/rules/`). Estas valen siempre, y el
porqué de cada una está en [docs/guides/conventions.md](./docs/guides/conventions.md):

- **La dirección de dependencia la verifica el linter**, no la revisión. `eslint.config.js` tiene un
  override por capa con `@typescript-eslint/no-restricted-imports` —la variante que también ve los
  `import type`— y un import prohibido falla `pnpm lint` con el mensaje de la capa. Los patrones cubren
  `../` y `../../`, que es la profundidad de hoy: al crear un subdirectorio nuevo hay que agregar el
  patrón. Es una red, no una prueba formal.
- **Sin barrels, con extensión explícita, sin alias.** Todo import local lleva extensión
  (`./domain/transform.ts`) — omitirla **no rompe la app**, porque Vite resuelve igual, así que el
  error sería invisible del lado del navegador y solo aparecería al cargar `domain/` con node crudo.
- **Los módulos no declaran constantes.** Un `.ts` de capa tiene funciones y nada más; los valores
  fijos van a `<capa>/constants/` y los tipos a `<capa>/types/`. El motivo es medible: antes había
  cuatro pares de números que tenían que coincidir y nada sincronizaba.
- **Español** en comentarios, commits y specs.
- **Cero `enum`.** El `erasableSyntaxOnly` del tsconfig los rechaza, y es la misma opción que permite
  que node cargue `src/domain/` sin compilar. Conjunto cerrado = const-object + union type derivado.
- **Cero `any` y cero `@ts-ignore`.** Los tres que hubo estaban tapando problemas de diseño, no de
  tipos. Si aparece la tentación de uno nuevo, sospechar del diseño antes que de TypeScript.
- **Sin estado global.** Ni Context, ni Redux, ni Zustand.
- **Los comentarios explican el porqué**, no el qué: una decisión, una restricción, un bug evitado.
- **Los borrados van en su propio commit**, para que revertirlos sea trivial.

---

## Preguntarle al dominio en vez de simularlo

`mcp-server/` levanta con el repo (`.mcp.json` está commiteado) y **ejecuta las funciones puras
reales**: no hay build y no hay artefacto que regenerar. Si alguien cambia `notesForRotation`, la tool
responde distinto en la consulta siguiente. `find_symbol` es la única que mira el código como texto, y
también construye su índice **en la consulta** — nada se persiste, así que sigue sin haber staleness.

| Tool | Preguntarle antes de |
|---|---|
| `describe_piece` | derivar a mano una rotación, una escala o un retrógrado |
| `simulate_board` | recorrer el lookahead a mano para saber qué suena junto |
| `check_invariants` | y después de tocar geometría, `SHAPES` o el modelo musical |
| `spec_status` | leer `log.md` y todos los `tasks.md` |
| `find_symbol` | `grep` para ubicar un símbolo, o abrir un archivo para ver una firma |

Su `usedBy` incluye a `mcp-server/`, que importa 31 símbolos del dominio: tocar una firma de `domain/`
puede romper una tool. Eso **no** pasa silencioso —`pnpm verify` typechequea cruzando el borde de
paquete— pero sin esa arista la estimación del cambio sale corta.

La regla corta: **simular el modelo es caro, y localizar dejó de ser gratis.** Lo segundo cambió y está
medido: `src/` pasó de 8 archivos a 38 con el spec 005, y el camino `grep` + abrir el archivo cuesta
~14x lo que cuesta preguntar. Y leer el código igual cuando la pregunta es *por qué* algo está hecho
así — eso vive en los comentarios, no en la salida de una tool.
[docs/guides/mcp-domain.md](./docs/guides/mcp-domain.md).

---

## Documentación

| Sección | Archivo | Cuándo consultarlo |
|---|---|---|
| Visión general | [docs/architecture/overview.md](./docs/architecture/overview.md) | Las cuatro capas y su dirección de dependencia |
| Estructura de directorios | [docs/architecture/directory-structure.md](./docs/architecture/directory-structure.md) | Dónde crear cada cosa, qué está muerto |
| Modelo musical | [docs/architecture/modelo-musical.md](./docs/architecture/modelo-musical.md) | Pieza → tónica, rotación → escala, reflexión → retrógrado, forma → nota por celda |
| Capa de audio | [docs/architecture/audio.md](./docs/architecture/audio.md) | Grafo Web Audio, ADSR, scheduler con lookahead, reconciliación de loops |
| Lenguaje visual | [DESIGN.md](./DESIGN.md) | Los 12 colores y su tónica, el contraste como test, qué muestra una celda y qué no se comunica con color |
| Inicio rápido | [docs/guides/quickstart.md](./docs/guides/quickstart.md) | Setup, comandos, flujos típicos |
| Convenciones | [docs/guides/conventions.md](./docs/guides/conventions.md) | Organización de `src/`, TypeScript, geometría, estado, comentarios |
| Troubleshooting | [docs/guides/troubleshooting.md](./docs/guides/troubleshooting.md) | Errores reales ya pisados en este repo |
| MCP server de dominio | [docs/guides/mcp-domain.md](./docs/guides/mcp-domain.md) | Las cuatro tools que ejecutan el dominio |
| Deploy | [docs/infra/deploy.md](./docs/infra/deploy.md) | Netlify, `publish = "dist"`, versión de Node |

**Trabajo planificado y deuda conocida:** [specs/log.md](./specs/log.md), con estados, dependencias y
notas de revisión. Es la única fuente — no se duplica acá para que no se desactualice.

---

## Antes de un cambio grande

Escribir un spec en `specs/` (cuatro archivos: `spec` · `research` · `plan` · `tasks`), commitearlo a
`main`, y recién ahí sacar la rama de feature. Convención en [specs/README.md](./specs/README.md).

El `research.md` se escribe **midiendo, no suponiendo**. El spec 001 salió distinto de lo previsto
porque correr el algoritmo sobre las 12 piezas × 4 rotaciones desmintió tres supuestos.

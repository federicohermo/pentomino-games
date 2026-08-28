# CLAUDE.md

Guía para Claude Code (claude.ai/code) en este repositorio. Es un *cheat sheet*: lo que no se puede
averiguar mirando un archivo. El detalle vive en `docs/`, las reglas por capa en `.claude/rules/`
—se cargan solas al tocar sus archivos—, y **el trabajo planificado y la deuda en GitHub Issues**:
`specs/mapa.json` es el mapa spec↔issue, y el porqué de cada decisión, un comentario en su issue.

## Qué es

Un prototipo de **instrumento musical**, no un juego con reglas de resolución. El usuario coloca
pentominós en un tablero que **mide lo que entra en la pantalla** —26×15 en un escritorio de
1920×1080, 5×9 en un teléfono, con la celda siempre en unos 73 px (spec 031)— y cada pieza dispara un
arpegio de cinco notas —salvo que esté
**muteada**, que desde el spec 014 la deja ocupando su lugar y su tiempo sin sonar—. Desde el spec 009 el
tablero es un **recorrido**, no un compás: un circuito cerrado visita las piezas, y el orden y los
silencios salen de la geometría. No hay puntaje ni condición de victoria — al evaluar una feature, la
pregunta es si vuelve al instrumento más expresivo, no más difícil.

**Stack:** Vite 7 · React 19 · TypeScript 5.8 · Tailwind CSS 4 · Web Audio (sin librería de audio)

---

## Comandos

La lista está en `package.json`. Lo que ese archivo no dice está en
[docs/guides/verificacion.md](./docs/guides/verificacion.md), entero. Lo que hay que saber antes de
abrirlo:

- **`pnpm verify` es el nodo de convergencia** y es lo que hay que correr antes de un PR: corre
  `lint ‖ typecheck ‖ suite ‖ mcp:test` en paralelo —23,7 s contra 41,2 s en serie— y desde el spec
  023 lo corre además GitHub Actions sobre cada PR, llamando al **script** y no a la lista de nodos.
- **`suite` son dos pasadas de vitest en secuencia**, y la segunda tiene el gate de coverage con
  umbral **100** en las cuatro métricas. Las dos cosas —dos pasadas, y en secuencia— existen porque
  instrumentar rompe los presupuestos de performance del 009, medido.
- **Cero excepciones al umbral**: ni un comentario que saltee una rama. Si parece inalcanzable, se
  borra o se vuelve alcanzable. Desde el 032 lo verifica `no-warning-comments`.
- **`lint` también lintea todos los `.md`** desde el 032, en dos carriles: preset completo en la
  documentación viva, y sólo las reglas de **renderizado** en `specs/[0-9]*/**`, porque un spec
  mergeado no se reescribe.
- **Los tests son dos proyectos de Vitest**, `node` y `browser`. El discriminante es el **sufijo**
  `*.browser.test.tsx` y no una carpeta; el `node` mira cinco raíces —`src/`, `__tests__/` en la raíz,
  `docs/`, `specs/` y `.claude/scripts/`—: cada gate vive con **el sujeto** que verifica. **Chromium
  no está en el lockfile**: un clone nuevo necesita `pnpm exec playwright install chromium`.
- **El gestor es pnpm y no npm** — el deploy elige el gestor por el lockfile, y un `package-lock.json`
  al lado le daría a elegir. Y `node_modules` es **estricto**: importar una transitiva falla, a propósito.
- **Node ≥ 20.19 o ≥ 22.12**, declarado en nuestro propio `engines`. El MCP server pide **≥ 22.18**
  porque corre TypeScript sin compilar, y ese piso vive en el `engines` del server.

---

## Arquitectura

`src/` son cuatro capas en carpetas, con **una sola dirección de dependencia**:

```text
types/ ← constants/ ← módulos              types/ no importa nada de afuera de types/
transform.ts ← board.ts                    domain/ no importa nada de fuera de domain/
             ← music.ts ← invariants.ts    audio/  no importa nada de fuera de audio/
board.ts + music.ts ← sequence.ts          components/ y App.tsx importan de las dos
```

1. **`domain/`** — puro: sin React, sin Web Audio, sin DOM. Geometría, reglas del tablero, modelo
   musical e invariantes.
2. **`audio/`** — habla MIDI y no conoce el dominio. Síntesis, scheduler con lookahead, singletons y el
   mapeo del espectro.
3. **`components/`** — un componente por archivo, presentacionales.
4. **`App.tsx`** — el shell: estado, derivados, handlers y la composición. Desde el spec 022 **sin un
   solo `useEffect`**: los cuatro de reconciliación viven en `components/use-engine.ts`, los dos de
   entrada en `components/use-input.ts` y —desde el 021— el que mide el viewport y escribe `--cell` en
   `components/use-grid.ts`.

`domain/` y `audio/` son **hermanos sin aristas entre ellos**: el motor habla números MIDI y no sabe
qué es un pentominó.

Que el dominio viviera dentro de `App.tsx` no era neutral: `react-refresh/only-export-components`
prohíbe que un `.tsx` exporte algo además del componente, así que las puras **no podían exportarse y
por lo tanto no podían testearse**. Hoy `domain/` tiene tests donde antes había cero.

Detalle en [docs/architecture/overview.md](./docs/architecture/overview.md).

---

## Reglas que valen en todo el repo

Las de cada capa se cargan solas al tocar sus archivos (`.claude/rules/`). Estas valen siempre, y
**el porqué de cada una está en [docs/guides/conventions.md](./docs/guides/conventions.md)** — acá
está la regla y quién la verifica, que es lo que hace falta antes de escribir una línea.

En `.claude/skills/` viven las especializaciones de `/spec-review` y `/spec-implement` —los globales
son el piso genérico; las locales cablean las rutas de `specs/` y el formato de tarea—, los tres
`-batch` y **`/spec-create`**. `/spec-review-batch` y `/spec-implement-batch` revisan e implementan un
lote en paralelo y `/pr-review-batch` cierra la vuelta, en ese orden: un cruce visto como texto cuesta
un párrafo y en dos carriles cuesta un rebase. `/spec-create` es el tramo anterior a todos ellos.

Estas son las reglas. Casi todas las verifica `pnpm lint` desde el spec 030 — antes eran prosa, y la
mitad estaba desincronizada:

- **La dirección de dependencia se prohíbe por ruta**, no por el string del import
  (`import-x/no-restricted-paths`). Una carpeta nueva queda cubierta sola.
- **Sin barrels, con extensión explícita, sin alias.** Todo import local lleva `.ts`/`.tsx`.
  Omitirla **no rompe la app** —Vite resuelve igual— así que el error sería invisible hasta cargar
  `domain/` con node crudo.
- **Los módulos no declaran constantes.** Los valores fijos van a `<capa>/constants/` y los tipos a
  `<capa>/types/`. Verificado en `domain/` y `audio/`, **no** en `components/`: el problema medido
  es un valor que existe dos veces, y una constante privada de un componente no puede
  desincronizarse con nada.
- **Español** en comentarios, commits y specs.
- **Cero `enum`.** Lo rechaza `erasableSyntaxOnly` —la misma opción que deja a node cargar
  `src/domain/` sin compilar— y también el linter. Conjunto cerrado = const-object + union derivado.
- **Cero `any` y cero `@ts-ignore`.** Los tres que hubo tapaban problemas de diseño, no de tipos.
  Su contraparte es `noInlineConfig`: **no hay `eslint-disable`**. Una excepción real va como
  override por archivo en `eslint.config.js`, que se ve en el diff y se explica.
- **La aserción no nula (`!`) es de la misma familia**: un `any` chiquito. Antes de escribir una,
  probar el `const`. Quedan **tres** en producción, las tres como override con su motivo — y esa
  lista es la única fuente del número, que mientras vivió acá se desincronizó dos veces. En los
  tests sí valen, y son deliberadas.
- **Nada de saltear una rama de coverage.** Si parece inalcanzable, se borra o se vuelve alcanzable.
- **Sin estado global.** Ni Context, ni Redux, ni Zustand.
- **Nada de `.only` ni `.skip` en un test**, ni un test sin una sola aserción. Es la misma familia
  de bug que el `--filter "{.}"`: fallar en verde.
- **Los comentarios explican el porqué**, no el qué: una decisión, una restricción, un bug evitado.
- **Los borrados van en su propio commit**, para que revertirlos sea trivial.

---

## Preguntarle al dominio en vez de simularlo

`mcp-server/` levanta con el repo (`.mcp.json` está commiteado) y **ejecuta las funciones puras
reales**: no hay build y no hay artefacto que regenerar. Si alguien cambia `notesForRotation`, la tool
responde distinto en la consulta siguiente. `find_symbol` es la única que mira el código como texto, y
también construye su índice **en la consulta** — nada se persiste, así que sigue sin haber staleness.
Y desde el spec 033 hay una que **escribe**, `spec_write`, que es la única: `tasks.md` no es un archivo
que se lee sino una **interfaz**, y cinco skills la implementaban a mano hasta que la tool existió.

| Tool | Preguntarle antes de |
|---|---|
| `describe_piece` | derivar a mano una rotación, una escala o un retrógrado |
| `simulate_board` | recorrer el lookahead a mano para saber qué suena junto |
| `check_invariants` | y después de tocar geometría, `SHAPES` o el modelo musical |
| `spec_status` | leer `mapa.json` y todos los `tasks.md` para saber qué falta de verdad, qué archivos cita una tarea o qué `X → Y` mueve |
| `spec_write` | abrir un `tasks.md` para marcar una casilla — es la única que escribe, y desde el 042 marcar es lo único que hace |
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
| Modelo musical | [docs/architecture/modelo-musical.md](./docs/architecture/modelo-musical.md) | Pieza → tónica, rotación → escala **o** orden según el régimen (spec 017), reflexión → retrógrado, forma → el camino que recorre el arpegio y con él la nota de cada celda, posición → orden y silencio |
| Capa de audio | [docs/architecture/audio.md](./docs/architecture/audio.md) | Grafo Web Audio, ADSR, scheduler con lookahead, reconciliación de loops |
| Lenguaje visual | [DESIGN.md](./DESIGN.md) | Los 12 colores y su tónica, el contraste como test, qué muestra una celda y qué no se comunica con color |
| Inicio rápido | [docs/guides/quickstart.md](./docs/guides/quickstart.md) | Setup, comandos, flujos típicos |
| Verificación | [docs/guides/verificacion.md](./docs/guides/verificacion.md) | `verify` entero: los cuatro nodos, las dos pasadas de `suite`, el umbral 100, los dos proyectos de Vitest y los dos carriles de Markdown |
| Convenciones | [docs/guides/conventions.md](./docs/guides/conventions.md) | Organización de `src/`, TypeScript, geometría, estado, comentarios |
| Troubleshooting | [docs/guides/troubleshooting.md](./docs/guides/troubleshooting.md) | Errores reales ya pisados en este repo |
| MCP server de dominio | [docs/guides/mcp-domain.md](./docs/guides/mcp-domain.md) | Las seis tools —cinco que ejecutan el dominio o lo leen, y la que escribe— y el resource `pentomino://constantes`, que no se llama como una tool |
| Deploy y ramas | [docs/infra/deploy.md](./docs/infra/deploy.md) · [docs/infra/ramas.md](./docs/infra/ramas.md) | Dónde vive la config del deploy y qué corre y qué no en el build; y el modelo de dos ramas: `staging` integra y es la default, `main` es release y es la que se publica, con el ruleset que lo sostiene |

**Trabajo planificado:** desde el spec 034 cada spec **es un issue**, y
[specs/mapa.json](./specs/mapa.json) —lo que se commitea de `specs/` son él, el `README.md` y los
dos gates de `specs/__tests__/`, y ninguno es un spec— es el **mapa spec↔issue** y el estado de cada
uno. **Su `estado` lo deriva `mapa.yml`** en el push a `staging` desde el 043: el gate del 038 prohíbe
tocarlo dentro del PR que lo justifica. Las dependencias tampoco: las calcula `spec_status` en
`cruces`, leyendo los `X → Y` de cada `tasks.md`. El porqué de cada decisión, en el issue de su spec.

**La deuda sin spec vive en [GitHub Issues](https://github.com/federicohermo/pentomino-games/issues)**,
no en un archivo —ni, desde el 042, en el `## Seguimiento` del spec que la parió—. `deuda.md` era un
tracker escrito a mano y perdía ítems: al mudarlo aparecieron **seis** enterrados en el `tasks.md` de
specs ya cerrados, dos de ellos bugs medidos que llevaban veinte días invisibles. Un issue tiene estado propio, se cierra desde un commit con `Closes #N` y no hereda el estado del spec que lo parió.
**Y desde el 044 el spec que nace de un issue lo salda**: lo declara en el `origen` de su fila —la línea `**Origen:** #N` del `spec.md`, y saldar no es citar— y su PR lleva un `Closes` por cada uno, o el gate del mapa se pone en rojo — no en ese PR ni al mergear, sino en el siguiente, que es de otro. Qué hay para promover: `node .claude/scripts/deuda.mjs`.

---

## Antes de un cambio grande

Escribir los cuatro archivos (`spec` · `research` · `plan` · `tasks`), **publicarlo como issue** con
`node .claude/scripts/publicar-spec.mjs`, que le escribe su entrada en `specs/mapa.json` — lo único del spec
que se commitea. **Ahí termina abrir un spec: la rama la abre el implementador**, porque escribirlo y decidir implementarlo son dos decisiones distintas y una rama entre las dos queda colgada. Y **desde el 037 lo bloquea un hook** y no la buena voluntad: sin un spec detrás de la rama no se edita `src/`, `mcp-server/src/` ni `docs/`. La convención, en [specs/README.md](./specs/README.md); el flujo entero y qué NO necesita spec, en el skill [spec-create](./.claude/skills/spec-create/SKILL.md).

Desde el spec 034 `specs/[0-9]*/` está en el `.gitignore`: el directorio es una **caché** que se trae
con `node .claude/scripts/hidratar-specs.mjs <NNN>`, y hace falta **en cada worktree**. Leerlos anda
igual, pero **`Grep` no los ve** —es ripgrep y respeta `.gitignore`—: ahí va `rg --no-ignore`.

El `research.md` se escribe **midiendo, no suponiendo**. El spec 001 salió distinto de lo previsto
porque correr el algoritmo sobre las 12 piezas × 4 rotaciones desmintió tres supuestos.

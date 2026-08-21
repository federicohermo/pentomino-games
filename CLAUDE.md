# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio. Es un *cheat sheet*: lo que no
se puede averiguar mirando un archivo. El detalle vive en `docs/`, las reglas por capa en
`.claude/rules/` —se cargan solas al tocar sus archivos— y el trabajo planificado en `specs/`
(`log.md` · `deuda.md` · `revisiones.md`).

## Qué es

Un prototipo de **instrumento musical**, no un juego con reglas de resolución. El usuario coloca
pentominós en un tablero de 10×6 y cada pieza dispara un arpegio de cinco notas —salvo que esté
**muteada**, que desde el spec 014 la deja ocupando su lugar y su tiempo sin sonar—. Desde el spec 009 el
tablero es un **recorrido**, no un compás: un circuito cerrado visita las piezas, y el orden y los
silencios salen de la geometría. No hay puntaje ni condición de victoria — al evaluar una feature, la
pregunta es si vuelve al instrumento más expresivo, no más difícil.

**Stack:** Vite 7 · React 19 · TypeScript 5.8 · Tailwind CSS 4 · Web Audio (sin librería de audio)

---

## Comandos

La lista está en `package.json`. Lo que ese archivo no dice:

**`pnpm verify` es el nodo de convergencia** — corre `lint ‖ typecheck ‖ suite ‖ mcp:test` en paralelo y
es lo que hay que correr antes de un PR. Medido con caché caliente: 41,2 s en serie contra 23,7 s en
paralelo, y un nodo rojo devuelve exit 1.

**Y desde el spec 023 no depende de que alguien se acuerde:** `.github/workflows/verify.yml` lo corre
sobre cada `pull_request` y cada push a `main`, con Chromium instalado por el propio workflow. El
workflow corre el **script**, no la lista de nodos, y el porqué está comentado ahí: la forma exacta de
`verify` ya costó dos trampas, y enumerarla en el YAML crearía un segundo lugar donde vive. La
evidencia no es hipotética — el 029 le cambió `test` por `suite` y un workflow con la lista habría
seguido en verde sin el gate de coverage.

**`suite` son DOS pasadas de vitest, en secuencia y no en paralelo** (spec 029): primero `test` sin
instrumentar y después `coverage`, con umbral **100** en las cuatro métricas. Los dos motivos están
medidos y ninguno es preferencia:

- **Instrumentar es medir el instrumento.** v8 inserta contadores en cada rama y los dos presupuestos
  de performance del 009 pasan de 1,8 ms a **11,3 ms** contra un techo de 5. Se saltean bajo coverage
  con `skipIf`, y el presupuesto se verifica en la pasada limpia — **la local**. Desde el 023 el mismo
  `skipIf` los saltea también cuando `CI` está puesta, por el mismo motivo con otra cara: el runner de
  Actions dio **8,4 ms y 15,7 ms** en dos corridas del mismo commit, o sea que no es una máquina lenta
  con un número propio sino una VM sin número, y no hay techo que ahí signifique algo. El precio, que
  el `skipIf` dice al lado: **estos dos presupuestos no los verifica la CI**, los verifica el `verify`
  de tu máquina.
- **Y en secuencia porque en paralelo el presupuesto también se cae, por otra razón.** Con cinco
  procesos pesados compitiendo por CPU la mediana sube igual y `verify` daba rojo sin que nada
  estuviera mal — el mismo modo de falla que el comentario de AC8 en `sequence.test.ts` ya
  documentaba cuando subió su techo de 2 a 4. Encadenarlas deja **cuatro** nodos concurrentes, o sea
  la misma contención que había antes del 029, y el presupuesto vuelve a medir lo que dice medir.

El umbral es 100 y no 95 porque un umbral más bajo es un presupuesto de deuda **sin dueño**: nadie
sabe cuáles son las líneas que el margen permite, así que nadie las revisa. Y su corolario: **cero
`/* v8 ignore */`**, por el mismo argumento que «cero `any`». Si una rama parece inalcanzable, se
borra o se vuelve alcanzable — las cuatro que aparecieron están anotadas en el research del 029.

Y el 023 encontró la quinta, que sólo se ve corriendo el gate en **otra** máquina: un comparador
`a.name < b.name ? -1 : 1` dentro de `walk()` cubría sus dos ramas en Windows y una sola en el runner,
porque **cuál lado se ejecuta depende del orden en que el filesystem entrega las entradas** —NTFS
alfabético, ext4 por hash— y `mcp:test` daba `99.64%`. El umbral 100 pasaba por el sistema de archivos
de quien lo corriera. La salida no fue un ignore sino borrar la rama: el comparador es aritmético
(`Number(a > b) - Number(a < b)`), que además deja el orden total.

**El nodo que más creció es `lint`**, y lo pagó el spec 030: el linting con tipos lo llevó de ~2,5 s a
**11,0 s**. Se pagó con la medición al lado —`recommendedTypeChecked` sobre el repo entero da 100
hallazgos y 97 son un solo patrón de `node:test`— y ya se recortó lo que no valía: `import-x/no-cycle`
costaba **15 s más** y encontraba cero ciclos, así que no está. Aun así el reloj de `verify` no lo manda
el lint sino **`suite`, con 19,4 s**: el 030 se escribió previendo ser el nodo más lento de los cuatro y
el 029 lo desbancó antes de que ninguno de los dos se mergeara. Es el dato de cada uno medido sin el
otro — el par de arriba está medido con los dos puestos.

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

Los tests de `src/` son **dos proyectos de Vitest y un solo comando** (spec 029). El corte no es por
capa sino por lo que el test necesita:

- **`node`** — `environment: 'node'` contra `node-web-audio-api`. El dominio es puro y el audio tiene
  una implementación nativa de Web Audio, así que corre ahí sin adaptación.
- **`browser`** — Chromium de verdad, por Playwright, para los archivos `*.browser.test.tsx`. Entra
  porque jsdom no puede: `Spectrum.tsx` necesita canvas 2D, `createLinearGradient`, `ResizeObserver`,
  `matchMedia` y un `getBoundingClientRect` con números, y `audio/engine.ts` necesita
  `new AudioContext()` y `window.setInterval`. Cubrirlos con jsdom exigiría mockear exactamente el
  código que se quiere cubrir, que es cobertura sin verificación.

El discriminante es el **sufijo** y no una carpeta: un test de `Board.tsx` que necesita navegador
sigue siendo un test de `Board.tsx` y vive al lado. **Chromium no está en el lockfile**: un clone
nuevo necesita `pnpm exec playwright install chromium` antes del primer `verify`. En CI eso no hace
falta acordárselo: el workflow del 023 lo instala con `--with-deps`, que el runner de Ubuntu necesita
para las librerías de sistema.

Los del MCP server son de `node --test`, en su propio paquete, y desde el 029 corren con los
`--test-coverage-*=100` de node.

Node ≥ 20.19 o ≥ 22.12 — lo exige Vite 7 y desde el spec 023 lo declara **nuestro propio**
`engines`, no el de Vite: con Node 18 el gestor lo dice al instalar, en vez de que se entere el build.
El MCP server pide **≥ 22.18** porque corre TypeScript sin compilar; es un piso de tooling, vive en el
`engines` del server —que es quien lo necesita— y con Node 20 solo se pierde el server.

---

## Arquitectura

`src/` son cuatro capas en carpetas, con **una sola dirección de dependencia**:

```
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
   solo `useEffect`**: los cuatro de reconciliación viven en `components/use-engine.ts` y los dos de
   entrada en `components/use-input.ts`.

`domain/` y `audio/` son **hermanos sin aristas entre ellos**: el motor habla números MIDI y no sabe
qué es un pentominó.

Que el dominio viviera dentro de `App.tsx` no era neutral: `react-refresh/only-export-components`
prohíbe que un `.tsx` exporte algo además del componente, así que las puras **no podían exportarse y
por lo tanto no podían testearse**. Hoy `domain/` tiene tests donde antes había cero.

Detalle en [docs/architecture/overview.md](./docs/architecture/overview.md).

---

## Reglas que valen en todo el repo

Las de cada capa se cargan solas al tocar sus archivos (`.claude/rules/`). Estas valen siempre, y el
porqué de cada una está en [docs/guides/conventions.md](./docs/guides/conventions.md). En
`.claude/skills/` viven además las especializaciones de `/spec-review` y `/spec-implement`: esos
skills globales son el piso genérico, y las locales cablean las rutas de `specs/` y el formato de
tarea del repo. Los dos `-batch` no tienen contraparte global y son de acá:
`/spec-review-batch` revisa un **lote** en paralelo —un agente por spec, sin worktrees, más uno de
coherencia que mira el lote entero y caza las contradicciones entre specs—; `/spec-implement-batch` reparte el lote en carriles —uno
por cadena de dependencias— y corre cada carril en su worktree. En ese orden: un cruce detectado como
texto cuesta un párrafo y detectado en dos carriles cuesta un rebase.

Estas son las reglas:

- **La dirección de dependencia la verifica el linter**, no la revisión. Desde el spec 030 se prohíbe
  por **ruta** y no por el string del import: `import-x/no-restricted-paths` con una zona por arista
  —las cuatro capas, `mcp-server/`, y `DOMAIN_INTERNO` módulo por módulo adentro de `domain/`—, todas
  en una sola regla. Dejó de ser una red: la ruta se resuelve contra el filesystem, así que un
  `domain/sub/x.ts` nuevo queda cubierto sin tocar la config, y ya no hay `../` que contar ni tres
  formas del mismo specifier que listar. Lo único que quedó en `no-restricted-imports` son los
  **paquetes** —React para las dos capas puras, y los de estado global—, porque un paquete de npm no
  tiene ruta en el repo.
- **Sin barrels, con extensión explícita, sin alias.** Todo import local lleva extensión
  (`./domain/transform.ts`) — omitirla **no rompe la app**, porque Vite resuelve igual, así que el
  error sería invisible del lado del navegador y solo aparecería al cargar `domain/` con node crudo.
  Desde el 030 **lo verifica el linter** (`no-restricted-syntax`), que es lo que permitió que la
  dirección interna de `domain/` deje de listar las tres formas de escribir el mismo import. El
  selector nombra las **cuatro** formas de referir un módulo —`import`, `import()`, `export … from` y
  `export * from`—: cubrir solo la primera lo devolvía a ser una red, y las otras tres existen en el
  repo.
- **Los módulos no declaran constantes.** Un `.ts` de capa tiene funciones y nada más; los valores
  fijos van a `<capa>/constants/` y los tipos a `<capa>/types/`. El motivo es medible: antes había
  cuatro pares de números que tenían que coincidir y nada sincronizaba. Lo verifica el linter **en
  `domain/` y en `audio/`, no en `components/`**, y la línea es la del motivo: el problema medido es
  un valor que existe dos veces, y una constante privada de un solo componente no puede
  desincronizarse con nada. Las siete de `Spectrum.tsx` y `Playhead.tsx` se quedan donde están, con
  los docblocks que explican el mecanismo de dibujo al lado del dibujo.
- **Español** en comentarios, commits y specs.
- **Cero `enum`.** El `erasableSyntaxOnly` del tsconfig los rechaza —y es la misma opción que permite
  que node cargue `src/domain/` sin compilar—, y desde el 030 también el linter, con el motivo del
  repo en el mensaje. Conjunto cerrado = const-object + union type derivado.
- **Cero `any` y cero `@ts-ignore`.** Los tres que hubo estaban tapando problemas de diseño, no de
  tipos. Si aparece la tentación de uno nuevo, sospechar del diseño antes que de TypeScript. Su
  contraparte lint es `noInlineConfig`: **no hay `eslint-disable`**, porque silenciar la regla es la
  otra forma de tapar el problema. Si hace falta una excepción real, va como override por archivo en
  `eslint.config.js` —que se ve en el diff y se explica— y no como un comentario suelto.
- **Sin estado global.** Ni Context, ni Redux, ni Zustand — y desde el 030 lo verifica el linter, por
  el paquete y por la llamada a `createContext`.
- **Nada de `.only` ni `.skip` en un test.** Es la misma familia de bug que el `--filter "{.}"` y el
  `$` del regex: fallar en verde. En `src/` los rechaza `@vitest/eslint-plugin`, más el test sin una
  sola aserción; en `mcp-server/` —que corre con `node --test`, donde ese plugin no llega— los rechaza
  un selector de `no-restricted-syntax`. El test sin aserción ahí no tiene equivalente barato y queda
  afuera.
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
| `spec_status` | leer `log.md` y todos los `tasks.md` para saber qué falta de verdad |
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
| Convenciones | [docs/guides/conventions.md](./docs/guides/conventions.md) | Organización de `src/`, TypeScript, geometría, estado, comentarios |
| Troubleshooting | [docs/guides/troubleshooting.md](./docs/guides/troubleshooting.md) | Errores reales ya pisados en este repo |
| MCP server de dominio | [docs/guides/mcp-domain.md](./docs/guides/mcp-domain.md) | Las cuatro tools que ejecutan el dominio |
| Deploy | [docs/infra/deploy.md](./docs/infra/deploy.md) | Netlify, `publish = "dist"`, versión de Node |

**Trabajo planificado:** [specs/log.md](./specs/log.md) —registro y dependencias—, con la deuda sin
spec en [specs/deuda.md](./specs/deuda.md) y el porqué de cada decisión en
[specs/revisiones.md](./specs/revisiones.md). Son la única fuente: no se duplican acá para que no se
desactualicen.

---

## Antes de un cambio grande

Escribir un spec en `specs/` (cuatro archivos: `spec` · `research` · `plan` · `tasks`), commitearlo a
`main`, y recién ahí sacar la rama de feature. Convención en [specs/README.md](./specs/README.md).

El `research.md` se escribe **midiendo, no suponiendo**. El spec 001 salió distinto de lo previsto
porque correr el algoritmo sobre las 12 piezas × 4 rotaciones desmintió tres supuestos.

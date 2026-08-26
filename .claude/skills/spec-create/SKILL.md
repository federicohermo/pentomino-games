---
name: spec-create
description: Abre un spec nuevo: convierte un pedido en prosa —«tenemos un bug», «hay que arreglar X», «habría que agregar», «se puede hacer que», «estaría bueno que»— en un spec publicado como issue y una rama, ANTES de tocar una línea de código. Usar apenas llega el pedido, no después de investigarlo. Trae escrito qué NO necesita spec.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - mcp__pentomino-domain__spec_status
  - mcp__pentomino-domain__spec_write
  - mcp__pentomino-domain__describe_piece
  - mcp__pentomino-domain__simulate_board
  - mcp__pentomino-domain__check_invariants
  - mcp__pentomino-domain__find_symbol
---

# spec-create — del pedido al spec publicado

Este skill cubre el **único tramo que los otros cinco no cubren**: el que va del pedido escrito en
prosa al `spec.md` en disco. `spec-review` audita un spec que existe, `spec-implement` implementa uno
que existe, y los tres `-batch` reparten lotes de specs que existen. Acá todavía no hay ninguno.

> **No lleva `context: fork`**, por el mismo motivo que `spec-implement`: necesita el historial de la
> conversación, que es donde está el pedido que lo disparó. Forkeado, el subagente arrancaría con el
> método y sin el pedido.

## Antes que nada: ¿esto necesita un spec?

**La mayoría de las veces sí, y por eso esta sección va primero y es corta.** Un skill que obliga a
escribir cuatro archivos para arreglar una tilde se apaga entero, y un gate apagado es peor que no
tenerlo — es la misma lógica que `invariants.ts` aplica a un invariante que falla por diseño.

**No necesita spec** —seguí derecho, sin rama de feature:

| Caso | Ejemplo |
|---|---|
| Un typo o una redacción, sin cambio de comportamiento | una tilde en un comentario, un `README` mal escrito |
| Revertir el commit anterior | `git revert`, cuando lo que se revierte ya tenía su spec |
| Un bump de versión de una dependencia | `pnpm up`, sin cambio de API |
| Terminar la tarea abierta de un spec **ya publicado** | marcar un `tasks.md`, cerrar un issue |
| Lo que el usuario pida explícitamente sin spec | y entonces se dice en voz alta que se está salteando |

**Necesita spec** todo lo demás, y en particular:

- Un **bug**, aunque el arreglo sea una línea. El bug de la `Z` del spec 036 eran **dos líneas** de
  `pieces.constants.ts`, y el spec no sobró: destapó que faltaba un invariante, que el teselado de los
  tests nunca había sido un teselado de las 12 piezas, y que dos tests del MCP quedaban verdes sin
  ejercer nada. Nada de eso se ve mirando las dos líneas.
- Cualquier cosa que toque `src/domain/`, `src/audio/` o el modelo musical.
- Una feature, por chica que parezca.

**En la duda, spec.** Escribirlo cuesta una hora; descubrir tres semanas después por qué se hizo algo
cuesta más.

## Paso 0 — ¿de dónde viene esto?

**Antes de escribir una línea: ¿el pedido ya es un issue?** Desde el 042 la deuda vive en GitHub Issues
y los skills la abren solos, así que la respuesta es «sí» más seguido de lo que parece. Mirá:

```bash
node .claude/scripts/deuda.mjs   # los issues abiertos que ningún spec reclama
```

Si el pedido **es** uno de ésos, la pregunta siguiente decide el carril, y es una sola: **¿el arreglo
toca `src/`, `mcp-server/src/` o `docs/`?**

| El arreglo… | Qué hacer | Qué cierra el issue |
|---|---|---|
| **no** las toca | rama `fix/` o `chore/` y seguí derecho: **no necesita spec** | `Closes #N` en el cuerpo del PR |
| **sí** las toca | necesita spec, y su `spec.md` lleva `**Origen:** #N` en el encabezado | un `Closes` por **cada** issue saldado |

**Esa línea no es decorativa**: `publicar-spec.mjs crear` la parsea y escribe `origen` en la fila de
`specs/mapa.json`, y de ahí la lee el gate que pone en rojo un spec cerrado cuyo issue de deuda siguió
abierto. Sin el dato, nada puede exigir el `Closes` — medido: 4 de los 43 specs nombran un issue de
deuda en prosa y **tres de esos cuatro siguen abiertos**.

**`origen` es lo que el spec SALDA, no lo que menciona.** El 035 cita al #97 como contexto de una
medición que no arregla: eso no va. Con la lectura ancha el gate daría rojo sobre specs correctos y se
apagaría en una semana. Y va en el **encabezado**, antes del primer `##`: un `#127` suelto en la prosa
no cuenta.

La línea se puede agregar o corregir **después** de publicar el spec: `crear` reconcilia el `origen`
de cada fila en cada corrida, así que volver a correrlo alcanza. Y si te olvidás, un gate de
`specs/__tests__/mapa-de-specs.test.ts` compara la fila contra el `spec.md` hidratado y da rojo.

Si el pedido no viene de ningún issue, no hay línea que escribir y el campo no se pone —vacío no, que
`leerMapa` lo rechaza—. Seguí al paso 1.

## Los cinco pasos

### 1. Medir, y recién después escribir

El `research.md` **sale de correr algo**, no de suponer. Es la regla que `specs/README.md` ya declara,
con su evidencia: el spec 001 salió distinto de lo previsto porque correr el algoritmo sobre las 12
piezas × 4 rotaciones desmintió tres supuestos.

Para medir el dominio, **preguntale al dominio en vez de simularlo**: `check_invariants`,
`describe_piece`, `simulate_board`, `find_symbol`. Y para lo que no cubren, un script de un solo uso
que se corre y se borra — no se commitea.

Lo que la medición tiene que dejar por escrito:

- **Qué se rompe.** Corré la suite con el cambio mínimo aplicado y contá: cuántos tests, en qué
  archivos, en qué proyecto (`node`, `browser`, `mcp:test`). Un número acá es lo que hace estimable el
  spec.
- **Quién cita lo que va a cambiar.** `rg --no-ignore` para `specs/`, `find_symbol` para el código.
- **Qué NO se mueve.** Es tan informativo como lo que sí: si el proyecto `browser` no se mueve, el
  trabajo no está en los componentes.

### 2. Los cuatro archivos

`specs/<NNN>-<descripcion-kebab>/` con `spec.md`, `research.md`, `plan.md` y `tasks.md`. El formato de
tarea y las cuatro desviaciones están en [`specs/README.md`](../../../specs/README.md).

**El número se reserva tarde**: mirá `specs/mapa.json` recién cuando vayas a crear la carpeta. Si hay
otra sesión trabajando en paralelo, el número que elijas al empezar ya no es el que te toca.

Dos cosas que este repo pide y que no son obvias:

- **Cada AC tiene que ser falsificable.** «El gate funciona» no lo es; «con el dato viejo puesto a
  mano, el gate da rojo» sí. Si un AC no se puede ver fallar, no verifica nada.
- **Y cada tarea tiene que poder cerrarla un agente: no escribas tareas que pidan una persona.** Hasta
  el 038 se marcaban `[M]` —oído, navegador, captura— y quedaban fuera de `pendientes`. El 039 lo
  midió: de **137** casillas `[M]` repartidas en **35** specs, sólo **6** se cerraron alguna vez, así
  que el marcador no significaba «espera a una persona» sino «no se va a hacer nunca, pero queda
  escrito». La regla que lo reemplaza, y que te toca a vos que sos quien escribe el `tasks.md`:
  **volverla verificable —medirla en el DOM, un test con `OfflineAudioContext`, un valor que un gate
  pueda leer— o no anotarla en ningún lado.** Los specs anteriores al 039 conservan sus `[M]` y no se
  reescriben; los tuyos no llevan ninguno.
- **Los `X → Y` de `tasks.md` son la única fuente de las dependencias entre specs.** `spec_status` las
  lee de ahí en `cruces`. Escribí los números que la tarea mueve, no una prosa que los rodee.

### 3. Publicarlo como issue

```bash
node .claude/scripts/publicar-spec.mjs crear     # un issue por spec, y le escribe su fila en mapa.json
node .claude/scripts/publicar-spec.mjs publicar  # sube spec.md al body y el resto como comentarios
```

Son dos fases porque los specs se citan entre sí y traducir una cita a la URL de su issue necesita que
ese issue ya exista. Las dos son idempotentes: se pueden correr de nuevo.

**`gh` no está en el PATH** en esta máquina. Antes de correrlo:
`export PATH="$PATH:/c/Program Files/GitHub CLI"`.

**El veredicto sale del exit code, nunca de un grep de la salida.** Un `| grep` que no matchea devuelve
1 y se traga la salida entera: es cómo este repo declaró un `verify` verde con el lint roto.

### 4. Commit del mapa

```bash
git add specs/mapa.json                                  # lo ÚNICO del spec que se trackea
git commit && git push origin staging
```

El spec entra a `staging` y ahí termina: un spec abandonado no se va con ninguna rama, y por eso el 001
(`Descartado`) y el 004 (`Superado`) siguen en el registro.

### 5. Entregarle el control a `/spec-implement`

Con el issue publicado y el mapa en `main`, el trabajo de este skill terminó.

**La rama NO se crea acá.** Escribir un spec y decidir implementarlo son dos decisiones distintas, y
entre una y otra puede pasar cualquier cosa: que se revise y cambie, que se descarte, que lo tome otra
sesión, que espere a que aterrice el spec del que depende. Una rama abierta en el paso 4 es una rama
que existe antes de que exista el trabajo, y que va a quedar colgada cada vez que esas dos decisiones
no sean la misma.

La crea el implementador, como primer movimiento y en su propio worktree si hay más de un carril. El
nombre no es decorativo —**es de donde el gate del 037 saca el número del spec**, y también
`/pr-review-batch`— así que es `feature/<NNN>-<descripcion-kebab>` y sale del `NNN` del mapa.

## Al cerrar

No es parte de abrir un spec, pero es la otra mitad y se saltea igual de fácil:

1. `spec_status` con el número del spec. **`pendientes` tiene que dar 0** — lo único que descuenta
   son las `[M]` de los specs anteriores al 039. En un spec tuyo no va a haber ninguna: no se
   escriben más (ver arriba), y desde el spec 042 tampoco hay un `## Seguimiento` donde anotar lo
   que quedó. Así que acá `pendientes: 0` quiere decir que se cerró **todo**, sin excepciones que
   valga la pena explicar.
2. **Un `Closes` por cada issue saldado**, y son el del spec **más los del `origen`**. El del spec se
   cierra solo —medido, un segundo después del merge— y el `estado` de `specs/mapa.json` lo deriva
   `mapa.yml` en el push a `staging` (spec 043). **No lo edites a mano en el PR**: mientras ese PR está
   abierto el mapa tiene que decir `Propuesto`, y el gate del 038 da rojo si dice otra cosa.

   El plural llegó con el 044 y es la mitad que faltaba. Decía `Closes #N` en singular, y ese `N` era
   justo el único que ya se cerraba solo: el issue del propio spec. El de deuda que lo parió no lo
   cerraba nadie, así que quedaban **dos issues por el mismo trabajo** y uno abierto para siempre. El
   `origen` de la fila es lo que ahora lo pone en rojo — pero **ese rojo no llega en tu PR, y tampoco
   al mergear**: mientras el PR está abierto el mapa dice `Propuesto` y el gate no mira los que siguen
   en vuelo, y el push a `staging` corre `verify` con el token vacío, así que el bloque de red se saltea
   entero. El primero que lo ve es **el PR siguiente, que es de otra persona** — y esa persona no
   puede arreglarlo, porque el `Closes` que falta va en un PR que ya está mergeado. Por eso la línea
   se escribe antes, y no después.
3. Lo que salió distinto de lo previsto, **como comentario en el issue**.

El paso 1 se saltea solo: el spec 035 se mergeó y su registro siguió diciendo `Propuesto` veinte horas,
con el gate en verde. El [spec 038](https://github.com/federicohermo/pentomino-games/issues/105) le
pone el gate.

## Si el gate te frenó

El hook de `PreToolUse` bloquea editar `src/`, `mcp-server/src/` y `docs/` desde `main` o desde una rama
sin spec. Si saltó, no lo saltees, y son tres casos distintos: o estás en el caso «no necesita spec»
—y entonces la rama igual no puede ser `main`—, o te falta el paso 3, o el spec ya está publicado y lo
que falta es **la rama**, que desde ahora la abre el implementador y no este skill.

`.claude/` y `specs/` **no** están protegidos, a propósito: son adonde este skill te manda a escribir
primero.

# Spec 033 — El archivo deja de ser la interfaz

> Sin ticket: este repo no tiene tablero de Jira. Ver [`specs/README.md`](../README.md).
>
> **No cambia una nota, ni un píxel, ni una línea de `src/`.**
>
> Es el spec que hace **posible** sacar `specs/` del repositorio, y deliberadamente **no lo saca**.
> Lo que hace es terminar la indirección que el repo ya tiene a medio construir: `spec_status`.
>
> **El hallazgo que le da forma:** de las **237 líneas** de `mcp-server/src/specs.ts`, **6 hacen
> I/O**. `parseLog` y `parseTasks` ya están exportadas y son **puras** —toman un `string` y devuelven
> una estructura—, así que cambiar el backend de archivo a issue **no toca el parser**: cambia de
> dónde sale el string, y eso es *una* función. Lo que bloquea la mudanza no es el server: son las
> cinco skills que abren el archivo por su cuenta.

## Problema

`tasks.md` no es un archivo que se lee: es una **interfaz**, y hoy **cinco skills la implementan a
mano** abriendo el archivo. Dos de ellas corren cada agente en su propio **worktree**, y
`git worktree add` hace checkout de lo **trackeado**: un archivo ignorado no viaja.

O sea que poner `specs/` en `.gitignore` hoy rompe `/pr-review-batch` y `/spec-implement-batch`
**en silencio** — el agente no encuentra el archivo, no falla, y sigue. Es la familia «fallar en
verde» que este repo ya se comió con el `--filter "{.}"` y con el `$` del regex de `verify`.

Medido sobre `.claude/skills/`, clasificando cada mención por **operación** y no por archivo:

| operación | quién | ¿worktree? | ¿la cubre `spec_status`? |
|---|---|---|---|
| Escribir `T0NN` en `## Seguimiento` | `pr-review-batch` (×5), `spec-implement-batch`, `spec-review-batch` (×3) | **sí** (las dos primeras) | **no** — la tool es de solo lectura |
| Marcar una tarea `[x]` | `spec-implement` | **sí** | **no** |
| Leer la **cita de línea** de cada tarea | `spec-implement-batch` | **sí** | **no** |
| Leer los cruces `X → Y` entre specs | `spec-implement-batch`, `spec-review-batch` | no | **no** |
| Estado, hechas/total, `pendientes`, próxima | `spec-review`, `spec-implement-batch`, `pr-review-batch` | — | **sí, y ya la usan** |

Las tres últimas filas son la buena noticia y la mala junta: la indirección **existe y funciona** —tres
skills ya prefieren la tool al archivo, y `spec-review/SKILL.md:83` lo dice como regla— pero le faltan
dos lecturas y **toda** la escritura.

## Solución

Completar `spec_status` hasta que ninguna skill necesite abrir el archivo, y recién entonces el
backend puede cambiar de fuente. Este spec hace lo primero. Lo segundo es el spec siguiente.

El corte no es por prolijidad: **lo primero vale por sí solo aunque la mudanza nunca ocurra.** Hoy
cinco skills reimplementan a mano el parseo de un formato que `parseTasks` ya sabe leer, y cada una
puede leerlo distinto sin que nada falle.

### Y el formato NO cambia

`- [ ] T012 [P] [M] texto` se queda exactamente como está, y eso es una decisión y no inercia: es lo
que **GitHub renderiza como task list nativa**, con barra de progreso. El día del cambio de backend,
el body del issue **es** el `tasks.md`, y `parseTasks` lo lee sin tocar una línea.

Medido: el `tasks.md` más grande del repo son **41.051 bytes** contra los **65.536** del body de un
issue. Entra al **63 %** — con margen, pero no de sobra, y los `tasks.md` crecen. Está anotado como
riesgo en [`research.md`](./research.md) §4.

## Criterios de aceptación

**AC1.** `spec_status` devuelve, por tarea, los **archivos que la tarea nombra entre backticks** con
su línea cuando la trae. Es lo que `spec-implement-batch` hoy saca leyendo el archivo
(`SKILL.md:47`, «leé la tarea y su cita de línea»).

**AC2.** `spec_status` devuelve los **cruces `X → Y`** de cada `tasks.md`. Es lo que
`spec-implement-batch/calibracion.md:45` y `spec-review-batch/SKILL.md:103` hoy grepean, y es la
arista que —dice el propio texto— «ningún import delata».

**AC3.** Existe una tool de **escritura**, con exactamente dos operaciones y ninguna más:
`marcar` (una tarea pasa a `[x]`) y `seguimiento` (agrega un `T0NN` al `## Seguimiento` de un spec).
Los IDs son **estables**: `seguimiento` sigue contando y nunca reusa uno libre.

**AC4.** Ningún `.md` de las cinco skills nombra `tasks.md` ni `plan.md` **como ruta a abrir o
escribir**. Verificable: las menciones que quedan son prosa —el contrato de formato, los ejemplos— y
no operaciones de archivo.

Los dos `scripts/*.sh` —`spec-review-batch/scripts/lote.sh` y
`spec-implement-batch/scripts/matriz.sh`— quedan **afuera del AC**, y el motivo no es que se hayan
pasado por alto: son **bash**, y bash no puede llamar una tool MCP. La indirección no los alcanza
mientras la matriz se inyecte con `` !`...` `` al cargar el skill, así que migrarlos no es reescribir
un `grep` sino mover el bloque del script al skill, que es un cambio de forma y va en su propio spec.
El precio queda escrito en el **T044** y hay que decirlo: con `specs/` en el `.gitignore` (T040) los
dos leen un directorio vacío y **no fallan** — el mismo «fallar en verde» que este spec vino a
cerrar, corrido de lugar. Lo que sí se cerró es el tercer bloque de `lote.sh`, los `X → Y`: la tool
ya los devuelve en `cruces`, así que era además una segunda fuente del mismo dato con otro regex.

**AC5.** `parseTasks` y `parseLog` **no cambian de firma**. Siguen tomando un `string`. Es lo que
mantiene barato el spec siguiente.

**AC6.** `readSpecStatus` sigue siendo el **único** punto de I/O del módulo, y su firma admite otra
fuente sin reescribir a sus llamadores.

**AC7.** `mcp:test` sigue en **100** en las cuatro métricas, y las tools nuevas entran con sus tests.

**AC8.** `pnpm verify` en verde, y **no se toca un archivo de `src/`**.

## Decisiones

**D1. La escritura de seguimiento va al registro central, no al PR.**
Hoy `/pr-review-batch` escribe el `## Seguimiento` **adentro del worktree**, así que el hallazgo viaja
en el PR; su argumento escrito es «libre de conflicto por construcción — un `tasks.md` por PR». Con
una tool, la escritura cae en el registro central y **deja de viajar en el PR**.

Se elige el registro central por dos razones: es adonde va a estar el día del backend de issues —un
comentario de issue es central por naturaleza— y el argumento de «libre de conflicto» **deja de hacer
falta** cuando no hay archivo que mergear. El precio es real y se anota: el reviewer ya no ve el
seguimiento en el diff del PR.

**D2. No entran sub-issues.** Un spec promedio tiene ~50 tareas y hay 32 specs: son **1.601**
sub-issues. El tracker se vuelve el ruido que la mudanza quería evitar. Las tareas viven en el body,
como task list.

**D3. Este spec no toca `.gitignore` ni crea un issue por spec.** Es el spec siguiente, y separarlo
es lo que permite revertir uno sin el otro.

## Fuera de alcance

- Mover `spec.md` y `research.md`. Otra decisión, y más cara: los cita `docs/`.
- El mapa spec↔issue. Es del spec siguiente, y es su parte difícil: issues y PRs comparten contador
  y este repo ya va por **#58**, así que el spec 014 no puede ser el issue #14.
- Tocar los specs mergeados. La Desviación 2 lo prohíbe y no hace falta: el formato no cambia.

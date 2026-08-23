# Research — Spec 033

Todo lo de acá está **medido sobre el repo**, no supuesto. Fecha: 2026-08-23.

## 1. El server ya está casi listo, y eso es el hallazgo

`mcp-server/src/specs.ts` son **237 líneas**. Las que tocan el filesystem:

```
1    import { readdirSync, readFileSync, existsSync } from 'node:fs';
177    return readdirSync(specsDir, { withFileTypes: true })
191    const logPath = join(specsDir, 'log.md');
192    const log = existsSync(logPath) ? parseLog(readFileSync(logPath, 'utf8')) : [];
200      const tasksPath = join(specsDir, dir, 'tasks.md');
202      if (existsSync(tasksPath)) tareas = parseTasks(readFileSync(tasksPath, 'utf8'));
```

**Seis líneas, todas dentro de `readSpecStatus`.** Los dos parsers exportados son puros:

| símbolo | firma | ¿toca el disco? |
|---|---|---|
| `parseLog` | `(md: string) => LogRow[]` | no |
| `parseTasks` | `(md: string) => TasksInfo` | no |
| `readSpecStatus` | `(specsDir: string) => {...}` | **sí, y es el único** |

O sea que el spec siguiente —cambiar la fuente de archivo a issue— es **una función**, no un
refactor. Lo que lo bloquea está afuera del server.

## 2. La superficie real de las skills

Grep de `tasks.md|plan.md` sobre `.claude/skills/*/*.md`: **22 menciones en 8 archivos**.
Clasificadas por operación —que es lo que importa, no el conteo—:

| # | archivo:línea | operación |
|---|---|---|
| 1 | `pr-review-batch/SKILL.md:34` | **escribe** el `## Seguimiento` |
| 2 | `pr-review-batch/SKILL.md:101-103` | **escribe**, con la regla de a cuál |
| 3 | `pr-review-batch/SKILL.md:206` | **escribe** el `T0NN` con su motivo |
| 4 | `pr-review-batch/hallazgos.md:126` | **escribe** |
| 5 | `spec-implement-batch/SKILL.md:99` | **escribe** la decisión que le falta al spec |
| 6 | `spec-review-batch/cruces.md:8`, `SKILL.md:45,187` | **escribe** el hallazgo |
| 7 | `spec-implement/SKILL.md:19,29` | **escribe** (`[x]`) y lee el `[P]` |
| 8 | `spec-implement-batch/SKILL.md:47` | **lee** la cita de línea |
| 9 | `spec-implement-batch/calibracion.md:21,45` | **lee** los `X → Y` |
| 10 | `spec-review-batch/SKILL.md:103`, `cruces.md:45` | **lee** los `X → Y` |
| 11 | `pr-review-batch/SKILL.md:32` | lee los AC — de `spec.md`, que **se queda** |
| 12 | `spec-review/SKILL.md:37,39` | prosa: el **contrato de formato** |

De las doce, **siete son escritura**, tres son lectura que la tool no cubre, una es de `spec.md` y una
es prosa. Las de prosa y las de `spec.md` **no se tocan**.

### Las que ya pasan por la tool

Tres, y una lo dice como regla — `spec-review/SKILL.md:83`:

> | Leer `log.md` y los once `tasks.md` para saber en qué quedó cada spec | `spec_status` — devuelve estado, hechas/total, y `pendientes` |

La indirección no hay que inventarla: hay que terminarla.

## 3. Los worktrees son el bloqueo, y es verificable

`CLAUDE.md` y las dos SKILL lo declaran: `/pr-review-batch` corre «un agente por PR en su worktree» y
`/spec-implement-batch` «reparte el lote en carriles — uno por cadena de dependencias, cada uno en su
worktree».

`git worktree add` hace checkout de lo **trackeado**. Un archivo en `.gitignore` no viaja. El repo ya
depende de eso a propósito para otra cosa: `.gitignore` tiene `.claude/worktrees/` con el comentario
de por qué.

Consecuencia medida sobre el texto de las skills: con `specs/` ignorado, el **paso 4** de
`pr-review-batch` («leé los AC del spec del PR, `specs/NNN-*/spec.md`») lee un directorio vacío. No
falla: revisa sin criterios de aceptación.

## 4. El formato entra en un issue, pero sin margen de sobra

`- [ ] T012 [P] [M] texto` es **exactamente** el formato de task list de GitHub. Renderiza con barra
de progreso y no hay que traducir nada.

| | bytes |
|---|---|
| `021/tasks.md` (el mayor) | **41.051** |
| `022/tasks.md` | 27.771 |
| `020/tasks.md` | 27.195 |
| **límite del body de un issue** | **65.536** |

El mayor entra al **63 %**. Es margen suficiente hoy y **no** es holgado: el 021 creció a 41 KB
siendo un spec de layout. Un spec con más tareas o más prosa por tarea lo pasa. Queda como riesgo
declarado del spec siguiente, con dos salidas conocidas: partir el `## Seguimiento` a un comentario,
o mover la prosa larga al `spec.md`.

## 5. Lo que el conteo de tareas dice hoy

1.601 tareas parseadas en 32 specs — **50 por spec** de promedio. Es el número que descarta los
sub-issues (D2): 1.601 sub-issues es más ruido del que la mudanza saca.

## 6. Un supuesto que se cayó midiendo

Se entró a este spec creyendo que había **245 casillas huérfanas** en specs cerrados y que había que
purgarlas. Es falso, y lo desmiente el propio `parseTasks` (`specs.ts:110`): `pendientes` **excluye**
las de `## Seguimiento`, las `[M]` y las de specs terminales.

Medido sobre las 282 casillas abiertas de hoy:

| clase | cuántas |
|---|---|
| `[M]` — verificación humana | 120 |
| `## Seguimiento` — notas | 86 |
| spec 001, que está `Descartado` | 33 |
| proceso | 6 |
| **pendientes de verdad en specs cerrados** | **2** |

O sea que **no hay basura que purgar**: la tool ya lee bien y `specs/README.md` ya lo documenta
(«`[M]` es la parte que hace legible el estado»). Se anota porque cambia el alcance de este spec —no
hay pase de limpieza— y porque es el ejemplo exacto de lo que el spec propone: **la ambigüedad la
resuelve el lector, y por eso el lector tiene que ser uno solo.**

## 7. Riesgos

| riesgo | mitigación |
|---|---|
| D1 saca el seguimiento del diff del PR | El precio está escrito en el spec. Si molesta, la tool puede además dejar un comentario en el PR |
| Las tools nuevas bajan el coverage del server | AC7 lo prohíbe: entran con sus tests |
| Una skill queda a medio migrar y lee el archivo igual | AC4 se verifica leyendo las cinco, no grepeando: la mención de prosa es legítima y el grep no las distingue |
| El spec siguiente necesita red y `mcp:test` corre offline | No es de este spec. Se anota para que su research arranque de acá: hoy `specs.test.ts` fabrica sus directorios, así que el patrón de fixture ya existe |

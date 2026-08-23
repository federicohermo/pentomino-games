# Plan — Spec 033

Cuatro pasos. El orden importa: las tools primero, las skills después, porque una skill migrada
contra una tool que no existe no se puede probar.

## Paso 1 — `spec_status` gana las dos lecturas que le faltan (AC1, AC2)

`parseTasks` ya recorre cada línea de tarea y ya tiene el texto separado del ID y de los marcadores.
Las dos lecturas salen de ese mismo recorrido, así que **no hay una segunda pasada**:

- **Las citas** (AC1) son los backticks del texto de la tarea. `calibracion.md:21` avisa del falso
  positivo a evitar: un `tasks.md` nombra archivos entre backticks **también** cuando la tarea es
  actualizar un doc que los menciona. La cita se devuelve como dato, no como verdad — quien decide
  sigue siendo la skill.
- **Los cruces** (AC2) son los pares `X → Y`. Medido: el patrón aparece en los `tasks.md` como
  `002 → 43`, o sea números sueltos y no siempre entre backticks, así que el regex se fija contra
  los casos reales del repo y no contra el ideal.

`TasksInfo` gana dos campos. `parseTasks` **no cambia de firma** (AC5): sigue siendo
`(md: string) => TasksInfo`.

**Verificación:** los tests de `specs.test.ts` fabrican sus propios directorios, así que los casos
nuevos entran ahí sin tocar `specs/` de verdad.

## Paso 2 — La tool de escritura (AC3)

Una tool, dos operaciones, y ninguna más:

| operación | qué hace | quién la va a usar |
|---|---|---|
| `marcar` | una tarea pasa de `- [ ]` a `- [x]` | `spec-implement` |
| `seguimiento` | agrega un `T0NN` al `## Seguimiento (no bloquea)` | `pr-review-batch`, `spec-implement-batch`, `spec-review-batch` |

Dos reglas que no son opcionales:

- **Los IDs son estables** (`specs/README.md`): `seguimiento` sigue contando desde el mayor y **nunca
  reusa** un ID libre. Un ID reusado rompe la referencia que otra tarea le hacía.
- **`marcar` no inventa**: si la tarea no existe o ya está marcada, lo dice. Marcar algo que no se
  hizo es exactamente lo que este repo acaba de arreglar en `log.md`.

**La escritura va al registro central y no al worktree** (D1). El precio —el seguimiento deja de
viajar en el diff del PR— está escrito en el spec.

## Paso 3 — Las cinco skills dejan de abrir el archivo (AC4)

Una por una, y en este orden, que es de menos a más superficie:

1. `spec-implement` — sólo marca. Es la más chica y valida la tool de escritura.
2. `spec-implement-batch` — marca, escribe decisiones, y lee citas y cruces. Es la que ejercita las
   cuatro cosas nuevas a la vez.
3. `pr-review-batch` — cinco escrituras de seguimiento. Es la que paga D1.
4. `spec-review-batch` — tres escrituras y una lectura de cruces.
5. `spec-review` — su tabla de la línea 24 ya nombra a `spec_status`; queda alinear el resto.

**Lo que NO se toca:** `spec-review/SKILL.md:37-39` (el contrato de formato) y
`pr-review-batch/SKILL.md:32` (los AC salen de `spec.md`). Son prosa y siguen siendo ciertas.

## Paso 4 — Verificación y cierre

`pnpm verify` entero. `mcp:test` en 100 con las tools nuevas cubiertas (AC7). Y una corrida real de
`/spec-implement` sobre este mismo spec, que es el primer consumidor de la tool que acaba de escribir.

## Lo que este plan deliberadamente no hace

No toca `.gitignore`, no crea un issue por spec, no escribe el mapa spec↔issue. Todo eso es el spec
siguiente, y separarlo es lo que permite revertir uno sin el otro — que es la misma razón por la que
en este repo los borrados van en su propio commit.

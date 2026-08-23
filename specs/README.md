# Specs

Trabajo planificado. Un spec por unidad de trabajo, en su propia carpeta numerada.

> **El registro vive en [log.md](./log.md)** y el porqué de cada decisión en
> [revisiones.md](./revisiones.md). **La deuda sin spec vive en
> [GitHub Issues](https://github.com/federicohermo/pentomino-games/issues)**, no en un archivo de acá.
> Este archivo documenta solo la convención.

La convención es la de [Spec Kit](https://github.com/github/spec-kit) con tres desviaciones
deliberadas, anotadas abajo donde corresponde. Las coincidencias no son casualidad: la carpeta
numerada, los tres documentos y el `tasks.md` derivado del plan salen de ahí.

## Convención de nombres

```text
specs/<NNN>-<descripcion-kebab>/
├── spec.md       ← problema, solución propuesta, criterios de aceptación y límites de alcance
├── research.md   ← estado del código relevante, archivos afectados y riesgos
├── plan.md       ← pasos de implementación y verificación
└── tasks.md      ← checklist de implementación, verificación y PR
```

- `NNN` — número secuencial de tres dígitos (001, 002, …).
- **Los cuatro archivos son el piso, no el techo.** Un spec puede agregar los que necesite —el 008
  tiene un `baseline.md` con la medición previa— y Spec Kit prevé lo mismo (`data-model.md`,
  `contracts/`, `quickstart.md`). Los tres de Spec Kit que este repo no genera son de API y de schema,
  y acá no hay ni una ni la otra.
- El spec se commitea a `main` **antes** de crear la rama de feature.

> **Desviación 1.** Spec Kit crea la rama primero y le da su nombre a la carpeta. Acá el spec entra a
> `main` antes, así que un spec abandonado no se va con su rama: el 001 (`Descartado`) y el 004
> (`Superado`) siguen en el registro.

> **Desviación 2.** Un spec mergeado **no se reescribe**. Spec Kit los trata como documentación viva
> que se regenera con el código; acá son ADR: registro de qué se decidió y con qué evidencia, con
> fecha. Lo que sí se mantiene al día es `docs/`, `.claude/rules/` y `CLAUDE.md`.

> **Desviación 3.** Este repo no tiene tablero de Jira, así que el segmento de ticket de la convención
> original (`specs/<NNN>-<TICKET>-<descripcion>/`) se omite siempre.

> **Desviación 4.** Desde el spec 032 los `.md` entran a `pnpm lint`, y los specs lo hacen **en su
> propio carril**: se apaga el preset entero y se reenciende, por nombre, sólo lo que caza un error de
> **renderizado** — una tabla que descarta celdas, un encabezado que no renderiza, un enlace dado
> vuelta. Ninguna regla de estilo.
>
> Se lee junto con la Desviación 2 y sale de ella. El preset completo sobre `specs/` da **483**
> hallazgos, y aplicarlo obligaría a reescribir 29 specs cerrados para satisfacer una regla de
> estilo, que es exactamente lo que la Desviación 2 prohíbe. Un error de renderizado es otra cosa: no
> reescribe una decisión, **destapa contenido que GitHub hoy esconde**. Con el carril puesto, el costo
> medido fue **1 hallazgo**, y era un bug real —`027/research.md:112` perdía una celda de tabla por
> dos barras sin escapar—.
>
> El carril **reenciende por nombre y no excluye por nombre**, por el mismo motivo que
> `REGLAS_DEL_REPO` en `eslint.config.js`: en flat config un override *reemplaza*, así que una lista
> por exclusión dejaría entrar sola cualquier regla que el preset agregue más adelante — y eso sería
> `pnpm lint` en rojo sobre specs que no se pueden tocar.
>
> Los tres registros de acá —este `README.md`, `log.md` y `revisiones.md`— **no** están en ese carril:
> son documentación viva y se mantienen al día, así que van con el preset completo.

## Formato de una tarea

```markdown
- [ ] T012 [P] [M] Descripción, con la ruta del archivo que toca
```

| Parte | Qué dice | Obligatorio |
|---|---|---|
| `T012` | ID estable dentro del spec, para que una tarea pueda nombrar a otra | En specs nuevos |
| `[P]` | Se puede hacer en paralelo con las otras `[P]` de su bloque: no comparten archivo ni dependen entre sí | No |
| `[M]` | Pide una persona — navegador, oído, captura. No bloquea el cierre del spec | No |

Los IDs son **estables**: no se renumeran al insertar una tarea nueva, se sigue contando. Un ID
libre no molesta a nadie; uno reusado rompe la referencia que otra tarea le hacía.

**`[M]` es la parte que hace legible el estado.** Sin él, un spec `Implementado` con casillas abiertas
es ambiguo: no se distingue "falta trabajo" de "quedó una verificación a oído que ya nadie va a hacer".
Con él, `spec_status` reporta `pendientes: 0` y el spec se lee cerrado. Los diez specs anteriores a
esta convención no llevan ID —no se reescriben, por la desviación 2— pero sí se les marcó `[M]` lo que
correspondía, porque eso no reescribe la historia: la aclara.

**`[P]` es lo que `spec-implement` hoy deriva solo.** Declararlo al escribir el spec, que es cuando se
conocen las dependencias reales, sale más barato y más confiable que inferirlo en cada corrida.

Las tareas de `## Seguimiento (no bloquea)` son deuda anotada a propósito y tampoco cuentan como
pendientes. Es un eje distinto de `[M]`: `Seguimiento` es *dónde* está anotada la tarea, `[M]` es
*quién* la puede hacer. Una tarea puede ser las dos cosas.

## Flujo

1. Escribir los cuatro archivos. El `research.md` se escribe **midiendo, no suponiendo**.
2. Commitear el spec a `main` y agregar su fila a [log.md](./log.md) con estado `Propuesto`.
3. Crear la rama `feature/<NNN>-<descripcion-kebab>`.
4. Implementar, marcando `tasks.md` a medida que se avanza.
5. Al mergear, actualizar el estado en [log.md](./log.md), y anotar en
   [revisiones.md](./revisiones.md) qué se aprendió si el spec salió distinto de lo previsto.

`spec_status` (MCP) responde el estado de los once specs en una llamada, en vez de abrir `log.md` y
once `tasks.md`.

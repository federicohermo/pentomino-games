# Specs

Trabajo planificado y deuda técnica documentada. Un spec por unidad de trabajo, en su propia carpeta
numerada.

> **El registro de specs vive en [log.md](./log.md)**, no acá. Este archivo documenta solo la
> convención.

## Convención de nombres

```
specs/<NNN>-<descripcion-kebab>/
├── spec.md       ← problema, solución propuesta, criterios de aceptación y límites de alcance
├── research.md   ← estado del código relevante, archivos afectados y riesgos
├── plan.md       ← pasos de implementación y verificación
└── tasks.md      ← checklist de implementación, verificación y PR
```

- `NNN` — número secuencial de tres dígitos (001, 002, …).
- **Los cuatro archivos** (`spec` · `research` · `plan` · `tasks`) son el formato vigente. El spec se
  commitea a `main` **antes** de crear la rama de feature.

> Este repo no tiene tablero de Jira, así que el segmento de ticket que usa la convención original
> (`specs/<NNN>-<TICKET>-<descripcion>/`) se omite siempre.

## Flujo

1. Escribir los cuatro archivos. El `research.md` se escribe **midiendo, no suponiendo**.
2. Commitear el spec a `main` y agregar su fila a [log.md](./log.md) con estado `Propuesto`.
3. Crear la rama `feature/<NNN>-<descripcion-kebab>`.
4. Implementar, marcando `tasks.md` a medida que se avanza.
5. Al mergear, actualizar el estado en [log.md](./log.md).

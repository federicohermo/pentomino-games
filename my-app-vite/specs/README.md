# Specs

Trabajo planificado y deuda técnica documentada. Un spec por unidad de trabajo, en su propia carpeta
numerada.

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

## Índice

| Spec | Descripción |
|------|-------------|
| [001](./001-notas-por-celda-en-orden-angular/spec.md) | Asignar cada nota a una celda de la pieza, en orden angular alrededor del centroide |
| [002](./002-motor-de-audio-propio-sobre-web-audio/spec.md) | Reemplazar Tone.js por un motor propio sobre Web Audio: síntesis, scheduler con lookahead y audio testeable |

> Los specs 001 y 002 son **ortogonales**: uno decide qué nota va en qué celda, el otro cómo se produce
> el sonido. Se pueden implementar en cualquier orden. Ambos comparten el mismo prerrequisito de montar
> Vitest.

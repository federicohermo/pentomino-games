# Log de Specs

Registro de todo el trabajo especificado, en orden. La convención de formato está en
[README.md](./README.md).

**Estados:** `Propuesto` (spec escrito, sin implementar) · `En curso` (rama abierta) ·
`Implementado` (mergeado) · `Descartado` (con el motivo anotado).

| Spec | Fecha | Estado | Descripción |
|------|-------|--------|-------------|
| [001](./001-notas-por-celda-en-orden-angular/spec.md) | 2026-08-02 | Propuesto | Asignar cada nota a una celda de la pieza, en orden angular alrededor del centroide |
| [002](./002-motor-de-audio-propio-sobre-web-audio/spec.md) | 2026-08-02 | Propuesto | Reemplazar Tone.js por un motor propio sobre Web Audio: síntesis, scheduler con lookahead y audio testeable |

## Dependencias entre specs

- **001 y 002 son ortogonales.** Uno decide qué nota va en qué celda; el otro, cómo se produce el
  sonido. Se pueden implementar en cualquier orden.
- **Ambos comparten un prerrequisito**: montar Vitest, que hoy no existe en el proyecto. El que se
  implemente primero lo deja resuelto para el otro.
- **002 tiene un gate que puede matarlo**: si no se consigue `OfflineAudioContext` corriendo en el
  runner de tests, el spec se replantea en vez de implementarse. Ver su `plan.md` §1.

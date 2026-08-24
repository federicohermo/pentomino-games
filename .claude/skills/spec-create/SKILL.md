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

### 4. Commit del mapa, y recién ahí la rama

```bash
git add specs/mapa.json                                  # lo ÚNICO del spec que se trackea
git commit && git push origin main
git checkout -b feature/<NNN>-<descripcion-kebab>
```

En ese orden. El spec entra a `main` **antes** que la rama para que un spec abandonado no se vaya con
ella — el 001 (`Descartado`) y el 004 (`Superado`) siguen en el registro.

El nombre de la rama no es decorativo: **es de donde el gate saca el número del spec**, y también
`/pr-review-batch`.

### 5. Entregarle el control a `/spec-implement`

Con el issue publicado y la rama creada, el trabajo de este skill terminó.

## Al cerrar

No es parte de abrir un spec, pero es la otra mitad y se saltea igual de fácil:

1. `spec_status` con el número del spec. **`pendientes` tiene que dar 0** — descuenta las de
   `## Seguimiento` y las `[M]`, que no bloquean.
2. `estado` a `Implementado` en `specs/mapa.json`, y `Closes #N` en el PR.
3. Lo que salió distinto de lo previsto, **como comentario en el issue**.

El paso 1 se saltea solo: el spec 035 se mergeó y su registro siguió diciendo `Propuesto` veinte horas,
con el gate en verde. El [spec 038](https://github.com/federicohermo/pentomino-games/issues/105) le
pone el gate.

## Si el gate te frenó

El hook de `PreToolUse` bloquea editar `src/`, `mcp-server/src/` y `docs/` desde `main` o desde una rama
sin spec. Si saltó, no lo saltees: o estás en el caso «no necesita spec» —y entonces la rama igual no
puede ser `main`— o te falta el paso 3.

`.claude/` y `specs/` **no** están protegidos, a propósito: son adonde este skill te manda a escribir
primero.

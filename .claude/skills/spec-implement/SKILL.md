---
name: spec-implement
description: Especialización de /spec-implement para pentomino-games: el paralelismo viene declarado por tarea con [P], y [M] marca lo que ningún agente cierra. Se lee junto con el skill global.
---

# spec-implement — pentomino-games

Este archivo **no reemplaza** al skill global: aporta lo que en este repo es distinto. El fake-edge
test, las reglas de andamiaje y la convergencia salen de allá.

> **Y por eso no lleva `context: fork`.** Un skill forkeado convierte su contenido en el prompt de un
> subagente **sin acceso al historial de la conversación**, y este archivo no es una tarea: es la
> mitad de una, que sólo tiene sentido leída encima del skill global ya cargado. Forkearlo haría que
> el subagente arranque con las excepciones del repo y sin el método al que corrigen.

## El paralelismo viene declarado — no lo derives de cero

El global construye el grafo con un nodo por encabezado y advierte que *"un grafo adivinado abanica
trabajo que se pisa"*. En este repo, desde el spec 011, la declaración viene por tarea
([`specs/README.md`](../../../specs/README.md#formato-de-una-tarea)):

```markdown
- [ ] T012 [P] [M] Descripción, con la ruta del archivo que toca
```

- **`[P]`** — no depende de las otras `[P]` de su bloque ni comparte archivo con ellas. Lo escribió
  quien conocía las dependencias reales, al escribir el spec.
- **`[M]`** — pide una persona: oído, navegador, captura. **Ningún agente la puede cerrar.** No la
  metas en el grafo y no la pases por `spec_write`: queda abierta a propósito y `spec_status` ya la
  descuenta.
- **`T0NN`** — ID estable. Usalo para nombrar nodos y aristas en el `--dry`, que es lo que hace
  revisable el grafo antes de lanzar nada. Es también la dirección con la que se marca: `spec_write`
  toma el ID, no un número de línea.

**La declaración se lee con `spec_status`, no abriendo el archivo.** Con el argumento `spec` la
respuesta se acota a ese spec y suma `citas`: por tarea, los archivos que nombra entre backticks, con
su línea. Eso es la materia prima del fake-edge test ya parseada, y acotada pesa una fracción del
registro entero — **cuánto exactamente lo dice la nota** que trae la respuesta sin `spec`, medida
sobre esa misma consulta. `cruces` da los pares `X → Y` que la
tarea declara **en su propia línea**, no en su prosa de abajo —`de` y `a` son
string, que en este repo hay un `4,0 → 11,8`— y `proximaId` dice cuál falta de verdad, con
`Seguimiento`, `[M]` y los specs terminales ya descontados.

**Seguí usando el fake-edge test sobre los `[P]` declarados, no en su lugar.** Un `[P]` mal puesto es
un conflicto de escritura que aparece recién al implementar; si el test contradice a la declaración,
gana el test y **decilo** — es un hallazgo sobre el spec, no un detalle.

Los specs 001–010 son anteriores a la convención y no llevan marcadores: ahí el grafo se deriva como
dice el global. No los reescribas para agregárselos.

## Antes de arrancar

- **`check_invariants` en proceso fresco**, antes y después. El MCP de la sesión cachea los módulos y
  contesta con el código viejo — está pisado como tarea en varios specs porque ya pasó.
- **`pnpm verify` es el nodo de convergencia**, no `pnpm test`. Corre lint ‖ typecheck ‖ suite ‖
  mcp:test en paralelo y es lo único que typechequea cruzando el borde de paquete hacia
  `mcp-server/`, que importa 31 símbolos del dominio. `suite` son las dos pasadas de vitest —la
  limpia y la de coverage, con umbral 100— encadenadas a propósito (spec 029).
- **El gestor es pnpm.** Nunca `npm install`: deja un `package-lock.json` que Netlify puede preferir.

## Al cerrar

- **Marcar es `spec_write` con `op: "marcar"` y el `T0NN`**, no una edición del archivo. Marcá sólo lo
  que hiciste. Lo `[M]` queda abierto — es la diferencia entre "falta" y "espera a una persona", y es
  lo que hace que `spec_status` reporte `pendientes: 0` sin mentir. Lo que la tool garantiza y una
  edición a mano no: **falla** si la tarea no existe o si ya estaba marcada, así que un ID mal tipeado
  se ve en el acto en vez de quedar como un reemplazo que no reemplazó nada; y escribe en el registro
  **central**, no en el worktree de quien la llama, que es lo que hace que dos carriles en paralelo no
  terminen con dos versiones del mismo estado.
- **La deuda que aparece implementando se anota con `spec_write` y `op: "seguimiento"`**, que la
  agrega al final de `## Seguimiento (no bloquea)` —y crea la sección si el spec no la tenía—. **El ID
  lo pone la tool**: sigue contando desde el mayor del archivo y nunca reusa uno libre, que es
  exactamente el error que comete quien numera a ojo mirando el último bloque.
- El estado del spec en `specs/mapa.json` lo mueve el **merge**, no la rama.
- Si el spec falsificó algo que la documentación afirma en presente, actualizá `docs/` y
  `.claude/rules/` —no los specs viejos, que son historia— y anotá el aprendizaje en
  el issue del spec, como nota de revisión.

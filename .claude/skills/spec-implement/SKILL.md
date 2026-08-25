---
name: spec-implement
description: Especialización de /spec-implement para pentomino-games: el paralelismo viene declarado por tarea con [P], y toda tarea de un spec nuevo la cierra un agente. Se lee junto con el skill global.
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
- [ ] T012 [P] Descripción, con la ruta del archivo que toca
```

- **`[P]`** — no depende de las otras `[P]` de su bloque ni comparte archivo con ellas. Lo escribió
  quien conocía las dependencias reales, al escribir el spec.
- **`T0NN`** — ID estable. Usalo para nombrar nodos y aristas en el `--dry`, que es lo que hace
  revisable el grafo antes de lanzar nada. Es también la dirección con la que se marca: `spec_write`
  toma el ID, no un número de línea.

**La declaración se lee con `spec_status`, no abriendo el archivo.** Con el argumento `spec` la
respuesta se acota a ese spec y suma `citas`: por tarea, los archivos que nombra entre backticks, con
su línea. Eso es la materia prima del fake-edge test ya parseada, y acotada pesa 3.135 bytes —el peor
spec, el 021, 7.962— contra los 29.742 del registro entero. `cruces` da los pares `X → Y` que la
tarea declara **en su propia línea**, no en su prosa de abajo —`de` y `a` son
string, que en este repo hay un `4,0 → 11,8`— y `proximaId` dice cuál falta de verdad, con `[M]`
—histórico, ver abajo— y los specs terminales ya descontados. Un `## Seguimiento` de un spec anterior
al 042 la tool ni lo mira: sus ítems no entran en `total` ni en `pendientes`.

**Seguí usando el fake-edge test sobre los `[P]` declarados, no en su lugar.** Un `[P]` mal puesto es
un conflicto de escritura que aparece recién al implementar; si el test contradice a la declaración,
gana el test y **decilo** — es un hallazgo sobre el spec, no un detalle.

Los specs 001–010 son anteriores a la convención y no llevan marcadores: ahí el grafo se deriva como
dice el global. No los reescribas para agregárselos.

### `[M]` es histórico: se respeta donde está, no se escribe uno nuevo

**Un spec anterior al 039 puede traer tareas marcadas `[M]`** — «pide una persona: oído, navegador,
captura»—. Cuando te toque implementar uno de ésos, la mecánica no cambió: **no la metas en el grafo y
no la pases por `spec_write`**, que queda abierta a propósito y `spec_status` ya la descuenta de
`pendientes`. Si dejara de descontarla, los specs cerrados pasarían a deber trabajo de un día para el
otro.

**Pero en un spec `NNN >= 039` no hay `[M]` que respetar, porque no se escriben.** Lo midió el propio
039: de las **137** casillas `[M]` repartidas en **35** specs, sólo **7** se
cerraron alguna vez. O sea que en la práctica `[M]` no significaba «espera a una persona» sino «no se
va a hacer nunca, pero queda escrito». La regla que lo reemplaza: **volverlo verificable, o no
anotarlo en ningún lado.** Si implementando encontrás una tarea que sólo se puede cerrar mirando o
escuchando, eso es un hallazgo sobre el spec —decilo— y no una casilla nueva para marcar.

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
  que hiciste. En un spec anterior al 039, lo `[M]` queda abierto y es lo que hace que `spec_status`
  reporte `pendientes: 0` sin mentir; en uno del 039 en adelante no hay `[M]`, así que `pendientes: 0`
  quiere decir que **todo** se cerró. Lo que la tool garantiza y una
  edición a mano no: **falla** si la tarea no existe o si ya estaba marcada, así que un ID mal tipeado
  se ve en el acto en vez de quedar como un reemplazo que no reemplazó nada; y escribe en el registro
  **central**, no en el worktree de quien la llama, que es lo que hace que dos carriles en paralelo no
  terminen con dos versiones del mismo estado.
- **La deuda que aparece implementando se abre como issue** con `mcp__github__issue_write`, y **no se
  anota en el spec**. Adentro de un `tasks.md` el ítem hereda el estado de su spec: un spec
  `Implementado` puede tener diez casillas abiertas y no deberle nada a nadie, y así es como al mudar
  `deuda.md` a Issues aparecieron **seis** ítems que nunca habían llegado al tracker —enterrados en
  specs ya cerrados, dos de ellos bugs medidos que llevaban veinte días invisibles—. Un issue tiene
  estado propio y se cierra con `Closes #N` desde un commit. Lleva tres cosas que el `texto` del
  seguimiento no pedía, porque estar escrito adentro del spec se las daba gratis:
  - **Título que se entienda fuera del contexto del spec.** En la lista de issues no hay más contexto
    que el título, y es la diferencia entre un ítem que se encuentra buscando y uno que hay que abrir
    para saber de qué habla.
  - **Cuerpo con la evidencia**: `archivo:línea`, el número medido, qué hace falta para verlo.
  - **`Detectado en #N`**, con el issue del spec que la encontró. Repone el vínculo que daba estar
    escrito adentro del `tasks.md`, y sin él el hallazgo queda sin origen. **El `#N` sale de
    `specs/mapa.json` y no del `NNN`**: el spec 001 es el issue #63.

  **El label es `bug` o `enhancement`**, los dos que el repo ya usa. Inventar uno propio para la deuda
  de los specs vuelve a partir el tracker en dos, que es el problema que esto cierra.
- El estado del spec en `specs/mapa.json` lo mueve el **merge**, no la rama.
- Si el spec falsificó algo que la documentación afirma en presente, actualizá `docs/` y
  `.claude/rules/` —no los specs viejos, que son historia— y anotá el aprendizaje en
  el issue del spec, como nota de revisión.

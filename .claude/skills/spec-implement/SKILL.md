---
name: spec-implement
description: Especialización de /spec-implement para pentomino-games. El grafo no se adivina: los tasks.md nuevos declaran el paralelismo por tarea con [P], y [M] marca lo que ningún agente puede cerrar. Se lee junto con el skill global, que aporta el método; acá está solo lo que difiere.
---

# spec-implement — pentomino-games

Este archivo **no reemplaza** al skill global: aporta lo que en este repo es distinto. El fake-edge
test, las reglas de andamiaje y la convergencia salen de allá.

## El paralelismo viene declarado — no lo derives de cero

El global construye el grafo con un nodo por encabezado y advierte que *"un grafo adivinado abanica
trabajo que se pisa"*. En este repo, desde el spec 011, `tasks.md` lo declara por tarea
([`specs/README.md`](../../../specs/README.md#formato-de-una-tarea)):

```
- [ ] T012 [P] [M] Descripción, con la ruta del archivo que toca
```

- **`[P]`** — no depende de las otras `[P]` de su bloque ni comparte archivo con ellas. Lo escribió
  quien conocía las dependencias reales, al escribir el spec.
- **`[M]`** — pide una persona: oído, navegador, captura. **Ningún agente la puede cerrar.** No la
  metas en el grafo y no la marques `[x]`: queda abierta a propósito y `spec_status` ya la descuenta.
- **`T0NN`** — ID estable. Usalo para nombrar nodos y aristas en el `--dry`, que es lo que hace
  revisable el grafo antes de lanzar nada.

**Seguí usando el fake-edge test sobre los `[P]` declarados, no en su lugar.** Un `[P]` mal puesto es
un conflicto de escritura que aparece recién al implementar; si el test contradice a la declaración,
gana el test y **decilo** — es un hallazgo sobre el spec, no un detalle.

Los specs 001–010 son anteriores a la convención y no llevan marcadores: ahí el grafo se deriva como
dice el global. No los reescribas para agregárselos.

## Antes de arrancar

- **`check_invariants` en proceso fresco**, antes y después. El MCP de la sesión cachea los módulos y
  contesta con el código viejo — está pisado como tarea en varios specs porque ya pasó.
- **`pnpm verify` es el nodo de convergencia**, no `pnpm test`. Corre lint ‖ typecheck ‖ test ‖
  mcp:test en paralelo y es lo único que typechequea cruzando el borde de paquete hacia
  `mcp-server/`, que importa 31 símbolos del dominio.
- **El gestor es pnpm.** Nunca `npm install`: deja un `package-lock.json` que Netlify puede preferir.

## Al cerrar

- Marcá `[x]` sólo lo que hiciste. Lo `[M]` queda abierto — es la diferencia entre "falta" y "espera a
  una persona", y es lo que hace que `spec_status` reporte `pendientes: 0` sin mentir.
- El estado del spec en `specs/log.md` lo mueve el **merge**, no la rama.
- Si el spec falsificó algo que la documentación afirma en presente, actualizá `docs/` y
  `.claude/rules/` —no los specs viejos, que son historia— y anotá el aprendizaje en
  `specs/revisiones.md`.

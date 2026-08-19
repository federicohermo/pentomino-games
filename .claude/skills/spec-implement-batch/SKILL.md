---
name: spec-implement-batch
description: Reparte un lote de specs de specs/ en carriles y los implementa — un carril por cadena de dependencias, cada uno en su worktree, delegando cada spec a spec-implement. Usar al implementar dos o más specs de una, al preguntar si un grupo de specs se puede paralelizar, o cuando specs/log.md los declara encadenados. Para un spec solo, spec-implement.
---

# spec-implement-batch — pentomino-games

`spec-implement` abanica los **pasos** de un spec. Este reparte **specs** en carriles.

Esa diferencia manda todo lo demás. Adentro de un spec, el padre escribe los archivos compartidos al
converger. Entre carriles ese padre no existe: cada carril tiene su árbol de trabajo y converge recién
en el merge, que resuelve texto y no semántica.

## Arista o conflicto

La decisión que define el lote entero, y la que se equivoca hacia el lado conservador: si tratás cada
archivo compartido como arista, un lote de UI colapsa a una cadena de ancho 1 —todos tocan el shell— y
el batch deja de comprar nada.

| Entre A y B | Es | Cuesta |
|---|---|---|
| B importa lo que A crea | **arista** | serie |
| B parte de un número que A mueve | **arista** | serie |
| Escriben la misma función del mismo archivo | **arista** | serie |
| Escriben regiones distintas del mismo archivo | **conflicto** | una resolución de merge |

Solo la arista serializa. El conflicto se paga en el merge y se mide en líneas.

Para separarlos, **leé la tarea y su cita de línea**, que los `tasks.md` de este repo traen
(`PiecePalette.tsx:36`, `Board.tsx:132`). Regiones lejanas del mismo archivo son conflicto barato; la
misma función, arista.

---

## Paso 1 — Repartir el lote en carriles

Derivá el grafo de los archivos, y recién después contrastalo contra «Dependencias entre specs» del
`log.md`. Ese texto dice qué quiso el autor; el grafo dice qué va a pasar. **Si difieren, eso es el
hallazgo** y va en el reporte.

1. **Corré [`scripts/matriz.sh`](./scripts/matriz.sh) con los números del lote.** Devuelve la matriz
   archivo × spec y, por cada archivo compartido, las líneas de tarea que lo citan — que es lo que
   decide arista o conflicto. No filtra las menciones que vienen de tareas de documentación: eso lo
   decide el verbo, y se lee en las líneas que el script ya trajo.
2. Aplicá la tabla de arriba a cada casilla marcada `<- compartido`.
3. **Preguntale al MCP en vez de abrir archivos.** `find_symbol` contesta quién importa qué —la arista
   real, no la que el texto insinúa— y `spec_status` da estado y próxima tarea de los N specs en una
   consulta. `mcp-server/` importa 31 símbolos del dominio: un spec que cambia una firma de `domain/`
   tiene una arista hacia el MCP que ningún `## Paso` declara.
4. Cada cadena de aristas es un **carril**. Los specs sin aristas entre sí van en carriles distintos.

**Terminado cuando** cada spec del lote está en exactamente un carril y cada arista tiene escrito el
archivo o el número que la justifica. Un carril sin esa justificación es una cadena adivinada.

Los cuatro juicios que este paso erra si se hacen de memoria —y la medición que fija cada uno— están
en [`calibracion.md`](./calibracion.md).

Si sale **un solo carril**, decilo y ofrecé la corrida en serie: el batch sigue comprando el Paso 2 y
el preámbulo, pero no compra reloj.

---

## Paso 2 — Checker cruzado

Lo que ningún `/spec-implement` suelto puede ver, porque mira un spec. Corré las cuatro preguntas
**antes de escribir una línea**:

1. **Un default que dos specs mueven.** Uno lo prende, otro lo apaga, y el segundo no sabe que el
   primero lo usa.
2. **Un spec produce el dato que otro apaga.** Medido: el 014 hace que la pieza muteada emita `Click`
   sin `note`, y el 015 pone `clicks` en `false` — pero `engine.ts:325` (`else if (clicksAudible)`)
   apaga exactamente la rama muda. Con los dos puestos la pieza muteada es **silencio total**.
3. **Un número que dos specs mueven.** Confirmá que el segundo parte del valor que deja el primero y no
   del de `main`.
4. **Un spec que cierra una tarea de otro.** Es el único archivo que se escribe fuera de su propio
   spec: anotalo para que dos carriles no lo pisen.

Un cruce encontrado **no es todavía un hallazgo**: el grafo dice que dos specs se tocan, no que nadie
lo haya decidido. **Andá al AC antes de escalar.** Medido sobre el cruce 014/015 de arriba: el AC11 del
015 ya declaraba el silencio total «la consecuencia buscada y no un agujero», pedía verificar **las dos
mitades** y encargaba el docblock que lo explica — no faltaba ninguna decisión, y frenar habría costado
una ronda de ida y vuelta por algo ya resuelto. Ojo con la otra mitad de la trampa: el spec pudo
haberse arreglado **después** de que este skill anotara el cruce, así que el `tasks.md` de hoy manda
sobre el ejemplo de acá.

Si el AC no lo cubre, entonces sí es una decisión de diseño que le falta al spec: **reportala y frená
con `AskUserQuestion`**, porque arreglar un spec cuesta un párrafo y arreglar dos carriles cuesta un
rebase. Con la respuesta en mano, escribila en el `tasks.md` que corresponda antes de lanzar.

**Terminado cuando** las cuatro preguntas tienen respuesta escrita, incluidas las que dieron que no —
y las que dieron que sí dicen **quién ya lo decidió**, con el AC citado.

---

## Paso 3 — Un worktree por carril

**Por carril, no por spec.** La cadena de un carril se apila adentro de su propio worktree y no necesita
gimnasia de ramas; lo que se aísla es el carril, que es lo que corre concurrente.

Lanzá los carriles en **un solo mensaje** con un `Agent` por carril e `isolation: "worktree"`. El
worktree arranca en `origin/main` y se limpia solo si el agente no cambió nada.

Cada agente de carril recibe:

- **el preámbulo, destilado una vez para todo el lote**: el bloque de convenciones de ≤40 líneas
  (`CLAUDE.md` + `.claude/rules/`) y las trampas que ya costaron una corrida en rojo. Es el ahorro
  propio del batch — sin esto, N corridas lo re-derivan N veces desde frío;
- **`pnpm install` primero**: el worktree nace sin `node_modules` y `pnpm verify` va a rojo hasta que
  lo corra. Con el store de pnpm son hardlinks, así que sale barato — pero hay que decirlo;
- **sus specs en orden**, y que delegue cada uno a `spec-implement`, que deriva el grafo *interno* y
  abanica lo que corresponda. Ahí el `[P]` de las tareas ya viene declarado;
- **que cierre cada spec antes de arrancar el siguiente**: `pnpm verify` en verde, la app corrida y
  **medida en el DOM** (`getComputedStyle`, un `Range` sobre el nodo de texto) si el spec cambia algo
  que se ve, commit por nodo del grafo, push a `origin`, y PR;
- **la base de cada PR**: el primer spec del carril apunta a `main`; los que le siguen, a la rama del
  spec anterior del mismo carril;
- **que marque `[x]` solo lo que hizo.** Lo `[M]` queda abierto: pide una persona, y `spec_status` ya
  lo descuenta.

Esperá a que vuelvan todos antes del reporte.

---

## Paso 4 — Reporte

- Los carriles, su ancho, y **cuántas aristas del `log.md` resultaron falsas**.
- **Qué encontró el Paso 2 y qué se decidió** — es el entregable propio de este skill.
- Por spec: verde o rojo de `pnpm verify`, número de PR, y qué quedó `[M]`.
- **El orden de merge, y que un squash obliga a rebasear el carril de abajo.** Los PR apilados dependen
  de la historia de su base.

Lo que el batch deja al usuario: mover el estado en `specs/log.md` —lo mueve el merge—, mergear, y
correr el review.


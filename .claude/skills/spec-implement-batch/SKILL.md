---
name: spec-implement-batch
description: Implementa un lote de specs de specs/ repartiéndolo en carriles —uno por cadena de dependencias, cada uno en su worktree—, delegando cada spec a spec-implement. Usar al implementar dos o más specs de una. Para un spec solo, spec-implement.
argument-hint: "<NNN NNN ...> | <NNN-MMM> | --propuestos [--dry]"
---

# spec-implement-batch — pentomino-games

## Matriz del lote

<!-- Inyección dinámica: el comando corre ANTES de que el modelo procese este archivo, así que la
     matriz llega con el skill ya cargado en vez de costar un turno de tool. `matriz.sh` entiende las
     tres formas del `argument-hint`, que es lo que deja pasarle `$ARGUMENTS` crudo.

     Ruta por `${CLAUDE_SKILL_DIR}` y no literal. Acá decía lo contrario, y el motivo escrito era
     que el orden de la sustitución respecto de la inyección `!` no estaba documentado — una que no
     ocurre no degrada, hace fallar la carga. Hoy sí está documentado, y para exactamente este caso:
     «for scripts within bash injection commands». Verificado además cargando el skill.

     Lo que compra no es un token: es que el skill se pueda mover, renombrar o empaquetar sin editar
     su propio contenido, que es la otra mitad de que sea autocontenido.

     Este skill sigue **sin `allowed-tools`**, o sea sin restricción. Declarar una lista parcial para
     nombrar el script le sacaría todo lo que no estuviera en ella —`Agent`, los `git worktree`, el
     `pnpm verify`— y lo rompería en silencio. -->

!`${CLAUDE_SKILL_DIR}/scripts/matriz.sh $ARGUMENTS`

---

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

Para separarlos, **leé la tarea y su cita de línea**: las devuelve `spec_status` en `citas`
(`{tarea, archivo, linea}` — `PiecePalette.tsx:36`, `Board.tsx:132`). Regiones lejanas del mismo
archivo son conflicto barato; la misma función, arista.

`citas` **sólo viene al pedir un spec por vez**: las de los 33 pesan 84.097 bytes contra los 29.742 de
la respuesta entera —la llevan a 3,8×—, así que el listado no las trae. Acotada a un spec la respuesta
baja de 29.742 bytes a 3.135 de mediana —7.962 el peor, que es el 021—, y la matriz de archivos de un
lote sale de una consulta por spec en vez de una sola grande.

---

## Paso 1 — Repartir el lote en carriles

Derivá el grafo de los archivos, y recién después contrastalo contra «Dependencias entre specs» del
`spec_status` en `cruces`. Eso dice qué quiso el autor; el grafo dice qué va a pasar. **Si difieren, eso es el
hallazgo** y va en el reporte.

1. **La matriz ya está arriba**, inyectada por [`scripts/matriz.sh`](./scripts/matriz.sh) al cargar
   este archivo: matriz archivo × spec y, por cada archivo compartido, las líneas de tarea que lo
   citan — que es lo que decide arista o conflicto. No la vuelvas a pedir por Bash. No filtra las
   menciones que vienen de tareas de documentación: eso lo decide el verbo, y se lee en las líneas
   que el script ya trajo.
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

Si sale **un solo carril**, decilo y **arrancá igual en serie, sin preguntar**: el batch sigue
comprando el Paso 2 y el preámbulo, pero no compra reloj. Que no compre reloj es un dato del reporte,
no una decisión que necesite al usuario.

---

## Paso 2 — Checker cruzado

Lo que ningún `/spec-implement` suelto puede ver, porque mira un spec. Corré las cuatro preguntas
**antes de escribir una línea**:

1. **Un default que dos specs mueven.** Uno lo prende, otro lo apaga, y el segundo no sabe que el
   primero lo usa.
2. **Un spec produce el dato que otro apaga.** Medido: el 014 hace que la pieza muteada emita `Click`
   sin `note`, y el 015 pone `clicks` en `false` — pero `engine.ts:325` (`else if (clicksAudible)`)
   apaga exactamente la rama muda. Con los dos puestos la pieza muteada es silencio total, y el AC11
   del 015 pide verificar lo contrario.
3. **Un número que dos specs mueven.** Confirmá que el segundo parte del valor que deja el primero y no
   del de `main`.
4. **Un spec que cierra una tarea de otro.** Es la única escritura que sale de su propio spec: anotalo
   para que dos carriles no lo pisen. Pisarlo dejó de ser silencioso —`spec_write` con `op: "marcar"`
   falla si la tarea ya estaba marcada, en vez de dejar creer que escribió— pero un carril que se
   frena con ese error igual costó la corrida.

Lo que salga es una decisión de diseño que le falta al spec. **Decidila vos, escribila con `spec_write`
(`op: "seguimiento"`) en el spec que corresponda antes de lanzar, y seguí** — no se frena con
`AskUserQuestion`. El ID de la tarea lo pone la tool, contando desde el mayor del archivo, así que dos
decisiones escritas seguidas no se pisan el número. Sigue valiendo el argumento de por qué se resuelve
*acá* y no en el carril: arreglar un spec cuesta un párrafo y arreglar dos carriles cuesta un rebase;
lo que cambia es quién contesta. La recomendación se toma, no se ofrece.

Va escrita **como tarea con su porqué y su AC**, no como nota al pie: el carril la va a leer sin este
contexto. Y la va a leer de verdad, que antes no estaba garantizado: la escritura cae en el **registro
central**, no en el árbol de quien la hace (D1 del spec 033), así que el carril la ve con `spec_status`
aunque su worktree haya nacido en `origin/main` sin ella. Y va al reporte del Paso 5, que es donde el
usuario la ve — si quiere revertirla, revierte un párrafo escrito, que es más barato que el turno de
ida y vuelta que la habría evitado.

Lo único que sigue frenando es lo de siempre: que proceder bajo cualquier supuesto sea inseguro, o
deje el lote inservible si el supuesto está mal. Eso casi nunca es una decisión de diseño de un spec.

**Terminado cuando** las cuatro preguntas tienen respuesta escrita, incluidas las que dieron que no.

> **Y este skill sigue sin llevar `context: fork`.** El motivo era doble y ahora es simple: **escribe
> código** en N worktrees y corre `pnpm verify`. Esconder eso del usuario no es ahorrar contexto — es
> sacarle de encima el trabajo que tiene que poder frenar a mitad de camino. (La otra mitad del
> argumento era que `AskUserQuestion` no existe en un subagente, y con la parada afuera dejó de
> aplicar.)

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
- **hidratar los specs del carril, primero de todo**: desde el spec 034 los specs viven en issues y
  `specs/[0-9]*/` está en el `.gitignore`, así que **al worktree no viajan** — `git worktree add`
  hace checkout de lo trackeado. Cada agente corre
  `node .claude/scripts/hidratar-specs.mjs <NNN> <NNN>` con los de su carril antes de leer nada.
  Sin eso lee un directorio vacío y **no falla**: implementa sin spec, que es la versión cara de
  «fallar en verde». El mapa sale de `specs/mapa.json`, que sí está trackeado;
- **`pnpm install` después**: el worktree nace sin `node_modules` y `pnpm verify` va a rojo hasta que
  lo corra. Con el store de pnpm son hardlinks, así que sale barato — pero hay que decirlo;
- **sus specs en orden**, y que delegue cada uno a `spec-implement`, que deriva el grafo *interno* y
  abanica lo que corresponda. Ahí el `[P]` de las tareas ya viene declarado;
- **que cierre cada spec antes de arrancar el siguiente**: `pnpm verify` en verde, la app corrida y
  **medida en el DOM** (`getComputedStyle`, un `Range` sobre el nodo de texto) si el spec cambia algo
  que se ve, commit por nodo del grafo, push a `origin`, y PR;
- **la base de cada PR**: el primer spec del carril apunta a `main`; los que le siguen, a la rama del
  spec anterior del mismo carril;
- **que marque `[x]` solo lo que hizo**, con `spec_write` (`op: "marcar"`). Si el spec es anterior al
  039 puede traer tareas `[M]`, que quedan abiertas —piden una persona— y `spec_status` ya las
  descuenta; de un spec `NNN >= 039` no se espera ninguna, porque no se escriben más: una tarea que
  sólo se cierra mirando o escuchando es un hallazgo sobre el spec, no una casilla a marcar. **Esa
  marca no viaja en el commit del carril**: cae en el registro central y no en su worktree (D1 del
  spec 033), así que el avance del lote se lee
  entero con `spec_status` sin esperar los merges — y a la inversa, no esperes verlo en el diff del PR.

Esperá a que vuelvan todos antes del reporte.

---

## Paso 4 — Destruir los worktrees

```bash
sh "${CLAUDE_SKILL_DIR}/scripts/limpiar-worktrees.sh" --todos
```

**Va antes del reporte, no después**, y no se hace a mano. Los carriles de este skill **corren la
app** —el Paso 3 pide medirla en el DOM—, así que cada worktree queda con un `vite` y su `esbuild`
vivos. En Windows un handle abierto hace fallar el borrado, y no solo el de git: por eso el script
mata primero y desregistra después. Medido: con ese orden `git worktree remove` pasa de fallar a
decir `ok`.

Y mata **por ruta del worktree, nunca por nombre de proceso**. Es la diferencia entre limpiar el
carril y matarle al usuario el `pnpm dev` del checkout principal, que en esta máquina existe.

Si imprime `SIGUE AHI`, el handle es de afuera —el IDE con la carpeta abierta, o un navegador de
Playwright que quedó vivo—. Decilo en el reporte: lo cierra el usuario, no vos.

## Paso 5 — Reporte

- Los carriles, su ancho, y **cuántas de las aristas declaradas resultaron falsas**.
- **Qué encontró el Paso 2 y qué se decidió** — es el entregable propio de este skill.
- Por spec: verde o rojo de `pnpm verify`, número de PR, y qué quedó abierto — en un spec anterior al
  039, sus `[M]`; en uno del 039 en adelante, cualquier tarea que no se haya podido cerrar, que ahí ya
  no hay marcador que la excuse.
- **El orden de merge, y que un squash obliga a rebasear el carril de abajo.** Los PR apilados dependen
  de la historia de su base.

Lo que el batch deja al usuario: mover el estado en `specs/mapa.json` —lo mueve el merge—, mergear, y
correr el review.


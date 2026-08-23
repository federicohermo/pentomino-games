---
name: pr-review-batch
description: Revisa los PR abiertos de GitHub en paralelo —un agente por PR, cada uno en su worktree—, arregla lo que encuentra, verifica con pnpm verify, commitea y pushea a la rama del PR. Usar al querer cerrar el review de uno o varios PR de este repo. Para revisar un spec que todavía es texto, spec-review-batch.
argument-hint: "<NN NN ...> | --abiertos [--cleanup] [--comentar] [--dry]"
# Sin `allowed-tools`, o sea sin restricción, y por el mismo motivo que `spec-implement-batch`:
# declarar una lista parcial le sacaría todo lo que no estuviera en ella —`Agent`, los `git
# worktree`, el `pnpm verify`, las cinco tools de `mcp__github__`— y lo rompería en silencio.
#
# Tampoco hay inyección `!` de un script al cargar, a diferencia de los dos skills de spec: la
# matriz de este skill son los PR abiertos, y eso lo contesta GitHub, no el filesystem. `gh` no
# está en el PATH de esta máquina, así que no hay comando que inyectar — sale por MCP en el Paso 0.
---

# pr-review-batch — pentomino-games

Un review de PR mira **un diff**. Este mira los N diffs abiertos, y su entregable propio es lo que
ninguno suelto puede ver: **este repo apila las ramas**, y un hallazgo del PR de arriba suele ser una
consecuencia del de abajo.

Y no termina en el reporte. Encuentra, arregla, verifica, commitea y pushea a la rama del PR. El
reporte es lo que queda, no el producto.

---

## Lo que este repo cambia respecto de un review genérico

Cuatro sustituciones. Las cuatro se descubrieron corriendo, no leyendo:

| Un review genérico | Acá |
|---|---|
| Localiza el PR con las tools de Bitbucket | **`mcp__github__list_pull_requests`** y `pull_request_read`. **`gh` no está en el PATH** de esta máquina: no hay fallback por CLI |
| Saca los criterios de aceptación de un ticket de Jira | **`specs/NNN-*/spec.md`**, sección de AC, más lo que `mcp__pentomino-domain__spec_status` contesta del estado de sus tareas. El número del spec sale del nombre de la rama: `feature/NNN-...` |
| Cierra con un `land.sh` que corre `npm run verify` | **`pnpm verify`, a mano.** `npm` acá deja un `package-lock.json` que Netlify puede llegar a preferir, y un `node_modules` plano |
| Eleva todo a comentarios del PR | **El chat y el `## Seguimiento`, que se escribe con `mcp__pentomino-domain__spec_write`.** La escritura cae en el **registro central** y no en el worktree, así que el hallazgo **ya no viaja en el diff del PR**. `--comentar` publica además un general por PR, para cuando lo mergea otra persona |

---

## Paso 0 — El mapa de PRs y la cadena de bases

`$ARGUMENTS`: números de PR sueltos (`26 27 28`), o `--abiertos` = todos los abiertos. Sin argumentos,
**preguntá**: no asumas.

1. `mcp__github__list_pull_requests` con `state: "open"`. Si devuelve un error de socket, **reintentá
   una vez** antes de diagnosticar nada — pasó y con el reintento salió.
2. Por cada PR anotá: número, `head.ref`, **`base.ref`** y autor.
3. **`base.ref` es la base, nunca `main`.** Medido el 2026-08-21: de cinco PR abiertos, tres estaban
   apilados (`025 ← 027 ← 026`). Diffear el de arriba contra `main` mete decenas de commits ajenos y
   el review se llena de hallazgos que son de otro PR. `diff-pr.sh` recibe la base como argumento
   justamente para que ese error sea imposible.
4. **Dibujá la cadena** y pasásela a los agentes. Un agente que sabe que su base es otro PR abierto
   sabe además que un hallazgo suyo puede pertenecer al de abajo, y lo dice en vez de arreglarlo dos
   veces.
5. **Medí la lista caliente**, que es el insumo del paso que sigue:
   ```bash
   cat <dir>/{33,34,35,36}/pr.files | sort | uniq -c | sort -rn | awk '$1>1'
   ```
   sobre los `pr.files` que `diff-pr.sh` ya emite —lo podés correr sin checkout, con el tercer
   argumento—. Medido el 2026-08-22 sobre el lote 018–021: **30 archivos distintos, 17 tocados por
   más de un PR y 3 por los cuatro** (`src/App.tsx`, `src/__tests__/App.browser.test.tsx` y
   `specs/revisiones.md`).
6. **Comparalo contra `main`.** El PR de más abajo puede estar detrás: en esa corrida `main` iba tres
   commits adelante de la base del 33 y no tocaba ninguno de los 30 archivos del lote, o sea que la
   puesta al día no costaba nada. Eso se dice en el reporte y **no** se hace desde acá.
7. **Autor distinto de `git config user.name` ⇒ ese PR es `--dry`**, él solo y no el lote: se revisa y
   se reporta, no se escribe ni se pushea. Pushear la rama de otro no es tuyo.

Con `--dry` no se escribe nada en ningún PR: se corre hasta el reporte y ahí termina.

## Paso 0 bis — El orden de merge, y por qué ningún agente lo puede verificar

Un batch que **escribe** sobre una cadena apilada tiene un modo de falla que el que sólo reporta no
tiene: el mismo arreglo aplicado en dos PR de la cadena se vuelve un conflicto de rebase, y el
arreglo aplicado en el PR equivocado obliga a rebasear todo lo que tiene encima. La cadena mergea de
**abajo hacia arriba**, siempre.

**Un agente no puede resolver esto solo, y no es por falta de criterio.** Está parado en su cabeza, y
`git log origin/main..HEAD` —el rango natural para preguntar «¿quién más toca este archivo?»— sólo ve
**hacia abajo**: su propio PR y los que tiene de base. Los de arriba están fuera del rango y no
existen para él. Medido en la corrida del 2026-08-22: **dos de cuatro agentes cerraron su reporte
afirmando que archivos suyos no los tocaba ningún otro PR del lote**, y los dos se equivocaban en el
mismo par (`.claude/rules/ui.md` y `docs/guides/conventions.md`, que toca el PR de más arriba). Por
eso la lista caliente la mide el padre en el Paso 0 y **baja en el preámbulo**: no es un dato que el
agente pueda ir a buscar.

Cinco cláusulas, que van **literales** en el preámbulo del Paso 1:

1. **Un hallazgo es del PR más bajo de la cadena que lo introdujo.** Como la base de cada uno es la
   cabeza del de abajo, el código del inferior le llega al superior como **contexto** y no como diff:
   se ve nuevo y no es suyo. El test es mecánico — **si la línea no aparece como `+` en tu `pr.diff`,
   no es tuya**, aunque todavía no esté en `main`. Se reporta como `PERTENECE-A-PR-<N>` con
   `archivo:línea` y evidencia, y no se toca.
2. **Pero la propiedad es de quien lo falsifica, no de quien toca la línea** — y esta es la excepción
   que la cláusula 1 necesita, porque sola crea un punto ciego. Un diff puede volver falsa una
   afirmación que **no contiene**: típicamente un conteo. Ver abajo.
3. **Un arreglo abajo cuesta un rebase en cada PR de arriba.** Eso no cambia dónde va el fix —va donde
   se introdujo— pero obliga a que cada agente **liste los archivos que tocó**, que es lo único con lo
   que el padre puede anunciar el costo.
4. **Hunk chico y quieto** en todo archivo de la lista caliente. Un arreglo que además re-justifica un
   párrafo, re-envuelve líneas o reordena una tabla convierte un conflicto de una línea en uno de
   veinte.
5. **El `## Seguimiento` se escribe con `mcp__pentomino-domain__spec_write` (`op: "seguimiento"`) y
   siempre con el `spec` propio.** El viejo argumento —«libre de conflicto por construcción, un
   `tasks.md` por PR»— **dejó de hacer falta**: la escritura cae en el registro central y ya no hay
   archivo que mergear. Lo que sí pesa más que antes es **a cuál spec**: el `spec` va como argumento
   explícito, y uno equivocado escribe en el registro de otro **sin que ningún diff lo delate**. Un 🟡
   que pertenece a otro spec del lote **no** se escribe: se reporta como `PERTENECE-A-PR-<N>`.
   El precio de la escritura central se paga acá y hay que decirlo en el reporte: **el reviewer del PR
   ya no ve el seguimiento en el diff**, así que el Paso 5 es el único canal por el que se entera.

Y nadie rebasea, mergea ni usa `--force`. El push es `git push origin HEAD:refs/heads/<head.ref>`.

### El punto ciego que la cláusula 2 existe para tapar

**Una afirmación numérica monótona sobre el árbol, corregida en un PR de la pila, queda vieja en cada
PR de arriba — y la cláusula 1 garantiza que ningún agente la vea.** Está medido, y es el hallazgo
propio de la corrida del 2026-08-22:

`docs/architecture/directory-structure.md` dice cuántos archivos tiene el proyecto `node` de Vitest.
Conteo real de `src/**/__tests__/*.test.ts` por cabeza, contra lo que el doc afirmaba:

| | `main` | 018 | 019 | 020 | 021 |
|---|---|---|---|---|---|
| real | 20 | 19 | 20 | **21** | **22** |
| el doc | 17 | 17 | **20** ✔ | 17 | 17 |

El agente del 019 lo corrigió a 20 y para **su** cabeza es exacto. Los dos de arriba no podían
cazarlo por dos motivos que se suman: la frase no estaba en su diff —en su base decía 17 y no la
tocaron—, y **el arreglo del 019 todavía no existía** cuando corrieron. Pero el 020 estrena
`orientation-constants.test.ts` y el 021 estrena `cell-px.test.ts`: los dos diffs **mueven el número
que la frase afirma**, así que los dos son dueños. Se despachan desde el Paso 5, con el número medido
al lado y la orden de remedirlo.

El corolario operativo: **todo conteo que el lote mueva es del padre.** Es la única clase de hallazgo
que no se delega, porque requiere ver la cadena entera a la vez.

Y su reverso, para no sobre-corregir: **la cláusula 1 funciona.** En esa misma corrida el agente de
más arriba detectó que ese doc no listaba archivos del 019 ni del 020, **no los arregló**, y los dos
agentes de abajo ya los habían arreglado cada uno en el suyo. Cero duplicación y cero rebase
duplicado, sin que el padre interviniera.

## Paso 1 — El preámbulo, destilado una vez

Es el ahorro propio del batch: sin esto, N agentes lo re-derivan N veces desde frío. Cuatro insumos, y
los cuatro van **destilados**, no como rutas a leer:

- **Las convenciones verificables, ≤40 líneas**: `CLAUDE.md` más los `.claude/rules/` de las capas que
  el lote toca. Con la línea de [`hallazgos.md`](./hallazgos.md) marcada: qué verifica ya el linter y
  qué no.
- **El mapa síntoma → deuda**, que sale de los **issues abiertos** (`mcp__github__list_issues`).
- Lo que `specs/revisiones.md` registra como *ya se probó y no funcionó* para el área del lote.
- **La cadena de bases del Paso 0**, con **las cinco cláusulas del Paso 0 bis literales** y **la lista
  caliente medida**. Las tres cosas son del padre y ninguna la puede derivar el agente: la cadena
  porque no ve hacia arriba, las cláusulas porque son el contrato, y la lista porque es la medición
  que le dice dónde el hunk tiene que quedarse quieto.

Escribilo **a un archivo** y pasá la ruta absoluta, en vez de inlinearlo N veces: los worktrees no lo
comparten pero sí leen rutas absolutas. Y **escribilo con `Write`, nunca con un heredoc** — es el
mismo `unexpected EOF` de los backticks y los `$` que ya muerde en el mensaje de commit, y acá muerde
antes porque el preámbulo está lleno de rutas y de identificadores entre backticks.

## Paso 2 — Un worktree por PR

Lanzá los N en **un solo mensaje**, un `Agent` por PR con `isolation: "worktree"`.

**Por qué un worktree y no ramas en el árbol principal:** los agentes corren `pnpm verify` a la vez, y
dos checkouts de la misma rama no pueden coexistir. Además cada uno hace `git add -A`, así que
compartir árbol significa que el primero que commitea se lleva puesto el trabajo de los otros cuatro.

**El ancho lo manda `pnpm verify`, no el review.** Cada uno son cuatro nodos concurrentes, así que N
PRs son 4N procesos pesados. Hasta cinco anduvo, con reintentos por el Paso 4; más que eso, tandas.

**Y el ancho decide cuánto pesa el Paso 4, que no es lineal.** Con **cinco** agentes, el 2026-08-21,
tres de cinco necesitaron el protocolo de contención. Con **cuatro**, el 2026-08-22, **ninguno**: los
cuatro `verify` dieron verde en una sola pasada. Cuatro es el ancho que sale gratis; el quinto se paga
en reintentos.

## Paso 3 — El contrato de cada agente

Cada uno recibe el preámbulo del Paso 1, su número de PR, su `head.ref`, su `base.ref` y la ruta a
[`hallazgos.md`](./hallazgos.md), que es el método y va **literal**: un agente aislado necesita la
rúbrica de confianza más que vos, porque no tiene el contexto que te deja descartar un hallazgo de un
vistazo.

Y este contrato, en este orden:

1. **Parate en la cabeza del PR sin robarle la rama a nadie.**
   ```bash
   git fetch origin
   git checkout -B rev-pr-<N> origin/<head.ref>
   ```
   Una rama de andamio propia: `git checkout <head.ref>` a secas falla si esa rama ya está tomada por
   otro worktree.
2. **`pnpm install --frozen-lockfile`.** El worktree nace sin `node_modules` y `verify` va a rojo
   hasta que lo corras. Con el store de pnpm son hardlinks, así que sale barato — pero hay que
   decirlo. El Chromium de Playwright **no** hace falta reinstalarlo: su caché es de la máquina, no
   del checkout.
3. **Materializá el diff una sola vez**, con la base del PR y no con `main`:
   ```bash
   sh .claude/skills/pr-review-batch/scripts/diff-pr.sh <base.ref> <dir-temporal>
   ```
   Emite el diff, el `--stat`, las listas de código y de prosa por separado, el gate de ejes y la
   lista de afirmaciones numéricas que el diff agrega. **Si `diff_size=grande`, no leas el diff
   entero**: triageá con el `--stat` y leé por archivo.
4. **Leé los AC del spec del PR** — `specs/NNN-*/spec.md`, con el `NNN` de la rama — y contrastá cada
   uno contra el diff. Un AC sin contraparte verificable en el diff es hallazgo aunque el código esté
   bien.
5. **Encontrá con el método de `hallazgos.md`**, y solo en los ejes que el gate abrió.
6. **Arreglá con la política de triage de `hallazgos.md`**, y con las cinco cláusulas del Paso 0 bis
   encima: lo que no sea `+` en el propio diff se reporta como `PERTENECE-A-PR-<N>` y no se toca, el
   hunk se queda quieto en los archivos de la lista caliente, y los 🟡 que no se aplican se escriben
   al `## Seguimiento (no bloquea)` **de su propio spec** con `mcp__pentomino-domain__spec_write`
   (`op: "seguimiento"`, `spec` el propio). **El `T0NN` lo numera la tool**, que cuenta desde el mayor
   del archivo y nunca reusa uno libre — así que el `texto` es todo lo que aportás y tiene que decir
   qué se encontró y con qué evidencia: es lo único que queda cuando el diff ya no está.
7. **`pnpm verify` en verde**, con el Paso 4 de este archivo adelante.
8. **Commit y push**, sin `--force`:
   ```bash
   git push origin HEAD:refs/heads/<head.ref>
   ```
   Empujar la rama de andamio a su nombre real. **El mensaje de commit se escribe con `Write` a un
   archivo, nunca con heredoc**: los backticks y los `$` del contenido rompen el heredoc con un
   `unexpected EOF` que cuesta más diagnosticar que reescribirlo.
9. **Devolvé un reporte de 30–50 líneas**: veredicto en la primera, los bloqueantes con
   `archivo:línea` y evidencia, lo aplicado a conteos, lo **no** aplicado con motivo, los
   `PERTENECE-A-PR-<N>`, **la lista exacta de archivos tocados** —es lo único con lo que el padre
   calcula el costo de rebase— y el SHA. Sin el SHA el padre no puede verificar que el push llegó.

   Y **pedile que no afirme qué otros PR tocan sus archivos.** No lo puede saber: `origin/main..HEAD`
   sólo ve hacia abajo. Que liste lo que tocó; el cruce es del Paso 5.

**No commitea el árbol rojo.** Si `verify` queda rojo después del Paso 4, revertí lo que lo rompió,
no pushees, y decilo. Un pipeline que pushea para completarse no sirve.

## Paso 4 — El protocolo de contención

**Este es el paso que más corridas rompe, y el rojo casi nunca es del PR.**

Los presupuestos de performance del spec 009 y los tests de reloj de pared (`playheadOffset()` en
`engine.browser.test.tsx`) miden **la máquina**, y la máquina está corriendo N verifies a la vez. En
la corrida del 2026-08-21, **tres de cinco PR dieron rojo en la primera pasada**, siempre en tests de
reloj y siempre en archivos que el PR no tocaba. Los tres estaban bien.

El protocolo, y no hay que improvisarlo:

1. ¿El test que falló está en un archivo que el PR toca? **Si sí, es tuyo** — arreglalo.
2. Si no, y es un presupuesto o un reloj de pared: **corré `pnpm test` solo**, sin `coverage` y sin
   los otros nodos.
3. **Verde ⇒ seguí, y declaralo en el reporte** con el nombre del test y las dos corridas. No lo
   escondas: el usuario tiene que poder distinguir "pasó" de "pasó en la segunda".
4. **Rojo de nuevo ⇒ no pushees.** Reportalo como bloqueante del lote, no del PR.

El motivo está escrito en `CLAUDE.md`: es la misma contención por la que las dos pasadas de `suite`
corren en secuencia y no en paralelo. Un runner —o cinco agentes— no es una máquina medible.

## Paso 5 — Converger y reportar

El padre no re-audita: cruza.

- **Verificá que cada push llegó.** `git fetch origin` y comparar el head remoto contra el SHA que
  devolvió cada agente. Un agente que dice "pusheado" y un remoto que no se movió es el único modo de
  falla silencioso que queda.
- **Un hallazgo del PR de arriba que en realidad es del de abajo se arregla una sola vez**, en el de
  abajo. La cadena del Paso 0 es lo que deja verlo; sin ella entra dos veces y el rebase lo duplica.
  Ruteá cada `PERTENECE-A-PR-<N>` **antes** de darlo por perdido: el agente destino sigue vivo y se
  resume con `SendMessage`, con su worktree y su contexto puestos. Medido el 2026-08-22: los dos
  despachos así costaron **~100 s cada uno**, contra los 10–17 min de la pasada original.
- **Recalculá la lista caliente con lo que el review escribió, no con lo que el diff traía.** El
  propio review crea solapamiento nuevo: en esa corrida tres agentes terminaron tocando
  `docs/architecture/directory-structure.md`, que **ningún** diff original incluía. La lista del
  Paso 0 sirve para instruir; la de después es la que se reporta.
- **Los conteos que el lote mueve son tuyos** (cláusula 2 del Paso 0 bis). Barré las afirmaciones
  numéricas sobre el árbol —cuántos archivos, cuántos tests, cuántos botones— **cabeza por cabeza**, y
  despachá el número medido. Y medilo con el pathspec acotado: el 24 que un agente reportó contra un
  20 real salió de no acotar a `src` y contar también los `mcp-server/src/__tests__/`.
- **Verificá los descartes, no sólo los hallazgos.** Un agente que descarta algo como «preexistente»
  con una medición propia puede estar descartando bien por el motivo equivocado — o mal. Los dos casos
  aparecieron en la misma corrida.
- **Con `--comentar`**, un general por PR encabezado por el SHA, con las cuatro secciones:
  bloqueantes resueltos, mejoras aplicadas, **no aplicado con motivo**, y lo que sigue abierto. La
  tercera es la que le da valor: un pipeline que solo cuenta lo que arregló no es confiable cuando
  calla. **No abras inline sobre tu propio PR ya arreglado** — es ruido con costo, y cada comentario
  se paga dos veces en eco.

El reporte, en este orden y en ~40 líneas más la tabla:

1. **Una tabla, una fila por PR:** número, rama, hallazgos por severidad, SHA, y si `verify` pasó a la
   primera o a la segunda.
2. **Lo que apareció en más de un PR** — el patrón transversal es el entregable propio del batch. En
   la corrida medida fueron 17 de 21 hallazgos de la misma clase: prosa que dejó de ser cierta.
3. **Lo no aplicado**, y en el `## Seguimiento` de qué spec quedó escrito, con el `T0NN` que devolvió
   la tool. Desde que la escritura es central esto **no es redundante con el PR**: el seguimiento no
   está en el diff, así que quien mergea sólo lo ve acá.
4. **El orden de merge, de abajo hacia arriba**, y que un squash obliga a rebasear el PR de arriba de
   la cadena.
5. **Los archivos que el review dejó disputados, con el costo de cada rebase.** Es el punto que
   distingue este reporte del de N reviews sueltos: el usuario mergea con la lista de dónde va a
   frenar y con qué resolución. Un conteo monótono es el caso fácil y hay que decirlo — el conflicto
   es de una línea y **se resuelve tomando el número de más arriba**, que es el de la cabeza más
   nueva.

## Paso 6 — Destruir los worktrees

```bash
sh .claude/skills/pr-review-batch/scripts/limpiar-worktrees.sh --todos
```

**No lo hagas a mano, y no uses `git worktree remove` solo: va a fallar.** Borra lo trackeado y el
`.git`, pero `node_modules` está en `.gitignore`, así que el directorio no queda vacío y el borrado
final tira `Directory not empty`. `--force` no ayuda —no es un problema de cambios sin commitear— y le
pasa a todo worktree que haya corrido `pnpm install`, o sea a todos. Git igual saca la metadata, así
que quedan directorios huérfanos que ya no figuran en `git worktree list`.

El script hace las tres cosas en orden —desregistrar, matar lo que haya adentro, borrar— y se lleva
también el `.claude/worktrees/` vacío, que es la única señal que el usuario ve en el IDE.

**Si imprime `ANOMALIA`, va al reporte.** Un review nunca levanta la app, así que la cuenta esperada de
procesos vivos adentro de un worktree es cero; que haya alguno significa que un agente se dejó algo
corriendo. Si en cambio dice `SIGUE AHI`, el handle es de afuera —típicamente el IDE con la carpeta
abierta— y eso lo resuelve el usuario, no vos.

Después borrá las ramas `rev-pr-<N>`, **pero recién después de verificar que cada una es idéntica a su
`origin/<head.ref>`**. Si difieren, algo no se pusheó y la rama es lo único que lo tiene.

---

## Lo que no hace

- **No mergea, y no mueve estados en `specs/log.md`** — los mueve el merge.
- **No revisa specs que todavía son texto.** Eso es `spec-review-batch`, corre antes, y sale mucho
  más barato: un cruce detectado como texto cuesta un párrafo y detectado en dos ramas cuesta un
  rebase.
- **No abre PRs ni ramas de feature.** Trabaja sobre lo que ya está abierto.
- **No corre la app.** Si un fix toca algo que se ve, la verificación en el DOM la pide el spec y la
  hace una persona: queda declarada como `[M]`.

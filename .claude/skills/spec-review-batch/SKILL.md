---
name: spec-review-batch
description: Revisa un lote de specs de specs/ en paralelo —un agente por spec, sin worktrees— más un carril de coherencia que mira el lote entero y caza las contradicciones entre specs mientras todavía son texto editable. Usar al revisar dos o más specs de una, antes de implementar un lote encadenado, o cuando specs/log.md declara una cadena. No usar para revisar un spec solo.
argument-hint: "<NNN NNN ...> | <NNN-MMM> | --propuestos [--dry]"
allowed-tools:
  - Agent
  - Skill
  - Read
  - Glob
  - Grep
  - Edit
  - AskUserQuestion
  - mcp__pentomino-domain__spec_status
  - mcp__pentomino-domain__find_symbol
  - mcp__pentomino-domain__describe_piece
  - mcp__pentomino-domain__simulate_board
  - Bash(git status:*)
  - Bash(git worktree list:*)
  - Bash(git branch:*)
  - Bash(.claude/skills/spec-review-batch/scripts/lote.sh:*)
  - Bash(sh .claude/skills/spec-review-batch/scripts/lote.sh:*)
---

# spec-review-batch — pentomino-games

Un review de spec audita **uno** contra el repo. Este audita **N contra el repo y entre sí**.

Lo segundo es el entregable: una contradicción entre dos specs del lote no la ve ningún review suelto,
porque cada uno mira un archivo. Y acá sale barata — arreglarla es editar un `tasks.md`. La misma
contradicción sobrevive intacta hasta que dos ramas del lote se pisan, y ahí ya cuesta un rebase.

## Por qué no hay worktrees

Revisar el lote y **implementarlo** se abanican distinto, y confundirlos es el error caro:

|  | implementar el lote | revisarlo (acá) |
|---|---|---|
| Qué se abanica | una cadena de specs entera | **un spec** |
| Ancho | tantas cadenas como haya | **N, siempre** |
| Aislamiento | un worktree por cadena | ninguno: `specs/NNN-*/` ya es disjunta |
| Convergencia | merge de ramas, resuelve texto | el padre escribe lo compartido, resuelve semántica |
| Qué arregla un choque | una resolución de merge | **nada**: la última escritura gana en silencio |

Un review no compila, no corre y no toca código: lee el árbol y escribe adentro de la carpeta de su
spec. Esa disyunción es lo único que hace segura la concurrencia, y por eso la regla del Paso 3 no es
una precaución sino la condición.

**Una cadena de anclaje no serializa.** Implementar el 020 necesita el 019 *en el árbol*; revisarlo
necesita el 019 *escrito*, y ya lo está. Por eso el ancho es N aunque el `log.md` declare una fila.

---

## Paso 0 — Resolver el lote y los gates

`$ARGUMENTS`: números sueltos (`018 019 020 021`), un rango (`018-021`), o `--propuestos` = todos los
`Propuesto` de la tabla de `specs/log.md`. Sin argumentos, **preguntá**: no asumas los últimos.

- **Sacá los terminales.** `Descartado` y `Superado` no se revisan; decí cuáles sacaste.
- **Árbol limpio en `specs/`.** `git status --short specs/`. Sucio, las ediciones de N agentes se
  mezclan con trabajo previo y el `git diff` deja de ser el registro del review — que es lo único que
  lo hace auditable. Ofrecé commitear primero o correr `--dry`.
- **Loop activo.** `git worktree list`: el spec que tenga un worktree abierto cae a `--dry` **él solo**,
  no el lote. Al resto no se le mueve el piso por un vecino.

## Paso 1 — El preámbulo, destilado una vez

Es el ahorro propio del batch: sin esto, N reviews lo re-derivan N veces desde frío. Cuatro insumos, y
los cuatro se pasan **destilados**, no como rutas a leer:

- `spec_status` con los N números — estado, hechas/total y `pendientes` de todo el lote en una consulta.
- **El mapa síntoma → deuda** de `specs/deuda.md`, que es el eje D entero.
- Lo que `specs/revisiones.md` registra como *ya se probó y no funcionó* para el área del lote.
- Las convenciones verificables, **≤40 líneas**: `CLAUDE.md` + `.claude/rules/` de las capas que el lote
  toca.

## Paso 2 — El orden del lote es la base de anclaje

El eje A del review suelto pregunta *¿el spec describe el repo que existe?*. En un lote encadenado esa
pregunta está mal formulada para todos menos el primero: el 020 cita cosas que el 019 crea.

**La base de cada spec es `main` + los specs del lote que lo preceden.** Derivá el orden y pasáselo a
cada agente, o el lote devuelve una avalancha de citas rotas falsas.

1. Corré [`scripts/lote.sh`](./scripts/lote.sh) con los números del lote: da la matriz archivo × spec,
   las líneas de tarea que citan cada archivo compartido, y **los `X → Y` de cada `tasks.md`**, que es
   la arista que ningún import delata.
2. Contrastá contra «Dependencias entre specs» del `log.md`. Ese texto dice qué quiso el autor; la
   matriz dice qué archivos se pisan. **Si difieren, eso es hallazgo** y se edita el `log.md`.
3. Un spec que **declara tolerar** llegar antes que su dependencia sale de la cadena: es permiso
   escrito, no un olvido.

Con el orden en mano, el eje A cambia de forma para todo spec que no sea el primero:

- Una cita a algo que **no existe hoy** no es cita rota si un spec anterior del lote lo crea. El
  hallazgo es el inverso: que el anterior **no** lo cree.
- Una cita con número de línea a un archivo que un spec anterior reescribe **está podrida por
  construcción**. Se re-ancla a un símbolo, o el enunciado declara contra qué base vale.
- Un número que aparece como `X → Y`: el `X` de abajo tiene que ser el `Y` de arriba, no el de `main`.

## Paso 3 — N agentes de spec, más el de coherencia

Lanzá los **N+1 en un solo mensaje**. Más de ~6 specs conviene en tandas: el cuello no es el reloj, es
que el padre tiene que sostener los reportes para el Paso 4.

### El carril de coherencia

Su unidad de análisis es **el lote**, no el spec. Existe porque el padre no puede hacer ese trabajo:
converge sobre los N reportes, que están comprimidos a 40 líneas cada uno, y un cruce vive justo en el
detalle que ningún reporte comprimido menciona — un `else if` que apaga la rama que el spec de arriba
agrega no aparece en el resumen de ninguno de los dos.

- **Corre en paralelo con los demás**, no después: su insumo son los specs, que ya están escritos. No
  espera a que los reviews terminen, así que no cuesta reloj.
- **Es uno solo, y no se reparte por clase de cruce.** Lo único que lo hace funcionar es que hay una
  sola cabeza con los N specs enteros adelante; partirlo re-fragmenta exactamente eso.
- **Lee los specs crudos**, los N, más la salida de `lote.sh` y el orden derivado en el Paso 2.
- **No edita nada, ni siquiera dentro de una carpeta.** Cada hallazgo suyo abarca dos specs o más, y
  esas carpetas las están escribiendo los agentes de spec en este momento.
- **Su brief son las clases de [`cruces.md`](./cruces.md)**, y las recorre todas: devuelve también las
  que dieron que no, porque un cruce ausente es información y un cruce no mirado no.
- **Devuelve, por hallazgo:** la clase, los dos `path:línea`, qué AC queda infalsificable si nadie lo
  toca, y **en qué spec va la edición**. Sin ese último dato el padre no puede aplicar nada.

### Los agentes de spec

Uno por spec, cada uno con el preámbulo del Paso 1 y su base del Paso 2. Lo que tiene que auditar, y
es el piso —si el repo tiene un review de spec suelto, el agente lo corre y esto es lo mínimo que
espera de vuelta—:

- **Anclaje** — cada path, símbolo, firma y cita con número de línea existe hoy y dice lo que el spec
  afirma. Es el eje que más rinde y el que el Paso 2 reencuadra.
- **Superficie** — todo consumidor de lo que el spec modifica está en el alcance o explícitamente
  fuera. `find_symbol` da el `usedBy`, y cruza el borde hacia `mcp-server/`.
- **Convenciones** — los snippets del spec se leen como el diff que se va a mergear: si una regla del
  repo los rechazaría, el spec ya está mal.
- **Deuda** — traducir lo que el spec propone al mapa síntoma → deuda del preámbulo. Un spec nunca
  dice *replico la deuda 002*.
- **Criterios de aceptación** — cada uno falsable, con su contraparte en verificación, más el AC
  mecánico y el de no-regresión si hubo superficie compartida.
- **Estructura** — los cuatro archivos, las secciones canónicas, los `T0NN` sin renumerar, `[P]` que
  no miente y `[M]` donde hace falta.

Y este contrato, que es lo propio del batch:

> **No escribís fuera de `specs/<NNN>-*/`.** Ni `docs/`, ni `.claude/rules/`, ni `CLAUDE.md`, ni
> `specs/log.md`, ni `specs/revisiones.md`, ni `deuda.md`, ni el `tasks.md` de otro spec. Los tocan los
> N a la vez y no hay merge que lo arregle. Devolvelos como **edición propuesta**, con `path:línea` y
> el texto exacto.

Y devuelve dos cosas: su reporte, comprimido a **40–60 líneas** —veredicto en la primera, después los
bloqueantes con evidencia, y lo editado a conteos—, y esa lista de ediciones propuestas afuera. Sin la
lista, el Paso 5 no tiene qué aplicar.

## Paso 4 — Converger las dos vistas

Vuelven N reportes de spec y uno de coherencia, y **miran cosas distintas a propósito**. El padre no
re-audita: cruza.

- **En cualquier hallazgo que abarque dos specs, manda el de coherencia** — es el único que vio los dos
  lados. Un "cita rota" de un agente de spec que el de coherencia explica como *"la crea el 019"* no es
  hallazgo: es la base del Paso 2 funcionando.
- **Al revés también:** si el de coherencia apunta a una línea que el agente de ese spec ya editó, el
  cruce se re-escribe contra el texto nuevo antes de aplicarlo.
- **Si los dos contradicen al orden que derivaste en el Paso 2, gana la evidencia y decilo**: un orden
  mal derivado es un hallazgo sobre el `log.md`, no un detalle de proceso.

La asimetría del review vale igual acá: **endurecer se aplica** —un cruce que falta se escribe en el
`tasks.md` del spec que corresponda—; **aflojar se propone**. Si el cruce obliga a elegir entre dos
diseños, frená con `AskUserQuestion`: un párrafo ahora contra dos ramas rebaseadas después.

## Paso 5 — Aplicar lo compartido y reportar

El padre aplica las ediciones fuera-de-carpeta que juntó en el Paso 3, **una por hallazgo** y en serie,
para que el `git diff` se lea. **No commitea.**

El reporte, en este orden:

1. **Una tabla, una fila por spec:** veredicto (`listo` · `N advertencias` · `no implementar`),
   bloqueantes, y las ediciones comprimidas a conteos.
2. **Los cruces y qué se decidió** — el entregable propio de este skill, y casi todo el presupuesto.
3. **El orden que salió, y cuántas aristas del `log.md` resultaron falsas.**
4. Una línea de lo que no tuvo nada.

~50 líneas más la tabla. Los matices, el porqué y las mediciones **van a los specs**: el chat se pierde,
el spec queda.

---

## Lo que no hace

- **No revisa código.** Si el lote ya tiene implementación, eso es un review de PR.
- **No implementa, y no reparte el lote en carriles de trabajo.** Corre antes de eso, y su salida —el
  orden corregido y los cruces resueltos— es el insumo de quien lo implemente.
- **No mueve estados en `specs/log.md`** —los mueve el merge— ni commitea.
- **No es un barrido de staleness.** Si lo único que querés es saber qué specs quedaron viejos respecto
  del código de hoy, alcanza con anclaje y deuda sobre cada uno, sin editar y sin coherencia: sale
  mucho más barato que esto.

---
name: spec-review-batch
description: Revisa N specs de specs/ en paralelo —un agente por spec— más un carril de coherencia que caza las contradicciones ENTRE specs mientras todavía son texto editable. Usar al revisar dos o más specs de una. Para un spec solo, spec-review.
argument-hint: "<NNN NNN ...> | <NNN-MMM> | --propuestos [--dry]"
# `describe_piece` y `simulate_board` estuvieron acá y se fueron: ningún paso las nombraba.
# No costaban contexto —`allowed-tools` no entra al prompt del agente— pero le daban a un
# review la capacidad de simular un tablero, que no es lo suyo.
allowed-tools:
  - Agent
  - Skill
  - Read
  - Glob
  - Grep
  - Edit
  - AskUserQuestion
  - mcp__pentomino-domain__spec_status
  - mcp__pentomino-domain__spec_write
  - mcp__pentomino-domain__find_symbol
  - Bash(git status:*)
  - Bash(git worktree list:*)
  - Bash(git branch:*)
  # Las dos formas del comando —directa y por `sh`— y las dos rutas: la que escribe la
  # inyección de abajo con `${CLAUDE_SKILL_DIR}` ya expandido, y la relativa que tipea una
  # persona desde la raíz. El comodín del medio es lo que cubre la primera sin hardcodear
  # dónde está clonado el repo: la expansión está documentada para el CONTENIDO del
  # SKILL.md, no para estas reglas, y una regla que no expande no falla — deja de matchear
  # y pide permiso en cada corrida, que es peor porque es silencioso.
  - Bash(*spec-review-batch/scripts/lote.sh:*)
  - Bash(sh *spec-review-batch/scripts/lote.sh:*)
---

# spec-review-batch — pentomino-games

## Matriz del lote

<!-- Inyección dinámica: el comando corre ANTES de que el modelo procese este archivo, así que
     la matriz llega con el skill ya cargado en vez de costar un turno de tool (la llamada más
     su resultado). `lote.sh` entiende las tres formas del `argument-hint`, que es lo que deja
     pasarle `$ARGUMENTS` crudo sin un caso especial.

     Ruta por `${CLAUDE_SKILL_DIR}` y no literal. Acá decía lo contrario, y el motivo escrito
     era que el orden de la sustitución respecto de la inyección `!` no estaba documentado —
     una que no ocurre no degrada, hace fallar la carga. Hoy sí está documentado, y para
     exactamente este caso: «for scripts within bash injection commands». Verificado además
     cargando el skill, que es lo que faltaba.

     Lo que compra no es un token: es que el skill se pueda mover, renombrar o empaquetar sin
     editar su propio contenido, que es la otra mitad de que sea autocontenido. -->

!`${CLAUDE_SKILL_DIR}/scripts/lote.sh $ARGUMENTS`

---

Un review de spec audita **uno** contra el repo. Este audita **N contra el repo y entre sí**.

Lo segundo es el entregable: una contradicción entre dos specs del lote no la ve ningún review suelto,
porque cada uno mira un archivo. Y acá sale barata — arreglarla es una llamada a `spec_write`. La misma
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
necesita el 019 *escrito*, y ya lo está. Por eso el ancho es N aunque los specs se citen en fila.

---

## Paso 0 — Resolver el lote y los gates

`$ARGUMENTS`: números sueltos (`018 019 020 021`), un rango (`018-021`), o `--propuestos` = todos los
`Propuesto` de `specs/mapa.json` — los lista
[`scripts/specs-por-estado.mjs`](./scripts/specs-por-estado.mjs), que vive adentro de este skill
igual que `lote.sh`.
Sin argumentos, **preguntá**: no asumas los últimos.

- **Sacá los terminales.** `Descartado` y `Superado` no se revisan; decí cuáles sacaste.
- **Los specs del lote están en el disco.** Desde el spec 034 viven en issues y `specs/[0-9]*/` está
  en el `.gitignore`, así que el directorio es una **caché** que puede no estar:

  ```bash
  node .claude/scripts/hidratar-specs.mjs <NNN> <NNN> …
  ```

  Sin eso los agentes revisan un directorio vacío y **no falla**: revisan un spec que no leyeron.

  **Y esto reemplaza al viejo gate de «árbol limpio en `specs/`», que dejó de poder funcionar**:
  `git status --short specs/` ya no ve nada de `specs/[0-9]*/` porque está ignorado, así que decía
  «limpio» siempre. Lo que ese gate protegía —que el `git diff` fuera el registro auditable del
  review— **ya no aplica**: desde el 033 las escrituras van por `spec_write` al registro central, y
  desde el 034 el registro es el issue. El historial del review es el del issue.
- **Loop activo.** `git worktree list`: el spec que tenga un worktree abierto cae a `--dry` **él solo**,
  no el lote. Al resto no se le mueve el piso por un vecino. Y `--dry` ahora quiere decir **no llamar a
  `spec_write`**: la tool escribe en el registro central y no en el árbol de quien la llama, así que un
  worktree abierto ya no contiene la escritura como la contenía un `Edit`.

## Paso 1 — El preámbulo, destilado una vez

Es el ahorro propio del batch: sin esto, N reviews lo re-derivan N veces desde frío. Cuatro insumos, y
los cuatro se pasan **destilados**, no como rutas a leer:

- `spec_status` **sin argumento** — estado, hechas/total, `pendientes` y `cruces` de **todos** los specs
  en una consulta, y te quedás con los N. No toma una lista: acotarla cuesta una llamada por spec y lo
  único que agrega son las `citas`, que el preámbulo no usa. La respuesta entera pesa ~29 KB justamente
  porque no las trae.
- **El mapa síntoma → deuda**, que sale de los **issues abiertos** (`mcp__github__list_issues`) y es
  el eje D entero.
- Lo que las **notas de revisión** registran como *ya se probó y no funcionó* para el área del lote.
  Viven como comentarios en el issue de cada spec: `gh issue view <N> --json comments`.
- Las convenciones verificables, **≤40 líneas**: `CLAUDE.md` + `.claude/rules/` de las capas que el lote
  toca.

## Paso 2 — El orden del lote es la base de anclaje

El eje A del review suelto pregunta *¿el spec describe el repo que existe?*. En un lote encadenado esa
pregunta está mal formulada para todos menos el primero: el 020 cita cosas que el 019 crea.

**La base de cada spec es `main` + los specs del lote que lo preceden.** Derivá el orden y pasáselo a
cada agente, o el lote devuelve una avalancha de citas rotas falsas.

1. **La matriz ya está arriba**, inyectada por [`scripts/lote.sh`](./scripts/lote.sh) al cargar este
   archivo: matriz archivo × spec y las líneas de tarea que citan cada archivo compartido. No la
   vuelvas a pedir por Bash — ya la tenés. Si arriba salió un mensaje de uso en vez de la matriz, el
   lote está mal escrito y eso se resuelve en el Paso 0.
2. **Los `X → Y` salen del campo `cruces` del `spec_status` del Paso 1** —`{tarea, de, a}`, ya
   pareados y con la tarea que los declara al lado—, que es la arista que ningún import delata. Vienen
   como **string** y no como número a propósito: hay pares con coma decimal (`4,0 → 11,8`,
   `0,02 → 0,05`) que un `Number()` convierte en `NaN`. Son **7 en todo el repo**, o sea que cruzarlos
   a mano es barato — lo caro era encontrarlos. Los 7 salen de la **línea de la tarea** y no de su
   prosa de abajo: contando también las continuaciones son 25, y los 18 de más son frecuencias y
   números de spec que inventarían una dependencia dura donde no hay ninguna.
3. Contrastá contra los `cruces` que devuelve `spec_status`: los pares `X → Y` de cada `tasks.md`, o
   sea los números que un spec mueve de un valor a otro. Eso dice qué quiso el autor; la matriz dice
   qué archivos se pisan. **Si difieren, eso es hallazgo**, y se corrige en el `tasks.md` del spec.

   Hasta el spec 035 esto se contrastaba contra una lista de dependencias escrita a mano en `log.md`.
   Se borró en vez de mudarse: era la copia a mano de un dato que la tool ya calcula.
4. Un spec que **declara tolerar** llegar antes que su dependencia sale de la cadena: es permiso
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
  no miente, y ninguna tarea que sólo se cierre mirando o escuchando: desde el 039 eso se vuelve
  verificable o no se anota, y ya no se marca `[M]`.

Y este contrato, que es lo propio del batch:

> **No escribís fuera de `specs/<NNN>-*/`.** Ni `docs/`, ni `.claude/rules/`, ni `CLAUDE.md`, ni
> `specs/mapa.json`, ni los issues de los specs. Los tocan los
> N a la vez y no hay merge que lo arregle. Devolvelos como **edición propuesta**, con `path:línea` y
> el texto exacto. **Tampoco abrís ni cerrás issues**, por lo mismo: el padre los consolida.
>
> **Y «otro spec» ya no es una ruta sino un argumento: `spec_write` sólo con tu propio número.**
> Cuando escribir en el spec del vecino era abrir un archivo suyo, respetar la carpeta propia alcanzaba
> para que no pasara. Con la tool el spec ajeno es el parámetro `spec` de una llamada que ya tenés
> permitida, así que nada en la forma de la operación delata que estás escribiendo afuera — la única
> barrera que queda es esta línea.

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
  mal derivado es un hallazgo sobre el `tasks.md` que lo declara, no un detalle de proceso.

La asimetría del review vale igual acá: **endurecer se aplica** —un cruce que falta se escribe con
`spec_write` (`op: "seguimiento"`) en el spec que corresponda, y el `texto` tiene que decir qué se
encontró y con qué evidencia, porque el ID lo pone la tool y esa línea es todo lo que queda del
hallazgo—; **aflojar se propone**. Si el cruce obliga a elegir entre dos
diseños, frená con `AskUserQuestion`: un párrafo ahora contra dos ramas rebaseadas después.

> **Y por eso este skill NO lleva `context: fork`.** Correrlo forkeado sacaría de esta conversación
> los N+1 reportes y la convergencia entera, que es el gasto de contexto más grande del skill — es
> tentador y está medido. Pero `AskUserQuestion` **no existe en un subagente** (docs de Claude Code,
> *user-input · Limitations*: «it is not available in subagents spawned via the Agent tool»), así que
> el fork no rechazaría esta línea: la ejecutaría eligiendo solo, en silencio, exactamente en el punto
> donde el skill decidió no elegir.
>
> El gate del Paso 0 —«sin argumentos, preguntá»— cae por lo mismo.
>
> Forkearlo pide primero mover las dos preguntas a los bordes: que el fork **devuelva** las decisiones
> pendientes en su reporte y el padre las pregunte y aplique. Es viable —el Paso 3 ya obliga a los
> agentes a devolver ediciones con `path:línea` y texto exacto, que es justo lo que el padre
> necesitaría— pero cambia el contrato del skill: las preguntas pasan de bloquear a diferirse. Es una
> decisión, no una optimización, y hasta que se tome el fork queda afuera.

## Paso 5 — Aplicar lo compartido y reportar

El padre aplica las ediciones fuera-de-carpeta que juntó en el Paso 3, **una por hallazgo** y en serie,
para que el `git diff` se lea, y las llamadas a `spec_write` van también de a una — aunque el motivo
no es el que parece. **No hay carrera**: el handler de la tool es síncrono y el server es un solo
proceso, así que el leer-modificar-escribir del `tasks.md` no se interrumpe y dos seguimientos no
pueden derivar el mismo `T0NN`. Lo que la serie compra es el **orden**: los IDs quedan en el orden en
que se decidieron los hallazgos y no en el que contestaron las llamadas. **No commitea.**

El reporte, en este orden:

1. **Una tabla, una fila por spec:** veredicto (`listo` · `N advertencias` · `no implementar`),
   bloqueantes, y las ediciones comprimidas a conteos.
2. **Los cruces y qué se decidió** — el entregable propio de este skill, y casi todo el presupuesto.
3. **El orden que salió, y cuántas de las aristas que los specs declaran resultaron falsas.**
4. Una línea de lo que no tuvo nada.

~50 líneas más la tabla. Los matices, el porqué y las mediciones **van a los specs**: el chat se pierde,
el spec queda.

---

## Lo que no hace

- **No revisa código.** Si el lote ya tiene implementación, eso es un review de PR.
- **No implementa, y no reparte el lote en carriles de trabajo.** Corre antes de eso, y su salida —el
  orden corregido y los cruces resueltos— es el insumo de quien lo implemente.
- **No mueve estados en `specs/mapa.json`** —los mueve el merge— ni commitea.
- **No es un barrido de staleness.** Si lo único que querés es saber qué specs quedaron viejos respecto
  del código de hoy, alcanza con anclaje y deuda sobre cada uno, sin editar y sin coherencia: sale
  mucho más barato que esto.

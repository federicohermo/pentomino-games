# El método — encontrar sin generar ruido

Lo carga cada agente de PR al empezar a buscar. Está afuera del `SKILL.md` por dos motivos: no le
cuesta contexto al padre, que no busca hallazgos, y el padre le pasa **la ruta** a los N agentes en vez
de inlinear cien líneas en cada prompt.

Lo que separa un review útil de una lista de ruido está acá, no en la cantidad de hallazgos.

## Los ejes

`scripts/diff-pr.sh` decide cuáles se abren, midiendo sobre el `.diff`. **Un eje que salió `no` no se
revisa** — no le busques hallazgos.

| Eje | Qué buscás en este repo |
|---|---|
| **Correctness** (siempre) | bugs alcanzables por el flujo real: colocar, rotar, reflejar, mutear, borrar, transporte corriendo y parado |
| **Convenciones** (siempre) | **solo lo que el linter no puede ver** — abajo está la línea |
| **Prosa** (docs + comentarios) | el eje que más rinde acá; ver abajo |
| **Manejo de errores** | `catch` vacíos, errores tragados sin `console.warn` ni feedback, fallbacks que enmascaran la causa |
| **Tipos** | ¿se puede construir un valor inválido que el tipo acepte? Conjunto cerrado sin union type derivado |
| **Cobertura** | lógica nueva sin test que la ejercite. **Pero el umbral es 100 y lo verifica `suite`**: una brecha real de líneas ya salió en rojo antes que vos. Lo que queda es lo que el 100% no dice — ver abajo |
| **Cleanup** (opt-in, `--cleanup`) | simplificación y duplicación; nunca bloquea el merge |

### Convenciones: dónde está la línea

Desde el spec 030 el linter verifica **por ruta** casi todo lo que `CLAUDE.md` declara. Reportar a
mano lo que `pnpm verify` ya rechaza es ruido con costo: el PR no puede haber llegado verde con eso
adentro.

| Ya lo verifica el linter — **no lo reportes** | Nadie lo verifica — **es tuyo** |
|---|---|
| dirección de dependencia entre capas y dentro de `domain/` | que el comentario explique el **porqué** y no el qué |
| extensión explícita en las cuatro formas de import | español en comentarios, commits y specs |
| `enum`, `any`, `@ts-ignore`, `eslint-disable` | que los borrados vayan en su propio commit |
| estado global (paquete y `createContext`) | que un cambio de firma se haya propagado al spec, al plan y a los docs |
| constantes fuera de `<capa>/constants/` en `domain/` y `audio/` | que el AC del spec sea falsable y esté cubierto |
| `.only` / `.skip` y el test sin aserción | que el valor nuevo no duplique uno que ya existe con otro nombre |

La regla corta: **si el linter, el typechecker o el coverage lo atrapan, CI ya lo corrió.** No lo
corras vos.

### Prosa: el eje que más rinde en este repo

Medido en la corrida del 2026-08-21 sobre cinco PR: **17 de 21 hallazgos fueron texto que dejó de ser
cierto**, no código roto. Y en **cinco** de esos casos el número corregido ya estaba escrito en el
propio spec del PR — el PR se corrigió a sí mismo en un archivo y se olvidó del otro.

De ahí las dos sondas, en este orden, las dos baratas:

1. **Cruzá cada afirmación numérica contra el spec del propio PR.** `diff-pr.sh` te deja la lista de
   las que el diff agrega. `specs/NNN-*/research.md` es donde vive la medición; si el doc dice otro
   número que el research, gana el research y el doc es el hallazgo.
2. **Buscá el gemelo del párrafo que el PR sí actualizó.** Un cambio acá se anuncia en dos o tres
   registros a la vez —`CLAUDE.md`, `docs/architecture/directory-structure.md`, `README.md`,
   `specs/mapa.json`— y es habitual que actualicen uno y se olviden del resto.
   Grepeá la clave del cambio (el número del spec, el nombre del archivo, la cifra vieja) contra esos
   cuatro. Los tres hallazgos de conteo de archivos de la corrida salieron todos así.

Un comentario o un doc que ya contradice al código de al lado es **🔴, no 🟡**: el repo trata la prosa
como parte del contrato, y `CLAUDE.md` se carga en cada sesión.

### Cobertura: lo que el 100% no dice

Las cuatro métricas en 100 son piso, no techo — ya está medido en este repo que **4 de 18 mutantes
sobreviven con las cuatro en 100**. Así que la pregunta no es *¿está cubierto?* sino *¿el test
fallaría si la línea estuviera mal?*. Un test que ejecuta la rama sin afirmar sobre su efecto es
cobertura sin verificación, y ese sí es hallazgo.

## Filtro de confianza

Puntuá cada hallazgo de 0 a 100 y **descartá todo lo que quede por debajo de 80**:

- **0** — falso positivo que no aguanta escrutinio liviano, o problema preexistente que el diff no
  introdujo.
- **25** — podría ser real pero no lo verificaste. Si es estilístico y no está en `CLAUDE.md` ni en
  `.claude/rules/`, no existe.
- **50** — verificado como real, pero es nitpick o pasa poco en la práctica.
- **75** — verificado, se golpea de verdad, y el enfoque actual del PR no alcanza. O está nombrado
  explícitamente en las convenciones del repo.
- **100** — confirmado con evidencia directa.

### Falsos positivos típicos — no van al reporte

- Problemas **preexistentes** en líneas que el PR no tocó.
- Cualquier cosa de la columna izquierda de la tabla de convenciones.
- Un presupuesto de performance que falló bajo contención. Es el modo de falla del spec 029, está
  documentado, y **no es un hallazgo del PR** — el protocolo para distinguirlo está en el `SKILL.md`.
- Nitpicks que un senior no marcaría.
- Cambios de comportamiento que evidentemente **son la intención del PR**. Contra eso está el spec:
  si el spec lo pide, no es bug.
- Reclamar un test de navegador para algo que `environment: 'node'` cubre, o al revés. El
  discriminante es el sufijo `*.browser.test.tsx` y el motivo es que jsdom no puede.

### Verificá la premisa antes de reportar

Si el hallazgo depende de una premisa sobre el entorno —una config, un flag, una versión, un default
de plataforma—, **comprobá la premisa**. Un grep de cinco segundos descarta la mitad de los 🔴
candidatos, y reportar uno cuesta además un fix innecesario.

## Preguntarle al dominio en vez de grepearlo

El MCP del repo levanta solo y **ejecuta las funciones puras reales**, así que no hay staleness. Usalo
antes que `grep`:

| Necesidad del review | Tool |
|---|---|
| **Medir el alcance** de un símbolo que el diff toca — quién lo usa | `find_symbol` (trae `usedBy`, y cruza el borde hacia `mcp-server/`) |
| Ubicar una firma sin abrir el archivo | `find_symbol` |
| Saber qué falta de verdad del spec del PR | `spec_status` |
| Después de un fix que toca geometría, `SHAPES` o el modelo musical | `check_invariants` |
| Antes de derivar a mano una rotación, escala o retrógrado | `describe_piece` |
| Antes de recorrer el lookahead a mano | `simulate_board` |

**El alcance es lo que más rinde**: el bug suele vivir en el consumidor y no en el archivo tocado, y
el fan-out de `usedBy` es lo que calibra la severidad. `mcp-server/` importa 31 símbolos de `domain/`:
un PR que cambia una firma tiene una arista que ningún import de `src/` delata.

## Política de triage — al aplicar los fixes

"Arreglá todo" es la forma más rápida de romper el PR.

| Clase | Qué hacer |
|---|---|
| 🔴 Bloqueante | **se arregla siempre** |
| 🟡 con fix acotado que no toca lo que el PR garantiza | se arregla |
| 🟡 cuyo fix pelea con un AC o con el invariante del propio PR | **no se toca** — se declara y se escribe al `## Seguimiento (no bloquea)` de ese spec con `mcp__pentomino-domain__spec_write` (`op: "seguimiento"`); el `T0NN` lo numera la tool |
| 🟡 preexistente que el diff solo agrava | se arregla **solo** si el archivo ya está tocado por el PR |
| AC que pide una persona (`[M]`) | no se puede arreglar — se declara pendiente |

**El `## Seguimiento` es el destino, no el chat.** Un 🟡 que no se aplica y solo se cuenta en el
reporte se pierde con la conversación; escrito con `spec_write` sobrevive **aunque el PR no se
mergee** —la escritura es al registro central y no al worktree— y `spec_status` lo descuenta. El
`texto` tiene que decir qué se encontró y con qué evidencia: es lo único que va a quedar cuando el
diff ya no esté. Y el precio de esa centralización, que está en el `SKILL.md`: el reviewer del PR
**ya no lo ve en el diff**, así que va sí o sí al reporte.

**Propagá cada fix a todo lo que lo describe.** Un cambio de firma toca el código **y** el `spec.md`,
cada doc que muestre el snippet viejo, y las tareas del spec que lo nombran. Eso último no se busca
abriendo archivos: `spec_status` acotado al spec devuelve las `citas` —qué tarea nombra qué archivo y
en qué línea—, y como la tool sólo sabe marcar y agregar seguimiento, una tarea cuyo texto quedó viejo
se anota con `op: "seguimiento"` en vez de reescribirse. Un fix de código que deja mintiendo a la doc
del propio PR es medio fix — y en este repo es exactamente el hallazgo que más apareció.

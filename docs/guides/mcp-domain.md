# MCP server: el dominio ejecutable

Un servidor MCP dentro del repo que **importa las funciones puras reales y las ejecuta**. No indexa
código: la fuente de verdad es `HEAD` en el momento de la consulta, así que no hay paso de indexado, no
hay staleness y no hay nada que sellar. Si alguien cambia `notesForRotation`, la tool responde distinto
en la consulta siguiente.

Vive en [`mcp-server/`](../../mcp-server/README.md) como paquete aparte del workspace. El spec que lo
motivó es el [006](../../specs/006-mcp-server-de-dominio-ejecutable/spec.md).

## Setup

```bash
pnpm install          # desde la raíz: el workspace instala la app y el server
pnpm mcp:test         # typecheck + node --test
```

Nada más. `.mcp.json` está commiteado en la raíz, así que abrir el repo con Claude Code levanta el
server sin configurar nada.

**Requiere Node ≥ 22.18**, por encima del ≥ 22.12 que pide Vite: el server corre TypeScript sin
compilar, quitando los tipos. Es tooling de desarrollo — no entra al bundle ni al deploy, así que con
Node 20 el server no arranca y **el repo sigue funcionando igual**.

## Las cuatro tools

| Tool | Responde | En lugar de |
|---|---|---|
| `describe_piece` | forma transformada, ASCII con el ancla marcada, tónica, escala y las 5 notas con el retrógrado aplicado | componer cuatro puras a mano sobre cinco pares de coordenadas |
| `simulate_board` | validez de cada colocación, los jobs que crearía el efecto de reconciliación, y la línea de tiempo de onsets del scheduler real | leer el scheduler y recorrer el lookahead a mano, o escuchar |
| `check_invariants` | los chequeos de `domain/invariants.ts` sobre las 96 combinaciones, con contraejemplos | correr los tests y leer la salida |
| `spec_status` | por spec: estado, tareas hechas/total y la próxima sin marcar | leer `log.md` + todos los `tasks.md` (24 KB) |

**Ninguna reimplementa nada.** `simulate_board` llama a `cellsAt`/`isValid`/`phaseFor` de
`domain/board.ts`; `check_invariants` llama a `checkAll()`; `describe_piece` llama a
`rotateN`/`reflect`/`notesForRotation`. Lo único propio del server es el render ASCII, el parseo de los
specs y el formato de las respuestas.

## Cuándo preferirlas a leer el código

La regla corta: **localizar es barato en este repo; simular el modelo no.** `src/` entra en un par de
reads y cualquier "¿dónde está X?" se resuelve con un `grep`. Lo caro es responder qué produce el
modelo, y ahí la simulación mental además **no avisa cuando sale mal**.

Preguntar en vez de leer cuando la pregunta es:

- *¿Qué notas suenan con la pieza `Z` rotada 270° y reflejada?* → `describe_piece`. A mano hay que
  aplicar la fórmula de escala, el corrimiento de octava y el retrógrado, en ese orden.
- *¿Qué forma tiene la `F` rotada 180°, y dónde queda su celda de agarre?* → `describe_piece`.
- *¿Este tablero suena apilado o desfasado?* → `simulate_board`, y mirar `coincident.maxPerInstant`.
  Es la diferencia entre textura y volumen, y es lo que el [spec 004](../../specs/004-fase-por-pieza-la-columna-como-posicion-en-el-compas/spec.md)
  hizo audible.
- *¿Rompí algo del modelo?* → `check_invariants`, antes y después de tocar geometría o piezas.
- *¿En qué quedó el trabajo planificado?* → `spec_status`.

Y **leer el código igual** cuando la pregunta es por qué algo está hecho así: eso vive en los
comentarios, no en la salida de una tool.

## Dos trampas que las tools evitan

1. **La letra describe la forma, no el sonido.** La pieza `F` suena con tónica C; la nota F le
   corresponde a la pieza `T`. Un agente que responda de memoria las confunde; `BASE_MAP` ejecutado, no.
2. **La reflexión no siempre se ve.** Siempre invierte las notas, pero deja la forma idéntica en `I` y
   `X` (las cuatro rotaciones) y en `T` y `U` (rotaciones 0 y 180°). En `V` y `W` sí cambia la forma —
   lo que no cambia es el conjunto de formas alcanzables, porque cae sobre otra rotación.

## Cuánto ahorra, medido

Pregunta de referencia: *"¿qué notas y qué forma da la `Z` en 270° reflejada, y qué onsets produce si la
pongo en `x=1` y otra pieza en `x=5`?"*

| | Bytes | ~Tokens |
|---|---|---|
| Leyendo el código: `domain/{transform,music,board}` + sus `constants/` + `audio/scheduler` + sus constantes | 14.999 | ~3.750 |
| Con las tools: `describe_piece` (414) + `simulate_board` (1.189) | **1.603** | **~400** |
| Catálogo de las cuatro tools, una vez por sesión | 4.863 | ~1.215 |

**89% menos por pregunta**, y el catálogo se paga con la primera. Lo que no aparece en la tabla es lo
que más importa: leyendo el código, la respuesta todavía hay que **derivarla a mano** —tres rotaciones,
un espejo, la escala transpuesta +7, el retrógrado y el recorrido del lookahead— y nadie avisa si sale
mal.

## Verificar que anda

```bash
pnpm mcp:test                    # typecheck + los 36 tests del server
node mcp-server/src/index.ts     # arranca por stdio; se queda esperando (Ctrl+C para salir)
```

Si el server no arranca, empezar por
[troubleshooting](./troubleshooting.md#el-mcp-server-no-arranca-err_module_not_found).

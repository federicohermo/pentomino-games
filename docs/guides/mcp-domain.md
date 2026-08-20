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

## Las cinco tools

| Tool | Responde | En lugar de |
|---|---|---|
| `find_symbol` | dónde está definido un símbolo de `src/` (archivo, línea, firma, primera frase del doc) y qué archivos lo importan, `mcp-server/` incluido | `grep` + abrir el archivo para ver la firma |
| `describe_piece` | forma transformada, dos ASCII —uno con el ancla marcada, otro con el **paso** de cada celda—, tónica, escala, `cellMap` (grado **y** paso por celda) y las 5 notas con el retrógrado aplicado | componer cuatro puras a mano sobre cinco pares de coordenadas |
| `simulate_board` | validez de cada colocación, el orden del circuito con sus saltos, y la línea de tiempo de notas y clicks que produce el recorrido | leer el scheduler y recorrer el lookahead a mano, o escuchar |
| `check_invariants` | los cinco chequeos de `domain/invariants.ts`, con contraejemplos y el espacio del modelo (96 orientaciones) | correr los tests y leer la salida |
| `spec_status` | por spec: estado, tareas hechas/total, cuántas de las abiertas no son deuda (`Seguimiento`, `[M]`, spec terminal) y la próxima que de verdad falta | leer `log.md` + todos los `tasks.md`, que crecen con cada spec |

**Ninguna de las cuatro de dominio reimplementa nada.** `simulate_board` llama a `cellsAt`/`isValid` de
`domain/board.ts` y a `buildSequence` de `domain/sequence.ts` para armar el circuito; `check_invariants`
llama a `checkAll()`; `describe_piece` llama a `rotateN`/`reflect`/`notesForRotation`. Lo único propio
del server es el render ASCII, el parseo de los specs, el índice de símbolos y el formato de las
respuestas.

`find_symbol` es la excepción y conviene tenerla clara: **es la única que mira el código como texto en
vez de ejecutarlo**, porque "dónde está X y quién lo usa" no se contesta ejecutando nada. Mantiene la
propiedad que importa igual — construye el índice **en la consulta** y no lo persiste, así que no hay
artefacto que regenerar ni que pueda quedar viejo.

## Cuándo preferirlas a leer el código

La regla corta: **simular el modelo es caro, y localizar dejó de ser gratis.** Lo caro sigue siendo
responder qué produce el modelo, y ahí la simulación mental además **no avisa cuando sale mal**. Pero la
otra mitad de la regla cambió y está medida: cuando se escribió el
[spec 006](../../specs/006-mcp-server-de-dominio-ejecutable/spec.md), `src/` eran 8 archivos y 855
líneas y cualquier "¿dónde está X?" se resolvía con un `grep` barato. Hoy —después de que el
[spec 005](../../specs/005-modularizacion-de-src-en-capas/spec.md) partiera `App.tsx` en capas— son
**38 archivos, 1.303 líneas de fuente y 84 símbolos exportados** —78 si se dejan afuera los `__tests__/`,
que es lo que el índice muestra por defecto. Localizar sigue siendo fácil para una
persona; lo que dejó de ser barato es el **costo en tokens** de localizar leyendo.

Preguntar en vez de leer cuando la pregunta es:

- *¿Qué notas suenan con la pieza `Z` rotada 270° y reflejada?* → `describe_piece`. A mano hay que
  aplicar la fórmula de escala, el corrimiento de octava y el retrógrado, en ese orden. Desde el
  [spec 017](../../specs/017-el-regimen-de-rotacion/spec.md) la pregunta **no está completa sin el
  régimen**: `describe_piece` y `simulate_board` lo aceptan como argumento —default `escala`, el de la
  app— y lo **devuelven** en la respuesta, porque en 36 de las 48 combinaciones de pieza × rotación las
  mismas cinco notas tienen dos respuestas correctas.
- *¿Qué forma tiene la `F` rotada 180°, y dónde queda su celda de agarre?* → `describe_piece`.
- *¿Este tablero suena como un recorrido continuo o con saltos largos?* → `simulate_board`, y mirar el
  orden del circuito, sus saltos y el largo del ciclo. Es lo que el
  [spec 009](../../specs/009-el-tablero-como-recorrido/spec.md) hizo audible.
- *¿Rompí algo del modelo?* → `check_invariants`, antes y después de tocar geometría o piezas.
- *¿En qué quedó el trabajo planificado?* → `spec_status`.
- *¿Dónde está `cellsAt` y quién lo usa?* → `find_symbol`, **no `grep`**. Trae la firma, así que no hay
  que abrir el archivo, y `usedBy` sale del grafo de imports: un archivo que lo llama quince veces
  aparece una vez, y un homónimo de otro módulo no aparece.
- *¿Qué exporta `src/` en total?* → `find_symbol` sin argumentos: el mapa entero en ~2 KB.

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
| Leyendo el código: `domain/{transform,music,board,sequence}` + sus `constants/` y `types/` + `audio/scheduler` + sus constantes | 48.565 | ~12.141 |
| Con las tools: `describe_piece` (621) + `simulate_board` (2.064) | **2.685** | **~671** |
| Catálogo de las cinco tools, una vez por sesión | 6.787 | ~1.697 |

Las dos primeras filas se re-midieron con el spec 009 y **la brecha se ensanchó**: la respuesta de
`simulate_board` creció de 1.189 a 2.064 bytes porque ahora lleva el camino de cada salto, pero el
código a leer creció mucho más —de 14.999 a 48.565— y encima ya no alcanza con esos archivos, porque
el orden y los silencios salen de `sequence.ts`. La fila del catálogo es la medición del spec 006 y no
se volvió a tomar: se serializa a través del SDK y no con el mismo método que las otras dos.

**94% menos por pregunta**, y el catálogo se paga con la primera. Lo que no aparece en la tabla es lo
que más importa: leyendo el código, la respuesta todavía hay que **derivarla a mano** —tres rotaciones,
un espejo, la escala transpuesta +7, el retrógrado y el recorrido del lookahead— y nadie avisa si sale
mal.

### `find_symbol` contra `grep`

Pregunta de referencia: *"¿dónde está `notesForRotation` y quién depende de él?"*

| | Bytes | Qué deja |
|---|---|---|
| `grep -rn notesForRotation src/ mcp-server/src/` | 4.544 | 40 hits, la mayoría call-sites repetidos del mismo test |
| + abrir `domain/music.ts` (hace falta para la firma) | 1.663 | |
| **Camino `grep`** | **6.207** | |
| `find_symbol("notesForRotation")` | **433** | definición, línea, firma, doc y los 4 archivos que lo importan |

**14x menos.** Su entrada del catálogo cuesta 1.705 bytes y ahorra ~5.774 por consulta, así que también
se paga con la primera. El índice completo —los 78 símbolos no-test agrupados por archivo— son 1.993
bytes.

El `grep` de la comparación barre los dos paquetes porque es lo que hace falta para igualar la
respuesta: `usedBy` incluye a `mcp-server/`, y ahí está justamente la parte que es fácil olvidar.

Costo de construirlo: **112 ms** la primera consulta, ~50 ms las siguientes, sobre 36 archivos
indexados más 16 que solo aportan aristas. Es lo que permite no persistirlo. El día que eso duela, la
respuesta es cachear por `mtime`, no generar un artefacto que alguien tenga que regenerar.

### El alcance del grafo, y por qué es asimétrico

Se **indexan** los símbolos de `src/`; se **leen los imports** de `src/` y de `mcp-server/src/`. La
asimetría es a propósito: las tools importan 31 símbolos del dominio, así que sin esa segunda raíz
`usedBy` contestaba 2 usuarios donde hay 4 — y quedaba *menos* completa que el `grep` que vino a
reemplazar. Sus exports, en cambio, no entran al mapa: el índice describe la superficie de `src/`, y
las tools no son parte de la app.

### Qué casa el grafo, y qué no

`usedBy` cruza el **nombre exportado** contra el **archivo resuelto**, y las dos mitades tienen su
trampa. Un `import { isValid as esValida }` importa a `isValid`: el segundo nombre es solo cómo se llama
del lado de acá, así que lo que se guarda es `propertyName`. Y un `import Board from './Board.tsx'` no
trae ningún nombre —del lado del export el símbolo no tiene uno—, así que el binding por defecto se
marca aparte y se casa solo por archivo; casarlo por nombre daría falso apenas alguien lo renombre al
importarlo, que es lo que `src/main.tsx` no hace y `App.tsx` sí podría. Los dos casos importan acá: los
seis `export default` de `src/` son `App` y los cinco componentes, o sea la capa de UI entera.

Lo que el grafo **no** ve es `import * as x`: un namespace no dice qué símbolo se usa. Hoy `src/` no
tiene ninguno; si aparece, `usedBy` va a sub-reportar en silencio.

`includeTests` filtra las **dos** puntas —los matches y los usuarios—, no solo `usedBy`. Filtrar una
sola devolvía los helpers de `audio/__tests__/test-context.ts` como símbolos huérfanos de `src/`, y una
coincidencia exacta dentro de un test tapaba la búsqueda por subcadena de un símbolo real.

Ojo con qué problema resuelve esto y cuál no. Romper una firma del dominio **no pasa silencioso**: el
tsconfig del server typechequea cruzando el borde de paquete (por eso su `lib` incluye `DOM`) y
`pnpm verify` falla señalando `describePiece.ts` y `simulateBoard.ts`. Lo que la segunda raíz arregla
es el *input de planificación* — que al dimensionar un cambio la respuesta no diga 2 cuando son 4.

## Verificar que anda

```bash
pnpm mcp:test                    # typecheck + los tests del server
node mcp-server/src/index.ts     # arranca por stdio; se queda esperando (Ctrl+C para salir)
```

Si el server no arranca, empezar por
[troubleshooting](./troubleshooting.md#el-mcp-server-no-arranca-err_module_not_found).

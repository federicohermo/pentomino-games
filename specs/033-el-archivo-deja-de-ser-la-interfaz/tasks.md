# Tasks — Spec 033

## Paso 1 — Las dos lecturas que le faltan a `spec_status`

- [x] T001 [P] `TasksInfo` gana `citas` en `mcp-server/src/specs.ts`: por tarea, los archivos que
      nombra entre backticks. Sale del recorrido que `parseTasks` ya hace — **AC1**
- [x] T002 [P] `TasksInfo` gana `cruces`: los pares `X → Y`. El regex se fija contra los casos reales
      del repo (`002 → 43`, números sueltos y no siempre entre backticks) y no contra el ideal — **AC2**
- [x] T003 `parseTasks` sigue siendo `(md: string) => TasksInfo`. Si el cambio pide otra firma, el
      diseño está mal: es lo que mantiene barato el spec siguiente — **AC5**
- [x] T004 [P] Tests de `citas` en `mcp-server/src/__tests__/specs.test.ts`, con el falso positivo que
      `calibracion.md:21` avisa: una tarea que nombra un doc **porque hay que actualizarlo**
- [x] T005 [P] Tests de `cruces`, incluido el caso de un `tasks.md` sin ninguno
- [x] T006 `spec_status` expone los dos campos nuevos en su respuesta, y su descripción los nombra

## Paso 2 — La tool de escritura

- [x] T010 Tool nueva en `mcp-server/src/tools/`, con las dos operaciones y ninguna más:
      `marcar` y `seguimiento` — **AC3**
- [x] T011 `seguimiento` deriva el `T0NN` **siguiendo desde el mayor**, sin reusar IDs libres
      (`specs/README.md`, «un ID reusado rompe la referencia que otra tarea le hacía»)
- [x] T012 `marcar` falla con un mensaje que dice qué pasó si la tarea no existe o ya está marcada.
      Marcar lo que no se hizo es lo que este repo acaba de arreglar en `log.md`
- [x] T013 La escritura cae en el registro central y no en el worktree — **D1**
- [x] T014 [P] Tests de las dos operaciones, con el caso del ID que sigue y el de la tarea ausente
- [x] T015 Registrar la tool en `mcp-server/src/tools/index.ts`

## Paso 3 — Las cinco skills

- [x] T020 `spec-implement`: marcar pasa por la tool. Es la más chica y valida la escritura primero
- [x] T021 `spec-implement-batch`: marcar, escribir decisiones, y leer citas y cruces por la tool.
      Ejercita las cuatro cosas nuevas a la vez
- [x] T022 `pr-review-batch`: las cinco escrituras de seguimiento pasan por la tool. Es la que paga
      **D1**, así que su texto tiene que decir que el hallazgo ya no viaja en el diff del PR
- [x] T023 `spec-review-batch`: tres escrituras y la lectura de cruces
- [x] T024 `spec-review`: alinear el resto con lo que su propia tabla ya dice
- [x] T025 **No se toca** `spec-review/SKILL.md:37-39` (contrato de formato) ni
      `pr-review-batch/SKILL.md:32` (los AC salen de `spec.md`). Son prosa y siguen siendo ciertas
- [x] T026 Leer las cinco y confirmar que no queda ninguna ruta a abrir. **Se verifica leyendo, no
      grepeando**: el grep no distingue la prosa de la operación — **AC4**

## Paso 4 — Verificación

- [x] T030 `pnpm verify` en verde — **AC8**
- [x] T031 `mcp:test` en 100 en las cuatro métricas, con las tools nuevas cubiertas — **AC7**
- [x] T032 Confirmar que no se tocó un solo archivo de `src/` — **AC8**
- [ ] T033 [M] Correr `/spec-implement` sobre este mismo spec: es el primer consumidor de la tool que
      acaba de escribir, y si algo no cierra se ve ahí
- [x] T034 Actualizar la fila del 033 en `specs/log.md` a `Implementado` — **queda abierta a
      propósito**: el estado lo mueve el merge. Y en este spec la nota es doble, porque el registro
      acaba de demostrar que ese mecanismo falló **diez de diez veces**
- [x] T035 Commit, push y PR contra `origin`
- [ ] T036 [M] Code review del PR

## Seguimiento (no bloquea)

- [ ] T040 **El spec siguiente**: `.gitignore` sobre `plan.md` y `tasks.md`, el backend de issues y el
      mapa spec↔issue. Su parte difícil es el mapa —issues y PRs comparten contador y el repo ya va
      por **#58**, así que el spec 014 no puede ser el issue #14— y su riesgo es el margen del body:
      41.051 bytes contra 65.536 (`research.md` §4)
- [ ] T041 **`mcp:test` corre offline y el backend de issues necesita red.** No es de este spec, pero
      su research arranca de acá: `specs.test.ts` ya fabrica sus directorios, así que el patrón de
      fixture existe y lo que falta decidir es si el server habla con la API o recibe el body
- [ ] T042 Si D1 molesta en la práctica —el reviewer deja de ver el seguimiento en el diff—, la tool
      puede además dejar un comentario en el PR. Se anota sin hacer: primero hay que sentirlo
- [ ] T043 `spec.md` y `research.md` siguen en el repo y este spec no los toca. Sacarlos es otra
      decisión y más cara: los cita `docs/`
- [ ] T044 **El AC4 se cumple en los cinco `.md` y NO en los dos scripts de las skills.** `spec-review-batch/scripts/lote.sh` (3 bloques) y `spec-implement-batch/scripts/matriz.sh` (2) grepean `specs/<n>-*/tasks.md` directo, y son la fuente real de la matriz que los dos SKILL.md dicen recibir inyectada. El research §2 no los vio porque grepeó `.claude/skills/*/*.md`: sólo markdown y un nivel. Con `specs/` en el `.gitignore` (T040) los dos scripts leen un directorio vacío y no fallan — es el mismo «fallar en verde» que este spec vino a cerrar, corrido de lugar.
- [x] T045 **Y no se cierra migrando los scripts, porque el bloque del verbo no se abarata.** Medido: los bloques de matriz y de `X → Y` son exactamente `citas` y `cruces` y salen gratis, pero el tercero —las líneas de tarea que citan cada archivo compartido— necesita el TEXTO de la tarea, y devolverlo es devolver el archivo: 39.237 bytes contra los 41.051 del `021/tasks.md`. Por cita en vez de por tarea es peor todavía (66.427). La cita es un ÍNDICE y eso es lo que la tool abarata (4.153 bytes el peor spec); el juicio del verbo que pide `calibracion.md` necesita el texto y el texto cuesta lo que cuesta. Las salidas son tres y hay que elegir una: (a) una tercera lectura que devuelva el texto sólo de las tareas que citan un archivo dado; (b) un punto de I/O que le dé el `md` crudo a un consumidor en proceso, que choca con el AC6; (c) aceptar que el verbo se lee del spec y acotar el AC4 a las operaciones que la tool sí cubre.
- [ ] T046 **`spec_status` no devuelve `[P]` por tarea, y `spec-implement` lo lee.** Hay `manual` (conteo de `[M]`) y no hay nada que diga qué tareas llevan `[P]`. Se resolvió tratando el bloque del formato como contrato de formato —la misma clase de prosa que el T025 protege en `spec-review:37-39`— y ninguna de las cinco skills afirma que la tool lo devuelva. Cuesta poco agregarlo: `parseTasks` ya lo parsea en su grupo 3 y hoy lo descarta. Queda como decisión y no como cirugía porque el AC1 y el AC2 nombran dos lecturas y ésta sería una tercera.
- [ ] T047 **El AC4 quedó acotado a los cinco `.md`, y la salida elegida del T045 es la (c).** El motivo no es preferencia: `lote.sh` y `matriz.sh` son **bash**, y bash no puede llamar una tool MCP, así que la indirección no los alcanza mientras la matriz se inyecte al cargar el skill — migrarlos es mover el bloque del script al skill, que es un cambio de forma y va en su propio spec. Lo que sí se cerró acá es el tercer bloque de `lote.sh`, los `X → Y`: la tool ya los devuelve en `cruces`, así que era además una segunda fuente del mismo dato con otro regex, y el `SKILL.md` ya decía que salían de la tool mientras el script los seguía emitiendo. El T044 sigue abierto: la deuda quedó declarada, no resuelta.
- [ ] T048 **El T025 está marcado `[x]` y `pr-review-batch/SKILL.md:32` sí se tocó.** Lo que el T025 protege —«los AC salen de `specs/NNN-*/spec.md`»— sigue textual; lo que se fue es la cola («más `plan.md` y `tasks.md`»), que era una lectura de archivo de las que el AC4 prohíbe y que el T040 rompería en corrida. El cambio es el correcto y se deja; lo que no es cierto es la casilla, y queda anotado acá porque un `tasks.md` mergeado no se reescribe para tapar eso.
- [ ] T049 **El review encontró que `cruces` devolvía 25 pares donde hay 7, y el test no podía verlo.** `extraer()` corría `CRUCE` también sobre las continuaciones de la tarea, que es donde vive la prosa que la justifica: los 18 de más eran frecuencias (`2 → 0.6461`), números de spec (`002 → 43`, `018 → 019`) y un `3 → 0` con su `0 → 3` de la misma tarea. Se partió en `extraerCitas` (línea de tarea + continuaciones) y `extraerCruces` (solo la línea de tarea), y quedaron los 7 que `cruces.md` documenta. Lo que hay que mirar de esto no es el fix sino por qué el gate no lo atajó: el fixture `CITAS` de `specs.test.ts` no tenía ningún `X → Y` en una continuación, así que la brecha convivía con 100 en las cuatro métricas. Con él, las siete mediciones que el spec declaraba —803 citas, 7 cruces, 49.670 bytes, 2,7×, el peor spec, 2.814 acotada— estaban tomadas con el prototipo de línea-de-tarea y ninguna se re-midió: hoy son 1.388 citas, 84.097 bytes y 3,8×.

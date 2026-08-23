# Tasks — Spec 033

## Paso 1 — Las dos lecturas que le faltan a `spec_status`

- [ ] T001 [P] `TasksInfo` gana `citas` en `mcp-server/src/specs.ts`: por tarea, los archivos que
      nombra entre backticks. Sale del recorrido que `parseTasks` ya hace — **AC1**
- [ ] T002 [P] `TasksInfo` gana `cruces`: los pares `X → Y`. El regex se fija contra los casos reales
      del repo (`002 → 43`, números sueltos y no siempre entre backticks) y no contra el ideal — **AC2**
- [ ] T003 `parseTasks` sigue siendo `(md: string) => TasksInfo`. Si el cambio pide otra firma, el
      diseño está mal: es lo que mantiene barato el spec siguiente — **AC5**
- [ ] T004 [P] Tests de `citas` en `mcp-server/src/__tests__/specs.test.ts`, con el falso positivo que
      `calibracion.md:21` avisa: una tarea que nombra un doc **porque hay que actualizarlo**
- [ ] T005 [P] Tests de `cruces`, incluido el caso de un `tasks.md` sin ninguno
- [ ] T006 `spec_status` expone los dos campos nuevos en su respuesta, y su descripción los nombra

## Paso 2 — La tool de escritura

- [ ] T010 Tool nueva en `mcp-server/src/tools/`, con las dos operaciones y ninguna más:
      `marcar` y `seguimiento` — **AC3**
- [ ] T011 `seguimiento` deriva el `T0NN` **siguiendo desde el mayor**, sin reusar IDs libres
      (`specs/README.md`, «un ID reusado rompe la referencia que otra tarea le hacía»)
- [ ] T012 `marcar` falla con un mensaje que dice qué pasó si la tarea no existe o ya está marcada.
      Marcar lo que no se hizo es lo que este repo acaba de arreglar en `log.md`
- [ ] T013 La escritura cae en el registro central y no en el worktree — **D1**
- [ ] T014 [P] Tests de las dos operaciones, con el caso del ID que sigue y el de la tarea ausente
- [ ] T015 Registrar la tool en `mcp-server/src/tools/index.ts`

## Paso 3 — Las cinco skills

- [ ] T020 `spec-implement`: marcar pasa por la tool. Es la más chica y valida la escritura primero
- [ ] T021 `spec-implement-batch`: marcar, escribir decisiones, y leer citas y cruces por la tool.
      Ejercita las cuatro cosas nuevas a la vez
- [ ] T022 `pr-review-batch`: las cinco escrituras de seguimiento pasan por la tool. Es la que paga
      **D1**, así que su texto tiene que decir que el hallazgo ya no viaja en el diff del PR
- [ ] T023 `spec-review-batch`: tres escrituras y la lectura de cruces
- [ ] T024 `spec-review`: alinear el resto con lo que su propia tabla ya dice
- [ ] T025 **No se toca** `spec-review/SKILL.md:37-39` (contrato de formato) ni
      `pr-review-batch/SKILL.md:32` (los AC salen de `spec.md`). Son prosa y siguen siendo ciertas
- [ ] T026 Leer las cinco y confirmar que no queda ninguna ruta a abrir. **Se verifica leyendo, no
      grepeando**: el grep no distingue la prosa de la operación — **AC4**

## Paso 4 — Verificación

- [ ] T030 `pnpm verify` en verde — **AC8**
- [ ] T031 `mcp:test` en 100 en las cuatro métricas, con las tools nuevas cubiertas — **AC7**
- [ ] T032 Confirmar que no se tocó un solo archivo de `src/` — **AC8**
- [ ] T033 [M] Correr `/spec-implement` sobre este mismo spec: es el primer consumidor de la tool que
      acaba de escribir, y si algo no cierra se ve ahí
- [ ] T034 Actualizar la fila del 033 en `specs/log.md` a `Implementado` — **queda abierta a
      propósito**: el estado lo mueve el merge. Y en este spec la nota es doble, porque el registro
      acaba de demostrar que ese mecanismo falló **diez de diez veces**
- [ ] T035 Commit, push y PR contra `origin`
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

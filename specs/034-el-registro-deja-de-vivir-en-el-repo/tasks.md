# Tasks — Spec 034

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — Los gates sobreviven al vacío (commit propio)

Va primero y solo: es lo único verificable sin haber publicado nada, y sin él los pasos 2–4 corren
contra un gate que no mira. Medido en `research.md` §4.

- [ ] T001 `specs-convencion.test.ts`: **`T015` hoy PASA con cero carpetas** y tiene que dejar de
      hacerlo. `CARPETAS` vacío → `flatMap` → `[]` → «los 33 specs tienen sus cuatro archivos» sin
      haber mirado ninguno. Lo atrapa hoy sólo el gate de arriba, que parecía de adorno — **AC7**
- [ ] T002 Repasar los **siete** gates de ese archivo con la regla del research §4 —«la red
      anti-vacío **es** el gate»— y darle una a cada uno que mire un directorio de spec. No alcanza
      con arreglar el T015: es el que se midió, no necesariamente el único
- [ ] T003 El gate «cada fila de `log.md` tiene su carpeta» pasa a ser «**cada fila apunta a un issue
      del mapa**». Después del paso 4 no hay carpetas, así que tal como está deja de tener sentido —
      **AC3, AC7**
- [ ] T004 `enlaces-resueltos.test.ts`: un enlace a `./NNN-*/spec.md` deja de tener que resolver
      **cuando su destino está ignorado**, sin dejar de verificar los otros. Es el gate más delicado
      del paso: aflojarlo de más lo apaga. Medido: hoy en worktree da **55 rotos** — **AC7**
- [ ] T005 Verificar el paso corriendo `pnpm verify` en un worktree con `specs/[0-9]*/` ignorado,
      **sin publicar nada** —se simula igual que en el research— y confirmar que falla por el motivo
      correcto. Un gate que nunca se vio fallar es un gate del que no se sabe si anda

## Paso 2 — Publicar los 33 specs y escribir el mapa

- [ ] T010 Crear un issue por spec, **en dos pasadas**: primero los 33 con un cuerpo mínimo, anotando
      el mapa; después los cuerpos ya traducidos. Un spec citado por otro que todavía no tiene issue
      no se puede traducir en una sola pasada — **AC2, AC4**
- [ ] T011 El reparto es **un archivo por cuerpo** y no «los que quepan»: `spec.md` al body,
      `research`/`plan`/`tasks` cada uno a un comentario. Medido: juntar `spec`+`research` ya llega al
      **87 %** del límite, y un archivo solo tiene su peor caso en **63 %** — **AC2**
- [ ] T012 Los **tres specs que no entran enteros** —021 (146 %), 005 (139 %), 022 (138 %)— no son un
      caso especial con este reparto: se verifica que sus cuatro cuerpos entren por separado
- [ ] T013 El `baseline.md` del **008** va como cuarto comentario. Es el único quinto archivo en 33
      specs, y el gate de los cuatro archivos no lo ve porque verifica que estén, no que no haya más
- [ ] T014 La **traducción de enlaces se hace al publicar**, sobre el texto que se sube, y **no** se
      edita un solo archivo de `specs/[0-9]*/`. Lo prohíbe la Desviación 2 y lo verifica T031 —
      **AC4, D3**
- [ ] T015 El estado del issue refleja el del spec: `Implementado`, `Descartado` y `Superado` se
      crean **y se cierran**; los `Propuesto` quedan abiertos
- [ ] T016 `log.md`: la columna del enlace pasa de `./NNN-*/spec.md` a la URL del issue. Es el mapa
      (D2), y es explícito porque **no puede ser aritmético**: issues y PRs comparten contador y el
      repo va por **#62**, así que el spec 014 no puede ser el issue #14 — **AC3**

## Paso 3 — Hidratar, y las 16 citas de afuera

- [ ] T020 Un comando **explícito** de hidratación: dado el mapa de `log.md`, trae los cuerpos y
      reconstruye `specs/NNN-*/`. No un hook (D4): un hook que baja 33 issues en cada `worktree add`
      es lento y falla sin red — **AC5**
- [ ] T021 Vive del lado de las **skills**, que ya tienen `mcp__github__`, y **no** del server.
      Medido: `mcp-server/` no tiene hoy una sola llamada de red —sus deps son `mcp` y `zod`— y
      `mcp:test` corre offline con umbral 100. Darle HTTP cuesta mockear la red (cobertura sin
      verificación, lo que el 029 rechazó) o volver el gate dependiente de red — **AC6**
- [ ] T022 [P] Las **13** citas de `docs/`: `guides/mcp-domain.md` (6), `architecture/modelo-musical.md`
      (5), `architecture/audio.md` (1), `architecture/overview.md` (1)
- [ ] T023 [P] Las **2** de `mcp-server/` —`README.md` y `src/__tests__/tools.test.ts`— y la **1** de
      `DESIGN.md`
- [ ] T024 `/pr-review-batch` y `/spec-implement-batch` documentan el paso de hidratación. Es el
      agujero exacto que el 033 nombró y no cerró: corren en worktree, y ahí llegan **3** archivos de
      `specs/` en vez de 136 — **AC5**
- [ ] T025 `specs/README.md`: cómo se escribe un spec ahora, y que el archivo local es **caché** y no
      la fuente (D1)

## Paso 4 — El `.gitignore` (dos commits, el segundo solo)

- [ ] T030 `specs/[0-9]*/` al `.gitignore`. Los tres registros —`README.md`, `log.md`,
      `revisiones.md`— **se quedan trackeados** — **AC1**
- [ ] T031 Los **133** archivos fuera del índice, en un commit **solo**: es el que hay que poder
      revertir de un tirón, y la regla del repo es que los borrados van aparte. Verificar de paso que
      el diff **no toca el contenido** de ningún spec (AC4) — **AC1**

## Paso 5 — Verificar donde se ve

- [ ] T040 `pnpm verify` en verde **en la máquina** — **AC8**
- [ ] T041 `pnpm verify` en verde **en un worktree limpio y ya hidratado**. Es la mitad que importa:
      el modo de falla que este spec puede introducir sólo aparece ahí. Mismo patrón que el 023 con el
      comparador de `walk()`, que sólo se vio en otra máquina — **AC8**
- [ ] T042 Falsificar, una por gate tocado: un mapa con una URL rota, un spec sin issue, un issue sin
      fila en `log.md`, y `verify` en un worktree **sin** hidratar. Cuatro roturas, cuatro rojos
- [ ] T043 `mcp:test` sigue en 100 y **sigue corriendo offline** — se verifica sin red, no leyendo el
      `package.json` — **AC6**
- [ ] T044 [M] Abrir tres issues publicados en GitHub y confirmar que el body renderiza: las tablas,
      los fences, y que los enlaces traducidos llevan al issue correcto
- [ ] T045 Actualizar la fila del 034 en `specs/log.md` a `Implementado` — **queda abierta a
      propósito**: el estado lo mueve el merge, y este registro ya demostró que ese mecanismo falla
- [ ] T046 Commit, push y PR contra `origin`
- [ ] T047 [M] Code review del PR

## Seguimiento (no bloquea)

- [ ] T050 **`revisiones.md` (1.051 líneas) no va a Issues** y este spec no lo toca: es aprendizaje
      transversal, no trabajo planificado. Su destino es repartirse en `docs/` y `.claude/rules/`, y
      es un spec propio
- [ ] T051 **`lote.sh` y `matriz.sh` siguen sin poder llamar la tool** — son bash. Este spec **no los
      rompe**, porque los dos leen `specs/log.md` y `log.md` se queda; pero tampoco los arregla, y el
      `T044` del 033 sigue abierto
- [ ] T052 **Si `log.md` también se mudara**, los dos scripts de arriba dejan de andar en el acto: es
      lo único que hoy los sostiene. Anotarlo acá para que el spec que mueva `log.md` arranque
      sabiéndolo
- [ ] T053 El `T038` del 032 **decía que `T015` pasaría a fallar y es falso**: pasa en verde con cero
      carpetas. Lo escribí sin medir y lo desmintió la simulación del research §4. Queda anotado y no
      se corrige allá: un `tasks.md` mergeado no se reescribe
- [ ] T054 Un spec futuro puede pasar los 65.536 en un solo archivo. Hoy el peor está al 63 %, y
      cuando pase se parte en dos comentarios — el reparto ya es por archivo, así que no hay que
      rediseñar nada

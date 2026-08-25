# Specs

Trabajo planificado. Un spec por unidad de trabajo, en su propia carpeta numerada.

> **El registro vive en [mapa.json](./mapa.json)** y el porqué de cada decisión, como comentario en
> el issue del spec del que habla. **La deuda sin spec vive en [GitHub Issues](https://github.com/federicohermo/pentomino-games/issues)**,
> no en un archivo de acá. Este archivo documenta solo la convención.

> **Desde el spec 034 los specs no se persisten en el repo: cada uno es un issue.**
> `specs/[0-9]*/` está en el `.gitignore`, y lo que queda trackeado son dos archivos que no son
> specs —este `README.md` y [`mapa.json`](./mapa.json)— más los gates de `__tests__/`.
>
> **El directorio local es una caché, no la fuente.** Si no está, se trae:
>
> ```bash
> node .claude/scripts/hidratar-specs.mjs           # los que están EN VUELO y falten
> node .claude/scripts/hidratar-specs.mjs 021       # o uno solo, esté como esté
> node .claude/scripts/hidratar-specs.mjs --todos   # los 42, cerrados incluidos
> ```
>
> **El default trae poco a propósito, desde el 038.** Hasta entonces «los que falten» eran los 42, y
> el caso normal es querer **uno**: el que se está implementando. Con `/spec-implement-batch`
> corriendo N worktrees eso son 42×N llamadas a `gh`. Las tres formas **declaran cuántas saltearon y
> por qué** — un default que trae menos y no lo dice se lee como «ese spec no existe», que es peor que
> traer de más.
>
> **Lo que mira el árbol entero va con `--todos`**, y no es una preferencia: `specs-convencion.test.ts`
> corre `runIf(HIDRATADOS > 0)`, así que con el default nuevo pasaría habiendo mirado un solo spec. Es
> «fallar en verde».
>
> Hace falta correrlo **en cada worktree**: `git worktree add` hace checkout de lo trackeado, y un
> archivo ignorado no viaja. Medido: antes del 034 a un worktree llegaban 136 archivos de `specs/` y
> ahora llegan **4** — este `README.md`, el mapa y los dos gates de `__tests__/`, ninguno de ellos un
> spec.
>
> **Buscar dentro de los specs necesita `--no-ignore`.** Leerlos no: `.gitignore` es cosa de git y no
> del sistema de archivos, así que `Read`, `cat` y `head` los abren normalmente. Pero **ripgrep respeta
> `.gitignore`**, y la herramienta `Grep` está construida sobre ripgrep — o sea que una búsqueda en
> `specs/` devuelve **cero resultados sin decir que no miró**, que es la peor respuesta posible. Para
> buscar ahí:
>
> ```bash
> rg --no-ignore "lo que sea" specs/
> ```

> **El mapa spec↔issue es [`mapa.json`](./mapa.json)**, y por eso ese archivo se queda. No puede ser
> aritmético —issues y PRs comparten contador—: el spec 001 es el issue **#63**.
>
> ```json
> { "001": { "issue": 63, "carpeta": "001-notas-por-celda-en-orden-angular",
>            "fecha": "2026-08-02", "estado": "Descartado", "titulo": "Spec 001 — …" } }
> ```
>
> **`carpeta` está guardada y no se deriva del título**: medido sobre los 35, derivarla acierta 28 y
> falla 7 —el 001 se llama `001-notas-por-celda-en-orden-angular` y su issue se titula «Asignar cada
> nota a una celda de la pieza…»—, o sea que un árbol recién hidratado inventaría siete carpetas que
> ninguna cita conoce.
>
> **`estado` y `titulo` son copias del issue**, y las mira un gate (`__tests__/mapa-de-specs.test.ts`)
> que se saltea declarándolo cuando no hay red. Se copian porque `spec_status` y `mcp:test` corren
> **sin red**; lo que no se copia es la descripción larga que tenía cada fila del registro anterior,
> que son los 54.531 bytes que se desincronizaban solos.

La convención es la de [Spec Kit](https://github.com/github/spec-kit) con tres desviaciones
deliberadas, anotadas abajo donde corresponde. Las coincidencias no son casualidad: la carpeta
numerada, los tres documentos y el `tasks.md` derivado del plan salen de ahí.

## Convención de nombres

```text
specs/<NNN>-<descripcion-kebab>/
├── spec.md       ← problema, solución propuesta, criterios de aceptación y límites de alcance
├── research.md   ← estado del código relevante, archivos afectados y riesgos
├── plan.md       ← pasos de implementación y verificación
└── tasks.md      ← checklist de implementación, verificación y PR
```

- `NNN` — número secuencial de tres dígitos (001, 002, …).
- **Los cuatro archivos son el piso, no el techo.** Un spec puede agregar los que necesite —el 008
  tiene un `baseline.md` con la medición previa— y Spec Kit prevé lo mismo (`data-model.md`,
  `contracts/`, `quickstart.md`). Los tres de Spec Kit que este repo no genera son de API y de schema,
  y acá no hay ni una ni la otra.
- El spec se commitea a `main` **antes** de crear la rama de feature.

> **Desviación 1.** Spec Kit crea la rama primero y le da su nombre a la carpeta. Acá el spec entra a
> `main` antes, así que un spec abandonado no se va con su rama: el 001 (`Descartado`) y el 004
> (`Superado`) siguen en el registro.

> **Desviación 2.** Un spec mergeado **no se reescribe**. Spec Kit los trata como documentación viva
> que se regenera con el código; acá son ADR: registro de qué se decidió y con qué evidencia, con
> fecha. Lo que sí se mantiene al día es `docs/`, `.claude/rules/` y `CLAUDE.md`.

> **Desviación 3.** El segmento de ticket de la convención original
> (`specs/<NNN>-<TICKET>-<descripcion>/`) no va en el nombre de la carpeta. **No es que no haya
> ticket**: desde el spec 034 cada spec *es* un issue, y ése es su ticket. Lo que pasa es que su
> número no se conoce cuando se crea la carpeta —lo asigna `publicar-spec.mjs`— y no es derivable,
> porque issues y PRs comparten contador: el spec 001 es el issue **#63**.
>
> Por eso existe [`mapa.json`](./mapa.json): **es el segmento de ticket, sacado del nombre de la
> carpeta**. Y por eso la rama sí lleva el número del spec y no el del issue — `feature/<NNN>-<kebab>`
> es de donde el gate de `spec-create` y `/pr-review-batch` sacan de qué spec se trata.
>
> Los encabezados de los specs anteriores al 037 dicen «este repo no tiene tablero de Jira». Quedó
> escrito antes del 034 y **no se reescribe**, por la Desviación 2.

> **Desviación 4.** Desde el spec 032 los `.md` entran a `pnpm lint`, y los specs lo hacen **en su
> propio carril**: se apaga el preset entero y se reenciende, por nombre, sólo lo que caza un error de
> **renderizado** — una tabla que descarta celdas, un encabezado que no renderiza, un enlace dado
> vuelta. Ninguna regla de estilo.
>
> Se lee junto con la Desviación 2 y sale de ella. El preset completo sobre `specs/` da **483**
> hallazgos, y aplicarlo obligaría a reescribir 29 specs cerrados para satisfacer una regla de
> estilo, que es exactamente lo que la Desviación 2 prohíbe. Un error de renderizado es otra cosa: no
> reescribe una decisión, **destapa contenido que GitHub hoy esconde**. Con el carril puesto, el costo
> medido fue **1 hallazgo**, y era un bug real —`027/research.md:112` perdía una celda de tabla por
> dos barras sin escapar—.
>
> El carril **reenciende por nombre y no excluye por nombre**, por el mismo motivo que
> `REGLAS_DEL_REPO` en `eslint.config.js`: en flat config un override *reemplaza*, así que una lista
> por exclusión dejaría entrar sola cualquier regla que el preset agregue más adelante — y eso sería
> `pnpm lint` en rojo sobre specs que no se pueden tocar.
>
> El `README.md` de acá **no** está en ese carril: es documentación viva y se mantiene al día, así
> que va con el preset completo.

## Los cuatro estados

El campo `estado` de [`mapa.json`](./mapa.json) es un conjunto cerrado, y la lista vive una sola vez:
`ESTADOS` en [`.claude/scripts/lib/specs.ts`](../.claude/scripts/lib/specs.ts). El orden es el del
ciclo de vida, no alfabético.

| Estado | Qué dice | ¿En vuelo? | Su issue |
|---|---|---|---|
| `Propuesto` | escrito y publicado; de él todavía puede salir trabajo | **Sí** | abierto |
| `Implementado` | su PR aterrizó en `main` | No | cerrado |
| `Descartado` | se abandonó sin implementar (el 001) | No | cerrado |
| `Superado` | otro spec lo reemplazó (el 004) | No | cerrado |

**«En vuelo» es la partición que importa**, y es una sola función —`enVuelo`— porque de ella dependen
tres cosas distintas: qué trae `hidratar-specs.mjs` por default, si `publicar-spec.mjs` cierra el
issue, y qué estado del issue espera el gate del mapa. Mientras el publicador tenía su propia copia
escrita a mano, sacar un estado del conjunto lo dejaba mirando uno que ya no existe, **en verde**. Un
estado desconocido cuenta como en vuelo: lo que no se entiende no cierra nada, y que además sea ilegal
lo grita el gate.

> **`En curso` existió hasta el 038 y se sacó, con una medición**: el conjunto cerrado lo aceptaba y
> el mapa **no lo usaba en ninguna de sus 42 entradas**. No fue descuido — ningún paso del flujo lo
> escribe: `publicar-spec.mjs` pone `Propuesto` al crear el issue y el merge pone `Implementado`, y
> entre esos dos no hay ningún momento en el que alguien vuelva al mapa a anotar que empezó. Agregar
> ese momento sería un **tercer punto de escritura manual**, que es justo el mecanismo que el 038
> demostró que falla. La pregunta que `En curso` prometía responder —¿esto ya aterrizó?— la contesta
> el cruce contra el PR, que no depende de que nadie se acuerde.

## Formato de una tarea

```markdown
- [ ] T012 [P] [M] Descripción, con la ruta del archivo que toca
```

| Parte | Qué dice | Obligatorio |
|---|---|---|
| `T012` | ID estable dentro del spec, para que una tarea pueda nombrar a otra | En specs nuevos |
| `[P]` | Se puede hacer en paralelo con las otras `[P]` de su bloque: no comparten archivo ni dependen entre sí | No |
| `[M]` | Pide una persona — navegador, oído, captura. No bloquea el cierre del spec | No |

Los IDs son **estables**: no se renumeran al insertar una tarea nueva, se sigue contando. Un ID
libre no molesta a nadie; uno reusado rompe la referencia que otra tarea le hacía.

**`[M]` es la parte que hace legible el estado.** Sin él, un spec `Implementado` con casillas abiertas
es ambiguo: no se distingue "falta trabajo" de "quedó una verificación a oído que ya nadie va a hacer".
Con él, `spec_status` reporta `pendientes: 0` y el spec se lee cerrado. Los diez specs anteriores a
esta convención no llevan ID —no se reescriben, por la desviación 2— pero sí se les marcó `[M]` lo que
correspondía, porque eso no reescribe la historia: la aclara.

**`[P]` es lo que `spec-implement` hoy deriva solo.** Declararlo al escribir el spec, que es cuando se
conocen las dependencias reales, sale más barato y más confiable que inferirlo en cada corrida.

Las tareas de `## Seguimiento (no bloquea)` son deuda anotada a propósito y tampoco cuentan como
pendientes. Es un eje distinto de `[M]`: `Seguimiento` es *dónde* está anotada la tarea, `[M]` es
*quién* la puede hacer. Una tarea puede ser las dos cosas.

**Y `Seguimiento` no es donde va todo lo que quedó pendiente.** Cerrar de una vez los seguimientos de
cuatro specs mostró que de sus 16 ítems, **la mitad no eran tareas** sino deuda de registro — y
confundirlas es lo que los había dejado abiertos tanto tiempo. Las cuatro clases que no son una tarea,
con la señal que las delata:

| No es una tarea, es… | La señal | Dónde va |
|---|---|---|
| una **decisión ya tomada** | está escrita como pendiente y nadie la discute | al lado de lo que decide: la constante, la firma, el módulo |
| algo **sin dueño** | vive en el seguimiento de un spec ya cerrado | [GitHub Issues](https://github.com/federicohermo/pentomino-games/issues), que es la única fuente que este repo declara |
| **otro spec** | otro spec ya la absorbió, a veces cambiando el enfoque | se cierra citando al spec que la absorbió |
| algo **que no se cierra leyendo código** | pide oído, ojo o navegador | se queda, con `[M]` y el motivo escrito al lado |

La señal más barata de todas: **una tarea anotada en cuatro seguimientos distintos ya no es de nadie.**
`PlacedPiece.notes` estaba en los seguimientos del 001, el 007, el 009 y el 010, y cada spec la
postergaba al siguiente; cerrarla no llevó más de un commit.

## Flujo

1. Escribir los cuatro archivos. El `research.md` se escribe **midiendo, no suponiendo**.
2. Publicarlo como issue con `node .claude/scripts/publicar-spec.mjs`, que le escribe su entrada en
   [mapa.json](./mapa.json) con estado `Propuesto`. **Esa entrada es el mapa**, y es lo único del spec
   que se commitea.
3. Crear la rama `feature/<NNN>-<descripcion-kebab>`.
4. Implementar, marcando `tasks.md` a medida que se avanza —con `spec_write`, que valida el ID en vez
   de dejar creer que escribió—. El archivo local es caché: si no está,
   `node .claude/scripts/hidratar-specs.mjs <NNN>`.
5. **Devolver las marcas al issue** con `node .claude/scripts/publicar-spec.mjs publicar`, antes de
   cerrar. `spec_write` escribe **al disco**, y el disco es una caché: la próxima hidratación baja el
   `tasks.md` del issue y **se lleva puesta cada casilla marcada**. Verificado en vivo al implementar
   el 038 — se marcó una tarea, se rehidrató el spec, y la marca ya no estaba. La fase `publicar` es
   idempotente de verdad (mapea los comentarios por archivo y hace `PATCH`), así que repetirla no
   duplica nada; su `--dry`, en cambio, **no sirve para confirmarlo**: saltea el fetch, así que no ve
   los comentarios que ya existen.
6. Al mergear, actualizar el estado en [mapa.json](./mapa.json), **cerrar el issue**, y anotar en el
   issue —como comentario— qué se aprendió si el spec salió distinto de lo previsto. Los dos primeros
   son la misma cosa vista de dos lados, y el gate del mapa falla si no coinciden.

**Los pasos 5 y 6 son uno solo para el gate.** Desde el 038 el mapa se cruza contra el PR —que está
mergeado o no, y eso no lo escribe nadie a mano— y contra los `pendientes` del spec: un spec cerrado
con trabajo abierto es rojo. Saltear el paso 5 hace que el 6 nazca en rojo la próxima vez que alguien
hidrate, y no en la máquina de quien lo cerró.

`spec_status` (MCP) responde el estado de todos los specs en una llamada, en vez de abrir el mapa y
treinta y cinco `tasks.md`. Y responde **sin hidratar**: lo que falta en ese caso es `tareas`, y lo
dice.

**Las dependencias entre specs no se declaran en ninguna parte.** Las calcula `spec_status` en
`cruces`, leyendo los pares `X → Y` de cada `tasks.md` — o sea los números que una tarea mueve de un
valor a otro, que es la arista que ningún import delata. El registro anterior tenía además una lista
escrita a mano, y era la copia de eso.

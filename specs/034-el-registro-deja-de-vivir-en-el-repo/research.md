# Research — Spec 034

Todo lo de acá está **medido sobre el repo**, no supuesto. Fecha: 2026-08-23, con el 032 y el 033 ya
mergeados.

La medición central —§4— se hizo **simulando la mudanza de verdad**: rama descartable, los 133
archivos fuera del índice, `specs/[0-9]*/` en el `.gitignore`, y un `git worktree add` para ver qué
llega del otro lado. No es un razonamiento sobre lo que pasaría; es lo que pasó.

## 1. Quién cita un archivo de spec por ruta

**135 citas en 63 archivos**, y el corte es lo que cambia el spec:

| Zona | Citas | Archivos |
|---|---|---|
| `specs/` (specs entre sí + los registros) | **119** | 46 |
| `docs/` | 13 | 4 |
| `mcp-server/` | 2 | 2 |
| `DESIGN.md` | 1 | 1 |
| **de afuera de `specs/`** | **16** | **7** |

Las 13 de `docs/` son: `guides/mcp-domain.md` (6), `architecture/modelo-musical.md` (5),
`architecture/audio.md` (1) y `architecture/overview.md` (1).

Y de las 119 internas, **40 son las filas de `log.md`** — una por spec, cada una enlazando a su
`spec.md`.

### A cuál de los cuatro archivos apuntan

| Archivo | Citas |
|---|---|
| `spec.md` | **113** |
| `tasks.md` | 13 |
| `research.md` | 5 |
| `plan.md` | 4 |

**El 84 % de las citas son a `spec.md`.** Es lo que justifica ponerlo en el *body* del issue y no en
un comentario: el body es lo que tiene URL propia y lo que se ve al abrir el issue.

## 2. El problema no es el volumen: es la Desviación 2

Reescribir 16 citas es una tarde. Las 119 internas son otra cosa, y no por cantidad: **están dentro de
specs mergeados**, y `specs/README.md` **Desviación 2** dice que un spec mergeado no se reescribe —
«acá son ADR: registro de qué se decidió y con qué evidencia, con fecha».

Editar 46 specs cerrados para cambiarles un enlace la viola igual que editarles una decisión. El único
precedente de tocar un spec congelado es el 027 en el spec 032, y su justificación fue explícita y
angosta: **no reescribía una decisión, destapaba una celda que GitHub descartaba**. Un enlace que
todavía resuelve no entra en esa excepción.

De ahí sale la solución del spec: **el archivo no es lo que se publica**. La traducción de enlaces
pasa al publicar, y el archivo queda como se escribió.

## 3. Los tamaños, y los tres specs que no entran

El límite del body de un issue —y de cada comentario— son **65.536 bytes**.

| Spec | Total (4 archivos) | % del límite | `spec.md` | `research.md` | `plan.md` | `tasks.md` |
|---|---|---|---|---|---|---|
| **021** | **95.977** | **146 %** | 15.054 | 29.663 | 10.209 | **41.051** |
| **005** | **91.272** | **139 %** | **36.018** | 21.332 | 22.110 | 11.812 |
| **022** | **90.330** | **138 %** | 25.557 | 22.517 | 14.485 | 27.771 |
| 019 | 64.590 | 99 % | 13.053 | 15.960 | 8.982 | 26.595 |
| 020 | 63.666 | 97 % | 8.319 | 17.932 | 10.220 | 27.195 |
| 032 | 62.012 | 95 % | 19.463 | 18.708 | 8.789 | 15.052 |

**3 de 33 no entran enteros**, y otros tres están al 95-99 %. O sea que «todo el spec en el body» no
es una opción, y no por poco.

Los máximos por archivo, que son lo que el reparto tiene que respetar:

| | Bytes | % del límite |
|---|---|---|
| `spec.md` mayor (005) | 36.018 | **55 %** |
| `research.md` mayor | 29.663 | 45 % |
| `tasks.md` mayor (021) | 41.051 | 63 % |
| `spec.md` + `research.md` mayor | 57.350 | **87 %** |

**Un archivo por cuerpo entra siempre, con el peor caso al 63 %.** Juntar dos ya llega al 87 %, así
que el reparto es **uno por cuerpo** y no «los que quepan».

Esto corrige al 033, que midió sólo el `tasks.md` —41.051, el 63 %— y concluyó «entra con margen». Es
cierto para `tasks.md` solo, y es lo único que ese spec pensaba mudar.

## 4. La simulación: qué llega a un worktree, y qué hacen los gates

Se hizo de verdad: rama descartable, `git rm --cached` de los 133, `specs/[0-9]*/` al `.gitignore`,
commit, `git worktree add`.

| | Repo | Worktree |
|---|---|---|
| `.md` en `specs/` | **136** | **3** |
| carpetas de spec visibles | 33 | **0** |
| `.md` que ve el caminante del gate de enlaces | 163 | **30** |

Y los cuatro gates del 032, corridos sobre los dos árboles:

| Gate | En el repo | En el worktree |
|---|---|---|
| «hay specs que verificar» (`> 20`) | pasa | **FALLA** ← lo único que atrapa a T015 |
| **T015** «cada spec tiene sus cuatro archivos» | pasa | **PASA CON CERO CARPETAS** |
| T017 «toda línea checkbox parsea» | pasa (1.642 tareas) | **FALLA** por la red anti-vacío |
| «cada fila de `log.md` tiene su carpeta» | pasa | **FALLA** (33 fantasmas) |
| «cada enlace apunta a un archivo que existe» | pasa | **FALLA** (55 rotos) |

### El hallazgo, y desmiente lo que este repo ya había anotado

El `T038` del 032 —escrito por mí, sin medir— decía que **`T015` pasaría a fallar**. **Es falso: pasa
en verde con cero carpetas.** `CARPETAS` queda vacío, `flatMap` sobre vacío devuelve `[]`, y el gate
declara que los 33 specs tienen sus cuatro archivos sin haber mirado ninguno.

Lo que lo atrapa no es él sino el gate de arriba —«hay specs que verificar»—, que el 032 escribió
justamente como red anti-vacío y que en su momento parecía de adorno. **La red funcionó, y el gate
que se creía sólido no lo era.**

Los otros dos que fallan lo hacen por el motivo correcto: `T017` cae por su propia red anti-vacío
(0 tareas contra el `> 1000`), no porque encuentre una línea mala.

**La lección que el 034 tiene que llevarse escrita:** en un mundo donde `specs/` puede no estar, todo
gate sobre `specs/` necesita su red anti-vacío, y **la red es el gate**. La aserción que mira el
contenido es la que sobra cuando no hay contenido.

## 5. El server no habla con GitHub, y no puede empezar barato

`mcp-server/package.json` declara **dos** dependencias: `@modelcontextprotocol/server` y `zod`. Un
grep por `fetch`, `https://`, `octokit` y `node:https` sobre los ocho `.ts` del server y sus seis
tools da **cero**.

`mcp:test` corre con `node --test` y `--test-coverage-*=100`, offline.

Darle un cliente HTTP cuesta una de dos cosas, y ninguna entra:

- **mockear la red en los tests** — cobertura sin verificación, que es exactamente lo que el 029
  rechazó cuando eligió Chromium sobre jsdom: «cubrirlos con jsdom exigiría mockear exactamente el
  código que se quiere cubrir»;
- **o volver `mcp:test` dependiente de red y de un token**, y con eso el gate de coverage deja de
  poder correr en un clone nuevo.

Por eso la hidratación la hacen las skills, que ya tienen `mcp__github__`. Es también lo que deja el
AC6 del 033 en pie sin tocarlo: `readSpecStatus` sigue siendo el único punto de I/O y sigue tomando un
directorio.

## 6. El mapa spec↔issue no puede ser aritmético

Issues y pull requests **comparten contador** en GitHub. El repo va por **#62** (el PR del fix del
032) con 15 issues abiertos, el mayor **#60**.

Así que `NNN → #NNN` está descartado por construcción: el spec 014 no puede ser el issue #14, que ya
es otra cosa. El mapa tiene que ser explícito y versionado, y el lugar natural es `log.md`, que ya
tiene exactamente una fila por spec y ya es el índice que `spec_status` parsea.

## 7. Lo que este spec NO rompe, y conviene saber

- **`lote.sh` y `matriz.sh`** leen `specs/log.md` —para sacar los `Propuesto`— y verifican que el
  directorio del spec exista. `log.md` **se queda trackeado**, así que la primera mitad sigue
  andando. La segunda es la que se apoya en el directorio, y es lo que la hidratación tiene que
  producir. El `T044` del 033 sigue abierto por otro motivo: son bash y no pueden llamar una tool.
- **`specs/008-*/` tiene un quinto archivo**, `baseline.md`. El gate de los cuatro archivos verifica
  que los cuatro estén, no que no haya más, así que no lo ve — pero la publicación sí tiene que
  decidir qué hacer con él. Es el único caso en 33 specs.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Un gate pasa en verde sin datos, como `T015` | AC7, y la regla del §4: la red anti-vacío **es** el gate. Se verifica corriendo `verify` en un worktree, que es donde se ve |
| El issue y el archivo local se desincronizan | D1: la fuente es el issue. El archivo local es caché y se re-hidrata |
| Un spec futuro pasa los 65.536 en un solo archivo | Hoy el peor está al 63 %. Cuando pase, se parte en dos comentarios — el reparto ya es por archivo |
| La hidratación falla sin red y bloquea el trabajo | D4: es un comando explícito, así que falla a la vista y no en medio de un `worktree add` |
| Perder el historial de un spec al mudarlo | Los archivos salen del índice, no de los commits. `git log` sigue teniendo todo |

# Ramas

Desde el 2026-08-26 este repositorio tiene **dos ramas con roles distintos**. Antes tenía una sola con
los dos trabajos: `main` era donde el trabajo aterrizaba y también lo que se publicaba, y no había
ningún gate — el único ruleset era `avoid-deletion`, sin un solo `required_status_checks`, así que
`pnpm verify` en rojo no impedía mergear nada.

Este archivo dice qué hace cada rama, qué las protege, y las tres cosas que parecen olvidos y no lo
son.

## Los dos roles

| Rama | Rol | Quién le escribe |
|---|---|---|
| `staging` | **Integración**, y la **default** del repositorio | cada PR de una rama `feature/<NNN>-<kebab>`, y `mapa.yml` |
| `main` | **Release**: es la rama de producción del deploy | sólo un PR de promoción desde `staging` |

La rama de producción del proveedor de deploy se declara **explícitamente** en `main`, y no se hereda
de la default. La configuración del build vive en [`deploy.md`](./deploy.md), que es su archivo; acá
sólo importa qué rama publica.

Una rama de trabajo se llama `feature/<NNN>-<kebab>` con el `NNN` de su spec, sale de `staging` y
vuelve a `staging` por PR. Ninguna de las dos ramas de este archivo se edita a mano: el gate del spec
037 lo bloquea, y abajo está qué hacer cuando te frena.

## El ruleset

`main` está protegida por un ruleset —`main-solo-por-pr-verde`, **id 21477023**— con exactamente
estas reglas:

| Regla | Valor |
|---|---|
| `pull_request` | puesta: a `main` no se pushea directo |
| `required_status_checks` | `[verify]` |
| `bypass_actors` | `[]` — **nadie**, ni el dueño |

El id se escribe acá porque es lo que hace falta para desarmarlo
(`gh api -X DELETE repos/federicohermo/pentomino-games/rulesets/21477023`), y un gate que no se sabe
desarmar se desarma mal: a los manotazos, o borrando la rama.

`staging` **no tiene ruleset**, y eso es parte del diseño: es adonde `mapa.yml` pushea, y el bot no
puede pasar por un PR (ver abajo).

### Por qué `required_status_checks` nombra sólo a `verify`

Parece que falta `derivar`, el job de `mapa.yml`, y no falta. Ese workflow corre con
`on: push[staging]` y **nunca sobre un PR**, así que exigirlo como check dejaría todos los PR
esperando un check que no va a llegar nunca. `verify` sí corre sobre `pull_request`, y es el nodo de
convergencia del repo.

### Por qué el bot del mapa no tiene bypass

No es una decisión de política: es que **la plataforma no lo permite**, y las dos salidas obvias están
cerradas. Las dos se midieron intentándolas el 2026-08-26.

**El bypass por integración no existe en un repositorio personal.** Al crear el ruleset con
`bypass_actors: [{ actor_id: 15368, actor_type: "Integration" }]` —15368 es el id de la app GitHub
Actions— la API responde:

```text
422 Validation Failed
"Actor GitHub Actions integration must be part of the ruleset source or owner organization"
```

La única familia de bypass disponible acá es `RepositoryRole`, o sea admin, y eso no sirve: **los
agentes actúan con el usuario del dueño**, así que un bypass de admin es un bypass para el agente y el
ruleset se vuelve un recordatorio.

**Y un PR creado con `GITHUB_TOKEN` no dispara workflows.** Es comportamiento documentado de Actions, y
es lo que mata la otra salida —«que el bot abra un PR en vez de pushear»—: `verify` nunca correría
sobre ese PR, el check requerido nunca se satisfaría, y el PR quedaría abierto para siempre.

Las dos juntas dejan una sola salida, que es la que se tomó: **el bot no se exime ni pide permiso, se
muda a una rama que no tiene reglas.** Por eso `mapa.yml` corre sobre `staging`.

### Por qué la rama default es `staging` y no la productiva

La default de GitHub no significa producción: significa la base **preseleccionada** de cada PR nuevo,
lo que da un `clone` fresco, y cuál rama toma el proveedor de deploy como producción si nadie la fija.

El argumento es asimétrico, y por eso no hay empate:

- Con `main` de default, el error es **silencioso y grave**: una rama de feature aterriza directo en la
  rama de release. El ruleset no lo impide —sólo exige `verify` en verde, no una rama de origen— así
  que la integración se saltea sin que nada avise.
- Con `staging` de default, el error es **visible e inofensivo**: un PR de promoción que apunta a
  `staging` no rompe nada y se retargetea en dos clics.

El costo del cambio es concreto y ya está pago: la rama de producción del deploy hay que fijarla a
mano en `main`, o se publica la rama de integración.

## Las tres copias que la maquinaria tiene del modelo

El modelo está escrito en tres lugares del árbol además de acá, y ninguno puede leer a los otros: dos
son YAML que GitHub Actions parsea antes de que exista un proceso donde correr código, y el tercero es
un script que corre como hook de permisos. Lo que cada uno declara:

| Dónde | Qué declara | Ramas |
|---|---|---|
| `.github/workflows/verify.yml` | `on.push.branches` | `staging`, `main` |
| `.github/workflows/mapa.yml` | `on.push.branches` | `staging` |
| `.claude/scripts/gate-de-spec.mjs` | `RAMAS_COMPARTIDAS` | `main`, `staging` |

`verify` corre sobre las dos porque la rama que se publica no puede ser la única sin corrida propia.
`mapa.yml` corre sólo sobre `staging` por el bypass que no existe. Y `RAMAS_COMPARTIDAS` nombra a las
dos porque las dos reciben trabajo de otros: **es el mismo conjunto que verifica `verify`**, y no por
casualidad — una rama compartida sin corrida propia es exactamente el agujero que este modelo cierra.

Que las tres digan lo mismo que este documento lo verifica
[`__tests__/ramas-sincronizadas.test.ts`](../../__tests__/ramas-sincronizadas.test.ts), con el molde
de los otros gates de sincronización del repo: lee del disco, compara texto, y corre sin red.

## Cuando el gate del 037 te frena

El hook del spec 037 bloquea editar `src/`, `mcp-server/src/` o `docs/` desde una rama que no nombre un
spec, y `main` y `staging` son las dos que nombra explícitamente. Si te frenó, el problema es **dónde
estás parado**, no cómo se llama la rama — y la salida nunca es renombrar la rama de integración:

```bash
git checkout staging && git pull
git checkout -b feature/<NNN>-<descripcion-kebab>
node .claude/scripts/hidratar-specs.mjs <NNN>
```

El `NNN` sale de la fila del spec en [`specs/mapa.json`](../../specs/mapa.json), que `spec-create` ya
escribió: abrir el spec y decidir implementarlo son dos decisiones distintas, y la rama la abre el
implementador.

Si el cambio de verdad no necesita spec —un typo, un bump de versión, revertir el commit anterior— la
rama igual no puede ser `main` ni `staging`.

## Qué no verifica nadie

**Que el ruleset siga puesto.** Vive en la configuración de GitHub, no en el repositorio, y leerlo
cuesta una llamada de red: los tests de este repo corren sin red a propósito, que es la misma razón por
la que `estado` y `titulo` están copiados en `specs/mapa.json`. El gate cruza las copias que están en
el árbol y **declara** que ésta no la mira.

Si alguien borra el ruleset, nada del repositorio se pone en rojo. Comprobarlo es una llamada:

```bash
gh api repos/federicohermo/pentomino-games/rulesets/21477023
```

Si algún día se quiere cubrir de verdad, el lugar es un paso de la Action y no un test: ahí sí hay red
y hay token.

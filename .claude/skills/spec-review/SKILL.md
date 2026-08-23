---
name: spec-review
description: Especialización de /spec-review para pentomino-games: rutas de specs/, formato de tarea y tools MCP de dominio. Se lee junto con el skill global.
---

# spec-review — pentomino-games

Este archivo **no reemplaza** al skill global: aporta lo que en este repo es distinto. Los ejes A–F,
los gates y el formato del reporte salen de allá.

> **Y por eso no lleva `context: fork`.** Un skill forkeado convierte su contenido en el prompt de un
> subagente **sin acceso al historial de la conversación**, y este archivo no es una tarea: es la
> mitad de una. Forkearlo dejaría al subagente con las rutas y las excepciones del repo, y sin los
> ejes que corrigen.

## Rutas — dónde está cada cosa acá

El global dice que `specs/README.md` "suele ser el registro de deuda abierta". **Acá no lo es**, y
buscar la deuda ahí la deja fuera del review entero. El registro está partido en cuatro:

| Archivo | Qué tiene | Para qué eje |
|---|---|---|
| `specs/log.md` | La tabla de specs con su estado, y las dependencias entre specs | Alcance, colisión de número |
| **GitHub Issues** (`mcp__github__list_issues`) | **La deuda registrada sin spec.** Es el mapa síntoma → deuda del eje D | D · Deuda |
| `specs/revisiones.md` | Qué se aprendió escribiendo o revisando cada spec, con fecha. Acá está el "esto ya se probó y no funcionó" | D · Deuda, y anclaje |
| `specs/README.md` | Solo la convención de formato y el flujo | F · Estructura |

**Los estados `Descartado` y `Superado` son terminales.** Un spec en uno de esos dos no se revisa ni
se corrige: es historia.

**Que el spec bajo review contradiga a uno anterior no es un hallazgo** — sea terminal o mergeado.
Los specs son planes de desarrollo con fecha, no documentación de lo que el código hace hoy: dar
vuelta una decisión vieja es para lo que existe un spec nuevo. No lo reportes, ni siquiera como nota
al pasar. Lo único accionable que sale de una contradicción está en *Un spec mergeado no se
reescribe*, más abajo.

## El contrato de `tasks.md`

Además de lo que pide el eje F del global, en este repo un `tasks.md` nuevo tiene que cumplir el
formato de [`specs/README.md`](../../../specs/README.md#formato-de-una-tarea):

```
- [ ] T012 [P] [M] Descripción, con la ruta del archivo que toca
```

**Esas tareas se le piden a `spec_status` con el argumento `spec`, no abriendo el archivo.** Acotada
así, la respuesta trae ese spec solo y suma `citas`: por tarea, los archivos que nombra entre
backticks, con su línea y con su `T0NN` —o `null` en los specs anteriores a la convención—. Pesa
3.135 bytes de mediana —7.962 el peor— contra los 29.742 del registro entero, y llega parseada, que es
la diferencia que importa:
cruzar archivos a ojo sobre el texto crudo es justo donde se escapa el choque del tercer punto.

Al revisar, verificá:

- **Cada tarea lleva su `T0NN`**, sin duplicados ni saltos, y **los IDs no se renumeraron** respecto
  de la versión anterior del archivo. Renumerar rompe toda referencia que otra tarea le hiciera.
- **`[M]` está donde corresponde.** El global ya pide que "un AC que solo un humano puede firmar esté
  marcado como tal: no es material de loop" — `[M]` es cómo se marca acá. Una tarea que dice
  *escuchar*, *a oído*, *a ojo*, *captura*, *GIF* o *en el navegador* y **no** lleva `[M]` es un
  hallazgo: sin el marcador, `spec_status` la reporta como trabajo pendiente para siempre.
- **`[P]` no miente.** Dos tareas `[P]` del mismo bloque no pueden tocar el mismo archivo — y eso lo
  contesta `citas`: el choque es un `archivo` que aparece bajo dos `tarea` distintas. Es el hallazgo
  más caro de los tres, porque `spec-implement` las abanica en paralelo y el conflicto aparece recién
  al escribir.
- Las de `## Seguimiento (no bloquea)` son deuda anotada a propósito y **no** cuentan como pendientes
  — `spec_status` ya las separa en `seguimiento`, así que la cuenta no hay que rehacerla.

Los specs 001–010 son anteriores a esta convención y **no se reescriben** (ver abajo): no lleves su
falta de IDs como hallazgo.

## Un spec mergeado no se reescribe

Acá los specs son ADR, no documentación viva: registro de qué se decidió y con qué evidencia. Lo que
sí se mantiene al día es `docs/`, `.claude/rules/` y `CLAUDE.md`.

Consecuencia para el review: que el spec bajo revisión **falsifique** algo que un spec anterior
afirma no genera hallazgo por sí solo, y el spec viejo no se toca. El hallazgo existe solo si hay
archivos de `docs/`, `.claude/rules/` o `CLAUDE.md` que **lo siguen afirmando en presente** — esos
son los que se mantienen al día —, y entonces la tarea es actualizarlos y anotar el aprendizaje en
`specs/revisiones.md`. Si ninguno lo afirma, no hay nada que reportar. Hay
precedente: los commits `d936597` (once archivos afirmaban que el eje X del tablero era tiempo) y
`eb154a0` (cinco archivos afirmaban en presente cosas que el 008 falsifica).

## Preguntale al dominio en vez de leerlo

El repo levanta un MCP server que **ejecuta las funciones puras reales** (`.mcp.json` está
commiteado, no hay build). Para los ejes que verifican afirmaciones sobre el modelo, sale más barato
y no puede quedar viejo:

| En vez de | Usá |
|---|---|
| Leer `log.md` y los `tasks.md` para saber en qué quedó cada spec, o abrir uno para auditarle las tareas | `spec_status` — estado, hechas/total y `pendientes`, que descuenta `Seguimiento`, `[M]` y specs terminales; con el argumento `spec`, ese spec solo más `citas` y `cruces` |
| Derivar a mano una rotación, una escala o un retrógrado que el spec afirma | `describe_piece` |
| Recorrer el lookahead a mano para saber qué suena junto | `simulate_board` |
| Verificar que el spec no rompe geometría, `SHAPES` o el modelo musical | `check_invariants`, **en proceso fresco** — el MCP de la sesión cachea los módulos y contesta con el código viejo |
| `grep` para ubicar un símbolo, o abrir un archivo para ver una firma | `find_symbol`, que además da `usedBy` |

`find_symbol` incluye a `mcp-server/`, que importa 31 símbolos del dominio: **tocar una firma de
`domain/` puede romper una tool**, y ese borde de paquete es un eje B que sin la tool se estima
corto. No pasa silencioso —`pnpm verify` typechequea cruzando el borde— pero el spec tiene que
declararlo.

## Convenciones que el eje C tiene que mirar acá

Están en `CLAUDE.md` y `docs/guides/conventions.md`, y las verifica el linter, no la revisión. Las
que un spec suele violar por escrito:

- **Cero `enum`** — `erasableSyntaxOnly` los rechaza (`TS1294`). Conjunto cerrado = const-object en
  `<capa>/constants/` + union type derivado en `<capa>/types/`.
- **Cero `any` y cero `@ts-ignore`.**
- **Los módulos no declaran constantes**, y los imports locales llevan extensión explícita.
- **La dirección de dependencia entre capas** (`domain/` y `audio/` son hermanos sin aristas).
- **Español** en comentarios, commits y specs.
- Un spec que propone una constante nueva tiene que decir **en qué `constants/` va**, y por qué ahí.

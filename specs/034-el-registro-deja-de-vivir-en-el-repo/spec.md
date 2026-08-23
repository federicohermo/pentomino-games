# Spec 034 — El registro deja de vivir en el repo

> Sin ticket: este repo no tiene tablero de Jira. Ver [`specs/README.md`](../README.md).
>
> **No cambia una nota, ni un píxel, ni una línea de `src/` que no sea un test.**
>
> Es el spec que el [033](../033-el-archivo-deja-de-ser-la-interfaz/spec.md) hizo posible y
> deliberadamente no hizo: `specs/NNN-*/` sale del repositorio y el registro pasa a vivir en GitHub
> Issues. Los **cuatro** archivos, no sólo el plan.
>
> **El hallazgo que le da forma:** de las **135** citas por ruta a un archivo de spec, sólo **16
> vienen de afuera de `specs/`**. Las otras 119 son specs citándose entre sí, y ahí está el problema
> real —no el volumen, sino que **la Desviación 2 prohíbe reescribirlos**—. La salida no es reescribir
> 46 specs cerrados: es que **el archivo deje de ser lo que se publica**.

## Problema

`specs/` son 133 archivos y 136 contando los registros. Ninguno lo lee el código, ninguno entra al
bundle, y desde el spec 033 ninguna skill los abre a mano: `spec_status` y `spec_write` los cubren.
Lo único que los sostiene en el repo es la costumbre.

El costo es el que abrió esta conversación: **acumulación**. Un tracker que crece con cada spec, que
nadie poda, y que ya demostró que se desincroniza solo — el PR #44 encontró que `log.md` mentía sobre
**12 de 31 filas**, y los diez specs afectados tenían una casilla abierta pidiendo exactamente eso.
No falló la disciplina una vez: falló siempre.

Un issue no tiene ese modo de falla. Tiene estado propio, se cierra desde un commit con `Closes #N`,
y no hereda el estado del spec que lo parió.

## Lo que la medición cambió del plan que traíamos

Tres cosas, todas medidas sobre el repo de hoy y ninguna prevista:

**1. Las citas de afuera son 16, no 135.** El desglose está en
[`research.md`](./research.md) §1: 13 en `docs/`, 2 en `mcp-server/` y 1 en `DESIGN.md`. Reescribir
16 referencias es una tarde. El bulto —119— es interno a `specs/`, y **se muda junto con lo que lo
contiene**.

**2. Pero esas 119 no se pueden reescribir**, y ese es el problema de verdad. La Desviación 2 dice
que un spec mergeado no se reescribe. Editar 46 specs cerrados para cambiarles un enlace la viola
tanto como editarles una decisión.

**3. Y tres specs no entran en un issue.** El 033 midió el `tasks.md` mayor —41.051 bytes, el 63 %
del body— y concluyó que había margen. Con los cuatro archivos juntos, **3 de 33 se pasan**: el 021
con **95.977 bytes (146 %)**, el 005 con 139 % y el 022 con 138 %.

## Solución

**El archivo deja de ser lo que se publica.** Sigue siendo la fuente que se escribe y se lee
localmente; lo que va al issue es el **resultado de traducirlo**, y la traducción es la que reescribe
los enlaces internos. El spec cerrado no se toca: se lo publica distinto.

Eso resuelve los tres hallazgos de arriba a la vez:

- los 119 enlaces internos se traducen al publicar, sin editar un solo spec cerrado;
- las 16 citas de afuera se reescriben a mano, una vez;
- y el reparto en **body + comentarios** resuelve el tamaño sin partir nada: `spec.md` va al body
  —el mayor es 36.018 bytes, el 55 %— y `research`, `plan` y `tasks` van cada uno a su comentario,
  con su propio límite de 65.536.

### Y el server MCP no habla con GitHub

Es la decisión de diseño más importante y sale de una medición: `mcp-server/` **no tiene hoy una sola
llamada de red** —sus dependencias son `@modelcontextprotocol/server` y `zod`, nada más— y
`mcp:test` corre offline con umbral 100.

Darle un cliente HTTP significaría o mockear la red en los tests —cobertura sin verificación, que es
justo lo que el 029 rechazó al elegir Chromium sobre jsdom— o volver `mcp:test` dependiente de red y
de un token. Ninguna de las dos entra.

Así que **la hidratación la hace quien ya habla con GitHub**: las skills, que tienen `mcp__github__`.
El server sigue leyendo un directorio del filesystem, sin enterarse de dónde salió. `readSpecStatus`
sigue siendo su único punto de I/O, y el AC6 del 033 sigue en pie sin tocarlo.

## Criterios de aceptación

**AC1.** `specs/[0-9]*/` está en `.gitignore` y sus 133 archivos salen del índice. Los tres registros
—`README.md`, `log.md`, `revisiones.md`— **se quedan trackeados**: no son specs, y `revisiones.md` es
aprendizaje transversal que ya se decidió que no va a Issues.

**AC2.** Cada spec tiene su issue, con `spec.md` en el body y `research.md`, `plan.md` y `tasks.md`
cada uno en un comentario. Ningún cuerpo supera los 65.536 bytes — verificable, y el peor caso hoy es
el `tasks.md` del 021 con 41.051.

**AC3.** Existe un **mapa spec↔issue explícito**, versionado, y **no** una convención aritmética.
`NNN → #NNN` es imposible: issues y PRs comparten contador y el repo ya va por **#62**, así que el
spec 014 no puede ser el issue #14. El mapa vive en `specs/log.md`, que ya tiene una fila por spec y
ya es el índice: la columna del enlace pasa a apuntar al issue.

**AC4.** La publicación **traduce** los enlaces `./NNN-*/spec.md` a la URL del issue del mapa. Ningún
archivo de `specs/[0-9]*/` se edita para esto — lo prohíbe la Desviación 2, y el AC7 lo verifica.

**AC5.** Un worktree o un clone limpio se **hidrata**: hay una forma documentada de traer los specs
que el checkout no trae. Medido, y es el corazón del problema: hoy un worktree recibe **136** archivos
de `specs/` y después de la mudanza recibe **3**.

**AC6.** `mcp-server/` sigue **sin dependencias de red** y `mcp:test` sigue corriendo offline con
umbral 100. `readSpecStatus` sigue siendo su único punto de I/O.

**AC7.** Los cuatro gates del 032 siguen diciendo la verdad en un worktree, y **ninguno pasa sin
mirar**. Es el AC más caro y el research §4 mide por qué: hoy, con `specs/` ignorado, tres de ellos
fallan —bien— pero **`T015` pasa con cero carpetas**.

**AC8.** `pnpm verify` en verde, en la máquina **y en un worktree limpio**. Las dos, porque el modo de
falla que este spec puede introducir sólo se ve en el segundo.

## Decisiones

**D1. La fuente de verdad pasa a ser el issue; el directorio local es una caché.**
Es lo que hace que la mudanza signifique algo: si el archivo siguiera mandando, el issue sería una
copia que se desincroniza, y el repo ya tiene su lección sobre copias que nada sincroniza —los cuatro
pares de números del spec 005, el color de fondo en cuatro archivos, `log.md` mintiendo en 12 filas—.

**D2. `log.md` se queda, y pasa a ser el mapa.**
Podría irse a un `project` de GitHub, pero hoy es lo que `spec_status` parsea y lo que da el orden y
las dependencias entre specs. Moverlo es otro spec; convertir su columna de enlace en el mapa
spec↔issue es una línea por fila y resuelve el AC3 sin inventar un archivo nuevo.

**D3. Los specs cerrados no se tocan, ni siquiera para arreglarles un enlace.**
La Desviación 2 no tiene una excepción para «es sólo un enlace». La única línea de un spec congelado
que este repo tocó fue la del 027, y fue para destapar contenido que GitHub descartaba —no para
reescribir una decisión—. Un enlace que apunta a un archivo que ya no está en el repo es historia
correcta: **así se escribió cuando se escribió.**

**D4. La hidratación no es automática.** Un comando explícito, no un hook. Un hook que baja 33 issues
en cada `worktree add` es lento y falla sin red; que sea explícito deja el fallo a la vista y no en
medio de otra cosa.

## Fuera de alcance

- **`revisiones.md`.** Es aprendizaje transversal, no trabajo planificado. Su destino es repartirse en
  `docs/` y `.claude/rules/`, y es otro spec.
- **Migrar `lote.sh` y `matriz.sh` a la tool.** El T044 del 033 lo dejó declarado y sigue abierto: son
  **bash**, y bash no puede llamar una tool MCP. Los dos leen `specs/log.md`, que **se queda**, así que
  este spec no los rompe — pero tampoco los arregla.
- **Borrar `specs/` del historial.** Los archivos salen del índice, no de los commits viejos. Reescribir
  el historial es caro y no compra nada: lo que molestaba era la acumulación en el árbol de trabajo.

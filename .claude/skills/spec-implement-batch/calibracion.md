# Calibración — cómo se erra el reparto en carriles

Cuatro juicios que el Paso 1 tiene que hacer y que salen mal si se hacen de memoria. Cada uno con la
medición que lo fija. Son reglas, no respuestas: el lote que tengas enfrente se deriva igual.

## El shell compartido no es arista

Es el error dominante, y va hacia el lado conservador: como casi todo spec de UI escribe `App.tsx`, el
lote entero parece una cadena de ancho 1.

Medido sobre un lote de cinco specs de UI: **cuatro de los cinco** escribían `App.tsx`, sobre **253
líneas**, en regiones disjuntas —uno metía refs y efectos, otro cambiaba un booleano, otro agregaba una
pieza de estado—. Tratarlo como arista colapsaba el lote a un carril; tratarlo como conflicto daba
**tres**.

La misma cuenta vale para el componente más caliente de la paleta o el panel: archivo chico, regiones
lejanas, conflicto barato.

## Una mención en una tarea de documentación no es una escritura

Las `citas` de `spec_status` son los archivos que la tarea nombra entre backticks, y una tarea los
nombra también cuando lo que hace es actualizar un doc que los enumera. Medido: un spec nombraba
`cell-text.ts` **una sola vez**, dentro de la tarea que agregaba otro archivo a
`directory-structure.md`. Contarla le inventaba una arista con el único spec que sí editaba ese
archivo.

Que la lista salga de una tool no la vuelve verdad: la cita es **dato**, y `citas` trae
`{tarea, archivo, linea}`, o sea el ID de la tarea y no su texto, así que el verbo no viene con ella.
Filtrá por el verbo antes de contar la cita como arista — se lee en las líneas de tarea que el Paso 1
ya trae inyectadas, no en `citas`.

## Lo que un spec declara es intención, no grafo

La sección «Dependencias entre specs» la escribe quien planificó el lote, y planifica en fila porque
así lo pensó. Medido: un lote declarado textualmente como *«una cadena»* de cinco eslabones dio **tres
carriles** al derivar el grafo de archivos.

Derivá primero y contrastá después. Cuando difieren, la diferencia es el hallazgo del batch.

## El número que un spec mueve y otro remide es arista dura

Es la arista más fácil de perder, porque no hay import que la delate: los dos specs escriben el mismo
archivo de constantes y parecen un conflicto.

Medido: una constante de layout que un spec llevaba de 63 a 71 y el siguiente de **71 a 73**. La tarea
del segundo cita el 71 como punto de partida — sin el primero en el árbol, esa tarea es infalsificable
y su medición sale contra el valor equivocado.

Los pares `X → Y` los devuelve `spec_status` en `cruces` (`{tarea, de, a}`, con `de` y `a` **string**
porque hay `4,0 → 11,8`, con coma decimal). Cruzá los `a` contra los `de` del resto: son **7 en todo el
repo**, así que cruzarlos a mano es barato — lo caro era encontrarlos.

---

**Y un caso que no es error sino permiso:** un spec puede declarar que tolera llegar antes que aquel
del que depende. Medido, una tarea escrita así: *«sólo con el 014 mergeado; si el 015 llega antes, la
tarea se deja abierta y la cierra el 014»*. Eso lo saca de la cadena y lo habilita como carril propio.
Buscalo antes de serializar por precaución.

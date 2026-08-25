# Cruces — las contradicciones que sólo se ven con los N specs adelante

**Este archivo es el brief del carril de coherencia** del Paso 3. Siete clases, cada una con el
precedente **medido en este repo** que la fijó, cómo se detecta y qué se edita. Son clases, no
respuestas: el lote que tengas enfrente se deriva igual, y las siete se recorren aunque seis den que no.

Todas se pagan tarde y caro: cuando se descubren, dos ramas del lote ya están escritas y el arreglo es
un rebase. Acá el spec todavía es texto — el hallazgo se corrige en el spec que corresponda y listo.

**Vos no escribís ninguno de esos arreglos.** El contrato del Paso 3 vale entero: devolvés la edición
propuesta con `path:línea` y el texto exacto, y no abrís ni cerrás issues. Lo que sí tenés que devolver
listo para copiar es lo que el padre va a necesitar para el cruce que **excede al lote** y sale como
issue, que son tres cosas y no una:

- **Un título que se entienda fuera del contexto del spec.** Un cruce abarca dos, así que no hay un
  spec solo que le sirva de contexto: es donde un título que arranque con «el problema del 019» no le
  dice nada a nadie dentro de seis meses.
- **El cuerpo con la evidencia**: los dos `path:línea`, el número medido y qué AC queda infalsificable
  si nadie lo toca.
- **`Detectado en #N`**, con el issue del spec en el que iba la edición. Es lo que repone el vínculo
  que daba estar escrito adentro del `tasks.md`; el `#N` sale de `specs/mapa.json` y no del `NNN` —el
  spec 001 es el issue #63—.

Y el label que va a llevar: **`bug` o `enhancement`**, los dos que el repo ya usa. Ninguno propio: un
label para la deuda de los specs vuelve a partir el tracker en dos.

## 1 · Una medición vence cuando otro spec mueve lo medido

La firma de este skill, y la que ningún review suelto puede tener: un `research.md` mide contra el repo
de un día, y el lote cambia ese repo antes de que el spec se implemente.

Medido: el 019 mide que borrar tres filas del panel se come **exactamente** los 50 px de aire muerto de
la tarjeta del tablero. El 021 borra el layout donde vive ese aire. En el orden declarado la medición
vale; al revés, el 019 mide un colchón que ya no existe.

- **Se detecta** cruzando cada número del `research.md` contra los archivos que los specs anteriores
  reescriben. Si el archivo medido está en la matriz de otro spec, la medición tiene orden.
- **Se edita** el enunciado de la medición para que diga **contra qué base vale**. Una medición sin base
  declarada es infalsificable en cuanto el lote se reordena.

## 2 · Un spec produce el dato que otro apaga

Medido, y es el caso testigo: el 014 hace que la pieza muteada emita `Click` sin `note`, y el 015 pone
`clicks` en `false` — pero `engine.ts:325` (`else if (clicksAudible)`) apaga exactamente la rama muda.
Con los dos puestos la pieza muteada es silencio total, y el **AC11 del 015 pide verificar lo
contrario**.

- **Se detecta** con `find_symbol` sobre la rama que un spec agrega, buscando quién la condiciona.
- **Se edita** el AC del spec de abajo, o su default. La consecuencia visible siempre es un **AC que
  queda infalsificable**: si un AC del lote no se puede firmar con el lote entero puesto, hay un cruce
  de esta clase atrás.

## 3 · Un número que dos specs mueven

La arista más fácil de perder: no hay import que la delate, los dos specs escriben el mismo archivo de
constantes y parecen un conflicto de merge.

Medido: `CELL_PX` va 63 → **71** (014) → **73** (016), y el 019 lo re-deriva y sobrevive en 73 **por 0,1
px**. La tarea del 016 cita el 71 como punto de partida: sin el 014 en el árbol, mide contra el valor
equivocado.

- **Se detecta** con el campo `cruces` de `spec_status` —los `X → Y` de cada tarea ya pareados,
  `{tarea, de, a}`— cruzando los `a` de un spec contra los `de` del resto. `de` y `a` son **string**:
  los pares reales incluyen `4,0 → 11,8` y `0,02 → 0,05`, con coma decimal, que un `Number()` convierte
  en `NaN`. Son **7 en todo el repo**, así que el cruce a mano sale gratis — lo caro era encontrarlos,
  y un grep se los perdía porque el par se escribe `44 → **63**`, con el énfasis de markdown adentro.
- **Se edita** la tarea de abajo para que cite el valor que deja la de arriba. Si el margen es de
  décimas, el AC tiene que decir contra qué valor se mide.

## 4 · Un default que dos specs mueven

Uno lo prende, otro lo apaga, y el segundo no sabe que el primero lo usa para su AC.

Medido: el 015 arranca con los clicks apagados, **dando vuelta la D4 del 009**. Toda decisión del lote
que se apoye en que suenan queda sin piso.

- **Se detecta** listando los defaults que cada spec toca y cruzándolos contra los AC de los demás.
- **Se edita** el AC que se apoyaba en el default viejo.

## 5 · Un spec cierra una tarea de otro

Es el único caso en que un spec escribe **sobre otro**, así que es también el único que dos agentes
pueden pisar a la vez — por eso lo aplica el padre, nunca el agente. Ese argumento no se cae con el
042: se vuelve **más frágil todavía**. Antes «fuera de la carpeta propia» era un path, y un agente que
respetaba `specs/<NNN>-*/` no podía escribirle al vecino ni queriendo; hoy el registro del spec ajeno
es un issue, y un comentario en un issue no tiene carpeta que lo contenga. Lo que era una disyunción
de rutas quedó reducido a una regla escrita, y una regla escrita se respeta o no se respeta — de ahí
que siga siendo del padre.

Medido: el 015 **cierra el `T070` del 011 con un "no"**: el 011 quería borrar el botón de clicks y el
015 lo deja más necesario, porque con el default apagado es la única forma de encenderlos.

- **Se detecta** leyendo las tareas de cada spec que nombran otro spec.
- **Se edita** en los dos lados, y desde el 042 no del mismo modo: el spec nuevo **todavía es texto**,
  así que ahí la nota va en su propio `tasks.md` —que cierra el `T0NN` del viejo, y por qué—; el viejo
  está mergeado y **no se reescribe**, así que lo suyo va como comentario en su issue, que es donde
  este repo guarda el porqué de una decisión. Anotarlo sólo de un lado deja `spec_status` reportando
  trabajo que ya no existe — y como el conteo sale del mismo `spec_status`, el olvido se ve en la
  consulta siguiente.

## 6 · Lo que un spec declara es intención, no grafo

«Dependencias entre specs» lo escribe quien planificó el lote, y planifica en fila porque así lo pensó.
Medido: un lote declarado textualmente como *«una cadena»* de cinco eslabones dio **tres carriles** al
derivar el grafo de archivos.

- **Se detecta** contrastando la matriz del Paso 2 contra ese texto.
- **Se corrige donde se declaró** —el `tasks.md` del spec, si todavía no está mergeado— y el orden corregido es
  el que va al reporte — y el que va a leer quien reparta el lote para implementarlo.

## 7 · Dos specs declaran la misma tarea de documentación

Barato pero contagioso: los dos agregan la misma fila a `directory-structure.md` o reescriben el mismo
docblock, y el segundo llega a un archivo que ya no dice lo que su tarea supone.

- **Se detecta** en la matriz, filtrando por el verbo: una mención dentro de una tarea de documentación
  no es una escritura de código, pero **sí** es una escritura de ese doc.
- **Se edita** dejándola en uno solo, con la razón anotada. Si las dos tienen que quedar, la de abajo
  declara que la de arriba ya tocó el archivo.

---

**Y un caso que no es cruce sino permiso:** un spec puede declarar que tolera llegar antes que aquel del
que depende — medido, una tarea escrita así: *«sólo con el 014 mergeado; si el 015 llega antes, la tarea
se deja abierta y la cierra el 014»*. Eso no se corrige: se verifica que esté escrito, y saca al spec de
la cadena.

# Research — Spec 020

Medido ejecutando `domain/transform.ts` y `domain/music.ts` reales con node, y leyendo `App.tsx` sobre
`main` con los specs 013–017 mergeados.

## 1. El tamaño del problema, medido

```
rotar una vez, hoy (rotación global):
  0° → 90°    cambian 11/12 miniaturas   quieta: X
  90° → 180°  cambian 11/12              quieta: X
  180° → 270° cambian 11/12              quieta: X
  270° → 0°   cambian 11/12              quieta: X
reflejar a 0°: cambian 8/12              quietas: I T U X
```

Once de doce. La `X` es la única que se salva y no por diseño: es simétrica de orden 4, así que sus
cuatro rotaciones dan la misma forma.

Y el número engaña para abajo, porque **la orientación de una pieza no colocada no es sólo visual**:
`arpeggioFor(piece, rotation, mirror, regimen)` mira las dos, así que al rotar la `F` las otras once
también cambian de arpegio. Lo que pasa es que no suenan hasta que se colocan, así que el cambio es
invisible **y** inaudible hasta que ya es tarde.

## 2. Dónde vive hoy la orientación

`App.tsx`, dos `useState` sueltos:

```ts
const [rotation, setRotation] = useState<number>(0); // 0..3
const [mirror, setMirror] = useState<boolean>(false);
```

Y **siete** consumidores, todos derivados de esos dos:

| Consumidor | Qué hace con ellos |
|---|---|
| `transformedShape` (`useMemo`) | `rotateN` + `reflect` para el fantasma y la colocación |
| `noteSet` (`useMemo`) | `arpeggioFor(selected, rotation, mirror, regimen)` |
| `handleCellClick` | los guarda en el `PlacedPiece` nuevo |
| `PiecePalette` (props) | las doce miniaturas (`miniCells(key, rotation, mirror)`) |
| `Board` (props) | el `title` y el texto del fantasma |
| efecto de teclado | `setRotation((rotation + 1) % 4)` y `setMirror(!mirror)` |
| efecto de la rueda | `setRotation(r => rotacionPorRueda(r, e.deltaY))` |

Los siete pasan a leer `orientaciones[selected]`. **Ninguno cambia de forma**, lo que cambia es de
dónde sale el par — que es lo que hace este spec barato pese a tocar siete lugares.

## 3. `PlacedPiece` ya resuelve la mitad difícil

```ts
// domain/types/board.types.ts, hoy
{ id, piece, rotation, mirror, cells, muted }
```

Una pieza colocada **ya lleva su propia orientación**, congelada en el momento del click. Por eso AC11
sale gratis: rotar la pieza en la mano nunca pudo cambiar lo que está en el tablero, y este spec no
abre esa puerta.

O sea que el modelo ya trataba la orientación como una propiedad de la pieza; el único lugar donde
seguía siendo global era la **pieza por colocar**, que es la que no tiene registro propio.

## 4. Los dos efectos de entrada, y el que cambia de forma

**El teclado** (`useEffect` con `[rotation, mirror, togglePlay]`) ya declara sus dependencias reales.
Pasa a `[orientaciones, selected, togglePlay]` o —mejor— a setters funcionales, que lo dejan en
`[selected, togglePlay]`.

**La rueda** es el caso interesante. Hoy se suscribe **una sola vez** y su comentario lo dice explícito:

> Con el setter funcional este efecto no depende de `rotation` y se suscribe una sola vez […]: acá no
> hay ningún valor que el handler tenga que leer.

Con memoria por pieza **sí hay**: el handler necesita saber *cuál* pieza está en la mano para escribir
en la ranura correcta. Dos salidas:

- **Agregar `selected` a las dependencias.** El efecto se re-suscribe al cambiar de pieza: doce valores
  posibles, dos `addEventListener` sobre un nodo. No es un costo.
- Un `selectedRef`. Suscribe una sola vez y **esconde de dónde sale el valor**, que es exactamente lo
  que `App.tsx` ya rechazó por escrito para el efecto del teclado: «la alternativa es un ref con el
  estado para suscribir una sola vez, que es la optimización que este repo no necesita».

Se agrega `selected`. Y el comentario del efecto de la rueda hay que **reescribirlo**, no dejarlo:
va a estar afirmando lo contrario de lo que hace el código.

## 5. Dónde va el tipo `Orientacion`

Hay dos candidatos y uno es una trampa.

`domain/types/transform.types.ts` parece natural —la rotación y la reflexión son operaciones de
`transform.ts`— y además dejaría a `PlacedPiece` reusarlo en vez de repetir los dos campos inline. Pero
eso es un refactor de `domain/` que cruza el borde de paquete: `mcp-server/` importa 31 símbolos del
dominio, y aunque agregar un tipo sea aditivo, cambiar la forma de `PlacedPiece` no lo es.

`components/types/` es lo correcto: la **memoria** de las doce orientaciones es estado del shell, no
del modelo. El modelo ya tiene su representación y es `PlacedPiece`.

El valor inicial (`{ rotation: 0, mirror: false }`) va a `components/constants/`, porque los módulos de
este repo no declaran constantes.

## 6. La paleta con doce orientaciones independientes

`miniCells(key, rotation, mirror)` ya recibe la orientación por parámetro (spec 016), así que la
paleta pasa de llamarla doce veces con el mismo par a llamarla doce veces con doce pares. **La firma
no cambia.**

Y la caja fija de 5×5 del 016 pasa a ser **más** necesaria, no menos. Su docblock dice:

> Con pistas automáticas la `I` sola haría saltar la fila entera entre 5 y 1 celdas de ancho.

Con rotación global eso pasaba en bloque y una vez por rotación. Con doce orientaciones independientes
podría pasar en cualquier momento y por una sola pieza. AC12 lo verifica.

## 7. La lectura de la orientación: por qué el 019 va primero

El spec 019 borra los botones de grados y agrega en su lugar una línea de texto que dice la
orientación, porque **29 de 96 orientaciones suenan distinto sin verse distinto** (6 de 12 piezas: `I T
U V W X`; el detalle está en `019/research.md` §3).

Esa línea es el único lector de la orientación después del 019, y este spec la vuelve **por pieza**:
pasa a decir la de la seleccionada y a cambiar al elegir otra (AC9). Es un cambio de una línea, y es
la razón por la que este spec va después del 019 y no antes: al revés, habría que escribir el lector
dos veces.

El botón `0°` va **acá** y no en el 019 porque sólo existe si hay memoria por pieza. O sea que el 019
saca botones del panel y el 020 devuelve uno — asimetría real, escrita en las dependencias del log.

## 8. Archivos afectados

| Archivo | Qué cambia |
|---|---|
| `src/components/types/` | `Orientacion` y el tipo de la memoria |
| `src/components/constants/` | La orientación inicial |
| `src/App.tsx` | Los dos `useState` → un `Record`; los siete consumidores; los dos efectos |
| `src/components/PiecePalette.tsx` | Las doce miniaturas leen doce pares; el botón `0°`; la línea del 019 |

`domain/`, `audio/` y `mcp-server/` no se tocan.

## 9. Riesgos

| Riesgo | Cuánto | Mitigación |
|---|---|---|
| Un consumidor de los siete se queda leyendo el par viejo | **Alto si se hace a mano** | Borrar los dos `useState` **primero**: el typecheck marca los siete. Es la misma técnica que el 017 usó al sacarle el default al parámetro del régimen |
| Doce orientaciones independientes vuelven la paleta ruidosa | Medio | Es información honesta y a pedido; la alternativa (mostrar las once en canónica) haría que el botón prometa una forma que al apretarlo no entrega |
| El efecto de la rueda re-suscribe al cambiar de pieza | Bajo | Doce valores posibles, dos `addEventListener`. Se elige eso antes que un ref que esconda de dónde sale `selected` |
| Estado invisible que sobrevive a `↺` | **Real, y aceptado** | Es la decisión de D3: `↺` conserva alcance único y la orientación tiene su propio botón. Queda escrito en el spec, no tapado |
| El comentario del efecto de la rueda queda mintiendo | Medio | Tarea explícita de reescribirlo. Un comentario que afirma lo contrario del código es peor que ninguno |

## 10. Lo que este spec le deja al 021

Nada que lo bloquee. El 021 mueve el panel a un dock flotante, y un panel con doce miniaturas que ya no
reflowean es más fácil de dimensionar que uno que cambia de alto al rotar.

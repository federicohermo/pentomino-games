# Plan — Spec 018

Cuatro pasos. El 1 y el 2 son de tipos y constantes y no cambian comportamiento; el 3 es la pura con
sus tests; el 4 es el cableado, que es lo único que no se puede testear sin navegador.

## Paso 1 — La acción nueva

`components/constants/input.constants.ts`: `ACCION` pasa de tres valores a cuatro con `seleccionar`.

El const-object es la forma obligada —`erasableSyntaxOnly` rechaza `enum`— y el precedente exacto está
en el mismo archivo. Sigue sin haber una acción `no-hacer-nada`: la ausencia es `null`, que es lo que
deja que el llamador use el mismo valor para decidir el `preventDefault`.

## Paso 2 — El evento gana los tres modificadores

`components/types/input.types.ts`: `EventoDeTecla` suma `ctrlKey`, `metaKey` y `altKey`.

**Obligatorios, sin `?`.** Un opcional dejaría que un llamador se los olvide y obtenga el
comportamiento de «ningún modificador abajo» en silencio, que es el caso peligroso: la tecla
seleccionaría durante un `Ctrl`+`F`. Es el mismo criterio con el que el 017 dejó `notesForRotation` sin
default en el parámetro del régimen — que el typecheck atrape al llamador olvidado es el punto.

`shiftKey` **no** se agrega: AC3 dice que con `Shift` abajo la letra igual selecciona, así que la
información no la usa nadie.

Este paso rompe el typecheck de `App.tsx` hasta el paso 4, que es la señal correcta. Y rompe también el
factory `tecla` de `input.test.ts:19` —arma el evento con defaults y le van a faltar tres campos—: los
tres van ahí en `false` **en el mismo paso**, o los tests del paso 3 se escriben sobre un archivo que no
compila y ninguno de los siete puede correr para verse fallar.

## Paso 3 — Las dos puras y sus tests

**`piezaDeTecla(key: string): PieceKey | null`** — normaliza a mayúscula y estrecha contra `SHAPES` con
un type predicate propio (`(k: string): k is PieceKey`) cuyo cuerpo es el `in`-check. El `in` a secas
**no estrecha** y está medido en `research.md` §8: estrecha el objeto, no la clave. Es una función aparte de `accionDeTecla` y no una rama adentro, por dos motivos:
`accionDeTecla` devuelve *qué acción*, no *sobre qué*, y ensanchar su retorno a un par le cambiaría el
tipo a los tres gestos que no lo necesitan. El llamador pregunta las dos cosas.

**`accionDeTecla`** — gana la rama de las letras, **después** de las dos guardas de hoy
(`targetEsControl`, `repeat`) y **antes** de las tres de los modificadores, con su propia guarda:

```
si ctrlKey || metaKey || altKey            → cae a la rama siguiente, NO a un return de la función
si tipo === 'keydown' && piezaDeTecla(key) → seleccionar
```

El orden adentro de la rama importa: los modificadores se miran antes que la letra porque `Ctrl`+`F` no
es una selección vetada, es un evento que no es nuestro.

Dónde **no** va esa guarda importa más: al tope de `accionDeTecla` sería un `return null` que también
alcanza a la barra y a los dos modificadores del 013, y `Ctrl`+espacio dejaría de arrancar el
transporte — un cambio de comportamiento que este spec no pide y que ningún AC pediría (AC11). La
guarda es de la rama de las letras.

Y el `tipo === 'keydown'` no es de adorno: `despachar` llama a la pura en los **dos** eventos, así que
sin él la letra también selecciona al soltarse. El caso concreto es soltar el `Ctrl` antes que la `V`
en un `Ctrl`+`V`: el `keyup` de la `V` llega con `ctrlKey: false`, pasa la guarda de modificadores y
deja la pieza `V` en la mano después de un gesto que no era nuestro (AC4).

`frenaElDefault` **no se toca** — su condición ya es `key === ' '`, así que AC6 sale solo. Igual se
escribe el test: que hoy salga gratis no significa que mañana alguien no lo generalice.

Tests en `components/__tests__/input.test.ts`: las doce letras, minúscula y mayúscula, los tres
modificadores, `targetEsControl`, `repeat`, una tecla que no es pieza, el `keyup` de una letra sin
modificador —que **no** selecciona—, que la barra con `Ctrl` abajo **siga** siendo transporte (AC11), y
que `frenaElDefault` siga diciendo `false` para todas.

## Paso 4 — El cableado

`App.tsx`, en el `despachar` del efecto de teclado:

1. El objeto `evento` suma `ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey`.
2. La cadena de `if`/`else` suma la rama `ACCION.seleccionar` → `setSelected(piezaDeTecla(e.key)!)`.

Ese `!` no va. La forma correcta es preguntar por la pieza y salir si es `null`:

```ts
if (accion === ACCION.seleccionar) {
  const pieza = piezaDeTecla(e.key);
  if (pieza !== null) setSelected(pieza);
}
```

Redundante contra la pura y **a propósito**: el repo prohíbe `any` y `@ts-ignore`, y un `!` es la misma
afirmación sin prueba. Dos llamadas a una función pura sobre el mismo string no son un costo.

Las dependencias del efecto **no cambian**: hoy son `[rotation, mirror, togglePlay]` y `setSelected` es
un setter de `useState`, cuya identidad React garantiza estable.

El footer suma el gesto, en el mismo idioma que los tres del 013. Y la tabla «Cómo se toca» de
`docs/guides/quickstart.md` suma su fila: es la única doc del repo que enumera los gestos, y el footer
—que es producto, no documentación— no la reemplaza.

## Verificación

`pnpm verify` (lint ‖ typecheck ‖ test ‖ mcp:test) y las tareas `[M]` en el navegador: las doce letras,
`Ctrl`+`F`, el foco en el slider de tempo, y `Shift`+`f` para AC3 — que es la que no se puede ver
leyendo.

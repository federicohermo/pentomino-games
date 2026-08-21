# Plan — Spec 018

Cuatro pasos. El 1 y el 2 son de tipos y constantes y no cambian comportamiento; el 3 es la pura con
sus tests en `environment: 'node'`; el 4 es el cableado.

Una corrección de fondo sobre el paso 4, y viene de releer el árbol el 2026-08-21: cuando esto se
escribió, el cableado vivía en `App.tsx` y «no se puede testear sin navegador» quería decir «no se
puede testear». Desde el 022 vive en `src/components/use-input.ts` y desde el 029 **hay** navegador —un
proyecto de Vitest sobre Chromium, con `use-input.browser.test.tsx` y `App.browser.test.tsx` ya
escritos— y hay **gate**: 100 en las cuatro métricas. O sea que el paso 4 ya no es la parte sin red: es
la parte que trae su propia red, y sin ella no mergea.

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

Este paso rompe el typecheck de `use-input.ts` —donde vive el objeto `evento` desde el 022— hasta el
paso 4, que es la señal correcta. Y rompe también el
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
(`targetEsControl`, `repeat`) y **antes** de las tres ramas de `Shift` / `Control` / barra, con su
propia guarda. Nada de `targetEsCelda` acá: es la quinta guarda que agregó el 026 y vive adentro de la
rama de la barra, porque apaga una sola tecla; la letra sigue siendo nuestra con una celda enfocada
(AC13), que es lo mismo que el 026 decidió para `Shift` y `Ctrl`.

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

El reparto lo fijó el spec 022 y son **dos** archivos, no uno:

**`src/components/use-input.ts`**, adentro de `despachar` (líneas 81-102):

1. El objeto `evento` suma `ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey`.
2. La interfaz `Acciones` (36-40) suma `seleccionar: (pieza: PieceKey) => void`.
3. La cadena de `if`/`else` suma la rama `ACCION.seleccionar` → `acciones.seleccionar(pieza)`.
4. El array de dependencias (119) suma `seleccionar`.

**`src/App.tsx`**: un callback nuevo al lado de `rotarConTecla` y `reflejarConTecla` (249-250) que
envuelve a `setSelected`, y un campo más en el objeto de la llamada a `useAtajosDeTeclado` (258-261).
**Callback y no el setter pelado**, aunque `setSelected` sea asignable: el docblock de `use-input.ts`
(18-21) dice por qué los dos hooks reciben callbacks —para que el día en que la ranura de estado cambie
de forma, el cambio caiga en el shell y no acá adentro—. Con dependencias vacías, igual que `alRotar`.

**Dónde va la rama importa tanto como qué hace.** La cadena de hoy (`use-input.ts:96-101`) termina en un
`else transporte()` **sin condición**: es el catch-all del transporte. Una rama nueva agregada como
`if` suelto **después** de la cadena deja que la letra arranque el transporte y además seleccione, y
eso pasa el typecheck y el lint. Va como `else if` **antes** del `else togglePlay()`, que sigue siendo
el catch-all:

```ts
if (accion === ACCION.rotar) rotar();
else if (accion === ACCION.reflejar) reflejar();
else if (accion === ACCION.seleccionar) {
  const pieza = piezaDeTecla(e.key);
  if (pieza !== null) seleccionar(pieza);
}
else transporte();
```

Y ese `!` del punto 2 no va: la forma correcta es preguntar por la pieza y salir si es `null`, como
arriba.

Redundante contra la pura y **a propósito**: el repo prohíbe `any` y `@ts-ignore`, y un `!` es la misma
afirmación sin prueba. Dos llamadas a una función pura sobre el mismo string no son un costo.

Las dependencias del efecto **sí cambian**, y de una sola forma: hoy son
`[rotar, reflejar, transporte, tapLimpio]` (`use-input.ts:119`) y suman `seleccionar`. Los campos van
por separado y el objeto `acciones` **no** entra crudo — el porqué está escrito en el docblock del hook
(57-60) y este spec no lo toca. Del lado del shell el callback nuevo puede ir con dependencias vacías
porque su cuerpo sólo llama a `setSelected`, un setter de `useState` cuya identidad React garantiza
estable.

**Y el paso 4 trae sus tests**, que es lo que cambió desde que este plan se escribió: `acciones()` en
`use-input.browser.test.tsx:24` deja de typechequear en cuanto `Acciones` gana un campo, la rama nueva
de `despachar` necesita un test que apriete una letra y verifique que llama a `seleccionar` **y no a
`transporte`**, y el callback nuevo de `App.tsx` cuenta como una función más contra el umbral 100.

El footer suma el gesto, en el mismo idioma que los tres del 013 (`App.tsx:433-439`, los `<span>` en
436-438). Y la tabla «Cómo se toca» de
`docs/guides/quickstart.md` suma su fila: es la única doc del repo que enumera los gestos, y el footer
—que es producto, no documentación— no la reemplaza.

## Verificación

`pnpm verify` (lint ‖ typecheck ‖ **suite** ‖ mcp:test, con el umbral 100 adentro de `suite`) y las
tareas `[M]` en el navegador: las doce letras,
`Ctrl`+`F`, el foco en el slider de tempo, y `Shift`+`f` para AC3 — que es la que no se puede ver
leyendo.

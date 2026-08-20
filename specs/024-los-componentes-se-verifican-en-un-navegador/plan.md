# Plan 024 — Los componentes se verifican en un navegador

Cuatro pasos. El primero es infra, el segundo la trampa, el tercero los tests y el cuarto el registro.

**Precondición: el 023 mergeado.** Dos cosas dependen de él — `vitest` en 4.1.11 (porque
`@vitest/browser-playwright` se publica pinneado a la versión exacta) y el workflow al que este spec le
agrega un paso.

## Paso 1 — La infra, y verla correr antes de escribir un test

Instalar las tres dependencias, bajar Chromium, y partir `test` en dos proyectos.

El orden importa: **primero se hace correr un test trivial en el navegador**, y recién después se
escriben los seis de verdad. Si el arranque de Chromium, el `provider` o la compilación del JSX fallan,
conviene que fallen contra tres líneas y no contra seis tests que además podrían estar mal escritos.

Lo que el proyecto de navegador **repite y no hereda** —`plugins: [react(), tailwindcss()]`— va con su
comentario: está medido que sin eso el JSX no compila, y es justo el tipo de línea que alguien borraría
por parecer duplicada.

**Verificación:** `pnpm test` reporta los dos proyectos, y los 322 de node siguen en 322.

## Paso 2 — El setup del navegador, que es la trampa de este spec

`vitest.setup.browser.ts`, con una sola línea de contenido —el `import` de `styles/index.css`— y un
docblock que ocupe más que el import, porque el argumento es lo que hay que conservar:

> Sin esta hoja, `getComputedStyle` devuelve los valores por defecto y **un test de layout falla igual
> que fallaría un bug real**. Medido: `z-10` en el `className` y `zIndex: 'auto'` computado.

Va en el setup del proyecto y no en cada test **a propósito**: es una condición de correctitud del
oráculo, no una conveniencia. Un test que se olvide del import no da un error de importación, da un
resultado equivocado.

**Verificación:** el test de `z-index` del paso 3 tiene que pasar **con** el setup y fallar **sin** él.
Se comprueba sacándolo y volviéndolo a poner.

## Paso 3 — Los seis tests

Uno por invariante de `research.md` §7. El criterio de D5 manda: cada test cita el docblock que hoy
sostiene solo lo que él verifica.

Se escriben en dos tandas, porque prueban cosas distintas:

**Tanda A — comportamiento (tests 1 y 2).** La rueda y `Ctrl`+rueda. Montan `App` y no `Board`: el
listener lo cuelga `useRuedaRota` desde el shell, así que un `Board` suelto daría un test que pasa por
la razón equivocada — está medido.

Estos dos son los únicos que **sobreviven al lote 018–021** (`research.md` §11), así que son también
los que más rinden.

**Tanda B — layout (tests 3 a 6).** `z-index`, ancho de la grilla, caja de las miniaturas, alto de la
línea de notas. Dependen del setup del paso 2.

Se escriben como **invariantes y no como medidas**: «el `body` no gana scroll horizontal», «el alto no
cambia entre el mejor y el peor caso», «el ancho es igual entre dos rotaciones». Nunca «mide 730,7 px».
Es lo que hace que sigan valiendo cuando el 019 y el 021 muevan los números, y lo que evita convertir
tres tablas de mediciones en tres tests que hay que actualizar a mano.

**Verificación, y es un AC:** hay que **ver fallar** el test de la rueda. Se mueve el listener a un
`onWheel` de JSX, se confirma el rojo, y se revierte. Un test que nunca se vio en rojo no está
verificado — es la misma regla que el 023 aplica a su workflow.

## Paso 4 — La CI y el registro

Un paso en el workflow: `pnpm exec playwright install --with-deps chromium`, antes de `pnpm verify`.

`.gitignore` gana `.vitest-attachments/` y los `__screenshots__/` que Vitest escribe **al lado del
test** cuando uno falla. Verificado: aparecen dentro de `src/components/__tests__/`.

Y el registro. `deuda.md` **no borra** el ítem de tests de UI: lo reescribe con la mitad que queda
abierta (D6). Seis invariantes bajo test no son la superficie de seis componentes, y decir que sí sería
el mismo error que el propio registro se corrigió con el `title` del tablero — «quedó anotado como si lo
cubriera, que es peor que no anotarlo».

Los tres archivos que hoy afirman que el repo no tiene tests de UI o que todo corre en `node`
—`CLAUDE.md`, `.claude/rules/ui.md`, `docs/guides/quickstart.md`— pasan a decir lo que hay.

## Orden

```
paso 1 ─→ paso 2 ─→ paso 3 (tanda A ‖ tanda B)
                          ↘
                            paso 4
```

## Qué NO se toca

- Los 16 archivos de test que existen. Ni uno.
- `environment: 'node'` del proyecto de node.
- `domain/` y `audio/`, que se testean donde se testean.
- Snapshots visuales, coverage, jsdom.

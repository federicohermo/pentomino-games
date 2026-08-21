# Plan 025 — El estado que se pinta también se anuncia

Cuatro pasos, de menos a más superficie.

**No hay nada que esperar.** El plan original decía «conviene con el 024 mergeado»; el proyecto de
navegador ya está en `main` desde el **029**, que lo construyó siguiendo el diseño del 024. Los tres
componentes que se tocan ya tienen su `*.browser.test.tsx`, así que los tests del paso 4 se **agregan a
archivos que existen**.

## Paso 1 — El atributo del documento

`index.html`: `lang="en"` → `lang="es"`.

Se toca **sólo eso** de ese archivo, aunque haya cuatro cosas más de CRA a la vista. Las otras cuatro
son identidad y son del 028; ésta es accesibilidad. Mezclarlas haría que el commit que arregla WCAG
3.1.1 se lea como un commit de branding.

## Paso 2 — El slider

Tres cambios en `TransportPanel.tsx`:

1. `id` en el `<span>Tempo</span>`;
2. `aria-labelledby` en el `input` apuntando a ese `id` — **no** un `aria-label` con el mismo texto;
3. `aria-valuetext={`${tempo} bpm`}`.

El comentario cita el argumento que ese archivo ya tiene escrito para el ojo («"110" a secas no dice si
son bpm o intervalos») y dice que el `aria-valuetext` es la misma decisión para el oído. Que el número y
la unidad salgan de la misma variable que pinta el `<span>` es el punto: no hay dos lugares que puedan
discrepar.

## Paso 3 — Los cuatro controles con estado

`PiecePalette.tsx`. Dos formas distintas y conviene no mezclarlas:

**Los dos toggles** (Reflexión, Recorrido en el vacío) — el botón pasa a llamarse por lo que hace y su
estado va en `aria-pressed`. El texto visible `ON`/`OFF` no se toca.

**Los dos grupos** (rotación, régimen) — `role="group"` sobre los `div.flex.gap-1` que ya existen
(`PiecePalette.tsx:74` y `:82`, cero nodos nuevos), con `aria-labelledby` apuntando al `<span>` de al
lado, que gana un `id` — igual que el de Tempo en el paso 2 —, y `aria-pressed` en cada botón. D4
explica por qué no es un `radiogroup`, y el comentario en el código lleva la versión corta: un
radiogroup obliga a un modelo de foco, y ese modelo lo fija el 026.

**Y las doce miniaturas**, en `OrientationPanel.tsx`: `aria-pressed={activo}`. Es el mismo defecto —el
fondo del botón es, textual, «el canal de "seleccionada"»— y es el archivo que el paso 4 ya abre para el
`type`. No llevan `role="group"`: la etiqueta que lo nombraría (`<h2>Piezas</h2>`) vive en el otro
componente.

Es importante que ese comentario esté, porque «esto debería ser un radiogroup» es lo primero que va a
pensar quien lo lea, y la respuesta no es «no sabíamos» sino «todavía no hay con qué ser consistente».

## Paso 4 — `type="button"`, la regla, y los tests

**`type="button"`** en los 22. Mecánico, en su propio commit, para que el diff de los pasos 2 y 3 se
pueda leer.

**La regla en `.claude/rules/ui.md`.** Es lo que sobrevive a que el 019 borre dos de los controles de
arriba, y lo que evita que el botón SVG solo-icono que el 019 crea nazca mudo. Tres cláusulas:

- todo control **solo-icono** lleva `aria-label` — el glifo no es un nombre;
- todo control que **alterna** lleva `aria-pressed`, y su nombre es lo que alterna, no el valor;
- la etiqueta se **toma del texto visible** con `aria-labelledby` cuando ese texto ya está en pantalla,
  en vez de duplicarse en un `aria-label`.

Las tres ya existen en el repo como comentarios sueltos —el del `▶`/`⏸` en `TransportPanel.tsx` y el del
`aria-label` de las miniaturas en `OrientationPanel.tsx`—. El paso es promoverlas de comentario a regla,
que es el movimiento que este repo hace todo el tiempo.

**Los tests**, sobre la infra que el 029 ya dejó en `main`, consultando por **rol y nombre**. Van
dentro de los tres archivos que ya existen —`TransportPanel.browser.test.tsx`,
`PiecePalette.browser.test.tsx`, `OrientationPanel.browser.test.tsx`— y con el idioma del repo, que es
`page` de `vitest/browser` y no `screen` de testing-library:

```tsx
page.getByRole('slider', { name: 'Tempo' })
page.getByRole('button', { name: /^Reflexión$/, pressed: false })
```

El nombre va anclado con regex porque `getByRole` empareja por subcadena, que es el mismo tropiezo que
`PiecePalette.browser.test.tsx:93-94` ya tiene anotado.

Es la primera vez que un test del repo pregunta por el árbol de accesibilidad en vez de por la
estructura, y es la diferencia entre verificar accesibilidad y verificar que se escribió un atributo.

**Y el AC1 aparte.** `index.html` no lo carga el browser mode, que sirve su propio documento: se
verifica con un test de `environment: 'node'` que lee el archivo. Sin eso, `lang="es"` es el único
criterio del spec que nada falsea, y el umbral 100 del 029 no lo cubre porque no es código de `src/`.

## Orden

```
paso 1  (independiente)   index.html
paso 2  (independiente)   TransportPanel.tsx
paso 3  (independiente)   PiecePalette.tsx + OrientationPanel.tsx
        ↘
          paso 4 — type=button, la regla, y los tests de los tres anteriores
```

Los tres primeros no comparten archivo: van `[P]`, y el `[P]` cruza los bloques —dentro de cada uno hay
una sola tarea paralelizable—. Adentro del paso 4 el `[P]` es más chico de lo que parece: **dos de los
tests caen en el mismo archivo** (`PiecePalette.browser.test.tsx`), así que van en serie.

## Qué NO se toca

- El tablero. Es el 026.
- El resto de `index.html`. Es el 028.
- El texto visible `ON`/`OFF`, las clases, el orden del DOM (AC9).
- El foco: este spec **no cambia una sola parada de tabulación**.
- Un `role="group"` sobre las doce miniaturas: necesitaría el `<h2>` del otro componente.
- El texto `cambia` como nombre del grupo de régimen: es un verbo suelto y se anuncia raro, pero
  cambiarlo sería tocar la interfaz (spec, D4).

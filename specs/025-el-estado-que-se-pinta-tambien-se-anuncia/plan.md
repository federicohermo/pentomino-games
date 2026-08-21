# Plan 025 — El estado que se pinta también se anuncia

Cuatro pasos, de menos a más superficie. **Conviene con el 024 mergeado**: sin él los ACs se verifican
con las devtools a mano, que es lo que este repo evita en todo lo demás.

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

**Los dos grupos** (rotación, régimen) — `role="group"` con `aria-labelledby` sobre la etiqueta que ya
existe, y `aria-pressed` en cada botón. D4 explica por qué no es un `radiogroup`, y el comentario en el
código lleva la versión corta: un radiogroup obliga a un modelo de foco, y ese modelo lo fija el 026.

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

**Los tests**, sobre la infra del 024, consultando por **rol y nombre**:

```tsx
screen.getByRole('slider', { name: 'Tempo' })
screen.getByRole('button', { name: 'Reflexión', pressed: false })
```

Es la primera vez que un test del repo pregunta por el árbol de accesibilidad en vez de por la
estructura, y es la diferencia entre verificar accesibilidad y verificar que se escribió un atributo.

## Orden

```
paso 1  (independiente)
paso 2  (independiente)
paso 3  (independiente)
        ↘
          paso 4 — type=button, la regla, y los tests de los tres anteriores
```

Los tres primeros no comparten archivo: van `[P]`.

## Qué NO se toca

- El tablero. Es el 026.
- El resto de `index.html`. Es el 028.
- El texto visible `ON`/`OFF`, las clases, el orden del DOM (AC9).
- El foco: este spec **no cambia una sola parada de tabulación**.

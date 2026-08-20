# Spec 025 — El estado que se pinta también se anuncia

> Sin ticket: este repo no tiene tablero de Jira. Ver `specs/README.md`.
>
> **No cambia una nota, ni un píxel.** El documento deja de declararse en inglés teniendo una interfaz
> entera en español; el slider de Tempo gana el nombre accesible que hoy no tiene; y los cuatro
> controles que comunican su estado **sólo con color** pasan a comunicarlo también por el árbol de
> accesibilidad.
>
> Es la mitad que falta de una regla que el repo ya defiende para el ojo. `DESIGN.md` dice que «el
> estado nunca se comunica con hue» y `palette.constants.ts` mide contraste con APCA contra un piso de
> Lc 60 — un rigor que casi ningún proyecto tiene. Lo que no se cubrió es el canal donde no hay color.
>
> **Colisión medida con el 019**: dos de los cuatro controles que este spec arregla, el 019 los borra.
> La salida no es esperarlo (§Colisión), es que la regla sobreviva a los botones.

## Problema

Cuatro cosas, todas de una línea, todas verificadas leyendo el DOM que el repo produce hoy.

### 1. `<html lang="en">` sobre una interfaz enteramente en español

`index.html:2`. Y lo que hay adentro:

> Piezas · Rotación · cambia · escala · orden · Reflexión · Recorrido en el vacío · Tempo · Reset ·
> Señal · «Click en tablero para colocar y escuchar» · «Rueda sobre el tablero o `Shift` rota» ·
> «botón derecho o `Ctrl` refleja» · «`Espacio` arranca y para»

Más el `aria-label` de las doce miniaturas, que el 016 escribió **en español a propósito** para que «el
lector de pantalla diga lo que el ojo ve»: `F, rotación 90°, reflejada`.

Un lector de pantalla usa `lang` para elegir el motor de voz. Con `en`, «Reflexión» y «rotación 90°» se
pronuncian con fonética inglesa: WCAG 2.2 **3.1.1 (Language of Page)**, nivel A. Es el atributo con la
mejor relación entre lo que cuesta y lo que arregla de todo el repo.

Viene de la plantilla de Create React App, como el `manifest.json` que `deuda.md` ya registra.

### 2. El slider de Tempo no tiene nombre accesible

`TransportPanel.tsx:22`:

```tsx
<span className="font-medium">Tempo</span>
<input type="range" min={TEMPO_MIN} max={TEMPO_MAX} value={tempo} onChange={…} />
```

El `<span>` está al lado, no lo etiqueta: no hay `<label for>`, ni `aria-labelledby`, ni `aria-label`.
Un lector de pantalla anuncia «control deslizante, 110» y no dice de qué.

Y hay un segundo hueco en el mismo control, que el propio archivo ya argumentó **para el ojo**:

> Con la unidad: «110» a secas no dice si son bpm o intervalos, y desde el spec 008 el instrumento
> maneja las dos unidades.

Ese argumento vale igual para el oído, y ahí no hay `<span>` que lo salve: un `range` se anuncia con su
valor numérico crudo salvo que tenga `aria-valuetext`.

### 3. Cuatro controles comunican su estado sólo con color

| Control | Qué dice hoy | Qué llega al árbol de accesibilidad |
|---|---|---|
| Reflexión | Texto `ON`/`OFF` + fondo oscuro si está activo | «OFF, botón» — sin decir de qué |
| Recorrido en el vacío | Ídem | Ídem |
| Rotación (`0° 90° 180° 270°`) | Fondo oscuro en el elegido | Cuatro botones sueltos. **Cuál está elegido: nada** |
| Régimen (`escala`/`orden`) | Ídem | Ídem |

Medido sobre `src/`: **cero** `aria-pressed`, **cero** `aria-checked`, **cero** `role=` en los 22
botones y el `input` de la app.

Los dos primeros al menos tienen un nombre —`OFF`—, pero es el nombre equivocado: lo que hace falta
saber es qué se apaga. Los dos últimos son peores: son grupos de selección única donde la selección es
**exclusivamente** un color de fondo, o sea el canal que `DESIGN.md` declara reservado y que este mismo
repo midió con APCA para el texto.

### 4. Ningún `<button>` declara `type`

Los 22. Hoy no hay ningún `<form>` en el árbol, así que **no hay bug**. Pero el default de un `<button>`
dentro de un formulario es `submit`, y en esta app eso significa recargar la página: se pierde el
tablero entero y **no hay deshacer** (`deuda.md`). Es una línea por botón que convierte una bomba futura
en nada.

## Solución propuesta

### D1 — `lang="es"`

Uno. El resto del `index.html` lo toca el spec 028, que es el que se ocupa de los arrastres de CRA;
acá entra sólo éste porque es accesibilidad y no identidad.

### D2 — El slider se etiqueta con el `<span>` que ya está, no con un `aria-label` nuevo

`aria-labelledby` apuntando al `id` del `<span>Tempo</span>`. **No** un `aria-label="Tempo"` duplicado:
sería el mismo texto escrito dos veces, que es exactamente lo que la regla «los módulos no declaran
constantes» existe para evitar, cruzando esta vez el borde entre lo que se ve y lo que se anuncia. Si
alguien cambia la etiqueta visible, la anunciada lo sigue sola.

Y `aria-valuetext={`${tempo} bpm`}`, con el argumento del propio archivo citado al lado: es la misma
decisión que ya se tomó para el ojo, aplicada al oído.

### D3 — Los toggles llevan `aria-pressed`, y el nombre pasa a ser la etiqueta

Reflexión y Recorrido en el vacío dejan de llamarse `OFF` y pasan a llamarse por lo que hacen, con su
estado en `aria-pressed`. El texto visible `ON`/`OFF` **no se toca** —es el idioma visual de la tarjeta y
el 019 tiene planes propios para él—: lo que cambia es que el botón tenga nombre además de valor.

### D4 — Rotación y régimen van como grupo de toggles, no como `radiogroup`

Es la decisión de diseño del spec, y tiene un costo que conviene escribir.

Un `role="radiogroup"` con `role="radio"` y `aria-checked` es lo que el patrón ARIA pide para una
selección única. Pero un radiogroup **obliga a un modelo de foco**: una sola parada de tabulación y
flechas para moverse dentro. Eso es exactamente la decisión que `deuda.md` dice que hay que tomar para
el tablero y que el spec 026 va a tomar — y tomarla acá, para cuatro botones y de paso, sería decidirla
dos veces y probablemente distinto.

Entonces: `role="group"` con `aria-labelledby` sobre la etiqueta que ya existe, y `aria-pressed` en cada
botón. Es válido, es honesto sobre el comportamiento real —siguen siendo cuatro paradas de tabulación,
que es lo que hacen hoy— y **no inventa navegación por teclado que después habría que sostener**.

La versión radiogroup queda anotada en Seguimiento, para cuando el 026 haya fijado el modelo de foco del
repo y haya con qué ser consistente.

### D5 — `type="button"` en los 22

Sin excepción y sin discutir caso por caso: la regla es que un `<button>` de esta app nunca envía nada.

### D6 — Lo importante no son los cuatro botones, es la regla

Dos de los cuatro controles del punto 3 los **borra el 019**, y el 019 además **crea uno nuevo que
nacería con el mismo problema**: muda «Recorrido en el vacío» a la fila de transporte como icono SVG
solo-icono, que es justo el caso donde el botón se queda sin nombre accesible — el mismo que
`TransportPanel.tsx` ya resolvió a mano para `▶`/`⏸` y escribió en un comentario.

Por eso este spec **escribe la regla en `.claude/rules/ui.md`**, y esa es la mitad que sobrevive a que
los botones cambien.

## Criterios de aceptación

- **AC1** — `index.html` declara `lang="es"`.
- **AC2** — El `input[type=range]` de Tempo tiene nombre accesible «Tempo», tomado del `<span>` visible
  por `aria-labelledby` y no duplicado en un `aria-label`.
- **AC3** — Ese mismo control anuncia su valor con la unidad («110 bpm») vía `aria-valuetext`.
- **AC4** — Reflexión y Recorrido en el vacío tienen nombre accesible propio y `aria-pressed` que
  refleja su estado.
- **AC5** — Los cuatro botones de rotación y los dos de régimen viven en un `role="group"` etiquetado
  por su `<span>`, y cada uno declara `aria-pressed`.
- **AC6** — Los 22 `<button>` declaran `type="button"`.
- **AC7** — `.claude/rules/ui.md` tiene la regla escrita, con las tres formas que cubre: nombre
  accesible en todo control solo-icono, estado por `aria-pressed`, y etiqueta tomada del texto visible.
- **AC8** — Un test de navegador (spec 024) afirma AC2, AC3, AC4 y AC5 leyendo el árbol de
  accesibilidad, no el `className`.
- **AC9** — Cero cambio visual: mismo DOM salvo atributos, mismas clases, mismo orden de nodos.
- **AC10** — `pnpm verify` verde.

## Colisión con el 019 y el 020, medida

| Control que este spec arregla | ¿Sobrevive al 019? |
|---|---|
| `lang="es"` | Sí |
| Slider de Tempo (AC2, AC3) | Sí |
| Recorrido en el vacío (AC4) | Sí — se **muda** a transporte y pasa a solo-icono, o sea que **necesita** más el AC7 |
| Régimen `escala`/`orden` (AC5) | Sí |
| Reflexión (AC4) | **No** — el 019 lo borra |
| Rotación `0° 90° 180° 270°` (AC5) | **No** — el 019 los borra |
| `type="button"` (AC6) | Los que queden |

**Dos de los seis frentes se los lleva el 019.** No se difieren por eso: son un defecto de
accesibilidad hoy, el 019 está en `Propuesto` desde hace un día y podría no implementarse nunca, y el
trabajo perdido son dos atributos. Lo que **no** se pierde es el AC7, que es lo que evita que el botón
nuevo del 019 nazca mudo.

El 020 agrega un botón `0°`. Con AC7 escrita, nace con nombre y estado.

## Fuera de alcance

- **El tablero con teclado.** Es el spec 026, y es el hueco grande.
- **El resto del `index.html`** —`manifest.json`, iconos, `theme-color`, `description`—, que es el 028.
- **Un `radiogroup` de verdad**, con roving tabindex (D4). Después del 026.
- **Auditar contraste.** Ya está hecho, medido y documentado, con sus dos excepciones registradas.
- **`aria-live` para lo que cambia solo** (la cabeza lectora, el espectro). Es otra decisión: anunciar
  cambios a 10 Hz es hostil, y el 019 ya trae un lector textual de la orientación que puede ser el lugar
  correcto para esto.

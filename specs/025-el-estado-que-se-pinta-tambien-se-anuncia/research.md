# Research 025 — El estado que se pinta también se anuncia

Medido sobre `main` en `052aedf`, leyendo el DOM que los componentes producen.

> **Revalidado contra `37abf53`**, que es `main` hoy: los specs **029** y **030** mergearon después de
> escribirse esto. `git diff 052aedf..37abf53` sobre `index.html`, `PiecePalette.tsx`,
> `TransportPanel.tsx`, `OrientationPanel.tsx` y `DESIGN.md` devuelve **cero**, así que todos los
> anclajes de abajo siguen en pie tal cual. Cambiaron dos cosas y ninguna es un número: `.claude/rules/ui.md`
> lo reescribió el 030, y la **premisa de §7** —el árbol de accesibilidad ya se puede leer hoy, sin
> esperar al 024.

## 1. Censo de controles

| Componente | Control | Cantidad | Nombre accesible hoy | Estado hoy |
|---|---|---|---|---|
| `OrientationPanel` | Miniatura de pieza | 12 | **Sí** — `aria-label` con letra, rotación y reflexión (016) | **Ninguno**, y el fondo es textual «el canal de "seleccionada"» (`OrientationPanel.tsx:55-57`) |
| `PiecePalette` | Rotación `0/90/180/270` | 4 | Sí, su texto (`90°`) | **Ninguno** |
| `PiecePalette` | Régimen `escala`/`orden` | 2 | Sí, su texto | **Ninguno** |
| `PiecePalette` | Reflexión | 1 | `ON`/`OFF` — el valor, no el control | **Ninguno** |
| `PiecePalette` | Recorrido en el vacío | 1 | `ON`/`OFF` — ídem | **Ninguno** |
| `TransportPanel` | Play/Pausa | 1 | **Sí** — `aria-label`, puesto al dejarlo solo-icono, con el motivo escrito en `TransportPanel.tsx:41-42` | El nombre cambia con el estado, que acá alcanza |
| `TransportPanel` | Reset | 1 | Sí, su texto | N/A |
| `TransportPanel` | Tempo (`input[type=range]`) | 1 | **No** | El valor, sin unidad |

**22 botones + 1 input**, salidos de **siete** sitios de JSX: `OrientationPanel.tsx:80` (×12 por el
`map`), `PiecePalette.tsx:76` (×4), `:84` (×2), `:92`, `:117`, y `TransportPanel.tsx:51` y `:57`.
`Board.tsx` no tiene un solo `<button>`, así que el censo es de los dos paneles y nada más. Búsqueda
exhaustiva sobre `src/**/*.tsx`, sin `__tests__/`:

```
aria-pressed  → 0 ocurrencias
aria-checked  → 0
role=         → 0
aria-label    → 2 (las miniaturas y el play)
aria-labelledby → 0
type="button" → 0
<label>       → 0
```

## 2. El idioma

`index.html:2` — `<html lang="en">`.

Cadenas visibles en español, extraídas del JSX (sin contar comentarios):

```
Piezas · Rotación · cambia · escala · orden · Reflexión · Recorrido en el vacío ·
Notas actuales · Tempo · bpm · Reset · Señal
```

más el footer completo y el `aria-label` de las doce miniaturas, que el 016 escribió en español
deliberadamente: «El `aria-label` dice también la orientación, para que el lector de pantalla diga lo
que el ojo ve».

O sea que **el único texto pensado explícitamente para un lector de pantalla en todo el repo está en
español, y el documento se declara inglés.** No es un descuido de traducción: es que el atributo nunca
se tocó desde la plantilla de CRA. `deuda.md` ya registra al `manifest.json` por lo mismo.

Un dato que refuerza: `index.html` también trae `<meta name="description" content="Pentomino Games">`,
`theme-color: #000000` y el `apple-touch-icon` apuntando a `logo192.png`. Los tres son de la plantilla y
son del spec 028, no de éste.

## 3. Qué anuncia hoy cada control, textual

Simulado leyendo el DOM producido (nombre accesible según el algoritmo de accname):

| Control | Lo que anuncia hoy | Lo que tendría que anunciar |
|---|---|---|
| Tempo | «control deslizante, 110» | «Tempo, control deslizante, 110 bpm» |
| Reflexión | «OFF, botón» | «Reflexión, botón alternar, no presionado» |
| Recorrido en el vacío | «OFF, botón» | «Recorrido en el vacío, botón alternar, no presionado» |
| Rotación 90° | «90°, botón» | «Rotación, grupo · 90°, botón alternar, presionado» |
| Régimen `orden` | «orden, botón» | «cambia, grupo · orden, botón alternar, no presionado» |

Los dos toggles son el caso más claro de por qué esto no es una formalidad: **anuncian su valor y no su
identidad**. Dos botones distintos de la misma tarjeta se anuncian con exactamente la misma cadena.

## 4. El slider, y el argumento que el repo ya escribió

`TransportPanel.tsx:23-27`, comentario textual:

> Con la unidad: "110" a secas no dice si son bpm o intervalos, y desde el spec 008 el instrumento
> maneja las dos unidades.

Ese comentario justifica el `<span>` que dice `110 bpm` al lado del slider. Para el ojo está resuelto.
Para el oído no: el `<span>` no es parte del control, y un `range` se anuncia con `aria-valuenow` crudo.

`aria-valuetext` es el mecanismo previsto por ARIA para exactamente esto, y deja el número y la unidad
en **una sola** fuente — la misma variable `tempo` que ya pinta el `<span>`.

Rango real, de `layout.constants.ts`: `TEMPO_MIN` y `TEMPO_MAX`. El `input` ya los declara como `min` y
`max`, así que `aria-valuemin`/`max` salen solos y no hay que escribirlos.

## 5. Por qué `role="group"` y no `radiogroup` — la medición que lo decide

El patrón ARIA para rotación y régimen sería `radiogroup`. Lo que eso arrastra:

| | `role="group"` + `aria-pressed` | `role="radiogroup"` + `aria-checked` |
|---|---|---|
| Paradas de tabulación | 4 (como hoy) | **1**, con flechas adentro |
| Código de teclado nuevo | Ninguno | Roving tabindex + `ArrowLeft/Right/Up/Down` + `Home`/`End` |
| ¿Consistente con el resto del repo? | Sí — todo tabula hoy | **No hay resto**: el tablero no tabula (026) |
| ¿Cambia el comportamiento del usuario vidente? | No | Sí |

El punto es el tercero. El modelo de foco de este repo **todavía no existe**: `deuda.md` lo dice para el
tablero —«¿una tab stop y flechas, o 60 tab stops?»— y esa pregunta la contesta el 026. Contestarla acá,
de refilón y para seis botones, es decidirla dos veces.

Y hay un argumento de riesgo concreto: un roving tabindex mal hecho es **peor** que no tenerlo — deja
controles inalcanzables. Con `role="group"` no hay forma de empeorar nada, porque no se toca el foco.

## 6. La colisión con el 019, contada por archivo

`019/spec.md` promete, textual: «Mueren los cuatro botones de grados y el ON/OFF de Reflexión […];
`Recorrido en el vacío` se muda a la fila de transporte como metrónomo **SVG** solo-icono».

| Frente de este spec | Archivo | ¿Lo borra el 019? |
|---|---|---|
| `lang="es"` | `index.html` | No lo toca |
| Slider (AC2, AC3) | `TransportPanel.tsx` | No |
| Régimen (AC5) | `PiecePalette.tsx` | No — el 019 borra grados y Reflexión, no el régimen |
| Recorrido en el vacío (AC4) | `PiecePalette.tsx` → `TransportPanel.tsx` | Se **muda**, y pasa a **solo-icono** |
| Reflexión (AC4) | `PiecePalette.tsx` | **Sí** |
| Rotación (AC5) | `PiecePalette.tsx` | **Sí** |

Trabajo que el 019 tiraría: **dos atributos y un `role`**. Trabajo que el 019 *necesita* de acá: el botón
SVG solo-icono que crea nace sin nombre accesible salvo que la regla ya esté escrita — que es el mismo
caso que `TransportPanel.tsx` resolvió a mano para `▶`/`⏸` y dejó anotado:

> `aria-label` porque al sacar el texto el botón se queda sin nombre accesible: el glifo no lo es.

Ese comentario es la regla del AC7 escrita para un botón. Lo que falta es que sea del repo y no de ese
archivo.

## 7. Cómo se verifica

**Reescrita contra `37abf53`.** La versión anterior decía «sin el 024 esto no se puede hacer». **Ya se
puede**: el 029 construyó el segundo proyecto de Vitest —Chromium por Playwright, sufijo
`*.browser.test.tsx`, `setupFiles` con la hoja de estilos— siguiendo el diseño que el 024 había fijado.
El **024 quedó `Superado`** por eso, así que la arista «024 es precondición del 025» del `log.md` ya no
existe: no hay nada del lote 023–028 que este spec tenga que esperar.

Los tres componentes que toca **ya tienen su archivo de test**, con el nombre PascalCase del componente:
`TransportPanel.browser.test.tsx`, `PiecePalette.browser.test.tsx` y `OrientationPanel.browser.test.tsx`.
Los tests nuevos se agregan ahí; no se crea ningún archivo.

El idioma del repo es `page` de `vitest/browser` con `render` de `vitest-browser-react`, **no** `screen`
de testing-library —que se evaluó y se descartó con jsdom—, y el atributo se lee con `.element()`:

```tsx
import { page } from 'vitest/browser';

await expect.element(page.getByRole('slider', { name: 'Tempo' })).toBeVisible();
expect(page.getByRole('slider').element().getAttribute('aria-valuetext')).toBe('110 bpm');
await expect.element(page.getByRole('button', { name: /^Reflexión$/, pressed: false })).toBeVisible();
```

El nombre va **anclado con regex**, por el motivo que `PiecePalette.browser.test.tsx:93-94` ya dejó
escrito: `getByRole` empareja por **subcadena**, y las doce miniaturas traen «rotación 180°» en su
`aria-label`.

Es la primera vez que un test del repo consulta por **rol y nombre** en vez de por estructura, y es la
diferencia entre testear accesibilidad y testear que se escribió un atributo.

**AC1 es la excepción**: `index.html` no lo carga el browser mode, que sirve su propio documento. Va con
un test de `environment: 'node'` que lee el archivo y afirma el atributo — AC12. Sin esa tarea, AC1 es el
único criterio del spec que nada falsea.

## 8. Archivos que toca

| Archivo | Qué cambia |
|---|---|
| `index.html` | Un atributo |
| `TransportPanel.tsx` | `id` en el `<span>`, `aria-labelledby` + `aria-valuetext` en el `input`, `type` en dos botones |
| `PiecePalette.tsx` | Dos `role="group"`, `aria-pressed` en 6 botones, nombre accesible en 2, `type` en 8 |
| `OrientationPanel.tsx` | `type` **y `aria-pressed`** en el botón de la miniatura (×12 por el `map`) |
| `.claude/rules/ui.md` | La regla del AC7. **El 030 lo reescribió**: la sección nueva va sobre ese archivo, que hoy tiene tres encabezados y ninguno de accesibilidad |
| `TransportPanel.browser.test.tsx` · `PiecePalette.browser.test.tsx` · `OrientationPanel.browser.test.tsx` | Los tests de §7. **Los tres ya existen** (029): se extienden, no se crean |
| Un test de `environment: 'node'` | AC12 — `index.html` declara `lang="es"` |
| `DESIGN.md:120` | «El color comunica identidad, nunca estado» gana su mitad no visual |

**Cero cambios en `domain/`, `audio/` y `App.tsx`.**

## 9. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `aria-pressed` sobre un botón cuyo texto ya dice `ON`/`OFF` suena redundante al escuchar | Media | Es el caso previsto: el nombre pasa a ser la etiqueta y `ON`/`OFF` queda como texto visual. AC8 lo verifica leyendo el nombre, que tiene que ser «Reflexión» y no «OFF» |
| Alguien lee `role="group"` como una versión pobre de `radiogroup` | Media | D4 lo argumenta y Seguimiento lo deja anotado con su condición: después del 026 |
| El 019 borra la mitad del trabajo | **Medida: 2 de 6 frentes** | Se acepta explícitamente; lo que sobrevive es la regla (D6) |
| Un cambio visual accidental al agregar atributos | Baja | AC9. Ningún cambio agrega un nodo: los dos `role="group"` van sobre los `div.flex.gap-1` que ya existen (`PiecePalette.tsx:74`, `:82`), así que el `space-y-2` de hijo directo que `PiecePalette.tsx:26-30` argumenta no se toca. Y los tests de alto del 029 (`PiecePalette.browser.test.tsx:66-76`) ya miden los dos que importan |
| Romper un test que hoy está en verde | Baja | Verificado leyendo los tres archivos: `PiecePalette.browser.test.tsx:126-134` localiza Reflexión y Recorrido por `querySelector` y afirma su `textContent`, no su nombre accesible, así que sobrevive al cambio de nombre; los de rotación (`:95`) y régimen (`:109`) buscan por un nombre que no cambia; y `TransportPanel.browser.test.tsx:67` pide `getByRole('slider')` sin nombre |
| Coverage: el umbral del 029 es **100** | Baja | Nada de lo que agrega este spec es una rama nueva —son atributos, y `aria-pressed={mirror}` no bifurca—, así que el gate no se mueve. Lo que sí es obligatorio es que cada AC traiga su test: es la regla del 029 |

# Research 025 — El estado que se pinta también se anuncia

Medido sobre `main` en `052aedf`, leyendo el DOM que los componentes producen.

## 1. Censo de controles

| Componente | Control | Cantidad | Nombre accesible hoy | Estado hoy |
|---|---|---|---|---|
| `OrientationPanel` | Miniatura de pieza | 12 | **Sí** — `aria-label` con letra, rotación y reflexión (016) | Ninguno |
| `PiecePalette` | Rotación `0/90/180/270` | 4 | Sí, su texto (`90°`) | **Ninguno** |
| `PiecePalette` | Régimen `escala`/`orden` | 2 | Sí, su texto | **Ninguno** |
| `PiecePalette` | Reflexión | 1 | `ON`/`OFF` — el valor, no el control | **Ninguno** |
| `PiecePalette` | Recorrido en el vacío | 1 | `ON`/`OFF` — ídem | **Ninguno** |
| `TransportPanel` | Play/Pausa | 1 | **Sí** — `aria-label`, agregado por el 019… no: por el propio 014/016 al sacarle el texto | El nombre cambia con el estado, que acá alcanza |
| `TransportPanel` | Reset | 1 | Sí, su texto | N/A |
| `TransportPanel` | Tempo (`input[type=range]`) | 1 | **No** | El valor, sin unidad |

**22 botones + 1 input.** Búsqueda exhaustiva sobre `src/**/*.tsx`:

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

`TransportPanel.tsx:23-28`, comentario textual:

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

Con el spec 024 puesto, los cinco ACs de contenido se verifican **leyendo el árbol de accesibilidad** y
no el `className`:

```tsx
await expect.element(screen.getByRole('slider', { name: 'Tempo' })).toBeVisible();
expect(slider.getAttribute('aria-valuetext')).toBe('110 bpm');
await expect.element(screen.getByRole('button', { name: 'Reflexión', pressed: false })).toBeVisible();
```

Es la primera vez que un test del repo consulta por **rol y nombre** en vez de por estructura, y es la
diferencia entre testear accesibilidad y testear que se escribió un atributo. Sin el 024 esto no se
puede hacer: `environment: 'node'` no tiene árbol de accesibilidad.

Si el 025 se implementara antes que el 024, los ACs se verifican a mano con las devtools y las tareas de
test quedan abiertas — pero es peor, y por eso el orden del `log.md` los pone al revés.

## 8. Archivos que toca

| Archivo | Qué cambia |
|---|---|
| `index.html` | Un atributo |
| `TransportPanel.tsx` | `id` en el `<span>`, `aria-labelledby` + `aria-valuetext` en el `input`, `type` en dos botones |
| `PiecePalette.tsx` | Dos `role="group"`, `aria-pressed` en 6 botones, nombre accesible en 2, `type` en 8 |
| `OrientationPanel.tsx` | `type` en el botón de la miniatura (×12 por el `map`) |
| `.claude/rules/ui.md` | La regla del AC7 |
| `src/components/__tests__/*.browser.test.tsx` | Los tests de §7 |
| `DESIGN.md` | La frase «el estado nunca se comunica con hue» gana su mitad no visual |

**Cero cambios en `domain/`, `audio/` y `App.tsx`.**

## 9. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `aria-pressed` sobre un botón cuyo texto ya dice `ON`/`OFF` suena redundante al escuchar | Media | Es el caso previsto: el nombre pasa a ser la etiqueta y `ON`/`OFF` queda como texto visual. AC8 lo verifica leyendo el nombre, que tiene que ser «Reflexión» y no «OFF» |
| Alguien lee `role="group"` como una versión pobre de `radiogroup` | Media | D4 lo argumenta y Seguimiento lo deja anotado con su condición: después del 026 |
| El 019 borra la mitad del trabajo | **Medida: 2 de 6 frentes** | Se acepta explícitamente; lo que sobrevive es la regla (D6) |
| Un cambio visual accidental al agregar atributos | Baja | AC9, y los tests de layout del 024 ya cubren los dos altos que importan |

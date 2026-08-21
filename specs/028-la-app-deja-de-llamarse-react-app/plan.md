# Plan 028 — La app deja de llamarse React App

Cuatro pasos, sin dependencias entre ellos y sin dependencias con ningún otro spec. Se puede implementar
en cualquier momento, incluso antes que el 023.

## Paso 1 — Los iconos

Dos commits, por la regla del repo: **«los borrados van en su propio commit, para que revertirlos sea
trivial»**.

**1a. Borrar** `logo192.png`, `logo512.png` y `favicon.ico`. Commit solo. En ese punto el repo queda con
el manifest apuntando a archivos que no existen — es transitorio y dura un commit, y es el precio de que
el borrado sea reversible de un `revert`.

**1b. Agregar** los iconos propios, en los mismos tres tamaños que el manifest pide.

El diseño no se discute: sale de lo que `DESIGN.md` ya fijó y midió — una pieza en uno de los doce
colores, con la baldosa redondeada de borde `slate-900` y el fondo `#f8fafc`. Es aplicación del lenguaje
visual, no una revisión de él.

## Paso 2 — El manifest y el `index.html`

`manifest.json`: nombre, nombre corto, los iconos nuevos, `theme_color` y `background_color` reales.
`start_url` y `display` no se tocan — están bien.

`index.html`, tres líneas:

- `description` — qué es. La distinción que `CLAUDE.md` abre haciendo: un instrumento, no un juego. Es
  el único texto que ven un buscador y el preview de un link, y hoy dice el nombre de la carpeta.
- `theme-color` — el fondo real.
- `apple-touch-icon` — el ícono nuevo.

**`lang` no se toca.** Es del 025. Si el 025 ya está mergeado, ya dice `es`; si no, se queda en `en` y lo
arregla ese spec. Dos specs escribiendo el mismo atributo es peor que esperar un rato.

## Paso 3 — El README

Se reescribe entero. Menos de 40 líneas y con una regla clara: **enlaza, no repite**.

Es el criterio que el repo ya se aplicó a sí mismo con `log.md`, `deuda.md` y `revisiones.md` —«son la
única fuente: no se duplican acá para que no se desactualicen»—. Un README que explique la arquitectura
es un cuarto lugar donde la arquitectura puede quedar vieja.

Estructura:

1. Qué es, en un párrafo. Instrumento, no juego. Pentominós, tablero de 10×6, arpegios, recorrido.
2. Cómo se corre. `pnpm install`, `pnpm dev`, `pnpm verify`. Tres líneas.
3. A dónde ir: `docs/README.md`, `DESIGN.md`, `CLAUDE.md`, `specs/README.md`.

Y una verificación que vale la pena hacer explícita: que no quede **ni una** línea de la plantilla. En
particular el bloque de ESLint, que recomienda `recommendedTypeChecked` / `strictTypeChecked` — una
config que este repo deliberadamente no usa, así que alguien que siga el README estaría deshaciendo
decisiones tomadas.

## Paso 4 — Las dos duplicaciones

**El color.** Una custom property en `index.css`, usada por el `body` y consumida por `App.tsx`. Los dos
lugares siguen existiendo —el `body` cubre el overscroll y el `div` el layout— pero el **valor** se
escribe una vez.

La verificación es literal y está en el AC: `git grep` del color tiene que devolver una línea.

**El `parseInt`.** `Number()` en `TransportPanel.tsx`. Los dos de `palette.test.ts` **no se tocan**:
pasan base 16 y son correctos — vale escribirlo en el commit para que no parezca un cambio incompleto.

## Orden

Los cuatro pasos son independientes. Sugerido por visibilidad:

```
paso 3 (README)  →  paso 2 (manifest + metas)  →  paso 1 (iconos)  →  paso 4 (duplicaciones)
```

El README primero porque es lo que ve cualquiera que abra el repo, y es el único de los ocho arrastres
que no estaba registrado.

## Qué NO se toca

- `lang="es"` — es del 025.
- `robots.txt` y `_redirects` — los dos están bien y hacen falta.
- `DESIGN.md` — manda, no se revisa.
- La lógica de cualquier componente. Este spec cambia texto, imágenes y dos valores.
- Convertir esto en una PWA de verdad — service worker, splash, instalable. Es otra decisión, y grande,
  sobre todo con un instrumento que necesita un gesto del usuario para que suene.

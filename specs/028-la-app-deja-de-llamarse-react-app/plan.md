# Plan 028 — La app deja de llamarse React App

Cinco pasos, sin dependencias de diseño entre ellos ni con ningún otro spec. Se puede implementar en
cualquier momento, incluso antes que el 023.

**Pero comparte texto con cuatro specs del lote** —`App.tsx` (024/026/027), `TransportPanel.tsx` (025),
`index.css` (024), `index.html` (025)—, una a tres líneas en cada uno. Es ortogonal en semántica y no
en texto: no hay que coordinar decisiones, sí hay que coordinar rebases. `DESIGN.md` y `CLAUDE.md` los
lee y no los edita.

## Paso 1 — Los iconos

Dos commits, por la regla del repo: **«los borrados van en su propio commit, para que revertirlos sea
trivial»**.

**1a. Borrar** `logo192.png`, `logo512.png` y `favicon.ico`. Commit solo. Los tres tienen **cuatro**
referencias, no tres: las dos del `manifest.json`, el `apple-touch-icon` de `index.html:12` y el
`<link rel="icon">` de `index.html:5`, que la lista original del spec no enumeraba (T033). En ese punto el repo queda con
el manifest apuntando a archivos que no existen — es transitorio y dura un commit, y es el precio de que
el borrado sea reversible de un `revert`.

**1b. Agregar** los iconos propios, en los mismos tres tamaños que el manifest pide.

El diseño no se discute: sale de lo que `DESIGN.md` ya fijó y midió — una pieza en uno de los doce
colores, con la baldosa `rounded-lg` de borde `slate-900` (`Board.tsx:293`) y el fondo `#f8fafc`. Es
aplicación del lenguaje visual, no una revisión de él.

**Con una exclusión que sale de `deuda.md`: ni `L` ni `Y`.** Son las dos piezas de `LC_EXCEPCIONES`
(`palette.constants.ts:70`), no llegan al piso Lc 60, y el ícono de la app es el peor lugar posible para
estrenar una excepción de contraste — se ve chico, sobre fondos que no controlamos.

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

Y una verificación que vale la pena hacer explícita: que no quede **ni una** línea de la plantilla.

El bloque de ESLint merece un párrafo porque **cambió de signo entre que se escribió este spec y hoy**,
y ese cambio es el mejor argumento del paso 3. Cuando se redactó, el README recomendaba pasar a
`recommendedTypeChecked` y el repo extendía `recommended`: recomendaba algo rechazado. **El 030 lo
adoptó** (`eslint.config.js:255`), así que hoy el README propone como pendiente algo ya hecho — junto a
`strictTypeChecked`, `stylisticTypeChecked`, el `parserOptions.project` a mano (reemplazado por
`projectService: true`) y dos plugins que no están instalados.

Conclusión operativa: **el README nuevo no describe el tooling, lo enlaza.** Un archivo que describe la
config de ESLint se pudre por los dos lados, y acá hay la prueba.

## Paso 4 — Las dos duplicaciones

**El color.** Una custom property en `index.css`, usada por el `body` y consumida por `App.tsx`. Los dos
lugares siguen existiendo —el `body` cubre el overscroll y el `div` el layout— pero el **valor** se
escribe una vez.

**Y la verificación del spec original no servía.** Hoy `git grep -i f8fafc` ya devuelve **una** línea
(`src/styles/index.css:10`): el literal nunca estuvo dos veces. La duplicación es semántica —
`bg-slate-50` **es** `#f8fafc` — y por eso ningún grep del valor la ve. Lo que se verifica: existe un
token, `App.tsx:251` deja de decir `bg-slate-50`, y el único grep que discrimina algo es el de los dos
nombres juntos, **acotado a `src/`**: con el manifest y la `<meta>` arreglados en el paso 2, el literal
queda en cuatro líneas del repo y tres son inevitables — el navegador las parsea sin CSS a la vista. La
fuente única está en `src/`; las tres copias las ata un test (T039) en vez de un comentario.

Más importante: **hoy ningún test mira ese fondo**. Es el único cambio del spec que entra sin red, y
por eso el paso lleva un test propio (AC11): en el proyecto `browser` del 029, el `background-color`
computado del `div` raíz y el del `body` tienen que coincidir.

**El `parseInt`.** `Number()` en `TransportPanel.tsx:22`. Los dos de `palette.test.ts` **no se tocan**:
pasan base 16 y son correctos — vale escribirlo en el commit para que no parezca un cambio incompleto.

Este es el único cambio del spec que **ya tiene test**: `TransportPanel.browser.test.tsx:73`, del 029,
verifica que el tempo viaje como número y no como el string del input. Lo que hay que arreglar en el
mismo commit es su comentario, que nombra al `parseInt` (T036).

## Paso 5 — La doc que este spec falsifica, y el registro

`docs/architecture/directory-structure.md:238-239` afirma **en presente** que los tres iconos están
«Vivos» y que `manifest.json` está «con valores por defecto de CRA». Las dos caen con este spec, y en
este repo los specs son ADR pero `docs/` se mantiene al día — es exactamente el caso de `fb910df`, donde
el 029 dejó cuatro archivos afirmando un solo proyecto de Vitest.

Más `deuda.md` (pierde el ítem del manifest), `revisiones.md` (la lección del README que se pudrió por
los dos lados) y la fila de `log.md`, que arrastra la frase vieja sobre la config de ESLint.

## Orden

Los pasos 1 a 4 son independientes; el 5 va último porque documenta lo que los otros dejaron.
Sugerido por visibilidad:

```
paso 3 (README)  →  paso 2 (manifest + metas)  →  paso 1 (iconos)  →  paso 4 (duplicaciones)  →  paso 5 (doc)
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

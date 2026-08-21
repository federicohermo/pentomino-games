# Research 028 — La app deja de llamarse React App

Medido sobre `main` en `052aedf`.

> **Revalidado sobre `main` en `37abf53`** (con el 029 y el 030 ya mergeados). De los ocho arrastres, los
> ocho siguen exactamente como se midieron: `git diff --stat 052aedf HEAD` sobre el radio de este spec
> cambia **dos** archivos, y ninguno es uno de los ocho. Los dos son:
>
> - **`eslint.config.js`** — el 030 lo reescribió entero y **adoptó `recommendedTypeChecked`**, que es
>   justo lo que el §4 de acá usaba como argumento. Ese párrafo está corregido más abajo: el README
>   sigue estando mal, por el motivo inverso.
> - **`docs/architecture/directory-structure.md`** — el 029 lo puso al día en la sección de tests
>   (`fb910df`), y su tabla de `public/` sigue afirmando en presente dos cosas que este spec falsifica
>   (líneas 238-239). Es AC12 y T032.

## 1. Censo de arrastres

`deuda.md` registra **uno**. Son **ocho**.

| # | Archivo | De dónde viene | ¿Registrado? |
|---|---|---|---|
| 1 | `public/manifest.json` | CRA | **Sí** |
| 2 | `public/logo192.png` | CRA (logo de React) | No |
| 3 | `public/logo512.png` | CRA (logo de React) | No |
| 4 | `public/favicon.ico` | CRA (logo de React) | No |
| 5 | `index.html` — `<meta name="description">` | Escrita a mano, dice el nombre del repo | No |
| 6 | `index.html` — `<meta name="theme-color" content="#000000">` | CRA | No |
| 7 | `index.html` — `<link rel="apple-touch-icon" href="/logo192.png">` | CRA | No |
| 8 | **`README.md`** | Plantilla de **Vite** | **No** |

El 8 es el más visible y el que no estaba anotado.

Lo que **no** es arrastre y conviene dejar escrito para que no se toque:

- `public/robots.txt` — `User-agent: * / Disallow:` permite todo. Correcto.
- `public/_redirects` — `/* /index.html 200`, el rewrite de SPA que Netlify necesita. Correcto y
  necesario.

## 2. El manifest, textual

```json
{
  "short_name": "React App",
  "name": "Create React App Sample",
  "icons": [
    { "src": "favicon.ico", "sizes": "64x64 32x32 24x24 16x16", "type": "image/x-icon" },
    { "src": "logo192.png", "type": "image/png", "sizes": "192x192" },
    { "src": "logo512.png", "type": "image/png", "sizes": "512x512" }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff"
}
```

Cuatro campos mal y tres archivos mal referenciados. `start_url` y `display` están bien.

`theme_color: #000000` contra el fondo real de la app:

```
src/styles/index.css:10   background-color: #f8fafc;
```

En un navegador móvil el `theme_color` pinta la barra de estado. Con `#000000` sobre una app clara, la
barra queda negra y la página blanca: se ve como si la app no hubiera terminado de cargar.

`background_color: #ffffff` es el color del splash mientras la app arranca — también debería ser
`#f8fafc` por lo mismo, aunque la diferencia es de un tono.

## 3. El `index.html`

```html
<html lang="en">
  <meta name="description" content="Pentomino Games" />
  <meta name="theme-color" content="#000000" />
  <link rel="apple-touch-icon" href="/logo192.png" />
  <link rel="manifest" href="/manifest.json" />
```

La `description` no es de CRA —CRA pone «Web site created using create-react-app»— así que alguien la
escribió. Dice el nombre del repo. `CLAUDE.md` abre con la distinción que ese texto no hace:

> Un prototipo de **instrumento musical**, no un juego con reglas de resolución.

Es el único texto que ven un buscador o el preview de un link, y dice lo contrario de lo primero que el
proyecto quiere aclarar sobre sí mismo. El nombre de la carpeta ya dice «games»; la descripción era la
única oportunidad de corregirlo.

`lang="en"` está en esta misma lista y **no lo toca este spec**: es del 025, porque es accesibilidad
(WCAG 3.1.1) y no identidad. Dos specs escribiendo el mismo atributo es peor que esperar.

## 4. El README

69 líneas. Primeras tres:

```markdown
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.
```

Búsqueda de `pentomino|instrumento|arpegio|tablero|musical`, sin distinguir mayúsculas: **cero
coincidencias**.

Y hay un problema peor que el vacío. El bloque «Expanding the ESLint configuration» recomienda:

```js
...tseslint.configs.recommendedTypeChecked,
// Alternatively, use this for stricter rules
...tseslint.configs.strictTypeChecked,
// Optionally, add this for stylistic rules
...tseslint.configs.stylisticTypeChecked,
```

más `parserOptions.project: ['./tsconfig.node.json', './tsconfig.app.json']` y, en el segundo bloque,
`eslint-plugin-react-x` y `eslint-plugin-react-dom`.

**Acá hay una corrección al párrafo original de este research, y es la más importante de todo el
archivo.** Cuando esto se midió (`052aedf`), `eslint.config.js` extendía `tseslint.configs.recommended`
y la conclusión era «el README recomienda una config que este repo deliberadamente no usa». **El spec
030 se mergeó cinco días después y adoptó `recommendedTypeChecked`** —`eslint.config.js:255`, con el
costo medido en el comentario de arriba— así que esa frase ya no es cierta.

Lo que **sigue** siendo cierto, y por eso el AC no se cae sino que se afila:

| Lo que el README propone | Qué hace el repo hoy |
|---|---|
| `...tseslint.configs.recommendedTypeChecked` | **Ya lo usa** (030). El README lo propone como pendiente |
| `...tseslint.configs.strictTypeChecked` | No lo usa |
| `...tseslint.configs.stylisticTypeChecked` | No lo usa |
| `parserOptions.project: [dos tsconfig a mano]` | `projectService: true`, con el porqué escrito en `eslint.config.js:243-246` |
| `eslint-plugin-react-x` / `eslint-plugin-react-dom` | No están instalados |

O sea: **cinco afirmaciones sobre la config de este repo y las cinco están mal**, sólo que dos de ellas
cambiaron de signo entre que se escribió el spec y hoy. Y ahí está la lección real, que vale más que el
diagnóstico: un README que describe el tooling se pudre por los dos lados. Por eso el README nuevo **no
describe la config de ESLint en absoluto** — enlaza a `eslint.config.js`, que está comentado y no puede
quedar viejo respecto de sí mismo.

Contra eso, `docs/README.md` ya existe y arranca bien:

> # Documentación Técnica — Pentomino Games
> Prototipo de instrumento musical basado en pentominós…

O sea que no falta documentación: falta la puerta. Y el repo ya tiene su criterio escrito para no
duplicar —«Son la única fuente: no se duplican acá para que no se desactualicen»—, así que el README
nuevo tiene que **enlazar** y no repetir.

Documentos a los que apuntar, todos existentes: `docs/README.md`, `DESIGN.md`, `CLAUDE.md`,
`specs/README.md`, `docs/guides/quickstart.md`.

## 5. El color escrito dos veces

```
src/styles/index.css:10   background-color: #f8fafc; /* light slate tint to match design */
src/App.tsx:251           <div className="min-h-screen bg-slate-50 text-slate-900 p-4">
```

`bg-slate-50` en Tailwind 4 **es** `#f8fafc`. Son el mismo valor por dos caminos distintos, y nada los
ata: cambiar uno deja una franja de otro color al hacer overscroll.

Los dos hacen falta:

- el `body` cubre lo que se ve **fuera** del documento (overscroll, y el área bajo el `min-h-screen` si
  el contenido es más corto);
- el `div` cubre el layout.

Lo que sobra es que el valor esté escrito dos veces, y es la misma clase de duplicación que el repo ya
persiguió en `src/` —«antes había cuatro pares de números que tenían que coincidir y nada
sincronizaba»— sólo que cruzando el borde CSS/TSX, donde ningún linter del repo mira.

Tailwind 4 tiene la salida natural: una custom property en el `@theme` o en `:root` de `index.css`, que
el `body` usa directamente y `App.tsx` consume por clase arbitraria o por estilo. La forma se decide al
implementar; la condición es que `git grep` del color, **acotado a `src/`**, devuelva **una** línea.

**Y el acotamiento no es cosmético.** Con el manifest y la `<meta name="theme-color">` arreglados
(pasos 2 y 4), el literal `#f8fafc` queda escrito en **cuatro** líneas del repo, no en una: el token,
los dos campos del `manifest.json` y el `<meta>`. Las tres de afuera de `src/` son inevitables — el
navegador parsea el manifest y el `<meta>` sin CSS a la vista, así que ninguna puede leer una custom
property. O sea que el enunciado original del AC («una vez en todo el repo») **lo falsifica este mismo
spec**. La fuente única vive en `src/`; las tres copias son el contrato de la plataforma, y en vez de
anotarlas con un comentario las ata un test (AC13, T039) — que es lo consistente con el argumento de
esta sección: si nada las sincroniza, se desincronizan.

## 6. El `parseInt`

Tres ocurrencias en `src/`:

```
components/TransportPanel.tsx:22   parseInt(e.target.value)                ← sin base
components/__tests__/palette.test.ts:39    parseInt(hex.slice(1), 16)      ← correcto
components/__tests__/palette.test.ts:158   parseInt(hex.slice(1), 16)      ← correcto
```

La primera no puede fallar: viene de un `input[type=range]` con `min`/`max` numéricos, así que
`e.target.value` es siempre una cadena decimal. No hay bug. Lo que hay es una función que toma una base
y no la recibe, donde `Number()` hace lo mismo sin dejar la pregunta abierta.

## 7. El ícono, y de dónde sale

No hace falta inventar identidad: `DESIGN.md` ya la tiene, medida.

| Material disponible | Dónde |
|---|---|
| Los doce colores, con su `fg` elegido por APCA | `palette.constants.ts` |
| La forma de cada pieza | `pieces.constants.ts` (`SHAPES`) |
| La baldosa: redondeada, borde `slate-900`, 2 px de aire | `Board.tsx` |
| El fondo | `#f8fafc` |

Un ícono que sea una pieza dibujada con ese lenguaje es coherente por construcción y no abre ninguna
discusión de diseño. Tamaños que pide el manifest: 192 y 512; más el `favicon.ico`.

Nota de implementación: los tres archivos actuales **se borran**, y por la regla del repo —«los borrados
van en su propio commit, para que revertirlos sea trivial»— eso es un commit aparte del que agrega los
nuevos.

## 8. Archivos que toca

| Archivo | Qué pasa |
|---|---|
| `public/manifest.json` | Se reescribe |
| `public/logo192.png`, `logo512.png`, `favicon.ico` | Se **borran** (commit propio) y se reemplazan |
| `index.html` | Tres líneas — **no** el `lang`, que es del 025 |
| `README.md` | Se reescribe entero |
| `src/styles/index.css` + `src/App.tsx` | El color, una vez |
| `src/components/TransportPanel.tsx` | Una línea |
| `specs/deuda.md` | Pierde el ítem del manifest |
| `docs/architecture/directory-structure.md` | Líneas 238-239: dicen en presente que los tres iconos están «Vivos» y que el manifest tiene los defaults de CRA. Las dos caen con este spec |
| `specs/revisiones.md` | La entrada del 028, con la lección del README que se pudrió por los dos lados |
| `src/__tests__/App.browser.test.tsx` | El test del fondo unificado (AC11) |

**Cero cambios en `domain/`, `audio/` y en la lógica de `components/`.**

## 9. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Cambiar el favicon rompe el build de Netlify | Muy baja | `public/` se copia tal cual; `publish = "dist"` no cambia |
| El color unificado deja una franja distinta en overscroll | Media | AC6 verifica que sea **una** línea, y `[M]` mirarlo con overscroll en móvil |
| El README nuevo duplica `docs/` y se desactualiza | **Media** | D3 y AC4 lo acotan: menos de 40 líneas, y enlaza en vez de repetir |
| Un ícono feo | Media | Sale del lenguaje que `DESIGN.md` ya fija; es aplicación, no rediseño |
| Choque con el 025 sobre `index.html` | Baja | D5: este spec no toca `lang` |

## 10. Dependencias

**Ninguna en semántica; cuatro archivos en texto, y conviene decirlo así.**

No toca un componente por su lógica, no toca una regla del linter y no toca el tooling: nada de lo que
este spec cambia altera lo que otro spec del lote decide. En ese sentido es ortogonal y se puede
implementar en cualquier momento, incluso primero.

Pero **comparte archivo** con cuatro de ellos, y eso son conflictos de merge, no de diseño:

| Archivo | Con quién | Qué toca el 028 ahí |
|---|---|---|
| `src/App.tsx` | 024, 026, 027 | **Una línea**: el `className` del `div` raíz (`App.tsx:251`) |
| `src/components/TransportPanel.tsx` | 025 | **Una línea**: el `parseInt` (`TransportPanel.tsx:22`) |
| `src/styles/index.css` | 024 | El `body` y el token nuevo |
| `index.html` | 025 | Tres líneas, y **no** el `lang`, que es del 025 (D5) |
| `DESIGN.md` | 025, 026 | **Nada.** El 028 lo lee y no lo edita |
| `CLAUDE.md` | 023, 024, 027 | **Nada.** T014 lo **enlaza** desde el README; no lo edita |

Las dos últimas filas están para cerrar la pregunta: la matriz del lote las marca como compartidas y
para el 028 no lo son.

Consecuencia práctica: si el 028 va **primero**, los otros rebasan una línea cada uno. Si va último,
rebasa él. Cualquiera de las dos sirve; lo que no sirve es implementarlo en un carril paralelo al del
024/025 sin saber que estas cuatro líneas se cruzan.

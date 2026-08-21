# Spec 028 — La app deja de llamarse React App

> Sin ticket: este repo no tiene tablero de Jira. Ver `specs/README.md`.
>
> **No cambia una nota, ni un tiempo, ni una regla.** Cierra el ítem de `manifest.json` de `deuda.md`, y
> lo cierra más grande de lo que estaba registrado: **no es un archivo, son ocho** — el manifest, tres
> imágenes, tres metas del `index.html`, y uno que el registro no tenía anotado y es el más visible de
> todos: **`README.md` son 69 líneas de la plantilla de Vite que no nombran el proyecto ni una vez.**
>
> Instalar la app hoy pone en el escritorio un ícono de React llamado «React App», y abrir el repo en
> GitHub muestra «This template provides a minimal setup to get React working in Vite with HMR».
>
> Se lleva de paso las dos duplicaciones chicas que quedaron sueltas: el color de fondo escrito en dos
> archivos y un `parseInt` sin base.

## Problema

### 1. `public/manifest.json` son los defaults de Create React App

`deuda.md` lo registra en una línea:

> **`public/manifest.json` tiene los valores por defecto de CRA** (`"name": "Create React App
> Sample"`).

Y es literal:

```json
{
  "short_name": "React App",
  "name": "Create React App Sample",
  "icons": [ { "src": "favicon.ico", … }, { "src": "logo192.png", … }, { "src": "logo512.png", … } ],
  "theme_color": "#000000",
  "background_color": "#ffffff"
}
```

Los tres iconos que referencia **también** son de la plantilla: `favicon.ico`, `logo192.png` y
`logo512.png` son el logo de React. O sea que la app instalada se llama «React App», tiene el ícono de
React, y declara un `theme_color` negro que no aparece en ninguna parte de este instrumento — el fondo
real es `#f8fafc`.

### 2. `index.html` completa el cuadro

Tres metas más, de la misma plantilla:

| Línea | Qué dice | Qué debería decir |
|---|---|---|
| `<meta name="description">` | `Pentomino Games` | Qué es: un instrumento, no un juego |
| `<meta name="theme-color">` | `#000000` | El fondo real de la app |
| `<link rel="apple-touch-icon">` | `logo192.png` | Un ícono propio |

La `description` es el caso más raro: no es de CRA, la escribió alguien, y dice el nombre del repo en
vez de qué hace. `CLAUDE.md` abre diciendo que esto es «un prototipo de **instrumento musical**, no un
juego con reglas de resolución» — y es exactamente la distinción que el único texto que ven los
buscadores y los previews no hace.

### 3. `README.md` es la plantilla de Vite — y esto no estaba registrado

69 líneas que empiezan así:

> # React + TypeScript + Vite
> This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

y siguen con instrucciones para configurar `tseslint.configs.recommendedTypeChecked`. Verificado: **no
aparece la palabra «pentomino» ni una sola vez**, ni «instrumento», ni «tablero», ni «arpegio».

Es el archivo más leído de cualquier repo y es el único documento del proyecto que no habla del
proyecto. Y no es que falte la documentación: `docs/README.md` existe, está bien y arranca con
«Documentación Técnica — Pentomino Games». Lo que falta es la puerta.

Peor: el bloque «Expanding the ESLint configuration» **describe mal la config de este repo**, y el modo
en que la describe mal cambió después de escribirse este spec. Cuando el 028 se redactó, el repo
extendía `tseslint.configs.recommended` y el README recomendaba pasar a `recommendedTypeChecked`: era
una recomendación que el repo había rechazado. **El spec 030 la adoptó** (`eslint.config.js:255`), así
que hoy el daño es el inverso y sigue siendo daño: el README propone como pendiente algo que ya está
hecho, junto a tres cosas que el repo **sí** descartó a propósito —`strictTypeChecked`,
`stylisticTypeChecked`, y el `parserOptions.project: [...]` a mano, que el 030 reemplazó por
`projectService: true` con el motivo escrito ahí mismo— más dos plugins que no están instalados
(`eslint-plugin-react-x`, `eslint-plugin-react-dom`). Alguien que siga ese bloque hoy deshace trabajo
del 030.

### 4. Dos duplicaciones sueltas

**El color de fondo, en dos archivos:**

```
src/styles/index.css:10   background-color: #f8fafc;  /* light slate tint to match design */
src/App.tsx:251           className="min-h-screen bg-slate-50 …"
```

Son el mismo color escrito dos veces —`bg-slate-50` **es** `#f8fafc`— y nada los sincroniza. Es
exactamente el patrón que la regla «los módulos no declaran constantes» existe para evitar («antes había
cuatro pares de números que tenían que coincidir y nada sincronizaba»), cruzando el borde entre CSS y
TSX, que es donde ningún linter del repo mira.

Los dos hacen falta: el `body` cubre el overscroll y el `div` cubre el layout. Lo que sobra es que el
valor esté escrito dos veces.

**Un `parseInt` sin base:**

```tsx
onChange={e => onTempo(parseInt(e.target.value))}
```

En `TransportPanel.tsx`. Con un `input[type=range]` no puede llegar nada raro, así que no hay bug: hay
una función que acepta una base y no la recibe, donde `Number()` dice lo mismo sin la pregunta. (Los
otros dos `parseInt` del repo están en `palette.test.ts` y **sí** pasan base 16: son correctos.)

## Solución propuesta

### D1 — Un ícono propio, y sale del propio instrumento

Los tres archivos de imagen se reemplazan por iconos derivados de lo que la app ya es: una forma de
pentominó en uno de los doce colores medidos, sobre el fondo del tablero.

**No** se inventa una identidad: `DESIGN.md` ya tiene los doce colores con su medición APCA y el
lenguaje de la baldosa redondeada con borde. El ícono es ese lenguaje en 192 y 512 px.

### D2 — El `theme_color` deja de ser negro y pasa a ser el fondo real

`#f8fafc`, que es lo que se ve. Un `theme_color` negro sobre una app de fondo claro hace que la barra
del navegador en móvil no coincida con la página.

### D3 — El README nuevo es corto y apunta

No se duplica `CLAUDE.md` ni `docs/`. Qué es el instrumento en un párrafo, cómo se corre en tres
líneas, y los enlaces a lo que ya existe: `docs/README.md`, `DESIGN.md`, `specs/`.

El criterio es el del propio repo: «no se duplican acá para que no se desactualicen». Un README que
repite la arquitectura es un cuarto lugar donde la arquitectura puede quedar vieja.

### D4 — El color de fondo se escribe una vez

El valor vive en un solo lado. La forma exacta se decide al implementar —una custom property en
`index.css` que el `body` use y `App.tsx` consuma, o el `body` heredando el del `div`— pero la
condición es la misma: **`git grep` de ese color tiene que devolver una línea**.

### D5 — Lo que este spec NO toca del `index.html`

`lang="es"` es del **025**, y ya está: es accesibilidad, no identidad. Si el 025 todavía no se
implementó, este spec lo deja como está — dos specs escribiendo el mismo atributo es peor que esperar.

## Criterios de aceptación

- **AC1** — `public/manifest.json` nombra a este proyecto, con su `theme_color` y `background_color`
  reales.
- **AC2a** *(mecánico)* — `public/logo192.png` y `public/logo512.png` no existen. Los archivos de
  ícono que quedan tienen los tamaños que el manifest declara, ninguno es byte-idéntico al que estaba
  antes, y `git grep -n "logo192\|logo512"` sobre el árbol —incluido `docs/` y los registros de
  `specs/`— no devuelve nada. **Lo único que el grep no alcanza son las carpetas `specs/NNN-*/`**: ahí
  los nombres viejos son el registro histórico —este mismo AC los escribe, y el research del 025
  también— y borrarlos sería falsificar el spec en vez de cerrarlo. Lo que el AC persigue es que no
  quede una referencia **viva**, y por eso la fila nueva de `directory-structure.md` y el ítem cerrado
  de `deuda.md` cuentan la historia sin escribir los nombres.
- **AC2b** `[M]` — Los iconos se leen como esta app y no como una plantilla. Se comparan contra el
  lenguaje que `DESIGN.md` ya fija y `Board.tsx:293` implementa: baldosa `rounded-lg` con borde
  `slate-900`, uno de los doce colores de `palette.constants.ts` sobre fondo `#f8fafc`. **Ni `L` ni
  `Y`**: son las dos excepciones de `LC_EXCEPCIONES` (`palette.constants.ts:70`), no llegan al piso de
  contraste y un ícono es justo donde eso se ve.
- **AC3** — `index.html` tiene una `description` que dice qué es —un instrumento, no un juego—, un
  `theme-color` que coincide con el fondo, y un `apple-touch-icon` propio. Y **las cuatro** referencias
  a assets resuelven: `index.html:5` (`<link rel="icon">`) es la que la lista original no enumeraba, y
  si el favicon cambia de nombre en el paso 1 esa línea apunta a un 404 que ningún test del repo ve.
- **AC4** — `README.md` habla de este proyecto, en menos de 40 líneas, y **enlaza** a `docs/`,
  `DESIGN.md`, `CLAUDE.md` y `specs/` en vez de repetirlos.
- **AC5** — `README.md` no contiene una sola línea de la plantilla de Vite. Mecánico: `grep -c` de
  `tseslint\|recommendedTypeChecked\|strictTypeChecked\|eslint-plugin-react-x\|plugin-react-swc\|This template`
  sobre `README.md` da **0**. El README nuevo **no describe** la config de ESLint: eso vive en
  `eslint.config.js`, comentado, y repetirlo sería el cuarto lugar donde puede quedar viejo — que es
  exactamente cómo llegamos acá.
- **AC6** — El color de fondo tiene **una sola fuente, y vive en `src/`**. El enunciado original
  («escrito una vez en todo el repo») **lo falsifica el propio spec**: después de implementarlo el
  literal `#f8fafc` aparece en **cuatro** líneas, no en una — el token de `src/styles/index.css`, los
  dos campos del `manifest.json` (T007) y el `<meta name="theme-color">` de `index.html` (T010).
  **Las tres de afuera de `src/` no se pueden evitar**: el navegador parsea el manifest y el `<meta>`
  sin CSS a la vista, así que ninguna puede consumir una custom property. Copiar ahí no es la deuda:
  es el contrato de la plataforma.
  Entonces el AC son tres cosas: **(a)** `git grep -i "f8fafc\|bg-slate-50" -- src` devuelve
  **exactamente una** línea, la del token; **(b)** `src/App.tsx` ya no dice `bg-slate-50` en el `div`
  raíz; **(c)** las tres copias de afuera están **verificadas** y no sólo anotadas — AC13.
  *(La medición del research era del antes, y por eso engañaba: sobre `main` hoy el grep ya devuelve
  una línea, porque el literal nunca estuvo dos veces. La duplicación que este spec cierra es
  semántica —`bg-slate-50` **es** `#f8fafc`— y ningún grep del valor la ve.)*
- **AC7** — `TransportPanel.tsx` no usa `parseInt` sin base.
- **AC8** — `specs/deuda.md` pierde el ítem del `manifest.json`.
- **AC9** — Cero cambio de comportamiento: mismo audio, mismo layout, mismos colores de las doce
  piezas. Mecánico: `pnpm verify` verde con los 562 tests del 029 y el umbral 100 intacto. **Con una
  salvedad medida**: hoy ningún test mira el fondo del `div` raíz de `App.tsx` —`git grep` de
  `bg-slate-50` y `min-h-screen` en `src/` sólo pega en `App.tsx:251`—, así que el cambio de AC6 entra
  sin red. Por eso AC11.
- **AC10** — `pnpm verify` verde y el deploy de Netlify sigue publicando `dist`.
- **AC11** — El fondo unificado tiene un test: en el proyecto `browser`, el `background-color` computado
  del `div` raíz de `App.tsx` es el mismo que el del `body`. Es lo que convierte AC6 y la mitad visual
  de AC9 en algo que `pnpm verify` puede fallar.
- **AC12** — La documentación que este spec falsifica queda al día:
  `docs/architecture/directory-structure.md:238-239` afirma **en presente** que `logo192.png` y
  `logo512.png` están «Vivos» y que `manifest.json` está «con valores por defecto de CRA». Las dos
  dejan de ser ciertas con este spec.
- **AC13** — Las tres copias que la plataforma obliga quedan **atadas por un test** del proyecto `node`:
  lee el token de `src/styles/index.css`, `theme_color` y `background_color` de `public/manifest.json` y
  el `<meta name="theme-color">` de `index.html`, y exige que los cuatro valores coincidan. Es lo que
  convierte «nada los sincroniza» —el problema con el que este spec abre— en algo que `pnpm verify`
  puede fallar, en vez de un comentario que pide buena fe.

## Fuera de alcance

- **`lang="es"`**, que es del 025 (D5).
- **Rediseñar el lenguaje visual.** `DESIGN.md` manda; el ícono lo aplica y no lo revisa.
- **Un splash screen, un service worker o hacer la app instalable de verdad.** El manifest arreglado es
  correcto; convertir esto en una PWA es una decisión propia y grande — sobre todo con un instrumento
  que depende de un gesto del usuario para arrancar el audio.
- **`robots.txt` y `_redirects`.** Los dos están bien: el primero permite todo y el segundo es el
  rewrite de SPA que Netlify necesita.
- **Los `parseInt` de `palette.test.ts`**, que pasan base 16 y son correctos.

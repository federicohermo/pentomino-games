# Tasks 028 — La app deja de llamarse React App

Formato en [`specs/README.md`](../README.md). **Sin dependencias de diseño**: nada de lo que este spec
cambia altera lo que otro spec del lote decide. Pero **comparte cuatro archivos** con 024, 025, 026 y
027 —`App.tsx`, `TransportPanel.tsx`, `index.css` e `index.html`, una a tres líneas en cada uno—, así
que es ortogonal en semántica y no en texto: ver la sección 10 del research. Ni `DESIGN.md` ni
`CLAUDE.md` se editan acá.

## Paso 1 — Los iconos

- [ ] T001 **Borrar** `public/logo192.png`, `public/logo512.png` y `public/favicon.ico`, en un commit
      que no haga nada más. Es la regla del repo: los borrados van solos para que revertirlos sea
      trivial
- [ ] T002 Anotar en el mensaje de commit que el manifest queda apuntando a archivos inexistentes hasta
      el T003. Dura un commit y es el precio de que el borrado sea reversible
- [ ] T003 Iconos propios en 192 y 512 px, más el `favicon`. Salen del lenguaje que `DESIGN.md` ya fijó:
      una pieza en uno de los doce colores medidos, baldosa `rounded-lg` con borde `slate-900`
      (`Board.tsx:293`), fondo `#f8fafc` — **AC2a**. **Ni `L` ni `Y`**: son las dos excepciones de
      `LC_EXCEPCIONES` (`palette.constants.ts:70`), no llegan al piso de contraste Lc 60 y un ícono es
      justo donde eso se ve. Elegir una de esas dos sería meter la deuda D3 en la identidad del
      proyecto
- [ ] T004 Es **aplicación** del lenguaje visual, no una revisión: si algo no cierra, se cambia el ícono
      y no `DESIGN.md`
- [ ] T005 [M] Mirar el favicon a 16 px, y los tres contra `DESIGN.md` — **AC2b**. Una pieza de cinco celdas puede volverse una mancha; si pasa,
      la salida es una silueta más simple y no otro color

## Paso 2 — El manifest y las metas

- [ ] T006 `public/manifest.json`: `name` y `short_name` de este proyecto; los tres iconos nuevos —
      **AC1**
- [ ] T007 `theme_color` y `background_color` pasan a `#f8fafc`, que es el fondo real. **Es una copia
      del token de `index.css`, no una segunda fuente**: el manifest lo parsea el navegador sin CSS a
      la vista. La ata T039, no un comentario. Hoy dicen
      `#000000` y `#ffffff`, y el negro pinta la barra de estado del navegador móvil en una app de fondo
      claro — **AC1**
- [ ] T008 `start_url` y `display` **no se tocan**: están bien
- [ ] T009 `index.html`: la `description` dice qué es —un instrumento, no un juego— en vez del nombre
      del repo. Es la distinción con la que `CLAUDE.md` abre, y el único texto que ven un buscador y el
      preview de un link — **AC3**
- [ ] T010 `index.html`: `theme-color` al fondo real, `apple-touch-icon` al ícono nuevo — **AC3**.
      **T009 y T010 NO son `[P]`**: los dos escriben `index.html` y el marcador los abanicaría en
      paralelo sobre el mismo archivo. Van seguidas, o en un solo edit
- [ ] T033 `index.html:5` — `<link rel="icon" href="/favicon.ico" />`. Es la **cuarta** referencia a un
      asset de la plantilla en ese archivo y la lista original del spec no la enumeraba: si el favicon
      cambia de nombre en T003, esta línea apunta a un 404 y ningún test del repo lo ve. O el favicon
      conserva el nombre y esta tarea es un no-op verificado, o se actualiza acá — **AC3**
- [ ] T011 **`lang` no se toca**: es del 025. Si ese spec ya está mergeado dirá `es`; si no, se queda —
      dos specs escribiendo el mismo atributo es peor que esperar — D5

## Paso 3 — El README

- [ ] T012 Reescribir `README.md` entero. Menos de 40 líneas — **AC4**
- [ ] T013 Tres secciones: qué es en un párrafo (instrumento, no juego; 10×6; arpegios; el recorrido del
      009), cómo se corre (`pnpm install`, `pnpm dev`, `pnpm verify`), y a dónde ir
- [ ] T014 **Enlaza, no repite**: `docs/README.md`, `DESIGN.md`, `CLAUDE.md`, `specs/README.md`. Es el
      criterio que el repo ya se aplicó —«son la única fuente: no se duplican acá para que no se
      desactualicen»—, y un README que explique la arquitectura sería un cuarto lugar donde puede quedar
      vieja — D3
- [ ] T015 Verificar que no queda **ni una** línea de la plantilla de Vite — **AC5**. Mecánico:
      `grep -cE "tseslint|TypeChecked|eslint-plugin-react-|plugin-react-swc|This template" README.md`
      da **0**.
      **El argumento cambió y hay que escribirlo bien en el commit**: cuando se redactó este spec, el
      bloque «Expanding the ESLint configuration» recomendaba `recommendedTypeChecked` y el repo
      extendía `recommended`, o sea recomendaba algo rechazado. **El 030 lo adoptó**
      (`eslint.config.js:255`), así que hoy el README propone como pendiente algo ya hecho, al lado de
      `strictTypeChecked`, `stylisticTypeChecked`, el `parserOptions.project` a mano —reemplazado por
      `projectService: true`— y dos plugins que no están instalados. Cinco afirmaciones sobre la config
      de este repo, las cinco mal, dos de ellas con el signo cambiado en cinco días
- [ ] T034 Consecuencia de T015 para el README nuevo: **no describe la config de ESLint**, la enlaza.
      Un README que explica el tooling se pudre por los dos lados —de eso es prueba T015— y el repo ya
      tiene el criterio escrito: «son la única fuente: no se duplican acá para que no se desactualicen»
- [ ] T016 Buscar `pentomino|instrumento|arpegio|tablero` en el README nuevo. Hoy da **cero**

## Paso 4 — Las dos duplicaciones

- [ ] T017 [P] El color de fondo se escribe **una** vez: custom property en `src/styles/index.css`, usada
      por el `body` y consumida por `App.tsx`. Los dos lugares siguen existiendo —el `body` cubre el
      overscroll, el `div` el layout— pero el valor no — **AC6**.
      Forma sugerida: `@theme { --color-fondo: #f8fafc }`, que en Tailwind 4 genera `bg-fondo` **y**
      deja `var(--color-fondo)` para el `body`. Ojo con `.claude/rules/ui.md:85-86`: una clase
      **literal** (`bg-fondo`, o `bg-[var(--color-fondo)]`) la escanea Tailwind y se genera; una
      **interpolada** no. Si el `@theme` crece, `conventions.md:119` ya dice dónde va: `styles/theme.css`
- [ ] T018 Verificación, y **no es la que decía el spec, por dos motivos distintos** — **AC6**.
      **Antes**: hoy `git grep -i f8fafc` ya devuelve una sola línea (`src/styles/index.css:10`), así
      que esa cuenta nunca discriminó nada — la duplicación es **semántica**, `bg-slate-50` **es**
      `#f8fafc`. **Después**: con T007 y T010 puestas, el mismo grep devuelve **cuatro**. Las tres
      nuevas son inevitables — el navegador parsea el manifest y el `<meta>` sin CSS a la vista.
      Lo que se corre es el grep **acotado a `src/`**: `git grep -i "f8fafc|bg-slate-50" -- src` da
      exactamente una línea, la del token, y `App.tsx:251` ya no dice `bg-slate-50`
- [ ] T039 [P] Test de sincronía en el proyecto `node` — **AC13**. Lee el token de
      `src/styles/index.css`, `theme_color` y `background_color` de `public/manifest.json` y el
      `<meta name="theme-color">` de `index.html`, y exige que los cuatro coincidan. Sin él, T007 y
      T010 reintroducen exactamente el defecto que este spec vino a cerrar — valores que tienen que
      coincidir y nada los sincroniza — sólo que cruzando el borde CSS/JSON/HTML en vez de CSS/TSX.
      Es `node` y no `browser`: son tres archivos leídos del disco, sin DOM
- [ ] T035 [P] Test del fondo unificado en `src/__tests__/App.browser.test.tsx`: el `background-color`
      computado del `div` raíz es el mismo que el del `body` — **AC11**. Es lo que le pone red a T017:
      medido, **ningún** test mira hoy ese fondo (un grep de `bg-slate-50` y `min-h-screen` en `src/`
      pega sólo en `App.tsx:251`), así que sin este test AC6 y AC9 se firman a ojo. El
      `browser-setup.ts` del 029 ya importa `styles/index.css`, así que el token está disponible en el
      proyecto `browser`
- [ ] T019 Comentario con por qué importa: es la misma clase de duplicación que la regla «los módulos no
      declaran constantes» persigue en `src/` («antes había cuatro pares de números que tenían que
      coincidir y nada sincronizaba»), cruzando el borde CSS/TSX, que es donde ningún linter del repo
      mira
- [ ] T020 [P] `TransportPanel.tsx:22`: `parseInt(e.target.value)` → `Number(e.target.value)` — **AC7**.
      **El 025 reescribe esta misma línea** — le agrega `aria-labelledby` y `aria-valuetext` al
      `<input type="range">`, y es el **único** `<input>` del archivo, así que los dos specs escriben la
      línea 22 y nada más. No hay contradicción: los dos cambios conviven en el mismo `<input>`. Es un
      conflicto de merge de una línea entre dos carriles que `log.md` declara independientes, y por eso
      va escrito acá y no se descubre resolviendo un rebase. **El orden no importa**: si el 028 llega
      segundo, este cambio se reduce a una palabra sobre el `onChange` ya reformateado por el 025
- [ ] T036 En el **mismo** commit que T020: `TransportPanel.browser.test.tsx:73` tiene un comentario que
      empieza «Lo que importa del `parseInt`». El test —«el tempo viaja como numero, no como el string
      del input»— sigue valiendo y **ya cubre AC7**; lo que se pudre es el nombre. Que diga `Number`
- [ ] T021 Los dos `parseInt` de `palette.test.ts` **no se tocan**: pasan base 16 y son correctos. Vale
      escribirlo en el commit para que no parezca un cambio a medias
- [ ] T022 [M] Overscroll en móvil, para confirmar que el color unificado no dejó una franja distinta

## Cierre

- [ ] T023 `specs/deuda.md`: se borra el ítem del `manifest.json` — **AC8**. Anotar que era **uno** y
      resultaron **ocho**, con el `README.md` como el que no estaba registrado y el más visible de todos
- [ ] T024 Confirmar **AC9**: la parte mecánica es T025 (`pnpm verify` verde, el umbral 100 intacto)
      más T035, que es el único que mira el fondo. **El `562` del 029 es un piso y no una igualdad**:
      los otros cuatro specs del lote 023–028 agregan tests, así que si alguno mergea antes el conteo
      sube. Y este spec suma dos propios (T035 y T039), con lo cual su propio verde ya no da 562
- [ ] T037 [M] La parte de AC9 que ningún test cubre: abrir la app y confirmar que el layout y los doce
      colores son los de antes. Va marcado porque sin `[M]` `spec_status` lo reporta como trabajo
      pendiente para siempre
- [ ] T025 `pnpm verify` verde — **AC10**
- [ ] T026 [M] Confirmar que Netlify sigue publicando `dist` y que el favicon nuevo llega al sitio
- [ ] T032 `docs/architecture/directory-structure.md:238-239` — **AC12**. La tabla de `public/` afirma
      **en presente** que `favicon.ico`, `logo192.png` y `logo512.png` están «Vivos, referenciados desde
      `index.html` y `manifest.json`», y que `manifest.json` está «Vivo pero **con valores por defecto
      de CRA**». Este spec falsifica las dos. Es doc en presente y el repo la mantiene al día: mismo
      caso que `fb910df`, donde el 029 dejó cuatro archivos diciendo un solo proyecto de Vitest
- [ ] T038 `specs/revisiones.md` — entrada del 028 con la lección, que no es sobre íconos: **el
      argumento central de la sección 4 del research se falsificó solo en cinco días**. El README
      recomendaba una config que el repo rechazaba; el 030 la adoptó y ahora el README propone algo ya
      hecho. Es la prueba empírica de por qué el README nuevo enlaza y no describe. La segunda mitad: la
      fila del 028 en `log.md:43` arrastra la frase vieja («recomiendan una config de ESLint que este
      repo deliberadamente no usa») y hay que corregirla al mover el estado en T027
- [ ] T027 Actualizar la fila del 028 en `specs/log.md` a `Implementado` — **queda abierta a propósito**:
      el estado lo mueve el merge
- [ ] T028 PR contra `main`

## Seguimiento (no bloquea)

- [ ] T029 **PWA de verdad** — service worker, splash, instalable. El manifest arreglado es correcto,
      pero esto es otra decisión y grande, sobre todo con un instrumento que necesita un gesto del
      usuario para que suene: una app instalada que abre muda es peor que una pestaña
- [ ] T030 **Open Graph.** Con la `description` arreglada, un `og:image` con el tablero haría que
      compartir el link muestre el instrumento. Es identidad y no arrastre, así que no entra acá
- [ ] T031 **El `title` del `index.html`** dice «Pentomino Games» y arrastra la misma ambigüedad que la
      `description` tenía. No se toca acá porque es el nombre del proyecto y cambiarlo es una decisión de
      nombre, no de higiene

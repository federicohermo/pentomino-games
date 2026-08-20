# Tasks 028 — La app deja de llamarse React App

Formato en [`specs/README.md`](../README.md). **Sin dependencias**: ni con los otros cinco specs de este
lote ni con 018–021.

## Paso 1 — Los iconos

- [ ] T001 **Borrar** `public/logo192.png`, `public/logo512.png` y `public/favicon.ico`, en un commit
      que no haga nada más. Es la regla del repo: los borrados van solos para que revertirlos sea
      trivial
- [ ] T002 Anotar en el mensaje de commit que el manifest queda apuntando a archivos inexistentes hasta
      el T003. Dura un commit y es el precio de que el borrado sea reversible
- [ ] T003 Iconos propios en 192 y 512 px, más el `favicon`. Salen del lenguaje que `DESIGN.md` ya fijó:
      una pieza en uno de los doce colores medidos, baldosa redondeada con borde `slate-900`, fondo
      `#f8fafc` — **AC2**
- [ ] T004 Es **aplicación** del lenguaje visual, no una revisión: si algo no cierra, se cambia el ícono
      y no `DESIGN.md`
- [ ] T005 [M] Mirar el favicon a 16 px. Una pieza de cinco celdas puede volverse una mancha; si pasa,
      la salida es una silueta más simple y no otro color

## Paso 2 — El manifest y las metas

- [ ] T006 `public/manifest.json`: `name` y `short_name` de este proyecto; los tres iconos nuevos —
      **AC1**
- [ ] T007 `theme_color` y `background_color` pasan a `#f8fafc`, que es el fondo real. Hoy dicen
      `#000000` y `#ffffff`, y el negro pinta la barra de estado del navegador móvil en una app de fondo
      claro — **AC1**
- [ ] T008 `start_url` y `display` **no se tocan**: están bien
- [ ] T009 [P] `index.html`: la `description` dice qué es —un instrumento, no un juego— en vez del nombre
      del repo. Es la distinción con la que `CLAUDE.md` abre, y el único texto que ven un buscador y el
      preview de un link — **AC3**
- [ ] T010 [P] `index.html`: `theme-color` al fondo real, `apple-touch-icon` al ícono nuevo — **AC3**
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
- [ ] T015 Verificar que no queda **ni una** línea de la plantilla de Vite — **AC5**. En particular el
      bloque «Expanding the ESLint configuration», que recomienda `recommendedTypeChecked` /
      `strictTypeChecked`: este repo deliberadamente no las usa, así que alguien que siga ese README
      estaría deshaciendo decisiones tomadas
- [ ] T016 Buscar `pentomino|instrumento|arpegio|tablero` en el README nuevo. Hoy da **cero**

## Paso 4 — Las dos duplicaciones

- [ ] T017 [P] El color de fondo se escribe **una** vez: custom property en `src/styles/index.css`, usada
      por el `body` y consumida por `App.tsx`. Los dos lugares siguen existiendo —el `body` cubre el
      overscroll, el `div` el layout— pero el valor no — **AC6**
- [ ] T018 Verificación literal: `git grep` del color devuelve **una** línea
- [ ] T019 Comentario con por qué importa: es la misma clase de duplicación que la regla «los módulos no
      declaran constantes» persigue en `src/` («antes había cuatro pares de números que tenían que
      coincidir y nada sincronizaba»), cruzando el borde CSS/TSX, que es donde ningún linter del repo
      mira
- [ ] T020 [P] `TransportPanel.tsx`: `parseInt(e.target.value)` → `Number(e.target.value)` — **AC7**
- [ ] T021 Los dos `parseInt` de `palette.test.ts` **no se tocan**: pasan base 16 y son correctos. Vale
      escribirlo en el commit para que no parezca un cambio a medias
- [ ] T022 [M] Overscroll en móvil, para confirmar que el color unificado no dejó una franja distinta

## Cierre

- [ ] T023 `specs/deuda.md`: se borra el ítem del `manifest.json` — **AC8**. Anotar que era **uno** y
      resultaron **ocho**, con el `README.md` como el que no estaba registrado y el más visible de todos
- [ ] T024 Confirmar **AC9**: cero cambio de comportamiento. Mismo audio, mismo layout, mismos doce
      colores
- [ ] T025 `pnpm verify` verde — **AC10**
- [ ] T026 [M] Confirmar que Netlify sigue publicando `dist` y que el favicon nuevo llega al sitio
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

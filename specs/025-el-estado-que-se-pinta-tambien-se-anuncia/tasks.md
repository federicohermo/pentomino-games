# Tasks 025 — El estado que se pinta también se anuncia

Formato en [`specs/README.md`](../README.md).

**No espera al 024.** El proyecto de navegador ya está en `main` desde el **029**, y los tres
componentes que este spec toca ya tienen su `*.browser.test.tsx`: T016–T019 y T029–T031 se **agregan a
archivos que existen** y ninguno queda `[M]`.

## Paso 1 — El documento

- [x] T001 [P] `index.html`: `lang="en"` → `lang="es"` — **AC1**. Sólo eso de ese archivo: las otras
      cuatro herencias de CRA que están a la vista son del 028

## Paso 2 — El slider

- [x] T002 [P] `TransportPanel.tsx`: `id` en el `<span>Tempo</span>`
- [x] T003 `input[type=range]`: `aria-labelledby` apuntando a ese `id`. **No** un `aria-label` con el
      mismo texto — sería la misma cadena escrita dos veces, cruzando el borde entre lo que se ve y lo
      que se anuncia — **AC2**
- [x] T004 `aria-valuetext={`${tempo} bpm`}`, con el comentario que cite el argumento que este mismo
      archivo ya tiene para el ojo: «"110" a secas no dice si son bpm o intervalos, y desde el spec 008
      el instrumento maneja las dos unidades» — **AC3**

## Paso 3 — Los cinco controles con estado

- [x] T005 [P] `PiecePalette.tsx`: Reflexión pasa a llamarse por lo que hace y gana `aria-pressed`. El
      nombre sale por `aria-labelledby` sobre el `<span>Reflexión</span>` que ya está en la fila
      (`:91`, que gana un `id`) y **no** por un `aria-label` con la misma cadena: es la tercera cláusula
      de la regla del AC7, y escribirla en `ui.md` violándola en el mismo commit no se hace. El texto
      visible `ON`/`OFF` **no se toca** — **AC4**
- [x] T006 Ídem «Recorrido en el vacío», etiquetado por el `<span>` de `:116` — **AC4**
- [x] T007 Los cuatro botones de rotación: `id` en el `<span>Rotación</span>` (`PiecePalette.tsx:73`),
      `role="group"` **sobre el `div.flex.gap-1` que ya existe** (`:74`) con `aria-labelledby` a ese
      `id`, y `aria-pressed` en cada uno. Cero nodos nuevos: agregar un envoltorio se comería un margen
      del `space-y-2` con las clases intactas (`PiecePalette.tsx:26-30`) — **AC5**, **AC9**
- [x] T008 Ídem los dos de régimen: `id` en el `<span>cambia</span>` (`:81`) y `role="group"` en el
      `div.flex.gap-1` de `:82`. El nombre del grupo queda siendo «cambia», un verbo suelto: se acepta
      porque el texto visible es la segunda línea de una oración que empieza en «Rotación» — **AC5**
- [x] T009 Comentario sobre los dos grupos explicando por qué **no** son `radiogroup`: obliga a un
      modelo de foco (una parada y flechas) y ese modelo lo fija el **026**, que es el spec que contesta
      la pregunta que `deuda.md` tiene abierta para el tablero. Decidirlo acá de refilón sería
      decidirlo dos veces y probablemente distinto — D4

## Paso 4 — La regla, el `type` y los tests

- [x] T010 `type="button"` en los 22 `<button>`, que salen de **siete** sitios de JSX y no de
      veintidós: `OrientationPanel.tsx:80` (×12 por el `map`), `PiecePalette.tsx:76` (×4), `:84` (×2),
      `:92`, `:117`, y `TransportPanel.tsx:51` y `:57` — **AC6**
- [x] T011 En su **propio commit**, para que el diff de los pasos 2 y 3 se pueda leer
- [x] T012 Comentario en uno de los tres archivos con el motivo: hoy no hay `<form>` y por lo tanto no
      hay bug, pero el default de un `<button>` en un formulario es `submit`, y acá eso es recargar la
      página perdiendo el tablero entero **sin deshacer** (`deuda.md`)
- [x] T013 `.claude/rules/ui.md`: la regla, con sus tres cláusulas — nombre accesible en todo control
      solo-icono, `aria-pressed` en todo lo que alterna y el nombre siendo lo que alterna, y etiqueta
      tomada del texto visible con `aria-labelledby` en vez de duplicada — **AC7**
- [x] T014 La regla nombra sus dos precedentes, que ya están en el repo como comentarios sueltos: el
      `aria-label` del `▶`/`⏸` («el glifo no lo es») y el de las miniaturas del 016
- [x] T015 `DESIGN.md:120`, «El color comunica identidad, nunca estado», gana su mitad no visual: si el
      color es el único canal que dice el estado, el árbol de accesibilidad no lo dice. (La frase que la
      versión anterior de esta tarea citaba —«el estado nunca se comunica con hue»— **no existe textual**
      en el archivo; lo más cerca está en `DESIGN.md:233`)
- [x] T016 [P] `TransportPanel.browser.test.tsx` (ya existe): `page.getByRole('slider', { name: 'Tempo' })`
      existe y su `aria-valuetext` es `110 bpm` — **AC8**
- [x] T017 [P] `PiecePalette.browser.test.tsx` (ya existe): `page.getByRole('button', { name: /^Reflexión$/, pressed: false })`,
      y después de un click, `pressed: true`. El nombre va **anclado**: `getByRole` empareja por
      subcadena, como `PiecePalette.browser.test.tsx:93-94` ya dejó anotado — **AC8**
- [x] T018 Test: los seis botones de los dos grupos exponen `aria-pressed`, y exactamente **uno** de
      los cuatro de rotación está en `true`. **Sin `[P]`: mismo archivo que T017** — **AC8**
- [x] T019 Los tests consultan por **rol y nombre**, nunca por `className`, y con `page` de
      `vitest/browser` + `render` de `vitest-browser-react`, que es el idioma que dejó el 029 — **no**
      `screen` de testing-library, que este repo evaluó y descartó con jsdom
- [x] T028 [P] `OrientationPanel.tsx:80-84`: `aria-pressed={activo}` en las doce miniaturas. Es el
      mismo defecto que los otros cuatro controles —el fondo del botón es, textual en `:55-57`, «el canal
      de "seleccionada"»— y sin esto la regla del AC7 nace con una excepción no argumentada en el mismo
      commit. **No** llevan `role="group"`: la etiqueta que lo nombraría (`<h2>Piezas</h2>`) vive en
      `PiecePalette.tsx` — **AC11**
- [x] T029 `OrientationPanel.browser.test.tsx` (ya existe): las doce exponen `aria-pressed` y
      exactamente una está en `true` — **AC8**, **AC11**
- [x] T030 Test: los 22 botones renderizados declaran `type="button"`. Sin esto AC6 es el único cambio
      de código del spec que nada falsea, y es justo el que existe para una regresión futura — **AC6**
- [x] T031 Test de `environment: 'node'` que lee `index.html` y afirma `lang="es"`. Va ahí y no en el
      proyecto de navegador porque el browser mode **sirve su propio documento** y nunca carga ese
      archivo — **AC12**. **Va en `src/__tests__/documento.test.ts`**, y el nombre no es libre: el
      `T039` del **028** crea el otro test del lote que lee `index.html` del disco —la sincronía del
      color de fondo entre CSS, manifest y `<meta>`— y si los dos eligen el nombre obvio
      (`index-html.test.ts`) el segundo carril que mergee pisa al primero sin que el merge lo vea, que
      es un archivo entero perdido en verde. El del 028 va en `src/__tests__/fondo-sincronizado.test.ts`
- [ ] T020 [M] Recorrer la tarjeta entera con `Tab` y un lector de pantalla, y confirmar que ningún
      control se anuncia con su valor en lugar de su identidad — que es el defecto exacto que este spec
      arregla (`research.md` §3)

## Cierre

- [x] T021 Confirmar **AC9**: mismo DOM salvo atributos, mismas clases, mismo orden. `git diff` no puede
      mostrar un solo cambio de `className`
- [x] T022 `pnpm verify` verde — **AC10**. **Sin conteo absoluto de tests**: los cinco specs del lote
      023–028 agregan tests, así que el `457 + 105` de `main` sólo vale para el primero que mergee. Lo
      que se afirma es que **no baja** y que el coverage sigue en 100 en las cuatro métricas — el
      número exacto lo fija el merge, no la rama
- [x] T023 [M] Actualizar la fila del 025 en `specs/log.md` a `Implementado` — el estado lo mueve el
      merge. Va `[M]` para que `spec_status` no la cuente como trabajo pendiente para siempre
- [x] T024 PR contra `main`

## Seguimiento (no bloquea)

- [ ] T025 **La versión `radiogroup` de rotación y régimen**, con roving tabindex. Su condición está
      escrita: después del **026**, cuando el repo tenga un modelo de foco con el que ser consistente
- [ ] T026 **El 019 se lleva dos de los seis frentes** —Reflexión y los cuatro de rotación— y **crea uno
      nuevo que nace con el mismo problema**: el botón SVG solo-icono del metrónomo. El AC7 es lo que lo
      cubre por adelantado; verificar al implementar el 019 que la regla se aplicó
- [ ] T027 **Si la cabeza lectora, el espectro y la orientación se suman a la región `aria-live`.** La
      región `polite` **no** está pendiente: la crea el **026** para las tres ediciones del tablero
      —colocar, quitar, mutear—, y su propio spec declara que no anuncia nada más. Lo que queda para
      después, y es una decisión bastante más chica que «¿hay región?», es si esas tres fuentes entran a
      **esa** región. Anunciar a 10 Hz es hostil, así que ninguna entra sin una regla de coalescencia; y
      el lector textual de orientación que trae el 019 puede ser el lugar correcto para la tercera
- [ ] T032 **`role="group"` para las doce miniaturas**, si alguna vez el `<h2>Piezas</h2>` y la grilla
      quedan en el mismo componente. Hoy cruzar ese borde no compra nada: cada botón ya tiene su nombre

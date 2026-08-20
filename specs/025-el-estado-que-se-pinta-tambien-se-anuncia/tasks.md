# Tasks 025 — El estado que se pinta también se anuncia

Formato en [`specs/README.md`](../README.md). **Conviene con el 024 mergeado**: sin él, T016–T019 se
verifican a mano y quedan `[M]`.

## Paso 1 — El documento

- [ ] T001 [P] `index.html`: `lang="en"` → `lang="es"` — **AC1**. Sólo eso de ese archivo: las otras
      cuatro herencias de CRA que están a la vista son del 028

## Paso 2 — El slider

- [ ] T002 [P] `TransportPanel.tsx`: `id` en el `<span>Tempo</span>`
- [ ] T003 `input[type=range]`: `aria-labelledby` apuntando a ese `id`. **No** un `aria-label` con el
      mismo texto — sería la misma cadena escrita dos veces, cruzando el borde entre lo que se ve y lo
      que se anuncia — **AC2**
- [ ] T004 `aria-valuetext={`${tempo} bpm`}`, con el comentario que cite el argumento que este mismo
      archivo ya tiene para el ojo: «"110" a secas no dice si son bpm o intervalos, y desde el spec 008
      el instrumento maneja las dos unidades» — **AC3**

## Paso 3 — Los cuatro controles con estado

- [ ] T005 [P] `PiecePalette.tsx`: Reflexión pasa a llamarse por lo que hace y gana `aria-pressed`. El
      texto visible `ON`/`OFF` **no se toca** — **AC4**
- [ ] T006 Ídem «Recorrido en el vacío» — **AC4**
- [ ] T007 Los cuatro botones de rotación: `role="group"` con `aria-labelledby` sobre el
      `<span>Rotación</span>`, y `aria-pressed` en cada uno — **AC5**
- [ ] T008 Ídem los dos de régimen, etiquetados por el `<span>cambia</span>` — **AC5**
- [ ] T009 Comentario sobre los dos grupos explicando por qué **no** son `radiogroup`: obliga a un
      modelo de foco (una parada y flechas) y ese modelo lo fija el **026**, que es el spec que contesta
      la pregunta que `deuda.md` tiene abierta para el tablero. Decidirlo acá de refilón sería
      decidirlo dos veces y probablemente distinto — D4

## Paso 4 — La regla, el `type` y los tests

- [ ] T010 `type="button"` en los 22 `<button>` de `PiecePalette.tsx`, `OrientationPanel.tsx` y
      `TransportPanel.tsx` — **AC6**
- [ ] T011 En su **propio commit**, para que el diff de los pasos 2 y 3 se pueda leer
- [ ] T012 Comentario en uno de los tres archivos con el motivo: hoy no hay `<form>` y por lo tanto no
      hay bug, pero el default de un `<button>` en un formulario es `submit`, y acá eso es recargar la
      página perdiendo el tablero entero **sin deshacer** (`deuda.md`)
- [ ] T013 `.claude/rules/ui.md`: la regla, con sus tres cláusulas — nombre accesible en todo control
      solo-icono, `aria-pressed` en todo lo que alterna y el nombre siendo lo que alterna, y etiqueta
      tomada del texto visible con `aria-labelledby` en vez de duplicada — **AC7**
- [ ] T014 La regla nombra sus dos precedentes, que ya están en el repo como comentarios sueltos: el
      `aria-label` del `▶`/`⏸` («el glifo no lo es») y el de las miniaturas del 016
- [ ] T015 `DESIGN.md`: la frase «el estado nunca se comunica con hue» gana su mitad no visual — el
      estado tampoco se comunica **sólo** con hue
- [ ] T016 [P] Test de navegador: `getByRole('slider', { name: 'Tempo' })` existe y su `aria-valuetext`
      es `110 bpm` — **AC8**
- [ ] T017 [P] Test: `getByRole('button', { name: 'Reflexión', pressed: false })`, y después de un click,
      `pressed: true` — **AC8**
- [ ] T018 [P] Test: los seis botones de los dos grupos exponen `aria-pressed`, y exactamente **uno** de
      los cuatro de rotación está en `true` — **AC8**
- [ ] T019 Los tests consultan por **rol y nombre**, nunca por `className`. Es la diferencia entre
      verificar accesibilidad y verificar que se escribió un atributo
- [ ] T020 [M] Recorrer la tarjeta entera con `Tab` y un lector de pantalla, y confirmar que ningún
      control se anuncia con su valor en lugar de su identidad — que es el defecto exacto que este spec
      arregla (`research.md` §3)

## Cierre

- [ ] T021 Confirmar **AC9**: mismo DOM salvo atributos, mismas clases, mismo orden. `git diff` no puede
      mostrar un solo cambio de `className`
- [ ] T022 `pnpm verify` verde — **AC10**
- [ ] T023 Actualizar la fila del 025 en `specs/log.md` a `Implementado` — **queda abierta a propósito**:
      el estado lo mueve el merge
- [ ] T024 PR contra `main`

## Seguimiento (no bloquea)

- [ ] T025 **La versión `radiogroup` de rotación y régimen**, con roving tabindex. Su condición está
      escrita: después del **026**, cuando el repo tenga un modelo de foco con el que ser consistente
- [ ] T026 **El 019 se lleva dos de los seis frentes** —Reflexión y los cuatro de rotación— y **crea uno
      nuevo que nace con el mismo problema**: el botón SVG solo-icono del metrónomo. El AC7 es lo que lo
      cubre por adelantado; verificar al implementar el 019 que la regla se aplicó
- [ ] T027 **`aria-live` para lo que cambia solo** (cabeza lectora, espectro, orientación). Es otra
      decisión —anunciar a 10 Hz es hostil— y el lector textual de orientación que trae el 019 puede ser
      el lugar correcto

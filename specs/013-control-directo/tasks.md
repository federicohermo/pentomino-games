# Tasks — Spec 013

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — Las puras de cada gesto

- [ ] T001 `src/components/types/input.types.ts`: `Accion` como const-object + union type derivado
      (`rotar` · `reflejar` · `transporte`). **Sin `enum`** — lo rechaza el `erasableSyntaxOnly`
- [ ] T002 `src/components/input.ts`: `rotacionPorRueda(rotation, deltaY)`, con el módulo positivo
      `(r + 4 + d) % 4` — en JS `-1 % 4` es `-1`, y sin esto la rueda hacia arriba desde `0` da `-1`
- [ ] T003 `src/components/input.ts`: `accionDeTecla({ key, repeat, targetEsControl })`, con las dos
      guardas (`repeat` → D3, `targetEsControl` → D4)
- [ ] T004 `src/components/input.ts`: `reflejaElContextMenu({ ctrlKey })` — la guarda de D2
- [ ] T005 Docblock de `input.ts`: por qué las puras reciben **campos** y no el evento (no hay jsdom en
      el repo), y por qué viven acá y no en `App.tsx` (`react-refresh/only-export-components`)
- [ ] T006 [P] `input.test.ts` — **AC1**: los dos sentidos de la rueda y las dos vueltas cíclicas
      (`3 → 0` con `deltaY > 0`, `0 → 3` con `deltaY < 0`)
- [ ] T007 [P] `input.test.ts` — **AC3 y AC5**: `repeat: true` no produce acción, para `Shift` y `Ctrl`
- [ ] T008 [P] `input.test.ts` — **AC6**: `contextmenu` con `ctrlKey: true` **no** refleja, y con
      `ctrlKey: false` sí. Es el único AC que no se puede ver desde Windows (`research.md` §5), así que
      el test lleva comentario diciendo eso — si alguien lo borra por "redundante", el bug vuelve mudo
- [ ] T009 [P] `input.test.ts` — **AC7 y AC8**: con `targetEsControl: true` la barra no produce acción

## Paso 2 — Los listeners de ventana

- [ ] T010 `App.tsx`: `useEffect` con `keydown` sobre `window`, dependencias `[rotation, mirror, playing]`
- [ ] T011 El handler mira si `e.target` es `HTMLButtonElement` o `HTMLInputElement` y se lo pasa a
      `accionDeTecla` como `targetEsControl`
- [ ] T012 `preventDefault` **solo** cuando la acción no es `null`: si el handler se saltea el evento,
      el navegador tiene que quedárselo entero (D4)
- [ ] T013 El transporte pasa por `togglePlay` y no por `startClock`/`stopClock` sueltos — **AC9**, es
      lo que mantiene la consulta a `clockRunning()` que exige `.claude/rules/audio.md`
- [ ] T014 Limpieza sincrónica en el retorno del efecto — **AC10**
- [ ] T015 Comentario en el efecto: por qué las dependencias son las reales y no `[]` con un ref (D7)

## Paso 3 — Los dos gestos del tablero

- [ ] T016 [P] `Board.tsx`: props `onWheel` y `onContextMenu` sobre el `div.relative.overflow-x-auto`,
      que es el que ya contiene a `Playhead` y scrollea con la grilla (`research.md` §3)
- [ ] T017 [P] `Board.tsx`: comentario de por qué enganchan ahí y no en el `.grid` de adentro ni en la
      tarjeta
- [ ] T018 `App.tsx`: handler de la rueda — `preventDefault` + `rotacionPorRueda`
- [ ] T019 `App.tsx`: handler del menú contextual — `preventDefault` **siempre** (el menú no se abre
      nunca sobre el tablero) y alterna solo si `reflejaElContextMenu(e)`
- [ ] T020 **Verificar que el `onWheel` de React no sea pasivo** y que el `preventDefault` frene el
      scroll de verdad. Si resultara pasivo, sale por `addEventListener(..., { passive: false })` desde
      un efecto con ref, y queda anotado por qué

## Paso 4 — Verificación y documentación

- [ ] T021 `pnpm verify` en verde — **AC12**
- [ ] T022 `check_invariants` en proceso fresco antes y después: este spec **no puede cambiar una nota**,
      y el diff no toca `domain/` ni `audio/`
- [ ] T023 [P] `docs/guides/quickstart.md`: la tabla de los cinco gestos
- [ ] T024 [P] `<footer>` de `App.tsx`: hoy explica el modelo musical y no menciona ni un gesto
- [ ] T025 [P] `.claude/rules/ui.md`: dónde vive un listener global y por qué. Es el **primero** del
      repo (`research.md` §1), así que la regla la escribe este spec y el próximo la copia
- [ ] T026 [M] **AC2** — la página no scrollea con el cursor sobre el tablero, y sí scrollea afuera.
      Probar en una ventana baja (~600 px de viewport), que es donde el costo existe
- [ ] T027 [M] **AC4** — el botón derecho sobre el tablero no abre el menú contextual, y sobre el resto
      de la página sí
- [ ] T028 [M] **AC13** — rotar con la rueda con el transporte corriendo: no corta el sonido, no
      reordena el circuito, y las piezas ya colocadas no se mueven
- [ ] T029 [M] Los cinco gestos seguidos, sin tocar el panel: elegir pieza, rotar con la rueda, reflejar
      con el botón derecho, colocar, y arrancar con la barra

## PR

- [ ] T030 Rama `feature/013-control-directo` desde `main`, con el spec ya mergeado
- [ ] T031 [M] `/pr-review` antes de pedir revisión
- [ ] T032 `specs/log.md`: estado del 013

## Seguimiento (no bloquea)

- [ ] T033 **El tipo de `rotation`** (D8). Este spec agrega el quinto lugar que compara contra `0|1|2|3`
      y no lo arregla; sigue en `specs/deuda.md`, ahora un poco más caro
- [ ] T034 **El tablero sigue sin teclado.** Los atajos son globales y funcionan sin foco, así que el
      hueco de `specs/deuda.md` no se cierra ni se agranda. Vale la pena mirarlo de nuevo cuando el 014
      haga que el click sobre una celda **borre** algo: ahí una grilla que no se puede alcanzar con el
      teclado deja de ser solo un problema de lectura
- [ ] T035 En Safari los botones no reciben foco al clickearlos (`research.md` §6), así que el doble
      disparo del espacio no existe ahí. La guarda de D4 es inofensiva, pero si algún día se prueba en
      Safari conviene confirmar que la barra sigue alternando el transporte

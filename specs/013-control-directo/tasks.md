# Tasks — Spec 013

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

Los IDs de T036 en adelante son los que agregó el review y por eso no están en orden de lectura:
**renumerar rompe toda referencia** que otra tarea o el `log.md` le hiciera a un ID. El orden que vale es
el del archivo, no el del número.

## Paso 1 — Las puras de cada gesto

- [x] T036 `src/components/constants/input.constants.ts`: el const-object `ACCION`
      (`rotar` · `reflejar` · `transporte`). Va en `constants/` y no en `types/`: **los módulos de este
      repo no declaran constantes**, y el precedente exacto es `MARCA` en `route.constants.ts`
- [x] T001 `src/components/types/input.types.ts`: `Accion` como union derivada de `ACCION`
      (`(typeof ACCION)[keyof typeof ACCION]`, igual que `MarcaKind`). **Sin `enum`** — lo rechaza el
      `erasableSyntaxOnly`
- [x] T002 `src/components/input.ts`: `rotacionPorRueda(rotation, deltaY)`, con el módulo positivo
      `(r + 4 + d) % 4` — en JS `-1 % 4` es `-1`, y sin esto la rueda hacia arriba desde `0` da `-1`
- [x] T003 `src/components/input.ts`: `accionDeTecla({ key, tipo, repeat, targetEsControl, tapLimpio })`,
      con las cuatro guardas: `repeat` (D3), `targetEsControl` (D4), y los modificadores solo con
      `tipo === 'keyup'` y `tapLimpio` (D10) — el espacio, solo con `tipo === 'keydown'`
- [x] T004 `src/components/input.ts`: `reflejaElContextMenu({ ctrlKey })` — la guarda de D2
- [x] T005 Docblock de `input.ts`: por qué las puras reciben **campos** y no el evento (no hay jsdom en
      el repo), y por qué viven acá y no en `App.tsx` (`react-refresh/only-export-components`)
> Los cuatro tests escriben **el mismo archivo**, así que ninguno lleva `[P]`: dos tareas `[P]` del
> mismo bloque no pueden tocar el mismo archivo, y `spec-implement` las abanicaría a la vez.

- [x] T006 `input.test.ts` — **AC1**: los dos sentidos de la rueda y las dos vueltas cíclicas
      (`3 → 0` con `deltaY > 0`, `0 → 3` con `deltaY < 0`)
- [x] T007 `input.test.ts` — **AC3 y AC5**: `repeat: true` no produce acción, para `Shift` y `Ctrl`
- [x] T008 `input.test.ts` — **AC6**: `contextmenu` con `ctrlKey: true` **no** refleja, y con
      `ctrlKey: false` sí. Es el único AC que no se puede ver desde Windows (`research.md` §5), así que
      el test lleva comentario diciendo eso — si alguien lo borra por "redundante", el bug vuelve mudo
- [x] T009 `input.test.ts` — **AC7 y AC8**: con `targetEsControl: true` la barra no produce acción
- [x] T037 `input.test.ts` — **AC3 y AC5, la parte del tap** (D10): el `keydown` de `Shift`/`Control` no
      produce acción, el `keyup` con `tapLimpio: true` sí, y con `tapLimpio: false` no. Es la guarda que
      evita que `Ctrl`+C dé vuelta la reflexión, y como la sucia la ensucia el cableado, el test es lo
      único que fija la regla

## Paso 2 — Los listeners de ventana

- [x] T010 `App.tsx`: `useEffect` con **`keydown` y `keyup`** sobre `window`, dependencias
      `[rotation, mirror, playing]`
- [x] T038 `App.tsx`: el `useRef<boolean>` del `tapLimpio` (D10) — arranca en `true` con el `keydown` del
      modificador, lo ensucian el `keydown` de otra tecla y el handler de la rueda, y **no** el mouse:
      si el mouse lo ensuciara, el `Ctrl`+click de Mac volvería al neto cero que D2 evita
- [x] T011 El handler mira si `e.target` es `HTMLButtonElement` o `HTMLInputElement` y se lo pasa a
      `accionDeTecla` como `targetEsControl`
- [x] T012 `preventDefault` **solo** cuando la acción no es `null`: si el handler se saltea el evento,
      el navegador tiene que quedárselo entero (D4)
- [x] T013 El transporte pasa por `togglePlay` y no por `startClock`/`stopClock` sueltos — **AC9**, es
      lo que mantiene la consulta a `clockRunning()` que exige `.claude/rules/audio.md`
- [x] T014 Limpieza sincrónica en el retorno del efecto, **para los dos listeners** — **AC10**
- [x] T015 Comentario en el efecto: por qué las dependencias son las reales y no `[]` con un ref (D7)

## Paso 3 — Los dos gestos del tablero

> El `[P]` de este bloque separa **archivos**, no tareas: `Board.tsx` (T016, y T017 detrás) por un lado
> y `App.tsx` (T018 y las que siguen) por el otro. Dos tareas del mismo archivo nunca van las dos con `[P]`.

- [x] T016 [P] `Board.tsx`: props `onContextMenu` y **`boardRef`** sobre el `div.relative.overflow-x-auto`,
      que es el que ya contiene a `Playhead` y scrollea con la grilla (`research.md` §3). El `ref` se crea
      en `App.tsx` y acá solo se cuelga: el componente no lo lee y sigue sin estado ni efectos (AC11)
- [x] T017 `Board.tsx`: comentario de por qué enganchan ahí y no en el `.grid` de adentro ni en la
      tarjeta, y por qué la rueda entra por `ref` y el menú por handler (`research.md` §10)
- [x] T018 [P] `App.tsx`: el `useRef` del nodo del tablero y el `useEffect` de la rueda —
      `addEventListener('wheel', h, { passive: false })` con su `removeEventListener` en el retorno.
      **No es una prop `onWheel`**: React monta `wheel` pasivo en el contenedor raíz y ahí
      `preventDefault` es un no-op (`research.md` §10, `react-dom` 19.1.1)
- [x] T039 `App.tsx`: el handler de la rueda se **saltea el evento entero cuando `e.ctrlKey`** —
      `Ctrl`+rueda es el zoom del navegador, que es accesibilidad y no un atajo nuestro — **AC15**.
      Cuando no, hace `preventDefault`, ensucia el `tapLimpio` y
      `setRotation(r => rotacionPorRueda(r, e.deltaY))` con el setter funcional, que es lo que deja al
      efecto sin depender de `rotation`
- [x] T019 `App.tsx`: handler del menú contextual — `preventDefault` **siempre** (el menú no se abre
      nunca sobre el tablero) y alterna solo si `reflejaElContextMenu(e)`. Este sí va por prop de JSX:
      `contextmenu` no está entre los tres nombres que React monta pasivos
- [ ] T020 [M] **En el navegador, con la consola abierta**: el `preventDefault` de la rueda frena el scroll
      de verdad y **no aparece** el aviso `Unable to preventDefault inside passive event listener`. Es la
      señal de que el listener quedó donde tiene que estar, y es lo que separa a AC1 en verde con AC2 en
      rojo de las dos en verde

## Paso 4 — Verificación y documentación

- [x] T021 `pnpm verify` en verde — **AC12**
- [x] T022 `check_invariants` en proceso fresco antes y después: este spec **no puede cambiar una nota**,
      y el diff no toca `domain/` ni `audio/`
- [x] T023 [P] `docs/guides/quickstart.md`: la tabla de los cinco gestos
- [x] T024 [P] `<footer>` de `App.tsx`: hoy explica el modelo musical y no menciona ni un gesto
- [x] T025 [P] `.claude/rules/ui.md`: dónde vive un listener global y por qué. Es el **primero** del
      repo (`research.md` §1), así que la regla la escribe este spec y el próximo la copia. En el mismo
      archivo, «los cuatro efectos» de la línea 9 pasa a seis
- [x] T040 [P] `CLAUDE.md:73` y `docs/architecture/overview.md:22` y `:67`: el conteo de efectos de
      `App.tsx`, que este spec falsifica — cuatro pasan a **seis** (`research.md` §11). Los specs son ADR
      y no se reescriben, pero `docs/`, `CLAUDE.md` y las reglas se mantienen al día; hay precedente en
      `d936597` y `eb154a0`. Ojo con el diagrama ASCII de `overview.md:22`, que es una caja alineada
- [ ] T041 [M] **AC7 y AC8** — apretar Play con el mouse y después la barra: el transporte alterna **una
      sola vez** y la página no scrollea; con el foco sobre `Reset`, la barra activa `Reset` y no el
      transporte. Es la mitad de AC7/AC8 que la pura no puede ver, porque lo que puede estar mal es que
      `App.tsx` mire mal el `e.target`
- [ ] T042 [M] **AC10** — con `pnpm dev` (StrictMode monta dos veces), en la consola de Chrome:
      `getEventListeners(window).keydown.length` y `.keyup.length` valen **1**. Sin el
      `removeEventListener` valen 2. No hay test posible: el repo no monta componentes ni tiene jsdom
- [ ] T026 [M] **AC2** — la página no scrollea con el cursor sobre el tablero, y sí scrollea afuera.
      Probar en una ventana baja (~600 px de viewport), que es donde el costo existe
- [ ] T027 [M] **AC4** — el botón derecho sobre el tablero no abre el menú contextual, y sobre el resto
      de la página sí
- [ ] T043 [M] **AC15** — `Ctrl`+rueda sobre el tablero hace el zoom del navegador y **no** rota. Y
      `Ctrl`+C con el foco en la página no da vuelta la reflexión (D10), que es el mismo tap sucio
- [ ] T028 [M] **AC13** — rotar con la rueda con el transporte corriendo: no corta el sonido, no
      reordena el circuito, y las piezas ya colocadas no se mueven
- [ ] T029 [M] Los cinco gestos seguidos, sin tocar el panel: elegir pieza, rotar con la rueda, reflejar
      con el botón derecho, colocar, y arrancar con la barra

## PR

- [x] T030 Rama `feature/013-control-directo` desde `main`, con el spec ya mergeado
- [ ] T031 [M] `/pr-review` antes de pedir revisión
- [x] T032 `specs/log.md`: estado del 013

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

# Tasks 027 — Lo que falla en silencio

Formato en [`specs/README.md`](../README.md). Los cinco pasos son independientes; **sólo el paso 4 pide
el 024 mergeado**.

## Paso 1 — El velo huérfano (bug)

- [ ] T001 `components/__tests__/route-source.test.ts`: el test de `research.md` §1, **en rojo primero**.
      Colocar, cerrar ciclo, `rutaActiva()`, encolar tablero vacío, `rutaActiva()` → `velo()` tiene que
      dar `[]` y hoy da 5 — **AC1**
- [ ] T002 `route-source.ts`: `reiniciar()`, que devuelve `activa`, `pendiente`, `generacion`,
      `estrenando` y `veloActual` a su valor inicial
- [ ] T003 Docblock de `reiniciar()` con la asimetría, que es lo que se pierde si no se escribe: `App.tsx`
      ya argumenta por qué `Reset` frena el transporte además de vaciar el tablero —«es el único lugar
      donde saltearse D5 es lo correcto»— y ese párrafo valía para el motor y **no** para la segunda cola
- [ ] T004 `App.tsx::resetBoard()`: llamarla junto a `frenarTransporte()`
- [ ] T005 **El otro test, el que evita pasarse de largo**: quitar la última pieza con el transporte
      **corriendo** no reinicia nada — el ciclo activo termina, que es D5 del 009 — **AC2**
- [ ] T006 Comentario en `resetBoard()`: las dos colas se reinician juntas o vuelve el bug. Es la misma
      razón por la que `use-engine.ts` encola en las dos con la **misma** instancia
- [ ] T007 [M] En el navegador: colocar, Play, `Reset` antes de que la cabeza llegue a la pieza, y
      confirmar que no queda ni un nodo de velo sobre el tablero vacío

## Paso 2 — `audio()` a medio construir

- [ ] T008 `audio/engine.ts`: en el `catch`, `ctx = null`, `master = null`, `analyser = null` — **AC3**
- [ ] T009 Una marca de «ya falló» para no reintentar el constructor en cada llamada. Apaga el warning
      **repetido**, no el warning — **AC4**
- [ ] T010 Comentario con el modo de falla completo, que es lo que hace legible una línea que si no
      parece defensiva: `ctx` seteado + `master` nulo → `startClock` no sale por su guarda →
      `clockRunning()` en `true` → `alternarTransporte` le cree → el botón dice «Pausa» y no suena nada.
      Es la falla suave que `.claude/rules/audio.md` obliga a chequear, entrando por una puerta que la
      pura no puede ver
- [ ] T011 Test: forzando un fallo posterior al constructor, `clockRunning()` no puede quedar en `true`.
      El andamio existe — `audio/__tests__/test-context.ts` — **AC3**
- [ ] T012 [P] Test: un fallo total produce **un** warning y no uno por llamada — **AC4**

## Paso 3 — El reposo de `Spectrum`

- [ ] T013 `Spectrum.tsx`: booleano de «ya dibujé el reposo» en el efecto; `drawIdle` sólo en la
      transición — **AC5**
- [ ] T014 El `resize` lo invalida: redimensionar borra el canvas, así que hay que volver a pintarlo
- [ ] T015 Comentario que **cite** el de `Playhead` en vez de argumentar de cero: la regla ya estaba
      medida en el repo («baja de 60 escrituras por segundo a entre 4 y 11, y en pausa el loop no toca el
      DOM ni una vez»), y este archivo no la aplicaba. Con el número de acá: 54 operaciones de canvas por
      cuadro, 3.240 por segundo, para pintar la misma imagen
- [ ] T016 Test de navegador de las **dos** mitades: en reposo no vuelve a dibujar después del primer
      cuadro, **y** tras un `resize` sí. Una sola mitad no dice nada — **AC5**

## Paso 4 — Medir la paleta (pide el 024)

- [ ] T017 Test de navegador que cuente ejecuciones de `OrientationPanel` mientras el cursor cruza diez
      celdas. Se instrumenta **desde el test** —mockeando el módulo con un contador que delega en el
      real—, nunca metiendo un contador en el componente — **AC6**
- [ ] T018 Anotar el número. Hoy tiene que dar **diez**, con 337 elementos por render (1 + 12 × 28, con
      `MINI_BOX = 5`)
- [ ] T019 **Decidir con el número, no antes.** Si no se nota, se escribe la medición al lado del
      comentario de `App.tsx` que hoy afirma sin medir que «no cuesta nada», y **no se toca una línea de
      código**. Si se nota, `memo()` sobre `OrientationPanel` + `useMemo` del objeto `orientacion`, y el
      test pasa a afirmar el número nuevo — **AC7**
- [ ] T020 Las dos salidas cierran el AC. La que **no** lo cierra es memoizar primero: `App.tsx` tiene
      una decisión escrita en contra y pisarla sin evidencia es lo que este repo no hace
- [ ] T021 Si se memoiza, comentario de por qué el argumento viejo era circular —«no memoizamos las props
      porque el componente no está memoizado»— y cuál fue el número que lo dio vuelta

## Paso 5 — Las dos aserciones

- [ ] T022 [P] `audio/engine.ts:129`: `const bus = master;` después de la guarda, y el `!` se va. TS
      pierde el estrechamiento al entrar al closure del `forEach` porque `master` es un `let` de módulo
      — **AC8**
- [ ] T023 [P] `main.tsx`: comentario de una línea con por qué ese `!` **se queda** — es el idiom de la
      plantilla de Vite sobre un `#root` que el propio `index.html` garantiza. Sin eso, la próxima
      lectura lo cuenta como deuda otra vez, que es literalmente lo que pasó para llegar a este spec —
      **AC8**
- [ ] T024 `CLAUDE.md`: la regla «cero `any` y cero `@ts-ignore`» pasa a nombrar también la aserción no
      nula, con la excepción de `main.tsx` escrita

## Cierre

- [ ] T025 Confirmar **AC10**: cero cambio visual y cero cambio de audio. Los 322 + 85 pasan sin tocar un
      oráculo
- [ ] T026 `pnpm verify` verde — **AC9**
- [ ] T027 `specs/deuda.md`: nada que borrar —ninguno de los cinco estaba registrado— pero sí anotar el
      que este spec **no** cierra, si el paso 4 termina en «no se memoiza»: queda el número y la puerta
      abierta para el 019/020
- [ ] T028 Actualizar la fila del 027 en `specs/log.md` a `Implementado` — **queda abierta a propósito**:
      el estado lo mueve el merge
- [ ] T029 PR contra `main`

## Seguimiento (no bloquea)

- [ ] T030 **La tercera frecuencia del sistema queda medida.** El repo tenía dos —D1 del 010 (4 a 10,6
      cambios por segundo) y D2 (60 fps contra 60 celdas)— y la del mouse era la única sin número. Con el
      T018 hecho, las tres están
- [ ] T031 **`route-source.ts` y `audio/engine.ts` siguen siendo estado de módulo**, y está bien: la
      regla «sin estado global» del repo habla de estado de **React**. Lo que este spec les agrega es la
      puerta de reinicio que a uno le faltaba; el otro ya la tenía (`stopClock`)
- [ ] T032 **Si el paso 4 termina memoizando**, el 019 y el 020 reescriben `PiecePalette` y
      `OrientationPanel` y tienen que re-decidirlo. El número medido sobrevive a los dos

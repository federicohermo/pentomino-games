# Tasks 027 — Lo que falla en silencio

Formato en [`specs/README.md`](../README.md). Los cinco pasos son independientes en criterio pero **no
en archivos**: el 2 y el 5 tocan `audio/engine.ts`, el 1 y el 4 tocan `App.tsx`. Y **ninguno pide el
024**: la arista que el paso 4 tenía la satisface `main`, porque el 029 construyó el proyecto de
navegador. Numeración a partir de `T033`: son las tareas que el review agregó, y los IDs viejos no se
tocan.

## Paso 1 — El velo huérfano (bug)

- [x] T001 `components/__tests__/route-source.test.ts`: el test de `research.md` §1, **en rojo primero**.
      Colocar, cerrar ciclo, `rutaActiva()`, encolar tablero vacío, `rutaActiva()` → `velo()` tiene que
      dar `[]` y hoy da 5 — **AC1**
- [x] T002 `src/components/route-source.ts`: `reiniciar()`, que devuelve `activa`, `pendiente`,
      `estrenando` y `veloActual` a su valor inicial. **`generacion` NO va a cero**: se sincroniza con
      `cycleGeneration()`, porque `cycleGen` del motor no se resetea nunca (`audio/engine.ts:230`) y
      ponerla en cero haría un swap fuera del borde del ciclo en el cuadro siguiente
- [x] T003 Docblock de `reiniciar()` con la asimetría, que es lo que se pierde si no se escribe: `App.tsx`
      ya argumenta por qué `Reset` frena el transporte además de vaciar el tablero —«es el único lugar
      donde saltearse D5 es lo correcto»— y ese párrafo valía para el motor y **no** para la segunda cola
- [x] T004 `src/App.tsx::resetBoard()`: llamarla junto a `frenarTransporte()`, **por `use-engine.ts`**
      — que la re-exporta como ya re-exporta `stopClock()`—, sin que el shell importe
      `components/route-source.ts` — **AC12**
- [x] T005 `src/components/__tests__/route-source.test.ts` — **el otro test, el que evita pasarse de
      largo**: quitar la última pieza con el transporte **corriendo** no reinicia nada; el ciclo activo
      termina, que es D5 del 009 — **AC2**
- [x] T006 Comentario en `resetBoard()`: las dos colas se reinician juntas o vuelve el bug. Es la misma
      razón por la que `use-engine.ts` encola en las dos con la **misma** instancia
- [ ] T007 [M] En el navegador: colocar, Play, `Reset` antes de que la cabeza llegue a la pieza, y
      confirmar que no queda ni un nodo de velo sobre el tablero vacío

## Paso 2 — `audio()` a medio construir

- [x] T008 `src/audio/engine.ts`: en el `catch`, `ctx = null`, `master = null`, `analyser = null`. El
      contexto a medio construir **no se cierra**: `close()` obligaría a un `.catch(() => {})` que no
      corre nunca, y con el umbral 100 eso es una función sin cubrir — **AC3**
- [x] T009 Una marca de «ya falló» para no reintentar el constructor en cada llamada. Apaga el warning
      **repetido**, no el warning — **AC4**
- [x] T010 Comentario con el modo de falla completo, que es lo que hace legible una línea que si no
      parece defensiva: `ctx` seteado + `master` nulo → `startClock` no sale por su guarda →
      `clockRunning()` en `true` → `alternarTransporte` le cree → el botón dice «Pausa» y no suena nada.
      Es la falla suave que `.claude/rules/audio.md` obliga a chequear, entrando por una puerta que la
      pura no puede ver
- [x] T011 `src/audio/__tests__/engine.browser.test.tsx`: forzando un fallo posterior al constructor,
      `clockRunning()` no puede quedar en `true`. El andamio **no** es `test-context.ts` —ése es el
      `OfflineAudioContext` del proyecto `node`— sino el helper `motor()` de ese archivo, que reimporta
      con `?fresh=N` porque `vi.resetModules()` no aisla un singleton en browser mode — **AC3**
- [x] T012 `src/audio/__tests__/engine.browser.test.tsx`: un fallo total produce **un** warning y no uno
      por llamada — **AC4**

## Paso 3 — El reposo de `Spectrum`

- [x] T013 `src/components/spectrum-loop.ts` —no el `.tsx`, el 029 mudó el loop—: **clave de lo último
      dibujado** y no un booleano, la misma forma que `dibujado` en `playhead-loop.ts`; `drawIdle` sólo
      en la transición — **AC5**
- [x] T014 El `resize` la invalida: redimensionar borra el canvas, así que hay que volver a pintarlo
- [x] T015 Comentario que **cite** el de `Playhead` en vez de argumentar de cero: la regla ya estaba
      medida en el repo («baja de 60 escrituras por segundo a entre 4 y 11, y en pausa el loop no toca el
      DOM ni una vez»), y este archivo no la aplicaba. Con el número de acá: **55** operaciones de canvas
      por cuadro, **3.300** por segundo, para pintar la misma imagen. (Decía 54 y 3.240: la cuenta vieja
      veía un solo `fillStyle` y hay dos — el re-conteo está en `research.md` §3 y en `log.md`)
- [x] T016 `src/components/__tests__/Spectrum.browser.test.tsx`: en reposo no vuelve a dibujar después
      del primer cuadro, **y** tras un `resize` sí. Una sola mitad no dice nada, y son **tres**: la
      tercera —señal → reposo— está en `T037` — **AC5**

## Paso 4 — Medir la paleta (pide el 024)

- [x] T017 `src/__tests__/App.browser.test.tsx`: contar ejecuciones de `OrientationPanel` mientras el
      cursor cruza diez celdas. Se instrumenta **desde el test** —`vi.mock` del módulo con un contador
      que delega en el real por `importActual`, el patrón que ya usan cinco `*.browser.test.tsx`—,
      nunca metiendo un contador en el componente. Se cuentan ejecuciones y **no** milisegundos, así
      que no necesita el `skipIf` bajo coverage del 029 — **AC6**
- [x] T018 Anotar el número en `src/App.tsx:253-257`. Hoy tiene que dar **diez además del render
      inicial** —decirlo es parte del oráculo—, con 337 elementos por render (1 + 12 × 28, con
      `MINI_BOX = 5`). **Y anotar qué mitad del sistema describe**: mide la frecuencia del **mouse**,
      y el 026 le agrega un segundo escritor de `hover` con la misma frecuencia por pulsación —la
      celda enfocada con el teclado **es** `hover`, no un estado paralelo—. Este spec va primero y
      mide sólo su mitad; el 026 escribe la suya y la dependencia queda declarada de los dos lados. Si
      la medición de acá terminara en «no se memoiza», ese número no cierra la pregunta para el 026:
      la cierra para el mouse
- [x] T019 **Decidir con el número, no antes.** Si no se nota, se escribe la medición al lado del
      comentario de `App.tsx` que hoy afirma sin medir que «no cuesta nada», y **no se toca una línea de
      código**. Si se nota, `memo()` sobre `OrientationPanel` + `useMemo` del objeto `orientacion`, y el
      test pasa a afirmar el número nuevo — **AC7**
- [x] T020 Las dos salidas cierran el AC. La que **no** lo cierra es memoizar primero: `App.tsx` tiene
      una decisión escrita en contra y pisarla sin evidencia es lo que este repo no hace
- [x] T021 Si se memoiza, comentario de por qué el argumento viejo era circular —«no memoizamos las props
      porque el componente no está memoizado»— y cuál fue el número que lo dio vuelta

## Paso 5 — Las dos aserciones

- [x] T022 [P] `src/audio/engine.ts:129`: `const bus = master;` después de la guarda, y el `!` se va. TS
      pierde el estrechamiento al entrar al closure del `forEach` porque `master` es un `let` de módulo
      — **AC8**
- [x] T023 [P] `src/main.tsx:12`: comentario de una línea con por qué ese `!` **se queda** — es el idiom de la
      plantilla de Vite sobre un `#root` que el propio `index.html` garantiza. Sin eso, la próxima
      lectura lo cuenta como deuda otra vez, que es literalmente lo que pasó para llegar a este spec —
      **AC8**
- [x] T024 `CLAUDE.md:170-174`: la regla «cero `any` y cero `@ts-ignore`» pasa a nombrar también la
      aserción no nula, con la excepción de `main.tsx` escrita. **El 030 no la escribió** —lo que él
      agregó a ese bullet es `noInlineConfig`, y la «aserción» que nombra en otro bullet es la de un
      test sin `expect`—, así que la tarea sigue viva, pero el texto que se edita ya no es el que este
      spec citaba

## Cierre

- [x] T025 Confirmar **AC10**: cero cambio visual y cero cambio de audio. Los 562 de `src/` y los del
      MCP server pasan sin tocar un oráculo — salvo **uno**, el del estado degradado (`T035`), que es el
      único que este spec da vuelta a propósito
- [x] T026 `pnpm verify` verde con sus cuatro nodos, incluida la pasada de `coverage` con umbral **100**
      y **cero `/* v8 ignore */`** en el diff — **AC9**, **AC11**
- [x] T027 `specs/deuda.md`: nada que borrar —ninguno de los cinco estaba registrado— pero sí anotar el
      que este spec **no** cierra, si el paso 4 termina en «no se memoiza»: queda el número y la puerta
      abierta para el 019/020
- [x] T028 Actualizar la fila del 027 en `specs/log.md` a `Implementado` — **queda abierta a propósito**:
      el estado lo mueve el merge
- [x] T029 PR contra `main`

## Agregadas por el review

- [x] T033 `src/components/use-engine.ts`: re-exportar el reinicio de la cola de dibujo al lado de
      `frenarTransporte()`, que es `stopClock()` re-exportado por el mismo motivo. Es el único módulo de
      `components/` por donde el shell le habla a las dos colas — **AC12**
- [x] T034 `src/components/__tests__/use-engine.browser.test.tsx`: su `vi.mock('../route-source.ts')`
      declara hoy sólo `encolar`. Si el reinicio pasa por el hook, el mock necesita la función nueva o
      el test se cae con un `undefined` que no dice nada
- [x] T035 `src/audio/__tests__/engine.browser.test.tsx:503`: **reescribir** «con el grafo a medio
      construir, tick se planta en su guarda». Hoy afirma `expect(e.audio()).not.toBeNull()` y
      `expect(e.clockRunning()).toBe(true)`, que es exactamente lo que **AC3** prohíbe. Se conserva la
      clase `SinGain` y se da vuelta el oráculo; su comentario —«alcanzable de verdad»— pasa a decir
      por qué dejó de serlo — **AC3**
- [x] T036 `src/audio/engine.ts`: comentario en las guardas `if (!c || !master)` de `playNotes` y
      `tick()` diciendo que su segunda mitad ya no es alcanzable desde afuera y por qué se queda igual.
      Si el coverage la marcara descubierta, se resuelve con un test que la alcance y **nunca** con un
      `/* v8 ignore */` — **AC11**
      · **Salió distinto, y está medido.** La de `playNotes` se quedó tal cual, con su comentario. La de
      `tick()` **no se puede dejar escrita**: su `return` se queda sin ningún camino de ejecución —el
      timer sólo existe después de que `audio()` contestó— y da 99,13 de statements y 98,27 de branches;
      en positivo (`if (c && bus) …`) los statements vuelven a 100 pero las branches siguen en 98,27,
      porque v8 emite el `else` implícito. Y ningún test puede alcanzarla, así que la salida del propio
      AC11 no aplicaba. Se **mudó a `startClock`**, el único lugar donde sigue siendo alcanzable —y
      además la única función cuya respuesta la UI muestra—, y `tick` pasó a recibir el par ya
      estrechado por su firma, que es una garantía más fuerte que la guarda. El argumento completo y la
      medición están en el docblock de `tick()`
- [x] T037 `src/components/__tests__/Spectrum.browser.test.tsx`: la tercera transición —**señal →
      reposo**, con `readSpectrum()` volviendo a `null` y el canvas lleno de barras— vuelve a dibujar el
      reposo. Es la que un booleano dejaría afuera — **AC5**
- [x] T038 `docs/architecture/audio.md`: la sección de `route-source.ts` (línea ~504) describe el par
      activa/pendiente sin la puerta de reinicio. Agregarla ahí, que es el archivo que se mantiene al
      día y el único de `docs/` que este lote no comparte con nadie
- [x] T039 `specs/revisiones.md`: anotar lo aprendido, que es de la familia del pase de mutación del 029
      —un test verde sobre código roto—: acá el test estaba verde **fijando** el estado degradado como
      correcto. Cubrir una rama y verificarla siguen sin ser lo mismo

- [x] T041 `src/components/Playhead.tsx:35-38`: el docblock afirma en presente una carencia que **ya
      no existe** —«No lo atrapa ningun test ni se ve en el atributo `style`»— y lo falsifica
      `src/components/__tests__/Playhead.browser.test.tsx:65`, que lee el `zIndex` **computado** de
      las dos capas, más `pointerEvents` y el orden en el DOM. Lo dejó podrido el 029 al escribir el
      test sin volver sobre el comentario que decía que no se podía escribir. **Es del mismo género
      que los otros cinco frentes**: nada falla, nadie se entera, y el costo es que manda a escribir
      un test que ya está escrito y hace creer que hay un agujero donde no lo hay — un comentario que
      sobrevive a su propio arreglo miente con la misma cara con la que antes decía la verdad. Texto
      de reemplazo, sin acentos como el resto del archivo, desde el `No` de la línea 35 hasta el punto
      de la 38 — **AC13**:

      ```
       * hasta la celda vacia tiene fondo opaco (`bg-white`), queda directamente invisible.
       *
       * No se ve en el atributo `style`, y por eso durante veintidos specs este comentario
       * decia que ningun test lo atrapaba: el `z-10` es una clase de Tailwind, asi que hay
       * que leer el valor COMPUTADO y sin la hoja de estilos cargada da `auto`. Desde el
       * 029 si lo atrapa `__tests__/Playhead.browser.test.tsx:65`, sobre las dos capas y
       * junto con `pointer-events` y el orden en el DOM. La otra via —preguntarle a
       * `elementFromPoint` quien esta arriba, habilitando el hit-testing un instante porque
       * `pointer-events-none` hace que devuelva lo de abajo— sigue siendo la unica que mira
       * los pixeles de verdad, y no hizo falta.
      ```

## Seguimiento (no bloquea)

- [ ] T030 **La tercera frecuencia del sistema queda medida.** El repo tenía dos —D1 del 010 (4 a 10,6
      cambios por segundo) y D2 (60 fps contra 60 celdas)— y la del mouse era la única sin número. Con el
      T018 hecho, las tres están
- [ ] T031 **`route-source.ts` y `audio/engine.ts` siguen siendo estado de módulo**, y está bien: la
      regla «sin estado global» del repo habla de estado de **React**. Lo que este spec les agrega es la
      puerta de reinicio que a uno le faltaba; el otro ya la tenía (`stopClock`)
- [ ] T032 **Si el paso 4 termina memoizando**, el 019 y el 020 reescriben `PiecePalette` y
      `OrientationPanel` y tienen que re-decidirlo. El número medido sobrevive a los dos
- [ ] T040 **La sexta falla muda queda registrada y afuera**: la rotación sin acotar de `deuda.md`
      —`base[j + rot]` fuera de rango pinta `undefinedNaN` en la celda— es la única de la familia que ya
      estaba anotada. No la cierra este spec porque el arreglo es acotar el tipo, o sea firmas y
      `domain/`, y acá `domain/` no se toca

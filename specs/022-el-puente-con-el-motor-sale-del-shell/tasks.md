# Tasks — Spec 022

Formato en [`specs/README.md`](../README.md). `[P]` = paralelizable dentro de su bloque; `[M]` = pide
una persona y no bloquea el cierre.

## Paso 1 — Las dos puras

- [x] T001 `src/components/types/motor.types.ts`: `MotorDeTransporte` (`arrancar`, `frenar`,
      `corriendo`) y `SequenceDelMotor`, el tipo que espera `setSequence`. Docblock con por qué los
      nombres del rol van en español y no replican `startClock`/`stopClock`/`clockRunning`: el tipo
      describe lo que la pura necesita, no la API de `engine.ts`
- [x] T002 `src/components/motor.ts`: `proyectarAlMotor(s: Sequence): SequenceDelMotor`. Los dos
      `Sequence` chocan de nombre, así que el del motor entra con **alias**; el alias va de ese lado
      porque en `components/` el del dominio ya lo importa `route-source.ts:1` y el del motor no lo
      importa nadie — medido, es **1 contra 0**, no 4 contra 0
- [x] T003 `motor.ts`: el comentario del ternario del click viaja **desde `App.tsx`**, no se reescribe.
      Es el que dice que la ausencia de la clave `note` significa «celda vacía» y que la forma corta
      `({ offset, note })` dejaría un tercer estado que el tipo existe para no tener
- [x] T004 `motor.ts`: comentario sobre qué **cae** en la proyección y por qué —`pieceId` porque el
      motor no tiene a quién devolvérselo, `cell` porque `audio/**` no puede importar `Cell` ni como
      `import type`—. Es D7/D8 del 009, y hoy vive sólo en el comentario del efecto de `App.tsx`
- [x] T005 `motor.ts`: `alternarTransporte(playing, motor)`. El `return motor.corriendo()` y **no**
      `return !playing` es la tarea entera: es AC10 del 008 y la regla de `.claude/rules/audio.md:24`
      en una línea, con el porqué al lado
- [x] T006 `src/components/__tests__/motor.test.ts`: los tres casos de `proyectarAlMotor`, armados con
      `buildSequence` sobre un tablero real —como `route-source.test.ts`— y no con literales. El tercero
      es el que hoy nadie cubre: el click mudo sale **sin la clave**, verificado con `'note' in c` y no
      con `c.note === undefined`, que es justamente la comparación que no distingue los dos estados —
      **AC2**, **AC3**
- [x] T007 `motor.test.ts`: las dos ramas de `alternarTransporte` con motores falsos. La segunda
      —`corriendo: () => false` tras pedirle arrancar— cierra el ítem de `deuda.md` que espera desde el
      spec 008, **sin jsdom y sin testing-library** — **AC6**

## Paso 2 — El hook, y el shell sin efectos de reconciliación

- [x] T008 `src/components/use-motor.ts`: `useMotorSincronizado({ secuencia, placed, tempo, clicks })`
      con los cuatro efectos **en el mismo orden que hoy** y con sus docblocks **mudados, no
      reescritos**: D5 del 009, por qué `playing` no está en las dependencias, la limpieza sincrónica
      bajo StrictMode y por qué el desmontaje usa `DEFAULT_REGIMEN` — **AC4**, **AC5**
- [x] T009 `use-motor.ts`: las dos proyecciones llaman a `proyectarAlMotor`. Es lo único que cambia
      adentro de los efectos — **AC1**
- [x] T010 `use-motor.ts`: docblock del módulo con **por qué `secuencia` entra por parámetro y el hook
      no la vuelve a derivar** — si llamara a `buildSequence` por su cuenta, el dibujo y el sonido
      podrían mirar circuitos distintos sin que nada falle, que es lo que D5 del 009 existe para cerrar
- [x] T011 `use-motor.ts`: `MOTOR` como const de módulo, cableando las tres funciones reales al rol de
      `MotorDeTransporte`, más `frenarTransporte()` para `resetBoard`. Es lo que evita que `App.tsx`
      siga importando el motor por una sola línea. El docblock tiene que decir **por qué no va a
      `components/constants/`** pese a la regla de que los módulos no declaran constantes: no es un
      valor fijo sino el cableado de tres funciones de `audio/engine.ts`, y mandarlo a `constants/`
      —que hoy sólo tiene datos— la obligaría a importar el singleton del `AudioContext`. Precedente en
      la misma capa: `route-source.ts:53` (`RUTA_VACIA`) y `cell-text.ts:11` (`memo`)
- [x] T012 `src/App.tsx`: borrar los cuatro efectos (`:98-99` y `:182-258`) y llamar al hook **después
      del `useMemo` de `secuencia`** (`:118`) y **no** donde estaban los dos cortos: `secuencia` es un
      `const`, así que llamarlo en `:98` la leería en su zona muerta temporal y tiraría un
      `ReferenceError` en el primer render. El orden de los efectos entre sí no cambia —siguen los
      cuatro juntos y antes de los dos de entrada—, que es lo que AC5 protege. Los `useMemo` de `secuencia` y `noteSet`
      **se quedan**: el hook recibe el resultado, no la regla — **AC4**
- [x] T013 `App.tsx`: `togglePlay` pasa a `setPlaying(alternarTransporte(playing, MOTOR))` y
      `resetBoard` a `frenarTransporte()`. Los imports de `startClock`, `stopClock`, `clockRunning` y
      `setSequence` se van; **`playNow` se queda** —el disparo de colocación no es reconciliación—, y
      `setBpm`/`setClicksAudible` también se van con sus efectos
- [x] T014 `App.tsx`: actualizar el docblock del módulo (`:28-44`), que hoy describe el archivo como
      «estado, derivados, handlers y efectos»
- [x] T015 `pnpm verify` en verde
- [ ] T062 [M] **Lectura contra AC5**: mismas llamadas al motor, en el mismo orden, con las mismas
      dependencias. Va separada de T015 y con `[M]` porque no es un gate automatizable — no hay test
      que lo cubra y no se inventa uno, montar el hook pide el jsdom que este spec existe para no
      agregar. Mezclada con `pnpm verify` quedaba tildada por correr un comando — **AC5**

## Paso 3 — Los dos hooks de entrada

- [x] T042 `src/components/use-entrada.ts`: `useAtajosDeTeclado(acciones, tapLimpio)` y
      `useRuedaRota(nodo, alRotar, tapLimpio)`. **Callbacks y no setters**: es lo que hace que el 020
      cambie `App.tsx` y no el hook cuando `rotation` y `mirror` pasen a ser una ranura de un `Record`
      — **AC14**
- [x] T043 `use-entrada.ts`: **`tapLimpio` entra por parámetro a los DOS hooks y NO se muda adentro de
      ninguno.** El ref (`App.tsx:96`) lo lee el teclado (`:296`) y lo escriben **los dos** —el teclado
      en cada `keydown` con `abreTapLimpio` (`:318`) y la rueda a `false` (`:350`)—, así que no es un
      productor y un consumidor sino estado mutable compartido en las dos direcciones. Meterlo adentro
      del hook del teclado deja al de la rueda sin forma de ensuciarlo y devuelve el bug que
      `App.tsx:344-349` documenta —`Ctrl`+rueda hace zoom **y refleja al soltar**, el gesto que D10 del
      013 nombra por su nombre—. El docblock lo dice en las dos firmas — **AC15**
- [x] T044 `use-entrada.ts`: el handler de la rueda conserva `{ passive: false }` explícito **y el
      orden de sus tres guardas** —ensuciar el tap → `ctrlKey` → `deltaY === 0` → `preventDefault`—,
      con el comentario que explica por qué ensuciar va primero. Ese orden **es** el arreglo de AC15:
      con la línea después del `return` por `ctrlKey`, el bug vuelve aunque el ref esté bien pasado
- [x] T045 `src/App.tsx`: `alRotar` va envuelto en `useCallback(…, [])`. Sin eso el listener de
      `wheel` se re-suscribe por render, y hoy se registra **una sola vez** — es posible porque el
      cuerpo sigue usando el setter funcional, que es lo que el comentario de `:337-339` declara —
      **AC16**
- [x] T046 `App.tsx`: los tres callbacks del teclado **no** se memoizan a `[]`. Dependen de `rotation`
      y `mirror` igual que hoy, así que el efecto se re-suscribe cuando ellos cambian — que es lo que
      el comentario de `:281-285` argumenta contra la alternativa del ref. Convertirlo acá sería meter
      una decisión nueva adentro de una mudanza — **AC16**
- [x] T063 `use-entrada.ts`: **`useAtajosDeTeclado` no puede poner el objeto `acciones` en el array de
      dependencias de su efecto.** Un literal `{ rotar, reflejar, transporte }` armado en el JSX tiene
      identidad nueva por render, así que el hook se re-suscribiría **por render** en vez de por cambio
      de `rotation`/`mirror` — peor que hoy, no igual, y sin que nada falle. Lista los tres campos por
      separado, o los recibe como tres parámetros. Es la mitad de AC16 que el `useCallback` de T045 no
      cubre — **AC16**
- [x] T047 `App.tsx`: borrar los dos efectos (`:286-372`) y llamar a los dos hooks. `handleContextMenu`
      **no se muda**: no pasa por ningún efecto — **AC14**
- [x] T048 Oráculo de **AC14**: `grep -c "useEffect" src/App.tsx` devuelve **0**, y el import de React
      pierde `useEffect`

## Paso 4 — La paleta en tres archivos

- [x] T049 `src/components/types/panel.types.ts`: los dos objetos de props. `regimen` y `noteSet` van
      con la **orientación** y no con el transporte aunque el régimen sea global como el tempo:
      gobierna qué hace la rotación (spec 017), así que sin él la orientación no dice qué suena.
      `onReset` va con el **transporte** porque `resetBoard` frena el reloj además de vaciar el tablero.
      Los tres criterios van escritos — **AC17**
- [x] T050 `src/components/PanelDeOrientacion.tsx`: las doce miniaturas, el régimen, la reflexión y el
      lector de la pieza en la mano. **El JSX se mueve, no se reescribe**, y el componente **devuelve un
      fragmento** (`<>…</>`) y **no** un `<div>` envoltorio: sus filas cuelgan del `space-y-2` de
      `PiecePalette.tsx:170`, que es un selector de **hijo directo**, así que envolverlas se come un
      margen con las clases intactas y sin que ningún test lo note (`research.md` §10) — **AC18**
- [x] T051 `src/components/PanelDeTransporte.tsx`: **sólo el bloque `border-t` de `:256-299`** —Tempo,
      play/pausa y Reset—. La fila de clicks **no entra acá**: hoy vive entre dos bloques de orientación
      (`:232-235`), así que llevársela reordenaría el DOM y rompería AC18. Ídem fragmento — **AC18**
- [x] T052 `PiecePalette.tsx`: se queda con la tarjeta, la composición y —medido, no por gusto— **la
      fila de clicks** (`:232-235`), que renderiza desde `transporte.clicks` y `transporte.onToggleClicks`
      porque está intercalada entre dos bloques de orientación. Sigue recibiendo **dos** props y cada
      panel sigue recibiendo sólo el suyo, así que AC17 queda literal. El 019 vuelve contigua esta
      agrupación cuando muda ese botón a la fila de transporte (`019` `T011`) — **AC17**, **AC18**
- [x] T064 `PiecePalette.tsx` / `PanelDeOrientacion.tsx`: los comentarios de medición **viajan con el
      bloque que describen**, con una excepción medida: el de `:41-46` explica el `md:col-span-4` de la
      **tarjeta** y se queda, pero el de `:50-82` —el reparto de columnas— se apoya en él (la tabla
      `viewport → interior → columnas → pista → padding`). Al separarse en dos archivos, el de la grilla
      tiene que **llevarse el dato del interior** o queda sin premisa — **AC18**
- [x] T053 `App.tsx`: los dos objetos se arman **inline en el JSX**. Comentario al lado: identidad
      nueva por render, que no cuesta nada porque `PiecePalette` no está memoizado. Se escribe porque
      es lo primero que alguien va a querer «arreglar» con un `useMemo` que no compra nada

> **Desviacion del Paso 4, medida al escribir el JSX.** `T050` pedia que
> `PanelDeOrientacion` se llevara tambien el regimen, la reflexion y el lector de notas,
> devolviendo un fragmento. **No se puede sin romper AC18**, y el motivo es que
> `research.md` §10 conto **una** de las tres interpolaciones: vio que la fila de clicks cae
> entre dos bloques de orientacion, pero no que la linea de notas viene DESPUES de esa fila
> ni que la grilla de miniaturas cuelga de la tarjeta y no del `space-y-2`. Con las tres
> juntas la orientacion vive en **tres regiones no adyacentes y en dos niveles de
> anidamiento**, y un componente devuelve un solo nodo.
>
> Se resolvio a favor del oraculo duro —AC18, del que dependen tres specs que ya midieron
> sobre ese DOM—: cada panel se lleva un subarbol **contiguo** y lo devuelve tal cual
> (`PanelDeOrientacion` la grilla de miniaturas, `PanelDeTransporte` el bloque `border-t`),
> y las **cuatro** filas del medio se quedan en `PiecePalette.tsx` leyendo del objeto que
> les toca. AC17 queda literal: el contenedor recibe dos objetos y cada panel recibe solo el
> suyo. El argumento esta en el docblock de `PiecePalette.tsx` y la leccion en
> `revisiones.md`.
>
> Verificado y no afirmado: se renderizo la version de `main` y la nueva con
> `renderToStaticMarkup` sobre las **32** combinaciones de rotacion x reflexion x `playing` x
> `clicks` y el markup salio identico en las 32. AC18 era falsable sin jsdom.

## Paso 5 — Las siete huérfanas (commit propio)

- [x] T016 `pnpm remove` de las cuatro `@testing-library/*`, `@types/jest`, `postcss` y `autoprefixer`,
      **en su propio commit**: es un borrado, y la regla del repo es que revertirlo sea trivial —
      **AC7**
- [x] T017 `vite.config.ts`: se va el comentario que explica cómo esquivar a `@types/jest` (`:14-16`;
      `:17` es el `include` y **se queda**).
      El bloque `test` no cambia de otra forma: `globals: true` queda **disponible y sin ejercer** —
      sacarle el import a 16 archivos de test no es de esta unidad de trabajo. `pnpm verify` corre
      **después** de este commit y no antes, que es la única forma de saber que ninguna de las siete
      estaba sosteniendo algo por accidente — **AC7**

## Paso 6 — Lo que dejó de ser cierto, y las dos reglas nuevas

- [x] T018 `specs/021-el-tablero-es-la-pantalla/tasks.md`: `T059`, `T060` y `T049` actualizan «los seis
      efectos» a **«siete»**, y con el 022 puesto el número base ya no es seis. Recontar en las tres.
      Precedente de tocar el `tasks.md` de un spec pendiente: el 015 cerró el `T070` del 011 y el 021
      cierra el `T033` del 016
- [x] T039 `specs/018-la-pieza-se-elige-con-su-letra/tasks.md`: su `T014` cita **`App.tsx:311`** (el
      `else togglePlay()` que cierra la cadena del teclado). El 022 borra 79 líneas **por encima** de
      esa, así que el número muere aunque el efecto no se mueva — es el mismo riesgo que los Límites de
      Alcance invocan para **no** mudar el teclado, y aplica igual por la resta. Recontar, o pasarla a
      **por símbolo** como ya hace el `T033` del 020
- [x] T040 `specs/019-el-panel-se-queda-sin-botones/tasks.md`: su `T040` afirma que «`resetBoard`
      (`App.tsx:176-180`) **no se toca**, así que el riesgo es bajo». Con el 022 puesto `resetBoard`
      **sí** se toca —`stopClock()` pasa a `frenarTransporte()` (T013)— y además se corre de línea.
      Reescribir la justificación del riesgo: el cambio es de cableado y no de comportamiento, pero
      decirlo es de este spec y no del 019
- [x] T041 `specs/020-la-orientacion-es-de-la-pieza/tasks.md`: su `T019` abre con «`resetBoard` **no
      cambia**». Sigue siendo cierto para lo que al 020 le importa —no toca las orientaciones— pero la
      frase pelada queda falsa después del 022. Acotarla a «no cambia **lo que hace**»
- [x] T061 `src/`: los **cinco docblocks** que este spec vuelve falsos, medidos en `research.md` §14.
      El que más importa es `audio/types/scheduler.types.ts:35-36` («`App.tsx` es el **único puente**
      entre las dos capas»), que es el que sostiene AC3 y D7/D8 del 009 y después del 022 apunta a un
      archivo que ya no proyecta. Los otros cuatro: `components/route-source.ts:22`,
      `domain/types/board.types.ts:35`, `domain/__tests__/sequence.test.ts:990` y
      `audio/engine.ts:177-181`. Son **comentarios**: no mueven ninguna firma, así que el borde con
      `mcp-server/` sigue intacto y AC13 se cumple igual — **AC21**
- [x] T019 [P] `CLAUDE.md:74` — **AC9**
- [x] T020 [P] `docs/architecture/overview.md`: **`:23`** (el diagrama ASCII), **`:68`** (la prosa) y
      **`:71-73`** (el párrafo que los enumera). Los tres en una tarea y no en tres `[P]`: es el mismo
      archivo. El párrafo de `:71-73` no se borra —ya parte los seis en «cuatro de reconciliación» y
      «dos de entrada», que es el corte de este spec— sino que pasa a nombrar los dos archivos — **AC9**
- [x] T021 [P] `.claude/rules/ui.md:9-11`: dos cosas en la misma frase. «Los seis efectos» (**AC9**) y
      «`domain/`, que es lo único que puede testearse», que **ya era falso antes de este spec** —
      `input.ts`, `cell-text.ts`, `piece-mini.ts` y `route-source.ts` tienen tests— y con `motor.ts`
      pasa a serlo por quinta vez. Es la regla que **se carga sola al tocar `App.tsx`**, así que dejarla
      vieja es la que más caro sale — **AC9**, **AC10**
- [x] T022 [P] `docs/guides/conventions.md`: la regla de idioma de los identificadores. **Descriptiva**:
      inglés para el vocabulario técnico universal, español para el del instrumento, con los ejemplos
      del repo de los dos lados. Dice explícitamente que **no se renombra nada** hacia atrás — **AC11**
- [x] T023 `docs/guides/conventions.md`: el criterio de comentario en el eje del **tiempo** — se
      queda la restricción vigente, la historia va a `revisiones.md` con un puntero—, con un ejemplo
      real de cada clase sacado del repo. Va en el mismo archivo que T022, así que **no lleva `[P]`**: en
      este repo `[P]` significa «no comparten archivo» (`specs/README.md`), y dos agentes escribiendo
      `conventions.md` a la vez chocan al guardar aunque apunten a secciones distintas. Es el mismo
      criterio con el que T020 junta las tres regiones de `overview.md` en una sola tarea — **AC12**

## Paso 7 — El registro, y las treinta y una tareas

- [x] T024 `specs/deuda.md`: **borrar** los tres ítems que este spec cierra —las `@testing-library/*`
      sin consumidor, `postcss` + `autoprefixer`, y `@types/jest`— y, del ítem de «No hay tests de UI»,
      la parte que nombra AC10 del 008 como «el primer caso a cubrir cuando exista la infra»: se cubre
      acá y sin infra. **El resto de ese ítem se queda**: los cuatro componentes se siguen verificando
      a ojo — **AC8**
- [x] T025 `specs/deuda.md`: **no se agrega ningún ítem nuevo.** Con el spec ampliado a los seis
      frentes no queda nada diferido: el teclado y la rueda salen en el paso 3, la paleta en el 4 y el
      pase de comentarios en el 8. Lo que **sigue abierto y del mismo tamaño** es el resto del ítem de
      «No hay tests de UI» —los cuatro componentes se verifican a ojo— y el de `public/manifest.json`.
      La tarea es verificar que el archivo quedó así y no dejar un ítem de más por inercia — **AC8**
- [x] T054 `specs/018-la-pieza-se-elige-con-su-letra/tasks.md`: `T013` y `T015` escriben «el efecto de
      teclado de `App.tsx`», que después del paso 3 vive en `use-entrada.ts`. Y ojo con la forma: con
      callbacks, la rama `ACCION.seleccionar` que el 018 agrega va **adentro del hook** —es una acción
      más del despacho— pero el `setSelected` que dispara va en el callback, en `App.tsx`. Decirlo
      ahorra el viaje equivocado — **AC22**
- [x] T055 `specs/020-la-orientacion-es-de-la-pieza/tasks.md`: `T009`, `T010`, `T011` y `T040` apuntan
      al efecto de teclado y al de la rueda en `App.tsx`. Las cuatro **se achican**: con los callbacks
      del paso 3, el 020 escribe los tres callbacks y no el efecto. `T010` en particular —«el efecto de
      la rueda agrega `selected` a las dependencias»— pasa a ser sobre el `useCallback` de T045, y hay
      que decir que **si `alRotar` deja de tener dependencias vacías, AC16 de este spec se rompe** —
      **AC22**
- [x] T056 `specs/019-…/tasks.md` (`T001`, `T002`, `T003`, `T005`, `T007`, `T011`, `T020`, **`T031`**,
      `T035`, **`T039`**), `specs/020-…/tasks.md` (**`T002`**, `T008`, `T013`, `T014`, `T015`,
      **`T016`**, `T017`, `T038`) y `specs/021-…/tasks.md` (`T017`, `T046`): las **veinte** que nombran
      `PiecePalette.tsx` y ahora tienen que nombrar `PanelDeOrientacion.tsx` o `PanelDeTransporte.tsx`.
      **No es un reemplazo de texto**: hay que mirar cada una y decidir a qué panel cae. Las de `T005`
      del 019 y `T008`/`T038` del 020 además dejan de sacar/agregar props sueltas y pasan a tocar un
      campo de un objeto.
      Las **cuatro en negrita** son las que la primera versión de esta tarea no listaba, y son las que
      más fácil se escapan porque nombran el archivo de refilón: `019` `T031` cita
      `PiecePalette.tsx:115`, `019` `T039` cita `PiecePalette.tsx:285-287`, `020` `T002` usa el `.map`
      de los doce botones como **testigo por símbolo** —y el símbolo se muda de archivo, que es
      justamente lo que esa tarea da por estable— y `020` `T016` es el botón `0°` — **AC22**
> `T026` y `T027` —la fila del 022 en `log.md` y su entrada de dependencias— **no están acá a
> propósito**: entran con el commit del spec a `main`, que es el paso 2 del flujo de
> [`README.md`](../README.md). Los IDs quedan libres y no se reusan.

## Paso 8 — El pase de comentarios (último, commit propio)

- [x] T057 Los **tres casos testigo** primero, y solos: `App.tsx:53-66` (el default de `clicks` que
      cambió de valor), `sequence.ts:359-380` («el plan del 009 decía… se cambió después de
      escucharlo») y `PiecePalette.tsx:50-59` («el esquema de columnas se remidió entero»). Si alguno
      resulta ser restricción vigente disfrazada de crónica, el criterio se ajusta **antes** de tocar
      nada más — **AC19**
- [x] T058 El pase sobre el resto de `src/` sin tests, con las cinco reglas del paso 8 del plan.
      **Nada se borra: se mueve** a `revisiones.md`, con fecha y con el spec que lo originó. Ante la
      duda, se queda — **AC19**
- [x] T059 El commit del pase va **solo**, y es lo último del spec: revertirlo entero tiene que ser
      trivial, y sobre su diff se verifica la conservación — **AC20**
- [x] T060 Oráculo de **AC19**: lo que `src/` perdió en comentarios está en `revisiones.md`. Se lee
      sobre el diff del commit de T059, que por eso va solo. **No hay objetivo porcentual**: si el pase
      saca poco, sacó poco

## Verificación

- [x] T028 `pnpm verify` en verde
- [x] T029 Oráculo de **AC1**: `grep -rn "{ offset: c.offset, note: c.note }" src/` devuelve **una**
      línea, contra las dos de hoy
- [x] T030 Oráculo de **AC9**: `grep -rn "seis efectos" .` no devuelve nada fuera de `specs/` —los
      specs son historia y no se reescriben (desviación 2 del README). **Sin `--include=*.md`**: el
      barrido con ese filtro es el que dejó pasar los cinco docblocks de `src/` que encontró el review
      (§14 del research, T061)
- [x] T031 La evidencia de **AC13** no es correr el typecheck del server —`pnpm verify` ya lo corre
      adentro de `mcp:test`, así que T028 lo cubre— sino que `git diff --stat` no muestre **ni un
      archivo de `mcp-server/`** y que los únicos de `domain/` y `audio/` sean los comentarios de T061
      y del paso 8 — **AC13**
- [ ] T032 [M] Navegador: colocar, quitar, mutear, mover el tempo, encender los clicks, arrancar y
      frenar el transporte, y `↺`. Tiene que sonar **igual que antes** — es la contraparte de **AC5** y
      **AC13**, y no hay forma automática de hacerla sin el jsdom que el spec no agrega
- [ ] T033 [M] Navegador: **la mitad de AC5 que el resto no cubre** — con el transporte corriendo,
      colocar una pieza y confirmar que entra recién al cerrar el ciclo (D5 del 009), y que `↺` frena
      en el acto. Son los dos comportamientos que dependen de que los efectos mudados sigan haciendo lo
      que hacían

## PR

- [x] T034 Rama `feature/022-el-puente-con-el-motor-sale-del-shell`
- [ ] T035 Actualizar la fila del 022 en `specs/log.md` a `Implementado`
      — **queda abierta a proposito**: en este repo el estado del spec en `log.md` lo mueve
      el **merge**, no la rama (`.claude/skills/spec-implement/SKILL.md`), asi que la fila
      se toca al mergear y no acá
- [x] T036 Anotar en `specs/revisiones.md` qué se aprendió. Candidato: que el ítem de deuda más viejo
      del repo pedía infra («agregar testing-library») y se cerró con una firma —el motor por
      parámetro—, sin infra ninguna

## Seguimiento (no bloquea)

- [ ] T037 `globals: true` en Vitest queda **disponible y sin ejercer** desde que se va `@types/jest`.
      Ejercerlo es sacarle el import a 16 archivos de test, y no compra nada que este spec necesite
- [ ] T038 `App.tsx` queda en **312** líneas —no ≈250: la diferencia son los comentarios nuevos que
      documentan por qué la llamada al hook va donde va y por qué cada callback se memoiza como se
      memoiza— y deja de ser el archivo de producción más largo del repo: pasa a serlo
      `domain/sequence.ts`, que este mismo spec dejó en **422** al mudarle siete líneas de crónica. Lo que queda en el shell es estado, derivados,
      handlers y composición — que es exactamente lo que `.claude/rules/ui.md` dice que tiene que ser,
      y por primera vez sin la lista de efectos al lado

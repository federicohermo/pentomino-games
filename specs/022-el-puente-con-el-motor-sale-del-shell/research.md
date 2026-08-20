# Research — Spec 022

Todo lo de acá está **medido sobre `main`** (commit `8d25591`), no supuesto.

## 1. El tamaño del shell, y de qué está hecho

`src/App.tsx` — **455 líneas**. Es el archivo de producción más largo del repo; el segundo es
`domain/sequence.ts` con 429 y el tercero `audio/engine.ts` con 373.

| Región | Líneas | Qué es |
|---|---|---|
| `:1-26` | 26 | imports |
| `:28-44` | 17 | docblock del módulo |
| `:46-96` | 51 | nueve `useState` + dos `useRef`, con sus comentarios |
| `:98-99` | **2** | los dos efectos de reconciliación cortos (`setBpm`, `setClicksAudible`) |
| `:101-128` | 28 | los tres derivados (`useMemo`) |
| `:130-180` | 51 | `handleCellClick` y `resetBoard` |
| `:182-258` | **77** | el efecto de reconciliación de la secuencia y el de desmontaje |
| `:260-284` | 25 | `togglePlay` |
| `:286-372` | 87 | los dos efectos de entrada del 013 (teclado y rueda) |
| `:374-395` | 22 | `handleContextMenu` y los derivados del fantasma |
| `:396-455` | 60 | el JSX |

Los cuatro efectos de reconciliación son **79 líneas** (`:98-99` más `:182-258`) y los dos de entrada
otras **87** (`:286-372`): **166 en total**, o sea el **36 % del archivo**. `App.tsx` queda en
**≈250**, y deja de ser el archivo de producción más largo del repo —pasa a serlo `domain/sequence.ts`
con 429—.

Lo que sale no es código sino sobre todo argumento: de las 79 primeras, **59 son comentario** —el 75 %,
contra el 60 % del promedio de `src/`— y los dos efectos de entrada tienen la misma proporción. Eso
importa para el plan: la mudanza es casi enteramente **mover docblocks sin re-derivarlos**, y el riesgo
real del spec no es romper el código sino perder el argumento.

## 2. La duplicación, exacta

`App.tsx:218-227` (efecto de reconciliación) y `App.tsx:250-258` (efecto de desmontaje). Los tres campos
son los mismos y el ternario es carácter por carácter idéntico salvo el nombre de la variable
(`secuencia` contra `s`):

```ts
clicks: X.clicks.map((c) => c.note === undefined ? { offset: c.offset } : { offset: c.offset, note: c.note }),
```

**Oráculo elegido**: `grep -rn "{ offset: c.offset, note: c.note }" src/` → **2** hoy, **1** después.
Se descartó como oráculo la condición sola (`note === undefined`), que da **8** líneas en `src/` y
sólo dos son ésta: `engine.ts:214` la usa para contar clicks mudos en `sequenceInfo`,
`scheduler.ts:155` para decidir si hay altura que convertir a Hz, y cuatro son de tests
(`scheduler.test.ts:132`, `route-source.test.ts:161` y `:196`, `sequence.test.ts:967`). Un oráculo que
cuenta esas seis no falsa nada.

**Qué cae en la proyección**, y por qué el test tiene que verificarlo: `pieceId` de cada `Step` y `cell`
de cada `Click`. No es prolijidad — `Cell` vive en `domain/` y el override de eslint sobre `audio/**`
prohíbe importarlo **incluso como `import type`**, así que si la proyección dejara pasar `cell` el
tipo del motor tendría que nombrar algo que su capa no puede ver. Es la mitad de D7/D8 del 009 que hoy
no tiene test.

## 3. El tercer estado de `note`

`audio/types/scheduler.types.ts` declara `Click` con `note?: number`, y su docblock dice que la
**ausencia** de la clave es lo que significa «celda vacía». La forma corta `({ offset, note })` deja la
clave presente en `undefined`.

Medido en el consumidor: `scheduler.ts:155` compara `click.note === undefined`, así que **hoy los dos
casos se comportan igual** y el bug sería invisible. La diferencia se ve en `Object.keys()` y en
cualquier serialización — y en el día en que alguien cambie esa comparación por un `'note' in click`.

Es, en concreto, un invariante que el repo declara en un docblock, protege con un ternario escrito dos
veces, y **no verifica en ningún test**. La pura lo vuelve verificable en tres líneas.

## 4. AC10 del spec 008, y por qué sigue abierto

El handler, `App.tsx:265-284`:

```ts
const togglePlay = useCallback(()=>{
  if (playing) stopClock(); else startClock();
  setPlaying(clockRunning());   // ← el motor es quien sabe si arrancó
}, [playing]);
```

`startClock()` es un **no-op silencioso** cuando `audio()` devuelve `null` (`engine.ts:37-56` devuelve
`null` si el `new AudioContext()` tira). `.claude/rules/audio.md:24` obliga a que «todo llamador tiene
que chequearlo». O sea: la línea de `setPlaying` es la que evita que el botón diga «Pausa» con el reloj
parado, y hoy está verificada **sólo por lectura**.

`deuda.md` lo tiene registrado desde el 008 con las dos salidas nombradas: «testearlo pide extraer el
handler de `App.tsx` **o** agregar testing-library». Este spec toma la primera. La segunda cuesta,
medido en el propio registro de deuda: `jsdom` «en su propio bloque de config, sin tocar el
`environment: 'node'` global que necesita el audio».

Con el motor por parámetro, el test de la rama que importa es una línea de fake:

```ts
const motorMudo = { arrancar: () => {}, frenar: () => {}, corriendo: () => false };
expect(alternarTransporte(false, motorMudo)).toBe(false);   // se pidió arrancar y no arrancó
```

## 5. Las siete dependencias huérfanas

Verificado con `grep -rl` sobre `src/`, `mcp-server/`, `vite.config.ts` y los configs de la raíz:

| Dependencia | Consumidores | Registrada en `deuda.md` |
|---|---|---|
| `@testing-library/react` | **0** | sí |
| `@testing-library/dom` | **0** | sí |
| `@testing-library/jest-dom` | **0** | sí |
| `@testing-library/user-event` | **0** | sí |
| `@types/jest` | **0** imports; nombrada en un comentario de `vite.config.ts` | sí |
| `postcss` | **0** | sí |
| `autoprefixer` | **0** | sí |

Contrastado además contra la estructura: no existe ningún `.test.tsx` en el repo, ni
`postcss.config.js`, ni `tailwind.config.js` — Tailwind 4 entra por `@tailwindcss/vite`, que sí está
en `vite.config.ts:8`.

`@types/jest` no es sólo peso: `vite.config.ts:14-16` documenta que es **por él** que los tests no
pueden usar `globals: true`, porque declara las mismas globales con firmas distintas. Borrarlo
desbloquea esa opción — que este spec **no** ejerce, porque cambiar 16 archivos de test para sacarles
un import no es parte de esta unidad de trabajo.

## 6. Los cuatro lugares que afirman «los seis efectos»

Medido con `grep -rn "seis efectos" --include=*.md`:

| Archivo | Línea | Qué dice |
|---|---|---|
| `CLAUDE.md` | 74 | «el shell: estado, derivados, handlers, los seis efectos y la composición» |
| `.claude/rules/ui.md` | 9 | idéntico, y **se carga solo al tocar `App.tsx`** |
| `docs/architecture/overview.md` | 23 | dentro del diagrama ASCII |
| `docs/architecture/overview.md` | 68 | en la prosa |

Hay un quinto lugar que no dice «seis» pero los **enumera**, y es el que este spec vuelve más útil en
vez de menos: `overview.md:71-73` ya los parte en «cuatro de reconciliación —tempo, clicks, la secuencia
contra el tablero, y la limpieza al desmontar— y los **dos de entrada** que agregó el spec 013». Ese
párrafo pasa a describir dos archivos en vez de una lista, que es exactamente el corte de este spec.

**Colisión con el 021, medida y acotada**: sus `T059`, `T060` y `T049` actualizan esos mismos cuatro
lugares de «seis» a **«siete»**, por el `useLayoutEffect` que agrega. Con el 022 puesto, el número base
ya no es seis, así que las tres tareas tienen que recontar sobre lo que quede. Son tres líneas de texto
en un spec con 44 tareas pendientes y cero hechas.

## 7. Qué cuesta mudar el teclado y la rueda, y qué compra

Medido sobre los `tasks.md` de los specs pendientes:

| Spec | Tareas que escriben esos dos efectos |
|---|---|
| 018 | `T013` (el objeto `evento` suma tres modificadores), `T014` (la rama `ACCION.seleccionar`, **citando `App.tsx:311`**), `T015` (verificar que las dependencias no cambian) |
| 020 | `T009` (el efecto de teclado escribe una sola ranura), `T010` (el efecto de la rueda suma `selected` a las dependencias), `T011` (reescribir el comentario del efecto de la rueda), `T033`, `T040` |

**Siete** tareas escriben los dos efectos, ninguna hecha (`spec_status`: 018 va 0/31, 020 va 0/43).
La octava de la tabla —`T033` del 020— escribe `App.tsx` en la misma región pero **no** es uno de los
dos efectos: es `handleContextMenu`, y su propio texto lo dice («el único consumidor que no pasa por un
efecto ni por un `useMemo`»). Cuenta para el riesgo de conflicto de merge, no para el argumento.

Ese es el costo, y es real: **siete tareas cambian de archivo de destino**. Lo que lo paga es que la
alternativa —dejarlos quietos— no evita ni la mitad de lo que parecía evitar:

1. **La cita por número muere igual.** `T014` del 018 dice `App.tsx:311`, y este spec borra 79 líneas
   *por encima* de esa línea aunque no toque el efecto. La referencia se rompe con los cuatro efectos
   de reconciliación solos.
2. **La forma que el 020 les da es la que los hooks reciben.** El 020 hace que `setRotation` y
   `setMirror` escriban una ranura de un `Record`. Con la firma de **callbacks** (§12), ese cambio cae
   en `App.tsx` y no en el hook: el 020 pasa de reescribir cinco tareas sobre el cuerpo del efecto a
   reescribir tres callbacks. O sea que extraer ahora no le fija una firma que va a cambiar — le saca
   el efecto de encima.
3. **Hay una arista que hoy nadie declara**, y mudarla es lo que la hace explícita: `tapLimpio` (§12).

Los cuatro de reconciliación no tienen ninguno de estos problemas: **ninguna** tarea pendiente de
018–021 los toca. El 021 agrega efectos a `App.tsx` (`T006`, `T043`) pero son de layout, con otro
target y otras dependencias.

## 8. Qué cuesta partir `PiecePalette`

Recibe **16 props** (8 de estado, 8 callbacks). Los tres specs pendientes la reescriben, y son
**veinte tareas** las que la nombran por archivo — contadas sobre los `tasks.md` de `main`:

| Spec | Tareas | Qué le hacen |
|---|---|---|
| 019 | `T001`, `T002`, `T003`, `T005`, `T007`, `T011`, `T020`, `T031`, `T035`, `T039` | borra los cuatro botones de grados y la fila de reflexión, saca dos props, muda el botón de recorrido |
| 020 | `T002`, `T008`, `T013`, `T014`, `T015`, `T016`, `T017`, `T038` | `miniCells` y `aria-label` por pieza, el botón `0°`, una prop nueva |
| 021 | `T017`, `T046` | de tarjeta a dock `fixed` con scroll interno propio |

Cuatro de esas veinte no estaban en la lista de la primera versión de este spec y son de las que más
fácil se escapan, porque nombran el archivo **de refilón** y no como objeto de la tarea: `019` `T031`
(el `aria-label` de los doce botones, citando `PiecePalette.tsx:115`), `019` `T039` (cita
`PiecePalette.tsx:285-287` para comparar el metrónomo con `↺`), `020` `T002` (usa el `.map` de los doce
botones como **testigo por símbolo**, y el símbolo se muda de archivo) y `020` `T016` (el botón `0°`).

Ese es el costo. Lo que lo acota es que el corte **no es el que los tres mueven**: 019 y 020 trabajan
enteros del lado de la orientación —los botones de grados, la reflexión, las miniaturas, el `0°`— y el
021 trabaja sobre la **tarjeta**, que es justamente lo que se queda en `PiecePalette.tsx`. O sea que
los tres siguen tocando un archivo cada uno; lo que cambia es cuál.

Y con **cero cambio visual** (AC18), el 021 no re-mide nada: sus dos tareas son sobre el contenedor,
que conserva las mismas clases.

**Lo que sí hay que aceptar**: las dieciséis tareas hay que leerlas una por una para decidir a qué
panel caen. No es un reemplazo de texto, y por eso es una tarea propia (`T056`) y no una línea de
`sed`.

## 9. Los dos objetos de props, y por qué el régimen va con la orientación

```
orientacion: { selected, rotation, mirror, regimen, noteSet, onSelect, onRotate, onMirror, onRegimen }
transporte:  { tempo, playing, clicks, onTempo, onTogglePlay, onToggleClicks, onReset }
```

`regimen` es global como el tempo, así que a primera vista va con el transporte. Va con la orientación
porque **gobierna qué hace la rotación** (spec 017): con `escala` la rotación cambia la fórmula de
escala y con `orden` cambia por dónde arranca el arpegio, así que sin el régimen la orientación no dice
qué suena. `noteSet` va del mismo lado por lo mismo — es el arpegio de la pieza en la mano *en esa*
orientación, y su `useMemo` en `App.tsx:124` ya depende de los cuatro (`selected`, `rotation`, `mirror`,
`regimen`).

`onReset` va con el transporte y no con la orientación porque `resetBoard` **frena el reloj** además de
vaciar el tablero (`App.tsx:177`), que es la mitad que su propio comentario declara «no cosmética».

## 10. El DOM de `PiecePalette`, y por qué AC18 no es gratis

Medido sobre `src/components/PiecePalette.tsx` (303 líneas). La tarjeta es un solo `<div>` (`:48`) con
**dos hijos**: la grilla de las doce miniaturas (`:83-169`) y un `<div className="mt-4 space-y-2">`
(`:170-300`). Adentro de ese segundo, los hijos directos en orden son:

| Región | Líneas | A qué panel cae |
|---|---|---|
| Rotación (dos líneas: grados + régimen) | `:182-200` | orientación |
| Reflexión | `:201-204` | orientación |
| **Recorrido en el vacío** (los clicks) | `:232-235` | **transporte** |
| Línea de tónica + `Notas actuales` | `:236-255` | orientación |
| `border-t`: Tempo, play/pausa, Reset | `:256-299` | transporte |

**Los dos panes se interleavan.** La fila de clicks cae entre dos bloques de orientación, así que
partir por rol semántico **reordena el DOM** — que es exactamente lo que AC18 prohíbe. Y hay una
segunda trampa en la misma región: `space-y-2` compila a `& > :not([hidden]) ~ :not([hidden])`, un
selector de **hijo directo**. Un `PanelDeOrientacion` que devuelva sus dos filas dentro de un `<div>`
propio convierte dos hijos en uno y **se come un margen**, con las clases intactas y sin que ningún
test lo note.

De ahí salen las dos restricciones que AC18 fija, y que son las que hacen la partición posible sin
tocar un píxel:

1. **Los paneles devuelven fragmentos** (`<>…</>`), no envoltorios.
2. **La fila de clicks se queda en `PiecePalette.tsx`**, renderizada por el contenedor desde
   `transporte.clicks` y `transporte.onToggleClicks`. `PanelDeTransporte` queda siendo el bloque
   `border-t` de `:256-299`, que es el único subárbol contiguo de los dos.

Eso mantiene AC17 literal —el contenedor recibe **dos** objetos y cada panel recibe sólo el suyo— sin
mover un nodo. La alternativa —agrupar `clicks` con la orientación— haría los dos panes contiguos pero
rompe el criterio de agrupación de §9, y encima el **019** vuelve contigua la versión de acá cuando
muda ese botón a la fila de transporte (`019` `T011`): en un spec el problema desaparece solo.

Nota para el pase de comentarios (paso 8): el comentario de `:41-46` explica el `md:col-span-4` de la
**tarjeta** y el de `:50-82` el reparto de columnas de la **grilla**, y el segundo se apoya en el
primero (la tabla de `viewport → interior → columnas`). Se separan en dos archivos, así que el de la
grilla tiene que llevarse el dato del interior o queda sin premisa.

## 11. Dónde viven los archivos nuevos, y qué dice el linter

`src/components/` no tiene override de imports en `eslint.config.js`: sólo le aplica el bloque general
de `src/**`, que prohíbe alcanzar `mcp-server/`. O sea que `motor.ts` puede importar los dos tipos
`Sequence` —el de `domain/types/sequence.types.ts` y el de `audio/types/scheduler.types.ts`— que es
justamente lo que una proyección necesita y lo que ninguna de las dos capas podría hacer. Es la razón
por la que el archivo va en `components/` y no en `domain/` ni en `audio/`.

Los dos nombres chocan, así que uno viaja con alias. Precedente en el repo: no hay; es la primera vez
que un módulo importa los dos. El alias va del lado del motor (`SequenceDelMotor`), que es el tipo
menos usado de los dos en `components/`.

`use-motor.ts` es `.ts` y no `.tsx`, así que `react-refresh/only-export-components` no lo mira — es la
misma razón por la que `input.ts` y `route-source.ts` pueden exportar lo que quieran.

**Convención de nombre de archivo**: `components/` usa kebab-case para los módulos que no son
componentes (`cell-text.ts`, `piece-mini.ts`, `route-source.ts`, `input.ts`) y PascalCase para los
cinco `.tsx`. `motor.ts`, `use-motor.ts` y `types/motor.types.ts` siguen esa convención.

## 12. `tapLimpio`: la arista que no declara nadie

Medido en `App.tsx`:

| Línea | Quién | Qué hace |
|---|---|---|
| `:96` | el shell | `const tapLimpio = useRef<boolean>(false)` |
| `:296` | efecto de **teclado** | lo **lee** para armar el objeto `evento` |
| `:318` | efecto de **teclado** | lo **escribe** con `abreTapLimpio(e)` en cada `keydown` |
| `:350` | efecto de **rueda** | lo **escribe** a `false` |

O sea que los dos efectos comparten estado mutable por **cierre léxico**, y nada lo declara: no hay un
tipo que lo diga, no hay un test que lo cubra, y lo único que lo explica es el comentario de `:344-349`
—seis líneas— que además explica que la escritura de la rueda tiene que ir **antes** de las dos
guardas del handler, porque con la línea después del `return` por `ctrlKey` el `keyup` del `Ctrl`
encuentra el tap limpio y refleja la pieza al soltar.

Es el punto más frágil de la mudanza y por eso tiene AC propio (**AC15**) y verificación en el
navegador: `Ctrl`+rueda hace zoom y al soltar **no** refleja. Un implementador que mueva el ref adentro
del hook del teclado —que es lo que parece natural, porque ahí se lee dos veces contra una— rompe el
gesto sin que falle un solo test.

La contrapartida es que mudarlo lo **mejora**: pasa de ser adyacencia a ser un parámetro con nombre en
las dos firmas.

## 13. Riesgos

| Riesgo | Mitigación |
|---|---|
| Mover el efecto de desmontaje rompe la garantía de limpieza sincrónica bajo StrictMode | El efecto se muda **entero y sin editar**, con su docblock. AC5 lo declara y el paso 2 del plan lo verifica leyendo, que es como está verificado hoy |
| El hook cambia el orden de los efectos y con él el orden de las llamadas al motor | Los cuatro se declaran dentro del hook en el **mismo orden** en que están hoy, y el hook se llama en `App.tsx` **antes** de los dos de entrada, que es donde estaban |
| `encolar(secuencia, placed)` y `setSequence(...)` tienen que seguir viendo la **misma instancia** de `secuencia` | El hook recibe `secuencia` ya derivada por props del `useMemo` de `App.tsx`: no la vuelve a derivar. Es explícito en el plan y es lo que D5 del 009 existe para garantizar |
| Borrar `@types/jest` rompe el typecheck de algún test | `pnpm verify` en el mismo commit. Los tests importan `describe`/`it`/`expect` de `'vitest'` explícitamente (`vite.config.ts` no usa `globals`), así que no dependen de las globales de nadie |
| Un implementador muda `tapLimpio` adentro del hook del teclado y rompe `Ctrl`+rueda | AC15, `T043`, `T044` y la verificación en navegador. Es el único riesgo del spec que **ningún test automático puede atrapar**, y por eso está escrito tres veces |
| El JSX de la paleta se «mejora» al mudarlo y cambia el DOM | AC18 dice cero cambio visual, y `T050`/`T051` dicen «se mueve, no se reescribe». El 019, el 020 y el 021 midieron sobre ese DOM |
| El pase de comentarios borra un argumento vigente | Es de conservación y no de poda (AC19): nada se borra, se mueve a `revisiones.md`. Commit propio (AC20), tres casos testigo primero (`T057`), y ante la duda se queda |
| El 021 queda con tres tareas que cuentan mal los efectos | Tarea explícita en este spec (`T018`), con precedente: el 015 tocó el `T070` del 011 y el 021 toca el `T033` del 016 |

## 14. Lo que la mudanza vuelve falso **adentro de `src/`**

El barrido de §6 fue `--include=*.md`, así que no vio los comentarios del código. Medido con
`grep -rn "App\.tsx" src/`, cinco afirman en presente algo que este spec da vuelta:

| Archivo | Qué dice hoy | Por qué deja de ser cierto |
|---|---|---|
| `audio/types/scheduler.types.ts:35-36` | «`App.tsx` es el **único puente** entre las dos capas y entrega la secuencia dejando caer esos campos» | El puente pasa a ser `components/motor.ts`. Es además el docblock en el que se apoyan AC3 y D7/D8 |
| `components/route-source.ts:22` | «mismo cruce que `App.tsx` ya hace al proyectar la secuencia para `setSequence`» | Quien proyecta pasa a ser `proyectarAlMotor` |
| `domain/types/board.types.ts:35` | «el ternario puesto a propósito en la proyección de `App.tsx`» | El ternario se muda a `motor.ts` — y con este spec **pasa a tener test**, que es lo que ese comentario lamentaba |
| `domain/__tests__/sequence.test.ts:990` | «lo que la proyección de `App.tsx` cuida con un ternario» | Idem |
| `audio/engine.ts:177-181` | «el `useState` de `App.tsx`, que lo pisa en el **efecto de montaje**» | El `useState` del tempo se queda; el efecto que lo baja al motor se muda al hook |

**Tres de los cinco viven en `domain/` y `audio/`**, que los Límites de Alcance declaran intocados. La
contradicción es sólo aparente en cuanto a riesgo —son comentarios: no cambian ninguna firma, así que
el borde con `mcp-server/` sigue sin cruzarse— pero **sí** amplia la lista de archivos afectados, y eso
lo decide una persona. Las dos salidas, y ninguna es «no hacer nada»:

- **Actualizarlos acá**, con una tarea `[P]` por archivo en el Paso 4 y los Límites reescritos a «no
  toca **código** de `domain/` ni de `audio/`». Es el camino con precedente: `d936597` y `eb154a0`
  arreglaron exactamente esta clase de rot en once y cinco archivos.
- ~~Diferirlos a `deuda.md`~~. **Descartada**: el spec se amplió a los seis frentes y no difiere nada.

**Resuelto por la primera vía**: los cinco son `AC21` y `T061`, y los Límites de Alcance pasaron a decir
«no toca **código** de `domain/` ni de `audio/`». Un comentario no mueve una firma, así que `AC13` y el
borde con `mcp-server/` se sostienen igual — y `T031` lo verifica con `git diff --stat`.

Lo que **no** es una salida es dejarlos sin registrar: el comentario de `scheduler.types.ts` es el que
explica por qué la proyección existe, y apuntaría a un archivo que ya no la hace.

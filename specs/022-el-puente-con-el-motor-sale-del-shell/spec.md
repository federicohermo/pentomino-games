# Spec 022 — El shell se queda con la composición

> Sin ticket: este repo no tiene tablero de Jira. Ver `specs/README.md`.
>
> **No cambia una nota, ni un tiempo, ni un timbre, ni un píxel.** `App.tsx` pierde **los seis
> efectos** y baja de 455 líneas a ≈250; `PiecePalette` pasa de dieciséis props a **dos**; se borra la
> única duplicación real que queda en `src/`; y los comentarios que cuentan *cómo se llegó* se mudan a
> `revisiones.md`, que es donde el repo ya declara que viven. Cierra los **tres** ítems de dependencias
> huérfanas de `deuda.md` —las `@testing-library/*`, `postcss` + `autoprefixer` y `@types/jest`— más la
> parte de AC10 del 008, que no es un ítem propio sino un párrafo adentro del de «No hay tests de UI» y
> sale solo. **Sin agregar jsdom.**
>
> **Va antes del lote 018–021**, y por el mismo argumento con el que el 005 fue antes del 001, 003 y
> 004: es el único que reordena sin cambiar comportamiento, y los cuatro que vienen escriben `App.tsx`
> y `PiecePalette.tsx`. **El precio está medido y es real**: **treinta y una** tareas de esos cuatro
> specs cambian de destino, y este spec las reescribe una por una. La primera versión difería tres de
> sus seis frentes para no pagarlo; se amplió a los seis por decisión explícita, con el costo medido
> y aceptado.

## Problema

Son tres cosas distintas que salen del mismo lugar, y el lugar es que **el shell no tiene dónde
mudarse**. `.claude/rules/ui.md:9` lo dice en presente: «`App.tsx` es el shell: estado con `useState`
local, derivados, handlers, los seis efectos y la composición. **Ninguna función pura y ningún literal
de dominio** — eso vive en `domain/`, que es lo único que puede testearse».

Esa última cláusula ya es falsa —`components/input.ts`, `cell-text.ts`, `piece-mini.ts` y
`route-source.ts` son cuatro módulos de `components/` con tests— pero la regla que sostenía sigue
teniendo el efecto que tenía: lo que no es dominio se queda en el `.tsx`, donde no se puede exportar y
por lo tanto no se puede testear. Es exactamente el mecanismo que `docs/architecture/overview.md:64-66`
describe como el motivo por el que nació `domain/`.

### 1. La proyección de `Sequence` al motor está escrita dos veces

`App.tsx:218-227` y `App.tsx:250-258`. El bloque es idéntico —los tres campos, incluido el ternario que
distingue el click mudo por **ausencia** de la clave `note`— y los dos llevan un comentario que ya
admite el problema: «Misma proyección que el efecto de arriba, y por el mismo motivo […] escribirla
distinto invitaría a divergir la próxima vez que se toque una».

El comentario está haciendo el trabajo que le corresponde a una función. Y el repo tiene el criterio
escrito para este caso exacto: la dirección de dependencia dejó de ser convención y pasó a ser regla de
lint porque «un import prohibido falla `pnpm lint`» en vez de fallar en una revisión. Acá es lo mismo a
otra escala: con una pura, «no divergir» deja de ser una promesa y pasa a ser imposible de escribir.

Los tres estados que el ternario protege no son teóricos. El docblock de `Click` (`audio/types/
scheduler.types.ts`) declara que la **ausencia** de `note` es lo que dice «celda vacía»; la forma corta
`({ offset, note })` deja la clave presente en `undefined`, que es un tercer estado que el tipo existe
para no tener. Hoy nadie lo notaría —`collectHits` compara `=== undefined`—, o sea que es una
duplicación que además protege un invariante que ningún test verifica.

### 2. AC10 del spec 008 es deuda registrada desde hace catorce specs, y el motivo es de organización

`deuda.md` lo dice con nombre y apellido:

> **El primer caso a cubrir cuando exista la infra es AC10 del spec 008**: que el botón de transporte
> refleje si el reloj *arrancó de verdad* (`setPlaying(clockRunning())`) y no si se lo apretó. […]
> testearlo pide **extraer el handler de `App.tsx`** o agregar testing-library.

Son dos vías y el registro las nombra a las dos. La segunda arrastra `jsdom` en su propio bloque de
config, sin tocar el `environment: 'node'` global que necesita el audio. La primera es tres líneas.

Y no es un caso de borde: `.claude/rules/audio.md` obliga a **todo llamador** a chequear que el motor
arrancó, porque `startClock()` es un no-op silencioso cuando `audio()` devuelve `null`. O sea que es una
regla del repo verificada hoy sólo por lectura, sobre el único botón que miente si se rompe.

### 3. Siete `devDependencies` sin un solo consumidor

`deuda.md` ya las registra **todas**, agrupadas en tres ítems —las `@testing-library/*`, el par
`postcss` + `autoprefixer` («candidatos a borrar») y `@types/jest` («es lo que impide usar
`globals: true` en Vitest»)—: no queda **ninguna** dependencia huérfana sin registrar, y por eso el
paso 3 borra código y registro de una sola vez. Verificado: **ningún archivo de `src/` ni de `mcp-server/` las importa**, no existe un solo
`.test.tsx`, y no hay `postcss.config.js` ni `tailwind.config.js` porque Tailwind 4 entra por
`@tailwindcss/vite`. El único lugar del repo que las nombra es un comentario de `vite.config.ts`
explicando cómo esquivar a `@types/jest`.

Esto no es una molestia estética. `node_modules` es **estricto** en este repo justamente para que un
import que no está declarado falle; el simétrico —una declaración que nadie importa— es la misma clase
de ruido, y acá cuesta un conflicto de tipos globales que ya está documentado en `vite.config.ts`.

### 4. Los otros dos efectos, y un ref que los ata sin que nada lo diga

Los de entrada del 013: el del teclado sobre `window` (`App.tsx:286-338`) y el de la rueda sobre el
nodo del tablero (`:340-372`). Son **87 líneas**, y tienen el mismo problema que los otros cuatro
—están en el `.tsx`, o sea que no se pueden montar sin DOM— más uno propio: **comparten un `useRef`**.

`tapLimpio` (`:96`) lo **lee** el despacho del teclado (`:296`), lo **escribe** el mismo efecto del
teclado en cada `keydown` (`:318`, con `abreTapLimpio`) y lo **escribe** también el handler de la rueda
(`:350`). O sea que **los dos efectos escriben** y uno de los dos lee: no es un productor y un
consumidor, es estado mutable compartido en las dos direcciones — lo que hace la mudanza más delicada,
no menos. Esa arista no la declara ningún tipo ni la verifica nada: la sostiene un comentario de seis
líneas en `:344-349`, que explica que la rueda tiene que ensuciar el tap **antes** de las dos guardas,
porque si no `Ctrl`+rueda hace zoom y además refleja la pieza al soltar el `Ctrl` —el gesto que D10 del
013 nombra por su nombre—.

O sea: la corrección de ese gesto depende hoy de que los dos efectos vivan en el mismo cuerpo de
función y compartan un ref por cierre léxico. **Es una dependencia real sostenida por adyacencia**, que
es la clase de acoplamiento que un refactor descuidado rompe justamente porque nada la nombra.

### 5. `PiecePalette` recibe dieciséis props planas

Ocho de estado (`selected`, `rotation`, `mirror`, `tempo`, `playing`, `clicks`, `regimen`, `noteSet`) y
ocho callbacks. La firma no dice qué agrupa con qué, y adentro son **dos paneles distintos**: la
orientación de la pieza en la mano y el transporte del instrumento. El componente cumple la regla del
repo —presentacional, sin estado ni efectos—, pero dieciséis argumentos sueltos es el punto donde una
firma deja de documentar y pasa a enumerar.

### 6. El 60 % de `src/` es comentario, y parte de eso es historia

Medido: **3.354 de 5.618 líneas** de `src/` sin tests. Nueve archivos pasan el 75 %; el pico es
`voice.constants.ts` con 89 %.

La regla del repo —«los comentarios explican el porqué»— es correcta, y es la razón de que este código
se entienda tan rápido. Lo que le falta es el **eje del tiempo**. Tres ejemplos, todos verdaderos y
ninguno vigente:

- `App.tsx:53-66` — doce líneas sobre que el default de `clicks` pasó de `true` a `false`, con el
  porcentaje medido del 009 y el «el `T070` del 011 propuso borrarlo y quedó cerrado con un no».
- `sequence.ts:359-380` — «El plan del spec 009 decía que el ciclo era… Se cambió DESPUÉS DE
  ESCUCHARLO… El spec 011 le sacó el síntoma y no el motivo».
- `PiecePalette.tsx:50-59` — «el esquema de columnas se REMIDIÓ entero… la cuenta anterior estaba
  hecha sobre la letra más el punto de color».

Eso ya tiene dónde vivir: `specs/revisiones.md` existe, textualmente, para «el porqué de cada
decisión». El costo de tenerlo en el código es que el lector tiene que separar, párrafo por párrafo,
la restricción que sigue viva de la crónica de cómo se llegó — y la segunda se pudre sola: cada spec
nuevo deja una capa más de «antes esto decía otra cosa».

## Solución Propuesta

**Los seis efectos y las decisiones que los acompañan se mudan a `components/`. `App.tsx` se queda con
estado, derivados, handlers y la composición — y con cero `useEffect`.**

El corte de los efectos no es nuevo: es el que la documentación ya dibuja.
`docs/architecture/overview.md:71-73` dice que los seis son «cuatro de reconciliación —tempo, clicks,
la secuencia contra el tablero, y la limpieza al desmontar— y los **dos de entrada** que agregó el spec
013». Ese párrafo pasa de describir una lista a describir **dos archivos**.

### Los archivos nuevos

| Archivo | Qué tiene | React |
|---|---|---|
| `src/components/motor.ts` | `proyectarAlMotor` y `alternarTransporte`, las dos **puras** | no |
| `src/components/types/motor.types.ts` | `MotorDeTransporte` — las tres funciones que `alternarTransporte` recibe | no |
| `src/components/use-motor.ts` | `useMotorSincronizado`, con los **cuatro** de reconciliación | sí |
| `src/components/use-entrada.ts` | `useAtajosDeTeclado` y `useRuedaRota`, los **dos** de entrada | sí |
| `src/components/PanelDeOrientacion.tsx` | las doce miniaturas, el régimen y el lector de la pieza en la mano | sí |
| `src/components/PanelDeTransporte.tsx` | tempo, play/pausa, clicks y reset | sí |
| `src/components/types/panel.types.ts` | los dos objetos de props | no |

La separación entre `motor.ts` y `use-motor.ts` es la que hace que los tests no necesiten DOM:
`motor.ts` no importa React ni el motor, así que `motor.test.ts` corre en `environment: 'node'` como
los otros cinco tests de `components/`. Los hooks quedan como cableado sin decisiones, que es la misma
división que el 013 hizo entre `input.ts` y `App.tsx` — y por eso `use-entrada.ts` **no** se lleva
`accionDeTecla` ni `rotacionPorRueda`, que se quedan donde están.

### Los hooks de entrada reciben **callbacks**, no setters

```ts
useAtajosDeTeclado(
  acciones: { rotar: () => void; reflejar: () => void; transporte: () => void },
  tapLimpio: RefObject<boolean>,
): void

useRuedaRota(
  nodo: RefObject<HTMLDivElement | null>,
  alRotar: (deltaY: number) => void,
  tapLimpio: RefObject<boolean>,
): void
```

No es preferencia de estilo, y es la decisión que **da vuelta el costo de este spec**. El 020 convierte
`rotation` y `mirror` en una ranura de un `Record<PieceKey, Orientacion>`; con setters en la firma ese
cambio entra **adentro** del hook, y el 020 vuelve a escribir código que este spec acaba de mover. Con
callbacks entra en `App.tsx` y el hook no se entera: el 020 pasa de reescribir cinco tareas sobre el
efecto a reescribir tres callbacks. La colisión se paga una vez acá y deja de existir para él.

Lo que hay que preservar al hacerlo es la **cardinalidad de suscripción**, que hoy es distinta en cada
uno y está argumentada en los dos comentarios: el de la rueda se suscribe **una sola vez** porque usa el
setter funcional y no lee ningún valor, y el del teclado se re-suscribe con `[rotation, mirror,
togglePlay]` porque sí los lee. Con callbacks, el primero lo conserva envolviendo `alRotar` en un
`useCallback` de dependencias vacías —posible justamente porque el cuerpo sigue usando el setter
funcional— y el segundo lo conserva solo, porque sus callbacks dependen de `rotation` y `mirror` igual
que hoy.

### `tapLimpio` se queda en `App.tsx` y viaja a los **dos** hooks

Es la parte que rompe el spec si se pasa por alto. El ref lo lee el teclado y lo escribe la rueda (§4
del Problema), así que meterlo adentro del hook del teclado —que es lo que parece natural— deja al de
la rueda sin forma de ensuciarlo, y ahí vuelve el bug que `App.tsx:341-347` documenta: `Ctrl`+rueda
hace zoom **y además refleja la pieza al soltar el `Ctrl`**. Lo que hoy sostiene un cierre léxico pasa
a sostenerlo un parámetro con nombre, que es la mitad buena de la mudanza: la arista deja de ser
adyacencia y pasa a estar escrita en las dos firmas.

### `PiecePalette` se parte en tres archivos y pasa de dieciséis props a dos

```
orientacion: { selected, rotation, mirror, regimen, noteSet, onSelect, onRotate, onMirror, onRegimen }
transporte:  { tempo, playing, clicks, onTempo, onTogglePlay, onToggleClicks, onReset }
```

`PiecePalette.tsx` se queda con la tarjeta y la composición. `regimen` y `noteSet` van con la
orientación aunque el régimen sea global como el tempo: gobierna **qué hace la rotación** (spec 017),
así que sin él la orientación no dice qué suena. `onReset` va con el transporte porque `resetBoard`
frena el reloj además de vaciar el tablero.

**Cero cambio visual**: mismo DOM, mismas clases, mismo orden. Es lo que deja que el 021 lo vuelva un
dock sin re-medir nada de lo que ya midió.

### El pase de comentarios va último, y es de conservación y no de poda

Nada se borra: lo que sale de `src/` **entra a `revisiones.md`**, con fecha y con el spec que lo
originó. El oráculo es de conservación —`revisiones.md` gana lo que `src/` pierde— y no de reducción:
un objetivo porcentual sería un incentivo a borrar el comentario bueno, que es siempre el más largo.
Va último, cuando todo lo demás ya está en verde, para que el pase se haga sobre el código final y no
sobre uno que este mismo spec va a mover.

### `alternarTransporte` recibe el motor por parámetro

```ts
export function alternarTransporte(playing: boolean, motor: MotorDeTransporte): boolean {
  if (playing) motor.frenar(); else motor.arrancar();
  return motor.corriendo();
}
```

Por parámetro y no por import, que es lo contrario de lo que hace `route-source.ts` —importa
`engine.ts` y su test lo mockea con `vi.mock`—. Las dos vías funcionan; ésta se elige porque el valor
que hay que testear es **la discrepancia** entre lo que se pidió y lo que pasó, y con un motor falso
esa discrepancia se escribe en una línea (`corriendo: () => false`) en vez de armarse desde un mock.
Además evita que el archivo de la pura importe el singleton del `AudioContext` para leer un booleano,
que es el mismo motivo que `route-source.test.ts` escribe en su docblock.

## Criterios de Aceptación

- **AC1** — La proyección del `Sequence` del dominio al del motor existe **una sola vez** en el repo.
  Falsable con el ternario entero y no con su condición: `grep -rn "{ offset: c.offset, note: c.note }"
  src/` devuelve **una** línea, contra las **dos** de hoy (`App.tsx:225` y `:255`). La condición sola
  (`note === undefined`) no sirve de oráculo: aparece en otros seis lugares legítimos —`engine.ts:214`,
  `scheduler.ts:155` y cuatro tests— que este spec no toca.
- **AC2** — `proyectarAlMotor` está testeada en los **tres** estados de `note` que el tipo distingue:
  presente con valor MIDI, ausente por celda vacía, y —el que hoy nadie verifica— que el objeto
  proyectado **no tiene la clave** `note` en vez de tenerla en `undefined`.
- **AC3** — La proyección también deja caer `pieceId` de los `Step` y `cell` de los `Click`, y el test
  lo verifica: es lo que sostiene que el motor no puede ver `Cell` (D7/D8 del 009, y el override de
  eslint sobre `audio/**`).
- **AC4** — Los cuatro efectos de reconciliación viven en `use-motor.ts` **con sus docblocks
  intactos** — el de D5 del 009, el de la limpieza sincrónica bajo StrictMode y el de `DEFAULT_REGIMEN`
  en el desmontaje son argumentos que no se re-derivan, se mudan.
- **AC5** — El comportamiento no cambia: mismas llamadas al motor, en el mismo orden, con las mismas
  dependencias. La llamada al hook va **después** del `useMemo` de `secuencia` (`App.tsx:118`) y antes
  de los dos efectos de entrada: es la única ventana donde `secuencia` ya existe, y el orden de
  registro de los seis efectos entre sí no cambia. En particular la limpieza del desmontaje sigue siendo **sincrónica**, y el efecto de
  desmontaje sigue con `[]` y usando `DEFAULT_REGIMEN` y no el `regimen` del estado.
- **AC6** — `alternarTransporte` es pura, recibe el motor por parámetro y está testeada con un motor
  falso en **las dos ramas que importan**: el reloj arrancó (`corriendo: () => true`) y el reloj **no**
  arrancó pese a habérselo pedido (`corriendo: () => false`). La segunda es AC10 del spec 008, y se
  cierra **sin jsdom y sin testing-library**.
- **AC7** — Las siete `devDependencies` huérfanas se van —las cuatro `@testing-library/*`,
  `@types/jest`, `postcss` y `autoprefixer`— **en su propio commit**, que es la regla del repo para los
  borrados. `pnpm verify` queda en verde y `vite.config.ts` pierde el comentario que explicaba cómo
  esquivar a `@types/jest`.
- **AC8** — `specs/deuda.md` pierde los **tres** ítems de dependencias huérfanas, le saca al de «No
  hay tests de UI» el párrafo que nombra AC10 del 008 como «el primer caso a cubrir cuando exista la
  infra» —y **conserva el resto de ese ítem**—, y **no gana ninguno**: con el spec ampliado a los seis
  frentes no queda nada diferido. Lo que sigue abierto y del mismo tamaño es el resto del ítem de «No
  hay tests de UI» y el de `public/manifest.json` (`T025`).
- **AC9** — Ningún archivo del repo afirma «los seis efectos» en presente. Son cuatro lugares medidos:
  `CLAUDE.md:74`, `.claude/rules/ui.md:9`, `docs/architecture/overview.md:23` y `:68` (más el párrafo
  de `:71-73`, que los enumera). El barrido **no es sólo de `.md`**: ver AC21.
- **AC10** — `.claude/rules/ui.md:9-11` deja de decir que `domain/` es «lo único que puede testearse»:
  ya era falso antes de este spec —cuatro módulos de `components/` tienen tests— y este spec agrega el
  quinto.
- **AC11** — `docs/guides/conventions.md` fija la **regla de idioma de los identificadores**: inglés
  para el vocabulario técnico universal, español para el del instrumento. Es descriptiva de lo que el
  repo ya hace, no un mandato nuevo: **no se renombra nada**.
- **AC12** — `docs/guides/conventions.md` fija el **criterio de comentario**: se queda el que describe
  una restricción vigente; el que cuenta cómo se llegó va a `revisiones.md` con un puntero. Entra el
  criterio, **no la poda**.
- **AC13** — No cambia una nota. No se toca **código** de `domain/` ni de `audio/` —sólo comentarios,
  por AC21— y sus tests pasan sin modificarse.
- **AC14** — `App.tsx` **no declara ni un `useEffect`**. Falsable: `grep -c "useEffect" src/App.tsx`
  devuelve **0**, contra los 6 de hoy, y el archivo baja de 455 líneas a ≈250.
- **AC15** — `tapLimpio` sigue viviendo en `App.tsx` y lo reciben **los dos** hooks de entrada.
  Falsable en el navegador y no por lectura: `Ctrl`+rueda sobre el tablero hace el zoom del navegador
  y, al soltar el `Ctrl`, la pieza **no** se refleja. Es el gesto de D10 del 013, y es el que se rompe
  si el ref se muda adentro del hook del teclado.
- **AC16** — La **cardinalidad de suscripción** no cambia, que es lo que los dos comentarios de hoy
  argumentan: el listener de `wheel` se registra **una vez por montaje**, y los dos de teclado se
  re-suscriben cuando cambian `rotation`, `mirror` o el transporte. Falsable contando llamadas a
  `addEventListener` con un contador temporal, o leyendo las dependencias de los dos efectos.
  **El objeto `acciones` no puede entrar crudo a las dependencias del efecto**: un literal
  `{ rotar, reflejar, transporte }` tiene identidad nueva en cada render, así que el hook se
  re-suscribiría por render y no por cambio de `rotation`/`mirror` — que es *peor* que hoy, no igual.
  El hook lista los tres campos por separado en su array de dependencias, o los recibe como tres
  parámetros. Verificado aparte: el handler de la rueda **no lee ningún valor reactivo** —sólo
  `e.ctrlKey`, `e.deltaY`, el ref y el setter funcional—, así que el `useCallback(…, [])` de `alRotar`
  es legítimo y no esconde una dependencia.
- **AC17** — `PiecePalette` recibe **dos** props (`orientacion` y `transporte`) en vez de dieciséis, y
  cada panel recibe **sólo su objeto**. Falsable por la firma.
- **AC18** — **Cero cambio visual.** El DOM que renderiza el panel es el mismo: mismas clases, mismo
  orden, mismos nodos. Es lo que hace que el 019, el 020 y el 021 no tengan que re-medir nada.
  **No es gratis, y está medido en `research.md` §10**: hoy los dos panes **no son dos regiones
  contiguas**. Bajo el `space-y-2` de `PiecePalette.tsx:170` el orden real es Rotación → Reflexión →
  *clicks* → línea de notas → Tempo/transporte, o sea que la fila de clicks queda **entre** dos bloques
  de orientación. Y `space-y-2` es un selector de **hijo directo**, así que cualquier componente que
  envuelva sus filas en un `<div>` propio cambia el ritmo vertical aunque las clases sean idénticas.
  Las dos consecuencias son obligatorias: los paneles devuelven **fragmentos** y no envoltorios, y la
  fila de clicks **se queda en `PiecePalette.tsx`**, que la renderiza leyendo `transporte.clicks` y
  `transporte.onToggleClicks`. `PanelDeTransporte` queda siendo exactamente el bloque `border-t` de
  `:256-299`, que sí es contiguo. La agrupación de props no cambia — la que el spec elige es la que el
  **019** vuelve contigua cuando muda ese botón a la fila de transporte (`019` `T011`).
- **AC19** — El pase de comentarios es de **conservación**: todo lo que sale de `src/` aparece en
  `revisiones.md`, con fecha y con el spec que lo originó. Nada se pierde, y donde había una crónica
  queda un puntero de una línea. **No hay objetivo porcentual**, a propósito.
- **AC20** — El pase de comentarios va **último y en su propio commit**, que es la regla del repo para
  los borrados: revertirlo entero tiene que ser trivial.
- **AC21** — Los **cinco docblocks de `src/` que este spec vuelve falsos** quedan al día. Están
  medidos en `research.md` §14, y el que más importa es `audio/types/scheduler.types.ts:35-36`, que
  afirma que «`App.tsx` es el único puente entre las dos capas» — después de este spec apunta a un
  archivo que ya no proyecta, y es justo el que sostiene AC3 y D7/D8 del 009. Son comentarios: no
  mueven ninguna firma, así que el borde con `mcp-server/` sigue intacto.
- **AC22** — Las tareas de los specs pendientes que este spec deja apuntando al archivo equivocado
  quedan reescritas, con el destino nuevo. **La fuente de verdad son las tablas de `research.md` §7 y
  §8**, tarea por tarea, y no este total: son **treinta y una** —018 (3), 019 (10), 020 (13) y 021 (5)—,
  contando las tres del 021 que recuentan los efectos. Contado sobre los `tasks.md` de `main`, no
  estimado. El total va después de las tablas y no antes justamente porque ya se movió dos veces
  mientras se escribía este spec: es el número que más fácil se desincroniza, y por eso no manda.

## Límites de Alcance

- **No renombra ningún identificador** por AC11. La regla se escribe para el código que viene, y
  aplicarla hacia atrás sería un churn que ningún test atrapa.
- **No mueve las puras de entrada.** `accionDeTecla`, `frenaElDefault`, `rotacionPorRueda`,
  `abreTapLimpio` y `reflejaElContextMenu` se quedan en `components/input.ts`, donde el 013 las puso y
  donde ya están testeadas. Los hooks son cableado; la decisión sigue viviendo aparte, que es
  justamente la división que hace testeable a la mitad que importa.
- **No cambia qué hace ningún gesto.** Los cuatro del 013, el `Alt` del 014 y el `contextmenu` de
  macOS siguen haciendo exactamente lo mismo. `handleContextMenu` **no se muda**: no pasa por ningún
  efecto, así que no es de este spec.
- **No toca el `<footer>` ni el layout.** El 021 los reescribe enteros.
- **No agrega jsdom, ni testing-library, ni un segundo `environment` de Vitest.** Es lo contrario:
  cierra el ítem de deuda que los pedía, por la otra vía que el propio ítem nombra.
- **No toca *código* de `domain/` ni de `audio/`, y no cruza el borde de paquete.** Ninguna firma que
  `mcp-server/` importe cambia, así que las cinco tools siguen compilando sin trabajo de migración. Lo
  único que se toca de esas dos capas son **comentarios** (AC21) y, en el pase final, los que cuenten
  historia (AC19). Un comentario no mueve una firma.
- **No agrega tests de UI.** Los cuatro componentes se siguen verificando a ojo; ese ítem de `deuda.md`
  queda **abierto y del mismo tamaño**.
- **No toca `public/manifest.json`**, que es el ítem de deuda que sí es sólo estético.

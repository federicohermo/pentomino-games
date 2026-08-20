# Plan — Spec 022

Ocho pasos. Los cuatro primeros son el cambio de código; los tres siguientes no tocan `src/`; el
último vuelve a `src/` pero sólo a los comentarios.

**El orden importa en tres lugares y en ninguno más**: el paso 1 va antes del 2, porque el hook
consume la pura; el paso 8 va **último**, porque poda comentarios del código que los pasos 1 a 4
acaban de mover; y el paso 7 va después del 3 y del 4, porque las tareas que reescribe nombran los
archivos que esos dos crean. Los pasos 3, 4, 5 y 6 son independientes entre sí.

---

## Paso 1 — Las dos puras y sus tests

`src/components/types/motor.types.ts` y `src/components/motor.ts`, más
`src/components/__tests__/motor.test.ts`.

### `proyectarAlMotor(s: Sequence): SequenceDelMotor`

Los dos `Sequence` chocan de nombre, así que el del motor entra con alias. El alias va de ese lado y no
del dominio porque en `components/` el del dominio es el único de los dos que ya aparece: lo importa
`route-source.ts:1`, y el del motor no lo importa nadie. Medido, es **1 contra 0 y no 4 contra 0**, así
que la asimetría es chica y la decisión se apoya además en que `SequenceDelMotor` nombra el destino y
no el origen.

La función **proyecta, no traduce** (D7, D8, AC12 del 009): `offset`, `notes` y la `note` MIDI del cruce
viajan tal cual; se caen `pieceId` —el motor no tiene a quién devolvérselo— y `cell` —el motor no puede
ver `Cell`—. La conversión a Hz es del motor y sigue siendo suya.

El ternario del click se muda **con su comentario**: la ausencia de la clave `note` es lo que dice
«celda vacía», y la forma corta dejaría un tercer estado que el tipo existe para no tener.

### `alternarTransporte(playing: boolean, motor: MotorDeTransporte): boolean`

Tres líneas: pide lo contrario de lo que está pasando, y **devuelve lo que el motor dice que pasó**, no
lo que se pidió. Ese `return` es AC10 del spec 008 y la regla de `.claude/rules/audio.md` en una línea.

`MotorDeTransporte` nombra las tres funciones en español (`arrancar`, `frenar`, `corriendo`) porque el
tipo describe **el rol** que el motor cumple para esta pura, no la API de `engine.ts`. El mapeo a
`startClock`/`stopClock`/`clockRunning` se hace en el único lugar que importa el motor de verdad, que
es `use-motor.ts`.

### Los tests

Cinco casos, ninguno necesita DOM ni mocks:

1. Un `Step` proyectado conserva `offset` y `notes` y **no tiene** `pieceId`.
2. Un `Click` con `note` conserva las dos claves y **no tiene** `cell`.
3. Un `Click` sin `note` sale **sin la clave** — `'note' in proyectado === false`, no
   `proyectado.note === undefined`. Es el caso que hoy ningún test cubre.
4. `alternarTransporte(false, motorQueArranca) === true`.
5. `alternarTransporte(false, motorMudo) === false` — se pidió arrancar y no arrancó. **AC10 del 008.**

Los casos 1-3 se arman con `buildSequence` sobre un tablero real, como hace `route-source.test.ts`, y
no con literales: así el test verifica la proyección de la forma que el dominio produce de verdad.

---

## Paso 2 — El hook, y `App.tsx` sin efectos de reconciliación

`src/components/use-motor.ts`, con `useMotorSincronizado({ secuencia, placed, tempo, clicks })`.

**Los cuatro efectos se mudan enteros y sin editar**, en el mismo orden en que están hoy: `setBpm`,
`setClicksAudible`, la reconciliación, el desmontaje. Sus docblocks viajan con ellos — el de D5 del 009,
el de por qué `playing` no está en las dependencias, el de la limpieza sincrónica bajo StrictMode y el
de por qué el desmontaje usa `DEFAULT_REGIMEN` y no el `regimen` del estado son argumentos ya medidos,
y re-derivarlos es la forma más fácil de perderlos.

Lo único que cambia adentro de los efectos es que las dos proyecciones llaman a la pura del paso 1.

**`secuencia` entra por parámetro y el hook no la vuelve a derivar.** Es lo que garantiza que `encolar`
y `setSequence` sigan viendo la misma instancia: si el hook llamara a `buildSequence` por su cuenta, el
dibujo y el sonido podrían mirar circuitos distintos sin que nada falle, que es exactamente lo que D5
del 009 existe para cerrar.

En `App.tsx`: la llamada al hook va **después del `useMemo` de `secuencia`** (`:118`), y **no** donde
estaban los dos efectos cortos. No es una preferencia de estilo: `secuencia` es un `const`, así que
llamar al hook en `:98` la leería en su zona muerta temporal y tiraría un `ReferenceError` en el primer
render. El orden de los efectos **entre sí** no cambia —los cuatro siguen registrándose juntos y antes
de los dos de entrada, que hoy son `:286` y `:340`—, que es lo que AC5 protege: lo único que se mueve
es el punto del cuerpo del componente donde se los declara, y un `useMemo` no es un efecto. Los
`useMemo` de `secuencia` y `noteSet` se quedan en el shell — el hook recibe el resultado, no la regla.

`togglePlay` pasa a `setPlaying(alternarTransporte(playing, MOTOR))`, con `MOTOR` como const de módulo
en `use-motor.ts` que cablea las tres funciones reales. **`MOTOR` no va a `components/constants/`**
aunque la regla del repo diga que los módulos no declaran constantes: esa regla existe para los
**valores fijos** que tenían que coincidir en dos lados, y `MOTOR` no es un valor sino el cableado de
tres funciones importadas de `audio/engine.ts` — mandarlo a `constants/`, que hoy sólo tiene datos,
la obligaría a importar el singleton del `AudioContext`. Precedente exacto en la misma capa:
`route-source.ts:53` declara `RUTA_VACIA` y `cell-text.ts:11` su `memo`, los dos consts de módulo y
ninguno en `constants/`. El docblock de `MOTOR` lleva ese argumento escrito. `App.tsx` deja de importar `startClock`,
`stopClock` y `clockRunning`; sigue importando `playNow` para el disparo de colocación, que no es
reconciliación y se queda.

**`resetBoard` también llama a `stopClock`** (`App.tsx:177`), y es la única llamada al motor que no es
ni reconciliación ni transporte: es la orden explícita de volver a cero, el único lugar donde saltearse
D5 es correcto. Se resuelve exportando `frenarTransporte()` desde `use-motor.ts` en vez de dejar a
`App.tsx` importando el motor por una línea.

**Verificación de este paso**: `pnpm verify` en verde y una lectura contra AC5 — mismas llamadas, mismo
orden, mismas dependencias. No hay test automático que lo cubra y no se inventa uno: montar el hook pide
el jsdom que este spec existe para no agregar.

---

## Paso 3 — Los dos hooks de entrada

`src/components/use-entrada.ts`, con `useAtajosDeTeclado` y `useRuedaRota`. Van en un archivo y como
dos funciones: comparten `tapLimpio`, pero siguen sin compartir target ni dependencias, que es lo que
`overview.md:71-73` dice de ellos y sigue siendo cierto.

**Los dos reciben callbacks y no setters.** Es lo que hace que el 020 —que convierte `rotation` y
`mirror` en una ranura de un `Record`— cambie `App.tsx` y no el hook. La firma está en el spec.

**`tapLimpio` no se muda**: se queda en `App.tsx` y entra por parámetro a los dos. Meterlo adentro del
hook del teclado deja al de la rueda sin forma de ensuciarlo y devuelve el bug de `Ctrl`+rueda que
`App.tsx:344-349` documenta. Medido: **los dos efectos lo escriben** —el teclado en `:318`, la rueda en
`:350`— y sólo el teclado lo lee (`:296`), así que la arista va en las dos direcciones. Es AC15 y se verifica en el navegador, no leyendo.

Lo que hay que preservar y es fácil de perder:

- **El listener de `wheel` se registra una sola vez.** Hoy el efecto tiene `[]` porque usa el setter
  funcional y no lee ningún valor. Con un callback, la identidad de `alRotar` cambiaría por render y
  re-suscribiría por cada tecla. Se envuelve en `useCallback(…, [])` en `App.tsx` — posible justamente
  porque el cuerpo sigue usando el setter funcional.
- **`{ passive: false }` explícito** y el orden de las tres guardas del handler (ensuciar el tap →
  `ctrlKey` → `deltaY === 0` → `preventDefault`). El comentario que explica por qué ensuciar va
  **primero** viaja con el código.
- **Los dos de teclado se siguen re-suscribiendo** con las dependencias reales. No se convierte en un
  ref «para suscribir una sola vez»: es la optimización que el comentario de hoy declara innecesaria, y
  cambiarla acá sería meter una decisión nueva adentro de una mudanza.
- **El objeto `acciones` no entra crudo al array de dependencias.** Armado inline tiene identidad nueva
  por render, así que el hook se re-suscribiría por render — peor que hoy y en silencio. Los tres campos
  van por separado en las dependencias, o como tres parámetros.

`App.tsx` queda con **cero `useEffect`** (AC14) y en ≈250 líneas.

---

## Paso 4 — La paleta en tres archivos

`PanelDeOrientacion.tsx`, `PanelDeTransporte.tsx` y `types/panel.types.ts`; `PiecePalette.tsx` se queda
con la tarjeta y la composición, y pasa a recibir **dos** props.

**El JSX se mueve, no se reescribe.** Mismo DOM, mismas clases, mismo orden (AC18): lo único que cambia
es de qué archivo sale cada nodo y de dónde lee cada valor. Dos restricciones lo hacen posible, y salen
del DOM medido en `research.md` §10 y no de una preferencia: los panes **devuelven fragmentos** —el
`space-y-2` de `:170` es un selector de hijo directo, así que un envoltorio se come un margen— y la
**fila de clicks se queda en el contenedor**, porque hoy cae entre dos bloques de orientación y moverla
reordenaría el DOM. Es lo que deja que el 019, el 020 y el 021
no tengan que re-medir nada de lo que ya midieron — y las tres mediciones que hay en los comentarios de
este archivo (los repartos de columnas, el ancho de la caja de la miniatura, el peor caso de las doce)
viajan con el bloque que describen.

Los dos objetos se arman **inline en el JSX de `App.tsx`**: identidad nueva por render, que no cuesta
nada porque `PiecePalette` no está memoizado. Va escrito al lado, porque es lo primero que alguien va a
querer «arreglar» con un `useMemo` que no compra nada.

---

## Paso 5 — Las siete huérfanas, en su propio commit

`pnpm remove` de las siete, y sacar de `vite.config.ts` el comentario que explicaba cómo esquivar a
`@types/jest`. El bloque `test` **no cambia de otra forma**: `globals: true` queda disponible y sin
ejercer.

Va en un commit propio porque es un borrado, y la regla del repo es que revertir un borrado sea trivial.
`pnpm verify` corre **después** de este commit, no antes: es la única forma de saber que ninguna de las
siete estaba sosteniendo algo por accidente.

---

## Paso 6 — Las dos reglas nuevas en `conventions.md`

**Idioma de los identificadores.** Descriptiva, no prescriptiva hacia atrás: inglés para el vocabulario
técnico universal (`rotate`, `normalize`, `midi`, `sequence`), español para el del instrumento
(`puertas`, `regimen`, `velo`, `tapLimpio`). Bajo esa regla lo que ya está escrito queda casi todo del
lado correcto, y lo que no, no se toca.

**Criterio de comentario.** El repo ya dice «los comentarios explican el porqué»; falta el eje del
tiempo. Se queda el que describe una restricción que **hoy** hace que el código tenga que ser así; el
que cuenta cómo se llegó va a `revisiones.md` con un puntero de una línea. Con ejemplos de las dos
clases sacados del repo, para que el criterio sea aplicable y no una máxima.

---

## Paso 7 — El registro, y las treinta y una tareas

`deuda.md` pierde tres ítems y **no gana ninguno**: con el spec ampliado a los seis frentes ya no queda
nada diferido. `log.md` gana su fila y su entrada de dependencias.

Y las **treinta y una** tareas —018 (3), 019 (10), 020 (13), 021 (5)— de los specs pendientes que quedan apuntando al archivo equivocado se
reescriben una por una. No es una cortesía: `spec_status` las ofrece como próxima tarea, así que una
tarea que nombra un archivo que ya no tiene lo que dice es trabajo que alguien va a empezar y descubrir
roto. El precedente de tocar el `tasks.md` de un spec pendiente está escrito dos veces en el repo: el
015 cerró el `T070` del 011 y el 021 cierra el `T033` del 016.

---

## Paso 8 — El pase de comentarios

**Va último**, con todo lo demás en verde. Alcance: `src/` sin tests —5.618 líneas, 3.354 de
comentario—. Los tests no se tocan.

Cinco reglas, y las cinco son de seguridad y no de estilo:

1. **Nada se borra: se mueve.** Lo que sale de `src/` entra a `revisiones.md`, con fecha y con el spec
   que lo originó. El oráculo es de **conservación**, no de reducción.
2. **Commit propio**, que es la regla del repo para los borrados: revertir el pase entero tiene que ser
   trivial.
3. **Ante la duda, se queda.** Un comentario de más cuesta una lectura; uno de menos cuesta el
   argumento, y el argumento es lo que este repo tiene de valioso.
4. **Si mezcla restricción e historia, se parte**: la restricción se queda donde está, la historia se
   muda y en su lugar queda un puntero de una línea.
5. **Sin objetivo numérico.** Un porcentaje es un incentivo a borrar el comentario largo, que acá es
   sistemáticamente el bueno.

Los tres casos testigo son los del §6 del spec. Se hacen primero, y si los tres salen bien el pase
sigue; si alguno resulta ser restricción vigente disfrazada de crónica, el criterio se ajusta antes de
tocar nada más.

---

## Cómo se verifica el spec entero

1. `pnpm verify` en verde después de cada uno de los pasos 2, 3, 4, 5 y 8.
2. El oráculo de AC1: `grep -rn "{ offset: c.offset, note: c.note }" src/` devuelve una línea.
3. El oráculo de AC9: `grep -rn "seis efectos" .` no devuelve nada fuera de `specs/` — **sin
   `--include=*.md`**, que es lo que dejó pasar los cinco docblocks de `src/` del §14 del research.
4. El oráculo de AC14: `grep -c "useEffect" src/App.tsx` devuelve **0**.
5. El oráculo de AC19: lo que `src/` perdió en comentarios está en `revisiones.md`. Se verifica sobre
   el diff del commit del paso 8, que por eso va solo.
6. `spec_status` reporta el 022 sin pendientes.
7. **En el navegador** —lo que pide una persona—: los seis gestos del 013/014, el `Ctrl`+rueda de
   AC15, el transporte, y que suene igual que antes. Es la contraparte de AC5, AC15, AC16 y AC18, y no
   hay forma automática de hacerla sin el jsdom que el spec no agrega.

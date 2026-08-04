# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentación Técnica

La documentación completa vive en `docs/`. Consultarla antes de hacer cambios arquitectónicos.

| Sección | Archivo | Cuándo consultarlo |
|---|---|---|
| Visión general | [docs/architecture/overview.md](./docs/architecture/overview.md) | Capas, por qué todo vive en un archivo |
| Estructura de directorios | [docs/architecture/directory-structure.md](./docs/architecture/directory-structure.md) | Dónde crear cada cosa, qué está muerto |
| Modelo musical | [docs/architecture/modelo-musical.md](./docs/architecture/modelo-musical.md) | Pieza → tónica, rotación → escala, reflexión → retrógrado |
| Capa de audio | [docs/architecture/audio.md](./docs/architecture/audio.md) | Grafo Web Audio, ADSR, scheduler con lookahead, reconciliación de loops |
| Inicio rápido | [docs/guides/quickstart.md](./docs/guides/quickstart.md) | Setup, comandos, flujos típicos |
| Convenciones | [docs/guides/conventions.md](./docs/guides/conventions.md) | TypeScript, geometría, estado, comentarios |
| Troubleshooting | [docs/guides/troubleshooting.md](./docs/guides/troubleshooting.md) | Errores reales ya pisados en este repo |
| Deploy | [docs/infra/deploy.md](./docs/infra/deploy.md) | Netlify, rutas relativas a `base`, versión de Node |

**Trabajo planificado y deuda:** el registro completo, con estados y dependencias, está en
[specs/log.md](./specs/log.md). Es la única fuente — no se duplica acá para que no se desactualice.

---

## Commands

```bash
pnpm dev      # Dev server de Vite
pnpm build    # tsc -b && vite build
pnpm lint     # ESLint (flat config v9)
pnpm preview  # Sirve dist/
pnpm test     # Vitest — tests de audio con OfflineAudioContext
pnpm exec tsc -b --noEmit   # Solo typecheck
```

**El gestor es pnpm**, fijado en `packageManager` del `package.json` y versionado en `pnpm-lock.yaml`.
No usar npm: instalaría un `node_modules` plano y dejaría un `package-lock.json` que Netlify puede
llegar a preferir. La config de pnpm vive en `pnpm-workspace.yaml`, no en el `package.json`.

`node_modules` es **estricto**: solo se puede importar lo declarado en `package.json`. Un import de una
dependencia transitiva que con npm andaba, acá falla — es a propósito, y es la red que atrapa los
imports fantasma antes de que lleguen a producción.

Los tests corren en `environment: 'node'` contra `node-web-audio-api`, no en jsdom: jsdom no implementa
Web Audio. No hay tests de componentes todavía.

Node ≥ 20.19 o ≥ 22.12 — Vite 7 lo exige en `engines`.

---

## Arquitectura

**Stack:** Vite 7 · React 19 · TypeScript 5.8 · Tailwind CSS 4 · Web Audio (sin librería de audio)

**Qué es:** un prototipo de instrumento musical, no un juego con reglas de resolución. El usuario coloca
pentominós en un tablero de 10×6 y cada pieza dispara un arpegio de cinco notas. No hay puntaje ni
condición de victoria — al evaluar una feature, la pregunta es si vuelve al instrumento más expresivo,
no más difícil.

**Organización:** `src/` son cuatro capas en carpetas, con **una sola dirección de dependencia**:

```
types/ ← constants/ ← módulos              types/ no importa nada de afuera de types/
transform.ts ← board.ts                    domain/ no importa nada de fuera de domain/
             ← music.ts ← invariants.ts    audio/  no importa nada de fuera de audio/
                                           components/ y App.tsx importan de las dos
```

1. **`domain/`** — puro: sin React, sin Web Audio, sin DOM. `transform.ts` (geometría), `board.ts` (las
   reglas del tablero), `music.ts` (el modelo musical) e `invariants.ts` (los cinco chequeos). Los datos
   viven en `domain/constants/` y los tipos en `domain/types/`.
2. **`audio/`** — habla MIDI y no conoce el dominio. `voice.ts` (síntesis), `scheduler.ts` (lookahead),
   `engine.ts` (singletons y la API que consume la UI) y `spectrum.ts` (mapeo bins→barras).
3. **`components/`** — un componente por archivo, presentacionales: reciben datos y callbacks por props,
   sin estado ni efectos propios. La excepción es `Spectrum.tsx`, que no recibe props y lee del motor
   por su cuenta para que dibujar a 60 fps no re-renderice nada del tablero.
4. **`App.tsx`** — el shell: estado con `useState` local, derivados, handlers, los dos efectos y la
   composición. **Ninguna función pura y ningún literal de dominio.**

`domain/` y `audio/` son **hermanos sin aristas entre ellos**: el motor habla números MIDI y no sabe qué
es un pentominó.

Que el dominio viviera dentro de `App.tsx` no era neutral: `react-refresh/only-export-components`
prohíbe que un `.tsx` exporte algo además del componente, así que las puras **no podían exportarse y por
lo tanto no podían testearse**. Hoy `domain/` tiene 50 tests donde antes había cero.

---

## Invariantes que no hay que romper

### La dirección de dependencia, y la verifica el linter

`domain/` no importa React, ni `audio/`, ni `components/`; `audio/` no importa React, ni `domain/`, ni
`components/`. No es una convención escrita: `eslint.config.js` tiene un override por capa con
`@typescript-eslint/no-restricted-imports` —la variante que también ve los `import type`— y un import
prohibido **falla `pnpm lint`** con el mensaje de la capa.

Los patrones cubren `../` y `../../`, que es la profundidad de hoy. Al crear un subdirectorio nuevo hay
que agregar el patrón: es una red, no una prueba formal.

### Sin barrels, con extensión explícita, sin alias

Ningún `index.ts` de re-exportación. Todo import local lleva extensión (`./domain/transform.ts`) —
omitirla **no rompe la app**, porque Vite resuelve igual, así que el error sería invisible del lado del
navegador y solo aparecería al cargar `domain/` con node crudo. Rutas relativas, sin `@/`.

### Los módulos no declaran constantes

Un `.ts` de capa tiene funciones y nada más; los valores fijos van a `<capa>/constants/`. El motivo es
medible: antes había cuatro pares de números que tenían que coincidir y nada sincronizaba (`NOTE_DUR`,
el tempo inicial, y los dos tamaños de celda).

### El orden del array de celdas

`rotate90`, `normalize` y `reflect` (en `domain/transform.ts`) son `map`: **la celda del índice `k` sigue
siendo la misma celda lógica después de transformar.**

`ANCHOR_INDEX` depende de esto —guarda la celda de agarre como índice, no como coordenada—, la fase por
pieza lee la columna del ancla por índice, y el spec 001 va a depender de lo mismo para el mapeo
celda↔nota. Filtrar, ordenar o reagrupar celdas dentro de esas funciones rompe la colocación de piezas
**sin ningún error visible**. `checkArrayOrder()` de `domain/invariants.ts` es la red.

### Toda la gestión de jobs del motor pasa por el efecto de reconciliación

Un único `useEffect` sobre `[placed, loopPlaced]` lleva los jobs a donde deben estar. Los handlers solo
cambian estado.

El patrón imperativo anterior —cada handler limpiando lo suyo— produjo loops huérfanos que sobrevivían a
"Quitar" y "Reset". Si hace falta agendar algo nuevo, va adentro de ese efecto.

### Nunca mutar objetos ya entregados a React

Ese fue exactamente el bug de los loops que motivó el rediseño: `newPiece._sched = id` después del
`setPlaced`. Si un dato tiene
que cambiar después de crearse, o va en el estado con su propio setter, o va afuera de React (ref o
singleton de módulo).

### `y` crece hacia abajo

Coordenadas de grilla, no cartesianas. Cualquier cálculo angular recorre el círculo en sentido horario
en pantalla.

---

## Modelo musical

| Entrada | Determina |
|---|---|
| Qué pieza | La tónica (`BASE_MAP`: F→C, I→C#, … Z→B) |
| Rotación | La fórmula de escala (mayor → menor → blues → mayor +7) |
| Reflexión | El orden de las notas (retrógrado) |
| La columna de la celda de agarre | La posición dentro del compás (`Job.phase = ax / GRID_W`) |
| **La forma** | **Nada, hoy** — es lo que ataca el spec 001 |

**El eje X del tablero es tiempo**, y la fase se deriva de la geometría, no del reloj de pared: el mismo
tablero suena siempre igual. Es fracción y no segundos, así que mover el tempo estira el patrón en vez
de reordenarlo. Hoy **se oye pero no se lee** — no hay cabeza lectora; es la limitación consciente del
spec 004.

Cuidado con la colisión de nombres: la **pieza `F`** suena con tónica **C**; la nota F le corresponde a
la pieza `T`. La letra describe la forma, no el sonido.

Detalle en [docs/architecture/modelo-musical.md](./docs/architecture/modelo-musical.md).

---

## Audio

El motor propio vive en `src/audio/`, sobre Web Audio y sin librerías. Tres bloques que son tres
archivos: `voice.ts` (síntesis), `scheduler.ts` (lookahead) y `engine.ts` (singletons y la API de la UI).

- **`voice.ts` y `scheduler.ts` reciben el `AudioContext` por parámetro y NO PUEDEN tocar el
  singleton**, porque vive en `engine.ts` y ellos no lo importan. Es lo que permite renderizarlos con
  `OfflineAudioContext` en los tests, y desde el spec 005 lo sostiene el grafo de imports en vez de un
  comentario. **No romper esa inyección**: es la diferencia entre audio testeable y audio que solo se
  puede escuchar.
- **`ctx.resume()` necesita un gesto.** Nada suena antes del primer click. Cualquier feature que quiera
  sonar sin click previo va a quedar muda.
- **Falla suave**: `audio()` devuelve `null` si Web Audio no está disponible; la app queda usable pero
  muda. Todo llamador tiene que chequearlo.
- **Hay dos caminos a sonido, no uno**: `playNotes()` (arpegio al colocar) y `tick()` (loop), que
  llama a `scheduleVoice()` directo porque `collectHits` ya expandió los instantes. Lo unificado es
  `scheduleVoice`, `DEFAULT_VOICE` y las constantes: **cambiar el timbre alcanza para los dos, cambiar
  cómo se expande el arpegio no.**
- **El scheduler usa lookahead**: temporizador grueso de 25 ms que agenda 100 ms de futuro contra el
  reloj de audio. El temporizador no dispara notas, decide cuándo mirar.
- **El reloj es un origen, no un cursor.** `ClockState` son dos escalares —`origin` y `scheduledUntil`—
  y los onsets de cada job (`origin + (k + phase) * bar`) se resuelven en forma cerrada. Tres
  propiedades que no hay que romper: `scheduledUntil` es lo único que evita re-emitir cada onset cuatro
  veces (ticks de 25 ms contra horizonte de 100 ms); los compases perdidos por la pestaña oculta **se
  saltean, no se recuperan**; y **nunca hay más de `LOOKAHEAD` de audio comprometido**, con cualquier
  fase — es lo que hace que quitar una pieza la calle en 100 ms. `firstOnsetAfter` usa `floor(x) + 1` y
  no `ceil(x)`: con `ceil`, un onset en el borde de la ventana sale dos veces. Y `startClock` tiene que
  dejar `scheduledUntil` **estrictamente antes** de `origin`, o el downbeat del compás 0 se pierde.
- **El `AnalyserNode` va en serie entre el master y el destino** y es transparente al audio.
  `readSpectrum()` devuelve `null` en reposo —eso es información, no falla— y reusa el buffer entre
  llamadas: quien lo guarde va a verlo cambiar por debajo. El mapeo bins→barras vive aparte, en
  `src/audio/spectrum.ts`, porque **`AnalyserNode` no rinde nada útil en `OfflineAudioContext`**: es lo
  testeable, y por eso está separado del nodo.
- **Verificar audio sin oírlo**: en tests con `OfflineAudioContext`; en el navegador con `jobCount()` y
  contando osciladores. Recetas en
  [docs/architecture/audio.md](./docs/architecture/audio.md#cómo-verificar-el-audio).

---

## Convenciones

> Guía completa: [docs/guides/conventions.md](./docs/guides/conventions.md)

- **Español** en comentarios, commits y specs.
- **Cero `enum`.** El `erasableSyntaxOnly` del tsconfig los rechaza, y es la misma opción que permite
  que node cargue `src/domain/` sin compilar. Conjunto cerrado = const-object + union type derivado.
- **Los comentarios explican el porqué**, no el qué: una decisión, una restricción, un bug evitado.
- **Cero `any` y cero `@ts-ignore`.** Los tres que hubo desaparecieron con Tone y con la lógica
  imperativa de loops: estaban tapando problemas de diseño, no de tipos. Si aparece la tentación de uno
  nuevo, sospechar del diseño antes que de TypeScript.
- **Sin estado global.** Ni Context, ni Redux, ni Zustand.
- **`key` por id, nunca por índice**, en listas de elementos removibles.
- **Efectos que reconcilian**, no que ejecutan comandos. Con flag de cancelación si hacen trabajo
  asincrónico; sincrónicos si la limpieza tiene que ganarle al re-montaje de StrictMode.
- **Los borrados van en su propio commit**, para que revertirlos sea trivial.

---

## Antes de un cambio grande

Escribir un spec en `specs/` (cuatro archivos: `spec` · `research` · `plan` · `tasks`), commitearlo a
`main`, y recién ahí sacar la rama de feature. Convención en
[specs/README.md](./specs/README.md).

El `research.md` se escribe **midiendo, no suponiendo**. El spec 001 salió distinto de lo previsto
porque correr el algoritmo sobre las 12 piezas × 4 rotaciones desmintió tres supuestos.

---

## Deploy

`netlify.toml` está en la **raíz del repo**, junto al `package.json`. Sin `base` (la app vive en la
raíz), `publish = "dist"`, `NODE_VERSION = "22"`.

Detalle y los dos errores ya cometidos en
[docs/infra/deploy.md](./docs/infra/deploy.md).

---

## Estado conocido del repo

- **`public/manifest.json`** tiene los valores por defecto de CRA (`"name": "Create React App
  Sample"`).
- **Las `@testing-library/*` siguen sin consumidor**: no hay tests de componentes todavía, y montarlos
  va a requerir `jsdom` en su propio bloque de config, sin tocar el `environment` global que necesita el
  audio. Los 86 tests actuales —36 de audio y 50 de dominio— corren en Node.
- **No hay tests de UI**, así que los cuatro componentes de `components/` se verifican a ojo.
- **`postcss` y `autoprefixer`** están en `devDependencies` sin ningún config que los use (Tailwind 4 va
  por el plugin de Vite). Candidatos a borrar.
- **`@types/jest`** sigue en el árbol y es lo que impide usar `globals: true` en Vitest.
- **La rotación es un `number` sin acotar**, comparada contra `0|1|2|3` en cuatro lugares. El reemplazo
  ya está decidido —const-object en `constants/` + union type derivado en `types/`, **nunca un `enum`**,
  que el `erasableSyntaxOnly` del tsconfig rechaza— pero cambia firmas, así que quedó como seguimiento
  del spec 005.

Ya resueltos: los archivos huérfanos de las plantillas de CRA y Vite (`src/App.css`, `src/logo.svg`,
`src/assets/react.svg`, `public/vite.svg`, `src/setupTests.ts`) y la dependencia `web-vitals`, que quedó
sin consumidor cuando `reportWebVitals.ts` no se migró. También el anclaje de la fase a la columna
(spec 004, AC8), que no tenía test automático porque las puras no se podían exportar desde `App.tsx`:
hoy vive en `domain/board.ts` y lo cubre `domain/__tests__/board.test.ts`.

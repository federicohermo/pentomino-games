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

**Organización:** el dominio y la UI del tablero viven juntos en `src/App.tsx` (~340 líneas), con tres
capas separadas por orden dentro del archivo:

1. **Dominio** — funciones puras de geometría (`SHAPES`, `rotateN`, `reflect`, `ANCHOR_INDEX`) y de
   música (`BASE_MAP`, `notesForRotation`, `midiName`). Sin React, sin audio.
2. **Componente `App`** — todo el estado con `useState` local. Sin estado global.
3. **Audio** — vive aparte, en `src/audio/engine.ts` y `src/audio/spectrum.ts`. `App.tsx` solo le
   habla: `playNow`, `addJob`, `clearJobs`, `startClock`.

Fuera de `App.tsx` hay un solo componente: `src/components/Spectrum.tsx`, el canvas del espectro. No
recibe props ni las va a recibir — lee del motor por su cuenta para que dibujar a 60 fps no
re-renderice nada del tablero.

Que sea un solo archivo es deliberado a esta escala; la separación por capas **sí** hay que respetarla
al agregar código. El límite está identificado: al montar tests, las funciones puras se extraen a su
propio módulo.

---

## Invariantes que no hay que romper

### El orden del array de celdas

`rotate90`, `normalize` y `reflect` son `map`: **la celda del índice `k` sigue siendo la misma celda
lógica después de transformar.**

`ANCHOR_INDEX` depende de esto —guarda la celda de agarre como índice, no como coordenada— y el spec 001
va a depender de lo mismo para el mapeo celda↔nota. Filtrar, ordenar o reagrupar celdas dentro de esas
funciones rompe la colocación de piezas **sin ningún error visible**.

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
| **La forma** | **Nada, hoy** — es lo que ataca el spec 001 |

Cuidado con la colisión de nombres: la **pieza `F`** suena con tónica **C**; la nota F le corresponde a
la pieza `T`. La letra describe la forma, no el sonido.

Detalle en [docs/architecture/modelo-musical.md](./docs/architecture/modelo-musical.md).

---

## Audio

El motor propio vive en `src/audio/engine.ts`, sobre Web Audio y sin librerías. Tres bloques:
síntesis, scheduler y capa de aplicación.

- **Los bloques de síntesis y scheduler reciben el `AudioContext` por parámetro**, nunca del singleton.
  Es lo que permite renderizarlos con `OfflineAudioContext` en los tests. **No romper esa inyección**:
  es la diferencia entre audio testeable y audio que solo se puede escuchar.
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
- **`setupTests.ts` y las `@testing-library/*`** quedaron sin consumidor: no hay tests de componentes
  todavía. Los 27 tests actuales son de la capa de audio —18 del motor, 9 del mapeo del espectro— y
  corren en Node.

Ya resueltos: los archivos huérfanos de las plantillas de CRA y Vite (`src/App.css`, `src/logo.svg`,
`src/assets/react.svg`, `public/vite.svg`) y la dependencia `web-vitals`, que quedó sin consumidor
cuando `reportWebVitals.ts` no se migró.

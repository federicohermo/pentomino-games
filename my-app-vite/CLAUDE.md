# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentación Técnica

La documentación completa vive en `docs/`. Consultarla antes de hacer cambios arquitectónicos.

| Sección | Archivo | Cuándo consultarlo |
|---|---|---|
| Visión general | [docs/architecture/overview.md](./docs/architecture/overview.md) | Capas, por qué todo vive en un archivo |
| Estructura de directorios | [docs/architecture/directory-structure.md](./docs/architecture/directory-structure.md) | Dónde crear cada cosa, qué está muerto |
| Modelo musical | [docs/architecture/modelo-musical.md](./docs/architecture/modelo-musical.md) | Pieza → tónica, rotación → escala, reflexión → retrógrado |
| Capa de audio | [docs/architecture/audio.md](./docs/architecture/audio.md) | Tone.js, Transport, reconciliación de loops |
| Inicio rápido | [docs/guides/quickstart.md](./docs/guides/quickstart.md) | Setup, comandos, flujos típicos |
| Convenciones | [docs/guides/conventions.md](./docs/guides/conventions.md) | TypeScript, geometría, estado, comentarios |
| Troubleshooting | [docs/guides/troubleshooting.md](./docs/guides/troubleshooting.md) | Errores reales ya pisados en este repo |
| Deploy | [docs/infra/deploy.md](./docs/infra/deploy.md) | Netlify, rutas relativas a `base`, versión de Node |

**Trabajo planificado y deuda:** el registro completo, con estados y dependencias, está en
[specs/log.md](./specs/log.md). Es la única fuente — no se duplica acá para que no se desactualice.

---

## Commands

```bash
npm run dev      # Dev server de Vite
npm run build    # tsc -b && vite build
npm run lint     # ESLint (flat config v9)
npm run preview  # Sirve dist/
npx tsc -b --noEmit   # Solo typecheck
```

**No hay `npm test`**: el proyecto no tiene runner configurado, aunque arrastra `@testing-library/*` y
un `src/App.test.tsx` que nadie ejecuta. Montarlo es parte del spec 001.

Node ≥ 20.19 o ≥ 22.12 — Vite 7 lo exige en `engines`.

---

## Arquitectura

**Stack:** Vite 7 · React 19 · TypeScript 5.8 · Tailwind CSS 4 · Tone.js 15

**Qué es:** un prototipo de instrumento musical, no un juego con reglas de resolución. El usuario coloca
pentominós en un tablero de 10×6 y cada pieza dispara un arpegio de cinco notas. No hay puntaje ni
condición de victoria — al evaluar una feature, la pregunta es si vuelve al instrumento más expresivo,
no más difícil.

**Organización:** todo el código vive en `src/App.tsx` (~400 líneas), con tres capas separadas por orden
dentro del archivo:

1. **Dominio** — funciones puras de geometría (`SHAPES`, `rotateN`, `reflect`, `ANCHOR_INDEX`) y de
   música (`BASE_MAP`, `notesForRotation`, `midiName`). Sin React, sin Tone.
2. **Componente `App`** — todo el estado con `useState` local. Sin estado global.
3. **Audio** — `ensureTone()`, `playNotesNow()`, `useTransport()` y el efecto de reconciliación de
   loops.

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

### Toda la gestión de eventos del Transport pasa por el efecto de reconciliación

Un único `useEffect` sobre `[placed, loopPlaced]` agenda y cancela los loops. Los handlers solo cambian
estado.

El patrón imperativo anterior —cada handler limpiando lo suyo— produjo loops huérfanos que sobrevivían a
"Quitar" y "Reset". Si hace falta agendar algo nuevo, va adentro de ese efecto.

### Nunca mutar objetos ya entregados a React

Ese fue exactamente el bug de los loops: `newPiece._sched = id` después del `setPlaced`. Si un dato tiene
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

Tone.js se carga con `import()` dinámico dentro de `ensureTone()` y vive en singletons a nivel de
módulo, no en estado. Dos motivos: no crear el `AudioContext` antes de un gesto del usuario, y sacar
~340 kB del chunk inicial.

- **`Tone.start()` necesita un gesto.** Nada suena antes del primer click. Cualquier feature que quiera
  sonar sin click previo va a quedar muda.
- **Falla suave**: si el import se cae, `ensureTone()` devuelve `null` y la app sigue usable pero muda.
  Todo llamador tiene que chequearlo.
- **Hay dos caminos de reproducción duplicados**: el arpegio al colocar (`playNotesNow`) y el loop por
  compás (dentro del efecto). Un cambio de sonido va en los dos.
- **Verificar audio sin oírlo**: se pueden contar los loops vivos desde la consola; receta en
  [docs/architecture/audio.md](./docs/architecture/audio.md#cómo-verificar-el-audio-sin-oírlo).
  Filtrar por `_TransportRepeatEvent` — Tone crea eventos internos y el conteo crudo engaña.

---

## Convenciones

> Guía completa: [docs/guides/conventions.md](./docs/guides/conventions.md)

- **Español** en comentarios, commits y specs.
- **Los comentarios explican el porqué**, no el qué: una decisión, una restricción, un bug evitado.
- **Un solo `any` aceptado**, en `synth`, con su `@ts-ignore`. Los otros dos que había desaparecieron al
  volver declarativa la lógica de loops — estaban tapando el bug.
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

`netlify.toml` está en la **raíz del repo**, un nivel arriba de esta carpeta. `base = "my-app-vite"`,
`publish = "dist"` (relativo a `base`, no a la raíz), `NODE_VERSION = "22"`.

Detalle y los dos errores ya cometidos en
[docs/infra/deploy.md](./docs/infra/deploy.md).

---

## Estado conocido del repo

- **`public/manifest.json`** tiene los valores por defecto de CRA (`"name": "Create React App
  Sample"`).
- **`src/App.test.tsx`** es el smoke test de CRA y no hay runner que lo corra.

Ya resueltos: los archivos huérfanos de las plantillas de CRA y Vite (`src/App.css`, `src/logo.svg`,
`src/assets/react.svg`, `public/vite.svg`) y la dependencia `web-vitals`, que quedó sin consumidor
cuando `reportWebVitals.ts` no se migró.

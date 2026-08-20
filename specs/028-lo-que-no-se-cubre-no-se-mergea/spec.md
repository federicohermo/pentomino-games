# Spec 028 — Lo que no se cubre no se mergea

> Sin ticket: este repo no tiene tablero de Jira. Ver `specs/README.md`.
>
> **`pnpm verify` gana un quinto nodo: `coverage`, con umbral 100 en las cuatro métricas.** Hoy el
> repo tiene 407 tests y **ningún proveedor de coverage instalado**, así que nadie sabe qué miden. La
> respuesta, medida: **61,97 % de statements en `src/`** y 92,38 % de líneas en `mcp-server`.
>
> **No re-decide la herramienta.** El [024](../024-los-componentes-se-verifican-en-un-navegador/spec.md)
> trae el proyecto de navegador y con él la única forma de cubrir `Spectrum.tsx` y `engine.ts`; este
> spec lo consume. Lo que agrega es el **umbral**, y los tests que faltan para que el umbral pase.
>
> **Revisa AC2 del 024**: `verify` deja de tener cuatro nodos y pasa a tener cinco. El motivo no es
> estético y está medido (D2).

## Problema

`CLAUDE.md` describe `verify` como «el nodo de convergencia» y enumera sus cuatro ramas: `lint`,
`typecheck`, `test`, `mcp:test`. Tres de las cuatro son binarias —compila o no, pasa o no—. La cuarta
no: `test` reporta que 407 tests pasan, y **no dice sobre qué**.

Medido el 2026-08-20 instalando `@vitest/coverage-v8` a mano —no está en `package.json`, así que este
número no se había mirado nunca:

| Métrica | `src/` | |
|---|---|---|
| Statements | **61,97 %** | 717 / 1157 |
| Branches | **56,79 %** | 280 / 493 |
| Functions | **56,07 %** | 120 / 214 |
| Lines | **60,61 %** | 548 / 904 |

Y el reparto por capa dice que el promedio esconde dos repos distintos:

| Capa | Statements | Lectura |
|---|---|---|
| `domain/` | **98,27 %** | Lo que el 005 vino a arreglar, arreglado |
| `audio/` | 50,23 % | `voice`, `scheduler`, `playhead` y `spectrum` cubiertos; `engine.ts` en **0 %** |
| `components/` | 29,01 % | Los `.ts` puros cubiertos; los seis `.tsx` y los dos hooks en **0 %** |
| `App.tsx` | **0 %** | — |

### Lo que está en cero absoluto

**1 393 líneas** sobre las que ningún test pasó nunca:

| Archivo | Líneas | Por qué está en cero |
|---|---|---|
| `audio/engine.ts` | 374 | Usa `new AudioContext()` a nivel de módulo y `window.setInterval`: ninguno existe en `environment: 'node'` |
| `App.tsx` | 312 | No hay DOM |
| `components/Board.tsx` | 308 | No hay DOM |
| `components/Playhead.tsx` | 278 | No hay DOM |
| `components/use-input.ts` | 155 | Hook con `useEffect`: cualquier renderer que corra efectos necesita `window` |
| `components/PiecePalette.tsx` | 143 | No hay DOM |
| `components/Spectrum.tsx` | 141 | No hay DOM |
| `components/use-engine.ts` | 139 | Ídem `use-input.ts` |
| `components/OrientationPanel.tsx` | 139 | No hay DOM |
| `components/TransportPanel.tsx` | 61 | No hay DOM |

`engine.ts` es el que más incomoda: **no es UI**. Son 374 líneas que contienen el reloj, la
reconciliación del loop, el `outputLatency` y el `tick` con lookahead —la parte del audio de la que
depende que algo suene a tiempo— y están fuera de toda red porque tocan dos globales del navegador.

### Y lo que está casi, que es distinto

Tres huecos parciales, y en los tres el hueco está en las **ramas**:

| Archivo | Statements | Branches | Líneas sin cubrir |
|---|---|---|---|
| `domain/invariants.ts` | 92,98 % | **83,33 %** | 99-103, 124-126, 133-137, 150-151, 187-188, 193-194, 231-235, 251-255, 261-262, 268-269, 279, 284-285, 289-290 |
| `components/route-source.ts` | 98,11 % | **81,25 %** | 141, 148-181 |
| `domain/` (resto) | — | 94,73 % | Ramas sueltas en `music.ts` (96,77 %) y `sequence.ts` (93,88 %) |

`invariants.ts` importa más que los otros dos juntos: `CLAUDE.md` lo nombra como el módulo que hay
que correr «después de tocar geometría, `SHAPES` o el modelo musical», y el 005 lo llamó «el
invariante que CLAUDE.md marca como el más peligroso del repo». Una sexta parte de sus ramas —las que
**reportan la violación**— nunca se ejecutaron. O sea: sabemos que el invariante pasa; no sabemos que
sepa fallar.

### El `mcp-server` no está mucho mejor, y ahí el hueco tiene otro color

Medido con `node --test --experimental-test-coverage`, acotado a `mcp-server/src/**`:

**92,38 % líneas · 94,71 % ramas · 91,36 % funciones.** Concentrado en cuatro lugares:

| Archivo | Líneas | Funciones | Sin cubrir |
|---|---|---|---|
| `specs.ts` | 77,64 % | **60,00 %** | 176-181, 191-237 |
| `tools/findSymbol.ts` | 70,41 % | **0,00 %** | 68-96 |
| `symbols.ts` | 90,29 % | 90,91 % | 241-249, 271-295 |
| `tools/specStatus.ts` | 100 % | **0,00 %** | — |

`findSymbol` y `specStatus` tienen su función `run` —lo que la tool **hace** cuando alguien la
llama— en 0 %. `CLAUDE.md` vende esas dos tools como el reemplazo de `grep` y de leer `log.md` más
once `tasks.md`; el `run` de las dos está sin test.

### Por qué el número no existía

No es olvido, y conviene decirlo porque explica por qué el arreglo no es «agregar `--coverage`»:
hasta el 024 **no había forma** de cubrir la mitad del repo. La única infra de UI que se había
evaluado era testing-library sobre jsdom, y el 024 documenta por qué no sirve acá. Medir sin poder
arreglar sólo produce un número deprimente y un `exclude` cada vez más largo.

El 024 destraba eso. Este spec es la consecuencia.

## Solución propuesta

Un **quinto nodo en `verify`** llamado `coverage`, con umbral **100** en `lines`, `statements`,
`functions` y `branches`, más los tests que faltan para que ese umbral pase.

```
pnpm verify
├── lint
├── typecheck
├── test        ← los dos proyectos del 024, SIN instrumentar
├── coverage    ← los dos proyectos, instrumentados, con umbral 100
└── mcp:test    ← ahora con --test-coverage-lines/branches/functions=100
```

### D1 — El umbral es 100, y no 95

Un umbral por debajo del 100 es un presupuesto de deuda **sin dueño**: nadie sabe cuáles son las 57
líneas que el 95 % permite dejar sin cubrir, así que nadie las revisa y el margen se llena solo. El
100 no admite esa ambigüedad: cada línea que entra al repo o está cubierta, o está excluida **por
nombre y con un motivo escrito**. La discusión se muda del promedio al archivo, que es donde se puede
resolver.

Es la misma forma que el repo ya eligió dos veces. `CLAUDE.md` dice «cero `any` y cero `@ts-ignore`»
—no «pocos»— y el argumento que da es este mismo: «los tres que hubo estaban tapando problemas de
diseño, no de tipos».

### D2 — `coverage` es un nodo aparte de `test`, y el motivo está medido

`domain/__tests__/sequence.test.ts` tiene dos presupuestos de performance. Bajo instrumentación v8:

| Presupuesto | Techo | Sin coverage | **Con coverage** |
|---|---|---|---|
| AC10 — mediana de 21 corridas, 12 piezas | < 5 ms | 1,8 ms | **11,3 ms** |
| AC8 — matriz de 144 rutas, 12 piezas | < 4 ms | — | **6,8 ms** |

Medir la performance de un build instrumentado no mide el producto: mide el instrumento. Las dos
salidas malas son subir los techos —que los vuelve inútiles— o borrarlos. La buena es correr las dos
cosas por separado: `test` mantiene los presupuestos honestos sobre un build limpio, y `coverage`
los saltea con `skipIf` y una env var, dejando dicho en el propio test por qué.

Corren en paralelo dentro de `verify`, así que el costo de pared es el del más lento y no la suma.

### D3 — El denominador se declara entero, y sólo se excluyen cuatro archivos

`coverage.include` es `src/**/*.{ts,tsx}`. Se excluyen, por nombre:

| Excluido | Motivo |
|---|---|
| `src/**/__tests__/**` | Son los tests |
| `src/vite-env.d.ts` | Declaraciones de tipo, sin runtime |
| `src/main.tsx` | Bootstrap: `createRoot(...).render(<App />)`. Cubrirlo verifica que React monta, no que este repo funcione |
| `mcp-server/src/index.ts` | El mismo archivo del otro lado del borde: `serveStdio(...)` y el registro de las cinco tools |

Los `constants/` y los `types/` **no** se excluyen. Los primeros porque un valor fijo que nadie
importa es código muerto y el umbral lo delata; los segundos porque `erasableSyntaxOnly` los borra en
compilación y llegan al reporte como 100 % sin que nadie haga nada.

### D4 — Cero `/* v8 ignore */`

Por el mismo motivo por el que `CLAUDE.md` prohíbe `@ts-ignore`: una rama que no se puede ejecutar es
casi siempre un problema de diseño, no de herramienta. Si una rama defensiva resulta genuinamente
inalcanzable, la salida es **borrarla o volverla alcanzable**, no silenciarla. Cada caso que aparezca
se anota en `research.md` con qué se hizo y por qué.

### D5 — El `mcp-server` usa los flags de node, no vitest

Node 22.18 —el piso que el server ya declara en `engines`— trae `--test-coverage-lines`,
`--test-coverage-branches`, `--test-coverage-functions` y `--test-coverage-include/exclude`. Meter
vitest en ese paquete para medir coverage sería agregarle un runner a un paquete que a propósito no
tiene ninguno: corre TypeScript sin compilar con `node --test`, y esa es su gracia.

Verificado: `--test-coverage-include='src/**'` acota el reporte al paquete y deja afuera los
`../src/**` del dominio que el server importa, que ya los mide el otro lado.

### D6 — Se apoya en el proyecto de navegador del 024, no lo construye

El 024 deja `test.projects` con `node` y `browser`, el sufijo `*.browser.test.tsx`, el setup que
importa la hoja de estilos, y Chromium instalado en la CI del 023. Este spec **no toca nada de eso**:
escribe tests que caen en los proyectos que ya existen.

La única corrección que le hace es a AC2 —cuatro nodos pasan a cinco—, más una nota medida sobre su
D3 que va en `research.md`.

## Criterios de aceptación

- **AC1** — `pnpm coverage` reporta **100 %** en `lines`, `statements`, `functions` y `branches` sobre
  `src/`, y devuelve exit 0. Con cualquiera de las cuatro por debajo, exit 1 y el mensaje nombra la
  métrica.
- **AC2** — `pnpm verify` corre **cinco** nodos en paralelo y `coverage` es uno de ellos. Revisa AC2
  del 024.
- **AC3** — `pnpm test` sigue corriendo **sin instrumentar**, y los dos presupuestos de performance de
  `sequence.test.ts` siguen midiendo contra 5 ms y 4 ms ahí y sólo ahí.
- **AC4** — Los dos presupuestos se saltean bajo coverage con `skipIf`, con un comentario que deja el
  número medido: 11,3 ms contra un techo de 5.
- **AC5** — `pnpm mcp:test` corre con umbral 100 en las tres métricas que node soporta, acotado a
  `mcp-server/src/**` y excluyendo `index.ts`.
- **AC6** — `audio/engine.ts` pasa de 0 % a 100 %, incluida la rama del `catch` que devuelve `null`
  cuando el navegador no soporta Web Audio.
- **AC7** — `domain/invariants.ts` llega al 100 % de ramas: cada invariante tiene un test que lo hace
  **fallar**, no sólo uno que lo hace pasar.
- **AC8** — `components/route-source.ts` llega al 100 % de ramas (hoy 81,25 %).
- **AC9** — Los seis `.tsx`, `App.tsx`, `use-engine.ts` y `use-input.ts` llegan al 100 % en el proyecto
  de navegador del 024.
- **AC10** — El repo no tiene ni un `/* v8 ignore */` ni un `/* c8 ignore */` (D4). Verificable con
  `grep`.
- **AC11** — `coverage.exclude` tiene exactamente los cuatro archivos de D3, cada uno con su comentario
  al lado.
- **AC12** — `CLAUDE.md` actualiza la descripción de `verify`: cinco nodos, y la medición nueva de
  serie contra paralelo.
- **AC13** — La CI del 023 corre `coverage` y falla el PR si baja del 100.

## Fuera de alcance

- **Mutation testing.** El coverage dice que la línea se ejecutó, no que el test la verifique. Stryker
  contesta la pregunta buena y es otro spec: instala un runner más, multiplica el tiempo por ~20 y
  exige decidir un umbral de mutantes sobrevivientes, que es una discusión entera.
- **Snapshots visuales.** Ya estaba fuera del 024 y sigue afuera.
- **Migrar los 322 tests de `node` al navegador.** El 024 lo puso fuera de alcance y el argumento no
  cambia: serían más lentos sin comprar nada.
- **Subir el coverage de `specs/`, `docs/` o `.claude/`.** No son código que corra.
- **Un reporte HTML de coverage o su publicación.** El reporte `text` en consola alcanza para un gate;
  un artefacto navegable es cosmética hasta que alguien lo pida.
- **Tocar `eslint.config.js` para que el linter mire los tests nuevos.** Es del 023, que ya sube el
  plugin de hooks y arregla los `.js` sin reglas.

# Spec 024 — Los componentes se verifican en un navegador

> ## ⚠ Este spec ya está construido, y no lo construyó él
>
> El [029](../029-lo-que-no-se-cubre-no-se-mergea/spec.md) necesitó el proyecto de navegador para
> llegar al 100 % de coverage, el 024 seguía en `Propuesto` y sin rama, y entonces **lo construyó él
> siguiendo el diseño que este spec ya había fijado** — para que no hubiera dos versiones el día que
> se implementara. Está mergeado (PR #24). Estado real, verificado contra el árbol en `37abf53`:
>
> - **AC1 y AC2: cumplidos.** `vite.config.ts` tiene los dos proyectos; `verify` tiene cuatro nodos.
> - **AC3 a AC9 —los seis invariantes, que era lo único propio de este spec—: cumplidos, y con más
>   fuerza que la que el AC pedía.** El detalle, invariante por invariante y con `path:línea`, está en
>   `tasks.md`.
> - **AC11: cumplido.** `deuda.md` reescribió el ítem, no lo borró.
> - **AC10: es lo único que queda, y no depende de este spec.** `.github/workflows/` no existe porque
>   el 023 sigue en `Propuesto`. **Que el paso de `playwright install` lo ponga el 023**, que es el que
>   crea el archivo.
> - **D3 quedó falsificado por una medición posterior** (ver abajo).
>
> El texto de abajo se conserva como registro de la decisión —los specs de este repo son ADR— con las
> correcciones señaladas donde el árbol dice otra cosa. Los números que fija son de `052aedf`: donde
> dice «322 tests» hoy son **562**, y donde dice «16 archivos de test» hoy son **16 `.ts` más 8
> `.browser.test.tsx`**.
>
> Sin ticket: este repo no tiene tablero de Jira. Ver `specs/README.md`.
>
> **Cierra el ítem más viejo de `deuda.md`: «No hay tests de UI».** Y lo cierra por la vía que ese ítem
> no había evaluado — **no jsdom**, que el repo rechaza con razón, sino el **browser mode** de Vitest 4,
> que ya está instalado. Los tests corren en Chromium real, con Web Audio de verdad, con listeners
> pasivos de verdad y con layout de verdad.
>
> **Medido, y es lo que decide el spec: el bug de la rueda pasiva se atrapa.** El test que dispara un
> `wheel` cancelable sobre el tablero y afirma `defaultPrevented === true` **pasa hoy** y fallaría el día
> que alguien mueva ese listener a una prop de JSX — que es la falla que `use-input.ts` describe como
> «la más cara posible: parece que anda».
>
> `environment: 'node'` **no se toca**: los 322 tests de hoy siguen corriendo exactamente donde corren.
> Es un proyecto **al lado**, no un reemplazo. **Se cumplió**: `vite.config.ts:59` sigue diciendo
> `environment: 'node'` para el proyecto `node`, y el `include` de ese proyecto sólo ganó el ancla de
> carpeta (`src/**/__tests__/*.test.ts`).

## Problema

`deuda.md` lo registra así:

> **No hay tests de UI**, así que los componentes de `components/` se verifican a ojo. […] Los
> componentes pasaron de cuatro a seis —`PiecePalette` se partió en tres— y **se siguen verificando a
> ojo**: el hueco es el mismo, sólo que reparte su superficie en más archivos.

El registro además explica por qué el hueco sobrevivió a veintidós specs, y el argumento es bueno: la
única infra que se había evaluado era **testing-library sobre jsdom**, y jsdom no sirve acá.

No sirve por tres motivos concretos, y los tres están escritos en el propio código:

1. **jsdom no implementa Web Audio.** `vite.config.ts` lo dice en un comentario: «jsdom no implementa
   Web Audio en absoluto, así que ahí `OfflineAudioContext` no existe».
2. **jsdom no distingue un listener pasivo de uno activo.** Y esa distinción es una decisión de diseño
   de este repo, con su propio docblock: React registra `wheel` **pasivo** en su contenedor raíz, así
   que `preventDefault()` desde una prop de JSX es un no-op. El listener va por `addEventListener(...,
   { passive: false })` por eso.
3. **jsdom no hace layout.** Y `src/` tiene **tres tablas de mediciones del DOM** en comentarios
   —el reparto de columnas en `Board.tsx`, las cuatro filas de viewports en `OrientationPanel.tsx`, la
   cadena que fija `CELL_PX` en `layout.constants.ts`— que hoy no revalida nada.

O sea: el hueco no estaba abierto por desidia. Estaba abierto porque **la única herramienta considerada
era la equivocada**, y no había otra hasta que Vitest 4 trajo el browser mode.

### Lo que hoy no verifica nadie

Todo esto está escrito en `src/` como decisión argumentada, y todo depende de que alguien lo mire:

La última columna es la de cuando se escribió este spec; entre paréntesis, quién lo cubre hoy.

| Qué | Dónde está el argumento | Cómo se verifica hoy |
|---|---|---|
| La rueda frena el scroll (listener no pasivo) | `use-input.ts`, docblock de `useRuedaRota` | ~~A ojo. «Parece que anda» si se rompe~~ (`use-input.browser.test.tsx:146`) |
| `Ctrl`+rueda hace zoom y **no** refleja | `use-input.ts`, D10 del 013 | ~~A ojo. Su propio comentario dice que ningún test lo atrapa~~ (`use-input.browser.test.tsx:177`) |
| La capa de `Playhead` se pinta **encima** de las celdas | `Playhead.tsx`, sección `z-10` | ~~A ojo. «Hay que mirar los píxeles»~~ (`Playhead.browser.test.tsx:65`) |
| El tablero mide 10 × `CELL_PX` y no empuja scroll a la página | `Board.tsx` | ~~A ojo~~ (`Board.browser.test.tsx:74`) |
| La línea de notas ocupa dos renglones reservados y no salta | `PiecePalette.tsx`, medido sobre las 48 combinaciones | ~~A ojo~~ (`PiecePalette.browser.test.tsx:50`) |
| Las doce miniaturas no reflowean al rotar | `OrientationPanel.tsx`, caja fija 5×5 | ~~A ojo~~ (`OrientationPanel.browser.test.tsx:59`) |

~~Seis invariantes medidos, cero tests.~~ **Seis invariantes medidos, seis tests, los seis en el
árbol.** Es la parte de este spec que quedó cumplida sin que el spec se implementara.

## Solución propuesta

Un **segundo proyecto de Vitest**, no un segundo runner.

```
pnpm test
├── proyecto "node"     ← los 322 de hoy, environment: 'node', sin tocar
└── proyecto "browser"  ← Chromium por Playwright, sólo *.browser.test.tsx
```

### D1 — `projects` y no dos configs ni dos scripts

`pnpm test` sigue siendo **un** comando que corre **todo**, y `pnpm verify` sigue teniendo cuatro nodos.
Partirlo en `test` y `test:browser` haría que el nodo de convergencia dejara de converger, que es
exactamente lo que `CLAUDE.md` construyó `verify` para evitar.

### D2 — La convención de nombre es el sufijo, no la carpeta

`*.browser.test.tsx` para el proyecto de navegador; `*.test.ts` para el de node. **El sufijo y no una
carpeta `__tests__/browser/`**: los tests del repo viven al lado de lo que prueban, y un test de
`Board.tsx` que necesita navegador sigue siendo un test de `Board.tsx`. Además la extensión ya separa
sola: el proyecto de node incluye `.ts` y el de navegador `.tsx`, así que un test que necesite JSX no
puede caer en node por accidente.

### D3 — El proyecto de navegador repite `plugins` — ~~decidido~~ **falsificado**

Medido: un `projects[]` **no hereda** los plugins de la config raíz. Sin `react()` en el proyecto de
navegador, el JSX no compila. Se escribe repetido y con el comentario que lo diga, porque es
exactamente el tipo de cosa que alguien "limpiaría" borrándola.

> **Corrección medida, del `research.md` §4 del 029.** Con **`extends: true`** en el proyecto sí los
> hereda: el spike corrió JSX en el proyecto de navegador **sin** repetir `plugins`. Las dos
> mediciones son compatibles —sin `extends`, no hereda—, pero la conclusión de D3 deja de valer, y el
> árbol quedó del otro lado: los dos proyectos extienden, y con eso heredan `plugins` **y** el bloque
> `coverage`, que es lo que hace que los dos reporten en una tabla contra un único umbral.

### D4 — La hoja de estilos se importa en el test, o el layout miente

Medido, y es la trampa más cara de este spec: sin `import '../../styles/index.css'`, la clase `z-10`
está en el `className` y `getComputedStyle(...).zIndex` devuelve **`auto`**. O sea que un test de
layout **pasa o falla por el motivo equivocado, en silencio**.

Es el mismo mecanismo que el repo ya conoce por el otro lado —«Tailwind escanea el fuente, así que una
clase interpolada no se generaría»— y merece el mismo tratamiento: queda en un archivo de setup del
proyecto de navegador, importado una vez, para que no dependa de que cada test se acuerde.

### D5 — Los primeros seis tests son los seis invariantes de la tabla, y ninguno más

No se testea «que el botón renderice». Se testea **lo que hoy sólo sabe un comentario**. El criterio
para que un test entre a este spec es que exista un docblock en `src/` que afirme algo que jsdom no
podría verificar.

### D6 — El velo de la deuda se cierra parcialmente, y se dice cuál mitad

`deuda.md` va a poder tachar «no hay tests de UI», pero **no** «los componentes se verifican a ojo del
todo»: seis invariantes bajo test no son la superficie completa de seis componentes. El ítem se
reescribe con lo que queda, en vez de borrarse — que es lo que el 022 hizo con su parte.

> **Cumplido, y la mitad que quedó abierta salió más chica de lo que este spec calculaba.** El 029 no
> se detuvo en los seis invariantes: llegó al **100 % en las cuatro métricas** sobre los seis
> componentes, el shell y los dos hooks. Así que la deuda que sobrevive no es «la superficie de seis
> componentes» sino sólo **verificar que la app se vea *bien*** — snapshots visuales, que este mismo
> spec ya ponía fuera de alcance. `specs/deuda.md:13-19`.

## Criterios de aceptación

Diez de once están cumplidos por el 029. El estado va al lado de cada uno, verificado contra `37abf53`.

- **AC1** ✅ — `pnpm test` corre los dos proyectos y reporta los dos. Los de hoy siguen pasando en
  `environment: 'node'`, sin un solo cambio en sus archivos. `vite.config.ts:53-89`. (Eran 322 cuando
  se escribió esto; son 562.)
- **AC2** ✅ — `pnpm verify` sigue teniendo **cuatro** nodos, y el de tests ahora incluye el navegador.
  `package.json:19`. El nodo se llama `suite` y no `test`: el 029 lo renombró al encadenar
  `test && coverage`, que es justamente lo que le permitió **no** pasar a cinco nodos.
- **AC3** ✅ — Existe un test que dispara un `wheel` cancelable sobre el contenedor del tablero y afirma
  `defaultPrevented === true`. **Medido: pasa hoy.** `use-input.browser.test.tsx:146`.
- **AC4** ✅ — Ese mismo test **falla** si se mueve el listener a una prop `onWheel` de JSX. Se cumplió
  por la vía más fuerte: un pase de mutación a `{ passive: true }`, anotado en el propio test
  (`use-input.browser.test.tsx:153-158`).
- **AC5** ✅ — Existe un test que afirma que `Ctrl`+rueda **no** cambia la rotación y **no** llama a
  `preventDefault` — el gesto que D10 del 013 nombra. `use-input.browser.test.tsx:177`.
- **AC6** ✅ — Existe un test que afirma que la capa de `Playhead` computa `z-index: 10` **con la hoja de
  estilos cargada**, y no `auto`. `Playhead.browser.test.tsx:65`, sobre las dos capas.
- **AC7** ✅ — Existe un test que afirma que la grilla mide `10 × CELL_PX` de ancho y que el `body` no
  gana scroll horizontal a 375 px de viewport. `Board.browser.test.tsx:74`.
- **AC8** ✅ — Existe un test que afirma que las doce miniaturas conservan su caja al rotar.
  `OrientationPanel.browser.test.tsx:59`, y no entre dos rotaciones sino entre las **ocho**
  orientaciones, botón por botón, ancho y alto.
- **AC9** ✅ — Existe un test que afirma que la línea «Notas actuales» reserva dos renglones y no cambia de
  alto entre el mejor y el peor caso de los 48. `PiecePalette.browser.test.tsx:50`.
- **AC10** ⏳ — El workflow del 023 instala Chromium antes de correr `verify`, y la CI pasa. **Es el
  único que falta, y no lo puede cumplir este spec**: `.github/workflows/` no existe porque el 023
  sigue en `Propuesto`. Es el mismo diferimiento que el AC13 del 029.
- **AC11** ✅ — `deuda.md` reescribe el ítem de tests de UI con la mitad que queda abierta, en vez de
  borrarlo (D6). `specs/deuda.md:13-19`.

## Fuera de alcance

- **Migrar los 322 tests existentes.** Corren en node porque el dominio es puro y el audio usa
  `node-web-audio-api`; moverlos al navegador los haría más lentos sin comprar nada.
- **jsdom.** Sigue sin entrar al repo, y ahora con un motivo más: ya no hace falta.
- **Snapshots visuales.** Playwright puede, y es otra decisión —qué se considera un cambio, dónde viven
  las imágenes de referencia— que no cabe acá.
- **Testear `domain/` o `audio/` en navegador.** Su lugar es node y no cambia.
- **Coverage.** ~~Sigue siendo el seguimiento del 023.~~ Se lo llevó el **029**, que además es el que
  terminó construyendo esta infra: hoy hay umbral 100 en las cuatro métricas y este proyecto de
  navegador entra al denominador.
- **Los tests de accesibilidad** de los specs 025 y 026, que se apoyan en esta infra pero deciden otra
  cosa.

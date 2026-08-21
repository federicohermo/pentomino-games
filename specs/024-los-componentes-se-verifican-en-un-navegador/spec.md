# Spec 024 — Los componentes se verifican en un navegador

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
> Es un proyecto **al lado**, no un reemplazo.

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

| Qué | Dónde está el argumento | Cómo se verifica hoy |
|---|---|---|
| La rueda frena el scroll (listener no pasivo) | `use-input.ts`, docblock de `useRuedaRota` | A ojo. «Parece que anda» si se rompe |
| `Ctrl`+rueda hace zoom y **no** refleja | `use-input.ts`, D10 del 013 | A ojo. Su propio comentario dice que ningún test lo atrapa |
| La capa de `Playhead` se pinta **encima** de las celdas | `Playhead.tsx`, sección `z-10` | A ojo. «No lo atrapa ningún test ni se ve en el atributo `style`: hay que mirar los píxeles» |
| El tablero mide 10 × `CELL_PX` y no empuja scroll a la página | `Board.tsx` | A ojo |
| La línea de notas ocupa dos renglones reservados y no salta | `PiecePalette.tsx`, medido sobre las 48 combinaciones | A ojo |
| Las doce miniaturas no reflowean al rotar | `OrientationPanel.tsx`, caja fija 5×5 | A ojo |

Seis invariantes medidos, cero tests.

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

### D3 — El proyecto de navegador repite `plugins`

Medido: un `projects[]` **no hereda** los plugins de la config raíz. Sin `react()` en el proyecto de
navegador, el JSX no compila. Se escribe repetido y con el comentario que lo diga, porque es
exactamente el tipo de cosa que alguien "limpiaría" borrándola.

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

## Criterios de aceptación

- **AC1** — `pnpm test` corre los dos proyectos y reporta los dos. Los 322 de hoy siguen pasando en
  `environment: 'node'`, sin un solo cambio en sus archivos.
- **AC2** — `pnpm verify` sigue teniendo **cuatro** nodos, y el de `test` ahora incluye el navegador.
- **AC3** — Existe un test que dispara un `wheel` cancelable sobre el contenedor del tablero y afirma
  `defaultPrevented === true`. **Medido: pasa hoy.**
- **AC4** — Ese mismo test **falla** si se mueve el listener a una prop `onWheel` de JSX. Es la
  verificación de que el test verifica algo: se comprueba rompiéndolo a propósito y revirtiendo.
- **AC5** — Existe un test que afirma que `Ctrl`+rueda **no** cambia la rotación y **no** llama a
  `preventDefault` — el gesto que D10 del 013 nombra y que hoy no cubre nada.
- **AC6** — Existe un test que afirma que la capa de `Playhead` computa `z-index: 10` **con la hoja de
  estilos cargada**, y no `auto`.
- **AC7** — Existe un test que afirma que la grilla mide `10 × CELL_PX` de ancho y que el `body` no
  gana scroll horizontal a 375 px de viewport.
- **AC8** — Existe un test que afirma que las doce miniaturas conservan su caja al rotar: el ancho del
  contenedor de la paleta no cambia entre `rotation: 0` y `rotation: 1`.
- **AC9** — Existe un test que afirma que la línea «Notas actuales» reserva dos renglones y no cambia de
  alto entre el mejor y el peor caso de los 48.
- **AC10** — El workflow del 023 instala Chromium antes de correr `verify`, y la CI pasa.
- **AC11** — `deuda.md` reescribe el ítem de tests de UI con la mitad que queda abierta, en vez de
  borrarlo (D6).

## Fuera de alcance

- **Migrar los 322 tests existentes.** Corren en node porque el dominio es puro y el audio usa
  `node-web-audio-api`; moverlos al navegador los haría más lentos sin comprar nada.
- **jsdom.** Sigue sin entrar al repo, y ahora con un motivo más: ya no hace falta.
- **Snapshots visuales.** Playwright puede, y es otra decisión —qué se considera un cambio, dónde viven
  las imágenes de referencia— que no cabe acá.
- **Testear `domain/` o `audio/` en navegador.** Su lugar es node y no cambia.
- **Coverage.** Sigue siendo el seguimiento del 023.
- **Los tests de accesibilidad** de los specs 025 y 026, que se apoyan en esta infra pero deciden otra
  cosa.

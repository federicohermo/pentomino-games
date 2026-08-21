# Research — 029

Todo lo de acá está **medido** el 2026-08-20 en Windows 11, Node v22.18.0, pnpm 10.33.0, con la
caché de vitest caliente. Nada está estimado.

## 1. Cómo se obtuvo la línea de base

`@vitest/coverage-v8` **no está en `package.json`**, así que el primer paso fue instalarlo,
medir y revertir:

```
pnpm add -Dw @vitest/coverage-v8
npx vitest run --coverage.enabled --coverage.provider=v8 --coverage.all \
  --coverage.include='src/**/*.{ts,tsx}' \
  --coverage.exclude='src/**/__tests__/**' --coverage.exclude='src/vite-env.d.ts' \
  --coverage.reporter=text --coverage.reportOnFailure
git checkout -- package.json pnpm-lock.yaml && pnpm install --frozen-lockfile
```

`--coverage.all` es imprescindible: sin él el denominador son sólo los archivos que algún test
importó, y los diez archivos en 0 % **no aparecen**. El número sin `--all` es más lindo y no
significa nada.

`--coverage.reportOnFailure` también hace falta y no es obvio: con tests en rojo, vitest **no imprime
la tabla**. Los dos presupuestos de performance fallan bajo instrumentación (§4), así que sin ese flag
la primera corrida no reporta nada.

## 2. La línea de base

```
File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|--------
All files          |   61.97 |    56.79 |   56.07 |   60.61
 src               |       0 |        0 |       0 |       0
  App.tsx          |       0 |        0 |       0 |       0
  main.tsx         |       0 |      100 |     100 |       0
 src/audio         |   50.23 |    37.07 |   43.75 |   52.32
  engine.ts        |       0 |        0 |       0 |       0
 src/components    |   29.01 |    36.02 |   32.05 |   27.45
  Board.tsx        |       0 |        0 |       0 |       0
  OrientationPanel |       0 |        0 |       0 |       0
  PiecePalette.tsx |       0 |        0 |       0 |       0
  Playhead.tsx     |       0 |        0 |       0 |       0
  Spectrum.tsx     |       0 |        0 |       0 |       0
  TransportPanel   |       0 |        0 |       0 |       0
  route-source.ts  |   98.11 |    81.25 |     100 |     100
  use-engine.ts    |       0 |      100 |       0 |       0
  use-input.ts     |       0 |        0 |       0 |       0
 src/domain        |   98.27 |    94.73 |     100 |    97.9
  invariants.ts    |   92.98 |    83.33 |     100 |   92.78
```

Los archivos que no aparecen en la tabla están al 100 %: los cuatro módulos restantes de `domain/`,
los cuatro de `audio/`, los cinco `.ts` de `components/` y todos los `constants/` y `types/`.

**Dato útil para estimar**: `types/` y `constants/` ya están al 100 % sin esfuerzo. Los primeros
porque `erasableSyntaxOnly` los borra; los segundos porque cualquier módulo que los importe los
ejecuta. O sea que el trabajo real es el de la tabla y nada más.

Total a cerrar: **440 statements, 213 ramas, 94 funciones, 356 líneas.**

## 3. Por qué jsdom no cierra este spec (medido sobre el código real)

`Spectrum.tsx` usa, en 141 líneas: `canvas.getContext('2d')`, `createLinearGradient`,
`setTransform`, `fillText`, `ResizeObserver`, `window.matchMedia('(resolution: Xdppx)')`,
`window.devicePixelRatio`, `getBoundingClientRect`, `requestAnimationFrame`.

En jsdom:

| API | Qué pasa | Consecuencia sobre el 100 % |
|---|---|---|
| `getContext('2d')` | Devuelve `null` sin el paquete nativo `canvas` (node-gyp, build nativo en Windows) | El `if (!g) return` se come el efecto entero: 60 de las 141 líneas quedan inalcanzables |
| `getBoundingClientRect()` | Devuelve todo en cero | `resize()` fija `w = h = 0`; `drawBars` itera con `slot = 0` y `drawIdle` pinta en un lienzo de área nula |
| `ResizeObserver` | No existe | `new ResizeObserver(resize)` tira `ReferenceError` |
| `matchMedia` | No existe | `watchDpr()` tira |

`audio/engine.ts` usa `new AudioContext()` a nivel de módulo y `window.setInterval(tick, TICK_MS)`.
Ninguno de los dos existe en jsdom.

O sea: **el 100 % de esos dos archivos con jsdom exige mockear exactamente el código que se quiere
cubrir**, que es coverage sin verificación. Es la misma conclusión a la que llega el 024 por el lado
de los invariantes de layout, y por eso este spec no vuelve a abrir la discusión.

## 4. Spike de Vitest Browser Mode — corrido, en verde, y qué costó

El 024 propone la infra; acá se verificó que **el coverage la atraviesa**, que es la parte que al 024
no le tocaba mirar.

Config del spike (dos proyectos en el mismo `vite.config.ts`, con `extends: true`):

```ts
test: {
  coverage: { provider: 'v8', include: [...], exclude: [...],
              thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 } },
  projects: [
    { extends: true, test: { name: 'node', environment: 'node',
        include: ['src/**/__tests__/*.test.ts'] } },
    { extends: true, test: { name: 'browser',
        include: ['src/**/__tests__/*.browser.test.tsx'],
        browser: { enabled: true, headless: true, provider: playwright(),
                   instances: [{ browser: 'chromium' }] } } },
  ],
}
```

Con dos tests de navegador —uno de `TransportPanel`, uno de `Spectrum`— y los 322 de siempre:

| Qué se verificó | Resultado |
|---|---|
| Un solo `vitest run` corre los dos proyectos | Sí — `Test Files 17`, `Tests 324` |
| **El coverage se fusiona en un reporte único** | Sí — `Spectrum.tsx` 0 → **55,84 %** y `engine.ts` 0 → **14,95 %**, en la misma tabla que `domain/` |
| El umbral 100 corta | Sí — exit ≠ 0 y cuatro líneas `ERROR: Coverage for X does not meet global threshold (100%)` |
| v8 sirve en browser mode | Sí, **sólo con Chromium**. Vitest valida el nombre del browser y falla explícito con firefox/webkit, ofreciendo istanbul como alternativa |
| Wall clock, run completo con coverage | **7,3 s** |
| Wall clock, sólo el proyecto browser | 1,4 s |

Y `vitest-browser-react@2.2.0` exporta **`renderHook`** además de `render`, que es lo que vuelve
testeables `use-engine.ts` y `use-input.ts` sin montarlos dentro de `App`.

### Cuatro cosas que costaron un intento cada una

Van acá para que la implementación no las vuelva a pagar:

1. **`render()` de `vitest-browser-react` 2.x devuelve una `Promise`.** Sin `await`, desestructurar
   `container` da `undefined` y el error que se ve es `Cannot read properties of undefined`.
2. **El import del contexto es `from 'vitest/browser'`.** `'@vitest/browser/context'` sigue
   funcionando pero avisa por consola que se va en la próxima major.
3. **`document.querySelector` no encuentra el árbol montado**: hay que usar el `container` que
   devuelve `render`, o los locators de `page`.
4. **El peer de `@vitest/browser-playwright@4.1.11` es `vitest: 4.1.11` exacto**, no un rango. Hay que
   subir vitest de 4.1.10, o pnpm avisa `unmet peer`.

### Corrección medida a D3 del 024

El 024 dice: «Medido: un `projects[]` **no hereda** los plugins de la config raíz. Sin `react()` en el
proyecto de navegador, el JSX no compila».

Con **`extends: true`** en el proyecto sí los hereda: el spike corrió JSX en el proyecto browser
**sin** repetir `plugins`. Las dos mediciones son compatibles —sin `extends`, no hereda— pero la
conclusión de D3 («se escribe repetido y con el comentario que lo diga») deja de hacer falta si el
proyecto extiende. No es un problema de este spec y no lo arregla: queda anotado porque el 024
todavía no está implementado y le ahorra la duplicación.

## 5. Los presupuestos de performance no sobreviven la instrumentación

`domain/__tests__/sequence.test.ts:863` y `:918`. Tres corridas:

| | AC10 (techo 5 ms) | AC8 (techo 4 ms) |
|---|---|---|
| Sin coverage | pasa (suite entera en 1,76 s) | pasa |
| Con coverage, corrida 1 | **11,29 ms** | **7,53 ms** |
| Con coverage, corrida 2 | **18,56 ms** | **11,87 ms** |
| Con coverage, corrida 3 | **11,27 ms** | **6,82 ms** |

Entre 2,3× y 3,7× el techo. La dispersión entre corridas también crece, que es lo esperable: v8
inserta contadores en cada rama del Dijkstra.

Sin instrumentar, los 322 pasan en 1,76 s.

De ahí sale D2 del spec: `test` y `coverage` son dos nodos, y los dos presupuestos se saltean en el
segundo con `skipIf`.

## 6. `node --test` soporta umbrales, y el scope hay que acotarlo

Node 22.18 expone `--test-coverage-lines`, `--test-coverage-branches`, `--test-coverage-functions`,
`--test-coverage-include` y `--test-coverage-exclude`.

Sin `--test-coverage-include`, el reporte del server **incluye los `../src/**` del dominio** que
importa —`sequence.ts`, `invariants.ts`, `voice.ts`, `scheduler.ts`, los `constants/`— y mide el
paquete equivocado. Con `--test-coverage-include='src/**'` queda acotado:

```
92,38 % líneas · 94,71 % ramas · 91,36 % funciones
```

Nota: `src/index.ts` **no aparece** en el reporte porque ningún test lo importa, y node sólo reporta
lo que se cargó. Excluirlo por nombre (D3) hace explícito lo que hoy pasa por accidente.

## 7. Archivos que toca la implementación

| Archivo | Qué le pasa |
|---|---|
| `package.json` | `@vitest/coverage-v8`; scripts `coverage` y `verify` con cinco nodos; `mcp:test` con los flags |
| `vite.config.ts` | Bloque `coverage` con `include`, `exclude` y `thresholds` |
| `domain/__tests__/sequence.test.ts` | `skipIf` en los dos presupuestos |
| `domain/__tests__/invariants.test.ts` | Los casos que hacen **fallar** cada invariante |
| `components/__tests__/route-source.test.ts` | Las ramas de 141 y 148-181 |
| `audio/__tests__/engine.browser.test.tsx` | Nuevo — 374 líneas a cubrir |
| `components/__tests__/*.browser.test.tsx` | Nuevos — los seis `.tsx`, `App.tsx` y los dos hooks |
| `mcp-server/src/__tests__/*.test.ts` | `specs.ts` 176-237, `findSymbol.run`, `specStatus.run`, `symbols.ts` 241-295 |
| `CLAUDE.md` | La descripción de `verify` |
| `specs/deuda.md`, `specs/log.md` | Registro |

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| **El singleton de `engine.ts`.** `ctx`, `master` y `analyser` son estado de módulo: un test que arranca el `AudioContext` contamina al siguiente, y la rama del `catch` exige que `new AudioContext()` tire | `vi.resetModules()` + `await import()` dinámico por caso, y `vi.stubGlobal('AudioContext', ...)` para la rama del error. Es la razón por la que estos tests van en su archivo y no mezclados |
| **El 100 % se alcanza y al día siguiente alguien agrega un `if` y el PR se cae.** Es la intención, pero puede leerse como fricción | Es exactamente lo que compra el gate. Lo que hay que cuidar es que el mensaje de error sea legible: por eso el reporter `text` queda, y no sólo el resumen |
| **Chromium fuera del lockfile.** `pnpm install` no lo trae; un clone nuevo corre `verify` y falla con un error de playwright | Es del 024 y del 023 (que lo instala en CI). Acá sólo se hereda. Vale que el `quickstart.md` lo diga |
| **Depende de dos specs sin implementar.** Si el 024 cambia de forma, la mitad de las tareas de acá cambian de destino | Las tareas del proyecto de navegador están agrupadas y marcadas en `tasks.md`; las que no dependen del 024 son la mayoría del trabajo de configuración y todo el `mcp-server` |
| **`route-source.ts` 148-181 pueden ser ramas defensivas inalcanzables** | D4 manda: si lo son, se borran o se vuelven alcanzables, y queda anotado acá cuál fue |

## 9. Pase de mutacion — que pasa cuando el codigo se rompe a proposito

El coverage dice que la linea se ejecuto, no que el test la verifique. Antes de dar los
tests por buenos se corrieron **18 mutaciones** sobre el codigo de produccion, cada una
seguida del test que deberia atraparla. El resultado de la PRIMERA corrida fue el
argumento mas fuerte a favor de hacerlo: **cuatro tests seguian en verde con el
comportamiento roto**.

| Mutacion | 1ra corrida | Despues |
|---|---|---|
| `{ passive: false }` → `{ passive: true }` en la rueda | SOBREVIVE* | muere |
| La caja de la miniatura pasa a `min-content` | **SOBREVIVE** | muere |
| Rearmar el velo vuelve a tapar lo ya estrenado | **SOBREVIVE** | muere |
| `startClock` deja de ser idempotente | **SOBREVIVE** | muere |
| `ids` sale de `porPieza` en vez de `s.steps` | SOBREVIVE | **equivalente** |
| Las otras 13 | mueren | mueren |

**\*El primero era un falso positivo, y la leccion es del metodo:** la cadena
`{ passive: false }` aparece **primero en un comentario** tres lineas mas arriba, asi
que la mutacion editaba el comentario y no el codigo. Aplicada sobre la linea real, el
test moria. O sea que un pase de mutacion tambien hay que verificarlo: un mutante que
"sobrevive" puede ser un mutante que nunca nacio.

Los tres reales y como se cerraron:

- **La caja de la miniatura.** El test comparaba anchos ENTRE rotaciones, y con
  `min-content` las cinco pistas colapsan a cero **todas por igual**, asi que la
  comparacion seguia dando verde. Se agrego la afirmacion del TAMANO absoluto:
  `5 × MINI_CELL_PX`.
- **El velo rearmado.** El test dejaba la cabeza parada sobre la celda, asi que el bucle
  de estreno la volvia a destapar en el mismo cuadro y tapaba el bug. Se corre la cabeza
  antes de rearmar.
- **`startClock` idempotente.** El test miraba `clockRunning()`, que sigue diciendo que
  si: lo que queda roto es un segundo timer huerfano. Se cuentan los `setInterval`.

El sobreviviente que queda es **equivalente**: `ids` sale de `s.steps` para que un paso
sin pieza igual aparezca en la lista —que es lo que hace alcanzables los dos `?? []` de
`recomputarVelo`— pero sacarlo de `porPieza` produce exactamente el mismo velo y las
mismas marcas. Cambia el interior sin cambiar nada observable, asi que no hay test que
pueda matarlo sin afirmar sobre estructura interna.

El script vive fuera del repo (es una herramienta de una corrida, no infraestructura):
aplica cada mutacion con un reemplazo textual, corre el test dirigido y revierte con
`git checkout --`.

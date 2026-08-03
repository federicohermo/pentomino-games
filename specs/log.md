# Log de Specs

Registro de todo el trabajo especificado, en orden. La convención de formato está en
[README.md](./README.md).

**Estados:** `Propuesto` (spec escrito, sin implementar) · `En curso` (rama abierta) ·
`Implementado` (mergeado) · `Descartado` (con el motivo anotado).

| Spec | Fecha | Estado | Descripción |
|------|-------|--------|-------------|
| [001](./001-notas-por-celda-en-orden-angular/spec.md) | 2026-08-02 | Propuesto | Asignar cada nota a una celda de la pieza, en orden angular alrededor del centroide |
| [002](./002-motor-de-audio-propio-sobre-web-audio/spec.md) | 2026-08-02 | Implementado | Reemplazar Tone.js por un motor propio sobre Web Audio: síntesis, scheduler con lookahead y audio testeable |
| [003](./003-visualizacion-de-la-senal-con-analysernode/spec.md) | 2026-08-02 | Propuesto | Visualizar la señal con `AnalyserNode`: espectro en canvas, con el mapeo bins→barras como función pura testeable |
| [004](./004-fase-por-pieza-la-columna-como-posicion-en-el-compas/spec.md) | 2026-08-02 | Propuesto | La columna de la celda de agarre determina en qué momento del compás arranca la pieza: el tablero pasa a ser un secuenciador |
| [005](./005-modularizacion-de-src-en-capas/spec.md) | 2026-08-03 | Propuesto | `src/` en capas (`domain` · `audio` · `components`) con dirección de dependencia verificada por el linter, carpetas por rol y los primeros tests del dominio. Sin cambio de comportamiento |
| [006](./006-mcp-server-de-dominio-ejecutable/spec.md) | 2026-08-03 | Propuesto | MCP server que **ejecuta** el dominio en vez de indexar el código: forma, notas, simulación del scheduler e invariantes, en una llamada. Las tools importan de `src/`, no reimplementan |

## Dependencias entre specs

- **001 y 002 son ortogonales.** Uno decide qué nota va en qué celda; el otro, cómo se produce el
  sonido. Se pueden implementar en cualquier orden.
- **003 dependía de 002, y ya está desbloqueado.** Con Tone el grafo era interno a la librería y no
  había dónde insertar el analizador; con el motor propio, `master.connect(analyser)` es una línea. Su
  paso 1 (el mapeo puro) es independiente y mergeable solo.
- **El prerrequisito de Vitest está resuelto y versionado** por el spec 002: `vitest` +
  `node-web-audio-api`, bloque `test` en `vite.config.ts`, `environment: 'node'`. El spec 001 lo hereda.
- **004 depende de 002, y más fuerte que 003.** No solo se apoya en el motor propio: **reescribe
  `collectHits`**. Con 002 ya mergeado, su rama se puede abrir.
- **004 y 003 se refuerzan pero no se bloquean.** 004 hace que la posición en el tablero suene
  distinto; 003 trae el canvas donde se podría *ver* esa posición. Sin 003, la fase de 004 se oye pero
  no se lee — está anotado como su limitación consciente.
- **004 y 001 son ortogonales.** 001 decide qué nota va en qué celda de la pieza; 004, en qué momento
  del compás arranca la pieza según su columna. Ambos usan el mismo invariante de orden del array.
- **005 conviene primero, y le ahorra trabajo a 001, 003 y 004.** Es el único que reorganiza `src/`
  sin cambiar comportamiento; los tres tocan `App.tsx` o `engine.ts`, así que mergearlo antes hace más
  chicas sus ramas. En particular resuelve la tarea que 001 tiene anotada como "preferible" —extraer
  las puras— y le deja a 004 un `scheduler.ts` de 50 líneas en vez de un `engine.ts` de 244.
- **006 depende de 005, y de forma material, no estética.** Node no carga `.tsx` y las puras de
  `App.tsx` no están exportadas: sin los módulos de `src/domain/` no hay nada que el server pueda
  ejecutar. Le alcanzan las **fases 1–3** de 005 (tipos, dominio, tablero, invariantes, audio); la fase
  4 —los componentes— no lo bloquea.
- **Separar 005 de 006 eliminó una duplicación que ya estaba planificada.** Mientras eran un spec solo,
  el server iba a tener su propio `board.ts` con la colocación y la validez, porque las de la app viven
  atrapadas dentro del componente: dos copias de la regla del juego. Con `domain/board.ts` en 005, las
  tools de 006 importan y no reimplementan.
- **006 se acopla a `collectHits`, que 004 reescribe.** Si 004 va primero, `simulate_board` se escribe
  contra la firma nueva; si va primero 006, 004 actualiza la tool y a cambio **la usa como
  instrumento**: la línea de tiempo de onsets es la forma de verificar sus AC1–AC7 sin escuchar.
- **006 es el único spec que no toca `src/` en absoluto.** Es tooling puro. 005 sí lo toca —es su
  objeto— pero sin alterar comportamiento.

## Notas de revisión

- **2026-08-02 — Review del spec 002.** Ejecutar los tests propuestos corrigió dos cosas que leyendo el
  plan no se veían: la detección de onsets necesita un seguidor de envolvente (un umbral crudo dio 21
  falsos onsets para 3 notas) y la tolerancia de AC5 es ±6 ms, no ±1 ms. Además, investigar las
  implementaciones de audio de ElevenLabs promovió la visualización de "seguimiento" vago a spec 003, y
  descartó explícitamente la síntesis por `AudioWorklet`.
- **2026-08-02 — El spec 004 salió de escuchar, no de planificar.** El reporte fue "las piezas suenan
  siempre superpuestas". Separarlo en dos ejes medibles mostró que uno (las notas dentro de un arpegio)
  es preexistente y con el 002 se solapa *menos*, y que el otro (las piezas entre sí) **lo introdujo el
  002**: la simplificación de "los jobs son datos puros" eliminó la fase por pieza, y eso no se
  registró como precio. Ver su `research.md`.
- **2026-08-02 — El spec 006 salió de copiar un server ajeno y medir que no servía.** El pedido era
  "un MCP server como el de `bait-landing-frontend`". Medir los dos repos descartó lo esencial de ese
  diseño: allá el server indexa 135 archivos con `ts-morph` porque localizar es el costo dominante;
  acá `src/` son 8 archivos y 25 KB, así que un índice de símbolos cuesta todo y ahorra nada. Lo caro
  de este repo se midió corriendo las puras sobre las 96 combinaciones de pieza × rotación × mirror:
  96 entradas dan **67 formas distintas**, `X` tiene una sola forma y cuatro escalas, y en seis piezas
  la reflexión se oye pero no se ve. Nada de eso se lee en el código. Se heredó el andamiaje y se
  cambió la capa de datos.
- **2026-08-03 — El spec 005 nació de partir en dos al 006, y la estructura la decidió el linter.** El
  server necesitaba el dominio como módulo, así que el spec original hacía dos cosas: reorganizar `src/`
  y montar el tooling. Separarlos dejó ver que la reorganización se justifica sola. La medición que la
  decidió no fue de gusto: `npx eslint` sobre un `.tsx` que exporta una constante además del componente
  **falla hoy** (`react-refresh/only-export-components`), o sea que **la organización actual prohíbe
  exportar el dominio, y por lo tanto testearlo** — de ahí que la geometría y la música tengan cero
  cobertura mientras el audio tiene 17 tests. La misma regla, con otro mensaje, prohíbe fusionar el
  entry con el componente raíz. El resto se investigó con context7: Vite documenta los barrel files
  como problema de performance y recomienda rutas de import explícitas; React avala componentes de un
  solo uso y desaconseja los hooks sin propósito específico; de bulletproof-react se tomaron la
  dirección única entre capas, hacerla cumplir con el linter y las subcarpetas por rol, y se
  descartaron `features/`, `stores/`, `api/` y `config/` por vacías a esta escala. Extender la regla a
  las constantes destapó **cuatro pares de números que hoy tienen que coincidir y nada sincroniza**: el
  `0.35` de `NOTE_DUR` está también como default de `scheduleVoice`, el `110` del tempo está en la UI y
  en el motor, y los tamaños de celda (`28px`/`w-7`, `20px`/`w-5`) conviven con su clase de Tailwind. Y
  sobre `enum`: **no hay ninguno y el repo no los admite** — `erasableSyntaxOnly` los rechaza con
  `TS1294`, que es la misma opción que hace type-strippable al código y por lo tanto sostiene al spec
  006. El reemplazo es const-object en `constants/` + union type en `types/`.
- **2026-08-03 — El repo migró de npm a pnpm, y el que más cambia es el 006.** Se midió antes de
  decidir, sobre este mismo `package.json` y en el mismo volumen: install en frío `pnpm` **2,2 s** ·
  `bun` 5,6 s · `npm ci` 6,9 s; y `node_modules` con **19 entradas directas** contra las 196 planas de
  npm. Bun se descartó con evidencia, no por gusto: falla al migrar el `package-lock.json` de este repo
  (`Could not resolve package 'tslib' … NotAllPackagesGotResolved`), **ignora el lockfile en silencio**
  y resuelve versiones nuevas —subió vite 7.1.5 → 7.3.6 y react 19.1.1 → 19.2.8 sin pedirlo—, además de
  ser más lento que pnpm en Windows y de dejar el `node_modules` plano, que es justo lo que no sirve
  acá. El beneficio grande no es el disco: el **spec 006** tenía toda una estrategia montada alrededor
  de un bug de npm (`npm --prefix mcp-server install` ensucia el `package.json` del server con un
  `file:..`, de ahí el `cd mcp-server` obligatorio). Con el workspace de pnpm eso desaparece — un
  `pnpm install` desde la raíz, el aislamiento garantizado por el gestor y un solo lockfile. Verificado
  sobre un prototipo del layout de dos paquetes antes de reescribir el plan. El `node_modules` estricto
  además ataja de antemano el riesgo que el 006 ya tenía anotado: un import fantasma que Vite resuelve
  y `node` no.

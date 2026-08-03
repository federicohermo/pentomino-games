# Log de Specs

Registro de todo el trabajo especificado, en orden. La convención de formato está en
[README.md](./README.md).

**Estados:** `Propuesto` (spec escrito, sin implementar) · `En curso` (rama abierta) ·
`Implementado` (mergeado) · `Descartado` (con el motivo anotado).

| Spec | Fecha | Estado | Descripción |
|------|-------|--------|-------------|
| [001](./001-notas-por-celda-en-orden-angular/spec.md) | 2026-08-02 | Propuesto | Asignar cada nota a una celda de la pieza, en orden angular alrededor del centroide |
| [002](./002-motor-de-audio-propio-sobre-web-audio/spec.md) | 2026-08-02 | Propuesto | Reemplazar Tone.js por un motor propio sobre Web Audio: síntesis, scheduler con lookahead y audio testeable |
| [003](./003-visualizacion-de-la-senal-con-analysernode/spec.md) | 2026-08-02 | Propuesto | Visualizar la señal con `AnalyserNode`: espectro en canvas, con el mapeo bins→barras como función pura testeable |
| [004](./004-fase-por-pieza-la-columna-como-posicion-en-el-compas/spec.md) | 2026-08-02 | Propuesto | La columna de la celda de agarre determina en qué momento del compás arranca la pieza: el tablero pasa a ser un secuenciador |

## Dependencias entre specs

- **001 y 002 son ortogonales.** Uno decide qué nota va en qué celda; el otro, cómo se produce el
  sonido. Se pueden implementar en cualquier orden.
- **003 depende de 002.** Con Tone el grafo es interno a la librería y no hay dónde insertar el
  analizador. Su paso 1 (el mapeo puro) sí es independiente y mergeable solo.
- **El prerrequisito de Vitest ya está resuelto.** `vitest` y `node-web-audio-api` están instalados y
  verificados; falta versionar el bloque `test` en `vite.config.ts`.
- **El gate de 002 ya pasó.** Se ejecutó durante el review del spec: los cuatro tests propuestos en
  verde, con números idénticos a Chrome dentro del 2%. Ver su `research.md`.
- **004 depende de 002, y más fuerte que 003.** No solo se apoya en el motor propio: **reescribe
  `collectHits`**. Abrir su rama antes de que 002 esté mergeado garantiza el conflicto.
- **004 y 003 se refuerzan pero no se bloquean.** 004 hace que la posición en el tablero suene
  distinto; 003 trae el canvas donde se podría *ver* esa posición. Sin 003, la fase de 004 se oye pero
  no se lee — está anotado como su limitación consciente.
- **004 y 001 son ortogonales.** 001 decide qué nota va en qué celda de la pieza; 004, en qué momento
  del compás arranca la pieza según su columna. Ambos usan el mismo invariante de orden del array.

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

# Tareas — `src/` en capas

> **Regla que gobierna todo el spec:** cero cambio de comportamiento. Al terminar cada fase se corre la
> verificación completa, no solo al final.

## Backlog
- [ ] Commitear el spec a `main` **antes** de crear la rama (convención de `specs/README.md`)
- [ ] Confirmar que ninguna rama de 001/003/004 está abierta: los tres tocan `App.tsx` o `engine.ts` y
      conviene que este spec entre primero
- [ ] **Crear rama** `feature/005-modularizacion-de-src-en-capas`

## Fase 1 — Tipos, constantes y dominio puro
- [ ] `domain/types/transform.types.ts` — `Cell`
- [ ] `domain/types/pieces.types.ts` — `PieceKey` **declarado explícito** (12 literales), no derivado
      de `keyof typeof BASE_MAP`
- [ ] `domain/types/board.types.ts` — `PlacedPiece`
- [ ] `domain/constants/pieces.constants.ts` — `SHAPES`, `ANCHOR_INDEX`, **con sus comentarios**
      (el porqué del ancla viaja con el dato, no se queda huérfano)
- [ ] `domain/constants/music.constants.ts` — `CHROMATIC`, `PENT_MAJOR`, `PENT_MINOR`, `PENT_BLUES5`,
      `BASE_MAP: Record<PieceKey, number>`, `DEFAULT_OCTAVE = 4`
- [ ] `domain/transform.ts` — `rotate90`, `normalize`, `rotateN`, `reflect`, **con el comentario del
      invariante del orden del array**
- [ ] `domain/music.ts` — `midiFor`, `midiName`, `notesForRotation`, con el comentario del corrimiento
      de octava. **Sin tablas**: el mapeo rotación → fórmula se queda, las fórmulas se van
- [ ] Confirmar que **`pieces.ts` no existe** como módulo: era solo datos y se disolvió en `constants/`
- [ ] `App.tsx` importando de los módulos nuevos, con extensión `.ts` explícita
- [ ] `domain/__tests__/transform.test.ts` · `music.test.ts`
- [ ] Verificación completa (`tsc`, `lint`, `test`, `build`, abrir la app)

## Fase 2 — Tablero e invariantes
- [ ] `domain/constants/board.constants.ts` — `GRID_W`, `GRID_H`
- [ ] `domain/board.ts` — `cellsAt(shape, anchorIndex, x, y)`,
      `isValid(cells, placed: readonly PlacedPiece[])`, `occupantAt(placed, x, y)`
- [ ] `App.tsx` usa las tres; **ninguna queda declarada dentro del componente** (AC5)
- [ ] `domain/invariants.ts` — los cinco `check*` devolviendo `CheckResult`, sin lanzar ni asertar
      (así los reutiliza el spec 006), y `checkAll()`
- [ ] El helper `sameCell` que normaliza el cero (`x + 0`) — AC7
- [ ] `domain/__tests__/board.test.ts` — fuera del tablero, choque contra pieza existente, y que la
      celda de agarre caiga donde se clickeó (AC8)
- [ ] `domain/__tests__/invariants.test.ts` — los cinco en verde sobre las 96 combinaciones (AC6)
- [ ] Un test que compruebe que el chequeo **detecta** una regresión: con una forma mutada a mano (celda
      repetida, orden reordenado), el chequeo tiene que dar rojo
- [ ] Un test de `-0`: comparar celdas crudas de `rotate90`/`reflect` contra su equivalente con `0`
- [ ] Verificación completa

## Fase 3 — Audio en tres módulos
- [ ] `audio/types/voice.types.ts` (`VoiceOpts`) y `audio/types/scheduler.types.ts` (`Job`,
      `ClockState`, `Hit`)
- [ ] `audio/constants/voice.constants.ts` — `DEFAULT_VOICE`, `NOTE_DUR = 0.35`,
      `DEFAULT_VELOCITY = 0.8`
- [ ] `audio/constants/scheduler.constants.ts` — `LOOKAHEAD = 0.1`, `TICK_MS = 25`
- [ ] `audio/constants/engine.constants.ts` — `MASTER_GAIN = 0.3`, `ARPEGGIO_SPREAD = 0.15`,
      `DEFAULT_BPM = 110`, `PLAY_DELAY = 0.02`, `CLOCK_START_DELAY = 0.05`
- [ ] **Deduplicar `NOTE_DUR`**: la firma de `scheduleVoice` pasa a `dur = NOTE_DUR` y `vel =
      DEFAULT_VELOCITY`. Hoy el `0.35` está escrito dos veces (líneas 52 y 180) y el `0.8` una vez como
      literal
- [ ] **Deduplicar el tempo**: `let bpm = DEFAULT_BPM` en el motor y `useState(DEFAULT_BPM)` en la UI.
      Hoy el `110` está en los dos lados sin nada que los sincronice
- [ ] `audio/voice.ts` — `midiToHz`, `scheduleVoice`, con el comentario del `setValueAtTime(0, at)` y
      el de las rampas lineales
- [ ] `audio/scheduler.ts` — `barDuration`, `collectHits`, **con los dos comentarios largos enteros**
      (el del iterable materializado y el de la guarda de recuperación)
- [ ] `audio/engine.ts` — solo la capa 3; importa de `voice.ts` y `scheduler.ts` y **no re-exporta en
      bloque**
- [ ] Mover `test-context.ts` a `audio/__tests__/`
- [ ] Repartir `engine.test.ts` → `__tests__/voice.test.ts` (7), `scheduler.test.ts` (8),
      `integration.test.ts` (2), **sin editar aserciones**
- [ ] `scheduler.test.ts` con su propio `const SPREAD = 0.15`, sin importar `ARPEGGIO_SPREAD` (AC10)
- [ ] Borrar `audio/engine.test.ts`
- [ ] `pnpm test` sigue reportando **27** (AC9)
- [ ] Verificación completa

## Fase 4 — Componentes *(la única fase opcional)*
- [ ] `components/constants/layout.constants.ts` — `CELL_PX = 28`, `PREVIEW_CELL_PX = 20`,
      `TEMPO_MIN = 60`, `TEMPO_MAX = 160`
- [ ] **Unificar el tamaño de celda**: las celdas pasan a `style={{ width: CELL_PX, height: CELL_PX }}`
      y pierden `w-7 h-7`; ídem `w-5 h-5` con `PREVIEW_CELL_PX`. `w-7` es 1.75rem = 28px, así que el
      render no cambia — **es el único punto del spec que toca el markup**
- [ ] `components/PiecePalette.tsx` — paleta, rotación, reflexión, tempo, transporte
- [ ] `components/Board.tsx` — grilla y fantasma
- [ ] `components/PiecePreview.tsx` — previsualización con el ancla
- [ ] `components/PlacedList.tsx` — lista de colocadas
- [ ] `Props` inline y **sin exportar** en cada uno; ningún export que no sea el componente
- [ ] Sin estado, sin efectos, sin `useMemo` en los cuatro
- [ ] `App.tsx` compone los cuatro y queda con estado + derivados + handlers + efectos
- [ ] Verificación completa, **con revisión visual panel por panel** (es la fase sin cobertura de tests)

## Fase 5 — Entry, estilos y limpieza
- [ ] `src/index.css` → `src/styles/index.css`
- [ ] `src/index.tsx` → `src/main.tsx`, con `import { StrictMode }` en vez de `import React`
- [ ] `index.html` apunta a `/src/main.tsx`
- [ ] Buscar en el repo que no quede ninguna mención a `src/index.tsx` (hoy hay cuatro: tres en `docs/`
      y la de `index.html`) — AC12
- [ ] **Commit aparte:** borrar `src/setupTests.ts` (muerto: `vite.config.ts` no declara `setupFiles`)
- [ ] Verificación completa

## Fase 6 — Linter y documentación
- [ ] Overrides de `@typescript-eslint/no-restricted-imports` para `src/domain/**` y `src/audio/**`,
      con los patrones `../` **y** `../../`
- [ ] **Probar que la regla falla**: import prohibido desde un módulo y desde un test, `pnpm lint`
      en rojo con el mensaje del override en los dos casos (AC3). Revertir después
- [ ] Confirmar que no hay ningún `index.ts` de re-exportación y que **todos** los imports locales
      llevan extensión (AC4)
- [ ] Confirmar que no quedó ninguna carpeta de rol vacía, y que `constants/` solo importa tipos (AC4b)
- [ ] **Barrer los literales que quedaron** (AC4c): `grep -n "[0-9]\{1,\}\.\?[0-9]*" src/domain/*.ts
      src/audio/*.ts` y revisar que lo que sobrevive no tenga nombre posible (un `+1` de índice, un
      `/2`). Confirmar que ningún módulo `.ts` de capa declara una constante
- [ ] Confirmar que **no hay ningún `enum`** — y que no puede haberlo: el `erasableSyntaxOnly` del
      tsconfig lo rechaza con `TS1294` (D12b)
- [ ] `CLAUDE.md` — sección "Organización" reescrita: cuatro capas y su dirección; barrels, extensión
      y dirección entran a "Invariantes"
- [ ] `docs/architecture/directory-structure.md` — árbol nuevo + "dónde crear cada cosa" con los roles
- [ ] `docs/architecture/overview.md` — diagrama de capas y `src/main.tsx`
- [ ] `docs/architecture/modelo-musical.md` — las puras viven en `src/domain/music.ts`
- [ ] `docs/architecture/audio.md` — tres bloques = tres archivos; la inyección de `ctx` es estructural
- [ ] `docs/guides/conventions.md` — dirección, las dos tablas de D12 (roles y crecimiento), **la regla
      de que los módulos no declaran constantes**, **la prohibición de `enum` con su motivo** (rompe el
      type-stripping del que depende el spec 006) y el patrón const-object + union como reemplazo, sin
      barrels, extensión explícita, sin alias, un componente por archivo, y la nota de la profundidad de
      los patrones del linter
- [ ] `docs/guides/troubleshooting.md` — referencia a `src/index.tsx`
- [ ] `specs/001/tasks.md` — marcar resuelta la tarea "evaluar extraer las puras" y apuntar al módulo
- [ ] `specs/log.md` — estado de 005 a `Implementado`

## Verificación final
- [ ] `pnpm exec tsc -b --noEmit` en 0
- [ ] `pnpm lint` en 0
- [ ] `pnpm test` en verde con **27 tests de audio + los nuevos del dominio**
- [ ] `pnpm build` en verde
- [ ] **Las 96 combinaciones a mano en la app**: recorrer las 12 piezas con las 4 rotaciones y el
      mirror, comparando forma, ancla y notas contra los valores de referencia del `research.md`. Es la
      verificación que decide si AC1 se cumplió
- [ ] Colocar 3–4 piezas, prender el loop, cambiar el tempo: suena igual que antes
- [ ] `pnpm dev` y editar un componente: **Fast Refresh sin recarga completa** y sin perder el
      tablero armado (es lo que D14 promete)

## PR
- [ ] Un commit por fase, más el del borrado — revertir la UI no debe revertir el dominio
- [ ] Explicar que **no hay cambio de comportamiento** y cuál es la única firma que cambia
      (`PieceKey` explícito → `BASE_MAP: Record<PieceKey, number>`)
- [ ] Nombrar las dos mediciones que decidieron la estructura: los dos errores de
      `react-refresh/only-export-components`
- [ ] `/pr-review` antes de pedir revisión

## Seguimiento (no bloquea)
- [ ] **Rotación como tipo cerrado.** Hoy es `rotation: number` comparada contra `0|1|2|3` en cuatro
      lugares. El patrón ya está decidido (D12b): `ROTATION` como const-object en
      `domain/constants/rotation.constants.ts` + `type Rotation` derivado en `types/`. **Nunca un
      `enum`** — el tsconfig lo rechaza. Cambia firmas, por eso no entra a este spec
- [ ] **`postcss` y `autoprefixer` están en `devDependencies` sin ningún config que los use** (no hay
      `postcss.config.*`; Tailwind 4 va por el plugin de Vite). Candidatos a borrar, en su propio commit
- [ ] `@types/jest` sigue en el árbol y es lo que impide usar `globals: true` en Vitest — sacarlo
      permitiría simplificar los imports de los tests
- [ ] `public/manifest.json` sigue con los valores por defecto de CRA
- [ ] Tests de componentes: requieren `jsdom` en su propio bloque de config y un `setupFiles`, sin
      cambiar el `environment` global que necesita el audio
- [ ] Cuando aparezca el primer token de diseño, partir `styles/index.css` en `theme.css` + `base.css`

# Inicio Rápido

## Requisitos Previos

- **Node ≥ 20.19 o ≥ 22.12.** No es una recomendación: Vite 7 lo declara en `engines`
  (`^20.19.0 || >=22.12.0`) y con Node 18 el build falla.
- **pnpm** (el repo versiona `pnpm-lock.yaml`). La versión está fijada en `packageManager` dentro del
  `package.json`; con Corepack activado (`corepack enable pnpm`) no hace falta instalarlo a mano.

## Instalación

```bash
pnpm install
pnpm dev
```

Desde la raíz del repo: no hay subdirectorio de app.

El dev server queda en `http://localhost:5173`. Para fijar otro puerto:

```bash
pnpm exec vite --port 5199 --strictPort
```

`--strictPort` hace que falle si el puerto está ocupado, en vez de saltar en silencio al siguiente —
útil cuando algo tiene que estar en un puerto conocido.

**No hay variables de entorno que configurar.** La app es enteramente cliente.

## Comandos

```bash
pnpm dev      # Dev server con HMR
pnpm build    # tsc -b && vite build → dist/
pnpm lint     # ESLint
pnpm preview  # Sirve dist/ como lo haría producción
pnpm test     # Vitest
```

`pnpm build` corre el typecheck **antes** del bundle. Un error de tipos rompe el build aunque el
código funcione en dev, donde Vite no typechequea.

Para verificar tipos sin buildear:

```bash
pnpm exec tsc -b --noEmit
```

## Flujos de trabajo típicos

### Agregar una pieza o cambiar una forma

1. Editar `SHAPES` en `src/domain/constants/pieces.constants.ts`. Las coordenadas son `[x, y]` con `y`
   creciendo **hacia abajo**.
2. Si se agrega una pieza, agregarla a `PieceKey` en `domain/types/pieces.types.ts` y actualizar
   `BASE_MAP` (su tónica, en `music.constants.ts`) y `ANCHOR_INDEX` (su celda de agarre, como índice
   dentro del array de celdas). Los tres son `Record<PieceKey, …>`, así que olvidarse de uno **no
   compila**.
3. Verificar que la celda de agarre elegida sea una celda **central**: es la que queda bajo el cursor, y
   si cae en un hueco del bounding box la colocación se siente rota.

### Cambiar cómo suena algo

Para el **timbre**, `DEFAULT_VOICE` en `src/audio/constants/voice.constants.ts` (ADSR y tipo de onda): alcanza con tocarlo
ahí, porque los dos caminos de reproducción pasan por `scheduleVoice()`. Agregar un test de envolvente
si se cambia la forma.

Para el **espaciado del arpegio**, cuidado: `playNotes()` lo aplica para el disparo al colocar y
`collectHits()` para el loop. Son dos lugares. Detalle en
[audio.md](../architecture/audio.md#los-dos-caminos-de-reproducción).

**No romper la inyección del contexto**: `scheduleVoice` y `collectHits` reciben el `AudioContext` por
parámetro. Si empiezan a tomarlo del singleton, dejan de ser testeables.

### Verificar audio sin oírlo

En tests, `OfflineAudioContext` renderiza determinísticamente y permite afirmar sobre frecuencia,
envolvente e instantes. En el navegador, `jobCount()` y el conteo de osciladores. Recetas en
[audio.md](../architecture/audio.md#cómo-verificar-el-audio).

### Antes de un cambio grande

Escribir un spec en `specs/`, commitearlo a `main`, y recién ahí sacar la rama de feature. Ver
[specs/README.md](../../specs/README.md).

## Verificación antes de un PR

```bash
pnpm exec tsc -b --noEmit   # tipos
pnpm lint                   # estilo
pnpm build                  # build completo
pnpm preview                # y probarlo a mano
```

Los tests corren en Node contra `node-web-audio-api`, no en jsdom.

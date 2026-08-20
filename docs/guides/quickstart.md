# Inicio Rápido

## Requisitos Previos

- **Node ≥ 20.19 o ≥ 22.12.** No es una recomendación: Vite 7 lo declara en `engines`
  (`^20.19.0 || >=22.12.0`) y con Node 18 el build falla.
- **Node ≥ 22.18 si además se quiere el MCP server**, que corre TypeScript sin compilar. Es un piso más
  alto y **solo para el tooling**: con Node 20 el server no arranca y la app, el build y el deploy
  siguen igual.
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
pnpm dev            # Dev server con HMR
pnpm build          # tsc -b && vite build → dist/
pnpm lint           # ESLint
pnpm preview        # Sirve dist/ como lo haría producción
pnpm test           # Vitest
pnpm mcp:test       # MCP server: typecheck + node --test
pnpm mcp:typecheck  # MCP server: solo tsc
```

`pnpm install` desde la raíz instala los **dos** paquetes del workspace: la app y `mcp-server/`. No hay
que entrar a la carpeta ni pasar prefijos.

`pnpm build` corre el typecheck **antes** del bundle. Un error de tipos rompe el build aunque el
código funcione en dev, donde Vite no typechequea.

Para verificar tipos sin buildear:

```bash
pnpm exec tsc -b --noEmit
```

## Cómo se toca

Los tres gestos que gobiernan la pieza **por colocar** tienen una segunda vía, más corta que ir al
panel: el panel se queda y sigue siendo quien **muestra** el estado, así que los atajos se descubren
solos —se rota con la rueda y se ve iluminarse `180°` en la paleta—.

| Gesto | Qué hace | Dónde escucha |
|---|---|---|
| Rueda abajo / arriba | Rotación `+90°` / `−90°` | Solo sobre el tablero |
| `Shift` (tap) | Rotación `+90°` | Toda la ventana, al **soltar** |
| Botón derecho | Alterna la reflexión | Solo sobre el tablero |
| `Ctrl` (tap) | Alterna la reflexión | Toda la ventana, al **soltar** |
| Barra espaciadora | Play / pausa | Toda la ventana |
| Click en una celda | Coloca la pieza y la escucha | El tablero |

Tres cosas que parecen bugs y no lo son:

- **Con el cursor sobre el tablero la página no scrollea.** Es el precio de que la rueda rote sin
  scrollear a la vez, que sería peor que no rotar. Queda toda la paleta, el panel de señal y el margen
  para scrollear, y es el trato que hace cualquier mapa embebido.
- **`Ctrl`+rueda hace el zoom del navegador y no rota**, y `Ctrl`+C no da vuelta la reflexión. Los
  modificadores actúan al **soltar** y solo si mientras estuvieron abajo no llegó otra tecla ni la
  rueda: un gesto del sistema le gana a uno nuestro.
- **Con el botón de Play enfocado, la barra activa ese botón** — y con el foco sobre `Reset`, activa
  `Reset`. Es el comportamiento nativo, y es el correcto: el foco dice qué control está armado.

El tablero **no se alcanza con el teclado** (las celdas son `div` sin `tabIndex`); es deuda conocida y
está en [specs/deuda.md](../../specs/deuda.md). Los atajos de arriba son globales y funcionan sin foco,
así que no dependen de eso.

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

Para el **espaciado del arpegio**, una sola definición usada en dos lugares: `intervalDuration(bpm)` la
fija, y tanto `playNotes()` (el disparo al colocar) como `collectHits()` (el loop) la consumen. Tocar la
definición alcanza para los dos. Detalle en
[audio.md](../architecture/audio.md#los-dos-caminos-de-reproducción).

**No romper la inyección del contexto**: `scheduleVoice` y `collectHits` reciben el `AudioContext` por
parámetro. Si empiezan a tomarlo del singleton, dejan de ser testeables.

### Verificar audio sin oírlo

En tests, `OfflineAudioContext` renderiza determinísticamente y permite afirmar sobre frecuencia,
envolvente e instantes. En el navegador, `sequenceInfo()` —pasos, clicks mudos, cruces con altura y
largo del ciclo de la secuencia activa— y el conteo de osciladores. Recetas en
[audio.md](../architecture/audio.md#cómo-verificar-el-audio).

### Preguntarle al modelo en vez de simularlo

Antes de derivar a mano qué notas suenan, qué forma queda o qué onsets produce un tablero, están las
tools del MCP server: `describe_piece`, `simulate_board`, `check_invariants` y `spec_status`. Ejecutan
las funciones puras reales, así que responden lo que el código hace hoy. Catálogo y recetas en
[mcp-domain.md](./mcp-domain.md).

### Antes de un cambio grande

Escribir un spec en `specs/`, commitearlo a `main`, y recién ahí sacar la rama de feature. Ver
[specs/README.md](../../specs/README.md).

## Verificación antes de un PR

```bash
pnpm exec tsc -b --noEmit   # tipos
pnpm lint                   # estilo
pnpm test                   # Vitest
pnpm mcp:test               # el MCP server, si se tocó src/ o el server
pnpm build                  # build completo
pnpm preview                # y probarlo a mano
```

`pnpm mcp:test` no es opcional al tocar `src/domain/` o `src/audio/`: el server importa esos módulos con
node crudo, así que es lo único que ataja un import sin extensión — que **no** rompe el build de la app.

Los tests corren en Node contra `node-web-audio-api`, no en jsdom.

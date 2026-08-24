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
pnpm exec playwright install chromium
pnpm dev
```

Desde la raíz del repo: no hay subdirectorio de app.

**El segundo comando hace falta una sola vez, y no se puede saltear si vas a correr los tests.** Es
para el **clone local**: en CI lo hace el workflow del spec 023, con `--with-deps` porque el runner de
Ubuntu tampoco trae las librerías de sistema que Chromium pide.
Desde el spec 029 los tests de `src/` son dos proyectos de Vitest y uno corre en un Chromium de
verdad —es la única forma de cubrir el canvas del espectro y el `AudioContext` del motor—. El binario
del navegador **no está en el lockfile**, así que `pnpm install` no lo trae y `pnpm verify` falla con
un error de Playwright hasta que se lo instala. Ocupa ~700 MB en la caché del usuario
(`%LOCALAPPDATA%\ms-playwright` en Windows, `~/.cache/ms-playwright` en Linux) y se comparte entre
todos los repos de la máquina.

El dev server queda en `http://localhost:5173`. Para fijar otro puerto:

```bash
pnpm exec vite --port 5199 --strictPort
```

`--strictPort` hace que falle si el puerto está ocupado, en vez de saltar en silencio al siguiente —
útil cuando algo tiene que estar en un puerto conocido.

**No hay variables de entorno que configurar.** La app es enteramente cliente.

### Los specs no vienen en el clone

Desde el spec 034 cada spec **es un issue** y `specs/[0-9]*/` está en el `.gitignore`, así que a un
clone nuevo llegan **2** archivos de `specs/` —`README.md` y `mapa.json`— y no 136. El
directorio es una **caché**, y se trae:

```bash
node .claude/scripts/hidratar-specs.mjs        # los que falten
node .claude/scripts/hidratar-specs.mjs 021    # o uno solo
```

Necesita [`gh`](https://cli.github.com/) autenticado, y hay que correrlo **en cada worktree**:
`git worktree add` hace checkout de lo trackeado, y un archivo ignorado no viaja. No hace falta para
`pnpm verify` —los gates saben en qué régimen están (spec 034) y no exigen las carpetas—, sí para
leer o auditar un spec. El mapa spec↔issue es la columna del enlace de
[`specs/mapa.json`](../../specs/mapa.json).

**Buscar dentro de los specs necesita `--no-ignore`.** Leerlos no: `.gitignore` es cosa de git y no
del sistema de archivos. Pero ripgrep lo respeta, así que `rg "lo que sea" specs/` devuelve cero
resultados **sin decir que no miró**.

## Comandos

```bash
pnpm dev            # Dev server con HMR
pnpm build          # tsc -b && vite build → dist/
pnpm lint           # ESLint
pnpm preview        # Sirve dist/ como lo haría producción
pnpm test           # Vitest: los dos proyectos, sin instrumentar
pnpm coverage       # Vitest con coverage y umbral 100 en las cuatro métricas
pnpm suite          # test y después coverage, que es lo que corre verify
pnpm verify         # lint ‖ typecheck ‖ suite ‖ mcp:test — el nodo de convergencia
pnpm mcp:test       # MCP server: typecheck + node --test, con umbral 100
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

De los cuatro gestos que gobiernan la pieza **por colocar**, los de rotar y reflejar son desde el
spec 019 la **única** vía: los botones que hacían lo mismo eran el camino lento al mismo lugar y se
borraron —elegir la pieza sí conserva su segunda vía, las doce miniaturas—. El panel se
queda como quien **muestra** el estado, y por eso los atajos siguen descubriéndose solos: se rota con
la rueda y la línea de orientación de la paleta pasa de `0°` a `90°`. Ese lector no es decorativo —es
la mitad del trabajo que hacían los botones—: la miniatura no puede decir la orientación entera, y en
29 de las 96 combinaciones dos orientaciones se ven idénticas y suenan distinto (la `X` rotada cuatro
veces es el caso extremo: cuatro arpegios, una sola forma).

| Gesto | Qué hace | Dónde escucha |
|---|---|---|
| Rueda abajo / arriba | Rotación `+90°` / `−90°` | Solo sobre el tablero |
| `Shift` (tap) | Rotación `+90°` | Toda la ventana, al **soltar** |
| Botón derecho | Alterna la reflexión | Solo sobre el tablero |
| `Ctrl` (tap) | Alterna la reflexión | Toda la ventana, al **soltar** |
| Barra espaciadora | Play / pausa | Toda la ventana |
| `F I L N P T U V W X Y Z` | Selecciona esa pieza | Toda la ventana, al **apretar** |
| Click en una celda | Coloca la pieza y la escucha | El tablero |

Tres cosas que parecen bugs y no lo son:

- **Con el cursor sobre el tablero la página no scrollea.** Es el precio de que la rueda rote sin
  scrollear a la vez, que sería peor que no rotar. Queda toda la paleta, el panel de señal y el margen
  para scrollear, y es el trato que hace cualquier mapa embebido.
- **`Ctrl`+rueda hace el zoom del navegador y no rota**, y `Ctrl`+C no da vuelta la reflexión. Los
  modificadores actúan al **soltar** y solo si mientras estuvieron abajo no llegó otra tecla ni la
  rueda: un gesto del sistema le gana a uno nuestro.
- **Con el botón de Play enfocado, la barra activa ese botón** — y con el foco sobre `↺`, vacía el
  tablero. Es el comportamiento nativo, y es el correcto: el foco dice qué control está armado.

Desde el spec 026 **el tablero también se toca con el teclado**, y es **una** parada de tabulación:
un `Tab` entra y otro lo pasa de largo. Adentro se mueve con las flechas —`Home` y `End` van a los
extremos de su fila—, `Enter` y la barra hacen lo mismo que un click, y `Alt`+ellos lo mismo que
`Alt`+click. La celda enfocada **es** el cursor, así que el fantasma y la nota son los mismos que con
el mouse. Con una celda enfocada la barra deja de alternar el transporte —la usa el tablero para
colocar— pero `Shift` y `Ctrl` siguen rotando y reflejando: el tablero se lleva la barra, el `Enter` y
las flechas, y nada más.

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

Escribir los cuatro archivos, publicarlo como issue con `node .claude/scripts/publicar-spec.mjs`,
publicarlo, que le escribe su entrada en [`specs/mapa.json`](../../specs/mapa.json) —lo único del
spec que se commitea— y recién
ahí sacar la rama de feature. Ver [specs/README.md](../../specs/README.md).

## Verificación antes de un PR

```bash
pnpm verify                 # lint ‖ typecheck ‖ suite ‖ mcp:test — los cuatro, en paralelo
pnpm build                  # build completo
pnpm preview                # y probarlo a mano
```

`pnpm verify` es el nodo de convergencia y reemplaza a correr los cuatro a mano: un nodo rojo devuelve
exit 1. Medido con caché caliente, 41,2 s en serie contra 23,7 s en paralelo.

**Y ya no depende de que te acuerdes.** Desde el spec 023, `.github/workflows/verify.yml` corre ese
mismo comando sobre cada `pull_request` y cada push a `main`. Corre el script y no la lista de nodos:
así el YAML no se entera cuando la forma de `verify` cambia —el 029 le cambió `test` por `suite` y una
lista habría seguido en verde sin el gate de coverage—. Correrlo local sigue valiendo la pena: es más
rápido enterarse acá que en el PR.

`pnpm mcp:test` no es opcional al tocar `src/domain/` o `src/audio/`: el server importa esos módulos con
node crudo, y un import sin extensión **no** rompe el build de la app. Desde el spec 030 ese caso lo
ataja antes `pnpm lint`, sobre el repo entero; `mcp:test` sigue siendo el que verifica que los módulos
*carguen* de verdad con node.

Los tests corren en **dos proyectos**: los `*.test.ts` en Node contra `node-web-audio-api`, y los
`*.browser.test.tsx` en un Chromium de verdad por Playwright. En jsdom no corre ninguno. **Chromium no
está en el lockfile**: un clone nuevo necesita `pnpm exec playwright install chromium` antes del primer
`verify`.

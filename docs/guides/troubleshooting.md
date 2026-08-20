# Solución de Problemas

Errores que ya se pisaron en este repo, con su causa real. No son hipotéticos.

## Build y configuración

### `Failed to load PostCSS config: module is not defined in ES module scope`

```
[plugin:vite:css] Failed to load PostCSS config (searchPath: …/my-app-vite):
[ReferenceError] module is not defined in ES module scope
```

**Síntoma de un problema más grande.** El error inmediato es que `postcss.config.js` usaba
`module.exports` (CommonJS) dentro de un paquete con `"type": "module"`. Pero renombrarlo a `.cjs` solo
destapa el siguiente error, porque el proyecto tiene **Tailwind 4** y en v4 el paquete `tailwindcss` ya
no expone un plugin de PostCSS.

**Solución aplicada:** se eliminaron `postcss.config.js` y `tailwind.config.js`, y Tailwind entra por el
plugin de Vite:

```ts
// vite.config.ts
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({ plugins: [react(), tailwindcss()] })
```

En v4 la config es CSS-first: no hay archivo de config por defecto y la detección de contenido es
automática. Para customizar el theme se usa `@theme { }` dentro de `styles/index.css`.

### Las clases de Tailwind no aplican

Verificar que `src/styles/index.css` empiece con la sintaxis de v4:

```css
@import "tailwindcss";
```

Las directivas de v3 (`@tailwind base; @tailwind components; @tailwind utilities;`) **no fallan con
error**: simplemente no generan nada, y la app queda sin estilos. Es un fallo silencioso.

Comprobación rápida con el dev server corriendo:

```bash
curl -s http://localhost:5173/src/styles/index.css | grep -c "min-h-screen"
```

### La página carga en blanco, sin errores en consola

Revisar que `src/main.tsx` efectivamente monte la app:

```tsx
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
```

Ya pasó una vez que el archivo quedó truncado en los imports, sin la llamada a `render`. El build
compila sin quejarse —los imports son válidos— y el `<div id="root">` queda vacío.

**Señal diagnóstica:** contar chunks **ya no sirve**. Cuando Tone entraba por import dinámico el build
emitía dos chunks JS, y ver uno solo delataba que `App` no era alcanzable desde el entry; con el motor
propio hay un único chunk siempre (ver [deploy.md](../infra/deploy.md#verificar-el-build-localmente)).

La comprobación equivalente hoy es buscar código de la app dentro del bundle:

```bash
pnpm build && grep -c "Tablero" dist/assets/*.js   # 0 → App no entró al bundle
```

### `Error: Port XXXX is already in use`

Con `--strictPort`, Vite falla en vez de saltar de puerto. Ver qué hay del otro lado antes de matarlo:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5199/
netstat -ano -p tcp | grep LISTENING | grep 5199
```

Suele ser un dev server anterior que quedó vivo, y sirve reusarlo.

## Tests

### `OfflineAudioContext is not defined` en un test

El entorno de tests es `node`, no `jsdom`, **a propósito**: jsdom no implementa Web Audio en absoluto.
Los tests importan `OfflineAudioContext` de `node-web-audio-api`, no de globales del entorno.

Si hace falta un test de componentes React, va a necesitar `jsdom` y su propio bloque de config — no
cambiar el `environment` global, que rompería los tests de audio.

### Los tests no ven `describe` / `it` / `expect`

`globals` está **desactivado** en `vite.config.ts`: hay que importarlos de `vitest`.

```ts
import { describe, it, expect } from 'vitest';
```

Es deliberado: `@types/jest` sigue en el árbol de dependencias y declara las mismas globales con firmas
distintas.

## Audio

### No suena nada

1. **¿Hubo un click primero?** `ctx.resume()` necesita un gesto del usuario. Nada suena hasta el
   primer click en el tablero. Verificable: `(await import('/src/audio/engine.ts')).audio().state`
   debe decir `'running'`, no `'suspended'`.
2. **¿Web Audio está disponible?** `audio()` falla de forma suave: loguea `"Web Audio no disponible"` y
   devuelve `null`. La app queda usable pero muda. Revisar la consola.
3. **¿Es el transporte y está parado?** El botón ▶ / ⏸ de la paleta arranca y para el reloj.
   Verificable con `clockRunning()`.
4. **¿Colocaste una pieza y no sonó el arpegio?** Es intencional si el transporte está corriendo:
   `handleCellClick` solo llama a `playNow` cuando `!playing`, para que el disparo de colocación no
   compita con el patrón del transporte. Si el transporte está parado y aun así no suena, seguir con los
   puntos 1 y 2.
5. **¿Hay secuencia activa?** `sequenceInfo().steps` debe ser mayor que 0 con el transporte en marcha y
   piezas colocadas. Si da 0 con piezas puestas, todavía no cerró el ciclo: desde el spec 009 la
   secuencia nueva entra recién en el cierre del ciclo en curso, y eso puede tardar hasta 7,5 s con 8
   piezas a 110 bpm. **Es una decisión (D5), no un bug** — esperar un ciclo antes de seguir buscando.

### Loops que siguen sonando después de borrar la pieza

Era un bug real, corregido. Si reaparece, el sospechoso es que alguien le haya hablado al motor **fuera**
del efecto de reconciliación. Desde el spec 009 hay una sola llamada —`setSequence(buildSequence(placed, regimen))`—
y toda la gestión tiene que pasar por ese efecto — ver
[audio.md](../architecture/audio.md#reconciliación-de-loops).

Para ver la secuencia activa desde la consola:

```js
(await import('/src/audio/engine.ts')).sequenceInfo()
```

## MCP server

### El MCP server no arranca: `ERR_MODULE_NOT_FOUND`

```
node:internal/modules/esm/resolve:274
    throw new ERR_MODULE_NOT_FOUND(
```

Casi siempre es **un import sin extensión dentro de `src/`**. El server corre con node crudo, que
necesita el `./music.constants.ts` completo; Vite resuelve igual sin la extensión, así que el error
**no rompe la app** y solo aparece del lado del server.

Es un modo de falla asimétrico y está verificado: sacándole el `.ts` a un import de `src/domain/`, el
server muere con este error y `pnpm build` termina en verde.

**Solución:** poner la extensión. La regla está en
[conventions.md](./conventions.md), y `pnpm mcp:test` la ataja antes que nadie.

### `ERR_UNKNOWN_FILE_EXTENSION: ".tsx"`

El server importó un `.tsx`. El type-stripping de node no transforma JSX: **`App.tsx` y los componentes
son inalcanzables desde el server, y no es cuestión de configuración.** Si una tool necesita algo que
hoy vive en un `.tsx`, eso tiene que bajar a `src/domain/` primero — en su propio commit.

### El server arranca pero Claude Code no lo ve

Revisar la versión de node: el server pide **≥ 22.18** y con Node 20 no levanta. `node --version`.
`.mcp.json` está commiteado en la raíz y no hay nada más que configurar.

## Deploy

Ver [infra/deploy.md](../infra/deploy.md) para los dos errores clásicos de Netlify en este repo: la
ruta de `publish` duplicada y la versión de Node.

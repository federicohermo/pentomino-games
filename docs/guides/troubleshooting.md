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
3. **¿Es el loop y el reloj está parado?** Los loops dependen del reloj; el botón "Loop" lo arranca.
   Verificable con `clockRunning()`. El arpegio de colocación no depende del reloj y suena siempre.
4. **¿Hay jobs?** `jobCount()` debe ser mayor que 0 con el checkbox activo y piezas colocadas.

### Loops que siguen sonando después de borrar la pieza

Era un bug real, corregido. Si reaparece, el sospechoso es que alguien haya vuelto a agendar o cancelar
jobs **fuera** del efecto de reconciliación. Toda la gestión de jobs tiene que pasar por ese efecto —
ver [audio.md](../architecture/audio.md#reconciliación-de-loops).

Para contar loops vivos desde la consola:

```js
(await import('/src/audio/engine.ts')).jobCount()
```

## Deploy

Ver [infra/deploy.md](../infra/deploy.md) para los dos errores clásicos de Netlify en este repo: la
ruta de `publish` duplicada y la versión de Node.

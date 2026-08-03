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
automática. Para customizar el theme se usa `@theme { }` dentro de `index.css`.

### Las clases de Tailwind no aplican

Verificar que `src/index.css` empiece con la sintaxis de v4:

```css
@import "tailwindcss";
```

Las directivas de v3 (`@tailwind base; @tailwind components; @tailwind utilities;`) **no fallan con
error**: simplemente no generan nada, y la app queda sin estilos. Es un fallo silencioso.

Comprobación rápida con el dev server corriendo:

```bash
curl -s http://localhost:5173/src/index.css | grep -c "min-h-screen"
```

### La página carga en blanco, sin errores en consola

Revisar que `src/index.tsx` efectivamente monte la app:

```tsx
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<React.StrictMode><App /></React.StrictMode>);
```

Ya pasó una vez que el archivo quedó truncado en los imports, sin la llamada a `render`. El build
compila sin quejarse —los imports son válidos— y el `<div id="root">` queda vacío.

**Señal diagnóstica:** si el build emite un solo chunk JS en vez de dos, `App` no es alcanzable desde el
entry y por lo tanto Tone.js nunca entra al grafo de módulos.

### `Error: Port XXXX is already in use`

Con `--strictPort`, Vite falla en vez de saltar de puerto. Ver qué hay del otro lado antes de matarlo:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5199/
netstat -ano -p tcp | grep LISTENING | grep 5199
```

Suele ser un dev server anterior que quedó vivo, y sirve reusarlo.

## Tests

### No hay runner de tests

`package.json` no tiene script `test` ni Vitest ni Jest, aunque sí arrastra `@testing-library/*` y
`@types/jest` de la época Create React App. `src/App.test.tsx` existe pero nadie lo corre.

Montar Vitest está en el alcance del
[spec 001](../../specs/001-notas-por-celda-en-orden-angular/plan.md) §1. Al hacerlo hay que sacar
`@types/jest`: con `globals: true` los tipos los provee Vitest y tener ambos declara `expect` dos veces
con firmas distintas.

## Audio

### No suena nada

1. **¿Hubo un click primero?** `Tone.start()` necesita un gesto del usuario para reanudar el
   `AudioContext`. Nada suena hasta el primer click en el tablero.
2. **¿Falló el import de Tone?** `ensureTone()` falla de forma suave: loguea
   `"Tone.js failed to load"` y devuelve `null`. La app queda usable pero muda. Revisar la consola.
3. **¿Es el loop y el Transport está parado?** Los loops de piezas colocadas dependen del Transport; el
   botón "Loop" lo arranca. El arpegio de colocación, en cambio, usa `Tone.now()` y suena siempre.

### Loops que siguen sonando después de borrar la pieza

Era un bug real, corregido. Si reaparece, el sospechoso es que alguien haya vuelto a agendar o cancelar
eventos **fuera** del efecto de reconciliación. Toda la gestión de eventos del Transport tiene que pasar
por ese efecto — ver [audio.md](../architecture/audio.md#reconciliación-de-loops).

Para contar loops vivos desde la consola, ver
[audio.md](../architecture/audio.md#cómo-verificar-el-audio-sin-oírlo). Recordar filtrar por
`_TransportRepeatEvent`: Tone crea eventos internos y el conteo crudo engaña.

## Deploy

Ver [infra/deploy.md](../infra/deploy.md) para los dos errores clásicos de Netlify en este repo: la
ruta de `publish` duplicada y la versión de Node.

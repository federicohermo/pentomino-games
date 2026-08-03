# Deploy

## Dónde vive la configuración

`netlify.toml` está en la **raíz del repositorio**, un nivel arriba de `my-app-vite/`. Es el único
archivo de config de deploy y no hay ninguno anidado.

```toml
[build]
  base = "my-app-vite"
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"
```

| Campo | Valor | Por qué |
|---|---|---|
| `base` | `my-app-vite` | Netlify corre `npm install` y el build **dentro** de esa carpeta |
| `command` | `npm run build` | Expande a `tsc -b && vite build`. Sin `cd`: `base` ya puso el cwd |
| `publish` | `dist` | Relativo a `base`, no a la raíz del repo |
| `NODE_VERSION` | `22` | Vite 7 exige `^20.19.0 \|\| >=22.12.0` |

## Los dos errores que ya se cometieron acá

### `publish` duplicando el path

Estuvo configurado como `publish = "my-app-vite/dist"` junto con `base = "my-app-vite"`. Netlify
resuelve **todas** las rutas del `netlify.toml` relativas al `base`, así que buscaba
`my-app-vite/my-app-vite/dist`, que no existe.

> "All paths configured in the `netlify.toml` should be absolute paths relative to the base directory"
> — documentación de Netlify

Lo confuso es que la UI de Netlify **muestra** el publish resuelto desde la raíz (`my-app-vite/dist`),
así que el valor correcto en el archivo y el que se ve en el dashboard no coinciden. No es un error.

### `NODE_VERSION = "18"`

Vite 7 declara `engines: { node: "^20.19.0 || >=22.12.0" }`. Node 18 está fuera de rango y el build
falla en Netlify aunque ande perfecto en local — el desarrollo se hizo sobre Node 22.

Verificable sin desplegar:

```bash
node -p "JSON.stringify(require('./node_modules/vite/package.json').engines)"
```

## Fallback de SPA

`public/_redirects` contiene:

```
/*    /index.html   200
```

Vite lo copia tal cual a `dist/`. Sin esa regla, cualquier ruta que no sea `/` daría 404 en Netlify.

**No hace falta duplicarlo** como bloque `[[redirects]]` en el `netlify.toml`; el archivo alcanza.

## Precedencia entre la UI y el archivo

Los valores cargados a mano en el dashboard de Netlify **pisan** al `netlify.toml` en varios campos.
Ante cualquier duda, dejar los campos de la UI vacíos y que mande el archivo versionado.

## Variables de entorno

**Ninguna.** La app no consume ni una. La sección "Environment variables" del sitio debe quedar vacía.

`NODE_VERSION` no es una excepción: configura la imagen de build de Netlify, no llega al bundle, y ya
está declarada en el archivo.

## Verificar el build localmente

Reproduce exactamente lo que hace Netlify:

```bash
cd my-app-vite
rm -rf dist
npm run build
find dist -type f
```

`dist/` tiene que contener `index.html`, `assets/` con **un** chunk JS y uno CSS, y `_redirects`.

Antes había dos chunks JS: el segundo eran los 340 kB de Tone.js, separados por el import dinámico. Con
el motor propio ese chunk no existe. **Si aparece un segundo chunk JS, algo volvió a introducir un
import dinámico** — no es un error, pero conviene saber qué es.

Después:

```bash
npm run preview
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/una/ruta/profunda   # 200, no 404
```

## Repositorio conectado

El sitio tiene que estar conectado al repositorio **al que se pushea**. Un push a un fork no dispara el
deploy de un sitio conectado al repo original: los webhooks son por repositorio.

Se verifica en *Site configuration → Build & deploy → Continuous deployment*.

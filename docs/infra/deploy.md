# Deploy

La plataforma es **Vercel**. Este archivo dice dónde vive la configuración, qué corre en el build y
qué no, y cuál de las dos ramas se publica.

## Dónde vive la configuración

`vercel.json` está en la **raíz del repositorio**, junto al `package.json` de la app. Es el único
archivo de config de deploy y no hay ninguno anidado.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "pnpm install",
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist"
}
```

| Campo | Valor | Por qué |
|---|---|---|
| `$schema` | `https://openapi.vercel.sh/vercel.json` | Da autocompletado y validación en el editor; no lo lee la plataforma |
| `installCommand` | `pnpm install` | Explícito, para que no dependa de que la detección por lockfile siga funcionando igual |
| `buildCommand` | `pnpm run build` | Expande a `tsc -b && vite build`. Corre en la raíz del repo |
| `outputDirectory` | `dist` | La app vive en la raíz, así que no hay prefijo de carpeta |

### Por qué el porqué de cada campo está acá y no al lado de la decisión

Es una **desviación declarada** de la convención del repo, que pide que un comentario explique el
porqué al lado de lo que decide. `vercel.json` es JSON y **JSON no admite comentarios**: no hay
ningún lugar adentro del archivo donde escribirlos. Por eso la tabla de arriba es la contraparte, y
está escrita como tal — si esto no quedara dicho, se leería como un descuido y el próximo que pase lo
"arreglaría" metiendo los porqués en un archivo que no los admite, que es un `JSON.parse` roto.

## Qué gestor de paquetes elige la plataforma, y por qué

`installCommand` lo fija en `pnpm install`, así que la elección no queda librada a la detección. Pero
el motivo por el que el repo usa pnpm sigue valiendo aunque el campo esté: **Vercel elige el gestor
por el lockfile** cuando nadie se lo dice, y con un `package-lock.json` en el repo elegiría npm. Por
eso `pnpm-lock.yaml` **tiene que estar versionado** y no puede haber un `package-lock.json` al lado —
si los dos están, el deploy y la máquina de quien desarrolla resuelven versiones distintas, en
silencio.

La versión de pnpm sale del campo `packageManager` del `package.json`, vía Corepack. Corepack no
acepta rangos semver ahí: va la versión exacta (`pnpm@10.33.0`).

## Qué corre en el build y qué no

**Corre el typecheck**, porque está adentro del `build`: `pnpm run build` es `tsc -b && vite build`, y
el `tsc -b` falla el deploy si el proyecto no typechequea.

**No corren el lint ni los tests.** Eso lo hace `pnpm verify` en GitHub Actions, sobre cada PR. La
consecuencia práctica: un deploy verde dice que el proyecto compila, **no** que la suite pasa. Los dos
gates son distintos y ninguno reemplaza al otro.

## Lo que `vercel.json` deliberadamente no declara

### No hay `ignoreCommand`

Es el único hook nativo de Vercel para condicionar un deploy, y **está invertido**: exit 0 **saltea**
el build y exit 1 lo continúa. Además saltea en vez de fallar. O sea que poner `pnpm verify` ahí
tendría dos problemas a la vez — se pagaría la verificación dos veces, y un rojo se reportaría como
«deploy salteado», que en el tablero se lee como verde. Condicionar lo que entra al repo es trabajo
del gate del PR, no del deploy.

### No hay `rewrites`

Un fallback de SPA existe para que `GET /alguna/ruta` devuelva el `index.html` en vez de un 404, y acá
no hay ninguna «alguna/ruta» que pedir: la app no tiene routing —ni `react-router`, ni `pushState`, ni
lectura de `window.location`— y la única URL es `/`.

**El día que haya routing, la regla va acá como `rewrites`**, no como un archivo suelto en `public/`.
Queda escrito porque hasta el spec 045 esa regla vivía en `public/_redirects`, en la sintaxis de la
plataforma anterior, que Vercel no lee.

### No hay versión de Node

`engines.node` del `package.json` **pisa** la configuración del proyecto en Vercel, y hoy ese campo
declara un rango que cruza dos majors (`^20.19.0 || >=22.12.0`) porque es el **piso** que exige Vite 7,
no un pin. Dónde vive el pin del deploy y quién lo cruza contra los dos pisos declarados es el spec
046; acá el campo está ausente a propósito y no por olvido.

## Variables de entorno

**Ninguna.** La app es enteramente cliente: sin backend, sin API keys, sin endpoints. La sección
*Environment Variables* del proyecto debe quedar vacía.

Si algún día hace falta una, en Vite tiene que llevar el prefijo `VITE_` para ser visible desde el
cliente (`import.meta.env.VITE_FOO`). El prefijo `REACT_APP_` de Create React App **no** funciona y
falla en silencio.

## Las dos ramas y cuál se publica

El repo tiene dos ramas con roles distintos:

| Rama | Rol | Qué produce en Vercel |
|---|---|---|
| `main` | release: es lo que se deploya | el deploy de **producción** |
| `staging` | integración: es donde aterrizan los PR | un deploy de **preview** |

**La rama de producción está fijada explícitamente en `main`, y eso no es higiene: es una
precondición.** Vercel toma como rama de producción la rama **default del repositorio** cuando nadie
la fija, y la default de este repo es `staging`. Un proyecto creado sin tocar esa configuración
publicaría la rama de integración — o sea que casi todos los PR irían a producción al mergear.

Se verifica sin entrar al dashboard: un push a `staging` produce una URL de preview y la URL de
producción no se mueve.

## Repositorio conectado

El proyecto tiene que estar conectado al repositorio **al que se pushea**. Un push a un fork no
dispara el deploy de un proyecto conectado al repo original: los webhooks son por repositorio.

## Verificar el build localmente

Reproduce exactamente lo que hace la plataforma:

```bash
rm -rf dist
pnpm build
find dist -type f
```

`dist/` tiene que contener `index.html` y `assets/` con **un** chunk JS y uno CSS.

Antes había dos chunks JS: el segundo eran los 340 kB de Tone.js, separados por el import dinámico.
Con el motor propio ese chunk no existe. **Si aparece un segundo chunk JS, algo volvió a introducir un
import dinámico** — no es un error, pero conviene saber qué es.

Después:

```bash
pnpm preview
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/   # 200
```

# Inicio Rápido

## Requisitos Previos

- **Node ≥ 20.19 o ≥ 22.12.** No es una recomendación: Vite 7 lo declara en `engines`
  (`^20.19.0 || >=22.12.0`) y con Node 18 el build falla.
- npm (el repo versiona `package-lock.json`).

## Instalación

```bash
cd my-app-vite
npm install
npm run dev
```

El dev server queda en `http://localhost:5173`. Para fijar otro puerto:

```bash
npx vite --port 5199 --strictPort
```

`--strictPort` hace que falle si el puerto está ocupado, en vez de saltar en silencio al siguiente —
útil cuando algo tiene que estar en un puerto conocido.

**No hay variables de entorno que configurar.** La app es enteramente cliente.

## Comandos

```bash
npm run dev      # Dev server con HMR
npm run build    # tsc -b && vite build → dist/
npm run lint     # ESLint
npm run preview  # Sirve dist/ como lo haría producción
```

`npm run build` corre el typecheck **antes** del bundle. Un error de tipos rompe el build aunque el
código funcione en dev, donde Vite no typechequea.

Para verificar tipos sin buildear:

```bash
npx tsc -b --noEmit
```

## Flujos de trabajo típicos

### Agregar una pieza o cambiar una forma

1. Editar `SHAPES` en `src/App.tsx`. Las coordenadas son `[x, y]` con `y` creciendo **hacia abajo**.
2. Si se agrega una pieza, actualizar también `BASE_MAP` (su tónica) y `ANCHOR_INDEX` (su celda de
   agarre, como índice dentro del array de celdas).
3. Verificar que la celda de agarre elegida sea una celda **central**: es la que queda bajo el cursor, y
   si cae en un hueco del bounding box la colocación se siente rota.

### Cambiar cómo suena algo

Ojo: hay **dos** caminos de reproducción, con lógica duplicada — el arpegio de colocación
(`playNotesNow`) y el loop por compás (dentro del efecto de reconciliación). Un cambio de sonido va en
los dos. Ver [audio.md](../architecture/audio.md#los-dos-caminos-de-reproducción).

### Verificar audio sin oírlo

Los eventos del Transport se pueden contar desde la consola del navegador. Receta en
[audio.md](../architecture/audio.md#cómo-verificar-el-audio-sin-oírlo).

### Antes de un cambio grande

Escribir un spec en `specs/`, commitearlo a `main`, y recién ahí sacar la rama de feature. Ver
[specs/README.md](../../specs/README.md).

## Verificación antes de un PR

```bash
npx tsc -b --noEmit    # tipos
npm run lint           # estilo
npm run build          # build completo
npm run preview        # y probarlo a mano
```

No hay `npm test`: el proyecto no tiene runner. Ver
[troubleshooting](./troubleshooting.md#no-hay-runner-de-tests).

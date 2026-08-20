# Research 024 — Los componentes se verifican en un navegador

Todo lo de acá se corrió de verdad sobre `main` en `052aedf`, con la infra instalada, un config
temporal y tests de prueba que después se borraron. Los números y los errores son transcripciones.

## 1. Lo que hay hoy

`vite.config.ts` tiene un solo bloque `test`:

```ts
test: {
  environment: 'node',
  include: ['src/**/*.test.{ts,tsx}'],
}
```

`include` ya nombra `.tsx`, pero **no existe ni un `.test.tsx` en el repo**: los 16 archivos de test son
`.ts`. O sea que la puerta estaba abierta y nadie entró, porque en `environment: 'node'` no hay DOM
donde montar nada.

16 archivos, 322 tests, 1,83 s.

## 2. La infra: qué se instala y cuánto pesa

```
pnpm add -w -D @vitest/browser-playwright vitest-browser-react playwright
```

| Paquete | Resuelto | Nota |
|---|---|---|
| `@vitest/browser-playwright` | **`4.1.11` exacta** | Se publica pinneado a la versión de `vitest`. Por eso el 023 sube `vitest` a 4.1.11 |
| `vitest-browser-react` | `^2.2.0` | El `render` con locators. Reemplaza a `@testing-library/react`, que este repo **borró** en el 022 |
| `playwright` | `^1.62.1` | Sólo el cliente; el navegador se baja aparte |

```
pnpm exec playwright install chromium
```

Baja cuatro cosas a `~/.cache` del sistema (en Windows, `%LOCALAPPDATA%\ms-playwright`):

```
chromium-1234                    Chrome for Testing 151.0.7922.34
chromium_headless_shell-1234
ffmpeg-1011
winldd-1007
```

Verificado en disco después de correr. **No entra al repo ni al bundle**: son binarios en el caché del
usuario, igual que el store de pnpm.

## 3. El config que funciona

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    projects: [
      { test: { name: 'node', environment: 'node', include: ['src/**/*.test.ts'] } },
      {
        plugins: [react(), tailwindcss()],          // ← NO se hereda. Ver §5.
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.tsx'],
          browser: {
            enabled: true, headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
```

Corrida real del proyecto de navegador con tres tests:

```
RUN  v4.1.11
 |browser (chromium)| src/components/__tests__/zz-smoke.browser.test.tsx (3 tests) 252ms
 Duration  1.81s
```

**~1,8 s de punta a punta**, con arranque de Chromium incluido. No es un costo que cambie la relación
con `verify`.

## 4. La medición que decide el spec: la rueda pasiva se atrapa

Este test **pasa** hoy:

```tsx
test('la rueda sobre el tablero frena el scroll (listener NO pasivo)', async () => {
  const screen = await render(<App />);
  const board = screen.container.querySelector('.relative.overflow-x-auto') as HTMLElement;

  const ev = new WheelEvent('wheel', { deltaY: 120, cancelable: true, bubbles: true });
  board.dispatchEvent(ev);

  expect(ev.defaultPrevented).toBe(true);
});
```

Es exactamente el invariante del docblock de `useRuedaRota`, y **no hay forma de escribirlo en jsdom**:
jsdom no implementa la semántica de listeners pasivos, así que `preventDefault()` ahí siempre "funciona"
y el test pasaría también con el bug puesto.

Nota de forma: el test monta **`App`** y no `Board`. Tiene que ser así — el listener no lo cuelga
`Board.tsx` sino `useRuedaRota` desde el shell, sobre un `ref` que `App.tsx` crea. Montar sólo `Board`
da un tablero sin listener y un test que pasa por la razón equivocada. Se comprobó: con `Board` suelto,
`ref.current` existe pero no hay `wheel` colgado.

## 5. Las cuatro trampas medidas

### 5.1 `plugins` no se hereda en un `projects[]`

Sin `plugins: [react()]` **dentro** del proyecto de navegador, el JSX no compila. La config raíz los
tiene y no alcanza.

### 5.2 `render()` se awaitea

`vitest-browser-react@2` devuelve una promesa. Sin `await`:

```
TypeError: Cannot read properties of undefined (reading 'querySelector')
```

Que es un error que **no menciona la promesa**, así que cuesta diagnosticarlo si no se sabe.

### 5.3 Los locators no son los de testing-library

```
TypeError: screen.getByTitle is not a function
```

La API es la de locators de Vitest (`getByRole`, `getByText`, `getByTestId`, …) más `screen.container`
para lo que no tenga locator. El `title` que `Board.tsx` pone en cada celda **no** es un locator, y eso
es coherente con lo que su propio comentario ya dice: ese `title` no es accesibilidad, es un tooltip de
mouse.

### 5.4 Sin la hoja de estilos, `getComputedStyle` miente

Es la trampa cara. Este test **falla** sin importar el CSS:

```tsx
expect(getComputedStyle(capa).zIndex).toBe('10');
// AssertionError: expected 'auto' to be '10'
```

La clase `z-10` está en el `className`; lo que falta es la hoja. Con `import '../../styles/index.css'`
en el test —o en un setup del proyecto— el estilo se resuelve.

Lo peligroso no es que falle: es que **el fallo se ve idéntico a un bug real de `z-index`**. Un test de
layout sin hoja cargada pasa o falla por el motivo equivocado y nadie se entera. Por eso el CSS va en un
setup del proyecto de navegador y no a criterio de cada test.

## 6. Web Audio real

```tsx
expect(typeof window.AudioContext).toBe('function');   // pasa
new AudioContext().createAnalyser;                     // existe
```

Chromium suspende el contexto sin gesto del usuario, que es el mismo comportamiento que la app maneja
con `playNow`. O sea que el navegador no sólo *tiene* Web Audio: tiene **la misma política de
autoplay** contra la que `audio()` y `playNow()` están escritos, y que `node-web-audio-api` no modela.

Queda anotado como puerta que este spec abre y no cruza: los tests de audio siguen en node.

## 7. Los seis invariantes que hoy sólo sabe un comentario

| # | Invariante | Fuente en `src/` | Verificable en navegador |
|---|---|---|---|
| 1 | La rueda frena el scroll | `use-input.ts` | **Medido: sí** (§4) |
| 2 | `Ctrl`+rueda no refleja ni frena | `use-input.ts`, D10 del 013 | Sí — mismo mecanismo que 1 |
| 3 | La capa de `Playhead` va encima | `Playhead.tsx` | Sí, con la hoja cargada (§5.4) |
| 4 | La grilla mide 10 × `CELL_PX` y no empuja scroll a la página | `Board.tsx` | Sí — `scrollWidth` del `body` |
| 5 | Las miniaturas no reflowean al rotar | `OrientationPanel.tsx` | Sí — ancho del contenedor entre dos rotaciones |
| 6 | «Notas actuales» reserva dos renglones | `PiecePalette.tsx`, `min-h-[2lh]` | Sí — alto entre el mejor y el peor de los 48 |

El 6 tiene una dependencia real: `2lh` se resuelve contra la fuente, así que **sin la hoja cargada mide
otra cosa**. Es el caso testigo de §5.4.

## 8. Qué le agrega al workflow del 023

Un paso, antes de `pnpm verify`:

```yaml
- run: pnpm exec playwright install --with-deps chromium
```

`--with-deps` en Linux instala las librerías del sistema que Chromium necesita. El caché de navegadores
se puede cachear con `actions/cache` sobre `~/.cache/ms-playwright`; queda como seguimiento y no como
requisito, porque la descarga son ~130 MB y el job hoy no tiene presión de tiempo.

## 9. Archivos que toca

| Archivo | Qué cambia |
|---|---|
| `vite.config.ts` | El bloque `test` pasa a `projects` |
| `vitest.setup.browser.ts` | **Nuevo** — importa la hoja una vez (§5.4) |
| `package.json` | Tres `devDependencies` nuevas |
| `.github/workflows/verify.yml` | Un paso de `playwright install` |
| `.gitignore` | `.vitest-attachments/` y los screenshots de fallo, que Vitest escribe al lado del test |
| `src/components/__tests__/*.browser.test.tsx` | **Nuevos** — seis |
| `specs/deuda.md` | El ítem de tests de UI se reescribe (D6) |
| `CLAUDE.md`, `.claude/rules/ui.md`, `docs/guides/quickstart.md` | Los tres afirman hoy que no hay tests de UI o que todo corre en `node` |

**Cero cambios en los 16 archivos de test que ya existen.**

## 10. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Un test de layout pasa por el motivo equivocado (§5.4) | **Alta si no se cuida** | El CSS va en el setup del proyecto, no en cada test. Y AC4 obliga a ver fallar al menos un test a propósito |
| Los tests de layout se vuelven frágiles al cambiar el diseño | Media | Se testean **invariantes medidos** y no píxeles exactos: «no gana scroll», «no cambia de alto», no «mide 730,7» |
| La CI se vuelve lenta o inestable por el navegador | Media | ~1,8 s local. Si aparece flakiness, el proyecto de navegador se puede correr aparte sin tocar los otros tres nodos |
| El lote 018–021 rompe estos tests | **Alta, y es a propósito** | Ver §11 |
| `@vitest/browser-playwright` pinneado a `vitest` exacto | Baja | El 023 ya deja `vitest` en 4.1.11 |

## 11. La colisión con el lote 018–021, medida

Cuatro de los seis tests tocan superficie que esos specs reescriben:

| Test | Lo rompe | Por qué |
|---|---|---|
| 3 (`z-10` de `Playhead`) | **021** | Reescribe `Board.tsx` y mueve `CELL_PX` a una custom property |
| 4 (grilla 10 × `CELL_PX`) | **021** | `CELL_PX` deja de ser constante |
| 5 (miniaturas no reflowean) | **020** | La orientación pasa a ser por pieza: rotar deja de mover las doce |
| 6 («Notas actuales» dos renglones) | **019** | Borra filas del panel y agrega el lector de orientación |

Los tests 1 y 2 —la rueda— sobreviven a los cuatro specs: `useRuedaRota` no lo toca ninguno.

**Y que se rompan es el punto.** Hoy esos cuatro invariantes se re-verifican a ojo después de cada
cambio de layout, o no se verifican. Con test, un spec que los cambie tiene que **decidir explícitamente**
el número nuevo y escribirlo — que es exactamente lo que el 021 ya promete hacer con `CELL_PX` y lo que
el 019 mide en su `T022`. Un test rojo es la conversación que hoy no ocurre.

Lo que sí hay que evitar es que los seis se escriban contra números que el 019 va a cambiar la semana
que viene. Por eso D5 del `spec.md` pide invariantes y no medidas.

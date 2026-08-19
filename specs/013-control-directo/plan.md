# Plan — Spec 013

Cuatro pasos. El 1 es puro y no toca ningún `.tsx`; el 2 y el 3 son el cableado y **se pueden hacer en
paralelo** porque tocan archivos distintos; el 4 cierra.

## Paso 1 — Las puras de cada gesto, con sus tests

Nace `src/components/input.ts`, al lado de `cell-text.ts` y `route-source.ts`, que son el precedente de
«lógica que un `.tsx` necesitaría pero no puede exportar».

Cada pura recibe **los campos del evento que importan**, no el evento: así se testean en
`environment: 'node'` sin jsdom ni sintéticos de React (`research.md` §7).

```ts
rotacionPorRueda(rotation: number, deltaY: number): number
accionDeTecla(k: { key: string; repeat: boolean; targetEsControl: boolean }): Accion | null
reflejaElContextMenu(e: { ctrlKey: boolean }): boolean
```

`Accion` es un const-object + union type en `types/input.types.ts` (`'rotar' | 'reflejar' | 'transporte'`),
**nunca un `enum`** — lo rechaza el `erasableSyntaxOnly`.

Las cuatro guardas quedan escritas acá y no en el `.tsx`:

- `deltaY > 0 → +1`, `deltaY < 0 → −1`, siempre `mod 4` **positivo** (`(r + 4 + d) % 4`, porque en JS
  `-1 % 4` es `-1`)
- `repeat === true → null` (D3)
- `targetEsControl === true → null` (D4)
- `ctrlKey === true → false` (D2)

Tests: AC1, AC3, AC5, AC6, AC7, AC8. **AC6 es el que justifica el paso**: es el único que no se puede
ver desde Windows.

## Paso 2 — El efecto de los listeners de ventana `[P]`

En `App.tsx`, un `useEffect` propio con `keydown` sobre `window`. Sus dependencias son las reales
—`rotation`, `mirror`, `playing`— y se re-suscribe (D7); no se mete un ref para suscribir una vez.

El handler traduce con `accionDeTecla`, mirando si `e.target` es `HTMLButtonElement` o
`HTMLInputElement`, y despacha a `setRotation` / `setMirror` / `togglePlay`. `preventDefault` solo
cuando la acción no es `null` — si el handler se saltea el evento, el navegador tiene que quedárselo
entero.

Limpieza sincrónica en el retorno del efecto (AC10).

## Paso 3 — Los dos gestos del tablero `[P]`

`Board.tsx` suma `onWheel` y `onContextMenu` como props y las cuelga del
`div.relative.overflow-x-auto` (`research.md` §3), sin lógica adentro: sigue siendo presentacional
(AC11).

`App.tsx` arma los dos handlers: el de la rueda hace `preventDefault` y `setRotation(rotacionPorRueda(...))`;
el del menú contextual hace `preventDefault` siempre —el menú no se abre nunca sobre el tablero— y
alterna solo si `reflejaElContextMenu(e)`.

> El `preventDefault` de la rueda tiene que ir en un listener **no pasivo**. React monta `onWheel` como
> no pasivo sobre el elemento, así que la prop alcanza; si en verificación resultara pasivo (el
> navegador lo fuerza en `window`/`document`, no en un elemento), la salida es un `addEventListener`
> con `{ passive: false }` desde un efecto con ref. Se verifica en el paso 4, no se asume.

## Paso 4 — Verificación, documentación y cierre

`pnpm verify` en verde (AC12). Después, a mano en el navegador, lo que ningún test puede ver: AC2
(la página no scrollea con el cursor sobre el tablero, y sí afuera), AC4 (no aparece el menú contextual)
y AC13 (rotar con el transporte corriendo no corta el sonido).

Documentación: la tabla de gestos a `docs/guides/quickstart.md` y al `<footer>` de `App.tsx`, que hoy
explica el modelo musical y no menciona ni un gesto. Y a `.claude/rules/ui.md`, la regla de dónde vive
un listener global — es la primera del repo (`research.md` §1) y la próxima se va a copiar de esta.

## Verificación

| Qué | Cómo |
|---|---|
| AC1, AC3, AC5, AC6, AC7, AC8 | `input.test.ts`, en `environment: 'node'` |
| AC9 | Por lectura: el atajo llama a `togglePlay`, que ya consulta `clockRunning()` |
| AC10 | StrictMode: montar/desmontar dos veces y contar handlers |
| AC11 | Por lectura y por lint: `Board.tsx` sin `useState` ni `useEffect` |
| AC12 | `pnpm verify` |
| AC2, AC4, AC13 | `[M]` navegador |
| AC14 | Por lectura de los tres archivos |
| **No cambia una nota** | `check_invariants` en proceso fresco antes y después, y el diff sin tocar `domain/` ni `audio/` |

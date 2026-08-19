# Plan — Spec 013

Cuatro pasos. El 1 es puro y no toca ningún `.tsx`; el 2 y el 3 son el cableado; el 4 cierra.

El 2 y el 3 **no** son paralelos, aunque la primera versión de este plan lo decía: los dos escriben
`App.tsx` —el 2 el efecto del teclado, el 3 el de la rueda y el handler del menú— y además comparten el
ref del `tapLimpio` (D10), que el 2 crea y el 3 ensucia. Lo único paralelizable adentro del 3 es
`Board.tsx`, que es el único archivo que no toca nadie más.

## Paso 1 — Las puras de cada gesto, con sus tests

Nace `src/components/input.ts`, al lado de `cell-text.ts` y `route-source.ts`, que son el precedente de
«lógica que un `.tsx` necesitaría pero no puede exportar».

Cada pura recibe **los campos del evento que importan**, no el evento: así se testean en
`environment: 'node'` sin jsdom ni sintéticos de React (`research.md` §7).

```ts
rotacionPorRueda(rotation: number, deltaY: number): number
accionDeTecla(k: { key: string; tipo: 'keydown' | 'keyup';
                   repeat: boolean; targetEsControl: boolean; tapLimpio: boolean }): Accion | null
reflejaElContextMenu(e: { ctrlKey: boolean }): boolean
```

`ACCION` es un **const-object en `constants/input.constants.ts`** y `Accion` la union derivada en
`types/input.types.ts` (`'rotar' | 'reflejar' | 'transporte'`), **nunca un `enum`** — lo rechaza el
`erasableSyntaxOnly`. El reparto no es opcional: los módulos de este repo no declaran constantes, y el
par `MARCA` (`route.constants.ts`) / `MarcaKind` (`route.types.ts`) es el precedente exacto.

Las guardas quedan escritas acá y no en el `.tsx`:

- `deltaY > 0 → +1`, `deltaY < 0 → −1`, siempre `mod 4` **positivo** (`(r + 4 + d) % 4`, porque en JS
  `-1 % 4` es `-1`)
- `repeat === true → null` (D3) — la ejerce el espacio, que es el único en `keydown`
- `targetEsControl === true → null` (D4)
- `Shift`/`Control` solo actúan con `tipo === 'keyup'` **y** `tapLimpio === true`; el espacio solo con
  `tipo === 'keydown'` (D10)
- `ctrlKey === true → false` (D2)

Tests: AC1, AC3, AC5, AC6, AC7, AC8. **AC6 es el que justifica el paso**: es el único que no se puede
ver desde Windows.

## Paso 2 — El efecto de los listeners de ventana

En `App.tsx`, un `useEffect` propio con **`keydown` y `keyup`** sobre `window`. Sus dependencias son las
reales —`rotation`, `mirror`, `playing`— y se re-suscribe (D7); no se mete un ref para suscribir una vez.

El handler traduce con `accionDeTecla`, mirando si `e.target` es `HTMLButtonElement` o
`HTMLInputElement`, y despacha a `setRotation` / `setMirror` / `togglePlay`. `preventDefault` solo
cuando la acción no es `null` — si el handler se saltea el evento, el navegador tiene que quedárselo
entero.

El `tapLimpio` de D10 es lo único que vive **afuera** del estado de React: un `useRef<boolean>` que
arranca en `true` al `keydown` del modificador, y que ensucian el `keydown` de **otra** tecla y el
handler de la rueda. El mouse no lo ensucia — si lo ensuciara, el `Ctrl`+click de Mac volvería al neto
cero que D2 evita. Va en un ref y no en `useState` porque cambia varias veces por gesto y no lo mira
nadie que se dibuje.

Limpieza sincrónica en el retorno del efecto, **para los dos listeners** (AC10).

## Paso 3 — Los dos gestos del tablero

Los dos gestos entran distinto, y la asimetría está medida (`research.md` §10): **React monta `wheel`
pasivo** en el contenedor raíz, así que un `onWheel` de JSX no puede hacer `preventDefault` y AC2 sería
imposible de cumplir con la prop. `contextmenu` no está en esa lista.

`Board.tsx` suma dos props sobre el `div.relative.overflow-x-auto` (`research.md` §3): `onContextMenu`,
que es un handler como `onCellClick`, y `boardRef`, que cuelga del mismo div y el componente no lee.
Sin lógica adentro y sin efectos: sigue siendo presentacional (AC11).

`App.tsx` arma las dos puntas:

- **La rueda**, en un `useEffect` propio: `boardRef.current.addEventListener('wheel', h, { passive: false })`,
  con su `removeEventListener` en el retorno. El handler se saltea el evento entero si `e.ctrlKey` —es el
  zoom del navegador, AC15—, y si no hace `preventDefault`, ensucia el `tapLimpio` (D10) y
  `setRotation(r => rotacionPorRueda(r, e.deltaY))`. Con el setter funcional el efecto no depende de
  `rotation` y se suscribe una sola vez, que es lo contrario del efecto del teclado y por un motivo
  concreto: acá no hay ningún valor que el handler tenga que leer.
- **El menú contextual**, por prop: `preventDefault` siempre —el menú no se abre nunca sobre el
  tablero— y alterna solo si `reflejaElContextMenu(e)`.

## Paso 4 — Verificación, documentación y cierre

`pnpm verify` en verde (AC12). Después, a mano en el navegador, **todo lo que las puras no cubren**: las
puras deciden bien y lo que puede estar mal es el cableado. AC2 (la página no scrollea con el cursor
sobre el tablero, y sí afuera, y la consola sin el aviso de `preventDefault` pasivo), AC15 (`Ctrl`+rueda
hace zoom), AC4 (no aparece el menú contextual), AC7 y AC8 (la barra con el botón de Play enfocado
alterna **una** vez, y no scrollea), AC10 (contar los handlers de `window` en la consola) y AC13 (rotar
con el transporte corriendo no corta el sonido).

Documentación: la tabla de gestos a `docs/guides/quickstart.md` y al `<footer>` de `App.tsx`, que hoy
explica el modelo musical y no menciona ni un gesto. A `.claude/rules/ui.md`, la regla de dónde vive
un listener global — es la primera del repo (`research.md` §1) y la próxima se va a copiar de esta.
Y el conteo de efectos de `App.tsx`, que pasa de cuatro a seis en los tres archivos que lo dicen en
presente (`research.md` §11).

## Verificación

| Qué | Cómo |
|---|---|
| AC1, AC3, AC5, AC6 | `input.test.ts`, en `environment: 'node'` |
| AC7, AC8 | La **decisión** (`targetEsControl → null`) en `input.test.ts`; el **cableado** —que `App.tsx` mire bien el `e.target`— solo `[M]` en el navegador |
| AC9 | Por lectura: el atajo llama a `togglePlay`, que ya consulta `clockRunning()` |
| AC10 | `[M]` `pnpm dev` (StrictMode monta dos veces) + `getEventListeners(window).keydown.length === 1` en la consola de Chrome. No hay forma de testearlo: el repo no monta componentes (`research.md` §7) |
| AC11 | Por lectura y por lint: `Board.tsx` sin `useState` ni `useEffect`, y el `ref` creado en `App.tsx` |
| AC12 | `pnpm verify` |
| AC2, AC4, AC13, AC15 | `[M]` navegador |
| AC14 | Por lectura de los cinco archivos: `quickstart.md`, el `<footer>`, `ui.md`, `CLAUDE.md` y `overview.md` |
| **No cambia una nota** | `check_invariants` en proceso fresco antes y después, y el diff sin tocar `domain/` ni `audio/` |

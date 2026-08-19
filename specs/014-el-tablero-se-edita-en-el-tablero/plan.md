# Plan — Spec 014

Cinco pasos. El orden no es cosmético: el **1 es de dominio y no cambia nada de lo que suena** (agrega
un campo que nadie pone en `true` todavía), el 2 lo hace sonar, el 3 lo hace ver, el 4 borra y el 5
cierra. Partido así, cada commit es reversible solo.

## Paso 1 — `muted` entra al dominio, apagado

`PlacedPiece` gana `muted: boolean` **obligatorio** (`research.md` §6: opcional daría dos formas de
decir "no muteada", y el repo ya pagó ese error). Todo lo que construye una `PlacedPiece` —`App.tsx`,
los helpers de test, `simulateBoard.ts`— pasa a ponerlo en `false`.

Al final de este paso `pnpm verify` está en verde y **nada suena distinto**: el campo existe y nadie lo
enciende. Es lo que hace que el commit siguiente tenga un diff que se lea.

## Paso 2 — La pieza muteada suena como clicks

En `buildSequence`, la pieza con `muted: true` deja de emitir su `Step` y emite cinco `Click`s sin
`note`, en los offsets donde estaban sus notas (D3). El circuito no se toca: `gates`, `routeBetween`,
los offsets del resto y el `length` quedan idénticos — y eso es AC5, con un test que compara las dos
secuencias campo por campo.

Acá se resuelve `route-source.ts` (§5): la decisión por defecto es **(a) la pieza muteada no tiene
velo**, con el motivo escrito en el código —el velo dice "esto todavía no sonó", y una pieza muteada no
va a sonar—. Lo que no puede quedar es que el velo desaparezca sin que nadie lo haya decidido (AC9).

Los **dos bordes** van en este mismo paso, porque son el mismo archivo (`research.md` §9): `clickEn`
deja de ponerle `note` al click de cruce cuando el ocupante está muteado (AC17), y la rama `n === 1`
—un retorno temprano aparte del bucle— emite los cinco clicks igual que el caso general (AC18). Sin el
primero, AC7 es falso en uno de cada tres tableros con cruce.

`App.tsx` no necesita cambiar su proyección: los clicks ya viajan y los `Step` que no existen no se
proyectan (AC7).

## Paso 3 — El gesto y la baldosa blanca

**El handler**, con las cuatro ramas de la tabla del spec. La pura va en `src/components/input.ts` —el
módulo que crea el **013**—, no en uno paralelo. La rama nueva se decide con `occupantAt`, que devuelve
`PlacedPiece | null`, y no con `isValid` (D2, `research.md` §1):

```
celda ocupada por una pieza con `piece === selected`
  ├─ sin Alt → quitar esa pieza
  └─ con Alt → alternar su `muted`
celda ocupada por otra pieza  → nada (como hoy)
celda libre y jugada válida
  ├─ sin Alt → colocar, y `playNow` si el transporte está parado (como hoy)
  └─ con Alt → colocar con `muted: true`, y **sin** `playNow` (D9)
```

**La baldosa.** En `Board.tsx`, la pieza muteada no arma el `style` inline con `PIECE_COLOR` y cae al
mismo blanco que una celda libre, conservando `cell.note` y `cell.step` con el color de texto del
tablero (D4, §7).

**El `Alt` tiene que cruzar `Board`.** Hoy `onCellClick` es `(x: number, y: number) => void`
(`Board.tsx:112`) y el `onClick` de la celda (`:189`) no pasa el evento, así que `e.altKey` no existe
del lado de `App`: cambia la prop además del handler. Y en el mismo archivo queda el
`cursor-not-allowed` de `:190`, que sobre una celda propia dice "acá no entra" justo donde el click
ahora borra (AC20).

Decisión del paso: el muteo **no** entra por `cellTextFor`. Esa pura contesta qué dice la celda —nota y
paso—, y una pieza muteada dice exactamente lo mismo; lo que cambia es cómo se pinta, que es de
`Board.tsx`. Meterlo en `cell-text.ts` mezclaría las dos preguntas.

## Paso 4 — Muere `PlacedList`, y el layout se reacomoda

**Commit propio para el borrado**, que es la regla del repo (AC10): `PlacedList.tsx`, su import, su
`<PlacedList>` y el `orden` que `App.tsx` derivaba para él.

Con la lista afuera, el reparto pasa a paleta `md:col-span-4` / tablero `md:col-span-8` y `CELL_PX` a
**71** (D6, §3). Las clases **no están en `App.tsx`**: viven en `PiecePalette.tsx:36` y `Board.tsx:132`.
Y se reescriben **dos** comentarios, no uno: el docblock de `CELL_PX` —las dos frases que explican el 63
dejan de ser ciertas (§4)— y el de `Board.tsx:125`, que argumenta el `col-span-7` contra el 6 con los
mismos números viejos.

> `secuencia.steps.map(s => s.pieceId)` se va con la lista. El `useMemo` de `secuencia` **se queda**:
> lo consumen el motor y la cabeza lectora.

## Paso 5 — MCP, verificación y documentación

`simulate_board` acepta `muted` en su entrada y lo reporta (AC12) — es una fachada sobre el dominio, así
que refleja lo que `buildSequence` hace y no reimplementa la regla.

`pnpm verify` y `check_invariants` en proceso fresco (AC13). Documentación: `DESIGN.md` (el canal
nuevo, y por qué no es ni color ni opacidad), `directory-structure.md` (muere un componente),
`modelo-musical.md` (una pieza puede no sonar) y `.claude/rules/ui.md`.

## Verificación

| Qué | Cómo |
|---|---|
| AC5, AC6, AC17, AC18 | `sequence.test.ts`: dos secuencias, la misma pieza con y sin mutear; un tablero con cruce sobre la muteada; y el tablero de una sola pieza |
| AC1, AC2, AC3, AC4 | La decisión del handler se extrae como pura (igual que en el 013) y se testea en `node` |
| AC7 | Por lectura del efecto de reconciliación |
| AC8, AC9, AC20 | `[M]` navegador + lectura |
| AC19 | `route-source.test.ts`: el `kind` de las celdas de la pieza muteada |
| AC10 | El borrado en su propio commit, verificable en el log |
| AC11 | Remedido en el navegador y escrito en el docblock |
| AC12, AC13 | `pnpm verify` + `check_invariants` |
| AC14, AC15 | `[M]` a oído y a ojo |
| AC16 | Por lectura de los cuatro archivos |

> **AC14 se escucha después del 015.** Hasta entonces una pieza muteada suena como cinco ráfagas de
> ruido blanco de 20 ms, que es el click de hoy. Está en los riesgos del spec y no invalida el AC — lo
> posterga.

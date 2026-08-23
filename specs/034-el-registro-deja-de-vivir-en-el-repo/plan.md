# Plan — Spec 034

## Orden y por qué

El orden no es negociable y sale del research: **nada sale del repo hasta que exista de este lado**.
Publicar primero y gitignorear después deja siempre un estado recuperable; al revés, un fallo a mitad
deja specs que no están en ningún lado.

```text
Paso 1  los gates aguantan el vacío  ──┐
(y recién ahí se puede medir el resto) │
                                       ├──> Paso 4  el .gitignore
Paso 2  publicar: 33 issues + el mapa ─┤    (el punto de no retorno)
                                       │
Paso 3  hidratar + las 16 citas ───────┘
                                            └──> Paso 5  verificar en worktree
```

**El paso 1 va primero y solo.** Es el único que se puede verificar sin haber publicado nada, y es el
que impide que el resto avance en verde mentiroso — el research §4 midió que hoy `T015` pasa con cero
carpetas, así que sin este paso los pasos 2–4 se harían con un gate que no mira.

**El paso 4 es el punto de no retorno** y va en su propio commit, con los 133 borrados en un commit
aparte del `.gitignore`, por la regla del repo: los borrados van solos para que revertirlos sea
trivial.

## Paso 1 — Los gates sobreviven al vacío (AC7)

La regla que el research §4 dejó escrita: **en un mundo donde `specs/` puede no estar, la red
anti-vacío es el gate**; la aserción que mira el contenido es la que sobra cuando no hay contenido.

Concretamente, en `src/__tests__/specs-convencion.test.ts`:

- `T015` («cada spec tiene sus cuatro archivos») **hoy pasa con cero carpetas**. Tiene que fallar, o
  declarar explícitamente que sin specs no aplica — pero no puede quedarse en el medio.
- Los gates que miran `log.md` **no** dependen de los directorios y siguen siendo los mismos:
  `log.md` se queda trackeado.
- El gate «cada fila de `log.md` tiene su carpeta» **deja de tener sentido** tal como está: después
  del paso 4 no hay carpetas. Se convierte en «cada fila apunta a un issue del mapa».
- `enlaces-resueltos.test.ts` tiene que dejar de exigir que un enlace a `./NNN-*/spec.md` resuelva
  **cuando ese destino está ignorado**, sin dejar de verificar todos los demás. Es el gate más
  delicado del paso: aflojarlo de más lo apaga.

**Verificación del paso:** correr `pnpm verify` en un worktree con `specs/[0-9]*/` ya ignorado
—simulable sin publicar nada, como hizo el research— y confirmar que **falla**, y por el motivo
correcto. Un gate que nunca se vio fallar es un gate del que no se sabe si anda.

## Paso 2 — Publicar los 33 specs y escribir el mapa (AC2, AC3, AC4)

Un issue por spec, con el reparto que el research §3 fijó: **un archivo por cuerpo**.

| Va a | Qué | Peor caso |
|---|---|---|
| body | `spec.md` | 36.018 B (55 %) |
| comentario 1 | `research.md` | 29.663 B (45 %) |
| comentario 2 | `plan.md` | 22.110 B (34 %) |
| comentario 3 | `tasks.md` | 41.051 B (63 %) |

Y el `baseline.md` del 008, que es el único quinto archivo del repo, va como cuarto comentario.

**La traducción de enlaces se hace acá, al publicar, y no editando el archivo** (AC4, D3). Como el
mapa se completa a medida que se publica, esto es en **dos pasadas**: primero se crean los 33 issues
y se anota el mapa, después se publican los cuerpos ya traducidos. Un spec citado por otro que
todavía no tiene issue no se puede traducir en una sola pasada.

El mapa se escribe en `log.md`: la columna del enlace pasa de `./NNN-*/spec.md` a la URL del issue.

**El estado del issue refleja el del spec:** los `Implementado`, `Descartado` y `Superado` se crean y
se cierran; los `Propuesto` quedan abiertos.

## Paso 3 — Hidratar, y las 16 citas de afuera (AC5)

- **Hidratación**: un comando explícito que, dado el mapa de `log.md`, trae los cuerpos y reconstruye
  `specs/NNN-*/`. Lo corre quien lo necesite —un worktree nuevo, un clone limpio— y **no** un hook
  (D4). Vive donde ya está el acceso a `mcp__github__`, o sea del lado de las skills, **no** del
  server (AC6, research §5).
- **Las 16 citas**: 13 en `docs/`, 2 en `mcp-server/`, 1 en `DESIGN.md`. Pasan a apuntar al issue.
  Son las únicas referencias que se reescriben a mano en todo el spec.
- Las dos skills que corren en worktree —`/pr-review-batch` y `/spec-implement-batch`— documentan el
  paso de hidratación. Es exactamente el agujero que el 033 nombró y no cerró.

## Paso 4 — El `.gitignore` (AC1)

Dos commits, en este orden:

1. `specs/[0-9]*/` al `.gitignore`.
2. Los 133 archivos fuera del índice (`git rm --cached`), **solo**.

Los tres registros se quedan. El segundo commit es el que hay que poder revertir de un tirón, y por
eso va limpio.

## Paso 5 — Verificar donde se ve (AC8)

`pnpm verify` en la máquina **y en un worktree limpio**, porque el modo de falla que este spec puede
introducir sólo aparece en el segundo. Es la misma forma que el 023 descubrió con el comparador de
`walk()`: había un gate que pasaba por el sistema de archivos de quien lo corriera, y sólo se vio
corriéndolo en otra máquina.

Más las falsificaciones deliberadas, una por gate tocado: un mapa con una URL rota, un spec sin issue,
un issue sin fila, y `verify` en un worktree sin hidratar.

## Lo que este plan deliberadamente no hace

No toca `revisiones.md`, no migra los dos `.sh` a la tool, y no reescribe el historial. Los tres
están en «Fuera de alcance» del spec con su motivo.

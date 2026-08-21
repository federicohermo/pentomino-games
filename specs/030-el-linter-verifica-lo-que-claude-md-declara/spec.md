# Spec 030 — El linter verifica lo que CLAUDE.md declara

> Sin ticket: este repo no tiene tablero de Jira. Ver `specs/README.md`.
>
> **No cambia una nota, ni un tiempo, ni un timbre, ni un píxel.** Cambia quién se entera cuando algo
> se rompe. Seis reglas que el repo tiene escritas y no verificaba nadie pasan a fallar `pnpm lint`;
> la dirección de dependencia deja de prohibirse por el *string* del import y pasa a prohibirse por
> **ruta**, que es lo que borra la advertencia que el propio `eslint.config.js` lleva escrita —«es una
> red, no una prueba formal»—; el preset de React pasa de **2 reglas a 17**; y `eslint .` deja de
> reportar verde con warnings adentro.
>
> **El precio está medido y es el único punto discutible del spec:** `pnpm verify` pasa de **4,0 s a
> 11,8 s**, y el nodo es `lint`, que pasa de ~2,5 s a 10,2 s por el linting con tipos. Ya se recortó lo
> que no valía la pena: `import-x/no-cycle` costaba **15 s más** —el 60 % del total— y encontraba cero
> ciclos, así que no entró.

## Problema

`CLAUDE.md` tiene una sección titulada **«Reglas que valen en todo el repo»**. Ocho bullets. La
primera dice, y es la tesis del repo entero:

> **La dirección de dependencia la verifica el linter**, no la revisión.

Las otras siete no las verifica nadie. Están escritas y se cumplen por disciplina, que es exactamente
lo que ese primer bullet declara insuficiente. La lista, con lo que hoy pasa si se rompen:

| Regla de `CLAUDE.md` | Qué la verifica hoy |
|---|---|
| Dirección de dependencia entre capas | el linter, **contando `../`** |
| Dirección adentro de `domain/` | el linter, **con tres formas del mismo import** |
| Extensión explícita en todo import local | nadie |
| Los módulos no declaran constantes | nadie |
| Cero `enum` | `erasableSyntaxOnly`, con el mensaje de TypeScript |
| Sin estado global (ni Context, ni Redux, ni Zustand) | nadie |
| Cero `any`, cero `@ts-ignore` | el preset de tseslint para `any`; nadie para el `eslint-disable` que lo taparía |
| Español en comentarios | nadie, y no es automatizable |

Y hay tres agujeros más, medidos y no supuestos:

**1. `pnpm lint` no falla con warnings.** `eslint .` sale con exit 0 aunque avise, y hay exactamente
una regla en nivel `warn`: `react-hooks/exhaustive-deps`. O sea que la regla que vigila los cuatro
efectos que el spec 022 acaba de concentrar en `components/use-engine.ts` **no puede romper
`pnpm verify`**.

**2. El config lintea paquetes que no son suyos.** Verificado con `--print-config`: el bloque base es
`files: ['**/*.{ts,tsx}']`, sin anclar a `src/`, así que `mcp-server/src/index.ts` recibe 91 reglas de
la app, los globals de **browser** —`window`, `document` y `AudioContext` definidos; `process` no— y
`react-refresh/only-export-components` en **error**. No rompe hoy porque `no-undef` está apagado para
TypeScript y esos archivos no exportan componentes. Es sorpresa guardada, y contradice la regla que ese
mismo archivo escribe tres veces: `mcp-server/` es otro paquete.

**3. `eslint.config.js` se lintea con cero reglas.** Ni `js.configs.recommended`, porque el único
bloque que lo extiende está atado a `**/*.{ts,tsx}`. El archivo que decide qué se verifica es el único
que no se verifica.

### Y la razón de fondo, que es la que ordena el spec

Las dos reglas que sí se verifican lo hacen **por el string del import**, y eso tiene dos parches
escritos en el propio archivo. El primero, el conteo de profundidad:

> Los patrones cubren `../` y `../../`, que es la profundidad de hoy: al crear un subdirectorio nuevo
> hay que agregar el patrón. Es una red, no una prueba formal.

El segundo, las tres formas del mismo specifier — `./music.ts`, `./music` y `./music.js` resuelven
igual, y hay un helper (`especificadores()`) y diez líneas de comentario para prohibirlas juntas. Ese
comentario nombra la causa sin poder arreglarla: *«nada en el repo lintea la convención de la
extensión»*.

Los dos parches son la misma consecuencia. Prohibir rutas en vez de strings los borra a los dos, y
lintear la extensión borra el segundo por partida doble.

## Solución propuesta

Siete frentes. Los seis primeros son la config; el séptimo es lo que las reglas nuevas encontraron.

1. **La dirección pasa a ser por ruta.** `import-x/no-restricted-paths` con una zona por arista
   prohibida —las cuatro capas, `mcp-server/`, y las cinco filas de `DOMAIN_INTERNO`—, **todas en una
   sola regla**. Desaparecen los cuatro overrides que se pisaban entre sí, el helper
   `especificadores()` y el conteo de `../`. En `no-restricted-imports` quedan solo los **paquetes**
   —React para las dos capas puras, y los de estado global— porque un paquete de npm no tiene ruta.
2. **Las cuatro reglas de `CLAUDE.md` que entran con `no-restricted-syntax`**, sin agregar plugin:
   extensión explícita, cero `enum`, sin `createContext`, y los módulos sin constantes.
3. **`linterOptions`:** `reportUnusedDisableDirectives: 'error'` y `noInlineConfig: true`, más
   `--max-warnings 0` en el script. Los tres cierran la misma puerta: silenciar la regla en vez de
   arreglar el código.
4. **Linting con tipos** (`recommendedTypeChecked` + `projectService`), con `consistent-type-imports`
   y `no-import-type-side-effects` encima — que son gratis y obligatorios, porque los tres tsconfig
   tienen `verbatimModuleSyntax: true` y ahí un `import type` mal escrito **rompe el build**.
5. **`@vitest/eslint-plugin`** en los tests: `.only`, `.skip`, test sin aserción, títulos repetidos.
6. **Alcance:** el bloque base se ancla a `src/`, `mcp-server/` y los `*.config.ts` reciben globals de
   node, los `.js` reciben `js.configs.recommended`, y `ecmaVersion` pasa de `2020` a `latest`. Las
   reglas de React se acotan a donde puede haber React.
7. **Los cinco hallazgos** que las reglas nuevas encontraron en el código, arreglados.

## Criterios de aceptación

- **AC1** — `pnpm verify` en verde, con `pnpm lint` corriendo con `--max-warnings 0`.
- **AC2** — Un import prohibido **por ruta** falla el lint con el mensaje de su zona, y falla también
  desde una carpeta que hoy no existe (`src/domain/sub/`), que es lo que la versión por string no
  cubría. Probado a mano en las dos formas.
- **AC3** — Las cuatro reglas de `no-restricted-syntax` fallan sobre un archivo con las cuatro
  violaciones. Probado a mano, las cuatro disparan.
- **AC4** — Un `.only`, un `.skip` y un test sin aserción fallan el lint. Probado a mano.
- **AC5** — Un `eslint-disable` no silencia nada, y además **avisa** — y con `--max-warnings 0` ese
  aviso rompe el build. Probado a mano.
- **AC6** — Una promesa sin esperar en `audio/` falla el lint. Probado a mano.
- **AC7** — `especificadores()` y el conteo de `../` **no existen** en `eslint.config.js`.
- **AC8** — `--print-config mcp-server/src/index.ts` no reporta `window` ni
  `react-refresh/only-export-components`; `--print-config eslint.config.js` reporta más de 0 reglas.
- **AC9** — El preset de react-hooks activa 17 reglas y no 2, y el repo pasa las 17 sin cambiar una
  línea de componente.
- **AC10** — Los números de `pnpm verify` en `CLAUDE.md` son los nuevos y están medidos.
- **AC11** — Ninguna doc queda afirmando en presente algo que el spec volvió falso.

## Fuera de alcance

- **Las siete constantes de `Spectrum.tsx` y `Playhead.tsx`.** La regla de constantes se aplica a
  `domain/` y `audio/` y no a `components/`, y el porqué está en `eslint.config.js`: el problema
  medido es un valor escrito **dos veces**, y una constante privada de un componente no puede
  desincronizarse con nada. Sus docblocks explican el mecanismo de dibujo y pertenecen al lado del
  dibujo.
- **`import-x/no-cycle`.** Medida y descartada: 15 s, cero hallazgos, y redundante con las zonas.
- **ESLint 10.** Salió (10.8.1) y no se miró. Es un spec aparte.
- **El `--fix` masivo.** Sólo se autofixearon los cuatro `consistent-type-imports`, y el diff se
  revisó archivo por archivo.

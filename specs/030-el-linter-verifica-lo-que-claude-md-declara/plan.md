# Plan — Spec 030

Seis pasos. El orden importa en un solo lugar: **el paso 5 (los hallazgos del código) no se puede
hacer antes del paso 2**, porque hasta que las reglas no están puestas no se sabe qué encontraron. Todo
lo demás es independiente.

---

## Paso 1 — Las dependencias

`pnpm add -D -w eslint-plugin-react-hooks@latest eslint-plugin-react-refresh@latest
typescript-eslint@latest @vitest/eslint-plugin@latest eslint-plugin-import-x@latest`

Dos altas (`@vitest/eslint-plugin`, `eslint-plugin-import-x`) y tres subidas. La única que importa es
react-hooks 5.2.0 → 7.1.1, y arrastra el cambio de clave del preset.

`unrs-resolver` queda con su script de instalación bloqueado por el `allowBuilds` de
`pnpm-workspace.yaml`. **No se desbloquea**: el resolver que usa la config es `createNodeResolver`, que
es JavaScript puro. Verificar que las zonas disparan igual (control positivo) es parte del paso 2.

## Paso 2 — `eslint.config.js`

Se reescribe entero. La forma nueva, en orden:

1. `globalIgnores(['dist'])`.
2. Un bloque sin `files` con `linterOptions`: `reportUnusedDisableDirectives: 'error'` y
   `noInlineConfig: true`.
3. `**/*.js` → `js.configs.recommended` + globals de node + `ecmaVersion: 'latest'`. No necesita
   `disableTypeChecked` porque el bloque con tipos matchea `**/*.{ts,tsx}` y no lo alcanza.
4. `**/*.{ts,tsx}` → `recommendedTypeChecked` con `projectService`, más `import-x` (una regla: las
   zonas), `consistent-type-imports`, `no-import-type-side-effects`, las opciones de
   `restrict-template-expressions` y `no-floating-promises`, y los tres `no-restricted-syntax`
   genéricos.
5. Los globals por entorno: browser para `src/`, node para `mcp-server/` y `*.config.ts`.
6. React acotado: hooks en `src/**/*.tsx` + `src/**/use-*.ts`, refresh sólo en `.tsx`.
7. Los dos bloques de `no-restricted-imports` (paquetes).
8. La regla de constantes, sólo en `src/domain/*.ts` y `src/audio/*.ts`.
9. El bloque de vitest en `src/**/__tests__/**`.

**Se borran:** `MCP_SERVER`, `FUERA_DE_DOMAIN`, `especificadores()`, los cinco overrides generados por
`DOMAIN_INTERNO` y los dos overrides de capa. `DOMAIN_INTERNO` **se queda** como dato: alimenta cinco
zonas en vez de cinco overrides.

## Paso 3 — El script

`"lint": "eslint . --max-warnings 0"`.

## Paso 4 — Los controles positivos

Cada regla nueva tiene que fallar sobre una violación escrita a mano. **Es el paso que no se puede
saltear**: cero hallazgos es también lo que devuelve una regla que no corre. Se escriben cuatro
archivos sonda —uno en `domain/`, uno en `components/`, uno en `audio/`, uno en `__tests__/`—, se corre
el lint, se leen los mensajes y se borran.

## Paso 5 — Los cinco hallazgos del código

1. `domain/constants/sequence.constants.ts` nuevo: `PASOS_MAX`, con su docblock **mudado, no
   reescrito**.
2. `domain/constants/invariants.constants.ts` nuevo: `ROTATIONS`, con docblock nuevo — no tenía.
3. `domain/invariants.ts`: los dos literales `5` se leen por una variable `number` para que el `if`
   vuelva a ser una comparación de números y el mensaje sea alcanzable.
4. `audio/__tests__/voice.test.ts:213`: se le saca el `async` al `it` que no espera nada.
5. `eslint --fix` para los dos `consistent-type-imports` de `components/types/`. El diff se revisa.

## Paso 6 — La doc que quedó en falso

- `CLAUDE.md`: los números de `pnpm verify`, la regla de dirección, y los cuatro bullets que ahora sí
  se verifican (extensión, constantes, `enum`, estado global) más el nuevo de `.only`.
- `docs/guides/conventions.md`: la sección del linter, el párrafo de «la profundidad actual» —que deja
  de existir— y el carve-out de `components/` en la regla de constantes.
- `docs/architecture/directory-structure.md`: los dos archivos de constantes nuevos y la línea de
  `eslint.config.js`.
- `docs/guides/troubleshooting.md`: dos entradas nuevas —el error de arranque de react-hooks 7.x y el
  aviso de `noInlineConfig`—, porque las dos son errores reales ya pisados acá.

## Verificación

`pnpm verify` en verde, y los controles positivos del paso 4 leídos uno por uno. Los números de tiempo
se remiden con caché caliente y se anotan.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

/**
 * El gate del spec 037: no se edita el producto sin un spec detras de la rama.
 *
 * **Se prueba contra un repo FABRICADO**, por el mismo motivo que las tools de `specs/`
 * se prueban contra un registro fabricado: el gate decide leyendo `git rev-parse` y
 * `specs/mapa.json`, asi que ejercerlo de verdad pide cambiar de rama — y hacerlo sobre
 * este repo dejaria la sesion en otra rama si un test se cae a la mitad.
 *
 * Con un repo de juguete las tres ramas que hay que probar existen de verdad y el gate
 * corre sin ningun parametro de test. **No hay variable de entorno que le diga la rama**:
 * un backdoor de testing en un gate es la primera cosa que alguien usa para saltearlo.
 *
 * ## Las dos direcciones, y por que la segunda importa mas
 *
 * Un gate probado solo del lado del «no» bloquea algo que no debia y **nadie lo nota
 * hasta que molesta** — y para entonces la salida es apagarlo. Por eso hay tantos casos
 * de `allow` como de `deny`, y los de `allow` incluyen los dos que el propio spec declara
 * fuera del gate: `specs/` y `.claude/`.
 *
 * Este archivo esta fuera del `include` de coverage (`src/**`), asi que no entra al
 * umbral de 100: el criterio de suficiencia es que cada caso sea un modo de falla real.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const GATE_REAL = resolve(AQUI, '../gate-de-spec.mjs');

let repo: string;

/** El payload que Claude Code le pasa al hook `PreToolUse`. */
const payload = (file_path: string, tool_name = 'Edit') =>
  JSON.stringify({ tool_name, tool_input: { file_path } });

interface Decision { permissionDecision: string; permissionDecisionReason?: string }

/** Corre el gate en el repo fabricado y devuelve la decision ya parseada. */
function correr(entrada: string): Decision {
  const salida = execFileSync(process.execPath, [join(repo, '.claude/scripts/gate-de-spec.mjs')], {
    input: entrada, encoding: 'utf8', cwd: repo,
  });
  return (JSON.parse(salida) as { hookSpecificOutput: Decision }).hookSpecificOutput;
}

const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' });

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'gate-de-spec-'));

  mkdirSync(join(repo, '.claude/scripts'), { recursive: true });
  mkdirSync(join(repo, 'src/domain'), { recursive: true });
  mkdirSync(join(repo, 'mcp-server/src'), { recursive: true });
  mkdirSync(join(repo, 'docs'), { recursive: true });
  mkdirSync(join(repo, 'specs'), { recursive: true });

  // El gate de verdad, no una copia escrita a mano: si alguien lo edita, esto lo prueba.
  cpSync(GATE_REAL, join(repo, '.claude/scripts/gate-de-spec.mjs'));
  writeFileSync(join(repo, 'specs/mapa.json'), JSON.stringify({
    '037': { issue: 104, carpeta: '037-un-cambio', fecha: '2026-08-24', estado: 'Propuesto', titulo: 'Spec 037' },
  }));
  writeFileSync(join(repo, 'src/domain/board.ts'), '// de juguete\n');

  git('init', '-b', 'main');
  git('config', 'user.email', 'gate@test');
  git('config', 'user.name', 'Gate');
  git('add', '-A');
  git('commit', '-m', 'inicial', '--no-gpg-sign');
});

afterAll(() => { rmSync(repo, { recursive: true, force: true }); });

describe('bloquea lo que tiene que bloquear', () => {
  it('`src/` desde `main`', () => {
    git('checkout', 'main');
    const r = correr(payload('src/domain/board.ts'));
    expect(r.permissionDecision).toBe('deny');
    expect(r.permissionDecisionReason).toContain('desde `main`');
  });

  it('`src/` desde una rama que no nombra un spec', () => {
    git('checkout', '-B', 'fix/algo-urgente', 'main');
    const r = correr(payload('src/domain/board.ts'));
    expect(r.permissionDecision).toBe('deny');
    expect(r.permissionDecisionReason).toContain('no nombra un spec');
  });

  it('una rama que dice ser de un spec que no esta en el mapa', () => {
    // El caso del numero mal escrito, y el del spec que todavia no se publico. Los dos
    // se ven igual desde aca, y el mensaje nombra los dos.
    git('checkout', '-B', 'feature/999-no-existe', 'main');
    const r = correr(payload('src/domain/board.ts'));
    expect(r.permissionDecision).toBe('deny');
    expect(r.permissionDecisionReason).toContain('no tiene entrada');
  });

  it('las tres carpetas protegidas, no solo `src/`', () => {
    git('checkout', '-B', 'main-sin-spec', 'main');
    for (const ruta of ['src/domain/board.ts', 'mcp-server/src/pieces.ts', 'docs/architecture/overview.md']) {
      expect(correr(payload(ruta)).permissionDecision, ruta).toBe('deny');
    }
  });

  it('no se lo esquiva con un `..`: la ruta se resuelve antes de compararla', () => {
    // Comparar el string dejaria pasar `specs/../src/…`, que es el mismo archivo.
    git('checkout', '-B', 'main-sin-spec', 'main');
    expect(correr(payload('specs/../src/domain/board.ts')).permissionDecision).toBe('deny');
  });

  it('el mensaje SIEMPRE dice como salir: sin eso, el reflejo es saltear el gate', () => {
    git('checkout', 'main');
    const r = correr(payload('src/domain/board.ts'));
    expect(r.permissionDecisionReason).toContain('spec-create');
    expect(r.permissionDecisionReason).toContain('publicar-spec.mjs');
  });
});

describe('deja pasar lo que no le toca', () => {
  it('`src/` desde la rama de un spec que existe', () => {
    git('checkout', '-B', 'feature/037-un-cambio', 'main');
    expect(correr(payload('src/domain/board.ts')).permissionDecision).toBe('allow');
  });

  it('`specs/` y `.claude/`, que es adonde el flujo te manda a escribir primero', () => {
    // Estan fuera a proposito: `specs/` es el paso 2 del skill, y `.claude/` es donde
    // vive el gate. Uno que se impide arreglarse a si mismo se borra en vez de corregirse.
    git('checkout', 'main');
    for (const ruta of ['specs/037-un-cambio/spec.md', '.claude/scripts/gate-de-spec.mjs']) {
      expect(correr(payload(ruta)).permissionDecision, ruta).toBe('allow');
    }
  });

  it('un archivo de la raiz, como `package.json`', () => {
    // El gate no puede impedir instalar una dependencia, y pretenderlo lo volveria
    // molesto sin volverlo util.
    git('checkout', 'main');
    expect(correr(payload('package.json')).permissionDecision).toBe('allow');
  });

  it('un nombre que EMPIEZA como una protegida pero no lo es', () => {
    // `src-viejo/` no es `src/`. Sin `relative`, un `startsWith` lo bloquearia.
    git('checkout', 'main');
    expect(correr(payload('src-viejo/board.ts')).permissionDecision).toBe('allow');
  });
});

describe('falla abierto, y lo declara', () => {
  it('un payload sin `file_path` pasa, pero deja escrito que no verifico', () => {
    // Un payload que cambie de forma dejaria el gate mudo para siempre. Este mensaje es
    // lo unico que lo delata.
    git('checkout', 'main');
    const r = correr(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } }));
    expect(r.permissionDecision).toBe('allow');
    expect(r.permissionDecisionReason).toContain('no se pudo verificar');
  });

  it('un payload que no es JSON tampoco rompe la sesion', () => {
    git('checkout', 'main');
    expect(correr('no soy json').permissionDecision).toBe('allow');
  });

  it('sin `mapa.json` legible pasa declarandolo, en vez de bloquear todo', () => {
    // Un gate que rompe la sesion entera se desactiva el mismo dia, y ahi no queda gate.
    git('checkout', '-B', 'feature/037-un-cambio', 'main');
    rmSync(join(repo, 'specs/mapa.json'));
    try {
      const r = correr(payload('src/domain/board.ts'));
      expect(r.permissionDecision).toBe('allow');
      expect(r.permissionDecisionReason).toContain('mapa.json');
    } finally {
      writeFileSync(join(repo, 'specs/mapa.json'), JSON.stringify({
        '037': { issue: 104, carpeta: '037-un-cambio', fecha: '2026-08-24', estado: 'Propuesto', titulo: 'Spec 037' },
      }));
    }
  });
});

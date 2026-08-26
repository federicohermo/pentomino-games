import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
const LIB_REAL = resolve(AQUI, '../lib');

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
  // Con su `lib/`, que es de donde importa la decision de si una ruta esta protegida.
  cpSync(GATE_REAL, join(repo, '.claude/scripts/gate-de-spec.mjs'));
  cpSync(LIB_REAL, join(repo, '.claude/scripts/lib'), { recursive: true });
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

  it('`src/` desde `staging`, y el mensaje la nombra en vez de hablar de specs', () => {
    // `staging` es la rama DEFAULT del repositorio desde el 2026-08-26, o sea adonde
    // apunta cada `gh pr create` y cada `clone` fresco. Ya caia por «no nombra un spec»,
    // que es el veredicto correcto con el diagnostico equivocado: invita a renombrar la
    // rama de integracion. La asercion que importa es la segunda.
    git('checkout', '-B', 'staging', 'main');
    const r = correr(payload('src/domain/board.ts'));
    expect(r.permissionDecision).toBe('deny');
    expect(r.permissionDecisionReason).toContain('desde `staging`');
    expect(r.permissionDecisionReason).not.toContain('no nombra un spec');
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

/**
 * El bug de los dos discos, y por que este bloque no se parece a ninguno de los de arriba.
 *
 * `relative()` entre `D:` y `C:` devuelve la ruta ABSOLUTA del destino: no hay ningun camino
 * con `..` que lleve de un disco al otro. Decidiendo solo por ese prefijo, esa respuesta era
 * indistinguible de una que cae adentro, asi que el gate daba por protegido cualquier archivo
 * del otro disco y bloqueaba desde `main` toda escritura ahi — con el repo en `D:` y el
 * temporal en `C:`, el scratchpad entero. Mordio dos veces.
 *
 * **No se puede fabricar con el repo de juguete**: el gate usa el modulo de rutas de la
 * plataforma, asi que reproducirlo pide dos discos de verdad. Eso depende de la maquina y no
 * existe en el `ubuntu-latest` de la CI, donde un test asi seria verde sin probar nada.
 *
 * Por eso la decision se mudo a `lib/rutas-protegidas.mjs` y recibe el modulo de rutas por
 * parametro: con `path.win32` inyectado el caso da lo MISMO en las tres plataformas. Se
 * ejerce por subproceso, como todo lo demas de este archivo, porque `allowJs` esta apagado a
 * proposito y un `.ts` no puede importar un `.mjs` — y el modulo es `.mjs` y no `.ts` porque
 * el gate lo carga en cada llamada a una herramienta y compilar TypeScript ahi cuesta 38 ms
 * medidos por llamada. El porque entero vive en el encabezado de ese archivo.
 */
describe('`estaProtegida`, con el modulo de rutas inyectado', () => {
  const LIB = pathToFileURL(resolve(AQUI, '../lib/rutas-protegidas.mjs')).href;
  const PROTEGIDAS = ['src', 'mcp-server/src', 'docs'];

  /**
   * Las respuestas a un lote de rutas, con `path.win32` o `path.posix` de por medio.
   *
   * Van en lote y no de a una para que el bloque cueste una llamada a `node` por caso de
   * test y no una por asercion: el subproceso es lo caro, y las rutas son strings.
   */
  function decidir(sabor: 'win32' | 'posix', raiz: string, rutas: readonly string[]): boolean[] {
    const guion = [
      "import path from 'node:path';",
      `import { estaProtegida } from ${JSON.stringify(LIB)};`,
      `const respuestas = ${JSON.stringify(rutas)}.map(`,
      `  (r) => estaProtegida(path.${sabor}, ${JSON.stringify(raiz)}, ${JSON.stringify(PROTEGIDAS)}, r));`,
      'process.stdout.write(JSON.stringify(respuestas));',
    ].join('\n');
    const salida = execFileSync(process.execPath, ['--input-type=module', '-e', guion], { encoding: 'utf8' });
    // `JSON.parse` y no un `=== 'true'`: si el guion imprimiera cualquier otra cosa, esto
    // revienta en vez de contestar `false` y dar verde por el motivo equivocado.
    return JSON.parse(salida) as boolean[];
  }

  const RAIZ_WIN = 'D:\\repo';

  it('una ruta de OTRO disco no esta protegida, aunque no empiece con `..`', () => {
    // El bug, exactamente. Sin `isAbsolute` las dos dan `true`.
    expect(decidir('win32', RAIZ_WIN, ['C:\\Users\\fede_\\AppData\\Local\\Temp\\nota.txt', 'C:\\src\\board.ts']))
      .toEqual([false, false]);
  });

  it('afuera del repo pero en SU disco tampoco, que es el camino donde el `..` si existe', () => {
    // El vecino del caso de arriba, y el que dice que el arreglo no fue apagar la
    // comparacion: por aca `relative` sigue devolviendo `..\\otro\\x.ts` y decide como antes.
    expect(decidir('win32', RAIZ_WIN, ['D:\\otro\\x.ts'])).toEqual([false]);
    expect(decidir('posix', '/repo', ['/otro/x.ts'])).toEqual([false]);
  });

  it('las tres protegidas siguen estando adentro, con los dos separadores', () => {
    const adentro = ['src/domain/board.ts', 'mcp-server/src/pieces.ts', 'docs/architecture/overview.md'];
    expect(decidir('win32', RAIZ_WIN, [...adentro, 'D:\\repo\\src\\domain\\board.ts']))
      .toEqual([true, true, true, true]);
    expect(decidir('posix', '/repo', adentro)).toEqual([true, true, true]);
  });

  it('la carpeta protegida ES una ruta protegida, y sus vecinos de nombre no', () => {
    // `relative(raiz/src, raiz/src)` da `''`, y el criterio anterior lo excluia. Los tres
    // vecinos van al lado porque son los que un criterio demasiado laxo confundiria con el
    // caso nuevo: el que empieza igual, el hermano, y la raiz que las contiene a todas.
    const casos = ['src', 'mcp-server/src', 'docs', 'src-viejo', 'mcp-server', '.'];
    expect(decidir('win32', RAIZ_WIN, casos)).toEqual([true, true, true, false, false, false]);
    expect(decidir('posix', '/repo', casos)).toEqual([true, true, true, false, false, false]);
  });

  it('y los cuatro que el gate ya distinguia, que son los que el cambio podia aflojar', () => {
    // Los mismos casos que los `it` de arriba prueban contra el gate entero, aca contra
    // `win32` fijo: el `..` que vuelve a entrar, el prefijo que no alcanza, la raiz y
    // `.claude/`. Son los vecinos del caso nuevo, y los que el cambio de criterio podia
    // aflojar sin que nadie lo notara hasta que el gate dejara de servir.
    const casos = ['specs/../src/domain/board.ts', 'src-viejo/board.ts', 'package.json', '.claude/scripts/gate-de-spec.mjs'];
    expect(decidir('win32', RAIZ_WIN, casos)).toEqual([true, false, false, false]);
  });
});

describe('falla abierto, y lo declara', () => {
  it('un payload sin `file_path` pasa, pero deja escrito que no verifico', () => {
    // Un payload que cambie de forma dejaria el gate mudo para siempre. Este mensaje es
    // lo unico que lo delata.
    //
    // El payload es de `Edit` y no de `Bash`, y el cambio es del spec 037 mismo: desde
    // que el gate entiende `Bash`, un `{tool_name:'Bash', command:'ls'}` ya NO es un
    // payload ilegible — es uno legible que no escribe nada, y pasa callado con razon.
    // Para probar «no se pudo leer» hace falta una herramienta de archivo sin su ruta.
    git('checkout', 'main');
    const r = correr(JSON.stringify({ tool_name: 'Edit', tool_input: { comando: 'ls' } }));
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

/**
 * El agujero que tenia el gate cuando solo miraba `Edit|Write|MultiEdit`.
 *
 * No es un eje mas: es un agujero **dirigido**. Negarle `Edit` sobre `src/` a un agente
 * lo empuja justo hacia `sed -i` y hacia la redireccion, asi que la mitad que faltaba era
 * la que el propio `deny` de la otra mitad iba a producir.
 *
 * La direccion del `allow` pesa MAS que en el resto del archivo, y por eso hay mas casos
 * de ese lado: `Bash` es la herramienta con la que se lee, se busca y se corre la suite.
 * Un gate que se pase de listo aca no molesta de vez en cuando — molesta todo el tiempo,
 * y se apaga entero el mismo dia.
 */
describe('lo que escribe `Bash`', () => {
  const bash = (command: string) => JSON.stringify({ tool_name: 'Bash', tool_input: { command } });

  describe('bloquea la escritura', () => {
    it('la redireccion, que es el escape mas corto: no necesita ningun comando conocido', () => {
      git('checkout', 'main');
      expect(correr(bash('echo "// nada" > src/domain/board.ts')).permissionDecision).toBe('deny');
    });

    it('`>>`, que es el mismo escape sin truncar', () => {
      git('checkout', 'main');
      expect(correr(bash('echo x >> mcp-server/src/pieces.ts')).permissionDecision).toBe('deny');
    });

    it('`sed -i`, que es la forma con la que un agente edita sin `Edit`', () => {
      git('checkout', 'main');
      expect(correr(bash("sed -i 's/viejo/nuevo/' src/domain/board.ts")).permissionDecision).toBe('deny');
    });

    it('`tee` en el segundo tramo de un pipe, donde vive el destino', () => {
      // Mirar el comando entero de una atribuiria el destino al `cat`, que solo lee.
      git('checkout', 'main');
      expect(correr(bash('cat /tmp/x | tee docs/architecture/overview.md')).permissionDecision).toBe('deny');
    });

    it('`rm`, porque borrar es escribir', () => {
      git('checkout', 'main');
      expect(correr(bash('rm -f src/domain/board.ts;')).permissionDecision).toBe('deny');
    });

    it('`rm -rf src`: la carpeta protegida tambien se protege a si misma', () => {
      // El agujero que dejaba el `rel !== ''`, y es el peor de todos: un archivo de adentro
      // se bloqueaba y la carpeta ENTERA pasaba. Vale para las tres, asi que las tres van.
      git('checkout', 'main');
      for (const carpeta of ['src', 'mcp-server/src', 'docs']) {
        expect(correr(bash(`rm -rf ${carpeta}`)).permissionDecision, carpeta).toBe('deny');
      }
    });

    it('y tampoco se la esquiva nombrandola con una barra al final o con un `..`', () => {
      // Las dos formas que `resolve` normaliza al mismo string vacio. Sin `relative` de por
      // medio, cualquiera de las dos seria un `rm -rf` distinto del que se bloquea.
      git('checkout', 'main');
      expect(correr(bash('rm -rf src/')).permissionDecision).toBe('deny');
      expect(correr(bash('rm -rf specs/../src')).permissionDecision).toBe('deny');
    });

    it('el destino de un `mv`, y no su origen', () => {
      git('checkout', 'main');
      expect(correr(bash('mv /tmp/board.ts src/domain/board.ts')).permissionDecision).toBe('deny');
    });

    it('una ruta entrecomillada, que sin desentrecomillar se leeria con las comillas adentro', () => {
      git('checkout', 'main');
      expect(correr(bash('echo x > "src/domain/board.ts"')).permissionDecision).toBe('deny');
    });

    it('no se lo esquiva con un `..` por la ventana de `Bash` tampoco', () => {
      // El mismo caso que ya se probaba sobre `Edit`, por el otro camino.
      git('checkout', 'main');
      expect(correr(bash('echo x > specs/../src/domain/board.ts')).permissionDecision).toBe('deny');
    });

    it('el nombre del comando se compara sin su ruta: `/usr/bin/sed` es `sed`', () => {
      git('checkout', 'main');
      expect(correr(bash("/usr/bin/sed -i 's/a/b/' src/domain/board.ts")).permissionDecision).toBe('deny');
    });
  });

  describe('deja pasar lo que solo LEE', () => {
    it('un `cat` de un archivo protegido', () => {
      git('checkout', 'main');
      expect(correr(bash('cat src/domain/board.ts')).permissionDecision).toBe('allow');
    });

    it('un `grep` sobre `src/` que redirige a OTRO lado', () => {
      // El falso positivo caro: el comando nombra una carpeta protegida y ademas trae un
      // `>`, pero lo que escribe es `/tmp`. Emparejar el operador con SU destino es lo
      // unico que lo distingue de un `> src/…`.
      git('checkout', 'main');
      expect(correr(bash('grep -rn foo src/domain > /tmp/hallazgos.txt')).permissionDecision).toBe('allow');
    });

    it('`sed` SIN `-i`, que imprime y no toca el archivo', () => {
      git('checkout', 'main');
      expect(correr(bash("sed 's/a/b/' src/domain/board.ts")).permissionDecision).toBe('allow');
    });

    it('un `cp` que usa el archivo protegido como ORIGEN', () => {
      git('checkout', 'main');
      expect(correr(bash('cp src/domain/board.ts /tmp/copia.ts')).permissionDecision).toBe('allow');
    });

    it('`2>&1` no es un archivo: redirige un descriptor', () => {
      // Sin el `(?!&)` esto se leeria como «escribe en el archivo `1`» y, peor, cualquier
      // comando con `2>&1` adentro entraria al camino de bloqueo.
      git('checkout', 'main');
      expect(correr(bash('pnpm test 2>&1')).permissionDecision).toBe('allow');
    });

    it('escribir en `specs/` y en `.claude/`, que estan fuera del gate a proposito', () => {
      git('checkout', 'main');
      for (const c of ['echo x > specs/037-un-cambio/spec.md', 'sed -i s/a/b/ .claude/scripts/gate-de-spec.mjs']) {
        expect(correr(bash(c)).permissionDecision, c).toBe('allow');
      }
    });

    it('escribir en `src/` desde la rama de un spec que existe', () => {
      // La direccion que importa mas: con la rama correcta, `Bash` no se entera del gate.
      git('checkout', '-B', 'feature/037-un-cambio', 'main');
      expect(correr(bash('echo x > src/domain/board.ts')).permissionDecision).toBe('allow');
    });
  });

  it('un `Bash` sin `command` pasa, pero deja escrito que no verifico', () => {
    // Mismo motivo que el payload sin `file_path`: si el payload cambia de forma, este
    // mensaje es lo unico que lo delata antes de que el gate quede mudo para siempre.
    git('checkout', 'main');
    const r = correr(JSON.stringify({ tool_name: 'Bash', tool_input: {} }));
    expect(r.permissionDecision).toBe('allow');
    expect(r.permissionDecisionReason).toContain('no se pudo verificar');
  });
});

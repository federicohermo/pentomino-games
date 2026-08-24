/**
 * El gate del spec 037: no se edita el producto sin un spec detrás de la rama.
 *
 * Corre como hook `PreToolUse` sobre `Edit|Write|MultiEdit`. Recibe el payload del
 * hook por stdin y contesta por stdout con `permissionDecision`.
 *
 * ## Por que existe
 *
 * `CLAUDE.md` y `specs/README.md` documentan el flujo —cuatro archivos,
 * `publicar-spec.mjs`, la rama recien despues— pero es prosa, y la prosa no frena a
 * nadie. La sesion que abrio el spec 036 reporto un bug de dominio y el agente abrio
 * una rama y edito `src/domain/` sin spec y sin issue: nada se lo impidio.
 *
 * Es el mismo hallazgo del spec 030 un nivel mas arriba. Ese movio las reglas de
 * `CLAUDE.md` al linter porque «antes eran prosa, y la mitad estaba desincronizada».
 * La regla que dice como EMPIEZA un cambio seguia siendo prosa.
 *
 * ## Tres decisiones que no son obvias
 *
 * 1. **Mira la edicion y no el commit.** Sobre el commit llega tarde: el trabajo ya
 *    esta hecho, y el costo de volver atras es lo que hace que la salida sea saltearlo.
 *    Sobre la edicion, cumplir cuesta cero — todavia no se escribio nada.
 *
 * 2. **Si algo falla, DEJA PASAR y lo dice.** Un gate que rompe la sesion entera se
 *    desactiva el mismo dia, y ahi no queda gate. Falla abierto a proposito: lo que
 *    protege es una convencion, no un secreto.
 *
 * 3. **El mensaje dice como salir.** Bloquear sin decir que hacer produce el reflejo de
 *    buscar como saltear el bloqueo, que es el fracaso completo del gate.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Lo que el gate protege.
 *
 * `specs/` y `.claude/` quedan afuera **a proposito**: son adonde el flujo te manda a
 * escribir primero, y `.claude/` es ademas donde vive este mismo archivo. Un gate que se
 * impide arreglarse a si mismo se termina borrando en vez de corregirse.
 *
 * `package.json` y los configs tampoco: el gate no puede impedir instalar una
 * dependencia, y pretenderlo lo volveria molesto sin volverlo util.
 */
const PROTEGIDAS = ['src', 'mcp-server/src', 'docs'];

/** Las ramas que pasan: `feature/NNN-…` con `NNN` en el mapa. */
const RAMA_DE_SPEC = /^feature\/(\d{3})-/;

/** Deja pasar, y opcionalmente cuenta por que. Es la salida por defecto de todo fallo. */
const pasar = (motivo) => {
  const salida = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } };
  // `permissionDecisionReason` solo cuando hay algo que declarar: un gate que no pudo
  // correr tiene que decirlo, y uno que decidio que no le tocaba, no.
  if (motivo) salida.hookSpecificOutput.permissionDecisionReason = motivo;
  console.log(JSON.stringify(salida));
  process.exit(0);
};

const bloquear = (motivo) => {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: motivo,
    },
  }));
  process.exit(0);
};

/** El `file_path` del payload, o `null` si el payload no trae uno que se pueda leer. */
function rutaDelPayload(crudo) {
  try {
    const { tool_input: entrada } = JSON.parse(crudo);
    const ruta = entrada?.file_path;
    return typeof ruta === 'string' && ruta.length > 0 ? ruta : null;
  } catch {
    return null;
  }
}

/**
 * Si la ruta cae dentro de una carpeta protegida.
 *
 * Compara por RUTA RESUELTA y no por el string: `relative` normaliza los `..`, las
 * barras invertidas de Windows y las rutas relativas, asi que
 * `src/../mcp-server/src/x.ts` cae donde tiene que caer. Comparar el string dejaria
 * pasar cualquiera de esas tres formas.
 */
function estaProtegida(ruta) {
  const abs = resolve(RAIZ, ruta);
  return PROTEGIDAS.some((carpeta) => {
    const rel = relative(resolve(RAIZ, carpeta), abs);
    return rel !== '' && !rel.startsWith('..') && !rel.startsWith(`..${sep}`);
  });
}

const crudo = readFileSync(0, 'utf8');
const ruta = rutaDelPayload(crudo);

// Sin ruta legible no hay nada que decidir. Pasa, pero lo DICE: un payload que cambio de
// forma dejaria el gate mudo para siempre, y esta linea es la que lo delata.
if (ruta === null) pasar('gate-de-spec: el payload no trae `file_path`, no se pudo verificar la rama');
if (!estaProtegida(ruta)) pasar();

let rama;
try {
  rama = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'],
    { cwd: RAIZ, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
} catch {
  pasar('gate-de-spec: no se pudo leer la rama con git, no se verifico');
}

const COMO_SALIR =
  'La salida es el skill `spec-create`: medir, escribir los cuatro archivos en ' +
  '`specs/<NNN>-<kebab>/`, publicarlos con `node .claude/scripts/publicar-spec.mjs crear` y ' +
  '`publicar`, commitear SOLO `specs/mapa.json` a `main`, y recien ahi ' +
  '`git checkout -b feature/<NNN>-<kebab>`. Si el cambio de verdad no necesita spec —un typo, ' +
  'un bump de version, revertir el commit anterior— el skill lo dice por escrito, pero la rama ' +
  'igual no puede ser `main`.';

if (rama === 'main') {
  bloquear(`No se edita \`${ruta}\` desde \`main\`. ${COMO_SALIR}`);
}

const match = RAMA_DE_SPEC.exec(rama);
if (match === null) {
  bloquear(
    `La rama \`${rama}\` no nombra un spec, y \`${ruta}\` esta protegida. La rama que pasa se ` +
    `llama \`feature/<NNN>-<kebab>\`. ${COMO_SALIR}`,
  );
}

const id = match[1];
let mapa;
try {
  mapa = JSON.parse(readFileSync(resolve(RAIZ, 'specs/mapa.json'), 'utf8'));
} catch {
  pasar('gate-de-spec: no se pudo leer `specs/mapa.json`, no se verifico el spec de la rama');
}

if (mapa[id] === undefined) {
  bloquear(
    `La rama \`${rama}\` dice ser del spec ${id}, que no tiene entrada en \`specs/mapa.json\`. ` +
    `O el spec no se publico todavia, o el numero esta mal. ${COMO_SALIR}`,
  );
}

pasar();

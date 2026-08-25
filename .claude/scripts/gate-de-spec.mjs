/**
 * El gate del spec 037: no se edita el producto sin un spec detrás de la rama.
 *
 * Corre como hook `PreToolUse` sobre `Edit|Write|MultiEdit|Bash`. Recibe el payload
 * del hook por stdin y contesta por stdout con `permissionDecision`.
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
 * ## Cuatro decisiones que no son obvias
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
 *
 * 4. **Mira tambien lo que escribe `Bash`.** Un gate solo sobre `Edit|Write|MultiEdit`
 *    tiene el agujero del tamano de `sed -i`, y encima es un agujero DIRIGIDO: negarle
 *    `Edit` a un agente lo empuja justo hacia la redireccion. Lo que se mira es un
 *    conjunto declarado de formas de escritura, no un parser de shell — ver
 *    `destinosDeBash`.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// `path` se importa entero y se le PASA a `estaProtegida`: el caso que rompio al gate —dos
// discos de Windows— solo se puede probar inyectando `path.win32`, y por eso esa decision
// vive afuera y recibe el modulo. El porque entero, en el encabezado de ese archivo.
import { estaProtegida } from './lib/rutas-protegidas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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

/** Quita las comillas que envuelven a un token de shell, si las tiene. */
const desentrecomillar = (token) =>
  /^(".*"|'.*')$/s.test(token) ? token.slice(1, -1) : token;

/**
 * Los comandos que ESCRIBEN, y de que argumentos sale el destino.
 *
 * Un `Map` y no un objeto: con un objeto, `ESCRITORES['constructor']` contesta una
 * funcion heredada y un comando llamado `constructor` entraria por la ventana.
 *
 * `cp` y `mv` escriben SOLO su ultimo argumento —el origen es lectura, y contarlo
 * bloquearia un `cp src/board.ts /tmp/` legitimo—; `rm` destruye todos los suyos; y
 * `sed` escribe unicamente con `-i`. El script de `sed` (`s/a/b/`) queda en la lista
 * de candidatos, pero no resuelve bajo ninguna carpeta protegida, asi que distinguirlo
 * no haria falta ni aunque fuera gratis.
 */
const ESCRITORES = new Map([
  ['tee', (args) => args],
  ['cp', (args) => args.slice(-1)],
  ['mv', (args) => args.slice(-1)],
  ['rm', (args) => args],
  ['truncate', (args) => args],
  ['sed', (args, flags) => (flags.some((f) => f.startsWith('-i')) ? args : [])],
]);

/**
 * Los archivos que un comando de `Bash` escribe.
 *
 * Existe porque el gate sobre `Edit|Write|MultiEdit` tenia un agujero del tamano de
 * `sed -i`: al agente al que se le niega `Edit` sobre `src/` le queda la redireccion,
 * y el `deny` de la otra herramienta lo empuja **justo** hacia ese escape. No es
 * hipotetico — la sesion de review que encontro esto corria con un system prompt que
 * pide preferir `Bash` para editar archivos.
 *
 * Es DETECCION y no un parser de shell: reconoce las formas que se usan de verdad
 * —redireccion, `sed -i`, `tee`, `cp`/`mv`/`rm`/`truncate`— y **no pretende ser
 * exhaustiva**. Un `python -c` que abra el archivo pasa, y esta bien que pase: la
 * decision 2 del encabezado vale igual aca, y un gate que intente parsear shell de
 * verdad se equivoca en la direccion cara, que es bloquear lo que no debia.
 */
function destinosDeBash(comando) {
  const destinos = [];

  // La redireccion se busca sobre el string entero y no por segmento: no necesita
  // ningun comando conocido adelante, que es lo que la vuelve el escape mas corto de
  // todos. El `(?!&)` deja afuera `2>&1`, que redirige un descriptor y no un archivo.
  for (const m of comando.matchAll(/>>?\s*(?!&)("[^"]*"|'[^']*'|[^\s;&|<>()]+)/g)) {
    destinos.push(desentrecomillar(m[1]));
  }

  // Y los comandos, por segmento: en `cat board.ts | tee src/board.ts` el destino es
  // del segundo, y mirar el comando entero de una lo atribuiria al primero.
  for (const segmento of comando.split(/[;\n]|\|\|?|&&/)) {
    const tokens = (segmento.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(desentrecomillar);
    // `/usr/bin/sed` es `sed`: comparar el token entero dejaria pasar la ruta absoluta.
    const escritor = ESCRITORES.get(tokens[0]?.split(/[/\\]/).pop() ?? '');
    if (escritor === undefined) continue;
    const resto = tokens.slice(1);
    const esFlag = (t) => t.startsWith('-');
    destinos.push(...escritor(resto.filter((t) => !esFlag(t)), resto.filter(esFlag)));
  }

  return destinos;
}

/**
 * Las rutas que el payload va a escribir, o `null` si no se pudo leer ninguna.
 *
 * `null` NO es «ninguna»: es «no se pudo decidir», y el llamador lo DECLARA. Un `Bash`
 * que de verdad no escribe nada devuelve `[]`, que si es una respuesta y pasa callado.
 */
function rutasDelPayload(crudo) {
  try {
    const { tool_name: herramienta, tool_input: entrada } = JSON.parse(crudo);
    if (herramienta === 'Bash') {
      const comando = entrada?.command;
      return typeof comando === 'string' ? destinosDeBash(comando) : null;
    }
    const ruta = entrada?.file_path;
    return typeof ruta === 'string' && ruta.length > 0 ? [ruta] : null;
  } catch {
    return null;
  }
}

const crudo = readFileSync(0, 'utf8');
const rutas = rutasDelPayload(crudo);

// Sin ruta legible no hay nada que decidir. Pasa, pero lo DICE: un payload que cambio de
// forma dejaria el gate mudo para siempre, y esta linea es la que lo delata.
if (rutas === null) {
  pasar('gate-de-spec: el payload no trae `file_path` ni `command`, no se pudo verificar la rama');
}

// La primera protegida es la que nombra el mensaje. Alcanza con una: el comando se
// bloquea entero, y listar las cinco de un `rm -rf` no cambia lo que hay que hacer.
const ruta = rutas.find((candidata) => estaProtegida(path, RAIZ, PROTEGIDAS, candidata));
if (ruta === undefined) pasar();

let rama;
try {
  rama = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'],
    { cwd: RAIZ, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
} catch {
  pasar('gate-de-spec: no se pudo leer la rama con git, no se verifico');
}

const COMO_SALIR =
  'Si el spec no existe, la salida es el skill `spec-create`: medir, escribir los cuatro archivos en ' +
  '`specs/<NNN>-<kebab>/`, publicarlos con `node .claude/scripts/publicar-spec.mjs crear` y ' +
  '`publicar`, y commitear SOLO `specs/mapa.json` a `main`. Si el spec YA esta publicado, lo que ' +
  'falta es la rama, que la abre el implementador: `git checkout -b feature/<NNN>-<kebab>` con el ' +
  '`NNN` que el mapa ya tiene. Si el cambio de verdad no necesita spec —un typo, ' +
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
  mapa = JSON.parse(readFileSync(path.resolve(RAIZ, 'specs/mapa.json'), 'utf8'));
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

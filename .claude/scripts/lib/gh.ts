/**
 * Lanzar `gh` diciendo qué falta cuando falta, en vez de tirar un `ENOENT` crudo.
 *
 * Los dos scripts que hablan con GitHub —`hidratar-specs.mjs` y `publicar-spec.mjs`—
 * invocaban `execFileSync('gh', …)` pelado. Sin `gh` en el PATH eso muere con el
 * `ENOENT` de node y su stack, que **no nombra ni a `gh` ni al PATH** y no dice qué
 * hacer.
 *
 * ## Por qué duele más de lo que parece
 *
 * Desde el spec 034 `specs/[0-9]…` está en el `.gitignore` y un worktree nuevo llega
 * con tres archivos de `specs/` en vez de 136. Hidratar es el único camino a los
 * criterios de aceptación, y `pr-review-batch/SKILL.md` lo declara textual: sin eso el
 * paso «lee un directorio vacío, no encuentra los AC y revisa sin criterios de
 * aceptación — que es la peor forma de este bug, porque el review igual termina y
 * reporta».
 *
 * Pasó de verdad: en la corrida sobre los PR #121 · #118 los dos agentes lo pisaron,
 * cada uno en su worktree, y salieron adelante por caminos distintos —uno reexportando
 * el PATH a mano, el otro cayendo al MCP de GitHub—. Los dos lo declararon, así que el
 * review no salió sin AC. Pero eso fue criterio del agente, no del script.
 *
 * ## Las dos mitades, y por qué son dos
 *
 * 1. **Buscar `gh` donde suele estar.** En Windows el instalador lo deja en
 *    `C:\Program Files\GitHub CLI\` y **no agrega la carpeta al PATH**, que es la
 *    configuración exacta de la máquina donde esto se midió. Encontrarlo ahí convierte
 *    un fallo duro en un aviso.
 * 2. **Y si tampoco está, morir diciendo cómo salir.** Un error que no dice qué hacer
 *    produce el reflejo de buscar cómo esquivarlo, que es el mismo argumento por el que
 *    el mensaje del gate del 037 explica su propia salida.
 *
 * ## Por qué el entorno se inyecta
 *
 * Por lo mismo que en `lib/rutas-protegidas.mjs`: el modo de falla que importa es «no
 * hay `gh` en esta máquina», y una máquina que sí lo tiene no puede fabricarlo. Con
 * `ejecutar`, `existe` y `plataforma` por parámetro, los tres caminos —lo encuentra en
 * el PATH, lo rescata de una ubicación conocida, no lo encuentra— se prueban en las
 * tres plataformas y sin tocar el PATH del que corre los tests.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Dónde deja `gh.exe` el instalador de Windows, en orden de preferencia.
 *
 * Son las dos rutas del instalador oficial —64 y 32 bits—. Deliberadamente **no** se
 * busca por todo el disco: esto es un rescate para la instalación estándar, no un
 * localizador. Si alguien lo instaló en otro lado, el mensaje le dice que lo agregue al
 * PATH, que es la solución que además arregla todas las otras herramientas.
 */
export const UBICACIONES_WINDOWS: readonly string[] = [
  'C:\\Program Files\\GitHub CLI\\gh.exe',
  'C:\\Program Files (x86)\\GitHub CLI\\gh.exe',
];

/** Lo que el lanzador necesita del mundo. Ver «Por qué el entorno se inyecta». */
export interface EntornoGh {
  /** `execFileSync`, o algo con su forma. Devuelve la salida estándar. */
  ejecutar: (bin: string, args: readonly string[], opciones: object) => string;
  /** `existsSync`, o algo con su forma. */
  existe: (ruta: string) => boolean;
  /** `process.platform`. */
  plataforma: string;
  /** Adónde va un aviso que no corta la corrida. */
  avisar: (mensaje: string) => void;
  /** Cómo se muere. Corta: no vuelve nunca. */
  morir: (mensaje: string) => never;
}

/**
 * El mensaje de «no hay `gh`», que es lo único que se lleva el que lo lea.
 *
 * Dice las tres cosas que el `ENOENT` no decía: **qué** falta, **dónde suele estar** y
 * **cómo seguir**. La ubicación sólo se nombra en Windows porque en POSIX el gestor de
 * paquetes ya lo pone en el PATH y la línea sería ruido.
 */
export function mensajeSinGh(plataforma: string): string {
  const donde = plataforma === 'win32'
    ? `\nEn Windows el instalador lo deja en una de estas y NO la agrega al PATH:\n`
      + UBICACIONES_WINDOWS.map((u) => `  ${u}`).join('\n')
      + '\nSi está ahí, agregá esa carpeta al PATH de usuario y abrí una terminal nueva.\n'
    : '\n';

  return 'No se encontró `gh`, el CLI de GitHub, y sin él este script no puede leer los '
    + `issues.\n${donde}`
    + '\nSi no está instalado: https://cli.github.com — y después `gh auth login`.';
}

/**
 * El mensaje de «`gh` está pero no hay sesión».
 *
 * Es el otro fallo que se confunde con «el script está roto»: `gh` existe, arranca, y
 * contesta que no hay credenciales. Sin esta rama el que lo lea ve un exit distinto de
 * cero y la salida de `gh` mezclada con el stack.
 */
export function mensajeSinSesion(salidaDeGh: string): string {
  return '`gh` está instalado pero la sesión de GitHub no sirve para esta consulta.\n'
    + `Lo que contestó:\n${salidaDeGh.trim()}\n\n`
    + 'La salida es `gh auth login` (o `gh auth status` para ver qué cuenta está activa).';
}

/** Si lo que tiró `execFileSync` es «no existe el ejecutable». */
const esEjecutableAusente = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT';

/** Lo que `gh` escribió en `stderr`, si escribió algo. */
const stderrDe = (error: unknown): string => {
  const crudo = (error as { stderr?: unknown })?.stderr;
  return typeof crudo === 'string' ? crudo : '';
};

/**
 * Un lanzador de `gh` que explica sus fallos.
 *
 * El ejecutable se resuelve **perezosamente y una sola vez**: la primera llamada usa
 * `gh` a secas para que el PATH gane cuando lo hay, y sólo si eso da `ENOENT` se busca
 * en las ubicaciones conocidas. Resolverlo por adelantado invertiría esa preferencia y
 * podría elegir una instalación vieja del disco por sobre la que el PATH declara.
 */
export function crearGh(entorno: EntornoGh): (args: readonly string[], opciones?: object) => string {
  let bin = 'gh';
  let rescatado = false;

  return (args, opciones = {}) => {
    try {
      return entorno.ejecutar(bin, args, opciones);
    } catch (error) {
      if (!esEjecutableAusente(error)) {
        // `gh` corrió y falló. La sesión es el motivo que se puede nombrar; cualquier
        // otro se deja subir tal cual, porque inventarle una explicación a un fallo que
        // no se reconoce es peor que mostrar el original.
        const stderr = stderrDe(error);
        if (/auth login|not logged|authentication/i.test(stderr)) entorno.morir(mensajeSinSesion(stderr));
        throw error;
      }

      // Ya se rescató una vez y volvió a faltar: la ubicación conocida tampoco sirve.
      if (rescatado) entorno.morir(mensajeSinGh(entorno.plataforma));

      const candidato = entorno.plataforma === 'win32'
        ? UBICACIONES_WINDOWS.find(entorno.existe)
        : undefined;
      if (candidato === undefined) entorno.morir(mensajeSinGh(entorno.plataforma));

      entorno.avisar(
        `aviso: \`gh\` no está en el PATH; se usa ${candidato}.\n`
        + '       Agregá esa carpeta al PATH para que el resto de las herramientas también lo vea.',
      );
      bin = candidato;
      rescatado = true;

      // El reintento va protegido, y eso lo encontró su test: sin el `catch`, el archivo
      // que existe pero no se puede ejecutar —un `gh.exe` de otra arquitectura, un enlace
      // roto— vuelve a dar `ENOENT` y se escapa crudo, que es exactamente el error que
      // este módulo existe para no dejar salir. El guardia de `rescatado` no alcanza:
      // recién corre en la llamada SIGUIENTE, y acá no hay ninguna.
      try {
        return entorno.ejecutar(bin, args, opciones);
      } catch (segundo) {
        if (esEjecutableAusente(segundo)) entorno.morir(mensajeSinGh(entorno.plataforma));
        throw segundo;
      }
    }
  };
}

/**
 * El lanzador con el entorno del proceso, que es el que usan los dos scripts.
 *
 * Vive acá y no en cada script por el mismo motivo por el que existe el módulo: el
 * cableado —qué es `ejecutar`, adónde va un aviso, cómo se muere— es idéntico en los
 * dos, y escribirlo dos veces es la forma de que uno de los dos quede sin el rescate el
 * día que alguien toque el otro.
 *
 * El estado del rescate —qué ejecutable terminó usándose— es de este módulo y por lo
 * tanto del proceso, que es lo correcto: encontrado una vez, el resto de las llamadas
 * del script ya no vuelven a buscar.
 */
export const gh = crearGh({
  ejecutar: (bin, args, opciones) => execFileSync(bin, args, opciones) as unknown as string,
  existe: existsSync,
  plataforma: process.platform,
  // A `stderr` y no a `stdout`: la salida de estos scripts es un reporte que se lee de
  // corrido, y un aviso en el medio lo ensucia sin que nadie lo distinga de una línea de
  // progreso.
  avisar: (mensaje) => { console.error(mensaje); },
  morir: (mensaje) => { console.error(`\n${mensaje}\n`); process.exit(1); },
});

import { z } from 'zod';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineTool, json } from './types.ts';
import { buscarSpec, marcarTarea, readSpecStatus, type Escritura } from '../specs.ts';
import { SPECS_DIR } from './specsDir.ts';

/**
 * La unica tool que escribe, y desde el 042 la unica cosa que se escribe en un
 * `tasks.md`: marcar una tarea.
 *
 * Existe porque `tasks.md` no es un archivo que se lee sino una **interfaz**, y
 * hasta el spec 033 cinco skills la implementaban a mano abriendo el archivo.
 * Dos de ellas corren cada agente en su propio worktree, y `git worktree add`
 * hace checkout de lo *trackeado*: el dia que `specs/` entre al `.gitignore`, un
 * agente que abre el archivo no lo encuentra, **no falla, y sigue**.
 *
 * Por que una sola operacion. Eran dos —la otra agregaba una tarea al
 * `## Seguimiento`— y el 042 saco esa seccion del formato: la deuda que aparece
 * implementando se abre como issue, porque anotada adentro del spec que la pario
 * hereda su estado y nadie la mira.
 *
 * Y sacar la operacion es parte del cambio, no una consecuencia: mientras anotar
 * tuviera una tool y abrir un issue no, el camino barato seguia llevando al lugar
 * equivocado. Una tool que ademas edite texto arbitrario tampoco: eso vuelve a poner
 * el formato en manos de quien llama, que es lo que esta indireccion viene a sacar.
 *
 * El I/O vive aca y no en `specs.ts` a proposito: alli `readSpecStatus` sigue
 * siendo el unico punto que toca el disco, y las dos funciones que hacen el
 * trabajo —hoy `marcarTarea`— son puras, asi que se testean contra strings fijos
 * igual que los parsers.
 */
const inputSchema = z.object({
  // Un enum de UN SOLO valor, y es deliberado: asi una llamada vieja con
  // `op: "seguimiento"` falla con error de schema en vez de ser ignorada. Un string
  // suelto, o sacar el campo, la dejarian pasar en silencio — que es el modo de
  // falla que este spec entero persigue.
  op: z.enum(['marcar'])
    .describe('`marcar`: una tarea pasa de "- [ ]" a "- [x]". Es la única operación desde el spec 042.'),
  spec: z.string()
    .describe('El spec: su número ("33" o "033") o el nombre de su carpeta.'),
  tarea: z.string()
    .describe('El ID de la tarea que se marca, "T012".'),
});

/**
 * El fallo viaja como `isError` y no como un campo mas del JSON.
 *
 * Es una ESCRITURA: si "la tarea ya estaba marcada" llega como texto adentro de
 * una respuesta exitosa, quien llama sigue de largo creyendo que escribio. Ese es
 * el modo de falla que este repo ya se comio dos veces con `verify` y el que la
 * tool entera viene a cerrar.
 */
const falla = (motivo: string) => ({ content: [{ type: 'text' as const, text: motivo }], isError: true });

/**
 * Toma su `specs/` por el mismo motivo que `spec_status`: un test que ejercite
 * una ESCRITURA no puede correr contra el registro de verdad, y las ramas que
 * fallan —el spec sin `tasks.md`, la tarea ya marcada— tienen que ser
 * alcanzables sin saltear la cobertura de esa rama.
 */
export const crearSpecWrite = (specsDir: string) => defineTool({
  name: 'spec_write',
  description:
    'Escribe en el tasks.md de un spec, y hace una sola cosa: "marcar" pasa una tarea de ' +
    '"- [ ]" a "- [x]". Usar EN LUGAR de abrir specs/NNN-*/tasks.md y editarlo a mano.\n' +
    'Dos cosas que garantiza y que editar a mano no: (1) FALLA si la tarea no existe o si ya ' +
    'estaba marcada, en vez de dejar creer que escribió; (2) la escritura cae en el registro ' +
    'central aunque quien llama esté corriendo en un worktree — la marca queda en specs/ y por ' +
    'lo tanto NO viaja en el diff del PR.\n' +
    'Un hallazgo que aparece implementando NO se anota acá: desde el spec 042 se abre como issue ' +
    'de GitHub, con título que se entienda fuera del spec, la evidencia en el cuerpo y ' +
    '"Detectado en #N". Anotado adentro del spec que lo parió heredaba su estado y nadie lo ' +
    'miraba.\n' +
    'Devuelve el ID y la línea de lo que escribió. Para LEER el estado de un spec está spec_status.',
  inputSchema,
  run: ({ op, spec, tarea }) => {
    // La carpeta sale de `readSpecStatus` y no de un `readdir` propio: es el
    // unico punto de I/O de `specs.ts` y ya sabe casar "33" con su carpeta.
    const { specs } = readSpecStatus(specsDir);
    const encontrado = buscarSpec(specs, spec);
    if (encontrado === null) return falla(`Ningún spec de specs/ coincide con "${spec}". Va el número ("33") o el nombre de la carpeta.`);
    // «No está hidratado» y «no tiene tasks.md» son dos cosas distintas y decir la
    // segunda por la primera manda a escribir de nuevo un archivo que existe — en el
    // issue. Desde el 035 `readSpecStatus` devuelve TODOS los specs del mapa, así que
    // este caso es el normal en un worktree recién creado, no una rareza.
    if (encontrado.enDisco === null) {
      return falla(`El spec ${encontrado.dir} no está hidratado en este árbol: vive en el issue #${encontrado.issue}. ` +
        `Traerlo con \`node .claude/scripts/hidratar-specs.mjs ${encontrado.id}\` y volver a intentar.`);
    }
    if (encontrado.tareas === null) return falla(`El spec ${encontrado.dir} no tiene tasks.md.`);

    // La ruta se arma con `enDisco` y NO con `dir`: son distintos en toda cache
    // hidratada antes de que `carpeta` existiera —7 de 35—, y ahí `dir` apunta a una
    // carpeta que no existe. El `readFileSync` de abajo no tiene `try/catch` ni arriba
    // ni en `defineTool`, así que eso salía como un ENOENT crudo en vez de un `falla`.
    const ruta = join(specsDir, encontrado.enDisco, 'tasks.md');
    const md = readFileSync(ruta, 'utf8');

    // `tarea` dejo de ser opcional al quedar una sola operacion, asi que el schema ya
    // rechaza la llamada sin ella: no hace falta una guarda que ninguna llamada valida
    // podria alcanzar, y que habria que cubrir para no saltear una rama.
    const resultado: Escritura = marcarTarea(md, tarea);

    if (!resultado.ok) return falla(`${encontrado.dir}: ${resultado.motivo}`);

    writeFileSync(ruta, resultado.md, 'utf8');
    return json({
      op,
      spec: encontrado.dir,
      tarea: resultado.tarea,
      linea: resultado.linea,
      texto: resultado.texto,
      // La ruta, para que quede dicho DONDE cayo: el que llama puede estar en un
      // worktree y esperar el cambio ahi. Y por eso es `enDisco` y no `dir` —
      // es la carpeta que se escribio, no el nombre que el mapa le da.
      archivo: `specs/${encontrado.enDisco}/tasks.md`,
    });
  },
});

export const specWrite = crearSpecWrite(SPECS_DIR);

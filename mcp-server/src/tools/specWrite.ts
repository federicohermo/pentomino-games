import { z } from 'zod';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineTool, json } from './types.ts';
import { agregarSeguimiento, buscarSpec, marcarTarea, readSpecStatus, type Escritura } from '../specs.ts';
import { SPECS_DIR } from './specsDir.ts';

/**
 * La unica tool que escribe, y las dos unicas cosas que se escriben en un
 * `tasks.md`: marcar una tarea y anotar seguimiento.
 *
 * Existe porque `tasks.md` no es un archivo que se lee sino una **interfaz**, y
 * hasta el spec 033 cinco skills la implementaban a mano abriendo el archivo.
 * Dos de ellas corren cada agente en su propio worktree, y `git worktree add`
 * hace checkout de lo *trackeado*: el dia que `specs/` entre al `.gitignore`, un
 * agente que abre el archivo no lo encuentra, **no falla, y sigue**.
 *
 * Por que dos operaciones y ninguna mas: son las dos que las skills hacen hoy. Una
 * tool que ademas edite texto arbitrario vuelve a poner el formato en manos de
 * quien llama, que es justo lo que esta indireccion viene a sacar.
 *
 * El I/O vive aca y no en `specs.ts` a proposito: alli `readSpecStatus` sigue
 * siendo el unico punto que toca el disco, y las dos funciones que hacen el
 * trabajo —`marcarTarea` y `agregarSeguimiento`— son puras, asi que se testean
 * contra strings fijos igual que los parsers.
 */
const inputSchema = z.object({
  op: z.enum(['marcar', 'seguimiento'])
    .describe('`marcar`: una tarea pasa de "- [ ]" a "- [x]". `seguimiento`: agrega una tarea nueva al "## Seguimiento (no bloquea)" del spec.'),
  spec: z.string()
    .describe('El spec: su número ("33" o "033") o el nombre de su carpeta.'),
  tarea: z.string().optional()
    .describe('Sólo con `marcar`: el ID de la tarea, "T012".'),
  texto: z.string().optional()
    .describe('Sólo con `seguimiento`: el texto de la tarea nueva. El ID lo pone la tool. Decir QUÉ se encontró y con qué evidencia, que es lo que el spec necesita para decidirlo después.'),
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
  title: 'Escribir en un spec',
  // La ÚNICA tool del server que escribe. Es el hecho que `CLAUDE.md` declara en
  // prosa —«spec_write … es la única que escribe»— y que acá deja de ser prosa:
  // varios clientes usan `readOnlyHint` para NO pedir permiso, así que hasta hoy
  // las cinco que sólo leen pagaban la misma fricción que ésta.
  // `destructiveHint: false` porque agrega y marca, no borra ni sobrescribe.
  //
  // NO lleva `idempotentHint`, y omitir es preferible a afirmar algo falso:
  // `marcar` FALLA si la tarea ya estaba marcada, así que llamarla dos veces no es
  // «sin efecto adicional» sino un error, y eso no es idempotencia. Es la misma
  // política con la que `spec_status` omite las `citas` en vez de mandarlas vacías.
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  description:
    'Escribe en el tasks.md de un spec, y sólo las dos cosas que se escriben: "marcar" pasa una ' +
    'tarea de "- [ ]" a "- [x]", y "seguimiento" agrega una tarea nueva al "## Seguimiento (no ' +
    'bloquea)". Usar EN LUGAR de abrir specs/NNN-*/tasks.md y editarlo a mano.\n' +
    'Tres cosas que hace y que editar a mano no garantiza: (1) el ID de "seguimiento" sigue ' +
    'contando desde el mayor del archivo y NUNCA reusa uno libre, porque un ID reusado rompe la ' +
    'referencia que otra tarea le hacía; (2) "marcar" FALLA si la tarea no existe o si ya estaba ' +
    'marcada, en vez de dejar creer que escribió; (3) la escritura cae en el registro central ' +
    'aunque quien llama esté corriendo en un worktree — el hallazgo queda anotado en specs/ y ' +
    'por lo tanto NO viaja en el diff del PR.\n' +
    'Devuelve el ID y la línea de lo que escribió. Para LEER el estado de un spec está spec_status.',
  inputSchema,
  run: ({ op, spec, tarea, texto }) => {
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

    let resultado: Escritura;
    if (op === 'marcar') {
      if (tarea === undefined) return falla('`marcar` necesita `tarea`: el ID de la que se marca, "T012".');
      resultado = marcarTarea(md, tarea);
    } else {
      if (texto === undefined) return falla('`seguimiento` necesita `texto`: qué se encontró. El ID lo pone la tool.');
      resultado = agregarSeguimiento(md, texto);
    }

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

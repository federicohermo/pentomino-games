import { z } from 'zod';
import { defineTool, json } from './types.ts';
import { buscarSpec, readSpecStatus, type SpecStatus } from '../specs.ts';
import { SPECS_DIR } from './specsDir.ts';

/**
 * Las `citas` se piden, no vienen puestas.
 *
 * Medido sobre los 33 specs de hoy: la respuesta entera pesa **29.742 bytes** y
 * las citas suman **84.097** —o sea que ponerlas la lleva a **3,8x**— para una
 * lectura que siempre se hace sobre UN spec. Acotada, la respuesta mediana son
 * 3.135 bytes y el peor spec del repo —el 021— **7.962**.
 *
 * Se OMITE el campo en vez de mandarlo vacio: un `citas: []` se lee como "esta
 * tarea no nombra ningun archivo", que es falso, y una respuesta que miente
 * barato es peor que una que cuesta cara.
 */
function sinCitas(s: SpecStatus): SpecStatus {
  if (s.tareas === null) return s;
  const tareas = { ...s.tareas };
  // `delete` y no una desestructuracion con descarte: el descarte deja una
  // variable sin usar, y en este repo no hay `eslint-disable` que la tape.
  delete tareas.citas;
  return { ...s, tareas };
}

/**
 * Los bytes que de verdad viajan: `JSON.stringify` compacto, el mismo que arma el
 * helper `json`. Medir una version indentada seria medir una respuesta que nadie
 * manda.
 */
const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), 'utf8');

/** Miles con punto, como el resto de la prosa del repo. */
const miles = (n: number): string => n.toLocaleString('es-AR');

const inputSchema = z.object({
  spec: z.string().optional()
    .describe('Un spec: su número ("33" o "033") o el nombre de su carpeta. Acota la respuesta a ese spec y le agrega `citas`. Sin él vienen todos los specs, sin `citas`.'),
});

/**
 * La tool toma su `specs/` en vez de cerrarse sobre el de este checkout.
 *
 * No es abstraccion por gusto: sin esto, la rama de un spec **sin** `tasks.md` no
 * se puede alcanzar desde un test —los 33 del repo lo tienen— y el umbral de 100
 * en ramas se pagaria con el comentario magico que saltea la rama, que este repo
 * no acepta y que desde el 032 rechaza `no-warning-comments`. Es el mismo motivo
 * por el que `specs.test.ts` fabrica sus directorios en vez de leer los de verdad.
 */
export const crearSpecStatus = (specsDir: string) => defineTool({
  name: 'spec_status',
  title: 'Estado de los specs',
  // Mismo caso que `find_symbol`: lee `specs/` del disco y no lo modifica.
  annotations: { readOnlyHint: true, openWorldHint: false },
  description:
    'Estado del trabajo planificado: por spec, su estado en specs/mapa.json, su issue, cuántas tareas ' +
    'están marcadas sobre el total y cuál es la próxima que de verdad falta. Usar en lugar de leer el ' +
    'mapa y los tasks.md, que son decenas de KB y crecen con cada spec. ' +
    'Un spec puede venir sin "tareas": su carpeta es una caché de lo que vive en el issue y este ' +
    'checkout puede no haberla hidratado. La nota lo dice y "totales.sinHidratar" los cuenta. Una casilla abierta no siempre ' +
    'es deuda, así que se descuentan tres clases y queda "pendientes", que vale 0 exactamente ' +
    'cuando no hay "proxima": las que están bajo un encabezado "Seguimiento" (deuda anotada a ' +
    'propósito), las marcadas "[M]" (piden una persona: navegador, oído, captura) y todas las de un ' +
    'spec Descartado o Superado (de ahí no sale trabajo, y la nota lo dice). Por eso un spec puede ' +
    'estar Implementado con seis casillas abiertas y no deberle nada a nadie.\n' +
    'Cada spec trae además "cruces": los pares `X → Y` de sus tareas, o sea los números que una ' +
    'tarea mueve de un valor a otro. Es la dependencia entre specs que ningún import delata — dos ' +
    'specs que mueven la misma constante parecen un conflicto de merge y son una cadena. Se leen ' +
    'cruzando los "a" de un spec contra los "de" del resto.\n' +
    'Con "spec" la respuesta es la de ESE spec y suma "citas": por tarea, los archivos que nombra ' +
    'entre backticks, con su línea cuando la trae. Son la materia prima del reparto en carriles y ' +
    'se devuelven como DATO, no como verdad: un tasks.md nombra un archivo también cuando la tarea ' +
    'es actualizar un doc que lo enumera, así que filtrar por el verbo sigue siendo de quien lee.\n' +
    'Para MARCAR una tarea o anotar seguimiento está spec_write: esta tool no escribe.',
  inputSchema,
  run: ({ spec }) => {
    const { specs, totales } = readSpecStatus(specsDir);

    if (spec === undefined) {
      // La nota se MIDE sobre esta consulta en vez de citar dos constantes.
      // Escritas se movieron —y en direcciones contrarias, por eso el factor
      // seguia sonando plausible— y nadie lo noto en seis specs: es el problema
      // que este server dice no tener, un artefacto que alguien tiene que
      // acordarse de regenerar (spec 041).
      const acotada = { specs: specs.map(sinCitas), totales };
      // Los dos objetos ya se arman: la diferencia es una resta, no un recorrido.
      const pesan = bytes({ specs, totales }) - bytes(acotada);
      const respuesta = bytes(acotada);
      // El factor tambien se calcula: es el numero que mas se cita y el que peor
      // envejece, porque un porcentaje viejo sigue pareciendo razonable.
      const factor = ((respuesta + pesan) / respuesta).toFixed(2).replace('.', ',');
      return json({
        ...acotada,
        // `respuesta` no cuenta esta nota —unos 200 bytes— porque contarla seria
        // circular: el largo del texto depende de los numeros que trae adentro.
        nota: `Sin \`spec\` las \`citas\` no viajan: son ${miles(pesan)} bytes contra los ${miles(respuesta)} de esta respuesta, o sea ${factor}x. Medido sobre ESTA consulta. Pedir un spec para tenerlas.`,
      });
    }

    const uno = buscarSpec(specs, spec);
    // Un miss se dice. Devolver la lista vacia deja al que pregunta sin saber si
    // el spec no existe o si la tool fallo — el mismo criterio que `find_symbol`.
    return uno === null
      ? json({ specs: [], totales, nota: `Ningún spec de specs/ coincide con "${spec}". Va el número ("33") o el nombre de la carpeta.` })
      : json({ specs: [uno], totales });
  },
});

export const specStatus = crearSpecStatus(SPECS_DIR);

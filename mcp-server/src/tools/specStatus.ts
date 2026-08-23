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
  description:
    'Estado del trabajo planificado: por spec, su estado en specs/log.md, cuántas tareas están ' +
    'marcadas sobre el total y cuál es la próxima que de verdad falta. Usar en lugar de leer log.md ' +
    'y los tasks.md, que son decenas de KB y crecen con cada spec. Una casilla abierta no siempre ' +
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
      return json({
        specs: specs.map(sinCitas),
        totales,
        nota: 'Sin `spec` las `citas` no viajan: son 84.097 bytes contra los 29.742 de esta respuesta. Pedir un spec para tenerlas.',
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

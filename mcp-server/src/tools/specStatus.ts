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
    'Estado del trabajo planificado: por spec, su estado en specs/mapa.json, su issue, cuántas tareas ' +
    'están marcadas sobre el total y cuál es la próxima que de verdad falta. Usar en lugar de leer el ' +
    'mapa y los tasks.md, que son decenas de KB y crecen con cada spec. ' +
    'Un spec puede venir sin "tareas": su carpeta es una caché de lo que vive en el issue y este ' +
    'checkout puede no haberla hidratado. La nota lo dice y "totales.sinHidratar" los cuenta. Una casilla abierta no siempre ' +
    'es deuda, así que se descuentan dos clases y queda "pendientes", que vale 0 exactamente ' +
    'cuando no hay "proxima": las marcadas "[M]" (un marcador HISTÓRICO: el spec 039 lo derogó, ' +
    'así que un spec nuevo no lo escribe y ahí "manual" vale 0; las 137 que quedaron en los 35 ' +
    'specs de antes se siguen descontando porque un spec mergeado no se reescribe) y todas las ' +
    'de un spec Descartado o Superado (de ahí no sale trabajo, y la nota lo dice). Por eso un ' +
    'spec puede estar Implementado con casillas abiertas y no deberle nada a nadie.\n' +
    'Lo que hay bajo un encabezado "Seguimiento" no se descuenta: desde el spec 042 NO SE CUENTA. ' +
    'El parser corta al entrar a esa sección, así que esas tareas tampoco entran a "total" ni ' +
    'aportan citas ni cruces. La sección salió del formato —la deuda que aparece implementando se ' +
    'abre como issue— y las 40 que ya están escritas son historia que no se reescribe.\n' +
    'Cada spec trae además "cruces": los pares `X → Y` de sus tareas, o sea los números que una ' +
    'tarea mueve de un valor a otro. Es la dependencia entre specs que ningún import delata — dos ' +
    'specs que mueven la misma constante parecen un conflicto de merge y son una cadena. Se leen ' +
    'cruzando los "a" de un spec contra los "de" del resto.\n' +
    'Con "spec" la respuesta es la de ESE spec y suma "citas": por tarea, los archivos que nombra ' +
    'entre backticks, con su línea cuando la trae. Son la materia prima del reparto en carriles y ' +
    'se devuelven como DATO, no como verdad: un tasks.md nombra un archivo también cuando la tarea ' +
    'es actualizar un doc que lo enumera, así que filtrar por el verbo sigue siendo de quien lee.\n' +
    'Para MARCAR una tarea está spec_write, que es lo único que escribe: esta tool no escribe.',
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

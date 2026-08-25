/**
 * Lo que decide `derivar-mapa.mjs`, separado de con quien habla (spec 043).
 *
 * `lib/specs.ts` tiene la derivacion **pura** —`derivarMapa`, `escribirMapa`— y declara
 * en su encabezado que no toca el disco ni la red. Lo que falta para que eso sea una
 * herramienta es el otro tramo: pedirle las listas a `gh`, decidir si la respuesta sirve,
 * escribir o no escribir, y con que codigo salir. Ese tramo tiene reglas propias y **son
 * las que hay que poder probar**, asi que el entorno se inyecta — igual que en `lib/gh.ts`
 * y en `lib/rutas-protegidas.mjs`, y por el mismo motivo: el modo de falla que importa
 * —una lista truncada, un mapa que ya esta bien— no se puede fabricar contra el repo real.
 *
 * ## Las cuatro salidas, y por que la tercera no escribe
 *
 * | Situacion | Que hace | Exit |
 * |---|---|---|
 * | no hay correcciones | no toca el archivo, lo dice | 0 |
 * | hay correcciones | reescribe e imprime cada una | 0 |
 * | la lista de `gh` llego al limite | **no toca el archivo**, dice por que | 1 |
 * | `--verificar` y hay correcciones | no toca el archivo, las imprime | 1 |
 *
 * La guarda de truncado es la misma que el gate del 038 ya tenia, y el argumento tambien:
 * en una lista que llego al limite, «este spec no tiene PR» y «su PR no entro en la
 * pagina» **no se distinguen**, y son respuestas opuestas. Derivar sobre eso pondria en
 * `Propuesto` a todo spec cuyo PR quedo afuera — o sea que el derivador, que existe para
 * arreglar el registro, seria el unico capaz de romperlo entero de una vez. Ante la duda
 * no escribe.
 */
import {
  leerMapa, derivarMapa, escribirMapa, agruparPrsPorSpec,
  type IssueDeSpec, type PrDeSpec,
} from './specs.ts';

/**
 * Lo que el derivador necesita del mundo.
 *
 * Las dos consultas son funciones y no datos para que no se hagan cuando no hacen falta,
 * y sobre todo para que un test declare exactamente que contesto cada una.
 */
export interface EntornoDerivacion {
  /** Los issues del repo, ya parseados. */
  issues: () => IssueDeSpec[];
  /** Los PR del repo, ya parseados. */
  prs: () => PrDeSpec[];
  /** El texto crudo de `specs/mapa.json`. */
  leerTexto: () => string;
  /** Escribir el mapa nuevo. No se llama si no hay nada que cambiar. */
  guardar: (texto: string) => void;
  /** Una linea del reporte. */
  informar: (linea: string) => void;
  /**
   * El techo que se le pidio a `gh`. Una lista que lo **alcanza** esta truncada: `gh`
   * pagina hasta el limite y no avisa que corto.
   */
  limite: number;
  /** `--verificar`: no escribe nunca, pero sale 1 si hubiera escrito. */
  verificar: boolean;
}

/** El codigo de salida del proceso. Ver la tabla del encabezado. */
export const derivarYGuardar = (entorno: EntornoDerivacion): number => {
  const issues = entorno.issues();
  const prs = entorno.prs();

  // Las dos listas se miran juntas y antes de derivar nada: alcanza con que una este
  // truncada para que el resultado no sea confiable, y no hay media derivacion.
  const truncadas = [
    issues.length >= entorno.limite ? `issues (${issues.length})` : null,
    prs.length >= entorno.limite ? `PR (${prs.length})` : null,
  ].filter((x) => x !== null);

  if (truncadas.length > 0) {
    entorno.informar(
      `la lista de ${truncadas.join(' y de ')} llego al limite de ${entorno.limite}, asi que esta ` +
      'truncada.\nNo se escribe nada: en una lista cortada, «este spec no tiene PR» y «su PR no ' +
      'entro\nen la pagina» no se distinguen. Subir el limite y volver a correr.',
    );
    return 1;
  }

  const mapa = leerMapa(entorno.leerTexto());
  const { mapa: derivado, correcciones } = derivarMapa(
    mapa,
    new Map(issues.map((i) => [i.number, i])),
    agruparPrsPorSpec(prs),
  );

  if (correcciones.length === 0) {
    entorno.informar(`el mapa ya dice lo que los ${prs.length} PR y los ${issues.length} issues dicen: ${Object.keys(mapa).length} specs, sin cambios.`);
    return 0;
  }

  for (const c of correcciones) entorno.informar(`${c.id}  ${c.campo}: "${c.de}" → "${c.a}"`);

  if (entorno.verificar) {
    entorno.informar(`\n${correcciones.length} correcciones sin aplicar (--verificar).`);
    return 1;
  }

  entorno.guardar(escribirMapa(derivado));
  entorno.informar(`\n${correcciones.length} correcciones escritas en specs/mapa.json.`);
  return 0;
};

/**
 * Lo puro de `publicar-spec.mjs` y `hidratar-specs.mjs` (specs 034 y 035), que son las
 * herramientas COMUNES: las que no pertenecen a ningun skill. Un skill se lleva adentro
 * los scripts que usa, asi que de aca no importa ninguno.
 *
 * **Existe para que tenga tests.** Los scripts empezaron como herramientas de un solo
 * uso y no lo son —cada spec nuevo se publica, y cada worktree se hidrata—: el commit
 * que los estreno se llama «tres bugs del publicador que lo estreno», y los tres eran
 * de parseo. Mientras esto vivio adentro de un script ejecutable no habia forma de
 * cubrirlo, porque importarlo corria el script.
 *
 * Lo verifica `.claude/scripts/__tests__/scripts-de-specs.test.ts`, que vive al lado de
 * lo que verifica — **en `scripts/`, no en `specs/`**: el test es del script, y `specs/`
 * es lo que el script manipula.
 *
 * **Es `.ts` y no `.mjs`** aunque lo importen dos `.mjs`: node lo carga igual —corre
 * TypeScript sin compilar, como `mcp-server/`, y la sintaxis de aca es la que
 * `erasableSyntaxOnly` permite—, y en cambio un `.mjs` no se puede importar desde un
 * test sin `allowJs` o un `.d.mts` escrito a mano, que es la duplicacion que este repo
 * evita en todos lados.
 *
 * El precio esta dicho: un `.mjs` que importa un `.ts` necesita **node >= 22.18** —el
 * mismo piso que `mcp-server/`—, por encima del `^20.19` de `engines`. Lo pagan las dos
 * herramientas comunes, que se corren a mano y una vez por spec. Lo que NO puede
 * pagarlo es un script de skill, que se inyecta en cada corrida: por eso los de los
 * skills no importan de aca.
 *
 * Nada de aca toca el disco ni la red: son strings a strings.
 */

/**
 * Una entrada de `specs/mapa.json`: un spec, su issue, y lo que de el se sabe sin red.
 *
 * Reemplaza a la fila de `log.md` (spec 035). La fila traia los mismos datos ahogados
 * en una descripcion larga que **nadie verificaba**, y por eso mintio sobre 12 de 31
 * filas; de aca lo unico duplicado del issue son `estado` y `titulo`, y los dos los
 * mira el gate de `specs/__tests__/mapa-de-specs.test.ts`.
 */
export interface EntradaDeMapa {
  /** El issue donde vive el spec. Es lo que hace que el mapa sea un mapa. */
  issue: number;
  /**
   * El nombre historico de la carpeta, que **no se deriva del titulo**.
   *
   * Aca vivia `slugDe`, que lo derivaba, y se borro con una medicion: reproducia 28 de
   * los 35 y fallaba en 7. El 001 se llama `001-notas-por-celda-en-orden-angular` y su
   * issue se titula «Asignar cada nota a una celda de la pieza…». Ninguna heuristica
   * los recupera, asi que el nombre se guarda en vez de calcularse.
   */
  carpeta: string;
  fecha: string;
  /** Uno de `ESTADOS`. */
  estado: string;
  /** El titulo del issue, **verbatim**, para que el gate sea una igualdad de strings. */
  titulo: string;
}

/** El registro entero: `NNN` → su entrada. */
export type Mapa = Record<string, EntradaDeMapa>;

/**
 * Los estados que un spec puede tener, y **son cuatro y no cinco desde el 038**.
 *
 * `En curso` se fue, y con una medicion: el conjunto cerrado lo aceptaba y el mapa **no
 * lo usaba en ninguna de sus 42 entradas**. No fue descuido — es que ningun paso del
 * flujo lo escribe. `publicar-spec.mjs` pone `Propuesto` al crear el issue y el merge
 * pone `Implementado`; entre esos dos no hay ningun momento en el que alguien vuelva
 * al mapa a anotar que empezo.
 *
 * Y agregar ese momento seria empeorar justo lo que el 038 arregla: este spec existe
 * porque **la transicion escrita a mano falla**, asi que un tercer punto de escritura
 * manual es un tercer lugar donde mentir. La pregunta que `En curso` prometia
 * responder —¿esto ya aterrizo?— la contesta ahora el cruce contra el PR, que no
 * depende de que nadie se acuerde.
 *
 * El orden es el del ciclo de vida y no alfabetico: es el que se lee al escribirlo.
 */
export const ESTADOS: readonly string[] = ['Propuesto', 'Implementado', 'Descartado', 'Superado'];

/**
 * Los estados de los que **no sale mas trabajo**: el spec aterrizo, se abandono o lo
 * reemplazo otro. Su issue esta cerrado.
 *
 * No es lo mismo que `ESTADOS_TERMINALES` de `mcp-server/src/specs.ts`, que son dos
 * —`Descartado` y `Superado`—: alla la pregunta es si las casillas abiertas son deuda
 * o historia, y un `Implementado` **si** puede deber seguimiento. Aca la pregunta es
 * si el spec sigue en vuelo, y un `Implementado` no.
 */
const CERRADOS: ReadonlySet<string> = new Set(['Implementado', 'Descartado', 'Superado']);

/**
 * Si el spec sigue en vuelo, o sea si de el todavia puede salir trabajo.
 *
 * Lo usan tres consumidores y por motivos distintos —`hidratar-specs.mjs` para elegir
 * que traer por default, `publicar-spec.mjs` para decidir si cierra el issue, y el
 * gate del mapa para saber que estado del issue esperar—, y esa es exactamente la
 * razon de que viva una sola vez: mientras el publicador tenia
 * su propio `estado !== 'Propuesto' && estado !== 'En curso'` escrito a mano, sacar un
 * estado del conjunto lo dejaba mirando uno que ya no existe, en verde.
 *
 * Un estado que no esta en `ESTADOS` cuenta como en vuelo: lo desconocido no cierra
 * nada. Que sea ademas ilegal lo dice el gate del mapa, que es quien tiene que gritar.
 */
export const enVuelo = (estado: string): boolean => !CERRADOS.has(estado);

/**
 * `specs/mapa.json` parseado, y **grita** ante un mapa vacio o que no es un objeto.
 *
 * El grito es el punto, y la leccion es del 034: su antecesora `filasDeLog` devolvia
 * `[]` cuando el regex dejaba de matchear, y `[]` no es un error sino un registro
 * vacio. Cuando cambio el formato de la columna, eso salio como 34 specs sin estado,
 * en verde.
 *
 * **La validacion campo por campo tambien esta aca**, y eso se corrigio: decia que la
 * delegaba al gate y a `parseMapa` del MCP server, y ninguno de los dos corre antes que
 * los scripts. Un mapa editado a mano al que le falte `issue` hacia que la fase 2 de
 * `publicar-spec.mjs` corriera `gh issue edit undefined` — su guarda `faltan` mira que
 * la CLAVE este, no la entrada. Es el mismo criterio que el resto del archivo: el que
 * lee el registro tiene que poder distinguir «roto» de «vacio», y ahora tambien de
 * «incompleto».
 */
const CAMPOS: readonly (keyof EntradaDeMapa)[] = ['issue', 'carpeta', 'fecha', 'estado', 'titulo'];

export const leerMapa = (json: string): Mapa => {
  let crudo: unknown;
  try {
    crudo = JSON.parse(json);
  } catch (e) {
    throw new Error(`specs/mapa.json no es JSON valido: ${(e as Error).message}`);
  }
  if (crudo === null || typeof crudo !== 'object' || Array.isArray(crudo)) {
    throw new Error('specs/mapa.json tiene que ser un objeto `{ "NNN": {…} }`.');
  }
  const mapa = crudo as Mapa;
  if (Object.keys(mapa).length === 0) {
    throw new Error('specs/mapa.json no tiene una sola entrada: o se trunco, o este no es el archivo.');
  }
  for (const [id, entrada] of Object.entries(mapa)) {
    if (entrada === null || typeof entrada !== 'object') {
      throw new Error(`specs/mapa.json: la entrada ${id} no es un objeto.`);
    }
    for (const campo of CAMPOS) {
      const esperado = campo === 'issue' ? 'number' : 'string';
      if (typeof entrada[campo] !== esperado) {
        throw new Error(`specs/mapa.json: la entrada ${id} no trae \`${campo}\` como ${esperado}.`);
      }
    }
  }
  return mapa;
};

/*
 * Aca vivia `idsPorEstado`, que sacaba los `NNN` de un estado para el `--propuestos` de
 * `lote.sh` y `matriz.sh`.
 *
 * Se fue porque **un skill se lleva los scripts que usa**: los dos `.sh` ahora llaman a
 * un `specs-por-estado.mjs` que vive adentro de su propio skill y no importa nada. Que
 * las dos copias sean iguales lo verifica un gate, que es la respuesta al unico riesgo
 * de duplicar; y no importar `lib/` es lo que las devuelve al piso de `engines` — un
 * `.mjs` que importa un `.ts` necesita node >= 22.18, y el repo declara `^20.19`.
 *
 * Lo que queda aca es lo que usan las herramientas COMUNES, `publicar-spec.mjs` y
 * `hidratar-specs.mjs`, que no son de ningun skill.
 */

/**
 * El estado que el registro declara para un spec, o `null` si no tiene entrada.
 *
 * Ese `null` no es un detalle: un spec recien escrito **todavia no** esta en el mapa, y
 * confundirlo con un estado terminal fue lo que cerro el issue del 035 apenas nacio.
 */
export const estadoDe = (mapa: Mapa, id: string): string | null => mapa[id]?.estado ?? null;

/** La URL de un issue. El repo se pasa: este archivo no habla con git ni con la red. */
export const urlDeIssue = (repo: string, numero: number): string =>
  `https://github.com/${repo}/issues/${numero}`;

/**
 * El alfabeto de un `.md` publicable de un spec, y **el mismo de los dos lados**.
 *
 * Lo comparten `archivoDeComentario` —que reconoce el encabezado al bajar— y el
 * `comentariosDe` de `publicar-spec.mjs` —que elige que subir—. Que sea uno solo es el
 * punto: mientras el publicador aceptaba `[a-z]+\.md`, un `reparto-de-lote.md` o un
 * `research-2.md` quedaba afuera **sin decir nada**, y como `specs/[0-9]…/` esta
 * ignorado, el archivo se perdia en la hidratacion siguiente.
 *
 * Sigue siendo estrecho a proposito —minusculas, digitos y guiones— porque es tambien
 * lo que distingue un archivo de una DISCUSION del issue: un comentario escrito a mano
 * no arranca con `## \`algo.md\``.
 */
export const NOMBRE_PUBLICABLE = /^[a-z0-9-]+\.md$/;

/** Un archivo reconstruido desde el comentario que lo llevaba. */
export interface ArchivoDeComentario {
  nombre: string;
  contenido: string;
}

/**
 * Un comentario del issue vuelve a ser su archivo. El encabezado que el publicador le
 * puso adelante —`## \`research.md\``— es lo que dice cual es, asi que se lee y se
 * saca: no forma parte del archivo original.
 *
 * Devuelve `null` cuando no lo tiene, y eso es lo que distingue un archivo de una
 * **discusion** del issue: sin esto, el primer comentario que alguien escriba a mano
 * se escribiria al disco como si fuera parte del spec. Desde el 035 eso incluye las 41
 * notas de revision, que van con un blockquote justamente para no matchear aca.
 */
export const archivoDeComentario = (cuerpo: string): ArchivoDeComentario | null => {
  // El separador se escribe entero en vez de `\s*\n\n?`, y las dos partes tienen
  // motivo. `\s*` es codicioso y se come **todas** las lineas en blanco que sigan, asi
  // que un archivo que arrancara con una linea vacia volvia del issue sin ella: el
  // round-trip byte por byte del 033 dejaba de valer, y no por un archivo del repo de
  // hoy sino por el primero que se escriba asi. Y el `\r` va explicito porque la API
  // devuelve CRLF: sin eso el corte deja un retorno de carro colgado adelante, que es
  // la misma trampa que `.claude/rules/mcp-server.md` ya tiene anotada.
  const m = /^##\s+`([a-z0-9-]+\.md)`[^\S\r\n]*\r?\n(?:\r?\n)?/.exec(cuerpo);
  if (!m) return null;
  return { nombre: m[1], contenido: cuerpo.slice(m[0].length) };
};

/**
 * Traduce las referencias a otro spec por la URL de su issue.
 *
 * **Es lo que permite no tocar un solo archivo de `specs/[0-9]…/`**: la Desviacion 2
 * dice que un spec mergeado no se reescribe, asi que la traduccion pasa a la
 * publicacion. Cubre las dos formas que existen en el repo: la relativa desde adentro
 * de `specs/` (`./005-…/spec.md`) y la que llega desde afuera (`specs/005-…/spec.md`,
 * con o sin `../` adelante). Lo que no esta en el mapa se deja como estaba.
 *
 * **El nombre del archivo se acepta con el mismo alfabeto que se publica** y no con una
 * lista de cinco. Mientras era `spec|research|plan|tasks|baseline`, un enlace a un
 * extra publicable —`./035-…/reparto.md`— se subia al issue VERBATIM, o sea una ruta
 * relativa a un directorio ignorado: un enlace muerto que ademas el gate de
 * `enlaces-resueltos` no mira, porque exime todo enlace de un spec hacia `specs/`.
 *
 * Que sea `NNN-slug/` lo que va adelante es lo que lo mantiene acotado: un `./notas.md`
 * suelto no matchea.
 */
export const traducir = (texto: string, mapa: Mapa, repo: string): string => texto.replace(
  /(?:\.{1,2}\/)*(?:specs\/)?(\d{3})-[a-z0-9-]+\/[a-z0-9-]+\.md/g,
  (original, id: string) => (mapa[id] ? urlDeIssue(repo, mapa[id].issue) : original),
);

/**
 * La carpeta de un spec entre las que ya estan, emparejando por `NNN`.
 *
 * **Por el numero y no por el nombre completo.** El mapa dice como se llama, pero una
 * cache hidratada antes de que `carpeta` existiera puede tener otro nombre —eran 7 de
 * 35—, y tratar ese nombre viejo como «el spec no esta» crearia una SEGUNDA carpeta
 * para el mismo spec. Dos carpetas con el mismo `NNN` hacen que `spec_status` cuente
 * el spec dos veces, sin que nada avise.
 */
export const carpetaExistente = (carpetas: string[], id: string): string | null =>
  carpetas.find((c) => c.startsWith(`${id}-`)) ?? null;

/* ── Derivar el mapa desde los PR (spec 043) ──────────────────────────────── */

/**
 * De que spec es una rama, `feature/043-el-mapa-…` → `043`.
 *
 * **Por la RAMA y no por `closedByPullRequestsReferences`**, y eso lo midio el gate del
 * 038 antes de elegir: la palabra clave `Closes #N` resuelve **2 de 42** —los unicos
 * dos PR escritos despues de que la convencion existiera— contra **37 de 42** por la
 * rama. Los otros 33 specs cerraron su issue a mano y GitHub no tiene el vinculo.
 *
 * El prefijo se deja abierto —`[^/]+`— a proposito: la convencion del 037 dice
 * `feature/`, pero el 038 y el 042 aterrizaron por ramas `fix/` y `chore/`, y un patron
 * que solo aceptara `feature/` los perderia sin decirlo.
 *
 * Vive aca y no en el gate porque desde el 043 lo leen los dos, y **que coincidan no
 * puede depender de que alguien copie bien**: el derivador escribe el estado y el gate
 * lo confirma, asi que dos copias que se separen dan un gate que confirma un calculo
 * que ya no es el suyo, en verde.
 */
export const RAMA_DE_SPEC = /^[^/]+\/(\d{3})-/;

/**
 * Cuantos issues y cuantos PR se le piden a `gh`, **y es uno solo para los dos lectores**.
 *
 * `gh` pagina hasta el limite y **no avisa que corto**, asi que pedir de menos convierte
 * una lista incompleta en un dato que parece completo. De ahi el numero: hoy son ~70
 * issues y ~57 PR, o sea una pagina, y pedir de mas no cuesta nada.
 *
 * Vive aca desde el 043 por lo mismo que `RAMA_DE_SPEC`: lo leen el derivador que escribe
 * el mapa y el gate que lo confirma. Con una copia en cada uno, subirlo solo en el
 * escritor deja al gate devolviendo `null` —o sea salteandose— mientras el derivador
 * escribe sin nadie que lo confirme. Se declara en el reporte, asi que no seria
 * silencioso; pero seria justo la copia que este spec argumenta que no debe existir.
 */
export const LIMITE_DE_LISTA = 1000;

/** Lo que hace falta de un PR: cual es, de que rama sale, y si sigue abierto. */
export interface PrDeSpec {
  number: number;
  headRefName: string;
  state: string;
}

/** Lo que hace falta de un issue: cual es, si esta abierto, y como se titula. */
export interface IssueDeSpec {
  number: number;
  state: string;
  title: string;
}

/**
 * Los estados que **no los mueve un merge**, y por eso quedan afuera del cruce contra
 * el PR — no del cruce contra el issue.
 *
 * Un `Superado` puede tener su PR mergeado —el 004 lo tiene, es el #3— y eso no dice
 * nada de su estado: lo supero otro spec despues. Y un `Descartado` puede no tener
 * ninguno. Los dos son decisiones humanas sobre el destino del spec, no consecuencias
 * de que el codigo haya aterrizado, asi que el derivador los deja como estan.
 *
 * No es lo mismo que `CERRADOS`, que son tres: alla la pregunta es si el spec sigue en
 * vuelo, aca es si un merge puede cambiarle el estado.
 */
export const NO_LOS_MUEVE_UN_MERGE: ReadonlySet<string> = new Set(['Descartado', 'Superado']);

/**
 * Los PR agrupados por el `NNN` de su rama. Los que no nombran un spec no entran.
 *
 * Devuelve un `Map` y no un objeto por lo mismo que `carpetaExistente` empareja por
 * numero: las claves son `NNN` de tres digitos con ceros adelante, y un objeto los
 * reordenaria como si fueran indices de array.
 */
export const agruparPrsPorSpec = (prs: readonly PrDeSpec[]): Map<string, PrDeSpec[]> => {
  const porSpec = new Map<string, PrDeSpec[]>();
  for (const pr of prs) {
    const id = RAMA_DE_SPEC.exec(pr.headRefName)?.[1];
    if (id === undefined) continue;
    porSpec.set(id, [...(porSpec.get(id) ?? []), pr]);
  }
  return porSpec;
};

/**
 * Los PR que aterrizaron **a mano**: figuran `CLOSED` y no `MERGED`, y sus commits de
 * merge estan igual en `main` (`6fffa34` y `ea4db2f`).
 *
 * Son los del 020 y el 021, y son una lista y no una regla porque no hay ninguna: la API
 * no distingue un PR mergeado fuera de GitHub de uno abandonado —los dos dicen `CLOSED`
 * con `mergedAt: null`—, asi que lo unico honesto es nombrar los dos casos medidos.
 *
 * Hoy hay cuatro PR `CLOSED` en el repo: estos dos, el #23 —una primera version del 029
 * que se abandono, y cuyo spec aterrizo igual por el #24— y el #20, de una rama que no
 * nombra ningun spec. La lista es exactamente la de los que aterrizaron.
 *
 * Si algun dia se vuelve a mergear a mano, el que grita es el gate: el mapa dira
 * `Propuesto` y el issue estara cerrado, que es un rojo con una pregunta real detras
 * —¿ese PR implemento el spec?— y se contesta agregando el numero aca.
 */
export const ATERRIZARON_A_MANO: ReadonlySet<number> = new Set([35, 36]);

/**
 * Si el trabajo de un spec llego a `main`.
 *
 * **`MERGED`, o uno de los dos que aterrizaron a mano.** Un `CLOSED` a secas NO cuenta,
 * y eso cambio en el 043 con el motivo entero: mientras esta regla la leia solo el gate,
 * un PR cerrado sin mergear costaba una investigacion. Desde el 043 la lee un
 * **escritor** que commitea a `main`, y ahi el mismo error sale carisimo: se abre y se
 * cierra sin mergear un `feature/044-x`, el push siguiente deriva el 044 a
 * `Implementado` y lo commitea, y a partir de ahi el cruce contra el issue —abierto—
 * pone en rojo **todos** los PR siguientes, incluidos los que no tocan nada de esto.
 * Arreglar el mapa a mano no sirve: el push siguiente lo vuelve a escribir.
 *
 * El error queda del lado barato: un PR abandonado deja el spec en `Propuesto`, que es
 * lo que era.
 */
export const aterrizo = (prs: readonly PrDeSpec[] | undefined): boolean =>
  (prs ?? []).some((pr) => pr.state === 'MERGED' || ATERRIZARON_A_MANO.has(pr.number));

/** Un campo del mapa que no decia lo que la fuente dice. */
export interface Correccion {
  id: string;
  campo: 'estado' | 'titulo';
  de: string;
  a: string;
}

/** El mapa derivado, y que hubo que cambiarle para llegar a el. */
export interface Derivacion {
  mapa: Mapa;
  correcciones: Correccion[];
}

/**
 * El mapa que se deduce de los PR y los issues, y la lista de lo que cambio.
 *
 * **El estado de un spec no es un dato que alguien escribe: es una consecuencia.** Su
 * PR aterrizo o no, y eso no lo escribe nadie a mano. Mientras el mapa fue una
 * afirmacion humana se desincronizo cinco veces seguidas —los specs 038 a 042— y el
 * gate que lo cazaba estuvo en verde todo el tiempo, porque no podia correr; y aunque
 * hubiera corrido, tampoco lo habria arreglado: el gate del 038 **prohibe** actualizar
 * el mapa adentro del PR que lo justifica, asi que el paso queda para un commit
 * posterior escrito a mano, que es el que se olvida.
 *
 * Lo que NO se deriva, y por que:
 *
 * - **`carpeta`**, porque no es derivable: el 035 midio que sacarla del titulo acierta
 *   28 de 35 y falla 7. El 001 se llama `001-notas-por-celda-en-orden-angular` y su
 *   issue se titula «Asignar cada nota a una celda de la pieza…».
 * - **`fecha`**, porque es cuando se escribio el spec, no cuando aterrizo.
 * - **`issue`**, porque es la clave que une las dos fuentes: derivarlo seria derivar de
 *   si mismo.
 * - **Las entradas que no estan.** Un spec entra al registro con `publicar-spec.mjs
 *   crear` y no de otra forma. Un PR cuya rama nombra un `NNN` ausente del mapa no
 *   agrega nada: es una rama mal nombrada o un spec sin publicar, y las dos veces
 *   inventarle una entrada seria peor que la falta.
 *
 * Y un issue que no esta en el `Map` **deja el titulo como estaba** en vez de vaciarlo:
 * ahi la respuesta cierta es «no lo pude leer», y quien grita por un spec que apunta a
 * un issue inexistente es el gate, que tiene el mensaje para decirlo.
 */
export const derivarMapa = (
  mapa: Mapa,
  issues: ReadonlyMap<number, IssueDeSpec>,
  prsPorSpec: ReadonlyMap<string, PrDeSpec[]>,
): Derivacion => {
  const correcciones: Correccion[] = [];
  const derivado: Mapa = {};

  for (const id of Object.keys(mapa)) {
    const entrada = mapa[id];

    const estado = NO_LOS_MUEVE_UN_MERGE.has(entrada.estado)
      ? entrada.estado
      : (aterrizo(prsPorSpec.get(id)) ? 'Implementado' : 'Propuesto');
    const titulo = issues.get(entrada.issue)?.title ?? entrada.titulo;

    if (estado !== entrada.estado) correcciones.push({ id, campo: 'estado', de: entrada.estado, a: estado });
    if (titulo !== entrada.titulo) correcciones.push({ id, campo: 'titulo', de: entrada.titulo, a: titulo });

    // El spread y no un objeto literal nuevo: `JSON.stringify` serializa en el orden de
    // insercion, y sobrescribir una clave que ya existe NO la mueve de lugar. Asi las
    // cinco claves salen en el orden con el que el mapa se genero, y cambiar un estado
    // da un diff de una linea en vez de una linea reordenada.
    derivado[id] = { ...entrada, estado, titulo };
  }

  return { mapa: derivado, correcciones };
};

/**
 * El texto de `specs/mapa.json`: **una entrada por linea**, ordenadas por `NNN`.
 *
 * Vive aca y no adentro de `publicar-spec.mjs`, que es donde estaba, porque desde el
 * 043 escriben dos. Y devuelve el texto en vez de escribir el archivo para que se pueda
 * testear sin tocar el disco: el `writeFileSync` queda del lado de cada script.
 *
 * **El formato no es estetica.** Con `JSON.stringify(m, null, 2)` cada entrada ocupa
 * siete lineas, asi que agregar un spec da un diff de siete y cambiar un estado da uno
 * que hay que leer con lupa. Asi cada cambio es exactamente la linea del spec que
 * cambio — que es lo que hace revisable el commit que la Action del 043 hace sola.
 */
export const escribirMapa = (mapa: Mapa): string => {
  const cuerpo = Object.keys(mapa).sort().map((id) => `  "${id}": ${JSON.stringify(mapa[id])}`).join(',\n');
  return `{\n${cuerpo}\n}\n`;
};

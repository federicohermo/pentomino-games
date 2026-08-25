import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Estado del trabajo planificado, leido de `specs/`.
 *
 * Es la unica tool que no es de dominio, y la que menos ahorra: `mapa.json` mas los
 * `tasks.md` —61 KB al escribir esto, y suben con cada spec— contra una respuesta
 * de menos de 1 KB. Entra porque el costo de escribirla es un parseo de checkboxes.
 *
 * El parseo esta separado de la lectura a proposito: `parseMapa` y `parseTasks`
 * son puras y se testean contra strings fijos, asi que los tests no se rompen
 * cada vez que alguien marca una tarea.
 */

/**
 * Corta en lineas aceptando CRLF, que es como estan los archivos de este repo en
 * Windows.
 *
 * No es una precaucion teorica: con `split('\n')` el `\r` sobrevive al final de
 * cada linea, y en JavaScript **`.` no matchea `\r`** —lo trata como terminador
 * de linea, igual que `\n`—, asi que todo patron que termine en `(.*)$` deja de
 * matchear y los conteos dan cero sin ningun error.
 */
const lines = (md: string): string[] => md.split(/\r?\n/);

/**
 * Una entrada de `specs/mapa.json`: un spec, su issue, y lo que de el se sabe sin red.
 *
 * Reemplaza a `LogRow` y con ella a `parseLog` (spec 035). La fila de `log.md` traia
 * los mismos cuatro datos ahogados en una descripcion larga que **nadie verificaba**:
 * el PR #44 encontro que mentia sobre 12 de 31 filas. Aca lo que se duplica del issue
 * son dos campos —`estado` y `titulo`— y los dos los vigila un gate.
 */
export interface EntradaDeMapa {
  /** El issue donde vive el spec. Es lo que hace que el mapa sea un mapa. */
  issue: number;
  /**
   * El nombre historico de la carpeta, que **no se deriva del titulo**.
   *
   * Medido sobre los 35: `slugDe` reproduce 28 y falla en 7 —el 001 se llama
   * `001-notas-por-celda-en-orden-angular` y su issue se titula «Asignar cada nota a
   * una celda de la pieza…»—. O sea que ninguna heuristica lo recupera, y sin este
   * campo un arbol recien hidratado inventa siete nombres que ninguna cita conoce.
   */
  carpeta: string;
  /** La fecha en que se escribio el spec. Es un hecho del pasado: no puede derivar. */
  fecha: string;
  /**
   * `Propuesto` · `Implementado` · `Descartado` · `Superado`.
   *
   * Son cuatro desde el 038, que saco `En curso`: el conjunto cerrado lo aceptaba y el
   * mapa no lo usaba en ninguna de sus 42 entradas, porque ningun paso del flujo lo
   * escribe. La lista que manda es `ESTADOS` en `.claude/scripts/lib/specs.ts`, y el
   * gate del mapa es quien la verifica — esto es la version legible, no una segunda
   * fuente.
   */
  estado: string;
  /**
   * El titulo del issue, **verbatim** — con el `Spec NNN — ` adelante y todo.
   *
   * Verbatim y no recortado para que el gate del AC4 sea una igualdad de strings.
   * Cualquier transformacion en el medio es una regla mas que puede desincronizarse
   * sola, que es exactamente lo que este spec vino a sacar del registro.
   */
  titulo: string;
}

/** Los cinco campos que toda entrada tiene que traer. */
const CAMPOS_DE_ENTRADA = ['issue', 'carpeta', 'fecha', 'estado', 'titulo'] as const;

/**
 * `specs/mapa.json` parseado, y **falla fuerte** ante cualquier cosa que no sea el
 * mapa entero.
 *
 * El grito es el punto. Su antecesora `parseLog` devolvia `[]` cuando el regex dejaba
 * de matchear, y `[]` no es un error: es una tabla vacia. Cuando el 034 migro el
 * formato de la columna, los 34 specs pasaron a responder `estado: null` con la nota
 * «sin fila en log.md» —o sea `spec_status` contestando que no sabe nada, en verde—, y
 * lo encontro una consulta a mano y no `mcp:test`.
 *
 * Un JSON roto rompe la tool entera donde un `.md` roto perdia una fila sola. Es el
 * precio del formato y se paga a proposito: perder una fila sola es lo que no se ve.
 */
export function parseMapa(json: string): Record<string, EntradaDeMapa> {
  let crudo: unknown;
  try {
    crudo = JSON.parse(json);
  } catch (e) {
    throw new Error(`specs/mapa.json no es JSON valido: ${(e as Error).message}`);
  }
  if (crudo === null || typeof crudo !== 'object' || Array.isArray(crudo)) {
    throw new Error('specs/mapa.json tiene que ser un objeto `{ "NNN": {…} }`.');
  }

  const mapa: Record<string, EntradaDeMapa> = {};
  for (const [id, valor] of Object.entries(crudo as Record<string, unknown>)) {
    if (!/^\d{3}$/.test(id)) throw new Error(`specs/mapa.json: "${id}" no es un NNN de tres digitos.`);
    if (valor === null || typeof valor !== 'object') throw new Error(`specs/mapa.json: la entrada ${id} no es un objeto.`);

    const e = valor as Record<string, unknown>;
    for (const campo of CAMPOS_DE_ENTRADA) {
      const esperado = campo === 'issue' ? 'number' : 'string';
      if (typeof e[campo] !== esperado) {
        throw new Error(`specs/mapa.json: la entrada ${id} no trae \`${campo}\` como ${esperado}.`);
      }
    }
    mapa[id] = {
      issue: e.issue as number,
      carpeta: e.carpeta as string,
      fecha: e.fecha as string,
      estado: e.estado as string,
      titulo: e.titulo as string,
    };
  }
  return mapa;
}

/**
 * Estados de los que ya no sale trabajo.
 *
 * Un spec `Descartado` no se implemento y no se va a implementar; uno `Superado`
 * se implemento y otro spec posterior lo reemplazo. En los dos casos las casillas
 * que quedaron abiertas son resto historico, no deuda, y ofrecerlas como
 * `proxima` es lo que hacia que esta tool contestara "Crear rama `feature/001`"
 * sobre un spec cerrado hace diez specs.
 */
const ESTADOS_TERMINALES = new Set(['Descartado', 'Superado']);

/**
 * Un archivo que una tarea nombra entre backticks, con su linea cuando la trae.
 *
 * Se devuelve como DATO y no como verdad. Un `tasks.md` nombra un archivo entre
 * backticks tambien cuando la tarea es actualizar un doc que lo enumera, y esa
 * mencion no es una escritura de codigo: medido en
 * `spec-implement-batch/calibracion.md`, contar una de esas le inventaba al lote
 * una arista con el unico spec que si editaba el archivo. Quien filtra por el
 * verbo sigue siendo la skill; lo que esta tool ahorra es el parseo.
 */
export interface Cita {
  /** El `T0NN` de la tarea que lo nombra. `null` en los specs anteriores a la convencion. */
  tarea: string | null;
  archivo: string;
  /** La linea citada —`Board.tsx:61`—, cuando la tarea la trae. */
  linea: number | null;
}

/**
 * Un par `X → Y`: un numero que una tarea mueve de un valor a otro.
 *
 * Es la arista que ningun import delata. Dos specs que mueven la misma constante
 * parecen un conflicto de merge y son una dependencia dura: se lee cruzando los
 * `a` de un spec contra los `de` del resto.
 *
 * Los dos valores viajan como STRING y no como number, y no es pereza: los casos
 * reales del repo incluyen `4,0 → 11,8` y `0,02 → 0,05`, con coma decimal, que
 * `Number()` convierte en `NaN` sin avisar.
 */
export interface Cruce {
  tarea: string | null;
  de: string;
  a: string;
}

/**
 * Que backtick es un archivo: el que termina en una extension conocida, con la
 * linea opcional pegada atras.
 *
 * La lista de extensiones no es decorativa. Sin ella entran `` `CELL_PX` `` y
 * `` `vitest@^4.1.10` `` —medido sobre los 33 `tasks.md`: 1.547 supuestas citas
 * contra 1.388 reales—, y una cita que no es un archivo es exactamente la clase de
 * ruido que hace que la skill vuelva a abrir el archivo para desconfiar.
 */
const CITA = /`([^`\s]*?[\w.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|md|json|css|html|yml|yaml))(?::(\d+)(?:-\d+)?)?`/g;

/**
 * El par `X → Y`, tolerando el enfasis de markdown que lo rodea.
 *
 * Fijado contra los casos reales del repo y no contra el ideal: en `007` el par
 * se escribe ``CELL_PX` 44 → **63**`, con los asteriscos ADENTRO del par, y un
 * patron de `\d+ → \d+` los pierde. Medido: **2** pares sin tolerar el enfasis
 * contra **7** con el, y los cinco que faltaban incluyen los dos que
 * `spec-review-batch/cruces.md` documenta como caso testigo (`63 → 71` del 014 y
 * `71 → 73` del 016).
 *
 * El enfasis se come con una clase de caracteres y no con `(?:\*\*|[*`_])*`: las
 * dos alternativas se solapan en `*` y esa forma es la del backtracking
 * exponencial sobre una linea con muchos asteriscos.
 */
const CRUCE = /[*`_]*(\d+(?:[.,]\d+)?)[*`_]*\s*→\s*[*`_]*(\d+(?:[.,]\d+)?)[*`_]*/g;

/**
 * Saca las citas de un tramo de texto de tarea.
 *
 * Recibe el acumulador en vez de devolver: se llama una vez por la linea de la
 * tarea y una vez por cada continuacion, y las de una continuacion son de la
 * tarea de arriba. Es el mismo recorrido de `parseTasks`, no una segunda pasada.
 */
function extraerCitas(texto: string, tarea: string | null, citas: Cita[]): void {
  for (const m of texto.matchAll(CITA)) {
    citas.push({ tarea, archivo: m[1], linea: m[2] === undefined ? null : Number(m[2]) });
  }
}

/**
 * Saca los cruces, y **solo de la linea de la tarea** — no de sus continuaciones.
 *
 * La asimetria con `extraerCitas` esta medida y es el motivo de que sean dos
 * funciones y no una. Una continuacion es donde vive la prosa que justifica la
 * tarea, y esa prosa tiene numeros con flecha que no son constantes que el spec
 * mueva: sobre los 33 `tasks.md`, correr `CRUCE` tambien sobre las continuaciones
 * da **25** pares donde hay **7**, y los 18 de mas son ruido —`2 → 0.6461` es una
 * frecuencia, `002 → 43` son dos numeros de spec, y una misma tarea aporta
 * `3 → 0` y `0 → 3`—. Filtrando por posicion quedan exactamente los 7 que
 * `spec-review-batch/cruces.md` documenta, casos testigo incluidos.
 *
 * Por que aca se filtra y en las citas no: una cita que no es un archivo hace que
 * la skill vuelva a abrir el archivo para desconfiar; un cruce que no es un cruce
 * le inventa una **dependencia dura entre dos specs**, que es lo que decide el
 * orden de un lote. El segundo falso positivo es mucho mas caro que el primero.
 */
function extraerCruces(texto: string, tarea: string | null, cruces: Cruce[]): void {
  for (const m of texto.matchAll(CRUCE)) cruces.push({ tarea, de: m[1], a: m[2] });
}

export interface TasksInfo {
  hechas: number;
  total: number;
  /**
   * Cuantas del total estan bajo un encabezado `Seguimiento`. Se cuentan aparte
   * porque son deuda anotada a proposito: un spec puede estar `Implementado` con
   * seis sin marcar y no deberle nada a nadie.
   */
  seguimiento: number;
  /**
   * Cuantas del total llevan `[M]`, y es un conteo **historico**: cuenta lo que los
   * specs anteriores al 039 ya tienen escrito, y en un spec nuevo vale siempre `0`.
   *
   * `[M]` marcaba una tarea que pedia una persona —navegador, oido, captura— y que
   * por eso no bloqueaba el cierre del spec. El 039 la derogo con la medicion que la
   * desmiente: de las **137** casillas `[M]` que hay en **35** specs, solo **6** se
   * cerraron alguna vez, o sea que `[M]` no significaba «espera a una persona» sino
   * «no se va a hacer, pero queda escrito». La regla desde el 039 es volver la tarea
   * verificable o no anotarla — el ultimo spec que trae una `[M]` es el **037**.
   *
   * Se sigue contando porque un spec mergeado no se reescribe, y para esos 35 sigue
   * valiendo que es un eje distinto del de `seguimiento`: `Seguimiento` es *donde*
   * esta anotada la tarea, `[M]` era *quien* la podia hacer. Una tarea vieja puede
   * ser las dos cosas, y entonces suma en los dos contadores.
   */
  manual: number;
  /**
   * Las que de verdad faltan: sin marcar, fuera de `Seguimiento` y sin `[M]`.
   * Vale `0` exactamente cuando `proxima` es `null`.
   *
   * El descuento de `[M]` es historico igual que el contador — ver `manual` y el
   * comentario del descuento en `parseTasks`.
   */
  pendientes: number;
  /** La primera de las `pendientes`. */
  proxima: string | null;
  /** El `T###` de `proxima`, cuando el spec numera sus tareas. */
  proximaId: string | null;
  /**
   * Los archivos que cada tarea nombra. Opcional porque `spec_status` las omite
   * cuando responde por todos: medido sobre los 33 specs del 2026-08-23 pesaban
   * 84.097 bytes sobre los 29.742 que la respuesta ya pesaba, y son una lectura
   * que siempre se hace sobre UN spec. La fecha va escrita porque los dos numeros
   * se movieron; el de cada consulta lo mide la nota de la tool (spec 041).
   */
  citas?: Cita[];
  /**
   * Los `X → Y` de cada tarea. Son 7 en todo el repo —solo de la linea de la
   * tarea, ver `extraerCruces`—: viajan siempre.
   */
  cruces: Cruce[];
}

/**
 * Checkboxes de un `tasks.md`, incluidos los anidados.
 *
 * La forma de una tarea es `- [ ] T012 [P] [M] texto`: el ID y los marcadores son
 * opcionales, asi que los specs anteriores a la convencion se leen igual. Los
 * grupos son estado, ID, marcadores y texto — el texto sale sin el ID ni los
 * marcadores, que ya estan parseados y repetirlos ensuciaria `proxima`.
 *
 * `[M]` se sigue parseando aunque el 039 lo derogue: un spec nuevo no lo escribe,
 * pero los 35 que lo tienen estan en disco y hay que leerlos — ver `manual`.
 *
 * Una tarea puede ocupar varias lineas —el texto sigue indentado abajo—, asi que
 * las continuaciones se pegan a la tarea abierta. Sin eso, `proxima` responderia
 * media frase.
 */
export function parseTasks(md: string): TasksInfo {
  const encabezado = /^#{2,}\s+(.*)$/;
  const tarea = /^\s*-\s\[([ xX])\]\s*(?:(T\d{3})\s+)?((?:\[[PM]\]\s*)*)(.*)$/;
  const continuacion = /^\s+\S/;

  let hechas = 0, total = 0, seguimiento = 0, manual = 0, pendientes = 0;
  let enSeguimiento = false;
  let proxima: string[] | null = null;
  let proximaId: string | null = null;
  let abierta: string[] | null = null;
  const citas: Cita[] = [];
  const cruces: Cruce[] = [];
  // El ID de la tarea abierta: una cita que aparece en una continuacion es de la
  // tarea de arriba, y sin esto quedaria colgada de `null`.
  let idAbierto: string | null = null;

  for (const line of lines(md)) {
    const h = encabezado.exec(line);
    if (h) {
      enSeguimiento = /^seguimiento/i.test(h[1].trim());
      abierta = null;
      continue;
    }

    const t = tarea.exec(line);
    if (t) {
      const marcada = t[1] !== ' ';
      const esManual = t[3].includes('[M]');
      total++;
      if (marcada) hechas++;
      if (enSeguimiento) seguimiento++;
      if (esManual) manual++;

      abierta = [t[4].trim()];
      idAbierto = t[2] ?? null;
      extraerCitas(t[4], idAbierto, citas);
      extraerCruces(t[4], idAbierto, cruces);
      // La primera sin marcar que no es de seguimiento ni lleva `[M]` se queda como
      // `proxima`, y sigue abierta para recibir sus continuaciones.
      //
      // El `!esManual` lo CONSERVA el 039 a proposito, que es lo contraintuitivo del
      // cambio: el spec deroga `[M]` **hacia adelante** y un spec mergeado no se
      // reescribe, asi que las 137 casillas `[M]` de los 35 specs que las tienen
      // siguen en disco. Sacar el descuento las convertiria de historia en deuda de un
      // dia para el otro y pondria en rojo, sobre 35 specs que nadie toco, el gate del
      // 038 que exige `pendientes: 0` en todo spec cerrado. En un spec nuevo el
      // descuento no descuenta nada, porque no hay `[M]` que descontar.
      if (!marcada && !enSeguimiento && !esManual) {
        pendientes++;
        if (proxima === null) {
          proxima = abierta;
          proximaId = t[2] ?? null;
        }
      }
      continue;
    }

    if (abierta && continuacion.test(line)) {
      abierta.push(line.trim());
      // Las citas si, los cruces no: el porque esta en `extraerCruces`.
      extraerCitas(line, idAbierto, citas);
    } else if (line.trim() === '') abierta = null;
  }

  return {
    hechas, total, seguimiento, manual, pendientes,
    proxima: proxima === null ? null : proxima.join(' '),
    proximaId,
    citas, cruces,
  };
}

/** Un spec con su entrada del mapa y el conteo de su `tasks.md`. */
export interface SpecStatus {
  id: string;
  /**
   * Su carpeta. Sale del mapa, asi que **existe aunque el spec no este hidratado**:
   * es el nombre historico, el que citan los specs viejos, y no uno derivado del
   * titulo — ver `EntradaDeMapa.carpeta`.
   *
   * Es la IDENTIDAD del spec y no una ruta: para abrir un archivo esta `enDisco`.
   */
  dir: string;
  /**
   * La carpeta que de verdad esta en disco, o `null` si el spec no esta hidratado.
   *
   * Va aparte de `dir` porque los dos hacen falta y **no siempre coinciden**: una
   * cache hidratada antes de que `carpeta` existiera quedo con el slug del titulo, y
   * eran 7 de los 35. Ahi `dir` sigue siendo el nombre que citan los specs viejos y
   * este es donde estan los bytes.
   *
   * Quien vaya a leer o escribir un archivo arma la ruta con ESTE. Con `dir` la ruta
   * apunta a una carpeta que puede no existir, y el `readFileSync` de `spec_write`
   * moria con un ENOENT crudo —sin `try/catch` en el medio— justo en el caso que la
   * nota «cache vieja» describe.
   */
  enDisco: string | null;
  /** El issue donde vive el spec entero. `null` solo si la carpeta no esta en el mapa. */
  issue: number | null;
  fecha: string | null;
  estado: string | null;
  titulo: string | null;
  /**
   * El conteo de su `tasks.md`, o `null` si no se pudo leer. Desde el 034 eso pasa
   * tambien cuando el spec **no esta hidratado**, que no es un error: el spec vive en
   * el issue y la carpeta es una cache. La nota dice cual de los dos casos es.
   */
  tareas: TasksInfo | null;
  /** Que falto para responder del todo. Vacio cuando no falto nada. */
  notas: string[];
}

/**
 * El spec que nombra `ref`: su id (`033`, `33`), su carpeta entera, o el prefijo
 * de su carpeta.
 *
 * Es pura y vive aca, y no en cada tool, porque la resuelven DOS: `spec_status`
 * para acotar la respuesta y `spec_write` para saber que archivo tocar. Dos
 * copias de esta funcion se desincronizan la primera vez que alguien acepta una
 * forma nueva de nombrar un spec en un solo lado.
 */
export function buscarSpec(specs: SpecStatus[], ref: string): SpecStatus | null {
  const limpio = ref.trim();
  // `33` y `033` son el mismo spec: el id del log lleva tres digitos y quien
  // escribe a mano no siempre.
  const id = /^\d+$/.test(limpio) ? limpio.padStart(3, '0') : null;
  return specs.find(s =>
    s.dir === limpio || s.id === limpio ||
    (id !== null && (s.id === id || s.dir.startsWith(`${id}-`)))) ?? null;
}

/** Carpetas `NNN-...` dentro de `specs/`. La lista no se hardcodea en ningun lado. */
function specDirs(specsDir: string): string[] {
  return readdirSync(specsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^\d+-/.test(e.name))
    .map(e => e.name)
    .sort();
}

/**
 * Estado de todos los specs.
 *
 * **Recorre el MAPA y despues cruza con las carpetas, no al reves** — y esa direccion
 * se dio vuelta en el 035 con una medicion: sobre `main` con el 034 recien mergeado y
 * `specs/` sin hidratar, esta funcion devolvia **1 spec de 35**, con
 * `totales: {specs: 1}` y sin una sola nota. Recorrer las carpetas era razonable
 * mientras las carpetas eran el registro; desde que son una **cache**, un checkout sin
 * hidratar hacia que la tool contestara, en verde, que el repo tiene un spec.
 *
 * El descuido que la direccion vieja cuidaba —una carpeta que nadie registro— no se
 * pierde: se recorren tambien las carpetas que el mapa no nombra, y esas salen con
 * `estado: null` y su nota.
 */
export function readSpecStatus(specsDir: string): { specs: SpecStatus[]; totales: Record<string, number> } {
  // Sin `existsSync` y sin fallback: si el mapa no esta, `readFileSync` grita. Es
  // deliberado y es la leccion del 034 —ver `parseMapa`—: la version silenciosa de
  // esta linea contestaba "no hay specs" en vez de "no encontre el registro".
  const mapa = parseMapa(readFileSync(join(specsDir, 'mapa.json'), 'utf8'));
  const enDisco = specDirs(specsDir);

  /**
   * La carpeta hidratada de un spec, emparejando por `NNN` y no por nombre.
   *
   * El mapa dice como se llama, pero una cache hidratada antes de que `carpeta`
   * existiera puede tener otro nombre —7 de los 35 salian con el slug del titulo—, y
   * negarle el `tasks.md` a esos siete seria tratar un nombre viejo como un spec que
   * no esta.
   */
  const hidratada = (id: string): string | null => enDisco.find(d => d.startsWith(`${id}-`)) ?? null;

  const leerTareas = (dir: string, notas: string[]): TasksInfo | null => {
    const ruta = join(specsDir, dir, 'tasks.md');
    if (existsSync(ruta)) return parseTasks(readFileSync(ruta, 'utf8'));
    notas.push('sin tasks.md');
    return null;
  };

  /**
   * De un spec terminal no sale trabajo, asi que sus casillas abiertas no son "lo
   * proximo". Se anota por que en vez de silenciarlas: el conteo sigue mostrando el
   * resto historico y la nota dice que nadie lo debe.
   */
  const sinTrabajo = (tareas: TasksInfo | null, estado: string | null, notas: string[]): TasksInfo | null => {
    if (!tareas || estado === null || !ESTADOS_TERMINALES.has(estado)) return tareas;
    const abiertas = tareas.total - tareas.hechas;
    if (abiertas > 0) notas.push(`${estado}: las ${abiertas} casillas abiertas son historia, no deuda`);
    return { ...tareas, pendientes: 0, proxima: null, proximaId: null };
  };

  const specs: SpecStatus[] = Object.keys(mapa).sort().map((id): SpecStatus => {
    const e = mapa[id];
    const notas: string[] = [];
    const dir = hidratada(id);

    if (dir === null) {
      // No es un error: el spec vive en el issue y la carpeta es una cache. Se dice
      // como reconstruirla, porque quien pregunta suele necesitar el `tasks.md`.
      //
      // **Con el `NNN` y no pelado**, desde el 038: el default del hidratador pasó a
      // traer sólo los que siguen en vuelo, asi que el comando sin argumentos no trae
      // un spec cerrado — que es justo el caso en el que esta nota aparece. Decirlo
      // pelado mandaria a correr algo que termina en exito sin traer lo que se pidio.
      notas.push(`sin hidratar: el spec vive en el issue #${e.issue}. \`node .claude/scripts/hidratar-specs.mjs ${id}\``);
    } else if (dir !== e.carpeta) {
      notas.push(`la carpeta en disco se llama ${dir} y el mapa dice ${e.carpeta}: cache vieja, volver a hidratar`);
    }

    const tareas = dir === null ? null : leerTareas(dir, notas);
    return {
      id,
      dir: e.carpeta,
      enDisco: dir,
      issue: e.issue,
      fecha: e.fecha,
      estado: e.estado,
      // El titulo sale del mapa —que lo copia verbatim del issue— y no del `# ` del
      // spec: es la misma frase, ya parseada, y no obliga a hidratar para tenerla.
      titulo: e.titulo,
      tareas: sinTrabajo(tareas, e.estado, notas),
      notas,
    };
  });

  // La direccion que el mapa no cubre: una carpeta que nadie registro. Es el descuido
  // que conviene ver, no uno que la respuesta deba esconder.
  for (const dir of enDisco) {
    if (mapa[dir.slice(0, 3)] !== undefined) continue;
    const notas = ['sin entrada en specs/mapa.json: el spec no tiene issue al que llegar'];
    specs.push({
      // Una carpeta huerfana es lo unico que hay: el nombre de disco es tambien el
      // unico nombre, asi que `dir` y `enDisco` son el mismo string por definicion.
      id: dir.split('-', 1)[0], dir, enDisco: dir, issue: null, fecha: null, estado: null, titulo: null,
      tareas: leerTareas(dir, notas), notas,
    });
  }

  // Los totales se derivan de los estados que aparecen, sin lista propia: si el
  // mapa estrena `Descartado`, sale en la respuesta sin tocar este archivo.
  const totales: Record<string, number> = { specs: specs.length };
  for (const s of specs) {
    const k = s.estado ?? 'sin estado';
    totales[k] = (totales[k] ?? 0) + 1;
  }
  // Cuantos contestan sin `tareas` por no estar hidratados. Va aparte porque es la
  // diferencia entre "este spec no tiene tareas" y "este checkout no las bajo".
  const sinHidratar = specs.filter(s => s.notas.some(n => n.startsWith('sin hidratar'))).length;
  if (sinHidratar > 0) totales.sinHidratar = sinHidratar;
  return { specs, totales };
}

/**
 * Lo que devuelve una escritura sobre un `tasks.md`.
 *
 * El fallo viaja como valor y no como excepcion porque los dos casos que importan
 * —la tarea no existe, la tarea ya estaba marcada— no son errores del programa
 * sino respuestas: quien llama tiene que poder decirlas. Y devuelve `md` en vez
 * de escribir: estas dos funciones son puras y el I/O lo hace la tool, que es lo
 * que deja testearlas contra strings fijos igual que a los parsers.
 */
export type Escritura =
  | { ok: true; md: string; tarea: string; linea: number; texto: string }
  | { ok: false; motivo: string };

/**
 * Corta conservando los terminadores: los indices pares son lineas y los impares
 * su `\r\n` o `\n`.
 *
 * `lines()` alcanza para leer y NO para escribir. Cortar con `split(/\r?\n/)` y
 * volver a pegar con `\n` reescribe cada linea del archivo en un repo que esta en
 * CRLF, asi que marcar una casilla daria un diff de 300 lineas.
 */
const partir = (md: string): string[] => md.split(/(\r?\n)/);

/** El terminador que ya usa el archivo, para las lineas que se agregan. */
const finDeLinea = (partes: string[]): string => partes.length > 1 ? partes[1] : '\n';

/**
 * Una tarea pasa de `- [ ]` a `- [x]`.
 *
 * No inventa: si la tarea no existe o ya estaba marcada, lo dice. Marcar lo que
 * no se hizo es exactamente el descuido que este repo acaba de arreglar en
 * `log.md`, y una escritura que devuelve exito sin haber cambiado nada es la
 * familia «fallar en verde» que ya costo el `--filter "{.}"` de `verify`.
 */
export function marcarTarea(md: string, id: string): Escritura {
  const partes = partir(md);
  const tarea = /^(\s*-\s\[)([ xX])(\]\s*)(T\d{3})(\s*.*)$/;

  for (let i = 0; i < partes.length; i += 2) {
    const m = tarea.exec(partes[i]);
    if (m === null || m[4] !== id) continue;
    const linea = i / 2 + 1;
    const texto = m[5].trim();
    if (m[2] !== ' ') return { ok: false, motivo: `${id} ya estaba marcada (linea ${linea}): «${texto}».` };
    partes[i] = `${m[1]}x${m[3]}${m[4]}${m[5]}`;
    return { ok: true, md: partes.join(''), tarea: id, linea, texto };
  }
  return { ok: false, motivo: `No hay ninguna tarea ${id} en este spec.` };
}

/**
 * Agrega una tarea al `## Seguimiento` de un spec, con el `T0NN` que sigue.
 *
 * El ID **sigue contando desde el mayor del archivo entero** y nunca reusa uno
 * libre (`specs/README.md`: «un ID libre no molesta a nadie; uno reusado rompe la
 * referencia que otra tarea le hacia»). Por eso el maximo se busca sobre todo el
 * archivo y no sobre la seccion.
 *
 * Si el spec no tiene la seccion, se crea: medido, uno de los 33 —el 018— no la
 * tiene, asi que fallar ahi seria negarse a anotar deuda justo donde no hay
 * ninguna anotada.
 */
export function agregarSeguimiento(md: string, texto: string): Escritura {
  const partes = partir(md);
  const eol = finDeLinea(partes);

  let mayor = 0;
  for (const m of md.matchAll(/^\s*-\s\[[ xX]\]\s*T(\d{3})\b/gm)) {
    mayor = Math.max(mayor, Number(m[1]));
  }
  // `T\d{3}` es el formato que parsea `parseTasks`. Pasado el 999 la tarea nueva
  // seria invisible para la propia tool que la escribio, asi que se dice.
  if (mayor >= 999) return { ok: false, motivo: 'El spec ya llego a T999: no hay ID siguiente de tres digitos.' };
  const id = `T${String(mayor + 1).padStart(3, '0')}`;
  const linea = `- [ ] ${id} ${texto}`;

  // Dos indices y no uno: el encabezado dice si la seccion existe, la ultima
  // linea con contenido dice donde termina. Una seccion que existe pero esta
  // vacia tiene el primero y no el segundo, y colapsarlos escribia un SEGUNDO
  // encabezado debajo del que ya estaba.
  let dentro = false;
  let inicio = -1;
  let ultima = -1;
  for (let i = 0; i < partes.length; i += 2) {
    const h = /^#{2,}\s+(.*)$/.exec(partes[i]);
    if (h !== null) {
      if (dentro) break;
      dentro = /^seguimiento/i.test(h[1].trim());
      if (dentro) inicio = i;
      continue;
    }
    if (dentro && partes[i].trim() !== '') ultima = i;
  }

  if (inicio === -1) {
    // Sin seccion, la tarea nueva se lleva su encabezado. El texto exacto es el
    // que documenta `specs/README.md`.
    const cola = md.endsWith(eol) ? '' : eol;
    const nuevo = `${md}${cola}${eol}## Seguimiento (no bloquea)${eol}${eol}${linea}${eol}`;
    // La linea nueva es la anteultima de `partir`: atras quedan su terminador y
    // el tramo vacio que todo archivo terminado en salto deja al final.
    return { ok: true, md: nuevo, tarea: id, linea: (partir(nuevo).length - 3) / 2 + 1, texto };
  }

  // Al final de la seccion y no debajo del encabezado: el orden de lectura
  // termina siendo el de escritura, que es lo que hace legible el seguimiento.
  const anclaje = ultima === -1 ? inicio : ultima;
  partes.splice(anclaje + 1, 0, eol, linea);
  return { ok: true, md: partes.join(''), tarea: id, linea: (anclaje + 2) / 2 + 1, texto };
}

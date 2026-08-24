import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Estado del trabajo planificado, leido de `specs/`.
 *
 * Es la unica tool que no es de dominio, y la que menos ahorra: `log.md` mas los
 * `tasks.md` —61 KB al escribir esto, y suben con cada spec— contra una respuesta
 * de menos de 1 KB. Entra porque el costo de escribirla es un parseo de checkboxes.
 *
 * El parseo esta separado de la lectura a proposito: `parseLog` y `parseTasks`
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

/** Una fila de la tabla de `log.md`. */
export interface LogRow {
  id: string;
  fecha: string;
  estado: string;
  descripcion: string;
  /**
   * A donde enlaza la fila, **tal cual**: `./NNN-slug/spec.md` mientras el registro
   * vivio en el repo, y la URL del issue desde el spec 034. Es el mapa spec<->issue
   * del AC3, y por eso se guarda crudo en vez de parseado: cualquiera de las dos
   * formas es informacion, y quien la necesite sabe cual espera.
   *
   * Fue `dir` —el slug, sacado del enlace— hasta que el 034 lo dejo sin sentido: con
   * una URL no hay slug que sacar, asi que el campo valia `''` en las 35 filas y el
   * unico consumidor que le quedaba eran sus propios tests.
   */
  href: string;
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
   * Cuantas del total llevan `[M]`: piden una persona —navegador, oido, captura—
   * y por eso sobreviven al merge. Se cuentan aparte por el mismo motivo que las
   * de seguimiento, pero no son lo mismo: `Seguimiento` es *donde* esta anotada
   * la tarea, `[M]` es *quien* la puede hacer. Una tarea puede ser las dos cosas,
   * y entonces suma en los dos contadores.
   */
  manual: number;
  /**
   * Las que de verdad faltan: sin marcar, fuera de `Seguimiento` y sin `[M]`.
   * Vale `0` exactamente cuando `proxima` es `null`.
   */
  pendientes: number;
  /** La primera de las `pendientes`. */
  proxima: string | null;
  /** El `T###` de `proxima`, cuando el spec numera sus tareas. */
  proximaId: string | null;
  /**
   * Los archivos que cada tarea nombra. Opcional porque `spec_status` las omite
   * cuando responde por los 33 specs: pesan 84.097 bytes sobre los 29.742 que la
   * respuesta ya pesa, y son una lectura que siempre se hace sobre UN spec.
   */
  citas?: Cita[];
  /**
   * Los `X → Y` de cada tarea. Son 7 en todo el repo —solo de la linea de la
   * tarea, ver `extraerCruces`—: viajan siempre.
   */
  cruces: Cruce[];
}

/**
 * Filas de la tabla de `log.md`.
 *
 * Lo que ata la fila con la carpeta es el `id`, que es lo unico estable en los dos
 * regimenes del spec 034: esta en la fila, en el nombre de la carpeta y en el
 * titulo del issue.
 */
export function parseLog(md: string): LogRow[] {
  // El destino del enlace es `([^)]*)` y no `\.\/([^/)]+)\/[^)]*`, y ese cambio es del
  // spec 034: desde ahi la fila puede enlazar a una **URL de issue** en vez de a una
  // carpeta, porque los specs ya no se persisten en el repo.
  //
  // Con el regex viejo una tabla migrada no matcheaba **ni una fila**, y el resultado
  // no era un error sino 34 specs con `estado: null` y la nota «sin fila en log.md» —
  // o sea `spec_status` respondiendo que no sabe nada, en verde. Lo encontro una
  // consulta a mano y no `mcp:test`, porque sus fixtures usan el formato viejo.
  const fila = /^\|\s*\[(\d+)\]\(([^)]*)\)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/;
  const rows: LogRow[] = [];

  for (const line of lines(md)) {
    const m = fila.exec(line.trim());
    if (!m) continue;
    rows.push({
      id: m[1],
      href: m[2].trim(),
      fecha: m[3].trim(),
      estado: m[4].trim(),
      descripcion: m[5].trim(),
    });
  }
  return rows;
}

/**
 * Checkboxes de un `tasks.md`, incluidos los anidados.
 *
 * La forma de una tarea es `- [ ] T012 [P] [M] texto`: el ID y los marcadores son
 * opcionales, asi que los specs anteriores a la convencion se leen igual. Los
 * grupos son estado, ID, marcadores y texto — el texto sale sin el ID ni los
 * marcadores, que ya estan parseados y repetirlos ensuciaria `proxima`.
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
      // La primera sin marcar que no es de seguimiento ni pide una persona se
      // queda como `proxima`, y sigue abierta para recibir sus continuaciones.
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

/** Un spec con su fila del log y el conteo de su `tasks.md`. */
export interface SpecStatus {
  id: string;
  dir: string;
  fecha: string | null;
  estado: string | null;
  titulo: string | null;
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
 * Recorre las CARPETAS y despues cruza con `log.md`, no al reves: un spec con
 * carpeta y sin fila en el log es exactamente el descuido que conviene ver, y no
 * uno que la respuesta deba esconder.
 */
export function readSpecStatus(specsDir: string): { specs: SpecStatus[]; totales: Record<string, number> } {
  const logPath = join(specsDir, 'log.md');
  const log = existsSync(logPath) ? parseLog(readFileSync(logPath, 'utf8')) : [];
  // **Por numero y no por carpeta** (spec 034). Antes la clave era el slug del
  // directorio, que salia del enlace de la fila; desde que ese enlace puede ser una URL
  // de issue, el slug ya no esta ahi — y ademas el directorio local es una CACHE que se
  // reconstruye desde el issue, asi que su nombre puede no ser el historico. El `NNN`
  // es lo unico que no cambia: esta en la fila, en la carpeta y en el titulo del issue.
  const byId = new Map(log.map(r => [r.id, r]));

  const specs = specDirs(specsDir).map((dir): SpecStatus => {
    const notas: string[] = [];
    const row = byId.get(dir.slice(0, 3)) ?? null;
    if (!row) notas.push('sin fila en log.md');

    const tasksPath = join(specsDir, dir, 'tasks.md');
    let tareas: TasksInfo | null = null;
    if (existsSync(tasksPath)) tareas = parseTasks(readFileSync(tasksPath, 'utf8'));
    else notas.push('sin tasks.md');

    // De un spec terminal no sale trabajo, asi que sus casillas abiertas no son
    // "lo proximo". Se anota por que en vez de silenciarlas: el conteo sigue
    // mostrando el resto historico y la nota dice que nadie lo debe.
    if (tareas && row && ESTADOS_TERMINALES.has(row.estado)) {
      const abiertas = tareas.total - tareas.hechas;
      if (abiertas > 0) {
        notas.push(`${row.estado}: las ${abiertas} casillas abiertas son historia, no deuda`);
      }
      tareas = { ...tareas, pendientes: 0, proxima: null, proximaId: null };
    }

    return {
      id: row?.id ?? dir.split('-', 1)[0],
      dir,
      fecha: row?.fecha ?? null,
      estado: row?.estado ?? null,
      // El titulo sale de la descripcion del log y no del `# ` del spec: es la
      // misma frase, ya parseada, y evita abrir seis archivos mas.
      titulo: row?.descripcion ?? null,
      tareas,
      notas,
    };
  });

  // Los totales se derivan de los estados que aparecen, sin lista propia: si el
  // log estrena `Descartado`, sale en la respuesta sin tocar este archivo.
  const totales: Record<string, number> = { specs: specs.length };
  for (const s of specs) {
    const k = s.estado ?? 'sin estado';
    totales[k] = (totales[k] ?? 0) + 1;
  }
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

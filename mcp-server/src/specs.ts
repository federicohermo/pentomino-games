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
  dir: string;
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
}

/**
 * Filas de la tabla de `log.md`.
 *
 * `dir` sale del link de la primera celda y no de una convencion de nombres: es
 * lo que ata la fila con la carpeta, y ademas es el nombre de la rama.
 */
export function parseLog(md: string): LogRow[] {
  const fila = /^\|\s*\[(\d+)\]\(\.\/([^/)]+)\/[^)]*\)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/;
  const rows: LogRow[] = [];

  for (const line of lines(md)) {
    const m = fila.exec(line.trim());
    if (!m) continue;
    rows.push({
      id: m[1],
      dir: m[2],
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

    if (abierta && continuacion.test(line)) abierta.push(line.trim());
    else if (line.trim() === '') abierta = null;
  }

  return {
    hechas, total, seguimiento, manual, pendientes,
    proxima: proxima === null ? null : proxima.join(' '),
    proximaId,
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
  const byDir = new Map(log.map(r => [r.dir, r]));

  const specs = specDirs(specsDir).map((dir): SpecStatus => {
    const notas: string[] = [];
    const row = byDir.get(dir) ?? null;
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

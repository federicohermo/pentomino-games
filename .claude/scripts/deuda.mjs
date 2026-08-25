/**
 * El censo de deuda: que issues abiertos no son de ningun spec (spec 044).
 *
 * Desde el 042 la deuda vive en GitHub Issues y los skills la abren solos — 25 issues de
 * deuda contra 43 de spec al escribir esto—. Lo que faltaba era la pregunta de vuelta:
 * **que hay para promover.** Hoy eso son tres comandos y un cruce a mano, y el triage no
 * se automatiza —cual se promueve y en que orden es una decision, y una maquina que la
 * tome inventa prioridades— pero **mirarlo no puede costar quince minutos o no se mira**.
 *
 * ## Por que un script y no una tool del MCP
 *
 * `spec_status` no habla con la red, y esa es una propiedad que el 034 defiende
 * explicitamente: responde sin hidratar y sin `gh`. Una tool que a veces necesita red y a
 * veces no es una tool que falla distinto segun donde corra — y el que la llama no tiene
 * como saber cual de las dos le toco.
 *
 * ## Que se lista y que no
 *
 * Se listan los **abiertos** sin reclamar, ordenados del mas viejo al mas nuevo. Los
 * cerrados sin reclamar se cuentan pero no se listan: son los que se arreglaron por el
 * carril `fix/`/`chore/` sin spec —eran tres— y no hay nada que promover en ellos, pero
 * que el numero aparezca es lo que distingue «no hay» de «no se pidieron».
 *
 * Uso:
 *   node .claude/scripts/deuda.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerMapa, deudaDelCenso, LIMITE_DE_LISTA } from './lib/specs.ts';
// El lanzador de `gh` que explica sus fallos en vez de tirar un `ENOENT` crudo (issue #125).
import { gh as lanzarGh } from './lib/gh.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MAPA_JSON = join(RAIZ, 'specs', 'mapa.json');
const REPO = 'federicohermo/pentomino-games';

/** Milisegundos en un dia, para la antiguedad. */
const UN_DIA = 24 * 60 * 60 * 1000;

const mapa = leerMapa(readFileSync(MAPA_JSON, 'utf8'));

const issues = JSON.parse(lanzarGh([
  'issue', 'list', '--repo', REPO,
  '--state', 'all', '--limit', String(LIMITE_DE_LISTA),
  '--json', 'number,state,title,labels,createdAt',
], { encoding: 'utf8', maxBuffer: 1 << 28 }));

// Una lista truncada no distingue «este issue no existe» de «no entro en la pagina», y
// las dos respuestas son opuestas. Es la misma guarda que el gate del mapa y el derivador,
// y por eso el techo sale de la misma constante.
if (issues.length >= LIMITE_DE_LISTA) {
  console.error(`\ngh devolvio ${issues.length} issues, o sea el limite: la lista puede estar cortada`
    + ' y el censo saldria corto sin decirlo. Subi `LIMITE_DE_LISTA` en `.claude/scripts/lib/specs.ts`.\n');
  process.exit(1);
}

const sinReclamar = deudaDelCenso(issues, mapa);
const abiertos = sinReclamar.filter((i) => i.state === 'OPEN')
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
const cerrados = sinReclamar.length - abiertos.length;

const ahora = Date.now();
for (const issue of abiertos) {
  const etiquetas = issue.labels.map((l) => l.name).join(', ') || '—';
  const dias = (ahora - Date.parse(issue.createdAt)) / UN_DIA;
  console.log(`#${String(issue.number).padEnd(4)} ${etiquetas.padEnd(12)} ${dias.toFixed(1).padStart(6)} d  ${issue.title}`);
}

console.log(`\n${abiertos.length} issues abiertos sin entrada en el mapa, de ${issues.length} en el repo.`);
console.log(`${Object.keys(mapa).length} son de un spec, y ${cerrados} cerrados sin spec no se listan.`);
// El triage NO se automatiza, y decirlo aca es parte del instrumento: un listado ordenado
// por antiguedad se lee como una cola, y no lo es. El repo es joven —la deuda abierta iba
// de 0,2 a 2,6 dias al medirlo— asi que la antiguedad todavia no dice nada; ordena por
// algo estable, no por prioridad.
console.log('El orden es por antiguedad y NO es una prioridad: cual se promueve es una decision.');

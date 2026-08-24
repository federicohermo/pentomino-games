/**
 * Los `NNN` de los specs que estan en un estado, uno por linea (spec 035).
 *
 * Existe para los dos `.sh` —`lote.sh` y `matriz.sh`— y su `--propuestos`. Hasta el
 * 035 cada uno lo sacaba con **su propio `sed`** sobre la tabla de `specs/log.md`, o
 * sea el mismo parseo escrito dos veces; ahora los dos llaman aca.
 *
 * ## Por que node y no `jq` ni `sed`
 *
 * El plan de este spec preveia esas dos: `jq` si estaba en el PATH, y si no un `sed`.
 * Medido, **`jq` no esta**. Y un `sed` sobre JSON ata la busqueda al FORMATO del
 * archivo —una entrada por linea—, asi que el dia que alguien lo reformatee la
 * respuesta pasa a ser vacia sin un solo error: un lote de cero specs que se lee como
 * «no hay nada `Propuesto`». Es la familia «fallar en verde» que este repo persigue.
 *
 * `node` no es una dependencia nueva: los dos `.sh` ya le dicen al usuario que corra
 * `node .claude/scripts/hidratar-specs.mjs` cuando falta un spec, y el repo declara su
 * version en `engines`. Y con `JSON.parse` la respuesta no depende del formato.
 *
 * Uso:
 *   node .claude/scripts/specs-por-estado.mjs             # Propuesto
 *   node .claude/scripts/specs-por-estado.mjs "En curso"
 */
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerMapa, idsPorEstado } from './lib/specs.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ESTADO = process.argv[2] ?? 'Propuesto';

const mapa = leerMapa(readFileSync(join(RAIZ, 'specs', 'mapa.json'), 'utf8'));
for (const id of idsPorEstado(mapa, ESTADO)) console.log(id);

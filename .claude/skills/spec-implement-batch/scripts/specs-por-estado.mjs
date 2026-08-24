/**
 * Los `NNN` de los specs que estan en un estado, uno por linea.
 *
 * **Vive adentro del skill.** Un skill se lleva los scripts que usa: el `.sh` de al lado
 * lo llama con una ruta relativa a si mismo, asi que el skill se puede mover, copiar o
 * empaquetar sin que quede nada colgando afuera. La contracara es que hay una copia por
 * skill, y que las dos sean IGUALES lo verifica un gate —
 * `.claude/scripts/__tests__/scripts-de-specs.test.ts`—, que es la respuesta al unico
 * riesgo real de duplicar: que una se arregle y la otra no.
 *
 * ## No importa nada, y eso no es pereza
 *
 * La version anterior vivia en `.claude/scripts/` e importaba `lib/specs.ts`. Eso ataba
 * un `--propuestos` a un node capaz de correr TypeScript sin compilar —**>= 22.18**, muy
 * por encima del `^20.19` que el repo declara en `engines`—, y por debajo de ese piso
 * moria con `ERR_UNKNOWN_FILE_EXTENSION`. Peor: el `.sh` no se enteraba y el lote seguia
 * con cero specs. Sin el import corre en cualquier node que el repo soporte.
 *
 * ## Por que node y no `jq` ni `sed`
 *
 * Medido: **`jq` no esta** en el PATH. Y un `sed` sobre JSON ata la busqueda al FORMATO
 * del archivo —una entrada por linea—, asi que el dia que alguien lo reformatee la
 * respuesta pasa a ser vacia sin un solo error: un lote de cero specs que se lee como
 * «no hay nada Propuesto». Con `JSON.parse` la respuesta no depende del formato.
 *
 * Uso, desde la raiz del repo:
 *   node <este-archivo>             # Propuesto
 *   node <este-archivo> "En curso"
 */
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Cuatro niveles arriba: <raiz>/.claude/skills/<skill>/scripts/.
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const ESTADO = process.argv[2] ?? 'Propuesto';

const mapa = JSON.parse(readFileSync(join(RAIZ, 'specs', 'mapa.json'), 'utf8'));

// Grita en vez de devolver la lista vacia, y esa es la leccion del 034: «el registro no
// se pudo leer» y «ninguno esta en ese estado» son cosas distintas, y `[]` las dice
// iguales. El `.sh` que llama aca corta con exit 3 y explica que paso.
if (mapa === null || typeof mapa !== 'object' || Array.isArray(mapa) || Object.keys(mapa).length === 0) {
  throw new Error('specs/mapa.json no es un mapa `{ "NNN": {…} }` con entradas: o se trunco, o este no es el archivo.');
}

for (const id of Object.keys(mapa).filter((k) => mapa[k]?.estado === ESTADO).sort()) console.log(id);

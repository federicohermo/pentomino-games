import { z } from 'zod';
import { defineTool, json } from './types.ts';
import { renderAscii, sizeOf } from '../render.ts';
import { PIECE_KEYS } from '../pieces.ts';
import { rotateN, reflect } from '../../../src/domain/transform.ts';
import { notesForRotation, midiName } from '../../../src/domain/music.ts';
import { SHAPES, ANCHOR_INDEX } from '../../../src/domain/constants/pieces.constants.ts';
import { BASE_MAP, CHROMATIC, DEFAULT_OCTAVE } from '../../../src/domain/constants/music.constants.ts';

/**
 * Forma + sonido de una pieza en una orientacion. Es la tool de mayor ahorro:
 * responder esto leyendo el codigo obliga a componer cuatro puras a mano sobre
 * cinco pares de coordenadas, y nadie avisa si la simulacion mental salio mal.
 *
 * Todo lo que se calcula viene de `src/domain/`. Lo unico propio es el ASCII.
 */

/**
 * Como se llama la formula que elige cada rotacion.
 *
 * Es una ETIQUETA, no la regla: quien elige la formula es `notesForRotation` en
 * `domain/music.ts`, y las notas de la respuesta salen de ahi. Si el mapeo
 * rotacion→formula cambia alla, este texto hay que actualizarlo — es la unica
 * linea del server que puede quedar desincronizada del dominio, y por eso esta
 * sola y anotada.
 */
const SCALE_LABEL = [
  'pentatónica mayor (rotación 0°)',
  'pentatónica menor (rotación 90°)',
  'pentatónica menor con blue note (rotación 180°)',
  'pentatónica mayor transpuesta +7 (rotación 270°)',
];

const inputSchema = z.object({
  piece: z.enum(PIECE_KEYS)
    .describe('Letra de la pieza. Describe la FORMA, no el sonido: la pieza F suena en C.'),
  rotation: z.number().int().min(0).max(3).default(0)
    .describe('Cuartos de vuelta horarios: 0=0°, 1=90°, 2=180°, 3=270°. Elige la fórmula de escala.'),
  mirror: z.boolean().default(false)
    .describe('Reflexión. Invierte el orden de las notas (retrógrado) y a veces no cambia la forma.'),
  octave: z.number().int().min(0).max(8).default(DEFAULT_OCTAVE)
    .describe(`Octava en la que se construye el arpegio. La app usa ${DEFAULT_OCTAVE}.`),
});

export const describePiece = defineTool({
  name: 'describe_piece',
  description:
    'Qué forma tiene y qué suena una pieza en una orientación dada. Usar ANTES de simular a mano ' +
    'una rotación o un arpegio: devuelve las celdas ya transformadas (en orden de array), el ' +
    'render ASCII con la celda de agarre marcada, la tónica, la fórmula de escala y las cinco ' +
    'notas MIDI con el retrógrado ya aplicado. Ejecuta las funciones reales de src/domain/, así ' +
    'que responde lo que suena hoy, no lo que decía la documentación.\n' +
    'Dos trampas medidas que conviene tener presentes: (1) la letra describe la FORMA, no el ' +
    'sonido — la pieza F suena con tónica C, y la nota F le toca a la pieza T; (2) en I, T, U, V, ' +
    'W y X la reflexión es geométricamente invisible y aun así invierte las notas.',
  inputSchema,
  run: ({ piece, rotation, mirror, octave }) => {
    const rotated = rotateN(SHAPES[piece], rotation);
    const cells = mirror ? reflect(rotated) : rotated;
    const anchorIndex = ANCHOR_INDEX[piece];

    // El retrogrado se aplica igual que en la app: `notesForRotation` produce el
    // arpegio ascendente y la reflexion lo da vuelta despues.
    const ascending = notesForRotation(BASE_MAP[piece], octave, rotation);
    const notes = mirror ? [...ascending].reverse() : ascending;

    return json({
      piece, rotation, mirror, octave,
      tonic: CHROMATIC[BASE_MAP[piece]],
      tonicPc: BASE_MAP[piece],
      scale: SCALE_LABEL[rotation],
      // El indice k es la misma celda logica que en SHAPES: rotar, reflejar y
      // normalizar son `map`. De eso depende que el ancla salga por indice.
      cells,
      anchorIndex,
      anchor: cells[anchorIndex],
      size: sizeOf(cells),
      ascii: renderAscii(cells, anchorIndex),
      notes: notes.map(m => ({ midi: m, name: midiName(m) })),
      retrograde: mirror,
    });
  },
});

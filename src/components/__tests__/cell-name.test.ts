import { describe, it, expect } from 'vitest';
import { cellNameFor } from '../cell-name.ts';
import { cellTextFor } from '../cell-text.ts';
import { REGIMEN } from '../../domain/constants/music.constants.ts';

/**
 * Los cuatro casos del AC8 (spec 026): celda libre, ocupada, ocupada y muteada, y
 * el criterio de que el fantasma no entra. Es el mismo tipo de test que
 * `cell-text.test.ts` -puro, sin DOM y sin React, en el `environment: 'node'` del
 * resto del repo- por la misma razon: lo que un lector de pantalla va a anunciar
 * tambien es una decision, y sin este archivo viviria sin test adentro de
 * `Board.tsx`.
 */
describe('cellNameFor — el nombre accesible de una celda', () => {
  it('celda libre: solo la coordenada y "libre", sin nota ni paso', () => {
    expect(cellNameFor(3, 2, null)).toBe('fila 3, columna 4, libre');
  });

  it('celda ocupada: coordenada, pieza, nota y paso, con el MISMO numero que la celda pinta', () => {
    const cell = cellTextFor('F', 0, false, REGIMEN.escala)[0];
    expect(cellNameFor(0, 0, { piece: 'F', muted: false, cell })).toBe(
      `fila 1, columna 1, pieza F, nota ${cell.note}, paso ${cell.step} de 4`,
    );
  });

  it('celda ocupada y muteada: el nombre dice "muteada" y conserva nota y paso (spec 014)', () => {
    // La pieza muteada "ocupa su lugar y su tiempo sin sonar" (spec 014) y NO es una
    // ausencia de contenido: el nombre tiene que seguir diciendo que nota y que paso
    // le tocarian, y ademas que esta muteada.
    const cell = cellTextFor('L', 1, true, REGIMEN.orden)[2];
    expect(cellNameFor(5, 3, { piece: 'L', muted: true, cell })).toBe(
      `fila 4, columna 6, pieza L muteada, nota ${cell.note}, paso ${cell.step} de 4`,
    );
  });

  it('el fantasma no entra: sin ocupante real, el nombre es "libre" aunque haya un CellText de fantasma para esa celda', () => {
    // Lo que `Board.tsx` calcularia para el HOVER de una `T` en esa celda -exactamente
    // el mismo `cellTextFor` que usa el fantasma en Board.tsx:213-. `cellNameFor` no
    // lo recibe: al no haber pieza colocada, el unico argumento posible es `null`, y
    // eso demuestra la garantia estructural del docblock -no hay forma de pasarle la
    // nota/paso del fantasma sin un ocupante real del que sacar `piece` y `muted`.
    const fantasma = cellTextFor('T', 2, false, REGIMEN.escala)[1];
    expect(fantasma).toBeDefined(); // el fantasma existe...
    expect(cellNameFor(7, 5, null)).toBe('fila 6, columna 8, libre'); // ...y no se usa.
  });
});

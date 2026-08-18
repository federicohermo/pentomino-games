/**
 * Los tres sonidos que puede pisar la cabeza lectora en un intervalo del recorrido
 * (D8, spec 011): la nota propia de una pieza, el cruce con floritura sobre una celda
 * ocupada que no es su turno, o el click mudo sobre celda vacia. Const-object y no un
 * booleano porque el conjunto ya no es cerrado a dos valores, y `erasableSyntaxOnly`
 * rechaza `enum` (ver `Marca` en `route.types.ts` para el porque del cambio).
 */
export const MARCA = { nota: 'nota', cruce: 'cruce', click: 'click' } as const;

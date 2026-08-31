/**
 * Cuántas columnas tiene una rejilla de `n` iconos para que **la última fila esté llena**.
 *
 * Es la función que `repeat(auto-fill, …)` no puede ser, y la diferencia es exactamente el
 * bug que este módulo cierra: `auto-fill` devuelve **la mayor cantidad que entre**, divida
 * o no. A un ancho que admita 5, `auto-fill` da 5 y deja 3 huecos; acá da 4.
 *
 * Rectángulo lleno = `c × f = n` exacto, o sea que `c` tiene que **dividir** a `n`. Con
 * doce iconos eso son `{1, 2, 3, 4, 6, 12}`, y la regla es la mayor que entre.
 *
 * ## Por qué 1 y 12 no son candidatas
 *
 * Porque son la misma degeneración vista por sus dos ejes, y una de las dos **es el bug de
 * hoy**: una columna por doce filas es la grilla que el dock pinta ahora mismo, 875 px de
 * alto adentro de una caja de 215. Doce columnas por una fila es su espejo — un dock de 620
 * px de ancho, o sea una barra que cruza el tablero—. Las dos son técnicamente rectángulos
 * llenos y ninguna de las dos es una tabla periódica, así que el conjunto de candidatas son
 * las divisoras **propias**: `{2, 3, 4, 6}` para doce, que es lo que AC1 pide.
 *
 * ## El piso, y por qué no puede no haberlo
 *
 * Si ninguna candidata entra —un techo más chico que las dos columnas de 100 px— se
 * devuelve **la menor**, no el 1. Devolver 1 sería contestar con el bug: la columna única
 * no aparece porque alguien la eligiera sino porque el ancho no alcanzaba, que es la misma
 * cadena que produjo el desborde de 1192 px. Con el chasis, el ancho del panel lo fija esta
 * cuenta y no al revés, así que un techo que no dé para dos columnas es un techo mal
 * elegido y no un caso que haya que degradar en silencio.
 *
 * El 1 se devuelve **sólo** cuando `n` no tiene ninguna divisora propia —un primo, o `n ≤
 * 3`—, que es el único caso donde no hay rectángulo no degenerado que dar. No es una rama
 * defensiva: `columnasRectangulares(7, …)` la ejercita, y con doce iconos no se alcanza.
 *
 * @param n     cuántos iconos hay que repartir
 * @param ancho el techo en px que la rejilla no puede pasar
 * @param pista el ancho de una columna en px
 * @param gap   la separación entre columnas en px
 */
export function columnasRectangulares(n: number, ancho: number, pista: number, gap: number): number {
  // Ascendente y en una sola pasada, guardando las dos respuestas que hacen falta: la menor
  // divisora propia (el piso) y la mayor que entra (la respuesta). Ordenar el conjunto de
  // divisoras para recorrerlo al revés sería una lista intermedia para leer dos elementos.
  let menor = 1;
  let mayorQueEntra = 0;
  for (let c = 2; c < n; c++) {
    if (n % c !== 0) continue;
    if (menor === 1) menor = c;
    // `c` pistas con `c - 1` separaciones entre ellas. El `<=` y no `<` es a propósito: el
    // ancho exacto entra, y es justo el caso del default —4 columnas piden 204 contra un
    // techo de 220—.
    if (c * pista + (c - 1) * gap <= ancho) mayorQueEntra = c;
  }
  return mayorQueEntra === 0 ? menor : mayorQueEntra;
}

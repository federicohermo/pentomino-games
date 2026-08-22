import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import { cellPxPara } from './cell-px.ts';

/**
 * Mide el contenedor raíz y escribe el tamaño de celda en la custom property `--cell`.
 *
 * Es el tercer hook de entrada de `components/`, junto a los dos del spec 022, y está acá
 * por la misma regla: **el listener global vive en un hook de `components/`, en un efecto
 * propio**, con el `ref` creado en el shell. `App.tsx` no declara un solo `useEffect` desde
 * el 022 y este spec no lo cambia — lo único que agrega al shell es un `ref` y una llamada.
 *
 * ## Por qué una custom property y no `useState`
 *
 * Porque el tamaño de celda lo leen las 60 celdas, las seis filas, el velo y la cabeza
 * lectora. Con el número en el estado de React, cada evento de `resize` re-renderizaría el
 * árbol entero — y un arrastre de ventana son decenas de eventos por segundo. Con
 * `--cell`, redimensionar reposiciona todo eso sin que React se entere: la custom property
 * hereda hacia abajo y el navegador resuelve los `calc()` solo.
 *
 * Esa herencia es también lo que decide **sobre qué nodo** se escribe: el contenedor raíz y
 * no el del tablero. Los dos flotantes del spec 021 son `fixed` y viven fuera de `Board`,
 * así que sus cajas —medidas en celdas— no resolverían `var(--cell)` si colgara de ahí.
 *
 * ## Por qué se mide la CAJA y no `window.innerWidth`
 *
 * Porque tienen que ser el mismo número. El contenedor raíz mide `100dvh` de alto, y
 * `innerHeight` en iOS incluye la barra del navegador: si la fórmula recibe uno y la caja
 * tiene el otro, la celda se calcula contra un alto que el contenedor no tiene y la grilla
 * desborda unos píxeles sin que nada falle. Leyendo `clientWidth`/`clientHeight` del propio
 * nodo, el número que entra a la fórmula **es** el que la caja mide, sea cual sea la unidad
 * con la que el CSS lo haya expresado. Y de paso no hace falta un `visualViewport?.height ??
 * innerHeight`, que es una rama que ningún navegador de test recorre.
 *
 * ## `useLayoutEffect` y no `useEffect`
 *
 * Con `--cell` sin definir, `repeat(10, var(--cell))` es una declaración inválida y la
 * grilla colapsa a una columna. Un `useEffect` corre DESPUÉS del primer paint, así que ese
 * colapso sería visible durante un cuadro.
 *
 * ## Sin debounce
 *
 * El handler hace una lectura de layout y una escritura de custom property, y el navegador
 * ya agrupa los `resize` por cuadro. Un debounce agregaría el único artefacto que este spec
 * no quiere: el tablero quedándose atrás de la ventana mientras se arrastra.
 */
export function useCellPx(raizRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const raiz = raizRef.current;
    if (raiz === null) return;

    // `setProperty` sobre el nodo y no `style={{ '--cell': … }}` en el JSX: React tipa
    // `style` como `CSSProperties`, que no admite propiedades custom, así que la vía del
    // JSX pide un `as React.CSSProperties` — una aserción para escribir un string. Y
    // además volvería a meter el número en el render, que es lo que este hook evita.
    //
    // **Con la unidad.** Un `--cell` que valga `180` a secas deja inválidos a todos los
    // `calc(var(--cell) * n)` y la grilla colapsa sin un solo error en consola.
    const escribir = () => {
      raiz.style.setProperty('--cell', `${cellPxPara(raiz.clientWidth, raiz.clientHeight)}px`);
    };

    escribir();
    window.addEventListener('resize', escribir);
    return () => window.removeEventListener('resize', escribir);
  }, [raizRef]);
}

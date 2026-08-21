import { useEffect, useRef } from 'react';
import { iniciarEspectro } from './spectrum-loop.ts';

/**
 * Espectro de la senal que sale por el master, dibujado en un canvas.
 *
 * React monta el <canvas> y arranca/frena el loop; el dibujo es imperativo y NO
 * pasa por estado: 60 renders por segundo de React para pintar barras competirian
 * con el re-render del tablero sin darle nada a nadie. Lo unico que cruza la
 * frontera es la lectura del motor, que el loop hace por su cuenta.
 *
 * El cuerpo del loop vive en `spectrum-loop.ts` y no aca: mientras estuvo adentro de
 * este `.tsx` no se podia exportar —`react-refresh/only-export-components`— y por lo
 * tanto no se podia testear, igual que el de `Playhead`. Lo que queda es el montaje,
 * que es lo unico propio del componente.
 */
export default function Spectrum() {
  const ref = useRef<HTMLCanvasElement>(null);

  // El array de dependencias vacio es intencional: el loop se monta una vez y lee
  // del motor directamente, asi que no hay nada que re-suscribir cuando la app
  // re-renderiza.
  useEffect(() => iniciarEspectro(ref.current), []);

  return (
    <div className="h-24 w-full">
      <canvas ref={ref} className="block h-full w-full rounded-xl bg-slate-900" />
    </div>
  );
}

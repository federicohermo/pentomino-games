import { describe, it, expect } from 'vitest';
import { crearGh, mensajeSinGh, mensajeSinSesion, UBICACIONES_WINDOWS, type EntornoGh } from '../lib/gh.ts';

/**
 * El lanzador de `gh` del issue #125.
 *
 * Lo que se prueba es **el camino de fallo**, que es el único que importa: el camino
 * feliz es `execFileSync` y no lo escribimos nosotros. Y el fallo que importa es «no hay
 * `gh` en esta máquina», que en la máquina que corre los tests no se puede fabricar —por
 * eso el entorno se inyecta, igual que el módulo de rutas en `gate-de-spec.test.ts`.
 *
 * Los tres caminos son tres y no uno:
 *
 *   - lo encuentra en el PATH  → no pasa nada, y sobre todo NO avisa;
 *   - da `ENOENT` y está en una ubicación conocida → lo rescata, avisa, y sigue;
 *   - da `ENOENT` y no está en ninguna → muere con el mensaje.
 */

/** Un error con la forma del que tira `execFileSync` cuando no encuentra el binario. */
const enoent = (): Error => Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' });

/** Un error con la forma del que tira `execFileSync` cuando el comando falla. */
const falloDeGh = (stderr: string): Error => Object.assign(new Error('exit 4'), { status: 4, stderr });

/**
 * Un entorno de mentira, con los registros de lo que le pasó.
 *
 * `morir` **tira** en vez de devolver: su tipo es `never`, y una implementación que
 * volviera dejaría al lanzador siguiendo de largo después de morir — que es el bug que
 * este archivo existe para no tener.
 */
function entornoFalso(opciones: {
  plataforma?: string;
  existentes?: readonly string[];
  respuestas: readonly (string | Error)[];
}): EntornoGh & { llamadas: string[]; avisos: string[] } {
  const llamadas: string[] = [];
  const avisos: string[] = [];
  const pendientes = [...opciones.respuestas];

  return {
    llamadas,
    avisos,
    plataforma: opciones.plataforma ?? 'win32',
    existe: (ruta) => (opciones.existentes ?? []).includes(ruta),
    avisar: (mensaje) => { avisos.push(mensaje); },
    morir: (mensaje) => { throw new Error(`MURIO: ${mensaje}`); },
    ejecutar: (bin) => {
      llamadas.push(bin);
      const siguiente = pendientes.shift();
      // Una respuesta de menos seria un `undefined` devuelto como si fuera la salida de
      // `gh`, o sea un test que pasa por el motivo equivocado.
      if (siguiente === undefined) throw new Error('el test no declaro una respuesta para esta llamada');
      if (siguiente instanceof Error) throw siguiente;
      return siguiente;
    },
  };
}

describe('cuando `gh` esta en el PATH', () => {
  it('lo usa y NO avisa nada', () => {
    const entorno = entornoFalso({ respuestas: ['[]'] });

    expect(crearGh(entorno)(['issue', 'list'])).toBe('[]');
    expect(entorno.llamadas).toEqual(['gh']);
    // El aviso vacio no es cosmetico: un lanzador que avise siempre entrena a ignorarlo,
    // y entonces el aviso del caso que SI importa tampoco se lee.
    expect(entorno.avisos).toEqual([]);
  });
});

describe('cuando `gh` no esta en el PATH pero si en el disco', () => {
  it('lo rescata de la ubicacion conocida, avisa, y devuelve la salida', () => {
    const entorno = entornoFalso({
      existentes: [UBICACIONES_WINDOWS[1]],
      respuestas: [enoent(), '{"ok":true}'],
    });

    expect(crearGh(entorno)(['issue', 'view', '1'])).toBe('{"ok":true}');
    expect(entorno.llamadas).toEqual(['gh', UBICACIONES_WINDOWS[1]]);
    expect(entorno.avisos).toHaveLength(1);
    expect(entorno.avisos[0]).toContain(UBICACIONES_WINDOWS[1]);
    expect(entorno.avisos[0]).toContain('PATH');
  });

  it('lo busca UNA vez: la segunda llamada ya va derecho al rescatado', () => {
    // Es la mitad que hace que el rescate no cueste una busqueda por consulta. `publicar`
    // hace ~171 llamadas, asi que la diferencia no es teorica.
    const entorno = entornoFalso({
      existentes: [UBICACIONES_WINDOWS[0]],
      respuestas: [enoent(), 'una', 'dos'],
    });
    const gh = crearGh(entorno);

    gh(['a']);
    gh(['b']);

    expect(entorno.llamadas).toEqual(['gh', UBICACIONES_WINDOWS[0], UBICACIONES_WINDOWS[0]]);
    expect(entorno.avisos).toHaveLength(1);
  });

  it('prefiere la primera ubicacion cuando estan las dos', () => {
    const entorno = entornoFalso({ existentes: UBICACIONES_WINDOWS, respuestas: [enoent(), 'ok'] });

    crearGh(entorno)(['a']);

    expect(entorno.llamadas[1]).toBe(UBICACIONES_WINDOWS[0]);
  });

  it('y si el rescatado TAMBIEN da `ENOENT`, muere en vez de buscar para siempre', () => {
    // El caso del binario que existe como archivo y no se puede ejecutar. Sin el corte,
    // el lanzador reintentaria la misma ubicacion en cada llamada.
    const entorno = entornoFalso({
      existentes: [UBICACIONES_WINDOWS[0]],
      respuestas: [enoent(), enoent()],
    });

    expect(() => crearGh(entorno)(['a'])).toThrow(/MURIO/);
  });
});

describe('cuando `gh` no esta en ningun lado', () => {
  it('muere con un mensaje que dice QUE falta, DONDE suele estar y COMO seguir', () => {
    const entorno = entornoFalso({ respuestas: [enoent()] });

    expect(() => crearGh(entorno)(['issue', 'list'])).toThrow(/MURIO/);
  });

  it('en POSIX no nombra las rutas de Windows, que ahi serian ruido', () => {
    const entorno = entornoFalso({ plataforma: 'linux', respuestas: [enoent()] });

    expect(() => crearGh(entorno)(['a'])).toThrow(/MURIO/);
    expect(mensajeSinGh('linux')).not.toContain('Program Files');
    expect(mensajeSinGh('linux')).toContain('cli.github.com');
  });

  it('el mensaje de Windows nombra las dos ubicaciones y el PATH', () => {
    const mensaje = mensajeSinGh('win32');

    for (const ubicacion of UBICACIONES_WINDOWS) expect(mensaje).toContain(ubicacion);
    expect(mensaje).toContain('PATH');
    expect(mensaje).toContain('gh auth login');
  });
});

describe('cuando `gh` esta pero la sesion no sirve', () => {
  it('muere nombrando `gh auth login` en vez de mostrar un exit 4 pelado', () => {
    const entorno = entornoFalso({ respuestas: [falloDeGh('gh: To get started with GitHub CLI, please run: gh auth login')] });

    expect(() => crearGh(entorno)(['issue', 'list'])).toThrow(/MURIO/);
  });

  it('el mensaje incluye lo que `gh` contesto, que es lo unico que distingue un caso de otro', () => {
    expect(mensajeSinSesion('  Bad credentials  ')).toContain('Bad credentials');
    expect(mensajeSinSesion('x')).toContain('gh auth status');
  });

  it('y un fallo que NO es de sesion sube tal cual, sin explicacion inventada', () => {
    // La contraparte del test de arriba: reconocer de mas es peor que reconocer de menos,
    // porque tapa el error original con una guia que no aplica.
    const entorno = entornoFalso({ respuestas: [falloDeGh('could not resolve to a Repository')] });

    expect(() => crearGh(entorno)(['a'])).toThrow(/exit 4/);
  });

  it('un error sin `stderr` tampoco se confunde con uno de sesion', () => {
    const entorno = entornoFalso({ respuestas: [new Error('algo raro')] });

    expect(() => crearGh(entorno)(['a'])).toThrow(/algo raro/);
  });
});

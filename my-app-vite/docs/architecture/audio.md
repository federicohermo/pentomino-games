# Capa de Audio

Cómo se integra Tone.js. Es la parte del código con más decisiones no obvias, y la que ya produjo un bug
real de loops huérfanos.

## Carga diferida

Tone.js **no** se importa arriba del archivo. Se carga con `import()` dinámico dentro de `ensureTone()`,
que además construye el sintetizador la primera vez:

```ts
let toneModule: ToneModule | null = null;
let synth: any = null;

async function ensureTone(){
  if (!toneModule) toneModule = await import('tone');
  if (toneModule && !synth) synth = new toneModule.PolySynth(toneModule.Synth).toDestination();
  return toneModule;
}
```

Dos motivos:

1. **Tone toca el `AudioContext` al importarse.** Cargarlo en el arranque crea un contexto suspendido
   antes de cualquier gesto del usuario, que es justo lo que las políticas de autoplay de los
   navegadores penalizan.
2. **Peso.** Tone son ~340 kB del bundle. Al ser dinámico, Vite lo separa en su propio chunk y la app
   pinta antes de bajarlo. Se ve en el output del build: dos chunks, no uno.

`ensureTone()` es idempotente y todos los caminos que necesitan audio pasan por ahí. Falla de forma
suave: si el import se cae, loguea un warning y devuelve `null`, y cada llamador debe chequearlo. **La
app sigue siendo usable sin audio** — se pueden colocar piezas, solo que no suenan.

## Singletons de módulo, no estado

`toneModule` y `synth` viven a nivel de módulo, fuera de React. No son `useState` ni `useRef`.

Es deliberado: hay **un** `AudioContext` y **un** sintetizador por pestaña, no uno por instancia del
componente. Meterlos en estado los ataría al ciclo de vida de React y en StrictMode se construirían dos
veces. Como contrapartida, sobreviven al desmontaje del componente — de ahí la limpieza explícita que se
describe abajo.

## `Tone.start()` necesita un gesto

```ts
await Tone.start();
```

En `playNotesNow`, antes de disparar. Los navegadores exigen que el `AudioContext` se reanude desde un
handler de evento originado por el usuario. Como `playNotesNow` sale del click en el tablero, la cadena
de gesto se preserva.

**Esto se rompe fácil**: si alguna vez se quiere que suene algo sin click previo —un preview al pasar el
mouse, una nota al cambiar de pieza con el teclado— el audio va a quedar en silencio hasta que el
usuario haga click en algo. No es un bug del código sino una restricción del navegador.

## Transport y tempo

```ts
function useTransport(tempo: number){
  useEffect(()=>{
    let mounted = true;
    ensureTone().then(Tone => { if (Tone && mounted) Tone.Transport.bpm.value = tempo; });
    return ()=>{ mounted = false; };
  },[tempo]);
}
```

El flag `mounted` evita escribir el BPM después de desmontar, si el import de Tone resuelve tarde.

El botón "Loop" arranca y para el Transport. **El Transport solo afecta a los loops de piezas
colocadas**: el arpegio de colocación usa `Tone.now()` y suena tenga o no el Transport corriendo.

## Reconciliación de loops

El patrón central de esta capa, y el que reemplazó al bug.

### El bug que había

El id del evento del Transport se guardaba dentro de `PlacedPiece._sched`, y se escribía **mutando el
objeto después de habérselo pasado a `setPlaced`**. Consecuencias:

- La limpieza de "Quitar" y "Reset" buscaba un id que muchas veces no estaba → loops huérfanos sonando
  para siempre.
- Apagar el checkbox no cancelaba nada de lo ya agendado.
- Encenderlo no agendaba las piezas ya colocadas.

Cada camino (colocar, quitar, resetear, togglear) tenía que acordarse de limpiar por su cuenta, y
ninguno lo hacía del todo bien.

### El patrón actual

Los ids viven en un `useRef<Map<string, number>>` —fuera del estado, porque cambiarlos no debe
re-renderizar— y **un solo efecto reconcilia** contra el tablero:

```ts
useEffect(()=>{
  let cancelled = false;
  const sched = schedRef.current;

  ensureTone().then(Tone => {
    if (!Tone || cancelled) return;
    const wanted = new Set(loopPlaced ? placed.map(p=>p.id) : []);

    for (const [pieceId, eventId] of sched){          // cancelar lo que sobra
      if (!wanted.has(pieceId)){ Tone.Transport.clear(eventId); sched.delete(pieceId); }
    }
    for (const p of placed){                          // agendar lo que falta
      if (!loopPlaced || sched.has(p.id)) continue;
      sched.set(p.id, Tone.Transport.scheduleRepeat(/* … */, "1m"));
    }
  });

  return ()=>{ cancelled = true; };
}, [placed, loopPlaced]);
```

Los cuatro caminos quedan cubiertos por la misma lógica. Colocar, quitar, resetear y togglear son todos
el mismo problema —"que el Transport refleje el tablero"— y ahora se resuelven en un solo lugar.

`PlacedPiece.id` existe para esto: identifica la pieza de forma estable, cosa que el índice del array no
hace cuando se puede borrar del medio.

### La limpieza de desmontaje es sincrónica a propósito

```ts
useEffect(()=> ()=>{
  const sched = schedRef.current;
  if (toneModule){
    for (const eventId of sched.values()) toneModule.Transport.clear(eventId);
  }
  sched.clear();
}, []);
```

Usa `toneModule` directo en vez de `await ensureTone()`. **Si fuera asincrónica, en StrictMode podría
correr después de que el efecto de reconciliación ya reagendó, y cancelaría los eventos nuevos.** React
ejecuta todas las limpiezas y después todos los efectos; una limpieza que resuelve una promesa se sale
de ese orden.

Si `toneModule` es `null` no hay nada que cancelar, porque nunca se agendó nada.

## Los dos caminos de reproducción

Hoy hay **dos** lugares que disparan notas, con lógica duplicada:

| Camino | Dónde | Referencia temporal |
|---|---|---|
| Arpegio al colocar | `playNotesNow()` | `Tone.now()` — inmediato |
| Loop por compás | callback de `scheduleRepeat` en el efecto | `time` del Transport |

Ambos usan el mismo espaciado de `0.15 s` y la misma duración `"8n"`, pero son código separado. Unificar
los dos caminos está anotado como seguimiento en el
[spec 001](../../specs/001-notas-por-celda-en-orden-angular/tasks.md) y es la razón por la que un cambio
en cómo suena una pieza hay que aplicarlo en dos lugares. **Al tocar uno, verificar el otro.**

## Cómo verificar el audio sin oírlo

Los eventos agendados son inspeccionables desde la consola del navegador en dev. Importando el mismo
módulo que sirve Vite se obtiene el singleton del Transport:

```js
const url = performance.getEntriesByType('resource')
  .map(e=>e.name).find(n=>/tone/.test(n));
const T = await import(url);
const tr = T.getTransport();

Object.values(tr._scheduledEvents)
  .filter(r => ((r.event ?? r)?.constructor?.name) === '_TransportRepeatEvent')
  .length;   // ← cuántos loops vivos hay
```

El filtro por `_TransportRepeatEvent` no es opcional: Tone crea `_TransportEvent` internos para
re-armar cada repeat, así que el conteo crudo de `_scheduledEvents` da más de lo esperado. Un loop
propio son tres entradas.

Es la técnica con la que se verificó la reconciliación (1 pieza → 1 loop; apagar → 0; "Quitar" → 0;
"Reset" → 0).

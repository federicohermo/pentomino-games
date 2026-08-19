# Research — Spec 015

Medido el 2026-08-19 sobre `main` en `c958dde`. Los timbres se midieron **renderizando offline** con
`node-web-audio-api` a 44 100 Hz, que es la misma infraestructura con la que el 011 midió su envolvente;
las estadísticas del ciclo, ejecutando `buildSequence` sobre tableros aleatorios con semilla fija.

## 1. Qué es el click hoy

`scheduleClick` en `src/audio/voice.ts`: un `AudioBufferSourceNode` de `CLICK_SECONDS` (20 ms) lleno de
`Math.random() * 2 - 1`, con `setValueAtTime(vel)` y rampa lineal a 0. Sin ataque, a propósito — el
docblock explica que la rampa le sacaría el transitorio que lo hace percusivo.

El buffer se arma **por click** y no se cachea, con dos motivos escritos: los módulos de capa no
declaran constantes, y un caché dependería del `sampleRate` del contexto, que entra por parámetro
justamente para poder renderizar offline.

Y **hoy no llama a `stop()`**, con el motivo escrito: el buffer dura exactamente `CLICK_SECONDS` y se
termina solo, así que un `stop()` en ese instante sería un segundo lugar donde vive la duración del
click. La limpieza cuelga de `src.onended`.

Con la campana esto se simplifica de un lado y se complica del otro. Se simplifica: un oscilador no
necesita buffer, así que la mitad de ese docblock —el `createBuffer`, el `sampleRate`, el "no se
cachea"— deja de aplicar y se va con el código. Se complica: **un `OscillatorNode` no se termina
solo**, así que el `stop()` pasa de innecesario a obligatorio y el argumento del docblock se da vuelta
con él. Sin `stop()` el nodo nunca dispara `onended`, los `disconnect()` no corren y quedan ~12
osciladores vivos por ciclo; y además la caída exponencial se apaga en un epsilon y no en cero, así que
los dos tests que exigen silencio **absoluto** después del click —`peakNear(..., at + CLICK_SECONDS +
0.03)` en `voice.test.ts` y en `integration.test.ts`— fallarían. El `stop()` va exactamente en
`at + CLICK_SECONDS`, que es donde `scheduleVoice` ya pone el suyo (más `RELEASE_TAIL`).

## 2. Medición de los dos timbres

Renderizado offline, mismo pico de partida (`CLICK_VELOCITY` = 0,25):

| | pico | RMS | cae 40 dB en | centroide espectral |
|---|---|---|---|---|
| **ruido 20 ms (hoy)** | 0,245 | 0,0167 | 19,6 ms | **11 260 Hz** |
| campana MIDI 96, 50 ms | 0,245 | 0,0141 | **29,5 ms** | **2 645 Hz** |
| campana MIDI 96, 80 ms | 0,246 | 0,0179 | 46,9 ms | 2 625 Hz |
| campana MIDI 93, 50 ms | 0,244 | 0,0141 | 29,4 ms | 2 290 Hz |

Dos cosas que la tabla decide:

- El centroide del ruido en 11 260 Hz no es sorpresa —el ruido blanco reparte energía hasta Nyquist—
  pero es **el número del problema**: la energía del evento vive casi dos octavas por encima del techo
  del instrumento.
- El centroide medido de la campana (2 645 Hz) queda por encima de su fundamental (2 093 Hz) porque la
  ventana de análisis incluye el transitorio de ataque. Es esperable y no cambia nada; lo que importa
  es que sea **2 kHz y no 11 kHz**.

La versión de 80 ms se descarta por el intervalo (§4) y la de MIDI 93 por el registro (§3): `A6` está a
6 semitonos del techo del instrumento, contra los 9 de `C7`.

## 3. El instrumento usa las 12 clases de altura: "fuera de la escala" no existe

```
clases de altura que el instrumento usa: 12 / 12  →  C C# D D# E F F# G G# A A# B
registro: MIDI 60 C4 261,6 Hz  ..  MIDI 87 D#6 1244,5 Hz
```

Son 12 tónicas (`BASE_MAP` asigna una clase distinta a cada pieza) por cuatro fórmulas pentatónicas,
así que el temperamento queda cubierto entero. **No hay ninguna nota libre.**

Esto tira abajo la formulación original del pedido —"altura fija, alta, fuera de la escala"— en su
segunda mitad, y es el ejemplo de por qué el `research.md` se escribe midiendo: la decisión escrita sin
medir habría sido falsa.

Lo que queda es salir del **registro**:

| candidato | | | sobre el techo |
|---|---|---|---|
| MIDI 88 | `E6` | 1 318,5 Hz | +1 semitono |
| MIDI 91 | `G6` | 1 568,0 Hz | +4 |
| MIDI 93 | `A6` | 1 760,0 Hz | +6 |
| **MIDI 96** | **`C7`** | **2 093,0 Hz** | **+9** |
| MIDI 100 | `E7` | 2 637,0 Hz | +13 |

El techo de 1 244,5 Hz **ya incluye** el corrimiento de octava que `notesForRotation` aplica cuando la
suma pasa de `B` — es la decisión que hace que las piezas de tónica alta abran más registro, así que el
número no se puede sacar de `DEFAULT_OCTAVE` a ojo.

## 4. El intervalo, y por qué 50 ms y no 80

| bpm | intervalo | la campana de 50 ms ocupa | ya cayó 40 dB al |
|---|---|---|---|
| 60 | 250,0 ms | 20 % | 12 % |
| 110 | 136,4 ms | 37 % | 22 % |
| **160** (`TEMPO_MAX`) | **93,8 ms** | **53 %** | **31 %** |

Con 80 ms, a 160 bpm la campana ocuparía el 85 % del intervalo y caería 40 dB recién al 50 %: dos
clicks consecutivos se encimarían de forma audible. Los 50 ms dejan 64 ms de aire en el peor caso.

El docblock de `CLICK_SECONDS` trae hoy la misma cuenta con los números viejos ("a 110 bpm el click
ocupa el 15 %; aun a 160 bpm ocupa el 21 %"). Se reemplaza por esta tabla.

## 5. Cuánto pesa el click en el ciclo

200 tableros aleatorios por tamaño, semilla fija, sobre `buildSequence`:

| Piezas | Notas | Clicks mudos | Cruces con altura | Ciclo (intervalos) | Clicks / eventos |
|---|---|---|---|---|---|
| 3 | 15,0 | 11,9 | 0,4 | 27,3 | **44 %** |
| 5 | 25,0 | 14,0 | 1,5 | 40,4 | **35 %** |
| 8 | 40,0 | 11,1 | 4,8 | 55,9 | **20 %** |

Dos lecturas, y las dos entran al spec:

- **Del lado del problema**: con 3 piezas casi la mitad de lo que suena es el siseo.
- **Del lado de D5**: apagarlos por default apaga esa misma mitad, y por eso el botón no se puede
  borrar.

La cantidad de clicks mudos **baja** de 5 a 8 piezas (14,0 → 11,1) mientras los cruces suben (1,5 →
4,8): con el tablero más lleno el recorrido tiene menos celdas vacías por donde pasar. Es coherente con
lo que el 011 midió.

> No se pudo generar ningún tablero de 12 piezas con la colocación aleatoria (400 intentos por
> tablero): 60 celdas y 12 pentominós es un empaquetado perfecto y el azar no lo encuentra. El `T060`
> del spec 011 —"el tablero lleno tiene que sonar mejor que hoy"— sigue siendo una verificación a mano.

## 6. Los tres eventos del motor, y cuál toca este spec

Desde el 011 el motor agenda tres clases y **el botón gobierna una sola**:

| Evento | Qué es | Amplitud | ¿Lo apaga el botón? |
|---|---|---|---|
| Nota de pieza | el arpegio | `DEFAULT_VELOCITY` 0,8 | no |
| Cruce por celda ocupada | la nota de la celda pisada (D5 del 011) | `GRACE_VELOCITY` 0,45 | **no** — es modelo, no mezcla (D6 del 011) |
| **Click mudo** | celda vacía pisada por el recorrido | `CLICK_VELOCITY` 0,25 | **sí** |

En `engine.ts`:

```ts
// Y no lo mira `clicksAudible`, que apaga solo la rama muda (D6).
...
else if (clicksAudible) scheduleClick(c, master, hit.at);
```

O sea que el punto de cambio es **una sola llamada** y `GRACE_*` no se toca (D8, AC10).

Y con el spec 014 puesto, esa misma rama es la que suena por una **pieza muteada**: sus celdas emiten
`Click` sin `note`, que es exactamente este caso. No hace falta código para AC11.

## 7. La etiqueta del botón

Hoy: `Clicks mudos` con `ON`/`OFF`, `ON` = se oyen. La composición ya era difícil —un click *mudo*
*encendido*— y con el default en `OFF` lo primero que se ve es un apagado ambiguo.

El comentario que la justifica está en `PiecePalette.tsx` y explica que dice "mudos" y no "Clicks" a
secas desde el 011, porque el recorrido pasó a tener dos clases de cruce y el botón apaga una sola.
Ese motivo **sigue valiendo**: la etiqueta nueva tiene que seguir sin prometer que apaga el cruce.

Restricción medida: la fila vive en la tarjeta de la paleta, que con el 014 pasa a 349,3 px de interior
(era 252). Hay más lugar que antes, así que la etiqueta puede ser más larga — pero conviene medirla
igual, porque el 016 va a meter 12 miniaturas en esa misma tarjeta.

## 8. Archivos que toca

| Archivo | Qué |
|---|---|
| `src/audio/voice.ts` | `scheduleClick` deja de armar un buffer y pasa a oscilador (§1) |
| `src/audio/constants/voice.constants.ts` | `CLICK_SECONDS` 0,02 → 0,05 y la altura nueva, con sus docblocks |
| `src/audio/__tests__/voice.test.ts` | AC5 y **AC15**: el test que hoy afirma que el click *no tiene altura* pasa a afirmar la contraria (con `zeroCrossHz`, el helper que ya existe), y el que exige silencio absoluto se conserva — es el que obliga al `stop()` (§1) |
| `src/audio/__tests__/integration.test.ts` | AC15: su comentario dice "50 ms despues ya es silencio" contando `CLICK_SECONDS + 0,03`. Con 50 ms el número pasa a 80 |
| `src/audio/engine.ts` | AC6: `let clicksAudible = true` es el **segundo** default. Y AC9: la rama del despacho es donde va escrito por qué no hay acento |
| `src/App.tsx` | El default de `clicks` a `false`, y el comentario que hoy argumenta lo contrario |
| `src/components/PiecePalette.tsx` | La etiqueta (§7) |
| `specs/011-.../tasks.md` | `T070` cerrado con "no" y su motivo (AC7) |
| `docs/architecture/audio.md`, `docs/architecture/modelo-musical.md`, `DESIGN.md` | AC14. `modelo-musical.md` afirma en presente que sobre celda vacía "suena un click sin altura", y `audio.md` lo repite en tres lugares además de llamar «Clicks» al toggle |

**No se toca** `domain/`: el click ya existe en el modelo desde el 009 y este spec sólo cambia cómo
suena.

**Y no cruza el borde de paquete.** `mcp-server/` importa un solo símbolo de `audio/` —`midiToHz`, en
`tools/simulateBoard.ts`— y este spec no le toca la firma: `scheduleClick`, `CLICK_SECONDS` y
`CLICK_MIDI` no los ve nadie fuera de `src/audio/`. Verificado, no supuesto.

# Línea base — el sonido de hoy, para comparar contra el de después

Generada con el repo **antes** de la rama del 008 (`4c74d10`), corriendo `simulate_board` sobre un
tablero fijo. Es contra esto que se compara al cerrar el PR: AC3 dice que a 100 bpm los onsets tienen
que caer en los mismos instantes.

**El tablero**, tres piezas en columnas distintas — que es lo que hace visible la fase del spec 004:

```json
[{ "piece": "F", "at": [1, 1] }, { "piece": "L", "at": [5, 1] }, { "piece": "Z", "at": [7, 4] }]
```

Columnas de agarre 1 · 5 · 7, o sea fases **0,1 · 0,5 · 0,7**. Las tres válidas. `bars: 2`.

> Ojo al reproducirlo: `Z` en `[7, 4]` y no en `[8, 4]`. La celda de agarre no es la esquina, y con
> ancla en 8 la pieza se va del tablero (`fuera-del-tablero`) — no suena y el baseline sale con dos
> piezas en vez de tres.

---

## 100 bpm — lo que AC3 tiene que dejar idéntico

`barSeconds: 2.4` · **30 onsets en 30 instantes** · `maxPerInstant: 1`

```
0.29 C4    0.44 D4    0.59 E4    0.74 G4    0.89 A4      ← F, fase 0.1
1.25 D4    1.40 E4    1.55 F#4   1.70 A4    1.85 B4      ← L, fase 0.5
1.73 B4    1.88 C#5   2.03 D#5   2.18 F#5   2.33 G#5     ← Z, fase 0.7
2.69 C4    2.84 D4    2.99 E4    3.14 G4    3.29 A4
3.65 D4    3.80 E4    3.95 F#4   4.10 A4    4.25 B4
4.13 B4    4.28 C#5   4.43 D#5   4.58 F#5   4.73 G#5
```

Espaciado dentro de cada arpegio: **0,15 s**, que es la semicorchea de 100 bpm. Por eso este tempo es
el que no se mueve.

## 160 bpm — lo que el spec viene a arreglar

`barSeconds: 1.5` · **30 onsets en 21 instantes** · `coincident.instants: 9` · `maxPerInstant: 2`

```
0.20 C4    0.35 D4    0.50 E4    0.65 G4    0.80 A4+D4
0.95 E4    1.10 F#4+B4    1.25 A4+C#5    1.40 B4+D#5    1.55 F#5
1.70 C4+G#5    1.85 D4    2.00 E4    2.15 G4    2.30 A4+D4
2.45 E4    2.60 F#4+B4    2.75 A4+C#5    2.90 B4+D#5    3.05 F#5    3.20 G#5
```

**Acá está el problema medido, y es peor que "el arpegio no se estira".** El arpegio sigue durando
0,6 s mientras el compás baja de 2,4 s a 1,5 s, así que las piezas se comen unas a otras: nueve
instantes pasan a tener dos notas y los 30 onsets colapsan en 21. Subir el tempo no acelera el
instrumento, lo **espesa** — que es justo lo contrario de lo que uno espera al mover un tempo, y es la
misma observación que motivó al spec 004 desde el otro lado.

---

## Lo que tiene que dar después, y por qué es falsable

Dos piezas comparten un instante solo si pasan **las dos** cosas, y conviene no mezclarlas:

1. **Que los arpegios se solapen.** Después del cambio el arpegio mide `4 × intervalo = compás / 4`, y
   la distancia entre dos piezas es `Δfase × compás`. Hay solapamiento si `Δfase < 0,25`, o sea a **1 o
   2 columnas** de distancia. El compás se cancela: **deja de depender del tempo**.
2. **Que además los onsets caigan encima.** Medida en intervalos, la distancia es
   `(Δfase × compás) / (compás / 16) = Δfase × 16`, que con 10 columnas da `1,6 × (columnas)`. Para las
   únicas dos distancias que solapan da **1,6 y 3,2**: ninguna entera.

De las dos juntas sale la predicción fuerte, y es más limpia de lo que parecía: **después del cambio,
dos piezas en columnas distintas no comparten un onset nunca, a ningún tempo.** `maxPerInstant` vuelve
a 1 y se queda ahí. Apilarse queda reservado para la misma columna (`Δfase = 0`), que es exactamente lo
que el 004 quiso decir con que el eje X es tiempo.

Para este tablero, entonces:

| | hoy | después |
|---|---|---|
| 100 bpm | 30 onsets / 30 instantes / max 1 | **igual, instante por instante** (AC3) |
| 160 bpm | 30 onsets / **21** instantes / max **2** | **30 / 30 / max 1** |

La segunda fila es lo que convierte a AC4 en algo que se mide en vez de escucharse: si después del
cambio 160 bpm sigue dando 21 instantes, el arpegio no se comprimió. Y si a 100 bpm cambia **algo**, se
rompió AC3.

> **Lo que hoy decide el choque es el reloj, y se puede ver.** Con `F` en `[1,1]` y `L` en `[6,1]`
> —5 columnas, `Δfase = 0,5`— hoy la razón en intervalos es `0,5 × compás / 0,15`, que **sí** depende
> del bpm: da 8 a 100 y 5 a 160, las dos enteras, pero 7,27 a 110. Medido, ninguna de las tres se apila
> igual, porque a esa distancia los arpegios ni siquiera llegan a tocarse (0,6 s de arpegio contra
> 1,2 s de separación a 100 bpm): 10 onsets en 10 instantes. Es el caso que muestra que la condición 1
> manda sobre la 2 — y por qué el número que hay que mirar al comparar es `distinctInstants`, no la
> aritmética.

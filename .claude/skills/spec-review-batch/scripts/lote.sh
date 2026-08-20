#!/usr/bin/env sh
# Insumo del Paso 2 de spec-review-batch: de que se agarra un spec del lote y que le mueve otro.
#
# Uso, desde la raiz del repo:
#   .claude/skills/spec-review-batch/scripts/lote.sh 018 019 020 021
#
# Emite tres bloques, y ninguno es una conclusion:
#
#   1. matriz archivo x spec   — que archivo tocan dos o mas specs. Dice donde mirar, nada mas:
#                                dos specs en regiones lejanas del mismo archivo no se contradicen.
#   2. tareas que lo citan     — las lineas, con numero, de cada archivo compartido. Es lo que
#                                decide si los dos specs escriben la misma funcion o no, y es
#                                tambien donde se ve si el de abajo cita una linea que el de
#                                arriba reescribe: esa cita esta podrida por construccion.
#   3. numeros que un spec mueve — cada `X -> Y` de cada tasks.md. Cruzar los Y de un spec contra
#                                los X del resto es la unica forma de cazar la arista que no tiene
#                                import que la delate: dos specs que mueven la misma constante y
#                                el de abajo partiendo del valor de main en vez del que le dejan.
#
# Lo que NO hace, a proposito: decidir. Filtrar las menciones que vienen de tareas de
# documentacion, o los `X -> Y` que son pares de una tabla y no una constante, depende del verbo
# de la tarea — y un script que lo adivine se equivoca en silencio.
set -eu

[ $# -ge 2 ] || { echo "uso: $(basename "$0") NNN MMM [NNN...]" >&2; exit 2; }

dir_de() {
  d=$(find specs -maxdepth 1 -type d -name "$1-*" | head -1)
  [ -n "$d" ] || { echo "no hay spec $1 en specs/" >&2; exit 1; }
  printf '%s' "$d"
}

pares=$(mktemp)
trap 'rm -f "$pares"' EXIT

# Basename a proposito: los tasks.md citan el mismo archivo como `src/domain/sequence.ts`
# y como `sequence.ts`, y contarlos aparte parte una colision en dos.
for n in "$@"; do
  # El `[A-Za-z0-9_-]` antes del punto descarta las menciones a la extension suelta
  # («los `.ts` de la capa»), que si no entran a la matriz como un archivo llamado «.ts».
  # Los .md entran a la matriz —dos specs que reescriben el mismo doc es un cruce— salvo los
  # cuatro archivos que todo spec tiene adentro de su carpeta, que citados sin ruta son suyos.
  grep -o '`[^`]*[A-Za-z0-9_-]\.\(ts\|tsx\|css\|json\|md\)`' "$(dir_de "$n")/tasks.md" \
    | tr -d '`' | sed 's|.*/||' \
    | grep -vx '\(spec\|research\|plan\|tasks\|README\)\.md' \
    | sort -u | sed "s|^|$n |"
done > "$pares"

echo "== matriz archivo x spec =="
awk '{ m[$2] = m[$2] " " $1; c[$2]++ }
     END { for (f in m) printf "%-30s%s%s\n", f, m[f], (c[f] > 1 ? "   <- compartido" : "") }' \
  "$pares" | sort

echo
echo "== tareas que citan cada archivo compartido =="
awk '{ c[$2]++ } END { for (f in c) if (c[f] > 1) print f }' "$pares" | sort | while read -r f; do
  echo "--- $f"
  for n in "$@"; do
    grep -nF "$f" "$(dir_de "$n")/tasks.md" | sed "s|^|  $n:|" || true
  done
done

echo
echo "== numeros que un spec mueve (cruzar los Y contra los X del resto) =="
for n in "$@"; do
  grep -nE '[0-9]+([,.][0-9]+)?[ ]*→[ ]*[*`]*[0-9]+([,.][0-9]+)?' "$(dir_de "$n")/tasks.md" \
    | cut -c1-160 | sed "s|^|  $n:|" || true
done

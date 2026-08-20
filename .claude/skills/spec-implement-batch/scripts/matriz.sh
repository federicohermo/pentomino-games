#!/usr/bin/env sh
# Matriz archivo x spec — insumo del Paso 1 de spec-implement-batch.
#
# Uso, desde la raiz del repo — las tres formas, igual que `lote.sh`:
#   .claude/skills/spec-implement-batch/scripts/matriz.sh 013 014 015 016 017
#   .claude/skills/spec-implement-batch/scripts/matriz.sh 013-017
#   .claude/skills/spec-implement-batch/scripts/matriz.sh --propuestos
#
# El SKILL.md lo INYECTA con !`... $ARGUMENTS`: la matriz llega con el skill ya cargado, sin
# gastar un turno de tool en pedirla.
#
# Emite dos bloques, y el segundo es el que importa: la matriz sola dice QUE archivo
# comparten dos specs, y eso no alcanza para decidir arista o conflicto. Para eso hay que
# leer las tareas que lo citan —con su numero de linea— y ver si tocan la misma funcion o
# regiones lejanas. El script las junta para no volver a buscarlas una por una.
#
# Lo que NO hace, a proposito: filtrar las menciones que vienen de tareas de documentacion.
# Eso lo decide el verbo de la tarea, y un script que lo adivine se equivoca en silencio.
set -eu

# Entiende las mismas tres formas que `lote.sh` de spec-review-batch, y por el mismo motivo:
# el SKILL.md lo INYECTA con !`matriz.sh $ARGUMENTS`, asi que recibe crudo lo que el usuario
# tipeo. Con el guard viejo —numeros sueltos y nada mas— `013-017` y `--propuestos` salian por
# `exit 2`, o sea que la inyeccion habria andado en una de tres formas y fallado en las otras.
#
# Los flags del skill (`--dry`) se ignoran en vez de rechazarse: vienen pegados en $ARGUMENTS.
expandir() {
  for a in "$@"; do
    case "$a" in
      --dry|--carriles|--serie) ;;
      --propuestos)
        # La tabla de log.md, columna de estado. Misma fuente que lee `spec_status`.
        sed -n 's/^| \[\([0-9][0-9][0-9]\)\](.*|[ ]*Propuesto[ ]*|.*/\1/p' specs/log.md ;;
      [0-9][0-9][0-9]-[0-9][0-9][0-9])
        # Los ceros a la izquierda se sacan antes del `-le`: `013` es octal invalido para la
        # aritmetica de shell y el rango moriria con un error que no dice eso.
        lo=$(printf '%s' "${a%-*}" | sed 's/^0*//; s/^$/0/')
        hi=$(printf '%s' "${a#*-}" | sed 's/^0*//; s/^$/0/')
        n=$lo; while [ "$n" -le "$hi" ]; do printf '%03d\n' "$n"; n=$((n + 1)); done ;;
      [0-9][0-9][0-9]) printf '%s\n' "$a" ;;
      *) echo "argumento no reconocido: $a" >&2; exit 2 ;;
    esac
  done
}

# shellcheck disable=SC2046 # el split por whitespace es lo que convierte las lineas en argumentos
set -- $(expandir "$@" | sort -u)

[ $# -ge 2 ] || { echo "uso: $(basename "$0") <NNN NNN ...> | <NNN-MMM> | --propuestos" >&2; exit 2; }

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
  grep -o '`[^`]*[A-Za-z0-9_-]\.\(ts\|tsx\|css\|json\)`' "$(dir_de "$n")/tasks.md" \
    | tr -d '`' | sed 's|.*/||' | sort -u | sed "s|^|$n |"
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

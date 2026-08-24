#!/usr/bin/env sh
# Insumo del Paso 2 de spec-review-batch: de que se agarra un spec del lote y que le mueve otro.
#
# Uso, desde la raiz del repo — las mismas tres formas que el `argument-hint` del skill:
#   .claude/skills/spec-review-batch/scripts/lote.sh 018 019 020 021
#   .claude/skills/spec-review-batch/scripts/lote.sh 018-021
#   .claude/skills/spec-review-batch/scripts/lote.sh --propuestos
#
# El SKILL.md lo INYECTA con !`... $ARGUMENTS`, asi que su salida llega con el skill ya
# cargado y no cuesta un turno de tool. Por eso entiende las tres formas: recibe crudo lo
# que el usuario tipeo.
#
# Emite dos bloques, y ninguno es una conclusion:
#
#   1. matriz archivo x spec   — que archivo tocan dos o mas specs. Dice donde mirar, nada mas:
#                                dos specs en regiones lejanas del mismo archivo no se contradicen.
#   2. tareas que lo citan     — las lineas, con numero, de cada archivo compartido. Es lo que
#                                decide si los dos specs escriben la misma funcion o no, y es
#                                tambien donde se ve si el de abajo cita una linea que el de
#                                arriba reescribe: esa cita esta podrida por construccion.
#
# Habia un tercero —los `X -> Y` de cada tasks.md— y lo saco el spec 033: eso ahora lo devuelve
# `spec_status` en `cruces`, ya pareado y con la tarea al lado. Dos fuentes del mismo dato con
# regex distintos es la forma de que el SKILL.md diga una cosa y el agente lea otra, que es
# exactamente lo que paso hasta este review: el skill ya decia que los cruces salen de la tool y
# el script los seguia emitiendo.
#
# Lo que NO hace, a proposito: decidir. Filtrar las menciones que vienen de tareas de
# documentacion depende del verbo de la tarea — y un script que lo adivine se equivoca en silencio.
set -eu

# Entiende las TRES formas del `argument-hint` del skill, no solo los numeros sueltos, y esa
# paridad es lo que deja que el SKILL.md lo inyecte con !`lote.sh $ARGUMENTS` sin un caso
# especial: lo que el usuario tipea es lo que el script recibe. Con el guard viejo
# —numeros sueltos y nada mas— `018-021` y `--propuestos` salian por `exit 2`, o sea que la
# inyeccion habria funcionado en una de las tres formas y fallado en silencio en las otras dos.
#
# `--dry` se ignora en vez de rechazarse: es un flag del SKILL, no del script, y viene pegado
# en el mismo $ARGUMENTS.
expandir() {
  for a in "$@"; do
    case "$a" in
      --dry) ;;
      --propuestos)
        # La tabla de log.md, columna de estado. Es la misma fuente que lee `spec_status`.
        sed -n 's/^| \[\([0-9][0-9][0-9]\)\](.*|[ ]*Propuesto[ ]*|.*/\1/p' specs/log.md ;;
      [0-9][0-9][0-9]-[0-9][0-9][0-9])
        # Los ceros a la izquierda se sacan antes del `-le`: `018` es octal invalido para la
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
  # Desde el spec 034 los specs viven en issues y `specs/[0-9]*/` esta en el
  # .gitignore, asi que la causa mas probable de que no este NO es que el spec no
  # exista: es que este checkout no lo hidrato todavia. El mensaje lo dice, porque
  # "no hay spec 021" manda a buscar el error en el lugar equivocado.
  [ -n "$d" ] || {
    echo "no hay spec $1 en specs/." >&2
    echo "  Si el spec existe, falta hidratarlo en este checkout:" >&2
    echo "    node .claude/scripts/hidratar-specs.mjs $1" >&2
    exit 1
  }
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

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

# Los scripts que este skill usa viven ADENTRO del skill, y la ruta sale de `$0` y no de
# la raiz del repo: asi el skill se puede mover o copiar sin que quede nada colgando.
AQUI=$(dirname "$0")

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
        # El estado sale de `specs/mapa.json`, que es la misma fuente que lee
        # `spec_status`. Es node y no `sed` a proposito: `sed` sobre JSON ata la
        # busqueda al formato del archivo, y el dia que alguien lo reformatee la
        # respuesta pasa a ser vacia sin un solo error — un lote de cero specs que
        # se lee como «no hay nada Propuesto». `jq` se descarto: no esta en el PATH.
        #
        # El `||` no es decorativo, y cierra un fallo en verde: el script grita cuando el
        # mapa no se puede leer, pero ese grito viajaba adentro de una sustitucion —ver
        # el `lista=` de mas abajo— y el lote seguia con CERO specs, que sale por el
        # `uso:` como si el usuario hubiera tipeado mal.
        node "$AQUI/specs-por-estado.mjs" Propuesto || {
          echo "no se pudo leer specs/mapa.json: $AQUI/specs-por-estado.mjs fallo." >&2
          echo "  node en uso: $(node --version 2>/dev/null || echo 'no esta en el PATH')" >&2
          exit 3
        } ;;
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

# La salida se captura ANTES del `set --`, y esa linea es un arreglo. `set -- $(expandir …)`
# toma como exit status el de `set`, que es 0 pase lo que pase: con `set -eu` puesto, un
# `exit 2` de `expandir` —un argumento no reconocido— o un `node` que muere se tragaban
# enteros, y el lote seguia con CERO specs. Eso salia por el `uso:` de abajo, o sea culpando
# al usuario de haber tipeado mal justo cuando lo que fallo fue otra cosa.
#
# El `| sort -u` tambien se movio, y por lo mismo: en un pipeline el status es el del ULTIMO
# comando —`sort`, que siempre anda— y `sh` de POSIX no tiene `pipefail`.
lista=$(expandir "$@") || exit $?
[ -n "$lista" ] || {
  echo "el lote quedo vacio: ningun spec coincide con «$*»." >&2
  echo "  Con --propuestos, quiere decir que specs/mapa.json no tiene ninguno en ese estado." >&2
  exit 2
}

# shellcheck disable=SC2046 # el split por whitespace es lo que convierte las lineas en argumentos
set -- $(printf '%s\n' "$lista" | sort -u)

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

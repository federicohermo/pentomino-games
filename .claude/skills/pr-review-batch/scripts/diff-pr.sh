#!/usr/bin/env sh
# Materializa el diff de UN PR y mide que ejes se revisan. Corre adentro del worktree del
# agente, ya parado en la cabeza del PR.
#
# Uso, desde la raiz del worktree:
#   .claude/skills/pr-review-batch/scripts/diff-pr.sh <rama-base> <dir-salida> [<rama-head>]
#
# El tercer argumento es opcional y por defecto es HEAD. Existe para que el PADRE pueda medir
# un PR sin checkout —cuantas lineas, que ejes, si es apilado— y decidir con eso el ancho del
# abanico. Un agente adentro de su worktree lo omite.
#
# La rama base es el `base.ref` del PR, NO `main`. En este repo las ramas se apilan —medido en
# la corrida del 2026-08-21: 025 <- 027 <- 026, tres PR abiertos a la vez sobre la misma
# cadena— y diffear contra main mete decenas de commits ajenos. Ese es el error que este script
# existe para hacer imposible: la base entra como argumento y no hay default.
#
# Emite los cinco archivos del diff, el gate de ejes y un bloque propio de este repo
# (afirmaciones numericas). El --stat y las listas partidas existen para triagear SIN leer el
# diff: leer 900 lineas para descubrir que 500 son markdown es el gasto mas caro del pipeline.
set -u

base="${1:?falta la rama base (base.ref del PR, no main)}"
out="${2:?falta el directorio de salida}"
head="${3:-HEAD}"

mkdir -p "$out" || exit 1

git fetch origin --quiet 2>/dev/null || echo "WARN: git fetch fallo; se usa el estado local" >&2

ref="origin/$base"
git rev-parse --verify --quiet "$ref" >/dev/null 2>&1 || ref="$base"
git rev-parse --verify --quiet "$ref" >/dev/null 2>&1 || {
  echo "ABORT: no existe ni '$base' ni 'origin/$base'" >&2; exit 1; }

git rev-parse --verify --quiet "$head" >/dev/null 2>&1 || {
  echo "ABORT: no existe la rama head '$head'" >&2; exit 1; }

mb=$(git merge-base "$ref" "$head") || { echo "ABORT: sin merge-base contra $ref" >&2; exit 1; }

# Excluir generados es gratis y saca casi todo el volumen. `pnpm-lock.yaml` esta por nombre
# ademas del patron: es el archivo mas grande del repo y el que menos se revisa.
diffear() {
  git diff "$@" "$mb..$head" -- . \
    ':(exclude)pnpm-lock.yaml' ':(exclude)*.lock' ':(exclude)*-lock.json' \
    ':(exclude)*.snap' ':(exclude)dist/*' ':(exclude)coverage/*' \
    ':(exclude)**/__screenshots__/*' ':(exclude)*.min.*'
}

diffear                > "$out/pr.diff"  || exit 1
diffear --name-only    > "$out/pr.files" || exit 1
diffear --stat         > "$out/pr.stat"  || exit 1

# Partir codigo de prosa: en este repo es el corte que mas rinde. En la corrida medida, 17 de
# 21 hallazgos fueron prosa que dejo de ser cierta, no codigo roto.
grep -E '\.(md|txt)$'  "$out/pr.files" > "$out/pr.docs" 2>/dev/null || true
grep -vE '\.(md|txt)$' "$out/pr.files" > "$out/pr.code" 2>/dev/null || true

n() { wc -l < "$1" | tr -d ' '; }
c() { grep -cE "$1" "$out/pr.diff" 2>/dev/null || true; }

lineas=$(n "$out/pr.diff")

echo "base_ref=$ref"
echo "head_ref=$head"
echo "merge_base=$mb"
echo "diff_path=$out/pr.diff"
echo "stat_path=$out/pr.stat"
echo "files_path=$out/pr.files"
echo "code_files_path=$out/pr.code"
echo "doc_files_path=$out/pr.docs"
echo "diff_lines=$lineas"
echo "files_changed=$(n "$out/pr.files")"
echo "code_files=$(n "$out/pr.code")"
echo "doc_files=$(n "$out/pr.docs")"

if [ "$lineas" -gt 1500 ]; then
  echo "diff_size=grande"
  echo "WARN: > 1500 lineas — NO lo leas entero. Triagea con el stat y lee por archivo" >&2
else
  echo "diff_size=ok"
fi

errores=$(c '^\+.*(catch[[:space:]]*[({]|\.catch\(|onError)')
tipos=$(c '^\+[[:space:]]*(export )?(interface |type [A-Za-z_][A-Za-z0-9_]* =|z\.object)')
coment=$(c '^\+[[:space:]]*(//|/\*|\*[[:space:]])')
mds=$(n "$out/pr.docs")

echo
echo "== ejes (umbral medido al lado; un eje en 'no' NO se revisa) =="
echo "correctness+convenciones : SI (siempre)"
if [ "$errores" -ge 3 ]; then echo "manejo de errores        : SI  ($errores catch/onError, umbral 3)"
else                          echo "manejo de errores        : no  ($errores catch/onError, umbral 3)"; fi
if [ "$tipos" -ge 2 ];   then echo "tipos                    : SI  ($tipos tipos, umbral 2)"
else                          echo "tipos                    : no  ($tipos tipos, umbral 2)"; fi
if [ "$coment" -ge 5 ] || [ "$mds" -ge 1 ]; then
  echo "prosa (docs+comentarios) : SI  ($coment lineas de comentario, $mds archivos .md)"
else
  echo "prosa (docs+comentarios) : no  ($coment lineas de comentario, $mds archivos .md)"; fi

echo
echo "== afirmaciones numericas que el diff AGREGA =="
# El eje mas productivo de este repo, y el unico que ningun grep generico levanta: una linea de
# prosa o de comentario con un numero adentro es una afirmacion falsable — un umbral, un
# conteo de archivos, una medicion de segundos. Este bloque no dice cual esta mal: dice cuales
# hay que cruzar contra el spec del PR, que es donde suele estar el numero corregido.
awk '
  /^\+\+\+ b\// { f = substr($0, 7); next }
  /^\+\+\+/ || /^\+\+/ { next }
  /^\+/ {
    l = substr($0, 2)
    doc = (f ~ /\.(md|txt)$/)
    com = (l ~ /^[ \t]*(\/\/|\/\*|\*[^\/])/)
    if ((doc || com) && l ~ /[0-9]/ && l !~ /^[ \t]*[|:# -]*$/) {
      total++
      if (total <= 60) printf "%s: %s\n", f, substr(l, 1, 150)
    }
  }
  END {
    if (total == 0) print "  (ninguna)"
    else if (total > 60) printf "  ... y %d mas (grepea el resto vos)\n", total - 60
  }' "$out/pr.diff"

echo
echo "-- pr.stat --"
cat "$out/pr.stat"

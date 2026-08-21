#!/usr/bin/env sh
# Destruye los worktrees de los carriles al cerrar `spec-implement-batch`.
#
# Uso, desde la raiz del repo:
#   .claude/skills/spec-implement-batch/scripts/limpiar-worktrees.sh --todos
#   .claude/skills/spec-implement-batch/scripts/limpiar-worktrees.sh <ruta> [<ruta> ...]
#
# Copia especializada de `.claude/scripts/limpiar-worktrees.sh`. Lo propio de este skill es que
# **sus carriles corren la app**: el Paso 3 pide medir en el DOM, asi que cada worktree termina
# con un `vite` y su `esbuild` vivos. O sea que aca el proceso vivo es LO ESPERADO, no una
# anomalia, y es la razon por la que la destruccion fallaba: en Windows un handle abierto hace
# fallar tambien el borrado crudo, no solo el `git worktree remove`.
#
# DOS PASADAS DE MATANZA, y esa es la diferencia con la version general. Un dev server es un
# arbol: `pnpm` lanza `vite`, `vite` lanza `esbuild`. Matar el padre deja huerfanos que siguen
# sosteniendo el handle unos milisegundos o directamente sobreviven, asi que la primera pasada
# no alcanza. La segunda corre despues de una espera corta y barre lo que quedo.
#
# LA OTRA CAUSA, la que le pasa a todo worktree: `node_modules` esta en .gitignore, asi que
# `git worktree remove` borra lo trackeado y el `.git` pero el directorio no queda vacio y el
# borrado final tira `Directory not empty`. `--force` no ayuda. Git IGUAL saca la metadata.
#
# Tres cosas que NO se tocan sin volver a medir, las tres se descubrieron fallando en verde:
#
#   - El filtro matchea la RUTA DEL WORKTREE, nunca el nombre del proceso. En esta maquina hay
#     un `pnpm dev --port 5199` sobre el checkout PRINCIPAL, y un filtro por `node.exe` o por
#     `vite` se lo llevaria puesto. Es exactamente el accidente que este skill puede causar.
#   - Y matchea tambien por `ExecutablePath`, no solo por linea de comando: el `esbuild.exe` que
#     bloquea el borrado corre desde el `node_modules` del worktree y su linea de comando puede
#     traer la ruta relativa, asi que por cmdline no aparece.
#   - Y excluye el propio arbol de procesos, porque la linea de comando del `bash.exe` que corre
#     este script contiene la ruta del worktree: sin eso el script se mata solo.
#
# Ninguna conversion de ruta del lado del shell: un `sed 's|/|\\|g'` da una barra sola tipeado
# en una terminal y DOS adentro de un archivo. La conversion la hace PowerShell con .Replace().
set -u

[ $# -ge 1 ] || { echo "uso: $(basename "$0") --todos | <ruta-del-worktree> [...]" >&2; exit 2; }

principal=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "ABORT: no es un repo git" >&2; exit 1; }

if [ "${1:-}" = "--todos" ]; then
  # shellcheck disable=SC2046 # el split por lineas es lo que los convierte en argumentos
  set -- $(git worktree list --porcelain | sed -n 's/^worktree //p' | grep -vxF "$principal")
  [ $# -ge 1 ] || { echo "no hay worktrees de carril para limpiar"; exit 0; }
fi

# Una pasada de matanza sobre un worktree. Se llama dos veces por el arbol del dev server.
matar() {
  powershell -NoProfile -NonInteractive -Command "
    \$ErrorActionPreference='SilentlyContinue'
    \$a = '$1'
    \$pats = @(\$a, \$a.Replace('/','\\'))
    \$todos = Get-CimInstance Win32_Process
    \$mios = @(); \$p = \$PID
    while (\$p -and (\$mios -notcontains \$p)) {
      \$mios += \$p
      \$pr = \$todos | Where-Object { \$_.ProcessId -eq \$p }
      if (-not \$pr) { break }
      \$p = \$pr.ParentProcessId
    }
    \$todos |
      Where-Object { \$mios -notcontains \$_.ProcessId } |
      Where-Object {
        \$c = \$_.CommandLine; \$e = \$_.ExecutablePath
        (\$c -and (\$pats | Where-Object { \$c.Contains(\$_) })) -or
        (\$e -and (\$pats | Where-Object { \$e.StartsWith(\$_) }))
      } |
      ForEach-Object {
        Write-Output ('   matando PID ' + \$_.ProcessId + ' - ' + \$_.Name)
        Stop-Process -Id \$_.ProcessId -Force
      }
  " 2>/dev/null
}

padre=$(dirname "$1")
fallo=0

for wt in "$@"; do
  echo "== $wt"

  # `pwd -W` y no `pwd`: git-bash devuelve `/d/Usuarios/...`, que no matchea ni el `D:/...` de
  # `git rev-parse --show-toplevel` ni el `D:\Usuarios\...` de `ExecutablePath`.
  abs=$(cd "$wt" 2>/dev/null && pwd -W 2>/dev/null) || abs=""
  [ -n "$abs" ] || { echo "   no existe: nada que hacer"; continue; }

  case "$abs" in
    "$principal"|"$principal"/) echo "   SALTEADO: es el checkout principal" >&2; fallo=1; continue ;;
  esac

  # El orden importa: primero matar y despues desregistrar. Al reves —como hace la version
  # general— tambien funciona, pero aca el dev server esta escribiendo en el arbol mientras git
  # lo borra, y eso deja el worktree a medio sacar.
  matar "$abs"
  sleep 2
  matar "$abs"

  if git worktree remove --force "$wt" >/dev/null 2>&1; then
    echo "   git worktree remove: ok"
  else
    echo "   git worktree remove: fallo (esperado, corrio pnpm install) - sigo"
  fi

  rm -rf "$wt" 2>/dev/null

  # Un reintento: `Stop-Process` vuelve enseguida pero Windows tarda en soltar el handle del
  # `.exe`, y sin esto el borrado corre contra un archivo todavia bloqueado. Dos fallos seguidos
  # ya no son timing: es algo que el filtro no ve.
  [ -d "$wt" ] && { sleep 2; rm -rf "$wt" 2>/dev/null; }

  if [ -d "$wt" ]; then
    echo "   SIGUE AHI. Algo tiene un handle abierto que el filtro no ve - tipicamente el IDE" >&2
    echo "   con la carpeta abierta, o un navegador de Playwright. Cerralo y repeti." >&2
    fallo=1
  else
    echo "   borrado"
  fi
done

# El padre vacio tambien se va: `.claude/worktrees/` sin nada adentro sigue apareciendo como
# carpeta en el IDE, que es la unica senal que ve el usuario. `rmdir` falla solo si quedo algo,
# asi que no hace falta preguntar. El padre se calcula ANTES del loop: `$abs` es de la ultima
# vuelta y podria ser de otro directorio.
rmdir "$padre" 2>/dev/null || true

echo
git worktree prune -v
echo
echo "-- quedan registrados --"
git worktree list

exit "$fallo"

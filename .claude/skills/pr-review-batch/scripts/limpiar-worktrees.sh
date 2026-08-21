#!/usr/bin/env sh
# Destruye los worktrees del lote al cerrar `pr-review-batch`.
#
# Uso, desde la raiz del repo:
#   .claude/skills/pr-review-batch/scripts/limpiar-worktrees.sh --todos
#   .claude/skills/pr-review-batch/scripts/limpiar-worktrees.sh <ruta> [<ruta> ...]
#
# Copia especializada de `.claude/scripts/limpiar-worktrees.sh`. Lo propio de este skill:
# **un review nunca levanta la app**, asi que aca la cuenta esperada de procesos vivos adentro
# de un worktree es CERO. Si mata alguno, no es rutina: es que un agente se dejo algo corriendo
# o que el IDE tiene la carpeta abierta, y eso va al reporte del Paso 5.
# El script lo dice explicito en vez de tragarselo, que es la diferencia con la version general.
#
# LA CAUSA QUE SI ES RUTINA ACA: `node_modules` esta en .gitignore, asi que `git worktree
# remove` borra lo trackeado y el `.git` pero el directorio no queda vacio y el borrado final
# tira `Directory not empty`. `--force` no ayuda —no es un problema de cambios sin commitear— y
# le pasa a todo worktree que haya corrido `pnpm install`, o sea a todos. Git IGUAL saca la
# metadata, asi que el worktree queda desregistrado y basta un borrado comun.
#
# Tres cosas que NO se tocan sin volver a medir, las tres se descubrieron fallando en verde:
#
#   - El filtro matchea la RUTA DEL WORKTREE, nunca el nombre del proceso. En esta maquina hay
#     un `pnpm dev --port 5199` sobre el checkout principal y un filtro por `node.exe` se lo
#     llevaria puesto.
#   - Y matchea tambien por `ExecutablePath`, no solo por linea de comando: un `.exe` en
#     ejecucion desde el `node_modules` del worktree es el que bloquea el borrado, y su linea de
#     comando puede traer la ruta relativa.
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
  [ $# -ge 1 ] || { echo "no hay worktrees del lote para limpiar"; exit 0; }
fi

padre=$(dirname "$1")
fallo=0
matados=0

for wt in "$@"; do
  echo "== $wt"

  # `pwd -W` y no `pwd`: git-bash devuelve `/d/Usuarios/...`, que no matchea ni el `D:/...` de
  # `git rev-parse --show-toplevel` ni el `D:\Usuarios\...` de `ExecutablePath`.
  abs=$(cd "$wt" 2>/dev/null && pwd -W 2>/dev/null) || abs=""
  [ -n "$abs" ] || { echo "   no existe: nada que hacer"; continue; }

  case "$abs" in
    "$principal"|"$principal"/) echo "   SALTEADO: es el checkout principal" >&2; fallo=1; continue ;;
  esac

  if git worktree remove --force "$wt" >/dev/null 2>&1; then
    echo "   git worktree remove: ok"
  else
    echo "   git worktree remove: fallo (esperado, corrio pnpm install) - sigo"
  fi

  [ -d "$wt" ] || { echo "   borrado"; continue; }

  # Nada de no-ASCII adentro del -Command: la cadena cruza a powershell.exe por la codepage de
  # la consola. Los comentarios viven aca, en shell, que no cruza.
  salida=$(powershell -NoProfile -NonInteractive -Command "
    \$ErrorActionPreference='SilentlyContinue'
    \$a = '$abs'
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
        Write-Output (\$_.ProcessId.ToString() + ' ' + \$_.Name)
        Stop-Process -Id \$_.ProcessId -Force
      }
  " 2>/dev/null)

  if [ -n "$salida" ]; then
    # Lo propio de este skill: aca esto NO es rutina.
    echo "$salida" | while read -r linea; do echo "   ANOMALIA: habia un proceso vivo - $linea"; done
    matados=1
    # `Stop-Process` vuelve enseguida, pero Windows tarda en soltar el handle del `.exe`. Sin
    # esta espera el `rm -rf` de abajo corre contra un archivo todavia bloqueado y falla —
    # medido: el proceso moria, el directorio quedaba, y el script culpaba al IDE.
    sleep 1
  fi

  rm -rf "$wt" 2>/dev/null

  # Un reintento, por si el handle tardo mas que la espera. Dos fallos seguidos ya no son
  # timing: es algo que el filtro no ve.
  [ -d "$wt" ] && { sleep 2; rm -rf "$wt" 2>/dev/null; }

  if [ -d "$wt" ]; then
    echo "   SIGUE AHI. Algo tiene un handle abierto que el filtro no ve - tipicamente el IDE" >&2
    echo "   con la carpeta abierta. Cerrala y volve a correr esto." >&2
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

if [ "$matados" -eq 1 ]; then
  echo
  echo "REPORTAR: un review no levanta la app, asi que no deberia haber habido ningun proceso"
  echo "vivo adentro de un worktree. Que lo haya habido va al reporte del Paso 5."
fi

exit "$fallo"

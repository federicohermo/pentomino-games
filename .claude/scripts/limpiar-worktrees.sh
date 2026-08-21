#!/usr/bin/env sh
# Destruye un worktree de agente en Windows, que tiene DOS modos de falla y no uno.
#
# Uso, desde la raiz del repo:
#   .claude/scripts/limpiar-worktrees.sh <ruta-del-worktree> [<ruta> ...]
#   .claude/scripts/limpiar-worktrees.sh --todos      # todos los registrados menos el principal
#
# Esta es la version GENERAL, para usar a mano. Los skills que abanican worktrees se llevan cada
# uno su copia especializada —`pr-review-batch` y `spec-implement-batch`—, porque el caso 2 de
# abajo le pasa a uno y no al otro, y un skill autocontenido puede decir cual espera.
#
# LAS DOS CAUSAS, las dos medidas el 2026-08-21:
#
#   1. `node_modules` esta en .gitignore. `git worktree remove` borra lo trackeado y el `.git`,
#      pero el directorio no queda vacio y el borrado final tira `Directory not empty`.
#      `--force` no ayuda: no es un problema de cambios sin commitear. Git IGUAL saca la
#      metadata, asi que el worktree deja de estar registrado y queda un directorio huerfano.
#      Le pasa a cualquier worktree que haya corrido `pnpm install`, o sea a todos.
#
#   2. Un proceso vivo adentro del worktree. En Windows un handle abierto tambien hace fallar
#      el borrado crudo, no solo el de git. Y el que bloquea no es el que uno esperaria: un
#      `.exe` EN EJECUCION desde el `node_modules` del worktree no se puede borrar mientras
#      corra, y su linea de comando puede traer la ruta relativa — o sea que solo lo encuentra
#      un match por `ExecutablePath`.
#
# Por eso el orden es: sacar la metadata, matar lo de adentro, recien ahi borrar.
#
# EL FILTRO DE PROCESOS TIENE DOS MITADES, y las dos se descubrieron probando este script:
#
#   - Matchea la RUTA DEL WORKTREE, nunca el nombre del proceso. Es lo que hace imposible el
#     accidente caro: en esta maquina hay un `pnpm dev --port 5199` sobre el checkout
#     principal, y un filtro por `node.exe` o por `vite` se lo llevaria puesto.
#
#   - Y excluye el propio arbol de procesos. Sin eso el filtro se cumple a si mismo: la linea
#     de comando del `bash.exe` que corre este script CONTIENE la ruta del worktree, asi que la
#     primera version se mataba sola. Medido: la consulta devolvia 5 `bash.exe` mas el
#     `powershell.exe` que la estaba corriendo.
#
# NINGUNA CONVERSION DE RUTA DEL LADO DEL SHELL. Es la tercera cosa que se descubrio fallando:
# un `sed 's|/|\\|g'` da una barra sola cuando se tipea en una terminal y DOS cuando vive en un
# archivo, porque hay una capa de comillas menos. El script quedaba mudo sin decir por que. La
# conversion la hace PowerShell con .Replace(), donde no hay capas, y el borrado lo hace
# `rm -rf`, que no necesita forma Windows.
set -u

[ $# -ge 1 ] || { echo "uso: $(basename "$0") <ruta-del-worktree> [...] | --todos" >&2; exit 2; }

principal=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "ABORT: no es un repo git" >&2; exit 1; }

if [ "${1:-}" = "--todos" ]; then
  # `git worktree list --porcelain` da la ruta de cada uno; el principal se saca comparando.
  # shellcheck disable=SC2046 # el split por lineas es lo que los convierte en argumentos
  set -- $(git worktree list --porcelain | sed -n 's/^worktree //p' | grep -vxF "$principal")
  [ $# -ge 1 ] || { echo "no hay worktrees registrados ademas del principal"; exit 0; }
fi

padre=$(dirname "$1")
fallo=0

for wt in "$@"; do
  echo "== $wt"

  # Absoluta y EN FORMA WINDOWS antes de comparar. `pwd` a secas en git-bash devuelve
  # `/d/Usuarios/...`, que no matchea ni el `D:/...` de `git rev-parse --show-toplevel` ni el
  # `D:\Usuarios\...` de `ExecutablePath`. `pwd -W` da `D:/...`, que sirve para los dos.
  abs=$(cd "$wt" 2>/dev/null && pwd -W 2>/dev/null) || abs=""
  [ -n "$abs" ] || { echo "   no existe: nada que hacer"; continue; }

  case "$abs" in
    "$principal"|"$principal"/) echo "   SALTEADO: es el checkout principal" >&2; fallo=1; continue ;;
  esac

  # 1. Sacar la metadata. Se espera que falle en el borrado final; lo que importa es que git
  #    desregistre el worktree, y eso lo hace igual. Por eso el mensaje se traga.
  if git worktree remove --force "$wt" >/dev/null 2>&1; then
    echo "   git worktree remove: ok"
  else
    echo "   git worktree remove: fallo (esperado si corrio pnpm install) - sigo"
  fi

  [ -d "$wt" ] || { echo "   borrado"; continue; }

  # 2. Matar lo de adentro. Nada de no-ASCII adentro del -Command: la cadena cruza a
  #    powershell.exe por la codepage de la consola. Los comentarios viven aca, en shell.
  powershell -NoProfile -NonInteractive -Command "
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
        Write-Output ('   matando PID ' + \$_.ProcessId + ' - ' + \$_.Name)
        Stop-Process -Id \$_.ProcessId -Force
      }
  " 2>/dev/null

  # 3. Borrado crudo. `git worktree remove` ya no sirve: quedo desregistrado en 1.
  rm -rf "$wt" 2>/dev/null

  # Un reintento: `Stop-Process` vuelve enseguida pero Windows tarda en soltar el handle del
  # `.exe`, y sin esto el borrado corre contra un archivo todavia bloqueado. Dos fallos seguidos
  # ya no son timing: es algo que el filtro no ve.
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

exit "$fallo"

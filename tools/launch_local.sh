#!/bin/sh
# Linux/macOS launcher for the local game and editor servers.
set -u

mode=${1:-}
case "$mode" in
    game|editor) ;;
    *)
        printf '用法：%s game|editor [参数...]\n' "$0" >&2
        exit 2
        ;;
esac
shift

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
root=$(dirname "$script_dir")

python_ok() {
    [ -n "${1:-}" ] && "$1" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' >/dev/null 2>&1
}

print_python_help() {
    printf '未找到 Python 3.10 或更新版本。\n' >&2
    if [ "$(uname -s 2>/dev/null)" = "Darwin" ]; then
        printf 'macOS：请安装 Python 3.10+（python.org 安装包或 brew install python），然后重新启动。\n' >&2
        printf '也可以设置 WHALE_PYTHON=/path/to/python3 后再启动。\n' >&2
        return
    fi
    if command -v apt-get >/dev/null 2>&1; then
        printf 'Debian/Ubuntu：sudo apt update && sudo apt install python3 python3-venv\n' >&2
    elif command -v dnf >/dev/null 2>&1; then
        printf 'Fedora/RHEL：sudo dnf install python3 python3-pip\n' >&2
    elif command -v pacman >/dev/null 2>&1; then
        printf 'Arch：sudo pacman -S python python-pip\n' >&2
    elif command -v zypper >/dev/null 2>&1; then
        printf 'openSUSE：sudo zypper install python3 python3-pip\n' >&2
    elif command -v apk >/dev/null 2>&1; then
        printf 'Alpine：sudo apk add python3 py3-pip\n' >&2
    else
        printf '请用系统包管理器安装 Python 3.10+。\n' >&2
    fi
    printf '也可以设置 WHALE_PYTHON=/path/to/python3 后再启动。\n' >&2
}

find_python() {
    for candidate in \
        "$root/.venv/bin/python" "$root/.venv/bin/python3" \
        python3.14 python3.13 python3.12 python3.11 python3.10 python3 python; do
        if [ "${candidate#/}" != "$candidate" ]; then
            [ -x "$candidate" ] || continue
            path=$candidate
        else
            path=$(command -v "$candidate" 2>/dev/null) || continue
        fi
        if python_ok "$path"; then
            printf '%s\n' "$path"
            return 0
        fi
    done
    return 1
}

pause_on_error() {
    [ "${WHALE_NO_PAUSE:-0}" = "1" ] && return
    if [ -t 0 ]; then
        printf '按回车退出……' >&2
        read -r _ || true
    fi
}

printf '正在检查 Python 运行环境……\n'

if [ -n "${WHALE_PYTHON:-}" ]; then
    if ! python_ok "$WHALE_PYTHON"; then
        printf 'WHALE_PYTHON 必须指向可用的 Python 3.10+：%s\n' "$WHALE_PYTHON" >&2
        pause_on_error
        exit 1
    fi
    python=$WHALE_PYTHON
else
    python=$(find_python) || {
        print_python_help
        pause_on_error
        exit 1
    }
fi

printf 'Python 已就绪，正在启动……\n'
export PYTHONUTF8=1
"$python" -B "$script_dir/start_local.py" "$mode" "$@"
status=$?
if [ "$status" -ne 0 ] && [ "$status" -ne 130 ]; then
    pause_on_error
fi
exit "$status"

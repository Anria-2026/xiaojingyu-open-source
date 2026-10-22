#!/bin/sh
# Install application-menu entries for the local game and editor.
set -u

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
apps="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$apps" || exit 1

quote_exec() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/%/%%/g'
}

install_entry() {
    mode=$1
    name=$2
    file=$3
    target="$apps/xiaojingyu-$mode.desktop"
    exec_path=$(quote_exec "$root/$file")
    cat > "$target" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=$name
Comment=鲸鱼娘养成计划本地服务
Exec=/bin/sh "$exec_path"
Path=$root
Icon=$root/resource/ui/favicon.png
Terminal=true
Categories=Game;
EOF
    chmod +x "$target"
    printf '已创建：%s\n' "$target"
}

install_entry game '鲸鱼娘养成计划' '启动游戏.sh'
install_entry editor '鲸鱼娘编辑器' '启动编辑器.sh'

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$apps" >/dev/null 2>&1 || true
fi
printf '可从应用菜单启动；若没有立即显示，请注销后重新登录。\n'

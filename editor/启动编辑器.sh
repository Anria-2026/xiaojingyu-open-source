#!/bin/sh
set -u
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
root=$(CDPATH= cd -- "$here/.." && pwd)
exec "$root/tools/launch_local.sh" editor "$@"

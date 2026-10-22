#!/bin/sh
set -u
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec /bin/sh "$here/tools/launch_local.sh" editor "$@"

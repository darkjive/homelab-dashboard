#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Taskbar/GUI launchers run without a TTY and a minimal PATH. pnpm's deps-status
# check then wants to purge+reinstall node_modules interactively and aborts,
# silently killing the launch. CI=true auto-confirms; the explicit PATH makes
# pnpm/node discoverable from non-login shells.
export CI=true
export PATH="$HOME/.local/share/pnpm:$HOME/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/bin:$PATH"

exec pnpm desktop:prod

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Taskbar/GUI launchers run without a TTY and a minimal PATH. pnpm's deps-status
# check then wants to purge+reinstall node_modules interactively and aborts,
# silently killing the launch. CI=true auto-confirms; the explicit PATH makes
# pnpm/node discoverable from non-login shells.
export CI=true

# Locate pnpm: prefer PATH, fall back to common install locations for non-login
# shells (taskbar launchers etc.). Covers standalone installer, corepack, npm
# global, and distro packages (NixOS /usr/bin via /run/current-system/sw/bin).
if ! command -v pnpm >/dev/null 2>&1; then
  export PATH="$HOME/.local/share/pnpm:$HOME/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/bin:/bin:/usr/local/lib/node_modules/.bin:/run/current-system/sw/bin:$PATH"
fi

exec pnpm desktop:prod

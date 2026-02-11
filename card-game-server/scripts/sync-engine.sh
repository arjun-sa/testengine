#!/usr/bin/env bash
# Syncs engine files from the client repo into this server project.
# Usage: npm run sync-engine
# Assumes the client repo is at ../src/engine/ relative to this script's project root.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_ROOT="$(dirname "$SCRIPT_DIR")"
CLIENT_ENGINE="${SERVER_ROOT}/../src/engine"
SERVER_ENGINE="${SERVER_ROOT}/src/engine"

if [ ! -d "$CLIENT_ENGINE" ]; then
  echo "Error: Client engine directory not found at $CLIENT_ENGINE"
  exit 1
fi

FILES=("types.ts" "gameEngine.ts" "scoring.ts")
HEADER="// SOURCE: card-game-engine/src/engine"

for file in "${FILES[@]}"; do
  src="$CLIENT_ENGINE/$file"
  dest="$SERVER_ENGINE/$file"

  if [ ! -f "$src" ]; then
    echo "Warning: $src not found, skipping"
    continue
  fi

  echo "$HEADER/$file — keep in sync" > "$dest"
  echo "" >> "$dest"
  cat "$src" >> "$dest"

  echo "Synced $file"
done

echo "Engine sync complete."

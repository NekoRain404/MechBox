#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE_DIR="$ROOT_DIR/release"

if [[ ! -d "$RELEASE_DIR" ]]; then
  echo "release 目录不存在，无需清理"
  exit 0
fi

echo "清理发布产物目录: $RELEASE_DIR"

find "$RELEASE_DIR" -mindepth 1 -maxdepth 1 \
  ! -name '.gitkeep' \
  -exec rm -rf {} +

echo "发布产物目录已清理"

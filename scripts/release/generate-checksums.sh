#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE_DIR="$ROOT_DIR/release"
OUTPUT_FILE="$RELEASE_DIR/SHA256SUMS.txt"

if [[ ! -d "$RELEASE_DIR" ]]; then
  echo "release 目录不存在，请先构建发布产物"
  exit 1
fi

checksum_cmd=""
if command -v sha256sum >/dev/null 2>&1; then
  checksum_cmd="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  checksum_cmd="shasum -a 256"
else
  echo "未找到 sha256sum 或 shasum，无法生成校验文件"
  exit 1
fi

mapfile -t artifacts < <(
  find "$RELEASE_DIR" -maxdepth 1 -type f \
    \( -name '*.exe' -o -name '*.AppImage' -o -name '*.deb' -o -name '*.blockmap' -o -name 'latest*.yml' \) \
    | sort
)

if [[ ${#artifacts[@]} -eq 0 ]]; then
  echo "release 目录中没有可生成校验的发布产物"
  exit 1
fi

echo "# MechBox release checksums" > "$OUTPUT_FILE"
echo "# generated_at=$(date -Iseconds)" >> "$OUTPUT_FILE"
echo >> "$OUTPUT_FILE"

for artifact in "${artifacts[@]}"; do
  rel_path="${artifact#$ROOT_DIR/}"
  checksum="$($checksum_cmd "$artifact" | awk '{print $1}')"
  printf "%s  %s\n" "$checksum" "$rel_path" >> "$OUTPUT_FILE"
done

echo "已生成校验文件: $OUTPUT_FILE"

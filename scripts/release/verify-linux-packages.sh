#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PACKAGE_JSON="$ROOT_DIR/package.json"
PRODUCT_NAME="$(node -e "const pkg=require(process.argv[1]); console.log(pkg.build.productName || pkg.name)" "$PACKAGE_JSON")"
PACKAGE_NAME="$(node -e "const pkg=require(process.argv[1]); console.log(pkg.name)" "$PACKAGE_JSON")"
VERSION="$(node -e "const pkg=require(process.argv[1]); console.log(pkg.version)" "$PACKAGE_JSON")"
DEB_VERSION="$(printf '%s' "$VERSION" | sed 's/-/~/')"
APPIMAGE_PATH="$ROOT_DIR/release/${PRODUCT_NAME}-${VERSION}.AppImage"
DEB_PATH="$ROOT_DIR/release/${PACKAGE_NAME}_${VERSION}_amd64.deb"
TMP_DIR="$(mktemp -d -t mechbox-linux-verify.XXXXXX)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

for cmd in ar bsdtar rg; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "缺少校验命令: $cmd"
    exit 1
  fi
done

if [[ ! -f "$APPIMAGE_PATH" ]]; then
  echo "缺少 AppImage 产物: $APPIMAGE_PATH"
  exit 1
fi

if [[ ! -f "$DEB_PATH" ]]; then
  echo "缺少 Debian 产物: $DEB_PATH"
  exit 1
fi

assert_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "缺少文件: $path"
    exit 1
  fi
}

assert_dir() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    echo "缺少目录: $path"
    exit 1
  fi
}

assert_contains() {
  local pattern="$1"
  local file="$2"
  if ! rg -Fq "$pattern" "$file"; then
    echo "文件内容校验失败: $file 缺少 $pattern"
    exit 1
  fi
}

echo "校验 AppImage 包内容"
APPIMAGE_DIR="$TMP_DIR/appimage"
mkdir -p "$APPIMAGE_DIR"
(
  cd "$APPIMAGE_DIR"
  APPIMAGE_EXTRACT_AND_RUN=1 "$APPIMAGE_PATH" --appimage-extract >/dev/null 2>&1
)

APP_ROOT="$APPIMAGE_DIR/squashfs-root"
assert_file "$APP_ROOT/mechbox.desktop"
assert_file "$APP_ROOT/mechbox.png"
assert_file "$APP_ROOT/resources/DOC/schema_v3.sql"
assert_file "$APP_ROOT/resources/DOC/seed_sources_v3.sql"
assert_file "$APP_ROOT/resources/data/materials-extended.json"
assert_dir "$APP_ROOT/resources/data/standards"
assert_file "$APP_ROOT/resources/data/standards/o-ring/as568.json"
assert_file "$APP_ROOT/usr/share/icons/hicolor/512x512/apps/mechbox.png"

assert_contains 'Name=MechBox' "$APP_ROOT/mechbox.desktop"
assert_contains 'Exec=AppRun --no-sandbox %U' "$APP_ROOT/mechbox.desktop"
assert_contains 'Icon=mechbox' "$APP_ROOT/mechbox.desktop"
assert_contains 'Categories=Development;' "$APP_ROOT/mechbox.desktop"
assert_contains "X-AppImage-Version=${VERSION}" "$APP_ROOT/mechbox.desktop"

echo "校验 Debian 包内容"
DEB_DIR="$TMP_DIR/deb"
mkdir -p "$DEB_DIR"
(
  cd "$DEB_DIR"
  ar x "$DEB_PATH"
)

assert_file "$DEB_DIR/debian-binary"
assert_contains '2.0' "$DEB_DIR/debian-binary"

CONTROL_ARCHIVE="$(find "$DEB_DIR" -maxdepth 1 -type f -name 'control.tar.*' | head -n 1)"
DATA_ARCHIVE="$(find "$DEB_DIR" -maxdepth 1 -type f -name 'data.tar.*' | head -n 1)"

if [[ -z "$CONTROL_ARCHIVE" || -z "$DATA_ARCHIVE" ]]; then
  echo "Debian 包结构不完整，缺少 control/data tar 包"
  exit 1
fi

CONTROL_DIR="$TMP_DIR/control"
DATA_DIR="$TMP_DIR/data"
mkdir -p "$CONTROL_DIR" "$DATA_DIR"
bsdtar -xf "$CONTROL_ARCHIVE" -C "$CONTROL_DIR"
bsdtar -xf "$DATA_ARCHIVE" -C "$DATA_DIR"

assert_file "$CONTROL_DIR/control"
assert_contains "Package: ${PACKAGE_NAME}" "$CONTROL_DIR/control"
assert_contains "Version: ${DEB_VERSION}" "$CONTROL_DIR/control"
assert_contains 'License: GPL-3.0-only' "$CONTROL_DIR/control"
assert_contains 'Architecture: amd64' "$CONTROL_DIR/control"
assert_contains 'Maintainer: NekoRain' "$CONTROL_DIR/control"
assert_contains 'Description: Mechanical Engineering Design Toolbox' "$CONTROL_DIR/control"

assert_file "$DATA_DIR/usr/share/applications/mechbox.desktop"
assert_file "$DATA_DIR/usr/share/icons/hicolor/512x512/apps/mechbox.png"
assert_file "$DATA_DIR/opt/MechBox/resources/DOC/schema_v3.sql"
assert_file "$DATA_DIR/opt/MechBox/resources/DOC/seed_sources_v3.sql"
assert_file "$DATA_DIR/opt/MechBox/resources/data/materials-extended.json"
assert_dir "$DATA_DIR/opt/MechBox/resources/data/standards"
assert_file "$DATA_DIR/opt/MechBox/resources/data/standards/o-ring/as568.json"
assert_dir "$DATA_DIR/opt/MechBox/locales"

assert_contains 'Name=MechBox' "$DATA_DIR/usr/share/applications/mechbox.desktop"
assert_contains 'Exec=/opt/MechBox/mechbox %U' "$DATA_DIR/usr/share/applications/mechbox.desktop"
assert_contains 'Icon=mechbox' "$DATA_DIR/usr/share/applications/mechbox.desktop"
assert_contains 'Categories=Development;' "$DATA_DIR/usr/share/applications/mechbox.desktop"

echo "Linux 包内容校验通过"

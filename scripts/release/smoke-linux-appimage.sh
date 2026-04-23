#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PACKAGE_JSON="$ROOT_DIR/package.json"
PRODUCT_NAME="$(node -e "const pkg=require(process.argv[1]); console.log(pkg.build.productName || pkg.name)" "$PACKAGE_JSON")"
VERSION="$(node -e "const pkg=require(process.argv[1]); console.log(pkg.version)" "$PACKAGE_JSON")"
APPIMAGE_PATH="$ROOT_DIR/release/${PRODUCT_NAME}-${VERSION}.AppImage"
TIMEOUT_SEC="${SMOKE_TIMEOUT_SEC:-20}"
SECOND_TIMEOUT_SEC="${SMOKE_SECOND_TIMEOUT_SEC:-8}"
FIRST_LOG_FILE="$(mktemp -t mechbox-appimage-smoke.first.XXXXXX.log)"
SECOND_LOG_FILE="$(mktemp -t mechbox-appimage-smoke.second.XXXXXX.log)"
FIRST_PID=""
EXTRACT_DIR=""
RUN_TARGET="$APPIMAGE_PATH"
RUNTIME_ENV=()
RUN_ARGS=(--no-sandbox)
RUN_PREFIX=()
USE_EXTRACT_ONCE=0

terminate_pid_tree() {
  local pid="$1"
  if [[ -z "$pid" ]] || ! kill -0 "$pid" >/dev/null 2>&1; then
    return 0
  fi

  local children=()
  mapfile -t children < <(pgrep -P "$pid" 2>/dev/null || true)

  if [[ ${#children[@]} -gt 0 ]]; then
    for child in "${children[@]}"; do
      terminate_pid_tree "$child"
    done
  fi

  kill -INT "$pid" >/dev/null 2>&1 || true
  sleep 1

  if kill -0 "$pid" >/dev/null 2>&1; then
    kill -TERM "$pid" >/dev/null 2>&1 || true
    sleep 1
  fi

  if kill -0 "$pid" >/dev/null 2>&1; then
    kill -KILL "$pid" >/dev/null 2>&1 || true
  fi
}

if [[ "${SMOKE_APPIMAGE_EXTRACT_AND_RUN:-0}" == "1" || "${APPIMAGE_EXTRACT_AND_RUN:-0}" == "1" ]]; then
  USE_EXTRACT_ONCE=1
fi

if [[ "${SMOKE_USE_XVFB:-auto}" != "0" ]]; then
  if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
    if command -v xvfb-run >/dev/null 2>&1; then
      RUN_PREFIX=(xvfb-run -a --server-args="-screen 0 1280x960x24")
      RUNTIME_ENV+=(
        ELECTRON_DISABLE_SANDBOX=1
        XDG_SESSION_TYPE=x11
        WAYLAND_DISPLAY=
        ELECTRON_OZONE_PLATFORM_HINT=x11
        GDK_BACKEND=x11
        QT_QPA_PLATFORM=xcb
        SDL_VIDEODRIVER=x11
      )
    elif [[ "${SMOKE_USE_XVFB:-auto}" == "1" ]]; then
      echo "AppImage 烟测需要图形会话，但未找到 DISPLAY/WAYLAND_DISPLAY，也未安装 xvfb-run"
      exit 1
    fi
  fi
fi

cleanup() {
  terminate_pid_tree "$FIRST_PID"
  if [[ -n "$EXTRACT_DIR" && -d "$EXTRACT_DIR" ]]; then
    rm -rf "$EXTRACT_DIR"
  fi
  rm -f "$FIRST_LOG_FILE" "$SECOND_LOG_FILE"
}
trap cleanup EXIT

if [[ ! -f "$APPIMAGE_PATH" ]]; then
  echo "未找到 AppImage 产物: $APPIMAGE_PATH"
  exit 1
fi

chmod +x "$APPIMAGE_PATH"

if [[ "$USE_EXTRACT_ONCE" == "1" ]]; then
  EXTRACT_DIR="$(mktemp -d -t mechbox-appimage-smoke.extract.XXXXXX)"
  (
    cd "$EXTRACT_DIR"
    "$APPIMAGE_PATH" --appimage-extract >/dev/null 2>&1
  )
  RUN_TARGET="$EXTRACT_DIR/squashfs-root/AppRun"
  if [[ ! -x "$RUN_TARGET" ]]; then
    echo "AppImage 烟测失败，解包后未找到可执行入口: $RUN_TARGET"
    exit 1
  fi
  # AppRun uses APPDIR from the AppImage runtime. When CI runs an extracted
  # AppDir directly, provide it explicitly so Electron args do not confuse
  # the generated AppRun path discovery.
  RUNTIME_ENV+=(
    "APPDIR=$EXTRACT_DIR/squashfs-root"
    "APPIMAGE=$APPIMAGE_PATH"
  )
fi

echo "执行 AppImage 烟测: $APPIMAGE_PATH"
echo "首启日志: $FIRST_LOG_FILE"
echo "二次启动日志: $SECOND_LOG_FILE"
if [[ ${#RUN_PREFIX[@]} -gt 0 ]]; then
  echo "图形环境: 使用 xvfb-run"
fi
if [[ "$USE_EXTRACT_ONCE" == "1" ]]; then
  echo "AppImage 运行模式: 先解包后运行 ($RUN_TARGET)"
fi
if [[ ${#RUNTIME_ENV[@]} -gt 0 ]]; then
  echo "运行环境变量: ${RUNTIME_ENV[*]}"
fi
echo "运行参数: ${RUN_ARGS[*]}"

required_patterns=(
  "[Main] createWindow"
  "did-finish-load"
  "Database initialization complete"
  "CAD sync server started"
)

print_key_log_excerpt() {
  local title="$1"
  local file="$2"
  local pattern="$3"

  echo "--- $title"
  if [[ ! -s "$file" ]]; then
    echo "(无日志输出)"
    return
  fi

  if ! rg -n "$pattern" "$file"; then
    sed -n '1,20p' "$file"
  fi
}

env "${RUNTIME_ENV[@]}" "${RUN_PREFIX[@]}" "$RUN_TARGET" "${RUN_ARGS[@]}" >"$FIRST_LOG_FILE" 2>&1 &
FIRST_PID="$!"

for _ in $(seq 1 "$TIMEOUT_SEC"); do
  ready=true
  for pattern in "${required_patterns[@]}"; do
    if ! rg -Fq "$pattern" "$FIRST_LOG_FILE"; then
      ready=false
      break
    fi
  done
  if [[ "$ready" == true ]]; then
    break
  fi
  sleep 1
done

for pattern in "${required_patterns[@]}"; do
  if ! rg -Fq "$pattern" "$FIRST_LOG_FILE"; then
    cat "$FIRST_LOG_FILE"
    echo "AppImage 烟测失败，首启缺少日志标记: $pattern"
    exit 1
  fi
done

if rg -Fq "did-fail-load" "$FIRST_LOG_FILE"; then
  cat "$FIRST_LOG_FILE"
  echo "AppImage 烟测失败，检测到页面加载失败日志"
  exit 1
fi

if ! ss -ltn | rg -q ':8321\b'; then
  cat "$FIRST_LOG_FILE"
  echo "AppImage 烟测失败，首启后未监听 8321 端口"
  exit 1
fi

second_start_ts="$(date +%s)"
set +e
timeout --signal=INT --kill-after=5s "${SECOND_TIMEOUT_SEC}s" env "${RUNTIME_ENV[@]}" "${RUN_PREFIX[@]}" "$RUN_TARGET" "${RUN_ARGS[@]}" >"$SECOND_LOG_FILE" 2>&1
second_status=$?
set -e
second_elapsed="$(( $(date +%s) - second_start_ts ))"

if [[ "$second_status" -ne 0 ]]; then
  cat "$SECOND_LOG_FILE"
  echo "AppImage 单实例校验失败，二次启动退出码: $second_status"
  exit 1
fi

if (( second_elapsed >= SECOND_TIMEOUT_SEC )); then
  cat "$SECOND_LOG_FILE"
  echo "AppImage 单实例校验失败，二次启动未在 ${SECOND_TIMEOUT_SEC}s 内主动退出"
  exit 1
fi

if rg -Fq "[Main] createWindow" "$SECOND_LOG_FILE"; then
  cat "$SECOND_LOG_FILE"
  echo "AppImage 单实例校验失败，二次启动不应再次创建窗口"
  exit 1
fi

if ! ss -ltn | rg -q ':8321\b'; then
  cat "$FIRST_LOG_FILE"
  cat "$SECOND_LOG_FILE"
  echo "AppImage 单实例校验失败，二次启动后主实例端口丢失"
  exit 1
fi

terminate_pid_tree "$FIRST_PID"
wait "$FIRST_PID" >/dev/null 2>&1 || true
FIRST_PID=""

for _ in $(seq 1 8); do
  if ! ss -ltn | rg -q ':8321\b|:8322\b|:8323\b'; then
    break
  fi
  sleep 1
done

if ss -ltn | rg -q ':8321\b|:8322\b|:8323\b'; then
  echo "AppImage 烟测失败，退出后仍有 CAD 端口占用"
  exit 1
fi

echo "AppImage 烟测通过"
print_key_log_excerpt \
  "首启关键信息" \
  "$FIRST_LOG_FILE" \
  'createWindow|did-finish-load|Database initialization complete|CAD sync server started|window shown'
print_key_log_excerpt "二次启动关键信息" "$SECOND_LOG_FILE" '.+'

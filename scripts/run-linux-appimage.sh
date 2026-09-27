#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"

usage() {
  cat <<'EOF'
Usage: scripts/run-linux-appimage.sh [--install-deps] [--extract] [APPIMAGE]

Finds the NEO Linux AppImage for this machine, checks whether FUSE 2 is
available, optionally installs the needed package, and runs the app.

Options:
  --install-deps  Install missing FUSE dependency without prompting.
  --extract       Extract and run the AppImage instead of using FUSE.
  -h, --help      Show this help.
EOF
}

install_deps=false
force_extract=false
explicit_appimage=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --install-deps)
      install_deps=true
      ;;
    --extract)
      force_extract=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      explicit_appimage="$1"
      ;;
  esac
  shift
done

if [ -n "$explicit_appimage" ]; then
  case "$explicit_appimage" in
    /*) ;;
    *) explicit_appimage="$PWD/$explicit_appimage" ;;
  esac
fi

arch="$(uname -m)"
case "$arch" in
  x86_64|amd64)
    default_pattern="NEO-*.AppImage"
    exclude_pattern="*-arm64.AppImage"
    ;;
  aarch64|arm64)
    default_pattern="NEO-*-arm64.AppImage"
    exclude_pattern=""
    ;;
  *)
    echo "Unsupported Linux architecture: $arch" >&2
    exit 1
    ;;
esac

find_appimage() {
  if [ -n "$explicit_appimage" ]; then
    printf '%s\n' "$explicit_appimage"
    return
  fi

  if [ ! -d "$DIST_DIR" ]; then
    echo "Missing dist/. Build the Linux AppImage first with: npm run package:linux" >&2
    exit 1
  fi

  if [ -n "$exclude_pattern" ]; then
    find "$DIST_DIR" -maxdepth 1 -type f -name "$default_pattern" ! -name "$exclude_pattern" | sort -V | tail -n 1
  else
    find "$DIST_DIR" -maxdepth 1 -type f -name "$default_pattern" | sort -V | tail -n 1
  fi
}

appimage="$(find_appimage)"

if [ -z "$appimage" ] || [ ! -f "$appimage" ]; then
  echo "Could not find a matching NEO AppImage in dist/." >&2
  echo "Build one first with: npm run package:linux" >&2
  exit 1
fi

chmod +x "$appimage"

has_fuse2() {
  if command -v ldconfig >/dev/null 2>&1 && ldconfig -p 2>/dev/null | grep -q 'libfuse\.so\.2'; then
    return 0
  fi

  [ -e /usr/lib/libfuse.so.2 ] ||
    [ -e /usr/lib64/libfuse.so.2 ] ||
    [ -e /lib/x86_64-linux-gnu/libfuse.so.2 ] ||
    [ -e /lib/aarch64-linux-gnu/libfuse.so.2 ]
}

detect_package_manager() {
  if command -v pacman >/dev/null 2>&1; then
    echo "pacman"
  elif command -v apt-get >/dev/null 2>&1; then
    echo "apt-get"
  elif command -v dnf >/dev/null 2>&1; then
    echo "dnf"
  elif command -v yum >/dev/null 2>&1; then
    echo "yum"
  elif command -v zypper >/dev/null 2>&1; then
    echo "zypper"
  elif command -v apk >/dev/null 2>&1; then
    echo "apk"
  else
    return 1
  fi
}

install_command_description() {
  case "$1" in
    pacman) echo "sudo pacman -S fuse2" ;;
    apt-get) echo "sudo apt-get update && sudo apt-get install -y libfuse2 || sudo apt-get install -y libfuse2t64" ;;
    dnf) echo "sudo dnf install -y fuse-libs fuse" ;;
    yum) echo "sudo yum install -y fuse-libs fuse" ;;
    zypper) echo "sudo zypper install -y libfuse2 || sudo zypper install -y fuse" ;;
    apk) echo "sudo apk add fuse" ;;
  esac
}

install_fuse2() {
  case "$1" in
    pacman)
      sudo pacman -S fuse2
      ;;
    apt-get)
      sudo apt-get update
      sudo apt-get install -y libfuse2 || sudo apt-get install -y libfuse2t64
      ;;
    dnf)
      sudo dnf install -y fuse-libs fuse
      ;;
    yum)
      sudo yum install -y fuse-libs fuse
      ;;
    zypper)
      sudo zypper install -y libfuse2 || sudo zypper install -y fuse
      ;;
    apk)
      sudo apk add fuse
      ;;
  esac
}

run_extracted() {
  extract_dir="$DIST_DIR/appimage-extracted-$(basename "$appimage" .AppImage)"
  rm -rf "$extract_dir"
  mkdir -p "$extract_dir"

  (
    cd "$extract_dir"
    "$appimage" --appimage-extract >/dev/null
    exec ./squashfs-root/AppRun
  )
}

if [ "$force_extract" = true ]; then
  run_extracted
  exit 0
fi

if ! has_fuse2; then
  echo "FUSE 2 is missing. AppImages need libfuse.so.2 to run directly."

  if package_manager="$(detect_package_manager)"; then
    echo "Detected install command: $(install_command_description "$package_manager")"

    if [ "$install_deps" = true ]; then
      install_fuse2 "$package_manager"
    else
      printf 'Install it now? [y/N] '
      read -r answer
      case "$answer" in
        y|Y|yes|YES)
          install_fuse2 "$package_manager"
          ;;
        *)
          echo "Running extracted fallback instead."
          run_extracted
          exit 0
          ;;
      esac
    fi
  else
    echo "Could not detect a supported package manager."
    echo "Running extracted fallback instead."
    run_extracted
    exit 0
  fi
fi

exec "$appimage"

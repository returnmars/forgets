#!/bin/sh
# Perry installer — downloads the latest release from GitHub
# Usage: curl -fsSL https://perryts.com/install.sh | sh

set -e

REPO="PerryTS/perry"
INSTALL_DIR="/usr/local/bin"
LIB_DIR="/usr/local/lib"

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
  darwin) OS="macos" ;;
  linux)  OS="linux" ;;
  *)
    echo "Error: Unsupported OS: $OS"
    echo "See https://github.com/$REPO for manual install instructions."
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH="x86_64" ;;
  aarch64|arm64) ARCH="aarch64" ;;
  *)
    echo "Error: Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

ARTIFACT="perry-${OS}-${ARCH}.tar.gz"

echo "Detecting platform: ${OS}/${ARCH}"

# Get latest release tag
LATEST=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST" ]; then
  echo "Error: Could not determine latest release."
  exit 1
fi

echo "Latest version: $LATEST"

URL="https://github.com/$REPO/releases/download/$LATEST/$ARTIFACT"

echo "Downloading $ARTIFACT..."

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

curl -fsSL "$URL" -o "$TMPDIR/perry.tar.gz"

echo "Extracting..."
tar xzf "$TMPDIR/perry.tar.gz" -C "$TMPDIR"

# Install binary
if [ -w "$INSTALL_DIR" ]; then
  cp "$TMPDIR/perry" "$INSTALL_DIR/perry"
  chmod 755 "$INSTALL_DIR/perry"
  # Install libraries alongside binary
  for lib in "$TMPDIR"/libperry_*.a; do
    [ -f "$lib" ] && cp "$lib" "$LIB_DIR/"
  done
else
  echo "Installing to $INSTALL_DIR (requires sudo)..."
  sudo cp "$TMPDIR/perry" "$INSTALL_DIR/perry"
  sudo chmod 755 "$INSTALL_DIR/perry"
  for lib in "$TMPDIR"/libperry_*.a; do
    [ -f "$lib" ] && sudo cp "$lib" "$LIB_DIR/"
  done
fi

echo ""
echo "Perry $LATEST installed successfully!"
echo ""
echo "Quick start:"
echo "  echo 'console.log(\"hello\")' > hello.ts"
echo "  perry hello.ts -o hello && ./hello"
echo ""
echo "Run 'perry doctor' to verify your setup."

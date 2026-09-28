#!/usr/bin/env bash
# frontend/package-lock.json dosyasini yeniden uretir.
#
# Neden iki kilit dosyasi var?
#   pnpm-lock.yaml  -> lokal gelistirme (proje kurali: pnpm)
#   package-lock.json -> Render Static Site build'i (`npm ci && npm run build`)
#
# Render blueprint'i servis olusturuldugu anda okunur; daha sonra degistirilen
# Build Command panelden elle girilmesi gerekir. Bu paket kilidi, panelde hic
#bir seye dokunmadan build'in calismasini saglar.
#
# Yeni bagimlilik eklediginde/guncellediginde BU KOMUTU CALISTIR:
#   bash scripts/sync-npm-lock.sh
set -euo pipefail

KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GECICI="$(mktemp -d)"
trap 'rm -rf "$GECICI"' EXIT

echo "[1/2] package.json kopyalaniyor..."
cp "$KOK/frontend/package.json" "$GECICI/"

echo "[2/2] package-lock.json uretiliyor..."
# node_modules YOK: pnpm'in kurdugu agac npm'yi 'workspace:*' referanslariyla
# bozuyor (EUNSUPPORTEDPROTOCOL). Temiz dizinde calistirmak sart.
( cd "$GECICI" && npm install --package-lock-only --no-audit --no-fund )

cp "$GECICI/package-lock.json" "$KOK/frontend/package-lock.json"

echo "Tamam: frontend/package-lock.json guncellendi."
echo "Dogrulama:  cd frontend && npm ci && npm run build"

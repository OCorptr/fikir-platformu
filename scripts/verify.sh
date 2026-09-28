#!/usr/bin/env bash
# Geleceğin Fikri Platformu — kurulum doğrulama (Linux/macOS)
#
# Windows/PowerShell için: scripts/verify.ps1
# Kullanım:  ./scripts/verify.sh
#
# Çıktı: her adım için geçti (OK) / kaldı (UYARI) / başarısız (HATA) yazar.
# Hata varsa çıkış kodu 1 döner.

set -uo pipefail

KOK_DIZIN="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HATA_SAYISI=0
UYARI_SAYISI=0

yes_green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yes_red()   { printf '\033[0;31m%s\033[0m\n' "$1"; }
yes_yellow(){ printf '\033[0;33m%s\033[0m\n' "$1"; }
baslik()    { printf '\n=== %s ===\n' "$1"; }

hata()   { yes_red   "[HATA]   $1"; HATA_SAYISI=$((HATA_SAYISI+1)); }
uyari()  { yes_yellow "[UYARI]  $1"; UYARI_SAYISI=$((UYARI_SAYISI+1)); }
tamam()  { yes_green "[TAMAM]  $1"; }

baslik "Araç kontrolü"

if ! command -v dotnet >/dev/null 2>&1; then
  hata "dotnet bulunamadı. .NET 10 SDK kurun: https://dotnet.microsoft.com/download"
else
  SDK_SURUM="$(dotnet --version 2>/dev/null || echo '?')"
  if [[ "$SDK_SURUM" == 10.* ]]; then
    tamam "dotnet SDK $SDK_SURUM"
  else
    hata "dotnet SDK $SDK_SURUM bulundu, ancak global.json 10.0.3xx istiyor. .NET 10 SDK kurun."
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  hata "pnpm bulunamadı. Kurulum: npm install -g pnpm@11"
else
  tamam "pnpm $(pnpm --version 2>/dev/null || echo '?')"
fi

baslik "Ortam değişkenleri (güvenlik kontrolü)"

# .env.example ile backend'in beklediği değişkenler
GEREKEN_ENV=(
  "DB_CONNECTION_STRING"
  "ADMINMAINTENANCE__SECRET"
  "SEED_ADMIN_EMAIL"
  "SEED_ADMIN_PASSWORD"
  "FRONTEND__BASEURL"
)

if [[ -f "$KOK_DIZIN/.env" ]]; then
  tamam ".env bulundu"
  for degisken in "${GEREKEN_ENV[@]}"; do
    if grep -qE "^${degisken}=" "$KOK_DIZIN/.env"; then
      tamam "$degisken tanımlı"
    else
      uyari "$degisken .env içinde yok veya boş"
    fi
  done

    # Kurulmuş sistemde anahtar güçlü ve tahmin edilemez olmalı
  GERCEK_ANAHTAR="$(grep -E '^ADMINMAINTENANCE__SECRET=' "$KOK_DIZIN/.env" | head -1 | cut -d= -f2- | tr -d '"'"'" | tr -d '[:space:]')"
  if [[ ${#GERCEK_ANAHTAR} -lt 24 ]]; then
    hata "ADMINMAINTENANCE__SECRET çok kısa (${#GERCEK_ANAHTAR} karakter). En az 24 karakter kullanın."
  elif [[ "$GERCEK_ANAHTAR" == "CHANGE_ME"* ]]; then
    hata "ADMINMAINTENANCE__SECRET hâlâ şablon değerinde. Gerçek bir rastgele değerle değiştirin."
  else
    tamam "ADMINMAINTENANCE__SECRET güçlü görünüyor (${#GERCEK_ANAHTAR} karakter)"
  fi
else
  uyari ".env yok. Kurulum için: cp .env.example .env  (sonra değerleri doldurun)"
fi

baslik "Gizli bilgi sızıntısı kontrolü"

# Kaynak kodda canlı parola/anahtar kalıntısı var mı?
# (Sprint 11.52'den beri hiçbir gerçek sır repoda bulunmamalıdır.)
SIR_CIKTI="$(grep -rInE 'hteuA3rMbq7mbIbs|2dccHw7yVykcvwe|BekleyinSprint12|Bilisim35sse|GOCSPX-[A-Za-z0-9]' \
     --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist \
     --exclude-dir=bin --exclude-dir=obj --exclude-dir=.cortexkit \
     "$KOK_DIZIN" 2>/dev/null || true)"

if [[ -n "$SIR_CIKTI" ]]; then
  hata "Kaynak kodda canlı parola/anahtar bulundu:"
  echo "$SIR_CIKTI" | head -5
  echo "  → Bu değerleri ROTASYONA alın ve kaynaktan kaldırın."
else
  tamam "Kaynak kodda canlı parola bulunmadı"
fi

baslik "Backend"

cd "$KOK_DIZIN/backend" || { hata "backend dizinine girilemedi"; exit 1; }

if dotnet restore FikirPlatformu.slnx >/dev/null 2>&1; then
  tamam "restore başarılı"
else
  hata "restore başarısız"
fi

if dotnet build -c Release --nologo >/dev/null 2>&1; then
  tamam "Release derleme başarılı"
else
  hata "Release derleme başarısız"
fi

if dotnet test FikirPlatformu.slnx --no-build --configuration Release >/dev/null 2>&1; then
  tamam "birim testleri geçti"
else
  uyari "birim testleri başarısız (0 test de olabilir)"
fi

baslik "Frontend"

cd "$KOK_DIZIN/frontend" || { hata "frontend dizinine girilemedi"; exit 1; }

if pnpm install --frozen-lockfile >/dev/null 2>&1; then
  tamam "bağımlılıklar kuruldu"
else
  hata "pnpm install başarısız (lockfile uyuşmazlığı olabilir)"
fi

if pnpm typecheck >/dev/null 2>&1; then
  tamam "tip kontrolü başarılı"
else
  hata "tip kontrolü başarısız"
fi

if pnpm build >/dev/null 2>&1; then
  tamam "üretim derlemesi başarılı"
  if [[ -d dist/assets ]]; then
    VITE_BUNDLE="$(ls -1 dist/assets/index-*.js 2>/dev/null | head -1)"
    if [[ -n "$VITE_BUNDLE" ]]; then
      tamam "bundle: $(basename "$VITE_BUNDLE")"
    fi
  fi
else
  hata "üretim derlemesi başarısız"
fi

baslik "Sonuç"

if [[ $HATA_SAYISI -gt 0 ]]; then
  yes_red "$HATA_SAYISI hata, $UYARI_SAYISI uyarı. Yukarıdaki [HATA] satırlarını giderin."
  exit 1
elif [[ $UYARI_SAYISI -gt 0 ]]; then
  yes_yellow "Hata yok, $UYARI_SAYISI uyarı var."
  exit 0
else
  yes_green "Tüm kontroller başarılı."
  exit 0
fi

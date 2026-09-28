#!/usr/bin/env bash
# Geleceğin Fikri Platformu — YEĞİTEK teslim paketi (Linux/macOS)
#
# Windows/PowerShell için: scripts/zip_yegitek.ps1
# Kullanım:  ./scripts/zip_yegitek.ps1 →  ./scripts/make_handover.sh
#
# Yalnızca git'e COMMIT EDİLMİŞ dosyaları paketler. Böylece:
#   - .env, dev-email, node_modules, build çıktıları, .tools gibi dosyalar DAHİL OLMAZ
#   - Dizin yapısı korunur (eski sürümde tüm dosyalar tek klasöre düzleşiyordu)
#   - Aynı adlı dosyalar (birden fazla Program.cs, Dockerfile) birbirine karışmaz

set -euo pipefail

KOK_DIZIN="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$KOK_DIZIN"

CIKTI="${1:-fikir-platformu-teslim-$(date +%Y%m%d).zip}"

if ! command -v git >/dev/null 2>&1; then
  echo "[HATA] git bulunamadı." >&2
  exit 1
fi

# --- Güvenlik: paketlenmeden önce canlı sırların repoda olmadığını doğrula ---
# Sprint 11.52'den beri kodda gömülü sır bulunmamalıdır. Aşağıdaki desenler
# yakalanırsa paketleme durdurulur.
SIR_DESENLERI=(
  'password=[^;"]{8,}'          # bağlantı dizesinde düz parola
  'hteuA3rMbq7mbIbs'           # eski TiDB parolası
  '2dccHw7yVykcvwe'            # eski TiDB kullanıcısı
  'BekleyinSprint12'           # eski bakım anahtarı
  'Bilisim35sse'               # eski admin şifresi
  'GOCSPX-[A-Za-z0-9]'         # Google OAuth client secret
)

TEHLIKE=0
for desen in "${SIR_DESENLERI[@]}"; do
  ESLESME="$(git grep -nIE "$desen" HEAD -- \
    '*.cs' '*.ts' '*.tsx' '*.py' '*.yml' '*.yaml' '*.env*' '*.json' '*.md' '*.sh' '*.ps1' \
    2>/dev/null | grep -viE 'CHANGE_ME|örnek|example|placeholder|PLACEHOLDER|\.example\.' || true)"

  if [[ -n "$ESLESME" ]]; then
    echo "[HATA] Commit'lenmiş kodda şüpheli sır deseni: /$desen/" >&2
    echo "$ESLESME" | head -5 >&2
    TEHLIKE=1
  fi
done

if [[ $TEHLIKE -eq 1 ]]; then
  echo >&2
  echo "Paketleme durduruldu. Önce sırları kaldırıp yeni commit atın." >&2
  exit 1
fi

# --- İçinde olmaması gereken yollar (git'te yoksa zaten gelmez, ama açıkça belirt) ---
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "[HATA] .env git'e commit edilmiş. Bu paketlenmemeli." >&2
  exit 1
fi

# --- Paketle ---
# git archive tüm commit'li dosyaları DİZİN YAPISI koruyarak tek zip'e koyar.
git archive --format=zip --output="$CIKTI" HEAD

echo
echo "[TAMAM] Teslim paketi oluşturuldu: $CIKTI"
echo "Boyut: $(du -h "$CIKTI" | cut -f1)"
echo
echo "Paket içeriği doğrulaması:"
unzip -l "$CIKTI" | tail -3
echo
yes_renk='\033[0;33m'
echo "${yes_renk}[HATIRLATMA]${yes_renk} Paketlenmeden önce README.md ve DEPLOYMENT.md içeriğini"
echo "yeniden okuyun: canlı parola, test hesabı veya kişisel e-posta geçmemeli."

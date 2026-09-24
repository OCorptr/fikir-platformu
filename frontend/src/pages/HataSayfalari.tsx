// Özel hata sayfaları (YEĞİTEK gereksinim #35 — kullanıcı dostu özel hata sayfaları)
// - 404: Sayfa bulunamadı
// - 500: Sunucu hatası
// - Genel hata (network/parse) için ErrorBoundary
// Erişilebilirlik (WCAG): role="alert", aria-live, başlık hiyerarşisi, klavye ile geri dönme.

import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

interface OzellestirilebilirSayfa {
  baslik: string;
  mesaj: string;
  kod: number;
  altBaslik?: string;
}

export function HataSayfasi({ baslik, mesaj, kod, altBaslik }: OzellestirilebilirSayfa) {
  const navigate = useNavigate();

  // Sayfa yüklendiğinde başlığı odakla (ekran okuyucu için).
  useEffect(() => {
    document.title = `${kod} — ${baslik}`;
  }, [kod, baslik]);

  return (
    <main className="hata-sayfasi" role="alert" aria-live="polite">
      <div className="hata-kutu">
        <p className="hata-kod" aria-hidden="true">{kod}</p>
        <h1 className="hata-baslik" tabIndex={-1} ref={(el) => el?.focus()}>
          {baslik}
        </h1>
        {altBaslik && <p className="hata-alt">{altBaslik}</p>}
        <p className="hata-mesaj">{mesaj}</p>
        <div className="hata-aksiyonlar">
          <button
            type="button"
            className="btn-ikincil"
            onClick={() => navigate(-1)}
            aria-label="Önceki sayfaya dön"
          >
            ← Geri
          </button>
          <Link to="/" className="btn-ana" aria-label="Ana sayfaya git">
            Ana Sayfa
          </Link>
        </div>
      </div>
    </main>
  );
}

export function SayfaBulunamadi() {
  return (
    <HataSayfasi
      kod={404}
      baslik="Sayfa bulunamadı"
      altBaslik="Aradığınız sayfa burada yok."
      mesaj="Yazım hatası olabilir veya sayfa kaldırılmış olabilir. Aşağıdaki bağlantılarla devam edebilirsiniz."
    />
  );
}

export function SunucuHatasi() {
  return (
    <HataSayfasi
      kod={500}
      baslik="Sunucu hatası"
      altBaslik="İsteğinizi şu anda işleyemiyoruz."
      mesaj="Beklenmeyen bir teknik sorun oluştu. Birkaç dakika sonra tekrar deneyin. Sorun devam ederse sistem yöneticisine bildirin."
    />
  );
}

export function BakimModu() {
  return (
    <HataSayfasi
      kod={503}
      baslik="Bakım çalışması"
      altBaslik="Sistem şu an güncelleniyor."
      mesaj="Planlı bakım nedeniyle kısa süreliğine hizmet dışıyız. Biraz sonra tekrar deneyin."
    />
  );
}
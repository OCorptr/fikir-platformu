import { useEffect, useState } from "react";
import { YetkiliGirisModal } from "../components/YetkiliGirisModal";

const kazananlar = [
  {
    emoji: "🌱",
    ad: "Mert Demir",
    okul: "Yunus Emre Ortaokulu · Buca",
    tema: "🌱 Çevre ve Sürdürülebilirlik",
    soz: '"Atık yağları toplayıp sabun üreten atölye kursak; geliri okul kütüphanesine aktaralım."',
    ay: "Eylül",
  },
  {
    emoji: "🔬",
    ad: "Zeynep Kaya",
    okul: "Atatürk Anadolu Lisesi · Bornova",
    tema: "❤️ Sosyal Fayda",
    soz: '"Okul bahçemize güneş enerjili akıllı sulama sistemi kuralım; bitkiler telefondan sulansın."',
    ay: "Ağustos",
  },
  {
    emoji: "💡",
    ad: "Arda Yılmaz",
    okul: "Atatürk Ortaokulu · İzmir",
    tema: "⚙️ Teknoloji ve Yenilik",
    soz: '"Görme engelli arkadaşlarımız için okul içinde sesli yönlendirme sistemi geliştirebiliriz."',
    ay: "Temmuz",
  },
  {
    emoji: "🤖",
    ad: "Elif Şahin",
    okul: "Mehmet Akif Ersoy Ortaokulu · Karşıyaka",
    tema: "🤖 Yapay Zekâ",
    soz: '"Zorlandığımız konuları yapay zekâ bizim seviyemize göre anlatan bir çalışma arkadaşı olsa."',
    ay: "Haziran",
  },
  {
    emoji: "📖",
    ad: "Emir Koç",
    okul: "Mareşal Fevzi Çakmak İlkokulu · Bayraklı",
    tema: "📖 Değerler Eğitimi",
    soz: '"Sınıflar arası iyilik kartı turnuvası düzenleyelim; kazanan sınıf sinema günü kazansın."',
    ay: "Mayıs",
  },
];

export function HomePage() {
  const [aktif, setAktif] = useState(0);
  const [arsivAcik, setArsivAcik] = useState(false);
  const [lightboxAcik, setLightboxAcik] = useState(false);
  const [yetkiliGirisAcik, setYetkiliGirisAcik] = useState(false);
  const n = kazananlar.length;

  useEffect(() => {
    const zaman = setInterval(() => setAktif((deger) => (deger + 1) % n), 6000);
    return () => clearInterval(zaman);
  }, [n]);

  const sol = kazananlar[(aktif - 1 + n) % n];
  const orta = kazananlar[aktif];
  const sag = kazananlar[(aktif + 1) % n];

  return (
    <>
      <main className="secim">
        <h1>
          GELECEĞİN FİKRİ
          <br />
          <span className="kivircik">PLATFORMU</span>
        </h1>
        <p className="alt-baslik">Fikirlerini paylaş, arkadaşlarından ilham al, geleceği birlikte şekillendirelim.</p>

        <div className="kartlar">
          <div className="af-baslik">
            <span className="af-cizgi"></span>🏆 Ayın Fikirleri<span className="af-cizgi"></span>
          </div>

          <div className="af-sahne">
            <div className="af-kart af-kenar-kart" id="af-sol">
              <div className="af-k-emoji">{sol.emoji}</div>
              <div className="af-k-ad">{sol.ad}</div>
              <div className="af-k-okul">{sol.okul}</div>
              <div className="af-k-tema">{sol.tema}</div>
              <div className="af-k-soz">{sol.soz}</div>
            </div>

            <div
              className="af-kart af-orta"
              id="af-orta"
              style={{ cursor: "pointer" }}
              onClick={() => setLightboxAcik(true)}
              title="Büyütmek için tıkla"
            >
              <div className="af-kurdele">👑 Ayın Fikri · {orta.ay}</div>
              <div className="af-emoji">{orta.emoji}</div>
              <div className="af-ad">{orta.ad}</div>
              <div className="af-okul">{orta.okul}</div>
              <div className="af-tema">{orta.tema}</div>
              <div className="af-soz">{orta.soz}</div>
            </div>

            <div className="af-kart af-kenar-kart" id="af-sag">
              <div className="af-k-emoji">{sag.emoji}</div>
              <div className="af-k-ad">{sag.ad}</div>
              <div className="af-k-okul">{sag.okul}</div>
              <div className="af-k-tema">{sag.tema}</div>
              <div className="af-k-soz">{sag.soz}</div>
            </div>

            <button
              className="af-ok af-ok-sol"
              type="button"
              aria-label="Önceki"
              onClick={() => setAktif((deger) => (deger - 1 + n) % n)}
            >
              ‹
            </button>
            <button
              className="af-ok af-ok-sag"
              type="button"
              aria-label="Sonraki"
              onClick={() => setAktif((deger) => (deger + 1) % n)}
            >
              ›
            </button>
          </div>

          <div className="af-noktalar">
            {kazananlar.map((_, indeks) => (
              <i
                key={indeks}
                className={indeks === aktif ? "aktif" : ""}
                onClick={() => setAktif(indeks)}
              />
            ))}
          </div>

          <a className="cta-fikir" href="/fikir">
            <span className="cta-ikon">✏️</span>
            <span className="cta-metin">Fikrini Yaz &amp; Paylaş</span>
            <svg className="cta-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h14" /><path d="M13 6l6 6-6 6" /></svg>
          </a>
        </div>

        {lightboxAcik && (
          <div
            className="af-lightbox"
            onClick={(olay) => {
              if (olay.target === olay.currentTarget) {
                setLightboxAcik(false);
                setAktif((deger) => (deger + 1) % n);
              }
            }}
          >
            <button
              type="button"
              className="af-lb-kapat"
              aria-label="Kapat"
              onClick={() => {
                setLightboxAcik(false);
                setAktif((deger) => (deger + 1) % n);
              }}
            >
              ✕
            </button>
            <div className="af-kart af-orta">
              <div className="af-kurdele">👑 Ayın Fikri · {orta.ay}</div>
              <div className="af-emoji">{orta.emoji}</div>
              <div className="af-ad">{orta.ad}</div>
              <div className="af-okul">{orta.okul}</div>
              <div className="af-tema">{orta.tema}</div>
              <div className="af-soz">{orta.soz}</div>
            </div>
          </div>
        )}

        <div className="ozellikler" style={{ marginTop: "2.4rem", paddingBottom: "1.6rem" }}>
          <button className="ozellik ozellik-arsiv" type="button" onClick={() => setArsivAcik(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v4a5 5 0 0 1-10 0z" /><path d="M17 5h3a1 1 0 0 1 1 1c0 2-1.5 3.5-3.5 3.5" /><path d="M7 5H4a1 1 0 0 0-1 1c0 2 1.5 3.5 3.5 3.5" /></svg>
            Ayın Fikri Arşivi
          </button>
          <button
            className="ozellik ozellik-yetkili"
            type="button"
            onClick={() => setYetkiliGirisAcik(true)}
            aria-label="Yetkili Girişi — İl AR-GE ve Bakanlık hesapları için"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Yetkili Girişi
          </button>
        </div>

        {arsivAcik && (
          <div
            className="arsiv-modal"
            onClick={(olay) => {
              if (olay.target === olay.currentTarget) setArsivAcik(false);
            }}
          >
            <div className="arsiv-icerik">
              <button className="arsiv-kapat" type="button" aria-label="Kapat" onClick={() => setArsivAcik(false)}>✕</button>
              <h2>🏆 Ayın Fikri Arşivi</h2>
              <p className="arsiv-alt">Önceki aylarda seçilen kazanan fikirler</p>
              <div className="arsiv-zaman">
                <div className="ay-kart">
                  <div className="ay-etiket">Ağustos 2026</div>
                  <div className="ay-kazanan">🔬 Zeynep Kaya</div>
                  <div className="ay-okul">Atatürk Anadolu Lisesi · Bornova</div>
                  <div className="ay-tema">Sosyal Fayda</div>
                  <div className="ay-fikir-giris">"Okul bahçemize güneş enerjili akıllı sulama sistemi kuralım; bitkiler telefondan sulansın."</div>
                </div>
                <div className="ay-kart">
                  <div className="ay-etiket">Temmuz 2026</div>
                  <div className="ay-kazanan">🤝 Defne Arslan</div>
                  <div className="ay-okul">Fatih Sultan Mehmet Ortaokulu · Gaziemir</div>
                  <div className="ay-tema">Sosyal Sorumluluk</div>
                  <div className="ay-fikir-giris">"Huzurevindeki dedelerimize ve ninelerimize mektup yazalım, her ay onları ziyaret edelim."</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <YetkiliGirisModal
        acik={yetkiliGirisAcik}
        onKapat={() => setYetkiliGirisAcik(false)}
      />
    </>
  );
}

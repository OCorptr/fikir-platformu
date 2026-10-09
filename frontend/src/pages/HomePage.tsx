import { useEffect, useState } from "react";
import { YetkiliGirisModal } from "../components/YetkiliGirisModal";
import { me } from "../services/auth";
import { fullPageNav } from "../components/YetkiliPanelSecim";
import { sessionForContext } from "../types";
import {
  anasayfaDonemleri,
  ayinFikirleriGetir,
  donemAralik,
  kazananDonemler,
  kategoriEmoji,
  type AyinFikirleriCevabi,
  type DonemKaydi,
} from "../services/ayinFikirleri";

/**
 * Sprint 11.92 — "Ayın Fikirleri" artık gerçek veriden geliyor.
 *
 * ÖNCE (Onur, 9 Eki 2026): "Şu anda Ekim ayına geçmişiz ama ana sayfada Dönenler
 * tamamen yanlış… sanki her ay seçmişiz gibi bir hata var." → Bu bileşen hiç API
 * çağırmıyordu; 5 sahte kayıt ve ay etiketleri dosyanın içinde yazılıydı.
 *
 * KURAL (Onur, 9 Eki 2026): Kategori başına 1 aday BAKANLIĞA gider, bakanlık
 * adaylar arasından 1'ini seçer. **Anasayfa adayları değil, sadece kazananı
 * yayınlar** — aktif dönem ve geçmiş 2 dönem. Arşivde tüm dönemler listelenir.
 *
 * Veri yoksa sahte içerik gösterilmez; dürüst bir boş durum gösterilir.
 */
export function HomePage() {
  const [aktif, setAktif] = useState(0);
  const [arsivAcik, setArsivAcik] = useState(false);
  const [lightboxAcik, setLightboxAcik] = useState(false);
  const [veri, setVeri] = useState<AyinFikirleriCevabi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [veriHatasi, setVeriHatasi] = useState<string | null>(null);

  // Sprint 11.55: `/giris` rotası ana sayfayı giriş modalı AÇIK halde gösterir.
  // Önceden bu rota tanımsızdı ve 404 dönüyordu.
  const [yetkiliGirisAcik, setYetkiliGirisAcik] = useState(
    () => typeof window !== "undefined" && window.location.pathname === "/giris",
  );

  // Onur (S11.87): "Fikrini Yaz & Paylaş" butonuna tıklayınca doğrudan
  // Yetkili Giriş'e tıkladığımda çıkan yönlendirme popup'ı çıksun… sen gitmişsen
  // saçma sapan /fikir sayfasına yönlendirip o sayfada yazıyorsun buna gerek yok."
  //
  // province yetkiyi taşır: il yöneticisi ve değerlendiricisi de "yönetici"dir.
  const [yetkiliOturum, setYetkiliOturum] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((cevap) => {
        setYetkiliOturum(
          Boolean(
            sessionForContext(cevap, "province") ?? sessionForContext(cevap, "ministry"),
          ),
        );
      })
      // Oturum okunamazsa CTA eskisi gibi /fikir'e gitsin — tahmin etmeyelim.
      .catch(() => setYetkiliOturum(false));
    return () => controller.abort();
  }, [yetkiliGirisAcik]);

  // Gerçek "Ayın Fikirleri" — anonim uç.
  useEffect(() => {
    const controller = new AbortController();
    ayinFikirleriGetir(controller.signal)
      .then(setVeri)
      .catch(() => setVeriHatasi("Dönem bilgisi alınamadı."))
      .finally(() => setYukleniyor(false));
    return () => controller.abort();
  }, []);

  // CTA davranışı: yönetici → panel seçimi modalı, diğer herkes → /fikir.
  function ctaTiklandi() {
    if (yetkiliOturum) {
      setYetkiliGirisAcik(true);
      return;
    }
    fullPageNav("/fikir");
  }

  // Anasayfa: aktif dönem + geçmiş 2 dönemin KAZANANLARI (adaylar değil).
  const onekiler: DonemKaydi[] = veri ? anasayfaDonemleri(veri) : [];
  const arsiv: DonemKaydi[] = veri ? kazananDonemler(veri) : [];
  const n = onekiler.length;
  const veriVar = n > 0;

  useEffect(() => {
    if (!veriVar) return;
    // Sprint 11.92: büyütme (lightbox) açıkken otomatik geçiş DURMALI.
    // Onur: "ortadaki karta tıklıyorum açılır açılmaz kart değişiyor,
    // neye tıkladıysak o açılmalı." — 6 saniyede bir dönen tur, tıklanan
    // kartı lightbox içinde başka bir kartla değiştiriyordu.
    if (lightboxAcik) return;
    const zaman = setInterval(() => setAktif((d) => (d + 1) % n), 6000);
    return () => clearInterval(zaman);
  }, [veriVar, n, lightboxAcik]);

  useEffect(() => {
    if (aktif >= n) setAktif(0);
  }, [n, aktif]);

  const aktifDonemEtiketi = veri?.aktifDonem?.etiket ?? "";

  const sol = veriVar ? onekiler[(aktif - 1 + n) % n] : null;
  const orta = veriVar ? onekiler[aktif] : null;
  const sag = veriVar ? onekiler[(aktif + 1) % n] : null;

  /**
   * Adı baş harflere indirger: "Elif Y." → "E. Y."
   * Sprint 11.92 — Onur: yan kartlarda isim eksik görünsün, ortada tam görünsün.
   */
  function kisaAd(ad: string): string {
    return (ad ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((parca) => (parca.length <= 1 ? parca : `${parca[0]}.`))
      .join(" ");
  }

  /** Yan kartlarda metni kısaltır; ortadaki kartta tam metin kalır. */
  function kisalt(metin: string, enFazla: number): string {
    const s = (metin ?? "").trim();
    if (s.length <= enFazla) return s;
    const kes = s.slice(0, enFazla);
    const son = kes.lastIndexOf(" ");
    return `${(son > enFazla * 0.6 ? kes.slice(0, son) : kes).trimEnd()}…`;
  }

  /** Kart gövdesi — hem karusel hem lightbox aynı yapı.
   *  `buyuk=true` → ortadaki kart ve lightbox (tam bilgi)
   *  `buyuk=false` → sol/sağ kenar kartı (kısaltılmış) */
  function kartIcerigi(kayit: DonemKaydi | null, buyuk: boolean) {
    if (!kayit?.kazanan) return null;
    const k = kayit.kazanan;
    const ad = buyuk ? k.ogrenci : kisaAd(k.ogrenci);
    const metin = buyuk ? k.fikir : kisalt(k.fikir, 60);
    return (
      <>
        <div className={buyuk ? "af-emoji" : "af-k-emoji"}>{kategoriEmoji(k.kategori)}</div>
        <div className={buyuk ? "af-ad" : "af-k-ad"}>{ad}</div>
        <div className={buyuk ? "af-okul" : "af-k-okul"}>{k.il}</div>
        <div className={buyuk ? "af-tema" : "af-k-tema"}>{k.kategori}</div>
        <div className={buyuk ? "af-soz" : "af-k-soz"}>&quot;{metin}&quot;</div>
      </>
    );
  }

  const kurdele = (kayit: DonemKaydi | null) =>
    kayit ? `👑 Ayın Fikri · ${donemAralik(kayit)}` : "";

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
            <span className="af-cizgi"></span>🏆 Ayın Fikirleri
            {aktifDonemEtiketi ? ` · ${aktifDonemEtiketi}` : ""}
            <span className="af-cizgi"></span>
          </div>

          {veriVar ? (
            <>
              <div className="af-sahne">
                <div className="af-kart af-kenar-kart" id="af-sol">
                  {kartIcerigi(sol, false)}
                </div>

                <div
                  className="af-kart af-orta"
                  id="af-orta"
                  style={{ cursor: "pointer" }}
                  onClick={() => setLightboxAcik(true)}
                  title="Büyütmek için tıkla"
                >
                  <div className="af-kurdele">{kurdele(orta)}</div>
                  {kartIcerigi(orta, true)}
                </div>

                <div className="af-kart af-kenar-kart" id="af-sag">
                  {kartIcerigi(sag, false)}
                </div>

                <button
                  className="af-ok af-ok-sol"
                  type="button"
                  aria-label="Önceki"
                  onClick={() => setAktif((d) => (d - 1 + n) % n)}
                >
                  ‹
                </button>
                <button
                  className="af-ok af-ok-sag"
                  type="button"
                  aria-label="Sonraki"
                  onClick={() => setAktif((d) => (d + 1) % n)}
                >
                  ›
                </button>
              </div>

              <div className="af-noktalar">
                {onekiler.map((kayit) => (
                  <i
                    key={kayit.id}
                    className={kayit.id === orta?.id ? "aktif" : ""}
                    onClick={() => setAktif(onekiler.findIndex((k) => k.id === kayit.id))}
                  />
                ))}
              </div>
            </>
          ) : (
            // Veri yokken sahte kart göstermiyoruz (Sprint 11.92).
            <div className="af-bos">
              <p>
                {yukleniyor
                  ? "Dönem bilgisi yükleniyor…"
                  : veriHatasi
                    ? "Dönem bilgisi alınamadı. Lütfen daha sonra tekrar deneyin."
                    : aktifDonemEtiketi
                      ? `${aktifDonemEtiketi} için bakanlık değerlendirmesi sürüyor. Seçilen fikir burada görünecek.`
                      : "İlk dönem değerlendirmesi yakında burada görünecek."}
              </p>
            </div>
          )}

          <button type="button" className="cta-fikir" onClick={ctaTiklandi}>
            <span className="cta-ikon">✏️</span>
            <span className="cta-metin">Fikrini Yaz &amp; Paylaş</span>
            <svg className="cta-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h14" /><path d="M13 6l6 6-6 6" /></svg>
          </button>
        </div>

        {lightboxAcik && orta && (
          <div
            className="af-lightbox"
            onClick={(olay) => {
              if (olay.target === olay.currentTarget) {
                setLightboxAcik(false);
                setAktif((d) => (d + 1) % n);
              }
            }}
          >
            <button
              type="button"
              className="af-lb-kapat"
              aria-label="Kapat"
              onClick={() => {
                setLightboxAcik(false);
                setAktif((d) => (d + 1) % n);
              }}
            >
              ✕
            </button>
            <div className="af-kart af-orta">
              <div className="af-kurdele">{kurdele(orta)}</div>
              {/* Sprint 11.92: kaydırma kutusu İÇERİDE. Kaydırma kartın
                  kendisinde olursa başlık şeridini (kartın dışına taşan
                  absolute öğe) o da kırpıyordu. */}
              <div className="af-lb-govde">{kartIcerigi(orta, true)}</div>
            </div>
          </div>
        )}

        <div className="ozellikler" style={{ marginTop: "1.2rem", paddingBottom: "0.8rem" }}>
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
              <p className="arsiv-alt">Bakanlığın seçtiği tüm kazanan fikirler</p>
              <div className="arsiv-zaman">
                {arsiv.length === 0 && (
                  <p className="arsiv-bos">Henüz seçilmiş bir kazanan fikir yok.</p>
                )}
                {arsiv.map((kayit) => (
                  <div className="ay-kart" key={kayit.id}>
                    <div className="ay-etiket">{donemAralik(kayit)}</div>
                    <div className="ay-kazanan">
                      {kategoriEmoji(kayit.kazanan!.kategori)} {kayit.kazanan!.ogrenci}
                    </div>
                    <div className="ay-okul">{kayit.kazanan!.il}</div>
                    <div className="ay-tema">{kayit.kazanan!.kategori}</div>
                    <div className="ay-fikir-giris">&quot;{kayit.kazanan!.fikir}&quot;</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <YetkiliGirisModal
        acik={yetkiliGirisAcik}
        onKapat={() => {
          setYetkiliGirisAcik(false);
          // `/giris` üzerinden gelindiyse adres çubuğu ana sayfaya dönsün,
          // aksi halde modal kapandığında `/giris` yazmaya devam ederdi.
          if (typeof window !== "undefined" && window.location.pathname === "/giris") {
            window.history.replaceState(null, "", "/");
          }
        }}
      />
    </>
  );
}

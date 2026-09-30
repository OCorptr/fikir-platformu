// MFA login sayfası (Sprint 10 — method-aware + method-choice UI).
// İki adım:
//   1) SEÇİM: kullanıcı yöntem seçer (Authenticator / E-posta).
//   2) GİRİŞ: seçilen yöntem için 6 haneli kod input.
// Kayıtlı yöntem "önerilen" rozetiyle işaretlenir (useEffect).
//
// Koruma: giriş yapmamış kullanıcı bu sayfayı açamaz.
// Kullanıcı /me veya /api/auth/mfa/method 401/403 alırsa /giris'e
// yönlendirilir (Yetkili Girişi modalı orada açılır).
//
// Deployment test (Sprint 10.7): yeni bundle hash çıkması için
// canonical değişiklik.

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiHttpError } from "../services/api";
import { logout, mfaCancel, mfaGetMethod, mfaLoginVerify, mfaSendEmailOtp } from "../services/auth";

/* Deployment test (Sprint 10.7) */

type Method = "Totp" | "Email" | "Bilinmiyor";
type Ekran = "secim" | "giris";

// 401/403 = authenticated değil veya MFA cookie'si yok → /giris'e at.
// Onur feedback: giriş yapmamış kullanıcı bu sayfayı açamamalı.
function authHatasiMi(hata: unknown): boolean {
  return hata instanceof ApiHttpError && (hata.status === 401 || hata.status === 403);
}

// Sprint 10.7 deployment marker — bundle hash should be different from Bpou4Cts

export function MfaLoginPage() {
  const navigate = useNavigate();
  const [ekran, setEkran] = useState<Ekran>("secim");
  const [kayitliYontem, setKayitliYontem] = useState<Method | null>(null);
  const [seciliYontem, setSeciliYontem] = useState<Method | null>(null);
  const [kod, setKod] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [emailGonderildi, setEmailGonderildi] = useState(false);
  const [gonderimHatasi, setGonderimHatasi] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0); // saniye
  const [providerReady, setProviderReady] = useState(true);
  // Sprint 11.66: needsGmailOAuth bu ekranda artık kullanılmıyor. Gmail token
  // sistem genelinde tek göndericide (ortam değişkeni) tutuluyor; kurumsal
  // Google OAuth yalnızca /admin/oauth sayfasında yapılandırılır. Bkz.
  // yontemSec() içindeki açıklama.
  // Onur feedback (Sprint 10.7+): initial state TRUE. /method cevabı gelene
  // kadar form render ETME — yoksa PreMfa cookie yokken bile sayfa açılıyor
  // (1-2 frame flash) ve Çıkış - Ana Sayfa sonrası URL'den yazınca yine
  // giriyor (gerçekten giriyor, sadece sonra yönlendiriliyor).
  const [yukleniyor, setYukleniyor] = useState(true);

  // Sayfa açıldığında: PreMfa cookie'si var mı? Backend'e method sor.
  // 401/403 → kullanıcı authenticated değil veya MFA cookie süresi dolmuş
  // → /giris'e yönlendir.
  //
  // Onur feedback (Sprint 10.7+): cookie client-side kontrol — yoksa
  // backend'e hiç gitme, sayfa ASLA açılmamalı. "Çıkış - Ana Sayfa"
  // sonrası URL'den yazınca bile spinner göstermeden direkt /giris'e at.
  useEffect(() => {
    const controller = new AbortController();
    mfaGetMethod()
      .then((m) => {
        const yontem: Method = m.method === "Email" ? "Email" : "Totp";
        setKayitliYontem(yontem);
        // Onur feedback (Sprint 10.5): Gmail OAuth handshake durumunu da al.
        if (typeof m.providerReady === "boolean") setProviderReady(m.providerReady);
        setYukleniyor(false);
      })
      .catch((e) => {
        if (authHatasiMi(e)) {
          // 401/403 = PreMfa cookie yok / süresi dolmuş → /. SPA nav
          // Modal içinde bozulduğu için window.location kullanıyoruz.
          window.location.href = "/";
          return;
        }
        // Ağ hatası vb. → seçim ekranı yine de açılsın (rozet olmadan).
        setKayitliYontem(null);
        setYukleniyor(false);
      });
    return () => controller.abort();
  }, []);

  // Onur feedback (Sprint 10.7+++): OAuth handshake mount anında OTOMATİK
  // TETIKLENMEMELI — kullanıcı önce TOTP (Authenticator) ya da E-posta seçimini
  // yapar. E-posta seçince handshake tetiklenir (yontemSec handler'ında).
  // Yoksa TOTP seçecek kullanıcının mail gönderim kutusunu doldurmak istemedigi
  // halde OAuth flow'a yönlendirilmesi kötü UX.

  // Cooldown geri sayım
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function yontemSec(yontem: Method) {
    // Sprint 11.66 (Onur): "E-posta seçeneğini seçince hem otp kurma çıkıyor
    // önce sonra değişip otp kod yollama çıkıyor, burada bug var, direk doğru
    // olan kısım çıkmalı."
    //
    // Sebep: burada `needsGmailOAuth` doğruysa kullanıcı Google OAuth ekranına
    // atılıyordu. Sprint 11.51'de Gmail refresh token'ı "her kullanıcıya bağla"
    // modelinden "sistem genelinde tek gönderici" modeline taşındı; DB tablosu
    // düşürüldü, token artık ortam değişkeninden okunuyor. Bu yönlendirme o
    // eski modelden kalma bir artıktı.
    //
    // Doğrusu: E-posta seçilince doğrudan kod ekranına geç, OTP'yi gönder.
    // Gönderilemezse gerçek hata mesajı gösterilir. Kurumsal Google OAuth
    // yalnızca /admin/oauth (E-posta Ayarları) sayfasında anlamlıdır.
    setSeciliYontem(yontem);
    setKod("");
    setHata(null);
    setGonderimHatasi(null);
    setEmailGonderildi(false);
    setEkran("giris");
    // Email seçildiyse otomatik OTP gönder.
    if (yontem === "Email") {
      void emailOtpGonder(true);
    }
  }

  function geriDonSecim() {
    setEkran("secim");
    setSeciliYontem(null);
    setKod("");
    setHata(null);
    setGonderimHatasi(null);
    setEmailGonderildi(false);
    setCooldown(0);
  }

  // 'Çıkış - Ana Sayfa' — MFA akışını iptal et, PreMfa cookie'yi temizle,
  // VARSAKİ PANEL OTURUMUNU DA kapat ve ana sayfaya dön.
  //
  // S11.91 (Onur): "Çıkış butonu sadece anasayfaya yönlendiriyor, logout olmuyor."
  // Kök neden: burada sadece mfaCancel() çağrılıyordu. O yalnızca PreMfa
  // cookie'sini siler; kullanıcının zaten açık olan il/bakanlık/öğrenci oturumu
  // hayatta kalıyor ve anasayfada hâlâ girişli görünüyordu.
  async function handleCikis() {
    setCalisiyor(true);
    try {
      // 1) Yarım kalan MFA oturumunu iptal et.
      await mfaCancel();
    } catch {
      // Sessizce yut — kullanıcı zaten çıkmak istiyor, hata gösterme.
    }
    try {
      // 2) Açık olan TÜM panel oturumlarını kapat (role parametresi yok
      //    → backend üç scheme'in cookie'sini de siler).
      await logout();
    } catch {
      // Sunucu hata verse bile ana sayfaya git.
    } finally {
      navigate("/", { replace: true });
      setCalisiyor(false);
    }
  }

  async function emailOtpGonder(ilkGonderim: boolean): Promise<boolean> {
    setCalisiyor(true);
    setGonderimHatasi(null);
    try {
      const cevap = await mfaSendEmailOtp();
      setEmailGonderildi(true);
      // Development modunda backend kodu response'a koyar; ekranda göster.
      // SMTP'li üretimde devCode=null gelir, hiç gösterilmez.
      if (cevap.devCode) {
        setKod(cevap.devCode);
      }
      if (!ilkGonderim) setCooldown(60);
      return true;
    } catch (e) {
      if (authHatasiMi(e)) {
        navigate("/", { replace: true });
        return false;
      }
      setGonderimHatasi(
        e instanceof ApiHttpError ? e.message : "Kod gönderilemedi, tekrar deneyin."
      );
      return false;
    } finally {
      setCalisiyor(false);
    }
  }

  async function handleTekrarGonder() {
    if (cooldown > 0) return;
    await emailOtpGonder(false);
  }

  async function handleOnayla(olay: FormEvent) {
    olay.preventDefault();
    if (!/^\d{6}$/.test(kod)) {
      setHata("6 haneli sayısal kod girin.");
      return;
    }
    setCalisiyor(true);
    setHata(null);
    try {
      const sonuc = await mfaLoginVerify(kod);
      // Sprint 11.14: Sistem Yöneticisi /admin'e yönlendirilir.
      const sistemAdminMi = sonuc.roles?.includes("SystemAdmin") ?? false;
      if (sistemAdminMi) {
        navigate("/admin", { replace: true });
        return;
      }
      const ctx = sonuc.context ?? "student";
      if (ctx === "ministry") navigate("/bakanlik");
      else if (ctx === "province") navigate("/il-panel");
      else navigate("/fikir");
    } catch (e) {
      if (authHatasiMi(e)) {
        navigate("/", { replace: true });
        return;
      }
      setHata(e instanceof ApiHttpError ? e.message : "Kod doğrulanamadı.");
    } finally {
      setCalisiyor(false);
    }
  }

  // === YÜKLENİYOR (auth kontrol ediliyor) ===
  // Onur feedback (Sprint 10.7+): /method cevabı gelmeden form render
  // ETME. PreMfa cookie yoksa 401 → /giris'e yönlendirilecek; bu ekran
  // kullanıcıya hiç gösterilmemeli (race condition + form flash yok).
  if (yukleniyor) {
    return (
      <main className="sayfa-ortak">
        <div className="mfa-login">
        <p className="mfa-aciklama">Oturum kontrol ediliyor…</p>
      </div>
      </main>
    );
  }

  // === SEÇİM EKRANI ===
  if (ekran === "secim") {
    return (
      <main className="sayfa-ortak">
        <div className="mfa-login mfa-secim">
        <h1>🔐 İki adımlı doğrulama</h1>
        <p className="mfa-aciklama">
          Girişinizi tamamlamak için bir doğrulama yöntemi seçin.
        </p>

        <div className="mfa-yontem-secim">
          <button
            type="button"
            className={`mfa-yontem-kart${kayitliYontem === "Totp" ? " onerilen" : ""}`}
            onClick={() => yontemSec("Totp")}
          >
            <span className="mfa-yontem-ikon">📱</span>
            <span className="mfa-yontem-baslik">Authenticator Uygulaması</span>
            <span className="mfa-yontem-aciklama">
              Telefonunuzdaki Google Authenticator / Microsoft Authenticator
              uygulamasında görünen 6 haneli kodu girin.
            </span>
            {kayitliYontem === "Totp" && (
              <span className="mfa-yontem-rozet">Önerilen</span>
            )}
          </button>

          <button
            type="button"
            className={`mfa-yontem-kart${kayitliYontem === "Email" ? " onerilen" : ""}`}
            onClick={() => yontemSec("Email")}
          >
            <span className="mfa-yontem-ikon">📧</span>
            <span className="mfa-yontem-baslik">E-posta kodu</span>
            <span className="mfa-yontem-aciklama">
              E-posta adresinize 6 haneli bir kod gönderelim (5 dakika geçerli).
            </span>
            {kayitliYontem === "Email" && (
              <span className="mfa-yontem-rozet">Önerilen</span>
            )}
          </button>
        </div>

        <button type="button" className="btn-link" onClick={handleCikis} disabled={calisiyor}>
          {calisiyor ? "Çıkış yapılıyor…" : "Çıkış - Ana Sayfa"}
        </button>
      </div>
      </main>
    );
  }

  // === GİRİŞ EKRANI ===
  const emailModu = seciliYontem === "Email";
  // Onur (S11.70): "mfa-login sayfası açıldığında önce E-posta hazırlama diye
  // bir ekran görünüyor sonra E-posta doğrulama ekranı çıkıyor, bug var."
  //
  // Sebep: `emailGonderildi` başta false. setEkran("giris") ile OTP isteği
  // arasında geçen ~1 saniyede alt başlık "E-posta kodu hazırlanıyor…"
  // yazıyor, cevap gelince "gönderdik"ye dönüyor. Kullanıcı iki ayrı ekran
  // gördüğünü sanıyor — aslında aynı ekranın iki durumu.
  //
  // Düzeltme: iki ayrı metin yerine TEK sabit metin. Gönderim sürerken
  // durum yalnızca gönder butonunda görünür, kod alanı pasif kalır.
  const baslik = emailModu ? "📧 E-posta doğrulama" : "📱 Authenticator kodu";
  const aciklama = emailModu
    ? "E-posta adresinize 6 haneli kod gönderdik. Kodu aşağıya girin."
    : "Authenticator uygulamanızda görünen 6 haneli kodu girin.";
  // Kod henüz gönderilmediyse giriş denemesi anlamsız — input kilitli.
  const kodGonderiliyor = emailModu && !emailGonderildi;

  return (
    <main className="sayfa-ortak">
        <div className="mfa-login mfa-giris">
      <h1>{baslik}</h1>
      <p className="mfa-aciklama">{aciklama}</p>

      {/* Onur feedback (Sprint 10.4): Demo banner kaldırıldı.
          Kod otomatik input'a yazılsa bile kullanıcı "Demo" yazısını görmesin.
          Gerekmez — Production SMTP aktifse zaten bu blok render edilmez.
          devCode kullanımı input auto-fill için kullanılır, banner için değil. */}

      <form className="mfa-form" onSubmit={handleOnayla}>
        <label className="mfa-alan">
          <span>Doğrulama kodu</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
            required
            disabled={kodGonderiliyor}
            value={kod}
            onChange={(e) => setKod(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
          />
        </label>
        {hata && (
          <div className="durum-banner durum-banner--hata" role="alert">
            <span>{hata}</span>
          </div>
        )}
        <button
          type="submit"
          className="btn-ana"
          disabled={calisiyor || kodGonderiliyor}
        >
          {kodGonderiliyor
            ? "Kod gönderiliyor…"
            : calisiyor
              ? "Doğrulanıyor…"
              : "Giriş yap"}
        </button>
      </form>

      <div className="mfa-yontem-yardimci">
        {emailModu && (
          <button
            type="button"
            className="btn-link"
            onClick={handleTekrarGonder}
            disabled={cooldown > 0 || calisiyor}
          >
            {cooldown > 0
              ? `Kodu tekrar gönder (${cooldown}sn)`
              : "Kodu tekrar gönder"}
          </button>
        )}
        {gonderimHatasi && (
          <div
            className="durum-banner durum-banner--hata"
            role="alert"
            style={{ marginTop: "0.6rem" }}
          >
            <span>{gonderimHatasi}</span>
          </div>
        )}
        <button type="button" className="btn-link" onClick={geriDonSecim}>
          ← Yöntem seçimine dön
        </button>
      </div>
    </div>
      </main>
  );
}

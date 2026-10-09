// /fikir — Aşama 3 frontend.
// Oturum yoksa AuthModal açılır (kapatılamaz); giriş/kayıt sonrası forma ulaşılır.
// Kategori + fikir metni yeterli — öğrenci bilgileri (il/okul/sınıf) backend profilinden alınır.

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthModal } from "../components/AuthModal";
import { ApiHttpError } from "../services/api";
import { getCategories } from "../services/references";
import {
  deleteIdea,
  getMyIdea,
  listMyIdeas,
  getPublishConsent,
  setPublishConsent,
  saveDraft,
  submitIdea,
  updateDraft,
} from "../services/ideas";
import { logout, me } from "../services/auth";
import { FikirAsamaCizgisi } from "../components/FikirAsamaCizgisi";
import { durumOzeti } from "../services/fikirAsamalari";
import {
  YetkiliPanelSecenekleri,
  fullPageNav,
  rolEtiketi,
} from "../components/YetkiliPanelSecim";
import {
  type CategoryRef,
  type MeSession,
  sessionForContext,
  type StudentIdeaDto,
} from "../types";

const MAX_KARAKTER = 1500;

// Kategori adina gore emoji prefix (referans fikir.html ile ayni ikonlar)
function kategoriEmoji(ad: string): string {
  if (ad.includes("Kültür") || ad.includes("Sanat")) return "🎨";
  if (ad.includes("Spor")) return "⚽";
  if (ad.includes("Bilim") || ad.includes("Teknoloji")) return "🔬";
  if (ad.includes("Yapay Zek")) return "🤖";
  if (ad.includes("Çevre")) return "🌱";
  if (ad.includes("Sosyal")) return "🤝";
  if (ad.includes("Girişimcilik")) return "💡";
  if (ad.includes("Afet")) return "🚨";
  if (ad.includes("Değerler")) return "📖";
  if (ad.includes("Yerli") || ad.includes("Mill")) return "🏭";
  return "🎨";
}

export default function FikirPage() {
  // oturum (öğrenci context'i)
  const [ben, setBen] = useState<MeSession | null>(null);
  const [kimlikKontrolEdildi, setKimlikKontrolEdildi] = useState(false);
  const [authAcik, setAuthAcik] = useState(false);
  // Onur (S11.86): "herhangi bir yönetici login durumunda iken /fikir sayfasına
  // giremez... Öğrenci kısmına ancak öğrenci hesabı ile giriş yapılır."
  //
  // SEBEP: Kontrol yalnızca student session'a bakıyordu. Yönetici oturumunda
  // student session yok → modal açılıyordu ama `arkadaMi` (kapatılabilir,
  // arkada görünen) olduğu için öğrenci sayfası EKRANDA KALIYORDU.
  // Kullanıcı modalı kapatıp öğrenci fikir ekranını kullanabiliyordu.
  // Ayrıca ProvinceManager/ProvinceEvaluator rollü bir kişi İL YÖNETİCİ
  // olduğu için yönetici sayılır.
  const [yetkiliRoller, setYetkiliRoller] = useState<string[] | null>(null);
  // AuthModal sekmesi (giris / kayit / dogrulamaBekleniyor) - maskot balonu buna gore guncellenir
  const [authMod, setAuthMod] = useState<"giris" | "kayit" | "dogrulamaBekleniyor">("giris");
  function balonYazisi(m: "giris" | "kayit" | "dogrulamaBekleniyor") {
    // Sprint 11.92 (araştırmaya dayalı düzeltmeler):
    //  · "hesabınla giriş yap" / "hesap oluştur" → butonlarla AYNI terimler
    //    ("Giriş Yap" / "Kayıt Ol"). Çocuk "hesap oluştur" deyip butonu arıyordu.
    //  · "Birkaç saniye sürer!" KALDIRILDI: e-posta doğrulaması saniyeler değil
    //    dakikalar sürer ve kullanıcının kontrolünde değildir → yanlış gelecek vaadi.
    //  · Spam'a düşme ihtimaline karşı çıkış yolu verildi.
    if (m === "giris") return <>Merhaba! Fikrini yazmadan önce <b>Giriş Yap</b> ya da <b>Kayıt Ol</b>. Sıra sende! 🖐</>;
    if (m === "kayit") return <>Yeni misin? <b>Kayıt Ol</b>, e-postanı doğrula, sonra fikrini yaz. E-posta gelince geri dönebilirsin. 🚀</>;
    return <>E-posta kutunu kontrol et! 🎉 Spam'a düşmüş olabilir. Gelenmezse <b>Geri al</b> klasörüne de bak.</>;
  }


  const [yayimRizasiVar, setYayimRizasiVar] = useState(false);
  const [yayimCalisiyor, setYayimCalisiyor] = useState(false);
  const [yayimMesaji, setYayimMesaji] = useState<string | null>(null);

  /** KVKK md.3 — açık rıza her zaman geri alınabilir. */
  async function yayimRizasiDegistir(yeniDeger: boolean) {
    if (!yeniDeger && !confirm(
      "Yayımlama iznini geri çekmek istediğine emin misin?\n\n" +
      "Fikrin değerlendirmeye devam eder, ancak artık ana sayfada görünmez.",
    )) return;
    setYayimCalisiyor(true);
    setYayimMesaji(null);
    try {
      const cevap = await setPublishConsent(yeniDeger);
      setYayimRizasiVar(cevap.yayimRizasiVerildi);
      setYayimMesaji(cevap.mesaj);
    } catch (e) {
      setYayimMesaji(mesajCikar(e));
    } finally {
      setYayimCalisiyor(false);
    }
  }

  const [kategoriler, setKategoriler] = useState<CategoryRef[]>([]);
  const [taslaklar, setTaslaklar] = useState<StudentIdeaDto[]>([]);
  const gonderilenler = taslaklar.filter((t) => t.status !== "Draft");
  const yalnTaslaklar = taslaklar.filter((t) => t.status === "Draft");
  const [aktifTaslakId, setAktifTaslakId] = useState<string | null>(null);
  const [kategoriId, setKategoriId] = useState<number | "">("");
  const [fikir, setFikir] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState<"taslak" | "gonder" | "sil" | "taslakYukle" | null>(null);
  const [gonderildiEkran, setGonderildiEkran] = useState<StudentIdeaDto | null>(null);

  // Onur (S11.88): gonderilen fikrin asamasi her an gorulebilsin.
  // Onceki davranista bu bilgi yalnizca gonderim aninda gorunuyordu.
  const [seciliFikir, setSeciliFikir] = useState<StudentIdeaDto | null>(null);

  // Detay icin sunucudan taze veri cek. Liste ekranda kalmis olabilir;
  // yonetici asamayi ilerletmis olabilir.
  const [detayYukleniyor, setDetayYukleniyor] = useState(false);

  async function detaySec(fikir: StudentIdeaDto) {
    setSeciliFikir(fikir);
    setDetayYukleniyor(true);
    try {
      const taze = await getMyIdea(fikir.id);
      setSeciliFikir(taze);
      setTaslaklar((oncekiler) =>
        oncekiler.map((t) => (t.id === taze.id ? taze : t)),
      );
    } catch {
      // Sunucuya ulasilamazsa listedeki veriyle gostermeye devam et.
    } finally {
      setDetayYukleniyor(false);
    }
  }

  // 1) sayfa açılır — öğrenci oturumu kontrol et
  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((cevap) => {
        // Önce yetkili oturumu kontrol et: yönetici /fikir'e giremez.
        // province yetkiyi taşır (il yöneticisi/değerlendiricisi dahil).
        const yetkili = sessionForContext(cevap, "province") ?? sessionForContext(cevap, "ministry");
        if (yetkili) {
          setYetkiliRoller(cevap.authenticated ? (cevap.roles ?? []) : []);
          setBen(sessionForContext(cevap, "student"));
          return;
        }
        const s = sessionForContext(cevap, "student");
        setBen(s);
        if (!s) setAuthAcik(true); // /me 200 dönse bile student session yoksa modal aç
      })
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setAuthAcik(true);
        }
      })
      .finally(() => setKimlikKontrolEdildi(true));
    return () => controller.abort();
  }, []);

  // 2) oturum açıldıktan sonra — kategoriler + taslaklar + yayım rızası durumu
  useEffect(() => {
    if (!ben) return;
    const controller = new AbortController();
    setCalisiyor("taslakYukle");
    // KVKK: yayım rızası var mı? (öğrenci kendi iznini görebilmeli)
    getPublishConsent(controller.signal)
      .then((c) => setYayimRizasiVar(c.yayimRizasiVar))
      .catch(() => undefined);
    Promise.all([getCategories(controller.signal), listMyIdeas(controller.signal)])
      .then(([kategorilerCevap, taslaklarCevap]) => {
        setKategoriler(kategorilerCevap);
        setTaslaklar(taslaklarCevap);
      })
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setHata(mesajCikar(e));
        }
      })
      .finally(() => setCalisiyor(null));
    return () => controller.abort();
  }, [ben]);

  function authGuncelle() {
    setAuthAcik(false);
    setKimlikKontrolEdildi(false);
    const controller = new AbortController();
    me(controller.signal)
      .then((cevap) => {
        const s = sessionForContext(cevap, "student");
        setBen(s);
        if (!s) setAuthAcik(true);
      })
      .catch(() => setAuthAcik(true))
      .finally(() => setKimlikKontrolEdildi(true));
    return () => controller.abort();
  }

  function formuTemizle() {
    setAktifTaslakId(null);
    setKategoriId("");
    setFikir("");
    setHata(null);
    setMesaj(null);
    setGonderildiEkran(null);
  }

  async function handleTaslak(e: FormEvent) {
    e.preventDefault();
    if (!fikir.trim()) {
      setHata("Fikir boş olamaz.");
      return;
    }
    if (!kategoriId) {
      setHata("Tema seçmelisin.");
      return;
    }
    setCalisiyor("taslak");
    setHata(null);
    setMesaj(null);
    try {
      if (aktifTaslakId) {
        await updateDraft(aktifTaslakId, { categoryId: kategoriId as number, content: fikir });
        setMesaj("Taslak güncellendi.");
      } else {
        const yeni = await saveDraft({ categoryId: kategoriId as number, content: fikir });
        setAktifTaslakId((yeni as { id: string }).id);
        setMesaj("Taslak kaydedildi.");
      }
      const liste = await listMyIdeas();
      setTaslaklar(liste);
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setCalisiyor(null);
    }
  }

  async function handleGonder(e: FormEvent) {
    e.preventDefault();
    if (!fikir.trim()) {
      setHata("Fikir boş olamaz.");
      return;
    }
    if (!kategoriId) {
      setHata("Tema seçmelisin.");
      return;
    }
    setCalisiyor("gonder");
    setHata(null);
    try {
      const gonderilen = aktifTaslakId
        ? await submitIdea(aktifTaslakId)
        : await submitIdea((await saveDraft({ categoryId: kategoriId as number, content: fikir })).id);
      setGonderildiEkran(gonderilen as unknown as StudentIdeaDto);
      setMesaj("Fikrin başarıyla iletildi!");
      setAktifTaslakId(null);
      const liste = await listMyIdeas();
      setTaslaklar(liste);
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setCalisiyor(null);
    }
  }

  async function handleTaslakSil(id: string) {
    if (!confirm("Bu taslağı silmek istediğine emin misin?")) return;
    setCalisiyor("sil");
    setHata(null);
    try {
      await deleteIdea(id);
      if (aktifTaslakId === id) formuTemizle();
      const liste = await listMyIdeas();
      setTaslaklar(liste);
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setCalisiyor(null);
    }
  }

  function taslakSec(t: StudentIdeaDto) {
    if (t.status !== "Draft") return;
    setAktifTaslakId(t.id);
    setKategoriId(t.categoryId);
    setFikir(t.content);
    setGonderildiEkran(null);
    setMesaj(null);
    setHata(null);
  }

  const navigate = useNavigate();

  async function handleCikis() {
    try {
      await logout("student");
    } catch {
      /* yoksay */
    }
    setBen(null);
    setAuthAcik(false); // modal yeniden acilmasin - anasayfaya yonlendiriliyoruz
    setTaslaklar([]);
    setKategoriler([]);
    formuTemizle();
    navigate("/", { replace: true });
  }

  // Yükleniyor ekranı
  if (!kimlikKontrolEdildi) {
    return (
        <main className="fikir-hero fikir-hero-onplanda">
          <div className="maskot-onplan">
            <img className="maskot-fikir" src="/assets/img/gencarge_logo.webp" alt="Genç AR-GE maskotu" />
            <div className="maskot-yazi">
              Merhaba! Fikrini yazmadan önce <b>giriş yap</b> ya da <b>kayıt ol</b>.
              <br />
              <span className="maskot-yazi-alt">Sıra sende!</span>
            </div>
          </div>
        </main>
    );
  }

  // Onur (S11.86): "Öğrenci kısmına ancak öğrenci hesabı ile giriş yapılır."
  // Yönetici oturumu varsa öğrenci fikir ekranı hiç render edilmez; yerine
  // ana sayfadaki "Yetkili Girişi" ile aynı panel yönlendirme ekranı çıkar.
  if (yetkiliRoller) {
    const etiket = rolEtiketi(yetkiliRoller);
    return (
      <main className="sayfa-ortak">
        <div className="sayfa-ortak-ic">
          <section className="mfa-kart">
            <h1 className="mfa-baslik">Yetkili Paneli</h1>
            <p className="mfa-mesaj">
              {etiket
                ? `${etiket} olarak giriş yaptınız.`
                : "Bu tarayıcıda bir yetkili oturumu açık."}{" "}
              Öğrenci fikir ekranına erişmek için çıkış yapıp öğrenci hesabınızla
              giriş yapın. Aşağıdan gitmek istediğiniz panele geçebilirsiniz.
            </p>
            <div className="mfa-eylem">
              <YetkiliPanelSecenekleri roller={yetkiliRoller} onGit={fullPageNav} />
            </div>
            <button
              type="button"
              className="mfa-geri"
              onClick={async () => {
                await logout();
                window.location.href = "/";
              }}
            >
              Çıkış yap
            </button>
          </section>
        </div>
      </main>
    );
  }

  // Kimlik yoksa FORM GÖSTERİLMEZ — sadece AuthModal arka planda açılır.
  if (!ben) {
    return (
      <main className="fikir-hero">
        <div className="fikir-sol">
          <div className="balon-kapsa">
            <div className="balon">{balonYazisi(authMod)}</div>
          </div>
          <img className="maskot-fikir" src="/assets/img/gencarge_logo.webp" alt="Genç AR-GE maskotu" />
        </div>
        <AuthModal acik={authAcik} onAuthed={authGuncelle} arkadaMi onModChange={setAuthMod} />
      </main>
    );
  }

  const formIcerigi = (
    <section className={`fikir-karti ${authAcik ? "fikir-form-blur" : ""}`}>
      {seciliFikir ? (
        // Onur (S11.88): fikrin asamasi her an gorulebilsin. Gonderim sonrasi
        // ekrandaki cizgiyle ayni bilesyi kullanir - iki gorunum ayrismaz.
        <div className="fikir-detay">
          <button
            type="button"
            className="fikir-detay__kapat"
            onClick={() => setSeciliFikir(null)}
          >
            ← Fikirlerime Dön
          </button>

          <h2 className="fikir-detay__baslik">{seciliFikir.content}</h2>

          <dl className="fikir-detay__bilgi">
            <div>
              <dt>Durum</dt>
              <dd>{durumEtiketi(seciliFikir.status)}</dd>
            </div>
            <div>
              <dt>Kategori</dt>
              <dd>{seciliFikir.categoryName}</dd>
            </div>
            <div>
              <dt>İl</dt>
              <dd>{seciliFikir.provinceName}</dd>
            </div>
            <div>
              <dt>Gönderilme</dt>
              <dd>
                {seciliFikir.submittedAt
                  ? new Date(seciliFikir.submittedAt).toLocaleDateString("tr-TR")
                  : "Gönderilmedi"}
              </dd>
            </div>
          </dl>

          <p className="fikir-detay__ozet">
            {detayYukleniyor ? "Güncel durum getiriliyor…" : durumOzeti(seciliFikir.status)}
          </p>

          <FikirAsamaCizgisi durum={seciliFikir.status} yon="asagi" />
        </div>
      ) : gonderildiEkran ? (
        <div className="basari">
          <svg className="basari-tik" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="24" fill="none" stroke="#16a34a" strokeWidth="3" />
            <path d="M15 27 l7.5 7 L38 19" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <h2 style={{ color: "var(--metin-ana)", fontSize: "1.8rem" }}>Fikrin bize ulaştı!</h2>
          <p style={{ color: "var(--metin-ikincil)" }}>{mesaj ?? "Fikrinin değerlendirme sürecini buradan takip edebilirsin."}</p>
          <div className="adimlar">
            <span className="adim aktif">Gönderildi</span>
            <span className="adim">Ön Değerlendirme</span>
            <span className="adim">Komisyon İncelemesi</span>
            <span className="adim">Planlama</span>
            <span className="adim">Hayata Geçirildi</span>
          </div>
          <button type="button" className="btn-ikincil" onClick={formuTemizle}>
            Yeni Fikir Yaz
          </button>
        </div>
      ) : (
        <>
          <h1>
            <span style={{ color: "var(--metin-marka-1)" }}>Fikir</span>{" "}
            <span style={{ color: "var(--metin-marka-2)" }}>Formu</span>
          </h1>

          {mesaj && (
            <div className="status-banner status-banner--success" role="status">
              <span className="status-banner__icon">✓</span>
              <span>{mesaj}</span>
            </div>
          )}


          <form onSubmit={handleGonder} className="fikir-form">
          <div className="bolum-basligi turkuaz">1 · Temanı Seç</div>
          <select
            className="tema-secim"
            value={kategoriId}
            onChange={(e) => setKategoriId(e.target.value === "" ? "" : Number(e.target.value))}
            required
            aria-label="Tema seç"
          >
            <option value="">🎨 Bir tema seç…</option>
                {kategoriler.map((k) => (
                  <option key={k.id} value={k.id}>{kategoriEmoji(k.name)} {k.name}</option>
                ))}
              </select>

          <div className="bolum-basligi turuncu">2 · Fikrim</div>
          <div className="alan">
            <span>Fikrin ({fikir.length}/{MAX_KARAKTER})</span>
              <textarea
                className="fikir-metni"
                value={fikir}
                onChange={(e) => setFikir(e.target.value)}
                placeholder="Fikrini buraya yaz…"
                maxLength={MAX_KARAKTER}
                rows={8}
                required
              />
            </div>

            <div className="fikir-butonlar">
              <button
                type="button"
                className="btn-ikincil"
                onClick={handleTaslak}
                disabled={calisiyor === "taslak" || calisiyor === "gonder"}
              >
                {calisiyor === "taslak" ? "Kaydediliyor…" : aktifTaslakId ? "Taslağı Güncelle" : "Taslak Kaydet"}
              </button>
              <button
                type="submit"
                className="btn-ana btn-tam"
                disabled={calisiyor === "taslak" || calisiyor === "gonder"}
              >
                {calisiyor === "gonder" ? "Gönderiliyor…" : aktifTaslakId ? "Taslağı Gönder" : "Fikrimi Gönder"}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 21 3l-5 18-4.5-7.5z"/><path d="M11.5 13.5 21 3"/></svg>
              </button>
              <button
                type="button"
                className="btn-ikincil fikir-eylem-cikis"
                onClick={handleCikis}
                title="Öğrenci oturumunu kapat"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4h3.2A1.8 1.8 0 0 1 20 5.8v12.4A1.8 1.8 0 0 1 18.2 20H15"/><path d="M10 8 6 12l4 4"/><path d="M6 12h9"/></svg>
                Çıkış
              </button>
            </div>
          </form>

          {/* ===== Sprint 11.92 — KVKK: yayımlama iznini geri çek =====
              Kanun 3. madde: açık rıza her zaman geri alınabilir. Öğrenci iznini
              kendisi görebilmeli ve geri çekebilmelidir. */}
          <div className="kvkk-bolum" style={{ marginTop: "1.2rem" }}>
            <h2 style={{ fontSize: "1.05rem" }}>Fikrimin yayımlanması</h2>
            <p style={{ fontSize: "0.9rem", marginBottom: "0.7rem" }}>
              Bakanlık bir dönemde <b>Ayın Fikri</b> seçerse, adın maskelenmiş
              biçimde (<i>örn. “Elif Y.”</i>) ve fikrin ana sayfada yayımlanır.
              Bu izni istemezsen fikrin yine değerlendirilir, yalnızca
              yayımlanmaz.
            </p>
            {yayimMesaji && (
              <div className="meta" style={{ marginBottom: "0.5rem" }} role="status">
                {yayimMesaji}
              </div>
            )}
            {yayimRizasiVar ? (
              <>
                <span className="durum yesil">🟢 Yayımlama iznin var</span>
                <button
                  type="button"
                  className="btn-ikincil"
                  style={{ marginLeft: "0.6rem" }}
                  onClick={() => yayimRizasiDegistir(false)}
                  disabled={yayimCalisiyor}
                >
                  {yayimCalisiyor ? "İşleniyor…" : "İznimi geri çek"}
                </button>
              </>
            ) : (
              <>
                <span className="durum mavi">ℹ️ Yayımlama iznin yok</span>
                <button
                  type="button"
                  className="btn-ikincil"
                  style={{ marginLeft: "0.6rem" }}
                  onClick={() => yayimRizasiDegistir(true)}
                  disabled={yayimCalisiyor}
                >
                  {yayimCalisiyor ? "İşleniyor…" : "Yayımlamaya izin ver"}
                </button>
              </>
            )}
          </div>

          {gonderilenler.length > 0 && (
            <div className="taslak-listesi">
              <div className="bolum-basligi turkuaz">Gönderilmiş Fikirlerim</div>
              <ul>
                {gonderilenler.map((t) => (
                  <li key={t.id} className="fikir-oge tiklanabilir">
                    <div className="taslak-satir">
                      <span className={`durum taslak-durum taslak-durum--${t.status}`}>{durumEtiketi(t.status)}</span>
                      <span className="taslak-icerik" title={t.content}>{t.content}</span>
                      <button
                        type="button"
                        className="taslak-durum-gor"
                        onClick={() => detaySec(t)}
                        title={`${t.content} — durumunu gör`}
                        aria-label={`${t.content} fikrinin durumunu gör`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/></svg>
                        <span>Durumu</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {yalnTaslaklar.length > 0 && (
            <div className="taslak-listesi">
              <div className="bolum-basligi turuncu">Taslaklarım</div>
              <ul>
                {yalnTaslaklar.map((t) => (
                  <li key={t.id} className="taslak-oge">
                    <div className="taslak-satir">
                      <span className="taslak-icerik" title={t.content}>{t.content}</span>
                      <span className="taslak-tarih">
                        {new Date(t.createdAt).toLocaleDateString("tr-TR")}
                      </span>
                      <div className="taslak-sag">
                        <button type="button" className="taslak-islem tehlikeli" onClick={() => handleTaslakSil(t.id)}>Sil</button>
                        <button type="button" className="taslak-islem" onClick={() => taslakSec(t)}>Düzenle</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );

  return (
    <main className="fikir-hero">
      <div className="fikir-sol">
        <div className="balon-kapsa">
          <div className="balon">
            {ben
              ? <>Hoş geldin, <b>{ben.firstName}</b>! Bir <b>tema</b> seç, sonra fikrini anlat. Sıra sende! ✏️</>
              : <>Merhaba, ben Fikri! Önce bir <b>tema</b> seç, sonra fikrini anlat. Sıra sende!</>}
          </div>
        </div>
        <img className="maskot-fikir" src="/assets/img/gencarge_logo.webp" alt="Genç AR-GE maskotu" />
      </div>
      {formIcerigi}
      <AuthModal acik={authAcik} onAuthed={authGuncelle} />
    </main>
  );
}

function durumEtiketi(durum: StudentIdeaDto["status"]): string {
  switch (durum) {
    case "Draft": return "Taslak";
    case "Submitted": return "Gönderildi";
    case "InEvaluation": return "Değerlendirmede";
    case "EvaluationCompleted": return "Komisyonda";
    // "Locked" = döneme seçilmiş, yani planlama aşamasına geçmiş. Öğrenciye
    // iç durum adı ("Kilitli") gösterilmez; anlamı olan aşama adı yazılır.
    // Sprint 11.92: Locked = "il onayı verildi, dönem adayı oldu"; Planned = "bakanlık adayı seçildi".
    case "Locked": return "İl onayı alındı";
    case "Planned": return "Planlandı";
    case "ImplementationCompleted": return "Uygulandı";
    case "ImplementationFailed": return "Uygulanmadı";
    case "Deleted": return "Silindi";
  }
  // Sprint 11.92: "ImplementationInProgress" dalı satır indeksli düzenleme
  // sırasında düşmüştü; aşırı yüklemeden dönmemesi için default döndürüyoruz.
  return "Uygulamada";
}

function mesajCikar(e: unknown): string {
  if (e instanceof ApiHttpError) return e.message;
  if (e instanceof Error) return e.message;
  return "Beklenmeyen bir hata oluştu.";
}




